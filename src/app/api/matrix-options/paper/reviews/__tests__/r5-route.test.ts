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

import { R5_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
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
const v0991 = getReviewManifest(V0991_PAPER_VERSION);
const v0991Question = (number: number) => `rpq:${V0991_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
// The topic that asks a v0.9.91 question, and one topic that does not.
const v0991CohortOf = (number: number) => Object.entries(v0991.cohortQuestionIds).find(([, ids]) => ids.includes(v0991Question(number)))![0];
const v0991WrongCohortFor = (number: number) => Object.entries(v0991.cohortQuestionIds).find(([, ids]) => !ids.includes(v0991Question(number)))![0];
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
  rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(V0991_PAPER_VERSION, v0991.sha256, v0991Question(1), v0991CohortOf(1)) }, error: null });
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

// Plan R4: only v0.9.91 collects responses. The write-binding cases that guarded R5/predecessor saves now guard the
// same identity binding for v0.9.91, and the R5/predecessor save paths assert the new 403 release_read_only contract.
describe('review responses: writes are bound to one release', () => {
  const c1 = v0991CohortOf(1);
  it('sends a v0.9.91 save to the database under the v0.9.91 identity only', async () => {
    const response = await put(v0991Question(1), body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: c1 }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_save_draft', { p_document_version: V0991_PAPER_VERSION, p_manifest_sha256: v0991.sha256, p_cohort_id: c1, p_question_id: v0991Question(1), p_text: 'hello', p_expected_revision: null });
    expect((await response.json()).row.question_id).toBe(v0991Question(1));
  });

  it('sends the changed question Q11 under its v0.9.91 topic, as a fresh response', async () => {
    const c11 = v0991CohortOf(11);
    rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(V0991_PAPER_VERSION, v0991.sha256, v0991Question(11), c11) }, error: null });
    const response = await put(v0991Question(11), body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: c11, action: 'submit', text: 'a fresh answer', expectedRevision: null }));
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_submit', expect.objectContaining({ p_document_version: V0991_PAPER_VERSION, p_manifest_sha256: v0991.sha256, p_question_id: v0991Question(11), p_cohort_id: c11, p_text: 'a fresh answer', p_expected_revision: null }));
  });

  it('surfaces the database refusal for an unseeded v0.9.91 manifest as unknown_identity, with no row', async () => {
    // Until the questions are provisioned in the database, the save RPC
    // answers unknown_identity. The route passes that through: nothing is
    // written, and nothing is retried under another release.
    rpcMock.mockResolvedValue({ data: { outcome: 'unknown_identity', row: null }, error: null });
    const response = await put(v0991Question(1), body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: c1 }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(REVISED_PAPER_VERSION);
    expect(JSON.stringify(rpcMock.mock.calls)).not.toContain(R5_PAPER_VERSION);
  });

  it('refuses a predecessor or R5 question id under the v0.9.91 identity as an unknown identity, before the database', async () => {
    for (const questionId of [predecessorQuestion(1), r5Question(1)]) {
      const response = await put(questionId, body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: c1 }));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each([
    ['the v0.9.91 version with the predecessor manifest', predecessor.sha256],
    ['the v0.9.91 version with the R5 manifest', r5.sha256],
  ])('refuses %s (400), before the database', async (_name, sha) => {
    const response = await put(v0991Question(1), body(V0991_PAPER_VERSION, sha, { cohortId: c1 }));
    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('refuses a v0.9.91 question filed under a topic that does not ask it', async () => {
    const response = await put(v0991Question(11), body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: v0991WrongCohortFor(11) }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ outcome: 'unknown_identity' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('treats a database row of the other release as unavailable, never as a saved v0.9.91 response', async () => {
    rpcMock.mockResolvedValue({ data: { outcome: 'ok', row: row(REVISED_PAPER_VERSION, predecessor.sha256, predecessorQuestion(1)) }, error: null });
    const response = await put(v0991Question(1), body(V0991_PAPER_VERSION, v0991.sha256, { cohortId: c1 }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ outcome: 'persistence_unavailable' });
  });

  it.each([
    ['an R5 save', r5Question(1), R5_PAPER_VERSION, () => r5.sha256],
    ['a predecessor save', predecessorQuestion(1), REVISED_PAPER_VERSION, () => predecessor.sha256],
    ['an R5 save with the predecessor manifest', r5Question(1), R5_PAPER_VERSION, () => predecessor.sha256],
    ['a save for an unknown version', r5Question(1), 'some-other-version', () => r5.sha256],
  ])('refuses %s with 403 release_read_only before any manifest check or database call', async (_name, questionId, version, sha) => {
    for (const action of ['save-draft', 'submit']) {
      const response = await put(questionId, body(version, sha(), { action, expectedRevision: action === 'submit' ? 1 : null }));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ outcome: 'release_read_only' });
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('refuses a v0.9.91 question id under the predecessor or R5 identity as read-only too', async () => {
    for (const [version, sha] of [[REVISED_PAPER_VERSION, predecessor.sha256], [R5_PAPER_VERSION, r5.sha256]] as const) {
      const response = await put(v0991Question(1), body(version, sha, { cohortId: c1 }));
      expect(response.status).toBe(403);
    }
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
