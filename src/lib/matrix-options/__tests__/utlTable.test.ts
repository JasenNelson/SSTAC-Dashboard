import { describe, it, expect } from 'vitest';

import { K_95_95_TABLE, lookupK9595 } from '../utlTable';

// utlTable.ts is pure math: a one-sided 95/95 tolerance-factor (K) lookup that
// linearly interpolates between tabulated rows and clamps outside the table.
// Every expectation below is independently derived from the published table
// (n=5 -> 4.166, n=10 -> 2.911, n=20 -> 2.396, n=30 -> 2.220, n=50 -> 2.065,
// n=100 -> 1.927) or from a mathematical invariant (monotonicity, clamping,
// linear-interpolation endpoint behaviour), never from "whatever it returns".

describe('K_95_95_TABLE', () => {
  it('is sorted strictly ascending by n', () => {
    for (let i = 1; i < K_95_95_TABLE.length; i += 1) {
      expect(K_95_95_TABLE[i].n).toBeGreaterThan(K_95_95_TABLE[i - 1].n);
    }
  });

  it('K decreases monotonically as n increases (larger samples -> tighter factor)', () => {
    for (let i = 1; i < K_95_95_TABLE.length; i += 1) {
      expect(K_95_95_TABLE[i].K).toBeLessThan(K_95_95_TABLE[i - 1].K);
    }
  });
});

describe('lookupK9595 -- exact table rows', () => {
  // At a tabulated n the interpolation fraction is 0 (or it short-circuits via
  // the clamp branches at the endpoints), so K must equal the published value.
  const exact: Array<[number, number]> = [
    [5, 4.166],
    [10, 2.911],
    [20, 2.396],
    [30, 2.220],
    [50, 2.065],
    [100, 1.927],
  ];
  for (const [n, K] of exact) {
    it(`returns the published K for n = ${n}`, () => {
      const { K: got } = lookupK9595(n);
      expect(got).toBeCloseTo(K, 10);
    });
  }

  it('does not warn at an exact interior row (n = 10)', () => {
    expect(lookupK9595(10).warning).toBeNull();
  });
});

describe('lookupK9595 -- linear interpolation', () => {
  it('returns the midpoint K halfway between two rows (n = 15 -> mean of K10,K20)', () => {
    // n=15 sits exactly halfway between n=10 (2.911) and n=20 (2.396).
    // Linear interpolation => (2.911 + 2.396) / 2 = 2.6535.
    const { K, warning } = lookupK9595(15);
    expect(K).toBeCloseTo((2.911 + 2.396) / 2, 10);
    expect(warning).toBeNull();
  });

  it('weights interpolation by distance (n = 7, 2/5 of the way from 5 to 10)', () => {
    // frac = (7 - 5) / (10 - 5) = 0.4
    // K = 4.166 + 0.4 * (2.911 - 4.166)
    const frac = (7 - 5) / (10 - 5);
    const expected = 4.166 + frac * (2.911 - 4.166);
    expect(lookupK9595(7).K).toBeCloseTo(expected, 10);
  });

  it('produces values strictly bracketed by the neighbouring rows (n = 40)', () => {
    // n=40 lies between n=30 (2.220) and n=50 (2.065). The interpolated value
    // must fall strictly inside that open interval.
    const { K } = lookupK9595(40);
    expect(K).toBeLessThan(2.22);
    expect(K).toBeGreaterThan(2.065);
  });

  it('interpolation is monotonic across a sweep (decreasing in n)', () => {
    let prev = Infinity;
    for (let n = 5; n <= 100; n += 1) {
      const { K } = lookupK9595(n);
      expect(K).toBeLessThanOrEqual(prev);
      prev = K;
    }
  });
});

describe('lookupK9595 -- clamping below the table', () => {
  it('clamps n below 5 to the n=5 row and emits a clamp warning', () => {
    const { K, warning } = lookupK9595(3);
    expect(K).toBe(4.166);
    expect(warning).toMatch(/below tabulated minimum/);
    expect(warning).toContain('n = 3');
  });

  it('treats n = 2 (smallest allowed integer) as a below-min clamp, not the guard branch', () => {
    const { K, warning } = lookupK9595(2);
    expect(K).toBe(4.166);
    expect(warning).toMatch(/below tabulated minimum/);
  });
});

describe('lookupK9595 -- clamping above the table', () => {
  it('clamps n above 100 to the n=100 row and emits a clamp warning', () => {
    const { K, warning } = lookupK9595(250);
    expect(K).toBe(1.927);
    expect(warning).toMatch(/exceeds tabulated maximum/);
    expect(warning).toContain('n = 250');
  });
});

describe('lookupK9595 -- invalid / degenerate input guard', () => {
  it('clamps n < 2 to the n=5 row with the integer-guard warning', () => {
    const { K, warning } = lookupK9595(1);
    expect(K).toBe(4.166);
    expect(warning).toMatch(/n must be an integer >= 2/);
  });

  it('clamps NaN to the n=5 row with the integer-guard warning', () => {
    const { K, warning } = lookupK9595(Number.NaN);
    expect(K).toBe(4.166);
    expect(warning).toMatch(/n must be an integer >= 2/);
  });

  it('clamps Infinity above the table (finite-then-clamp ordering)', () => {
    // Infinity fails Number.isFinite -> the guard fires first -> n=5 clamp.
    const { K, warning } = lookupK9595(Number.POSITIVE_INFINITY);
    expect(K).toBe(4.166);
    expect(warning).toMatch(/n must be an integer >= 2/);
  });
});
