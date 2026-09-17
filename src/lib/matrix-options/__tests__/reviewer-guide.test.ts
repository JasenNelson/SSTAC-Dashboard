import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import guideContract from '../paper/contracts/reviewer-guide-v1.json';
import { authenticateReviewerGuideAgainstPaper, getReviewerGuideContract, REVIEW_GUIDE_SOURCE_PATH, validateReviewerGuideContract } from '../reviewer-guide';

describe('reviewer guide contract', () => {
  it('exposes the twelve authenticated source questions with stable IDs', () => {
    const contract = getReviewerGuideContract();
    expect(contract.questions).toHaveLength(12);
    expect(contract.questions.map((question) => question.id)).toEqual(
      Array.from({ length: 12 }, (_, index) => `rpq:1.0.11-remediated-20260913:q${String(index + 1).padStart(2, '0')}`),
    );
    expect(contract.questions[3].prompt).toContain('$4 \\times 4 = 16');
    expect(contract.questions[10].sourceLines).toEqual([219, 220]);
  });

  it('fails closed for malformed or synthetic contracts', () => {
    expect(() => validateReviewerGuideContract({ ...guideContract, questions: [] })).toThrow(/question count/);
    expect(() => validateReviewerGuideContract({ ...guideContract, releaseIdentity: 'slice-1a-fixture-v1' })).toThrow(/release identity/);
  });

  it('F-05: fails closed for a wrong or missing source path and malformed question entries', () => {
    expect(getReviewerGuideContract().sourcePath).toBe(REVIEW_GUIDE_SOURCE_PATH);
    expect(() => validateReviewerGuideContract({ ...guideContract, sourcePath: 'matrix_research/options_paper/other-release.md' })).toThrow(/source path/);
    const withoutPath: Record<string, unknown> = { ...guideContract };
    delete withoutPath.sourcePath;
    expect(() => validateReviewerGuideContract(withoutPath)).toThrow(/source path/);
    const withQuestion = (index: number, replacement: unknown) => ({ ...guideContract, questions: guideContract.questions.map((question, position) => (position === index ? replacement : question)) });
    expect(() => validateReviewerGuideContract(withQuestion(2, null))).toThrow(/question shape/);
    expect(() => validateReviewerGuideContract(withQuestion(2, ['not', 'a', 'question']))).toThrow(/question shape/);
    expect(() => validateReviewerGuideContract(withQuestion(2, { ...guideContract.questions[2], sourceLines: null }))).toThrow(/source range 3/);
    expect(() => validateReviewerGuideContract(withQuestion(2, { ...guideContract.questions[2], prompt: 42 }))).toThrow(/question 3/);
    expect(() => validateReviewerGuideContract(withQuestion(2, { ...guideContract.questions[2], heading: ['Heading'] }))).toThrow(/question 3/);
  });

  it('authenticates every prompt, heading, range, and paper SHA against the real release', async () => {
    const paperText = readFileSync(resolve(process.cwd(), 'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md'), 'utf8');
    const contract = getReviewerGuideContract();
    await expect(authenticateReviewerGuideAgainstPaper(contract, paperText)).resolves.toBeUndefined();
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: contract.questions.map((question, index) => index === 0 ? { ...question, prompt: `${question.prompt} altered` } : question) }, paperText)).rejects.toThrow(/prompt source/);
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: contract.questions.map((question, index) => index === 0 ? { ...question, heading: 'Wrong heading' } : question) }, paperText)).rejects.toThrow(/heading source/);
    await expect(authenticateReviewerGuideAgainstPaper(contract, `${paperText.slice(0, -1)} `)).rejects.toThrow(/paper byte length|paper SHA-256/);
  });

  it('never authenticates an empty question list vacuously', async () => {
    const paperText = readFileSync(resolve(process.cwd(), 'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md'), 'utf8');
    const contract = getReviewerGuideContract();
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: [] }, paperText)).rejects.toThrow(/question count/);
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: contract.questions.slice(0, 1) }, paperText)).rejects.toThrow(/question count/);
  });
});
