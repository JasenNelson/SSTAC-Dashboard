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
 * Legacy question deep link (F-07: the identity is never dropped).
 * - A reviewer-guide question id opens My Review on that question (q) and its cohort.
 * - A paper question id opens its owner (else container) heading section, keeping a
 *   valid mode (and, in My Review, a valid cohort and question).
 * - Anything else is 404.
 * In My Review a paper question's `section` identity is carried in the URL by
 * design (M1-07): the workspace selects a cohort portion only when the anchor is
 * a portion's sectionAnchor, and otherwise leaves the identity in the URL unchanged.
 */
export default async function PublicationQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentVersion: string; questionId: string }>;
  searchParams?: Promise<PaperSearchParams>;
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
  }
  const structure = loadRevisedPaperStructure();
  const context = buildPaperUrlContext(structure);
  const guideCohort = context.questionCohort.get(resolvedQuestionId);
  if (guideCohort !== undefined) {
    redirect(paperWorkspaceHref(documentVersion, { mode: 'my-review', cohort: guideCohort, q: resolvedQuestionId, section: null }));
  }
  const question = structure.questions.find((candidate) => candidate.id === resolvedQuestionId);
  if (!question) notFound();
  const headingNodeId = structure.nodes.some((node) => node.id === question.ownerNodeId) ? question.ownerNodeId : question.containerNodeId;
  const section = resolveSectionAnchor(structure, headingNodeId, question.startByte);
  const { state } = parsePaperUrlState((await searchParams) ?? {}, context);
  redirect(paperWorkspaceHref(documentVersion, { ...state, section }));
}
