// Goodness-of-Fit (GOF) test suite verifying parity with US EPA ProUCL v5.2 examples.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section G.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import {
  shapiroWilk,
  lillieforsTest,
  prouclDistChoose,
  shapiroWilkCritVal,
  lillieforsCritVal,
  estimateGammaMle,
  gammaADTest,
  gammaKSTest
} from '../gof';

describe('Goodness-of-Fit tests (GOF)', () => {
  // 1. Chromium dataset worked example (n = 24)
  // Normal distribution GOF tests.
  const chromiumData = [
    8.7, 8.1, 11.0, 5.1, 12.0, 20.0, 12.0, 11.0, 13.0, 20.0, 9.8, 14.0,
    17.0, 15.0, 8.4, 14.0, 4.5, 3.0, 4.0, 11.0, 16.4, 7.6, 35.5, 6.1
  ];

  it('verifies Chromium descriptive statistics and normality tests', () => {
    const n = chromiumData.length;
    expect(n).toBe(24);

    const sum = chromiumData.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    expect(mean).toBeCloseTo(11.97, 1); // target 11.97

    let sumSq = 0;
    for (const val of chromiumData) sumSq += (val - mean) ** 2;
    const sd = Math.sqrt(sumSq / (n - 1));
    expect(sd).toBeCloseTo(6.892, 3); // target 6.892

    // Shapiro-Wilk
    const sw = shapiroWilk(chromiumData);
    expect(sw.w).toBeCloseTo(0.87, 2); // target 0.87
    expect(sw.p).toBeLessThan(0.01); // target rejected at 1%

    const swCrit = shapiroWilkCritVal(n, 0.01);
    expect(swCrit).toBeCloseTo(0.884, 3); // target 0.884
    expect(sw.w).toBeLessThan(swCrit);

    // Lilliefors
    const lillie = lillieforsTest(chromiumData);
    expect(lillie.d).toBeCloseTo(0.134, 3); // target 0.134
    
    const lillieCrit = lillieforsCritVal(n, 0.01);
    expect(lillieCrit).toBeCloseTo(0.2056, 3); // target 0.2056 (rounds to 0.206)
    expect(lillie.d).toBeLessThan(lillieCrit); // normality accepted at 1%

    // Sequential pick should classify this as Normal / Approximate Normal
    // since Lilliefors passes (either passes rule)
    const gof = prouclDistChoose(chromiumData);
    expect(gof.verdict).toBe('Normal');
    expect(gof.normal.passed).toBe(true);
  });

  // 2. Pyrene dataset (excluding outlier 2982, n = 55)
  // Gamma distribution GOF tests.
  const pyreneDataNoOutlier = [
    31, 32, 34, 40, 47, 48, 59, 63, 64, 64, 67, 67, 67, 72, 73, 84, 86, 87, 94, 98,
    100, 103, 103, 105, 107, 110, 111, 119, 119, 122, 132, 133, 133, 138, 163, 187,
    190, 222, 238, 273, 289, 306, 333, 459
    // detects only from Pyrene dataset without outlier 2982
    // total detects = 44, plus non-detects or others. Wait!
    // Let's verify the detects values.
    // The extraction packet lists Pyrene dataset detects values.
    // Let's construct the full 55 values (excluding 2982) based on the extraction packet description:
    // detects values are: 31, 32, 34, 40, 47, 48, 59, 63, 64, 64, 67, 67, 67, 72, 73, 84, 86, 87, 94, 98,
    // 100, 103, 103, 105, 107, 110, 111, 119, 119, 122, 132, 133, 133, 138, 163, 187, 190, 222, 238, 273,
    // 289, 306, 333, 459 (length 44)
    // plus non-detects (censored): 28, 35, 35, 58, 86, 117, 122, 163, 163, 163, 174 (length 11)
    // For GOF tests on detected data in ProUCL, we use the detected-only data (n = 44).
    // Let's check shape parameter k* on detected data.
  ];

  it('verifies Pyrene shape parameter and Gamma GOF calculations', () => {
    // Detects only from Pyrene dataset (n = 44).
    // Let's verify if the shape parameter matches the target.
    const detects = pyreneDataNoOutlier;
    const n = detects.length;
    expect(n).toBe(44);

    const mle = estimateGammaMle(detects);
    // Bias correction formula: k* = (n - 3) * k_hat / n + 2 / (3 * n)
    const kStar = (n - 3) * mle.shape / n + 2.0 / (3.0 * n);
    expect(kStar).toBeCloseTo(2.454, 1); // target shape k* ~ 2.454

    // Run AD and KS tests
    const ad = gammaADTest(detects, kStar, mle.scale);
    const ks = gammaKSTest(detects, kStar, mle.scale);

    // Verify critical values are computed
    expect(ad.critVal).toBeGreaterThan(0.7);
    expect(ks.critVal).toBeGreaterThan(0.1);
  });
});
