// engine_v2 frontend Lane 1 / Module L1-4c: POST /api/engine-v2/projects/propose-policies.
//
// Runs the engine proposer CLI against a caller-supplied application context and
// returns the scored + filtered policy list. This route is STATELESS: it does not
// create or modify any database rows. The wizard calls it on step 4 entry and on
// retry; the result is held client-side until the HITL curates and submits.
//
// Flow:
//   1. requireAdminForApi             -> 401/403 NextResponse on failure.
//   2. checkCsrf                      -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. LOCAL_ENGINE_ENABLED gate      -> 503 unless env var is literally "true".
//   4. Body parse + Zod validation    -> 400 invalid_json | invalid_payload.
//   5. Write app-context JSON to tmp  -> crypto-random name under os.tmpdir().
//   6. runProposeCli                  -> 502 on CLI error; 200 with output on success.
//   7. finally: delete tmp file.
//
// Engine paths:
//   python:  REG_REVIEW_PYTHON_PATH env (default "python" -- stdout-dependent spawn)
//   CLI:     REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH env
//            default "C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/propose_applicable_policies_cli.py"
//
// NOTE: The default CLI path points at the engine-v2 worktree. On the live box
// .env.local overrides REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH to the deployed
// engine path. This mirrors the pattern at [id]/evaluate/route.ts:52-54.
// The default checkout on a fresh clone is STALE and lacks the CLI until the
// engine M1a branch is merged; this is a known HELD-FOR-OWNER seam.

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { ProposePoliciesPayloadSchema } from "@/lib/engine-v2/zod";
import { runProposeCli } from "@/lib/engine-v2/propose_policies";

export const runtime = "nodejs";

// Cap an error detail string before returning it to the admin client. The route
// is admin-gated so actionable detail is fine, but unbounded stderr/tracebacks
// from the proposer subprocess must not be echoed back wholesale.
const DETAIL_CAP = 300;
function capDetail(message: string): string {
  return message.length > DETAIL_CAP ? message.slice(0, DETAIL_CAP) : message;
}

function getPythonPath(): string {
  // Default "python" (not "pythonw.exe"): the proposer CLI is stdout-dependent
  // and pythonw stdout behavior is not guaranteed. The REG_REVIEW_PYTHON_PATH
  // env override is unchanged (the live box points this at the engine venv).
  return process.env.REG_REVIEW_PYTHON_PATH ?? "python";
}

function getProposeCliPath(): string {
  return (
    process.env.REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH ??
    "C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/propose_applicable_policies_cli.py"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;

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

  // Step 3: LOCAL_ENGINE_ENABLED gate (mirrors extract/evaluate route pattern).
  if (process.env.LOCAL_ENGINE_ENABLED !== "true") {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  // Step 4: body parse + Zod validation.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }
  const parsed = ProposePoliciesPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  // Step 5: write app-context JSON to a temp file.
  const tmpName = `propose_ctx_${crypto.randomUUID()}.json`;
  const tmpPath = path.join(os.tmpdir(), tmpName);

  try {
    const appContext = {
      selected_services: payload.selected_services,
      media_types: payload.media_types,
      lifecycle_stages: payload.lifecycle_stages,
      application_types: payload.application_types,
    };
    await fs.writeFile(tmpPath, JSON.stringify(appContext), "utf-8");

    // Step 6: run proposer CLI.
    const output = await runProposeCli({
      pythonPath: getPythonPath(),
      cliPath: getProposeCliPath(),
      appContextPath: tmpPath,
    });

    return NextResponse.json(output, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "proposer_failed", detail: capDetail(message) },
      { status: 502 },
    );
  } finally {
    // Step 7: always clean up the temp file.
    try {
      await fs.unlink(tmpPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
