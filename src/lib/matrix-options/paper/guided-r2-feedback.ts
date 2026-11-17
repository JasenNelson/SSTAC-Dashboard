import 'server-only';

import { getCohortManifest } from '../cohort-contract';
import { getReviewerGuideBinding } from '../reviewer-guide';
import { getReviewLineage } from './review-lineage';
import { getReviewManifest } from './review-manifest';
import { reviewResponseRowSchema, reviewResponseStatusLabel } from './review-responses';
import { getPaperRelease, PHASE2_R2_PAPER_VERSION } from './releases';

const conciseRelevance = {
  2: { areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5' },
  4: { areaId: 'human-health', sectionAnchor: 'sec-phase2-6-1' },
  5: { areaId: 'ecological-health', sectionAnchor: 'sec-phase2-6-3' },
  7: { areaId: 'common-rules-sequencing', sectionAnchor: 'sec-phase2-8' },
  8: { areaId: 'whole-paper', sectionAnchor: 'sec-phase2-9' },
} as const;

const legacyR2Relevance = {
  1: { areaId: 'approach-structure', sectionAnchor: 'sec-phase2-3' },
  2: { areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5' },
  3: { areaId: 'substances-evidence', sectionAnchor: 'sec-phase2-4' },
  4: { areaId: 'human-health', sectionAnchor: 'sec-phase2-6-1' },
  5: { areaId: 'ecological-health', sectionAnchor: 'sec-phase2-6-3' },
  6: { areaId: 'common-rules-sequencing', sectionAnchor: 'sec-phase2-7' },
  7: { areaId: 'common-rules-sequencing', sectionAnchor: 'sec-phase2-8' },
  8: { areaId: 'whole-paper', sectionAnchor: 'sec-phase2-9' },
} as const;

export function guidedR2FeedbackSources() {
  const lineage = getReviewLineage(PHASE2_R2_PAPER_VERSION);
  if (!lineage) throw new Error('R2 feedback lineage is unavailable');
  const conciseRelease = getPaperRelease(lineage.predecessorVersion);
  const r2Release = getPaperRelease(PHASE2_R2_PAPER_VERSION);
  if (!conciseRelease || !r2Release) throw new Error('R2 feedback source release is unavailable');
  const conciseById = new Map(lineage.questions.flatMap((question) => {
    const mapped = conciseRelevance[question.number as keyof typeof conciseRelevance];
    return mapped && question.predecessorQuestionId ? [[question.predecessorQuestionId, { ...mapped, number: question.number }] as const] : [];
  }));
  const r2ById = new Map(getReviewerGuideBinding(PHASE2_R2_PAPER_VERSION).questions.map((question) => [question.id, { ...legacyR2Relevance[question.number as keyof typeof legacyR2Relevance], number: question.number }] as const));
  if (conciseById.size !== Object.keys(conciseRelevance).length || r2ById.size !== Object.keys(legacyR2Relevance).length) throw new Error('R2 feedback relevance map mismatch');
  return [
    { sourceRelease: conciseRelease, sourceManifest: getReviewManifest(conciseRelease.documentVersion), sourceGuide: getReviewerGuideBinding(conciseRelease.documentVersion), sourceCohorts: getCohortManifest(conciseRelease.documentVersion), byId: conciseById, relationType: 'exact-continuation' as const },
    { sourceRelease: r2Release, sourceManifest: getReviewManifest(r2Release.documentVersion), sourceGuide: getReviewerGuideBinding(r2Release.documentVersion), sourceCohorts: getCohortManifest(r2Release.documentVersion), byId: r2ById, relationType: 'related-context' as const },
  ];
}

export function normalizeGuidedR2Feedback(raw: readonly unknown[], userId: string) {
  const sources = guidedR2FeedbackSources();
  const items = raw.map((value) => {
    if (!value || typeof value !== 'object') return null;
    const { user_id: owner, ...rest } = value as Record<string, unknown>;
    const row = reviewResponseRowSchema.safeParse(rest);
    if (!row.success || owner !== userId) return null;
    const source = sources.find((candidate) => row.data.document_version === candidate.sourceRelease.documentVersion && row.data.manifest_sha256 === candidate.sourceManifest.sha256 && candidate.sourceManifest.paperSha256 === candidate.sourceRelease.sha256);
    if (!source) return null;
    const map = source.byId.get(row.data.question_id);
    const question = source.sourceGuide.questions.find((candidate) => candidate.id === row.data.question_id);
    const cohort = source.sourceCohorts.cohorts.find((candidate) => candidate.id === row.data.cohort_id && candidate.questionNumbers.includes(question?.number ?? -1));
    if (!map || !question || !cohort) return null;
    const submitted = row.data.submitted_text?.trim();
    const draft = row.data.draft_text?.trim();
    const status = reviewResponseStatusLabel(row.data);
    const priorSubmittedNowCleared = status === 'changed-since-submit' && !draft && Boolean(submitted);
    const text = status === 'submitted' || priorSubmittedNowCleared ? submitted : draft;
    if (!text) return undefined;
    return {
      areaId: map.areaId, sectionAnchor: map.sectionAnchor,
      sourceReleaseIdentity: source.sourceRelease.documentVersion,
      sourcePaperSha256: source.sourceRelease.sha256,
      sourceGuideSha256: source.sourceManifest.reviewerGuideSha256,
      sourceManifestSha256: source.sourceManifest.sha256,
      originalQuestionId: row.data.question_id,
      relationType: source.relationType,
      responseStatus: priorSubmittedNowCleared ? 'prior-submitted-now-cleared' : status,
      timestamp: status === 'submitted' || priorSubmittedNowCleared ? row.data.submitted_at : row.data.updated_at,
      displayLabel: `${source.relationType === 'exact-continuation' ? 'Earlier concise' : 'Earlier R2'} question ${map.number}${priorSubmittedNowCleared ? ' (prior submitted text; current draft cleared)' : ''}`,
      text,
    };
  });
  // A row under the exact source identity but outside this map is not shown.
  // A malformed or foreign row is a source failure, not partial feedback.
  if (items.some((item) => item === null)) return null;
  return items.filter((item): item is NonNullable<typeof item> => item !== undefined);
}
