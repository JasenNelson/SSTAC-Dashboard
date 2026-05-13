// engine_v2 frontend Lane 2d / Phase B (v0.5): Indigenous content-type
// keywords for the v2_submission_chunks.indigenous_flagged flag.
//
// This list is owner-editable. It is consumed ONLY by the indexer
// (submission_chunks_indexing.ts) at INSERT time. It is NOT imported by
// the chat route or any AI prompt. The flag is a UI content-type
// relevance signal -- it surfaces to the human reviewer that the chunk
// references Indigenous uses (pathway-relevant: traditional gardens,
// hunting, fishing, medicines, etc.). It is NOT a procedural gate, NOT
// an AI behavior rule, and NOT a redaction trigger. See
// feedback_no_tier_judgment_for_ai (2026-05-12, HIGH AUTHORITY).
//
// Excluded: 'consent' (too many non-Indigenous regulatory uses; high
// false-positive rate). 'reconciliation' is retained; if owner reports
// false-positive noise, drop it in a follow-up.
//
// All entries are plain ASCII. Short tokens like 'tek' use a
// word-boundary check at the matcher level so they do not match
// substrings (e.g., 'latek').

export const INDIGENOUS_CONTENT_KEYWORDS = [
  "indigenous",
  "first nation",
  "first nations",
  "aboriginal",
  "treaty",
  "metis",
  "inuit",
  "undrip",
  "dripa",
  "section 35",
  "duty to consult",
  "honour of the crown",
  "honor of the crown",
  "traditional territory",
  "traditional use",
  "traditional uses",
  "traditional knowledge",
  "traditional food",
  "traditional foods",
  "traditional medicine",
  "traditional medicines",
  "country food",
  "country foods",
  "tek",
  "reconciliation",
] as const;

export type IndigenousKeyword = (typeof INDIGENOUS_CONTENT_KEYWORDS)[number];

// Short tokens that MUST match as whole words (word-boundary check). Anything
// here is also expected to appear in INDIGENOUS_CONTENT_KEYWORDS; the matcher
// applies the boundary check based on this set.
export const SHORT_TOKEN_KEYWORDS = new Set<string>(["tek"]);

/**
 * Return true when `content` contains at least one Indigenous-content
 * keyword (case-insensitive). Short tokens (per SHORT_TOKEN_KEYWORDS) are
 * matched with word boundaries; everything else is a plain substring
 * match.
 *
 * Pure function: deterministic, no I/O. Safe to call from the indexer
 * once per chunk.
 */
export function detectIndigenousContent(content: string): boolean {
  if (!content) return false;
  const haystack = content.toLowerCase();
  // Optional Unicode-fold step: if the host has built-in normalization for
  // diacritic-bearing variants (e.g., the m-tilde-e-tilde-t-tilde-i-tilde-s
  // form), the lowercased haystack already collapses many of them via the
  // 'english' to_tsvector pipeline at Postgres-side. The TS-side detector
  // intentionally stays ASCII to avoid pulling in a normalization
  // dependency and keep behavior portable across runtimes. Owner can
  // expand the keyword list with additional fold-test inputs if a real
  // submission surfaces a miss.
  for (const kw of INDIGENOUS_CONTENT_KEYWORDS) {
    if (SHORT_TOKEN_KEYWORDS.has(kw)) {
      // Word-boundary match: ASCII boundary on each side.
      const re = new RegExp(`(^|[^a-z0-9])${kw}([^a-z0-9]|$)`, "i");
      if (re.test(haystack)) return true;
    } else {
      if (haystack.includes(kw)) return true;
    }
  }
  return false;
}
