import { createHash, webcrypto } from 'node:crypto';
import { expect, it } from 'vitest';

import { guidedR2DraftSetDigest } from '../guided-r2-digest';
import type { GuidedEntry } from '../guided-r2-contract';

const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const base: GuidedEntry = {
  user_id: '11111111-1111-4111-8111-111111111111', document_version: 'phase2-review-2026-11-fa356b89',
  guided_manifest_sha256: 'a'.repeat(64), review_manifest_sha256: 'b'.repeat(64),
  target_kind: 'text-prompt', target_id: 'site-assignment', revision: 2,
  draft_choice_id: null, draft_rationale: null, draft_text: 'A real site',
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null,
  submitted_revision: null, submitted_at: null, updated_at: '2026-11-16T00:00:00Z',
};

it('uses an ordered UTF-8 payload digest and excludes cleared rows', async () => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  const expected = digest(`text-prompt:site-assignment:2:-:-:${digest('A real site')}`);
  expect(await guidedR2DraftSetDigest([base])).toBe(expected);
  expect(await guidedR2DraftSetDigest([{ ...base, draft_text: null }])).toBe(digest(''));
  expect(await guidedR2DraftSetDigest([{ ...base, target_id: 'z' }, base])).toBe(digest(`text-prompt:site-assignment:2:-:-:${digest('A real site')}\ntext-prompt:z:2:-:-:${digest('A real site')}`));
});
