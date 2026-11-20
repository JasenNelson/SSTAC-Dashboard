import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { fetchGuidedAdminState } from '../guided-r2-admin-query';
import { getGuidedR2Manifest } from '../guided-r2-manifest';

const manifest = getGuidedR2Manifest();
const identity = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const user = '11111111-1111-4111-8111-111111111111';
const entry = (kind: string, id: string) => ({ user_id: user, document_version: identity.documentVersion,
  guided_manifest_sha256: identity.guidedManifestSha256, review_manifest_sha256: identity.reviewManifestSha256,
  target_kind: kind, target_id: id, revision: 1, draft_choice_id: null, draft_rationale: null,
  draft_text: 'Text', submitted_choice_id: null, submitted_rationale: null, submitted_text: null,
  submitted_revision: null, submitted_at: null, updated_at: '2026-11-19T00:00:00Z' });

it('pages guided rows through an empty page using the composite cursor', async () => {
  const pages = new Map([
    ['matrix_guided_r2_entries', [[entry('section-comment', 'sec-phase2-1')], [entry('section-comment', 'sec-phase2-2')], []]],
    ['matrix_guided_r2_completion', [[], []]],
  ]);
  const filters: string[] = [];
  const client = { from(table: string) { return { select() {
    const query = {
      eq() { return query; }, gt() { return query; },
      or(filter: string) { filters.push(filter); return query; },
      order() { return query; }, limit() { return query; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: pages.get(table)?.shift() ?? [], error: null })); },
    };
    return query;
  } }; } };
  const result = await fetchGuidedAdminState(client as unknown as Parameters<typeof fetchGuidedAdminState>[0], identity);
  expect(result.entries).toHaveLength(2);
  expect(result.completions).toEqual([]);
  expect(filters).toHaveLength(2);
  expect(filters[1]).toContain('target_id.gt.sec-phase2-2');
});

it('fails closed when a later page has a mismatched release identity', async () => {
  const client = { from() { return { select() {
    const query = { eq() { return query; }, gt() { return query; }, or() { return query; }, order() { return query; }, limit() { return query; },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: [{ ...entry('text-prompt', 'site-assignment'), document_version: 'wrong' }], error: null })); } };
    return query;
  } }; } };
  await expect(fetchGuidedAdminState(client as unknown as Parameters<typeof fetchGuidedAdminState>[0], identity)).rejects.toThrow('release identity mismatch');
});
