import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import {
  loadRevisedPaper,
  REVISED_PAPER_VERSION,
  RevisedPaperUnavailableError,
} from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  createWorkspaceModel,
  parseAtlasQuery,
  parseWorkspaceMode,
  ReviewQueryError,
} from '@/lib/matrix-options/revised-paper-review';

export default async function PaperVersionPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string }>;
  searchParams?: Promise<{ mode?: string | string[]; lens?: string | string[]; q?: string | string[]; page?: string | string[]; scenario?: string | string[] }>;
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

  try {
    const query = await searchParams;
    const mode = parseWorkspaceMode(query?.mode);
    const atlasQuery = parseAtlasQuery(query ?? {});
    const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
    const model = createWorkspaceModel(loadRevisedPaperStructure(), atlasQuery, mode);
    return <RevisedPaperWorkspace model={model} />;
  } catch (error) {
    if (error instanceof RevisedPaperUnavailableError) notFound();
    if (error instanceof ReviewQueryError) notFound();
    throw error;
  }
}
