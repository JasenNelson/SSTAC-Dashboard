// engine_v2 frontend S4 read-side: schema_version helper.
//
// Single source of truth for per-policy packet version resolution, used by ALL
// render / sort / filter / memo / export surfaces so they never drift from each
// other. See S4_DASHBOARD_CHANGE_SPEC.md Rule 1 / Rule 1b.
//
// Plain ASCII only (every char code-point <= 127).

// ---- Shared TS shapes (from s4_output_0_1_0.schema.json $defs) ----

export interface EvidenceSignalCounts {
  total_cited?: number;
  supporting?: number;
  negating?: number;
  absence_or_category_mismatch?: number;
  neutral?: number;
}

export interface EvidenceSynthesisSelfScore {
  appropriateness?: number;
  sufficiency?: number;
  banned_phrase_hits?: unknown[];
}

export interface IndigenousContentSignal {
  matched?: boolean;
  trigger_keywords_matched?: string[];
  detector_version?: string;
}

// ---- EvidenceStatus: the normalized, total-orderable resolved object ----

export interface EvidenceStatus {
  // Resolved per-packet version (see resolveS4Version).
  version: string;
  // True when version >= 0.1.0 (tier-blind evidence-match packet).
  isEvidenceStatus: boolean;
  // Whether relevant evidence was located (evidence_present). Null for legacy.
  present: boolean | null;
  // Packet-level signal rollup. Null for legacy.
  signalCounts: EvidenceSignalCounts | null;
  // Confidence in the evidence MATCH (not adequacy). Null when absent.
  confidence: number | null;
  // Scope tag; expected to be "EVIDENCE_MATCH_NOT_ADEQUACY" for 0.1.0.
  confidenceScope: string | null;
  // Self-score from evidence_synthesis_self_score. Null for legacy or absent.
  synthesisSelfScore: EvidenceSynthesisSelfScore | null;
  // True when indigenous_content_signal.matched is true.
  indigenousMatched: boolean;
  // Keywords that matched the indigenous content detector.
  indigenousKeywords: string[];
  // Numeric total-order key for sorting a MIXED list of 0.1.0 and legacy rows
  // deterministically (must be transitive; never NaN).
  //
  // Banding scheme (ascending = "more relevant first"):
  //   Band 0 (0..999)   : 0.1.0 rows, evidence present=true, ordered by supporting count.
  //   Band 1 (1000..1999): 0.1.0 rows, evidence present=false / null.
  //   Band 2 (2000..2999): legacy 0.0.1 rows, ordered by verdict_suggestion rank.
  //   Band 3 (3000)     : fallback for anything unclassified.
  //
  // Within band 0: sortKey = 999 - min(supporting, 999) (more supporting -> lower key).
  // Within band 2: PASS=2000, FAIL=2100, NOT_FOUND=2200, ESCALATE=2300, unknown=2400.
  sortKey: number;
}

// ---- Row shape accepted by the resolver functions ----
//
// Reads dedicated DB columns first, then falls back to raw_result_json so a
// surface whose SELECT omits a column still renders correctly (defense-in-depth
// behind the explicit SELECT additions in each route/page).

type S4VersionRow = {
  s4_schema_version?: string | null;
  raw_result_json?: unknown;
  // Optional dedicated columns (read column-first):
  evidence_present?: boolean | null;
  evidence_signal_counts?: Record<string, unknown> | null;
  confidence?: number | null;
  confidence_scope?: string | null;
  evidence_synthesis_self_score?: Record<string, unknown> | null;
  verdict_suggestion?: string | null;
};

// ---- Internal helpers ----

function safeStr(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function safeBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  return null;
}

function safeNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function safeObj(v: unknown): Record<string, unknown> | null {
  if (v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

// Pull a value from raw_result_json by key, guarding against non-object shapes.
function fromRaw(row: S4VersionRow, key: string): unknown {
  const raw = safeObj(row.raw_result_json);
  if (!raw) return undefined;
  return raw[key];
}

// ---- Exported resolver functions ----

/**
 * resolveS4Version: returns the per-packet S4 schema version for a DB row.
 *
 * Resolution order (Rule 1b, S4_DASHBOARD_CHANGE_SPEC.md):
 *   1. row.s4_schema_version   (dedicated DB column; populated by the importer)
 *   2. raw_result_json.schema_version  (per-packet field in older rows imported
 *                                       before the dedicated column was added)
 *   3. "0.0.1"  (legacy default for rows that predate any S4 version stamp)
 *
 * Empty string "" is treated as absent and falls through to the next step.
 * NEVER reads the eval_result envelope schema_version (see Rule 1 / SPEC).
 */
export function resolveS4Version(row: S4VersionRow): string {
  // Step 1: dedicated DB column (non-empty string only).
  const col = safeStr(row.s4_schema_version ?? null);
  if (col !== null) return col;

  // Step 2: per-packet schema_version inside raw_result_json.
  const rawSv = fromRaw(row, "schema_version");
  const rawCol = safeStr(rawSv);
  if (rawCol !== null) return rawCol;

  // Step 3: legacy default.
  return "0.0.1";
}

/**
 * isEvidenceStatusVersion: returns true when version >= 0.1.0.
 *
 * Only "0.0.1" and "0.1.0" exist today (2026-06-01), but the >= check is
 * intentional forward-compat so a future bump (0.1.1 / 0.2.0 / 1.0.0) does
 * not silently fall to the broken-legacy render path.
 *
 * Malformed or empty versions resolve to false (treated as legacy).
 */
export function isEvidenceStatusVersion(v: string | null | undefined): boolean {
  if (v === null || v === undefined || v === "") return false;
  const parts = v.split(".");
  if (parts.length !== 3) return false;
  const major = parseInt(parts[0]!, 10);
  const minor = parseInt(parts[1]!, 10);
  const patch = parseInt(parts[2]!, 10);
  if (
    !Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)
  )
    return false;
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return false;
  // >= 0.1.0: major > 0 OR (major === 0 AND minor >= 1).
  if (major > 0) return true;
  if (major === 0 && minor >= 1) return true;
  return false;
}

// Verdict -> sort key within the legacy band (band 2).
const LEGACY_VERDICT_RANK: Record<string, number> = {
  PASS: 2000,
  FAIL: 2100,
  NOT_FOUND: 2200,
  ESCALATE: 2300,
};

/**
 * resolveEvidenceStatus: computes a normalized, total-orderable EvidenceStatus
 * for a DB row.
 *
 * For each evidence field the dedicated DB column is read first; if absent (or
 * null), the corresponding key inside raw_result_json is used as fallback.
 * This ensures a surface whose SELECT omits a new column still renders correctly.
 *
 * indigenous_content_signal is raw-only (no dedicated DB column); it is always
 * read from raw_result_json.
 *
 * Never throws on malformed input; all fields degrade gracefully.
 */
export function resolveEvidenceStatus(row: S4VersionRow): EvidenceStatus {
  const version = resolveS4Version(row);
  const isEvidenceStatus = isEvidenceStatusVersion(version);

  // evidence_present: column-first, then raw fallback.
  const presentCol = row.evidence_present !== undefined ? row.evidence_present : null;
  const presentRaw = safeBool(fromRaw(row, "evidence_present"));
  const present: boolean | null = isEvidenceStatus
    ? (safeBool(presentCol) ?? presentRaw)
    : null;

  // evidence_signal_counts: column-first, then raw fallback.
  const signalCountsCol = row.evidence_signal_counts !== undefined
    ? safeObj(row.evidence_signal_counts)
    : null;
  const signalCountsRaw = safeObj(fromRaw(row, "evidence_signal_counts"));
  const rawCounts = signalCountsCol ?? signalCountsRaw;
  const signalCounts: EvidenceSignalCounts | null = isEvidenceStatus
    ? (rawCounts
        ? {
            total_cited: safeNum(rawCounts.total_cited) ?? undefined,
            supporting: safeNum(rawCounts.supporting) ?? undefined,
            negating: safeNum(rawCounts.negating) ?? undefined,
            absence_or_category_mismatch:
              safeNum(rawCounts.absence_or_category_mismatch) ?? undefined,
            neutral: safeNum(rawCounts.neutral) ?? undefined,
          }
        : null)
    : null;

  // confidence: column-first, then raw fallback.
  const confidenceCol = row.confidence !== undefined ? row.confidence : null;
  const confidenceRaw = safeNum(fromRaw(row, "confidence"));
  const confidence: number | null = safeNum(confidenceCol) ?? confidenceRaw;

  // confidence_scope: column-first, then raw fallback.
  const confidenceScopeCol = row.confidence_scope !== undefined
    ? safeStr(row.confidence_scope)
    : null;
  const confidenceScopeRaw = safeStr(fromRaw(row, "confidence_scope"));
  const confidenceScope: string | null = confidenceScopeCol ?? confidenceScopeRaw;

  // evidence_synthesis_self_score: column-first, then raw fallback.
  const selfScoreCol = row.evidence_synthesis_self_score !== undefined
    ? safeObj(row.evidence_synthesis_self_score)
    : null;
  const selfScoreRaw = safeObj(fromRaw(row, "evidence_synthesis_self_score"));
  const rawSS = selfScoreCol ?? selfScoreRaw;
  const synthesisSelfScore: EvidenceSynthesisSelfScore | null = isEvidenceStatus
    ? (rawSS
        ? {
            appropriateness: safeNum(rawSS.appropriateness) ?? undefined,
            sufficiency: safeNum(rawSS.sufficiency) ?? undefined,
            banned_phrase_hits: Array.isArray(rawSS.banned_phrase_hits)
              ? rawSS.banned_phrase_hits
              : undefined,
          }
        : null)
    : null;

  // indigenous_content_signal: raw-only (no dedicated DB column).
  const icsRaw = safeObj(fromRaw(row, "indigenous_content_signal"));
  const indigenousMatched: boolean = icsRaw
    ? (safeBool(icsRaw.matched) ?? false)
    : false;
  const indigenousKeywords: string[] =
    icsRaw && Array.isArray(icsRaw.trigger_keywords_matched)
      ? (icsRaw.trigger_keywords_matched as unknown[]).filter(
          (x): x is string => typeof x === "string",
        )
      : [];

  // sortKey: total-order numeric key, banded (see EvidenceStatus.sortKey comment).
  let sortKey: number;
  if (isEvidenceStatus) {
    if (present === true) {
      // Band 0: present, ordered by supporting count descending.
      const supporting = signalCounts?.supporting ?? 0;
      sortKey = Math.max(0, 999 - Math.min(supporting, 999));
    } else {
      // Band 1: present=false or null.
      sortKey = 1000;
    }
  } else {
    // Band 2: legacy, ordered by verdict_suggestion rank.
    const v = safeStr(row.verdict_suggestion ?? null);
    sortKey = (v !== null && LEGACY_VERDICT_RANK[v] !== undefined)
      ? LEGACY_VERDICT_RANK[v]!
      : 2400;
  }

  return {
    version,
    isEvidenceStatus,
    present,
    signalCounts,
    confidence,
    confidenceScope,
    synthesisSelfScore,
    indigenousMatched,
    indigenousKeywords,
    sortKey,
  };
}
