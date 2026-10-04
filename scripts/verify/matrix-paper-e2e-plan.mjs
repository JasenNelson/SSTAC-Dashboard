import path from 'node:path';

import { privateFixtureModeForLeg } from './matrix-paper-e2e-fixture-mode.mjs';

const APPENDIX_L_GREP = 'v0.9.91 Appendix L inclusion';

export function buildMatrixPaperE2EPlan({ cwd, githubActions }) {
  const appendixLMode = githubActions
    ? 'skip'
    : privateFixtureModeForLeg('appendix-l-inclusion-only');
  const appendixLOverrides = {
    MATRIX_OPTIONS_PAPER_WORKSPACE: 'true',
    MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true',
    MATRIX_PAPER_PRIVATE_FIXTURE: appendixLMode,
    MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR: githubActions ? '' : path.resolve(cwd, 'candidate', 'paper'),
    E2E_AUTH_ENABLED: 'true',
  };

  return [
    {
      id: 'flags-off',
      label: 'flags-off regression',
      args: [],
      overrides: {
        MATRIX_OPTIONS_PAPER_WORKSPACE: 'false',
        MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'false',
        MATRIX_PAPER_PRIVATE_FIXTURE: privateFixtureModeForLeg('flags-off'),
      },
    },
    {
      id: 'authenticated-v16',
      label: 'real V16 authenticated acceptance',
      args: [
        'e2e/matrix-options-paper.spec.ts',
        '--project=chromium-auth',
        '--grep', 'authenticated real release',
      ],
      overrides: {
        MATRIX_OPTIONS_PAPER_WORKSPACE: 'true',
        MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true',
        MATRIX_PAPER_PRIVATE_FIXTURE: privateFixtureModeForLeg('authenticated-v16'),
        E2E_AUTH_ENABLED: 'true',
      },
    },
    {
      id: 'appendix-l-inclusion',
      label: 'v0.9.91 Appendix L authenticated inclusion',
      args: [
        'e2e/matrix-options-paper.spec.ts',
        '--project=chromium-auth',
        '--grep', APPENDIX_L_GREP,
      ],
      overrides: appendixLOverrides,
    },
  ];
}

export function assertMatrixPaperE2EPlan(plan) {
  const expectedIds = ['flags-off', 'authenticated-v16', 'appendix-l-inclusion'];
  const actualIds = plan.map((leg) => leg.id);
  if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index])) {
    throw new Error('Matrix Paper E2E wrapper must run flags-off, authenticated V16, and Appendix L inclusion legs in order.');
  }

  const appendixL = plan[2];
  if (appendixL.overrides.MATRIX_PAPER_PRIVATE_FIXTURE !== 'required' && appendixL.overrides.MATRIX_PAPER_PRIVATE_FIXTURE !== 'skip') {
    throw new Error('Matrix Paper E2E Appendix L leg must declare required or skip fixture mode.');
  }
  if (appendixL.overrides.MATRIX_PAPER_PRIVATE_FIXTURE === 'required' && !appendixL.overrides.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR) {
    throw new Error('The local Matrix Paper E2E Appendix L leg must bind its private fixture directory.');
  }
  if (appendixL.overrides.MATRIX_PAPER_PRIVATE_FIXTURE === 'skip' && appendixL.overrides.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR) {
    throw new Error('The public Matrix Paper E2E Appendix L leg must not bind a private fixture directory.');
  }
}
