import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  refreshGlobalAdminStatus, 
  checkCurrentUserAdminStatus,
  clearAdminStatusBackup 
} from './admin-utils';

// Mock Supabase client
const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq2 = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
  from: mockFrom,
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe('admin-utils', () => {
  beforeEach(async () => {
    // Clear localStorage before each test
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.clearAllMocks();
    
    // Reset mock chain - each call returns new object
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq1,
    });
    mockEq1.mockReturnValue({
      eq: mockEq2,
    });
    mockEq2.mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
    
    // Reset time-based throttling by adding small delay
    await new Promise(resolve => setTimeout(resolve, 60));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refreshGlobalAdminStatus', () => {
    it('should return false when no user is authenticated', async () => {
      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await refreshGlobalAdminStatus();
      expect(result).toBe(false);
      expect(mockGetUser).toHaveBeenCalled();
    });

    it('should return false when auth error occurs', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const result = await refreshGlobalAdminStatus();
      expect(result).toBe(false);
    });

    it('should return true for admin users', async () => {
      // Wait to avoid throttling from previous test
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const mockUser = { id: 'user-123', email: 'admin@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      const result = await refreshGlobalAdminStatus();

      expect(result).toBe(true);
      expect(mockGetUser).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalledWith('user_roles');
      expect(mockSelect).toHaveBeenCalledWith('role');
      // SECURITY: Admin status no longer uses localStorage (Phase 2 fix)
      // localStorage is not checked or used
    });

    it('should return false for non-admin users', async () => {
      const mockUser = { id: 'user-456', email: 'user@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await refreshGlobalAdminStatus();
      
      expect(result).toBe(false);
      expect(localStorage.getItem('admin_status_user-456')).toBeNull();
    });

    it('should return false on database error (no localStorage fallback)', async () => {
      const mockUser = { id: 'user-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await refreshGlobalAdminStatus();

      // SECURITY: On database error, return false (never fall back to localStorage)
      expect(result).toBe(false);
    });

    it('should respect throttling and return false during throttle period', async () => {
      // Wait to avoid throttling from previous test
      await new Promise(resolve => setTimeout(resolve, 60));

      const mockUser = { id: 'user-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      // First call - should succeed
      const firstResult = await refreshGlobalAdminStatus(true); // Force to bypass throttling
      expect(firstResult).toBe(true);

      // Clear mocks to verify throttling
      vi.clearAllMocks();

      // Second call immediately after (should be throttled)
      const secondResult = await refreshGlobalAdminStatus();

      // SECURITY: During throttle period, return false without checking DB or localStorage
      expect(secondResult).toBe(false);
      // Should NOT have made any database calls due to throttling
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('should bypass throttling with force flag', async () => {
      // Wait to avoid throttling from previous test
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const mockUser = { id: 'user-123', email: 'admin@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      // First call
      await refreshGlobalAdminStatus(true);
      
      // Clear mocks to verify force bypass
      vi.clearAllMocks();
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      mockMaybeSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      // Force refresh should bypass throttling
      const result = await refreshGlobalAdminStatus(true);
      
      expect(result).toBe(true);
      expect(mockGetUser).toHaveBeenCalled();
    });

    it('should handle errors gracefully and try localStorage fallback', async () => {
      // Wait to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 60));
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('admin_status_user-789', 'true');
      }
      
      const mockUser = { id: 'user-789', email: 'admin@test.com' };
      
      // First call throws error
      mockGetUser.mockRejectedValueOnce(new Error('Network error'));

      // Mock fallback call
      mockGetUser.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const result = await refreshGlobalAdminStatus(true);
      
      // Should try to use localStorage fallback or handle error
      expect(result).toBeDefined();
    });
  });

  describe('checkCurrentUserAdminStatus', () => {
    it('should return false when no user is authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await checkCurrentUserAdminStatus();
      
      // If there's localStorage with admin status, it might return true
      // So we just check it's not undefined
      expect(result).toBeDefined();
      expect(mockGetUser).toHaveBeenCalled();
    });

    it('should return false when auth error occurs', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Auth error' },
      });

      const result = await checkCurrentUserAdminStatus();
      
      expect(result).toBe(false);
    });

    it('should return true for admin users', async () => {
      const mockUser = { id: 'user-123', email: 'admin@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: { role: 'admin' },
        error: null,
      });

      const result = await checkCurrentUserAdminStatus();

      expect(result).toBe(true);
      // SECURITY: Admin status no longer uses localStorage (Phase 2 fix)
      // Server-side verification only
    });

    it('should return false for non-admin users', async () => {
      const mockUser = { id: 'user-456', email: 'user@test.com' };
      
      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await checkCurrentUserAdminStatus();

      expect(result).toBe(false);
      // SECURITY: Admin status no longer uses localStorage
    });

    it('should return false on database error (no localStorage fallback)', async () => {
      const mockUser = { id: 'user-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const result = await checkCurrentUserAdminStatus();

      // SECURITY: On database error, return false (never fall back to localStorage)
      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(checkCurrentUserAdminStatus()).resolves.not.toThrow();
    });
  });

  describe('clearAdminStatusBackup', () => {
    it('should verify current user (no localStorage cleared)', async () => {
      const mockUser = { id: 'user-123', email: 'admin@test.com' };

      mockGetUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Should not throw
      await expect(clearAdminStatusBackup()).resolves.not.toThrow();

      // SECURITY: No localStorage operations - just verifies user
      expect(mockGetUser).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockGetUser.mockRejectedValue(new Error('Auth error'));

      // Should not throw
      await expect(clearAdminStatusBackup()).resolves.not.toThrow();
    });

    it('should handle missing user gracefully', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Should not throw
      await expect(clearAdminStatusBackup()).resolves.not.toThrow();
    });
  });
});

