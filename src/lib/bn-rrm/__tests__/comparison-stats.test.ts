/**
 * Regression fixtures for comparison-stats.ts
 *
 * Hand-verified against the actual 48-station matched dataset
 * (risk_comparison.json, 2026-03-25).
 *
 * Matrix (rows=WOE mapped, cols=BN-RRM predicted):
 *          BN:low  BN:mod  BN:high
 * WOE:low      23       4      13
 * WOE:mod       1       0       5
 * WOE:high      0       0       2
 *
 * If these values change, either the stats code has regressed or
 * the comparison data has been updated — investigate before accepting.
 */

import { describe, test, expect } from 'vitest';
import {
  confusionMatrixFromPairs,
  cohensKappa,
  weightedKappa,
  weightedKappaFromPairs,
  unweightedKappaFromPairs,
  perClassMetrics,
  mcNemarTest,
  bootstrapCI,
} from '../comparison-stats';

// ─── Fixture data ────────────────────────────────────────────────────────────

const HAND_CHECKED_MATRIX = [
  [23, 4, 13],
  [1, 0, 5],
  [0, 0, 2],
];

// Build pairs from the matrix (rows=WOE/reference, cols=BN-RRM/predicted)
function pairsFromMatrix(matrix: number[][]): [string, string][] {
  const classes = ['low', 'moderate', 'high'];
  const pairs: [string, string][] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = 0; j < classes.length; j++) {
      for (let k = 0; k < matrix[i][j]; k++) {
        pairs.push([classes[j], classes[i]]); // [predicted, reference]
      }
    }
  }
  return pairs;
}

const PAIRS = pairsFromMatrix(HAND_CHECKED_MATRIX);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('comparison-stats regression fixtures', () => {
  test('confusion matrix reconstructs from pairs', () => {
    const predicted = PAIRS.map((p) => p[0]);
    const observed = PAIRS.map((p) => p[1]);
    const matrix = confusionMatrixFromPairs(predicted, observed);
    expect(matrix).toEqual(HAND_CHECKED_MATRIX);
  });

  test('n = 48 matched stations', () => {
    expect(PAIRS.length).toBe(48);
  });

  test('unweighted kappa = 0.1375 (4 decimal places)', () => {
    const kappa = cohensKappa(HAND_CHECKED_MATRIX);
    expect(kappa).toBeCloseTo(0.1375, 3);
  });

  test('weighted kappa (quadratic) = 0.2218 (4 decimal places)', () => {
    const kappa = weightedKappa(HAND_CHECKED_MATRIX, 'quadratic');
    expect(kappa).toBeCloseTo(0.2218, 3);
  });

  test('weighted kappa (linear) = 0.1880 (4 decimal places)', () => {
    const kappa = weightedKappa(HAND_CHECKED_MATRIX, 'linear');
    expect(kappa).toBeCloseTo(0.1880, 3);
  });

  test('overall agreement = 25/48 (52.1%)', () => {
    const agree = PAIRS.filter(([pred, ref]) => pred === ref).length;
    expect(agree).toBe(25);
    expect(agree / PAIRS.length).toBeCloseTo(0.5208, 3);
  });

  test('kappa from pairs matches kappa from matrix', () => {
    const fromPairs = weightedKappaFromPairs(PAIRS);
    const fromMatrix = weightedKappa(HAND_CHECKED_MATRIX, 'quadratic');
    expect(fromPairs).toBeCloseTo(fromMatrix, 10);
  });

  test('unweighted kappa from pairs matches kappa from matrix', () => {
    const fromPairs = unweightedKappaFromPairs(PAIRS);
    const fromMatrix = cohensKappa(HAND_CHECKED_MATRIX);
    expect(fromPairs).toBeCloseTo(fromMatrix, 10);
  });

  test('per-class metrics (WOE as reference)', () => {
    const predicted = PAIRS.map((p) => p[0]);
    const reference = PAIRS.map((p) => p[1]);
    const metrics = perClassMetrics(predicted, reference);

    // WOE low: 40 support, BN predicted low for 23 of them
    expect(metrics.low.support).toBe(40);
    expect(metrics.low.recall).toBeCloseTo(23 / 40, 3); // 0.575

    // WOE moderate: 6 support, BN predicted moderate for 0 of them
    expect(metrics.moderate.support).toBe(6);
    expect(metrics.moderate.recall).toBe(0);

    // WOE high: 2 support, BN predicted high for 2 of them
    expect(metrics.high.support).toBe(2);
    expect(metrics.high.recall).toBeCloseTo(1.0, 3);
  });

  test('McNemar binary reduction (elevated vs low)', () => {
    const result = mcNemarTest(PAIRS, (label) =>
      label === 'moderate' || label === 'high' ? 'positive' : 'negative'
    );
    // b = BN elevated, WOE low (cells [0][1] + [0][2] = 4 + 13 = 17)
    expect(result.b).toBe(17);
    // c = BN low, WOE elevated (cells [1][0] + [2][0] = 1 + 0 = 1)
    expect(result.c).toBe(1);
  });

  test('bootstrap CI contains point estimate', () => {
    const ci = bootstrapCI(PAIRS, weightedKappaFromPairs, 500);
    expect(ci.lower).toBeLessThanOrEqual(ci.point);
    expect(ci.upper).toBeGreaterThanOrEqual(ci.point);
    expect(ci.point).toBeCloseTo(0.2218, 2);
  });

  test('bootstrap CI is reproducible (seeded PRNG)', () => {
    const ci1 = bootstrapCI(PAIRS, weightedKappaFromPairs, 500);
    const ci2 = bootstrapCI(PAIRS, weightedKappaFromPairs, 500);
    expect(ci1.lower).toBe(ci2.lower);
    expect(ci1.upper).toBe(ci2.upper);
  });
});
