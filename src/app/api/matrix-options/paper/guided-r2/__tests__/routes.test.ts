import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { authMock, rpcMock, fromMock, getUserMock } = vi.hoisted(() => ({
  authMock: vi.fn(), rpcMock: vi.fn(), fromMock: vi.fn(), getUserMock: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: authMock }));

import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { GET as stateGet } from '../state/route';
import { GET as feedbackGet } from '../feedback/route';
import { PUT as targetPut } from '../targets/[targetId]/route';
import { POST as completePost } from '../complete/route';

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false };
const manifest = getGuidedR2Manifest();
const identity = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const url = (endpoint: string) => `https://example.test/api/matrix-options/paper/guided-r2/${endpoint}`;
const request = (endpoint: string, init?: RequestInit) => new Request(url(endpoint), init) as unknown as NextRequest;
const query = new URLSearchParams(identity).toString();
const emptyDigest = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const savedRow = { user_id: user.id, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
  target_kind: 'choice-prompt', target_id: 'structure-approach', revision: 1, draft_choice_id: 'sound', draft_rationale: null, draft_text: null,
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null, submitted_revision: null, submitted_at: null, updated_at: '2026-11-16T00:00:00Z' };
const completionRow = { user_id: user.id, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
  revision: 1, submitted_set_digest: emptyDigest, submitted_at: '2026-11-16T00:00:00Z' };

function tableResult(table: string, dataOverride?: unknown) {
  const result = { data: dataOverride === undefined ? table === 'matrix_guided_r2_completion' ? null : [] : dataOverride, error: null };
  const builder = { select: () => builder, eq: () => builder, order: () => builder, in: () => builder, maybeSingle: () => Promise.resolve(result), then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve) };
  return builder;
}

