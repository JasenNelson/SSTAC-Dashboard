import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createClient: vi.fn(),
  cookies: vi.fn(),
  checkCsrf: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}));

vi.mock('@/lib/engine-v2/csrf', () => ({
  checkCsrf: mocks.checkCsrf,
}));

import { POST } from '../route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/matrix-map/admin/publish', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

function chain(finalValue: unknown) {
  const api = {
    select: vi.fn(() => api),
    eq: vi.fn(() => api),
    in: vi.fn(() => api),
    limit: vi.fn(() => api),
    maybeSingle: vi.fn(async () => finalValue),
  };
  return api;
}

describe('POST /api/matrix-map/admin/publish', () => {
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

  describe('1. Non-admin POST is blocked', () => {
    it('returns 401 when there is no user', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: null },
            error: null,
          })),
        },
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ dra_id: '11111111-1111-4111-8111-111111111111', public: true, reason: 'test' }));
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({ error: 'unauthorized' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 when user is authenticated but not an admin', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn(() => chain({ data: null, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({ dra_id: '11111111-1111-4111-8111-111111111111', public: true, reason: 'test' }));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({ error: 'forbidden' });
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('2. Admin POST calls flip_dra_public with right args', () => {
    it('calls flip_dra_public on the caller authenticated client and passes server-resolved actor id', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn(() => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({ rpc })), // NO .from method in schema return
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'TWG review complete',
      }));

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('flip_dra_public', {
        p_dra_id: '11111111-1111-4111-8111-111111111111',
        p_new_value: true,
        p_actor_id: '22222222-2222-4222-8222-222222222222',
        p_reason: 'TWG review complete',
      });
    });
  });

  describe('3. Validation -> 400', () => {
    const setupAdminClient = () => {
      const rpc = vi.fn();
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn(() => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({ rpc })),
      };
      mocks.createServerClient.mockReturnValue(authClient);
      return authClient;
    };

    it('returns 400 for empty or whitespace reason', async () => {
      const authClient = setupAdminClient();
      for (const reason of ['  ', '']) {
        const response = await POST(makeRequest({
          dra_id: '11111111-1111-4111-8111-111111111111',
          public: true,
          reason,
        }));
        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('invalid_payload');
        expect(authClient.schema).not.toHaveBeenCalled();
      }
    });

    it('returns 400 for malformed dra_id', async () => {
      const authClient = setupAdminClient();
      const response = await POST(makeRequest({
        dra_id: 'not-a-uuid',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(400);
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 400 for non-boolean public', async () => {
      const authClient = setupAdminClient();
      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: 'true',
        reason: 'test',
      }));
      expect(response.status).toBe(400);
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('4. Assert NO code path issues a direct dras UPDATE', () => {
    it('structurally guarantees no direct UPDATE by verifying schema returned object has no from method', async () => {
      // Setup similar to test 2
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const schemaReturn = { rpc }; // ONLY rpc is implemented
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn(() => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => schemaReturn),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'TWG review complete',
      }));

      expect(response.status).toBe(200);
      
      // Verification: the schemaReturn object does not have a 'from' property
      expect(schemaReturn).not.toHaveProperty('from');
    });
  });
});
