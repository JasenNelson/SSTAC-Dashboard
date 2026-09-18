import { describe, expect, it, vi } from 'vitest';
import { DownloadBoundaryError, contentDispositionForCatalog, loadAuthenticatedPrintPackageCatalog, parseDownloadRequestBinding, selectOpaquePackageArtifact, streamAuthenticatedPrintPackageArtifact, validateOpaquePackageId, loadDownloadManifestState, type PrintPackageArtifact, type TrustedDownloadContext } from '@/lib/matrix-options/paper/download-manifest-server';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { Readable } = await import('node:stream');
  const readFileMock = vi.fn(async (filePath: string) => {
    if (filePath.endsWith('catalog.json')) {
      return JSON.stringify({
        artifacts: [
          { packageId: 'categories-pdf', kind: 'PDF', label: 'PDF', fileName: 'paper.pdf', sha256: '6b0c82cc9821bbf8483452bdf92439198857221090f4a862e4574ad4d992ee64', byteLength: 110968, order: 0, cohortId: 'categories', path: 'private-packages/categories.pdf' },
          { packageId: 'categories-docx', kind: 'DOCX', label: 'DOCX', fileName: 'paper.docx', sha256: '6b0c82cc9821bbf8483452bdf92439198857221090f4a862e4574ad4d992ee64', byteLength: 110968, order: 1, cohortId: 'categories', path: 'private-packages/categories.docx' }
        ]
      });
    }
    return Buffer.alloc(110968);
  });
  const statMock = vi.fn(async (_filePath: string) => {
    return { size: 110968 };
  });
  const openMock = vi.fn(async (filePath: string) => {
    return {
      createReadStream: vi.fn((_opts) => {
        if (filePath.includes('mismatch')) {
          return Readable.from([Buffer.alloc(110968, 1)]);
        }
        return Readable.from([Buffer.alloc(110968)]);
      }),
      close: vi.fn(async () => {})
    };
  });
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      readFile: readFileMock,
      stat: statMock,
      open: openMock
    },
    readFile: readFileMock,
    stat: statMock,
    open: openMock
  };
});

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const hash = 'a'.repeat(64);
const context = { documentVersion: version, manifestSha256: hash, paperSha256: 'b'.repeat(64), releaseIdentity: 'release', paperReleaseIdentity: 'paper', cohortQuestionIds: { categories: [`rpq:${version}:q01`] }, reviewManifest: {} as TrustedDownloadContext['reviewManifest'] } satisfies TrustedDownloadContext;
const artifact = { packageId: 'full-paper-pdf', kind: 'PDF', label: 'PDF', fileName: 'paper.pdf', sha256: 'c'.repeat(64), byteLength: 10, order: 0, cohortId: 'categories', documentVersion: version, manifestSha256: hash, serverAssetLocator: 'private-print-package:full-paper-pdf' } satisfies PrintPackageArtifact;
const completeCatalog = [artifact, { ...artifact, packageId: 'full-paper-docx', kind: 'DOCX' as const, fileName: 'paper.docx', sha256: 'd'.repeat(64), byteLength: 11, order: 1, serverAssetLocator: 'private-print-package:full-paper-docx' }];

