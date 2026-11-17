import { NextRequest, NextResponse } from 'next/server';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

/** Historical responses stay readable through GET/export; this route makes no new legacy writes. */
export async function PUT(request: NextRequest, _context: { params: Promise<{ questionId: string }> }) {
  if (resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION) !== 'REVIEW_NAVIGATION') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders });
  }
  const { user, rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'default');
  if (rateLimitResponse) return rateLimitResponse;
  if (!user || user.is_anonymous !== false) {
    return NextResponse.json({ outcome: 'unauthenticated' }, { status: 401, headers: noStoreHeaders });
  }
  return NextResponse.json({ outcome: 'release_read_only' }, { status: 403, headers: { ...noStoreHeaders, ...rateLimitHeaders } });
}
