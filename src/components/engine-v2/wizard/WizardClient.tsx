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
  // null = not yet loaded (or was cleared on retry / upstream-context edit).
  proposal: ProposerCliOutput | null;
  // proposalContextKey: the context key (see makeContextKey) of the inputs that
  // produced `proposal`. Used by the step-4 gate to ensure the loaded proposal
  // matches the CURRENT upstream context -- guards against advancing/submitting a
  // proposal computed for a now-stale services/application-types selection.
  proposalContextKey: string | null;
  // selectedIds: HITL-curated policy id list. Initialised on first proposal load.
  selectedIds: string[];
}

const INITIAL_STATE: WizardState = {
  metadata: { name: "", description: "" },
  applicationTypes: [],
  selectedServices: [],
  context: { overrides: {} },
  proposal: null,
  proposalContextKey: null,
  selectedIds: [],
};

// Stable JSON key of EXACTLY the inputs sent to /propose-policies. Arrays that do
// not carry semantic order (services, media types, application types) are sorted so
// the key is order-insensitive; lifecycle_stages is always [] today (kept explicit
// to mirror the request body). Two contexts yielding the same proposer universe map
// to the same key; any upstream edit that changes the request changes the key.
function makeContextKey(args: {
  selectedServices: string[];
  mediaTypes: string[];
  applicationTypes: string[];
}): string {
  return JSON.stringify({
    selected_services: [...args.selectedServices].sort(),
    media_types: [...args.mediaTypes].sort(),
    lifecycle_stages: [],
    application_types: [...args.applicationTypes].sort(),
  });
}

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

  // The context key for the CURRENT upstream selections. The step-4 gate compares
  // this against the key stored with the loaded proposal.
  const currentContextKey = useMemo(
    () =>
      makeContextKey({
        selectedServices: state.selectedServices,
        mediaTypes,
        applicationTypes: state.applicationTypes,
      }),
    [state.selectedServices, mediaTypes, state.applicationTypes],
  );

  // Ref mirror of currentContextKey so the async fetchProposal closure can read the
  // LATEST key at resolve time (the memoized closure would otherwise capture a stale
  // value). Kept in sync on every render.
  const currentContextKeyRef = useRef(currentContextKey);
  currentContextKeyRef.current = currentContextKey;

  // Invalidate any loaded/in-flight proposal so returning to step 4 always
  // refetches against the current context. Called from the upstream onChange
  // handlers (services / application types) whose edits change the request body.
  // The stale-response guard in fetchProposal additionally prevents an older
  // in-flight response from repopulating state after an edit.
  function invalidateProposal() {
    setProposalError(null);
    setState((prev) =>
      prev.proposal === null &&
      prev.proposalContextKey === null &&
      prev.selectedIds.length === 0
        ? prev
        : { ...prev, proposal: null, proposalContextKey: null, selectedIds: [] },
    );
  }

  // Fetch proposal on entering step 4 (first time or retry). The request's context
  // key is captured at call time; on resolve, the response is DISCARDED if that key
  // no longer equals the current context key (stale-response guard).
  const fetchProposal = useMemo(
    () => async () => {
      const requestContextKey = makeContextKey({
        selectedServices: state.selectedServices,
        mediaTypes,
        applicationTypes: state.applicationTypes,
      });
      setProposalLoading(true);
      setProposalError(null);
      setState((prev) => ({
        ...prev,
        proposal: null,
        proposalContextKey: null,
        selectedIds: [],
      }));

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
        // Stale-response guard: discard if the context changed while in flight.
        if (requestContextKey !== currentContextKeyRef.current) return;
        if (!res.ok) {
          let detail = `Request failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string; detail?: string };
            if (j?.detail) detail = j.detail;
            else if (j?.error) detail = j.error;
          } catch {
            // body wasn't JSON
          }
          if (requestContextKey !== currentContextKeyRef.current) return;
          setProposalError(detail);
          setProposalLoading(false);
          return;
        }
        const output = (await res.json()) as ProposerCliOutput;
        // Re-check after the async json() parse: context may have changed again.
        if (requestContextKey !== currentContextKeyRef.current) return;
        // Default-check all signal_fired ids; floor tail starts unchecked.
        const defaultSelected = output.signal_fired.map((e) => e.policy_id);
        setState((prev) => ({
          ...prev,
          proposal: output,
          proposalContextKey: requestContextKey,
          selectedIds: defaultSelected,
        }));
      } catch (err) {
        if (requestContextKey !== currentContextKeyRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        setProposalError(`Network error: ${message}`);
      } finally {
        // Only clear loading if this request is still the current one; otherwise a
        // stale resolution must not flip the spinner for the newer in-flight fetch.
        if (requestContextKey === currentContextKeyRef.current) {
          setProposalLoading(false);
        }
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
        // Advance only when a proposal is loaded AND it was computed for the
        // CURRENT context (proposalContextKey === currentContextKey) AND we are not
        // mid-fetch. A proposal whose key no longer matches is stale (user edited
        // services/application types after it loaded) and must not be advanced or
        // submitted. proposalError !== null still allows skipping a failed fetch.
        // Zero selection is allowed (warning shown in component).
        if (proposalLoading) return false;
        if (proposalError !== null) return true;
        return (
          state.proposal !== null &&
          state.proposalContextKey === currentContextKey
        );
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, state, proposalError, proposalLoading, currentContextKey]);

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
            onChange={(applicationTypes) => {
              // Application types feed the proposer context -> invalidate any
              // loaded/in-flight proposal so step 4 refetches for the new context.
              setState((prev) => ({ ...prev, applicationTypes }));
              invalidateProposal();
            }}
          />
        ) : null}
        {step === 2 ? (
          <ServiceTypeStep
            value={state.selectedServices}
            onChange={(selectedServices) => {
              // Services drive both selected_services AND derived media types in the
              // proposer context -> invalidate any loaded/in-flight proposal.
              setState((prev) => ({ ...prev, selectedServices }));
              invalidateProposal();
            }}
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
