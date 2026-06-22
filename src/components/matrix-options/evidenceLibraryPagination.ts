// Pure pagination math for the Evidence Library Values table. Kept separate from the (heavy)
// EvidenceLibrary component module so it is cheap to unit-test without rendering the full catalog.
//
// WHY: at 1161+ approved rows the Values table emitted 2300+ <tr> nodes (each logical row is a data
// row plus a <details> disclosure row), which is slow in the browser and crossed the CI render
// timeout. Paging bounds the rendered set; ResultCountBadge still reports the true filtered total.

export const VALUES_PAGE_SIZE = 50;

export interface ValuesPagination {
  /** Total number of pages (>= 1, even when there are zero rows). */
  pageCount: number;
  /** The requested page clamped into [0, pageCount - 1]. */
  clampedPage: number;
  /** True when the row count exceeds one page (i.e. the pager should be shown + slicing applied). */
  isPaged: boolean;
  /** Inclusive 1-based index of the first row on the clamped page (for "Rows start-end of total"). */
  start: number;
  /** Inclusive 1-based index of the last row on the clamped page. */
  end: number;
  /** Zero-based slice start for Array.prototype.slice. */
  sliceStart: number;
  /** Zero-based slice end (exclusive) for Array.prototype.slice. */
  sliceEnd: number;
}

/**
 * Compute the pagination window for a list of `totalRows` rows.
 *
 * - `pageCount` is always at least 1 (an empty list is "page 1 of 1").
 * - `page` is clamped into range, so a stale page index after the filtered set shrinks does not
 *   produce an out-of-range empty page.
 * - `isPaged` is false when the whole list fits in one page; callers render every row in that case.
 */
export function computeValuesPagination(
  totalRows: number,
  page: number,
  pageSize: number = VALUES_PAGE_SIZE,
): ValuesPagination {
  const safeTotal = Math.max(0, Math.floor(totalRows));
  const safeSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(safeTotal / safeSize));
  const clampedPage = Math.min(Math.max(0, Math.floor(page) || 0), pageCount - 1);
  const isPaged = safeTotal > safeSize;
  const sliceStart = clampedPage * safeSize;
  const sliceEnd = Math.min(sliceStart + safeSize, safeTotal);
  return {
    pageCount,
    clampedPage,
    isPaged,
    start: safeTotal === 0 ? 0 : sliceStart + 1,
    end: sliceEnd,
    sliceStart,
    sliceEnd,
  };
}
