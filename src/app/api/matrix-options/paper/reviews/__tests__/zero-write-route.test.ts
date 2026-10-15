import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { getAuthAndRateLimitMock, rpcMock } = vi.hoisted(() => ({
  getAuthAndRateLimitMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: getAuthAndRateLimitMock }));
vi.mock('server-only', () => ({}));

import { PREDECESSOR_PAPER_VERSION, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { PUT } from '../[questionId]/route';

/*
 * Zero-write gate, server side: only v0.9.91 collects responses. Any other release is refused
 * with 403 release_read_only before any manifest lookup or RPC.
 */

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const requestFor = (url: string, init?: RequestInit) => new Request(url, init) as unknown as NextRequest;
const questionIdFor = (version: string) => `rpq:${version}:q01`;
const body = (version: string, sha: string) => JSON.stringify({ documentVersion: version, manifestSha256: sha, cohortId: 'categories', action: 'save-draft', text: 'hello', expectedRevision: null });
const put = (version: string, sha: string) => {
  const questionId = questionIdFor(version);
  return PUT(requestFor(`https://example.test/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body(version, sha) }), { params: Promise.resolve({ questionId: encodeURIComponent(questionId) }) });
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  getAuthAndRateLimitMock.mockResolvedValue({ user, supabase: { rpc: rpcMock }, rateLimitResponse: null, rateLimitHeaders: {} });
  rpcMock.mockImplementation((_name: string, args: Record<string, unknown>) => Promise.resolve({
    data: { outcome: 'ok', row: { document_version: args.p_document_version, manifest_sha256: args.p_manifest_sha256, cohort_id: args.p_cohort_id, question_id: args.p_question_id, draft_text: args.p_text, submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } },
    error: null,
  }));
});

describe('review writes: only v0.9.91 collects responses', () => {
  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s: 403 release_read_only and no RPC', async (_name, version) => {
    const response = await put(version, getReviewManifest(version).sha256);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ outcome: 'release_read_only' });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('refuses before any manifest lookup: even a digest no release holds is release_read_only for another version', async () => {
    const response = await put(R5_PAPER_VERSION, 'f'.repeat(64));
    expect(response.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('v0.9.91 still reaches the RPC', async () => {
    const response = await put(V0991_PAPER_VERSION, getReviewManifest(V0991_PAPER_VERSION).sha256);
    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('matrix_paper_review_save_draft', expect.objectContaining({ p_document_version: V0991_PAPER_VERSION }));
  });
});
