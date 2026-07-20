import { describe, it, expect } from 'vitest';
import {
  computeSiteAggregates,
  summariseSiteAggregates,
  coordinateClusterId,
  COORDINATE_CLUSTER_PRECISION,
  type AggregateInputSample,
  type AggregateInputDra,
  type SiteAggregate,
} from '../siteAggregates';

const DRA_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const DRA_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const DRA_MISSING = 'cccccccc-0000-0000-0000-000000000003';

const dras: AggregateInputDra[] = [
  { id: DRA_A, title: 'Site A', public: false },
  { id: DRA_B, title: 'Site B', public: true },
];

function sample(over: Partial<AggregateInputSample> = {}): AggregateInputSample {
  return {
    source_dra_id: DRA_A,
    coordinate_quality_tier: 'medium',
    coordinate_source: 'bc-csr-centroid',
    latitude: 49.2827,
    longitude: -123.1207,
    ...over,
  };
}

/** Build N identical stacked samples, the real-world shape this design exists to fix. */
function stacked(n: number, over: Partial<AggregateInputSample> = {}): AggregateInputSample[] {
  return Array.from({ length: n }, () => sample(over));
}

describe('coordinateClusterId', () => {
  it('is deterministic and precision-bounded', () => {
    expect(coordinateClusterId(49.2827, -123.1207)).toBe('49.28270,-123.12070');
    expect(COORDINATE_CLUSTER_PRECISION).toBe(5);
  });

  it('collapses coordinates that differ below the precision floor', () => {
    // 49.282700001 and 49.2827 are the same physical point at 5 dp.
    expect(coordinateClusterId(49.282700001, -123.1207)).toBe(coordinateClusterId(49.2827, -123.1207));
  });

  it('separates coordinates that differ above the precision floor', () => {
    expect(coordinateClusterId(49.2827, -123.1207)).not.toBe(coordinateClusterId(49.2837, -123.1207));
  });
});

describe('computeSiteAggregates -- stacking (the core case)', () => {
  it('N=1: a single sample yields one aggregate of count 1', () => {
    const out = computeSiteAggregates([sample()], dras);
    expect(out).toHaveLength(1);
    expect(out[0].sample_count_total).toBe(1);
    expect(out[0].sample_count_medium).toBe(1);
    expect(out[0].distinct_point_count).toBe(1);
  });

  it('N=476: 476 coincident samples collapse to ONE marker, not 476', () => {
    // This is the worst real site (Old Slope Place). Rendering it per-sample would put
    // 476 pins on one coordinate; the whole point of Option C is that this is 1 marker.
    const out = computeSiteAggregates(stacked(476), dras);
    expect(out).toHaveLength(1);
    expect(out[0].sample_count_total).toBe(476);
    expect(out[0].distinct_point_count).toBe(1);
  });

  it('splits one DRA across clusters when coordinates genuinely differ', () => {
    // Future coordinate enrichment must produce multiple markers without a schema change.
    const out = computeSiteAggregates(
      [...stacked(3), ...stacked(2, { latitude: 50.1, longitude: -124.5 })],
      dras
    );
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.sample_count_total)).toEqual([3, 2]);
    expect(new Set(out.map((a) => a.coordinate_cluster_id)).size).toBe(2);
  });

  it('keeps distinct DRAs at the same coordinate as separate sites', () => {
    const out = computeSiteAggregates([sample(), sample({ source_dra_id: DRA_B })], dras);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((a) => a.source_dra_id))).toEqual(new Set([DRA_A, DRA_B]));
  });
});

