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

export default async function PublicationNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string; canonicalNodeId: string }>;
  searchParams?: Promise<DetailSearchParams>;
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
  const object = structure.objects.find((candidate) => candidate.id === resolvedCanonicalNodeId);
  let detail: RequestedDetail;
  if (node) {
    detail = { id: node.id, domain: node.domain, label: node.label, startByte: node.startByte, endByte: node.endByte, ownerNodeId: null };
  } else {
    if (!object) {
      notFound();
      return null;
    }
    detail = { id: object.id, domain: object.domain, label: object.label, startByte: object.startByte, endByte: object.endByte, ownerNodeId: object.ownerNodeId };
  }
  try {
    const query = (await searchParams) ?? {};
    const detailQuery = parseDetailQuery(query, node ? 'all' : 'objects');
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
