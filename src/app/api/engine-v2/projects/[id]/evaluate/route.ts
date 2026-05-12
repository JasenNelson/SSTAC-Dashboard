// engine_v2 frontend Lane 2a / Module L2a-2: POST /api/engine-v2/projects/[id]/evaluate.
//
// Triggers an engine_v2 evaluation against the latest completed extraction
// of an admin-owned project. Mirrors Lane 1's /extract route in structure:
//   1. requireAdminForApi             -> 401/403 NextResponse on failure.
//   2. checkCsrf                      -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. LOCAL_ENGINE_ENABLED gate      -> 503 unless env var is literally "true".
//   4. ENGINE_V2_EVAL_BACKEND_DEFAULT validation -> 500 if invalid.
//   5. Ownership probe v2_projects    -> 403 on 0 rows (RLS scoping).
//   6. Latest completed extraction    -> 400 'no_completed_extraction' if none.
//   7. Body parse + Zod validation    -> 400 invalid_json | invalid_payload.
//   8. Single-VERBATIM-JSON resolver  -> 500 on 0 / >=2 artifacts.
//   9. Race-safe INSERT v2_evaluations -> 23505 -> 409 with existing row.
//  10. Write scenario YAML            -> mkdir -p + fs.writeFile.
//  11. Spawn detached run_owner_scenario.py with the local async-error race
//      pattern copied from spawn_extraction.ts (see SPAWN_RACE_WINDOW_MS).
//      On reject: status='error' + 500. On success: status='running' + 200.

import { spawn } from "child_process";
import { openSync } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { NextResponse, type NextRequest } from "next/server";

import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { composeScenarioYaml } from "@/lib/engine-v2/scenario_yaml";
import {
  TERMINAL_EVALUATION_STATUSES,
  type EvaluationStatus,
} from "@/lib/engine-v2/types_lane2";
import { EvalTriggerPayloadSchema } from "@/lib/engine-v2/zod_lane2";

export const runtime = "nodejs";

const SPAWN_RACE_WINDOW_MS = 500;

function getBasePath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_BASE_PATH ??
    "C:/Projects/Regulatory-Review/engine_v2_dashboard_staging"
  );
}

function getPythonPath(): string {
  return process.env.REG_REVIEW_PYTHON_PATH ?? "pythonw.exe";
}

function getScenarioScriptPath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_SCRIPT_PATH ??
    "C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/run_owner_scenario.py"
  );
}

function getBenchFixture(): string {
  return process.env.REG_REVIEW_ENGINE_V2_BENCH_FIXTURE ?? "bench_43_full";
}

type EvalBackend = "stub" | "live";

function readEvalBackendDefault(): EvalBackend | { error: string } {
  const raw = process.env.ENGINE_V2_EVAL_BACKEND_DEFAULT;
  if (raw === undefined || raw === "") return "stub";
  if (raw === "stub" || raw === "live") return raw;
  return { error: "invalid_eval_backend_default" };
}

function getOllamaUrl(): string {
  return process.env.OLLAMA_URL ?? "http://localhost:11434";
}

function getOllamaModel(): string {
  return (
    process.env.ENGINE_V2_OLLAMA_MODEL ?? "qwen2.5:14b-instruct-q4_K_M"
  );
}

// Preflight Ollama for live backend. Returns null on success, or an
// inline {error, ollama_url} payload on failure (timeout / network / non-2xx).
async function preflightOllama(
  ollamaUrl: string,
): Promise<{ error: string; ollama_url: string } | null> {
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) {
      return { error: "ollama_unreachable", ollama_url: ollamaUrl };
    }
    return null;
  } catch {
    return { error: "ollama_unreachable", ollama_url: ollamaUrl };
  }
}

interface SpawnScenarioArgs {
  pythonPath: string;
  scriptPath: string;
  scenarioConfigPath: string;
  outputDir: string;
}

