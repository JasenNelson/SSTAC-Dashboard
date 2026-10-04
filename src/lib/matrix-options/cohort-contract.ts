import cohortContract from './paper/contracts/cohorts-v1.json';
import r5CohortContract from './paper/contracts/cohorts-v0.9.88-r4-presentation-001.json';
import v0991CohortContract from './paper/contracts/cohorts-v0.9.91-run109-001.json';

import { getPaperRelease, R5_PAPER_VERSION, V0991_PAPER_VERSION, type PaperReleaseVersion } from './paper/releases';
import { getReviewerGuideBinding, hasExactlyKeys } from './reviewer-guide';

/** The DEFAULT release's cohort identity; every caller that names no version gets these cohorts. */
export const COHORT_RELEASE_IDENTITY = '1.0.11-remediated-7-8-successor-20260918-D' as const;
export const COHORT_STATUS = 'PROPOSED_PENDING_OWNER_QP_APPROVAL' as const;
export const COHORT_IDS = ['categories', 'pathway-grid', 'exposure-assumptions', 'inputs-evidence', 'methods-water-type'] as const;

export type CohortId = typeof COHORT_IDS[number];

export interface CohortContract {
  readonly id: CohortId;
  readonly name: string;
  readonly questionNumbers: readonly number[];
  readonly sourceLocators: readonly string[];
  readonly guideEvidenceRanges: readonly (readonly [number, number])[];
  readonly purpose: string;
  readonly packageContents: readonly string[];
  readonly limitations: string;
}

export interface CohortManifest {
  readonly schemaVersion: 'matrix-paper-cohorts-v1';
  readonly releaseIdentity: PaperReleaseVersion;
  readonly status: typeof COHORT_STATUS;
  readonly cohorts: readonly CohortContract[];
}

const SUCCESSOR_MANIFEST_KEYS = ['schemaVersion', 'releaseIdentity', 'status', 'cohorts'] as const;
const SUCCESSOR_COHORT_KEYS = ['id', 'name', 'questionNumbers', 'sourceLocators', 'guideEvidenceRanges', 'purpose', 'packageContents', 'limitations'] as const;
const GUIDE_LOCATOR_PREFIX = /^Reviewer'?s Guide/i;
const GUIDE_LOCATOR = /^Reviewer's Guide lines (\d{1,5})-(\d{1,5})$/;

function fail(message: string): never {
  throw new Error(`Invalid cohort contract: ${message}`);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonBlankTrimmedString(value: unknown): value is string {
  return isNonBlankString(value) && value === value.trim();
}

function isNonBlankStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonBlankString);
}

/**
 * Validates a cohort manifest for one bound release (the default release when
 * none is named) against THAT release's reviewer guide: question membership,
 * guide line coverage and locator ranges are all checked against the same
 * release, never across releases.
 */
