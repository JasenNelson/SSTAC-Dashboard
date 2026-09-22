import 'server-only';

import { canonicalJson, sha256Object } from './contracts';
import { COHORT_RELEASE_IDENTITY, getCohortManifest } from '../cohort-contract';
import { getReviewerGuideContract, REVIEW_GUIDE_RELEASE_IDENTITY } from '../reviewer-guide';
import { REVISED_PAPER_SHA256, REVISED_PAPER_VERSION } from '../revised-paper';

export const REVIEW_MANIFEST_SCHEMA_VERSION = 'matrix-paper-review-manifest-v1' as const;

export interface ReviewManifest {
  readonly schemaVersion: typeof REVIEW_MANIFEST_SCHEMA_VERSION;
  readonly documentVersion: typeof REVISED_PAPER_VERSION;
  readonly paperSha256: typeof REVISED_PAPER_SHA256;
  readonly reviewerGuideReleaseIdentity: typeof REVIEW_GUIDE_RELEASE_IDENTITY;
  readonly cohortsReleaseIdentity: typeof COHORT_RELEASE_IDENTITY;
  readonly reviewerGuideSha256: string;
  readonly cohortsSha256: string;
  readonly questionIds: readonly string[];
  readonly cohortQuestionIds: Readonly<Record<string, readonly string[]>>;
  readonly sha256: string;
}

export type ReviewManifestIdentity = Omit<ReviewManifest, 'sha256' | 'paperSha256'> & { readonly paperSha256: string };

export function computeReviewManifestSha256(identity: ReviewManifestIdentity): string {
  return sha256Object(identity);
}

/**
 * Recomputes the review identity from the authoritative release and the two
 * validated review contracts. The digest is over canonical JSON, so callers
 * never trust a checked-in or client-supplied manifest hash.
 */
export function getReviewManifest(): ReviewManifest {
  const guide = getReviewerGuideContract();
  const cohorts = getCohortManifest();
  const reviewerGuideSha256 = sha256Object(guide);
  const cohortsSha256 = sha256Object(cohorts);
  const questionByNumber = new Map(guide.questions.map((question) => [question.number, question.id]));
  const cohortQuestionIds = Object.fromEntries(cohorts.cohorts.map((cohort) => [
    cohort.id,
    cohort.questionNumbers.map((number) => questionByNumber.get(number)).filter((id): id is string => Boolean(id)),
  ]));
  const identity = {
    schemaVersion: REVIEW_MANIFEST_SCHEMA_VERSION,
    documentVersion: REVISED_PAPER_VERSION,
    paperSha256: REVISED_PAPER_SHA256,
    reviewerGuideReleaseIdentity: REVIEW_GUIDE_RELEASE_IDENTITY,
    cohortsReleaseIdentity: COHORT_RELEASE_IDENTITY,
    reviewerGuideSha256,
    cohortsSha256,
    questionIds: guide.questions.map((question) => question.id),
    cohortQuestionIds,
  } as const;
  return { ...identity, sha256: computeReviewManifestSha256(identity) };
}

export function reviewManifestCanonicalBytes(identity: ReviewManifestIdentity): string {
  return canonicalJson(identity);
}
