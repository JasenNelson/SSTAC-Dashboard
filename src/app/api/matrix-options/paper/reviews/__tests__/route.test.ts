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

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
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

  it('rejects anonymous (and claim-less) sessions on GET and PUT before touching the database', async () => {
    for (const sessionUser of [{ ...user, is_anonymous: true }, { id: user.id }]) {
      getAuthAndRateLimitMock.mockResolvedValueOnce({ user: sessionUser, supabase: { from: vi.fn(() => queryMock), rpc: rpcMock }, rateLimitResponse: null, rateLimitHeaders: {} });
      const read = await GET(requestFor(`https://example.test/api/matrix-options/paper/reviews${validQuery}`));
      expect(read.status).toBe(401);
      getAuthAndRateLimitMock.mockResolvedValueOnce({ user: sessionUser, supabase: { from: vi.fn(() => queryMock), rpc: rpcMock }, rateLimitResponse: null, rateLimitHeaders: {} });
      const write = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
      expect(write.status).toBe(401);
      expect(await write.json()).toEqual({ outcome: 'unauthenticated' });
    }
    expect(queryMock.select).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
    // Two-sided: a signed-in reviewer still reads.
    expect((await GET(requestFor(`https://example.test/api/matrix-options/paper/reviews${validQuery}`))).status).toBe(200);
  });

  it('maps the database write throttle (rate_limited) to 429 with no row', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'rate_limited', row: null }, error: null });
    const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody() }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ outcome: 'rate_limited' });
  });

  it('rejects a blank SUBMIT before calling the database, but still accepts a blank draft save', async () => {
    for (const text of ['', '   \n\t ']) {
      const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ action: 'submit', text }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
      expect(response.status).toBe(400);
    }
    expect(rpcMock).not.toHaveBeenCalled();
    // Two-sided: clearing a draft is still a valid save.
    const draft = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ action: 'save-draft', text: '' }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(draft.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_save_draft', expect.objectContaining({ p_text: '' }));
  });

  it('refuses (409 identity_changed) a save pinned to a different reviewer than the session, before the database', async () => {
    const other = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ expectedUserId: '22222222-2222-4222-8222-222222222222' }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(other.status).toBe(409);
    expect(await other.json()).toEqual({ outcome: 'identity_changed' });
    expect(rpcMock).not.toHaveBeenCalled();
    // Two-sided: the page's own reviewer saves normally.
    const own = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ expectedUserId: user.id }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(own.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it('maps the database blank-submission guard to 422 with no row', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'blank_submission', row: null }, error: null });
    const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ action: 'submit', text: 'non-blank here' }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ outcome: 'blank_submission' });
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

  // Two-sided: a stale_revision RPC result with no row means the row the
  // client's base revision named no longer exists (deleted, or a new
  // manifest). This must stay a 409 the client can recover from by re-basing
  // to "no row" and retrying -- never a 503, which the client can only retry
  // forever against a revision that will never come back.
  it('maps a rowless stale_revision to a 409 with no row (never a 503 the client can only retry forever)', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'stale_revision', row: null }, error: null });
    const response = await PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: putBody({ expectedRevision: 1 }) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
    expect(response.status).toBe(409);
    const payload = await response.json() as { outcome: string; row?: unknown };
    expect(payload.outcome).toBe('stale_revision');
    expect(payload).not.toHaveProperty('row');
  });
});
