import { describe, expect, it, vi } from 'vitest';

import { EMPTY_MATRIX_SITE_AGGREGATE_DATA } from '@/app/(dashboard)/matrix-map/types';
import { fetchMatrixMapSiteAggregatesServerSide } from '../fetch-site-aggregates-server';

type QueryCall = {
  table: string;
  select: string[];
  eq: unknown[][];
  inFilters: unknown[][];
  not: unknown[][];
  order: unknown[][];
  ranges: [number, number][];
};

function mockClient({
  dras,
  samples,
  errorTable,
}: {
  dras: Record<string, unknown>[];
  samples: Record<string, unknown>[];
  errorTable?: string;
}) {
  const calls: QueryCall[] = [];
  const byTable: Record<string, Record<string, unknown>[]> = { dras, samples };
  const client = {
    schema: vi.fn((schemaName: string) => ({
      from: vi.fn((table: string) => {
        const call: QueryCall = {
          table,
          select: [],
          eq: [],
          inFilters: [],
          not: [],
          order: [],
          ranges: [],
        };
        calls.push(call);
        const api = {
          select: vi.fn((columns: string) => {
            call.select.push(columns);
            return api;
          }),
          eq: vi.fn((...args: unknown[]) => {
            call.eq.push(args);
            return api;
          }),
          in: vi.fn((...args: unknown[]) => {
            call.inFilters.push(args);
            return api;
          }),
          not: vi.fn((...args: unknown[]) => {
            call.not.push(args);
            return api;
          }),
          order: vi.fn((...args: unknown[]) => {
            call.order.push(args);
            return api;
          }),
          range: vi.fn(async (from: number, to: number) => {
            call.ranges.push([from, to]);
            if (table === errorTable) {
              return { data: null, error: { message: `${table} failed` } };
            }
            let rows = byTable[table] ?? [];
            for (const [column, value] of call.eq) {
              rows = rows.filter((row) => row[String(column)] === value);
            }
            for (const [column, values] of call.inFilters) {
              const allowed = Array.isArray(values) ? new Set(values) : new Set();
              rows = rows.filter((row) => allowed.has(row[String(column)]));
            }
            for (const [column, operator, value] of call.not) {
              if (operator === 'is' && value === null) {
                rows = rows.filter((row) => row[String(column)] !== null);
              }
            }
            return { data: rows.slice(from, to + 1), error: null };
          }),
        };
        expect(schemaName).toBe('matrix_map');
        return api;
      }),
    })),
  };
  return { client, calls };
}

const DRA_PRIVATE = 'aaaaaaaa-0000-4000-8000-000000000001';
const DRA_PUBLIC = 'bbbbbbbb-0000-4000-8000-000000000002';
const DRA_PRIVATE_UNSEEN = 'cccccccc-0000-4000-8000-000000000003';

function sample(over: Record<string, unknown> = {}) {
  return {
    source_dra_id: DRA_PRIVATE,
    coordinate_quality_tier: 'medium',
    coordinate_source: 'bc-csr-centroid',
    latitude: 49.2827,
    longitude: -123.1207,
    ...over,
  };
}

