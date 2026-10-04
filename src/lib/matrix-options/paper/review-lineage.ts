import 'server-only';

import { createHash } from 'node:crypto';

import { getReviewerGuideBinding, normalizeReviewerGuideText, reviewerGuideBoundText } from '../reviewer-guide';
import type { ReviewerGuideBoundQuestion, ReviewQuestionEquivalence } from '../reviewer-guide';
import { getPaperRelease } from './releases';

/*
 * Read-only review lineage between a release and its predecessor.
 *
 * Responses are version-bound: a response answers one question of one release
 * and is stored under that release's own review manifest. Nothing here copies,
 * re-keys or rewrites a response. Lineage only says which question of the
 * predecessor a successor question continues, so the reader can be SHOWN their
 * earlier answer beside the successor's empty editor.
 *
 * A successor question continues a predecessor question only when BOTH hold:
 * the successor's guide contract declares EXACT_HEADING_AND_PROMPT_TEXT, and
 * the two questions have the same heading and prompt. Two text-form questions
 * are compared as strings. Where either guide is hash form (reviewer-guide.ts)
 * the comparison is by the bound value: the SHA-256 of a question's normalized
 * heading and prompt, which a hash-form question stores as `textSha256` and a
 * text-form question yields from its own text. A declaration that disagrees with
 * the text fails closed in either direction, so lineage can never be shown for a
 * question whose wording changed, and a question declared changed is never
 * silently treated as the same question.
 *
 * Server-only (node crypto). Client code imports the types alone.
 */

export interface ReviewLineageQuestion {
  readonly number: number;
  readonly questionId: string;
  readonly equivalence: ReviewQuestionEquivalence;
  /** The predecessor question this one continues; null when the question changed. */
  readonly predecessorQuestionId: string | null;
}

export interface ReviewLineage {
  readonly documentVersion: string;
  readonly predecessorVersion: string;
  readonly questions: readonly ReviewLineageQuestion[];
}

function fail(message: string): never {
  throw new Error(`Invalid review lineage: ${message}`);
}

/** The bound value of a question's text: stored for a hash-form question, computed for a text-form one. */
function boundTextSha256(question: ReviewerGuideBoundQuestion): string {
  if (question.textSha256 !== undefined) return question.textSha256;
  return createHash('sha256').update(reviewerGuideBoundText(normalizeReviewerGuideText(question)), 'utf8').digest('hex');
}

function sameText(earlier: ReviewerGuideBoundQuestion, question: ReviewerGuideBoundQuestion): boolean {
  if (earlier.textSha256 === undefined && question.textSha256 === undefined) return earlier.heading === question.heading && earlier.prompt === question.prompt;
  return boundTextSha256(earlier) === boundTextSha256(question);
}

/** The lineage of a release, or null for a release with no predecessor (the default release). */
export function getReviewLineage(documentVersion: string): ReviewLineage | null {
  const release = getPaperRelease(documentVersion);
  if (!release || release.predecessorVersion === null) return null;
  const guide = getReviewerGuideBinding(release.documentVersion);
  const predecessor = getReviewerGuideBinding(release.predecessorVersion);
  const questions = guide.questions.map((question): ReviewLineageQuestion => {
    const earlier = predecessor.questions.find((candidate) => candidate.number === question.number);
    const identical = earlier !== undefined && sameText(earlier, question);
    const declaredExact = question.predecessorEquivalence === 'EXACT_HEADING_AND_PROMPT_TEXT';
    if (declaredExact !== identical) fail(`declared equivalence disagrees with the question text ${question.number}`);
    if (!question.predecessorEquivalence) fail(`equivalence ${question.number}`);
    if (declaredExact && (!earlier || question.predecessorQuestionId !== earlier.id)) fail(`predecessor question ${question.number}`);
    return Object.freeze({
      number: question.number,
      questionId: question.id,
      equivalence: question.predecessorEquivalence,
      predecessorQuestionId: declaredExact && earlier ? earlier.id : null,
    });
  });
  return Object.freeze({ documentVersion: release.documentVersion, predecessorVersion: release.predecessorVersion, questions: Object.freeze(questions) });
}

/** What the review panel needs to show lineage: the predecessor's identity and the question map. */
export interface ReviewLineageView {
  readonly predecessorVersion: string;
  /** The predecessor's own review manifest digest: its rows are read under it, unchanged. */
  readonly predecessorManifestSha256: string;
  /** Successor question id -> the predecessor question it continues, or null when it changed. */
  readonly predecessorQuestionIds: Readonly<Record<string, string | null>>;
}

export function reviewLineageView(lineage: ReviewLineage, predecessorManifestSha256: string): ReviewLineageView {
  return Object.freeze({
    predecessorVersion: lineage.predecessorVersion,
    predecessorManifestSha256,
    predecessorQuestionIds: Object.freeze(Object.fromEntries(lineage.questions.map((question) => [question.questionId, question.predecessorQuestionId]))),
  });
}
