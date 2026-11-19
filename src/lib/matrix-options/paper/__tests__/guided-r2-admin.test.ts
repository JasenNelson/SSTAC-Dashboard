import { expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { buildGuidedAdminCsv, normalizeGuidedAdminRows } from '../guided-r2-admin';
import { getGuidedR2Manifest } from '../guided-r2-manifest';

const manifest = getGuidedR2Manifest();
const identity = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const userId = '11111111-1111-4111-8111-111111111111';
const entry = (target_kind: string, target_id: string, values: Record<string, unknown> = {}) => ({
  user_id: userId, document_version: identity.documentVersion,
  guided_manifest_sha256: identity.guidedManifestSha256, review_manifest_sha256: identity.reviewManifestSha256,
  target_kind, target_id, revision: 1, draft_choice_id: null, draft_rationale: null, draft_text: null,
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null,
  submitted_revision: null, submitted_at: null, updated_at: '2026-11-19T00:00:00Z', ...values,
});
const completion = (id = userId) => ({ user_id: id, document_version: identity.documentVersion,
  guided_manifest_sha256: identity.guidedManifestSha256, review_manifest_sha256: identity.reviewManifestSha256,
  revision: 1, submitted_set_digest: 'a'.repeat(64), submitted_at: '2026-11-19T01:00:00Z' });

it('preserves choice, rationale, text, section, whole-paper and completion in admin rows and CSV', () => {
  const rows = normalizeGuidedAdminRows([
    entry('choice-prompt', 'structure-approach', { draft_choice_id: 'sound', draft_rationale: 'Because', submitted_choice_id: 'sound', submitted_rationale: 'Because', submitted_revision: 1, submitted_at: '2026-11-19T01:00:00Z' }),
    entry('text-prompt', 'site-assignment', { draft_text: 'Sites', submitted_text: 'Sites', submitted_revision: 1, submitted_at: '2026-11-19T01:00:00Z' }),
    entry('section-comment', 'sec-phase2-5', { draft_text: 'Section' }),
    entry('whole-paper-comment', 'whole-paper', { draft_text: '=FORMULA()', submitted_text: '=FORMULA()', submitted_revision: 1, submitted_at: '2026-11-19T01:00:00Z' }),
  ], [completion()], identity);
  expect(rows).not.toBeNull();
  expect(rows).toHaveLength(4);
  expect(rows!.find((row) => row.targetId === 'structure-approach')).toMatchObject({ draftChoiceId: 'sound', draftRationale: 'Because', status: 'submitted', completionRevision: 1 });
  expect(rows!.find((row) => row.targetId === 'site-assignment')?.submittedText).toBe('Sites');
  expect(rows!.find((row) => row.targetId === 'sec-phase2-5')?.targetLabel).toBe('Section 5');
  expect(rows!.find((row) => row.targetId === 'whole-paper')?.draftText).toBe('=FORMULA()');
  const csv = buildGuidedAdminCsv(rows!, identity);
  expect(csv).toContain('"\'=FORMULA()"');
  expect(csv).toContain('"Because"');
  expect(csv).toContain('"whole-paper-comment"');
});

it('shows an explicit completion-only record for a finished empty review', () => {
  expect(normalizeGuidedAdminRows([], [completion()], identity)).toMatchObject([{ status: 'completion-only', userId, completionRevision: 1 }]);
});

it('fails closed on release mismatch, unknown target, duplicate row and invalid choice', () => {
  expect(normalizeGuidedAdminRows([entry('text-prompt', 'site-assignment', { document_version: 'wrong' })], [], identity)).toBeNull();
  expect(normalizeGuidedAdminRows([entry('text-prompt', 'unknown')], [], identity)).toBeNull();
  expect(normalizeGuidedAdminRows([entry('text-prompt', 'site-assignment'), entry('text-prompt', 'site-assignment')], [], identity)).toBeNull();
  expect(normalizeGuidedAdminRows([entry('choice-prompt', 'structure-approach', { draft_choice_id: 'bad' })], [], identity)).toBeNull();
});
