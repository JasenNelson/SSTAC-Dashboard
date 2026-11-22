import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getGuidedR2Manifest } from '../guided-r2-manifest';
import { runGuidedSaveQueue, type GuidedQueueStepOutcome } from '../guided-r2-save-queue';
import { createGuidedTransport, guidedResetTimeSeconds, type GuidedSaveBody } from '../guided-r2-transport';

// P2-2: an HTTP 429 from EITHER layer is a rate refusal. The application rate-limit wrapper
// (src/app/api/_helpers/rate-limit-wrapper.ts) replies {error, resetTime} plus Retry-After; the
// RPC path (guidedWriteOutcomeResponse) replies {outcome: 'rate_limited'} plus Retry-After.
const manifest = getGuidedR2Manifest();
const user = '11111111-1111-4111-8111-111111111111';
const body: GuidedSaveBody = {
  documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256, targetKind: 'text-prompt', expectedRevision: 0,
  expectedUserId: user, draft: { text: 'Answer' },
};
const reply = (payload: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status, headers });
const wrapper429 = (headers: Record<string, string>, resetTime: unknown = Date.now() + 30_000) =>
  reply({ error: 'Rate limit exceeded', resetTime }, 429, { 'Content-Type': 'application/json', ...headers });
const rpc429 = (headers: Record<string, string>) => reply({ outcome: 'rate_limited' }, 429, headers);
const okRow = (revision: number) => reply({
  outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256,
  row: {
    user_id: user, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256,
    review_manifest_sha256: manifest.reviewManifestSha256, target_kind: 'text-prompt', target_id: 'work-sequence', revision,
    draft_choice_id: null, draft_rationale: null, draft_text: 'Answer', submitted_choice_id: null, submitted_rationale: null,
    submitted_text: null, submitted_revision: null, submitted_at: null, updated_at: '2026-11-20T00:00:00Z',
  },
}, 200);

const save = (response: Response) => createGuidedTransport('production', vi.fn(async () => response)).save('work-sequence', body);

describe('guided transport 429 normalization', () => {
  it('normalizes the route-wrapper 429 shape to rate_limited and keeps Retry-After', async () => {
    expect(await save(wrapper429({ 'Retry-After': '17' }))).toEqual({ ok: false, status: 429, outcome: 'rate_limited', retryAfterSeconds: 17 });
  });

  it('falls back to the wrapper resetTime when Retry-After is absent or unusable', async () => {
    const now = Date.now();
    const absent = await save(wrapper429({}, now + 12_500));
    expect(absent.ok).toBe(false);
    if (absent.ok) return;
    expect(absent.outcome).toBe('rate_limited');
    expect(absent.retryAfterSeconds).toBeGreaterThanOrEqual(12);
    expect(absent.retryAfterSeconds).toBeLessThanOrEqual(13);
    // The wrapper computes Retry-After from resetTime - now, which can be 0 or negative at the edge.
    expect(await save(wrapper429({ 'Retry-After': '0' }, now - 1000))).toEqual({ ok: false, status: 429, outcome: 'rate_limited' });
  });

  it('normalizes the RPC 429 shape and keeps Retry-After', async () => {
    expect(await save(rpc429({ 'Retry-After': '60' }))).toEqual({ ok: false, status: 429, outcome: 'rate_limited', retryAfterSeconds: 60 });
  });

  it('treats an unreadable or unexpected 429 body as rate_limited, never as 503', async () => {
    expect(await save(reply('not json', 429, { 'Retry-After': '5' }))).toEqual({ ok: false, status: 429, outcome: 'rate_limited', retryAfterSeconds: 5 });
    expect(await save(reply({ unexpected: true }, 429))).toEqual({ ok: false, status: 429, outcome: 'rate_limited' });
  });

  it('still fails closed on invalid non-429 bodies', async () => {
    expect(await save(reply({ error: 'Rate limit exceeded', resetTime: Date.now() + 1000 }, 503))).toEqual({ ok: false, status: 503, outcome: 'persistence_unavailable' });
    expect(await save(reply({ outcome: 'not-a-real-outcome' }, 409))).toEqual({ ok: false, status: 503, outcome: 'persistence_unavailable' });
    expect(await save(reply('not json', 500))).toEqual({ ok: false, status: 503, outcome: 'persistence_unavailable' });
  });

  it('applies the same normalization to Finish', async () => {
    const transport = createGuidedTransport('production', vi.fn(async () => wrapper429({ 'Retry-After': '9' })));
    expect(await transport.complete({
      documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256,
      reviewManifestSha256: manifest.reviewManifestSha256, expectedUserId: user, expectedCompletionRevision: 0,
      draftSetDigest: 'a'.repeat(64),
    })).toEqual({ ok: false, status: 429, outcome: 'rate_limited', retryAfterSeconds: 9 });
  });

  it('ignores past, non-numeric and implausibly distant reset times', () => {
    expect(guidedResetTimeSeconds(1_000, 2_000)).toBeUndefined();
    expect(guidedResetTimeSeconds('1700000000000', 0)).toBeUndefined();
    expect(guidedResetTimeSeconds(Number.NaN, 0)).toBeUndefined();
    expect(guidedResetTimeSeconds(10 * 3600 * 1000, 0)).toBeUndefined();
    expect(guidedResetTimeSeconds(4_001, 0)).toBe(5);
  });
});

describe.each([
  ['route wrapper', () => wrapper429({ 'Retry-After': '7' })],
  ['RPC', () => rpc429({ 'Retry-After': '7' })],
] as const)('Save all pacing with a %s 429', (_label, limited) => {
  it('waits for Retry-After once, then saves the target without stopping as failed', async () => {
    const responses = [limited(), okRow(1)];
    const transport = createGuidedTransport('production', vi.fn(async () => responses.shift()!));
    const dirty = new Set(['work-sequence']);
    const waits: number[] = [];
    const result = await runGuidedSaveQueue({
      remaining: () => Array.from(dirty),
      saveOne: async (): Promise<GuidedQueueStepOutcome> => {
        const outcome = await transport.save('work-sequence', body);
        if (outcome.ok) { dirty.delete('work-sequence'); return { kind: 'ok' }; }
        return outcome.status === 429 ? { kind: 'rate_limited', retryAfterSeconds: outcome.retryAfterSeconds ?? null } : { kind: 'failed' };
      },
      wait: async (seconds) => { waits.push(seconds); return true; },
      cancelled: () => false,
    });
    expect(result).toMatchObject({ status: 'saved', saved: 1, total: 1, waits: 1 });
    // Retry-After 7 plus the one-second queue margin.
    expect(waits).toEqual([8]);
  });
});
