// engine_v2 frontend Lane 2d / Phase D: chat retrieval helpers.
//
// Two retrieval axes for the chat surface:
//   - retrieveSubmissionChunks (PRIMARY, async): rank-ordered top-N from
//     v2_submission_chunks via the search_submission_chunks RPC (the
//     same canonical search path Phase C ships). Single round trip.
//   - retrievePolicyMatches (SECONDARY, SYNCHRONOUS): policy KB FTS5
//     anchoring. Called only when the query "looks policy-grounded"
//     (e.g., policy-id pattern or long query). Wraps
//     policy_kb.searchPolicies({ limit }) -- the options-object signature
//     (BLOCKER 2 regression guard). Since the underlying better-sqlite3
//     driver is synchronous, this helper is ALSO synchronous; the route
//     does NOT await it.
//
// Naming: evidence_item_id / source_chunk_id mirror Phase B/C; the join
// key is evidence_item_id end-to-end. source_chunk_id is OPTIONAL
// metadata only.
//
// Indigenous content (feedback_no_tier_judgment_for_ai, HIGH AUTHORITY):
// indigenous_flagged is a content-type signal only; this module does
// NOT redact, filter, or reorder based on the flag. The UI renders a
// neutral "Indigenous uses content" badge alongside the citation; the
// chat assistant treats Indigenous-uses content as routine pathway
// evidence per the prompt scope.
//
// ASCII only.

import type { SupabaseClient } from "@supabase/supabase-js";

import { searchPolicies } from "./policy_kb";

export interface SubmissionChunkCitation {
  type: "chunk";
  evidence_item_id: string;
  source_chunk_id: string | null;
  section: string;
  page: number | null;
  snippet: string;
  indigenous_flagged: boolean;
  rank: number;
}

export interface PolicyCitation {
  type: "policy";
  policy_id: string;
  excerpt: string;
  source: string | null;
}

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

// Minimal RPC-only shape so callers (route, tests) can pass a fake
// without satisfying the full SupabaseClient surface area.
export interface ChatRetrievalRpcClient {
  rpc(
    fn: "search_submission_chunks",
    args: { p_evaluation_id: string; p_query: string; p_limit: number },
  ): Promise<{ data: RpcRow[] | null; error: { message: string } | null }>;
}

/**
 * Submission-axis retrieval (PRIMARY). Calls the canonical
 * search_submission_chunks RPC, which is what Phase C also uses, so
 * both surfaces see the same ranking. Returns at most `limit` rows.
 *
 * The route awaits this helper. On RPC error, throws -- the route
 * catches and emits an SSE `error` event.
 */
export async function retrieveSubmissionChunks(
  evaluationId: string,
  query: string,
  limit: number,
  client: ChatRetrievalRpcClient | SupabaseClient,
): Promise<SubmissionChunkCitation[]> {
  const { data, error } = await (
    client as ChatRetrievalRpcClient
  ).rpc("search_submission_chunks", {
    p_evaluation_id: evaluationId,
    p_query: query,
    p_limit: limit,
  });
  if (error) {
    throw new Error(`submission_search_failed: ${error.message}`);
  }
  const rows = (data ?? []) as RpcRow[];
  return rows.map((r) => ({
    type: "chunk" as const,
    evidence_item_id: r.evidence_item_id,
    source_chunk_id: r.source_chunk_id,
    section: r.doc_section,
    page: r.page_num,
    snippet: r.snippet ?? "",
    indigenous_flagged: r.indigenous_flagged,
    rank: r.rank,
  }));
}

/**
 * Policy-axis retrieval (SECONDARY, SYNCHRONOUS). Wraps
 * policy_kb.searchPolicies({ limit }) -- options-object form -- and
 * returns at most `limit` PolicyCitation rows. SYNCHRONOUS to match
 * the underlying better-sqlite3 driver. The route does NOT await this.
 *
 * On internal driver failure (e.g., DB file missing in a build that
 * does not bundle better-sqlite3) this swallows the error and returns
 * []. The route's `requireLocalEngine` guard normally prevents this
 * path from being reached at all in cloud builds.
 */
export function retrievePolicyMatches(
  query: string,
  limit: number,
): PolicyCitation[] {
  try {
    const { rows } = searchPolicies(query, { limit });
    return rows.map((r) => ({
      type: "policy" as const,
      policy_id: r.id,
      excerpt: (r.originalText ?? r.plainLanguage ?? "").slice(0, 400),
      source:
        [r.sourceDocument, r.sourceSection]
          .filter((s): s is string => Boolean(s))
          .join(", ") || null,
    }));
  } catch {
    return [];
  }
}

/**
 * Heuristic: does the query look policy-grounded enough to warrant the
 * policy-axis secondary retrieval? Two triggers:
 *   - Contains what looks like a policy id (uppercase prefix + dash/
 *     underscore + alphanumeric tail, e.g., CSAP-NPG-RP-1).
 *   - Or is a longer query (>=80 chars) likely to benefit from KB
 *     anchoring rather than just submission-side FTS.
 */
const POLICY_ID_PATTERN = /[A-Z]{2,}[-_][A-Z0-9\-_.]{2,}/;
export const POLICY_AXIS_LONG_QUERY_THRESHOLD = 80;

export function shouldUsePolicyAxis(query: string): boolean {
  if (POLICY_ID_PATTERN.test(query)) return true;
  if (query.length >= POLICY_AXIS_LONG_QUERY_THRESHOLD) return true;
  return false;
}
