// Guards for check-prod-sha-drift.mjs (READ-ONLY prod deploy-health drift check, Top-50 row 2).
// Pure/injected inputs -- no network, no git. Plain ASCII.

import { describe, it, expect } from 'vitest';
import { isAligned, evaluateDrift } from '../check-prod-sha-drift.mjs';

const FULL = 'c8d920eaceeef882bfa04b907d03c634e1e6b642'; // a real 40-char SHA shape
const SHORT7 = 'c8d920e'; // Git's default 7-char abbreviation of FULL
const OTHER = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

// Build a minimal fetch Response stub. `throwErr` simulates a network failure.
function stubFetch({ ok = true, status = 200, body = {}, throwErr = null } = {}) {
  return async () => {
    if (throwErr) throw throwErr;
    return {
      ok,
      status,
      json: async () => body,
    };
  };
}

describe('isAligned', () => {
  it('matches when the deployed SHA starts with the full expected abbreviation', () => {
    expect(isAligned(FULL, SHORT7)).toBe(true);
    expect(isAligned(FULL, FULL)).toBe(true);
    expect(isAligned(FULL, 'c8d920eaceee')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAligned(FULL.toUpperCase(), SHORT7)).toBe(true);
    expect(isAligned(FULL, SHORT7.toUpperCase())).toBe(true);
  });

  it('does not match a different commit', () => {
    expect(isAligned(OTHER, SHORT7)).toBe(false);
    expect(isAligned(OTHER, FULL)).toBe(false);
  });

  it('rejects a deployed SHA shorter than the expected abbreviation (ambiguity guard)', () => {
    // If git had to disambiguate to a longer abbreviation, a 7-char deployed value
    // must NOT be treated as a match -- it could share only the first 7 chars.
    expect(isAligned(SHORT7, FULL)).toBe(false);
    expect(isAligned('c8d920e', 'c8d920eaceee')).toBe(false);
  });

  it('treats empty/missing expected as not aligned', () => {
    expect(isAligned(FULL, '')).toBe(false);
    expect(isAligned(FULL, null)).toBe(false);
    expect(isAligned(FULL, undefined)).toBe(false);
  });
});

describe('evaluateDrift exit codes', () => {
  it('exit 0 ALIGNED when the deployed SHA matches', async () => {
    const r = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ body: { sha: FULL, env: 'production' } }),
    });
    expect(r.code).toBe(0);
    expect(r.stream).toBe('out');
    expect(r.message).toContain('ALIGNED');
  });

  it('exit 1 DRIFT when the deployed SHA differs', async () => {
    const r = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ body: { sha: OTHER, env: 'production' } }),
    });
    expect(r.code).toBe(1);
    expect(r.stream).toBe('err');
    expect(r.message).toContain('DRIFT');
  });

  it('exit 2 UNREACHABLE when prod URL is missing', async () => {
    const r = await evaluateDrift({ prodUrl: '', expected: SHORT7, fetchFn: stubFetch() });
    expect(r.code).toBe(2);
    expect(r.message).toContain('no prod URL');
  });

  it('exit 2 UNREACHABLE when the expected SHA is missing', async () => {
    const r = await evaluateDrift({ prodUrl: 'https://example.test', expected: '', fetchFn: stubFetch() });
    expect(r.code).toBe(2);
    expect(r.message).toContain('no expected SHA');
  });

  it('exit 2 UNREACHABLE on a non-OK HTTP status', async () => {
    const r = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ ok: false, status: 503 }),
    });
    expect(r.code).toBe(2);
    expect(r.message).toContain('HTTP 503');
  });

  it('exit 2 UNREACHABLE when the fetch throws', async () => {
    const r = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ throwErr: new Error('ECONNREFUSED') }),
    });
    expect(r.code).toBe(2);
    expect(r.message).toContain('ECONNREFUSED');
  });

  it('exit 2 UNREACHABLE when /api/health reports no build SHA', async () => {
    const missing = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ body: { env: 'production' } }),
    });
    expect(missing.code).toBe(2);

    const unknown = await evaluateDrift({
      prodUrl: 'https://example.test',
      expected: SHORT7,
      fetchFn: stubFetch({ body: { sha: 'unknown', env: 'production' } }),
    });
    expect(unknown.code).toBe(2);
  });

  it('strips a trailing slash from the prod URL before appending /api/health', async () => {
    let calledUrl = null;
    const fetchFn = async (u) => {
      calledUrl = u;
      return { ok: true, status: 200, json: async () => ({ sha: FULL, env: 'production' }) };
    };
    const r = await evaluateDrift({ prodUrl: 'https://example.test/', expected: SHORT7, fetchFn });
    expect(calledUrl).toBe('https://example.test/api/health');
    expect(r.code).toBe(0);
  });
});
