import 'server-only';

import { logger } from '@/lib/logger';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  EMPTY_MATRIX_SITE_AGGREGATE_DATA,
  type MatrixSiteAggregateData,
} from '@/app/(dashboard)/matrix-map/types';
import {
  computeSiteAggregates,
  type AggregateInputDra,
  type AggregateInputSample,
  type CoordinateTier,
} from './siteAggregates';
import {
  markerRadiusForCount,
  toAggregateMarkers,
  type AggregateMarker,
} from './siteAggregateMarkers';
// ONE legal database pagination envelope for every RPC consumer. Local numeric
// copies are forbidden: three consumers previously each declared their own
// PAGE_SIZE/MAX_PAGES, so raising the shared values and the SQL ceiling
// together would have left this loader failing at the old cap.
import {
  PAGE_SIZE,
  siteAggregatePageArgs,
  siteAggregatePageIndexes,
} from './site-aggregate-pagination';

const DRA_ID_CHUNK_SIZE = 100;
const PUBLISHED_AGGREGATE_SOURCE_PREFIX = 'published-aggregate';
const PUBLISHED_AGGREGATE_SNAPSHOT_FALLBACK = 'site-aggregate-publications-v1';

/**
 * Discriminates WHY an aggregate fetch produced no data. Previously every failure
 * collapsed into the single string 'Site aggregates temporarily unavailable.', so
 * a caller could not tell "the member-safe RPC is not deployed" from "the query
 * failed" from "we exceeded the page cap". Under the fail-closed contract below
 * that distinction is load-bearing, because "no published aggregates exist" and
 * "we refused to serve a non-member-safe shape" must not look identical.
 */
export type SiteAggregateFetchErrorKind =
  | 'client_unavailable'
  | 'member_rpc_unavailable'
  | 'query_failed'
  | 'page_cap_exceeded';

export interface FetchSiteAggregatesServerSideResult {
  siteAggregateData: MatrixSiteAggregateData;
  siteAggregateFetchErrorMessage: string | null;
  /** Optional so existing callers that construct this shape stay valid. */
  siteAggregateFetchErrorKind?: SiteAggregateFetchErrorKind | null;
}

/** Internal discriminated result of the member-safe RPC attempt. */
type PublishedAggregateAttempt =
  | { status: 'ok'; data: MatrixSiteAggregateData }
  | { status: 'rpc_unavailable' };

interface PagedQuery<T> {
  range: (from: number, to: number) => Promise<{ data: T[] | null; error: QueryError | null }>;
}

interface QueryError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

