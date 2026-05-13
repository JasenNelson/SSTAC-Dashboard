// engine_v2 frontend Lane 2d / Phase B (v0.5): Submission chunks indexer.
//
// Called from inside importEvalResult after per-policy rows land and the
// evidence_slices map is parsed. Idempotent: same evaluation_id re-runs
// produce the same row set via the replace_submission_chunks RPC, which
// wraps DELETE+DELETE+INSERT+INSERT in a single Postgres transaction
// (Round 2 / BLOCKER 2 fix; Round 1 used separate Supabase JS calls
// which were not transactional).
//
// BLOCKER 1 (v0.5): the indexer is wired into importEvalResult, NOT the
// evaluate route. The evaluate route spawns a detached Python process
// and returns 200 immediately with status='running'; completion is
// detected by the evaluation-status route which calls importEvalResult.
//
// Phase B corrective follow-up (RLS alignment): all writes execute
// against the authenticated admin Supabase client supplied by the
// caller. The Phase B tables (v2_submission_chunks,
// v2_chunk_policy_citations, v2_submission_chunks_indexing_status) now
// expose owner-AND-admin FOR ALL TO authenticated RLS policies that
// match the canonical lane2a/lane2b/engine_v2 patch pattern, so the
// authenticated admin client can read AND write subject to RLS. No
// service-role client is constructed; callers are required to pass the
// authenticated client in `params.client`.
//
// BLOCKER 3 (v0.5): the join key is the evidence_slices map KEY
// (evidence_item_id), which is ALWAYS present. The inner source.chunk_id
// is often null and is stored as optional metadata only.
//
// IMPORTANT 3 (v0.5): the parent function (importEvalResult) must NOT
// throw when this indexer fails. The runIndexer caller catches and
// writes v2_submission_chunks_indexing_status.status='error' with the
// error message so the UI can render a retry CTA.
//
// Round 2 / IMPORTANT 1: status transitions are pending -> running ->
// complete | error. 'pending' is written on indexer entry BEFORE any
// work begins so an observer can distinguish "indexer was invoked" from
// "indexer never ran". 'running' is written immediately before the data
// transaction. 'complete' or 'error' is written after.
//
// Round 2 / IMPORTANT 3 (missing-slices path): even when the envelope
// has no evidence_slices (older schema 0.0.1, or a re-evaluation that
// dropped slices), the indexer still DELETEs existing rows before
// transitioning to 'complete' with 0 inserted rows. This prevents stale
// rows from a previous successful index from masquerading as the
// current result.
//
// Round 2 / IMPORTANT 4 (status-write surface): writeStatus returns a
// typed result so the caller can surface a status-write failure
// (separate from data-write failure) to the UI. importEvalResult stays
// non-blocking; the reindex route forwards the status-write error
// inline so the UI can show a clearer message.
//
// IMPORTANT 6 (v0.5): logging never echoes chunk content. Source text
// legitimately lives in v2_submission_chunks.content (that is the
// table's purpose); the prohibition is on log lines, error messages,
// and metrics payloads.
//
// Inverse index: v2_chunk_policy_citations is populated from each
// per-policy result's evidence_packet by walking entries and collecting
// evidence_item_ids. An evidence_packet entry is treated as a submission
// citation iff its id resolves to a slice in evidence_slices (this
// excludes policy-text citations and prevents orphan rows).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractEvidenceSlices,
  type EvidenceSlice,
  type EvidenceSliceMap,
} from "./evidence_slices";
import { detectIndigenousContent } from "./submission_indigenous_keywords";

export interface SubmissionChunkRow {
  evaluation_id: string;
  evidence_item_id: string;
  source_chunk_id: string | null;
  doc_section: string;
  page_num: number | null;
  content: string;
  indigenous_flagged: boolean;
}

export interface CitationRow {
  evidence_item_id: string;
  evaluation_id: string;
  policy_id: string;
}

export interface IndexResult {
  chunkRows: number;
  citationRows: number;
  // Round 2 / IMPORTANT 4: a non-null statusWriteError means the data
  // write succeeded (or no data write was attempted) but the status
  // side table upsert failed. The UI may still show stale-or-missing
  // status; surfacing the error string lets the caller annotate that.
  statusWriteError?: string | null;
}

export interface PerPolicyResultLike {
  policy_id?: unknown;
  evidence_packet?: unknown;
}

