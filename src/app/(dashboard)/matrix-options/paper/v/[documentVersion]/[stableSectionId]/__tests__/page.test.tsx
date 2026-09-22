import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notFoundMock, redirectMock, loadStructureSpy } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn((_url: string) => {
    throw new Error('NEXT_REDIRECT');
  }),
  loadStructureSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock('@/lib/matrix-options/revised-paper-structure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  loadStructureSpy.mockImplementation(actual.loadRevisedPaperStructure);
  return { ...actual, loadRevisedPaperStructure: loadStructureSpy };
});

import PaperSectionPage from '../page';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';
import { MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';
import { buildLegacyAnchorMap } from '@/lib/matrix-options/paper/full-document';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';

const priorWorkspaceValue = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
const priorNavigationValue = process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv('MATRIX_OPTIONS_PAPER_WORKSPACE', priorWorkspaceValue);
  restoreEnv('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', priorNavigationValue);
});

function visit(stableSectionId: string, documentVersion: string = REVISED_PAPER_VERSION) {
  return PaperSectionPage({ params: Promise.resolve({ documentVersion, stableSectionId }) });
}

function workingDraft(section: string | null) {
  return paperWorkspaceHref(REVISED_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section });
}

describe('/matrix-options/paper/v/[documentVersion]/[stableSectionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it.each([undefined, '', 'false', 'TRUE']) (
    'redirects exact V16 to the legacy real-paper review when the workspace flag is %s, without loading paper structure',
    async (workspaceValue) => {
      if (workspaceValue === undefined) {
        delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
      } else {
        process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspaceValue;
      }

      await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
      expect(loadStructureSpy).not.toHaveBeenCalled();
    },
  );

  it('redirects exact V16 to its version page when only the workspace flag is exact-true, without loading paper structure', async () => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(REVISED_PAPER_ROUTE);
    expect(loadStructureSpy).not.toHaveBeenCalled();
  });

  describe('with both flags exact-true (M1-07)', () => {
    beforeEach(() => {
      process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
      process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
    });

    it('keeps a heading anchor as the canonical Working Draft section', async () => {
      const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
      const anchor = actual.loadRevisedPaperStructure().nodes[5].anchor;
      await expect(visit(anchor)).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).toHaveBeenCalledWith(workingDraft(anchor));
      expect(workingDraft(anchor)).toContain('section=');
    });

    it('maps a legacy section-anchor id (raw or percent-encoded) to its heading anchor', async () => {
      const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
      const legacy = Object.entries(buildLegacyAnchorMap(actual.loadRevisedPaperStructure())).find(([id, anchor]) => id !== anchor);
      expect(legacy).toBeDefined();
      if (!legacy) return;
      const [legacyId, anchor] = legacy;
      await expect(visit(legacyId)).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenLastCalledWith(workingDraft(anchor));
      await expect(visit(encodeURIComponent(legacyId).replace(/-/g, '%2D'))).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenLastCalledWith(workingDraft(anchor));
    });

    it.each(['ignored-old-id', '%E0%A4%A', '__proto__'])('lands an unknown or malformed id (%s) on the Working Draft without a section', async (stableSectionId) => {
      await expect(visit(stableSectionId)).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).toHaveBeenCalledWith(workingDraft(null));
      expect(notFoundMock).not.toHaveBeenCalled();
    });
  });

  it.each(['slice-1a-fixture-v1', 'unknown']) (
    'fails closed before the flag branch for non-V16 version %s',
    async (documentVersion) => {
      for (const workspaceValue of ['false', 'true']) {
        vi.clearAllMocks();
        process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspaceValue;
        process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = workspaceValue;
        await expect(visit('any-id', documentVersion)).rejects.toThrow('NEXT_NOT_FOUND');
        expect(redirectMock).not.toHaveBeenCalled();
        expect(loadStructureSpy).not.toHaveBeenCalled();
      }
    },
  );

  it('contains no synthetic reader, provider or fixture, and loads paper structure only after both gate redirects', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/(dashboard)/matrix-options/paper/v/[documentVersion]/[stableSectionId]/page.tsx',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/PaperSectionReader|paper\/provider|synthetic-fixture/);
    const resolverGate = source.indexOf("gate === 'PAPER_RESOLVER'");
    const structureLoad = source.indexOf('loadRevisedPaperStructure()');
    expect(resolverGate).toBeGreaterThan(0);
    expect(structureLoad).toBeGreaterThan(resolverGate);
    expect(source).toContain('resolveLegacySectionAnchor(');
  });
});
