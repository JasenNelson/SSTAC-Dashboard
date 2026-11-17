import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { R2GuidedReview } from '@/components/matrix-options/paper/R2GuidedReview';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { isLocalR2PreviewRequest, loadLocalR2PreviewStructure } from '@/lib/matrix-options/paper/r2-review-preview-source';

export const dynamic = 'force-dynamic';

/** A loopback development fixture for isolated UI testing. It never reads provider state. */
export default async function R2GuidedFixturePage() {
  if (!isLocalR2PreviewRequest(await headers())) notFound();
  const structure = await loadLocalR2PreviewStructure();
  const manifest = getGuidedR2Manifest();
  return <R2GuidedReview
    documentVersion={manifest.documentVersion}
    guidedManifestSha256={manifest.guidedManifestSha256}
    reviewManifestSha256={manifest.reviewManifestSha256}
    outline={getPaperNavOutline(structure)}
    paper={<PaperDocument model={getPaperDocumentModel(structure)} previewFigureBasePath="/r2-review-preview/figures" />}
  />;
}
