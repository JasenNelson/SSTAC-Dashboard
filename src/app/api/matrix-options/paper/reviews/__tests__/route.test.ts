import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { getAuthAndRateLimitMock, queryMock, rpcMock } = vi.hoisted(() => ({
  getAuthAndRateLimitMock: vi.fn(),
  queryMock: { select: vi.fn(), eq: vi.fn(), order: vi.fn() },
  rpcMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: getAuthAndRateLimitMock }));
vi.mock('server-only', () => ({}));

import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { GET } from '../route';
import { PUT } from '../[questionId]/route';

const user = { id: '11111111-1111-4111-8111-111111111111' };
const manifest = getReviewManifest();
const questionId = 'rpq:1.0.11-remediated-7-8-successor-20260918-D:q01';
const validQuery = `?documentVersion=${encodeURIComponent(REVISED_PAPER_VERSION)}&manifestSha256=${manifest.sha256}`;
const validRow = () => ({ document_version: REVISED_PAPER_VERSION, manifest_sha256: manifest.sha256, cohort_id: 'categories', question_id: questionId, draft_text: 'saved', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null });
const requestFor = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;
const putBody = (overrides: Record<string, unknown> = {}) => JSON.stringify({ documentVersion: REVISED_PAPER_VERSION, manifestSha256: manifest.sha256, cohortId: 'categories', action: 'save-draft', text: 'hello', expectedRevision: null, ...overrides });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  queryMock.select.mockReturnValue(queryMock);
  queryMock.eq.mockReturnValue(queryMock);
  queryMock.order.mockResolvedValue({ data: [], error: null });
  rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: validRow() }, error: null });
  getAuthAndRateLimitMock.mockResolvedValue({ user, supabase: { from: vi.fn(() => queryMock), rpc: rpcMock }, rateLimitResponse: null, rateLimitHeaders: {} });
});

describe('Matrix paper review response API', () => {
  it('reads only authenticated user rows bound to the recomputed release and returns no-store', async () => {
    const response = await GET(requestFor(`https://example.test/api/matrix-options/paper/reviews${validQuery}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).userKey).toBe(user.id);
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', user.id);
    expect(queryMock.eq).toHaveBeenCalledWith('document_version', REVISED_PAPER_VERSION);
    expect(queryMock.eq).toHaveBeenCalledWith('manifest_sha256', manifest.sha256);
  });

  it('fails closed when the database returns a malformed or wrong-identity row', async () => {
    queryMock.order.mockResolvedValue({ data: [{ ...validRow(), manifest_sha256: 'a'.repeat(64) }], error: null });
    const response = await GET(requestFor(`https://example.test/api/matrix-options/paper/reviews${validQuery}`));
    expect(response.status).toBe(503);
    expect((await response.json()).outcome).toBe('persistence_unavailable');
  });

  it('authenticates before parsing malformed input and never accepts a body user id', async () => {
    getAuthAndRateLimitMock.mockResolvedValueOnce({ user: null, supabase: {}, rateLimitResponse: null, rateLimitHeaders: {} });
    const unauthorized = await PUT(requestFor('https://example.test/api/matrix-options/paper/reviews/bad', { method: 'PUT', body: '{' }), { params: Promise.resolve({ questionId: 'bad' }) });
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ outcome: 'unauthenticated' });

    const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_save_draft', expect.objectContaining({ p_question_id: questionId, p_expected_revision: null }));
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain('user_id');

    const malformed = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(malformed.status).toBe(400);
  });

  it('stops at the rate-limit response before parsing the request body', async () => {
    const rateLimitResponse = new Response('rate limited', { status: 429 });
    getAuthAndRateLimitMock.mockResolvedValueOnce({ user, supabase: {}, rateLimitResponse, rateLimitHeaders: {} });
    const response = await PUT(requestFor('https://example.test/api/matrix-options/paper/reviews/q', { method: 'PUT', body: '{' }), { params: Promise.resolve({ questionId: 'q' }) });
    expect(response.status).toBe(429);
  });

  it('maps a CAS conflict and requires a valid saved row', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'stale_revision', row: { ...validRow(), revision: 2 } }, error: null });
    const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ expectedRevision: 1 }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(response.status).toBe(409);
    expect((await response.json()).outcome).toBe('stale_revision');

    rpcMock.mockResolvedValue({ data: { outcome: 'ok' }, error: null });
    const invalid = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(invalid.status).toBe(503);
  });

  it('maps noop and unknown identity outcomes according to the RPC contract', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'noop_already_submitted', row: { ...validRow(), submitted_text: 'submitted', submitted_revision: 1 } }, error: null });
    const noop = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ action: 'submit' }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(noop.status).toBe(200);
    expect((await noop.json()).outcome).toBe('noop_already_submitted');

    const unknown = await PUT(requestFor('https://example.test/api/matrix-options/paper/reviews/unknown', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: 'unknown' }) });
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).outcome).toBe('unknown_identity');
  });

  it('never attaches a row to row-less RPC outcomes', async () => {
    for (const outcome of ['unknown_identity', 'stale_manifest', 'unauthenticated', 'too_large', 'persistence_unavailable'] as const) {
      rpcMock.mockResolvedValueOnce({ data: { outcome, row: validRow() }, error: null });
      const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
      const payload = await response.json() as { outcome: string; row?: unknown };
      expect(payload.outcome).toBe(outcome);
      expect(payload).not.toHaveProperty('row');
    }
  });
});
