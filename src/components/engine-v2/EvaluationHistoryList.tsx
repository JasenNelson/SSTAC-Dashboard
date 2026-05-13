"use client";

// engine_v2 frontend: EvaluationHistoryList (Client Component).
//
// Presentational table that surfaces evaluations for a project so reviewers
// can compare runs side-by-side and jump back to prior result pages. Renders as
// a compact table with a toggle for surfacing errored (no-results) runs.
//
// By default, rows with status === "error" are hidden because they represent
// failed startups (no per-policy results, no memo, nothing to view). A small
// toggle link below the table reveals them when explicitly requested.
//
// All date formatting is locale-locked to "en-US" to avoid SSR/client
// hydration mismatch (NON-DROPPABLE per Lane 2a EvaluationStatusPanel pattern).

import { useMemo, useState } from "react";
import Link from "next/link";
import type {
  EvaluationStatus,
  V2EvaluationListRow,
} from "@/lib/engine-v2/types_lane2";
import { TERMINAL_EVALUATION_STATUSES } from "@/lib/engine-v2/types_lane2";

interface EvaluationHistoryListProps {
  projectId: string;
  // Ordered started_at DESC by the caller. Slim rows -- no JSONB blob
  // (raw_eval_result_json) per row. Codex Round 1 fix (Lane 2c retro).
  // Phase 2.5 hotfix: strictly NON-LATEST -- the latest eval is rendered
  // separately above this table (EvaluationStatusPanel) and must NOT
  // appear here, or stale "running" rows persist after polling completes.
  evaluations: V2EvaluationListRow[];
}

function isTerminalStatus(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

function isViewableStatus(status: EvaluationStatus): boolean {
  return status === "completed" || status === "completed_with_errors";
}

function statusBadgeClass(status: EvaluationStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "completed_with_errors":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "running":
    case "pending":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

function backendBadgeClass(backend: string): string {
  // "stub" runs are synthetic fixtures; "live" runs hit a real LLM. Color
  // them differently so reviewers can tell at a glance whether a row is a
  // smoke test vs a production-grade run.
  const lower = backend.toLowerCase();
  if (lower === "stub") {
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
  return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
}

function formatTs(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readCoverageNumber(
  coverage: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  if (!coverage) return null;
  const raw = coverage[key];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return null;
}

function formatCoverage(coverage: Record<string, unknown> | null): string {
  const evaluated = readCoverageNumber(coverage, "evaluated");
  const total = readCoverageNumber(coverage, "total_policies");
  if (evaluated === null && total === null) return "-";
  return `${evaluated === null ? "-" : evaluated} / ${
    total === null ? "-" : total
  }`;
}

function formatDuration(startedIso: string, completedIso: string | null): string {
  if (!completedIso) return "in progress";
  const start = new Date(startedIso).getTime();
  const end = new Date(completedIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "-";
  const totalSec = Math.round((end - start) / 1000);
  if (totalSec < 60) return `${totalSec} sec`;
  const totalMin = Math.round(totalSec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (min === 0) return `${hr} hr`;
  return `${hr} hr ${min} min`;
}

export function EvaluationHistoryList(
  props: EvaluationHistoryListProps,
): React.ReactElement | null {
  const { projectId, evaluations } = props;
  const [showErrored, setShowErrored] = useState<boolean>(false);

  // Split into "useful" (anything that produced results, plus still-running
  // rows) vs "errored" (failed startup, no results page worth linking to).
  const { visible, erroredCount } = useMemo(() => {
    const errored = evaluations.filter((e) => e.status === "error");
    const nonErrored = evaluations.filter((e) => e.status !== "error");
    return {
      visible: showErrored ? evaluations : nonErrored,
      erroredCount: errored.length,
    };
  }, [evaluations, showErrored]);

  // Empty (after filtering): no prior evals to compare against the latest --
  // suppress the section entirely. Note: the toggle link is still useful
  // when only errored runs exist, so we keep the section visible if there
  // are hidden errored rows. Phase 2.5 hotfix: the threshold dropped from
  // <= 1 to < 1 because the latest eval is no longer duplicated into this
  // list, so a length of 1 now represents a genuine prior run worth showing.
  if (visible.length < 1 && erroredCount === 0) {
    return null;
  }

  return (
    <section
      data-testid="evaluation-history-list"
      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm"
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
        Evaluation history
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
              <th scope="col" className="py-2 pr-3 font-medium">
                Started
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Status
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Backend
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Coverage
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Duration
              </th>
              <th scope="col" className="py-2 pr-3 font-medium text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((evalRow) => {
              const terminal = isTerminalStatus(evalRow.status);
              const viewable = isViewableStatus(evalRow.status);
              const resultsHref = `/dashboard/engine-v2/${encodeURIComponent(
                projectId,
              )}/evaluation/${encodeURIComponent(evalRow.id)}`;
              return (
                <tr
                  key={evalRow.id}
                  data-testid="evaluation-history-row"
                  data-eval-id={evalRow.id}
                  className="border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                >
                  <td className="py-2 pr-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatTs(evalRow.started_at)}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${statusBadgeClass(
                        evalRow.status,
                      )}`}
                    >
                      {evalRow.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${backendBadgeClass(
                        evalRow.evaluation_backend,
                      )}`}
                    >
                      {evalRow.evaluation_backend}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatCoverage(evalRow.coverage_statement)}
                  </td>
                  <td className="py-2 pr-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatDuration(evalRow.started_at, evalRow.completed_at)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {viewable ? (
                      <Link
                        href={resultsHref}
                        data-testid="evaluation-history-view-link"
                        className="text-sm font-medium text-sky-700 dark:text-sky-300 hover:underline"
                      >
                        View
                      </Link>
                    ) : terminal ? (
                      // Errored runs have no results page worth linking to.
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        -
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Pending...
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Showing {visible.length} of {evaluations.length} evaluations
        </p>
        {erroredCount > 0 ? (
          <button
            type="button"
            data-testid="evaluation-history-toggle-errored"
            onClick={() => setShowErrored((prev) => !prev)}
            className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:underline"
          >
            {showErrored
              ? `Hide ${erroredCount} failed evaluation${
                  erroredCount === 1 ? "" : "s"
                }`
              : `Show ${erroredCount} failed evaluation${
                  erroredCount === 1 ? "" : "s"
                }`}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default EvaluationHistoryList;