describe('computeSiteAggregates -- mixed-tier counts', () => {
  it('counts each tier separately and totals correctly', () => {
    const out = computeSiteAggregates(
      [
        ...stacked(20, { coordinate_quality_tier: 'high' }),
        ...stacked(35, { coordinate_quality_tier: 'medium' }),
        ...stacked(2, { coordinate_quality_tier: 'low' }),
      ],
      dras
    );
    expect(out).toHaveLength(1);
    const a = out[0];
    expect(a.sample_count_high).toBe(20);
    expect(a.sample_count_medium).toBe(35);
    expect(a.sample_count_low).toBe(2);
    expect(a.sample_count_total).toBe(57);
  });

  it('tier counts always sum to the total (design acceptance criterion 2)', () => {
    const out = computeSiteAggregates(
      [
        ...stacked(7, { coordinate_quality_tier: 'high' }),
        ...stacked(11, { coordinate_quality_tier: 'medium' }),
        ...stacked(1, { coordinate_quality_tier: 'low' }),
        ...stacked(4, { coordinate_quality_tier: 'medium', source_dra_id: DRA_B }),
      ],
      dras
    );
    for (const a of out) {
      expect(a.sample_count_high + a.sample_count_medium + a.sample_count_low).toBe(a.sample_count_total);
    }
  });

  it('the tier filter is a fixed server-side choice, and it scopes which samples count', () => {
    const input = [
      ...stacked(20, { coordinate_quality_tier: 'high' }),
      ...stacked(35, { coordinate_quality_tier: 'medium' }),
    ];
    const medium = computeSiteAggregates(input, dras, { tier: 'medium' });
    expect(medium).toHaveLength(1);
    expect(medium[0].sample_count_total).toBe(35);
    expect(medium[0].sample_count_high).toBe(0);
  });

  it('reports the dominant tier deterministically on ties', () => {
    const out = computeSiteAggregates(
      [...stacked(5, { coordinate_quality_tier: 'high' }), ...stacked(5, { coordinate_quality_tier: 'medium' })],
      dras
    );
    // Equal counts must not flip between runs.
    expect(out[0].coordinate_quality_tier).toBe('high');
    const again = computeSiteAggregates(
      [...stacked(5, { coordinate_quality_tier: 'medium' }), ...stacked(5, { coordinate_quality_tier: 'high' })],
      dras
    );
    expect(again[0].coordinate_quality_tier).toBe('high');
  });
});

describe('computeSiteAggregates -- exclusions', () => {
  it('excludes orphans (source_dra_id null) entirely', () => {
    const out = computeSiteAggregates([...stacked(3), ...stacked(8, { source_dra_id: null })], dras);
    expect(out).toHaveLength(1);
    expect(out[0].sample_count_total).toBe(3);
    // No aggregate may carry a null-DRA key.
    expect(out.every((a) => a.source_dra_id !== null && a.source_dra_id !== 'null')).toBe(true);
  });

  it('excludes samples whose DRA is not present', () => {
    const out = computeSiteAggregates([...stacked(2), ...stacked(9, { source_dra_id: DRA_MISSING })], dras);
    expect(out).toHaveLength(1);
    expect(out[0].source_dra_id).toBe(DRA_A);
  });

  it('excludes samples without a usable finite coordinate', () => {
    const out = computeSiteAggregates(
      [
        ...stacked(4),
        sample({ latitude: null }),
        sample({ longitude: null }),
        sample({ latitude: Number.NaN }),
        sample({ longitude: Number.POSITIVE_INFINITY }),
      ],
      dras
    );
    expect(out).toHaveLength(1);
    expect(out[0].sample_count_total).toBe(4);
  });

  it('returns an empty array for empty input rather than throwing', () => {
    expect(computeSiteAggregates([], dras)).toEqual([]);
    expect(computeSiteAggregates([sample()], [])).toEqual([]);
  });
});

