import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import r5FiguresContract from '../contracts/accepted-figures-v0.9.88-r4-presentation-001.json';
import r5CohortContract from '../contracts/cohorts-v0.9.88-r4-presentation-001.json';
import predecessorCohortContract from '../contracts/cohorts-v1.json';
import r5GuideContract from '../contracts/reviewer-guide-v0.9.88-r4-presentation-001.json';
import predecessorGuideContract from '../contracts/reviewer-guide-v1.json';
import { getCohortManifest, validateCohortManifest } from '../../cohort-contract';
import {
  authenticateReviewerGuideAgainstPaper,
  getReviewerGuideBinding,
  getReviewerGuideContract,
  normalizeReviewerGuideText,
  reviewerGuideBoundText,
  reviewerGuideForm,
  validateReviewerGuideBinding,
  validateReviewerGuideContract,
} from '../../reviewer-guide';
import type { ReviewerGuideContract } from '../../reviewer-guide';
import { loadRevisedPaper, REVISED_PAPER_VERSION } from '../../revised-paper';
import { loadRevisedPaperStructure } from '../../revised-paper-structure';
import { getPaperNavOutline, getPaperStableSectionIds, resolveLegacySectionAnchor } from '@/components/matrix-options/paper/PaperDocument';
import { deriveCohortPortions, sectionNumberFromHeading } from '../cohort-portions';
import { buildLegacyAnchorMap } from '../full-document';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { getReviewLineage, reviewLineageView } from '../review-lineage';
import { findReviewManifest, getReviewManifest } from '../review-manifest';
import { buildReviewNavigation } from '../review-navigation';
import { REVIEWER_GUIDE_FAILURE_PREFIX, resolveReviewerGuide } from '../reviewer-guide-server';
import { describePrivate, readPrivatePresentation } from './private-fixture';
import { privateR5Structure } from './private-structure';

/*
 * Unit 3: version-safe review behaviour.
 *
 * R5 has its own reviewer guide, cohorts and review manifest. The predecessor's
 * contracts and its persisted manifest digest are untouched. Lineage is read
 * only: Q1-Q10 and Q12 continue the predecessor question with identical text;
 * Q11 changed and continues nothing.
 *
 * R5 is a private-storage release, so its guide is stored in HASH form: no
 * question text of it is in the repository. What the contracts bind is checked
 * here without any of that text (ids, lines, anchors and hashes, and lineage by
 * hash against the predecessor's public text). What needs the artifact itself is
 * a `describePrivate` suite.
 */

const PREDECESSOR_MANIFEST_SHA256 = '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e';
const R5_MANIFEST_SHA256 = 'c0e99115f042cdeb193da10cbe31ea2d2b442c119c7c07b1b11b260ec7d4e2aa';
const EXACT = 'EXACT_HEADING_AND_PROMPT_TEXT';
const CHANGED = 'MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD';
const SHA256_HEX = /^[0-9a-f]{64}$/;
const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const r5Guide = getReviewerGuideBinding(R5_PAPER_VERSION);
const withQuestion = (index: number, patch: Record<string, unknown>) => ({ ...r5GuideContract, questions: r5GuideContract.questions.map((question, position) => (position === index ? { ...question, ...patch } : question)) });

/** Every string VALUE anywhere inside `value` (keys are checked separately, as closed key sets). */
function stringValues(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value);
  else if (Array.isArray(value)) for (const entry of value) stringValues(entry, into);
  else if (value && typeof value === 'object') for (const entry of Object.values(value as Record<string, unknown>)) stringValues(entry, into);
  return into;
}

/** The only kinds of string a hash-form contract may hold. Anything else could be text of the release. */
const CONTRACT_STRING_KINDS: readonly RegExp[] = [
  SHA256_HEX,
  /^matrix-paper-(?:reviewer-guide|accepted-figures)-v1$/,
  /^(?:v0\.9\.88-r4-presentation-001|1\.0\.11-remediated-7-8-successor-20260918-D)$/,
  /^presentation:v0\.9\.88-r4-presentation-001$/,
  /^rpq:(?:v0\.9\.88-r4-presentation-001|1\.0\.11-remediated-7-8-successor-20260918-D):q[0-9]{2}$/,
  /^(?:sec|app)-[a-z0-9-]+$/,
  /^[0-9A-Z]+-[0-9]+$/,
  /^FIG[0-9A-Z-]+(?:\.png)?$/,
  /^(?:registry|overlay-correction|primary|secondary)$/,
  /^(?:EXACT_HEADING_AND_PROMPT_TEXT|MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD)$/,
];
const textBearing = (value: unknown): string[] => stringValues(value).filter((entry) => !CONTRACT_STRING_KINDS.some((kind) => kind.test(entry)));

