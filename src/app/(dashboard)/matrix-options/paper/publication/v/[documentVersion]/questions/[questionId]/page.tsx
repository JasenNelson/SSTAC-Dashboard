import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  createWorkspaceModel,
  parseDetailQuery,
  parseWorkspaceMode,
  ReviewQueryError,
  sourceRangeText,
} from '@/lib/matrix-options/revised-paper-review';
import type { RequestedDetail } from '@/lib/matrix-options/revised-paper-review';

type DetailSearchParams = { mode?: string | string[]; lens?: string | string[]; q?: string | string[]; page?: string | string[] };

function canonicalReviewHref(documentVersion: string, query: ReturnType<typeof parseDetailQuery>): string {
  const params = new URLSearchParams({ mode: 'my-review', lens: query.lens, page: String(query.page) });
  if (query.q) params.set('q', query.q);
  return `/matrix-options/paper/publication/v/${encodeURIComponent(documentVersion)}?${params.toString()}`;
}

export default async function PublicationQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string; questionId: string }>;
  searchParams?: Promise<DetailSearchParams>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(REVISED_PAPER_ROUTE);
  const { documentVersion, questionId } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  let resolvedQuestionId: string;
  try {
    resolvedQuestionId = decodeURIComponent(questionId);
  } catch {
    notFound();
    return null;
  }
  const structure = loadRevisedPaperStructure();
  const question = structure.questions.find((candidate) => candidate.id === resolvedQuestionId);
  if (!question) notFound();
  const detail: RequestedDetail = {
    id: question.id,
    domain: question.domain,
    label: question.label,
    startByte: question.startByte,
    endByte: question.endByte,
    ownerNodeId: question.ownerNodeId,
  };
  try {
    const query = (await searchParams) ?? {};
    const detailQuery = parseDetailQuery(query, 'questions');
    const mode = parseWorkspaceMode(query.mode ?? 'publication');
    if (mode === 'my-review') redirect(canonicalReviewHref(documentVersion, detailQuery));
    const model = createWorkspaceModel(
      structure,
      detailQuery,
      mode,
      detail,
    );
    const { RevisedPaperWorkspace } = await import('@/components/matrix-options/paper/RevisedPaperWorkspace');
    return <RevisedPaperWorkspace model={model} readerText={mode === 'publication' ? sourceRangeText(structure.content, detail.startByte, detail.endByte) : undefined} />;
  } catch (error) {
    if (error instanceof ReviewQueryError) notFound();
    throw error;
  }
}
