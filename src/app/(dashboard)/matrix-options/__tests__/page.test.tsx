import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
  REVISED_PAPER_VERSION: '1.0.11-remediated-20260913',
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
  documentVersion: '1.0.11-remediated-20260913',
  sha256: 'bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd',
  bytes: 534101,
  releaseIdentity:
    'matrix-options-paper:1.0.11-remediated-20260913:bcc4e4b472d13d12506ece436edf4a4aa6a5bb9ff4724a5478573993183057bd',
  persistenceState: 'DISABLED_PENDING_LIVE_CONTRACT' as const,
  content: 'exact authenticated V16 paper content',
};
const EFFECTIVE_REVIEW_NAVIGATION_VALUE =
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION ?? '<unset>';

async function loadDirectReviewRouteFailClosed() {
  const effectiveValue = process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION ?? '<unset>';
  if (effectiveValue === 'true') {
    throw new Error('Review Navigation must be non-exact-true for Unit 0A');
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

  it('records the effective Review Navigation value and requires it to be non-exact-true', () => {
    expect(EFFECTIVE_REVIEW_NAVIGATION_VALUE).not.toBe('true');
    expect(EFFECTIVE_REVIEW_NAVIGATION_VALUE).toBe('<unset>');
  });

  it('fails closed before importing direct-review code when Review Navigation is exact true', async () => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', 'true');

    await expect(loadDirectReviewRouteFailClosed()).rejects.toThrow(
      'Review Navigation must be non-exact-true for Unit 0A',
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('routes unchanged direct review through the real-paper resolver before Candidate-015 loads or requests', async () => {
    vi.stubEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', 'true');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { effectiveValue, route } = await loadDirectReviewRouteFailClosed();

    await expect(
      route({
        params: Promise.resolve({ documentVersion: PAPER_RELEASE.documentVersion }),
        searchParams: Promise.resolve({ scenario: 'must-remain-unread' }),
      }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(effectiveValue).toBe(EFFECTIVE_REVIEW_NAVIGATION_VALUE);
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
