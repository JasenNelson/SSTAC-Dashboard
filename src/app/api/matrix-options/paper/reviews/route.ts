import { NextRequest, NextResponse } from 'next/server';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { reviewResponseRowSchema } from '@/lib/matrix-options/paper/review-responses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

function unavailableResponse(userKey?: string, rateLimitHeaders?: HeadersInit) {
  return NextResponse.json({ outcome: 'persistence_unavailable', rows: [], persistence: 'unavailable', ...(userKey ? { userKey } : {}) }, { status: 503, headers: { ...noStoreHeaders, ...rateLimitHeaders } });
}

function gateResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders });
}

function queryValue(request: NextRequest, key: string): string | null {
  const values = (request.nextUrl ?? new URL(request.url)).searchParams.getAll(key);
  return values.length === 1 ? values[0] : values.length === 0 ? null : '__repeated__';
}

export async function GET(request: NextRequest) {
  if (resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION) !== 'REVIEW_NAVIGATION') return gateResponse();
  const documentVersion = queryValue(request, 'documentVersion');
  const manifestSha256 = queryValue(request, 'manifestSha256');
  const reviewManifest = getReviewManifest();
  if (documentVersion !== reviewManifest.documentVersion || manifestSha256 !== reviewManifest.sha256) return NextResponse.json({ error: 'Invalid release identity' }, { status: 400, headers: noStoreHeaders });

  const { user, supabase, rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'default');
  if (rateLimitResponse) return rateLimitResponse;
  // Anonymous Supabase sessions are not reviewers (same rule as the downloads route).
  if (!user || user.is_anonymous !== false) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const { data, error } = await supabase
    .from('matrix_paper_review_responses')
    .select('id,document_version,manifest_sha256,cohort_id,question_id,draft_text,submitted_text,revision,submitted_revision,submitted_at,updated_at')
    .eq('user_id', user.id)
    .eq('document_version', documentVersion)
    .eq('manifest_sha256', manifestSha256)
    .order('question_id', { ascending: true });
  if (error) return unavailableResponse(user.id, rateLimitHeaders);

  const guide = getReviewerGuideContract();
  const questionById = new Map(guide.questions.map((question) => [question.id, question]));
  const cohorts = getCohortManifest().cohorts;
  if (!Array.isArray(data)) return unavailableResponse(user.id, rateLimitHeaders);
  const rows = data.flatMap((row: unknown) => {
    const parsed = reviewResponseRowSchema.safeParse(row);
    if (!parsed.success || parsed.data.document_version !== reviewManifest.documentVersion || parsed.data.manifest_sha256 !== reviewManifest.sha256) return [];
    const question = questionById.get(parsed.data.question_id);
    const cohort = cohorts.find((candidate) => candidate.id === parsed.data.cohort_id);
    if (!question || !cohort || !cohort.questionNumbers.includes(question.number)) return [];
    return [parsed.data];
  });
  if (data.length !== rows.length) return unavailableResponse(user.id, rateLimitHeaders);
  return NextResponse.json({ persistence: 'available', userKey: user.id, rows }, { headers: { ...noStoreHeaders, ...rateLimitHeaders } });
}
