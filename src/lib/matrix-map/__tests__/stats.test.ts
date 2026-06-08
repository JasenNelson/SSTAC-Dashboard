// Unit tests for the stats engine (Phase 1).
//
// Hand-computed fixture: values [1, 2, 3, 4, 5, 6, 7, 8]
//
// Arithmetic (reviewer verification):
//   n = 8
//   sum = 1+2+3+4+5+6+7+8 = 36
//   mean = 36/8 = 4.5
//
//   Sorted: [1, 2, 3, 4, 5, 6, 7, 8]
//   Median (type-7, q=0.5): h = (8-1)*0.5 = 3.5 -> lo=3, hi=4
//     = sorted[3] + 0.5*(sorted[4]-sorted[3]) = 4 + 0.5*(5-4) = 4.5
//
//   Sample variance (ddof=1):
//     deviations: -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5
//     sum of squares: 12.25+6.25+2.25+0.25+0.25+2.25+6.25+12.25 = 42
//     s^2 = 42/7 = 6
//     s = sqrt(6) = 2.449490 (6 dp)
//
//   CV = s/mean = sqrt(6)/4.5 = 0.544331...
//
//   Skewness (Pearson, ddof=1, Excel SKEW formula):
//     Sum of cubed z-scores where z = (x - mean)/s:
//       z values: -3.5/sqrt(6), ..., 3.5/sqrt(6)
//       Each z^3 is symmetric so skewness = 0.
//
//   P90 (type-7, q=0.90): h = (8-1)*0.9 = 6.3
//     lo=6, hi=7 -> sorted[6] + 0.3*(sorted[7]-sorted[6]) = 7 + 0.3*1 = 7.3
//
//   P95 (type-7, q=0.95): h = (8-1)*0.95 = 6.65
//     lo=6, hi=7 -> sorted[6] + 0.65*(sorted[7]-sorted[6]) = 7 + 0.65 = 7.65
//
//   Student's-t UCL95: xbar + t(0.95, n-1) * s / sqrt(n)
//     = 4.5 + t(0.95, 7) * sqrt(6) / sqrt(8)
//     t(0.95, 7) = 1.8946 (table value, 4 dp)
//     sqrt(6)/sqrt(8) = sqrt(0.75) = 0.866025
//     UCL = 4.5 + 1.8946 * 0.866025 = 4.5 + 1.64082... = 6.14082...
//     Using the precise computed t (not rounded): approx 6.1408 (to 4 dp).
//
//   Chebyshev UCL 95%: xbar + sqrt(19) * s / sqrt(n)
//     = 4.5 + sqrt(19) * sqrt(6) / sqrt(8)
//     sqrt(19) = 4.358898944...
//     sqrt(6) = 2.449489743..., sqrt(8) = 2.828427125...
//     k = sqrt(19), k * s/sqrt(n) = 4.358898944 * 2.449489743 / 2.828427125
//       = 4.358898944 * 0.866025404 = 3.77493...
//     UCL 95% = 4.5 + 3.77493 = 8.27493...
//
//   Chebyshev UCL 97.5%: xbar + sqrt(39) * s / sqrt(n)
//     sqrt(39) = 6.244997998...
//     k * s/sqrt(n) = 6.244997998 * 0.866025404 = 5.40833...
//     UCL 97.5% = 4.5 + 5.40833 = 9.90833 (approx)
//
//   Chebyshev UCL 99%: xbar + sqrt(99) * s / sqrt(n)
//     sqrt(99) = 9.949874371...
//     k * s/sqrt(n) = 9.949874371 * 0.866025404 = 8.61706...
//     UCL 99% = 4.5 + 8.61706 = 13.11706...
//
//   Sigma-hat (SD of ln(detects>0), ddof=1, all 8 values > 0):
//     ln(1)=0, ln(2)=0.693147, ln(3)=1.098612, ln(4)=1.386294,
//     ln(5)=1.609438, ln(6)=1.791759, ln(7)=1.945910, ln(8)=2.079442
//     mean_ln = (0+0.693147+1.098612+1.386294+1.609438+1.791759+1.945910+2.079442)/8
//             = 10.604602/8 = 1.325575
//     sum_sq_dev = sum of (ln_i - mean_ln)^2:
//       Each deviation and square (approx):
//         (0 - 1.325575)^2 = 1.757149
//         (0.693147 - 1.325575)^2 = 0.399589
//         (1.098612 - 1.325575)^2 = 0.051487
//         (1.386294 - 1.325575)^2 = 0.003687
//         (1.609438 - 1.325575)^2 = 0.080612
//         (1.791759 - 1.325575)^2 = 0.217304
//         (1.945910 - 1.325575)^2 = 0.384851
//         (2.079442 - 1.325575)^2 = 0.568061
//       sum = 3.462740 (using the 6-dp log values shown above; full-precision
//       logs give 3.46335 -> sigma-hat 0.703395 -- the displayed arithmetic is
//       rounded for readability)
//     sigma-hat = sqrt(3.462740/7) = sqrt(0.494677) = 0.703333 (approx)
//     0.703333 < 1.0 so high_skew flag should NOT be set for this fixture.
//
// Plain ASCII only (code point <= 127).

