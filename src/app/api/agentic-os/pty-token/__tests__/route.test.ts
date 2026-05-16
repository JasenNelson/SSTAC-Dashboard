// Route-level tests for POST /api/agentic-os/pty-token (step 9 / Pattern E).
//
// Covers the 6-gate chain plus the PTY-specific gate 1b (secret + node-pty).
// Mocks the auth + CSRF helpers so the tests stay hermetic; the validator
// runs its real code path so the project-allowlist invariant is asserted
// transitively.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

vi.mock('@/lib/engine-v2/admin_guards', () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: vi.fn(),
}));
vi.mock('@/lib/agentic-os/launch-audit-log', () => ({
  appendLaunchAudit: vi.fn(),
}));

import { requireAdminForApi } from '@/lib/engine-v2/admin_guards';
import { checkCsrf } from '@/lib/engine-v2/csrf';
import { POST } from '../route';
import { __resetPtyModuleProbeForTest } from '@/lib/agentic-os/feature-flag-server';

const VALID_SECRET = 'test-pty-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

function makeReq(opts: {
  body?: unknown;
  bodyRaw?: string;
  origin?: string;
  referer?: string;
  contentType?: string;
} = {}): import('next/server').NextRequest {
  const ct = opts.contentType ?? 'application/json';
  const body = opts.bodyRaw ?? JSON.stringify(opts.body ?? { project: 'SSTAC-Dashboard', action: 'open_embedded' });
  const headers = new Headers({ 'content-type': ct });
  if (opts.origin !== undefined) headers.set('origin', opts.origin);
  if (opts.referer !== undefined) headers.set('referer', opts.referer);
  return {
    headers,
    nextUrl: { origin: opts.origin ?? 'http://localhost:3000' } as never,
    async json() {
      try {
        return JSON.parse(body) as unknown;
      } catch (e) {
        throw e;
      }
    },
  } as unknown as import('next/server').NextRequest;
}

function happyAuth() {
  (requireAdminForApi as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'u1', email: 'admin@example.com' },
  });
  (checkCsrf as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPtyModuleProbeForTest();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('AGENTIC_OS_PTY_SECRET', VALID_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/agentic-os/pty-token', () => {
  it('returns 403 when isAgenticOsLaunchEnabled is false', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AGENTIC_OS_LOCAL', '');
    happyAuth();
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.error).toBe('launch_disabled_in_non_dev');
  });

  it('returns 403 pty_disabled when AGENTIC_OS_PTY_SECRET is unset', async () => {
    vi.stubEnv('AGENTIC_OS_PTY_SECRET', '');
    happyAuth();
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.error).toBe('pty_disabled');
  });

  it('returns 403 localhost_only for an external origin', async () => {
    happyAuth();
    const resp = await POST(makeReq({ origin: 'https://evil.example.com' }));
    expect(resp.status).toBe(403);
    const body = await resp.json();
    expect(body.error).toBe('localhost_only');
  });

  it('returns 403 localhost_only when origin header is absent and referer is external', async () => {
    happyAuth();
    const resp = await POST(makeReq({ referer: 'https://evil.example.com/page' }));
    expect(resp.status).toBe(403);
  });

  it('passes localhost origin (127.0.0.1)', async () => {
    happyAuth();
    const resp = await POST(makeReq({ origin: 'http://127.0.0.1:3000' }));
    // Must reach later gates -- 200 on the happy path.
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('minted');
    expect(typeof body.token).toBe('string');
    expect(typeof body.runId).toBe('string');
    expect(typeof body.port).toBe('number');
  });

  it('returns 415 when CSRF rejects', async () => {
    happyAuth();
    (checkCsrf as ReturnType<typeof vi.fn>).mockReturnValue({
      ok: false, reason: 'csrf_reject', detail: 'content-type',
    });
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(415);
  });

  it('returns 401/403 when admin auth fails', async () => {
    (checkCsrf as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
    (requireAdminForApi as ReturnType<typeof vi.fn>).mockResolvedValue(
      NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    );
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(401);
  });

  it('rejects invalid JSON body with 400', async () => {
    happyAuth();
    const resp = await POST(makeReq({ origin: 'http://localhost:3000', bodyRaw: '{not json' }));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('invalid_payload');
  });

  it('rejects payload with action != open_embedded', async () => {
    happyAuth();
    const resp = await POST(makeReq({
      origin: 'http://localhost:3000',
      body: { project: 'SSTAC-Dashboard', action: 'run_safe_exit' },
    }));
    expect(resp.status).toBe(400);
  });

  it('rejects payload with unknown project (allowlist)', async () => {
    happyAuth();
    const resp = await POST(makeReq({
      origin: 'http://localhost:3000',
      body: { project: 'Some-Hostile-Project', action: 'open_embedded' },
    }));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('unknown_project');
  });

  it('happy path mints a JWT and returns {token, port, runId}', async () => {
    happyAuth();
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.status).toBe('minted');
    // Token is a JWT (three dot-separated b64 segments).
    expect(body.token.split('.').length).toBe(3);
    // runId is a UUID-ish string (36 chars).
    expect(body.runId.length).toBe(36);
    // Port is a positive integer.
    expect(Number.isInteger(body.port)).toBe(true);
    expect(body.port).toBeGreaterThan(0);
  });

  it('uses AGENTIC_OS_PTY_PORT when set; defaults otherwise', async () => {
    happyAuth();
    vi.stubEnv('AGENTIC_OS_PTY_PORT', '3199');
    const resp = await POST(makeReq({ origin: 'http://localhost:3000' }));
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.port).toBe(3199);
  });

  it('rejects strict-mode extra keys (smuggled fields)', async () => {
    happyAuth();
    const resp = await POST(makeReq({
      origin: 'http://localhost:3000',
      body: { project: 'SSTAC-Dashboard', action: 'open_embedded', extra: 'whoami' },
    }));
    expect(resp.status).toBe(400);
  });
});
