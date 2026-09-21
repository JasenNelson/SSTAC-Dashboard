import { NextRequest, NextResponse } from 'next/server';

import { getAuthAndRateLimit } from '@/app/api/_helpers/rate-limit-wrapper';
import {
  DownloadBoundaryError,
  DOWNLOAD_API_PREFIX,
  PRINT_PACKAGE_ARTIFACT_DEPENDENCY,
  PRINT_PACKAGE_ARTIFACTS_STATE,
  buildValidatedDownloadManifest,
  loadAuthenticatedPrintPackageCatalog,
  loadTrustedDownloadContext,
  parseDownloadRequestBinding,
} from '@/lib/matrix-options/paper/download-manifest-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function noStore(response: NextResponse): NextResponse {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new NextResponse(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(error: DownloadBoundaryError | { status: number; code: string; message: string }, rateLimitHeaders?: HeadersInit): NextResponse {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { user, rateLimitResponse, rateLimitHeaders } = await getAuthAndRateLimit(request, 'default');
  if (rateLimitResponse) return noStore(rateLimitResponse);
  if (!user || user.is_anonymous !== false) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
  try {
    const binding = parseDownloadRequestBinding(new URL(request.url));
    const context = await loadTrustedDownloadContext(binding);
    const artifacts = await loadAuthenticatedPrintPackageCatalog(context, binding.cohortId);
    if (!artifacts) return NextResponse.json({ error: 'Authenticated PDF/DOCX print-package artifacts are unavailable.', code: 'PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', dependency: PRINT_PACKAGE_ARTIFACT_DEPENDENCY, state: PRINT_PACKAGE_ARTIFACTS_STATE }, { status: 503, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
    const manifest = buildValidatedDownloadManifest(artifacts, context, binding.cohortId);
    return NextResponse.json({ manifest, apiPrefix: DOWNLOAD_API_PREFIX }, { headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders } });
  } catch (error) {
    // Log before responding: the client only ever sees a code, so without this
    // an operator has no record that the manifest boundary refused a request.
    console.error(
      `[matrix-options-paper][manifest-route] ` +
      (error instanceof DownloadBoundaryError
        ? `code=${error.code} status=${error.status}`
        : `unexpected=${error instanceof Error ? error.message : 'unknown'}`),
    );
    if (error instanceof DownloadBoundaryError) return errorResponse(error, rateLimitHeaders);
    return errorResponse({ status: 503, code: 'DOWNLOAD_BOUNDARY_UNAVAILABLE', message: 'Download boundary is unavailable.' }, rateLimitHeaders);
  }
}
