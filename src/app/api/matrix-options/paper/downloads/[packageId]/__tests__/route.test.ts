import { beforeEach, describe, expect, it, vi } from 'vitest';
const { authMock, serverMock, MockDownloadBoundaryError } = vi.hoisted(() => {
  class MockDownloadBoundaryError extends Error { readonly status: 400 | 404 | 409 | 503; readonly code: string; constructor(message: string, status: 400 | 404 | 409 | 503, code: string) { super(message); this.status = status; this.code = code; } }
  return { authMock: vi.fn(), serverMock: { loadTrustedDownloadReleaseContext: vi.fn(), loadAuthenticatedPrintPackageCatalog: vi.fn(), selectOpaquePackageArtifact: vi.fn(), contentDispositionForCatalog: vi.fn(), streamAuthenticatedPrintPackageArtifact: vi.fn(), validateOpaquePackageId: vi.fn() }, MockDownloadBoundaryError };
});
vi.mock('@/app/api/_helpers/rate-limit-wrapper', () => ({ getAuthAndRateLimit: authMock }));
vi.mock('@/lib/matrix-options/paper/download-manifest-server', () => ({ DownloadBoundaryError: MockDownloadBoundaryError, ...serverMock }));
import { NextRequest, NextResponse } from 'next/server';
import { GET } from '@/app/api/matrix-options/paper/downloads/[packageId]/route';
const user = { id: 'user-1' }; const context = { releaseIdentity: 'release' }; const artifact = { packageId: 'full-paper-pdf', fileName: 'paper.pdf' }; const request = new NextRequest('https://example.test/api/matrix-options/paper/downloads/full-paper-pdf');
beforeEach(() => { vi.clearAllMocks(); authMock.mockResolvedValue({ user, rateLimitResponse: null, rateLimitHeaders: {} }); serverMock.validateOpaquePackageId.mockImplementation((id: string) => { if (!id || id !== id.toLowerCase() || /[%/\\]|\.\./.test(id)) throw new MockDownloadBoundaryError('rejected', 400, 'UNSAFE_PACKAGE_ID'); return id; }); serverMock.loadTrustedDownloadReleaseContext.mockResolvedValue(context); serverMock.loadAuthenticatedPrintPackageCatalog.mockResolvedValue([artifact]); serverMock.selectOpaquePackageArtifact.mockReturnValue(artifact); serverMock.contentDispositionForCatalog.mockReturnValue('attachment; filename="paper.pdf"'); serverMock.streamAuthenticatedPrintPackageArtifact.mockRejectedValue(new MockDownloadBoundaryError('private transport unavailable', 503, 'PRIVATE_ASSET_MECHANISM_UNBOUND')); });
describe('opaque artifact endpoint', () => {
  it('authenticates before any catalog/path work and preserves 429 headers', async () => {
    authMock.mockResolvedValueOnce({ user: null, rateLimitResponse: null, rateLimitHeaders: {} }); expect((await GET(request, { params: Promise.resolve({ packageId: 'full-paper-pdf' }) })).status).toBe(401);
    authMock.mockResolvedValueOnce({ user, rateLimitResponse: NextResponse.json({}, { status: 429 }), rateLimitHeaders: {} }); const response = await GET(request, { params: Promise.resolve({ packageId: 'full-paper-pdf' }) }); expect(response.status).toBe(429); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(serverMock.loadTrustedDownloadReleaseContext).not.toHaveBeenCalled();
  });
  it('maps unknown, malformed, case-only, catalog, and private transport failures', async () => {
    for (const [id, status, code] of [['missing', 404, 'ARTIFACT_NOT_FOUND'], ['Full-Paper-PDF', 400, 'UNSAFE_PACKAGE_ID'], ['full%2Fpaper', 400, 'UNSAFE_PACKAGE_ID'], ['../paper', 400, 'UNSAFE_PACKAGE_ID']] as const) {
      serverMock.selectOpaquePackageArtifact.mockReset();
      if (status === 404) serverMock.selectOpaquePackageArtifact.mockImplementation(() => { throw new MockDownloadBoundaryError('rejected', status, code); });
      const response = await GET(request, { params: Promise.resolve({ packageId: id }) }); expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    }
    serverMock.loadAuthenticatedPrintPackageCatalog.mockResolvedValueOnce(null); serverMock.selectOpaquePackageArtifact.mockReset(); serverMock.selectOpaquePackageArtifact.mockImplementation(() => { throw new MockDownloadBoundaryError('missing catalog', 503, 'PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE'); });
    const missingCatalog = await GET(request, { params: Promise.resolve({ packageId: 'full-paper-pdf' }) }); expect(missingCatalog.status).toBe(503); expect((await missingCatalog.json()).code).toBe('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE');
    serverMock.loadAuthenticatedPrintPackageCatalog.mockResolvedValue([artifact]); serverMock.selectOpaquePackageArtifact.mockReset(); serverMock.selectOpaquePackageArtifact.mockReturnValue(artifact);
    const response = await GET(request, { params: Promise.resolve({ packageId: 'full-paper-pdf' }) }); expect(response.status).toBe(503); expect((await response.json()).code).toBe('PRIVATE_ASSET_MECHANISM_UNBOUND'); expect(serverMock.streamAuthenticatedPrintPackageArtifact).toHaveBeenCalledWith(artifact);
  });
  it('validates the opaque ID before trusted context and never supplies a filesystem path', async () => {
    const response = await GET(request, { params: Promise.resolve({ packageId: 'Full-Paper-PDF' }) });
    expect(response.status).toBe(400);
    expect(serverMock.loadTrustedDownloadReleaseContext).not.toHaveBeenCalled();
    expect(serverMock.streamAuthenticatedPrintPackageArtifact).not.toHaveBeenCalled();
  });
});
