// Step 9 / Pattern E: regression test for the open_embedded guard on the
// /api/agentic-os/launch route. open_embedded MUST go through
// /api/agentic-os/pty-token, NOT through /launch -- the launch route would
// otherwise pipe-spawn `claude --resume` as a Pattern-A-style child, which
// would steal the run-card slot the PTY sidecar is supposed to own.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/engine-v2/admin_guards', () => ({
  requireAdminForApi: vi.fn(),
}));
vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: vi.fn(),
}));
vi.mock('@/lib/agentic-os/launch-audit-log', () => ({
  appendLaunchAudit: vi.fn(),
}));
vi.mock('@/lib/agentic-os/launch-runs', () => ({
  registerRun: vi.fn(),
}));
vi.mock('@/lib/agentic-os/spawn-await-ready', () => ({
  spawnAwaitingReady: vi.fn(),
}));

import { requireAdminForApi } from '@/lib/engine-v2/admin_guards';
import { checkCsrf } from '@/lib/engine-v2/csrf';
import { spawnAwaitingReady } from '@/lib/agentic-os/spawn-await-ready';
import { POST } from '../route';

function makeReq(body: unknown): import('next/server').NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  });
  return {
    headers,
    nextUrl: { origin: 'http://localhost:3000' } as never,
    async json() { return body; },
  } as unknown as import('next/server').NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'development');
  (requireAdminForApi as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: 'u1', email: 'admin@example.com' },
  });
  (checkCsrf as ReturnType<typeof vi.fn>).mockReturnValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/agentic-os/launch open_embedded guard (step 9)', () => {
  it('rejects open_embedded with 400 use_pty_token_route and does NOT spawn', async () => {
    const resp = await POST(
      makeReq({ project: 'SSTAC-Dashboard', action: 'open_embedded' }),
    );
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe('use_pty_token_route');
    expect(spawnAwaitingReady).not.toHaveBeenCalled();
  });

  it('still accepts Pattern-A actions through this route', async () => {
    // The spawnAwaitingReady mock returns a fake child with the minimum
    // shape registerRun/launch-route needs. Without an explicit return
    // value the route would 500 -- this test isn't asserting that path
    // since the guard is what we care about; we just verify the guard
    // doesn't accidentally reject non-open_embedded actions.
    (spawnAwaitingReady as ReturnType<typeof vi.fn>).mockResolvedValue({
      pid: 12345,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
    });
    const resp = await POST(
      makeReq({ project: 'SSTAC-Dashboard', action: 'run_safe_exit' }),
    );
    // Either 200 (spawn happy) or 500 (mock incomplete). The relevant
    // assertion is that we got PAST the guard, so 400 use_pty_token_route
    // is the failure mode we explicitly check for.
    expect(resp.status).not.toBe(400);
  });
});
