// engine_v2 frontend Lane 2d / Phase B (v0.5): shared submission search lib.
//
// Pure helpers consumed by both Phase C (Search submission tab UI route)
// and Phase D (chat retrieval). Keeping the tsvector query shape and
// snippet rendering centralized prevents drift between the two surfaces.
//
// Postgres-side concerns:
//   - plainto_tsquery: safe parameterization for raw user input. Never
//     concatenate user text into a to_tsquery expression.
//   - ts_headline: produces inline snippet highlights with a stable
//     fragment cap so the UI renders predictable card sizes.
//
// This module exports SQL fragments + bind parameters. It does NOT open
// a Supabase client or perform I/O; callers are responsible for running
// the query against the appropriate client (route handler or chat
// retrieval helper).

export const SUBMISSION_SEARCH_LIMIT_DEFAULT = 20;
export const SUBMISSION_SEARCH_LIMIT_MIN = 1;
export const SUBMISSION_SEARCH_LIMIT_MAX = 100;

// ts_headline option string. MaxFragments=2 keeps each result snippet to
// at most two highlight windows; MaxWords=30 sizes each window. The
// 'english' config matches the GENERATED ALWAYS AS expression on
// v2_submission_chunks.content_tsv (migration 20260513).
export const SUBMISSION_SEARCH_HEADLINE_OPTIONS =
  "MaxFragments=2,MaxWords=30,MinWords=10,ShortWord=2";

export interface BuildSubmissionSearchQueryOptions {
  limit: number;
  evaluationId: string;
}

export interface BuildSubmissionSearchQueryResult {
  sql: string;
  params: unknown[];
}

/**
 * Clamp a limit value into the configured [MIN, MAX] range. Non-numeric
 * inputs collapse to DEFAULT.
 */
export function clampSubmissionSearchLimit(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < SUBMISSION_SEARCH_LIMIT_MIN) return SUBMISSION_SEARCH_LIMIT_MIN;
    if (raw > SUBMISSION_SEARCH_LIMIT_MAX) return SUBMISSION_SEARCH_LIMIT_MAX;
    return Math.floor(raw);
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n)) {
      if (n < SUBMISSION_SEARCH_LIMIT_MIN) return SUBMISSION_SEARCH_LIMIT_MIN;
      if (n > SUBMISSION_SEARCH_LIMIT_MAX) return SUBMISSION_SEARCH_LIMIT_MAX;
      return n;
    }
  }
  return SUBMISSION_SEARCH_LIMIT_DEFAULT;
}

/**
 * Build the parameterized SELECT for submission-side full-text search,
 * including a rank-ordered ts_headline snippet. Returns SQL + bind
 * params; the caller supplies the connection.
 *
 * Bind positions:
 *   $1 = raw query (string, fed to plainto_tsquery)
 *   $2 = evaluation_id (uuid)
 *   $3 = limit (int)
 *
 * Result columns: id, evidence_item_id, source_chunk_id, doc_section,
 * page_num, indigenous_flagged, snippet, rank.
 */
export function buildSubmissionSearchQuery(
  q: string,
  opts: BuildSubmissionSearchQueryOptions,
): BuildSubmissionSearchQueryResult {
  const safeLimit = clampSubmissionSearchLimit(opts.limit);
  // ts_headline option string is a literal-only Postgres argument; it
  // does NOT accept bind parameters. We embed it as a SQL literal
  // (single-quoted) and rely on the constant being a non-user value.
  const headlineLiteral = `'${SUBMISSION_SEARCH_HEADLINE_OPTIONS}'`;
  const sql = `
    SELECT
      id,
      evidence_item_id,
      source_chunk_id,
      doc_section,
      page_num,
      indigenous_flagged,
      ts_headline('english', content, plainto_tsquery('english', $1), ${headlineLiteral}) AS snippet,
      ts_rank_cd(content_tsv, plainto_tsquery('english', $1)) AS rank
    FROM v2_submission_chunks
    WHERE evaluation_id = $2
      AND content_tsv @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC, page_num ASC NULLS LAST, id ASC
    LIMIT $3
  `;
  return {
    sql,
    params: [q, opts.evaluationId, safeLimit],
  };
}

/**
 * SQL fragment for the snippet column in isolation. Useful for routes
 * that select an already-known chunk and want the same headline
 * semantics (e.g., the chunk-detail endpoint).
 *
 * Caller embeds this in a SELECT, providing $1 = raw query string.
 */
export function renderSnippet(): string {
  return `ts_headline('english', content, plainto_tsquery('english', $1), '${SUBMISSION_SEARCH_HEADLINE_OPTIONS}')`;
}

/**
 * Lightweight JS-side fallback for environments that cannot run a
 * round-trip to Postgres (e.g., chat retrieval that already has the
 * chunk content in memory). Trivially extracts a window of up to
 * `windowChars` characters around the first case-insensitive match of
 * any whitespace-separated token from `query`. Returns the original
 * content (truncated to windowChars) when no token matches.
 *
 * NOTE: This is intentionally simpler than Postgres ts_headline; the
 * Phase C UI route is the canonical path. Phase D chat retrieval may
 * prefer this JS fallback when content is already in-memory.
 */
export function renderSnippetJs(
  content: string,
  query: string,
  windowChars = 240,
): string {
  if (!content) return "";
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) {
    return content.slice(0, windowChars);
  }
  const haystack = content.toLowerCase();
  let bestIdx = -1;
  for (const tok of tokens) {
    const idx = haystack.indexOf(tok);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }
  if (bestIdx === -1) {
    return content.slice(0, windowChars);
  }
  const half = Math.floor(windowChars / 2);
  const start = Math.max(0, bestIdx - half);
  const end = Math.min(content.length, start + windowChars);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";
  return `${prefix}${content.slice(start, end)}${suffix}`;
}
