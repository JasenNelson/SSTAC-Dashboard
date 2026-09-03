import { notFound, redirect } from 'next/navigation';

import { isMatrixOptionsPaperWorkspaceEnabled, MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';

export default async function PaperVersionPage({ params }: { params: Promise<{ documentVersion: string }> }) {
  if (!isMatrixOptionsPaperWorkspaceEnabled(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE)) {
    redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  }
  const [{ PaperVersionLanding }, { PaperContentNotFoundError }] = await Promise.all([
    import('@/components/matrix-options/paper/PaperReader'),
    import('@/lib/matrix-options/paper/provider'),
  ]);
  const { documentVersion } = await params;
  try {
    return await PaperVersionLanding({ documentVersion });
  } catch (error) {
    if (error instanceof PaperContentNotFoundError) notFound();
    throw error;
  }
}
