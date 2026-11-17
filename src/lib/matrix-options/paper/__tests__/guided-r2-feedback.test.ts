import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { guidedR2FeedbackSources, normalizeGuidedR2Feedback } from '../guided-r2-feedback';

const userId = '11111111-1111-4111-8111-111111111111';

function row(source: ReturnType<typeof guidedR2FeedbackSources>[number], questionId: string) {
  const question = source.sourceGuide.questions.find((item) => item.id === questionId)!;
  const cohort = source.sourceCohorts.cohorts.find((item) => item.questionNumbers.includes(question.number))!;
  return { user_id: userId, id: 'response', document_version: source.sourceRelease.documentVersion,
    manifest_sha256: source.sourceManifest.sha256, cohort_id: cohort.id, question_id: questionId,
    draft_text: 'Updated draft', submitted_text: 'Older submitted text', revision: 3,
    submitted_revision: 2, submitted_at: '2026-10-01T00:00:00Z', updated_at: '2026-11-16T00:00:00Z' };
}

it('binds concise continuation and legacy R2 context to separate sources and whole-paper target', () => {
  const [concise, r2] = guidedR2FeedbackSources();
  const conciseQ8 = [...concise.byId.entries()].find(([, map]) => map.number === 8)![0];
  const r2Q3 = [...r2.byId.entries()].find(([, map]) => map.number === 3)![0];
  const items = normalizeGuidedR2Feedback([row(concise, conciseQ8), row(r2, r2Q3)], userId)!;
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ areaId: 'whole-paper', relationType: 'exact-continuation', responseStatus: 'changed-since-submit', text: 'Updated draft', timestamp: '2026-11-16T00:00:00Z' });
  expect(items[1]).toMatchObject({ areaId: 'substances-evidence', relationType: 'related-context', sourceReleaseIdentity: r2.sourceRelease.documentVersion });
});

it('fails closed for a foreign owner or stale source manifest', () => {
  const [concise] = guidedR2FeedbackSources();
  const questionId = [...concise.byId.keys()][0];
  expect(normalizeGuidedR2Feedback([{ ...row(concise, questionId), user_id: '22222222-2222-4222-8222-222222222222' }], userId)).toBeNull();
  expect(normalizeGuidedR2Feedback([{ ...row(concise, questionId), manifest_sha256: 'f'.repeat(64) }], userId)).toBeNull();
});

it('omits an intentionally cleared historical draft without failing the entire read', () => {
  const [concise] = guidedR2FeedbackSources();
  const questionId = [...concise.byId.keys()][0];
  expect(normalizeGuidedR2Feedback([{ ...row(concise, questionId), draft_text: null, submitted_text: null, submitted_revision: null }], userId)).toEqual([]);
  expect(normalizeGuidedR2Feedback([{ ...row(concise, questionId), draft_text: null }], userId)).toMatchObject([
    { responseStatus: 'prior-submitted-now-cleared', text: 'Older submitted text', timestamp: '2026-10-01T00:00:00Z' },
  ]);
});
