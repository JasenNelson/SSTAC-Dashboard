import { NextRequest, NextResponse } from 'next/server';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import {
  reviewResponseOutcomeStatus,
  reviewResponseRequestSchema,
  reviewResponseRowSchema,
  type ReviewResponseOutcome,
} from '@/lib/matrix-options/paper/review-responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

function normalizeRpcData(data: unknown, expected: { documentVersion: string; manifestSha256: string; cohortId: string; questionId: string }): ReviewResponseOutcome {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object') return { outcome: 'persistence_unavailable' };
  const record = value as Record<string, unknown>;
  const rawOutcome = record.outcome;
  const supported = rawOutcome === 'ok' || rawOutcome === 'noop_already_submitted' || rawOutcome === 'stale_revision' || rawOutcome === 'unknown_identity' || rawOutcome === 'stale_manifest' || rawOutcome === 'unauthenticated' || rawOutcome === 'too_large' || rawOutcome === 'persistence_unavailable';
  if (!supported) return { outcome: 'persistence_unavailable' };
  const parsedRow = record.row === null || record.row === undefined ? null : reviewResponseRowSchema.safeParse(record.row);
  const row = parsedRow?.success ? parsedRow.data : null;
  const rowMatchesRequest = row !== null
    && row.document_version === expected.documentVersion
    && row.manifest_sha256 === expected.manifestSha256
    && row.cohort_id === expected.cohortId
    && row.question_id === expected.questionId;
  if ((rawOutcome === 'ok' || rawOutcome === 'noop_already_submitted' || rawOutcome === 'stale_revision') && !rowMatchesRequest) return { outcome: 'persistence_unavailable' };
  if (record.row !== null && record.row !== undefined && !rowMatchesRequest && rawOutcome !== 'unknown_identity' && rawOutcome !== 'stale_manifest' && rawOutcome !== 'unauthenticated' && rawOutcome !== 'too_large') return { outcome: 'persistence_unavailable' };
  const rowBearingOutcome = rawOutcome === 'ok' || rawOutcome === 'noop_already_submitted' || rawOutcome === 'stale_revision';
  return rowBearingOutcome && rowMatchesRequest ? { outcome: rawOutcome, row } as ReviewResponseOutcome : { outcome: rawOutcome } as ReviewResponseOutcome;
}

function errorOutcome(error: { readonly code?: string; readonly message?: string }): ReviewResponseOutcome {
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01' || /function .* does not exist|relation .* does not exist/i.test(error.message ?? '')) return { outcome: 'persistence_unavailable' };
  return { outcome: 'persistence_unavailable' };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  if (resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION) !== 'REVIEW_NAVIGATION') return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders });
  const { user, supabase, rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'default');
  if (rateLimitResponse) return rateLimitResponse;
  if (!user) return NextResponse.json({ outcome: 'unauthenticated' }, { status: 401, headers: noStoreHeaders });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: noStoreHeaders }); }
  const parsed = reviewResponseRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid review response' }, { status: 400, headers: noStoreHeaders });
  const { questionId: encodedQuestionId } = await params;
  let questionId: string;
  try { questionId = decodeURIComponent(encodedQuestionId); } catch { return NextResponse.json({ error: 'Invalid question id' }, { status: 400, headers: { ...noStoreHeaders, ...rateLimitHeaders } }); }
  const reviewManifest = getReviewManifest();
  if (parsed.data.documentVersion !== reviewManifest.documentVersion || parsed.data.manifestSha256 !== reviewManifest.sha256) return NextResponse.json({ error: 'Invalid review response' }, { status: 400, headers: noStoreHeaders });
  const question = getReviewerGuideContract().questions.find((candidate) => candidate.id === questionId);
  const cohort = getCohortManifest().cohorts.find((candidate) => candidate.id === parsed.data.cohortId && candidate.questionNumbers.includes(question?.number ?? -1));
  if (!question || !cohort) return NextResponse.json({ outcome: 'unknown_identity' }, { status: reviewResponseOutcomeStatus('unknown_identity'), headers: { ...noStoreHeaders, ...rateLimitHeaders } });

  const rpcName = parsed.data.action === 'submit' ? 'matrix_paper_review_submit' : 'matrix_paper_review_save_draft';
  const { data, error } = await supabase.rpc(rpcName, {
    p_document_version: parsed.data.documentVersion,
    p_manifest_sha256: parsed.data.manifestSha256,
    p_cohort_id: parsed.data.cohortId,
    p_question_id: questionId,
    p_text: parsed.data.text,
    p_expected_revision: parsed.data.expectedRevision,
  });
  const outcome = error ? errorOutcome(error) : normalizeRpcData(data, { documentVersion: reviewManifest.documentVersion, manifestSha256: reviewManifest.sha256, cohortId: parsed.data.cohortId, questionId });
  return NextResponse.json(outcome, { status: reviewResponseOutcomeStatus(outcome.outcome), headers: { ...noStoreHeaders, ...rateLimitHeaders } });
}
