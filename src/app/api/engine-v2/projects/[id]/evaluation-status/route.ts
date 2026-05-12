// engine_v2 frontend Lane 2a / Module L2a-3: POST /api/engine-v2/projects/[id]/evaluation-status.
//
// Verb is POST (not GET) per Finding 37: CSRF Content-Type + Origin checks apply
// to state-mutating routes; this handler imports eval_result.json into the
// database on terminal transition, so safe-GET semantics no longer fit. Body
// carries the evaluation_id under EvalStatusSyncPayloadSchema.
//
// Flow per plan v0.2 L2a-3 lines 257-273:
//   1. requireAdminForApi.
//   2. checkCsrf.
//   3. Zod parse {evaluation_id}.
//   4. Ownership probe v2_projects -> 403.
//   5. SELECT v2_evaluations by (project_id, evaluation_id) -> 404.
//   6. If row.status is terminal -> return as-is.
//   7. Look for <base>/data/v2_dashboard_eval_runs/<eval_id>/<engine_run_id>/eval_result.json
//      by walking the eval_id dir for any subdir containing eval_result.json.
//   8. If found AND non-terminal: parse + importEvalResult; on parse error mark row 'error'.
//   9. If not found AND now() - started_at > stale-timeout: mark row 'error'.
//  10. Otherwise return row as-is (UI continues polling).
//
// Eval-run-dir cleanup invariant (codex v0.2 amendment): NO cleanup on terminal
// transition. Run dirs are retained for audit. Lane 2b janitor can reap them.

import { NextResponse, type NextRequest } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { EvalStatusSyncPayloadSchema } from "@/lib/engine-v2/zod_lane2";
import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
  type V2Evaluation,
} from "@/lib/engine-v2/types_lane2";
import {
  importEvalResult,
  type EvalResultEnvelope,
} from "@/lib/engine-v2/eval_result_import";

export const runtime = "nodejs";

const DEFAULT_EVAL_STALE_MS = 1800000; // 30 minutes.

const EVALUATION_COLS =
  "id, project_id, extraction_run_id, status, run_id_engine, variant_config_hash, evaluation_backend, embedder_backend, reranker_backend, model, bench_fixture, applicability_mode, coverage_statement, errors, raw_eval_result_json, started_at, completed_at, updated_at";

function getBasePath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH ??
    "C:/Projects/Regulatory-Review/engine_v2_dashboard_staging"
  );
}

function getStaleMs(): number {
  const raw = process.env.EVAL_STALE_TIMEOUT_MS;
  if (!raw) return DEFAULT_EVAL_STALE_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_EVAL_STALE_MS;
}

function isTerminal(status: EvaluationStatus): boolean {
  return (TERMINAL_EVALUATION_STATUSES as readonly string[]).includes(status);
}

// Walk <evalDir> looking for any subdirectory that contains eval_result.json.
// Engine emits one UUID-named subdir per run. If multiple subdirs exist (e.g.
// retried run), pick the lexically-first for determinism. Returns null when no
// eval_result.json is present yet.
async function findEvalResultJson(evalDir: string): Promise<string | null> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(evalDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const subdirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const name of subdirs) {
    const candidate = path.join(evalDir, name, "eval_result.json");
    try {
      await fs.promises.access(candidate, fs.constants.R_OK);
      return candidate;
    } catch {
      // Try next subdir.
    }
  }
  return null;
}

async function readEvalResultJson(filePath: string): Promise<string> {
  return await fs.promises.readFile(filePath, "utf-8");
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
  const parsed = EvalStatusSyncPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { evaluation_id: evaluationId } = parsed.data;

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

  // Step 5: Locate evaluation row scoped to this project.
  const { data: evalRow, error: evalErr } = await client
    .from("v2_evaluations")
    .select(EVALUATION_COLS)
    .eq("project_id", projectId)
    .eq("id", evaluationId)
    .maybeSingle();
  if (evalErr || !evalRow) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }
  const row = evalRow as unknown as V2Evaluation;

  // Step 6: Terminal short-circuit -- no file read, no re-import.
  if (isTerminal(row.status)) {
    return NextResponse.json(row, { status: 200 });
  }

  // Step 7: Locate eval_result.json under <base>/data/v2_dashboard_eval_runs/<eval_id>/<engine_run_id>/.
  const base = getBasePath();
  const evalDir = path.join(
    base,
    "data",
    "v2_dashboard_eval_runs",
    evaluationId,
  );

  let evalResultPath: string | null;
  try {
    evalResultPath = await findEvalResultJson(evalDir);
  } catch (err) {
    return NextResponse.json(
      {
        error: "eval_dir_scan_failed",
        detail: (err as Error).message ?? "unknown",
      },
      { status: 500 },
    );
  }

  const nowMs = Date.now();
  const staleMs = getStaleMs();

  // Step 8: file found AND non-terminal -> parse + import.
  if (evalResultPath !== null) {
    let parsedJson: EvalResultEnvelope;
    try {
      const txt = await readEvalResultJson(evalResultPath);
      parsedJson = JSON.parse(txt) as EvalResultEnvelope;
    } catch (err) {
      // Malformed JSON: stamp the row as 'error' so the UI stops polling.
      const completedAtIso = new Date().toISOString();
      const { data: updated, error: updErr } = await client
        .from("v2_evaluations")
        .update({
          status: "error",
          errors: [`eval_result_parse_error: ${(err as Error).message ?? "unknown"}`],
          completed_at: completedAtIso,
        })
        .eq("id", evaluationId)
        .select(EVALUATION_COLS)
        .single();
      if (updErr || !updated) {
        return NextResponse.json(
          {
            error: "parse_error_transition_failed",
            detail: updErr?.message ?? "no_row",
          },
          { status: 500 },
        );
      }
      return NextResponse.json(updated, { status: 200 });
    }

    try {
      await importEvalResult(client, evaluationId, parsedJson);
    } catch (err) {
      // Import failed mid-flight. Per codex ordering: per_policy rows may be
      // committed but evaluation row is still non-terminal. Return current row
      // so the UI keeps polling; the next sync attempt will retry the import
      // (UPSERT DO UPDATE is idempotent).
      return NextResponse.json(
        {
          error: "eval_result_import_failed",
          detail: (err as Error).message ?? "unknown",
        },
        { status: 500 },
      );
    }

    // Re-SELECT to return the post-import row state.
    const { data: latest, error: latestErr } = await client
      .from("v2_evaluations")
      .select(EVALUATION_COLS)
      .eq("id", evaluationId)
      .single();
    if (latestErr || !latest) {
      return NextResponse.json(
        {
          error: "post_import_select_failed",
          detail: latestErr?.message ?? "no_row",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(latest, { status: 200 });
  }

  // Step 9: file NOT found. Stale-timeout transition keyed on started_at.
  const startedMs = new Date(row.started_at).getTime();
  if (Number.isFinite(startedMs) && nowMs - startedMs > staleMs) {
    const completedAtIso = new Date().toISOString();
    const { data: updated, error: updErr } = await client
      .from("v2_evaluations")
      .update({
        status: "error",
        errors: ["Subprocess silent beyond stale timeout"],
        completed_at: completedAtIso,
      })
      .eq("id", evaluationId)
      .select(EVALUATION_COLS)
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

  // Step 10: still within window, file not yet present -> return row as-is.
  return NextResponse.json(row, { status: 200 });
}
