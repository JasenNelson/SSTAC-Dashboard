"use client";

// engine_v2 frontend Lane 1 / Module L1-4: client-side wizard orchestrator.
// Holds step state, advances through 5 steps, and submits to
// POST /api/engine-v2/projects. On 201 redirects to the project detail route.

import { useMemo, useState } from "react";
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
import { ReviewStep } from "./ReviewStep";
import { deriveMediaTypesFromServices } from "@/lib/engine-v2/service_to_media";

type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS: readonly string[] = [
  "Metadata",
  "Application types",
  "Services",
  "Context",
  "Review",
];

interface WizardState {
  metadata: ProjectMetadataValue;
  applicationTypes: ApplicationTypeId[];
  selectedServices: string[];
  context: SubmissionContextValue;
}

const INITIAL_STATE: WizardState = {
  metadata: { name: "", description: "" },
  applicationTypes: [],
  selectedServices: [],
  context: { overrides: {} },
};

export function WizardClient() {
  const router = useRouter();
  const [step, setStep] = useState<StepIndex>(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mediaTypes = useMemo(
    () => deriveMediaTypesFromServices(state.selectedServices),
    [state.selectedServices],
  );

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
        return true;
      default:
        return false;
    }
  }, [step, state]);

  function next() {
    if (!canAdvance) return;
    if (step < 4) setStep((step + 1) as StepIndex);
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

    const body = {
      name: state.metadata.name.trim(),
      application_types: state.applicationTypes,
      selected_services: state.selectedServices,
      media_types: mediaTypes,
      submission_context_overrides: overrides,
      model: null,
    };

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
          <ReviewStep
            metadata={state.metadata}
            applicationTypes={state.applicationTypes}
            applicationTypeLabels={APPLICATION_TYPE_OPTIONS}
            selectedServices={state.selectedServices}
            mediaTypes={mediaTypes}
            context={state.context}
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
        {step < 4 ? (
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
