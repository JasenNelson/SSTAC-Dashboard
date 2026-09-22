import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { paperWorkspaceHref, parsePaperUrlState } from '@/lib/matrix-options/paper/url-state';
import type { PaperSearchParams } from '@/lib/matrix-options/paper/url-state';
import { buildPaperUrlContext, resolveSectionAnchor } from '@/components/matrix-options/paper/PaperDocument';

/**
 * Legacy node/object deep link. Resolves the identity to its section anchor and
 * redirects (307) to the canonical workspace URL, keeping a valid mode (and, in
 * My Review, a valid cohort and question). Unknown identities are 404 (F-07).
 * In My Review the `section` identity is carried in the URL by design (M1-07):
 * the workspace selects a cohort portion only when the anchor is a portion's
 * sectionAnchor, and otherwise leaves the identity in the URL unchanged.
 */
export default async function PublicationNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string; canonicalNodeId: string }>;
  searchParams?: Promise<PaperSearchParams>;
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
  }
  const structure = loadRevisedPaperStructure();
  const node = structure.nodes.find((candidate) => candidate.id === resolvedCanonicalNodeId);
  const object = node ? undefined : structure.objects.find((candidate) => candidate.id === resolvedCanonicalNodeId);
  if (!node && !object) notFound();
  const section = node ? node.anchor : resolveSectionAnchor(structure, object!.ownerNodeId, object!.startByte);
  const { state } = parsePaperUrlState((await searchParams) ?? {}, buildPaperUrlContext(structure));
  redirect(paperWorkspaceHref(documentVersion, { ...state, section }));
}
