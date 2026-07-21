// Route-level tests for GET /api/health (Top-50 row 2 deploy-health probe).
//
// The handler reads only process.env (VERCEL_GIT_COMMIT_SHA, VERCEL_ENV) and
// emits a fixed JSON shape. Tests drive the env directly and assert the shape,
// the short-SHA slicing, and the fallbacks.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';

const ORIGINAL = { sha: process.env.VERCEL_GIT_COMMIT_SHA, env: process.env.VERCEL_ENV };

describe('GET /api/health', () => {
  beforeEach(() => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    if (ORIGINAL.sha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = ORIGINAL.sha;
    if (ORIGINAL.env === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = ORIGINAL.env;
  });

  it('returns 200 with status ok and the required fields', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890';
    process.env.VERCEL_ENV = 'production';
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.env).toBe('production');
    expect(typeof body.timestamp).toBe('string');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it('returns the FULL commit SHA (so a drift check can use Git\'s own abbreviation length)', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890abcdef1234567890abcdef12';
    const body = await GET().json();
    expect(body.sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
  });

  it("falls back to 'unknown' when env vars are unset", async () => {
    const body = await GET().json();
    expect(body.sha).toBe('unknown');
    expect(body.env).toBe('unknown');
  });
});
