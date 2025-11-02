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
  console.log = vi.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('POST /api/wordcloud-polls/submit', () => {
  describe('Validation', () => {
    it('should reject missing required fields', async () => {
      mockCookies.mockResolvedValue({});
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagePath: '/cew-polls/test' }),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject empty words array', async () => {
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/test',
        pollIndex: 0,
        question: 'Test question',
        words: [],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('At least one word is required');
    });

    it('should reject words exceeding maxWords limit', async () => {
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/test',
        pollIndex: 0,
        question: 'Test question',
        maxWords: 3,
        words: ['word1', 'word2', 'word3', 'word4'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Maximum 3 words allowed');
    });

    it('should reject words exceeding wordLimit length', async () => {
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/test',
        pollIndex: 0,
        question: 'Test question',
        wordLimit: 5,
        words: ['short', 'verylongword'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('Words must be 5 characters or less');
    });

    it('should reject duplicate words', async () => {
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/test',
        pollIndex: 0,
        question: 'Test question',
        words: ['word1', 'word2', 'word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Duplicate words are not allowed');
    });

    it('should handle case-insensitive duplicate detection', async () => {
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/test',
        pollIndex: 0,
        question: 'Test question',
        words: ['Word', 'WORD', 'word'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Duplicate words are not allowed');
    });
  });

  describe('CEW Wordcloud Poll Submission', () => {
    it('should successfully submit CEW wordcloud votes', async () => {
      const mockPollId = 'wordcloud-poll-123';
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
            data: [
              { id: 'vote-1', word: 'word1' },
              { id: 'vote-2', word: 'word2' },
            ],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/wiks',
        pollIndex: 0,
        question: 'Enter words',
        maxWords: 3,
        wordLimit: 20,
        words: ['word1', 'word2'],
        authCode: 'CEW2025',
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_or_create_wordcloud_poll_fixed', {
        p_page_path: requestBody.pagePath,
        p_poll_index: requestBody.pollIndex,
        p_question: requestBody.question,
        p_max_words: requestBody.maxWords,
        p_word_limit: requestBody.wordLimit,
      });
    });

    it('should lowercase words before storing', async () => {
      const mockPollId = 'wordcloud-poll-123';
      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'vote-1' }, { id: 'vote-2' }, { id: 'vote-3' }],
        error: null,
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
        pagePath: '/cew-polls/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['HELLO', 'World', 'test'], // Different words to avoid duplicate detection
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall[0].word).toBe('hello');
      expect(insertCall[1].word).toBe('world');
      expect(insertCall[2].word).toBe('test');
    });

    it('should trim words before storing', async () => {
      const mockPollId = 'wordcloud-poll-123';
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
            data: [{ id: 'vote-1' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['  word  ', '  another  '],
      };
      
      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'vote-1' }, { id: 'vote-2' }],
        error: null,
      });
      
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        insert: mockInsert,
      });
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      await POST(request);
      
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall[0].word).toBe('word');
      expect(insertCall[1].word).toBe('another');
    });
  });

  describe('Authenticated Wordcloud Poll Submission', () => {
    it('should successfully submit authenticated wordcloud votes', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'wordcloud-poll-456';
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
          insert: vi.fn().mockResolvedValue({
            data: [{ id: 'vote-1' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
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
        pagePath: '/survey-results/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
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
        pagePath: '/cew-polls/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to get or create poll');
    });

    it('should handle vote submission errors', async () => {
      const mockPollId = 'wordcloud-poll-123';
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
            data: null,
            error: { message: 'Vote error' },
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue({});
      
      const requestBody = {
        pagePath: '/cew-polls/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }) as NextRequest;
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to submit');
    });

    it('should handle delete errors gracefully for authenticated users', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockPollId = 'wordcloud-poll-456';
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
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Delete error' },
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({
            data: [{ id: 'new-vote' }],
            error: null,
          }),
        }),
      };
      
      mockCreateServerClient.mockReturnValue(mockSupabaseClient);
      mockCookies.mockResolvedValue(cookieStore);
      
      const requestBody = {
        pagePath: '/survey-results/wiks',
        pollIndex: 0,
        question: 'Enter words',
        words: ['word1'],
      };
      
      const request = new Request('http://localhost/api/wordcloud-polls/submit', {
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

