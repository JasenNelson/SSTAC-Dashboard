import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { getAuthAndRateLimitMock, queryMock, rpcMock, fromMock } = vi.hoisted(() => ({
  getAuthAndRateLimitMock: vi.fn(),
  queryMock: { select: vi.fn(), eq: vi.fn(), order: vi.fn() },
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: getAuthAndRateLimitMock }));
vi.mock('server-only', () => ({}));

import { R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { GET } from '../route';
import { PUT } from '../[questionId]/route';

/*
 * Version-safe review persistence. Each release is addressed by its own
 * (document version, review manifest digest) pair. Nothing is read, written,
 * copied or re-keyed across releases: a predecessor question id is unknown
 * under the R5 manifest and an R5 question id is unknown under the
 * predecessor's.
 */

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const predecessor = getReviewManifest(REVISED_PAPER_VERSION);
const r5 = getReviewManifest(R5_PAPER_VERSION);
const r5Question = (number: number) => `rpq:${R5_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
const predecessorQuestion = (number: number) => `rpq:${REVISED_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
const requestFor = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;
const query = (version: string, sha: string) => `?documentVersion=${encodeURIComponent(version)}&manifestSha256=${sha}`;
const row = (version: string, sha: string, questionId: string, cohortId = 'categories') => ({ document_version: version, manifest_sha256: sha, cohort_id: cohortId, question_id: questionId, draft_text: 'saved', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null });
const body = (version: string, sha: string, overrides: Record<string, unknown> = {}) => JSON.stringify({ documentVersion: version, manifestSha256: sha, cohortId: 'categories', action: 'save-draft', text: 'hello', expectedRevision: null, ...overrides });
const put = (questionId: string, payload: string) => PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
const get = (search: string) => GET(requestFor(`https://example.test/api/matrix-options/paper/reviews${search}`));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  queryMock.select.mockReturnValue(queryMock);
  queryMock.eq.mockReturnValue(queryMock);
  queryMock.order.mockResolvedValue({ data: [], error: null });
  fromMock.mockReturnValue(queryMock);
  rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(R5_PAPER_VERSION, r5.sha256, r5Question(1)) }, error: null });
  getAuthAndRateLimitMock.mockResolvedValue({ user, supabase: { from: fromMock, rpc: rpcMock }, rateLimitResponse: null, rateLimitHeaders: {} });
});

