import { describe, it, expect, vi, beforeEach } from 'vitest';
import HitlPacketsPage from '../page';

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`redirect called with ${url}`);
});
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

const mockCreateServerClient = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

const mockDiscoverPacketSessions = vi.fn();
vi.mock('@/lib/hitl-packets/discovery', () => ({
  discoverPacketSessions: () => mockDiscoverPacketSessions(),
}));

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111';

function makeClient(
  getUserResult: { data: { user: { id: string } | null }; error: { message: string } | null },
  rolesResult: { data: Array<{ role: string }> | null }
) {
  const calls: { eqArgs?: unknown[]; inArgs?: unknown[] } = {};
  const client = {
    _calls: calls,
    auth: {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    },
    from: vi.fn((table: string) => {
      if (table === 'user_roles') {
        const builder = {
          select: () => builder,
          eq: (...args: unknown[]) => { calls.eqArgs = args; return builder; },
          in: (...args: unknown[]) => { calls.inArgs = args; return Promise.resolve(rolesResult); },
        };
        return builder;
      }
      throw new Error(`Unexpected table in test mock: ${table}`);
    }),
  };
  return client;
}

describe('HitlPacketsPage server component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({
      get: () => undefined,
      set: () => undefined,
      remove: () => undefined,
    });
  });

  it('authError/no user (getUser -> {data:{user:null}, error:{...}} or {user:null}) -> redirect called with \'/login?redirect=/hitl-packets\'. discoverPacketSessions NOT called.', async () => {
    const client = makeClient({ data: { user: null }, error: { message: 'auth error' } }, { data: [] });
    mockCreateServerClient.mockReturnValue(client);

    await expect(HitlPacketsPage()).rejects.toThrow('redirect called with /login?redirect=/hitl-packets');
    expect(mockRedirect).toHaveBeenCalledWith('/login?redirect=/hitl-packets');
    expect(mockDiscoverPacketSessions).not.toHaveBeenCalled();
  });

  it('Authenticated non-admin (roles -> []) -> redirect called with \'/dashboard\'.', async () => {
    const client = makeClient({ data: { user: { id: AUTH_USER_ID } }, error: null }, { data: [] });
    mockCreateServerClient.mockReturnValue(client);

    await expect(HitlPacketsPage()).rejects.toThrow('redirect called with /dashboard');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    expect(mockDiscoverPacketSessions).not.toHaveBeenCalled();
  });

  it('admin (roles -> [{role:\'admin\'}]) -> NO redirect; discoverPacketSessions called once; component returns without throwing.', async () => {
    const client = makeClient({ data: { user: { id: AUTH_USER_ID } }, error: null }, { data: [{ role: 'admin' }] });
    mockCreateServerClient.mockReturnValue(client);
    mockDiscoverPacketSessions.mockReturnValue([]);

    const result = await HitlPacketsPage();
    expect(client._calls.eqArgs).toEqual(['user_id', AUTH_USER_ID]);
    expect(client._calls.inArgs).toEqual(['role', ['admin', 'matrix_admin']]);
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockDiscoverPacketSessions).toHaveBeenCalledTimes(1);
  });
});
