// engine_v2 frontend Lane 2a / Module L2a-3: eval_result.json import helper.
//
// Codex v0.2 BLOCKER fix: import ordering reversed.
//   1. UPSERT per_policy_results rows FIRST with
//      ON CONFLICT (evaluation_id, policy_id, COALESCE(stage,''), COALESCE(packet_id,''))
//      DO UPDATE so a retried import repairs partial rows.
//   2. Classify terminal status from coverage_statement.error + telemetry.errors.
//   3. UPDATE v2_evaluations LAST with terminal status + provenance fields.
//
// Rationale: if step 1 partially fails and step 3 never runs, the evaluation row
// stays non-terminal and a later poll re-attempts the import. DO UPDATE (not
// DO NOTHING) repairs partial rows. If we stamped terminal first, a mid-import
// crash would leave a "completed" evaluation with missing verdicts and no retry
// path.
//
// Idempotency: re-importing the same envelope twice is a no-op at the row level
// (UPSERT overwrites with identical values) and at the evaluation level (the
// terminal UPDATE writes the same fields).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvalCoverageStatement } from "./types_lane2";
import { runIndexerNonBlocking } from "./submission_chunks_indexing";

export interface EvalResultEnvelope {
  run_id?: string;
  schema_version?: string;
  variant_config_hash?: string;
  provenance?: Record<string, unknown>;
  per_policy_results?: Array<Record<string, unknown>>;
  coverage_statement?: EvalCoverageStatement;
  telemetry?: {
    errors?: unknown[];
    [k: string]: unknown;
  };
  // Lane 2c: schema_version 0.1.0 adds a top-level evidence_slices dict that
  // per-policy evidence_packet entries reference by evidence_item_id. The
  // dashboard does NOT promote this into its own table -- the existing
  // raw_eval_result_json wholesale persistence below already carries it.
  // Frontend rendering uses extractEvidenceSlices() from ./evidence_slices.
  // Older schema_version 0.0.1 envelopes omit this field; the helper falls
  // back to a degraded "verbatim text not available" view.
  evidence_slices?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ImportResult {
  rowsImported: number;
  terminalStatus: "completed" | "completed_with_errors";
  errorsCount: number;
}

// Helpers: pluck a typed scalar/object from an unknown record without forcing
// the whole row through a noisy `as` cast.
function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : null;
}
function asNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}
function asArray(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  return null;
}

// Build the row payload that v2_per_policy_results expects.
// stage and packet_id default to "" (NOT NULL columns per Lane 2a unique-index
// hotfix) so the upsert onConflict tuple is always present.
function toPerPolicyRow(
  evaluationId: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    evaluation_id: evaluationId,
    policy_id: String(raw.policy_id ?? ""),
    stage: asString(raw.stage) ?? "",
    packet_id: asString(raw.packet_id) ?? "",
    tier: asString(raw.tier),
    verdict_suggestion: asString(raw.verdict_suggestion),
    ai_suggestion: asString(raw.ai_suggestion),
    confidence: asNumber(raw.confidence),
    confidence_method: asString(raw.confidence_method),
    summary: asString(raw.summary),
    evidence_packet: asArray(raw.evidence_packet) ?? asRecord(raw.evidence_packet) ?? [],
    pathway_notes: asRecord(raw.pathway_notes) ?? {},
    rubric_self_score: asRecord(raw.rubric_self_score),
    raw_result_json: raw,
  };
}

// Classify terminal status. Per plan v0.2 IMPORTANT amendment:
//   coverage_statement.error === 0 AND telemetry.errors === []  -> completed
//   coverage_statement.error >  0 OR  telemetry.errors non-empty -> completed_with_errors
function classifyTerminal(
  envelope: EvalResultEnvelope,
): { terminalStatus: ImportResult["terminalStatus"]; errorsCount: number } {
  const telemetryErrors = Array.isArray(envelope.telemetry?.errors)
    ? (envelope.telemetry!.errors as unknown[])
    : [];
  const errorsCount = telemetryErrors.length;
  const coverageError = envelope.coverage_statement?.error ?? 0;
  const terminalStatus: ImportResult["terminalStatus"] =
    errorsCount === 0 && coverageError === 0
      ? "completed"
      : "completed_with_errors";
  return { terminalStatus, errorsCount };
}

