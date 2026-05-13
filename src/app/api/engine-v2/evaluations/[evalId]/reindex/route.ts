// engine_v2 frontend Lane 2d / Phase B (v0.5): POST reindex route.
//
// POST /api/engine-v2/evaluations/[evalId]/reindex
//
// Re-runs the submission chunks indexer for a single evaluation. Consumed
// by the SubmissionSearchTab "Search unavailable: indexing failed (retry)"
// CTA (IMPORTANT 3 in v0.5).
//
// Flow:
//   1. requireAdminForApi          -> 401/403.
//   2. requireLocalEngine          -> 503 (this endpoint runs the local
//                                       indexer; on Vercel it would have
//                                       no effect).
//   3. checkCsrf                   -> 415 (Content-Type) or 403 (Origin).
//   4. Ownership probe via explicit v2_evaluations -> v2_projects.user_id
//      JOIN (Round 2 / IMPORTANT 2). RLS scopes the SELECT but the JOIN
//      makes the assertion explicit at the route layer; a foreign or
//      missing evaluation returns 404 instead of leaking the ambient RLS
//      behavior.
//   5. Re-fetch raw_eval_result_json + per_policy_results from Supabase
//      and run the indexer. The indexer is idempotent (DELETE + INSERT
//      inside one Postgres transaction via the replace_submission_chunks
//      RPC) so this simply replaces existing rows.
//   6. Return { status, error_message? }.
//
// Round 2 / BLOCKER 1: runIndexerNonBlocking constructs its own service-
// role client for writes -- we deliberately do NOT pass the authenticated
// admin client (which only has SELECT on the new Phase B tables). The
// read steps (ownership probe + raw envelope fetch + per_policy_results
// fetch) stay on the authenticated client so RLS continues to enforce
// project ownership for reads.
//
// Degraded case: when raw_eval_result_json is null (evaluation completed
// before Lane 2c, schema_version 0.0.1) OR evidence_slices is missing,
// the indexer still runs the DELETE step (Round 2 / IMPORTANT 3) so any
// stale rows from a previous successful index are removed, then marks
// status='complete' with 0 rows.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import { checkCsrf } from "@/lib/engine-v2/csrf";
import { runIndexerNonBlocking } from "@/lib/engine-v2/submission_chunks_indexing";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ evalId: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate. The local-engine helper returns a 503
  // NextResponse when LOCAL_ENGINE_ENABLED !== 'true'. Reindex needs the
  // local engine because the indexer writes to Supabase tables that are
  // only populated by local-engine evaluations in the first place.
  const engineErr = requireLocalEngine();
  if (engineErr) return engineErr;

  // Step 3: CSRF.
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

  const { evalId } = await context.params;

  // Step 4 (Round 2 / IMPORTANT 2): explicit ownership probe.
  // Proves v2_evaluations.project_id -> v2_projects.user_id = auth.uid()
  // at the route layer. The embedded select via the FK relationship and
  // the .eq('v2_projects.user_id', userId) filter together cause a
  // missing row OR a non-owner-eval to fall through to 404. RLS would
  // already block this, but the explicit probe makes the intent visible
  // and matches the plan's ED-2d4-7 spec.
  const { data: ownership, error: ownershipErr } = await client
    .from("v2_evaluations")
    .select("id, v2_projects!inner(user_id)")
    .eq("id", evalId)
    .eq("v2_projects.user_id", user.id)
    .maybeSingle();
  if (ownershipErr) {
    return NextResponse.json(
      { error: "ownership_probe_failed", detail: ownershipErr.message },
      { status: 500 },
    );
  }
  if (!ownership) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }

  // Step 4b: fetch raw envelope. Ownership is proven; this read is
  // safe under RLS (the same JOIN predicate gates SELECT on
  // v2_evaluations).
  const { data: evalRow, error: evalErr } = await client
    .from("v2_evaluations")
    .select("id, raw_eval_result_json")
    .eq("id", evalId)
    .maybeSingle();
  if (evalErr) {
    return NextResponse.json(
      { error: "evaluation_query_failed", detail: evalErr.message },
      { status: 500 },
    );
  }
  if (!evalRow) {
    return NextResponse.json(
      { error: "evaluation_not_found" },
      { status: 404 },
    );
  }
  const rawEnvelope = (evalRow as { raw_eval_result_json: unknown })
    .raw_eval_result_json;

  // Step 5: fetch per_policy_results so the inverse-index can re-derive.
  const { data: perPolicyRows, error: perPolicyErr } = await client
    .from("v2_per_policy_results")
    .select("policy_id, evidence_packet")
    .eq("evaluation_id", evalId);
  if (perPolicyErr) {
    return NextResponse.json(
      { error: "per_policy_query_failed", detail: perPolicyErr.message },
      { status: 500 },
    );
  }

  // Step 6: run the indexer. It is non-blocking and writes the indexing
  // status side table. We surface the outcome inline so the UI can react
  // immediately (no need to re-poll status).
  //
  // Round 2 / BLOCKER 1: do NOT pass the authenticated client. The
  // indexer constructs its own service-role client (the new Phase B
  // tables expose service-role writes only).
  const result = await runIndexerNonBlocking({
    evaluationId: evalId,
    rawEnvelope,
    perPolicyResults: (perPolicyRows ?? []) as Array<Record<string, unknown>>,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        status: "error",
        error_message: result.error,
        // Round 2 / IMPORTANT 4: surface status-write failure separately
        // so the UI can distinguish "data write failed" from "status
        // observability degraded".
        status_write_error: result.statusWriteError ?? null,
      },
      { status: 200 },
    );
  }
  return NextResponse.json(
    {
      status: "complete",
      chunk_rows: result.result.chunkRows,
      citation_rows: result.result.citationRows,
      // Round 2 / IMPORTANT 4: even on the happy data path, surface a
      // null-or-string status write error so the UI can detect partial
      // observability.
      status_write_error: result.result.statusWriteError ?? null,
    },
    { status: 200 },
  );
}
