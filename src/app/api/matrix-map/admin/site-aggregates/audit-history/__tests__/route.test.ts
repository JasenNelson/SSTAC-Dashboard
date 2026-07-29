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
  const captured: { column?: string; values?: unknown } = {};
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    // CAPTURE the filter arguments. Without this the role tests are vacuous:
    // stubbing a null row proves nothing about WHICH roles the route accepts,
    // and the suite would still pass if the `.in()` predicate were deleted and
    // the implementation accepted any returned role.
    in: vi.fn((column: string, values: unknown) => {
      captured.column = column;
      captured.values = values;
      return api;
    }),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => finalValue),
    captured,
  };
  return api;
}

function setupAdminClient(
  queryResult: unknown,
  options: { candidateResult?: unknown; role?: string | null; roleError?: unknown } = {},
) {
  const { candidateResult = { data: [], error: null }, role = 'matrix_admin', roleError = null } =
    options;

  // Name-aware: the route calls TWO distinct RPCs and they must not be conflated.
  const rpc = vi.fn(async (name: string) => {
    if (name === 'fetch_site_aggregate_publication_audit') return queryResult;
    if (name === 'fetch_site_aggregate_candidate_audit') return candidateResult;
    return { data: null, error: { message: `unexpected rpc: ${name}` } };
  });

  const chain = roleChain(
    roleError ? { data: null, error: roleError } : { data: role ? { role } : null, error: null },
  );

  const authClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: ADMIN_USER } },
        error: null,
      })),
    },
    from: vi.fn(() => chain),
    schema: vi.fn(() => ({ rpc })),
  };
  mocks.createServerClient.mockReturnValue(authClient);
  return { authClient, rpc, chain };
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

  it('returns BOTH audit trails, each scoped to the requested publication', async () => {
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
    const candidateRows = [
      {
        id: 'cand-audit-1',
        publication_id: PUBLICATION_ID,
        action: 'create',
        reason: 'initial candidate',
        changed_by_email: 'admin@example.com',
      },
    ];
    const { authClient, rpc } = setupAdminClient(
      { data: rows, error: null },
      { candidateResult: { data: candidateRows, error: null } },
    );

    const response = await GET(makeRequest(PUBLICATION_ID));

    expect(response.status).toBe(200);
    expect(authClient.schema).toHaveBeenCalledWith('matrix_map');
    expect(rpc).toHaveBeenCalledWith('fetch_site_aggregate_publication_audit', {
      p_publication_id: PUBLICATION_ID,
    });
    // Previously ZERO callers existed for this RPC, so candidate create/refresh
    // history was recorded but never surfaced anywhere.
    expect(rpc).toHaveBeenCalledWith('fetch_site_aggregate_candidate_audit', {
      p_publication_id: PUBLICATION_ID,
    });
    expect(await response.json()).toEqual({
      ok: true,
      publication_id: PUBLICATION_ID,
      rows,
      candidate_rows: candidateRows,
    });
  });

  it('maps publication audit RPC errors to query_failed without leaking the message', async () => {
    setupAdminClient({ data: null, error: { message: 'relation secret_table does not exist' } });

    const response = await GET(makeRequest(PUBLICATION_ID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('query_failed');
    expect(JSON.stringify(body)).not.toContain('secret_table');
  });

  it('fails CLOSED when the candidate audit trail cannot be read', async () => {
    // A partial audit history reads as "nothing happened", which is the most
    // misleading thing an audit surface can do.
    setupAdminClient(
      { data: [], error: null },
      { candidateResult: { data: null, error: { message: 'candidate audit unavailable' } } },
    );

    const response = await GET(makeRequest(PUBLICATION_ID));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('candidate_query_failed');
    expect(body.rows).toBeUndefined();
  });

  describe('admin allow-list', () => {
    it('restricts the role query to exactly admin and matrix_admin', async () => {
      // Non-vacuous: fails if a third role is added or the filter is removed.
      const { chain } = setupAdminClient({ data: [], error: null });

      await GET(makeRequest(PUBLICATION_ID));

      expect(chain.captured.column).toBe('role');
      expect(chain.captured.values).toEqual(['admin', 'matrix_admin']);
    });

    it.each(['admin', 'matrix_admin'])('accepts the %s role', async (role) => {
      const { rpc } = setupAdminClient({ data: [], error: null }, { role });

      const response = await GET(makeRequest(PUBLICATION_ID));

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalled();
    });

    it('fails CLOSED with 500 and no detail when the role query itself errors', async () => {
      const { authClient } = setupAdminClient(
        { data: [], error: null },
        { roleError: { message: 'permission denied for relation user_roles' } },
      );

      const response = await GET(makeRequest(PUBLICATION_ID));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: 'admin_role_query_failed' });
      // The message must NOT reach a caller whose admin status is unproven.
      expect(JSON.stringify(body)).not.toContain('user_roles');
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });
});
