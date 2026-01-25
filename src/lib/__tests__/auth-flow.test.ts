import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAuthenticatedClient,
  createAnonymousClient,
  getAuthenticatedUser,
  createClientForPagePath,
  generateCEWUserId,
} from '../supabase-auth';

// Mock @supabase/ssr
const mockCreateServerClient = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

// Mock next/headers
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  };
  vi.clearAllMocks();
  
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn(),
    },
  });
  
  mockCookies.mockResolvedValue({
    get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
    set: vi.fn(),
  });
});

describe('Authentication Flow Tests', () => {
  describe('Authenticated Flow', () => {
    it('should complete full authenticated user flow', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: '1' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      
      // Step 1: Create authenticated client
      const supabase = await createAuthenticatedClient();
      
      // Step 2: Get authenticated user
      const user = await getAuthenticatedUser(supabase as any);
      
      // Step 3: Verify user is authenticated
      expect(user).toEqual(mockUser);
      expect(user?.id).toBe('user-123');
      expect(user?.email).toBe('test@example.com');
      
      // Step 4: Verify client was created with cookie handling
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          cookies: expect.objectContaining({
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          }),
        })
      );
    });

    it('should handle authentication failure gracefully', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      
      const supabase = await createAuthenticatedClient();
      const user = await getAuthenticatedUser(supabase as any);
      
      expect(user).toBeNull();
    });

    it('should handle authentication errors', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Auth error' },
          }),
        },
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      
      const supabase = await createAuthenticatedClient();
      const user = await getAuthenticatedUser(supabase as any);
      
      expect(user).toBeNull();
    });
  });

  describe('Anonymous/CEW Flow', () => {
    it('should complete full CEW anonymous flow', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({
            data: [{ id: 'vote-1' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      
      // Step 1: Create anonymous client for CEW page
      const { supabase, isCEWPage } = await createClientForPagePath('/cew-polls/holistic-protection');
      
      expect(isCEWPage).toBe(true);
      
      // Step 2: Generate CEW user ID
      const sessionId = 'session-123';
      const userId = generateCEWUserId('CEW2025', sessionId);
      
      expect(userId).toBe('CEW2025_session-123');
      
      // Step 3: Verify client doesn't use cookies
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieGet = callArgs.cookies.get;
      expect(cookieGet('test')).toBeNull();
    });

    it('should generate unique IDs for multiple CEW submissions', () => {
      const sessionId1 = 'session-123';
      const sessionId2 = 'session-456';
      
      const userId1 = generateCEWUserId('CEW2025', sessionId1);
      const userId2 = generateCEWUserId('CEW2025', sessionId2);
      
      expect(userId1).not.toBe(userId2);
      expect(userId1).toBe('CEW2025_session-123');
      expect(userId2).toBe('CEW2025_session-456');
    });

    it('should generate fallback IDs when no session ID provided', () => {
      const userId1 = generateCEWUserId('CEW2025', null);
      const userId2 = generateCEWUserId('CEW2025', null);

      // Should be different due to cryptographic randomness
      // Format: CEW2025_{32-char-hex} from crypto.randomBytes(16)
      expect(userId1).toMatch(/^CEW2025_[a-f0-9]{32}$/);
      expect(userId2).toMatch(/^CEW2025_[a-f0-9]{32}$/);
      expect(userId1).not.toBe(userId2); // Should be cryptographically different
    });
  });

  describe('Page Path Detection Flow', () => {
    it('should correctly identify CEW pages', async () => {
      const cewPaths = [
        '/cew-polls/holistic-protection',
        '/cew-polls/prioritization',
        '/cew-polls/tiered-framework',
        '/cew-polls/wiks',
      ];
      
      for (const path of cewPaths) {
        const { isCEWPage } = await createClientForPagePath(path);
        expect(isCEWPage).toBe(true);
      }
    });

    it('should correctly identify authenticated pages', async () => {
      const authPaths = [
        '/survey-results/holistic-protection',
        '/survey-results/prioritization',
        '/admin/poll-results',
        '/dashboard',
      ];
      
      for (const path of authPaths) {
        const { isCEWPage } = await createClientForPagePath(path);
        expect(isCEWPage).toBe(false);
      }
    });

    it('should create appropriate client type based on path', async () => {
      // Test CEW path
      const { supabase: cewClient, isCEWPage: isCEW } = await createClientForPagePath('/cew-polls/test');
      expect(isCEW).toBe(true);
      
      // Verify anonymous client pattern
      const cewCallArgs = mockCreateServerClient.mock.calls[0][2];
      expect(cewCallArgs.cookies.get()).toBeNull();
      
      // Test authenticated path
      mockCookies.mockResolvedValue({
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      });
      
      const { supabase: authClient, isCEWPage: isAuth } = await createClientForPagePath('/survey-results/test');
      expect(isAuth).toBe(false);
      
      // Verify authenticated client pattern
      const authCallArgs = mockCreateServerClient.mock.calls[1][2];
      const cookieGet = authCallArgs.cookies.get;
      expect(cookieGet('test')).toBe('cookie-test');
    });
  });

  describe('Mixed Flow Scenarios', () => {
    it('should handle switching between CEW and authenticated flows', async () => {
      // Start with CEW flow
      const { supabase: cewClient, isCEWPage: isCEW } = await createClientForPagePath('/cew-polls/test');
      expect(isCEW).toBe(true);
      
      // Switch to authenticated flow
      mockCookies.mockResolvedValue({
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      });
      
      const { supabase: authClient, isCEWPage: isAuth } = await createClientForPagePath('/survey-results/test');
      expect(isAuth).toBe(false);
      
      // Both clients should be usable
      expect(cewClient).toBeDefined();
      expect(authClient).toBeDefined();
    });

    it('should handle concurrent requests correctly', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      
      // Create multiple authenticated clients
      const client1 = await createAuthenticatedClient();
      const client2 = await createAuthenticatedClient();
      const client3 = await createAuthenticatedClient();
      
      // All should be valid clients
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
      expect(client3).toBeDefined();
      
      // Should have created clients (calls may be batched, but should work)
      expect(mockCreateServerClient).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should handle cookie store errors gracefully', async () => {
      const errorCookieStore = {
        get: vi.fn(() => {
          throw new Error('Cookie error');
        }),
        set: vi.fn(() => {
          throw new Error('Cookie error');
        }),
      };
      
      mockCookies.mockResolvedValue(errorCookieStore);
      
      // Should not throw
      await expect(createAuthenticatedClient()).resolves.toBeDefined();
    });

    it('should handle Supabase client creation errors', async () => {
      mockCreateServerClient.mockImplementation(() => {
        throw new Error('Client creation error');
      });
      
      // Should propagate error
      await expect(createAuthenticatedClient()).rejects.toThrow();
    });
  });
});

