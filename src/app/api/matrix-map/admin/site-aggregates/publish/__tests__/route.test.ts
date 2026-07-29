import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  checkCsrf: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: mocks.checkCsrf,
}));

import { POST } from '../route';

const EXPECTED_UPDATED_AT = '2026-07-28T00:00:00.123456+00:00';
const PUBLICATION_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER = '22222222-2222-4222-8222-222222222222';

function makeRequest(body: unknown) {
  return new NextRequest(
    'http://localhost/api/matrix-map/admin/site-aggregates/publish',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify(body),
    },
  );
}

function roleChain(finalValue: unknown) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => finalValue),
  };
  return api;
}

/**
 * The HTTP status PostgREST reports for a given SQLSTATE -- for the SMALL set of
 * codes this suite actually uses and whose mapping is certain.
 *
 * It deliberately REFUSES to guess. Earlier versions tried to model PostgREST's
 * whole mapping table and were wrong six times running (custom `UE*` codes,
 * the `40*` rollback class, `PTxyz` overrides, the v12+ `53400` / `54*`
 * behaviour, PostgREST-native `PGRST***` codes). Each wrong entry silently
 * produced an impossible status/code pair and exercised the wrong branch of the
 * classifier -- the exact failure this helper exists to prevent.
 *
 * Modelling an upstream mapping that varies by PostgREST version, from a repo
 * with no PostgREST to test against, cannot be made reliable by adding more
 * entries. So an unmodelled code is a hard ERROR -- as is a MISSING code and a
 * malformed one (a SQLSTATE is exactly five uppercase alphanumerics). Pass
 * `rpcStatus` explicitly and state the pairing you mean to test.
 */
function realisticPostgrestStatus(code: unknown): number {
  const refuse = (why: string): never => {
    throw new Error(
      `realisticPostgrestStatus: ${why}. Pass an explicit rpcStatus instead of ` +
        'relying on a guessed default.',
    );
  };
  // A code-less error is NOT implicitly a 500: a code-less PostgREST or client
  // error can accompany several statuses, so guessing one silently invents the
  // pairing under test.
  if (typeof code !== 'string') refuse('the error carries no SQLSTATE');
  // A SQLSTATE is EXACTLY five uppercase alphanumerics. Anything else cannot be
  // one, so prefix matching must not accept it -- `UEfoobar` is not a code.
  if (!/^[A-Z0-9]{5}$/.test(code as string)) {
    refuse(`"${code as string}" is not a well-formed SQLSTATE`);
  }
  const sqlstate = code as string;
  // PostgREST's explicit override: the three characters after `PT` ARE the status.
  const ptOverride = /^PT(\d{3})$/.exec(sqlstate);
  if (ptOverride) return Number(ptOverride[1]);
  if (sqlstate === '55P03') return 500; // lock_not_available, the one 5xx pre-commit code
  if (sqlstate === '42501') return 403; // insufficient_privilege, authenticated
  if (sqlstate.startsWith('XX')) return 500; // internal_error class
  if (sqlstate.startsWith('UE')) return 400; // our own codes, via PostgREST's catch-all
  return refuse(`no certain mapping for SQLSTATE "${sqlstate}"`);
}

function setupAdminClient(
  readbackPublic: boolean | null = true,
  rpcError: unknown = null,
  readbackError: unknown = null,
  // HTTP status postgrest-js reports for the mutation RPC. 0 = transport
  // failure. Defaults to what PostgREST would REALLY return for that code.
  rpcStatus: number = rpcError
    ? realisticPostgrestStatus((rpcError as { code?: unknown }).code)
    : 200,
  roleError: unknown = null,
) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'flip_site_aggregate_public') {
      return { data: null, error: rpcError, status: rpcStatus };
    }
    if (name === 'fetch_admin_site_aggregate_publications') {
      return {
        data:
          readbackPublic === null
            ? []
            : [{ publication_id: PUBLICATION_ID, is_published: readbackPublic }],
        error: readbackError,
      };
    }
    return { data: null, error: { message: `unexpected rpc: ${name}` } };
  });
  const authClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: ADMIN_USER } },
        error: null,
      })),
    },
    from: vi.fn(() =>
      roleChain(
        roleError ? { data: null, error: roleError } : { data: { role: 'matrix_admin' }, error: null },
      ),
    ),
    schema: vi.fn(() => ({ rpc })),
  };
  mocks.createServerClient.mockReturnValue(authClient);
  return { authClient, rpc };
}

