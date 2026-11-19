import { beforeEach, expect, it } from 'vitest';
import { clearGuidedDraft, clearGuidedDraftsForUser, readGuidedDraft, writeGuidedDraft } from '../guided-r2-local-drafts';

const id = { userKey: '11111111-1111-4111-8111-111111111111', documentVersion: 'release', guidedManifestSha256: 'a'.repeat(64), reviewManifestSha256: 'b'.repeat(64), targetKind: 'text-prompt' as const, targetId: 'site-assignment' };
beforeEach(() => window.localStorage.clear());

it('recovers an exact user and release draft with revision and UTF-16 bound', () => {
  expect(writeGuidedDraft(id, { choiceId: null, rationale: '', text: 'x'.repeat(20000) + 'y' }, 4)).toBe(true);
  expect(readGuidedDraft(id)).toMatchObject({ baseRevision: 4, value: { text: 'x'.repeat(20000) } });
  expect(readGuidedDraft({ ...id, userKey: '22222222-2222-4222-8222-222222222222' })).toBeNull();
  expect(readGuidedDraft({ ...id, reviewManifestSha256: 'c'.repeat(64) })).toBeNull();
  clearGuidedDraft(id);
  expect(readGuidedDraft(id)).toBeNull();
});

it('clears only the signed-out user and rejects unknown targets', () => {
  const other = { ...id, userKey: '22222222-2222-4222-8222-222222222222' };
  const value = { choiceId: null, rationale: '', text: 'Unsaved' };
  writeGuidedDraft(id, value, 0); writeGuidedDraft(other, value, 0);
  clearGuidedDraftsForUser(id.userKey);
  expect(readGuidedDraft(id)).toBeNull();
  expect(readGuidedDraft(other)?.value.text).toBe('Unsaved');
  expect(writeGuidedDraft({ ...id, targetId: 'bad' }, value, 0)).toBe(false);
});
