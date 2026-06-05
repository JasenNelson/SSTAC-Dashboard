"use client";

// engine_v2 frontend Lane 1 / Module L1-4: client-side wizard orchestrator.
// Holds step state, advances through 6 steps, and submits to
// POST /api/engine-v2/projects. On 201 redirects to the project detail route.

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ProjectMetadataStep,
  type ProjectMetadataValue,
} from "./ProjectMetadataStep";
import {
  ApplicationTypeStep,
  APPLICATION_TYPE_OPTIONS,
  type ApplicationTypeId,
} from "./ApplicationTypeStep";
import { ServiceTypeStep } from "./ServiceTypeStep";
import {
  SubmissionContextStep,
  type SubmissionContextValue,
} from "./SubmissionContextStep";
import { ApplicablePolicyStep } from "./ApplicablePolicyStep";
import { ReviewStep } from "./ReviewStep";
import { deriveMediaTypesFromServices } from "@/lib/engine-v2/service_to_media";
import type { ProposerCliOutput } from "@/lib/engine-v2/propose_policies";

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: readonly string[] = [
  "Metadata",
  "Application types",
  "Services",
  "Context",
  "Applicable policies",
  "Review",
];

interface WizardState {
  metadata: ProjectMetadataValue;
  applicationTypes: ApplicationTypeId[];
  selectedServices: string[];
  context: SubmissionContextValue;
  // proposal: result from POST /api/engine-v2/projects/propose-policies (step 4).
  // null = not yet loaded (or was cleared on retry).
  proposal: ProposerCliOutput | null;
  // selectedIds: HITL-curated policy id list. Initialised on first proposal load.
  selectedIds: string[];
}

const INITIAL_STATE: WizardState = {
  metadata: { name: "", description: "" },
  applicationTypes: [],
  selectedServices: [],
  context: { overrides: {} },
  proposal: null,
  selectedIds: [],
};

