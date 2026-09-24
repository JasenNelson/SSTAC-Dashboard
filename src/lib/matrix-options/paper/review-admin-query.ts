import { REVIEW_RESPONSE_SELECT } from './review-csv';

/*
 * The one admin read of paper review responses, shared by the admin page and
 * the CSV export.
 *
 * - Always scoped to the TRUSTED release (document version + manifest): rows
 *   from any other release would fail normalizeReviewRows and fail the whole
 *   view closed once a second release exists. The caller's own release filters
 *   are validated against the trusted identity beforehand and are therefore
 *   redundant here -- they are never sent as extra, case-sensitive predicates
 *   (an accepted upper-case hash would otherwise match nothing).
 * - KEYSET-paged on the immutable unique row id (id > last id seen, ascending)
 *   until an EMPTY page, so PostgREST's max-rows limit can never silently
 *   truncate the result. Guarantee (within REVIEW_ADMIN_MAX_PAGES; beyond it
 *   an error is returned): every row that exists both when the read starts and
 *   when it ends is returned exactly once -- ids are immutable and the order is
 *   total, so page boundaries cannot shift into a duplicate or a skip the way
 *   offset paging could. This is NOT a point-in-time snapshot: a row created or
 *   deleted during a multi-page read may or may not appear, and a row edited
 *   mid-read carries whichever revision its page saw. Display order is applied
 *   by the consumers.
 */

export const REVIEW_ADMIN_PAGE_SIZE = 1000;
/** Hard stop far above any realistic release (reviewers x 12 questions). */
export const REVIEW_ADMIN_MAX_PAGES = 100;

export interface ReviewAdminFilters {
  readonly cohortId?: string;
  readonly questionId?: string;
  readonly userId?: string;
}

interface QueryResult { readonly data?: unknown; readonly error?: unknown }
// Minimal structural view of the Supabase query builder used here.
interface ReviewQuery extends PromiseLike<QueryResult> {
  eq(column: string, value: string): ReviewQuery;
  gt(column: string, value: string): ReviewQuery;
  order(column: string, options?: { ascending?: boolean }): ReviewQuery;
  limit(count: number): ReviewQuery;
}
interface ReviewClient {
  from(table: string): { select(columns: string): ReviewQuery };
}

export async function fetchTrustedReviewRows(
  client: ReviewClient,
  trusted: { readonly documentVersion: string; readonly manifestSha256: string },
  filters: ReviewAdminFilters,
): Promise<{ readonly rows: unknown[] } | { readonly error: unknown }> {
  const rows: unknown[] = [];
  let lastId: string | null = null;
  for (let page = 0; page < REVIEW_ADMIN_MAX_PAGES; page += 1) {
    let query = client.from('matrix_paper_review_responses').select(REVIEW_RESPONSE_SELECT)
      .eq('document_version', trusted.documentVersion)
      .eq('manifest_sha256', trusted.manifestSha256);
    if (filters.cohortId) query = query.eq('cohort_id', filters.cohortId);
    if (filters.questionId) query = query.eq('question_id', filters.questionId);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (lastId !== null) query = query.gt('id', lastId);
    const result = await query.order('id', { ascending: true }).limit(REVIEW_ADMIN_PAGE_SIZE);
    if (result.error || !Array.isArray(result.data)) return { error: result.error ?? new Error('Invalid review query result') };
    for (const row of result.data) {
      const id = row && typeof row === 'object' ? (row as { id?: unknown }).id : undefined;
      if (typeof id !== 'string' || id.length === 0) return { error: new Error('Review row without an id') };
      rows.push(row);
      lastId = id;
    }
    // Stop only on an empty page: PostgREST's max-rows may be smaller than the
    // page size, so a short page does not prove the end.
    if (result.data.length === 0) return { rows };
  }
  return { error: new Error('Review export exceeded the page limit') };
}
