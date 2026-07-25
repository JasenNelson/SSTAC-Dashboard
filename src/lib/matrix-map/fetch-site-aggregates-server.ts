import 'server-only';

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

const PAGE_SIZE = 1000;
const MAX_PAGES = 25;
const DRA_ID_CHUNK_SIZE = 100;
const PUBLISHED_AGGREGATE_SOURCE_PREFIX = 'published-aggregate';
const PUBLISHED_AGGREGATE_SNAPSHOT_FALLBACK = 'site-aggregate-publications-v1';

export interface FetchSiteAggregatesServerSideResult {
  siteAggregateData: MatrixSiteAggregateData;
  siteAggregateFetchErrorMessage: string | null;
}

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

type MatrixMapSchemaRpcClient = {
  rpc?: (functionName: string) => PagedQuery<RawPublishedAggregateRow>;
};

async function fetchAllPages<T>(query: PagedQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
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

  const representativeCount = bucketRepresentativeCount(bucket);
  return {
    key: aggregateId,
    source_dra_id: `${PUBLISHED_AGGREGATE_SOURCE_PREFIX}:${aggregateId}`,
    position: [latitude, longitude],
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
): Promise<MatrixSiteAggregateData | null> {
  const schemaClient = supabase.schema('matrix_map') as unknown as MatrixMapSchemaRpcClient;
  if (typeof schemaClient.rpc !== 'function') return null;

  const rpcQuery = schemaClient.rpc('fetch_published_site_aggregates');
  const rows: RawPublishedAggregateRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await rpcQuery.range(from, to);
    if (error) {
      if (isMissingPublishedAggregateRpcError(error)) {
        console.warn('[matrix-map] fetch_published_site_aggregates RPC missing; falling back to legacy RLS path');
        return null;
      }
      throw new Error(error.message ?? 'published site aggregate query failed');
    }
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (page === MAX_PAGES - 1) {
      throw new Error('published site aggregate query exceeded page cap');
    }
  }

  const markers = rows
    .map(normalizePublishedAggregate)
    .filter((marker): marker is AggregateMarker => Boolean(marker));
  const dataSnapshotVersion = rows
    .map((row) => row.data_snapshot_version)
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    site_aggregate_markers: markers,
    site_count: markers.length,
    sample_count_total: markers.reduce((total, marker) => total + marker.sample_count_total, 0),
    sample_count_label: markers.length > 0 ? 'bucketed sample counts' : undefined,
    data_snapshot_version: dataSnapshotVersion ?? PUBLISHED_AGGREGATE_SNAPSHOT_FALLBACK,
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
    };
  }

  try {
    const publishedSiteAggregateData = await fetchPublishedSiteAggregatesServerSide(supabase);
    if (publishedSiteAggregateData) {
      return {
        siteAggregateData: publishedSiteAggregateData,
        siteAggregateFetchErrorMessage: null,
      };
    }

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
    console.error('[matrix-map] site aggregate fetch failed:', error);
    return {
      siteAggregateData: EMPTY_MATRIX_SITE_AGGREGATE_DATA,
      siteAggregateFetchErrorMessage: 'Site aggregates temporarily unavailable.',
    };
  }
}