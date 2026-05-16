import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  TOOLTIPS,
  inferStatus,
  sparklineToneFor,
  formatLastActivity,
  compactName,
  shortenPath,
} from '../status-helpers';

describe('TOOLTIPS', () => {
  it('exposes the full step 5-11 tooltip set as a frozen-shape constant', () => {
    // Sanity: each step's tooltip is a non-empty string. Locks the keys we
    // depend on in TerminalPanel + ProjectDetailPanel.
    expect(TOOLTIPS.step5).toMatch(/step 5/);
    expect(TOOLTIPS.step6).toMatch(/step 6/);
    expect(TOOLTIPS.step7).toMatch(/step 7/);
    expect(TOOLTIPS.step8).toMatch(/step 8/);
    expect(TOOLTIPS.step9).toMatch(/step 9/);
    expect(TOOLTIPS.step10).toMatch(/step 10/);
    expect(TOOLTIPS.step11).toMatch(/step 11/);
  });
});

describe('inferStatus', () => {
  it('maps "blocked" keyword to red + blocked label', () => {
    expect(inferStatus('Currently blocked on review')).toEqual({
      color: 'bg-red-400',
      label: 'blocked',
    });
  });

  it('treats AUTH_POINT keyword as blocked (owner-gated work)', () => {
    expect(inferStatus('Waiting at AUTH_POINT_3')).toEqual({
      color: 'bg-red-400',
      label: 'blocked',
    });
  });

  it('maps "paused" to amber + paused label', () => {
    expect(inferStatus('Paused pending owner decision')).toEqual({
      color: 'bg-amber-400',
      label: 'paused',
    });
  });

  it('maps "stale" to gray-500 + stale label', () => {
    expect(inferStatus('Stale -- no activity in 30+ days')).toEqual({
      color: 'bg-gray-500',
      label: 'stale',
    });
  });

  it('maps "done" and "archived" to gray-400 + done label', () => {
    expect(inferStatus('Done -- shipped').label).toBe('done');
    expect(inferStatus('Archived 2026-03').label).toBe('done');
  });

  it('defaults to active (emerald) for free-text status without keywords', () => {
    expect(inferStatus('Active review mode')).toEqual({
      color: 'bg-emerald-400',
      label: 'active',
    });
  });

  it('is case-insensitive (BLOCKED, Blocked, blocked all map to blocked)', () => {
    expect(inferStatus('BLOCKED').label).toBe('blocked');
    expect(inferStatus('Blocked').label).toBe('blocked');
    expect(inferStatus('bLoCkEd').label).toBe('blocked');
  });

  it('honors priority: blocked beats paused beats stale beats done', () => {
    // Owner is unlikely to author this but the precedence rule is load-bearing
    // for any future automated status authoring -- lock it.
    expect(inferStatus('paused, blocked, stale, done').label).toBe('blocked');
    expect(inferStatus('paused, stale, done').label).toBe('paused');
    expect(inferStatus('stale, done').label).toBe('stale');
  });
});

describe('sparklineToneFor', () => {
  it('returns "blocked" tone only for the exact "blocked" label', () => {
    expect(sparklineToneFor('blocked')).toBe('blocked');
  });

  it('returns "active" tone for the active label', () => {
    expect(sparklineToneFor('active')).toBe('active');
  });

  it('returns "active" tone for any non-blocked label (paused, stale, done)', () => {
    // Sparkline's own total===0 path overrides to "idle"; sparklineToneFor's
    // job is only the blocked-vs-not-blocked split.
    expect(sparklineToneFor('paused')).toBe('active');
    expect(sparklineToneFor('stale')).toBe('active');
    expect(sparklineToneFor('done')).toBe('active');
  });
});

describe('formatLastActivity', () => {
  // Deterministic clock so the "minutes / hours / days" branches are stable
  // across CI hosts. Use 2026-05-15T12:00:00Z as the reference "now".
  const NOW = new Date('2026-05-15T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns em-dash for null input', () => {
    expect(formatLastActivity(null)).toBe('—');
  });

  it('returns em-dash for an unparseable ISO string', () => {
    expect(formatLastActivity('not a date at all')).toBe('—');
  });

  it('returns "just now" for a future timestamp (clock-skew tolerant)', () => {
    const future = new Date(NOW + 60_000).toISOString();
    expect(formatLastActivity(future)).toBe('just now');
  });

  it('formats <60-minute deltas as "Xm" with a 1m floor', () => {
    // 30 seconds ago floors to 0 minutes -> displays "1m" (no "0m").
    expect(formatLastActivity(new Date(NOW - 30_000).toISOString())).toBe('1m');
    // 5 minutes ago -> "5m"
    expect(formatLastActivity(new Date(NOW - 5 * 60_000).toISOString())).toBe(
      '5m'
    );
  });

  it('formats <24-hour deltas as "Xh"', () => {
    expect(
      formatLastActivity(new Date(NOW - 3 * 60 * 60_000).toISOString())
    ).toBe('3h');
  });

  it('formats <30-day deltas as "Xd"', () => {
    expect(
      formatLastActivity(new Date(NOW - 5 * 24 * 60 * 60_000).toISOString())
    ).toBe('5d');
  });

  it('formats >=30-day deltas as a locale "Mon DD" date', () => {
    // 60 days before 2026-05-15 -> mid-March 2026. Don't pin the exact locale
    // string (CI hosts vary); assert it's no longer the "Xd" form.
    const old = new Date(NOW - 60 * 24 * 60 * 60_000).toISOString();
    const out = formatLastActivity(old);
    expect(out).not.toMatch(/^\d+d$/);
    expect(out).not.toMatch(/^\d+h$/);
    expect(out).not.toMatch(/^\d+m$/);
    expect(out).not.toBe('—');
    expect(out).not.toBe('just now');
  });
});

describe('compactName', () => {
  it('lowercases mixed-case names', () => {
    expect(compactName('Regulatory-Review')).toBe('regulatory-review');
    expect(compactName('SSTAC-Dashboard')).toBe('sstac-dashboard');
  });

  it('returns already-lowercase names unchanged', () => {
    expect(compactName('engine-v2')).toBe('engine-v2');
  });
});

describe('shortenPath', () => {
  it('rewrites Windows C:\\Projects\\<name>\\ to ~/Projects/<name>', () => {
    expect(shortenPath('C:\\Projects\\Regulatory-Review\\')).toBe(
      '~/Projects/Regulatory-Review'
    );
  });

  it('rewrites without a trailing backslash too', () => {
    expect(shortenPath('D:\\Projects\\Site3250-KB')).toBe(
      '~/Projects/Site3250-KB'
    );
  });

  it('preserves nested segments under Projects and normalizes slashes', () => {
    expect(shortenPath('C:\\Projects\\foo\\bar\\baz')).toBe(
      '~/Projects/foo/bar/baz'
    );
  });

  it('returns the input unchanged when it does not match the convention', () => {
    expect(shortenPath('/home/user/work')).toBe('/home/user/work');
    expect(shortenPath('C:\\Users\\jasen\\Documents')).toBe(
      'C:\\Users\\jasen\\Documents'
    );
  });

  it('returns empty string for empty input', () => {
    expect(shortenPath('')).toBe('');
  });
});
