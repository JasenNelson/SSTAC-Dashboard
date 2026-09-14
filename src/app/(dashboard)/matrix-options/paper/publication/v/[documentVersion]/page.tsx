import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { createWorkspaceModel, parseAtlasQuery, parseWorkspaceMode, ReviewQueryError } from '@/lib/matrix-options/revised-paper-review';

export default async function PublicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string }>;
  searchParams: Promise<{ mode?: string | string[]; lens?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  try {
    const query = await searchParams;
    const model = createWorkspaceModel(loadRevisedPaperStructure(), parseAtlasQuery(query), parseWorkspaceMode(query.mode ?? 'publication'));
    const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
    return <RevisedPaperWorkspace model={model} />;
  } catch (error) {
    if (error instanceof ReviewQueryError) notFound();
    throw error;
  }
}
