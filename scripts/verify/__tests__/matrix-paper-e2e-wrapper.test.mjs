import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { assertMatrixPaperE2EPlan, buildMatrixPaperE2EPlan } from '../matrix-paper-e2e-plan.mjs';

describe('Matrix Paper E2E wrapper plan', () => {
  it('requires and binds the Appendix L leg for the local owner run', () => {
    const plan = buildMatrixPaperE2EPlan({ cwd: 'C:/workspace', githubActions: false });
    assertMatrixPaperE2EPlan(plan);
    expect(plan.map((leg) => leg.id)).toEqual(['flags-off', 'authenticated-v16', 'appendix-l-inclusion']);
    expect(plan[2].overrides.MATRIX_PAPER_PRIVATE_FIXTURE).toBe('required');
    expect(plan[2].overrides.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR).toBe(path.resolve('C:/workspace', 'candidate', 'paper'));
    expect(plan[2].args).toContain('e2e/matrix-options-paper.spec.ts');
    expect(plan[2].args).toContain('--project=chromium-auth');
    expect(plan[2].args).toContain('v0.9.91 Appendix L inclusion');
  });

  it('keeps the public CI leg explicit and private-byte free', () => {
    const plan = buildMatrixPaperE2EPlan({ cwd: 'C:/workspace', githubActions: true });
    assertMatrixPaperE2EPlan(plan);
    expect(plan[2].overrides.MATRIX_PAPER_PRIVATE_FIXTURE).toBe('skip');
    expect(plan[2].overrides.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR).toBe('');
  });

  it('fails when the required Appendix L leg is removed', () => {
    const plan = buildMatrixPaperE2EPlan({ cwd: 'C:/workspace', githubActions: false });
    expect(() => assertMatrixPaperE2EPlan(plan.slice(0, 2))).toThrow('must run flags-off, authenticated V16, and Appendix L inclusion legs');
  });
});