// Walk an evidence_packet object/array and return every evidence_item_id-like
// string referenced inside. Tolerates the engine's shapes:
//   - { hits: [{ evidence_item_id: 'slice_<hash>' }, ...] }
//   - { items: [{ id: 'slice_<hash>' }, ...] }
//   - Array of strings or { id }/{ evidence_item_id } records.
// Conservatively scans nested objects for both 'evidence_item_id' and 'id'
// fields, returning de-duped string values.
function collectCandidateEvidenceItemIds(packet: unknown): string[] {
  const seen = new Set<string>();
  const stack: unknown[] = [packet];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) continue;
    if (typeof cur === "string") {
      // Bare-string packets are rare but possible; treat the whole string as
      // an id only when it looks like one. The downstream resolve-against-
      // slices step filters out non-slice ids.
      if (cur.length > 0) seen.add(cur);
      continue;
    }
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
      continue;
    }
    if (typeof cur === "object") {
      const rec = cur as Record<string, unknown>;
      const candidate =
        typeof rec.evidence_item_id === "string"
          ? rec.evidence_item_id
          : typeof rec.id === "string"
            ? rec.id
            : null;
      if (candidate && candidate.length > 0) seen.add(candidate);
      // Recurse into nested objects/arrays that may carry hits/items.
      for (const v of Object.values(rec)) {
        if (v && (typeof v === "object" || Array.isArray(v))) {
          stack.push(v);
        }
      }
    }
  }
  return [...seen];
}

// Resolve raw eval_result.json envelope -> submission chunk rows. Pure: no
// DB access. Used by writeChunks (production path) and unit tests.
export function buildSubmissionChunkRows(
  evaluationId: string,
  slices: EvidenceSliceMap,
): SubmissionChunkRow[] {
  const rows: SubmissionChunkRow[] = [];
  for (const [evidenceItemId, slice] of Object.entries(slices)) {
    const s: EvidenceSlice = slice;
    rows.push({
      evaluation_id: evaluationId,
      evidence_item_id: evidenceItemId,
      source_chunk_id: s.source.chunk_id ?? null,
      doc_section:
        s.source.section && s.source.section.length > 0
          ? s.source.section
          : s.source.title && s.source.title.length > 0
            ? s.source.title
            : "(unknown)",
      page_num: s.source.page ?? null,
      content: s.content,
      indigenous_flagged: detectIndigenousContent(s.content),
    });
  }
  return rows;
}

