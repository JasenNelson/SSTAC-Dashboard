import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadMock, notFoundMock, redirectMock } = vi.hoisted(() => ({
  loadMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn((_url: string) => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));
vi.mock('@/lib/matrix-options/revised-paper', () => ({
  loadRevisedPaper: loadMock,
  REVISED_PAPER_VERSION: '1.0.11-remediated-7-8-successor-20260918-D',
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
  documentVersion: '1.0.11-remediated-7-8-successor-20260918-D',
  sha256: 'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337',
  bytes: 541959,
  releaseIdentity:
    'matrix-options-paper:1.0.11-remediated-7-8-successor-20260918-D:feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337',
  persistenceState: 'DISABLED_PENDING_LIVE_CONTRACT',
};

describe('/matrix-options/paper/v/[documentVersion]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMock.mockReturnValue(paper);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it('R2-01: with both flags on, lands on the canonical Working Draft URL without rendering a workspace', async () => {
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';

    await expect(
      PaperVersionPage({
        params: Promise.resolve({ documentVersion: paper.documentVersion }),
        searchParams: Promise.resolve({ mode: 'my-review', page: '2' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper/publication/v/1.0.11-remediated-7-8-successor-20260918-D?mode=working-draft');
    expect(loadMock).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('redirects to the legacy TWG Review when the workspace flag is off', async () => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false';
    await expect(PaperVersionPage({ params: Promise.resolve({ documentVersion: paper.documentVersion }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
  });

  it('loads only the exact version and passes the same descriptor to TWGReviewPortal', async () => {
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false';
    const result = await PaperVersionPage({
      params: Promise.resolve({ documentVersion: paper.documentVersion }),
    });
    render(result as React.ReactElement);

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
