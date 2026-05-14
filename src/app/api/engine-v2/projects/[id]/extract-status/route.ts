// engine_v2 frontend Lane 1 / Module L1-6: POST /api/engine-v2/projects/[id]/extract-status.
//
// Verb is POST (not GET) per Finding 37: CSRF Content-Type + Origin checks apply to
// state-mutating routes; this handler updates v2_extraction_runs on stale transition
// and on terminal transitions, so safe-GET semantics no longer fit. Body carries the
// run_id under Zod ExtractStatusSyncPayloadSchema.
//
// Flow per plan v7.19 L1-6 lines 1033-1047:
//   1. requireAdminForApi.
//   2. checkCsrf.
//   3. Zod parse {run_id}.
//   4. Ownership probe v2_projects -> 403.
//   5. SELECT v2_extraction_runs by (project_id, run_id) -> 404.
//   6. If row.status is terminal -> return row as-is.
//   7. Read status JSON file via status_parsing.ts.
//   8. Missing file + non-terminal status: stale check via row.started_at baseline.
//   9. Present file: parse + merge; stale check via parsed.updatedAt.
//   10. Cleanup-on-transition: terminal-success -> delete uploads dir; terminal-error ->
//       best-effort quarantineUploadsDir. Extracts dir retained always.
//   11. UPDATE row + return latest.

import { NextResponse, type NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { ExtractStatusSyncPayloadSchema } from "@/lib/engine-v2/zod";
import { parseStatusJson } from "@/lib/engine-v2/status_parsing";
import { isContained } from "@/lib/engine-v2/path_containment";
import { quarantineUploadsDir } from "@/lib/engine-v2/storage_materialize";
import {
  TERMINAL_EXTRACTION_STATUSES,
  type ExtractionStatus,
  type ExtractionStatusJson,
  type V2ExtractionRun,
} from "@/lib/engine-v2/types";

export const runtime = "nodejs";

const DEFAULT_STALE_MS = 3600000; // 60 minutes (Finding 7).

function getBasePath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH ??
    "C:/Projects/Regulatory-Review/engine_v2_dashboard_staging"
  );
}

function getStaleMs(): number {
  const raw = process.env.EXTRACT_STALE_TIMEOUT_MS;
  if (!raw) return DEFAULT_STALE_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALE_MS;
}

function isTerminal(status: ExtractionStatus): boolean {
  return (TERMINAL_EXTRACTION_STATUSES as readonly string[]).includes(status);
}

