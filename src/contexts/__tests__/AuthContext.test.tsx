/**
 * Unit tests for AuthContext retryable-error handling.
 *
 * Key invariant: a transient / retryable error from supabase.auth.getUser()
 * MUST NOT null-out the existing session.  Only a clean "no user, no error"
 * response or a terminal auth error may do that.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// ---------------------------------------------------------------------------
// Mock @/components/supabase-client
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock('@/components/supabase-client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const MOCK_USER = { id: 'user-abc', email: 'test@example.com' };
const MOCK_SESSION = { user: MOCK_USER, access_token: 'tok', token_type: 'bearer', expires_in: 3600, refresh_token: 'ref', expires_at: 9999999999 };

function makeSubscription() {
  return { data: { subscription: { unsubscribe: vi.fn() } } };
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no auth state change events; subscription is a no-op
    mockOnAuthStateChange.mockReturnValue(makeSubscription());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets session when getUser returns a valid user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for async syncSession to complete
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toEqual(MOCK_SESSION);
    expect(result.current.user).toEqual(MOCK_USER);
    expect(result.current.authUnverified).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('sets session=null when getUser returns no user and no error (clean logged-out)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toBeNull();
    expect(result.current.authUnverified).toBe(false);
    expect(result.current.authError).toBeNull();
  });

  it('preserves prior session on AuthRetryableFetchError (does NOT null the session)', async () => {
    // First call succeeds and establishes a session
    mockGetUser
      .mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null })
      // Second call (after re-render / online event) returns retryable error
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'network error', status: 0 },
      });
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Let first syncSession complete
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toEqual(MOCK_SESSION);

    // Trigger a second syncSession (simulates online event or visibility change)
    await act(async () => {
      await result.current.refreshSession();
    });

    // Session must still be the prior one -- not null
    expect(result.current.session).toEqual(MOCK_SESSION);
    expect(result.current.authUnverified).toBe(true);
    expect(result.current.authError).toBeNull();
  });

  it('preserves prior session on status=0 (network-level failure)', async () => {
    mockGetUser
      .mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null })
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'FetchError', message: 'Failed to fetch', status: 0 },
      });
    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toEqual(MOCK_SESSION);

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.session).toEqual(MOCK_SESSION);
    expect(result.current.authUnverified).toBe(true);
  });

  it('preserves prior session on 502/503/504 gateway errors', async () => {
    for (const status of [502, 503, 504]) {
      vi.clearAllMocks();
      mockOnAuthStateChange.mockReturnValue(makeSubscription());

      mockGetUser
        .mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null })
        .mockResolvedValueOnce({
          data: { user: null },
          error: { name: 'Error', message: 'Gateway error', status },
        });
      mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => { await Promise.resolve(); });
      await act(async () => { await Promise.resolve(); });

      expect(result.current.session).toEqual(MOCK_SESSION);

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.session).toEqual(MOCK_SESSION);
      expect(result.current.authUnverified).toBe(true);
    }
  });

  it('clears session and sets authError on terminal auth error (e.g. 401)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'invalid JWT', status: 401 },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.session).toBeNull();
    expect(result.current.authError).not.toBeNull();
    expect(result.current.authError?.message).toBe('invalid JWT');
    expect(result.current.authUnverified).toBe(false);
  });

  it('clears authUnverified when sync succeeds after a prior transient failure', async () => {
    mockGetUser
      // First: successful login
      .mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null })
      // Second: retryable error
      .mockResolvedValueOnce({
        data: { user: null },
        error: { name: 'AuthRetryableFetchError', message: 'net error', status: 0 },
      })
      // Third: recovery
      .mockResolvedValueOnce({ data: { user: MOCK_USER }, error: null });

    mockGetSession.mockResolvedValue({ data: { session: MOCK_SESSION }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.authUnverified).toBe(false);

    // Transient failure
    await act(async () => { await result.current.refreshSession(); });
    expect(result.current.authUnverified).toBe(true);

    // Recovery
    await act(async () => { await result.current.refreshSession(); });
    expect(result.current.authUnverified).toBe(false);
    expect(result.current.session).toEqual(MOCK_SESSION);
  });
});
