import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock handles — available to vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockRequireAdmin,
  mockRequireLocalEngine,
  MockDatabaseClass,
  mockDbAll,
} = vi.hoisted(() => {
  const mockDbAll = vi.fn().mockReturnValue([]);
  // Must use regular function (not arrow) so vi.fn() is constructable with `new`
  const MockDatabaseClass = vi.fn(function () {
    return {
      prepare: vi.fn().mockReturnValue({ all: mockDbAll }),
      close: vi.fn(),
    };
  });
  return {
    mockRequireAdmin: vi.fn(),
    mockRequireLocalEngine: vi.fn(),
    MockDatabaseClass,
    mockDbAll,
  };
});

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------
vi.mock('@/lib/api-guards', () => ({
  requireAdmin: mockRequireAdmin,
  requireLocalEngine: mockRequireLocalEngine,
}));

vi.mock('@/lib/sqlite/require-database', () => ({
  Database: MockDatabaseClass,
}));

// ---------------------------------------------------------------------------
// Import the handler under test AFTER mocks are wired
// ---------------------------------------------------------------------------
import { POST } from '../route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse an SSE text stream into typed event objects. */
async function parseSSE(
  response: Response
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const text = await response.text();
  const events: Array<{ event: string; data: Record<string, unknown> }> = [];
  for (const block of text.split('\n\n')) {
    if (!block.trim()) continue;
    let event = '';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7);
      if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (event && data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        /* malformed data — skip */
      }
    }
  }
  return events;
}

/** Build a minimal POST request body with sensible defaults. */
function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/regulatory-review/assistant/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_BODY = {
  submissionId: 'SUB-001',
  query: 'What are the soil vapour standards?',
  scope: 'policy' as const,
  mode: 'fast' as const,
};

/**
 * Wire globalThis.fetch to simulate a successful Ollama session.
 * First call → GET /api/tags (model discovery)
 * Second call → POST /api/chat (streaming NDJSON)
 */
