// Approximate and Adjusted Gamma UCL unit tests.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section C & G.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import {
  chiSquareInverse,
  getBetaGriceBain,
  getKStar,
  computeApproximateGammaUcl,
  computeAdjustedGammaUcl
} from '../gamma-ucl';

describe('Gamma UCL Primitives (gamma-ucl)', () => {
  it('verifies chiSquareInverse against standard targets', () => {
    // Chi2_0.05(2) = 0.102587
    expect(chiSquareInverse(0.05, 2)).toBeCloseTo(0.1026, 4);
    // Chi2_0.95(2) = 5.99146
    expect(chiSquareInverse(0.95, 2)).toBeCloseTo(5.991, 3);
  });

  it('verifies beta interpolation for Grice-Bain', () => {
    // n = 5 => 0.0086
    expect(getBetaGriceBain(5)).toBeCloseTo(0.0086, 6);
    // n = 10 => 0.0267
    expect(getBetaGriceBain(10)).toBeCloseTo(0.0267, 6);
    // n = 20 => 0.0380
    expect(getBetaGriceBain(20)).toBeCloseTo(0.0380, 6);
    // n = 40 => 0.0440
    expect(getBetaGriceBain(40)).toBeCloseTo(0.0440, 6);
  });

  it('verifies shape parameter bias correction', () => {
    // getKStar(1.771, 24) = (21 * 1.771) / 24 + 2 / 72 = 1.577375
    expect(getKStar(1.771, 24)).toBeCloseTo(1.5774, 4);
  });

  it('handles empty/null values', () => {
    expect(computeApproximateGammaUcl(0, 1.5, 10)).toBeNull();
    expect(computeAdjustedGammaUcl(10, -0.5, 10)).toBeNull();
  });
});
