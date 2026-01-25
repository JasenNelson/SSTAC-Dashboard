import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAuthenticatedClient,
  createAnonymousClient,
  getAuthenticatedUser,
  requireAuthenticatedUser,
  createClientForPagePath,
  generateCEWUserId,
} from './supabase-auth';

// Mock @supabase/ssr
const mockCreateServerClient = vi.fn();
const mockCookies = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

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
  
  // Setup default mocks
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

describe('supabase-auth', () => {
  describe('createAuthenticatedClient', () => {
    it('should create authenticated client with cookie handling', async () => {
      const client = await createAuthenticatedClient();
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should use correct Supabase URL and key', async () => {
      await createAuthenticatedClient();
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        expect.any(Object)
      );
    });

    it('should handle cookie get operations', async () => {
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `value-${name}` })),
        set: vi.fn(),
      };
      mockCookies.mockResolvedValue(cookieStore);
      
      await createAuthenticatedClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieGet = callArgs.cookies.get;
      
      const result = cookieGet('test-cookie');
      expect(result).toBe('value-test-cookie');
      expect(cookieStore.get).toHaveBeenCalledWith('test-cookie');
    });

    it('should handle cookie set operations with error handling', async () => {
      const cookieStore = {
        get: vi.fn(),
        set: vi.fn(() => {
          throw new Error('Cookie set failed');
        }),
      };
      mockCookies.mockResolvedValue(cookieStore);
      
      await createAuthenticatedClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieSet = callArgs.cookies.set;
      
      // Should not throw error
      expect(() => {
        cookieSet('name', 'value', {});
      }).not.toThrow();
    });

    it('should handle cookie remove operations with error handling', async () => {
      const cookieStore = {
        get: vi.fn(),
        set: vi.fn(() => {
          throw new Error('Cookie remove failed');
        }),
      };
      mockCookies.mockResolvedValue(cookieStore);
      
      await createAuthenticatedClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieRemove = callArgs.cookies.remove;
      
      // Should not throw error
      expect(() => {
        cookieRemove('name', {});
      }).not.toThrow();
    });
  });

  describe('createAnonymousClient', () => {
    it('should create anonymous client without cookie handling', async () => {
      const client = await createAnonymousClient();
      
      expect(mockCreateServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.objectContaining({
            get: expect.any(Function),
            set: expect.any(Function),
            remove: expect.any(Function),
          }),
        })
      );
      expect(client).toBeDefined();
    });

    it('should return null for cookie get', async () => {
      await createAnonymousClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieGet = callArgs.cookies.get;
      
      expect(cookieGet('any-cookie')).toBeNull();
    });

    it('should have no-op cookie set', async () => {
      await createAnonymousClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieSet = callArgs.cookies.set;
      
      // Should not throw or do anything
      expect(() => {
        cookieSet('name', 'value', {});
      }).not.toThrow();
    });

    it('should have no-op cookie remove', async () => {
      await createAnonymousClient();
      
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieRemove = callArgs.cookies.remove;
      
      // Should not throw or do anything
      expect(() => {
        cookieRemove('name', {});
      }).not.toThrow();
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      
      const user = await getAuthenticatedUser(mockSupabaseClient as any);
      
      expect(user).toEqual(mockUser);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('should return null when not authenticated', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      
      const user = await getAuthenticatedUser(mockSupabaseClient as any);
      
      expect(user).toBeNull();
    });

    it('should return null on error', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Auth error' },
          }),
        },
      };
      
      const user = await getAuthenticatedUser(mockSupabaseClient as any);
      
      expect(user).toBeNull();
    });
  });

  describe('requireAuthenticatedUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      };
      
      const user = await requireAuthenticatedUser(mockSupabaseClient as any);
      
      expect(user).toEqual(mockUser);
    });

    it('should throw error when not authenticated', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      
      await expect(
        requireAuthenticatedUser(mockSupabaseClient as any)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('createClientForPagePath', () => {
    it('should return anonymous client for CEW pages', async () => {
      const result = await createClientForPagePath('/cew-polls/holistic-protection');
      
      expect(result.isCEWPage).toBe(true);
      expect(result.supabase).toBeDefined();
      expect(mockCreateServerClient).toHaveBeenCalled();
    });

    it('should return authenticated client for survey-results pages', async () => {
      const result = await createClientForPagePath('/survey-results/holistic-protection');
      
      expect(result.isCEWPage).toBe(false);
      expect(result.supabase).toBeDefined();
      expect(mockCreateServerClient).toHaveBeenCalled();
    });

    it('should return authenticated client for other paths', async () => {
      const result = await createClientForPagePath('/admin/users');
      
      expect(result.isCEWPage).toBe(false);
      expect(result.supabase).toBeDefined();
    });

    it('should correctly identify CEW paths with different prefixes', async () => {
      const cewResult = await createClientForPagePath('/cew-polls/prioritization');
      const surveyResult = await createClientForPagePath('/survey-results/prioritization');
      
      expect(cewResult.isCEWPage).toBe(true);
      expect(surveyResult.isCEWPage).toBe(false);
    });
  });

  describe('generateCEWUserId', () => {
    it('should generate user ID with session ID when provided', () => {
      const sessionId = 'session_1234567890_abc123';
      const userId = generateCEWUserId('CEW2025', sessionId);
      
      expect(userId).toBe('CEW2025_session_1234567890_abc123');
    });

    it('should generate user ID without session ID', () => {
      const userId = generateCEWUserId('CEW2025', null);

      // Format: CEW2025_{32-char-hex} using crypto.randomBytes
      expect(userId).toMatch(/^CEW2025_[a-f0-9]{32}$/);
    });

    it('should use default auth code when not provided', () => {
      const userId = generateCEWUserId(undefined, null);

      // Format: CEW2025_{32-char-hex} using crypto.randomBytes (default auth code)
      expect(userId).toMatch(/^CEW2025_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs for multiple calls', () => {
      const userId1 = generateCEWUserId('CEW2025', null);
      // Small delay to ensure different timestamp
      const userId2 = generateCEWUserId('CEW2025', null);
      
      expect(userId1).not.toBe(userId2);
    });

    it('should use cryptographically secure randomBytes when no session ID', () => {
      const userId = generateCEWUserId('TEST', null);

      // Format: TEST_{32-char-hex} from crypto.randomBytes(16).toString('hex')
      expect(userId).toMatch(/^TEST_[a-f0-9]{32}$/);
      // Verify it's 4 + 1 (underscore) + 32 = 37 characters total
      expect(userId).toHaveLength(37);
    });
  });

  describe('integration scenarios', () => {
    it('should work together: authenticated flow', async () => {
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
      
      const supabase = await createAuthenticatedClient();
      const user = await getAuthenticatedUser(supabase as any);
      
      expect(user).toEqual(mockUser);
    });

    it('should work together: CEW page flow', async () => {
      const { supabase, isCEWPage } = await createClientForPagePath('/cew-polls/test');
      
      expect(isCEWPage).toBe(true);
      expect(supabase).toBeDefined();
      
      // Verify it's using anonymous client pattern
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieGet = callArgs.cookies.get;
      expect(cookieGet('test')).toBeNull();
    });

    it('should work together: authenticated page flow', async () => {
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `value-${name}` })),
        set: vi.fn(),
      };
      mockCookies.mockResolvedValue(cookieStore);
      
      const { supabase, isCEWPage } = await createClientForPagePath('/survey-results/test');
      
      expect(isCEWPage).toBe(false);
      expect(supabase).toBeDefined();
      
      // Verify it's using authenticated client pattern
      const callArgs = mockCreateServerClient.mock.calls[0][2];
      const cookieGet = callArgs.cookies.get;
      expect(cookieGet('test')).toBe('value-test');
    });
  });
});

