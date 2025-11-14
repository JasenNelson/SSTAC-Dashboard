import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsers, toggleAdminRole, addUserRole } from '../actions';

// Mock Next.js server-side functions
const mockRedirect = vi.fn();
const mockCookies = vi.fn();

// Next.js redirect() throws a special error to stop execution
// We need to mock it to throw so tests can catch it
interface RedirectError extends Error {
  digest?: string;
}

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    mockRedirect(path);
    // Throw an error to simulate Next.js redirect behavior
    const error: RedirectError = new Error('NEXT_REDIRECT');
    error.digest = `NEXT_REDIRECT;${path}`;
    throw error;
  },
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock Supabase client
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq1 = vi.fn();
const mockEq2 = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
  rpc: vi.fn(),
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

describe('Admin User Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default cookie mock
    mockCookies.mockReturnValue({
      get: vi.fn((name: string) => ({ value: `mock-cookie-${name}` })),
    });

    // Setup default Supabase query chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    });
    
    mockSelect.mockReturnValue({
      eq: mockEq1,
      order: mockOrder,
    });
    
    mockEq1.mockReturnValue({
      eq: mockEq2,
    });
    
    mockEq2.mockReturnValue({
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
    });

    mockOrder.mockReturnValue({
      data: [],
      error: null,
    });

    mockSingle.mockReturnValue({
      data: null,
      error: null,
    });

    mockMaybeSingle.mockReturnValue({
      data: null,
      error: null,
    });

    mockInsert.mockReturnValue({
      data: null,
      error: null,
    });

    // Delete chain needs to support .eq().eq()
    const mockDeleteEq1 = vi.fn();
    const mockDeleteEq2 = vi.fn();
    
    mockDeleteEq1.mockReturnValue({
      eq: mockDeleteEq2,
    });
    
    mockDeleteEq2.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });
    
    mockDelete.mockReturnValue({
      eq: mockDeleteEq1,
    });
  });

  describe('getUsers', () => {
    it('should redirect to login when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(getUsers()).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect non-admin users to dashboard', async () => {
      const mockUser = { id: 'user-123', email: 'user@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: null, // No admin role found
        error: { code: 'PGRST116' }, // Not found error
      });

      await expect(getUsers()).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should return users from admin_users_comprehensive view', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };
      const mockAdminUsers = [
        {
          id: 'user-1',
          email: 'user1@test.com',
          auth_created_at: '2024-01-01T00:00:00Z',
          role: 'member',
          is_admin: false,
        },
        {
          id: 'user-2',
          email: 'user2@test.com',
          auth_created_at: '2024-01-02T00:00:00Z',
          role: 'admin',
          is_admin: true,
        },
      ];

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      mockOrder.mockResolvedValue({
        data: mockAdminUsers,
        error: null,
      });

      // Mock the comprehensive view query
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_users_comprehensive') {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: mockAdminUsers,
                error: null,
              }),
            }),
          };
        }
        return {
          select: mockSelect,
        };
      });

      const result = await getUsers();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('email');
        expect(result[0]).toHaveProperty('role');
        expect(result[0]).toHaveProperty('isAdmin');
      }
    });

    it('should throw error when all fallback methods fail', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      // All views return errors
      // All views return errors to trigger fallback to getUsersComprehensive
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'View not found' },
      });

      // Track calls to distinguish between admin check and getUsersComprehensive
      let userRolesCallCount = 0;
      
      // Mock getUsersComprehensive to throw an error (simulating all methods failing)
      // When admin_users_comprehensive and users_overview both fail,
      // getUsers() calls getUsersComprehensive which will also fail
      mockFrom.mockImplementation((table: string) => {
        if (table === 'admin_users_comprehensive' || table === 'users_overview') {
          return {
            select: () => ({
              order: () => Promise.resolve({
                data: null,
                error: { message: 'View not found' },
              }),
            }),
          };
        }
        
        // For user_roles table:
        // First call (callCount = 0) is admin check - needs full chain: .select().eq().eq().single()
        // Second call (callCount = 1+) is from getUsersComprehensive - should fail
        if (table === 'user_roles') {
          const currentCall = userRolesCallCount++;
          if (currentCall === 0) {
            // Admin check - return normal chain
            return {
              select: mockSelect,
              insert: mockInsert,
              delete: mockDelete,
            };
          } else {
            // getUsersComprehensive call - make it fail
            return {
              select: () => Promise.resolve({
                data: null,
                error: { message: 'Failed to fetch user roles' },
              }),
            };
          }
        }
        
        // Default fallback
        return {
          select: mockSelect,
          insert: mockInsert,
          delete: mockDelete,
        };
      });

      await expect(getUsers()).rejects.toThrow('Failed to fetch users');
    });
  });

  describe('toggleAdminRole', () => {
    it('should redirect to login when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(toggleAdminRole('user-123', false)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect non-admin users to dashboard', async () => {
      const mockUser = { id: 'user-123', email: 'user@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(toggleAdminRole('user-456', false)).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should add admin role when currentIsAdmin is false', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      mockInsert.mockResolvedValue({
        data: null,
        error: null,
      });

      mockEq2.mockReturnValue({
        single: mockSingle,
      });

      // Mock delete chain for insert path
      mockDelete.mockReturnValue({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      });

      await toggleAdminRole('user-456', false);

      expect(mockFrom).toHaveBeenCalledWith('user_roles');
      // Should insert admin role
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should remove admin role when currentIsAdmin is true', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      // The delete chain is already set up in beforeEach with proper .eq().eq() chain
      // Just ensure it returns success
      await toggleAdminRole('user-456', true);

      expect(mockFrom).toHaveBeenCalledWith('user_roles');
      // Should delete admin role via the delete chain
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw error when operation fails', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(toggleAdminRole('user-456', false)).rejects.toThrow('Failed to grant admin role');
    });
  });

  describe('addUserRole', () => {
    it('should redirect to login when user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(addUserRole('user-123', 'member')).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect non-admin users to dashboard', async () => {
      const mockUser = { id: 'user-123', email: 'user@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(addUserRole('user-456', 'member')).rejects.toThrow();
      expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
    });

    it('should add role to user when admin is authenticated', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      mockInsert.mockResolvedValue({
        data: null,
        error: null,
      });

      await addUserRole('user-456', 'member');

      expect(mockFrom).toHaveBeenCalledWith('user_roles');
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-456',
        role: 'member',
      });
    });

    it('should throw error when insert fails', async () => {
      const mockUser = { id: 'admin-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(addUserRole('user-456', 'member')).rejects.toThrow('Failed to add user role');
    });
  });
});

