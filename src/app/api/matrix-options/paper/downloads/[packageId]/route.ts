import { NextRequest, NextResponse } from 'next/server';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import {
  DownloadBoundaryError,
  contentDispositionForCatalog,
  loadAuthenticatedPrintPackageCatalog,
  loadTrustedDownloadReleaseContext,
  selectOpaquePackageArtifact,
  streamAuthenticatedPrintPackageArtifact,
  validateOpaquePackageId,
} from '@/lib/matrix-options/paper/download-manifest-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function jsonError(error: DownloadBoundaryError | { status: number; code: string; message: string }, rateLimitHeaders?: HeadersInit): NextResponse {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
}

export async function GET(request: NextRequest, routeContext: { params: Promise<{ packageId: string }> }): Promise<NextResponse> {
  const { user, supabase, rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'default');
  if (rateLimitResponse) {
    const headers = new Headers(rateLimitResponse.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new NextResponse(rateLimitResponse.body, { status: rateLimitResponse.status, statusText: rateLimitResponse.statusText, headers });
  }
  if (!user || user.is_anonymous !== false) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
  try {
    const { packageId } = await routeContext.params;
    const validatedPackageId = validateOpaquePackageId(packageId);
    const context = await loadTrustedDownloadReleaseContext();
    const artifacts = await loadAuthenticatedPrintPackageCatalog(context);
    const artifact = selectOpaquePackageArtifact(artifacts, validatedPackageId, context);
    const contentDisposition = contentDispositionForCatalog(artifact);
    const response = await streamAuthenticatedPrintPackageArtifact(artifact, supabase);
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Content-Disposition', contentDisposition);
    return response;
  } catch (error) {
    // Log before responding: the client only ever sees a code, so without this
    // an operator has no record that the artifact boundary refused a request.
    console.error(
      `[matrix-options-paper][artifact-route] ` +
      (error instanceof DownloadBoundaryError
        ? `code=${error.code} status=${error.status}`
        : `unexpected=${error instanceof Error ? error.message : 'unknown'}`),
    );
    if (error instanceof DownloadBoundaryError) return jsonError(error, rateLimitHeaders);
    return jsonError({ status: 503, code: 'DOWNLOAD_BOUNDARY_UNAVAILABLE', message: 'Download boundary is unavailable.' }, rateLimitHeaders);
  }
}
