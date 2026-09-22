import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { isMatrixOptionsPaperReviewNavigationEnabled } from '@/lib/matrix-options/navigation';

const {
  createServerClientMock,
  loadRevisedPaperMock,
  redirectMock,
  fetchSamplesMock,
  fetchAggregatesMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  loadRevisedPaperMock: vi.fn(),
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
  fetchSamplesMock: vi.fn(),
  fetchAggregatesMock: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/matrix-map/fetch-samples-server', () => ({
  fetchMatrixMapSamplesServerSide: fetchSamplesMock,
}));
vi.mock('@/lib/matrix-map/fetch-site-aggregates-server', () => ({
  fetchMatrixMapSiteAggregatesServerSide: fetchAggregatesMock,
}));
vi.mock('@/lib/matrix-options/revised-paper', () => ({
  loadRevisedPaper: loadRevisedPaperMock,
  REVISED_PAPER_VERSION: '1.0.11-remediated-7-8-successor-20260918-D',
}));
vi.mock('@/components/MatrixDashboard', () => ({
  default: ({
    paperRelease,
    initialViewId,
    paperWorkspaceEnabled,
  }: {
    paperRelease: {
      content: string;
      documentVersion: string;
      sha256: string;
      releaseIdentity: string;
      persistenceState: string;
    };
    initialViewId: string;
    paperWorkspaceEnabled: boolean;
  }) => (
    <div
      data-testid="matrix-dashboard-mock"
      data-document-version={paperRelease.documentVersion}
      data-sha256={paperRelease.sha256}
      data-release-identity={paperRelease.releaseIdentity}
      data-persistence-state={paperRelease.persistenceState}
      data-initial-view={initialViewId}
      data-workspace-enabled={String(paperWorkspaceEnabled)}
    >
      {paperRelease.content}
    </div>
  ),
}));
import MatrixOptionsPage from '../page';

const PAPER_RELEASE = {
  documentVersion: '1.0.11-remediated-7-8-successor-20260918-D',
  sha256: 'feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337',
  bytes: 541959,
  releaseIdentity:
    'matrix-options-paper:1.0.11-remediated-7-8-successor-20260918-D:feb62bd63c46f9b799a705da9ccb6db41974512ca4c73d9582111eeb3ae47337',
  persistenceState: 'DISABLED_PENDING_LIVE_CONTRACT' as const,
  content: 'exact authenticated V16 paper content',
};
async function loadDirectReviewRouteFailClosed() {
  const rawValue = process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  const effectiveValue = rawValue ?? '<unset>';
  // Absence now enables Review Navigation, so the guard uses the production
  // helper rather than an exact-'true' check.
  if (isMatrixOptionsPaperReviewNavigationEnabled(rawValue)) {
    throw new Error('Review Navigation must be disabled for Unit 0A');
  }

  const route = await import('../paper/review/v/[documentVersion]/page');
  return { effectiveValue, route: route.default };
}

describe('Matrix Options main page revised-paper integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadRevisedPaperMock.mockReturnValue(PAPER_RELEASE);
    createServerClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each([
    ['disabled', 'false'],
    ['exact true', 'true'],
  ])('passes the identical V16 descriptor with workspace flag %s', async (_label, flag) => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', flag);

    render(
      await MatrixOptionsPage({
        searchParams: Promise.resolve({ view: 'The Guide' }),
      }),
    );

    const dashboard = screen.getByTestId('matrix-dashboard-mock');
    expect(loadRevisedPaperMock).toHaveBeenCalledWith(PAPER_RELEASE.documentVersion);
    expect(dashboard).toHaveTextContent(PAPER_RELEASE.content);
    expect(dashboard).toHaveAttribute('data-document-version', PAPER_RELEASE.documentVersion);
    expect(dashboard).toHaveAttribute('data-sha256', PAPER_RELEASE.sha256);
    expect(dashboard).toHaveAttribute('data-release-identity', PAPER_RELEASE.releaseIdentity);
    expect(dashboard).toHaveAttribute(
      'data-persistence-state',
      'DISABLED_PENDING_LIVE_CONTRACT',
    );
    expect(dashboard).toHaveAttribute('data-workspace-enabled', flag);
  });

  it('redirects the workspace-enabled Review view through the real paper resolver', async () => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', 'true');

    await expect(
      MatrixOptionsPage({
        searchParams: Promise.resolve({ view: 'TWG Review' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(loadRevisedPaperMock).toHaveBeenCalledWith(PAPER_RELEASE.documentVersion);
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('redirects the Review view to the revised workspace when both paper flags are absent', async () => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', undefined);
    vi.stubEnv('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', undefined);

    await expect(
      MatrixOptionsPage({
        searchParams: Promise.resolve({ view: 'TWG Review' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it('contains no legacy-paper or Candidate-015 content fallback', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', '(dashboard)', 'matrix-options', 'page.tsx'),
      'utf8',
    );

    expect(source).not.toContain('BC_Matrix_Options_Paper_FINAL_DRAFT.md');
    expect(source).not.toContain('slice-1a-fixture-v1');
    expect(source).not.toContain('Candidate-015');
    expect(source).not.toContain('Error loading final paper.');
  });

  it.each([
    ['absent', undefined],
    ['exact true', 'true'],
  ])('fails closed before importing direct-review code when Review Navigation is %s', async (_label, value) => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', value);

    await expect(loadDirectReviewRouteFailClosed()).rejects.toThrow(
      'Review Navigation must be disabled for Unit 0A',
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('routes unchanged direct review through the real-paper resolver before Candidate-015 loads or requests', async () => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', 'true');
    vi.stubEnv('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', 'false');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { effectiveValue, route } = await loadDirectReviewRouteFailClosed();

    await expect(
      route({
        params: Promise.resolve({ documentVersion: PAPER_RELEASE.documentVersion }),
        searchParams: Promise.resolve({ scenario: 'must-remain-unread' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(effectiveValue).toBe('false');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
    expect(fetchSpy).not.toHaveBeenCalled();

    const directRouteSource = fs.readFileSync(
      path.join(
        process.cwd(),
        'src',
        'app',
        '(dashboard)',
        'matrix-options',
        'paper',
        'review',
        'v',
        '[documentVersion]',
        'page.tsx',
      ),
      'utf8',
    );
    expect(directRouteSource).not.toContain('synthetic-fixture');
    expect(directRouteSource).not.toContain('slice-1a-fixture-v1');
    expect(directRouteSource).not.toContain('@/components/matrix-options/paper/ReviewNavigation');
    expect(directRouteSource).not.toContain('@/lib/matrix-options/paper/review-navigation');
    expect(directRouteSource).not.toContain('Candidate-015');
  });
});
