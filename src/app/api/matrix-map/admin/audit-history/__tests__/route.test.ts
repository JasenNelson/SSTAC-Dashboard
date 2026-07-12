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

function makeRequest(draId: string | null) {
  const url = new URL('http://localhost/api/matrix-map/admin/audit-history');
  if (draId !== null) url.searchParams.set('dra_id', draId);
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

function auditQueryChain(finalValue: unknown) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    order: vi.fn(() => api),
    limit: vi.fn(async () => finalValue),
  };
  return api;
}

const DRA_1 = '11111111-1111-4111-8111-111111111111';
const ADMIN_USER = '22222222-2222-4222-8222-222222222222';

function setupAdminClient(queryResult: unknown) {
  const audit = auditQueryChain(queryResult);
  const authClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: ADMIN_USER } },
        error: null,
      })),
    },
    from: vi.fn(() => roleChain({ data: { role: 'matrix_admin' }, error: null })),
    schema: vi.fn(() => ({ from: vi.fn(() => audit) })),
  };
  mocks.createServerClient.mockReturnValue(authClient);
  return { authClient, audit };
}

describe('GET /api/matrix-map/admin/audit-history', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    mocks.cookies.mockResolvedValue({
      get: vi.fn(),
      set: vi.fn(),
    });
  });

  describe('1. Non-admin GET is blocked', () => {
    it('returns 401 when there is no user', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
        },
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'unauthorized' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 when user is authenticated but not an admin', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: ADMIN_USER } },
            error: null,
          })),
        },
        from: vi.fn(() => roleChain({ data: null, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'forbidden' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('2. Validation', () => {
    it('returns 400 when dra_id is missing', async () => {
      const { authClient } = setupAdminClient({ data: [], error: null });
      const response = await GET(makeRequest(null));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_dra_id');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 400 when dra_id is not a UUID', async () => {
      const { authClient } = setupAdminClient({ data: [], error: null });
      const response = await GET(makeRequest('not-a-uuid'));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_dra_id');
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('3. Admin GET scopes the query to dra_id (per-DRA fix)', () => {
    it('queries matrix_map.dra_visibility_audit filtered by the requested dra_id and returns its rows', async () => {
      const rows = [
        {
          id: 'audit-1',
          dra_id: DRA_1,
          prior_value: false,
          new_value: true,
          changed_at: '2020-01-01T00:00:00.000Z',
          changed_by_email: 'admin@example.com',
          reason: 'Old change, correctly still returned',
        },
      ];
      const { authClient, audit } = setupAdminClient({ data: rows, error: null });

      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ ok: true, dra_id: DRA_1, rows });

      expect(authClient.schema).toHaveBeenCalledWith('matrix_map');
      expect(audit.eq).toHaveBeenCalledWith('dra_id', DRA_1);
      expect(audit.order).toHaveBeenCalledWith('changed_at', { ascending: false });
      expect(audit.limit).toHaveBeenCalledWith(50);
    });

    it('returns an empty rows array (not an error) when the DRA genuinely has no history', async () => {
      setupAdminClient({ data: [], error: null });
      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ ok: true, dra_id: DRA_1, rows: [] });
    });

    it('maps a query error to 500 query_failed rather than a false empty result', async () => {
      setupAdminClient({ data: null, error: { message: 'connection reset' } });
      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('query_failed');
    });

    it('accepts admin (not just matrix_admin) role', async () => {
      const audit = auditQueryChain({ data: [], error: null });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: ADMIN_USER } },
            error: null,
          })),
        },
        from: vi.fn(() => roleChain({ data: { role: 'admin' }, error: null })),
        schema: vi.fn(() => ({ from: vi.fn(() => audit) })),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await GET(makeRequest(DRA_1));
      expect(response.status).toBe(200);
    });
  });
});
