import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { authMock, query, rpc } = vi.hoisted(() => ({
  authMock: vi.fn(), query: { select: vi.fn(), eq: vi.fn(), order: vi.fn() }, rpc: vi.fn(),
}));
vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: authMock }));
vi.mock('server-only', () => ({}));

import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { GET } from '../route';
import { PUT } from '../[questionId]/route';

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const manifest = getReviewManifest(V0991_PAPER_VERSION);
const questionId = `rpq:${V0991_PAPER_VERSION}:q01`;
const row = { document_version: V0991_PAPER_VERSION, manifest_sha256: manifest.sha256,
  cohort_id: 'categories', question_id: questionId, draft_text: 'saved history', submitted_text: null,
  revision: 1, submitted_revision: null, submitted_at: null, updated_at: null };
const request = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [row], error: null });
  authMock.mockResolvedValue({ user, supabase: { from: vi.fn(() => query), rpc }, rateLimitResponse: null, rateLimitHeaders: {} });
});

describe('historical paper review responses', () => {
  it('reads the signed-in reviewer history under immutable v0.9.91 identity', async () => {
    const url = `https://example.test/api/matrix-options/paper/reviews?documentVersion=${V0991_PAPER_VERSION}&manifestSha256=${manifest.sha256}`;
    const response = await GET(request(url));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).rows).toEqual([row]);
    expect(query.eq).toHaveBeenCalledWith('document_version', V0991_PAPER_VERSION);
    expect(query.eq).toHaveBeenCalledWith('manifest_sha256', manifest.sha256);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed or cross-release history returned by storage', async () => {
    query.order.mockResolvedValue({ data: [{ ...row, document_version: 'other' }], error: null });
    const response = await GET(request(`https://example.test/api/matrix-options/paper/reviews?documentVersion=${V0991_PAPER_VERSION}&manifestSha256=${manifest.sha256}`));
    expect(response.status).toBe(503);
    expect((await response.json()).rows).toEqual([]);
  });

  it('rejects every new v0.9.91 save or submission before RPC, regardless of payload', async () => {
    for (const body of ['{', '{}', JSON.stringify({ documentVersion: V0991_PAPER_VERSION, manifestSha256: manifest.sha256,
      cohortId: 'categories', action: 'submit', text: 'new response', expectedRevision: 0 })]) {
      const response = await PUT(request(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', body }), { params: Promise.resolve({ questionId }) });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ outcome: 'release_read_only' });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('preserves authentication, navigation gate and rate limit before the read-only response', async () => {
    authMock.mockResolvedValueOnce({ user: null, supabase: {}, rateLimitResponse: null, rateLimitHeaders: {} });
    expect((await PUT(request('https://example.test/api/matrix-options/paper/reviews/q', { method: 'PUT' }), { params: Promise.resolve({ questionId: 'q' }) })).status).toBe(401);
    authMock.mockResolvedValueOnce({ user, supabase: {}, rateLimitResponse: new Response('rate limited', { status: 429 }), rateLimitHeaders: {} });
    expect((await PUT(request('https://example.test/api/matrix-options/paper/reviews/q', { method: 'PUT' }), { params: Promise.resolve({ questionId: 'q' }) })).status).toBe(429);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false';
    expect((await PUT(request('https://example.test/api/matrix-options/paper/reviews/q', { method: 'PUT' }), { params: Promise.resolve({ questionId: 'q' }) })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});
