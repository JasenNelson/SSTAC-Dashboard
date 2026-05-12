// engine_v2 frontend Lane 2c: Reviewer Dashboard landing page.
// Server Component. Admin-gated entry point at /dashboard/engine-v2/.
//
// Lists the current admin user's v2_projects rows (RLS filters by auth.uid())
// alongside per-project at-a-glance status: file count, latest extraction
// status, latest evaluation status, coverage (terminal evals), and judgment
// progress (terminal evals).
//
// Query strategy: a small number of separate Supabase queries with .in() to
// batch the per-project lookups, then a JS-side join. This is intentionally
// simpler than a deeply nested PostgREST select and keeps each query well
// behaved against RLS.

import Link from "next/link";
import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import type {
  V2Project,
  V2ExtractionRun,
} from "@/lib/engine-v2/types";
import type { V2Evaluation } from "@/lib/engine-v2/types_lane2";
import {
  ProjectStatusCard,
  type ProjectStatusCardData,
} from "@/components/engine-v2/ProjectStatusCard";

// Subset of V2Project we need for the dashboard list.
type V2ProjectListRow = Pick<
  V2Project,
  "id" | "name" | "created_at" | "max_files"
>;

export default async function EngineV2LandingPage() {
  const { client } = await requireAdminForServerComponent();

  // RLS on v2_projects filters to auth.uid() = user_id; no explicit user_id
  // filter needed in the query. Order newest-first for owner workflow.
  const { data: projectData, error: projectsError } = await client
    .from("v2_projects")
    .select("id, name, created_at, max_files")
    .order("created_at", { ascending: false });

  const projects: V2ProjectListRow[] = projectData ?? [];

  const projectIds = projects.map((p) => p.id);

  // File counts per project. We fetch only id + project_id with deleted_at IS
  // NULL and tally in JS to keep this a single round-trip even when the count
  // varies per project. RLS already scopes to projects owned by this admin.
  const fileCountByProject = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: fileRows } = await client
      .from("v2_submission_files")
      .select("id, project_id")
      .in("project_id", projectIds)
      .is("deleted_at", null);
    for (const row of fileRows ?? []) {
      const pid =
        typeof (row as { project_id?: unknown }).project_id === "string"
          ? (row as { project_id: string }).project_id
          : null;
      if (pid === null) continue;
      fileCountByProject.set(pid, (fileCountByProject.get(pid) ?? 0) + 1);
    }
  }

  // Latest extraction run per project. We fetch all runs for these projects,
  // ordered by started_at desc, then pick the first per project in JS.
  const latestRunByProject = new Map<string, V2ExtractionRun>();
  if (projectIds.length > 0) {
    const { data: runRows } = await client
      .from("v2_extraction_runs")
      .select(
        "id, project_id, status, total_files, completed_files, current_file, progress, errors, chunk_progress, updated_at, started_at, completed_at",
      )
      .in("project_id", projectIds)
      .order("started_at", { ascending: false });
    for (const row of (runRows ?? []) as V2ExtractionRun[]) {
      if (!latestRunByProject.has(row.project_id)) {
        latestRunByProject.set(row.project_id, row);
      }
    }
  }

  // Latest evaluation per project (same fetch-all-then-pick-first-per-project
  // pattern).
  const latestEvaluationByProject = new Map<string, V2Evaluation>();
  if (projectIds.length > 0) {
    const { data: evalRows } = await client
      .from("v2_evaluations")
      .select(
        "id, project_id, extraction_run_id, status, run_id_engine, variant_config_hash, evaluation_backend, embedder_backend, reranker_backend, model, bench_fixture, applicability_mode, coverage_statement, errors, raw_eval_result_json, started_at, completed_at, updated_at",
      )
      .in("project_id", projectIds)
      .order("started_at", { ascending: false });
    for (const row of (evalRows ?? []) as V2Evaluation[]) {
      if (!latestEvaluationByProject.has(row.project_id)) {
        latestEvaluationByProject.set(row.project_id, row);
      }
    }
  }

  // Per-policy + judgment tallies per evaluation. Only needed for terminal
  // evaluations (the card hides this row otherwise), but we fetch for all
  // latest evals to keep the code simple -- the volume is bounded by the
  // number of projects, not by total per_policy_results rows in the table.
  const latestEvaluationIds: string[] = [];
  for (const ev of latestEvaluationByProject.values()) {
    latestEvaluationIds.push(ev.id);
  }

  const perPolicyTotalByEvaluation = new Map<string, number>();
  const perPolicyIdsByEvaluation = new Map<string, string[]>();
  if (latestEvaluationIds.length > 0) {
    const { data: pprRows } = await client
      .from("v2_per_policy_results")
      .select("id, evaluation_id")
      .in("evaluation_id", latestEvaluationIds);
    for (const row of pprRows ?? []) {
      const evalId =
        typeof (row as { evaluation_id?: unknown }).evaluation_id === "string"
          ? (row as { evaluation_id: string }).evaluation_id
          : null;
      const rowId =
        typeof (row as { id?: unknown }).id === "string"
          ? (row as { id: string }).id
          : null;
      if (evalId === null || rowId === null) continue;
      perPolicyTotalByEvaluation.set(
        evalId,
        (perPolicyTotalByEvaluation.get(evalId) ?? 0) + 1,
      );
      const list = perPolicyIdsByEvaluation.get(evalId) ?? [];
      list.push(rowId);
      perPolicyIdsByEvaluation.set(evalId, list);
    }
  }

  // Judgment counts per evaluation. v2_judgments is keyed by
  // per_policy_result_id; we tally how many distinct per-policy rows for each
  // evaluation have at least one judgment row.
  const judgedCountByEvaluation = new Map<string, number>();
  if (perPolicyIdsByEvaluation.size > 0) {
    const allPerPolicyIds: string[] = [];
    for (const ids of perPolicyIdsByEvaluation.values()) {
      for (const id of ids) allPerPolicyIds.push(id);
    }
    if (allPerPolicyIds.length > 0) {
      const { data: judgmentRows } = await client
        .from("v2_judgments")
        .select("per_policy_result_id")
        .in("per_policy_result_id", allPerPolicyIds);
      // Build a set of per_policy_result_ids that have any judgment.
      const judgedPpr = new Set<string>();
      for (const row of judgmentRows ?? []) {
        const pprId =
          typeof (row as { per_policy_result_id?: unknown })
            .per_policy_result_id === "string"
            ? (row as { per_policy_result_id: string }).per_policy_result_id
            : null;
        if (pprId !== null) judgedPpr.add(pprId);
      }
      // For each evaluation, count how many of its per-policy rows are judged.
      for (const [
        evalId,
        pprIds,
      ] of perPolicyIdsByEvaluation.entries()) {
        let count = 0;
        for (const id of pprIds) if (judgedPpr.has(id)) count += 1;
        judgedCountByEvaluation.set(evalId, count);
      }
    }
  }

  // Assemble per-card payloads.
  const cardData: ProjectStatusCardData[] = projects.map((p) => {
    const latestEvaluation = latestEvaluationByProject.get(p.id) ?? null;
    const perPolicyTotal = latestEvaluation
      ? (perPolicyTotalByEvaluation.get(latestEvaluation.id) ?? 0)
      : 0;
    const judgedCount = latestEvaluation
      ? (judgedCountByEvaluation.get(latestEvaluation.id) ?? 0)
      : 0;
    return {
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      max_files: p.max_files,
      fileCount: fileCountByProject.get(p.id) ?? 0,
      latestRun: latestRunByProject.get(p.id) ?? null,
      latestEvaluation,
      perPolicyTotal,
      judgedCount,
    };
  });

  const hasProjects = !projectsError && cardData.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Projects
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Submission projects you own. Create a new project to upload
            documents and run extraction.
          </p>
        </div>
        <Link
          href="/dashboard/engine-v2/new"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
        >
          New project
        </Link>
      </div>

      {projectsError ? (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-6">
          <h3 className="text-base font-semibold text-red-900 dark:text-red-100">
            Could not load projects
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            Please refresh the page. If the problem persists, contact an
            administrator.
          </p>
        </div>
      ) : !hasProjects ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 p-10 text-center">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            No projects yet
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-md mx-auto">
            Get started by creating your first project. You will be able to
            upload submission documents and trigger extraction once it is
            created.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/engine-v2/new"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-colors"
            >
              New project
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {cardData.map((data) => (
            <ProjectStatusCard key={data.id} data={data} />
          ))}
        </ul>
      )}
    </div>
  );
}
