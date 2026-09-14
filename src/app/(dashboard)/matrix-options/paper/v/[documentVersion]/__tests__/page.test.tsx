import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadMock, notFoundMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
}));
vi.mock('@/lib/matrix-options/revised-paper', () => ({
  loadRevisedPaper: loadMock,
  REVISED_PAPER_VERSION: '1.0.11-remediated-20260913',
  RevisedPaperUnavailableError: class RevisedPaperUnavailableError extends Error {},
}));
vi.mock('@/components/TWGReviewPortal', () => ({
  default: ({
    finalDraftContent,
    paperRelease,
  }: {
    finalDraftContent: string;
    paperRelease: { releaseIdentity: string; persistenceState: string };
  }) => (
    <div
      data-testid="portal"
      data-content={finalDraftContent}
      data-release={paperRelease.releaseIdentity}
      data-persistence={paperRelease.persistenceState}
    />
  ),
}));

import PaperVersionPage from '../page';

const paper = {
  content: '# Exact paper',
  documentVersion: '1.0.11-remediated-20260913',
  sha256: 'bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd',
  bytes: 534101,
  releaseIdentity:
    'matrix-options-paper:1.0.11-remediated-20260913:bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd',
  persistenceState: 'DISABLED_PENDING_LIVE_CONTRACT',
};

describe('/matrix-options/paper/v/[documentVersion]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMock.mockReturnValue(paper);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it('loads only the exact version and passes the same descriptor to TWGReviewPortal', async () => {
    const result = await PaperVersionPage({
      params: Promise.resolve({ documentVersion: paper.documentVersion }),
    });
    render(result);

    expect(loadMock).toHaveBeenCalledWith(paper.documentVersion);
    expect(screen.getByTestId('portal')).toHaveAttribute('data-content', paper.content);
    expect(screen.getByTestId('portal')).toHaveAttribute(
      'data-release',
      paper.releaseIdentity,
    );
    expect(screen.getByTestId('portal')).toHaveAttribute(
      'data-persistence',
      'DISABLED_PENDING_LIVE_CONTRACT',
    );
  });

  it.each([undefined, 'slice-1a-fixture-v1', 'unknown']) (
    'fails closed for an absent or unknown version: %s',
    async (documentVersion) => {
      await expect(
        PaperVersionPage({
          params: Promise.resolve({ documentVersion: documentVersion as string }),
        }),
      ).rejects.toThrow('NEXT_NOT_FOUND');
      expect(loadMock).not.toHaveBeenCalled();
    },
  );
});
