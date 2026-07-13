import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

const mockDiscoverPacketSessions = vi.fn();
vi.mock('@/lib/hitl-packets', () => ({
  discoverPacketSessions: () => mockDiscoverPacketSessions(),
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

const FIXTURE_SESSIONS = [
  {
    sessionId: 'session-1',
    csvPath: '/path/to.csv',
    mdPath: null,
    metadata: { record_count: 5 },
    modifiedAt: '2026-07-13T12:00:00Z',
  },
];

describe('GET /api/hitl-packets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Unauthenticated (getAuthenticatedUser -> null) -> status 401, body.error === \'Unauthorized\'. discoverPacketSessions NOT called.', async () => {
    const client = makeClient({ data: null, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockDiscoverPacketSessions).not.toHaveBeenCalled();
  });

  it('Authenticated non-admin (maybeSingle -> {data:null,error:null}) -> status 403, body.error === \'Forbidden\'. discoverPacketSessions NOT called.', async () => {
    const client = makeClient({ data: null, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(mockDiscoverPacketSessions).not.toHaveBeenCalled();
  });

  it('Role query error (maybeSingle -> {data:null,error:{message:\'boom\'}}) -> status 403 (fail-closed).', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
    expect(mockDiscoverPacketSessions).not.toHaveBeenCalled();
  });

  it('admin role (maybeSingle -> {data:{role:\'admin\'},error:null}) -> status 200; body.count === fixture length; sessions mapped.', async () => {
    const client = makeClient({ data: { role: 'admin' }, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });
    mockDiscoverPacketSessions.mockReturnValue(FIXTURE_SESSIONS);

    const response = await GET();
    expect(client._calls.eqArgs).toEqual(['user_id', AUTH_USER_ID]);
    expect(client._calls.inArgs).toEqual(['role', ['admin', 'matrix_admin']]);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBe(FIXTURE_SESSIONS.length);
    expect(body.sessions[0]).toEqual({
      sessionId: 'session-1',
      hasCSV: true,
      hasMD: false,
      metadata: { record_count: 5 },
      modifiedAt: '2026-07-13T12:00:00Z',
    });
  });

  it('matrix_admin role (maybeSingle -> {data:{role:\'matrix_admin\'},error:null}) -> status 200.', async () => {
    const client = makeClient({ data: { role: 'matrix_admin' }, error: null });
    mockCreateAuthenticatedClient.mockResolvedValue(client);
    mockGetAuthenticatedUser.mockResolvedValue({ id: AUTH_USER_ID });
    mockDiscoverPacketSessions.mockReturnValue(FIXTURE_SESSIONS);

    const response = await GET();
    expect(client._calls.eqArgs).toEqual(['user_id', AUTH_USER_ID]);
    expect(client._calls.inArgs).toEqual(['role', ['admin', 'matrix_admin']]);
    expect(response.status).toBe(200);
  });
});
