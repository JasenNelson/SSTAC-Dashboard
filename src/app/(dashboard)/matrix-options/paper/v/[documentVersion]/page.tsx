import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import {
  loadRevisedPaper,
  REVISED_PAPER_VERSION,
  RevisedPaperUnavailableError,
} from '@/lib/matrix-options/revised-paper';

export default async function PaperVersionPage({
  params,
}: {
  params: Promise<{ documentVersion: string }>;
  /** Accepted for route-contract compatibility; flags-on this route ignores the query. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION,
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') {
    try {
      const paper = loadRevisedPaper(documentVersion);
      const { default: TWGReviewPortal } = await import('@/components/TWGReviewPortal');
      return (
        <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden print:block print:h-auto print:overflow-visible">
          <TWGReviewPortal finalDraftContent={paper.content} paperRelease={paper} />
        </div>
      );
    } catch (error) {
      if (error instanceof RevisedPaperUnavailableError) notFound();
      throw error;
    }
  }
  // REVIEW_NAVIGATION: this route never renders the workspace (R2-01); it lands on the canonical Working Draft.
  redirect(paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null }));
}