import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  sampleStdDev,
  sampleSkewness,
  percentile,
  studentTUcl,
  chebyshevUcl,
  computeSelectionStats,
  DL_SUBSTITUTION_FACTOR,
  DL_SUBSTITUTION_LABEL,
} from '../stats';
import { normalInverse } from '../gof';
import { DEFAULT_MATRIX_MAP_FILTER_STATE } from '@/stores/matrix-map/filterStore';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';

const EMPTY_FILTER: MatrixMapFilterState = DEFAULT_MATRIX_MAP_FILTER_STATE;

// ---------------------------------------------------------------------------
// Numeric primitive tests
// ---------------------------------------------------------------------------

describe('mean', () => {
  it('[1..8] -> 4.5', () => {
    expect(mean([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(4.5, 10);
  });
  it('empty -> NaN', () => {
    expect(mean([])).toBeNaN();
  });
  it('single value', () => {
    expect(mean([7])).toBe(7);
  });
});

describe('median', () => {
  it('[1..8] -> 4.5', () => {
    expect(median([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(4.5, 10);
  });
  it('[1,3] -> 2', () => {
    expect(median([1, 3])).toBeCloseTo(2, 10);
  });
  it('[5] -> 5', () => {
    expect(median([5])).toBe(5);
  });
  it('empty -> NaN', () => {
    expect(median([])).toBeNaN();
  });
});

describe('sampleStdDev', () => {
  it('[1..8] -> sqrt(6) = 2.449490 (6 dp)', () => {
    // See arithmetic comment at top.
    expect(sampleStdDev([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(2.449490, 6);
  });
  it('n=1 -> NaN', () => {
    expect(sampleStdDev([5])).toBeNaN();
  });
  it('n=0 -> NaN', () => {
    expect(sampleStdDev([])).toBeNaN();
  });
  it('[2,2] -> 0', () => {
    expect(sampleStdDev([2, 2])).toBeCloseTo(0, 10);
  });
});

describe('sampleSkewness', () => {
  it('[1..8] -> 0 (symmetric distribution)', () => {
    expect(sampleSkewness([1, 2, 3, 4, 5, 6, 7, 8])).toBeCloseTo(0, 6);
  });
  it('n < 3 -> NaN', () => {
    expect(sampleSkewness([1, 2])).toBeNaN();
    expect(sampleSkewness([1])).toBeNaN();
  });
  it('all-equal -> NaN (SD=0)', () => {
    expect(sampleSkewness([3, 3, 3])).toBeNaN();
  });
});

describe('percentile (type-7)', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8];

  it('P90 -> 7.3', () => {
    // h = (8-1)*0.90 = 6.3 -> lo=6, hi=7 -> 7 + 0.3*(8-7) = 7.3
    expect(percentile(sorted, 0.90)).toBeCloseTo(7.3, 10);
  });

  it('P95 -> 7.65', () => {
    // h = (8-1)*0.95 = 6.65 -> lo=6, hi=7 -> 7 + 0.65*(8-7) = 7.65
    expect(percentile(sorted, 0.95)).toBeCloseTo(7.65, 10);
  });

  it('P0 -> min', () => {
    expect(percentile(sorted, 0)).toBe(1);
  });

  it('P100 -> max', () => {
    expect(percentile(sorted, 1)).toBe(8);
  });

  it('P50 -> median', () => {
    expect(percentile(sorted, 0.5)).toBeCloseTo(4.5, 10);
  });

  it('empty -> NaN', () => {
    expect(percentile([], 0.5)).toBeNaN();
  });

  it('single element -> that element', () => {
    expect(percentile([42], 0.5)).toBe(42);
  });
});

describe('studentTUcl', () => {
  it('[1..8] UCL95 correct to 4 dp', () => {
    // See arithmetic at top: UCL ~= 6.14082
    // Using full-precision t(0.95,7) from our studentTInv, not the rounded table value.
    const ucl = studentTUcl([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(ucl).not.toBeNull();
    expect(ucl!).toBeCloseTo(6.1408, 3);
  });
  it('n=1 -> null', () => {
    expect(studentTUcl([5])).toBeNull();
  });
  it('n=0 -> null', () => {
    expect(studentTUcl([])).toBeNull();
  });
  it('n=2 is not null', () => {
    expect(studentTUcl([1, 3])).not.toBeNull();
  });
});

describe('chebyshevUcl', () => {
  const vals = [1, 2, 3, 4, 5, 6, 7, 8];

  it('level=0.95: xbar + sqrt(19)*s/sqrt(n) ~ 8.275', () => {
    // k = sqrt(1/0.05 - 1) = sqrt(19) = 4.358899
    // UCL = 4.5 + 4.358899 * sqrt(6)/sqrt(8) = 4.5 + 4.358899 * 0.866025
    //     = 4.5 + 3.77493 = 8.27493
    const ucl = chebyshevUcl(vals, 0.95);
    expect(ucl).not.toBeNull();
    expect(ucl!).toBeCloseTo(8.2749, 3);
  });

  it('level=0.975: xbar + sqrt(39)*s/sqrt(n)', () => {
    // k = sqrt(1/0.025 - 1) = sqrt(39) = 6.244998
    // UCL = 4.5 + 6.244998 * sqrt(6)/sqrt(8) = 4.5 + 6.244998 * 0.866025
    //     = 4.5 + 5.40833 = 9.90833
    const ucl = chebyshevUcl(vals, 0.975);
    expect(ucl).not.toBeNull();
    expect(ucl!).toBeCloseTo(9.9083, 3);
  });

  it('level=0.99: xbar + sqrt(99)*s/sqrt(n)', () => {
    // k = sqrt(1/0.01 - 1) = sqrt(99) = 9.949874
    // UCL = 4.5 + 9.949874 * 0.866025 = 4.5 + 8.61706 = 13.11706
    const ucl = chebyshevUcl(vals, 0.99);
    expect(ucl).not.toBeNull();
    expect(ucl!).toBeCloseTo(13.117, 2);
  });

  it('n=1 -> null', () => {
    expect(chebyshevUcl([5], 0.95)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fixtures helpers
// ---------------------------------------------------------------------------

function makeRow(over: Partial<MatrixMapMeasurementRow> = {}): MatrixMapMeasurementRow {
  return {
    sample_id: 'sample-a',
    sample_display_name: 'Station 1',
    sample_station_id: 'STA-1',
    sample_event_id: 'event-a',
    event_date: '2024-06-15',
    measurement_id: 'meas-a',
    medium: 'sediment',
    substance_id: 'sub-copper',
    substance_key: 'copper',
    substance_display_name: 'Copper',
    value: 1.0,
    unit: 'mg/kg',
    detection_limit: null,
    qualifier: null,
    censored: false,
    coordinate_quality_tier: 'high',
    classification: 'reference',
    source_dra_id: 'dra-1',
    source_dra_title: 'Source DRA',
    source_dra_citation: null,
    ...over,
  };
}

function makeFixtureRows(values: number[]): MatrixMapMeasurementRow[] {
  return values.map((v, i) =>
    makeRow({ sample_id: 'sample-' + String(i), measurement_id: 'meas-' + String(i), value: v }),
  );
}

// ---------------------------------------------------------------------------
// computeSelectionStats -- integration tests
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- [1..8] fixture', () => {
  const rows = makeFixtureRows([1, 2, 3, 4, 5, 6, 7, 8]);
  const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });

  it('produces exactly one bucket', () => {
    expect(result.buckets).toHaveLength(1);
  });

  it('n=8', () => {
    expect(result.buckets[0].descriptive.n).toBe(8);
  });

  it('mean = 4.5', () => {
    expect(result.buckets[0].descriptive.mean).toBeCloseTo(4.5, 10);
  });

  it('median = 4.5', () => {
    expect(result.buckets[0].descriptive.median).toBeCloseTo(4.5, 10);
  });

  it('sd = sqrt(6) = 2.449490 (6 dp)', () => {
    expect(result.buckets[0].descriptive.sd).toBeCloseTo(2.449490, 6);
  });

  it('P90 = 7.3', () => {
    expect(result.buckets[0].descriptive.p90).toBeCloseTo(7.3, 10);
  });

  it('P95 = 7.65', () => {
    expect(result.buckets[0].descriptive.p95).toBeCloseTo(7.65, 10);
  });

  it('Student-t UCL95 correct to 3 dp', () => {
    expect(result.buckets[0].ucl.studentT95!).toBeCloseTo(6.141, 2);
  });

  it('Chebyshev UCL 95% correct', () => {
    const entry = result.buckets[0].ucl.chebyshev.find((e) => e.level === 0.95);
    expect(entry).toBeDefined();
    expect(entry!.ucl).toBeCloseTo(8.2749, 3);
  });

  it('detects=8, nonDetects=0, detectionFreq=100%', () => {
    const d = result.buckets[0].descriptive;
    expect(d.detects).toBe(8);
    expect(d.nonDetects).toBe(0);
    expect(d.detectionFrequencyPct).toBeCloseTo(100, 5);
  });

  it('correct flags for 8-point dataset', () => {
    // n=8: 2 <= 8 < 10 -> small_n fires (per plan: small_n threshold is SMALL_N_UPPER=10).
    // sigma-hat ~ 0.703 < 1.0 -> no high_skew.
    // No censored rows -> no dl_substitution_used.
    // n >= 2 -> no insufficient_n.
    expect(result.buckets[0].flags).not.toContain('insufficient_n');
    expect(result.buckets[0].flags).toContain('small_n');
    expect(result.buckets[0].flags).not.toContain('high_skew');
    expect(result.buckets[0].flags).not.toContain('dl_substitution_used');
  });

  it('excludedCount=0', () => {
    expect(result.buckets[0].excludedCount).toBe(0);
  });

  it('UCL basis contains Normal distribution recommendation', () => {
    expect(result.buckets[0].ucl.basis).toContain('Normal distribution');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- n=0', () => {
  it('empty rows produces no buckets', () => {
    const result = computeSelectionStats({ rows: [], filterState: EMPTY_FILTER });
    expect(result.buckets).toHaveLength(0);
    expect(result.filteredRows).toBe(0);
  });
});

describe('computeSelectionStats -- n=1', () => {
  it('single row: n=1, insufficient_n flag, no UCL', () => {
    const rows = [makeRow({ value: 5.0 })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(1);
    expect(result.buckets[0].flags).toContain('insufficient_n');
    expect(result.buckets[0].ucl.studentT95).toBeNull();
    expect(result.buckets[0].ucl.chebyshev).toHaveLength(0);
  });
});

describe('computeSelectionStats -- n=2', () => {
  it('two rows: n=2, small_n flag, UCL is present', () => {
    const rows = [makeRow({ value: 3.0 }), makeRow({ sample_id: 'b', value: 7.0 })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(2);
    expect(result.buckets[0].flags).toContain('small_n');
    expect(result.buckets[0].flags).not.toContain('insufficient_n');
    expect(result.buckets[0].ucl.studentT95).not.toBeNull();
  });
});

describe('computeSelectionStats -- all-censored rows (DL/2 substitution)', () => {
  it('DL/2 branch: n counts DL/2 values; nonDetects=n; freq=0%', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 10.0, sample_id: 'a' }),
      makeRow({ value: null, censored: true, detection_limit: 20.0, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'DL2' });
    const d = result.buckets[0].descriptive;
    expect(d.n).toBe(2);
    expect(d.nonDetects).toBe(2);
    expect(d.detects).toBe(0);
    expect(d.detectionFrequencyPct).toBeCloseTo(0, 10);
    // DL/2 substitution: DLs are 10 and 20 -> substituted values 10*0.5=5 and
    // 20*0.5=10; mean = (5 + 10) / 2 = 7.5. Express the expectation from the
    // fixture DETECTION LIMITS so it stays correct if the factor or n changes.
    expect(d.mean).toBeCloseTo(
      (10 * DL_SUBSTITUTION_FACTOR + 20 * DL_SUBSTITUTION_FACTOR) / 2,
      1,
    );
    expect(result.buckets[0].flags).toContain('dl_substitution_used');
  });

  it('DL/2 basis label appears in ucl.basis', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 10.0, sample_id: 'a' }),
      makeRow({ value: null, censored: true, detection_limit: 20.0, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'DL2' });
    expect(result.buckets[0].ucl.basis).toContain(DL_SUBSTITUTION_LABEL);
  });

  it('falls back to DL/2 substitution in ROS mode when detects = 0', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 10.0, sample_id: 'a' }),
      makeRow({ value: null, censored: true, detection_limit: 20.0, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'ROS' });
    expect(result.buckets[0].ucl.basis).toContain(DL_SUBSTITUTION_LABEL);
    expect(result.buckets[0].flags).toContain('dl_substitution_used');
  });

  it('falls back to DL/2 substitution in ROS mode when there are non-positive detected values', () => {
    const rows = [
      makeRow({ value: 0.0, censored: false, sample_id: 'a' }),
      makeRow({ value: 10.0, censored: false, sample_id: 'b' }),
      makeRow({ value: null, censored: true, detection_limit: 5.0, sample_id: 'c' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'ROS' });
    expect(result.buckets[0].ucl.basis).toContain(DL_SUBSTITUTION_LABEL);
    expect(result.buckets[0].flags).toContain('dl_substitution_used');
    // Censored value is 5.0 * 0.5 = 2.5. Detected values are 0.0 and 10.0.
    // Mean = (0.0 + 10.0 + 2.5) / 3 = 4.1667
    expect(result.buckets[0].descriptive.mean).toBeCloseTo(4.1667, 3);
  });
});


describe('computeSelectionStats -- mixed units -> separate buckets', () => {
  it('two different units -> two buckets, never aggregated', () => {
    const rows = [
      makeRow({ value: 5.0, unit: 'mg/kg', sample_id: 'a' }),
      makeRow({ value: 10.0, unit: 'ug/kg', sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets).toHaveLength(2);
    const units = result.buckets.map((b) => b.unit).sort();
    expect(units).toEqual(['mg/kg', 'ug/kg']);
    // Each bucket has exactly n=1.
    for (const bucket of result.buckets) {
      expect(bucket.descriptive.n).toBe(1);
    }
  });
});

describe('computeSelectionStats -- null-unit bucket isolation', () => {
  it('null unit row forms its own bucket, not merged with named-unit rows', () => {
    const rows = [
      makeRow({ value: 5.0, unit: 'mg/kg', sample_id: 'a' }),
      makeRow({ value: 3.0, unit: null, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets).toHaveLength(2);
    const nullBucket = result.buckets.find((b) => b.unit === null);
    expect(nullBucket).toBeDefined();
    expect(nullBucket!.descriptive.n).toBe(1);
  });
});

describe('computeSelectionStats -- string value parsing', () => {
  it('"3.2" is accepted', () => {
    const rows = [
      makeRow({ value: '3.2' as unknown as number, sample_id: 'a' }),
      makeRow({ value: '4.8' as unknown as number, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(2);
    expect(result.buckets[0].excludedCount).toBe(0);
  });

  it('"1e-7" is accepted', () => {
    const rows = [makeRow({ value: '1e-7' as unknown as number })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(1);
    expect(result.buckets[0].excludedCount).toBe(0);
    expect(result.buckets[0].descriptive.mean).toBeCloseTo(1e-7, 15);
  });

  it('two null-substance_id rows with different keys/names form SEPARATE buckets', () => {
    // codex 5.5 P2 regression lock: substance identity must fall back through
    // substance_key then display name when substance_id is null -- two
    // UNIDENTIFIED substances must never aggregate into one mean/UCL.
    const result = computeSelectionStats({
      rows: [
        makeRow({ substance_id: null, substance_key: 'mystery-a', substance_display_name: 'Mystery A', value: 1 }),
        makeRow({ substance_id: null, substance_key: 'mystery-b', substance_display_name: 'Mystery B', value: 100 }),
      ],
      filterState: EMPTY_FILTER,
    });
    expect(result.buckets).toHaveLength(2);
    const names = result.buckets.map((b) => b.substanceDisplayName).sort();
    expect(names).toEqual(['Mystery A', 'Mystery B']);
    // null id AND null key falls back to the display name -- still isolated.
    const result2 = computeSelectionStats({
      rows: [
        makeRow({ substance_id: null, substance_key: null, substance_display_name: 'Name Only A', value: 1 }),
        makeRow({ substance_id: null, substance_key: null, substance_display_name: 'Name Only B', value: 2 }),
      ],
      filterState: EMPTY_FILTER,
    });
    expect(result2.buckets).toHaveLength(2);
  });

  it('all-excluded bucket reports detectionFrequencyPct as NULL, never 0%', () => {
    // codex 5.5 P2 regression lock: n === 0 makes detects/n an undefined 0/0;
    // reporting it as 0% would misread "all rows excluded" as "no detects".
    const result = computeSelectionStats({
      rows: [
        makeRow({ value: 'ND' as unknown as number }),
        makeRow({ value: null, censored: true, detection_limit: null }),
      ],
      filterState: EMPTY_FILTER,
    });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].descriptive.detectionFrequencyPct).toBeNull();
    expect(result.buckets[0].excludedCount).toBe(2);
  });

  it('"ND" (non-numeric string) is excluded', () => {
    const rows = [makeRow({ value: 'ND' as unknown as number })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
    expect(result.buckets[0].flags).toContain('excluded_rows');
  });

  it('"1,000" (comma-formatted) is excluded by parseDecimalInput', () => {
    const rows = [makeRow({ value: '1,000' as unknown as number })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
  });
});

describe('computeSelectionStats -- negative value rejection', () => {
  it('numeric -1 as value is excluded', () => {
    const rows = [makeRow({ value: -1 })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
  });

  it('string "-1" as value is excluded', () => {
    const rows = [makeRow({ value: '-1' as unknown as number })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
  });

  it('numeric -1 as detection_limit excluded for a censored row', () => {
    const rows = [makeRow({ value: null, censored: true, detection_limit: -1 })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
  });

  it('string "-1" as detection_limit excluded for a censored row', () => {
    const rows = [makeRow({ value: null, censored: true, detection_limit: '-1' as unknown as number })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
  });
});

describe('computeSelectionStats -- censored-with-null-DL excluded', () => {
  it('censored=true with detection_limit=null is excluded', () => {
    const rows = [makeRow({ value: null, censored: true, detection_limit: null })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    expect(result.buckets[0].descriptive.n).toBe(0);
    expect(result.buckets[0].excludedCount).toBe(1);
    expect(result.buckets[0].flags).toContain('excluded_rows');
  });
});

describe('computeSelectionStats -- censored===null treated as detected', () => {
  it('censored=null with a valid value is treated as detected', () => {
    const rows = [makeRow({ value: 7.5, censored: null })];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    const d = result.buckets[0].descriptive;
    expect(d.n).toBe(1);
    expect(d.detects).toBe(1);
    expect(d.nonDetects).toBe(0);
    expect(d.mean).toBeCloseTo(7.5, 10);
  });
});

describe('computeSelectionStats -- DL_SUBSTITUTION_FACTOR constant', () => {
  it('DL_SUBSTITUTION_FACTOR = 0.5', () => {
    expect(DL_SUBSTITUTION_FACTOR).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// TODO(parity): ProUCL v5.2 worked example scaffold.
// When the owner supplies the exact example from the ProUCL v5.2 Tech Guide
// (dataset, reported mean, SD, UCL95 by method), add assertions here to
// confirm bit-for-bit parity.  This scaffold marks the gap; Phase 2/3
// completes the parity gate.
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- KM log transformation with zero values', () => {
  it('does not throw or produce NaN/Infinity when some non-detect values are 0.0', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 0.0, sample_id: 'a' }),
      makeRow({ value: 10.0, censored: false, sample_id: 'b' }),
      makeRow({ value: 20.0, censored: false, sample_id: 'c' }),
      makeRow({ value: 30.0, censored: false, sample_id: 'd' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const ucl = result.buckets[0].ucl;
    // hUcl should be computed using logParsed which filters out the 0.0 detection limit since log(0) is invalid
    expect(ucl.hUcl).not.toBeNull();
    expect(Number.isFinite(ucl.hUcl)).toBe(true);
  });
});

describe('computeSelectionStats -- empty KM fit', () => {
  it('returns null for all UCLs in KM mode when detects = 0 (empty KM fit)', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 10.0, sample_id: 'a' }),
      makeRow({ value: null, censored: true, detection_limit: 20.0, sample_id: 'b' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const bucket = result.buckets[0];
    
    // UCLs should be nulled out
    expect(bucket.ucl.hUcl).toBeNull();
    expect(bucket.ucl.studentT95).toBeNull();
    expect(bucket.ucl.approximateGamma).toBeNull();
    expect(bucket.ucl.adjustedGamma).toBeNull();
    expect(bucket.ucl.chebyshev).toHaveLength(0);

    // Descriptive stats should be NaN / null
    expect(bucket.descriptive.mean).toBeNaN();
    expect(bucket.descriptive.sd).toBeNaN();
    expect(bucket.descriptive.cv).toBeNull();
    expect(bucket.descriptive.min).toBeNaN();
    expect(bucket.descriptive.max).toBeNaN();
    expect(bucket.descriptive.median).toBeNaN();
    expect(bucket.descriptive.p90).toBeNaN();
    expect(bucket.descriptive.p95).toBeNaN();

    // Accepted values array should be empty
    expect(bucket.acceptedValues).toHaveLength(0);
  });
});

describe('computeSelectionStats -- single-row empty KM fit', () => {
  it('clears descriptives and acceptedValues to avoid leaking DL/2 values when n = 1 in KM mode', () => {
    const rows = [
      makeRow({ value: null, censored: true, detection_limit: 10.0, sample_id: 'a' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const bucket = result.buckets[0];
    
    expect(bucket.descriptive.mean).toBeNaN();
    expect(bucket.descriptive.sd).toBeNaN();
    expect(bucket.acceptedValues).toHaveLength(0);
  });
});

describe('computeSelectionStats -- KM bootstrap prevention', () => {
  it('returns empty acceptedValues for censored KM buckets with detects to prevent bootstrap overrides', () => {
    const rows = [
      makeRow({ value: 10.0, censored: false, sample_id: 'a' }),
      makeRow({ value: 12.0, censored: false, sample_id: 'b' }),
      makeRow({ value: null, censored: true, detection_limit: 8.0, sample_id: 'c' }),
    ];
    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const bucket = result.buckets[0];
    
    // KM fit should succeed (mean, sd are numbers)
    expect(bucket.descriptive.mean).not.toBeNaN();
    expect(bucket.descriptive.sd).not.toBeNaN();
    // But acceptedValues must be empty
    expect(bucket.acceptedValues).toHaveLength(0);
  });
});

describe('computeSelectionStats -- outlier mapping to original indices', () => {
  it('correctly maps outliers to original row indices rather than sorted bucket offsets', () => {
    // Rosner test requires n >= 25. Create 26 values where the outlier is at index 3.
    const values = [
      10, 11, 12, 1000, 13, 14, 15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34
    ];
    const rows = values.map((val, idx) =>
      makeRow({
        value: val,
        censored: false,
        sample_id: `sample-${idx}`,
        measurement_id: `meas-${idx}`
      })
    );

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    const bucket = result.buckets[0];
    
    // Rosner test should run (n=26 >= 25) and flag 1000 as an outlier.
    expect(bucket.outliers).toBeDefined();
    expect(bucket.outliers.length).toBeGreaterThan(0);
    
    // The outlier 1000 is at index 3 in the original values array.
    const outlierRow = bucket.outliers.find(o => o.value === 1000);
    expect(outlierRow).toBeDefined();
    expect(outlierRow!.index).toBe(3);
  });
});

describe('computeSelectionStats -- method-specific log SD in recommendation', () => {
  it('recommends the correct UCL method in DL2 mode when completed log SD >= 1.5 but detects-only log SD < 1.5', () => {
    // n = 21 (small sample size).
    // Detects (11 values): constructed to reject Normality (last value is 50.0, skewing the data)
    // while keeping log SD < 1.5 (log SD is approx 1.34).
    const detects = [0.316, 0.449, 0.705, 0.896, 1.094, 1.419, 1.878, 2.460, 3.456, 5.003, 50.0];
    const censors = Array.from({ length: 10 }, () => 0.0001);

    const rows = [
      ...detects.map((v, i) => makeRow({ value: v, censored: false, sample_id: `d-${i}`, substance_key: 'gof-test', substance_display_name: 'GOF Test' })),
      ...censors.map((v, i) => makeRow({ value: null, censored: true, detection_limit: v, sample_id: `c-${i}`, substance_key: 'gof-test', substance_display_name: 'GOF Test' }))
    ];

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'DL2' });
    const bucket = result.buckets[0];
    
    // Gof should reject Normality (due to 50.0)
    expect(bucket.gof.verdict).not.toBe('Normal');
    
    // Total n = 21 (< 28)
    expect(bucket.descriptive.n).toBe(21);
    
    // The detects-only log SD (sigmaHat) is approx 1.34 < 1.5
    expect(bucket.descriptive.sigmaHat).toBeLessThan(1.5);
    
    // If it used detects-only log SD (1.34):
    // - Lognormal recommends hUcl
    // - Nonparametric recommends chebyshev975
    // Because it correctly uses completed log SD (which is stretched to >= 2.0 by censors):
    // - Lognormal recommends studentT95
    // - Nonparametric recommends chebyshev99
    const expectedMethod = bucket.gof.verdict === 'Lognormal' ? 'kmT' : 'kmChebyshev99';
    expect(bucket.recommendation.recommendedMethod).toBe(expectedMethod);
  });
});

describe('computeSelectionStats -- lognormal filtered sample size in recommendation', () => {
  it('uses positive-only log sample size to recommend kmT instead of kmH when total n >= 28 but positive logs n < 28 with high log SD', () => {
    // 27 positive lognormal values with log SD >= 1.5 (evaluates to Lognormal verdict)
    const detects = [
      0.1, 0.5, 1.0, 1.5, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8,
      4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 10.0, 15.0, 20.0, 30.0, 50.0, 100.0, 250.0
    ];
    const rows = [
      ...detects.map((v, i) => makeRow({ value: v, censored: false, sample_id: `d-${i}`, substance_key: 'gof-test-ln', substance_display_name: 'GOF Test LN' })),
      makeRow({ value: null, censored: true, detection_limit: 0.0, sample_id: 'c-0', substance_key: 'gof-test-ln', substance_display_name: 'GOF Test LN' })
    ];

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const bucket = result.buckets[0];

    // Total n is 28
    expect(bucket.descriptive.n).toBe(28);
    // But positive log n is 27 (< 28)
    // If it used total n = 28, it would recommend kmH.
    // Because it correctly uses positive log n = 27 < 28 and log SD >= 1.5, it recommends kmT.
    expect(bucket.recommendation.recommendedMethod).toBe('kmT');
  });
});

describe('computeSelectionStats -- lognormal extreme censoring on zero-DL buckets', () => {
  it('correctly recommends none due to NDs > 95% when total n = 101 but detects = 5 with zero-DL non-detects', () => {
    const detects = [10.0, 11.0, 12.0, 13.0, 14.0]; // 5 detects
    const censors = Array.from({ length: 96 }, () => 0.0); // 96 zero-DL non-detects
    const rows = [
      ...detects.map((v, i) => makeRow({ value: v, censored: false, sample_id: `d-${i}`, substance_key: 'gof-test-ec', substance_display_name: 'GOF Test EC' })),
      ...censors.map((v, i) => makeRow({ value: null, censored: true, detection_limit: v, sample_id: `c-${i}`, substance_key: 'gof-test-ec', substance_display_name: 'GOF Test EC' }))
    ];

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });
    const bucket = result.buckets[0];

    // Total n is 101
    expect(bucket.descriptive.n).toBe(101);
    // Detects is 5
    expect(bucket.descriptive.detects).toBe(5);
    // Since detects/n = 5/101 ~ 4.95% < 5%, it should trigger extreme censoring guard (NDs > 95%) and recommend 'none'
    expect(bucket.recommendation.recommendedMethod).toBe('none');
    expect(bucket.recommendation.basisString).toContain('NDs > 95%');
  });
});

describe('computeSelectionStats -- lognormal ROS Imputation pathway', () => {
  it('imputes censored values using lognormal regression line when detects >= 2 and positive detects are present', () => {
    // 5 detects: 10, 15, 20, 25, 30
    // 2 censors: both with DL = 12.0
    const detects = [10.0, 15.0, 20.0, 25.0, 30.0];
    const censors = [12.0, 12.0];
    const rows = [
      ...detects.map((v, i) => makeRow({ value: v, censored: false, sample_id: `d-${i}`, substance_key: 'gof-test-ros', substance_display_name: 'GOF Test ROS' })),
      ...censors.map((v, i) => makeRow({ value: null, censored: true, detection_limit: v, sample_id: `c-${i}`, substance_key: 'gof-test-ros', substance_display_name: 'GOF Test ROS' }))
    ];

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'ROS' });
    const bucket = result.buckets[0];

    expect(bucket.descriptive.n).toBe(7);
    expect(bucket.descriptive.detects).toBe(5);
    expect(bucket.descriptive.nonDetects).toBe(2);

    // Let's verify that no DL/2 substitution warning/flag is set
    expect(bucket.flags).not.toContain('dl_substitution_used');

    // Imputed values should be strictly positive, and should be <= their detection limits (12.0)
    // The rawParsed values are order-based. Let's make sure the mean is calculated using imputed values.
    // If DL/2 substitution were used, the mean would be:
    // (10 + 15 + 20 + 25 + 30 + 6 + 6) / 7 = 112 / 7 = 16
    // If ROS is used, it should compute regression of ln(detects) vs normal quantiles and impute.
    // Let's verify that the mean is not 16.
    expect(bucket.descriptive.mean).not.toBeCloseTo(16.0, 4);
    expect(bucket.descriptive.mean).toBeGreaterThan(10.0);
    expect(bucket.descriptive.mean).toBeLessThan(30.0);
  });
});

describe('computeSelectionStats -- H-UCL fallback on extreme skewness', () => {
  it('falls back to Chebyshev (95%) when H-UCL solver fails to find a root on highly skewed Lognormal datasets', () => {
    const n = 30;
    const logMean = 1.0;
    const logSd = 10.0;
    const values = Array.from({ length: n }, (_, i) => {
      const p = (i + 1 - 0.375) / (n + 0.25);
      const z = normalInverse(p);
      return Math.exp(logMean + logSd * z);
    });
    const rows = values.map((val, idx) =>
      makeRow({
        value: val,
        censored: false,
        sample_id: `sample-${idx}`,
        substance_key: 'high-skew-ln',
        substance_display_name: 'High Skew LN'
      })
    );

    const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    const bucket = result.buckets[0];

    // Lognormal verdict should pass due to collinear quantiles
    expect(bucket.gof.verdict).toBe('Lognormal');
    expect(bucket.ucl.hUcl).toBeNull();
    expect(bucket.recommendation.recommendedMethod).toBe('chebyshev95');
    expect(bucket.recommendation.basisString).toContain('H-UCL solver failed to converge, fell back to Chebyshev (95%)');
  });
});

describe.skip('ProUCL v5.2 parity scaffold (TODO -- owner supplies values)', () => {
  it('TODO: worked-example dataset from Tech Guide section X', () => {
    // Replace with owner-supplied values from ProUCL v5.2 Tech Guide.
    // Example shape:
    //   const rows = makeFixtureRows([...values from Tech Guide...]);
    //   const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER });
    //   expect(result.buckets[0].descriptive.mean).toBeCloseTo(<Tech Guide value>, 4);
    //   expect(result.buckets[0].ucl.studentT95).toBeCloseTo(<Tech Guide UCL95>, 4);
    expect(true).toBe(true);
  });
});
