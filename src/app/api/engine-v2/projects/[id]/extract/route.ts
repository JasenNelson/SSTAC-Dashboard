// engine_v2 frontend Lane 1 / Module L1-6: POST /api/engine-v2/projects/[id]/extract.
//
// Triggers Docling extraction for an admin-owned project. Flow per plan v7.19 L1-6:
//   1. requireAdminForApi             -> 401/403 NextResponse on failure.
//   2. checkCsrf                      -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. LOCAL_ENGINE_ENABLED gate      -> 503 unless env var is literally "true".
//   4. Ownership probe v2_projects    -> 403 on 0 rows (RLS scoping).
//   5. Zero-file guard (Finding 80)   -> 400 if no active v2_submission_files for project.
//   6. Race-safe INSERT pending       -> 23505 (idx_v2_extraction_runs__one_active) -> 409.
//   7. Sequentially materializeToLocal each file (Findings 29, 30). Any throw transitions
//      the row to status='error', best-effort quarantines uploads dir, returns 500.
//   8. Spawn detached pythonw subprocess (Findings 7, 43). Any spawn throw same as step 7.
//      On success transitions row to status='extracting', returns 200 with {run_id, status}.
//
// NOTE on engine_v2 .gitignore (plan L1-6 line 1014): the cross-repo .gitignore edit is
// SKIPPED in this module per the L1-6 file allowlist contract. Single-repo demo posture.

import { NextResponse, type NextRequest } from "next/server";
import * as path from "path";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import {
  materializeToLocal,
  quarantineUploadsDir,
} from "@/lib/engine-v2/storage_materialize";
import { spawnExtractor } from "@/lib/engine-v2/spawn_extraction";
import {
  TERMINAL_EXTRACTION_STATUSES,
  type ExtractionStatus,
} from "@/lib/engine-v2/types";

export const runtime = "nodejs";

function getBasePath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH ??
    "C:/Projects/Regulatory-Review/engine_v2_dashboard_staging"
  );
}

function getPythonPath(): string {
  return process.env.REG_REVIEW_PYTHON_PATH ?? "pythonw.exe";
}

function getScriptPath(): string {
  return (
    process.env.EXTRACT_SCRIPT_PATH ??
    "C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py"
  );
}