// Local copy of spawn_extraction.ts's async-error race pattern. We intentionally
// do not modify spawn_extraction.ts (Lane 1 file). See SPAWN_RACE_WINDOW_MS:
// Node emits ENOENT/EACCES asynchronously on the child's 'error' event, so a
// naive spawn() lets a misconfigured pythonPath silently succeed. We race the
// 'spawn' (success) and 'error' (failure) events with a short wait window and
// surface a real rejection that the route can stamp into v2_evaluations.errors.
async function spawnScenarioRunner(args: SpawnScenarioArgs): Promise<void> {
  const cli = [
    args.scriptPath,
    "--scenario-config",
    args.scenarioConfigPath,
    "--output-dir",
    args.outputDir,
  ];

  // Capture subprocess stdout/stderr to log files in the run dir so a crash
  // is diagnosable from the dashboard (previously stdio:'ignore' threw away
  // the engine's anti-leak guard error, costing a 30-min stale-timeout to
  // surface). The stale-handler in /evaluation-status reads stderr.log
  // when present and appends a tail into v2_evaluations.errors.
  const stdoutPath = `${args.outputDir}/subprocess_stdout.log`;
  const stderrPath = `${args.outputDir}/subprocess_stderr.log`;
  const outFd = openSync(stdoutPath, "a");
  const errFd = openSync(stderrPath, "a");

  const child = spawn(args.pythonPath, cli, {
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      child.removeListener("spawn", onSpawn);
      child.removeListener("error", onError);
      clearTimeout(timer);
      fn();
    };
    const onSpawn = () => settle(resolve);
    const onError = (err: Error) => settle(() => reject(err));
    child.once("spawn", onSpawn);
    child.once("error", onError);
    const timer = setTimeout(() => settle(resolve), SPAWN_RACE_WINDOW_MS);
  });

  child.unref();
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

  // Step 4: env-driven default backend validation. Per plan v0.2 ED-2a-1,
  // any value other than 'stub'/'live' is a configuration error. The effective
  // backend (request override -> env default) is resolved after Zod parse.
  const evalBackendResolved = readEvalBackendDefault();
  if (typeof evalBackendResolved !== "string") {
    return NextResponse.json(evalBackendResolved, { status: 500 });
  }
  const envBackendDefault: EvalBackend = evalBackendResolved;

  const { id: projectId } = await context.params;

  // Step 5: Ownership probe (RLS returns 0 rows for non-owners -> 403).
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

  // Step 6: latest completed extraction. Lane 2a always uses the most-recent
  // terminal-successful extraction; Lane 2b will add explicit selection via
  // the (optional) extraction_run_id field in the payload.
  const { data: extractionRow, error: extractionErr } = await client
    .from("v2_extraction_runs")
    .select("id, status, started_at")
    .eq("project_id", projectId)
    .in("status", ["completed", "completed_with_errors"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (extractionErr) {
    return NextResponse.json(
      {
        error: "extraction_run_query_failed",
        detail: extractionErr.message,
      },
      { status: 500 },
    );
  }
  if (!extractionRow) {
    return NextResponse.json(
      {
        error: "no_completed_extraction",
        message: "Run extraction first.",
      },
      { status: 400 },
    );
  }
  const extractionRunId: string = extractionRow.id as string;

  // Step 7: body parse + Zod validation. Empty body is acceptable.
  let payload: unknown;
  try {
    const raw = await request.text();
    payload = raw.length === 0 ? {} : JSON.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: "invalid_json", detail: (err as Error).message },
      { status: 400 },
    );
  }
  const parsed = EvalTriggerPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", detail: parsed.error.message },
      { status: 400 },
    );
  }

  // ED-2b-4: per-evaluation backend toggle. Request override wins; otherwise
  // fall back to env default ('stub' if unset). Live mode requires an Ollama
  // preflight; failure short-circuits the flow with 503 before any DB writes.
  const requestedBackend = parsed.data.evaluation_backend ?? null;
  const effectiveBackend: EvalBackend = requestedBackend ?? envBackendDefault;
  const ollamaModel = getOllamaModel();

  if (effectiveBackend === "live") {
    const ollamaUrl = getOllamaUrl();
    const preflight = await preflightOllama(ollamaUrl);
    if (preflight) {
      return NextResponse.json(preflight, { status: 503 });
    }
  }

  // Step 8: locate the single verbatim JSON artifact for this project.
  // Lane 2a contract: exactly one *.json must exist; 0 or >=2 is a setup error.
  const base = getBasePath();
  const extractsDir = path.join(base, "data", "v2_dashboard_extracts", projectId);
  let extractEntries: string[];
  try {
    extractEntries = await fs.readdir(extractsDir);
  } catch (err) {
    return NextResponse.json(
      {
        error: "no_extracted_json",
        detail: (err as Error).message,
      },
      { status: 500 },
    );
  }
  const jsonFiles = extractEntries.filter((name) => name.toLowerCase().endsWith(".json"));
  if (jsonFiles.length === 0) {
    return NextResponse.json(
      { error: "no_extracted_json" },
      { status: 500 },
    );
  }
  if (jsonFiles.length >= 2) {
    return NextResponse.json(
      {
        error: "multiple_extraction_artifacts_for_project",
        count: jsonFiles.length,
      },
      { status: 500 },
    );
  }
  const verbatimJsonPath = path.join(extractsDir, jsonFiles[0]!);

  // Step 9: race-safe INSERT v2_evaluations. On idx_v2_evaluations__one_active
  // unique violation (23505) re-SELECT and return the existing non-terminal row.
  const benchFixture = getBenchFixture();
  const applicabilityMode = "off";
  // In live mode the embedder must also be real, otherwise the retriever uses
  // SHAKE-256 stub embeddings against the real corpus -> meaningless candidates.
  // The reranker stays disabled (Lane 2c default; live with reranker is a
  // separate config opt-in).
  const embedderBackend: "stub" | "real" =
    effectiveBackend === "live" ? "real" : "stub";
  const rerankerBackend = "disabled";
  const embedderModelPath: string | undefined =
    effectiveBackend === "live"
      ? process.env.ENGINE_V2_EMBEDDER_MODEL_PATH ??
        "C:/Projects/models/bge-small-en-v1.5/"
      : undefined;
  const insertResp = await client
    .from("v2_evaluations")
    .insert({
      project_id: projectId,
      extraction_run_id: extractionRunId,
      status: "pending",
      evaluation_backend: effectiveBackend,
      embedder_backend: embedderBackend,
      reranker_backend: rerankerBackend,
      bench_fixture: benchFixture,
      applicability_mode: applicabilityMode,
      model: effectiveBackend === "live" ? ollamaModel : null,
    })
    .select("id, status")
    .single();
  if (insertResp.error) {
    const code = (insertResp.error as { code?: string }).code;
    if (code === "23505") {
      const allStatuses: EvaluationStatus[] = [
        "pending",
        "running",
        "completed",
        "completed_with_errors",
        "error",
      ];
      const nonTerminal: EvaluationStatus[] = allStatuses.filter(
        (s) => !TERMINAL_EVALUATION_STATUSES.includes(s),
      );
      const { data: existing, error: selErr } = await client
        .from("v2_evaluations")
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
        { evaluation_id: existing.id, status: existing.status },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: "evaluation_insert_failed",
        detail: insertResp.error.message,
      },
      { status: 500 },
    );
  }
  const evaluationId: string = insertResp.data.id as string;

  // Step 10: write scenario YAML. Run dirs are retained on terminal transition
  // per Lane 2a "eval-run-dir cleanup invariant" (v0.2 amendment).
  const evalRunDir = path.join(
    base,
    "data",
    "v2_dashboard_eval_runs",
    evaluationId,
  );
  const scenarioYamlPath = path.join(evalRunDir, "scenario.yaml");
  try {
    await fs.mkdir(evalRunDir, { recursive: true });
    const yaml = composeScenarioYaml({
      // Engine rejects scenario_ids containing 4-5 digit numeric segments
      // (anti-leak guard against BC site file numbers like "13254"). UUIDs
      // frequently contain numeric hex subgroups (e.g. "4536") that trip
      // this guard. Use a guaranteed-anonymous handle derived from the eval
      // UUID's prefix with only letters: takes the first 8 hex chars,
      // remaps digits -> letters via charCode shift so no numeric run
      // survives. Example: "7b5b4e60" -> "hbcbeegh".
      scenarioId: `DASHBOARD-EVAL-${evaluationId
        .replace(/-/g, "")
        .slice(0, 12)
        .replace(/[0-9]/g, (d) => String.fromCharCode(97 + Number(d)))}`,
      extractPath: verbatimJsonPath,
      benchFixture,
      applicabilityMode,
      evaluationBackend: effectiveBackend,
      embedderBackend,
      rerankerBackend,
      model: effectiveBackend === "live" ? ollamaModel : "",
      variant: "graph_v2_default",
      embedderModelPath,
    });
    await fs.writeFile(scenarioYamlPath, yaml, "utf8");
  } catch (err) {
    const msg = (err as Error).message ?? "unknown";
    await client
      .from("v2_evaluations")
      .update({
        status: "error",
        errors: [`Scenario YAML write failed: ${msg}`],
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluationId);
    return NextResponse.json(
      { error: "scenario_yaml_write_failed", detail: msg },
      { status: 500 },
    );
  }

  // Step 11: spawn detached subprocess. Async-error race pattern copied from
  // spawn_extraction.ts (we don't import/extend it -- per allowlist).
  try {
    await spawnScenarioRunner({
      pythonPath: getPythonPath(),
      scriptPath: getScenarioScriptPath(),
      scenarioConfigPath: scenarioYamlPath,
      outputDir: evalRunDir,
    });
  } catch (err) {
    const msg = (err as Error).message ?? "unknown";
    await client
      .from("v2_evaluations")
      .update({
        status: "error",
        errors: [`Subprocess spawn failed: ${msg}`],
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluationId);
    return NextResponse.json(
      { error: "subprocess_spawn_failed", detail: msg },
      { status: 500 },
    );
  }

  // Promote pending -> running on successful spawn.
  await client
    .from("v2_evaluations")
    .update({ status: "running" })
    .eq("id", evaluationId);

  return NextResponse.json(
    { evaluation_id: evaluationId, status: "running" },
    { status: 200 },
  );
}
