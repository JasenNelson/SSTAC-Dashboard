import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authMock, serverMock, MockDownloadBoundaryError } = vi.hoisted(() => {
  class MockDownloadBoundaryError extends Error { readonly status: 400 | 404 | 409 | 503; readonly code: string; constructor(message: string, status: 400 | 404 | 409 | 503, code: string) { super(message); this.status = status; this.code = code; } }
  return { authMock: vi.fn(), serverMock: { parseDownloadRequestBinding: vi.fn(), loadTrustedDownloadContext: vi.fn(), loadAuthenticatedPrintPackageCatalog: vi.fn(), buildValidatedDownloadManifest: vi.fn() }, MockDownloadBoundaryError };
});
vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: authMock }));
vi.mock('@/lib/matrix-options/paper/download-manifest-server', () => ({ DownloadBoundaryError: MockDownloadBoundaryError, DOWNLOAD_API_PREFIX: '/api/matrix-options/paper/downloads', PRINT_PACKAGE_ARTIFACT_DEPENDENCY: 'authenticated-pdf-docx-bytes-and-private-catalog-locator', PRINT_PACKAGE_ARTIFACTS_STATE: 'UNAVAILABLE_MISSING_AUTHENTICATED_ARTIFACTS', ...serverMock }));
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/app/api/matrix-options/paper/downloads/route';
const user = { id: 'user-1' };
beforeEach(() => { vi.clearAllMocks(); authMock.mockResolvedValue({ user, rateLimitResponse: null, rateLimitHeaders: {} }); serverMock.parseDownloadRequestBinding.mockReturnValue({ documentVersion: 'v', manifestSha256: 'a'.repeat(64), cohortId: 'categories' }); serverMock.loadTrustedDownloadContext.mockResolvedValue({ releaseIdentity: 'release' }); });
describe('manifest endpoint', () => {
  it('authenticates before release work and preserves helper 429 headers', async () => {
    authMock.mockResolvedValueOnce({ user: null, rateLimitResponse: null, rateLimitHeaders: {} });
    expect((await GET(new NextRequest('https://example.test/api/matrix-options/paper/downloads'))).status).toBe(401);
    authMock.mockResolvedValueOnce({ user, rateLimitResponse: NextResponse.json({ error: 'slow down' }, { status: 429 }), rateLimitHeaders: {} });
    const response = await GET(new NextRequest('https://example.test/api/matrix-options/paper/downloads'));
    expect(response.status).toBe(429); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(serverMock.parseDownloadRequestBinding).not.toHaveBeenCalled();
  });
  it('maps null producer and integrity/release exceptions fail-closed', async () => {
    serverMock.loadAuthenticatedPrintPackageCatalog.mockResolvedValueOnce(null);
    const missing = await GET(new NextRequest('https://example.test/api/matrix-options/paper/downloads')); expect(missing.status).toBe(503); expect(missing.headers.get('cache-control')).toBe('no-store'); expect(missing.headers.get('x-content-type-options')).toBe('nosniff');
    serverMock.loadAuthenticatedPrintPackageCatalog.mockRejectedValueOnce(new MockDownloadBoundaryError('catalog mismatch', 409, 'CATALOG_RELEASE_MISMATCH'));
    const mismatch = await GET(new NextRequest('https://example.test/api/matrix-options/paper/downloads')); expect(mismatch.status).toBe(409); expect((await mismatch.json()).code).toBe('CATALOG_RELEASE_MISMATCH');
  });
});
