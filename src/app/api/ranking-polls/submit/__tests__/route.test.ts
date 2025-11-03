import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import type { NextRequest } from 'next/server';

// Mock next/headers
const mockCookies = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

// Mock @supabase/ssr
const mockCreateServerClient = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

// Mock console.log to reduce noise in tests
const originalConsoleLog = console.log;
beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NODE_ENV: 'test',
  };
  vi.clearAllMocks();
  console.log = vi.fn(); // Suppress console.log in tests
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('POST /api/ranking-polls/submit', () => {
  describe('CEW Ranking Poll Submission', () => {
    it('should successfully submit CEW ranking votes', async () => {
      const mockPollId = 'ranking-poll-123';
      const mockSelect = vi.fn().mockResolvedValue({
        data: [
          { id: 'vote-1', rank: 1 },
          { id: 'vote-2', rank: 2 },
        ],
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: 'Rank these options',
        options: ['Option A', 'Option B'],
        rankings: [
          { optionIndex: 0, rank: 1 },
          { optionIndex: 1, rank: 2 },
        ],
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pollId).toBe(mockPollId);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_ranking_poll', {
        p_page_path: requestBody.pagePath,
        p_poll_index: requestBody.pollIndex,
        p_question: requestBody.question,
        p_options: requestBody.options,
      });
    });

    it('should generate unique user ID for CEW ranking submissions', async () => {
      const mockPollId = 'ranking-poll-123';
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'vote-1' }],
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      // Verify insert was called with data
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(Array.isArray(insertCall)).toBe(true);
      expect(insertCall[0].user_id).toMatch(/^CEW2025_\d+_[a-z0-9]+$/);
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should insert multiple ranking votes', async () => {
      const mockPollId = 'ranking-poll-123';
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({
            data: [{ id: 'vote-1' }, { id: 'vote-2' }, { id: 'vote-3' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['A', 'B', 'C'],
        rankings: [
          { optionIndex: 0, rank: 1 },
          { optionIndex: 1, rank: 2 },
          { optionIndex: 2, rank: 3 },
        ],
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const mockSelectMultiple = vi.fn().mockResolvedValue({
        data: [{ id: 'vote-1' }, { id: 'vote-2' }, { id: 'vote-3' }],
        error: null,
      });
      const mockInsertMultiple = vi.fn().mockReturnValue({
        select: mockSelectMultiple,
      });
      
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: mockInsertMultiple,
      });
      
      await POST(request);
      
      expect(mockInsertMultiple).toHaveBeenCalled();
      const insertCall = mockInsertMultiple.mock.calls[0][0];
      expect(insertCall).toHaveLength(3);
      expect(insertCall[0].rank).toBe(1);
      expect(insertCall[1].rank).toBe(2);
      expect(insertCall[2].rank).toBe(3);
    });
  });

  describe('Authenticated Ranking Poll Submission', () => {
    it('should successfully submit authenticated ranking votes', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'ranking-poll-456';
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });
      
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'vote-1' }],
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
          insert: mockInsert,
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pollId).toBe(mockPollId);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should delete existing votes before inserting for authenticated users', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'ranking-poll-456';
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'old-vote' }],
            error: null,
          }),
        }),
      });
      
      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'new-vote' }],
        error: null,
      });
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
          insert: mockInsert,
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should return 401 for unauthenticated users on survey-results pages', async () => {
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Error Handling', () => {
    it('should handle poll creation errors', async () => {
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create/get ranking poll');
    });

    it('should handle vote submission errors', async () => {
      const mockPollId = 'ranking-poll-123';
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Vote error' },
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to submit ranking votes');
    });

    it('should handle delete errors gracefully for authenticated users', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'ranking-poll-456';
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Delete error' },
          }),
        }),
      });
      
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'new-vote' }],
        error: null,
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: mockSelect,
      });
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
          insert: mockInsert,
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/prioritization',
        pollIndex: 0,
        question: 'Rank these',
        options: ['Option A'],
        rankings: [{ optionIndex: 0, rank: 1 }],
      };
      
      const request = new Request('http://localhost/api/ranking-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      // Should continue despite delete error
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

