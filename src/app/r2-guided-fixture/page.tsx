import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { R2GuidedReview } from '@/components/matrix-options/paper/R2GuidedReview';
import { GUIDED_R2_SECTION_ANCHORS } from '@/lib/matrix-options/paper/guided-r2-contract';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';
import { isLocalR2PreviewRequest, loadLocalR2PreviewStructure } from '@/lib/matrix-options/paper/r2-review-preview-source';

export const dynamic = 'force-dynamic';

/** A loopback development fixture for isolated UI testing. It never reads provider state. */
export default async function R2GuidedFixturePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (!isLocalR2PreviewRequest(await headers())) notFound();
  const mode = (await searchParams).mode === 'my-review' ? 'my-review' : 'working-draft';
  // The browser seam uses synthetic headings when private R2 bytes are unavailable.
  // The ordinary fixture still authenticates the exact paper and figures.
  const synthetic = process.env.NODE_ENV === 'development' && process.env.MATRIX_R2_PREVIEW_BROWSER_TEST === '1';
  const structure = synthetic ? null : await loadLocalR2PreviewStructure();
  const manifest = getGuidedR2Manifest();
  return <R2GuidedReview
    transportMode="preview"
    documentVersion={manifest.documentVersion}
    guidedManifestSha256={manifest.guidedManifestSha256}
    reviewManifestSha256={manifest.reviewManifestSha256}
    initialMode={mode}
    outline={structure ? getPaperNavOutline(structure) : GUIDED_R2_SECTION_ANCHORS.map((anchor) => ({ anchor, label: anchor }))}
    paper={structure ? <PaperDocument model={getPaperDocumentModel(structure)} previewFigureBasePath="/r2-review-preview/figures" />
      : <article>{GUIDED_R2_SECTION_ANCHORS.map((anchor) => <section id={anchor} key={anchor} style={{ minHeight: 500 }}><h2>{anchor}</h2><p>Local browser seam fixture.</p></section>)}</article>}
  />;
}
