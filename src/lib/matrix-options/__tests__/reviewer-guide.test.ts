import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import guideContract from '../paper/contracts/reviewer-guide-v1.json';
import { authenticateReviewerGuideAgainstPaper, getReviewerGuideContract, validateReviewerGuideContract } from '../reviewer-guide';

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

  it('authenticates every prompt, heading, range, and paper SHA against the real release', async () => {
    const paperText = readFileSync(resolve(process.cwd(), 'matrix_research/options_paper/BC_Matrix_Options_Paper_v1.0.11-remediated-20260913.md'), 'utf8');
    const contract = getReviewerGuideContract();
    await expect(authenticateReviewerGuideAgainstPaper(contract, paperText)).resolves.toBeUndefined();
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: contract.questions.map((question, index) => index === 0 ? { ...question, prompt: `${question.prompt} altered` } : question) }, paperText)).rejects.toThrow(/prompt source/);
    await expect(authenticateReviewerGuideAgainstPaper({ ...contract, questions: contract.questions.map((question, index) => index === 0 ? { ...question, heading: 'Wrong heading' } : question) }, paperText)).rejects.toThrow(/heading source/);
    await expect(authenticateReviewerGuideAgainstPaper(contract, `${paperText.slice(0, -1)} `)).rejects.toThrow(/paper byte length|paper SHA-256/);
  });
});
