import { createHash } from 'node:crypto';

import { COHORT_IDS, getCohortManifest } from './cohort-contract';
import { getReviewerGuideContract } from './reviewer-guide';

export const PACKAGE_STATUS = 'REVIEW_READY_NOT_GREEN' as const;
export const PACKAGE_ARTIFACT_NAMES = ['review-package.docx', 'review-package.pdf'] as const;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * The sha256 of the exact contract bytes, accepted only when those bytes parse
 * to the same contract the application validates and serves (F-05). The hash
 * is computed here from the bytes; a caller-supplied hash is never trusted.
 */
function contractBytesSha256(bytes: Uint8Array | string, loaded: unknown, label: string): string {
  const encoded = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(encoded));
  } catch {
    fail(`${label} contract bytes`);
  }
  if (JSON.stringify(parsed) !== JSON.stringify(loaded)) fail(`${label} contract bytes`);
  return sha256Hex(encoded);
}

export function validatePackageManifest(
  candidate: unknown,
  expectedReleaseIdentity: string,
  expectedCohortId: string,
  expectedPaperSha256: string,
  reviewerGuideContractBytes: Uint8Array | string,
  cohortsContractBytes: Uint8Array | string,
  expectedPaperText: string,
): PackageManifest {
  const guide = getReviewerGuideContract();
  const cohorts = getCohortManifest();
  if (!isRecord(candidate)) fail('object');
  const manifest = candidate as unknown as PackageManifest;
  if (manifest.schemaVersion !== 'matrix-review-package-v1') fail('schema version');
  if (manifest.releaseIdentity !== expectedReleaseIdentity) fail('release identity');
  if (!COHORT_IDS.includes(manifest.cohortId as typeof COHORT_IDS[number]) || manifest.cohortId !== expectedCohortId) fail('cohort identity');
  if (manifest.status !== PACKAGE_STATUS) fail('draft status');
  const reviewerGuideSha256 = contractBytesSha256(reviewerGuideContractBytes, guide, 'reviewer guide');
  const cohortsSha256 = contractBytesSha256(cohortsContractBytes, cohorts, 'cohorts');
  if (manifest.paperSha256 !== expectedPaperSha256 || manifest.reviewerGuideSha256 !== reviewerGuideSha256 || manifest.cohortsSha256 !== cohortsSha256) fail('source hash');
  const paperBytes = new TextEncoder().encode(expectedPaperText);
  if (manifest.paperBytes !== paperBytes.byteLength || sha256Hex(paperBytes) !== expectedPaperSha256) fail('authenticated paper bytes');
  let decodedPaper: string;
  try { decodedPaper = new TextDecoder('utf-8', { fatal: true }).decode(paperBytes); } catch { fail('paper UTF-8'); }
  if (decodedPaper !== expectedPaperText || !Array.isArray(manifest.paperContextPortions) || manifest.paperContextPortions.length === 0) fail('paper context portions');
  const portionIds = new Set<string>();
  const availableRanges: [number, number][] = [];
  for (const rawPortion of manifest.paperContextPortions as readonly unknown[]) {
    if (!isRecord(rawPortion)) fail('paper context identity');
    const portion = rawPortion as unknown as PaperContextPortion;
    if (typeof portion.id !== 'string' || !portion.id || typeof portion.cohortId !== 'string' || !portion.cohortId || typeof portion.sectionNumber !== 'string' || !/^\d+(?:\.\d+)*$/.test(portion.sectionNumber) || typeof portion.sourceLocator !== 'string' || !portion.sourceLocator || typeof portion.sectionLabel !== 'string' || !portion.sectionLabel) fail('paper context identity');
    if (portionIds.has(portion.id)) fail('duplicate paper context id');
    portionIds.add(portion.id);
    if (portion.cohortId !== manifest.cohortId) fail('paper context cohort');
    if (portion.status === 'unavailable') {
      if (portion.text !== undefined || portion.startByte !== undefined || portion.endByte !== undefined || portion.sourceNodeId !== undefined) fail('unavailable paper context payload');
      continue;
    }
    const { startByte, endByte } = portion;
    if (portion.status !== 'available' || !portion.sourceNodeId || typeof startByte !== 'number' || typeof endByte !== 'number' || !Number.isInteger(startByte) || !Number.isInteger(endByte) || startByte < 0 || endByte <= startByte || endByte > paperBytes.byteLength || typeof portion.text !== 'string' || !portion.text.trim()) fail('available paper context shape');
    if (startByte === 0 && endByte === paperBytes.byteLength) fail('full paper context fallback');
    const actual = new TextDecoder('utf-8', { fatal: true }).decode(paperBytes.slice(startByte, endByte));
    if (actual !== portion.text) fail('authenticated paper context range');
    availableRanges.push([startByte, endByte]);
  }
  availableRanges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let index = 1; index < availableRanges.length; index += 1) {
    if (availableRanges[index][0] < availableRanges[index - 1][1]) fail('overlapping paper context ranges');
  }
  const artifacts: unknown = manifest.artifacts;
  if (!isRecord(artifacts)) fail('artifacts');
  if (JSON.stringify(Object.keys(artifacts).sort()) !== JSON.stringify([...PACKAGE_ARTIFACT_NAMES])) fail('artifact keys');
  for (const name of PACKAGE_ARTIFACT_NAMES) {
    const value = artifacts[name];
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail(`artifact hash ${name}`);
  }
  return manifest;
}
