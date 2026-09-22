import guideContract from './paper/contracts/reviewer-guide-v1.json';

export const REVIEW_GUIDE_RELEASE_IDENTITY = '1.0.11-remediated-7-8-successor-20260918-D' as const;
/** The guide questions are authenticated against this exact release file (F-05). */
export const REVIEW_GUIDE_SOURCE_PATH = 'candidate/paper/BC_Matrix_Options_Paper_v1.0.11-remediated-7-8-successor-20260918-D.md' as const;
const AUTHORITATIVE_PAPER_BYTES = 541959;
const AUTHORITATIVE_PAPER_SHA256 = 'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337';

export interface ReviewerGuideQuestion {
  readonly number: number;
  readonly id: string;
  readonly sourceLines: readonly [number, number];
  readonly heading: string;
  readonly prompt: string;
}

export interface ReviewerGuideContract {
  readonly schemaVersion: 'matrix-paper-reviewer-guide-v1';
  readonly releaseIdentity: typeof REVIEW_GUIDE_RELEASE_IDENTITY;
  readonly sourcePath: string;
  readonly questions: readonly ReviewerGuideQuestion[];
}

function fail(message: string): never {
  throw new Error(`Invalid reviewer guide contract: ${message}`);
}

export function validateReviewerGuideContract(candidate: unknown): ReviewerGuideContract {
  if (!candidate || typeof candidate !== 'object') fail('object');
  const contract = candidate as ReviewerGuideContract;
  if (contract.schemaVersion !== 'matrix-paper-reviewer-guide-v1') fail('schema version');
  if (contract.releaseIdentity !== REVIEW_GUIDE_RELEASE_IDENTITY) fail('release identity');
  if (contract.sourcePath !== REVIEW_GUIDE_SOURCE_PATH) fail('source path');
  if (!Array.isArray(contract.questions) || contract.questions.length !== 12) fail('question count');
  if ((contract.questions as readonly unknown[]).some((question) => !question || typeof question !== 'object' || Array.isArray(question))) fail('question shape');
  const numbers = contract.questions.map((question) => question.number);
  if (numbers.some((number, index) => number !== index + 1)) fail('question numbering');
  for (const question of contract.questions) {
    const expectedId = `rpq:${REVIEW_GUIDE_RELEASE_IDENTITY}:q${String(question.number).padStart(2, '0')}`;
    if (question.id !== expectedId || typeof question.prompt !== 'string' || !question.prompt || typeof question.heading !== 'string' || !question.heading) fail(`question ${question.number}`);
    const sourceLines: unknown = question.sourceLines;
    if (!Array.isArray(sourceLines) || sourceLines.length !== 2 || !Number.isInteger(sourceLines[0]) || !Number.isInteger(sourceLines[1]) || sourceLines[0] < 1 || sourceLines[0] > sourceLines[1]) fail(`source range ${question.number}`);
  }
  return contract;
}

export function getReviewerGuideContract(): ReviewerGuideContract {
  return validateReviewerGuideContract(guideContract);
}

function normalizeSourceText(value: string): string {
  return value.replace(/^\s*\d+\.\s*/, '').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
}

function normalizeSourceHeading(value: string): string {
  return value.replace(/^\s*\*\*|\*\*\s*$/g, '').replace(/\s+/g, ' ').trim();
}

async function sha256Text(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('Web Crypto is unavailable for paper authentication');
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function authenticateReviewerGuideAgainstPaper(
  contract: ReviewerGuideContract,
  paperText: string,
): Promise<void> {
  // Re-validate the contract shape so an empty (or otherwise malformed)
  // question list can never authenticate vacuously.
  validateReviewerGuideContract(contract);
  if (new TextEncoder().encode(paperText).byteLength !== AUTHORITATIVE_PAPER_BYTES) fail('paper byte length');
  if (await sha256Text(paperText) !== AUTHORITATIVE_PAPER_SHA256) fail('paper SHA-256');
  if (paperText.charCodeAt(0) === 0xfeff || paperText.includes('\r')) fail('paper encoding or line endings');
  const lines = paperText.split('\n');
  for (const question of contract.questions) {
    const [start, end] = question.sourceLines;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lines.length) fail(`source range ${question.number}`);
    const actualPrompt = normalizeSourceText(lines.slice(start - 1, end).join(' '));
    if (actualPrompt !== normalizeSourceText(question.prompt)) fail(`prompt source ${question.number}`);
    const sourceHeading = lines.slice(0, start - 1).reverse().find((line) => /^\s*\*\*.+\*\*\s*$/.test(line));
    if (!sourceHeading || normalizeSourceHeading(sourceHeading) !== normalizeSourceHeading(question.heading)) fail(`heading source ${question.number}`);
  }
}

export function reviewerGuidePrompts(): readonly string[] {
  return getReviewerGuideContract().questions.map((question) => question.prompt);
}
