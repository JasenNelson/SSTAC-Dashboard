import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  MATRIX_OPTIONS_PAPER_LANDING_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

export default async function ReviewPacketPage({
  params,
}: {
  params: Promise<{ documentVersion: string; assignmentId: string; packetId: string }>;
  /** Accepted for route-contract compatibility; this legacy route ignores the query. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION,
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(MATRIX_OPTIONS_PAPER_LANDING_PATH);

  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  redirect(paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null }));
}
