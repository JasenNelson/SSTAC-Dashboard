import 'server-only';

import { createHash } from 'node:crypto';

import {
  getReviewerGuideBinding,
  resolveReviewerGuideAgainstLines,
  reviewerGuideForm,
  validateReviewerGuideContract,
  type ReviewerGuideContract,
} from '../reviewer-guide';
import { getPaperRelease, V0991_PAPER_VERSION } from './releases';

/*
 * The reviewer guide of a release WITH its text, resolved on the server from the
 * release's own verified paper.
 *
 * - Text form (a repository release): the stored contract, checked against the
 *   paper text.
 * - Hash form (a private-storage release): the stored contract holds no text.
 *   Each question's heading and prompt are read from the paper at the question's
 *   source lines, and the SHA-256 of their joined value must equal the bound
 *   `textSha256`. The text therefore exists only in the verified paper and in
 *   what the server hands a guarded page.
 *
 * Any difference throws: a guide is never resolved in part.
 */

export const REVIEWER_GUIDE_FAILURE_PREFIX = 'reviewer guide: ';

/** What a guide is resolved from: the compiled structure's text and the identity it was compiled under. */
interface ReviewerGuideSource {
  readonly content: string;
  readonly manifest: { readonly source: { readonly version: string; readonly sha256: string; readonly bytes?: number } };
}

function fail(reason: string): never {
  throw new Error(`${REVIEWER_GUIDE_FAILURE_PREFIX}${reason}`);
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

/** One resolution per structure object: it lives exactly as long as the structure does. */
const resolvedGuides = new WeakMap<ReviewerGuideSource, ReviewerGuideContract>();

/**
 * The guide of the structure's release, with text. The v0.9.91 structure is a
 * same-source presentation derived only after the full source was authenticated
 * by compileRevisedPaperStructure.
 */
export function resolveReviewerGuide(structure: ReviewerGuideSource): ReviewerGuideContract {
  const cached = resolvedGuides.get(structure);
  if (cached) return cached;
  const release = getPaperRelease(structure.manifest.source.version);
  if (!release) fail('release identity');
  if (structure.manifest.source.sha256 !== release.sha256) fail('paper SHA-256');
  if (release.documentVersion === V0991_PAPER_VERSION) {
    if (structure.manifest.source.bytes !== release.bytes) fail('paper byte length');
    const appendixL = structure.content.match(/^## Appendix L: Phase 2 Project Plan V2 \{#app-l \.chapter\}[ \t]*$/gm) ?? [];
    if (appendixL.length !== 1 || !structure.content.includes('](#app-l)')) fail('Appendix L is missing from the presented paper');
  } else {
    if (structure.manifest.source.bytes !== undefined && structure.manifest.source.bytes !== release.bytes) fail('paper byte length');
    if (Buffer.byteLength(structure.content, 'utf8') !== release.bytes) fail('paper byte length');
    if (sha256Hex(structure.content) !== release.sha256) fail('paper SHA-256');
  }
  if (structure.content.charCodeAt(0) === 0xfeff || structure.content.includes('\r')) fail('paper encoding or line endings');
  let guide: ReviewerGuideContract;
  try {
    const binding = getReviewerGuideBinding(release.documentVersion);
    guide = resolveReviewerGuideAgainstLines(binding, structure.content.split('\n'), sha256Hex);
    // A resolved hash-form guide is a new object: it is validated in its text form and frozen.
    // A text-form guide is the stored contract itself and is returned as it is.
    if (reviewerGuideForm(release) === 'hash') guide = deepFreeze(validateReviewerGuideContract(guide, release.documentVersion));
  } catch (error) {
    fail(error instanceof Error ? error.message : 'unresolved');
  }
  resolvedGuides.set(structure, guide);
  return guide;
}
