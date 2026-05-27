// Unit tests for src/lib/api-guards.ts
//
// Covers all branches of:
//   - requireAdmin(): authenticated admin, unauthenticated, non-admin role, error
//   - requireLocalEngine(): enabled, disabled

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock handles
// ---------------------------------------------------------------------------
const {
  mockGetUser: _mockGetUser,
  mockFrom: _mockFrom,
  mockCreateServerClient,
  mockCookies,
} = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockSelect = vi.fn();
  const mockEq1 = vi.fn();
  const mockEq2 = vi.fn();
  const mockMaybeSingle = vi.fn();

  mockMaybeSingle.mockResolvedValue({ data: null });
  mockEq2.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockEq1.mockReturnValue({ eq: mockEq2 });
  mockSelect.mockReturnValue({ eq: mockEq1 });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

  const mockCreateServerClient = vi.fn().mockReturnValue({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  });

  const mockCookies = vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
    set: vi.fn(),
  });

  return { mockGetUser, mockFrom, mockCreateServerClient, mockCookies };
});

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------
vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// ---------------------------------------------------------------------------
// Import subject AFTER mocks
// ---------------------------------------------------------------------------
import { requireAdmin, requireLocalEngine } from '../api-guards';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSupabaseClient(userResult: unknown, roleData: unknown) {
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: roleData });
  const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const from = vi.fn().mockReturnValue({ select: mockSelect });
  const getUser = vi.fn().mockResolvedValue(userResult);
  const client = { auth: { getUser }, from };
  mockCreateServerClient.mockReturnValue(client);
  return { client, mockEq1, mockEq2 };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// requireAdmin()
// ---------------------------------------------------------------------------

describe('requireAdmin()', () => {
  it('returns null (proceed) when user is authenticated and has admin role', async () => {
    const user = { id: 'user-1', email: 'admin@example.com' };
    const { mockEq1, mockEq2 } = buildSupabaseClient(
      { data: { user }, error: null },
      { role: 'admin' },
    );

    const result = await requireAdmin();

    expect(result).toBeNull();
    expect(mockEq1).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockEq2).toHaveBeenCalledWith('role', 'admin');
  });

  it('returns 401 Unauthorized when getUser returns no user', async () => {
    buildSupabaseClient(
      { data: { user: null }, error: null },
      null,
    );

    const result = await requireAdmin();

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 Unauthorized when getUser returns an error', async () => {
    buildSupabaseClient(
      { data: { user: null }, error: { message: 'JWT expired' } },
      null,
    );

    const result = await requireAdmin();

    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 403 Forbidden when authenticated user does not have admin role', async () => {
    const user = { id: 'user-2', email: 'viewer@example.com' };
    buildSupabaseClient(
      { data: { user }, error: null },
      null, // no admin role row
    );

    const result = await requireAdmin();

    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
    const body = await result!.json();
    expect(body.error).toBe('Forbidden');
  });

  it('creates Supabase client with cookie handlers (get / set / remove)', async () => {
    const user = { id: 'user-3', email: 'admin2@example.com' };
    buildSupabaseClient(
      { data: { user }, error: null },
      { role: 'admin' },
    );

    await requireAdmin();

    expect(mockCreateServerClient).toHaveBeenCalled();
    const [, , options] = mockCreateServerClient.mock.calls[0] as [unknown, unknown, { cookies: Record<string, unknown> }];
    expect(options).toHaveProperty('cookies');
    expect(typeof options.cookies.get).toBe('function');
    expect(typeof options.cookies.set).toBe('function');
    expect(typeof options.cookies.remove).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// requireLocalEngine()
// ---------------------------------------------------------------------------

describe('requireLocalEngine()', () => {
  it('returns null (proceed) when LOCAL_ENGINE_ENABLED is "true"', () => {
    vi.stubEnv('LOCAL_ENGINE_ENABLED', 'true');

    const result = requireLocalEngine();

    expect(result).toBeNull();
  });

  it('returns 503 when LOCAL_ENGINE_ENABLED is unset', () => {
    vi.stubEnv('LOCAL_ENGINE_ENABLED', '');

    const result = requireLocalEngine();

    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });

  it('returns 503 when LOCAL_ENGINE_ENABLED is "false"', () => {
    vi.stubEnv('LOCAL_ENGINE_ENABLED', 'false');

    const result = requireLocalEngine();

    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });

  it('503 response body mentions local evaluation engine', async () => {
    vi.stubEnv('LOCAL_ENGINE_ENABLED', '');

    const result = requireLocalEngine();
    const body = await result!.json();

    expect(body.error).toContain('local evaluation engine');
  });
});
