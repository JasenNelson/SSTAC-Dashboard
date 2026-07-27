import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

import { GET } from '../route';

const PUBLICATION_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER = '22222222-2222-4222-8222-222222222222';

function makeRequest(publicationId: string | null) {
  const url = new URL('http://localhost/api/matrix-map/admin/site-aggregates/audit-history');
  if (publicationId !== null) url.searchParams.set('publication_id', publicationId);
  return new NextRequest(url);
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

function setupAdminClient(queryResult: unknown) {
  const rpc = vi.fn(async () => queryResult);
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

describe('GET /api/matrix-map/admin/site-aggregates/audit-history', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.cookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    });
  });

  it('returns 401 when there is no user', async () => {
    const authClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
      schema: vi.fn(),
    };
    mocks.createServerClient.mockReturnValue(authClient);

    const response = await GET(makeRequest(PUBLICATION_ID));

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

    const response = await GET(makeRequest(PUBLICATION_ID));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('requires a publication_id UUID', async () => {
    const { authClient } = setupAdminClient({ data: [], error: null });

    const missing = await GET(makeRequest(null));
    const malformed = await GET(makeRequest('not-a-uuid'));

    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toBe('invalid_publication_id');
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe('invalid_publication_id');
    expect(authClient.schema).not.toHaveBeenCalled();
  });

  it('calls only the aggregate audit RPC scoped to the requested publication', async () => {
    const rows = [
      {
        id: 'audit-1',
        publication_id: PUBLICATION_ID,
        prior_value: false,
        new_value: true,
        changed_by_email: 'admin@example.com',
        reason: 'pilot publish',
      },
    ];
    const { authClient, rpc } = setupAdminClient({ data: rows, error: null });

    const response = await GET(makeRequest(PUBLICATION_ID));

    expect(response.status).toBe(200);
    expect(authClient.schema).toHaveBeenCalledWith('matrix_map');
    expect(rpc).toHaveBeenCalledWith('fetch_site_aggregate_publication_audit', {
      p_publication_id: PUBLICATION_ID,
    });
    expect(await response.json()).toEqual({
      ok: true,
      publication_id: PUBLICATION_ID,
      rows,
    });
  });

  it('maps RPC errors to query_failed', async () => {
    setupAdminClient({ data: null, error: { message: 'connection reset' } });

    const response = await GET(makeRequest(PUBLICATION_ID));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('query_failed');
  });
});
