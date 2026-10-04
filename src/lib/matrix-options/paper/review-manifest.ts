import 'server-only';

import { canonicalJson, sha256Object } from './contracts';
import { getPaperRelease, type PaperReleaseVersion } from './releases';
import { getCohortManifest } from '../cohort-contract';
import { getReviewerGuideBinding } from '../reviewer-guide';
import { REVISED_PAPER_VERSION } from '../revised-paper';

export const REVIEW_MANIFEST_SCHEMA_VERSION = 'matrix-paper-review-manifest-v1' as const;

export interface ReviewManifest {
  readonly schemaVersion: typeof REVIEW_MANIFEST_SCHEMA_VERSION;
  readonly documentVersion: PaperReleaseVersion;
  readonly paperSha256: string;
  readonly reviewerGuideReleaseIdentity: PaperReleaseVersion;
  readonly cohortsReleaseIdentity: PaperReleaseVersion;
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
 * Recomputes the review identity of ONE bound release from that release and
 * its two validated review contracts. The digest is over canonical JSON, so
 * callers never trust a checked-in or client-supplied manifest hash.
 *
 * The guide is hashed AS STORED (reviewer-guide.ts ReviewerGuideBinding): with
 * its text for a text-form release, with its text hashes for a hash-form one.
 * Either way a change to a question's wording changes the digest.
 *
 * With no argument this is the DEFAULT release, whose digest is the one the
 * persisted review rows are keyed on; it does not change when another release
 * is bound. Each release has its own manifest, so a response is always written
 * and read under the exact release it answers.
 */
export function getReviewManifest(documentVersion: string = REVISED_PAPER_VERSION): ReviewManifest {
  const release = getPaperRelease(documentVersion);
  if (!release) throw new Error(`Unknown paper release for review manifest: ${documentVersion}`);
  const guide = getReviewerGuideBinding(release.documentVersion);
  const cohorts = getCohortManifest(release.documentVersion);
  const reviewerGuideSha256 = sha256Object(guide);
  const cohortsSha256 = sha256Object(cohorts);
  const questionByNumber = new Map(guide.questions.map((question) => [question.number, question.id]));
  const cohortQuestionIds = Object.fromEntries(cohorts.cohorts.map((cohort) => [
    cohort.id,
    cohort.questionNumbers.map((number) => questionByNumber.get(number)).filter((id): id is string => Boolean(id)),
  ]));
  const identity = {
    schemaVersion: REVIEW_MANIFEST_SCHEMA_VERSION,
    documentVersion: release.documentVersion,
    paperSha256: release.sha256,
    reviewerGuideReleaseIdentity: guide.releaseIdentity,
    cohortsReleaseIdentity: cohorts.releaseIdentity,
    reviewerGuideSha256,
    cohortsSha256,
    questionIds: guide.questions.map((question) => question.id),
    cohortQuestionIds,
  } as const;
  return { ...identity, sha256: computeReviewManifestSha256(identity) };
}

/** The bound release whose review manifest is exactly this (version, digest) pair, or null. */
export function findReviewManifest(documentVersion: string | null | undefined, manifestSha256: string | null | undefined): ReviewManifest | null {
  if (!documentVersion || !manifestSha256 || !getPaperRelease(documentVersion)) return null;
  const manifest = getReviewManifest(documentVersion);
  return manifest.sha256 === manifestSha256 ? manifest : null;
}

export function reviewManifestCanonicalBytes(identity: ReviewManifestIdentity): string {
  return canonicalJson(identity);
}
