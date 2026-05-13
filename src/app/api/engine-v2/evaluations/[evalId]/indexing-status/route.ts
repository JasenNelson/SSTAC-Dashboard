// engine_v2 frontend Lane 2d / Phase C: indexing-status route.
//
// GET /api/engine-v2/evaluations/[evalId]/indexing-status
//
// Returns the row from v2_submission_chunks_indexing_status for this
// evaluation_id (see plan v0.5 IMPORTANT 3). Consumed by
// SubmissionSearchTab + AskAiTab to render a disabled state + retry CTA
// when status='error'.
//
// Flow:
//   1. requireAdminForApi  -> 401/403.
//   2. requireLocalEngine  -> 503 (kept for symmetry with the other
//      submission/* routes; admin evaluation surfaces stay local-only).
//   3. Ownership probe via explicit v2_evaluations -> v2_projects.user_id
//      JOIN. Missing or non-owner evaluation_id -> 404.
//   4. SELECT from v2_submission_chunks_indexing_status (RLS-gated).
//   5. Return shape:
//        { status: 'pending'|'running'|'complete'|'error'|'absent',
//          error_message?, started_at?, completed_at?, updated_at? }
//      The 'absent' status indicates no row exists yet (e.g., an
//      evaluation completed before Phase B indexer was wired in -- the
//      UI can render a smaller "re-evaluate to enable search" hint).
//
// ASCII only.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ evalId: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate. Normalized 503 shape.
  const engineErr = requireLocalEngine();
  if (engineErr) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  const { evalId } = await context.params;

  // Step 3: explicit ownership probe. RLS would gate any subsequent
  // SELECT regardless, but the probe makes the intent visible and
  // surfaces 404 instead of an empty result set.
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

  // Step 4: fetch the status row. maybeSingle so a missing row returns
  // data=null rather than an error.
  const { data: row, error: statusErr } = await client
    .from("v2_submission_chunks_indexing_status")
    .select(
      "status, error_message, started_at, completed_at, updated_at",
    )
    .eq("evaluation_id", evalId)
    .maybeSingle();
  if (statusErr) {
    return NextResponse.json(
      { error: "status_query_failed", detail: statusErr.message },
      { status: 500 },
    );
  }

  if (!row) {
    // Backwards-compat: an evaluation that completed before Phase B
    // indexer was wired in has no status row. UI renders a smaller
    // "re-evaluate to enable search" hint for this case.
    return NextResponse.json({ status: "absent" });
  }

  return NextResponse.json({
    status: row.status,
    error_message: row.error_message,
    started_at: row.started_at,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  });
}