// Build inverse-index rows from per_policy_results. Pure: no DB access.
// Only entries whose evidence_item_id resolves to a slice in `slices` are
// emitted (excludes policy-text citations + prevents orphan rows).
export function buildCitationRows(
  evaluationId: string,
  perPolicyResults: readonly PerPolicyResultLike[],
  slices: EvidenceSliceMap,
): CitationRow[] {
  const out: CitationRow[] = [];
  const seen = new Set<string>();
  for (const r of perPolicyResults) {
    const policyId = typeof r.policy_id === "string" ? r.policy_id : "";
    if (!policyId) continue;
    const candidates = collectCandidateEvidenceItemIds(r.evidence_packet);
    for (const evidenceItemId of candidates) {
      // Only emit a citation when the id resolves to a submission slice.
      // This is the explicit submission-vs-policy filter; orphan-resistant.
      if (!Object.prototype.hasOwnProperty.call(slices, evidenceItemId)) {
        continue;
      }
      const key = `${policyId}::${evidenceItemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        evaluation_id: evaluationId,
        evidence_item_id: evidenceItemId,
        policy_id: policyId,
      });
    }
  }
  return out;
}

// Round 2 / BLOCKER 2 fix: atomic DELETE+INSERT via Postgres RPC.
// Replaces the prior Supabase-JS two-statement DELETE-then-INSERT
// pattern (which was not transactional). The RPC body is a single
// plpgsql function -- the whole DELETE/DELETE/INSERT/INSERT sequence
// commits atomically.
async function replaceChunksTransactional(
  client: SupabaseClient,
  evaluationId: string,
  chunkRows: SubmissionChunkRow[],
  citationRows: CitationRow[],
): Promise<void> {
  // Strip evaluation_id from the row payloads -- the RPC binds it from
  // the function arg (defence-in-depth against a row-payload spoofing
  // attempt). The RPC schema expects only the per-row fields.
  const chunksPayload = chunkRows.map((r) => ({
    evidence_item_id: r.evidence_item_id,
    source_chunk_id: r.source_chunk_id,
    doc_section: r.doc_section,
    page_num: r.page_num,
    content: r.content,
    indigenous_flagged: r.indigenous_flagged,
  }));
  const citationsPayload = citationRows.map((r) => ({
    evidence_item_id: r.evidence_item_id,
    policy_id: r.policy_id,
  }));

  const { error } = await client.rpc("replace_submission_chunks", {
    p_evaluation_id: evaluationId,
    p_chunks: chunksPayload,
    p_citations: citationsPayload,
  });
  if (error) {
    throw new Error(
      `replace_submission_chunks_rpc_failed evaluation_id=${evaluationId} message=${error.message}`,
    );
  }
}

// Status-write result. Round 2 / IMPORTANT 4: propagate failures so the
// caller can surface them to the UI separately from data-write failures.
type StatusWriteResult = { ok: true } | { ok: false; error: string };

// Round 3 / IMPORTANT 4 (residual): when the core indexer is about to
// throw on a data-write failure, attach any prior status-write error
// onto the thrown Error as a property. runIndexerNonBlocking reads it
// in its catch block so the prior error is not silently dropped when
// the final defensive error-status write happens to succeed.
interface IndexerErrorWithPriorStatus extends Error {
  priorStatusWriteError?: string | null;
}

async function writeStatus(
  client: SupabaseClient,
  evaluationId: string,
  status: "pending" | "running" | "complete" | "error",
  fields: { error_message?: string | null; started_at?: string | null; completed_at?: string | null } = {},
): Promise<StatusWriteResult> {
  const payload: Record<string, unknown> = {
    evaluation_id: evaluationId,
    status,
    updated_at: new Date().toISOString(),
  };
  if (fields.error_message !== undefined) payload.error_message = fields.error_message;
  if (fields.started_at !== undefined) payload.started_at = fields.started_at;
  if (fields.completed_at !== undefined) payload.completed_at = fields.completed_at;

  const { error } = await client
    .from("v2_submission_chunks_indexing_status")
    .upsert(payload, { onConflict: "evaluation_id" });
  if (error) {
    // Log without echoing content; return the error so the caller can
    // decide whether to surface it. The indexer keeps going either way
    // -- if the data write succeeded the observability gap is the only
    // remaining cost.
    console.error(
      `[submission_chunks_indexing] status_write_failed evaluation_id=${evaluationId} status=${status} message=${error.message}`,
    );
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export interface IndexFromEnvelopeParams {
  // Phase B corrective follow-up (RLS alignment): write client is the
  // authenticated admin Supabase client supplied by the caller. The
  // Phase B tables now expose owner-AND-admin FOR ALL TO authenticated
  // policies (matching the lane2a/lane2b pattern), so the same client
  // used elsewhere in engine_v2 can write subject to RLS. Required.
  client: SupabaseClient;
  evaluationId: string;
  rawEnvelope: unknown;
  perPolicyResults: readonly PerPolicyResultLike[];
}

// Core entry. Reads evidence_slices from the raw envelope, derives chunk +
// citation rows, transactionally replaces the rows for the evaluation_id
// via the replace_submission_chunks RPC, and updates the status side
// table on each transition. Throws on the (data-write) failure path; the
// importEvalResult wrapper catches and turns the throw into a
// status='error' row WITHOUT failing the parent.
export async function indexSubmissionChunksFromEnvelope(
  params: IndexFromEnvelopeParams,
): Promise<IndexResult> {
  const { evaluationId, rawEnvelope, perPolicyResults } = params;
  // Phase B corrective follow-up (RLS alignment): writes go through the
  // authenticated admin client supplied by the caller. RLS on the Phase
  // B tables (owner-AND-admin FOR ALL TO authenticated) gates access.
  const writeClient: SupabaseClient = params.client;

  // Round 2 / IMPORTANT 1: status transitions pending -> running ->
  // complete/error. 'pending' is the entry-state observable; 'running'
  // is the work-in-progress observable.
  let lastStatusWriteError: string | null = null;
  const pendingResult = await writeStatus(writeClient, evaluationId, "pending", {
    started_at: null,
    completed_at: null,
    error_message: null,
  });
  if (!pendingResult.ok) lastStatusWriteError = pendingResult.error;

  const startedAt = new Date().toISOString();
  const runningResult = await writeStatus(writeClient, evaluationId, "running", {
    started_at: startedAt,
    completed_at: null,
    error_message: null,
  });
  if (!runningResult.ok) lastStatusWriteError = runningResult.error;

  const slices = extractEvidenceSlices(rawEnvelope);
  if (!slices) {
    // Round 2 / IMPORTANT 3 (missing-slices path): even with no slices,
    // run the RPC to DELETE any stale rows from a previous successful
    // index. Empty arrays -> RPC inserts zero rows but the DELETE side
    // still fires. Then mark complete.
    try {
      await replaceChunksTransactional(writeClient, evaluationId, [], []);
    } catch (err) {
      const message = (err as Error).message ?? "unknown";
      const errStatusResult = await writeStatus(writeClient, evaluationId, "error", {
        completed_at: new Date().toISOString(),
        error_message: message,
      });
      if (!errStatusResult.ok) lastStatusWriteError = errStatusResult.error;
      // Round 3 / IMPORTANT 4 (residual): attach prior status-write error
      // so runIndexerNonBlocking can surface it even if its own defensive
      // error-status write succeeds and would otherwise reset the field.
      const thrown: IndexerErrorWithPriorStatus = new Error(
        `submission_chunks_indexing_failed: ${message}`,
      );
      thrown.priorStatusWriteError = lastStatusWriteError;
      throw thrown;
    }
    const completeResult = await writeStatus(writeClient, evaluationId, "complete", {
      completed_at: new Date().toISOString(),
      error_message: null,
    });
    if (!completeResult.ok) lastStatusWriteError = completeResult.error;
    console.info(
      `[submission_chunks_indexing] no_evidence_slices evaluation_id=${evaluationId} chunkRows=0 citationRows=0`,
    );
    return { chunkRows: 0, citationRows: 0, statusWriteError: lastStatusWriteError };
  }

  const chunkRows = buildSubmissionChunkRows(evaluationId, slices);
  const citationRows = buildCitationRows(evaluationId, perPolicyResults, slices);

  try {
    await replaceChunksTransactional(writeClient, evaluationId, chunkRows, citationRows);
  } catch (err) {
    const message = (err as Error).message ?? "unknown";
    const errStatusResult = await writeStatus(writeClient, evaluationId, "error", {
      completed_at: new Date().toISOString(),
      error_message: message,
    });
    if (!errStatusResult.ok) lastStatusWriteError = errStatusResult.error;
    // Re-throw so the caller (runIndexerNonBlocking inside importEvalResult)
    // can decide whether to swallow. The throw carries no chunk content.
    // Round 3 / IMPORTANT 4 (residual): attach prior status-write error
    // so runIndexerNonBlocking can surface it even if its own defensive
    // error-status write succeeds and would otherwise reset the field.
    const thrown: IndexerErrorWithPriorStatus = new Error(
      `submission_chunks_indexing_failed: ${message}`,
    );
    thrown.priorStatusWriteError = lastStatusWriteError;
    throw thrown;
  }

  const completeResult = await writeStatus(writeClient, evaluationId, "complete", {
    completed_at: new Date().toISOString(),
    error_message: null,
  });
  if (!completeResult.ok) lastStatusWriteError = completeResult.error;
  console.info(
    `[submission_chunks_indexing] complete evaluation_id=${evaluationId} chunkRows=${chunkRows.length} citationRows=${citationRows.length}`,
  );
  return {
    chunkRows: chunkRows.length,
    citationRows: citationRows.length,
    statusWriteError: lastStatusWriteError,
  };
}

// Non-blocking wrapper used by importEvalResult. Catches every error
// from the core indexer and writes a status='error' row but does NOT
// rethrow. Returns { ok: true } on success and { ok: false, error } on
// failure so the caller can log structurally.
//
// Round 2 / IMPORTANT 4: the success branch surfaces statusWriteError
// from IndexResult so the caller can show a clearer UI message when
// data succeeded but observability degraded.
export async function runIndexerNonBlocking(
  params: IndexFromEnvelopeParams,
): Promise<
  | { ok: true; result: IndexResult }
  | { ok: false; error: string; statusWriteError?: string | null }
> {
  try {
    const result = await indexSubmissionChunksFromEnvelope(params);
    return { ok: true, result };
  } catch (err) {
    const message = (err as Error).message ?? "unknown";
    // Round 3 / IMPORTANT 4 (residual): seed statusWriteError from any
    // prior status-write error carried by the thrown error (Option A).
    // Otherwise, if a pending/running status-write previously failed and
    // the data write then failed, the final defensive error-status write
    // (below) succeeding would silently mask the prior failure.
    const priorStatusWriteError =
      (err as IndexerErrorWithPriorStatus).priorStatusWriteError ?? null;
    let statusWriteError: string | null = priorStatusWriteError;
    // Defence-in-depth: ensure the status row reflects failure even if the
    // throw came from a path that did not write status (it always does in
    // the current code, but a future refactor could regress that).
    try {
      // Use the authenticated admin client supplied by the caller. Phase
      // B corrective follow-up: no service-role fallback is constructed
      // here; the same client used for the data writes covers the
      // defensive status write under RLS.
      const r = await writeStatus(params.client, params.evaluationId, "error", {
        completed_at: new Date().toISOString(),
        error_message: message,
      });
      // Only overwrite statusWriteError with a fresher failure; do NOT
      // clear a non-null prior error just because the defensive write
      // happened to succeed.
      if (!r.ok) statusWriteError = r.error;
    } catch (statusErr) {
      // Already logged inside writeStatus. Capture for the return shape
      // (overwrite prior because the most recent failure is more
      // actionable).
      statusWriteError = (statusErr as Error).message ?? "unknown";
    }
    console.error(
      `[submission_chunks_indexing] non_blocking_failure evaluation_id=${params.evaluationId} message=${message}`,
    );
    return { ok: false, error: message, statusWriteError };
  }
}
