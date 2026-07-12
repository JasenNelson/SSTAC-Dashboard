import { describe, it, expect } from 'vitest';
import { computeCapAlert, CAP_ALERT_THRESHOLD } from '../cap-alert';

describe('computeCapAlert', () => {
  it('exposes the threshold as 0.9 (90%)', () => {
    expect(CAP_ALERT_THRESHOLD).toBe(0.9);
  });

  it('returns ok below the threshold', () => {
    const result = computeCapAlert(4486, 5000); // 89.72%
    expect(result.level).toBe('ok');
    expect(result.pct).toBeCloseTo(0.8972, 4);
  });

  it('returns ok well below the threshold', () => {
    const result = computeCapAlert(100, 5000);
    expect(result.level).toBe('ok');
    expect(result.pct).toBeCloseTo(0.02, 4);
  });

  it('returns warning exactly at the threshold', () => {
    const result = computeCapAlert(4500, 5000); // exactly 90%
    expect(result.level).toBe('warning');
    expect(result.pct).toBeCloseTo(0.9, 5);
  });

  it('returns warning above the threshold', () => {
    const result = computeCapAlert(4900, 5000); // 98%
    expect(result.level).toBe('warning');
    expect(result.pct).toBeCloseTo(0.98, 4);
  });

  it('returns warning when the count exceeds the cap (post-truncation)', () => {
    const result = computeCapAlert(5200, 5000);
    expect(result.level).toBe('warning');
    expect(result.pct).toBeGreaterThan(1);
  });

  it('fails closed to indeterminate when sampleCount is null', () => {
    const result = computeCapAlert(null, 5000);
    expect(result.level).toBe('indeterminate');
    expect(result.pct).toBeNull();
  });

  it('fails closed to indeterminate when deployedCap is null', () => {
    const result = computeCapAlert(4486, null);
    expect(result.level).toBe('indeterminate');
    expect(result.pct).toBeNull();
  });

  it('fails closed to indeterminate when both are undefined', () => {
    const result = computeCapAlert(undefined, undefined);
    expect(result.level).toBe('indeterminate');
    expect(result.pct).toBeNull();
  });

  it('fails closed to indeterminate when deployedCap is zero or negative', () => {
    expect(computeCapAlert(100, 0).level).toBe('indeterminate');
    expect(computeCapAlert(100, -5).level).toBe('indeterminate');
  });

  it('fails closed to indeterminate on non-finite input', () => {
    expect(computeCapAlert(NaN, 5000).level).toBe('indeterminate');
    expect(computeCapAlert(4486, Infinity).level).toBe('indeterminate');
  });

  it('fails closed to indeterminate on negative sample count', () => {
    expect(computeCapAlert(-1, 5000).level).toBe('indeterminate');
  });
});
