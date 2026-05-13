// engine_v2 frontend Lane 1 / Module L1-5: project detail page (Server Component).
//
// Admin-gated entry point at /dashboard/engine-v2/<projectId>. Renders the
// initial server-side snapshot (project row, files, latest run) and hands the
// rest off to ProjectDetailClient for the upload + extract + polling workflow.

import { notFound } from "next/navigation";
import { requireAdminForServerComponent } from "@/lib/engine-v2/admin_guards";
import { EngineV2Breadcrumbs } from "@/components/engine-v2/EngineV2Breadcrumbs";
import { ProjectDetailClient } from "./ProjectDetailClient";
import type {
  V2Project,
  V2SubmissionFile,
  V2ExtractionRun,
} from "@/lib/engine-v2/types";
import type {
  V2Evaluation,
  V2EvaluationListRow,
} from "@/lib/engine-v2/types_lane2";

interface PageProps {
  // Next.js 15 App Router: params is a Promise (Finding 50-style).
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage(props: PageProps) {
  const { projectId } = await props.params;
  const { client } = await requireAdminForServerComponent();

  // RLS filters v2_projects by auth.uid() = user_id. 0 rows => not owned by
  // this admin OR does not exist; render 404 either way.
  const { data: projectRow, error: projectErr } = await client
    .from("v2_projects")
    .select(
      "id, user_id, name, application_types, selected_services, media_types, submission_context_overrides, applicability_mode, evaluation_backend, embedder_backend, reranker_backend, model, max_files, max_total_bytes, created_at, updated_at",
    )
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr || !projectRow) {
    notFound();
  }
  const project = projectRow as V2Project;

  // Initial file list.
  const { data: fileRows } = await client
    .from("v2_submission_files")
    .select(
      "id, project_id, original_filename, storage_path, size_bytes, mime_type, sha256, uploaded_at, deleted_at",
    )
    .eq("project_id", project.id)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });
  const initialFiles = (fileRows ?? []) as V2SubmissionFile[];

  // Initial latest extraction run (may be null).
  const { data: runRows } = await client
    .from("v2_extraction_runs")
    .select(
      "id, project_id, status, total_files, completed_files, current_file, progress, errors, chunk_progress, updated_at, started_at, completed_at",
    )
    .eq("project_id", project.id)
    .order("started_at", { ascending: false })
    .limit(1);
  const initialRun =
    runRows && runRows.length > 0 ? (runRows[0] as V2ExtractionRun) : null;

  // Codex Round 1 fix (Lane 2c retro): split the evaluations fetch into two
  // queries so the history-list does NOT hydrate raw_eval_result_json blobs
  // for every prior run. Latest row keeps the full payload (results page
  // needs raw_eval_result_json for evidence_slices); the rest of the history
  // only needs id/status/backend/bench/coverage/timestamps/errors.
  const { data: latestEvalRows } = await client
    .from("v2_evaluations")
    .select(
      "id, project_id, extraction_run_id, status, run_id_engine, variant_config_hash, evaluation_backend, embedder_backend, reranker_backend, model, bench_fixture, applicability_mode, coverage_statement, errors, raw_eval_result_json, started_at, completed_at, updated_at",
    )
    .eq("project_id", project.id)
    .order("started_at", { ascending: false })
    .limit(1);
  const initialEvaluation: V2Evaluation | null =
    latestEvalRows && latestEvalRows.length > 0
      ? (latestEvalRows[0] as V2Evaluation)
      : null;

  // History list: slim columns, no JSONB blob. Includes the latest row too
  // so the table still shows "1 of N" + ordering remains stable. Ordered
  // started_at DESC by the caller convention.
  const { data: historyRows } = await client
    .from("v2_evaluations")
    .select(
      "id, status, evaluation_backend, bench_fixture, coverage_statement, started_at, completed_at, errors",
    )
    .eq("project_id", project.id)
    .order("started_at", { ascending: false });
  const evaluationHistory: V2EvaluationListRow[] =
    (historyRows ?? []) as V2EvaluationListRow[];

  // Pass the session access token to the client component (Lane 1 simplification
  // per L1-5 spec). Production should refresh the token client-side.
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  return (
    <div className="space-y-4">
      <EngineV2Breadcrumbs
        segments={[
          { label: "Engine v2", href: "/dashboard/engine-v2" },
          { label: project.name },
        ]}
      />
      <ProjectDetailClient
        project={project}
        initialFiles={initialFiles}
        initialRun={initialRun}
        initialEvaluation={initialEvaluation}
        evaluationHistory={evaluationHistory}
        accessToken={accessToken}
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
      />
    </div>
  );
}
