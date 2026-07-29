/**
 * The admin site-aggregate page's READ-ONLY pagination loaders, extracted so
 * their RPC/range arguments are testable.
 *
 * WHY THIS EXISTS. The page is a Next.js server component wired to `cookies()`
 * and `redirect()`, so its loops could not be executed directly and its actual
 * pagination arguments were the one consumer with no runtime evidence. A review
 * demonstrated that a consumer computing `(page + 1) * PAGE_SIZE` would reach
 * offset 25000, fail closed at the SQL ceiling with UE422, and leave every
 * contract assertion green. These three loops are moved here VERBATIM in
 * behaviour -- same ordering, same break conditions, same truncation flags, same
 * error routing -- so that gap can be closed by execution rather than by
 * inspection.
 *
 * Each loader takes the bounds from `siteAggregatePageArgs`, the single
 * authority, and never computes an offset itself.
 */

import type { AggregateInputDra, AggregateInputSample } from './siteAggregates';
import { PAGE_SIZE, siteAggregatePageArgs, siteAggregatePageIndexes } from './site-aggregate-pagination';

/** Minimal shape of the PostgREST/RPC client surface these loaders touch. */
export interface AdminLoaderClient {
  schema(name: string): {
    from(table: string): AdminLoaderQuery;
    rpc(fn: string, args: Record<string, unknown>): Promise<AdminLoaderResult>;
  };
}

export interface AdminLoaderQuery {
  select(columns: string): AdminLoaderQuery;
  eq(column: string, value: unknown): AdminLoaderQuery;
  order(column: string, options?: Record<string, unknown>): AdminLoaderQuery;
  range(from: number, to: number): Promise<AdminLoaderResult>;
}

export interface AdminLoaderResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface SamplesLoad {
  samples: AggregateInputSample[];
  truncated: boolean;
  loadError: string | null;
}

export async function loadAdminMediumTierSamples(
  client: AdminLoaderClient,
): Promise<SamplesLoad> {
  const samples: AggregateInputSample[] = [];
  let loadError: string | null = null;
  let truncated = false;
  const pages = siteAggregatePageIndexes();

  for (const page of pages) {
    const { p_limit, p_offset } = siteAggregatePageArgs(page);
    const { data, error } = await client
      .schema('matrix_map')
      .from('samples')
      .select('source_dra_id, coordinate_quality_tier, coordinate_source, latitude, longitude')
      // Medium-tier only, matching the operator preview this page has always
      // shown. Drift is decided SERVER-SIDE
      // (fetch_admin_site_aggregate_publications.snapshot_drift_state).
      .eq('coordinate_quality_tier', 'medium')
      // TOTAL ORDER IS REQUIRED FOR CORRECTNESS. `source_dra_id` alone is not
      // unique -- one DRA can hold hundreds of rows, so its ties straddle a
      // 1000-row page boundary. Without a unique tiebreaker, rows can be
      // silently skipped or double-counted between independent .range() calls
      // while `truncated` stays false. `id` is ORDERED BY but never SELECTed,
      // so no per-sample identifier reaches the page or the rendered output.
      .order('source_dra_id', { ascending: true, nullsFirst: true })
      .order('id', { ascending: true })
      .range(p_offset, p_offset + p_limit - 1);

    if (error) {
      loadError = error.message ?? 'sample load failed';
      break;
    }
    const rows = (data ?? []) as AggregateInputSample[];
    samples.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    if (page === pages[pages.length - 1]) truncated = true;
  }

  return { samples, truncated, loadError };
}

export interface DrasLoad {
  draRows: AggregateInputDra[];
  drasTruncated: boolean;
  draError: string | null;
}

export async function loadAdminDras(client: AdminLoaderClient): Promise<DrasLoad> {
  const draRows: AggregateInputDra[] = [];
  let draError: string | null = null;
  let drasTruncated = false;
  const pages = siteAggregatePageIndexes();

  for (const page of pages) {
    const { p_limit, p_offset } = siteAggregatePageArgs(page);
    const { data, error } = await client
      .schema('matrix_map')
      .from('dras')
      .select('id, title, public')
      .eq('is_deleted', false)
      // `id` is the primary key, so unlike the samples load it is already
      // unique on its own -- no second tiebreaker is needed.
      .order('id', { ascending: true })
      .range(p_offset, p_offset + p_limit - 1);

    if (error) {
      draError = error.message ?? 'dra load failed';
      break;
    }
    const rows = (data ?? []) as AggregateInputDra[];
    draRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    if (page === pages[pages.length - 1]) drasTruncated = true;
  }

  return { draRows, drasTruncated, draError };
}

