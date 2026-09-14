import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  createWorkspaceModel,
  parseAtlasQuery,
  parseWorkspaceMode,
  ReviewQueryError,
  sourceRangeText,
} from '@/lib/matrix-options/revised-paper-review';

export default async function PublicationNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string; canonicalNodeId: string }>;
  searchParams?: Promise<{ mode?: string | string[]; lens?: string | string[]; q?: string | string[]; page?: string | string[] }>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const { documentVersion, canonicalNodeId } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  let resolvedCanonicalNodeId: string;
  try {
    resolvedCanonicalNodeId = decodeURIComponent(canonicalNodeId);
  } catch {
    notFound();
    return null;
  }
  const structure = loadRevisedPaperStructure();
  const node = structure.nodes.find((candidate) => candidate.id === resolvedCanonicalNodeId);
  if (!node) notFound();
  try {
    const query = (await searchParams) ?? {};
    const model = createWorkspaceModel(
      structure,
      parseAtlasQuery({ ...query, lens: query.lens ?? 'all', q: query.q ?? node.label, page: query.page ?? '1' }),
      parseWorkspaceMode(query.mode ?? 'publication'),
    );
    const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
    return <RevisedPaperWorkspace model={model} readerText={sourceRangeText(structure.content, node.startByte, node.endByte)} />;
  } catch (error) {
    if (error instanceof ReviewQueryError) notFound();
    throw error;
  }
}
