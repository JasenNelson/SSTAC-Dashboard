import cohortContract from './paper/contracts/cohorts-v1.json';

import { getReviewerGuideContract } from './reviewer-guide';

export const COHORT_RELEASE_IDENTITY = '1.0.11-remediated-20260913' as const;
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
  readonly releaseIdentity: typeof COHORT_RELEASE_IDENTITY;
  readonly status: typeof COHORT_STATUS;
  readonly cohorts: readonly CohortContract[];
}

function fail(message: string): never {
  throw new Error(`Invalid cohort contract: ${message}`);
}

export function validateCohortManifest(candidate: unknown): CohortManifest {
  if (!candidate || typeof candidate !== 'object') fail('object');
  const manifest = candidate as CohortManifest;
  if (manifest.schemaVersion !== 'matrix-paper-cohorts-v1') fail('schema version');
  if (manifest.releaseIdentity !== COHORT_RELEASE_IDENTITY || manifest.status !== COHORT_STATUS) fail('release or status');
  const rawCohorts: unknown = (manifest as { readonly cohorts?: unknown }).cohorts;
  if (!Array.isArray(rawCohorts) || rawCohorts.length !== COHORT_IDS.length) fail('cohort count');
  const guide = getReviewerGuideContract();
  const validQuestions = new Set(guide.questions.map((question) => question.number));
  const seen = new Set<number>();
  manifest.cohorts.forEach((cohort, index) => {
    if (cohort.id !== COHORT_IDS[index]) fail(`cohort order ${cohort.id}`);
    if (cohort.questionNumbers.length === 0 || cohort.questionNumbers.some((number) => !validQuestions.has(number))) fail(`questions ${cohort.id}`);
    for (const number of cohort.questionNumbers) {
      if (seen.has(number)) fail(`duplicate question ${number}`);
      seen.add(number);
    }
    if (cohort.guideEvidenceRanges.length !== 1 || cohort.guideEvidenceRanges.some((range) => range.length !== 2 || !Number.isInteger(range[0]) || !Number.isInteger(range[1]) || range[0] < 1 || range[0] > range[1])) fail(`guide evidence ranges ${cohort.id}`);
    const questionLines = cohort.questionNumbers.flatMap((number) => guide.questions[number - 1].sourceLines);
    const range = cohort.guideEvidenceRanges[0];
    if (range[0] > Math.min(...questionLines) || range[1] < Math.max(...questionLines)) fail(`guide evidence coverage ${cohort.id}`);
    if (!cohort.purpose || cohort.sourceLocators.length === 0 || cohort.packageContents.length === 0 || !cohort.limitations) fail(`incomplete ${cohort.id}`);
  });
  if (seen.size !== validQuestions.size) fail('question omission');
  return manifest;
}

export function getCohortManifest(): CohortManifest {
  return validateCohortManifest(cohortContract);
}
