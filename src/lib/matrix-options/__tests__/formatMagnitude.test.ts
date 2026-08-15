import { describe, it, expect } from 'vitest';
import { formatMagnitude } from '../formatMagnitude';

describe('formatMagnitude', () => {
  it('never renders a sub-5e-5 value as zero (the P1-1 bug)', () => {
    const result = formatMagnitude(0.00003);
    expect(result).not.toBe('0');
    expect(result).not.toBe('0.0000');
    expect(result).toBe('0.00003000');
  });

  it('formats a value around 1e-4 with real significant digits, matching every slot', () => {
    // The exact repo-derivation value that showed the bug: toFixed(4)
    // rendered it as "0.0001" while toPrecision(4) rendered it as
    // "0.0001337" -- this is the toPrecision behaviour, now the only one.
    expect(formatMagnitude(0.0001337)).toBe('0.0001337');
    expect(formatMagnitude(0.000098592)).toBe('0.00009859');
  });

  it('formats a value around 1 with the legacy 4-decimal-place display (>= 0.1 threshold)', () => {
    expect(formatMagnitude(1.23456)).toBe('1.2346');
  });

  it('formats a large value with 4 decimal places, matching toFixed(4) exactly (P1-1b regression)', () => {
    expect(formatMagnitude(123456)).toBe('123456.0000');
    expect(formatMagnitude(1234567)).toBe('1234567.0000');
  });

  it('P1-1b regression: does not lose a digit relative to the pre-toPrecision display', () => {
    // The exact case from the P1-1b bug report: toFixed(4) gave "5.7516"
    // (5 significant figures); the toPrecision(4) regression gave "5.752"
    // (a digit dropped). The fix must reproduce the toFixed(4) string
    // exactly for this "normal magnitude" value.
    expect(formatMagnitude(5.7516)).toBe('5.7516');
    expect(formatMagnitude(10)).toBe('10.0000');
  });

  it('matches toFixed(4) exactly for every value at or above the 0.1 threshold', () => {
    const toFixedMatches = [0.1, 0.5, 1, 5, 5.7516, 10, 70.5, 100, 999.99999, 1234567];
    for (const v of toFixedMatches) {
      expect(formatMagnitude(v)).toBe(v.toFixed(4));
    }
  });

  it('formats exactly zero as "0", not "0.000"', () => {
    expect(formatMagnitude(0)).toBe('0');
  });

  it('returns the placeholder for null', () => {
    expect(formatMagnitude(null)).toBe('--');
    expect(formatMagnitude(null, { placeholder: 'n/a' })).toBe('n/a');
  });

  it('returns the placeholder for undefined', () => {
    expect(formatMagnitude(undefined)).toBe('--');
  });

  it('returns the placeholder for non-finite input instead of "NaN"', () => {
    expect(formatMagnitude(Number.NaN)).toBe('--');
    expect(formatMagnitude(Number.POSITIVE_INFINITY)).toBe('--');
  });

  it('formats a negative value with the sign preserved, matching toFixed(4)', () => {
    expect(formatMagnitude(-5.6789)).toBe('-5.6789');
  });

  it('never collapses a tiny negative value to zero either', () => {
    const result = formatMagnitude(-0.00003);
    expect(result).not.toBe('0');
    expect(result).not.toBe('-0.0000');
    expect(result).toBe('-0.00003000');
  });

  it('is deterministic across repeated calls for the same input', () => {
    expect(formatMagnitude(0.000098592)).toBe(formatMagnitude(0.000098592));
  });

  it('supports a caller-chosen significant-figure count', () => {
    expect(formatMagnitude(0.000098592, { significantFigures: 2 })).toBe('0.000099');
  });

  it('falls back to exponential notation for a very small magnitude instead of a long zero run', () => {
    expect(formatMagnitude(0.0000001)).toBe('1.000e-7');
    expect(formatMagnitude(-0.0000001)).toBe('-1.000e-7');
  });

  it('a large but plausible magnitude (1e6) still uses toFixed(4), not exponential', () => {
    // Well below UPPER_EXPONENTIAL_THRESHOLD (1e9) -- this is the "normal magnitude" large
    // case (P3 UI QA audit 2026-08-14 fix 3): a large equivalent/standard still renders as a
    // plain decimal, matching the historical toFixed(4) display exactly.
    expect(formatMagnitude(1000000)).toBe((1000000).toFixed(4));
    expect(formatMagnitude(1000000)).toBe('1000000.0000');
  });

  it('boundary: switches to exponential notation at UPPER_EXPONENTIAL_THRESHOLD (1e9)', () => {
    // Just below the threshold: still the toFixed(4) branch (a very long decimal string).
    expect(formatMagnitude(999999999)).toBe('999999999.0000');
    // At and above the threshold: exponential notation, bounding display width.
    expect(formatMagnitude(1e9)).toBe('1.000e+9');
    expect(formatMagnitude(-1e9)).toBe('-1.000e+9');
  });

  it('a pathologically large magnitude (1e15) renders as bounded exponential notation, not a 20+ character decimal string', () => {
    expect(formatMagnitude(1e15)).toBe('1.000e+15');
    expect(formatMagnitude(1e15).length).toBeLessThan(12);
  });

  it('boundary: is continuous across the 0.1 fixed-vs-significant-figure threshold, no digit-count jump', () => {
    // At and above 0.1: the toFixed(4) branch.
    expect(formatMagnitude(0.1)).toBe('0.1000');
    // Just below 0.1: the toPrecision(4) branch rounds up to the same
    // string as the boundary value -- the seam is continuous, not a jump.
    expect(formatMagnitude(0.099999999)).toBe('0.1000');
    // One decade further below: still a clean 4-significant-digit budget,
    // no sudden loss or gain of precision relative to the value just
    // above it.
    expect(formatMagnitude(0.0999)).toBe('0.09990');
    expect(formatMagnitude(0.01)).toBe('0.01000');
  });
});
