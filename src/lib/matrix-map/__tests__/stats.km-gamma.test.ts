// C4: KM-censored Gamma UCL chain regression tests.
//
// Goal: pin that computeSelectionStats() with censoredMethod='KM' wires
//       KM moments -> getKStar -> Gamma UCL correctly.
//
// Design notes:
//   - We build a left-censored dataset (mix of detects + non-detects) that
//     produces a SUCCESSFUL KM fit with POSITIVE variance.
//   - We assert that the KM path was actually taken (ucl.approximateGamma and
//     ucl.adjustedGamma are NON-NULL).  This is the FIXTURE GUARDRAIL -- without
//     it, the test could silently pass on the null/fallback path.
//   - We then recompute expected values INDEPENDENTLY using the exported
//     primitives (getKStar, computeApproximateGammaUcl, computeAdjustedGammaUcl,
//     computeKmStats) and assert closeness.  This pins the wiring against drift
//     without re-deriving chi-square tables by hand.
//
// Plain ASCII only (code point <= 127).

import { describe, it, expect } from 'vitest';
import { computeSelectionStats } from '../stats';
import { getKStar, computeApproximateGammaUcl, computeAdjustedGammaUcl } from '../gamma-ucl';
import { computeKmStats } from '../km';
import { DEFAULT_MATRIX_MAP_FILTER_STATE } from '@/stores/matrix-map/filterStore';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';

const EMPTY_FILTER: MatrixMapFilterState = DEFAULT_MATRIX_MAP_FILTER_STATE;

// ---------------------------------------------------------------------------
// Row factory -- matches the existing makeRow style in stats.test.ts
// ---------------------------------------------------------------------------

function makeRow(over: Partial<MatrixMapMeasurementRow> = {}): MatrixMapMeasurementRow {
  return {
    sample_id: 'sample-km-a',
    sample_display_name: 'Station KM-1',
    sample_station_id: 'STA-KM-1',
    sample_event_id: 'event-km-a',
    event_date: '2024-06-15',
    date_precision: 'exact',
    measurement_id: 'meas-km-a',
    medium: 'sediment',
    substance_id: 'sub-lead',
    substance_key: 'lead',
    substance_display_name: 'Lead',
    value: 10.0,
    unit: 'mg/kg',
    detection_limit: null,
    qualifier: null,
    censored: false,
    coordinate_quality_tier: 'high',
    classification: 'reference',
    source_dra_id: 'dra-km-1',
    source_dra_title: 'KM Test DRA',
    source_dra_citation: null,
    ...over,
  };
}

// Build a detected (non-censored) row.
function makeDetect(id: string, value: number): MatrixMapMeasurementRow {
  return makeRow({ sample_id: id, measurement_id: 'meas-' + id, value, censored: false, detection_limit: null });
}

// Build a non-detect (censored) row with a detection limit.
function makeCensored(id: string, dl: number): MatrixMapMeasurementRow {
  return makeRow({
    sample_id: id,
    measurement_id: 'meas-' + id,
    value: null as unknown as number,
    censored: true,
    detection_limit: dl,
  });
}

// ---------------------------------------------------------------------------
// Fixture: 6 detects + 2 non-detects (n=8, enough for a stable KM fit)
//
// Detected values:  [5, 10, 15, 20, 25, 30]
// Non-detect DLs:   [2, 4]   (DLs are below all detect values -> clean KM fit)
//
// This fixture is deliberately simple so we can verify KM fit produces
// positive variance without needing to hand-compute all KM products.
// ---------------------------------------------------------------------------

const DETECT_VALUES = [5, 10, 15, 20, 25, 30];
const CENSORED_DLS = [2, 4];

function makeKmRows(): MatrixMapMeasurementRow[] {
  const rows: MatrixMapMeasurementRow[] = [];
  DETECT_VALUES.forEach((v, i) => rows.push(makeDetect('d' + String(i), v)));
  CENSORED_DLS.forEach((dl, i) => rows.push(makeCensored('c' + String(i), dl)));
  return rows;
}

