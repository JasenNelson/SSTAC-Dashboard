import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { guideOverride } = vi.hoisted(() => ({ guideOverride: { current: null as null | ((guide: unknown) => unknown) } }));

vi.mock('server-only', () => ({}));
vi.mock('../../reviewer-guide', async () => {
  const actual = await vi.importActual<typeof import('../../reviewer-guide')>('../../reviewer-guide');
  return {
    ...actual,
    // Only the successor's stored guide is altered; the predecessor's is always the real one.
    getReviewerGuideBinding: (documentVersion?: string) => {
      const guide = actual.getReviewerGuideBinding(documentVersion);
      return documentVersion === 'v0.9.88-r4-presentation-001' && guideOverride.current ? guideOverride.current(guide) : guide;
    },
  };
});

import { getReviewerGuideContract, normalizeReviewerGuideText, reviewerGuideBoundText } from '../../reviewer-guide';
import type { ReviewerGuideBinding } from '../../reviewer-guide';
import { REVISED_PAPER_VERSION } from '../../revised-paper';
import { R5_PAPER_VERSION } from '../releases';
import { getReviewLineage } from '../review-lineage';

/*
 * Lineage is shown only where the declaration AND the text agree. A guide
 * contract that declares a question identical when its text differs, or
 * changed when its text is identical, makes lineage unavailable for the whole
 * release (the publication route turns that into a reason-coded 404) rather
 * than showing an earlier answer under a different question.
 *
 * The successor's guide is hash form, so "the text" is its bound text hash,
 * compared with the hash of the predecessor's own, public, heading and prompt.
 * No text of the successor is needed, so every case runs everywhere.
 */

const EXACT = 'EXACT_HEADING_AND_PROMPT_TEXT';
const CHANGED = 'MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD';
const predecessorId = (number: number) => `rpq:${REVISED_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
/** The bound value of a predecessor question: the hash of its normalized heading and prompt. */
const predecessorTextSha256 = (number: number): string => sha(reviewerGuideBoundText(normalizeReviewerGuideText(getReviewerGuideContract().questions[number - 1])));

function withQuestion(number: number, patch: Record<string, unknown>) {
  guideOverride.current = (guide) => {
    const contract = guide as ReviewerGuideBinding;
    return { ...contract, questions: contract.questions.map((question) => (question.number === number ? { ...question, ...patch } : question)) };
  };
}

beforeEach(() => {
  guideOverride.current = null;
});

describe('review lineage fails closed when the declaration and the text disagree', () => {
  it('baseline: the real contracts agree, so lineage is available', () => {
    const lineage = getReviewLineage(R5_PAPER_VERSION);
    expect(lineage?.questions).toHaveLength(12);
    expect(lineage?.questions[10].predecessorQuestionId).toBeNull();
    expect(lineage?.questions[0].predecessorQuestionId).toBe(predecessorId(1));
  });

  it('refuses a reworded question declared identical (Q11 would otherwise show an answer to different wording)', () => {
    withQuestion(11, { predecessorEquivalence: EXACT, predecessorQuestionId: predecessorId(11) });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 11');
  });

  it.each([
    ['its bound text hash differs by one digit', { textSha256: predecessorTextSha256(1).replace(/^./, (digit) => (digit === '0' ? '1' : '0')) }],
    ['it binds the text of another question', { textSha256: predecessorTextSha256(2) }],
    ['it binds only the prompt, without the heading', { textSha256: sha(normalizeReviewerGuideText(getReviewerGuideContract().questions[0]).prompt) }],
  ])('refuses a question declared identical when %s', (_name, patch) => {
    withQuestion(1, patch);
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 1');
  });

  it('two-sided: the bound hash of an identical question IS the hash of the predecessor text, and of Q11 it is not', () => {
    withQuestion(1, { textSha256: predecessorTextSha256(1) });
    expect(getReviewLineage(R5_PAPER_VERSION)?.questions[0].predecessorQuestionId).toBe(predecessorId(1));
    // Q11 made identical to its predecessor by hash must then be declared identical.
    withQuestion(11, { textSha256: predecessorTextSha256(11) });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 11');
    withQuestion(11, { textSha256: predecessorTextSha256(11), predecessorEquivalence: EXACT, predecessorQuestionId: predecessorId(11) });
    expect(getReviewLineage(R5_PAPER_VERSION)?.questions[10].predecessorQuestionId).toBe(predecessorId(11));
  });

  it('refuses an identical question declared changed (a carried reference is never silently dropped either)', () => {
    withQuestion(1, { predecessorEquivalence: CHANGED, predecessorQuestionId: null });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 1');
  });

  it('refuses an identical question that names a different predecessor question', () => {
    withQuestion(1, { predecessorQuestionId: predecessorId(2) });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: predecessor question 1');
  });

  it('refuses a question with no declaration at all', () => {
    withQuestion(11, { predecessorEquivalence: undefined });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: equivalence 11');
  });

  it('compares two text-form questions as strings: identical text continues, one changed character does not', () => {
    const predecessor = getReviewerGuideContract().questions[0];
    withQuestion(1, { textSha256: undefined, heading: predecessor.heading, prompt: predecessor.prompt });
    expect(getReviewLineage(R5_PAPER_VERSION)?.questions[0].predecessorQuestionId).toBe(predecessorId(1));
    withQuestion(1, { textSha256: undefined, heading: predecessor.heading, prompt: `${predecessor.prompt} ` });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 1');
    withQuestion(1, { textSha256: undefined, heading: 'On something else', prompt: predecessor.prompt });
    expect(() => getReviewLineage(R5_PAPER_VERSION)).toThrow('Invalid review lineage: declared equivalence disagrees with the question text 1');
  });

  it('is never consulted for the default release, whatever its successor declares', () => {
    withQuestion(11, { predecessorEquivalence: EXACT, predecessorQuestionId: predecessorId(11) });
    expect(getReviewLineage(REVISED_PAPER_VERSION)).toBeNull();
  });
});
