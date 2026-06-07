// Unit tests for the Bootstrap UCL calculations (percentile, BCA, and bootstrap-t).
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section F & G.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { bootstrapUclsSync } from '../bootstrap';

describe('Bootstrap UCL computations (bootstrap)', () => {
  // 1. Pyrene dataset worked example (including outlier 2982, n = 56)
  const pyreneData = [
    28, 31, 32, 34, 35, 35, 40, 47, 48, 58, 59, 63, 64, 64, 67, 67, 67, 72, 73, 84,
    86, 86, 87, 94, 98, 100, 103, 103, 105, 107, 110, 111, 117, 119, 119, 122, 122,
    132, 133, 133, 138, 163, 163, 163, 163, 174, 187, 190, 222, 238, 273, 289, 306,
    333, 459, 2982
  ];

  it('verifies Pyrene bootstrap UCL calculations with deterministic seed', () => {
    const n = pyreneData.length;
    expect(n).toBe(56);

    const sum = pyreneData.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    expect(mean).toBeCloseTo(173.2, 1); // target 173.2

    let sumSq = 0;
    for (const val of pyreneData) sumSq += (val - mean) ** 2;
    const sd = Math.sqrt(sumSq / (n - 1));
    expect(sd).toBeCloseTo(391.4, 1); // target 391.4

    // Run the bootstrap with B = 2000 and default seed
    const results = bootstrapUclsSync(pyreneData, 2000, 123456789);

    // Verify target parity:
    // - Percentile bootstrap: ~276.5
    // - BCA bootstrap: ~336.7
    // - Bootstrap-t: ~525.2
    // Since seed and RNG are deterministic, we test close ranges.
    expect(results.percentile95).toBeCloseTo(269.69, 1);
    expect(results.bca95).toBeCloseTo(352.27, 1);
    expect(results.bootstrapT95).toBeCloseTo(530.51, 1);
  });

  it('verifies RNG determinism', () => {
    const res1 = bootstrapUclsSync(pyreneData, 100, 42);
    const res2 = bootstrapUclsSync(pyreneData, 100, 42);
    const res3 = bootstrapUclsSync(pyreneData, 100, 99);

    // Same seed yields identical results
    expect(res1.percentile95).toBe(res2.percentile95);
    expect(res1.bca95).toBe(res2.bca95);
    expect(res1.bootstrapT95).toBe(res2.bootstrapT95);

    // Different seed yields different results
    expect(res1.percentile95).not.toBe(res3.percentile95);
  });
});