type RawSampleRow = {
  source_dra_id?: unknown;
  coordinate_quality_tier?: unknown;
  coordinate_source?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type RawDraRow = {
  id?: unknown;
  title?: unknown;
  public?: unknown;
};

type RawPublishedAggregateRow = {
  aggregate_id?: unknown;
  label?: unknown;
  representative_latitude?: unknown;
  representative_longitude?: unknown;
  coordinate_quality_tier?: unknown;
  sample_count_bucket?: unknown;
  data_snapshot_version?: unknown;
  visible_sample_suppression_key?: unknown;
};

type SampleCountBucket = '1' | '2-9' | '10-99' | '100+';

/**
 * The member aggregate RPC now takes its bounds as ARGUMENTS and resolves to a
 * result directly, rather than returning a chainable `.range()` builder. The
 * function is PL/pgSQL, so an outer range would trim a result the database had
 * already materialized in full -- once per page.
 */
type PublishedAggregateRpcArgs = { p_limit: number; p_offset: number };

type MatrixMapSchemaRpcClient = {
  rpc?: (
    functionName: string,
    args: PublishedAggregateRpcArgs,
  ) => Promise<{ data: RawPublishedAggregateRow[] | null; error: QueryError | null }>;
};

async function fetchAllPages<T>(query: PagedQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (const page of siteAggregatePageIndexes()) {
    // The WINDOW comes from the shared authority, not from arithmetic here.
    const { p_limit, p_offset } = siteAggregatePageArgs(page);
    const from = p_offset;
    const to = p_offset + p_limit - 1;
    const { data, error } = await query.range(from, to);
    if (error) {
      throw new Error(error.message ?? 'query failed');
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
  throw new Error('site aggregate query exceeded page cap');
}

function asCoordinateTier(value: unknown): CoordinateTier | null {
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Rounds (never truncates) to at most three decimal places -- roughly 111 m of
 * precision at the equator, the published member coordinate contract. Applied
 * AFTER the finite-number validation in `normalizePublishedAggregate`, so this
 * is a boundary enforcement, not a trust assumption: if an installed RPC ever
 * returns more than 3 decimals (deployment drift, a schema change upstream),
 * the member marker must still be clamped to the contract here rather than
 * forwarding whatever precision happened to arrive.
 */
function roundToThreeDecimalPlaces(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function asSampleCountBucket(value: unknown): SampleCountBucket | null {
  return value === '1' || value === '2-9' || value === '10-99' || value === '100+'
    ? value
    : null;
}

function bucketRepresentativeCount(bucket: SampleCountBucket): number {
  if (bucket === '1') return 1;
  if (bucket === '2-9') return 2;
  if (bucket === '10-99') return 10;
  return 100;
}

function normalizeSample(row: RawSampleRow): AggregateInputSample | null {
  const tier = asCoordinateTier(row.coordinate_quality_tier);
  if (!tier) return null;
  return {
    source_dra_id: typeof row.source_dra_id === 'string' ? row.source_dra_id : null,
    coordinate_quality_tier: tier,
    coordinate_source: typeof row.coordinate_source === 'string' ? row.coordinate_source : null,
    latitude: asFiniteNumber(row.latitude),
    longitude: asFiniteNumber(row.longitude),
  };
}

function normalizeDra(row: RawDraRow): AggregateInputDra | null {
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    title: typeof row.title === 'string' ? row.title : null,
    public: row.public === true,
  };
}

function normalizePublishedAggregate(row: RawPublishedAggregateRow): AggregateMarker | null {
  // A null/non-object row previously threw a TypeError on the first property
  // access below. That exception escaped to the outer catch and discarded EVERY
  // otherwise-valid marker in the payload -- a single malformed row poisoned the
  // whole response and the caller silently received the empty fallback.
  if (!row || typeof row !== 'object') return null;

  const aggregateId = typeof row.aggregate_id === 'string' ? row.aggregate_id : null;
  const label = typeof row.label === 'string' && row.label.trim().length > 0
    ? row.label
    : null;
  const latitude = asFiniteNumber(row.representative_latitude);
  const longitude = asFiniteNumber(row.representative_longitude);
  const tier = asCoordinateTier(row.coordinate_quality_tier);
  const bucket = asSampleCountBucket(row.sample_count_bucket);
  const sampleSuppressionKey = typeof row.visible_sample_suppression_key === 'string' && row.visible_sample_suppression_key.length > 0
    ? row.visible_sample_suppression_key
    : undefined;
  if (!aggregateId || !label || latitude === null || longitude === null || !tier || !bucket) {
    return null;
  }

  // Precision containment at the application boundary: round AFTER the finite
  // check above, never trust the RPC's own precision. See
  // roundToThreeDecimalPlaces for why this must be round, not truncate.
  const boundedLatitude = roundToThreeDecimalPlaces(latitude);
  const boundedLongitude = roundToThreeDecimalPlaces(longitude);

  const representativeCount = bucketRepresentativeCount(bucket);
  return {
    key: aggregateId,
    source_dra_id: `${PUBLISHED_AGGREGATE_SOURCE_PREFIX}:${aggregateId}`,
    position: [boundedLatitude, boundedLongitude],
    label,
    coordinate_quality_tier: tier,
    sample_count_total: representativeCount,
    sample_count_high: 0,
    sample_count_medium: representativeCount,
    sample_count_label: bucket,
    sample_suppression_key: sampleSuppressionKey,
    radius: markerRadiusForCount(representativeCount),
  };
}

function isMissingPublishedAggregateRpcError(error: QueryError): boolean {
  if (error.code === 'PGRST202') return true;
  const text = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  return (
    text.includes('fetch_published_site_aggregates') &&
    (text.includes('could not find') ||
      text.includes('not found') ||
      text.includes('does not exist') ||
      text.includes('schema cache'))
  );
}

async function fetchPublishedSiteAggregatesServerSide(
  supabase: SupabaseClient,
): Promise<PublishedAggregateAttempt> {
  const schemaClient = supabase.schema('matrix_map') as unknown as MatrixMapSchemaRpcClient;
  if (typeof schemaClient.rpc !== 'function') {
    // Previously returned null with NO log at all, so this path was completely
    // invisible: the map silently served the legacy shape with no signal anywhere.
    logger.warn('[matrix-map] schema client exposes no rpc(); member-safe aggregate path unavailable');
    return { status: 'rpc_unavailable' };
  }

  const rows: RawPublishedAggregateRow[] = [];
  const pageIndexes = siteAggregatePageIndexes();
  for (const page of pageIndexes) {
    // Bounds are ARGUMENTS, not an outer `.range()`. The RPC is PL/pgSQL, so
    // its RETURN QUERY materializes the whole sorted set before any outer range
    // trims it -- paging with `.range()` recomputed the entire published list
    // once per page. A fresh call per page is required now that the bounds are
    // part of the request.
    // The argument object is the shared constructor's RETURN VALUE, passed
    // straight through. No p_limit/p_offset is built here.
    const { data, error } = await schemaClient.rpc(
      'fetch_published_site_aggregates',
      siteAggregatePageArgs(page),
    );
    if (error) {
      if (isMissingPublishedAggregateRpcError(error)) {
        logger.warn('[matrix-map] fetch_published_site_aggregates RPC unavailable; failing closed', {
          code: error.code ?? null,
        });
        return { status: 'rpc_unavailable' };
      }
      throw new Error(error.message ?? 'published site aggregate query failed');
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (page === pageIndexes[pageIndexes.length - 1]) {
      throw new Error('published site aggregate query exceeded page cap');
    }
  }

  const markers = rows
    .map(normalizePublishedAggregate)
    .filter((marker): marker is AggregateMarker => Boolean(marker));

  // Malformed rows are dropped rather than failing the whole payload, but the
  // drop must not be SILENT -- an unobservable discard is how a projection
  // regression ships unnoticed.
  const droppedRowCount = rows.length - markers.length;
  if (droppedRowCount > 0) {
    logger.warn('[matrix-map] dropped malformed published aggregate rows', {
      dropped: droppedRowCount,
      received: rows.length,
    });
  }

  // Mixed snapshot versions: `.find()` silently returned the FIRST version, so a
  // payload spanning a republish boundary advertised one snapshot key while
  // carrying markers from several. Still deterministic (first wins, for
  // compatibility), but no longer silent.
  const snapshotVersions = [
    ...new Set(
      rows
        .map((row) => (row && typeof row === 'object' ? row.data_snapshot_version : undefined))
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  ];
  if (snapshotVersions.length > 1) {
    logger.warn('[matrix-map] published aggregates span multiple data_snapshot_version values', {
      versions: snapshotVersions.length,
      selected: snapshotVersions[0],
    });
  }

  return {
    status: 'ok',
    data: {
      site_aggregate_markers: markers,
      site_count: markers.length,
      sample_count_total: markers.reduce((total, marker) => total + marker.sample_count_total, 0),
      sample_count_label: markers.length > 0 ? 'bucketed sample counts' : undefined,
      data_snapshot_version: snapshotVersions[0] ?? PUBLISHED_AGGREGATE_SNAPSHOT_FALLBACK,
    },
  };
}

/**
 * Fixed, caller-independent Option C aggregate read. When the audited publication
 * primitive is installed, this helper uses the member-safe RPC projection first:
 * opaque ids, neutral labels, bucketed counts, and no raw DRA provenance. Before
 * that migration exists, it falls back to the original authenticated Matrix Map
 * RLS surface so the deployed pages keep their current behavior.
 *
 * Callers must pass a server-side Supabase client with the user's JWT attached.
 * The helper accepts no bbox, radius, substance, date, classification, or other
 * caller-supplied filter, so counts cannot be narrowed into an oracle.
 */
export async function fetchMatrixMapSiteAggregatesServerSide(
  supabase: SupabaseClient | null,
): Promise<FetchSiteAggregatesServerSideResult> {
  if (!supabase) {
    return {
      siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
      siteAggregateFetchErrorMessage: 'Site aggregates temporarily unavailable.',
      siteAggregateFetchErrorKind: 'client_unavailable',
    };
  }

  try {
    const attempt = await fetchPublishedSiteAggregatesServerSide(supabase);
    if (attempt.status === 'ok') {
      return {
        siteAggregateData: attempt.data,
        siteAggregateFetchErrorMessage: null,
        siteAggregateFetchErrorKind: null,
      };
    }

    // ---------------------------------------------------------------------
    // D1(c) FAIL_CLOSED - owner-approved 2026-07-27.
    //
    // When the member-safe RPC is unavailable we return NO aggregate markers
    // and an explicit unavailable state. We do NOT fall through to the legacy
    // RLS recomputation below.
    //
    // Why: the legacy path emits a DIFFERENT, wider shape -- raw DRA ids and
    // titles, exact per-tier counts, and full-precision coordinates -- versus
    // the published member contract's opaque ids, neutral labels, bucketed
    // counts and 3-decimal coordinates. Silently substituting it means the
    // caller cannot tell which contract it received, so a publication
    // primitive that exists precisely to bound member exposure would quietly
    // degrade to the unbounded path whenever it was missing. Everything the
    // legacy path exposes is permitted by existing RLS, so this is a contract
    // and release-safety failure rather than a privilege leak -- but "allowed
    // by RLS" is not the same as "inside the published member contract".
    //
    // An empty map with an honest unavailable banner is strictly better than a
    // populated map of unknown provenance.
    // ---------------------------------------------------------------------
    logger.warn('[matrix-map] member-safe aggregate RPC unavailable; failing closed (D1c)');
    return {
      siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
      siteAggregateFetchErrorMessage:
        'Site aggregates are unavailable until the published aggregate service is deployed.',
      siteAggregateFetchErrorKind: 'member_rpc_unavailable',
    };
  } catch (error) {
    const isPageCap =
      error instanceof Error && error.message.includes('exceeded page cap');
    logger.error('[matrix-map] site aggregate fetch failed', {
      kind: isPageCap ? 'page_cap_exceeded' : 'query_failed',
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
      siteAggregateFetchErrorMessage: 'Site aggregates temporarily unavailable.',
      siteAggregateFetchErrorKind: isPageCap ? 'page_cap_exceeded' : 'query_failed',
    };
  }
}

/**
 * LEGACY RLS recomputation. Retained for the ADMIN preview surface and for
 * reference, but deliberately NO LONGER reachable from the ordinary member path
 * above (see the D1(c) FAIL_CLOSED block). It emits the wider admin-shaped
 * projection and must never be served to members as a substitute for the
 * published member contract.
 */
export async function fetchLegacyRlsSiteAggregatesServerSide(
  supabase: SupabaseClient,
): Promise<FetchSiteAggregatesServerSideResult> {
  try {
    const draQuery = supabase
      .schema('matrix_map')
      .from('dras')
      .select('id, title, public')
      .eq('is_deleted', false)
      .order('id', { ascending: true }) as unknown as PagedQuery<RawDraRow>;
    const dras = (await fetchAllPages(draQuery))
      .map(normalizeDra)
      .filter((d): d is AggregateInputDra => Boolean(d));
    const visibleDraIds = dras.map((dra) => dra.id).sort();
    if (visibleDraIds.length === 0) {
      return {
        siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
        siteAggregateFetchErrorMessage: null,
      };
    }

    const samples: AggregateInputSample[] = [];
    for (let start = 0; start < visibleDraIds.length; start += DRA_ID_CHUNK_SIZE) {
      const draIdChunk = visibleDraIds.slice(start, start + DRA_ID_CHUNK_SIZE);
      const sampleQuery = supabase
        .schema('matrix_map')
        .from('samples')
        .select('source_dra_id, coordinate_quality_tier, coordinate_source, latitude, longitude')
        .not('source_dra_id', 'is', null)
        .in('source_dra_id', draIdChunk)
        .order('source_dra_id', { ascending: true })
        .order('id', { ascending: true }) as unknown as PagedQuery<RawSampleRow>;
      samples.push(
        ...(await fetchAllPages(sampleQuery))
          .map(normalizeSample)
          .filter((s): s is AggregateInputSample => Boolean(s)),
      );
    }

    const visibleAggregates = computeSiteAggregates(samples, dras)
      .filter((aggregate) => aggregate.sample_count_medium > 0)
      .map((aggregate) => ({
        ...aggregate,
        coordinate_quality_tier: 'medium' as const,
      }));
    const markers = toAggregateMarkers(visibleAggregates);

    return {
      siteAggregateData: {
        site_aggregate_markers: markers,
        site_count: markers.length,
        sample_count_total: visibleAggregates.reduce(
          (total, aggregate) => total + aggregate.sample_count_total,
          0,
        ),
        data_snapshot_version: 'site-aggregates-v1',
      },
      siteAggregateFetchErrorMessage: null,
    };
  } catch (error) {
    logger.error('[matrix-map] legacy RLS site aggregate fetch failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
      siteAggregateFetchErrorMessage: 'Site aggregates temporarily unavailable.',
      siteAggregateFetchErrorKind: 'query_failed',
    };
  }
}