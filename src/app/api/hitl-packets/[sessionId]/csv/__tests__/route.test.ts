import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import fs from 'fs';

vi.mock('fs', () => ({
  default: { readFileSync: () => 'csv content' },
}));

vi.mock('@/lib/hitl-packets', () => ({
  isValidSessionId: () => true,
  getArtifactPath: () => '/path/to.csv',
}));

const mockGetAuthenticatedUser = vi.fn();
const mockCreateAuthenticatedClient = vi.fn();
vi.mock('@/lib/supabase-auth', () => ({
  createAuthenticatedClient: () => mockCreateAuthenticatedClient(),
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

function makeClient(
  roleResult: { data: { role: string } | null; error: { message: string } | null }
) {
  const calls: { eqArgs?: unknown[]; inArgs?: unknown[] } = {};
  const client = {
    _calls: calls,
    from: vi.fn((table: string) => {
      if (table === 'user_roles') {
        const builder = {
          select: () => builder,
          eq: (...args: unknown[]) => { calls.eqArgs = args; return builder; },
          in: (...args: unknown[]) => { calls.inArgs = args; return builder; },
          limit: () => builder,
          maybeSingle: () => Promise.resolve(roleResult),
        };
        return builder;
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
  return client;
}

describe('GET /api/hitl-packets/[sessionId]/csv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const req = {} as unknown as Parameters<typeof GET>[0];
  const params = Promise.resolve({ sessionId: 'session-123' });

  it('Unauthenticated (getAuthenticatedUser -> null) -> status 401, body.error === \'Unauthorized\'.', async () => {
    const client = makeClient({ data: null, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('Authenticated non-admin (maybeSingle -> {data:null,error:null}) -> status 403, body.error === \'Forbidden\'.', async () => {
    const client = makeClient({ data: null, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('Role query error (maybeSingle -> {data:null,error:{message:\'boom\'}}) -> status 403 (fail-closed).', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET(req, { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('admin role (maybeSingle -> {data:{role:\'admin\'},error:null}) -> status 200.', async () => {
    const client = makeClient({ data: { role: 'admin' }, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET(req, { params });
    expect(client._calls.eqArgs).toEqual(['user_id', AUTH_USER_ID]);
    expect(client._calls.inArgs).toEqual(['role', ['admin', 'matrix_admin']]);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    const text = await response.text();
    expect(text).toBe('csv content');
  });

  it('matrix_admin role (maybeSingle -> {data:{role:\'matrix_admin\'},error:null}) -> status 200.', async () => {
    const client = makeClient({ data: { role: 'matrix_admin' }, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET(req, { params });
    expect(client._calls.eqArgs).toEqual(['user_id', AUTH_USER_ID]);
    expect(client._calls.inArgs).toEqual(['role', ['admin', 'matrix_admin']]);
    expect(response.status).toBe(200);
  });
});
