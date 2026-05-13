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
import { EngineV2Breadcrumbs } from "@/components/engine-v2/EngineV2Breadcrumbs";
import { PerPolicyResultsTable } from "@/components/engine-v2/PerPolicyResultsTable";
import { TelemetryDisclosure } from "@/components/engine-v2/TelemetryDisclosure";
import { ExportMemoButton } from "@/components/engine-v2/ExportMemoButton";
import { ExportFormatMenu } from "@/components/engine-v2/ExportFormatMenu";
import { JudgmentSummaryTile } from "@/components/engine-v2/JudgmentSummaryTile";
import { EvaluationSidePanel } from "@/components/engine-v2/side-panel/EvaluationSidePanel";
import { SidePanelProvider } from "@/components/engine-v2/side-panel/SidePanelContext";
import { extractEvidenceSlices } from "@/lib/engine-v2/evidence_slices";
import type {
  V2Evaluation,
  V2PerPolicyResult,
  V2Judgment,
  EvalCoverageStatement,
  EvaluationStatus,
} from "@/lib/engine-v2/types_lane2";

interface PageProps {
  // Next.js 15 App Router: params is a Promise (Lane 1 Finding 50 carries over).
  params: Promise<{ projectId: string; evalId: string }>;
}

// Locale-locked date formatter (en-US) to avoid SSR/client hydration mismatch.
function formatDateLong(iso: string | null | undefined): string {
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

function BackendBadge({ backend }: { backend: string }): React.ReactElement {
  const lower = (backend ?? "").toLowerCase();
  const palette =
    lower === "stub"
      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
      : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200";
  return (
    <span
      data-testid="evaluation-backend-badge"
      data-backend={backend}
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${palette}`}
    >
      {backend}
    </span>
  );
}

function MemoStatusNote({
  memoCreatedAt,
  latestJudgmentUpdatedAt,
}: {
  memoCreatedAt: string | null;
  latestJudgmentUpdatedAt: string | null;
}): React.ReactElement {
  if (!memoCreatedAt) {
    return (
      <div
        data-testid="memo-status-note"
        data-state="none"
        className="mb-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
      >
        No memo exported for this evaluation yet.
      </div>
    );
  }
  const memoMs = new Date(memoCreatedAt).getTime();
  const judgmentMs = latestJudgmentUpdatedAt
    ? new Date(latestJudgmentUpdatedAt).getTime()
    : NaN;
  const stale =
    !Number.isNaN(memoMs) &&
    !Number.isNaN(judgmentMs) &&
    judgmentMs > memoMs;
  if (stale) {
    return (
      <div
        data-testid="memo-status-note"
        data-state="stale"
        className="mb-2 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-100"
      >
        Judgments have changed since the last memo export -- click Export memo
        to regenerate.
      </div>
    );
  }
  return (
    <div
      data-testid="memo-status-note"
      data-state="current"
      className="mb-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
    >
      Memo last exported {formatDateLong(memoCreatedAt)}. Re-export to refresh.
    </div>
  );
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

  // L2b-2 UI: fetch any existing HITL judgments for the loaded per-policy
  // results so the table can render the latest verdict in the Judgment column
  // and prefill the inline editor. RLS already scopes by ownership; we still
  // skip the IN(...) round-trip when the per-policy import has not run yet.
  let judgments: V2Judgment[] = [];
  if (results.length > 0) {
    const ppIds = results.map((r) => r.id);
    const { data: judgmentRows } = await client
      .from("v2_judgments")
      .select(
        "id, per_policy_result_id, reviewer_user_id, tier, verdict, rationale, evidence_refs, created_at, updated_at",
      )
      .in("per_policy_result_id", ppIds);
    judgments = (judgmentRows ?? []) as V2Judgment[];
  }

  // Submission filenames: pull the original_filename(s) of files associated
  // with the same project (scoped via the evaluation's extraction_run_id ->
  // project_id). Used in the demo-friendly subtitle below.
  const { data: submissionFileRows } = await client
    .from("v2_submission_files")
    .select("original_filename, uploaded_at")
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true });
  const submissionFilenames = ((submissionFileRows ?? []) as Array<{
    original_filename: string;
  }>)
    .map((r) => r.original_filename)
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  // Latest memo export for this evaluation (any snapshot hash). Used to
  // render the MemoStatusNote above the ExportMemoButton.
  const { data: latestMemoRow } = await client
    .from("v2_memo_exports")
    .select("id, created_at")
    .eq("evaluation_id", evaluation.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const memoCreatedAt =
    latestMemoRow && typeof (latestMemoRow as { created_at?: unknown }).created_at === "string"
      ? ((latestMemoRow as { created_at: string }).created_at)
      : null;

  // Latest judgment updated_at across all per-policy results of this eval.
  let latestJudgmentUpdatedAt: string | null = null;
  for (const j of judgments) {
    if (!j.updated_at) continue;
    if (
      latestJudgmentUpdatedAt === null ||
      new Date(j.updated_at).getTime() >
        new Date(latestJudgmentUpdatedAt).getTime()
    ) {
      latestJudgmentUpdatedAt = j.updated_at;
    }
  }

  const coverage = (evaluation.coverage_statement ??
    {}) as EvalCoverageStatement;
  const errors = Array.isArray(evaluation.errors) ? evaluation.errors : [];

  // Demo-friendly subtitle inputs.
  const policiesTotal =
    typeof coverage.total_policies === "number"
      ? coverage.total_policies
      : results.length;
  const submissionDisplay =
    submissionFilenames.length > 0
      ? submissionFilenames.join(", ")
      : "(no submission files)";

  // Lane 2c: pull the top-level evidence_slices dict from the raw eval result
  // JSONB. Returns null for older schema_version 0.0.1 evaluations; the table
  // renders a degraded "verbatim text not available" view in that case.
  const evidenceSlices = extractEvidenceSlices(evaluation.raw_eval_result_json);

  // Lane 2d / Phase A: side-panel mount region.
  //
  // ED-2d4-12 MOUNT CONTRACT: Phase A is the ONLY phase that edits this
  // file. Phases C (Search submission), D (Ask AI), and E (bidirectional
  // citation linking) populate the side panel by editing files inside
  // src/components/engine-v2/side-panel/ and consuming SidePanelContext
  // via useSidePanel(); they do NOT re-edit this page. If a future
  // phase needs new props on EvaluationSidePanel, the orchestrator
  // approves a single isolated edit here -- no parallel work crosses
  // this file.
  //
  // Layout (ED-2d4-10): main content + side panel are flex siblings so
  // the panel reserves layout space in split mode (>=1200px viewport)
  // and the main column reflows to share the viewport. The panel handles
  // its own width-driven flex-basis and switches to a position:fixed
  // drawer overlay below 1200px (where it leaves the flex flow entirely
  // and the main column reclaims the full width).
  return (
    <SidePanelProvider>
      <div className="flex flex-row items-stretch gap-0 min-h-screen">
        <div className="flex-1 min-w-0 space-y-6 pr-4">
        <EngineV2Breadcrumbs
        segments={[
          { label: "Engine v2", href: "/dashboard/engine-v2" },
          {
            label: project.name,
            href: `/dashboard/engine-v2/${projectId}`,
          },
          { label: "Evaluation" },
        ]}
      />
      <header className="space-y-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          project {projectId} / evaluation {evalId}
        </p>
        <h2
          data-testid="evaluation-page-title"
          className="text-2xl font-bold text-slate-900 dark:text-white"
        >
          {project.name}: Regulatory review
        </h2>
        <p
          data-testid="evaluation-page-subtitle"
          className="text-sm text-slate-700 dark:text-slate-300"
        >
          Evaluating{" "}
          <span className="font-medium">{submissionDisplay}</span> against{" "}
          <code className="font-mono text-xs">{evaluation.bench_fixture}</code>{" "}
          ({policiesTotal} policies)
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1">
            Status: <StatusBadge status={evaluation.status} />
          </span>
          <span className="inline-flex items-center gap-1">
            Backend: <BackendBadge backend={evaluation.evaluation_backend} />
          </span>
          <span className="inline-flex items-center gap-1">
            Started:{" "}
            <span className="font-mono text-xs">
              {formatDateLong(evaluation.started_at)}
            </span>
          </span>
        </div>
        {/* L2b-6: memo export trigger (disabled until terminal). */}
        <div className="pt-2">
          <MemoStatusNote
            memoCreatedAt={memoCreatedAt}
            latestJudgmentUpdatedAt={latestJudgmentUpdatedAt}
          />
          <div className="flex flex-wrap items-start gap-2">
            <ExportMemoButton
              projectId={projectId}
              evaluationId={evaluation.id}
              evaluationStatus={evaluation.status}
            />
            {/* L2d-3: ad-hoc CSV/MD/HTML export sibling. docx stays on ExportMemoButton. */}
            <ExportFormatMenu
              projectId={projectId}
              evaluationId={evaluation.id}
              evaluationStatus={evaluation.status}
            />
          </div>
        </div>
      </header>
      <CoverageSummary coverage={coverage} />
      {judgments ? (
        <JudgmentSummaryTile results={results} judgments={judgments} />
      ) : null}
      <ErrorsBlock errors={errors} />
      {/* L2b-4: 2-column layout with TelemetrySidebar on the right (xl+). */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Per-policy results ({results.length})
            </h3>
            <PerPolicyResultsTable
              results={results}
              judgments={judgments}
              evidenceSlices={evidenceSlices}
            />
          </section>
        </div>
        <aside data-testid="telemetry-sidebar-slot">
          <TelemetryDisclosure evaluation={evaluation} />
        </aside>
      </div>
        </div>
        {/* Lane 2d / Phase A: side panel mounted as a flex sibling of
            the main content column. In split mode (>=1200px) the panel
            reserves layout space via flex-basis so the main column
            reflows. In drawer mode (<1200px) the panel switches to a
            position:fixed full-height overlay and leaves the flex flow
            (main content reclaims full width). See ED-2d4-10. */}
        <EvaluationSidePanel
          evaluationId={evaluation.id}
          projectId={project.id}
        />
      </div>
    </SidePanelProvider>
  );
}