export async function importEvalResult(
  client: SupabaseClient,
  evaluationId: string,
  envelope: EvalResultEnvelope,
): Promise<ImportResult> {
  // Step 1: UPSERT per_policy rows FIRST (codex BLOCKER fix).
  const perPolicy = Array.isArray(envelope.per_policy_results)
    ? envelope.per_policy_results
    : [];
  const rows = perPolicy.map((r) => toPerPolicyRow(evaluationId, r));

  if (rows.length > 0) {
    // Supabase JS upsert accepts a comma-separated onConflict column list. The
    // unique index in the schema is COALESCE-based on (evaluation_id, policy_id,
    // stage, packet_id) so "" and NULL collide identically. ignoreDuplicates is
    // explicitly false to get DO UPDATE semantics per codex amendment.
    //
    // Lane 2c note: evidence_slices (when present in envelope, schema_version
    // 0.1.0+) is persisted via raw_eval_result_json on the v2_evaluations row
    // below; per-policy rows only get the metadata-side fields per Lane 2a
    // design. The dashboard dereferences slice_<sha256> ids from
    // evidence_packet via extractEvidenceSlices() at render time.
    const { error: upsertErr } = await client
      .from("v2_per_policy_results")
      .upsert(rows, {
        onConflict: "evaluation_id,policy_id,stage,packet_id",
        ignoreDuplicates: false,
      });
    if (upsertErr) {
      throw new Error(`per_policy_upsert_failed: ${upsertErr.message}`);
    }
  }

  // Step 2: classify terminal AFTER rows committed.
  const { terminalStatus, errorsCount } = classifyTerminal(envelope);

  // Step 3: stamp v2_evaluations LAST.
  const telemetryErrors = Array.isArray(envelope.telemetry?.errors)
    ? (envelope.telemetry!.errors as unknown[])
    : [];

  const { error: updateErr } = await client
    .from("v2_evaluations")
    .update({
      status: terminalStatus,
      run_id_engine: envelope.run_id ?? null,
      variant_config_hash: envelope.variant_config_hash ?? null,
      coverage_statement: envelope.coverage_statement ?? {},
      errors: telemetryErrors,
      raw_eval_result_json: envelope as unknown as Record<string, unknown>,
      completed_at: new Date().toISOString(),
    })
    .eq("id", evaluationId);

  if (updateErr) {
    // The per_policy rows are already committed; the next poll will see the
    // eval still non-terminal and re-run importEvalResult, which is idempotent.
    throw new Error(`evaluation_update_failed: ${updateErr.message}`);
  }

  // Step 4 (Lane 2d Phase B / BLOCKER 1 fix): submission chunks indexer.
  // Wired here (NOT inside the evaluate route, which has no completion
  // path). Non-blocking: the indexer surfaces failures via the
  // v2_submission_chunks_indexing_status side table (status='error',
  // error_message set) so the UI can render a retry CTA. importEvalResult
  // still returns success even when the indexer throws -- the per-policy
  // verdicts and evaluation terminal status are independent of the
  // submission search index.
  //
  // BLOCKER 3: the indexer joins on the evidence_slices MAP KEY
  // (evidence_item_id), which is always present. source.chunk_id may be
  // null and is stored as optional metadata only.
  //
  // Phase B corrective follow-up (RLS alignment): pass the authenticated
  // admin `client` through. The Phase B tables now expose owner-AND-
  // admin FOR ALL TO authenticated policies (matching lane2a/lane2b),
  // so the same client used for per-policy + evaluation writes also
  // covers the indexer's writes subject to RLS.
  const indexerResult = await runIndexerNonBlocking({
    client,
    evaluationId,
    rawEnvelope: envelope,
    perPolicyResults: perPolicy,
  });
  if (!indexerResult.ok) {
    // Already logged structurally inside the helper; no chunk content in
    // logs (IMPORTANT 6). Surface a one-liner here so the importEvalResult
    // call site can grep against it.
    console.error(
      `[eval_result_import] indexer_failed_non_blocking evaluation_id=${evaluationId} error=${indexerResult.error}`,
    );
  }

  return {
    rowsImported: rows.length,
    terminalStatus,
    errorsCount,
  };
}
