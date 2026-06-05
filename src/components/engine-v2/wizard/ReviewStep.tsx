"use client";

// engine_v2 frontend Lane 1 / Module L1-4: Step 5 - review and submit.
// Read-only summary; Submit button lives on the orchestrator (WizardClient).

import { getServiceById } from "@/lib/regulatory-review/schedule3";
import type { ProjectMetadataValue } from "./ProjectMetadataStep";
import type {
  ApplicationTypeId,
} from "./ApplicationTypeStep";
import type { SubmissionContextValue } from "./SubmissionContextStep";

interface ProposalSummary {
  selectedCount: number;
  signalCount: number;
  floorCount: number;
}

interface Props {
  metadata: ProjectMetadataValue;
  applicationTypes: ApplicationTypeId[];
  applicationTypeLabels: ReadonlyArray<{ id: ApplicationTypeId; label: string }>;
  selectedServices: string[];
  mediaTypes: string[];
  context: SubmissionContextValue;
  // proposalSummary: provided when the wizard completed step 4; null when absent
  // (legacy path or proposal was unavailable).
  proposalSummary: ProposalSummary | null;
}

export function ReviewStep({
  metadata,
  applicationTypes,
  applicationTypeLabels,
  selectedServices,
  mediaTypes,
  context,
  proposalSummary,
}: Props) {
  const applicationLabel = (id: ApplicationTypeId): string =>
    applicationTypeLabels.find((o) => o.id === id)?.label ?? id;

  const serviceLabel = (id: string): string =>
    getServiceById(id)?.name ?? id;

  const overrideEntries = Object.entries(context.overrides);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Review
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Confirm the details below, then create the project.
        </p>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
        <div className="sm:col-span-1">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Name
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white break-words">
            {metadata.name || <em className="text-slate-400">(none)</em>}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Description
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white whitespace-pre-wrap">
            {metadata.description.trim() || (
              <em className="text-slate-400">(none)</em>
            )}
          </dd>
        </div>

        <div className="sm:col-span-3">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Application types
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white">
            {applicationTypes.length === 0 ? (
              <em className="text-slate-400">(none)</em>
            ) : (
              <ul className="list-disc list-inside">
                {applicationTypes.map((id) => (
                  <li key={id}>{applicationLabel(id)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>

        <div className="sm:col-span-3">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Services
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white">
            {selectedServices.length === 0 ? (
              <em className="text-slate-400">(none)</em>
            ) : (
              <ul className="list-disc list-inside">
                {selectedServices.map((id) => (
                  <li key={id}>{serviceLabel(id)}</li>
                ))}
              </ul>
            )}
          </dd>
        </div>

        <div className="sm:col-span-3">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Derived media types
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white">
            {mediaTypes.length === 0 ? (
              <em className="text-slate-400">
                (none - selected services do not map to known media)
              </em>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {mediaTypes.map((m) => (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 text-xs"
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}
          </dd>
        </div>

        {proposalSummary !== null ? (
          <div className="sm:col-span-3">
            <dt className="font-medium text-slate-500 dark:text-slate-400">
              Proposed applicable policies
            </dt>
            <dd className="mt-1 text-slate-900 dark:text-white">
              {proposalSummary.selectedCount} selected (of{" "}
              {proposalSummary.signalCount} signal +{" "}
              {proposalSummary.floorCount} floor proposed)
            </dd>
          </div>
        ) : null}

        <div className="sm:col-span-3">
          <dt className="font-medium text-slate-500 dark:text-slate-400">
            Submission context overrides
          </dt>
          <dd className="mt-1 text-slate-900 dark:text-white">
            {overrideEntries.length === 0 ? (
              <em className="text-slate-400">(none)</em>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                {overrideEntries.map(([k, v]) => (
                  <li
                    key={k}
                    className="px-3 py-2 grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2"
                  >
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 break-all">
                      {k}
                    </span>
                    <span className="break-words">{v}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