export function WizardClient() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Proposal loading state (step 4).
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  // Track whether we have triggered the proposal fetch for the current step-4 visit.
  const proposalFetchedRef = useRef(false);

  const mediaTypes = useMemo(
    () => deriveMediaTypesFromServices(state.selectedServices),
    [state.selectedServices],
  );

  // Fetch proposal on entering step 4 (first time or retry).
  const fetchProposal = useMemo(
    () => async () => {
      setProposalLoading(true);
      setProposalError(null);
      setState((prev) => ({ ...prev, proposal: null, selectedIds: [] }));

      try {
        const res = await fetch("/api/engine-v2/projects/propose-policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_services: state.selectedServices,
            media_types: mediaTypes,
            lifecycle_stages: [],
            application_types: state.applicationTypes,
          }),
        });
        if (!res.ok) {
          let detail = `Request failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string; detail?: string };
            if (j?.detail) detail = j.detail;
            else if (j?.error) detail = j.error;
          } catch {
            // body wasn't JSON
          }
          setProposalError(detail);
          setProposalLoading(false);
          return;
        }
        const output = (await res.json()) as ProposerCliOutput;
        // Default-check all signal_fired ids; floor tail starts unchecked.
        const defaultSelected = output.signal_fired.map((e) => e.policy_id);
        setState((prev) => ({
          ...prev,
          proposal: output,
          selectedIds: defaultSelected,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setProposalError(`Network error: ${message}`);
      } finally {
        setProposalLoading(false);
      }
    },
    [state.selectedServices, state.applicationTypes, mediaTypes],
  );

  // Trigger proposal fetch when step becomes 4 (first time).
  useEffect(() => {
    if (step === 4 && !proposalFetchedRef.current) {
      proposalFetchedRef.current = true;
      fetchProposal();
    }
    // When navigating away from step 4, reset so re-entry re-fetches.
    if (step !== 4) {
      proposalFetchedRef.current = false;
    }
  }, [step, fetchProposal]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.metadata.name.trim().length > 0;
      case 1:
        return state.applicationTypes.length > 0;
      case 2:
        return state.selectedServices.length > 0;
      case 3:
        return true;
      case 4:
        // Allow advance when proposal is loaded (or failed -- HITL can skip).
        // Zero selection is allowed (warning shown in component).
        return state.proposal !== null || proposalError !== null;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, state, proposalError]);

  function next() {
    if (!canAdvance) return;
    if (step < 5) setStep((step + 1) as StepIndex);
  }
  function back() {
    if (step > 0) setStep((step - 1) as StepIndex);
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const description = state.metadata.description.trim();
    const overrides = { ...state.context.overrides };
    if (description) {
      overrides["description"] = description;
    }

    const body: Record<string, unknown> = {
      name: state.metadata.name.trim(),
      application_types: state.applicationTypes,
      selected_services: state.selectedServices,
      media_types: mediaTypes,
      submission_context_overrides: overrides,
      model: null,
    };

    // Include HITL-curated policy ids when present.
    if (state.selectedIds.length > 0) {
      body["applicable_policy_ids"] = state.selectedIds;
    }

    try {
      const res = await fetch("/api/engine-v2/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status !== 201) {
        let detail = `Request failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; detail?: string };
          if (j?.error) detail = j.detail ? `${j.error}: ${j.detail}` : j.error;
        } catch {
          // body wasn't JSON; keep generic detail.
        }
        setSubmitError(detail);
        setSubmitting(false);
        return;
      }
      const created = (await res.json()) as { id?: string };
      if (!created?.id) {
        setSubmitError("Project created but response missing id.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/engine-v2/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(`Network error: ${message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-6 space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs font-medium">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <li
              key={label}
              className={
                "px-3 py-1 rounded-full border " +
                (isActive
                  ? "bg-sky-600 text-white border-sky-600"
                  : isDone
                    ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700"
                    : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-700")
              }
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      <div className="min-h-[16rem]">
        {step === 0 ? (
          <ProjectMetadataStep
            value={state.metadata}
            onChange={(metadata) =>
              setState((prev) => ({ ...prev, metadata }))
            }
          />
        ) : null}
        {step === 1 ? (
          <ApplicationTypeStep
            value={state.applicationTypes}
            onChange={(applicationTypes) =>
              setState((prev) => ({ ...prev, applicationTypes }))
            }
          />
        ) : null}
        {step === 2 ? (
          <ServiceTypeStep
            value={state.selectedServices}
            onChange={(selectedServices) =>
              setState((prev) => ({ ...prev, selectedServices }))
            }
          />
        ) : null}
        {step === 3 ? (
          <SubmissionContextStep
            value={state.context}
            onChange={(context) =>
              setState((prev) => ({ ...prev, context }))
            }
          />
        ) : null}
        {step === 4 ? (
          <ApplicablePolicyStep
            proposal={state.proposal}
            loading={proposalLoading}
            error={proposalError}
            selectedIds={state.selectedIds}
            onChange={(selectedIds) =>
              setState((prev) => ({ ...prev, selectedIds }))
            }
            onRetry={() => {
              proposalFetchedRef.current = true;
              fetchProposal();
            }}
          />
        ) : null}
        {step === 5 ? (
          <ReviewStep
            metadata={state.metadata}
            applicationTypes={state.applicationTypes}
            applicationTypeLabels={APPLICATION_TYPE_OPTIONS}
            selectedServices={state.selectedServices}
            mediaTypes={mediaTypes}
            context={state.context}
            proposalSummary={
              state.proposal
                ? {
                    selectedCount: state.selectedIds.length,
                    signalCount: state.proposal.counts.signal_fired_count,
                    floorCount: state.proposal.counts.floor_tail_count,
                  }
                : null
            }
          />
        ) : null}
      </div>

      {submitError ? (
        <div className="rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-100">
          {submitError}
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || submitting}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Back
        </button>
        {step < 5 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance || submitting}
            className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Creating..." : "Create project"}
          </button>
        )}
      </div>
    </div>
  );
}
