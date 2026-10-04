import guideContract from './paper/contracts/reviewer-guide-v1.json';
import r5GuideContract from './paper/contracts/reviewer-guide-v0.9.88-r4-presentation-001.json';
import v0991GuideContract from './paper/contracts/reviewer-guide-v0.9.91-run109-001.json';
import { getPaperRelease, paperReleaseSourceLabel, R5_PAPER_VERSION, V0991_PAPER_VERSION, type PaperRelease, type PaperReleaseVersion } from './paper/releases';

/*
 * Reviewer guide contracts: the twelve review questions of a release.
 *
 * A guide is STORED in one of two forms, decided by how the release's bytes are
 * delivered (paper/releases.ts):
 * - text form (a repository release): each question carries its heading and
 *   prompt. The stored contract is the guide.
 * - hash form (a private-storage release): each question carries `textSha256`
 *   and no text, so no text of that release is in the repository or in a client
 *   bundle. The guide WITH text is resolved on the server from the verified
 *   paper (paper/reviewer-guide-server.ts) and handed to the reader as data.
 *
 * `ReviewerGuideBinding` is the stored form; `ReviewerGuideContract` is a guide
 * with text (a text-form binding, or a resolved hash-form one). Ids, numbers,
 * source lines, section anchors and predecessor declarations are the same in
 * both and are read from the binding.
 *
 * Isomorphic: no fs, no node crypto.
 */

/** The DEFAULT release's guide identity; every caller that names no version gets this guide. */
export const REVIEW_GUIDE_RELEASE_IDENTITY = '1.0.11-remediated-7-8-successor-20260918-D' as const;
/** The guide questions are authenticated against this exact release file (F-05). */
export const REVIEW_GUIDE_SOURCE_PATH = 'candidate/paper/BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md' as const;

/** How a question relates to the same-numbered question of the predecessor release. */
export const REVIEW_QUESTION_EQUIVALENCES = ['EXACT_HEADING_AND_PROMPT_TEXT', 'MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD'] as const;
export type ReviewQuestionEquivalence = (typeof REVIEW_QUESTION_EQUIVALENCES)[number];

/** What a question binds in either form: everything except its text. */
interface ReviewerGuideQuestionIdentity {
  readonly number: number;
  readonly id: string;
  readonly sourceLines: readonly [number, number];
  /** Successor releases only: the stable section ids the question is anchored to. */
  readonly sectionAnchors?: readonly string[];
  /** Successor releases only: the declared relationship to the predecessor's question. */
  readonly predecessorEquivalence?: ReviewQuestionEquivalence;
  /** Successor releases only: the predecessor question this one continues, when the text is identical. */
  readonly predecessorQuestionId?: string | null;
}

/** A question with its text. */
export interface ReviewerGuideQuestion extends ReviewerGuideQuestionIdentity {
  readonly heading: string;
  readonly prompt: string;
}

/**
 * A question as stored: its text (text form), or the SHA-256 of its text (hash
 * form; see reviewerGuideBoundText). Never both.
 */
export type ReviewerGuideBoundQuestion = ReviewerGuideQuestionIdentity & (
  | { readonly heading: string; readonly prompt: string; readonly textSha256?: undefined }
  | { readonly textSha256: string; readonly heading?: undefined; readonly prompt?: undefined }
);

interface ReviewerGuideIdentity {
  readonly schemaVersion: 'matrix-paper-reviewer-guide-v1';
  readonly releaseIdentity: PaperReleaseVersion;
  /** Which artifact the questions are read from (paper/releases.ts paperReleaseSourceLabel). */
  readonly sourcePath: string;
  /** Successor releases only. */
  readonly predecessorReleaseIdentity?: string;
}

/** A guide with its text: a text-form stored contract, or a hash-form one resolved against its paper. */
export interface ReviewerGuideContract extends ReviewerGuideIdentity {
  readonly questions: readonly ReviewerGuideQuestion[];
}

/** A guide as stored: what the contract file holds. */
export interface ReviewerGuideBinding extends ReviewerGuideIdentity {
  readonly questions: readonly ReviewerGuideBoundQuestion[];
}

export type ReviewerGuideForm = 'text' | 'hash';

/** The form a release's stored guide takes: hashes for a private-storage release, text otherwise. */
export function reviewerGuideForm(release: Pick<PaperRelease, 'delivery'>): ReviewerGuideForm {
  return release.delivery === 'private-storage' ? 'hash' : 'text';
}

