import { notFound, redirect } from 'next/navigation';

import { isMatrixOptionsPaperWorkspaceEnabled, MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';

export default async function PaperSectionPage({ params }: { params: Promise<{ documentVersion: string; stableSectionId: string }> }) {
  if (!isMatrixOptionsPaperWorkspaceEnabled(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE)) {
    redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  }
  const [{ PaperSectionReader }, { PaperContentNotFoundError }] = await Promise.all([
    import('@/components/matrix-options/paper/PaperReader'),
    import('@/lib/matrix-options/paper/provider'),
  ]);
  const { documentVersion, stableSectionId } = await params;
  try {
    const reader = await PaperSectionReader({ documentVersion, stableSectionId });
    if (!reader) notFound();
    return reader;
  } catch (error) {
    if (error instanceof PaperContentNotFoundError) notFound();
    throw error;
  }
}
