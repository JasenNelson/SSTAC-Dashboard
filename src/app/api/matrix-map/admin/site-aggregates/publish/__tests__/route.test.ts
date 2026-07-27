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

function setupAdminClient(
  readbackPublic: boolean | null = true,
  rpcError: unknown = null,
  readbackError: unknown = null,
) {
  const rpc = vi.fn(async (name: string) => {
    if (name === 'flip_site_aggregate_public') {
      return { data: null, error: rpcError };
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
    from: vi.fn(() => roleChain({ data: { role: 'matrix_admin' }, error: null })),
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('calls the aggregate RPC with the server-resolved actor id and verifies read-back', async () => {
    const { rpc } = setupAdminClient(true);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: ' pilot publish ' }),
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('flip_site_aggregate_public', {
      p_publication_id: PUBLICATION_ID,
      p_new_value: true,
      p_actor_id: ADMIN_USER,
      p_reason: 'pilot publish',
    });
    expect(rpc).toHaveBeenCalledWith('fetch_admin_site_aggregate_publications', {
      p_publication_id: PUBLICATION_ID,
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
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
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'readback_failed' });
  });

  it('returns readback_missing when verification read-back returns no row after the flip', async () => {
    setupAdminClient(null);

    const response = await POST(
      makeRequest({ publication_id: PUBLICATION_ID, public: true, reason: 'pilot publish' }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'readback_missing' });
  });

});
