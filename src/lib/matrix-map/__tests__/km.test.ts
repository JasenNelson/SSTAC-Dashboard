// Kaplan-Meier product-limit estimation unit tests.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section D.1.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { computeKmStats, kmTUcl, kmZUcl, kmChebyshevUcl } from '../km';

describe('Kaplan-Meier Primitives (km)', () => {
  // Oahu arsenic dataset n=24, with 13 NDs (censored = true).
  // Detected values are at: 0.5, 0.5, 0.5, 0.6, 0.7, 0.7, 0.9, 1.5, 1.7, 2.8, 3.2 (length 11)
  // Censored values (NDs) are at: 0.9, 1.0 (4 times), 2.0 (8 times) (length 13)
  const oahuData = [
    { value: 0.5, censored: false },
    { value: 0.5, censored: false },
    { value: 0.5, censored: false },
    { value: 0.6, censored: false },
    { value: 0.7, censored: false },
    { value: 0.7, censored: false },
    { value: 0.9, censored: false },
    { value: 1.5, censored: false },
    { value: 1.7, censored: false },
    { value: 2.8, censored: false },
    { value: 3.2, censored: false },
    { value: 0.9, censored: true },
    { value: 1.0, censored: true },
    { value: 1.0, censored: true },
    { value: 1.0, censored: true },
    { value: 1.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
    { value: 2.0, censored: true },
  ];

  it('computes KM stats for Oahu arsenic dataset', () => {
    const res = computeKmStats(oahuData);
    expect(res).not.toBeNull();
    if (res) {
      expect(res.mean).toBeCloseTo(0.9490, 4);
      expect(res.sd).toBeCloseTo(0.7130, 4);
      expect(res.se).toBeCloseTo(0.1647, 4);

      const tUcl = kmTUcl(res, 24);
      expect(tUcl).toBeCloseTo(1.231, 3); // target 1.231

      const zUcl = kmZUcl(res);
      expect(zUcl).toBeCloseTo(1.22, 2); // target 1.220

      const cheb90 = kmChebyshevUcl(res, 0.90);
      expect(cheb90).toBeCloseTo(1.443, 3); // target 1.443

      const cheb95 = kmChebyshevUcl(res, 0.95);
      expect(cheb95).toBeCloseTo(1.667, 3); // target 1.667

      const cheb975 = kmChebyshevUcl(res, 0.975);
      expect(cheb975).toBeCloseTo(1.977, 3); // target 1.977

      const cheb99 = kmChebyshevUcl(res, 0.99);
      expect(cheb99).toBeCloseTo(2.588, 3); // target 2.588
    }
  });

  it('handles empty or small datasets', () => {
    expect(computeKmStats([])).toBeNull();
    expect(computeKmStats([{ value: 5, censored: false }])).toBeNull();
  });

  it('handles zero SE case correctly by returning mean', () => {
    const zeroSeResult = {
      mean: 10.0,
      variance: 0.0,
      sd: 0.0,
      se: 0.0,
    };
    expect(kmTUcl(zeroSeResult, 5)).toBeCloseTo(10.0, 5);
    expect(kmZUcl(zeroSeResult)).toBeCloseTo(10.0, 5);
    expect(kmChebyshevUcl(zeroSeResult, 0.95)).toBeCloseTo(10.0, 5);
  });
});
