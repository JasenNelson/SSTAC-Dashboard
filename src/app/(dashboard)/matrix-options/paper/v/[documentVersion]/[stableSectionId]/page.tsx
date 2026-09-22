import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { resolveLegacySectionAnchor } from '@/components/matrix-options/paper/PaperDocument';

/**
 * Legacy section deep link. Flags off: the unchanged legacy/resolver
 * destinations, before any paper structure is loaded. Flags on (M1-07): the
 * canonical Working Draft, keeping the section identity as `section=` when the
 * id is a heading anchor or a legacy section-anchor id of this release; any
 * other id lands on the Working Draft without a section.
 */
export default async function PaperSectionPage({ params }: { params: Promise<{ documentVersion: string; stableSectionId: string }> }) {
  const { documentVersion, stableSectionId } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();

  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION,
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const section = resolveLegacySectionAnchor(loadRevisedPaperStructure(), stableSectionId);
  redirect(paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section }));
}
