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
import { toAggregateMarkers } from './siteAggregateMarkers';

const PAGE_SIZE = 1000;
const MAX_PAGES = 25;
const DRA_ID_CHUNK_SIZE = 100;

export interface FetchSiteAggregatesServerSideResult {
  siteAggregateData: MatrixSiteAggregateData;
  siteAggregateFetchErrorMessage: string | null;
}

interface PagedQuery<T> {
  range: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>;
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

/**
 * Fixed, caller-independent Option C aggregate read over the caller's
 * authenticated Matrix Map RLS surface. This helper accepts no bbox, radius,
 * substance, date, classification, or other caller-supplied filter, so counts
 * cannot be narrowed into an oracle. It also does not use service-role
 * credentials.
 *
 * Callers must pass a server-side Supabase client with the user's JWT attached.
 * RLS/allowlist/private grants decide which rows are visible. The helper returns
 * aggregate markers only, never sample rows.
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
