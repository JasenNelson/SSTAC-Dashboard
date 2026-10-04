import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getRateLimitHeaders } from '@/app/api/_helpers/rate-limit-wrapper';
import { resolveMatrixOptionsPaperReviewNavigationGate } from '@/lib/matrix-options/navigation';
import { getAcceptedFiguresContract } from '@/lib/matrix-options/paper/accepted-figures';
import { appendixLSourceMediaContract } from '@/lib/matrix-options/paper/accepted-source-media';
import { loadPrivatePaperFigure } from '@/lib/matrix-options/paper/paper-request-loader';
import { PaperReaderDeniedError, PrivateReleaseUnavailableError } from '@/lib/matrix-options/paper/private-release-assets';
import { RATE_LIMIT_CONFIGS } from '@/lib/rate-limit-redis';
import { createAuthenticatedClient } from '@/lib/supabase-auth';

import { PRIVATE_RELEASE_UNAVAILABLE_BODY, resolvePaperRouteSession } from '../../route-session';

/*
 * GET /api/matrix-options/paper/v/<version>/figures/<asset file>?sha256=<asset sha256>
 *
 * One accepted figure of a bound release, as the exact accepted PNG bytes.
 *
 * /api/** is NOT covered by the middleware auth matcher, so this handler checks
 * the feature gate and the session itself, in this order: gate -> session ->
 * rate limit -> release and asset identity -> bytes. The session rule is the
 * one the sections route applies to the paper text (route-session.ts): a
 * release with accepted figures is a private-storage release, so its figures go
 * only to a signed-in, non-anonymous reader, checked on every request.
 *
 * Fail closed on every identity: the version must be a release that has
 * accepted figures, the file must be one of its bound assets and the `sha256`
 * query must be that asset's bound hash. All three are decided from the
 * contract before anything is read. The bytes then come from the private
 * release boundary, which serves them only out of a release whose every object
 * passed its length, hash and form checks, and whose text passed its own: a
 * release that cannot be read or verified right now is a constant 503, never
 * different bytes.
 *
 * The bound hash is part of the URL and is the ETag. The response is cached
 * privately (per reader) but revalidated on every use: a matching If-None-Match
 * is answered 304 only after the gate, the reader and the bytes have been
 * checked again.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * Revalidated on every use, never shown from a cache without asking. A browser may keep the
 * bytes in its private cache (they can remain on that device after sign-out until evicted),
 * but it must present its ETag here first, so the gate and the session are checked on every
 * view and a signed-out browser gets 401, not the image. "private" keeps shared caches out.
 * no-store (as the paper text uses) would also keep the bytes off the device, at the cost
 * of 17 full downloads per page load against the shared request budget.
 */
const REVALIDATE_PRIVATE = 'private, no-cache';

function json(body: unknown, status: number, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** The asset file a route segment names, percent-decoded once; null for malformed encoding. */
function decodeSegment(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentVersion: string; assetFile: string }> },
) {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE, process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);
  if (gate !== 'REVIEW_NAVIGATION') return json({ error: 'Not found' }, 404);

  const supabase = await createAuthenticatedClient();
  const { documentVersion, assetFile } = await params;
  // The release named decides which session rule applies; nothing else is read from it yet.
  const session = await resolvePaperRouteSession(supabase, documentVersion);
  if (!session) return json({ error: 'Unauthorized' }, 401);

  const { response: rateLimited, headers: rateLimitHeaders } = await getRateLimitHeaders(request, session.userId, RATE_LIMIT_CONFIGS.default);
  if (rateLimited) {
    rateLimited.headers.set('Cache-Control', 'no-store');
    return rateLimited;
  }

  const contract = getAcceptedFiguresContract(documentVersion);
  if (!contract) return json({ error: 'Not found' }, 404, rateLimitHeaders);

  // Exact match against the bound file names only: the segment is never used to build a path.
  const requested = decodeSegment(assetFile);
  const asset = requested === null ? undefined : contract.assets.find((candidate) => candidate.file === requested);
  const sourceMedia = documentVersion === 'v0.9.91' && requested === appendixLSourceMediaContract().file
    ? appendixLSourceMediaContract()
    : undefined;
  if (!asset && !sourceMedia) return json({ error: 'Not found' }, 404, rateLimitHeaders);

  const expectedSha256 = asset?.sha256 ?? sourceMedia!.sha256;
  const expectedFile = asset?.file ?? sourceMedia!.file;
  if (new URL(request.url).searchParams.get('sha256') !== expectedSha256) {
    return json({ error: 'Figure release mismatch' }, 409, rateLimitHeaders);
  }

  // Figure bytes exist only behind the private release boundary, which takes nothing but a
  // reader the check above issued for this request.
  if (!session.reader) return json({ error: 'Not found' }, 404, rateLimitHeaders);
  let bytes: Buffer | null;
  try {
    bytes = await loadPrivatePaperFigure(documentVersion, expectedFile, session.reader);
  } catch (error) {
    if (error instanceof PaperReaderDeniedError) return json({ error: 'Unauthorized' }, 401, rateLimitHeaders);
    if (error instanceof PrivateReleaseUnavailableError) return json(PRIVATE_RELEASE_UNAVAILABLE_BODY, 503, rateLimitHeaders);
    throw error;
  }
  if (!bytes) return json({ error: 'Not found' }, 404, rateLimitHeaders);

  const etag = `"${expectedSha256}"`;
  const cacheHeaders = { ...rateLimitHeaders, 'Cache-Control': REVALIDATE_PRIVATE, ETag: etag };
  if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers: cacheHeaders });
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      ...cacheHeaders,
      'Content-Type': 'image/png',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `inline; filename="${expectedFile}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
