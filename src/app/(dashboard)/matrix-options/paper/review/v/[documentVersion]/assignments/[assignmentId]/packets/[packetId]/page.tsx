import { notFound, redirect } from 'next/navigation';

import {
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  MATRIX_OPTIONS_PAPER_LANDING_PATH,
  resolveMatrixOptionsPaperReviewNavigationGate,
  MATRIX_OPTIONS_PAPER_REVIEW_ROUTE,
} from '@/lib/matrix-options/navigation';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

export default async function ReviewPacketPage({
  params,
}: {
  params: Promise<{ documentVersion: string; assignmentId: string; packetId: string }>;
}) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION,
  );
  if (gate === 'LEGACY_TWG_REVIEW') redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  if (gate === 'PAPER_RESOLVER') redirect(MATRIX_OPTIONS_PAPER_LANDING_PATH);

  const { documentVersion } = await params;
  if (documentVersion !== REVISED_PAPER_VERSION) notFound();
  redirect(MATRIX_OPTIONS_PAPER_REVIEW_ROUTE);
}
