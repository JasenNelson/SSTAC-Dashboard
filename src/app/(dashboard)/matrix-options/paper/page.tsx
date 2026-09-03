import { redirect } from 'next/navigation';

import {
  isMatrixOptionsPaperWorkspaceEnabled,
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
} from '@/lib/matrix-options/navigation';

export default async function MatrixOptionsPaperResolverPage() {
  if (!isMatrixOptionsPaperWorkspaceEnabled(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE)) {
    redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  }
  const { SYNTHETIC_PAPER_VERSION } = await import('@/lib/matrix-options/paper/synthetic-fixture');
  redirect(`/matrix-options/paper/v/${SYNTHETIC_PAPER_VERSION}`);
}
