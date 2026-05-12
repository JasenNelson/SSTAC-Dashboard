// engine_v2 frontend Lane 2c: evidence_slices dereferencing helper.
// New in eval_result schema_version 0.1.0 (engine_v2 backend emits a
// top-level evidence_slices dict; per-policy evidence_packet entries
// reference into it by evidence_item_id).
//
// Older eval results (schema_version 0.0.1) lack this field; the helper
// returns null for unknown slice ids so callers can render a degraded
// view ("verbatim text not available").

export interface EvidenceSliceSource {
  doc_id: string;
  title: string;
  page: number | null;
  section: string | null;
  chunk_id: string | null;
  source_path: string | null;
}

export interface EvidenceSlice {
  content_hash: string;
  content: string;
  field: string;
  policy_id: string;
  source: EvidenceSliceSource;
}

export type EvidenceSliceMap = Record<string, EvidenceSlice>;

/**
 * Pull the evidence_slices dict out of a raw eval_result.json JSONB blob.
 * Returns null when the blob is null OR the field is missing OR has
 * the wrong shape -- callers should treat null as "older schema, no
 * verbatim text available".
 */
export function extractEvidenceSlices(
  rawEvalResultJson: unknown,
): EvidenceSliceMap | null {
  if (!rawEvalResultJson || typeof rawEvalResultJson !== "object") return null;
  const slices = (rawEvalResultJson as Record<string, unknown>).evidence_slices;
  if (!slices || typeof slices !== "object" || Array.isArray(slices)) return null;
  // Defensive: validate at least one entry has the expected shape.
  const map = slices as Record<string, unknown>;
  const out: EvidenceSliceMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== "object") continue;
    const entry = v as Record<string, unknown>;
    if (typeof entry.content !== "string") continue;
    if (typeof entry.content_hash !== "string") continue;
    const source = (entry.source ?? {}) as Record<string, unknown>;
    out[k] = {
      content_hash: entry.content_hash,
      content: entry.content,
      field: typeof entry.field === "string" ? entry.field : "original_text",
      policy_id: typeof entry.policy_id === "string" ? entry.policy_id : "",
      source: {
        doc_id: typeof source.doc_id === "string" ? source.doc_id : "",
        title: typeof source.title === "string" ? source.title : "",
        page: typeof source.page === "number" ? source.page : null,
        section: typeof source.section === "string" ? source.section : null,
        chunk_id: typeof source.chunk_id === "string" ? source.chunk_id : null,
        source_path:
          typeof source.source_path === "string" ? source.source_path : null,
      },
    };
  }
  return out;
}

/**
 * Resolve a single evidence item id to its verbatim slice. Returns null
 * when the map is null OR the id is not present.
 */
export function dereferenceSlice(
  slices: EvidenceSliceMap | null,
  evidenceItemId: string,
): EvidenceSlice | null {
  if (!slices) return null;
  return slices[evidenceItemId] ?? null;
}