function mockOllamaSuccess(chunks: string[]) {
  const ndjson = chunks
    .map((text) => JSON.stringify({ message: { content: text } }))
    .join('\n');
  const encoded = new TextEncoder().encode(ndjson + '\n');

  let consumed = false;
  const mockFetch = vi.fn<typeof fetch>();

  // tags discovery
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      models: [{ name: 'mistral-nemo:latest' }],
    }),
  } as unknown as Response);

  // chat streaming
  mockFetch.mockResolvedValueOnce({
    ok: true,
    body: {
      getReader: () => ({
        read: () => {
          if (!consumed) {
            consumed = true;
            return Promise.resolve({
              done: false as const,
              value: encoded,
            });
          }
          return Promise.resolve({ done: true as const, value: undefined });
        },
      }),
    },
  } as unknown as Response);

  globalThis.fetch = mockFetch;
  return mockFetch;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/regulatory-review/assistant/chat', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: auth passes, DB returns empty
    mockRequireAdmin.mockResolvedValue(null);
    mockRequireLocalEngine.mockReturnValue(null);
    mockDbAll.mockReturnValue([]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ---- Auth & guards ----
  describe('authentication & authorization', () => {
    it('returns 401 when unauthenticated', async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe('Unauthorized');
    });

    it('returns 403 when not admin', async () => {
      mockRequireAdmin.mockResolvedValue(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(403);
    });

    it('returns 503 when local engine disabled', async () => {
      mockRequireLocalEngine.mockReturnValue(
        NextResponse.json(
          { error: 'This feature requires the local evaluation engine.' },
          { status: 503 }
        )
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(503);
    });
  });

  // ---- Validation ----
  describe('request validation', () => {
    it('returns 400 for invalid JSON body', async () => {
      const req = new Request('http://localhost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{{not-json',
      }) as unknown as NextRequest;

      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Invalid JSON');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await POST(makeRequest({ query: 'test' }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Missing required fields');
    });

    it('returns 400 for invalid scope', async () => {
      const res = await POST(
        makeRequest({ ...VALID_BODY, scope: 'everywhere' })
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Invalid scope');
    });

    it('returns 400 for invalid mode', async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, mode: 'turbo' }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Invalid mode');
    });
  });

  // ---- Indigenous hard-stop ----
  describe('Indigenous content hard-stop', () => {
    it('returns TIER_3 hard-stop and skips Ollama', async () => {
      const spy = vi.fn();
      globalThis.fetch = spy as unknown as typeof fetch;

      const res = await POST(
        makeRequest({
          ...VALID_BODY,
          query: 'What about indigenous consultation?',
        })
      );
      const events = await parseSSE(res);

      // delta with hard-stop text
      const delta = events.find((e) => e.event === 'delta');
      expect(delta).toBeDefined();
      expect(delta!.data.text).toContain('TIER_3_STATUTORY');

      // meta with model=none
      const meta = events.find((e) => e.event === 'meta');
      expect(meta).toBeDefined();
      expect(meta!.data.model).toBe('none');

      // done sentinel
      expect(events.find((e) => e.event === 'done')).toBeDefined();

      // Ollama must NOT have been called
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ---- Ollama connectivity ----
  describe('Ollama connectivity', () => {
    it('emits SSE error when Ollama is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('ECONNREFUSED')
      ) as typeof fetch;

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const err = events.find((e) => e.event === 'error');
      expect(err).toBeDefined();
      expect(String(err!.data.message)).toContain('not running');
    });

    it('emits SSE error when no compatible model is found', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'unrelated:7b' }],
        }),
      }) as typeof fetch;

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const err = events.find((e) => e.event === 'error');
      expect(err).toBeDefined();
      expect(String(err!.data.message)).toContain('No compatible model');
    });
  });

  // ---- SSE streaming ----
  describe('SSE streaming', () => {
    it('accumulates multiple delta events from Ollama chunks', async () => {
      mockOllamaSuccess(['Hello', ' world', '!']);

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const deltas = events.filter((e) => e.event === 'delta');
      expect(deltas).toHaveLength(3);
      expect(deltas[0].data.text).toBe('Hello');
      expect(deltas[1].data.text).toBe(' world');
      expect(deltas[2].data.text).toBe('!');
    });

    it('emits citation events for retrieved policies', async () => {
      // Return one mock policy row from the DB
      mockDbAll.mockReturnValueOnce([
        {
          id: 'AUTH-1',
          originalText: 'A contaminated site investigation must be conducted.',
          discretionTier: 'TIER_1_BINARY',
          sourceDocument: 'CSR 375/96',
          sourceSection: 'Section 1.1',
        },
      ]);
      mockOllamaSuccess(['Acknowledged.']);

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const citations = events.filter((e) => e.event === 'citation');
      expect(citations.length).toBeGreaterThanOrEqual(1);

      const first = citations[0].data;
      expect(first.type).toBe('policy');
      expect(first.id).toBe('AUTH-1');
      expect(first.source).toContain('CSR 375/96');
    });

    it('emits meta event with model, mode, retrievalCount, durationMs', async () => {
      mockOllamaSuccess(['Reply']);

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const meta = events.find((e) => e.event === 'meta');
      expect(meta).toBeDefined();
      expect(meta!.data.model).toBe('mistral-nemo:latest');
      expect(meta!.data.mode).toBe('fast');
      expect(typeof meta!.data.retrievalCount).toBe('number');
      expect(typeof meta!.data.durationMs).toBe('number');
    });

    it('terminates the stream with a done event', async () => {
      mockOllamaSuccess(['Done.']);

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      expect(events[events.length - 1].event).toBe('done');
    });

    it('emits error event when Ollama chat returns non-ok', async () => {
      const mockFetch = vi.fn<typeof fetch>();

      // tags OK
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral-nemo:latest' }],
        }),
      } as unknown as Response);

      // chat 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        body: null,
      } as unknown as Response);

      globalThis.fetch = mockFetch;

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const err = events.find((e) => e.event === 'error');
      expect(err).toBeDefined();
      expect(String(err!.data.message)).toContain('500');
    });

    it('emits error event when stream read throws mid-stream', async () => {
      const mockFetch = vi.fn<typeof fetch>();

      // tags OK
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [{ name: 'mistral-nemo:latest' }],
        }),
      } as unknown as Response);

      // chat — reader throws
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.reject(new Error('stream interrupted')),
          }),
        },
      } as unknown as Response);

      globalThis.fetch = mockFetch;

      const res = await POST(makeRequest(VALID_BODY));
      const events = await parseSSE(res);

      const err = events.find((e) => e.event === 'error');
      expect(err).toBeDefined();
      expect(String(err!.data.message)).toContain('stream interrupted');
    });

    it('caps history at last 10 turns', async () => {
      const mockFetch = mockOllamaSuccess(['OK']);

      // Build 15 history turns
      const history = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Turn ${i}`,
      }));

      await POST(makeRequest({ ...VALID_BODY, history }));

      // The Ollama /api/chat call is the second fetch call
      const chatCall = mockFetch.mock.calls[1];
      const chatBody = JSON.parse(chatCall[1]!.body as string);

      // messages = 1 system + 10 capped history + 1 context/user prompt
      expect(chatBody.messages).toHaveLength(12);
      // First history message should be Turn 5 (last 10 of 0..14)
      expect(chatBody.messages[1].content).toBe('Turn 5');
    });
  });
});