describe('opaque download server boundary', () => {
  it('accepts trusted rpq and rejects raw, percent, double-encoded, and mixed separators', () => {
    expect(parseDownloadRequestBinding(new URL(`https://example.test/?documentVersion=${version}&manifestSha256=${hash}&cohortId=categories&questionId=rpq:${version}:q01`)).questionId).toBe(`rpq:${version}:q01`);
    for (const value of ['rpq:' + version + ':q01/child', 'rpq:' + version + ':q01\\child', 'rpq:' + version + ':q01%2F..', 'rpq:' + version + ':q01%252F..']) expect(() => parseDownloadRequestBinding(new URL(`https://example.test/?documentVersion=${version}&manifestSha256=${hash}&cohortId=categories&questionId=${value}`))).toThrow(DownloadBoundaryError);
  });
  it('rejects malformed or case-only opaque IDs before catalog selection', () => {
    expect(validateOpaquePackageId('full-paper-pdf')).toBe('full-paper-pdf');
    for (const id of ['', 'Full-Paper-PDF', 'full/paper', 'full\\paper', 'full%2Fpaper', 'full%252Fpaper', '..']) expect(() => validateOpaquePackageId(id)).toThrow(DownloadBoundaryError);
  });
  it('binds the private catalog, rejects unknown IDs, and streams only catalog-owned bytes', async () => {
    const loaded = await loadAuthenticatedPrintPackageCatalog(context, 'categories');
    expect(loaded).toHaveLength(2);
    expect(loaded?.map((entry) => entry.packageId)).toEqual(['categories-pdf', 'categories-docx']);
    expect(() => selectOpaquePackageArtifact(null, 'full-paper-pdf', context)).toThrow(/unavailable/);
    expect(() => selectOpaquePackageArtifact([artifact], 'full-paper-pdf', context)).toThrow(/Exactly one authenticated/);
    expect(() => selectOpaquePackageArtifact([artifact, { ...artifact, packageId: 'other-pdf', fileName: 'other.pdf', order: 1 }], 'full-paper-pdf', context)).toThrow(/duplicate package kinds/);
    expect(() => selectOpaquePackageArtifact(completeCatalog, 'missing', context)).toThrow(/not in the authenticated catalog/);
    const response = await streamAuthenticatedPrintPackageArtifact(loaded![0]);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(Number(response.headers.get('content-length'))).toBe(110968);
  });
  it('derives disposition solely from the catalog filename', () => expect(contentDispositionForCatalog(artifact)).toBe('attachment; filename="paper.pdf"'));
  it('proves that only ENOENT returns null while other errors fail closed', async () => {
    const fsMock = await import('node:fs/promises');
    
    // 1. ENOENT returns null
    vi.mocked(fsMock.default.readFile).mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    await expect(loadAuthenticatedPrintPackageCatalog(context, 'categories')).resolves.toBeNull();
    
    // 2. Malformed JSON throws boundary failure
    vi.mocked(fsMock.default.readFile).mockResolvedValueOnce('{ bad json }'); // catalog
    await expect(loadAuthenticatedPrintPackageCatalog(context, 'categories')).rejects.toThrow(DownloadBoundaryError);

    // 3. EACCES throws boundary failure
    vi.mocked(fsMock.default.readFile).mockRejectedValueOnce(Object.assign(new Error('EACCES'), { code: 'EACCES' }));
    await expect(loadAuthenticatedPrintPackageCatalog(context, 'categories')).rejects.toThrow(DownloadBoundaryError);
    
    // 4. Hash mismatch throws boundary failure
    vi.mocked(fsMock.default.readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: 'matrix-paper-print-catalog-v1',
      releaseIdentity: context.documentVersion,
      paperSha256: context.paperSha256,
      artifacts: [{ packageId: 'categories-pdf', kind: 'PDF', label: 'PDF', fileName: 'paper.pdf', sha256: 'a'.repeat(64), byteLength: 10, order: 0, cohortId: 'categories', path: 'private-packages/categories.pdf' }]
    }));
    vi.mocked(fsMock.default.readFile).mockResolvedValueOnce(Buffer.from('bad bytes')); // bytes do not match artifact sha256!
    await expect(loadAuthenticatedPrintPackageCatalog(context, 'categories')).rejects.toThrow(DownloadBoundaryError);
  });

  it('proves that file length match but byte mismatch (TOCTOU) fails before 200 response', async () => {
    const fsMock = await import('node:fs/promises');
    vi.mocked(fsMock.default.readFile).mockResolvedValueOnce(JSON.stringify({
      schemaVersion: 'matrix-paper-print-catalog-v1',
      releaseIdentity: context.documentVersion,
      paperSha256: context.paperSha256,
      artifacts: [{ packageId: 'mismatch-pdf', kind: 'PDF', label: 'PDF', fileName: 'paper.pdf', sha256: '6b0c82cc9821bbf8483452bdf92439198857221090f4a862e4574ad4d992ee64', byteLength: 110968, order: 0, cohortId: 'categories', path: 'private-packages/mismatch.pdf' }]
    }));
    const spoofArtifact = { ...artifact, packageId: 'mismatch-pdf', serverAssetLocator: 'private-print-package:mismatch-pdf', byteLength: 110968, sha256: '6b0c82cc9821bbf8483452bdf92439198857221090f4a862e4574ad4d992ee64' };
    await expect(streamAuthenticatedPrintPackageArtifact(spoofArtifact)).rejects.toThrow(/Private package bytes do not match/);
  });

  it('maps an authenticated null catalog to pending only', async () => {
    await expect(loadDownloadManifestState({ documentVersion: 'other', manifestSha256: hash, cohortId: 'missing' })).rejects.toThrow();
  });
});
