import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const { redirectMock, notFoundMock, workspaceMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  workspaceMock: vi.fn(() => <div data-testid="revised-workspace" />),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/components/matrix-options/paper/RevisedPaperWorkspace', () => ({ RevisedPaperWorkspace: workspaceMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', () => ({ loadRevisedPaperStructure: vi.fn(() => ({ manifest: { source: { version: '1.0.11-remediated-20260913' } }, releaseIdentity: 'release', nodes: [], objects: [], questions: [], lenses: { all: [], core: [], appendices: [], evidence: [], objects: [], questions: [] }, content: '', lines: [], questionContainerIds: [] })) }));

import ReviewVersionPage from '../page';
import ReviewAssignmentPage from '../assignments/[assignmentId]/page';
import ReviewPacketPage from '../assignments/[assignmentId]/packets/[packetId]/page';
import ReviewItemPage from '../assignments/[assignmentId]/packets/[packetId]/items/[reviewItemId]/page';

const version = '1.0.11-remediated-20260913';

describe('paper review V16 route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  it('renders the real workspace in My Review mode with canonical query defaults', async () => {
    const result = await ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) });
    expect(result).toBeTruthy();
  });

  it('redirects before workspace import when either gate is disabled', async () => {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
    redirectMock.mockClear();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
    await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
  });

  it.each(['unknown', 'slice-1a-fixture-v1'])('notFound for non-real version %s', async (documentVersion) => {
    await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('keeps the exact three-state route boundary across the review version and child routes', async () => {
    const childRoutes = [
      () => ReviewAssignmentPage({ params: Promise.resolve({ documentVersion: version, assignmentId: 'assignment' }) }),
      () => ReviewPacketPage({ params: Promise.resolve({ documentVersion: version, assignmentId: 'assignment', packetId: 'packet' }) }),
      () => ReviewItemPage({ params: Promise.resolve({ documentVersion: version, assignmentId: 'assignment', packetId: 'packet', reviewItemId: 'item' }) }),
    ] as const;
    const assertLegacyRedirect = async () => {
      redirectMock.mockClear();
      await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
      for (const route of childRoutes) {
        redirectMock.mockClear();
        await expect(route()).rejects.toThrow('NEXT_REDIRECT');
        expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
      }
    };
    const assertResolverRedirect = async () => {
      redirectMock.mockClear();
      await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
      for (const route of childRoutes) {
        redirectMock.mockClear();
        await expect(route()).rejects.toThrow('NEXT_REDIRECT');
        expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper');
      }
    };

    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    await assertLegacyRedirect();

    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
    await assertResolverRedirect();

    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
    const result = await ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) });
    expect((result as { type: unknown }).type).toBe(workspaceMock);
    for (const route of childRoutes) {
      redirectMock.mockClear();
      await expect(route()).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(`/matrix-options/paper/review/v/${version}`);
    }
  });

  it('fails closed for unknown versions and invalid review queries without legacy imports', async () => {
    const childRoutes = [
      () => ReviewAssignmentPage({ params: Promise.resolve({ documentVersion: 'unknown', assignmentId: 'assignment' }) }),
      () => ReviewPacketPage({ params: Promise.resolve({ documentVersion: 'unknown', assignmentId: 'assignment', packetId: 'packet' }) }),
      () => ReviewItemPage({ params: Promise.resolve({ documentVersion: 'unknown', assignmentId: 'assignment', packetId: 'packet', reviewItemId: 'item' }) }),
    ] as const;
    for (const route of childRoutes) {
      notFoundMock.mockClear();
      await expect(route()).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFoundMock).toHaveBeenCalledTimes(1);
    }
    notFoundMock.mockClear();
    await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ lens: 'invalid' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    notFoundMock.mockClear();
    await expect(ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: ['my-review', 'publication'] }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);

    const routeSources = [
      'src/app/(dashboard)/matrix-options/paper/review/v/[documentVersion]/page.tsx',
      'src/app/(dashboard)/matrix-options/paper/review/v/[documentVersion]/assignments/[assignmentId]/page.tsx',
      'src/app/(dashboard)/matrix-options/paper/review/v/[documentVersion]/assignments/[assignmentId]/packets/[packetId]/page.tsx',
      'src/app/(dashboard)/matrix-options/paper/review/v/[documentVersion]/assignments/[assignmentId]/packets/[packetId]/items/[reviewItemId]/page.tsx',
    ];
    for (const routeSource of routeSources) {
      const source = readFileSync(path.resolve(process.cwd(), routeSource), 'utf8');
      expect(source).not.toContain('@/lib/matrix-options/paper/ReviewNavigation');
      expect(source).not.toContain('@/lib/matrix-options/paper/review-navigation');
      expect(source).not.toContain('Candidate-015');
    }
  });
});
