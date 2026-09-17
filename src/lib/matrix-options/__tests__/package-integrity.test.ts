import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { sha256Hex, validatePackageManifest, type PackageManifest } from '../package-integrity';

const hash = 'a'.repeat(64);
const paperText = readFileSync(resolve(process.cwd(), 'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md'), 'utf8');
const paperHash = sha256Hex(new TextEncoder().encode(paperText));
const paperBytes = Buffer.from(paperText, 'utf8');
const guideBytes = readFileSync(resolve(process.cwd(), 'src/lib/matrix-options/paper/contracts/reviewer-guide-v1.json'));
const cohortBytes = readFileSync(resolve(process.cwd(), 'src/lib/matrix-options/paper/contracts/cohorts-v1.json'));
const sectionHeading = Buffer.from('### 4.1 Part 1: Matrix Numerical Sediment Standards & Four Proposed Sediment Uses', 'utf8');
const sectionStart = paperBytes.indexOf(sectionHeading);
const sectionEnd = paperBytes.indexOf(Buffer.from('\n### 4.2', 'utf8'), sectionStart);
if (sectionStart < 0 || sectionEnd <= sectionStart) throw new Error('test paper section boundary missing');
const textAt = (startByte: number, endByte: number) => paperBytes.subarray(startByte, endByte).toString('utf8');
const basePortion = { id: 'categories:section-4.1', cohortId: 'categories', sectionNumber: '4.1', sourceLocator: 'Section 4.1', sectionLabel: 'Section 4.1', status: 'available' as const, sourceNodeId: 'node:test-4.1', startByte: sectionStart, endByte: sectionEnd, text: textAt(sectionStart, sectionEnd) };
const paperContextPortions = [basePortion];
const manifest: PackageManifest = {
  schemaVersion: 'matrix-review-package-v1',
  releaseIdentity: '1.0.11-remediated-20260913',
  cohortId: 'categories',
  status: 'REVIEW_READY_NOT_GREEN',
  paperSha256: paperHash,
  paperBytes: paperBytes.byteLength,
  reviewerGuideSha256: sha256Hex(guideBytes),
  cohortsSha256: sha256Hex(cohortBytes),
  paperContextPortions,
  artifacts: {
    'review-package.pdf': hash,
    'review-package.docx': hash,
  },
};

function validate(candidate: unknown, guide: Uint8Array | string = guideBytes, cohorts: Uint8Array | string = cohortBytes) {
  return validatePackageManifest(candidate, manifest.releaseIdentity, manifest.cohortId, paperHash, guide, cohorts, paperText);
}

