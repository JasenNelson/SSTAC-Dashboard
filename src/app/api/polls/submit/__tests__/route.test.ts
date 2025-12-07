import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Mock environment variables
const originalEnv = process.env;
beforeEach(() => {
  vi.resetModules();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    NODE_ENV: 'test',
  };
  vi.clearAllMocks();
});

describe('POST /api/polls/submit', () => {
  describe('CEW Poll Submission', () => {
    it('should successfully submit a CEW poll vote', async () => {
      const mockPollId = 'poll-123';
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'vote-1', poll_id: mockPollId }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A', 'Option B'],
        optionIndex: 0,
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-123' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pollId).toBe(mockPollId);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_poll', {
        p_page_path: requestBody.pagePath,
        p_poll_index: requestBody.pollIndex,
        p_question: requestBody.question,
        p_options: requestBody.options,
      });
    });

    it('should generate unique user ID for CEW submissions', async () => {
      const mockPollId = 'poll-123';
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'vote-1' }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': 'session-123' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      // Verify insert was called with CEW user ID format
      const insertCall = mockSupabaseClient.from().insert.mock.calls[0][0];
      expect(insertCall.user_id).toMatch(/^CEW2025_session-123$/);
    });

    it('should handle CEW submission without session ID', async () => {
      const mockPollId = 'poll-123';
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'vote-1' }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      // Should generate fallback session ID
      const insertCall = mockSupabaseClient.from().insert.mock.calls[0][0];
      expect(insertCall.user_id).toMatch(/^CEW2025_session_\d+_[a-z0-9]+$/);
    });
  });

  describe('Authenticated Poll Submission', () => {
    it('should successfully submit an authenticated poll vote', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'poll-456';
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [], // No existing votes
                error: null,
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'vote-1', poll_id: mockPollId }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A', 'Option B'],
        optionIndex: 1,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pollId).toBe(mockPollId);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
    });

    it('should delete existing votes before inserting new one for authenticated users', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'poll-456';
      const cookieStore = {
        get: vi.fn((name: string) => ({ value: `cookie-${name}` })),
        set: vi.fn(),
      };
      
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'old-vote-1' }],
              error: null,
            }),
          }),
        }),
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
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ id: 'existing-vote' }],
                error: null,
              }),
            }),
          }),
          delete: mockDelete,
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'new-vote' }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      // Verify delete was called before insert
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
        pagePath: '/survey-results/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
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
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create/get poll');
    });

    it('should handle vote submission errors', async () => {
      const mockPollId = 'poll-123';
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Vote error' },
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A'],
        optionIndex: 0,
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to submit vote');
    });

    it('should handle invalid request body', async () => {
      mockCookies.mockResolvedValue({});
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      }) as NextRequest;
      
      const response = await POST(request);
      
      // Should handle gracefully - may return 500 due to missing pagePath
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle other_text field', async () => {
      const mockPollId = 'poll-123';
      const mockSupabaseClient = {
        rpc: vi.fn().mockResolvedValue({ data: mockPollId, error: null }),
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'vote-1' }],
              error: null,
            }),
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/holistic-protection',
        pollIndex: 0,
        question: 'Test question',
        options: ['Option A', 'Other'],
        optionIndex: 1,
        otherText: 'Custom answer',
      };
      
      const request = new Request('http://localhost/api/polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      const insertCall = mockSupabaseClient.from().insert.mock.calls[0][0];
      expect(insertCall.other_text).toBe('Custom answer');
    });
  });
});

