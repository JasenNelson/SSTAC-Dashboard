import { describe, expect, it } from 'vitest';
import { validateDownloadManifest } from '@/lib/matrix-options/paper/download-manifest';

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const hash = 'a'.repeat(64);
const base = { schemaVersion: 'matrix-paper-download-manifest-v1' as const, validationState: 'SERVER_VALIDATED' as const, status: 'REVIEW_READY_NOT_GREEN' as const, releaseIdentity: 'release', documentVersion: version, manifestSha256: hash };
function pkg(kind: 'PDF' | 'DOCX', id: string, order: number) {
  const fileName = kind === 'PDF' ? 'paper.pdf' : 'paper.docx';
  return { packageId: id, kind, label: kind, fileName, path: `opaque/${id}`, href: `/api/matrix-options/paper/downloads/${id}`, sha256: `${order ? 'b' : 'c'}`.repeat(64), byteLength: 10 + order, documentVersion: version, manifestSha256: hash, order };
}

describe('opaque download manifest', () => {
  it('accepts exactly the two catalog-owned opaque packages', () => {
    const manifest = validateDownloadManifest({ ...base, packages: [pkg('PDF', 'full-paper-pdf', 0), pkg('DOCX', 'full-paper-docx', 1)] }, base);
    expect(manifest.packages.map((entry) => entry.href)).toEqual(['/api/matrix-options/paper/downloads/full-paper-pdf', '/api/matrix-options/paper/downloads/full-paper-docx']);
  });
  it('rejects legacy paths and path-shaped or case-only IDs', () => {
    for (const id of ['Full-Paper-PDF', 'full/paper', 'full\\paper', 'full%2Fpaper', '..']) {
      expect(() => validateDownloadManifest({ ...base, packages: [pkg('PDF', id, 0), pkg('DOCX', 'full-paper-docx', 1)] }, base)).toThrow();
    }
    expect(() => validateDownloadManifest({ ...base, packages: [ { ...pkg('PDF', 'full-paper-pdf', 0), href: '/api/matrix-options/paper/downloads/v/hash/categories/paper.pdf' }, pkg('DOCX', 'full-paper-docx', 1) ] }, base)).toThrow();
  });
  it('rejects duplicate IDs, kinds, and order values', () => {
    expect(() => validateDownloadManifest({ ...base, packages: [pkg('PDF', 'full-paper-pdf', 0), pkg('PDF', 'other-pdf', 1)] }, base)).toThrow();
    expect(() => validateDownloadManifest({ ...base, packages: [pkg('PDF', 'full-paper-pdf', 0), pkg('DOCX', 'full-paper-pdf', 1)] }, base)).toThrow();
  });
});
