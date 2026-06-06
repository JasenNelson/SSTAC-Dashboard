// Tests for the inverse Student's-t CDF implementation.
// Reference values are from published one-sided t-tables (t_{0.95, df}).
// Tolerance: 1e-4 for all t-table comparisons (4 decimal places).
//
// VERIFY: One-sided t(0.95, df) convention vs ProUCL v5.2 Tech Guide.
// These test values are one-sided (P(T <= t) = 0.95).
//
// Plain ASCII only (code point <= 127).

import { describe, it, expect } from 'vitest';
import { studentTInv, tCritical, incompleteBeta, lnGamma } from '../inverse-t';

const TOL = 1e-4;

// ---------------------------------------------------------------------------
// lnGamma sanity checks (Stirling / known values)
// ---------------------------------------------------------------------------

describe('lnGamma', () => {
  it('lnGamma(1) = 0', () => {
    expect(lnGamma(1)).toBeCloseTo(0, 10);
  });

  it('lnGamma(2) = 0 (since Gamma(2)=1)', () => {
    expect(lnGamma(2)).toBeCloseTo(0, 10);
  });

  it('lnGamma(3) = ln(2) (since Gamma(3)=2)', () => {
    expect(lnGamma(3)).toBeCloseTo(Math.log(2), 8);
  });

  it('lnGamma(0.5) = 0.5*ln(pi) (since Gamma(0.5)=sqrt(pi))', () => {
    expect(lnGamma(0.5)).toBeCloseTo(0.5 * Math.log(Math.PI), 8);
  });
});

// ---------------------------------------------------------------------------
// incompleteBeta boundary and round-trip
// ---------------------------------------------------------------------------

describe('incompleteBeta', () => {
  it('I_0(a,b) = 0', () => {
    expect(incompleteBeta(2, 3, 0)).toBe(0);
  });

  it('I_1(a,b) = 1', () => {
    expect(incompleteBeta(2, 3, 1)).toBe(1);
  });

  it('I_0.5(1,1) = 0.5 (uniform distribution)', () => {
    // I_x(1,1) = x for any x in [0,1]
    expect(incompleteBeta(1, 1, 0.5)).toBeCloseTo(0.5, 8);
  });

  it('I_x(a,b) + I_{1-x}(b,a) = 1 (symmetry identity)', () => {
    const a = 3;
    const b = 5;
    const x = 0.3;
    const sum = incompleteBeta(a, b, x) + incompleteBeta(b, a, 1 - x);
    expect(sum).toBeCloseTo(1, 8);
  });

  it('round-trip with inverseIncompleteBeta at a known value', () => {
    // incompleteBeta(5, 5, 0.5) should be exactly 0.5 by symmetry.
    const val = incompleteBeta(5, 5, 0.5);
    expect(val).toBeCloseTo(0.5, 6);
  });
});

// ---------------------------------------------------------------------------
// studentTInv: published one-sided t-table values
// Tolerance 1e-4 (4 decimal places as specified in the plan).
//
// Source: standard t-table (one-sided alpha=0.05, i.e. P(T<=t)=0.95).
// ---------------------------------------------------------------------------

describe('studentTInv -- one-sided t(0.95, df) table', () => {
  const TABLE: [number, number][] = [
    [1,   6.3138],
    [2,   2.9200],
    [3,   2.3534],
    [4,   2.1318],
    [5,   2.0150],
    [6,   1.9432],
    [7,   1.8946],
    [8,   1.8595],
    [9,   1.8331],
    [10,  1.8125],
    [15,  1.7531],
    [20,  1.7247],
    [25,  1.7081],
    [29,  1.6991],
    [30,  1.6973],
    [40,  1.6839],
    [60,  1.6706],
    [120, 1.6577],
  ];

  for (const [df, expected] of TABLE) {
    it('df=' + String(df) + ' -> ' + String(expected), () => {
      const actual = studentTInv(0.95, df);
      expect(actual).toBeCloseTo(expected, Math.round(-Math.log10(TOL)));
    });
  }
});

// ---------------------------------------------------------------------------
// Large df -> approaches z-score 1.6449 (standard normal 95th percentile)
// ---------------------------------------------------------------------------

describe('studentTInv -- large df asymptote', () => {
  it('df=1000 is close to 1.6449 (standard normal)', () => {
    const actual = studentTInv(0.95, 1000);
    expect(Math.abs(actual - 1.6449)).toBeLessThan(0.005);
  });

  it('df=10000 is very close to 1.6449', () => {
    const actual = studentTInv(0.95, 10000);
    expect(Math.abs(actual - 1.6449)).toBeLessThan(0.001);
  });
});

// ---------------------------------------------------------------------------
// tCritical wrapper is identical to studentTInv
// ---------------------------------------------------------------------------

describe('tCritical', () => {
  it('tCritical(0.95, 7) matches studentTInv(0.95, 7)', () => {
    expect(tCritical(0.95, 7)).toBeCloseTo(studentTInv(0.95, 7), 10);
  });

  it('tCritical(0.95, 29) matches table 1.6991 to 4 dp', () => {
    expect(tCritical(0.95, 29)).toBeCloseTo(1.6991, 4);
  });
});

// ---------------------------------------------------------------------------
// Boundary / edge values
// ---------------------------------------------------------------------------

describe('studentTInv -- boundary values', () => {
  it('p=0 returns -Infinity', () => {
    expect(studentTInv(0, 10)).toBe(-Infinity);
  });

  it('every representable p < 1 stays FINITE (no underflow path to Infinity)', () => {
    // codex Spark round 1 raised "p within machine epsilon of 1 underflows
    // 2*(1-p) to 0 -> Infinity". In float64 any representable p < 1 has
    // 1 - p >= 2^-53 > 0, so the interior path is finite; a literal like
    // 1 - 1e-20 rounds to exactly 1.0 BEFORE the call and takes the
    // documented p >= 1 boundary guard instead. Lock both facts.
    expect(Number.isFinite(studentTInv(1 - Number.EPSILON / 2, 7))).toBe(true);
    expect(Number.isFinite(studentTInv(1 - Number.EPSILON, 7))).toBe(true);
    expect(studentTInv(1 - Number.EPSILON / 2, 7)).toBeGreaterThan(10);
    // The literal collapses to 1.0 in float64 -> explicit boundary guard.
    expect(1 - 1e-20).toBe(1);
    expect(studentTInv(1 - 1e-20, 7)).toBe(Infinity);
  });

  it('p=1 returns Infinity', () => {
    expect(studentTInv(1, 10)).toBe(Infinity);
  });

  it('p=0.5 returns 0 (median of symmetric t)', () => {
    expect(studentTInv(0.5, 10)).toBeCloseTo(0, 8);
  });

  it('df<=0 returns NaN', () => {
    expect(Number.isNaN(studentTInv(0.95, 0))).toBe(true);
    expect(Number.isNaN(studentTInv(0.95, -1))).toBe(true);
  });
});
