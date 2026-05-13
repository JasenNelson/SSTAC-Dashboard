// engine_v2 frontend Lane 2d / Phase C Round 2: submission FTS search route.
//
// GET /api/engine-v2/evaluations/[evalId]/submission/search?q=...&limit=...
//
// Returns matching submission chunks for an evaluation. Consumes Phase
// B's v2_submission_chunks (RLS-gated, owner-read; tsvector + GIN index)
// and v2_chunk_policy_citations (RLS-gated, owner-read; the inverse
// index that drives the "cited by N policies" badge).
//
// Round 2 (IMPORTANT 1 fix): the original Phase C implementation used
// PostgREST's .textSearch() with a page_num ASC ordering because the
// PostgREST query builder cannot expose ts_rank as a sort key. That
// produced page-order results, not relevance-order results, which is
// not acceptable FTS UX -- high-relevance hits could be crowded out by
// low-relevance hits with smaller page numbers.
//
// Round 2 ships a new RPC `search_submission_chunks` (migration
// 20260513_v2_submission_chunks_search_rpc.sql). The RPC:
//   - applies plainto_tsquery + @@ inside the function body (same op
//     the shared submission_search.ts lib uses);
//   - emits server-side ts_headline highlighting with <mark>...</mark>
//     so the route does NOT need to do JS-side highlighting anymore;
//   - LEFT JOINs an aggregated cited_by subselect so the route does
//     NOT need a separate batched IN-query against
//     v2_chunk_policy_citations;
//   - orders by ts_rank DESC with a deterministic tie-break.
// SECURITY INVOKER means RLS still applies; the existing owner-read
// policies + this route's ownership probe both gate access.
//
// Naming sweep: the join key and the API surface use evidence_item_id,
// NOT chunk_id. source_chunk_id is OPTIONAL metadata only.
//
// Flow:
//   1. requireAdminForApi  -> 401/403.
//   2. requireLocalEngine  -> 503.
//   3. Ownership probe via explicit v2_evaluations -> v2_projects.user_id
//      JOIN. Missing or non-owner -> 404.
//   4. Parse + validate q (>= 2 chars, <= 200 chars) and limit (clamped
//      to [1, 100]). Both bounds apply to the TRIMMED query.
//   5. client.rpc('search_submission_chunks', { p_evaluation_id,
//      p_query, p_limit }). Single round trip.
//   6. Map RPC row shape (doc_section, page_num) -> response shape
//      (section, page) for the UI.
//   7. Return { query, count, results: [...] }.
//
// indigenous_flagged is a content-type signal only; result ordering is
// driven by ts_rank with a stable tie-break (page_num ASC NULLS LAST,
// then id ASC) inside the RPC. The flag has zero influence on ranking.
// Badge label in the UI is the neutral "Indigenous uses content" per
// feedback_no_tier_judgment_for_ai (2026-05-12, HIGH AUTHORITY).
//
// ASCII only.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";
import {
  clampSubmissionSearchLimit,
  SUBMISSION_SEARCH_LIMIT_DEFAULT,
} from "@/lib/engine-v2/submission_search";

export const runtime = "nodejs";

const MIN_QUERY_LEN = 2;
const MAX_QUERY_LEN = 200;

interface RpcRow {
  id: string;
  evidence_item_id: string;
  source_chunk_id: string | null;
  doc_section: string;
  page_num: number | null;
  snippet: string;
  indigenous_flagged: boolean;
  cited_by_count: number | string;
  rank: number;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ evalId: string }> },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate (normalized 503 shape).
  const engineErr = requireLocalEngine();
  if (engineErr) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  const { evalId } = await context.params;

  // Step 3: ownership probe.
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

  // Step 4: parse + normalize query params.
  //
  // Round 2 MINOR 1 fix: apply BOTH the min-length and the max-length
  // checks to the trimmed query so a 201-char string of whitespace
  // doesn't slip past min-length or fail max-length on raw input. The
  // trimmed value is also the one bound to the RPC.
  const sp = request.nextUrl.searchParams;
  const rawQ = sp.get("q");
  const rawLimit = sp.get("limit");

  const query = (rawQ ?? "").trim();
  if (query.length < MIN_QUERY_LEN) {
    return NextResponse.json({ error: "query_too_short" }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LEN) {
    return NextResponse.json({ error: "query_too_long" }, { status: 400 });
  }
  const limit =
    rawLimit === null
      ? SUBMISSION_SEARCH_LIMIT_DEFAULT
      : clampSubmissionSearchLimit(rawLimit);

  // Step 5: call the rank-ordered RPC. Single round trip; the RPC
  // emits ts_headline-highlighted snippets + aggregated cited_by_count
  // via LEFT JOIN. Result ordering is ts_rank DESC inside the function.
  const { data: rawRows, error: rpcErr } = await client.rpc(
    "search_submission_chunks",
    {
      p_evaluation_id: evalId,
      p_query: query,
      p_limit: limit,
    },
  );

  if (rpcErr) {
    return NextResponse.json(
      { error: "search_failed", detail: rpcErr.message },
      { status: 500 },
    );
  }

  const rows = (rawRows ?? []) as RpcRow[];

  // Step 6: map RPC row shape to API response shape. The UI already
  // consumes `section` + `page` (not doc_section + page_num); the RPC
  // returns the column names from the underlying table, so we rename
  // here. cited_by_count comes back as bigint -- in PostgREST that
  // arrives as a number for small values but a string for very large
  // values; coerce defensively.
  const results = rows.map((r) => ({
    evidence_item_id: r.evidence_item_id,
    snippet: r.snippet ?? "",
    section: r.doc_section,
    page: r.page_num,
    indigenous_flagged: r.indigenous_flagged,
    cited_by_count:
      typeof r.cited_by_count === "string"
        ? Number.parseInt(r.cited_by_count, 10) || 0
        : r.cited_by_count,
    rank: r.rank,
  }));

  return NextResponse.json({
    query,
    count: results.length,
    results,
  });
}
