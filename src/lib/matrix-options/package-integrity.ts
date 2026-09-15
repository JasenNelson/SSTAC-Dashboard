import { createHash } from 'node:crypto';

import { COHORT_IDS, getCohortManifest } from './cohort-contract';
import { getReviewerGuideContract } from './reviewer-guide';

export const PACKAGE_STATUS = 'REVIEW_READY_NOT_GREEN' as const;

export interface PaperContextPortion {
  readonly id: string;
  readonly cohortId: string;
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly sectionLabel: string;
  readonly status: 'available' | 'unavailable';
  readonly sourceNodeId?: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly text?: string;
}

export interface PackageManifest {
  readonly schemaVersion: 'matrix-review-package-v1';
  readonly releaseIdentity: string;
  readonly cohortId: string;
  readonly status: typeof PACKAGE_STATUS;
  readonly paperSha256: string;
  readonly paperBytes: number;
  readonly reviewerGuideSha256: string;
  readonly cohortsSha256: string;
  readonly paperContextPortions: readonly PaperContextPortion[];
  readonly artifacts: Readonly<Record<'review-package.pdf' | 'review-package.docx', string>>;
}

function fail(message: string): never {
  throw new Error(`Invalid package manifest: ${message}`);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validatePackageManifest(
  manifest: PackageManifest,
  expectedReleaseIdentity: string,
  expectedCohortId: string,
  expectedPaperSha256: string,
  expectedReviewerGuideSha256: string,
  expectedCohortsSha256: string,
  expectedPaperText: string,
): PackageManifest {
  getReviewerGuideContract();
  getCohortManifest();
  if (manifest.schemaVersion !== 'matrix-review-package-v1') fail('schema version');
  if (manifest.releaseIdentity !== expectedReleaseIdentity) fail('release identity');
  if (!COHORT_IDS.includes(manifest.cohortId as typeof COHORT_IDS[number]) || manifest.cohortId !== expectedCohortId) fail('cohort identity');
  if (manifest.status !== PACKAGE_STATUS) fail('draft status');
  if (manifest.paperSha256 !== expectedPaperSha256 || manifest.reviewerGuideSha256 !== expectedReviewerGuideSha256 || manifest.cohortsSha256 !== expectedCohortsSha256) fail('source hash');
  const paperBytes = new TextEncoder().encode(expectedPaperText);
  if (manifest.paperBytes !== paperBytes.byteLength || sha256Hex(paperBytes) !== expectedPaperSha256) fail('authenticated paper bytes');
  let decodedPaper: string;
  try { decodedPaper = new TextDecoder('utf-8', { fatal: true }).decode(paperBytes); } catch { fail('paper UTF-8'); }
  if (decodedPaper !== expectedPaperText || !Array.isArray(manifest.paperContextPortions) || manifest.paperContextPortions.length === 0) fail('paper context portions');
  for (const portion of manifest.paperContextPortions) {
    if (!portion || !portion.id || !portion.cohortId || !/^\d+(?:\.\d+)*$/.test(portion.sectionNumber) || !portion.sourceLocator || !portion.sectionLabel) fail('paper context identity');
    if (portion.status === 'unavailable') {
      if (portion.text !== undefined || portion.startByte !== undefined || portion.endByte !== undefined || portion.sourceNodeId !== undefined) fail('unavailable paper context payload');
      continue;
    }
    if (portion.status !== 'available' || !portion.sourceNodeId || !Number.isInteger(portion.startByte) || !Number.isInteger(portion.endByte) || portion.startByte < 0 || portion.endByte <= portion.startByte || portion.endByte > paperBytes.byteLength || !portion.text?.trim()) fail('available paper context shape');
    if (portion.startByte === 0 && portion.endByte === paperBytes.byteLength) fail('full paper context fallback');
    const actual = new TextDecoder('utf-8', { fatal: true }).decode(paperBytes.slice(portion.startByte, portion.endByte));
    if (actual !== portion.text) fail('authenticated paper context range');
  }
  for (const name of ['review-package.pdf', 'review-package.docx'] as const) {
    if (!/^[a-f0-9]{64}$/.test(manifest.artifacts[name])) fail(`artifact hash ${name}`);
  }
  return manifest;
}