describe('review responses: reads are bound to one release', () => {
  it('reads R5 rows only under the R5 version and the R5 manifest digest', async () => {
    queryMock.order.mockResolvedValue({ data: [row(R5_PAPER_VERSION, r5.sha256, r5Question(1)), row(R5_PAPER_VERSION, r5.sha256, r5Question(11), 'methods-water-type')], error: null });
    const response = await get(query(R5_PAPER_VERSION, r5.sha256));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const payload = await response.json();
    expect(payload.rows.map((entry: { question_id: string }) => entry.question_id)).toEqual([r5Question(1), r5Question(11)]);
    expect(queryMock.eq).toHaveBeenCalledWith('user_id', user.id);
    expect(queryMock.eq).toHaveBeenCalledWith('document_version', R5_PAPER_VERSION);
    expect(queryMock.eq).toHaveBeenCalledWith('manifest_sha256', r5.sha256);
    expect(queryMock.eq).not.toHaveBeenCalledWith('document_version', REVISED_PAPER_VERSION);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('still reads predecessor rows under the predecessor identity (the read-only lineage read)', async () => {
    queryMock.order.mockResolvedValue({ data: [row(REVISED_PAPER_VERSION, predecessor.sha256, predecessorQuestion(1))], error: null });
    const response = await get(query(REVISED_PAPER_VERSION, predecessor.sha256));
    expect(response.status).toBe(200);
    expect((await response.json()).rows).toHaveLength(1);
    expect(queryMock.eq).toHaveBeenCalledWith('document_version', REVISED_PAPER_VERSION);
    expect(queryMock.eq).toHaveBeenCalledWith('manifest_sha256', predecessor.sha256);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ['the R5 version with the predecessor manifest', query(R5_PAPER_VERSION, predecessor.sha256)],
    ['the predecessor version with the R5 manifest', query(REVISED_PAPER_VERSION, r5.sha256)],
    ['an unknown version', query('some-other-version', r5.sha256)],
    ['a repeated version', `${query(R5_PAPER_VERSION, r5.sha256)}&documentVersion=${encodeURIComponent(REVISED_PAPER_VERSION)}`],
    ['a missing manifest', `?documentVersion=${encodeURIComponent(R5_PAPER_VERSION)}`],
  ])('rejects %s (400) before the session or the database', async (_name, search) => {
    const response = await get(search);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid release identity' });
    expect(getAuthAndRateLimitMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('fails closed when a row of the other release comes back under this release', async () => {
    // A predecessor row returned for an R5 read (wrong version, digest and question id).
    queryMock.order.mockResolvedValue({ data: [row(REVISED_PAPER_VERSION, predecessor.sha256, predecessorQuestion(1))], error: null });
    const wrongRelease = await get(query(R5_PAPER_VERSION, r5.sha256));
    expect(wrongRelease.status).toBe(503);
    expect((await wrongRelease.json()).rows).toEqual([]);
    // A row carrying the R5 identity but a predecessor question id.
    queryMock.order.mockResolvedValue({ data: [row(R5_PAPER_VERSION, r5.sha256, predecessorQuestion(1))], error: null });
    expect((await get(query(R5_PAPER_VERSION, r5.sha256))).status).toBe(503);
    // An otherwise valid R5 row that carries only the other release's digest, or only its version.
    queryMock.order.mockResolvedValue({ data: [row(R5_PAPER_VERSION, predecessor.sha256, r5Question(1))], error: null });
    expect((await get(query(R5_PAPER_VERSION, r5.sha256))).status).toBe(503);
    queryMock.order.mockResolvedValue({ data: [row(REVISED_PAPER_VERSION, r5.sha256, r5Question(1))], error: null });
    expect((await get(query(R5_PAPER_VERSION, r5.sha256))).status).toBe(503);
    // Two-sided: the same row under its own identity is served.
    queryMock.order.mockResolvedValue({ data: [row(R5_PAPER_VERSION, r5.sha256, r5Question(1))], error: null });
    expect((await get(query(R5_PAPER_VERSION, r5.sha256))).status).toBe(200);
    // An R5 question filed under a topic that does not ask it.
    queryMock.order.mockResolvedValue({ data: [row(R5_PAPER_VERSION, r5.sha256, r5Question(11), 'categories')], error: null });
    expect((await get(query(R5_PAPER_VERSION, r5.sha256))).status).toBe(503);
  });
});

describe('review responses: writes are bound to one release', () => {
  it('sends an R5 save to the database under the R5 identity only', async () => {
    const response = await put(r5Question(1), body(R5_PAPER_VERSION, r5.sha256));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_save_draft', { p_document_version: R5_PAPER_VERSION, p_manifest_sha256: r5.sha256, p_cohort_id: 'categories', p_question_id: r5Question(1), p_text: 'hello', p_expected_revision: null });
    expect((await response.json()).row.question_id).toBe(r5Question(1));
  });

  it('sends the changed question Q11 under its R5 topic, as a fresh R5 response', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(R5_PAPER_VERSION, r5.sha256, r5Question(11), 'methods-water-type') }, error: null });
    const response = await put(r5Question(11), body(R5_PAPER_VERSION, r5.sha256, { cohortId: 'methods-water-type', action: 'submit', text: 'a fresh answer', expectedRevision: null }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_submit', expect.objectContaining({ p_document_version: R5_PAPER_VERSION, p_manifest_sha256: r5.sha256, p_question_id: r5Question(11), p_cohort_id: 'methods-water-type', p_text: 'a fresh answer', p_expected_revision: null }));
  });

  it('surfaces the database refusal for an unseeded R5 manifest as unknown_identity, with no row', async () => {
    // Until the R5 questions are provisioned in the database, the save RPC
    // answers unknown_identity. The route passes that through: nothing is
    // written, and nothing is retried under another release.
    rpcMock.mockResolvedValue({ data: { outcome: 'unknown_identity', row: null }, error: null });
    const response = await put(r5Question(1), body(R5_PAPER_VERSION, r5.sha256));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(REVISED_PAPER_VERSION);
  });

  it.each([
    ['a predecessor question id under the R5 identity', predecessorQuestion(1), R5_PAPER_VERSION, 'r5'],
    ['an R5 question id under the predecessor identity', r5Question(1), REVISED_PAPER_VERSION, 'predecessor'],
  ])('refuses %s as an unknown identity, before the database', async (_name, questionId, version, which) => {
    const sha = which === 'r5' ? r5.sha256 : predecessor.sha256;
    const response = await put(questionId, body(version, sha));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ['the R5 version with the predecessor manifest', R5_PAPER_VERSION, 'predecessor'],
    ['the predecessor version with the R5 manifest', REVISED_PAPER_VERSION, 'r5'],
    ['an unknown version', 'some-other-version', 'r5'],
  ])('refuses %s (400), before the database', async (_name, version, which) => {
    const sha = which === 'r5' ? r5.sha256 : predecessor.sha256;
    const response = await put(r5Question(1), body(version, sha));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('refuses an R5 question filed under a topic that does not ask it', async () => {
    const response = await put(r5Question(11), body(R5_PAPER_VERSION, r5.sha256, { cohortId: 'categories' }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('treats a database row of the other release as unavailable, never as a saved R5 response', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(REVISED_PAPER_VERSION, predecessor.sha256, predecessorQuestion(1)) }, error: null });
    const response = await put(r5Question(1), body(R5_PAPER_VERSION, r5.sha256));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ outcome: 'persistence_unavailable' });
  });

  it('leaves predecessor saves and submits exactly as they were', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(REVISED_PAPER_VERSION, predecessor.sha256, predecessorQuestion(1)) }, error: null });
    const save = await put(predecessorQuestion(1), body(REVISED_PAPER_VERSION, predecessor.sha256));
    expect(save.status).toBe(200);
    expect(rpcMock).toHaveBeenLastCalledWith('matrix_paper_review_save_draft', { p_document_version: REVISED_PAPER_VERSION, p_manifest_sha256: predecessor.sha256, p_cohort_id: 'categories', p_question_id: predecessorQuestion(1), p_text: 'hello', p_expected_revision: null });
    const submit = await put(predecessorQuestion(1), body(REVISED_PAPER_VERSION, predecessor.sha256, { action: 'submit', expectedRevision: 1 }));
    expect(submit.status).toBe(200);
    expect(rpcMock).toHaveBeenLastCalledWith('matrix_paper_review_submit', expect.objectContaining({ p_document_version: REVISED_PAPER_VERSION, p_manifest_sha256: predecessor.sha256, p_expected_revision: 1 }));
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(R5_PAPER_VERSION);
  });
});
