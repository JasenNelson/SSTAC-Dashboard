import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GUIDED_R2_TARGETS } from '../guided-r2-contract';
import { guidedR2DraftSetDigest } from '../guided-r2-digest';
import { getGuidedR2Manifest } from '../guided-r2-manifest';
import { createPreviewR2Service } from '../guided-r2-preview-service';
import { createGuidedTransport, type GuidedIdentity } from '../guided-r2-transport';

const manifest = getGuidedR2Manifest();
const identity: GuidedIdentity = {
  documentVersion: manifest.documentVersion,
  guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256,
};

function harness(mode: 'production' | 'preview') {
  const service = createPreviewR2Service();
  let token: string | undefined;
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://127.0.0.1:49232');
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    let request: unknown;
    if (mode === 'preview') {
      expect(url.pathname).toBe('/api/matrix-options/paper/preview-r2');
      request = body;
    } else if (url.pathname.endsWith('/state')) {
      request = { operation: 'state', identity: Object.fromEntries(url.searchParams) };
    } else if (url.pathname.endsWith('/feedback')) {
      request = { operation: 'feedback', identity: Object.fromEntries(url.searchParams) };
    } else if (url.pathname.includes('/targets/')) {
      request = { operation: 'save', targetId: decodeURIComponent(url.pathname.split('/').at(-1) ?? ''), body };
    } else {
      request = { operation: 'complete', body };
    }
    const reply = await service.handle(request, token);
    if (reply.sessionToken) token = reply.sessionToken;
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  });
  return { transport: createGuidedTransport(mode, fetcher), fetcher, service, token: () => token };
}

describe.each(['production', 'preview'] as const)('%s guided transport conformance', (mode) => {
  it('loads state and feedback, saves every target type, conflicts, completes and reloads', async () => {
    const { transport, service } = harness(mode);
    const initial = await transport.state(identity);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.value.mode).toBe('writable');
    const user = initial.value.userKey;
    const feedback = await transport.feedback(identity);
    expect(feedback.ok && feedback.value.items[0].text).toContain('Synthetic preview feedback');
    const choice = GUIDED_R2_TARGETS.find((target) => target.kind === 'choice-prompt')!;
    const text = GUIDED_R2_TARGETS.find((target) => target.kind === 'text-prompt')!;
    const section = GUIDED_R2_TARGETS.find((target) => target.kind === 'section-comment')!;
    const cases = [
      { target: choice, draft: { choiceId: choice.options[0], rationale: 'Reason' } },
      { target: text, draft: { text: 'Answer' } },
      { target: section, draft: { text: 'Section comment' } },
      { target: { kind: 'whole-paper-comment' as const, id: 'whole-paper' }, draft: { text: 'Whole paper comment' } },
    ];
    for (const item of cases) {
      const saved = await transport.save(item.target.id, { ...identity, targetKind: item.target.kind,
        expectedRevision: 0, expectedUserId: user, draft: item.draft });
      expect(saved.ok).toBe(true);
      if (saved.ok) expect(saved.value.row.revision).toBe(1);
    }
    const conflict = await transport.save(choice.id, { ...identity, targetKind: choice.kind,
      expectedRevision: 0, expectedUserId: user, draft: { choiceId: choice.options[0] } });
    expect(conflict).toMatchObject({ ok: false, status: 409, outcome: 'stale_revision' });
    const before = await transport.state(identity);
    expect(before.ok && before.value.entries).toHaveLength(4);
    if (!before.ok) return;
    const digest = await guidedR2DraftSetDigest(before.value.entries);
    const wrongDigest = await transport.complete({ ...identity, expectedUserId: user,
      expectedCompletionRevision: 0, draftSetDigest: '0'.repeat(64) });
    expect(wrongDigest).toMatchObject({ ok: false, status: 409, outcome: 'draft_set_changed' });
    const completed = await transport.complete({ ...identity, expectedUserId: user,
      expectedCompletionRevision: 0, draftSetDigest: digest });
    expect(completed.ok && completed.value.completion.revision).toBe(1);
    const reload = await transport.state(identity);
    expect(reload.ok && reload.value.completion?.submitted_set_digest).toBe(digest);
    expect(service.sessionCount()).toBe(1);
  });
});

