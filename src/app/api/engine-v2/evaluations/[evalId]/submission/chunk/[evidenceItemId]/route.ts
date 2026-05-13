// engine_v2 frontend Lane 2d / Phase C: submission chunk detail route.
//
// GET /api/engine-v2/evaluations/[evalId]/submission/chunk/[evidenceItemId]
//
// Returns the full content of a single submission chunk plus the list
// of policies that cite it. Used by the peek panel (Phase A scaffolding;
// rendering completed in Phase E) when the user clicks a search result.
//
// Naming sweep (orchestrator pre-spawn): the URL param is evidenceItemId
// (NOT chunkId per v0.5 plan text). evidence_item_id is the v0.5
// canonical join key for v2_submission_chunks; source_chunk_id is
// OPTIONAL metadata and is exposed on the response for cross-reference
// only.
//
// Flow:
//   1. requireAdminForApi  -> 401/403.
//   2. requireLocalEngine  -> 503.
//   3. Ownership probe via v2_evaluations -> v2_projects.user_id JOIN
//      -> 404 if non-owner or missing.
//   4. Validate evidenceItemId against ^[A-Za-z0-9._-]{1,128}$ -- the
//      engine emits this shape (slice_<hex>); reject anything else
//      before issuing a DB query.
//   5. SELECT chunk row by (evaluation_id, evidence_item_id). 404 on
//      not-found.
//   6. SELECT cited-by policy_ids list for the chunk. The list is
//      ordered (policy_id ASC) so the UI renders deterministically.
//   7. Return { evidence_item_id, source_chunk_id, section, page,
//                content, indigenous_flagged, cited_by: [{policy_id}] }.
//
// ASCII only.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/engine-v2/admin_guards";
import { requireLocalEngine } from "@/lib/api-guards";

export const runtime = "nodejs";

const EVIDENCE_ITEM_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ evalId: string; evidenceItemId: string }>;
  },
): Promise<NextResponse> {
  // Step 1: admin gate.
  const auth = await requireAdminForApi();
  if (auth instanceof NextResponse) return auth;
  const { client, user } = auth;

  // Step 2: local-engine gate.
  const engineErr = requireLocalEngine();
  if (engineErr) {
    return NextResponse.json(
      { error: "local_engine_disabled" },
      { status: 503 },
    );
  }

  const { evalId, evidenceItemId } = await context.params;

  // Step 4 (before any read): validate the evidence_item_id shape.
  // Runs before the ownership probe to avoid spending a roundtrip on
  // an obviously-malformed input. The pattern is broad enough to fit
  // the engine's slice_<hex> shape plus reasonable variations, and
  // narrow enough to exclude SQL meta-characters even though the
  // query is parameterized -- defense in depth.
  if (!EVIDENCE_ITEM_ID_PATTERN.test(evidenceItemId)) {
    return NextResponse.json(
      { error: "invalid_evidence_item_id" },
      { status: 400 },
    );
  }

  // Step 3: explicit ownership probe.
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

  // Step 5: chunk fetch by composite key.
  const { data: chunk, error: chunkErr } = await client
    .from("v2_submission_chunks")
    .select(
      "evidence_item_id, source_chunk_id, doc_section, page_num, content, indigenous_flagged",
    )
    .eq("evaluation_id", evalId)
    .eq("evidence_item_id", evidenceItemId)
    .maybeSingle();
  if (chunkErr) {
    return NextResponse.json(
      { error: "chunk_query_failed", detail: chunkErr.message },
      { status: 500 },
    );
  }
  if (!chunk) {
    return NextResponse.json(
      { error: "chunk_not_found" },
      { status: 404 },
    );
  }

  // Step 6: cited-by list (deterministic ordering).
  const { data: citationRows, error: citationErr } = await client
    .from("v2_chunk_policy_citations")
    .select("policy_id")
    .eq("evaluation_id", evalId)
    .eq("evidence_item_id", evidenceItemId)
    .order("policy_id", { ascending: true });
  if (citationErr) {
    return NextResponse.json(
      { error: "citation_query_failed", detail: citationErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    evidence_item_id: chunk.evidence_item_id,
    source_chunk_id: chunk.source_chunk_id,
    section: chunk.doc_section,
    page: chunk.page_num,
    content: chunk.content,
    indigenous_flagged: chunk.indigenous_flagged,
    cited_by: (citationRows ?? []).map(
      (c) => ({ policy_id: (c as { policy_id: string }).policy_id }),
    ),
  });
}