function fail(message: string): never {
  throw new Error(`Invalid reviewer guide contract: ${message}`);
}

const SHA256_HEX = /^[0-9a-f]{64}$/;
const STABLE_SECTION_ANCHOR = /^(?:sec|app)-[a-z0-9-]+$/;
const GUIDE_KEYS = ['schemaVersion', 'releaseIdentity', 'sourcePath', 'questions'] as const;
const SUCCESSOR_GUIDE_KEYS = ['schemaVersion', 'releaseIdentity', 'sourcePath', 'predecessorReleaseIdentity', 'questions'] as const;
const QUESTION_TEXT_KEYS: Readonly<Record<ReviewerGuideForm, readonly string[]>> = { text: ['heading', 'prompt'], hash: ['textSha256'] };
const QUESTION_KEYS = ['number', 'id', 'sourceLines'] as const;
const SUCCESSOR_QUESTION_KEYS = ['sectionAnchors', 'predecessorEquivalence', 'predecessorQuestionId'] as const;

/** True when `value` has every one of `keys` as an own property and no other own property. */
export function hasExactlyKeys(value: unknown, keys: readonly string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** A question carries exactly the text members of its form, and none of the other form's. */
function hasTextOfForm(question: ReviewerGuideBoundQuestion, form: ReviewerGuideForm): boolean {
  if (form === 'hash') return typeof question.textSha256 === 'string' && SHA256_HEX.test(question.textSha256) && !hasOwn(question, 'heading') && !hasOwn(question, 'prompt');
  return typeof question.prompt === 'string' && question.prompt !== '' && typeof question.heading === 'string' && question.heading !== '' && !hasOwn(question, 'textSha256');
}

/**
 * Shape of a guide in one form for one bound release. The release decides the
 * expected identity, source label and question ids; nothing is taken from the
 * candidate on trust.
 */
function validateGuide(candidate: unknown, releaseIdentity: string, form: ReviewerGuideForm): ReviewerGuideBinding {
  if (!candidate || typeof candidate !== 'object') fail('object');
  const contract = candidate as ReviewerGuideBinding;
  const release = getPaperRelease(releaseIdentity);
  if (contract.schemaVersion !== 'matrix-paper-reviewer-guide-v1') fail('schema version');
  if (!release || contract.releaseIdentity !== release.documentVersion) fail('release identity');
  if (contract.sourcePath !== paperReleaseSourceLabel(release)) fail('source path');
  if (!Array.isArray(contract.questions) || contract.questions.length !== 12) fail('question count');
  if ((contract.questions as readonly unknown[]).some((question) => !question || typeof question !== 'object' || Array.isArray(question))) fail('question shape');
  const numbers = contract.questions.map((question) => question.number);
  if (numbers.some((number, index) => number !== index + 1)) fail('question numbering');
  for (const question of contract.questions) {
    const expectedId = `rpq:${release.documentVersion}:q${String(question.number).padStart(2, '0')}`;
    if (question.id !== expectedId || !hasTextOfForm(question, form)) fail(`question ${question.number}`);
    const sourceLines: unknown = question.sourceLines;
    if (!Array.isArray(sourceLines) || sourceLines.length !== 2 || !Number.isInteger(sourceLines[0]) || !Number.isInteger(sourceLines[1]) || sourceLines[0] < 1 || sourceLines[0] > sourceLines[1]) fail(`source range ${question.number}`);
  }
  const successor = release.predecessorVersion !== null;
  if (successor && contract.predecessorReleaseIdentity !== release.predecessorVersion) fail('predecessor release identity');
  // A successor's contract, and every hash-form contract, is CLOSED: each field in it is one a
  // validator or the check against the paper verifies. The whole stored contract is hashed
  // into the release's review manifest digest, which the review record is keyed on, so a
  // field nothing verifies would let that digest change with no check noticing. A closed
  // hash-form contract also has no member that could carry text of its release.
  if (successor || form === 'hash') {
    if (!hasExactlyKeys(contract, successor ? SUCCESSOR_GUIDE_KEYS : GUIDE_KEYS)) fail('unverified field');
    const questionKeys = [...QUESTION_KEYS, ...QUESTION_TEXT_KEYS[form], ...(successor ? SUCCESSOR_QUESTION_KEYS : [])];
    for (const question of contract.questions) {
      if (!hasExactlyKeys(question, questionKeys)) fail(`unverified field ${question.number}`);
    }
  }
  // A successor release declares, per question, how it relates to its predecessor.
  // The declaration is checked against the predecessor's own text in
  // paper/review-lineage.ts; here only its shape is required to be complete.
  if (release.predecessorVersion !== null) {
    for (const question of contract.questions) {
      const anchors: unknown = question.sectionAnchors;
      if (!Array.isArray(anchors) || anchors.length === 0 || anchors.some((anchor) => typeof anchor !== 'string' || !STABLE_SECTION_ANCHOR.test(anchor))) fail(`section anchors ${question.number}`);
      if (!REVIEW_QUESTION_EQUIVALENCES.includes(question.predecessorEquivalence as ReviewQuestionEquivalence)) fail(`predecessor equivalence ${question.number}`);
      const expectedPredecessorId = `rpq:${release.predecessorVersion}:q${String(question.number).padStart(2, '0')}`;
      const exact = question.predecessorEquivalence === 'EXACT_HEADING_AND_PROMPT_TEXT';
      if (exact ? question.predecessorQuestionId !== expectedPredecessorId : question.predecessorQuestionId !== null) fail(`predecessor question ${question.number}`);
    }
  }
  return contract;
}

/**
 * Validates a guide WITH text for one bound release (the default release when
 * none is named): a text-form stored contract, or a resolved hash-form one.
 */
export function validateReviewerGuideContract(candidate: unknown, releaseIdentity: string = REVIEW_GUIDE_RELEASE_IDENTITY): ReviewerGuideContract {
  return validateGuide(candidate, releaseIdentity, 'text') as ReviewerGuideContract;
}

/** Validates a guide AS STORED for one bound release, in the form that release stores it. */
export function validateReviewerGuideBinding(candidate: unknown, releaseIdentity: string = REVIEW_GUIDE_RELEASE_IDENTITY): ReviewerGuideBinding {
  const release = getPaperRelease(releaseIdentity);
  return validateGuide(candidate, releaseIdentity, release ? reviewerGuideForm(release) : 'text');
}

/**
 * The validated stored guide of one bound release (the default release when no
 * version is given): ids, numbers, source lines, section anchors and predecessor
 * declarations. It carries question text only for a text-form release.
 */
export function getReviewerGuideBinding(documentVersion: string = REVIEW_GUIDE_RELEASE_IDENTITY): ReviewerGuideBinding {
  if (documentVersion === REVIEW_GUIDE_RELEASE_IDENTITY) return validateReviewerGuideBinding(guideContract, REVIEW_GUIDE_RELEASE_IDENTITY);
  if (documentVersion === R5_PAPER_VERSION) return validateReviewerGuideBinding(r5GuideContract, R5_PAPER_VERSION);
  if (documentVersion === V0991_PAPER_VERSION) return validateReviewerGuideBinding(v0991GuideContract, V0991_PAPER_VERSION);
  fail('release identity');
}

/**
 * The validated guide, with text, of a TEXT-FORM release; the default release
 * when no version is given. A hash-form release has no guide text here: it is
 * resolved from the verified paper on the server (paper/reviewer-guide-server.ts).
 */
export function getReviewerGuideContract(documentVersion: string = REVIEW_GUIDE_RELEASE_IDENTITY): ReviewerGuideContract {
  const release = getPaperRelease(documentVersion);
  if (!release) fail('release identity');
  if (reviewerGuideForm(release) !== 'text') fail('the guide text of this release is resolved from its paper');
  return getReviewerGuideBinding(release.documentVersion) as ReviewerGuideContract;
}

function normalizeSourceText(value: string): string {
  return value.replace(/^\s*\d+\.\s*/, '').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
}

function normalizeSourceHeading(value: string): string {
  return value.replace(/^\s*\*\*|\*\*\s*$/g, '').replace(/\s+/g, ' ').trim();
}

/** A question's heading and prompt in the normalized form they are compared and hashed in. */
export function normalizeReviewerGuideText(question: { readonly heading: string; readonly prompt: string }): { readonly heading: string; readonly prompt: string } {
  return { heading: normalizeSourceHeading(question.heading), prompt: normalizeSourceText(question.prompt) };
}

/**
 * The ONE joined value a hash-form question binds: the normalized heading, a
 * line feed, the normalized prompt. `textSha256` is its SHA-256 (UTF-8,
 * lowercase hex). The two strings must already be normalized.
 */
export function reviewerGuideBoundText(normalized: { readonly heading: string; readonly prompt: string }): string {
  return `${normalized.heading}\n${normalized.prompt}`;
}

/**
 * Checks every question of a stored guide against the lines of its paper and
 * returns the guide with text.
 * - The prompt is the question's source lines; the heading is the nearest bold
 *   line above them; both normalized.
 * - Text form: the stored heading and prompt must equal them. The stored
 *   contract itself is returned.
 * - Hash form: the SHA-256 of their joined value (reviewerGuideBoundText) must
 *   equal `textSha256`. The returned guide carries the text read from the paper.
 * - A section anchor must be a stable section id the paper carries.
 * `lines` must be the lines of the exact release artifact: the caller proves
 * that. `sha256Hex` is called for hash-form questions only.
 */
export function resolveReviewerGuideAgainstLines(binding: ReviewerGuideBinding, lines: readonly string[], sha256Hex: (text: string) => string): ReviewerGuideContract {
  const questions = binding.questions.map((question): ReviewerGuideQuestion => {
    const [start, end] = question.sourceLines;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) fail(`source range ${question.number}`);
    const prompt = normalizeSourceText(lines.slice(start - 1, end).join(' '));
    const sourceHeading = lines.slice(0, start - 1).reverse().find((line) => /^\s*\*\*.+\*\*\s*$/.test(line));
    const heading = sourceHeading === undefined ? null : normalizeSourceHeading(sourceHeading);
    let resolved: ReviewerGuideQuestion;
    if (question.textSha256 === undefined) {
      if (prompt !== normalizeSourceText(question.prompt)) fail(`prompt source ${question.number}`);
      if (heading === null || heading !== normalizeSourceHeading(question.heading)) fail(`heading source ${question.number}`);
      resolved = question;
    } else {
      if (heading === null) fail(`heading source ${question.number}`);
      if (sha256Hex(reviewerGuideBoundText({ heading, prompt })) !== question.textSha256) fail(`text SHA-256 ${question.number}`);
      // A new object with its own arrays: the caller may freeze it without touching the stored contract.
      const { textSha256: _textSha256, ...identity } = question;
      resolved = { ...identity, sourceLines: [start, end], ...(question.sectionAnchors ? { sectionAnchors: [...question.sectionAnchors] } : {}), heading, prompt };
    }
    // A successor question's section anchors must be stable section ids this paper really carries.
    for (const anchor of question.sectionAnchors ?? []) {
      const legacyAnchor = lines.includes(`<div id="${anchor}" class="section-anchor"></div>`);
      const pandocAnchor = lines.some((line) => /^#{1,6} .+ \{#[A-Za-z][A-Za-z0-9_-]*(?: \.[A-Za-z][A-Za-z0-9_-]*)*\}[ \t]*$/.test(line)
        && new RegExp(`\\{#${anchor}(?: |\\})`).test(line));
      if (!legacyAnchor && !pandocAnchor) fail(`section anchor source ${question.number}`);
    }
    return resolved;
  });
  if (questions.every((question, index) => question === binding.questions[index])) return binding as ReviewerGuideContract;
  return { ...binding, questions };
}

async function sha256Text(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('Web Crypto is unavailable for paper authentication');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Authenticates every prompt, heading and source range of a guide WITH text
 * against the exact bytes of the release the guide itself names. The paper text
 * must be that release's artifact, byte for byte, or nothing authenticates.
 */
export async function authenticateReviewerGuideAgainstPaper(
  contract: ReviewerGuideContract,
  paperText: string,
): Promise<void> {
  // Re-validate the contract shape so an empty (or otherwise malformed)
  // question list can never authenticate vacuously.
  validateReviewerGuideContract(contract, contract.releaseIdentity);
  const release = getPaperRelease(contract.releaseIdentity);
  if (!release) fail('release identity');
  if (new TextEncoder().encode(paperText).byteLength !== release.bytes) fail('paper byte length');
  if (await sha256Text(paperText) !== release.sha256) fail('paper SHA-256');
  if (paperText.charCodeAt(0) === 0xfeff || paperText.includes('\r')) fail('paper encoding or line endings');
  resolveReviewerGuideAgainstLines(contract, paperText.split('\n'), () => fail('question text form'));
}

export function reviewerGuidePrompts(): readonly string[] {
  return getReviewerGuideContract().questions.map((question) => question.prompt);
}