function mockWriteOutcomes(...outcomes: unknown[]) {
  const pending = [...outcomes];
  rpcMock.mockImplementation((name: string) => Promise.resolve({
    data: name === 'matrix_guided_r2_reviewer_allowed' ? true : name === 'matrix_guided_r2_activation_status' ? false : pending.shift(),
    error: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  process.env.MATRIX_R2_GUIDED_REVIEW_UI = 'true';
  delete process.env.MATRIX_R2_GUIDED_REVIEW_WRITES;
  getUserMock.mockResolvedValue({ data: { user }, error: null });
  fromMock.mockImplementation(tableResult);
  rpcMock.mockImplementation((name: string) => Promise.resolve({ data: name === 'matrix_guided_r2_reviewer_allowed' ? true : name === 'matrix_guided_r2_activation_status' ? false : { outcome: 'release_read_only' }, error: null }));
  authMock.mockResolvedValue({ user, supabase: { auth: { getUser: getUserMock }, rpc: rpcMock, from: fromMock }, rateLimitResponse: null, rateLimitHeaders: {} });
});

describe('guided R2 inactive route boundaries', () => {
  it('returns 404 when the UI gate is off without touching persistence', async () => {
    delete process.env.MATRIX_R2_GUIDED_REVIEW_UI;
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('requires the existing navigation gate as well as the R2 UI flag', async () => {
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false';
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(404);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('serves healthy own state as read-only while both barriers are off', async () => {
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mode: 'read-only', userKey: user.id, guidedManifestSha256: manifest.guidedManifestSha256, entries: [], completion: null });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('fails a missing activation-status RPC closed with 503', async () => {
    rpcMock.mockImplementation((name: string) => Promise.resolve(name === 'matrix_guided_r2_reviewer_allowed' ? { data: true, error: null } : { data: null, error: { code: 'PGRST202' } }));
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(503);
  });

  it('withholds a foreign entry even if a database read returns it', async () => {
    fromMock.mockImplementation((table: string) => tableResult(table, table === 'matrix_guided_r2_entries' ? [{ ...savedRow, user_id: '22222222-2222-4222-8222-222222222222' }] : undefined));
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(503);
  });

  it('rejects a stale guided digest with 409 before database calls', async () => {
    const stale = new URLSearchParams({ ...identity, guidedManifestSha256: 'f'.repeat(64) });
    const response = await stateGet(request(`state?${stale}`));
    expect(response.status).toBe(409);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('blocks target and completion writes at the app flag before an RPC', async () => {
    const saveBody = JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'sound' } });
    const save = await targetPut(request('targets/structure-approach', { method: 'PUT', body: saveBody }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    const finish = await completePost(request('complete', { method: 'POST', body: JSON.stringify({ ...identity, expectedUserId: user.id, expectedCompletionRevision: 0, draftSetDigest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }) }));
    expect(save.status).toBe(403);
    expect(finish.status).toBe(403);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(authMock).not.toHaveBeenCalled();
  });

  it('validates local write inputs before auth or admission for both routes', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    const save = (body: string) => targetPut(request('targets/structure-approach', { method: 'PUT', body }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    const complete = (body: string) => completePost(request('complete', { method: 'POST', body }));
    const validSave = { ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'sound' } };
    const validComplete = { ...identity, expectedUserId: user.id, expectedCompletionRevision: 0, draftSetDigest: emptyDigest };
    const cases: Array<[string, number, number]> = [
      ['{', 422, 422],
      ['{}', 422, 422],
      [JSON.stringify({ ...validSave, guidedManifestSha256: 'f'.repeat(64) }), 409, 422],
      [JSON.stringify({ ...validComplete, guidedManifestSha256: 'f'.repeat(64) }), 422, 409],
    ];
    for (const [body, saveStatus, completeStatus] of cases) {
      expect((await save(body)).status).toBe(saveStatus);
      expect((await complete(body)).status).toBe(completeStatus);
    }
    expect((await save('x'.repeat(80001))).status).toBe(413);
    expect((await complete('x'.repeat(4001))).status).toBe(413);
    expect(authMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('maps the inactive database barrier to 403 when the app flag is on', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    const save = await targetPut(request('targets/structure-approach', { method: 'PUT', body: JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'sound' } }) }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    expect(save.status).toBe(403);
    expect(await save.json()).toEqual({ outcome: 'release_read_only' });
    expect(rpcMock).toHaveBeenCalledWith('matrix_guided_r2_save', expect.objectContaining({ p_guided_manifest_sha256: manifest.guidedManifestSha256, p_target_id: 'structure-approach' }));
  });

  it('denies nonallowlisted state and feedback before reading guided or historical data', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    for (const endpoint of ['state', 'feedback']) {
      const response = endpoint === 'state' ? await stateGet(request(`state?${query}`)) : await feedbackGet(request(`feedback?${query}`));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ outcome: 'reviewer_not_allowed' });
    }
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('denies nonallowlisted writes before the write RPC when the app flag is on', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    rpcMock.mockResolvedValue({ data: false, error: null });
    const save = await targetPut(request('targets/structure-approach', { method: 'PUT', body: JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'sound' } }) }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    const finish = await completePost(request('complete', { method: 'POST', body: JSON.stringify({ ...identity, expectedUserId: user.id, expectedCompletionRevision: 0, draftSetDigest: emptyDigest }) }));
    expect(save.status).toBe(403);
    expect(finish.status).toBe(403);
    expect(await save.json()).toEqual({ outcome: 'reviewer_not_allowed' });
    expect(await finish.json()).toEqual({ outcome: 'reviewer_not_allowed' });
    expect(rpcMock.mock.calls.map(([name]) => name)).toEqual(['matrix_guided_r2_reviewer_allowed', 'matrix_guided_r2_reviewer_allowed']);
  });

  it('fails missing admission RPC closed before any guided read', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    const response = await stateGet(request(`state?${query}`));
    expect(response.status).toBe(503);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('validates the returned own row on successful typed save and maps conflict and rate outcomes', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    const makeSave = () => targetPut(request('targets/structure-approach', { method: 'PUT', body: JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'sound' } }) }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    mockWriteOutcomes({ outcome: 'ok', row: savedRow }, { outcome: 'stale_revision' }, { outcome: 'rate_limited' }, { outcome: 'ok', row: { ...savedRow, user_id: '22222222-2222-4222-8222-222222222222' } });
    expect((await makeSave()).status).toBe(200);
    expect((await makeSave()).status).toBe(409);
    expect((await makeSave()).status).toBe(429);
    expect((await makeSave()).status).toBe(503);
  });

  it('validates completion and maps noop, stale digest, and rate outcomes', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    const makeComplete = () => completePost(request('complete', { method: 'POST', body: JSON.stringify({ ...identity, expectedUserId: user.id, expectedCompletionRevision: 0, draftSetDigest: emptyDigest }) }));
    mockWriteOutcomes({ outcome: 'ok', completion: completionRow, entries: [] }, { outcome: 'noop_already_completed', completion: completionRow, entries: [] }, { outcome: 'draft_set_changed' }, { outcome: 'rate_limited' });
    expect((await makeComplete()).status).toBe(200);
    expect((await makeComplete()).status).toBe(200);
    expect((await makeComplete()).status).toBe(409);
    expect((await makeComplete()).status).toBe(429);
  });

  it('rejects a foreign user and an invalid choice before the write RPC', async () => {
    process.env.MATRIX_R2_GUIDED_REVIEW_WRITES = 'true';
    const foreign = await targetPut(request('targets/structure-approach', { method: 'PUT', body: JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: '22222222-2222-4222-8222-222222222222', draft: { choiceId: 'sound' } }) }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    const invalid = await targetPut(request('targets/structure-approach', { method: 'PUT', body: JSON.stringify({ ...identity, targetKind: 'choice-prompt', expectedRevision: 0, expectedUserId: user.id, draft: { choiceId: 'invented' } }) }), { params: Promise.resolve({ targetId: 'structure-approach' }) });
    expect(foreign.status).toBe(409);
    expect(invalid.status).toBe(422);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(authMock).toHaveBeenCalledTimes(1);
  });

  it('withholds unavailable historical feedback rather than serving partial cards', async () => {
    fromMock.mockImplementation((table: string) => table === 'matrix_paper_review_responses' ? { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ in: () => ({ order: () => Promise.resolve({ data: null, error: { code: '42P01' } }) }) }) }) }) }) } : tableResult(table));
    const response = await feedbackGet(request(`feedback?${query}`));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ outcome: 'feedback_unavailable', items: [] });
  });
});