describe('package integrity contract', () => {
  it('accepts a release-bound draft manifest with sidecar hashes', () => {
    expect(validate(manifest)).toEqual(manifest);
    expect(sha256Hex('matrix-review')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects synthetic releases and non-hex artifact hashes', () => {
    expect(() => validate({ ...manifest, releaseIdentity: 'slice-1a-fixture-v1' })).toThrow(/release identity/);
    expect(() => validate({ ...manifest, artifacts: { ...manifest.artifacts, 'review-package.pdf': 'not-a-hash' } })).toThrow(/artifact hash/);
    expect(() => validate({ ...manifest, paperContextPortions: [] })).toThrow(/paper context portions/);
    expect(() => validate({ ...manifest, paperContextPortions: [{ ...basePortion, text: 'tampered' }] })).toThrow(/authenticated paper context range/);
    expect(() => validate({ ...manifest, paperContextPortions: [{ ...basePortion, startByte: 0, endByte: paperBytes.byteLength, text: paperText }] })).toThrow(/full paper context fallback/);
    expect(() => validatePackageManifest(manifest, manifest.releaseIdentity, manifest.cohortId, paperHash, guideBytes, cohortBytes, `${paperText.slice(0, -1)} `)).toThrow(/authenticated paper bytes/);
  });

  it('rejects a paper context portion bound to a different cohort than the manifest', () => {
    expect(() => validate({ ...manifest, paperContextPortions: [{ ...basePortion, cohortId: 'pathway-grid' }] })).toThrow(/paper context cohort/);
    expect(() => validate({ ...manifest, paperContextPortions: [basePortion, { ...basePortion, id: 'other', cohortId: 'not-a-cohort' }] })).toThrow(/paper context cohort/);
  });

  it('F-05: fails closed (never with a TypeError) for a non-object manifest, portion or artifacts map', () => {
    for (const candidate of [null, undefined, 'manifest', 7, []]) expect(() => validate(candidate)).toThrow(/Invalid package manifest: object/);
    expect(() => validate({ ...manifest, artifacts: undefined })).toThrow(/Invalid package manifest: artifacts/);
    expect(() => validate({ ...manifest, artifacts: [hash, hash] })).toThrow(/Invalid package manifest: artifacts/);
    expect(() => validate({ ...manifest, paperContextPortions: [null] })).toThrow(/Invalid package manifest: paper context identity/);
    expect(() => validate({ ...manifest, paperContextPortions: [{ ...basePortion, sectionNumber: 41 }] })).toThrow(/Invalid package manifest: paper context identity/);
  });

  it('F-05: rejects missing or extra artifact keys', () => {
    expect(() => validate({ ...manifest, artifacts: { ...manifest.artifacts, 'review-package.zip': hash } })).toThrow(/artifact keys/);
    expect(() => validate({ ...manifest, artifacts: { 'review-package.pdf': hash } })).toThrow(/artifact keys/);
  });

  it('F-05: rejects duplicate portion ids and overlapping portion ranges, and allows adjacent ranges', () => {
    expect(() => validate({ ...manifest, paperContextPortions: [basePortion, { ...basePortion }] })).toThrow(/duplicate paper context id/);
    const overlapStart = sectionStart + 1;
    const overlapping = { ...basePortion, id: 'categories:section-4.1-overlap', startByte: overlapStart, endByte: sectionEnd, text: textAt(overlapStart, sectionEnd) };
    expect(() => validate({ ...manifest, paperContextPortions: [basePortion, overlapping] })).toThrow(/overlapping paper context ranges/);
    expect(() => validate({ ...manifest, paperContextPortions: [overlapping, basePortion] })).toThrow(/overlapping paper context ranges/);
    const adjacentEnd = sectionEnd + 200;
    const adjacent = { ...basePortion, id: 'categories:adjacent', startByte: sectionEnd, endByte: adjacentEnd, text: textAt(sectionEnd, adjacentEnd) };
    expect(() => validate({ ...manifest, paperContextPortions: [basePortion, adjacent] })).not.toThrow();
  });

  it('F-05: computes contract hashes from the contract bytes and binds those bytes to the served contracts', () => {
    // A hash that is not the hash of the supplied bytes is rejected.
    expect(() => validate({ ...manifest, reviewerGuideSha256: hash })).toThrow(/source hash/);
    expect(() => validate({ ...manifest, cohortsSha256: hash })).toThrow(/source hash/);
    // Same parsed contract, different bytes: the manifest hash no longer matches.
    expect(() => validate(manifest, Buffer.concat([guideBytes, Buffer.from('\n')]))).toThrow(/source hash/);
    // Different contract content is rejected even when the manifest carries that content's hash.
    const tamperedGuide = JSON.stringify({ ...JSON.parse(guideBytes.toString('utf8')), sourcePath: 'matrix_research/options_paper/other-release.md' });
    expect(() => validate({ ...manifest, reviewerGuideSha256: sha256Hex(tamperedGuide) }, tamperedGuide)).toThrow(/reviewer guide contract bytes/);
    const tamperedCohorts = JSON.stringify({ ...JSON.parse(cohortBytes.toString('utf8')), status: 'APPROVED' });
    expect(() => validate({ ...manifest, cohortsSha256: sha256Hex(tamperedCohorts) }, guideBytes, tamperedCohorts)).toThrow(/cohorts contract bytes/);
    expect(() => validate(manifest, 'not json')).toThrow(/reviewer guide contract bytes/);
    expect(() => validate(manifest, guideBytes, new Uint8Array([0xff, 0xfe]))).toThrow(/cohorts contract bytes/);
    // The string form of the exact bytes is accepted.
    expect(validate(manifest, guideBytes.toString('utf8'), cohortBytes.toString('utf8'))).toEqual(manifest);
  });
});
