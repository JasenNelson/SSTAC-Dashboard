// engine_v2 frontend Lane 1 / Module L1-4: POST /api/engine-v2/projects.
//
// Creates a v2_projects row owned by the authenticated admin user.
// Flow (per plan v7.19 L1-4):
//   1. requireAdminForApi  -> 401 / 403 NextResponse on failure.
//   2. checkCsrf           -> 415 (Content-Type) or 403 (Origin) on failure.
//   3. Zod validate body   -> 400 on schema failure.
//   4. If applicable_policy_ids present and non-empty: server-side universe
//      validation via runProposeCli. FAIL-CLOSED:
//        - runProposeCli throws (CLI unavailable/error) -> 502 proposer_unavailable,
//          NO insert. We refuse to persist an unvalidated curated policy set: an
//          unvalidated id would silently seed a synthetic-zero-seed false-GREEN at
//          evaluation time, so an unverifiable list must block creation.
//        - any submitted id not in (signal_fired UNION floor_tail) ->
//          400 invalid_applicable_policy_id.
//      Universe rationale: signal+floor partitions the full KB (~5860 policies)
//      so ANY valid policy id is in the union.
//      NOTE: validation uses the same env-path convention as
//      /api/engine-v2/projects/propose-policies/route.ts (REG_REVIEW_PYTHON_PATH
//      + REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH).
//   5. INSERT v2_projects (max_files / max_total_bytes use DB defaults per Finding 81).
//   6. 201 with inserted row, or 500 on DB error.

// Cap an error detail string before returning it to the admin client. The route
// is admin-gated so actionable detail is fine, but unbounded stderr/tracebacks
// from the proposer subprocess must not be echoed back wholesale.
const DETAIL_CAP = 300;
function capDetail(message: string): string {
  return message.length > DETAIL_CAP ? message.slice(0, DETAIL_CAP) : message;
}

import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { ProjectCreatePayloadSchema } from "@/lib/engine-v2/zod";
import { runProposeCli } from "@/lib/engine-v2/propose_policies";

export const runtime = "nodejs";

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
  const { client, user } = auth;

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

  // Step 3: Zod validation. Trap JSON parse errors before Zod sees them so
  // malformed bodies surface as 400 rather than uncaught throws.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }
  const parsed = ProjectCreatePayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const payload = parsed.data;

  // Step 4: server-side universe validation for applicable_policy_ids.
  // FAIL-CLOSED: only runs when the list is present and non-empty. Writes a temp
  // app-context file, calls runProposeCli, then checks all submitted ids against
  // the (signal_fired UNION floor_tail) universe. The temp file is cleaned up in
  // finally. If runProposeCli throws, we return 502 and DO NOT INSERT.
  if (payload.applicable_policy_ids && payload.applicable_policy_ids.length > 0) {
    const tmpName = `projects_universe_check_${crypto.randomUUID()}.json`;
    const tmpPath = path.join(os.tmpdir(), tmpName);
    let universeOutput;
    try {
      const appContext = {
        selected_services: payload.selected_services ?? [],
        media_types: payload.media_types ?? [],
        lifecycle_stages: [],
        application_types: payload.application_types ?? [],
      };
      await fs.writeFile(tmpPath, JSON.stringify(appContext), "utf-8");
      universeOutput = await runProposeCli({
        pythonPath: getPythonPath(),
        cliPath: getProposeCliPath(),
        appContextPath: tmpPath,
      });
    } catch (err) {
      // FAIL-CLOSED: the proposer is the only authority that can verify a curated
      // policy set against the KB. If it is unavailable, we refuse to persist an
      // unvalidated list (synthetic-zero-seed false-GREEN guard) -> 502, no insert.
      return NextResponse.json(
        {
          error: "proposer_unavailable",
          detail: capDetail((err as Error).message),
        },
        { status: 502 },
      );
    } finally {
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore cleanup errors
      }
    }

    // Build universe set: signal_fired ids UNION floor_tail_policy_ids.
    const universe = new Set<string>();
    for (const entry of universeOutput.signal_fired) universe.add(entry.policy_id);
    for (const id of universeOutput.floor_tail_policy_ids) universe.add(id);
    // Find the first offender.
    const offender = payload.applicable_policy_ids.find((id) => !universe.has(id));
    if (offender !== undefined) {
      return NextResponse.json(
        {
          error: "invalid_applicable_policy_id",
          detail: `Policy id '${offender}' is not in the proposer universe for this application context.`,
        },
        { status: 400 },
      );
    }
  }

  // Step 5: INSERT. max_files / max_total_bytes intentionally omitted so the
  // DB defaults (50, 524288000) apply per Finding 81.
  const { data, error } = await client
    .from("v2_projects")
    .insert({
      user_id: user.id,
      name: payload.name,
      application_types: payload.application_types,
      selected_services: payload.selected_services,
      media_types: payload.media_types,
      submission_context_overrides: payload.submission_context_overrides,
      model: payload.model ?? null,
      ...(payload.applicable_policy_ids && payload.applicable_policy_ids.length > 0
        ? { applicable_policy_ids: payload.applicable_policy_ids }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "insert_failed",
        detail: error?.message ?? "no row returned",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