export function validateCohortManifest(candidate: unknown, releaseIdentity: string = COHORT_RELEASE_IDENTITY): CohortManifest {
  if (!candidate || typeof candidate !== 'object') fail('object');
  const manifest = candidate as CohortManifest;
  const release = getPaperRelease(releaseIdentity);
  if (manifest.schemaVersion !== 'matrix-paper-cohorts-v1') fail('schema version');
  if (!release || manifest.releaseIdentity !== release.documentVersion || manifest.status !== COHORT_STATUS) fail('release or status');
  const rawCohorts: unknown = (manifest as { readonly cohorts?: unknown }).cohorts;
  if (!Array.isArray(rawCohorts) || rawCohorts.length !== COHORT_IDS.length) fail('cohort count');
  // A successor's cohort contract is CLOSED, for the same reason as its guide contract
  // (reviewer-guide.ts): it is hashed whole into the review manifest digest, so it carries
  // only fields this validator checks.
  if (release.predecessorVersion !== null) {
    if (!hasExactlyKeys(manifest, SUCCESSOR_MANIFEST_KEYS)) fail('unverified field');
    if ((rawCohorts as readonly unknown[]).some((cohort) => !hasExactlyKeys(cohort, SUCCESSOR_COHORT_KEYS))) fail('unverified cohort field');
  }
  // Question numbers and source lines only: the stored guide has them in either form.
  const guide = getReviewerGuideBinding(release.documentVersion);
  const validQuestions = new Set(guide.questions.map((question) => question.number));
  const seen = new Set<number>();
  const seenCohortIds = new Set<string>();
  (rawCohorts as readonly unknown[]).forEach((rawCohort, index) => {
    if (!rawCohort || typeof rawCohort !== 'object') fail(`cohort shape ${index}`);
    const cohort = rawCohort as CohortContract;
    if (seenCohortIds.has(cohort.id)) fail(`duplicate cohort ${cohort.id}`);
    seenCohortIds.add(cohort.id);
    if (cohort.id !== COHORT_IDS[index]) fail(`cohort order ${cohort.id}`);
    if (!isNonBlankTrimmedString(cohort.name)) fail(`name ${cohort.id}`);
    if (!Array.isArray(cohort.questionNumbers) || cohort.questionNumbers.length === 0 || cohort.questionNumbers.some((number) => !validQuestions.has(number))) fail(`questions ${cohort.id}`);
    for (const number of cohort.questionNumbers) {
      if (seen.has(number)) fail(`duplicate question ${number}`);
      seen.add(number);
    }
    const ranges: unknown = cohort.guideEvidenceRanges;
    if (!Array.isArray(ranges) || ranges.length === 0 || ranges.some((range) => !Array.isArray(range) || range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < 1 || range[0] > range[1])) fail(`guide evidence ranges ${cohort.id}`);
    const sortedRanges = [...cohort.guideEvidenceRanges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let rangeIndex = 1; rangeIndex < sortedRanges.length; rangeIndex += 1) {
      if (sortedRanges[rangeIndex][0] <= sortedRanges[rangeIndex - 1][1]) fail(`overlapping guide evidence ranges ${cohort.id}`);
    }
    for (const number of cohort.questionNumbers) {
      const [start, end] = guide.questions[number - 1].sourceLines;
      if (!cohort.guideEvidenceRanges.some((range) => range[0] <= start && range[1] >= end)) fail(`guide evidence coverage ${cohort.id}`);
    }
    if (!isNonBlankString(cohort.purpose) || !isNonBlankString(cohort.limitations) || !isNonBlankStringList(cohort.sourceLocators) || !isNonBlankStringList(cohort.packageContents)) fail(`incomplete ${cohort.id}`);
    // F-05: every "Reviewer's Guide lines a-b" locator names exactly one guide
    // evidence range, and every range has exactly one such locator.
    const locatorRanges = cohort.sourceLocators.filter((locator) => GUIDE_LOCATOR_PREFIX.test(locator)).map((locator) => {
      const match = GUIDE_LOCATOR.exec(locator);
      if (!match) fail(`guide locator ${cohort.id}`);
      return `${Number(match[1])}-${Number(match[2])}`;
    });
    const rangeKeys = cohort.guideEvidenceRanges.map((range) => `${range[0]}-${range[1]}`);
    if (locatorRanges.length !== rangeKeys.length || [...locatorRanges].sort().join(',') !== [...rangeKeys].sort().join(',')) fail(`guide locator ranges ${cohort.id}`);
  });
  if (seen.size !== validQuestions.size) fail('question omission');
  return manifest;
}

/** The validated cohorts of one bound release; the default release when no version is given. */
export function getCohortManifest(documentVersion: string = COHORT_RELEASE_IDENTITY): CohortManifest {
  if (documentVersion === COHORT_RELEASE_IDENTITY) return validateCohortManifest(cohortContract, COHORT_RELEASE_IDENTITY);
  if (documentVersion === R5_PAPER_VERSION) return validateCohortManifest(r5CohortContract, R5_PAPER_VERSION);
  if (documentVersion === V0991_PAPER_VERSION) return validateCohortManifest(v0991CohortContract, V0991_PAPER_VERSION);
  fail('release or status');
}