export interface CandidatesLoad<T> {
  candidates: T[];
  candidatesTruncated: boolean;
  candidateError: string | null;
}

export async function loadAdminCandidates<T>(
  client: AdminLoaderClient,
): Promise<CandidatesLoad<T>> {
  const candidates: T[] = [];
  let candidatesTruncated = false;
  let candidateError: string | null = null;
  const pages = siteAggregatePageIndexes();

  for (const page of pages) {
    // Bounds are passed INTO the RPC. `.range()` would only trim what crosses
    // the wire: the function is PL/pgSQL, so its RETURN QUERY materializes
    // first and would recompute the drift snapshot for every publication on
    // every page. The database work must be bounded, not just the payload.
    const { data, error } = await client
      .schema('matrix_map')
      .rpc('fetch_admin_site_aggregate_publications', {
        p_publication_id: null,
        ...siteAggregatePageArgs(page),
      });

    if (error) {
      // CANDIDATE-SIDE ONLY. This must never reach the sample/DRA `loadError`:
      // a failing candidate RPC -- guaranteed while the Option C SQL is
      // unapplied, since the function does not exist yet -- would otherwise
      // blank the medium-tier table, summary and map that loaded fine.
      if (!candidateError) candidateError = error.message ?? 'candidate load failed';
      break;
    }
    const rows = (data ?? []) as T[];
    candidates.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    if (page === pages[pages.length - 1]) candidatesTruncated = true;
  }

  return { candidates, candidatesTruncated, candidateError };
}

/** Combined read-only evidence the admin surface needs, in one orchestration. */
export interface AdminSurfaceLoad<TCandidate> {
  samples: AggregateInputSample[];
  truncated: boolean;
  draRows: AggregateInputDra[];
  drasTruncated: boolean;
  candidates: TCandidate[];
  candidatesTruncated: boolean;
  /**
   * PREVIEW-side error only. A sample or DRA failure lands here; a candidate
   * failure NEVER does, because `loadError` gates the medium-tier table, summary
   * and map, and a failing candidate RPC -- guaranteed while the Option C SQL is
   * unapplied -- must not blank a preview that loaded fine.
   */
  loadError: string | null;
  /** CANDIDATE-side error, deliberately kept separate from `loadError`. */
  candidateError: string | null;
}

/**
 * THE ONE ORCHESTRATION the admin page invokes.
 *
 * Extracted so that "the page actually USES these loaders" is provable by
 * EXECUTION rather than by source shape. A review demonstrated that scanning the
 * page and the loader module as concatenated text proves only that the code
 * EXISTS: removing the page's `loadAdminCandidates(...)` call while keeping the
 * import left all 44 relocated contract assertions green, in a state where the
 * admin page would silently lose every candidate and every lifecycle control.
 *
 * Three properties are now distinguished, and each is proved separately:
 *   1. the implementation EXISTS          -- loader unit tests
 *   2. the implementation is CONSTRAINED  -- the column-projection and
 *                                            containment checks, plus the
 *                                            OBSERVED runtime RPC, table and
 *                                            ordering calls recorded in
 *                                            site-aggregate-pagination-behaviour.test.ts.
 *                                            No claim is made about which RPCs
 *                                            are reachable statically.
 *   3. the page INVOKES it                -- this function's behavioural test,
 *                                            plus a narrow structural assertion
 *                                            that page.tsx calls THIS function
 *
 * Ordering and error routing are preserved exactly as they were inline in the
 * page: samples, then DRAs (whose error only fills `loadError` if the sample
 * load did not already), then candidates.
 */
export async function loadSiteAggregateAdminSurface<TCandidate>(
  client: AdminLoaderClient,
): Promise<AdminSurfaceLoad<TCandidate>> {
  const { samples, truncated, loadError: sampleLoadError } =
    await loadAdminMediumTierSamples(client);
  let loadError: string | null = sampleLoadError;

  const { draRows, drasTruncated, draError } = await loadAdminDras(client);
  if (draError && !loadError) loadError = draError;

  const { candidates, candidatesTruncated, candidateError } =
    await loadAdminCandidates<TCandidate>(client);

  return {
    samples,
    truncated,
    draRows,
    drasTruncated,
    candidates,
    candidatesTruncated,
    loadError,
    candidateError,
  };
}
