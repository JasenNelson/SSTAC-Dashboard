// engine_v2 frontend Lane 2c / Reviewer Dashboard: ProjectStatusCard.
//
// Presentational Server Component (no client hooks). Renders a per-project
// at-a-glance summary card for the /dashboard/engine-v2 list view: file count,
// latest extraction status badge, latest evaluation status badge, coverage
// fraction (terminal evals only), judgment progress (terminal evals only),
// and a "View" link to the evaluation results page when applicable.
//
// All date formatting is locale-locked to en-US to avoid SSR/client hydration
// mismatch (matches the convention used by ExtractionStatusPanel and
// EvaluationStatusPanel).

import Link from "next/link";
import type { ExtractionStatus, V2ExtractionRun } from "@/lib/engine-v2/types";
import type {
  EvaluationStatus,
  EvalCoverageStatement,
  V2Evaluation,
} from "@/lib/engine-v2/types_lane2";
import { TERMINAL_EVALUATION_STATUSES } from "@/lib/engine-v2/types_lane2";

export interface ProjectStatusCardData {
  id: string;
  name: string;
  created_at: string;
  max_files: number;
  fileCount: number;
  latestRun: V2ExtractionRun | null;
  latestEvaluation: V2Evaluation | null;
  perPolicyTotal: number;
  judgedCount: number;
}

interface ProjectStatusCardProps {
  data: ProjectStatusCardData;
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isTerminalEvaluation(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

function extractionBadgeClass(status: ExtractionStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "completed_with_errors":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "extracting":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    case "pending":
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

function evaluationBadgeClass(status: EvaluationStatus): string {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "completed_with_errors":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "running":
      return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200";
    case "pending":
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
  }
}

function noneBadgeClass(): string {
  return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
}

function readCoverage(
  evaluation: V2Evaluation | null,
): { evaluated: number; total: number } | null {
  if (!evaluation) return null;
  const cs = evaluation.coverage_statement as
    | EvalCoverageStatement
    | null
    | undefined;
  if (!cs || typeof cs !== "object") return null;
  const evaluated =
    typeof cs.evaluated === "number" && Number.isFinite(cs.evaluated)
      ? cs.evaluated
      : null;
  const total =
    typeof cs.total_policies === "number" && Number.isFinite(cs.total_policies)
      ? cs.total_policies
      : null;
  if (evaluated === null || total === null) return null;
  return { evaluated, total };
}

export function ProjectStatusCard({ data }: ProjectStatusCardProps) {
  const {
    id,
    name,
    created_at,
    max_files,
    fileCount,
    latestRun,
    latestEvaluation,
    perPolicyTotal,
    judgedCount,
  } = data;

  const projectHref = `/dashboard/engine-v2/${id}`;
  const hasFiles = fileCount > 0;

  // Note: extraction terminality is informational only -- the card surfaces
  // the latest extraction status badge regardless of terminality. Evaluation
  // terminality, by contrast, gates the coverage + judgments rows below.
  const evaluationTerminal =
    latestEvaluation !== null && isTerminalEvaluation(latestEvaluation.status);

  const coverage = evaluationTerminal ? readCoverage(latestEvaluation) : null;
  const judgmentPct =
    evaluationTerminal && perPolicyTotal > 0
      ? Math.round((judgedCount / perPolicyTotal) * 100)
      : null;

  const evaluationHref =
    evaluationTerminal && latestEvaluation
      ? `/dashboard/engine-v2/${id}/evaluation/${latestEvaluation.id}`
      : null;

  return (
    <li>
      <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-sky-300 dark:hover:border-sky-500 transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={projectHref}
              className="block text-base font-semibold text-slate-900 dark:text-white truncate hover:text-sky-700 dark:hover:text-sky-300"
            >
              {name}
            </Link>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Created {formatCreatedAt(created_at)}
            </p>
          </div>
        </div>

        {!hasFiles ? (
          <div className="mt-4 flex-1 flex flex-col items-start justify-center">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              No files uploaded
            </p>
            <Link
              href={projectHref}
              className="mt-3 inline-flex items-center px-3 py-1.5 rounded-md bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        ) : (
          <dl className="mt-4 flex-1 grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Files</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {fileCount} / {max_files}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Extraction</dt>
              <dd>
                {latestRun ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${extractionBadgeClass(latestRun.status)}`}
                  >
                    {latestRun.status}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${noneBadgeClass()}`}
                  >
                    None
                  </span>
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Evaluation</dt>
              <dd>
                {latestEvaluation ? (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${evaluationBadgeClass(latestEvaluation.status)}`}
                  >
                    {latestEvaluation.status}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${noneBadgeClass()}`}
                  >
                    None
                  </span>
                )}
              </dd>
            </div>

            {coverage ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Coverage</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {coverage.evaluated} / {coverage.total} policies
                </dd>
              </div>
            ) : null}

            {evaluationTerminal ? (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">
                  Judgments
                </dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">
                  {judgedCount} / {perPolicyTotal} judged
                  {judgmentPct !== null ? (
                    <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                      ({judgmentPct}%)
                    </span>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
        )}

        {hasFiles && evaluationHref ? (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Link
              href={evaluationHref}
              className="inline-flex items-center text-sm font-medium text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-100"
            >
              View results
              <span aria-hidden="true" className="ml-1">
                {">"}
              </span>
            </Link>
          </div>
        ) : null}
      </div>
    </li>
  );
}
