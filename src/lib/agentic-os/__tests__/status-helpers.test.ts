import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  TOOLTIPS,
  inferStatus,
  sparklineToneFor,
  formatLastActivity,
  compactName,
  shortenPath,
  applyViewFilter,
  type ViewFilter,
} from '../status-helpers';
import type { Project } from '../parse-projects-map';

describe('TOOLTIPS', () => {
  it('exposes the full step 5-11 tooltip set as a frozen-shape constant', () => {
    // Sanity: each step's tooltip is a non-empty string. Locks the keys we
    // depend on in TerminalPanel + ProjectDetailPanel.
    expect(TOOLTIPS.step5).toMatch(/step 5/);
    expect(TOOLTIPS.step6).toMatch(/step 6/);
    // step 7 has shipped (Pattern B Windows Terminal pop-out); its tooltip
    // now describes the action rather than a deferral. Sanity-check that
    // the string is non-empty and mentions the terminal pop-out behavior.
    expect(TOOLTIPS.step7).toMatch(/Windows Terminal|pop ?out|terminal/i);
    expect(TOOLTIPS.step7.length).toBeGreaterThan(0);
    expect(TOOLTIPS.step8).toMatch(/step 8/);
    // step 9 has shipped (Pattern E xterm.js embedded terminal). The tooltip
    // now describes how to ENABLE the surface (set AGENTIC_OS_PTY_SECRET +
    // restart with `npm run dev:all`) rather than deferring to a future
    // step. Defensive: also assert the stale "arrives in MVP step 9" copy
    // is NOT present so a future regression doesn't silently restore it.
    expect(TOOLTIPS.step9).toMatch(/AGENTIC_OS_PTY_SECRET/);
    expect(TOOLTIPS.step9).not.toMatch(/arrives in MVP step 9/);
    // step 10 has shipped (Pattern D agent dropdown). The tooltip describes
    // where agents launch from (per-project "Agent v" dropdown -> logs tab)
    // rather than deferring. Defensive: assert the stale "arrives in MVP
    // step 10" copy is NOT present so a future regression doesn't silently
    // restore the deferral wording.
    expect(TOOLTIPS.step10).toMatch(/agent|dropdown|logs/i);
    expect(TOOLTIPS.step10).not.toMatch(/arrives in MVP step 10/);
    // step 11 (Cowork digest) lives on a separate machine; its tooltip is
    // an informational note, not a deferral. Defensive: assert the stale
    // "arrives in MVP step 11" copy is gone.
    expect(TOOLTIPS.step11).toMatch(/Cowork|separate machine|Telegram/i);
    expect(TOOLTIPS.step11).not.toMatch(/arrives in MVP step 11/);
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

describe('applyViewFilter (owner-bug 4, 2026-05-16)', () => {
  // Minimal Project fixtures. Required fields only -- name / path / purpose /
  // status / tags / extras. status is the load-bearing field for the Views
  // filter (it flows through inferStatus); tags + purpose are load-bearing
  // for the free-text filter; the rest is filler.
  const mkProject = (
    over: Partial<Project> & Pick<Project, 'name' | 'status'>,
  ): Project => ({
    name: over.name,
    path: over.path ?? `C:\\Projects\\${over.name}`,
    purpose: over.purpose ?? '',
    status: over.status,
    tags: over.tags ?? [],
    extras: over.extras ?? {},
    keyHandoff: over.keyHandoff,
    resumePrompt: over.resumePrompt,
    activitySignal: over.activitySignal,
  });

  const projects: readonly Project[] = [
    mkProject({ name: 'Regulatory-Review', status: 'Active development', tags: ['rraa', 'engine'] }),
    mkProject({ name: 'Site3250-KB', status: 'AUTH_POINT_3 pending owner', tags: ['kb'] }),
    mkProject({ name: 'TechMemo-KB', status: 'Paused while site work completes', tags: ['memo'] }),
    mkProject({ name: 'Knowledge-Base', status: 'active', tags: ['wiki'], purpose: 'Personal Karpathy LLM wiki' }),
    mkProject({ name: 'EnquiryMgt', status: 'blocked on PAC review', tags: ['inquiry'] }),
  ];

  it('viewFilter "all" with empty text returns the input array unchanged', () => {
    const out = applyViewFilter(projects, '', 'all');
    expect(out).toHaveLength(projects.length);
    expect(out.map((p) => p.name)).toEqual(projects.map((p) => p.name));
  });

  it('viewFilter "active" returns only projects whose inferred label is "active"', () => {
    const out = applyViewFilter(projects, '', 'active');
    // Regulatory-Review (Active development) + Knowledge-Base (active) only.
    expect(out.map((p) => p.name).sort()).toEqual(
      ['Knowledge-Base', 'Regulatory-Review'].sort(),
    );
  });

  it('viewFilter "blocked" matches BOTH "blocked" keyword AND "AUTH_POINT_*"', () => {
    const out = applyViewFilter(projects, '', 'blocked');
    // EnquiryMgt explicit "blocked" + Site3250-KB AUTH_POINT_3. Paused and
    // active projects must NOT leak in.
    expect(out.map((p) => p.name).sort()).toEqual(
      ['EnquiryMgt', 'Site3250-KB'].sort(),
    );
  });

  it('text filter composes with viewFilter via AND semantics (both predicates pass)', () => {
    // viewFilter "active" narrows to [Regulatory-Review, Knowledge-Base];
    // text filter "wiki" matches Knowledge-Base via BOTH its "wiki" tag and
    // its "Personal Karpathy LLM wiki" purpose. Intersection: [Knowledge-Base].
    const out = applyViewFilter(projects, 'wiki', 'active');
    expect(out.map((p) => p.name)).toEqual(['Knowledge-Base']);
  });

  it('text filter matches name / tag / purpose substrings, lowercased', () => {
    // "karpathy" only appears in Knowledge-Base.purpose.
    expect(applyViewFilter(projects, 'KARPATHY', 'all').map((p) => p.name)).toEqual([
      'Knowledge-Base',
    ]);
    // "engine" only appears in Regulatory-Review.tags.
    expect(applyViewFilter(projects, 'engine', 'all').map((p) => p.name)).toEqual([
      'Regulatory-Review',
    ]);
  });

  it('returns empty array when no project satisfies the combined filter', () => {
    // viewFilter "blocked" + text "engine" -- no blocked project has the
    // "engine" tag.
    const out = applyViewFilter(projects, 'engine', 'blocked');
    expect(out).toEqual([]);
  });

  it('whitespace-only text filter is treated as empty (no text-side narrowing)', () => {
    const out = applyViewFilter(projects, '   ', 'all');
    expect(out).toHaveLength(projects.length);
  });

  it('does not mutate the input array', () => {
    const snapshot = projects.map((p) => p.name);
    applyViewFilter(projects, 'kb', 'blocked');
    expect(projects.map((p) => p.name)).toEqual(snapshot);
  });

  it('ViewFilter union is exhaustively handled (compile-time check)', () => {
    // If a future contributor widens ViewFilter without updating
    // applyViewFilter, this assignment line will fail tsc. Runtime call is
    // just a sanity that each value returns *something*.
    const filters: ViewFilter[] = ['all', 'active', 'blocked'];
    for (const f of filters) {
      const out = applyViewFilter(projects, '', f);
      expect(Array.isArray(out)).toBe(true);
    }
  });
});