describe('POST /api/matrix-map/admin/site-aggregates/publish', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.cookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    });
    mocks.checkCsrf.mockReturnValue({ ok: true });
  });

  it('returns 401 when there is no user', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      schema: vi.fn(),
    };
    mocks.createServerClient.mockReturnValue(authClient);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('returns 403 when the user is not a Matrix Map admin', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: ADMIN_USER } }, error: null })),
      },
      from: vi.fn(() => roleChain({ data: null, error: null })),
      schema: vi.fn(),
    };
    mocks.createServerClient.mockReturnValue(authClient);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('calls the aggregate RPC with the server-resolved actor id and verifies read-back', async () => {
    const { rpc } = setupAdminClient(true);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: ' pilot publish ', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('flip_site_aggregate_public', {
      p_publication_id: PUBLICATION_ID,
      p_new_value: true,
      p_actor_id: ADMIN_USER,
      p_reason: 'pilot publish',
      p_expected_updated_at: EXPECTED_UPDATED_AT,
    });
    // Bounds are stated explicitly: the RPC has no argument defaults, so a
    // caller cannot inherit an unbounded page.
    expect(rpc).toHaveBeenCalledWith('fetch_admin_site_aggregate_publications', {
      p_publication_id: PUBLICATION_ID,
      p_limit: 1,
      p_offset: 0,
    });
    expect(await response.json()).toEqual({
      ok: true,
      publication_id: PUBLICATION_ID,
      public: true,
      verified: true,
    });
  });

  it('does not call the DRA publication RPC', async () => {
    const { rpc } = setupAdminClient(true);

    await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(rpc).not.toHaveBeenCalledWith('flip_dra_public', expect.anything());
  });

  it('rejects bulk publication payloads', async () => {
    const { authClient } = setupAdminClient(true);

    const response = await POST(
      makeRequest({
        publication_id: [PUBLICATION_ID, '33333333-3333-4333-8333-333333333333'],
        public: true,
        reason: 'bulk publish',
      }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_payload');
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('rejects empty reasons before calling the aggregate RPC', async () => {
    const { authClient } = setupAdminClient(true);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: '   ' }),
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid_payload');
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('returns the CSRF rejection before calling the aggregate RPC', async () => {
    mocks.checkCsrf.mockReturnValue({ ok: false, reason: 'origin_mismatch' });
    const { authClient } = setupAdminClient(true);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('origin_mismatch');
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('maps permission errors to 403', async () => {
    setupAdminClient(null, { code: '42501', message: 'permission denied' });

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: false, reason: 'hold pilot' }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error).toBe('rpc_forbidden');
  });

  it('returns verified=false when read-back does not match the requested value', async () => {
    setupAdminClient(false);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.verified).toBe(false);
    expect(data.public).toBe(false);
    expect(data.ok).toBeUndefined();
  });

  it('returns readback_failed when verification read-back errors after the flip', async () => {
    setupAdminClient(true, null, { message: 'read failed' });

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    // POST-COMMIT: the flip already committed, so this must NOT be a retryable
    // 5xx. A retry would issue a SECOND visibility change plus another audit
    // entry against an already-changed publication.
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('readback_failed');
    expect(body.committed).toBe(true);
    expect(body.verified).toBe(false);
    expect(body.retry_safe).toBe(false);
    expect(body.detail).toMatch(/do not retry/i);
  });

  it('returns readback_missing when verification read-back returns no row after the flip', async () => {
    setupAdminClient(null);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('readback_missing');
    expect(body.committed).toBe(true);
    expect(body.verified).toBe(false);
    expect(body.retry_safe).toBe(false);
    expect(body.detail).toMatch(/do not retry/i);
  });


  describe('commit-outcome classification (mirrors the candidate route)', () => {
    // This branch is a SEPARATE implementation from the candidate route's.
    // Candidate-route coverage cannot protect it, so the realistic transport,
    // unrecognized-5xx, allow-listed-5xx and role-failure cases are all
    // exercised here directly.
    const body = { publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish', expected_updated_at: EXPECTED_UPDATED_AT };

    it('treats a TRANSPORT failure (status 0) as commit-INDETERMINATE', async () => {
      const { rpc } = setupAdminClient(true, { message: 'fetch failed' }, null, 0);

      const response = await POST(makeRequest(body));
      const parsed = await response.json();

      expect(response.status).toBe(409);
      expect(parsed.error).toBe('commit_indeterminate');
      expect(parsed.committed).toBeNull();
      expect(parsed.retry_safe).toBe(false);
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['an unrecognized code', { code: 'XX999', message: 'gateway' }, 500],
      ['no code at all', { code: undefined, message: 'gateway' }, 500],
      // A FORGED application code in an anomalous 5xx body must NOT be
      // trusted: PostgREST reports UE* codes at 400, so UE409 at 500 did not
      // come from PostgREST and the outcome is genuinely unknown.
      ['a forged UE409', { code: 'UE409', message: 'gateway' }, 500],
      // 55P03 is exempt ONLY at exactly 500; any other 5xx pairing is a
      // gateway anomaly and must fail closed.
      ['55P03 at 502', { code: '55P03', message: 'bad gateway' }, 502],
      ['55P03 at 503', { code: '55P03', message: 'unavailable' }, 503],
      ['55P03 at 504', { code: '55P03', message: 'timeout' }, 504],
    ])('treats %s as commit-INDETERMINATE', async (_label, rpcError, anomalousStatus) => {
      setupAdminClient(true, rpcError, null, anomalousStatus);

      const response = await POST(makeRequest(body));
      const parsed = await response.json();

      expect(response.status).toBe(409);
      expect(parsed.error).toBe('commit_indeterminate');
      expect(parsed.committed).toBeNull();
      expect(parsed.retry_safe).toBe(false);
    });

    it('maps 55P03 lock contention at HTTP 500 to a retryable 409', async () => {
      // 55P03 is the ONE code PostgREST reports at 5xx that is definitionally
      // pre-commit: the LOCK ... NOWAIT failed, so the mutation never ran.
      setupAdminClient(true, { code: '55P03', message: 'lock not available' }, null, 500);

      const response = await POST(makeRequest(body));
      const parsed = await response.json();

      expect(response.status).toBe(409);
      expect(parsed.error).toBe('conflict');
      expect(parsed.committed).toBe(false);
      expect(parsed.retry_safe).toBe(true);
    });

    it('states PRE-commit semantics when the admin role lookup fails, and calls no RPC', async () => {
      const { rpc } = setupAdminClient(true, null, null, 200, { message: 'role lookup exploded' });

      const response = await POST(makeRequest(body));
      const parsed = await response.json();

      expect(response.status).toBe(500);
      expect(parsed.error).toBe('admin_role_query_failed');
      expect(parsed.committed).toBe(false);
      expect(parsed.retry_safe).toBe(true);
      // Nothing was written, and nothing may be attempted after the failure.
      expect(rpc).not.toHaveBeenCalled();
    });
  });

});
