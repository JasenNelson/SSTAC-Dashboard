import { describe, it, expect } from 'vitest';
import {
  toAggregateMarkers,
  markerRadiusForCount,
  boundsForMarkers,
  type AggregateMarker,
} from '../siteAggregateMarkers';
import type { SiteAggregate } from '../siteAggregates';

function agg(over: Partial<SiteAggregate> = {}): SiteAggregate {
  return {
    aggregate_id: 'dra-1:49.28270,-123.12070',
    source_dra_id: 'dra-1',
    coordinate_cluster_id: '49.28270,-123.12070',
    display_name: 'Site One',
    dra_public: false,
    representative_latitude: 49.2827,
    representative_longitude: -123.1207,
    coordinate_quality_tier: 'medium',
    coordinate_source: 'bc-csr-centroid',
    sample_count_total: 5,
    sample_count_high: 0,
    sample_count_medium: 5,
    sample_count_low: 0,
    distinct_point_count: 1,
    ...over,
  };
}

describe('markerRadiusForCount', () => {
  it('is at the floor for N=1 (legible at the small end)', () => {
    expect(markerRadiusForCount(1)).toBe(5);
    expect(markerRadiusForCount(0)).toBe(5);
  });

  it('is clamped at the ceiling for N=476 (does not read as spatial extent)', () => {
    expect(markerRadiusForCount(476)).toBe(14);
  });

  it('grows monotonically but sub-linearly between the extremes', () => {
    const r10 = markerRadiusForCount(10);
    const r100 = markerRadiusForCount(100);
    expect(r10).toBeGreaterThan(5);
    expect(r100).toBeGreaterThan(r10);
    expect(r100).toBeLessThanOrEqual(14);
    // Sub-linear: 100 samples is not 10x the radius of 10 samples.
    expect(r100).toBeLessThan(r10 * 10);
  });

  it('handles non-finite input by falling back to the floor radius, not the ceiling', () => {
    // Non-finite is bad upstream data; defaulting to the smallest marker is the safe choice
    // (a giant marker would misrepresent an unknown count as the worst case).
    expect(markerRadiusForCount(Number.NaN)).toBe(5);
    expect(markerRadiusForCount(Number.POSITIVE_INFINITY)).toBe(5);
  });
});

describe('toAggregateMarkers', () => {
  it('emits Leaflet [lat, lng] order, not [lng, lat]', () => {
    const [m] = toAggregateMarkers([agg()]);
    expect(m.position).toEqual([49.2827, -123.1207]);
    // Guard the classic swap: latitude first, longitude second.
    expect(m.position[0]).toBe(49.2827);
    expect(m.position[1]).toBe(-123.1207);
  });

  it('carries counts and label through for the popup', () => {
    const [m] = toAggregateMarkers([
      agg({ sample_count_total: 476, sample_count_high: 1, sample_count_medium: 475, display_name: 'Old Slope Place' }),
    ]);
    expect(m.sample_count_total).toBe(476);
    expect(m.sample_count_high).toBe(1);
    expect(m.sample_count_medium).toBe(475);
    expect(m.label).toBe('Old Slope Place');
    expect(m.radius).toBe(14);
  });

  it('N=1 site produces exactly one marker at floor radius', () => {
    const markers = toAggregateMarkers([agg({ sample_count_total: 1, sample_count_medium: 1 })]);
    expect(markers).toHaveLength(1);
    expect(markers[0].radius).toBe(5);
  });

  it('476 samples collapse to ONE marker, never 476', () => {
    const markers = toAggregateMarkers([agg({ sample_count_total: 476, sample_count_medium: 476 })]);
    expect(markers).toHaveLength(1);
  });

  it('uses aggregate_id as the stable key', () => {
    const [m] = toAggregateMarkers([agg()]);
    expect(m.key).toBe('dra-1:49.28270,-123.12070');
  });

  it('skips aggregates with a non-finite representative coordinate', () => {
    const markers = toAggregateMarkers([
      agg(),
      agg({ aggregate_id: 'x', representative_latitude: Number.NaN }),
      // The type says number, but defend against bad upstream data at runtime anyway.
      agg({ aggregate_id: 'y', representative_longitude: Infinity }),
    ]);
    expect(markers).toHaveLength(1);
  });

  it('returns an empty array for empty input', () => {
    expect(toAggregateMarkers([])).toEqual([]);
  });
});

describe('toAggregateMarkers -- containment', () => {
  const ALLOWED_KEYS = new Set<keyof AggregateMarker>([
    'key',
    'source_dra_id',
    'position',
    'label',
    'coordinate_quality_tier',
    'sample_count_total',
    'sample_count_high',
    'sample_count_medium',
    'radius',
  ]);

  it('emits exactly the allowlisted marker fields', () => {
    const [m] = toAggregateMarkers([agg()]);
    for (const k of Object.keys(m)) {
      expect(ALLOWED_KEYS.has(k as keyof AggregateMarker)).toBe(true);
    }
    expect(Object.keys(m).length).toBe(ALLOWED_KEYS.size);
  });

  it('exposes no per-sample, station, measurement, or raw-source field', () => {
    const serialised = JSON.stringify(toAggregateMarkers([agg()]));
    for (const forbidden of ['station_id', 'bnrrm_station_id', 'sample_id', 'measurement', 'geometry', 'coordinate_source', 'notes']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('marker count equals site count, never sample count', () => {
    const markers = toAggregateMarkers([
      agg({ aggregate_id: 'a', sample_count_total: 476 }),
      agg({ aggregate_id: 'b', source_dra_id: 'dra-2', representative_latitude: 50.1, sample_count_total: 9 }),
    ]);
    expect(markers).toHaveLength(2);
  });
});

describe('boundsForMarkers', () => {
  it('is null when there are no markers', () => {
    expect(boundsForMarkers([])).toBeNull();
  });

  it('covers all marker coordinates', () => {
    const markers = toAggregateMarkers([
      agg({ aggregate_id: 'a', representative_latitude: 49.0, representative_longitude: -123.0 }),
      agg({ aggregate_id: 'b', source_dra_id: 'd2', representative_latitude: 50.5, representative_longitude: -125.5 }),
      agg({ aggregate_id: 'c', source_dra_id: 'd3', representative_latitude: 48.4, representative_longitude: -124.2 }),
    ]);
    const b = boundsForMarkers(markers);
    expect(b).toEqual({ south: 48.4, west: -125.5, north: 50.5, east: -123.0 });
  });

  it('handles a single marker (degenerate bounds)', () => {
    const b = boundsForMarkers(toAggregateMarkers([agg()]));
    expect(b).toEqual({ south: 49.2827, west: -123.1207, north: 49.2827, east: -123.1207 });
  });
});
