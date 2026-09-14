import { notFound, redirect } from 'next/navigation';

import { isMatrixOptionsPaperWorkspaceEnabled, MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';

export default async function PaperSectionPage({ params }: { params: Promise<{ documentVersion: string; stableSectionId: string }> }) {
  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();

  if (!isMatrixOptionsPaperWorkspaceEnabled(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE)) {
    redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  }
  redirect(REVISED_PAPER_ROUTE);
}
