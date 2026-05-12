// engine_v2 frontend Lane 2a / Module L2a-5: per-policy results viewer page.
//
// Server Component, admin-gated via requireAdminForServerComponent (Lane 1
// helper). Loads the parent project (for the page header), the evaluation
// row, and all per-policy results for the evaluation, then hands off to
// the PerPolicyResultsTable client component for interactive rendering.
//
// Constraints (per Lane 2a plan v0.2):
//   - ASCII only. No em dashes, smart quotes, or Unicode arrows.
//   - Hydration safety: any date formatters must lock locale to "en-US"
//     so server- and client-rendered strings match (Lane 1 pattern).
//   - Out of scope: trigger button + status panel (L2a-4), /evaluate
//     route (L2a-2), /evaluation-status route (L2a-3).

import { notFound } from "next/navigation";
import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import { PerPolicyResultsTable } from "@/components/engine-v2/PerPolicyResultsTable";
import type {
  V2Evaluation,
  V2PerPolicyResult,
  EvalCoverageStatement,
  EvaluationStatus,
} from "@/lib/engine-v2/types_lane2";

interface PageProps {
  // Next.js 15 App Router: params is a Promise (Lane 1 Finding 50 carries over).
  params: Promise<{ projectId: string; evalId: string }>;
}

function StatusBadge({
  status,
}: {
  status: EvaluationStatus;
}): React.ReactElement {
  let palette =
    "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300";
  if (status === "completed") {
    palette =
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  } else if (status === "completed_with_errors") {
    palette =
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  } else if (status === "error") {
    palette = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  } else if (status === "running") {
    palette =
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
  }
  return (
    <span
      data-testid="evaluation-status-badge"
      data-status={status}
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${palette}`}
    >
      {status}
    </span>
  );
}

function CoverageSummary({
  coverage,
}: {
  coverage: EvalCoverageStatement;
}): React.ReactElement {
  const total = coverage.total_policies ?? 0;
  const evaluated = coverage.evaluated ?? 0;
  const deferred = coverage.deferred ?? 0;
  const errored = coverage.error ?? 0;
  const deferredReasons = coverage.deferred_reasons ?? {};
  const reasonEntries = Object.entries(deferredReasons);

  return (
    <section
      data-testid="evaluation-coverage-summary"
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        Coverage
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total
          </div>
          <div
            className="text-lg font-semibold text-slate-900 dark:text-white font-mono"
            data-testid="coverage-total"
          >
            {total}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Evaluated
          </div>
          <div
            className="text-lg font-semibold text-emerald-700 dark:text-emerald-300 font-mono"
            data-testid="coverage-evaluated"
          >
            {evaluated}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Deferred
          </div>
          <div
            className="text-lg font-semibold text-amber-700 dark:text-amber-300 font-mono"
            data-testid="coverage-deferred"
          >
            {deferred}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Errored
          </div>
          <div
            className="text-lg font-semibold text-red-700 dark:text-red-300 font-mono"
            data-testid="coverage-errored"
          >
            {errored}
          </div>
        </div>
      </div>
      {reasonEntries.length > 0 ? (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            Deferred reasons
          </div>
          <ul
            data-testid="coverage-deferred-reasons"
            className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5"
          >
            {reasonEntries.map(([reason, count]) => (
              <li key={reason} className="font-mono">
                {reason}: {count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ErrorsBlock({ errors }: { errors: unknown[] }): React.ReactElement | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  return (
    <section
      data-testid="evaluation-errors"
      className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-4 space-y-2"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
        Errors ({errors.length})
      </h3>
      <ul className="text-xs text-red-900 dark:text-red-100 space-y-1 list-disc list-inside">
        {errors.map((err, idx) => {
          const text =
            typeof err === "string" ? err : JSON.stringify(err);
          return (
            <li key={idx} className="font-mono break-words">
              {text}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default async function EvaluationResultsPage(props: PageProps) {
  const { projectId, evalId } = await props.params;
  const { client } = await requireAdminForServerComponent();

  // Parent project (RLS scopes to admin owner). 404 if missing or not owned.
  const { data: projectRow, error: projectErr } = await client
    .from("v2_projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr || !projectRow) {
    notFound();
  }
  const project = projectRow as { id: string; name: string };

  // Evaluation row. Scoped to projectId + evalId; RLS already filters by
  // project ownership but we double-bind the project to defend against
  // cross-project URL tampering.
  const { data: evalRow, error: evalErr } = await client
    .from("v2_evaluations")
    .select(
      "id, project_id, extraction_run_id, status, run_id_engine, variant_config_hash, evaluation_backend, embedder_backend, reranker_backend, model, bench_fixture, applicability_mode, coverage_statement, errors, raw_eval_result_json, started_at, completed_at, updated_at",
    )
    .eq("project_id", projectId)
    .eq("id", evalId)
    .maybeSingle();
  if (evalErr || !evalRow) {
    notFound();
  }
  const evaluation = evalRow as V2Evaluation;

  // Per-policy results. May be empty if evaluation is not yet terminal or
  // the import flow has not yet run. Order by policy_id for stable display.
  const { data: rowsData } = await client
    .from("v2_per_policy_results")
    .select(
      "id, evaluation_id, policy_id, stage, packet_id, tier, verdict_suggestion, ai_suggestion, confidence, confidence_method, summary, evidence_packet, pathway_notes, rubric_self_score, raw_result_json, created_at",
    )
    .eq("evaluation_id", evaluation.id)
    .order("policy_id", { ascending: true });
  const results = (rowsData ?? []) as V2PerPolicyResult[];

  const coverage = (evaluation.coverage_statement ??
    {}) as EvalCoverageStatement;
  const errors = Array.isArray(evaluation.errors) ? evaluation.errors : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          project {projectId} / evaluation {evalId}
        </p>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {project.name}: Evaluation results
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1">
            Status: <StatusBadge status={evaluation.status} />
          </span>
          <span className="inline-flex items-center gap-1">
            Backend:{" "}
            <code className="font-mono text-xs">
              {evaluation.evaluation_backend}
            </code>
          </span>
          <span className="inline-flex items-center gap-1">
            Bench:{" "}
            <code className="font-mono text-xs">{evaluation.bench_fixture}</code>
          </span>
          {evaluation.run_id_engine ? (
            <span className="inline-flex items-center gap-1">
              Engine run:{" "}
              <code className="font-mono text-xs">
                {evaluation.run_id_engine}
              </code>
            </span>
          ) : null}
        </div>
      </header>
      <CoverageSummary coverage={coverage} />
      <ErrorsBlock errors={errors} />
      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Per-policy results ({results.length})
        </h3>
        <PerPolicyResultsTable results={results} />
      </section>
    </div>
  );
}
