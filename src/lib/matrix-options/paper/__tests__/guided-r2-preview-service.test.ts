import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GUIDED_R2_TARGETS, type GuidedEntry } from '../guided-r2-contract';
import { buildGuidedAdminCsv, normalizeGuidedAdminRows } from '../guided-r2-admin';
import { guidedR2DraftSetDigest } from '../guided-r2-digest';
import { getGuidedR2Manifest } from '../guided-r2-manifest';
import { createPreviewR2Service } from '../guided-r2-preview-service';

const manifest = getGuidedR2Manifest();
const identity = { documentVersion: manifest.documentVersion,
  guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const stateRequest = { operation: 'state', identity };

it('matches production digest, noop and completion CAS ordering', async () => {
  const service = createPreviewR2Service();
  const first = await service.handle(stateRequest, undefined);
  const token = first.sessionToken!;
  const user = (first.body as { userKey: string }).userKey;
  const digest = await guidedR2DraftSetDigest([]);
  const complete = (revision: number, value: string) => service.handle({ operation: 'complete',
    body: { ...identity, expectedUserId: user, expectedCompletionRevision: revision, draftSetDigest: value } }, token);
  expect((await complete(0, digest)).body).toMatchObject({ outcome: 'ok' });
  expect((await complete(0, digest)).body).toMatchObject({ outcome: 'noop_already_completed' });
  expect((await complete(0, '0'.repeat(64))).body).toMatchObject({ outcome: 'draft_set_changed' });
  const target = GUIDED_R2_TARGETS.find((item) => item.kind === 'text-prompt')!;
  const saved = await service.handle({ operation: 'save', targetId: target.id, body: {
    ...identity, targetKind: target.kind, expectedRevision: 0, expectedUserId: user, draft: { text: 'Changed' },
  } }, token);
  expect(saved.body).toMatchObject({ outcome: 'ok' });
  const current = await service.handle(stateRequest, token);
  const changedDigest = await guidedR2DraftSetDigest((current.body as { entries: [] }).entries);
  expect((await complete(0, changedDigest)).body).toMatchObject({ outcome: 'stale_revision' });
  expect((await complete(1, changedDigest)).body).toMatchObject({ outcome: 'ok' });
});

it('keeps blank saved entries unsubmitted and hashes persisted tab-only fields', async () => {
  const service = createPreviewR2Service();
  const first = await service.handle(stateRequest, undefined);
  const token = first.sessionToken!;
  const user = (first.body as { userKey: string }).userKey;
  const target = GUIDED_R2_TARGETS.find((item) => item.kind === 'text-prompt')!;
  const save = (revision: number, text: string) => service.handle({ operation: 'save', targetId: target.id, body: {
    ...identity, targetKind: target.kind, expectedRevision: revision, expectedUserId: user, draft: { text },
  } }, token);
  const complete = (revision: number, digest: string) => service.handle({ operation: 'complete', body: {
    ...identity, expectedUserId: user, expectedCompletionRevision: revision, draftSetDigest: digest,
  } }, token);
  const entries = () => service.adminSnapshot().entries as GuidedEntry[];

  expect((await save(0, 'Answer')).body).toMatchObject({ outcome: 'ok' });
  expect((await complete(0, await guidedR2DraftSetDigest(entries()))).body).toMatchObject({ outcome: 'ok' });
  expect(entries()[0].submitted_revision).toBe(1);

  expect((await save(1, '   ')).body).toMatchObject({ outcome: 'ok', row: { draft_text: null } });
  expect((await complete(1, await guidedR2DraftSetDigest(entries()))).body).toMatchObject({ outcome: 'ok' });
  expect(entries()[0]).toMatchObject({ draft_text: null, submitted_text: null, submitted_revision: null, submitted_at: null });
  const rows = normalizeGuidedAdminRows(entries(), service.adminSnapshot().completions, identity);
  expect(rows).toMatchObject([{ status: 'saved-draft', submittedRevision: null, completionRevision: 2 }]);
  expect(buildGuidedAdminCsv(rows!, identity)).toContain('"saved-draft"');

  expect((await save(2, '\t')).body).toMatchObject({ outcome: 'ok', row: { draft_text: '\t' } });
  const tabDigest = await guidedR2DraftSetDigest(entries());
  expect(tabDigest).not.toBe(await guidedR2DraftSetDigest([]));
  expect((await complete(2, tabDigest)).body).toMatchObject({ outcome: 'ok' });
  expect(entries()[0]).toMatchObject({ draft_text: '\t', submitted_text: '\t', submitted_revision: 3 });

  expect((await save(3, ' \n')).body).toMatchObject({ outcome: 'ok', row: { draft_text: ' \n' } });
  expect((await complete(3, await guidedR2DraftSetDigest(entries()))).body).toMatchObject({ outcome: 'ok' });
  expect(entries()[0]).toMatchObject({ draft_text: ' \n', submitted_text: ' \n', submitted_revision: 4 });
});

it('expires idle sessions, rotates stale cookies and evicts the least recently used session', async () => {
  let time = 1000;
  const service = createPreviewR2Service(true, { now: () => time, ttlMs: 10, maxSessions: 2 });
  const first = await service.handle(stateRequest, undefined);
  const second = await service.handle(stateRequest, undefined);
  expect(service.sessionCount()).toBe(2);
  const firstUser = (first.body as { userKey: string }).userKey;
  const target = GUIDED_R2_TARGETS.find((item) => item.kind === 'text-prompt')!;
  expect((await service.handle({ operation: 'save', targetId: target.id, body: {
    ...identity, targetKind: target.kind, expectedRevision: 0, expectedUserId: firstUser,
    draft: { text: 'First session only' },
  } }, first.sessionToken)).status).toBe(200);
  expect((await service.handle(stateRequest, second.sessionToken).then((reply) => reply.body) as { entries: unknown[] }).entries).toEqual([]);
  time += 1;
  await service.handle(stateRequest, first.sessionToken);
  const third = await service.handle(stateRequest, undefined);
  expect(service.sessionCount()).toBe(2);
  expect((await service.handle({ operation: 'feedback', identity }, second.sessionToken)).status).toBe(401);
  const rotated = await service.handle(stateRequest, second.sessionToken);
  expect(rotated.sessionToken).toBeDefined();
  expect(rotated.sessionToken).not.toBe(second.sessionToken);
  expect((rotated.body as { userKey: string }).userKey).not.toBe((second.body as { userKey: string }).userKey);
  expect((third.body as { entries: unknown[] }).entries).toEqual([]);
  time += 11;
  expect((await service.handle({ operation: 'feedback', identity }, rotated.sessionToken)).status).toBe(401);
  const afterRestart = await service.handle(stateRequest, rotated.sessionToken);
  expect(afterRestart.status).toBe(200);
  expect(afterRestart.sessionToken).not.toBe(rotated.sessionToken);
  const freshProcess = createPreviewR2Service();
  const recovered = await freshProcess.handle(stateRequest, afterRestart.sessionToken);
  expect(recovered.status).toBe(200);
  expect(recovered.sessionToken).not.toBe(afterRestart.sessionToken);
});