// Best-effort: log+swallow so original error response is not masked (Finding 54).
async function bestEffortQuarantine(projectId: string): Promise<void> {
  try {
    const r = await quarantineUploadsDir(projectId);
    if (!r.moved && r.reason !== "source_missing") {
      console.warn(
        `[engine-v2 extract] quarantine no-op for project ${projectId}: ${r.reason}`,
      );
    }
  } catch (err) {
    console.error(
      `[engine-v2 extract] quarantine failed for project ${projectId}: ${(err as Error).message}`,
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client } = auth;

  // Step 2: CSRF.
  const csrf = checkCsrf(request);
  if (!csrf.ok) {
    const status =
      csrf.reason === "missing_content_type" ||
      csrf.reason === "wrong_content_type"
        ? 415
        : 403;
    return NextResponse.json(
      { error: csrf.reason, detail: csrf.detail },
      { status },
    );
  }

  // Step 3: LOCAL_ENGINE_ENABLED gate.
  if (process.env.LOCAL_ENGINE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  const { id: projectId } = await context.params;

  // Step 4: Ownership probe (RLS returns 0 rows for non-owners -> 403).
  const { data: project, error: projectErr } = await client
    .from("v2_projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json(
      { error: "project_not_found_or_forbidden" },
      { status: 403 },
    );
  }

  // Step 5: Zero-file guard (Finding 80). SELECT all active files in one query;
  // reuse the result for step 7 materialization.
  const { data: files, error: filesErr } = await client
    .from("v2_submission_files")
    .select("id, storage_path, mime_type, original_filename")
    .eq("project_id", projectId)
    .is("deleted_at", null);
  if (filesErr) {
    return NextResponse.json(
      { error: "submission_files_query_failed", detail: filesErr.message },
      { status: 500 },
    );
  }
  if (!files || files.length === 0) {
    return NextResponse.json(
      {
        error: "no_active_files",
        message: "Upload at least one file before triggering extraction.",
      },
      { status: 400 },
    );
  }

  // Step 6: Race-safe INSERT (Finding 5). On 23505 against
  // idx_v2_extraction_runs__one_active, re-SELECT existing non-terminal row.
  const totalFiles = files.length;
  const insertResp = await client
    .from("v2_extraction_runs")
    .insert({ project_id: projectId, status: "pending", total_files: totalFiles })
    .select("id, status")
    .single();
  if (insertResp.error) {
    const code = (insertResp.error as { code?: string }).code;
    if (code === "23505") {
      // Derive non-terminal filter from the shared TERMINAL_EXTRACTION_STATUSES
      // constant so a future fourth terminal value cannot silently desync.
      const nonTerminal: ExtractionStatus[] = (["pending", "extracting", "completed", "completed_with_errors", "error"] as ExtractionStatus[]).filter(
        (s) => !TERMINAL_EXTRACTION_STATUSES.includes(s),
      );
      const { data: existing, error: selErr } = await client
        .from("v2_extraction_runs")
        .select("id, status")
        .eq("project_id", projectId)
        .in("status", nonTerminal)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (selErr || !existing) {
        return NextResponse.json(
          {
            error: "idempotency_reselect_failed",
            detail: selErr?.message ?? "no_non_terminal_row",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { run_id: existing.id, status: existing.status },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "extraction_run_insert_failed", detail: insertResp.error.message },
      { status: 500 },
    );
  }
  const runId: string = insertResp.data.id as string;

  // Step 7: Sequential materialization.
  const base = getBasePath();
  const uploadsDir = path.join(base, "data", "v2_dashboard_uploads", projectId);
  const extractsDir = path.join(base, "data", "v2_dashboard_extracts", projectId);
  const statusJsonPath = path.join(uploadsDir, ".extraction_status.json");

  type FileRow = {
    id: string;
    storage_path: string;
    mime_type: string;
    original_filename: string;
  };
  const fileRows = files as FileRow[];

  for (const f of fileRows) {
    // Derive extension from the storage_path's existing extension (server-controlled).
    const ext = path.extname(f.storage_path) || "";
    const localPath = path.join(uploadsDir, `${f.id}${ext}`);
    try {
      await materializeToLocal(client, f.storage_path, localPath);
    } catch (err) {
      const msg = (err as Error).message ?? "unknown";
      await client
        .from("v2_extraction_runs")
        .update({
          status: "error",
          errors: [`Materialization failed: ${msg}`],
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      await bestEffortQuarantine(projectId);
      return NextResponse.json(
        { error: "materialization_failed", detail: msg },
        { status: 500 },
      );
    }
  }

  // Step 8: Spawn the detached extractor. Wrap in try/catch.
  try {
    spawnExtractor({
      pythonPath: getPythonPath(),
      scriptPath: getScriptPath(),
      sourceDir: uploadsDir,
      outputDir: extractsDir,
      progressFilePath: statusJsonPath,
    });
  } catch (err) {
    const msg = (err as Error).message ?? "unknown";
    await client
      .from("v2_extraction_runs")
      .update({
        status: "error",
        errors: [`Subprocess spawn failed: ${msg}`],
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    await bestEffortQuarantine(projectId);
    return NextResponse.json(
      { error: "subprocess_spawn_failed", detail: msg },
      { status: 500 },
    );
  }

  // Promote pending -> extracting on successful spawn.
  await client
    .from("v2_extraction_runs")
    .update({ status: "extracting" })
    .eq("id", runId);

  return NextResponse.json(
    { run_id: runId, status: "extracting" },
    { status: 200 },
  );
}
