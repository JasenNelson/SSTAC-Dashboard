import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sha256Hex, validatePackageManifest, type PackageManifest } from '../package-integrity';

const hash = 'a'.repeat(64);
const paperText = readFileSync(resolve(process.cwd(), 'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md'), 'utf8');
const paperHash = sha256Hex(new TextEncoder().encode(paperText));
const paperBytes = Buffer.from(paperText, 'utf8');
const sectionHeading = Buffer.from('### 4.1 Part 1: Matrix Numerical Sediment Standards & Four Proposed Sediment Uses', 'utf8');
const sectionStart = paperBytes.indexOf(sectionHeading);
const sectionEnd = paperBytes.indexOf(Buffer.from('\n### 4.2', 'utf8'), sectionStart);
if (sectionStart < 0 || sectionEnd <= sectionStart) throw new Error('test paper section boundary missing');
const paperContextPortions = [{ id: 'categories:section-4.1', cohortId: 'categories', sectionNumber: '4.1', sourceLocator: 'Section 4.1', sectionLabel: 'Section 4.1', status: 'available' as const, sourceNodeId: 'node:test-4.1', startByte: sectionStart, endByte: sectionEnd, text: paperBytes.subarray(sectionStart, sectionEnd).toString('utf8') }];
const manifest: PackageManifest = {
  schemaVersion: 'matrix-review-package-v1',
  releaseIdentity: '1.0.11-remediated-20260913',
  cohortId: 'categories',
  status: 'REVIEW_READY_NOT_GREEN',
  paperSha256: paperHash,
  paperBytes: paperBytes.byteLength,
  reviewerGuideSha256: hash,
  cohortsSha256: hash,
  paperContextPortions,
  artifacts: {
    'review-package.pdf': hash,
    'review-package.docx': hash,
  },
};

describe('package integrity contract', () => {
  it('accepts a release-bound draft manifest with sidecar hashes', () => {
    expect(validatePackageManifest(manifest, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toEqual(manifest);
    expect(sha256Hex('matrix-review')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects synthetic releases and non-hex artifact hashes', () => {
    expect(() => validatePackageManifest({ ...manifest, releaseIdentity: 'slice-1a-fixture-v1' }, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toThrow(/release identity/);
    expect(() => validatePackageManifest({ ...manifest, artifacts: { ...manifest.artifacts, 'review-package.pdf': 'not-a-hash' } }, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toThrow(/artifact hash/);
    expect(() => validatePackageManifest({ ...manifest, paperContextPortions: [] }, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toThrow(/paper context portions/);
    expect(() => validatePackageManifest({ ...manifest, paperContextPortions: [{ ...paperContextPortions[0], text: 'tampered' }] }, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toThrow(/authenticated paper context range/);
    expect(() => validatePackageManifest({ ...manifest, paperContextPortions: [{ ...paperContextPortions[0], startByte: 0, endByte: paperBytes.byteLength, text: paperText }] }, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, paperText)).toThrow(/full paper context fallback/);
    expect(() => validatePackageManifest(manifest, manifest.releaseIdentity, manifest.cohortId, paperHash, hash, hash, `${paperText.slice(0, -1)} `)).toThrow(/authenticated paper bytes/);
  });
});
