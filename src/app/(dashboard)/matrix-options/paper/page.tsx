import { redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG,
  MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE } from '@/lib/matrix-options/revised-paper';

export default async function MatrixOptionsPaperResolverPage() {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env[MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG],
    process.env[MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG],
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  redirect(REVISED_PAPER_ROUTE);
}