describe('computeSiteAggregates -- containment (no per-sample data escapes)', () => {
  const ALLOWED_KEYS = new Set<keyof SiteAggregate>([
    'aggregate_id',
    'source_dra_id',
    'coordinate_cluster_id',
    'display_name',
    'dra_public',
    'representative_latitude',
    'representative_longitude',
    'coordinate_quality_tier',
    'coordinate_source',
    'sample_count_total',
    'sample_count_high',
    'sample_count_medium',
    'sample_count_low',
    'distinct_point_count',
  ]);

  it('emits exactly the allowlisted fields and nothing else', () => {
    const out = computeSiteAggregates(stacked(5), dras);
    for (const a of out) {
      for (const k of Object.keys(a)) {
        expect(ALLOWED_KEYS.has(k as keyof SiteAggregate)).toBe(true);
      }
      expect(Object.keys(a).length).toBe(ALLOWED_KEYS.size);
    }
  });

  it('exposes no per-sample, station, or measurement identifier under any key', () => {
    const out = computeSiteAggregates(stacked(5), dras);
    const serialised = JSON.stringify(out);
    for (const forbidden of ['station_id', 'bnrrm_station_id', 'sample_id', 'measurement', 'geometry', 'notes']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('output row count reveals site count, never sample count', () => {
    // 476 samples must not produce 476 rows -- that would leak per-sample cardinality
    // into the response shape itself.
    const out = computeSiteAggregates(stacked(476), dras);
    expect(out).toHaveLength(1);
  });
});

describe('computeSiteAggregates -- determinism', () => {
  it('is order-independent', () => {
    const input = [
      ...stacked(3),
      ...stacked(5, { source_dra_id: DRA_B }),
      ...stacked(2, { latitude: 50.5, longitude: -125.5 }),
    ];
    const a = computeSiteAggregates(input, dras);
    const b = computeSiteAggregates([...input].reverse(), dras);
    expect(a).toEqual(b);
  });

  it('sorts by sample_count_total desc then aggregate_id asc', () => {
    const out = computeSiteAggregates(
      [...stacked(2), ...stacked(9, { source_dra_id: DRA_B })],
      dras
    );
    expect(out.map((x) => x.sample_count_total)).toEqual([9, 2]);
  });

  it('representative coordinate is stable and rounded to the cluster precision', () => {
    const out = computeSiteAggregates(stacked(3, { latitude: 49.282700001, longitude: -123.120700001 }), dras);
    expect(out[0].representative_latitude).toBeCloseTo(49.2827, 5);
    expect(out[0].representative_longitude).toBeCloseTo(-123.1207, 5);
  });

  it('reports multiple coordinate sources explicitly instead of silently choosing one', () => {
    const out = computeSiteAggregates(
      [sample({ coordinate_source: 'src-b' }), sample({ coordinate_source: 'src-a' })],
      dras
    );
    expect(out[0].coordinate_source).toBe('src-a; src-b');
  });
});

describe('summariseSiteAggregates', () => {
  it('rolls up counts, median, and the stacking-hazard indicators', () => {
    const aggregates = computeSiteAggregates(
      [
        ...stacked(476),
        ...stacked(9, { source_dra_id: DRA_B }),
        ...stacked(1, { latitude: 50.5, longitude: -125.5 }),
      ],
      dras
    );
    const s = summariseSiteAggregates(aggregates);
    expect(s.site_count).toBe(3);
    expect(s.sample_count_total).toBe(486);
    expect(s.max_samples_at_one_site).toBe(476);
    expect(s.median_samples_per_site).toBe(9);
    expect(s.sites_with_100_plus).toBe(1);
    expect(s.sites_with_single_sample).toBe(1);
  });

  it('handles the empty case without dividing by zero', () => {
    const s = summariseSiteAggregates([]);
    expect(s.site_count).toBe(0);
    expect(s.median_samples_per_site).toBe(0);
    expect(s.max_samples_at_one_site).toBe(0);
  });

  it('averages the two middle values for an even site count', () => {
    const aggregates = computeSiteAggregates(
      [
        ...stacked(2),
        ...stacked(4, { source_dra_id: DRA_B }),
        ...stacked(6, { latitude: 50.5, longitude: -125.5 }),
        ...stacked(8, { source_dra_id: DRA_B, latitude: 51.5, longitude: -126.5 }),
      ],
      dras
    );
    expect(summariseSiteAggregates(aggregates).median_samples_per_site).toBe(5);
  });
});
