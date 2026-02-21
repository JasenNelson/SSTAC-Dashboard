import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';

// --- Hoisted mock handles ---
const { mockRequireAdmin, mockRequireLocalEngine } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockRequireLocalEngine: vi.fn(),
}));

vi.mock('@/lib/api-guards', () => ({
  requireAdmin: mockRequireAdmin,
  requireLocalEngine: mockRequireLocalEngine,
}));

import { GET } from '../route';

// --- Tests ---
describe('GET /api/regulatory-review/assistant/models', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
    mockRequireLocalEngine.mockReturnValue(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // --- Auth / guards ---
  it('returns 401 when unauthenticated', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    );
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 503 when local engine disabled', async () => {
    mockRequireLocalEngine.mockReturnValue(
      NextResponse.json(
        { error: 'This feature requires the local evaluation engine.' },
        { status: 503 }
      )
    );
    const res = await GET();
    expect(res.status).toBe(503);
  });

  // --- Ollama connectivity ---
  it('returns empty models with error when Ollama unreachable', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error('ECONNREFUSED')
    ) as typeof fetch;

    const res = await GET();
    const body = await res.json();
    expect(body.models).toEqual([]);
    expect(body.error).toContain('not reachable');
  });

  it('returns empty models with error when Ollama returns non-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as typeof fetch;

    const res = await GET();
    const body = await res.json();
    expect(body.models).toEqual([]);
    expect(body.error).toContain('500');
  });

  // --- Successful discovery ---
  it('maps models with fast/deep capabilities from registry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'mistral-nemo:latest', size: 8_000_000_000, details: { parameter_size: '12B' } },
          { name: 'qwen3:14b', size: 9_000_000_000 },
          { name: 'unknown-model:7b', size: 4_000_000_000 },
        ],
      }),
    }) as typeof fetch;

    const res = await GET();
    const body = await res.json();

    expect(body.models).toHaveLength(3);

    // mistral-nemo is allowed in both fast and deep
    const mistral = body.models.find((m: { name: string }) => m.name === 'mistral-nemo:latest');
    expect(mistral.capabilities).toContain('fast');
    expect(mistral.capabilities).toContain('deep');
    expect(mistral.size).toBe('12B');

    // qwen3 is deep-only
    const qwen = body.models.find((m: { name: string }) => m.name === 'qwen3:14b');
    expect(qwen.capabilities).toContain('deep');
    expect(qwen.capabilities).not.toContain('fast');

    // unknown model has no capabilities
    const unknown = body.models.find((m: { name: string }) => m.name === 'unknown-model:7b');
    expect(unknown.capabilities).toEqual([]);
  });

  it('formats byte size when parameter_size not in details', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [{ name: 'tiny:1b', size: 536_870_912 }], // 512 MB
      }),
    }) as typeof fetch;

    const res = await GET();
    const body = await res.json();
    expect(body.models[0].size).toBe('512MB');
  });
});