async function readStatusFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function safeDeleteUploadsDir(projectId: string): Promise<void> {
  const base = getBasePath();
  const uploadsBase = path.resolve(base, "data", "v2_dashboard_uploads");
  const target = path.resolve(uploadsBase, projectId);
  try {
    await fs.promises.stat(target);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  const contained = await isContained(uploadsBase, target);
  if (!contained) {
    throw new Error(
      `uploads_cleanup_containment_violation:${target}`,
    );
  }
  await fs.promises.rm(target, { recursive: true, force: true });
}

async function bestEffortQuarantine(projectId: string): Promise<void> {
  try {
    const r = await quarantineUploadsDir(projectId);
    if (!r.moved && r.reason !== "source_missing") {
      console.warn(
        `[engine-v2 extract-status] quarantine no-op for project ${projectId}: ${r.reason}`,
      );
    }
  } catch (err) {
    console.error(
      `[engine-v2 extract-status] quarantine failed for project ${projectId}: ${(err as Error).message}`,
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

  // Step 3: Zod validate body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ExtractStatusSyncPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { run_id: runId } = parsed.data;

  const { id: projectId } = await context.params;

  // Step 4: Ownership probe.
  const { data: project, error: projectErr } = await client
    .from("v2_projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json(
      { error: "project_not_found_or_forbidden" },
      { status: 403 },
    );
  }

  // Step 5: Locate run row.
  const { data: runRow, error: runErr } = await client
    .from("v2_extraction_runs")
    .select(
      "id, project_id, status, total_files, completed_files, current_file, progress, errors, chunk_progress, updated_at, started_at, completed_at",
    )
    .eq("project_id", projectId)
    .eq("id", runId)
    .maybeSingle();
  if (runErr || !runRow) {
    return NextResponse.json(
      { error: "run_not_found" },
      { status: 404 },
    );
  }
  const row = runRow as V2ExtractionRun;

  // Step 6: Terminal short-circuit -- no file read, no cleanup re-fire.
  if (isTerminal(row.status)) {
    return NextResponse.json(row, { status: 200 });
  }

  // Step 7: Read status JSON file defensively.
  const base = getBasePath();
  const statusJsonPath = path.join(
    base,
    "data",
    "v2_dashboard_uploads",
    projectId,
    ".extraction_status.json",
  );
  let rawJson: string | null;
  try {
    rawJson = await readStatusFileIfExists(statusJsonPath);
  } catch (err) {
    return NextResponse.json(
      {
        error: "status_file_read_failed",
        detail: (err as Error).message ?? "unknown",
      },
      { status: 500 },
    );
  }

  const staleMs = getStaleMs();
  const nowMs = Date.now();

  // Step 8: Missing file + non-terminal status. Use row.started_at as stale baseline.
  if (rawJson === null) {
    const startedMs = new Date(row.started_at).getTime();
    if (Number.isFinite(startedMs) && nowMs - startedMs > staleMs) {
      const completedAt = new Date().toISOString();
      // Cleanup-before-UPDATE (L1-6 BLOCKER #2): run quarantine BEFORE the terminal
      // UPDATE so a crash between the two does NOT leave the row in a permanent terminal
      // state with orphaned uploads. If cleanup fails here we still do the UPDATE so the
      // row reaches a terminal error; the orphaned uploads will need manual cleanup, but
      // future polls will no longer short-circuit at step 6.
      await bestEffortQuarantine(projectId);
      const { data: updated, error: updErr } = await client
        .from("v2_extraction_runs")
        .update({
          status: "error",
          errors: ["Subprocess never wrote status file within stale timeout"],
          completed_at: completedAt,
        })
        .eq("id", runId)
        .select(
          "id, project_id, status, total_files, completed_files, current_file, progress, errors, chunk_progress, updated_at, started_at, completed_at",
        )
        .single();
      if (updErr || !updated) {
        return NextResponse.json(
          {
            error: "stale_transition_update_failed",
            detail: updErr?.message ?? "no_row",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(updated, { status: 200 });
    }
    // Within window: return row as-is.
    return NextResponse.json(row, { status: 200 });
  }

  // Step 9: Parse + merge. parseStatusJson is permissive; on malformed JSON it returns
  // the sentinel `{status: 'error', errors: ['status_json_parse_error']}`.
  const parsedStatus = parseStatusJson(rawJson) as Partial<ExtractionStatusJson>;

  // Stale check via parsed.updatedAt (Finding 7): if absent or older than staleMs and
  // the parsed status is not already terminal, transition to error.
  let staleTransition = false;
  const candidateStatus = parsedStatus.status ?? row.status;
  if (!isTerminal(candidateStatus)) {
    if (typeof parsedStatus.updatedAt === "string") {
      const upd = new Date(parsedStatus.updatedAt).getTime();
      if (Number.isFinite(upd) && nowMs - upd > staleMs) {
        staleTransition = true;
      }
    }
  }

  const completedAtIso = new Date().toISOString();
  let nextStatus: ExtractionStatus = candidateStatus;
  let nextErrors: string[] = Array.isArray(parsedStatus.errors)
    ? parsedStatus.errors
    : (row.errors ?? []);
  let nextCompletedAt: string | null = row.completed_at;

  if (staleTransition) {
    nextStatus = "error";
    nextErrors = ["Extraction subprocess silent beyond timeout (stale)"];
    nextCompletedAt = completedAtIso;
  } else if (isTerminal(candidateStatus)) {
    nextCompletedAt = completedAtIso;
  }

  // Build the UPDATE patch. Only include known-typed fields.
  const patch: Record<string, unknown> = {
    status: nextStatus,
    errors: nextErrors,
    completed_at: nextCompletedAt,
  };
  if (typeof parsedStatus.totalFiles === "number") {
    patch.total_files = parsedStatus.totalFiles;
  }
  if (typeof parsedStatus.completedFiles === "number") {
    patch.completed_files = parsedStatus.completedFiles;
  }
  if (typeof parsedStatus.currentFile === "string") {
    patch.current_file = parsedStatus.currentFile;
  }
  if (typeof parsedStatus.progress === "number") {
    patch.progress = parsedStatus.progress;
  }
  if (typeof parsedStatus.chunkProgress === "string") {
    patch.chunk_progress = parsedStatus.chunkProgress;
  }

  // Step 10: Cleanup-on-transition BEFORE the terminal UPDATE (plan line 1046-1047).
  // If cleanup throws and we then bail out without UPDATE, the row stays non-terminal
  // and a future poll re-runs cleanup. Reverse order risks orphaning uploads forever:
  // terminal row short-circuits at step 6, so a failed post-UPDATE cleanup is never
  // retried. Cleanup failures are best-effort here; the row UPDATE still proceeds.
  if (nextStatus === "completed" || nextStatus === "completed_with_errors") {
    try {
      await safeDeleteUploadsDir(projectId);
    } catch (err) {
      console.error(
        `[engine-v2 extract-status] uploads dir cleanup failed for project ${projectId}: ${(err as Error).message}`,
      );
    }
  } else if (nextStatus === "error") {
    await bestEffortQuarantine(projectId);
  }

  // Step 11: Upsert (UPDATE) and return latest row.
  const { data: updated, error: updErr } = await client
    .from("v2_extraction_runs")
    .update(patch)
    .eq("id", runId)
    .select(
      "id, project_id, status, total_files, completed_files, current_file, progress, errors, chunk_progress, updated_at, started_at, completed_at",
    )
    .single();
  if (updErr || !updated) {
    return NextResponse.json(
      {
        error: "status_update_failed",
        detail: updErr?.message ?? "no_row",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(updated, { status: 200 });
}
