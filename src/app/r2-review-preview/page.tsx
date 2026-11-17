import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { R2ReviewPreview, type R2ReviewPreviewProps } from '@/components/matrix-options/paper/R2ReviewPreview';
import type { PreviewEarlierFeedback, PreviewFeedbackContract } from '@/lib/matrix-options/paper/r2-review-preview';
import { isLocalR2PreviewRequest, loadLocalR2PreviewStructure } from '@/lib/matrix-options/paper/r2-review-preview-source';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { getPaperRelease, PHASE2_PAPER_VERSION, PHASE2_R2_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'R2 guided review preview | Matrix Options Paper' };

export default async function R2ReviewPreviewPage({ searchParams }: { readonly searchParams: Promise<{ readonly fixture?: string }> }) {
  if (!isLocalR2PreviewRequest(await headers())) notFound();
  const requestedFixture = (await searchParams).fixture;
  const fixtureStates: readonly NonNullable<R2ReviewPreviewProps['fixtureState']>[] = ['loading', 'signed-out', 'source-unavailable', 'stale-lineage', 'transient-read-error', 'no-prompt', 'no-earlier-feedback'];
  const fixtureState = fixtureStates.find((state) => state === requestedFixture) ?? 'ready';
  const viewerIdentity = 'synthetic-preview-reviewer';
  const sessionIdentity = 'synthetic-r2-preview-session';
  if (fixtureState === 'loading' || fixtureState === 'signed-out' || fixtureState === 'source-unavailable' || fixtureState === 'transient-read-error') {
    return <R2ReviewPreview outline={[]} feedback={[]} feedbackContract={{ viewerIdentity, sessionIdentity, sources: {} }} paper={null} fixtureState={fixtureState} />;
  }
  const structure = await loadLocalR2PreviewStructure();
  const model = getPaperDocumentModel(structure);
  const outline = getPaperNavOutline(structure)
    .filter((entry) => entry.anchor.startsWith('sec-phase2-'))
    .map((entry) => ({ anchor: entry.anchor, label: entry.label }));
  const earlier = getPaperRelease(PHASE2_PAPER_VERSION);
  const deepDive = getPaperRelease(V0991_PAPER_VERSION);
  const r2 = getPaperRelease(PHASE2_R2_PAPER_VERSION);
  if (!earlier || !deepDive || !r2 || structure.manifest.source.sha256 !== r2.sha256) {
    throw new Error('The exact R2 preview source is unavailable.');
  }
  const earlierManifest = getReviewManifest(PHASE2_PAPER_VERSION);
  const deepDiveManifest = getReviewManifest(V0991_PAPER_VERSION);
  const conciseQuestionId = `rpq:${earlier.documentVersion}:q02`;
  const deepDiveQuestionId = `rpq:${deepDive.documentVersion}:q11`;
  const feedbackContract: PreviewFeedbackContract = {
    viewerIdentity, sessionIdentity,
    sources: {
      [conciseQuestionId]: { areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5', releaseIdentity: earlier.documentVersion, paperSha256: earlier.sha256, guideSha256: earlierManifest.reviewerGuideSha256, manifestSha256: earlierManifest.sha256, relationType: 'exact-continuation' },
      [deepDiveQuestionId]: { areaId: 'common-rules-sequencing', sectionAnchor: 'sec-phase2-7', releaseIdentity: deepDive.documentVersion, paperSha256: deepDive.sha256, guideSha256: deepDiveManifest.reviewerGuideSha256, manifestSha256: deepDiveManifest.sha256, relationType: 'related-context' },
    },
  };
  const feedback: readonly PreviewEarlierFeedback[] = [
    {
      ownerIdentity: viewerIdentity, sessionIdentity,
      areaId: 'uses-waterbodies', sectionAnchor: 'sec-phase2-5', sourceReleaseIdentity: earlier.documentVersion,
      sourcePaperSha256: earlier.sha256, sourceGuideSha256: earlierManifest.reviewerGuideSha256,
      sourceManifestSha256: earlierManifest.sha256, originalQuestionId: conciseQuestionId,
      relationType: 'exact-continuation', responseStatus: 'submitted', timestamp: '2026-10-01',
      displayLabel: 'Earlier concise draft - site assignment',
      text: 'Example only: I suggested adding a worked site-assignment example for an estuary.', synthetic: true,
    },
    {
      ownerIdentity: viewerIdentity, sessionIdentity,
      areaId: 'common-rules-sequencing', sectionAnchor: 'sec-phase2-7', sourceReleaseIdentity: deepDive.documentVersion,
      sourcePaperSha256: deepDive.sha256, sourceGuideSha256: deepDiveManifest.reviewerGuideSha256,
      sourceManifestSha256: deepDiveManifest.sha256, originalQuestionId: deepDiveQuestionId,
      relationType: 'related-context', responseStatus: 'saved-draft', timestamp: '2026-09-15',
      displayLabel: 'Scientific deep dive - related context',
      text: 'Example only: I asked how a site-specific adjustment would be documented.', synthetic: true,
    },
  ];
  return (
    <R2ReviewPreview outline={outline} feedback={feedback} feedbackContract={feedbackContract} fixtureState={fixtureState} paper={<PaperDocument model={model} previewFigureBasePath="/r2-review-preview/figures" />} />
  );
}