describe('R5 contracts hold no text of the release', () => {
  it('the guide contract has a closed key set and every string in it is an id, a version, a label, an anchor, an enumeration value or a hash', () => {
    expect(Object.keys(r5GuideContract)).toEqual(['schemaVersion', 'releaseIdentity', 'sourcePath', 'predecessorReleaseIdentity', 'questions']);
    for (const question of r5GuideContract.questions) expect(Object.keys(question)).toEqual(['number', 'id', 'sourceLines', 'textSha256', 'sectionAnchors', 'predecessorEquivalence', 'predecessorQuestionId']);
    expect(textBearing(r5GuideContract)).toEqual([]);
    expect(stringValues(r5GuideContract).length).toBeGreaterThan(40);
  });

  it('the figures contract has a closed key set and every string in it is an id, a version, a file name, an anchor, an enumeration value or a hash', () => {
    expect(Object.keys(r5FiguresContract)).toEqual(['schemaVersion', 'releaseIdentity', 'paperSha256', 'sources', 'assets', 'placements']);
    expect(Object.keys(r5FiguresContract.sources)).toEqual(['candidateManifestSha256', 'placementRegistrySha256', 'interfaceOverlaySha256']);
    for (const asset of r5FiguresContract.assets) expect(Object.keys(asset)).toEqual(['id', 'file', 'sha256', 'bytes', 'width', 'height', 'placementIds']);
    for (const placement of r5FiguresContract.placements) expect(Object.keys(placement)).toEqual(['figureId', 'assetId', 'textSha256', 'sectionAnchor', 'anchorSource', 'role', 'markerLine']);
    expect(textBearing(r5FiguresContract)).toEqual([]);
    expect(stringValues(r5FiguresContract).length).toBeGreaterThan(150);
  });

  it('the check can fail: a heading, a prompt, a caption or a status would be reported', () => {
    for (const text of ['On a topic', 'A sentence that asks something?', 'Figure 1-1. A caption.', 'SOME_STATUS', 'STATUS_ONE; STATUS_TWO', 'candidate/paper/some-file.md']) {
      expect(textBearing({ questions: [{ heading: text }] })).toEqual([text]);
    }
    // The predecessor's text-form guide is reported in full: its headings and prompts are text.
    expect(textBearing(predecessorGuideContract).length).toBeGreaterThanOrEqual(24);
  });
});

