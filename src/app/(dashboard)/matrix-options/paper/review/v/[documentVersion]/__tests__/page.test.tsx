import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((_url: string) => { throw new Error('NEXT_REDIRECT'); }),
  notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));

import ReviewVersionPage from '../page';
import ReviewAssignmentPage from '../assignments/[assignmentId]/page';
import ReviewPacketPage from '../assignments/[assignmentId]/packets/[packetId]/page';
import ReviewItemPage from '../assignments/[assignmentId]/packets/[packetId]/items/[reviewItemId]/page';

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const canonicalWorkingDraft = `/matrix-options/paper/publication/v/${version}?mode=working-draft`;

const routes = (documentVersion: string) => [
  ['review version', () => ReviewVersionPage({ params: Promise.resolve({ documentVersion }), searchParams: Promise.resolve({ mode: 'my-review', lens: 'all', page: '1' }) })],
  ['assignment', () => ReviewAssignmentPage({ params: Promise.resolve({ documentVersion, assignmentId: 'assignment' }) })],
  ['packet', () => ReviewPacketPage({ params: Promise.resolve({ documentVersion, assignmentId: 'assignment', packetId: 'packet' }) })],
  ['item', () => ReviewItemPage({ params: Promise.resolve({ documentVersion, assignmentId: 'assignment', packetId: 'packet', reviewItemId: 'item' }) })],
] as const;

async function expectEveryRouteRedirectsTo(target: string) {
  for (const [name, route] of routes(version)) {
    redirectMock.mockClear();
    await expect(route(), name).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock, name).toHaveBeenCalledTimes(1);
    expect(redirectMock, name).toHaveBeenCalledWith(target);
  }
}

describe('paper review V16 legacy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  it('R2-01: with both flags on, every legacy review route lands on the canonical Working Draft URL', async () => {
    await expectEveryRouteRedirectsTo(canonicalWorkingDraft);
  });

  it('keeps the exact flags-off legacy and resolver redirects', async () => {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    await expectEveryRouteRedirectsTo('/matrix-options?view=TWG%20Review');
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
    await expectEveryRouteRedirectsTo('/matrix-options/paper');
  });

  it.each(['unknown', 'slice-1a-fixture-v1'])('fails closed for non-real version %s on every review route', async (documentVersion) => {
    for (const [name, route] of routes(documentVersion)) {
      notFoundMock.mockClear();
      redirectMock.mockClear();
      await expect(route(), name).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFoundMock, name).toHaveBeenCalledTimes(1);
      expect(redirectMock, name).not.toHaveBeenCalled();
    }
  });

  it('R2-01: only the canonical publication route renders the workspace, and its My Review branch always passes cohort portions', () => {
    const root = path.resolve(process.cwd(), 'src/app/(dashboard)/matrix-options/paper');
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== '__tests__') walk(full);
        } else if (name === 'page.tsx') {
          pages.push(full);
        }
      }
    };
    walk(root);
    const renderers = pages.filter((file) => readFileSync(file, 'utf8').includes('RevisedPaperWorkspace')).map((file) => path.relative(root, file).split(path.sep).join('/'));
    expect(renderers).toEqual(['publication/v/[documentVersion]/page.tsx']);
    const publication = readFileSync(path.join(root, 'publication', 'v', '[documentVersion]', 'page.tsx'), 'utf8');
    expect(publication).toMatch(/if \(state\.mode === 'my-review'\) \{\s*return <RevisedPaperWorkspace [^>]*cohortPortions=\{cohortPortions\}/);
    expect(publication.match(/<RevisedPaperWorkspace /g)).toHaveLength(2);
  });

  it('keeps review routes free of Candidate-015 and legacy workspace imports', () => {
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
      expect(source).not.toContain('RevisedPaperWorkspace');
      expect(source).not.toContain('createWorkspaceModel');
    }
  });
});