describe('fetchMatrixMapSiteAggregatesServerSide', () => {
  it('derives public medium-tier aggregate markers from the authenticated RLS projection', async () => {
    const { client, calls } = mockClient({
      dras: [
        { id: DRA_PUBLIC, title: 'Public DRA', public: true, is_deleted: false },
      ],
      samples: [
        sample(),
        sample(),
        sample({ latitude: 49.282700001 }),
        sample({ source_dra_id: DRA_PUBLIC }),
        sample({ source_dra_id: DRA_PUBLIC }),
        sample({ source_dra_id: DRA_PUBLIC, coordinate_quality_tier: 'high' }),
        sample({ source_dra_id: null }),
      ],
    });

    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);

    expect(result.siteAggregateFetchErrorMessage).toBeNull();
    expect(result.siteAggregateData.site_count).toBe(1);
    expect(result.siteAggregateData.sample_count_total).toBe(3);
    expect(result.siteAggregateData.site_aggregate_markers).toHaveLength(1);
    expect(result.siteAggregateData.site_aggregate_markers[0]).toMatchObject({
      source_dra_id: DRA_PUBLIC,
      label: 'Public DRA',
      sample_count_total: 3,
      sample_count_high: 1,
      sample_count_medium: 2,
    });

    const sampleCall = calls.find((call) => call.table === 'samples');
    expect(sampleCall?.select).toEqual([
      'source_dra_id, coordinate_quality_tier, coordinate_source, latitude, longitude',
    ]);
    expect(sampleCall?.eq).toEqual([]);
    expect(sampleCall?.not).toContainEqual(['source_dra_id', 'is', null]);
    expect(sampleCall?.inFilters).toContainEqual(['source_dra_id', [DRA_PUBLIC]]);
    expect(sampleCall?.order).toContainEqual(['source_dra_id', { ascending: true }]);
    expect(sampleCall?.order).toContainEqual(['id', { ascending: true }]);
    expect(JSON.stringify(sampleCall)).not.toMatch(/sample_id|station_id|bnrrm_station_id|measurement|geometry/i);
  });

  it('uses RLS-visible grant DRAs without opening unseen private DRAs', async () => {
    const { client, calls } = mockClient({
      dras: [
        { id: DRA_PRIVATE, title: 'Grant-visible DRA', public: false, is_deleted: false },
        { id: DRA_PUBLIC, title: 'Public DRA', public: true, is_deleted: false },
      ],
      samples: [
        sample({ source_dra_id: DRA_PRIVATE }),
        sample({ source_dra_id: DRA_PUBLIC }),
        sample({ source_dra_id: DRA_PUBLIC }),
        sample({ source_dra_id: DRA_PRIVATE_UNSEEN }),
      ],
    });

    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);

    expect(result.siteAggregateFetchErrorMessage).toBeNull();
    expect(result.siteAggregateData.site_count).toBe(2);
    expect(result.siteAggregateData.sample_count_total).toBe(3);
    expect(result.siteAggregateData.site_aggregate_markers.map((marker) => marker.source_dra_id))
      .toEqual([DRA_PUBLIC, DRA_PRIVATE]);

    const sampleCall = calls.find((call) => call.table === 'samples');
    expect(sampleCall?.inFilters).toContainEqual([
      'source_dra_id',
      [DRA_PRIVATE, DRA_PUBLIC],
    ]);
    expect(result.siteAggregateData.site_aggregate_markers.map((marker) => marker.source_dra_id))
      .not.toContain(DRA_PRIVATE_UNSEEN);
  });

  it('emits centroid provenance for mixed-tier aggregate markers', async () => {
    const { client } = mockClient({
      dras: [
        { id: DRA_PUBLIC, title: 'Public DRA', public: true, is_deleted: false },
      ],
      samples: [
        sample({ source_dra_id: DRA_PUBLIC }),
        sample({ source_dra_id: DRA_PUBLIC, coordinate_quality_tier: 'high' }),
        sample({ source_dra_id: DRA_PUBLIC, coordinate_quality_tier: 'high' }),
      ],
    });

    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);

    expect(result.siteAggregateData.site_aggregate_markers[0]).toMatchObject({
      source_dra_id: DRA_PUBLIC,
      coordinate_quality_tier: 'medium',
      sample_count_total: 3,
      sample_count_high: 2,
      sample_count_medium: 1,
    });
  });
  it('chunks large visible DRA id sets before reading samples', async () => {
    const dras = Array.from({ length: 205 }, (_, index) => ({
      id: `dra-${String(index).padStart(3, '0')}`,
      title: `DRA ${index}`,
      public: true,
      is_deleted: false,
    }));
    const { client, calls } = mockClient({
      dras,
      samples: [
        sample({ source_dra_id: 'dra-000' }),
        sample({ source_dra_id: 'dra-100' }),
        sample({ source_dra_id: 'dra-204' }),
      ],
    });

    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);

    expect(result.siteAggregateFetchErrorMessage).toBeNull();
    expect(result.siteAggregateData.site_count).toBe(3);
    const sampleCalls = calls.filter((call) => call.table === 'samples');
    expect(sampleCalls).toHaveLength(3);
    expect(sampleCalls.map((call) => (call.inFilters[0]?.[1] as unknown[]).length))
      .toEqual([100, 100, 5]);
  });
  it('has no caller-scoped oracle surface', async () => {
    expect(fetchMatrixMapSiteAggregatesServerSide.length).toBeLessThanOrEqual(1);
    const source = fetchMatrixMapSiteAggregatesServerSide.toString();
    expect(source).not.toMatch(/bbox|radius|searchParams|substance|classification|date_from|date_to/);
  });

  it('returns an empty fallback when the authenticated read surface is unavailable', async () => {
    const result = await fetchMatrixMapSiteAggregatesServerSide(null);
    expect(result.siteAggregateData).toEqual(EMPTY_MATRIX_SITE_AGGREGATE_DATA);
    expect(result.siteAggregateFetchErrorMessage).toMatch(/temporarily unavailable/);
  });

  it('returns an empty fallback on query failure', async () => {
    const { client } = mockClient({
      dras: [{ id: DRA_PUBLIC, title: 'Public DRA', public: true, is_deleted: false }],
      samples: [sample({ source_dra_id: DRA_PUBLIC })],
      errorTable: 'samples',
    });

    const result = await fetchMatrixMapSiteAggregatesServerSide(client as never);
    expect(result.siteAggregateData).toEqual(EMPTY_MATRIX_SITE_AGGREGATE_DATA);
    expect(result.siteAggregateFetchErrorMessage).toMatch(/temporarily unavailable/);
  });
});
