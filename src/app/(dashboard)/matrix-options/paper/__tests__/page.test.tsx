import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import MatrixOptionsPaperResolverPage from '../page';
import { REVISED_PAPER_ROUTE } from '@/lib/matrix-options/revised-paper';

describe('/matrix-options/paper', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it('redirects directly to the exact authenticated paper version', async () => {
    await expect(MatrixOptionsPaperResolverPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(REVISED_PAPER_ROUTE);
  });
});
