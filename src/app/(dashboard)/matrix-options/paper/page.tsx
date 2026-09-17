import { redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG,
  MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

export default async function MatrixOptionsPaperResolverPage() {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env[MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG],
    process.env[MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG],
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  // Flags on: land on the canonical Working Draft URL (redirect() is 307, never permanent).
  redirect(paperWorkspaceHref(REVISED_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: null }));
}