describe('R5 reviewer guide (hash form)', () => {
  it('carries the twelve overlay questions with R5 ids, source lines, anchors and one text hash each', () => {
    expect(r5Guide.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(r5Guide.sourcePath).toBe(`presentation:${R5_PAPER_VERSION}`);
    expect(r5Guide.questions.map((question) => question.id)).toEqual(Array.from({ length: 12 }, (_, index) => `rpq:${R5_PAPER_VERSION}:q${String(index + 1).padStart(2, '0')}`));
    expect(r5Guide.questions.map((question) => question.sourceLines)).toEqual([[127, 128], [129, 129], [130, 131], [135, 136], [137, 138], [142, 143], [144, 145], [149, 150], [151, 152], [156, 157], [161, 161], [165, 167]]);
    expect(r5Guide.questions.map((question) => question.sectionAnchors)).toEqual([
      ['sec-4-1'], ['sec-4-1'], ['sec-4-1'], ['sec-4-1', 'sec-6-0'], ['sec-4-1', 'sec-6-0'], ['sec-7-5', 'sec-7-8'], ['sec-7-5', 'sec-7-8'], ['sec-7-8'], ['sec-7-8'], ['sec-6-0', 'sec-7-5'], ['sec-4-4'], ['sec-7-7', 'sec-7-8'],
    ]);
    expect(r5Guide.questions.every((question) => typeof question.textSha256 === 'string' && SHA256_HEX.test(question.textSha256))).toBe(true);
    expect(new Set(r5Guide.questions.map((question) => question.textSha256)).size).toBe(12);
    expect(r5Guide.questions.some((question) => 'heading' in question || 'prompt' in question)).toBe(false);
  });

  it('is hash form because the release is private-storage; the default release is text form', () => {
    expect(reviewerGuideForm(getPaperRelease(R5_PAPER_VERSION)!)).toBe('hash');
    expect(reviewerGuideForm(getPaperRelease(REVISED_PAPER_VERSION)!)).toBe('text');
    // No guide WITH text exists for R5 outside the server's resolution against the artifact.
    expect(() => getReviewerGuideContract(R5_PAPER_VERSION)).toThrow('Invalid reviewer guide contract: the guide text of this release is resolved from its paper');
    expect(() => getReviewerGuideContract('unknown')).toThrow(/release identity/);
    expect(() => getReviewerGuideBinding('unknown')).toThrow(/release identity/);
  });

  it('fails closed for a guide offered under the wrong release, in the wrong form, or with incomplete lineage fields', () => {
    expect(() => validateReviewerGuideBinding(r5GuideContract)).toThrow(/release identity/);
    expect(() => validateReviewerGuideBinding(predecessorGuideContract, R5_PAPER_VERSION)).toThrow(/release identity/);
    expect(() => validateReviewerGuideBinding({ ...r5GuideContract, sourcePath: 'candidate/paper/some-file.md' }, R5_PAPER_VERSION)).toThrow(/source path/);
    // A hash-form release never accepts text, and never a question with both.
    expect(() => validateReviewerGuideBinding(withQuestion(0, { heading: 'A heading', prompt: 'A prompt?' }), R5_PAPER_VERSION)).toThrow(/question 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(0, { textSha256: undefined, heading: 'A heading', prompt: 'A prompt?' }), R5_PAPER_VERSION)).toThrow(/question 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(3, { textSha256: 'A'.repeat(64) }), R5_PAPER_VERSION)).toThrow(/question 4/);
    expect(() => validateReviewerGuideBinding(withQuestion(3, { textSha256: 'a'.repeat(63) }), R5_PAPER_VERSION)).toThrow(/question 4/);
    // The stored hash-form contract is not a guide with text.
    expect(() => validateReviewerGuideContract(r5GuideContract, R5_PAPER_VERSION)).toThrow(/question 1/);
    // A text-form release never accepts a hash.
    expect(() => validateReviewerGuideBinding({ ...predecessorGuideContract, questions: predecessorGuideContract.questions.map((question, index) => (index === 0 ? { ...question, textSha256: 'a'.repeat(64) } : question)) })).toThrow(/question 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(10, { predecessorEquivalence: EXACT }), R5_PAPER_VERSION)).toThrow(/predecessor question 11/);
    expect(() => validateReviewerGuideBinding(withQuestion(10, { predecessorQuestionId: `rpq:${REVISED_PAPER_VERSION}:q11` }), R5_PAPER_VERSION)).toThrow(/predecessor question 11/);
    expect(() => validateReviewerGuideBinding(withQuestion(0, { predecessorQuestionId: `rpq:${REVISED_PAPER_VERSION}:q02` }), R5_PAPER_VERSION)).toThrow(/predecessor question 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(0, { predecessorEquivalence: 'SAME' }), R5_PAPER_VERSION)).toThrow(/predecessor equivalence 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(0, { sectionAnchors: [] }), R5_PAPER_VERSION)).toThrow(/section anchors 1/);
    expect(() => validateReviewerGuideBinding({ ...r5GuideContract, predecessorReleaseIdentity: R5_PAPER_VERSION }, R5_PAPER_VERSION)).toThrow(/predecessor release identity/);
    // Two-sided: the stored contract itself validates.
    expect(validateReviewerGuideBinding(r5GuideContract, R5_PAPER_VERSION)).toBe(r5GuideContract);
  });

  it('is a closed contract: a field no validator checks is refused, so it can never move the review manifest digest', () => {
    expect(() => validateReviewerGuideBinding({ ...r5GuideContract, paperSha256: 'a'.repeat(64) }, R5_PAPER_VERSION)).toThrow(/unverified field/);
    expect(() => validateReviewerGuideBinding({ ...r5GuideContract, sourceOverlay: { file: 'x', sha256: 'y' } }, R5_PAPER_VERSION)).toThrow(/unverified field/);
    expect(() => validateReviewerGuideBinding(withQuestion(0, { headingLine: 1 }), R5_PAPER_VERSION)).toThrow(/unverified field 1/);
    expect(() => validateReviewerGuideBinding(withQuestion(11, { note: 'anything' }), R5_PAPER_VERSION)).toThrow(/unverified field 12/);
    // The same holds for the cohort contract.
    expect(Object.keys(r5CohortContract)).toEqual(['schemaVersion', 'releaseIdentity', 'status', 'cohorts']);
    expect(() => validateCohortManifest({ ...r5CohortContract, paperSha256: 'a'.repeat(64) }, R5_PAPER_VERSION)).toThrow(/unverified field/);
    expect(() => validateCohortManifest({ ...r5CohortContract, cohorts: r5CohortContract.cohorts.map((cohort, index) => (index === 2 ? { ...cohort, extra: true } : cohort)) }, R5_PAPER_VERSION)).toThrow(/unverified cohort field/);
    // The predecessor's contracts are not closed and are untouched: they still validate with their extra fields.
    expect(Object.keys(predecessorCohortContract)).toContain('paperSha256');
    expect(() => validateCohortManifest(predecessorCohortContract)).not.toThrow();
    expect(Object.keys(predecessorGuideContract)).toContain('paperSha256');
    expect(() => validateReviewerGuideBinding(predecessorGuideContract)).not.toThrow();
  });

  it('leaves the predecessor guide byte-for-byte what it was: the stored contract, with its text', () => {
    const guide = getReviewerGuideContract();
    expect(guide).toBe(predecessorGuideContract);
    expect(guide).toBe(getReviewerGuideContract(REVISED_PAPER_VERSION));
    expect(guide).toBe(getReviewerGuideBinding());
    expect(guide.releaseIdentity).toBe(REVISED_PAPER_VERSION);
    expect(guide.sourcePath).toBe(`candidate/paper/BC_Matrix_Options_Paper_v${REVISED_PAPER_VERSION}.md`);
    expect(guide.questions[10]).toMatchObject({ id: `rpq:${REVISED_PAPER_VERSION}:q11`, heading: 'On water type', sourceLines: [219, 220] });
    expect(guide.questions.every((question) => question.predecessorEquivalence === undefined && question.sectionAnchors === undefined && !('textSha256' in question))).toBe(true);
  });

  it('never authenticates the default guide against any text but its own paper', async () => {
    const predecessorPaper = loadRevisedPaper(REVISED_PAPER_VERSION).content;
    await expect(authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), predecessorPaper)).resolves.toBeUndefined();
    await expect(authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), `${predecessorPaper} `)).rejects.toThrow(/paper byte length/);
    await expect(authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), `${predecessorPaper.slice(0, -1)} `)).rejects.toThrow(/paper SHA-256/);
    // The stored hash-form guide is not a guide with text, so it authenticates against nothing.
    await expect(authenticateReviewerGuideAgainstPaper(r5Guide as unknown as ReviewerGuideContract, predecessorPaper)).rejects.toThrow(/question 1/);
  });

  it('is never resolved from text that is not the bound artifact', () => {
    const release = getPaperRelease(R5_PAPER_VERSION)!;
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    const source = (content: string, sha256: string, version: string = R5_PAPER_VERSION) => ({ content, manifest: { source: { version, sha256 } } });
    expect(() => resolveReviewerGuide(source(predecessor.content, release.sha256))).toThrow(`${REVIEWER_GUIDE_FAILURE_PREFIX}paper byte length`);
    expect(() => resolveReviewerGuide(source('x'.repeat(release.bytes), release.sha256))).toThrow(`${REVIEWER_GUIDE_FAILURE_PREFIX}paper SHA-256`);
    expect(() => resolveReviewerGuide(source(predecessor.content, predecessor.sha256))).toThrow(`${REVIEWER_GUIDE_FAILURE_PREFIX}paper SHA-256`);
    expect(() => resolveReviewerGuide(source(predecessor.content, predecessor.sha256, 'unknown'))).toThrow(`${REVIEWER_GUIDE_FAILURE_PREFIX}release identity`);
    // Two-sided, text form: the default release resolves to its stored contract.
    expect(resolveReviewerGuide(loadRevisedPaperStructure())).toBe(predecessorGuideContract);
    expect(resolveReviewerGuide(source(predecessor.content, predecessor.sha256, REVISED_PAPER_VERSION))).toBe(predecessorGuideContract);
    expect(() => resolveReviewerGuide(source(`${predecessor.content.slice(0, -2)}X\n`, predecessor.sha256, REVISED_PAPER_VERSION))).toThrow(`${REVIEWER_GUIDE_FAILURE_PREFIX}paper SHA-256`);
  });
});

