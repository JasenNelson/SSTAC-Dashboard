// Land's H-UCL solver unit tests.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section F.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { solveH, computeHUcl } from '../h-ucl';

describe('Land H-UCL Solver (h-ucl)', () => {
  it('verifies Oahu n=24 H-UCL parity', () => {
    // Oahu log-scale KM stats: mean = -0.2362, sd = 0.5470, n = 24
    const meanLog = -0.2362;
    const sdLog = 0.5470;
    const n = 24;

    const H = solveH(sdLog, n, 0.95);
    expect(H).not.toBeNull();
    expect(H!).toBeCloseTo(2.0067, 3); // Critical H value solved on-the-fly

    const ucl = computeHUcl(meanLog, sdLog, n, 0.95);
    expect(ucl).not.toBeNull();
    if (ucl !== null) {
      // Plan Target: ProUCL 1.155 vs Solver 1.153 (tolerance <= 0.005)
      expect(ucl).toBeCloseTo(1.153, 3);
      expect(Math.abs(ucl - 1.155)).toBeLessThanOrEqual(0.005);
    }
  });

  it('verifies Pyrene n=55 H-UCL parity', () => {
    // Pyrene n=55 log-scale KM stats: mean = 4.599, sd = 0.649, n = 55
    const meanLog = 4.599;
    const sdLog = 0.649;
    const n = 55;

    const H = solveH(sdLog, n, 0.95);
    expect(H).not.toBeNull();
    expect(H!).toBeCloseTo(1.9756, 3);

    const ucl = computeHUcl(meanLog, sdLog, n, 0.95);
    expect(ucl).not.toBeNull();
    if (ucl !== null) {
      // Plan Target: ProUCL 146.2 vs Solver 146.1 (tolerance <= 0.2)
      expect(ucl).toBeCloseTo(146.07, 1);
      expect(Math.abs(ucl - 146.2)).toBeLessThanOrEqual(0.2);
    }
  });

  it('verifies Pyrene n=56 H-UCL parity', () => {
    // Pyrene n=56 log-scale KM stats: mean = 4.660, sd = 0.787, n = 56
    const meanLog = 4.660;
    const sdLog = 0.787;
    const n = 56;

    const H = solveH(sdLog, n, 0.95);
    expect(H).not.toBeNull();
    expect(H!).toBeCloseTo(2.0877, 3);

    const ucl = computeHUcl(meanLog, sdLog, n, 0.95);
    expect(ucl).not.toBeNull();
    if (ucl !== null) {
      // Plan Target: ProUCL 180.2 vs Solver 179.7 (tolerance <= 0.6)
      expect(ucl).toBeCloseTo(179.72, 1);
      expect(Math.abs(ucl - 180.2)).toBeLessThanOrEqual(0.6);
    }
  });

  it('handles invalid or boundary cases', () => {
    expect(computeHUcl(0, 0, 10)).toBeNull();
    expect(computeHUcl(1.5, 0.5, 2)).toBeNull(); // n < 3
  });

  it('returns null for solveH and computeHUcl on highly skewed inputs with no valid root bracket', () => {
    const H = solveH(10.0, 50, 0.95); // Extremely large log SD = 10
    expect(H).toBeNull();

    const ucl = computeHUcl(1.0, 10.0, 50, 0.95);
    expect(ucl).toBeNull();
  });
});