it('isolates opaque preview sessions and rejects invalid selections before any fetch', async () => {
  const first = harness('preview');
  const second = harness('preview');
  const a = await first.transport.state(identity);
  const b = await second.transport.state(identity);
  expect(a.ok && b.ok && a.value.userKey).not.toBe(b.ok && b.value.userKey);
  expect(first.token()).not.toBe(second.token());
  const fetcher = vi.fn(async () => new Response('{}'));
  expect(() => createGuidedTransport('invalid' as 'preview', fetcher)).toThrow();
  const valid = createGuidedTransport('preview', fetcher);
  expect(await valid.state({ ...identity, guidedManifestSha256: 'bad' })).toMatchObject({ ok: false });
  expect(fetcher).not.toHaveBeenCalled();
});

it('rejects successful replies with foreign identity, user, target or completion', async () => {
  const service = createPreviewR2Service();
  const initial = await service.handle({ operation: 'state', identity }, undefined);
  const token = initial.sessionToken!;
  const user = (initial.body as { userKey: string }).userKey;
  const choice = GUIDED_R2_TARGETS.find((item) => item.kind === 'choice-prompt')!;
  const saveBody = { ...identity, targetKind: choice.kind, expectedRevision: 0,
    expectedUserId: user, draft: { choiceId: choice.options[0] } };
  const saved = await service.handle({ operation: 'save', targetId: choice.id, body: saveBody }, token);
  const state = await service.handle({ operation: 'state', identity }, token);
  const feedback = await service.handle({ operation: 'feedback', identity }, token);
  const digest = await guidedR2DraftSetDigest((state.body as { entries: [] }).entries);
  const completeBody = { ...identity, expectedUserId: user, expectedCompletionRevision: 0, draftSetDigest: digest };
  const completed = await service.handle({ operation: 'complete', body: completeBody }, token);
  const parse = <T>(value: T) => JSON.parse(JSON.stringify(value)) as T;
  const reply = (body: unknown, status = 200) => createGuidedTransport('production', vi.fn(async () =>
    new Response(JSON.stringify(body), { status })));
  const foreignIdentity = parse(state.body) as Record<string, unknown>;
  foreignIdentity.documentVersion = 'foreign';
  expect(await reply(foreignIdentity).state(identity)).toMatchObject({ ok: false, status: 503, outcome: 'persistence_unavailable' });
  const foreignFeedback = parse(feedback.body) as { guidedManifestSha256: string };
  foreignFeedback.guidedManifestSha256 = 'f'.repeat(64);
  expect(await reply(foreignFeedback).feedback(identity)).toMatchObject({ ok: false, status: 503 });
  const foreignUser = parse(state.body) as { entries: { user_id: string }[] };
  foreignUser.entries[0].user_id = '00000000-0000-4000-8000-000000000001';
  expect(await reply(foreignUser).state(identity)).toMatchObject({ ok: false, status: 503 });
  const wrongTarget = parse(saved.body) as { row: { target_id: string } };
  wrongTarget.row.target_id = 'another-target';
  expect(await reply(wrongTarget).save(choice.id, saveBody)).toMatchObject({ ok: false, status: 503 });
  const wrongCompletion = parse(completed.body) as { completion: { document_version: string } };
  wrongCompletion.completion.document_version = 'foreign';
  expect(await reply(wrongCompletion).complete(completeBody)).toMatchObject({ ok: false, status: 503 });
  expect(await reply({ outcome: 'unknown_server_outcome' }, 409).state(identity)).toMatchObject({
    ok: false, status: 503, outcome: 'persistence_unavailable',
  });
});