describePrivate('R5 reviewer guide resolved from the artifact (private fixture)', () => {
  it('resolves to a guide with text whose hashes are the bound ones, under the R5 identity', () => {
    const resolved = resolveReviewerGuide(privateR5Structure());
    expect(resolved.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(resolved.sourcePath).toBe(`presentation:${R5_PAPER_VERSION}`);
    expect(Object.keys(resolved)).toEqual(['schemaVersion', 'releaseIdentity', 'sourcePath', 'predecessorReleaseIdentity', 'questions']);
    expect(resolved.questions.map((question) => question.id)).toEqual(r5Guide.questions.map((question) => question.id));
    expect(resolved.questions.map((question) => sha(reviewerGuideBoundText(question)))).toEqual(r5Guide.questions.map((question) => question.textSha256));
    expect(resolved.questions.every((question) => Object.keys(question).sort().join() === ['heading', 'id', 'number', 'predecessorEquivalence', 'predecessorQuestionId', 'prompt', 'sectionAnchors', 'sourceLines'].join())).toBe(true);
    expect(Object.isFrozen(resolved) && resolved.questions.every((question) => Object.isFrozen(question))).toBe(true);
    // One resolution per structure.
    expect(resolveReviewerGuide(privateR5Structure())).toBe(resolved);
    // The resolved guide is a valid guide with text for R5, and the stored one is not.
    expect(validateReviewerGuideContract(resolved, R5_PAPER_VERSION)).toBe(resolved);
  });

  it('authenticates the resolved guide against the exact artifact, and against nothing else', async () => {
    const resolved = resolveReviewerGuide(privateR5Structure());
    const artifact = readPrivatePresentation();
    const outcome = async (guide: ReviewerGuideContract, text: string): Promise<string> => {
      try {
        await authenticateReviewerGuideAgainstPaper(guide, text);
        return 'authenticated';
      } catch (error) {
        return error instanceof Error ? error.message : 'unknown';
      }
    };
    const altered = (index: number, patch: Record<string, unknown>): ReviewerGuideContract => ({ ...resolved, questions: resolved.questions.map((question, position) => (position === index ? { ...question, ...patch } : question)) });
    expect(await outcome(resolved, artifact)).toBe('authenticated');
    expect(await outcome(altered(10, { prompt: predecessorGuideContract.questions[10].prompt }), artifact)).toMatch(/prompt source 11/);
    expect(await outcome(altered(10, { heading: predecessorGuideContract.questions[10].heading }), artifact)).toMatch(/heading source 11/);
    expect(await outcome(altered(0, { sourceLines: [185, 186] }), artifact)).toMatch(/prompt source 1/);
    expect(await outcome(altered(0, { sectionAnchors: ['sec-7-8-1'] }), artifact)).toMatch(/section anchor source 1/);
    expect(await outcome(altered(0, { sectionAnchors: ['sec-99-9'] }), artifact)).toMatch(/section anchor source 1/);
    expect(await outcome(resolved, `${artifact.slice(0, -1)} `)).toMatch(/paper SHA-256/);
    expect(await outcome(resolved, loadRevisedPaper(REVISED_PAPER_VERSION).content)).toMatch(/paper byte length/);
    expect(await outcome(getReviewerGuideContract(), artifact)).toMatch(/paper byte length/);
  });

  it('is exact where it says exact: ten questions and question twelve have the predecessor heading and prompt, and question eleven does not', () => {
    const resolved = resolveReviewerGuide(privateR5Structure());
    const predecessor = getReviewerGuideContract();
    const identical = resolved.questions.map((question) => {
      const earlier = predecessor.questions[question.number - 1];
      return earlier.heading === question.heading && earlier.prompt === question.prompt;
    });
    expect(identical).toEqual([true, true, true, true, true, true, true, true, true, true, false, true]);
  });

  it('opens each question on a section the overlay anchors it to', () => {
    const structure = privateR5Structure();
    const resolved = resolveReviewerGuide(structure);
    const navigation = buildReviewNavigation(getCohortManifest(R5_PAPER_VERSION), resolved, getPaperNavOutline(structure));
    const stableIds = getPaperStableSectionIds(structure);
    for (const question of resolved.questions) {
      const anchor = navigation.anchorForQuestion(question.number);
      expect(anchor === undefined).toBe(false);
      expect(question.sectionAnchors).toContain(stableIds[anchor as string]);
    }
    // Q11 opens Section 4.4, the overlay's anchor for it.
    expect(stableIds[navigation.anchorForQuestion(11) as string]).toBe('sec-4-4');
  });
});

describe('R5 cohorts', () => {
  const cohorts = getCohortManifest(R5_PAPER_VERSION);
  // The only locator forms the cohort contracts use: one section, two sections, a guide line range.
  const LOCATOR = /^(?:Section \d{1,2}(?:\.\d{1,2}){0,2}|Sections \d{1,2}(?:\.\d{1,2}){0,2} and \d{1,2}(?:\.\d{1,2}){0,2}|Reviewer's Guide lines \d{1,5}-\d{1,5})$/;

  it('carries the five review topics and question groupings forward with R5 guide line ranges', () => {
    expect(cohorts.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(cohorts.status).toBe('PROPOSED_PENDING_OWNER_QP_APPROVAL');
    const predecessor = getCohortManifest();
    expect(cohorts.cohorts.map((cohort) => [cohort.id, cohort.name, cohort.questionNumbers])).toEqual(predecessor.cohorts.map((cohort) => [cohort.id, cohort.name, cohort.questionNumbers]));
    expect(cohorts.cohorts.map((cohort) => cohort.guideEvidenceRanges)).toEqual([[[125, 131]], [[133, 138]], [[140, 145]], [[147, 152], [163, 167]], [[154, 161]]]);
  });

  it('holds no prose of its own: name, purpose, package contents and limitations equal the public predecessor exactly', () => {
    expect(r5CohortContract.cohorts).toHaveLength(predecessorCohortContract.cohorts.length);
    for (const [index, cohort] of r5CohortContract.cohorts.entries()) {
      const earlier = predecessorCohortContract.cohorts[index];
      expect(Object.keys(cohort)).toEqual(['id', 'name', 'questionNumbers', 'sourceLocators', 'guideEvidenceRanges', 'purpose', 'packageContents', 'limitations']);
      expect([cohort.id, cohort.name, cohort.purpose, cohort.packageContents, cohort.limitations]).toEqual([earlier.id, earlier.name, earlier.purpose, earlier.packageContents, earlier.limitations]);
    }
  });

  it('every locator matches a closed pattern, in both releases, and the pattern can fail', () => {
    const locators = r5CohortContract.cohorts.flatMap((cohort) => cohort.sourceLocators);
    expect(locators).toHaveLength(16);
    expect(locators.filter((locator) => !LOCATOR.test(locator))).toEqual([]);
    expect(predecessorCohortContract.cohorts.flatMap((cohort) => cohort.sourceLocators).filter((locator) => !LOCATOR.test(locator))).toEqual([]);
    for (const text of ['Section 7.8 Some heading text', 'Sections 4.1, 6.0 and 7.5', 'The section on inputs', "Reviewer's Guide", 'Section 7.8.1.2.3', 'section 7.8', ' Section 7.8']) expect(LOCATOR.test(text)).toBe(false);
  });

  it('changes only the guide line locators and the water-type locator, which follows the overlay anchor for Q11', () => {
    const sectionLocators = (manifest: typeof cohorts) => manifest.cohorts.map((cohort) => cohort.sourceLocators.filter((locator) => !locator.startsWith("Reviewer's Guide")));
    const predecessor = sectionLocators(getCohortManifest());
    const successor = sectionLocators(cohorts);
    expect(successor.slice(0, 4)).toEqual(predecessor.slice(0, 4));
    expect(predecessor[4]).toEqual(['Sections 6.0 and 7.5', 'Section 4.4.2']);
    expect(successor[4]).toEqual(['Sections 6.0 and 7.5', 'Section 4.4']);
  });

  it('validates only against its own release guide', () => {
    expect(() => validateCohortManifest(r5CohortContract)).toThrow(/release or status/);
    expect(() => validateCohortManifest(predecessorCohortContract, R5_PAPER_VERSION)).toThrow(/release or status/);
    // Relabelled as R5 the predecessor's contract is refused twice over: first for the fields a successor contract may not carry...
    expect(() => validateCohortManifest({ ...predecessorCohortContract, releaseIdentity: R5_PAPER_VERSION }, R5_PAPER_VERSION)).toThrow(/unverified field/);
    // ...and, with those removed, because its guide line ranges do not cover the R5 guide's question lines.
    const { schemaVersion, status, cohorts: predecessorCohorts } = predecessorCohortContract;
    expect(() => validateCohortManifest({ schemaVersion, releaseIdentity: R5_PAPER_VERSION, status, cohorts: predecessorCohorts }, R5_PAPER_VERSION)).toThrow(/guide evidence coverage categories/);
    expect(() => getCohortManifest('unknown')).toThrow(/release or status/);
  });

  it('changes no predecessor portion: every range of the default release is exactly what it was', () => {
    const ranges = deriveCohortPortions(loadRevisedPaperStructure(), getCohortManifest()).map((portion) => [portion.id, portion.startByte, portion.endByte, portion.sectionLabel]);
    expect(ranges).toEqual([
      ['categories:4.1', 46365, 52105, '4.1 Part 1: Matrix Numerical Sediment Standards & Four Proposed Sediment Uses'],
      ['categories:9.9', 178880, 186798, '9.9 Water lot use classes and their exposure scenarios - options'],
      ['pathway-grid:4.1', 46365, 52105, '4.1 Part 1: Matrix Numerical Sediment Standards & Four Proposed Sediment Uses'],
      ['pathway-grid:6', 86488, 94686, '6.0 Proposed Matrix Standards Framework'],
      ['pathway-grid:18.1', 252861, 258216, '18.1 The three-part structure and how its parts relate'],
      ['exposure-assumptions:7.5', 107016, 108184, 'Section 7.5 (7.5.1-7.5.3)'],
      ['exposure-assumptions:7.8', 136413, 141892, 'Section 7.8 (7.8.1-7.8.2)'],
      ['exposure-assumptions:9.5', 151588, 151683, '9.5 Matrix Standards Derivation Options'],
      ['inputs-evidence:7.7', 120264, 135491, '7.7 BC Aquatic Database'],
      ['inputs-evidence:7.8', 136413, 141892, 'Section 7.8 (7.8.1-7.8.2)'],
      ['inputs-evidence:15', 229160, 245502, '15.0 Limitations of This Draft'],
      ['methods-water-type:6', 86488, 94686, '6.0 Proposed Matrix Standards Framework'],
      ['methods-water-type:7.5', 107016, 108184, 'Section 7.5 (7.5.1-7.5.3)'],
      ['methods-water-type:4.4.2', 58676, 62490, '4.4.2 The structure the in-force schedule already uses'],
    ]);
  });
});

describePrivate('R5 cohort portions (private fixture)', () => {
  const portions = () => deriveCohortPortions(privateR5Structure(), getCohortManifest(R5_PAPER_VERSION));

  it('resolves every cohort locator to an authenticated section (none unavailable)', () => {
    expect(portions().every((portion) => portion.status === 'available')).toBe(true);
    expect(portions().map((portion) => portion.id)).toEqual([
      'categories:4.1', 'categories:9.9', 'pathway-grid:4.1', 'pathway-grid:6', 'pathway-grid:18.1', 'exposure-assumptions:7.5', 'exposure-assumptions:7.8', 'exposure-assumptions:9.5', 'inputs-evidence:7.7', 'inputs-evidence:7.8', 'inputs-evidence:15', 'methods-water-type:6', 'methods-water-type:7.5', 'methods-water-type:4.4',
    ]);
  });

  it('gives the "Section 7.5" portion its whole section: 7.5.1-7.5.3 are authored at the same level as 7.5 and still belong to it', () => {
    const structure = privateR5Structure();
    // Before the appendix boundary there is one heading numbered 7.5, and its three subsections are its siblings.
    const boundary = structure.nodes.findIndex((candidate) => candidate.depth === 1 && candidate.label === 'Technical Appendices Compendium');
    const body = structure.nodes.slice(0, boundary);
    const numbered = (number: string) => body.filter((candidate) => sectionNumberFromHeading(candidate.label) === number);
    expect([numbered('7.5').length, numbered('7.5.1').length, numbered('7.5.3').length, numbered('7.6').length]).toEqual([1, 1, 1, 1]);
    const node = numbered('7.5')[0];
    const firstChild = numbered('7.5.1')[0];
    const last = numbered('7.5.3')[0];
    expect(firstChild.depth).toBe(node.depth);
    expect(node.endByte).toBe(firstChild.startByte);
    for (const id of ['exposure-assumptions:7.5', 'methods-water-type:7.5']) {
      const portion = portions().find((candidate) => candidate.id === id)!;
      expect(portion.status).toBe('available');
      expect(portion.sectionLabel === node.label).toBe(true);
      expect(portion.sectionAnchor === node.anchor).toBe(true);
      expect(portion.startByte).toBe(node.startByte);
      // The portion runs through the end of 7.5.3, not just the 7.5 lead-in...
      expect(portion.endByte).toBe(last.endByte);
      expect(portion.endByte).toBeGreaterThan(node.endByte);
      // ...holds the figure bound to sec-7-5, which the questions cite...
      expect((portion.text ?? '').includes('<!-- MATRIX_FIGURE_PLACEMENT: 7-2 -->')).toBe(true);
      // ...and stops where the next section starts.
      expect(portion.endByte).toBe(numbered('7.6')[0].startByte);
    }
  });

  it('pins every other portion range', () => {
    const ranges = portions().filter((portion) => !portion.id.endsWith(':7.5')).map((portion) => [portion.id, portion.startByte, portion.endByte]);
    expect(ranges).toEqual([
      ['categories:4.1', 42833, 48411],
      ['categories:9.9', 229888, 238010],
      ['pathway-grid:4.1', 42833, 48411],
      ['pathway-grid:6', 81394, 88853],
      ['pathway-grid:18.1', 305377, 310905],
      ['exposure-assumptions:7.8', 125707, 126736],
      ['exposure-assumptions:9.5', 159891, 199967],
      ['inputs-evidence:7.7', 112986, 125707],
      ['inputs-evidence:7.8', 125707, 126736],
      ['inputs-evidence:15', 281142, 297917],
      ['methods-water-type:6', 81394, 88853],
      ['methods-water-type:4.4', 53933, 70086],
    ]);
  });
});

describe('review manifests: one per release, the predecessor unchanged', () => {
  it('keeps the predecessor manifest digest that persisted review rows are keyed on', () => {
    expect(getReviewManifest().sha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(getReviewManifest(REVISED_PAPER_VERSION).sha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(getReviewManifest().documentVersion).toBe(REVISED_PAPER_VERSION);
  });

  it('gives R5 its own manifest over the R5 artifact, stored guide and cohorts', () => {
    const manifest = getReviewManifest(R5_PAPER_VERSION);
    expect(manifest.documentVersion).toBe(R5_PAPER_VERSION);
    expect(manifest.paperSha256).toBe(getPaperRelease(R5_PAPER_VERSION)?.sha256);
    expect(manifest.reviewerGuideReleaseIdentity).toBe(R5_PAPER_VERSION);
    expect(manifest.cohortsReleaseIdentity).toBe(R5_PAPER_VERSION);
    expect(manifest.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.sha256).not.toBe(PREDECESSOR_MANIFEST_SHA256);
    // Pinned, like the predecessor's. This is the digest the review record must be provisioned
    // with for R5 saves to be accepted; any edit to the R5 guide or cohort contract changes it,
    // and must fail here rather than silently strand a provisioned record.
    expect(manifest.sha256).toBe(R5_MANIFEST_SHA256);
    expect(manifest.questionIds.every((id) => id.startsWith(`rpq:${R5_PAPER_VERSION}:q`))).toBe(true);
    expect(Object.values(manifest.cohortQuestionIds).flat().sort()).toEqual([...manifest.questionIds].sort());
    // No question id is shared between the two releases.
    expect(manifest.questionIds.filter((id) => getReviewManifest().questionIds.includes(id))).toEqual([]);
    expect(() => getReviewManifest('unknown')).toThrow(/Unknown paper release/);
  });

  it('finds a manifest only for the exact (version, digest) pair of one release', () => {
    const r5 = getReviewManifest(R5_PAPER_VERSION);
    expect(findReviewManifest(R5_PAPER_VERSION, r5.sha256)?.documentVersion).toBe(R5_PAPER_VERSION);
    expect(findReviewManifest(REVISED_PAPER_VERSION, PREDECESSOR_MANIFEST_SHA256)?.documentVersion).toBe(REVISED_PAPER_VERSION);
    // Never one release's version with the other release's digest.
    expect(findReviewManifest(R5_PAPER_VERSION, PREDECESSOR_MANIFEST_SHA256)).toBeNull();
    expect(findReviewManifest(REVISED_PAPER_VERSION, r5.sha256)).toBeNull();
    expect(findReviewManifest('unknown', r5.sha256)).toBeNull();
    expect(findReviewManifest(null, r5.sha256)).toBeNull();
    expect(findReviewManifest(R5_PAPER_VERSION, null)).toBeNull();
    expect(findReviewManifest(R5_PAPER_VERSION, r5.sha256.toUpperCase())).toBeNull();
  });
});

describe('review lineage: read-only, exact text only, by hash against the predecessor public text', () => {
  it('continues Q1-Q10 and Q12 from the same-numbered predecessor question, and nothing for Q11', () => {
    const lineage = getReviewLineage(R5_PAPER_VERSION)!;
    expect(lineage.predecessorVersion).toBe(REVISED_PAPER_VERSION);
    expect(lineage.questions.filter((question) => question.equivalence === EXACT).map((question) => question.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
    expect(lineage.questions.filter((question) => question.equivalence === CHANGED).map((question) => question.number)).toEqual([11]);
    for (const question of lineage.questions) {
      expect(question.predecessorQuestionId).toBe(question.number === 11 ? null : `rpq:${REVISED_PAPER_VERSION}:q${String(question.number).padStart(2, '0')}`);
    }
    expect(getReviewLineage(REVISED_PAPER_VERSION)).toBeNull();
    expect(getReviewLineage('unknown')).toBeNull();
  });

  it('is exact where it says exact: the hash of the predecessor heading and prompt is the bound hash, and for Q11 it is not', () => {
    const predecessor = getReviewerGuideContract();
    const equal = r5Guide.questions.map((question) => sha(reviewerGuideBoundText(normalizeReviewerGuideText(predecessor.questions[question.number - 1]))) === question.textSha256);
    expect(equal).toEqual([true, true, true, true, true, true, true, true, true, true, false, true]);
    // The bound value is one joined string: neither part alone, nor the two in the other order, hashes to it.
    const first = normalizeReviewerGuideText(predecessor.questions[0]);
    expect(reviewerGuideBoundText(first)).toBe(`${first.heading}\n${first.prompt}`);
    for (const other of [first.heading, first.prompt, `${first.prompt}\n${first.heading}`, `${first.heading}${first.prompt}`, `${first.heading} ${first.prompt}`]) expect(sha(other)).not.toBe(r5Guide.questions[0].textSha256);
  });

  it('exposes to the review panel only the predecessor identity and the question map', () => {
    const view = reviewLineageView(getReviewLineage(R5_PAPER_VERSION)!, getReviewManifest(REVISED_PAPER_VERSION).sha256);
    expect(view.predecessorVersion).toBe(REVISED_PAPER_VERSION);
    expect(view.predecessorManifestSha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(Object.keys(view.predecessorQuestionIds)).toHaveLength(12);
    expect(view.predecessorQuestionIds[`rpq:${R5_PAPER_VERSION}:q11`]).toBeNull();
    expect(view.predecessorQuestionIds[`rpq:${R5_PAPER_VERSION}:q12`]).toBe(`rpq:${REVISED_PAPER_VERSION}:q12`);
  });
});

describe('section anchors: the default release', () => {
  const predecessor = loadRevisedPaperStructure();

  it('retires nothing in the predecessor, and resolves its Section 7.8 ids to their own headings', () => {
    const predecessorRetired = getPaperRelease(REVISED_PAPER_VERSION)!.retiredSectionAnchors;
    expect(predecessorRetired).toEqual({});
    for (const id of ['sec-7-8-1', 'sec-7-8-2']) expect(predecessor.content).toContain(`<div id="${id}" class="section-anchor"></div>`);
    // Owner decision 2026-10-01. The predecessor authors these three anchor divs directly
    // UNDER their headings; before rule 3b of buildLegacyAnchorMap they resolved to nothing,
    // so switching drafts from R5 Section 7.8 opened the default draft at its start.
    const legacy = buildLegacyAnchorMap(predecessor);
    const labelOf = (id: string) => predecessor.nodes.find((node) => node.anchor === resolveLegacySectionAnchor(predecessor, id, predecessorRetired))?.label;
    expect(labelOf('sec-7-8')).toBe('Section 7.8: Input Parameter Inventory and Selection Options');
    expect(labelOf('sec-7-8-1')).toBe('7.8.1 Inventory, provenance and status discipline');
    expect(labelOf('sec-7-8-2')).toBe('7.8.2 Source submission and primary verification');
    expect(Object.keys(legacy)).toHaveLength(120);
    expect(getPaperStableSectionIds(predecessor)[legacy['sec-7-8']]).toBe('sec-7-8');
  });

  it('attaches an anchor div to the heading above it only when the id states that heading\'s own number', () => {
    const encoder = new TextEncoder();
    const synthetic = (lines: readonly string[]) => {
      const content = lines.join('\n');
      const nodes: Record<string, unknown>[] = [];
      let offset = 0;
      lines.forEach((line, index) => {
        const match = /^(#{1,6}) (.+)$/.exec(line);
        if (match) {
          const startByte = encoder.encode(content.slice(0, offset)).length;
          nodes.push({ id: `node:${index}`, kind: 'heading', depth: match[1].length, label: match[2], parentId: null, tokenEndByte: startByte + encoder.encode(line).length, anchor: `a-${index}`, startByte, endByte: startByte + encoder.encode(line).length });
        }
        offset += line.length + 1;
      });
      return { content, nodes } as unknown as Parameters<typeof buildLegacyAnchorMap>[0];
    };
    const div = (id: string) => `<div id="${id}" class="section-anchor"></div>`;
    // Under its own heading, in both label forms: resolved.
    const own = buildLegacyAnchorMap(synthetic(['# Section 7.8: Inputs', '', div('sec-7-8'), '', 'Prose.', '', '#### 7.8.1 Inventory', '', div('sec-7-8-1'), '', 'More prose.', '', '# 9.0 Next']));
    expect(own).toEqual({ 'sec-7-8': 'a-0', 'sec-7-8-1': 'a-6' });
    // Under a heading that states a DIFFERENT number: never attached to it.
    expect(buildLegacyAnchorMap(synthetic(['# 7.7 Other', '', div('sec-7-8'), '', 'Prose.', '', '# 9.0 Next']))).toEqual({});
    // A non-numeric id is never attached to the heading above it.
    expect(buildLegacyAnchorMap(synthetic(['# 7.8 Inputs', '', div('sec-inputs'), '', 'Prose.', '', '# 9.0 Next']))).toEqual({});
    // Prose between the heading and the div: not "directly under".
    expect(buildLegacyAnchorMap(synthetic(['# 7.8 Inputs', '', 'Lead-in prose.', '', div('sec-7-8'), '', 'Prose.', '', '# 9.0 Next']))).toEqual({});
    // The existing rules still win: a div directly ABOVE a heading labels that heading, whatever sits above the div.
    expect(buildLegacyAnchorMap(synthetic(['# 7.8 Inputs', '', div('sec-7-9'), '', '# 7.9 Later']))).toEqual({ 'sec-7-9': 'a-4' });
  });
});

describePrivate('section anchors across releases (private fixture)', () => {
  const predecessor = () => loadRevisedPaperStructure();
  const retired = getPaperRelease(R5_PAPER_VERSION)!.retiredSectionAnchors;

  it('lands the retired predecessor ids sec-7-8-1 and sec-7-8-2 on sec-7-8 in R5, for navigation only', () => {
    const r5 = privateR5Structure();
    const target = buildLegacyAnchorMap(r5)['sec-7-8'];
    expect(sectionNumberFromHeading(r5.nodes.find((node) => node.anchor === target)?.label ?? '')).toBe('7.8');
    expect(buildLegacyAnchorMap(r5)['sec-7-8-1']).toBeUndefined();
    expect(buildLegacyAnchorMap(r5)['sec-7-8-2']).toBeUndefined();
    expect(resolveLegacySectionAnchor(r5, 'sec-7-8-1', retired)).toBe(target);
    expect(resolveLegacySectionAnchor(r5, 'sec-7-8-2', retired)).toBe(target);
    // Without the release's retired map the ids are unknown: nothing else redirects them.
    expect(resolveLegacySectionAnchor(r5, 'sec-7-8-1')).toBeNull();
    expect(resolveLegacySectionAnchor(r5, 'sec-9-9-9', retired)).toBeNull();
    for (const id of ['sec-7-8-1', 'sec-7-8-2']) expect(r5.content.includes(`id="${id}"`)).toBe(false);
    // Section 7.8 carries across drafts in BOTH directions by its stable id.
    expect(getPaperStableSectionIds(r5)[target]).toBe('sec-7-8');
  });

  it('maps every stable id both releases have to a section in each, so a place carries across drafts', () => {
    const r5 = privateR5Structure();
    const r5Legacy = buildLegacyAnchorMap(r5);
    const predecessorLegacy = buildLegacyAnchorMap(predecessor());
    const shared = Object.keys(predecessorLegacy).filter((id) => Object.prototype.hasOwnProperty.call(r5Legacy, id));
    expect(shared.length).toBeGreaterThan(100);
    // The R5-only stable ids of the overlay are sections of R5 and not of the predecessor.
    for (const id of ['sec-7-1', 'sec-7-2', 'sec-7-3', 'sec-7-4', 'sec-7-6', 'sec-8-0', 'sec-9-9-1', 'sec-9-9-2', 'sec-9-9-3', 'sec-9-9-4', 'sec-13-0', 'sec-15-5', 'sec-15-6']) {
      expect(Object.prototype.hasOwnProperty.call(r5Legacy, id)).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(predecessorLegacy, id)).toBe(false);
    }
    expect(getPaperStableSectionIds(r5)[r5Legacy['sec-4-4']]).toBe('sec-4-4');
  });
});