// ---------------------------------------------------------------------------
// C4: KM Gamma UCL chain
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- KM Gamma UCL chain (C4)', () => {
  const rows = makeKmRows();
  const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });

  it('produces exactly one bucket', () => {
    expect(result.buckets).toHaveLength(1);
  });

  const bucket = () => result.buckets[0];

  // FIXTURE GUARDRAIL: assert the KM Gamma path was actually taken.
  // If these are null the downstream assertions would trivially pass while
  // covering nothing.
  it('GUARDRAIL: ucl.approximateGamma is NON-NULL (KM Gamma path taken)', () => {
    expect(bucket().ucl.approximateGamma).not.toBeNull();
    expect(bucket().ucl.approximateGamma).toBeGreaterThan(0);
  });

  it('GUARDRAIL: ucl.adjustedGamma is NON-NULL (KM Gamma path taken)', () => {
    expect(bucket().ucl.adjustedGamma).not.toBeNull();
    expect(bucket().ucl.adjustedGamma).toBeGreaterThan(0);
  });

  it('GUARDRAIL: KM fit produced positive variance (test data is suitable)', () => {
    // Verify KM primitive directly so we know the test fixture is valid
    const rawParsed = [
      ...DETECT_VALUES.map((v) => ({ value: v, censored: false })),
      ...CENSORED_DLS.map((dl) => ({ value: dl, censored: true })),
    ];
    const km = computeKmStats(rawParsed);
    expect(km).not.toBeNull();
    expect(km!.variance).toBeGreaterThan(0);
    expect(km!.mean).toBeGreaterThan(0);
  });

  // Independent recomputation: call the same primitives stats.ts calls,
  // then compare against the bucket result to pin the wiring.
  it('approximateGamma matches independent recomputation via primitives', () => {
    const rawParsed = [
      ...DETECT_VALUES.map((v) => ({ value: v, censored: false })),
      ...CENSORED_DLS.map((dl) => ({ value: dl, censored: true })),
    ];
    const n = rawParsed.length; // 8
    const km = computeKmStats(rawParsed)!;
    expect(km.variance).toBeGreaterThan(0);

    // stats.ts line 562-563: shapeEst = (km.mean^2) / km.variance
    const kHat = (km.mean * km.mean) / km.variance;
    const kStar = getKStar(kHat, n);
    const expected = computeApproximateGammaUcl(km.mean, kStar, n);

    expect(expected).not.toBeNull();
    expect(bucket().ucl.approximateGamma).toBeCloseTo(expected!, 6);
  });

  it('adjustedGamma matches independent recomputation via primitives', () => {
    const rawParsed = [
      ...DETECT_VALUES.map((v) => ({ value: v, censored: false })),
      ...CENSORED_DLS.map((dl) => ({ value: dl, censored: true })),
    ];
    const n = rawParsed.length; // 8
    const km = computeKmStats(rawParsed)!;

    const kHat = (km.mean * km.mean) / km.variance;
    const kStar = getKStar(kHat, n);
    const expected = computeAdjustedGammaUcl(km.mean, kStar, n);

    expect(expected).not.toBeNull();
    expect(bucket().ucl.adjustedGamma).toBeCloseTo(expected!, 6);
  });

  it('adjustedGamma >= approximateGamma (adjusted uses tighter beta -> lower chi2 denom -> higher UCL)', () => {
    const approx = bucket().ucl.approximateGamma!;
    const adjusted = bucket().ucl.adjustedGamma!;
    // The adjusted gamma UCL uses a smaller chi-square quantile (beta < 0.05)
    // so the denominator is smaller and the UCL is larger.
    expect(adjusted).toBeGreaterThanOrEqual(approx);
  });

  it('bucket has nonDetects=2 (the censored rows)', () => {
    expect(bucket().descriptive.nonDetects).toBe(2);
  });

  it('bucket has detects=6', () => {
    expect(bucket().descriptive.detects).toBe(6);
  });

  it('bucket n=8 (total accepted rows)', () => {
    expect(bucket().descriptive.n).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// C4 edge: all-detect dataset (no censoring) -- KM Gamma path also works
// for uncensored data when hasCensored=false (shapeEst from GOF gamma.shape).
// Verify Gamma UCLs are non-null for a standard all-detect fixture.
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- uncensored Gamma UCLs (C4 auxiliary)', () => {
  // Use distinct positive values so GOF can estimate a gamma shape > 0.
  const rows = [5, 10, 15, 20, 25, 30, 35, 40].map((v, i) =>
    makeDetect('aux-' + String(i), v),
  );
  const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });

  it('produces one bucket', () => {
    expect(result.buckets).toHaveLength(1);
  });

  it('approximateGamma is non-null for all-detect positive dataset', () => {
    expect(result.buckets[0].ucl.approximateGamma).not.toBeNull();
    expect(result.buckets[0].ucl.approximateGamma).toBeGreaterThan(0);
  });

  it('adjustedGamma is non-null for all-detect positive dataset', () => {
    expect(result.buckets[0].ucl.adjustedGamma).not.toBeNull();
    expect(result.buckets[0].ucl.adjustedGamma).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// C4 edge: null Gamma UCLs when kStar would be zero/negative
// This happens when hasCensored=true, KM fit fails (all censored, detects=0).
// ---------------------------------------------------------------------------

describe('computeSelectionStats -- KM fit failure -> null Gamma UCLs (C4 guard)', () => {
  // All-censored dataset: KM fit will fail (nMinusK=0) -> kmStatsResult=null
  // -> approxGamma and adjustedGamma should be null.
  const rows = [
    makeCensored('all-c-0', 5.0),
    makeCensored('all-c-1', 10.0),
    makeCensored('all-c-2', 15.0),
  ];
  const result = computeSelectionStats({ rows, filterState: EMPTY_FILTER, censoredMethod: 'KM' });

  it('produces one bucket', () => {
    expect(result.buckets).toHaveLength(1);
  });

  it('approximateGamma is null when KM cannot fit', () => {
    expect(result.buckets[0].ucl.approximateGamma).toBeNull();
  });

  it('adjustedGamma is null when KM cannot fit', () => {
    expect(result.buckets[0].ucl.adjustedGamma).toBeNull();
  });
});
