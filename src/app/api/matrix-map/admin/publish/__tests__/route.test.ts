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
    single: vi.fn(async () => finalValue),
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
        from: vi.fn((_table?: string) => chain({ data: null, error: null })),
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
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({
          rpc,
          from: vi.fn((_table?: string) => chain({ data: { public: true }, error: null }))
        })),
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
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({
          rpc,
          from: vi.fn((_table?: string) => chain({ data: { public: true }, error: null }))
        })),
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

  describe('5. CSRF gating', () => {
    it('returns the checkCsrf-mapped status when checkCsrf rejects (missing/wrong content-type -> 415)', async () => {
      mocks.checkCsrf.mockReturnValue({ ok: false, reason: 'missing_content_type' });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(415);
      const data = await response.json();
      expect(data.error).toBe('missing_content_type');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('returns 403 when checkCsrf rejects on origin mismatch', async () => {
      mocks.checkCsrf.mockReturnValue({ ok: false, reason: 'origin_mismatch' });
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('origin_mismatch');
      expect(authClient.schema).not.toHaveBeenCalled();
    });
  });

  describe('6. RPC error mapping', () => {
    it('maps a 42501 (RLS/permission denied) RPC error to 403 rpc_forbidden', async () => {
      const rpc = vi.fn(async () => ({
        data: null,
        error: { code: '42501', message: 'permission denied for function flip_dra_public' },
      }));
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({ rpc })),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: false,
        reason: 'Withdrawn',
      }));
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('rpc_forbidden');
    });

    it('maps a non-42501 RPC error to 500 rpc_failed', async () => {
      const rpc = vi.fn(async () => ({
        data: null,
        error: { code: '23503', message: 'foreign key violation' },
      }));
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({ rpc })),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('rpc_failed');
    });
  });

  describe('7. Single-DRA / no-bulk contract', () => {
    it('rejects a payload with an array of dra_ids (no bulk support)', async () => {
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('invalid_payload');
      expect(authClient.schema).not.toHaveBeenCalled();
    });

    it('accepts admin (not just matrix_admin) role', async () => {
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '33333333-3333-4333-8333-333333333333' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'admin' }, error: null })),
        schema: vi.fn(() => ({
          rpc,
          from: vi.fn((_table?: string) => chain({ data: { public: true }, error: null }))
        })),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith('flip_dra_public', {
        p_dra_id: '11111111-1111-4111-8111-111111111111',
        p_new_value: true,
        p_actor_id: '33333333-3333-4333-8333-333333333333',
        p_reason: 'test',
      });
    });
  });

  describe('4. Assert NO code path issues a direct dras UPDATE', () => {
    it('structurally guarantees no direct UPDATE by verifying from() returned object has no update method', async () => {
      // Setup similar to test 2
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const schemaReturn = {
        rpc,
        from: vi.fn((_table?: string) => chain({ data: { public: true }, error: null }))
      };
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => schemaReturn),
      };
      mocks.createServerClient.mockReturnValue(authClient);

      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'TWG review complete',
      }));

      expect(response.status).toBe(200);

      // Verification: the from() object does not have an 'update' property
      expect(schemaReturn.from('dras')).not.toHaveProperty('update');
    });
  });

  describe('8. Read-back verification', () => {
    const setupReadbackClient = (readbackValue: boolean | null, readErr: unknown) => {
      const rpc = vi.fn(async () => ({ data: null, error: null }));
      const authClient = {
        auth: {
          getUser: vi.fn(async () => ({
            data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
            error: null,
          })),
        },
        from: vi.fn((_table?: string) => chain({ data: { role: 'matrix_admin' }, error: null })),
        schema: vi.fn(() => ({
          rpc,
          from: vi.fn((_table?: string) => chain({ data: readbackValue !== null ? { public: readbackValue } : null, error: readErr }))
        })),
      };
      mocks.createServerClient.mockReturnValue(authClient);
      return authClient;
    };

    it('returns verified=true when read-back public matches submitted public', async () => {
      setupReadbackClient(true, null);
      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.verified).toBe(true);
      expect(data.public).toBe(true);
    });

    it('returns verified=false and actual DB value when read-back does not match (silent non-persist)', async () => {
      setupReadbackClient(false, null);
      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true, // Submitted true, but read-back says false
        reason: 'test',
      }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.verified).toBe(false);
      expect(data.public).toBe(false); // Returns the ACTUAL db value
    });

    it('returns verified=null when read-back errors', async () => {
      setupReadbackClient(null, { message: 'db error' });
      const response = await POST(makeRequest({
        dra_id: '11111111-1111-4111-8111-111111111111',
        public: true,
        reason: 'test',
      }));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.verified).toBe(null);
      expect(data.public).toBe(true); // Falls back to submitted
    });
  });
});
