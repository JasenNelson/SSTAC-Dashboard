import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isLocalR2PreviewRequest } from '../r2-review-preview-source';

afterEach(() => { vi.unstubAllEnvs(); });

it('opens the R2 preview only in explicitly enabled local development', () => {
  const local = new Headers({ host: '127.0.0.1:3100' });
  const remote = new Headers({ host: 'example.org' });
  const forged = new Headers({ host: '127.0.0.1:3100', 'x-forwarded-host': 'example.org' });
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '1');
  expect(isLocalR2PreviewRequest(local)).toBe(true);
  expect(isLocalR2PreviewRequest(remote)).toBe(false);
  expect(isLocalR2PreviewRequest(forged)).toBe(false);
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '0');
  expect(isLocalR2PreviewRequest(local)).toBe(false);
  vi.stubEnv('MATRIX_R2_REVIEW_PREVIEW', '1');
  vi.stubEnv('NODE_ENV', 'production');
  expect(isLocalR2PreviewRequest(local)).toBe(false);
});
