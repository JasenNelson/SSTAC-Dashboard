import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { notFoundMock, redirectMock, loadStructureSpy, requestLoadSpy, privateLoadSpy, createClientMock, getUserMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirectMock: vi.fn((_url: string) => {
    throw new Error('NEXT_REDIRECT');
  }),
  loadStructureSpy: vi.fn(),
  requestLoadSpy: vi.fn(),
  privateLoadSpy: vi.fn(),
  createClientMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

// The request's session client. A page that reaches the loader creates exactly one.
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createClientMock }));

vi.mock('@/lib/matrix-options/revised-paper-structure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  loadStructureSpy.mockImplementation(actual.loadRevisedPaperStructure);
  return { ...actual, loadRevisedPaperStructure: loadStructureSpy };
});

// The real loaders behind spies, so a test can see whether either ran and can make one fail. A
// private-storage release is loaded by loadPrivatePaperStructure, for the reader the page's own check issued.
vi.mock('@/lib/matrix-options/paper/paper-request-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  requestLoadSpy.mockImplementation(actual.loadPaperStructureForRequest);
  privateLoadSpy.mockImplementation(actual.loadPrivatePaperStructure);
  return { ...actual, loadPaperStructureForRequest: requestLoadSpy, loadPrivatePaperStructure: privateLoadSpy };
});

import PaperSectionPage from '../page';
import {
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_VERSION,
} from '@/lib/matrix-options/revised-paper';
import { MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';
import { buildLegacyAnchorMap } from '@/lib/matrix-options/paper/full-document';
import { PrivateReleaseUnavailableError } from '@/lib/matrix-options/paper/private-release-assets';
import { getPaperRelease, PAPER_WITHHELD_NOTICE_ID, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
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

async function resetLoaders() {
  vi.clearAllMocks();
  const structureModule = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  const loaderModule = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  loadStructureSpy.mockImplementation(structureModule.loadRevisedPaperStructure);
  requestLoadSpy.mockImplementation(loaderModule.loadPaperStructureForRequest);
  privateLoadSpy.mockImplementation(loaderModule.loadPrivatePaperStructure);
  getUserMock.mockResolvedValue({ data: { user: { id: '11111111-1111-4111-8111-111111111111', is_anonymous: false } }, error: null });
  createClientMock.mockImplementation(async () => ({ auth: { getUser: getUserMock, getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } }));
}

function visit(stableSectionId: string, documentVersion: string = REVISED_PAPER_VERSION) {
  return PaperSectionPage({ params: Promise.resolve({ documentVersion, stableSectionId }) });
}

function workingDraft(section: string | null) {
  return paperWorkspaceHref(REVISED_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section });
}

describe('/matrix-options/paper/v/[documentVersion]/[stableSectionId]', () => {
  beforeEach(async () => {
    await resetLoaders();
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it.each(['', 'false', 'TRUE']) (
    'redirects exact V16 to the legacy real-paper review when the workspace flag is %s, without loading paper structure',
    async (workspaceValue) => {
      process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspaceValue;

      await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
      expect(loadStructureSpy).not.toHaveBeenCalled();
      expect(createClientMock).not.toHaveBeenCalled();
    },
  );

  it('lands on the canonical Working Draft when both flags are absent', async () => {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
    await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(workingDraft(null));
  });

  it('redirects exact V16 to its version page when only the workspace flag is exact-true, without loading paper structure', async () => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false';
    await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(REVISED_PAPER_ROUTE);
    expect(loadStructureSpy).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
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

    it('serves the default release whatever the session is: its structure comes from the repository loader, with no reader check', async () => {
      // No user at all, an anonymous user and a failing user check: none of them is consulted.
      for (const user of [{ data: { user: null }, error: null }, { data: { user: { id: 'a', is_anonymous: true } }, error: null }, { data: { user: null }, error: new Error('session check failed') }]) {
        getUserMock.mockResolvedValue(user);
        redirectMock.mockClear();
        await expect(visit('ignored-old-id')).rejects.toThrow('NEXT_REDIRECT');
        expect(redirectMock).toHaveBeenCalledWith(workingDraft(null));
      }
      expect(getUserMock).not.toHaveBeenCalled();
      expect(notFoundMock).not.toHaveBeenCalled();
      expect(loadStructureSpy).toHaveBeenCalledWith(REVISED_PAPER_VERSION);
    });

    it('still opens the default release at its own Appendix L: that release withholds nothing', async () => {
      const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
      const anchor = buildLegacyAnchorMap(actual.loadRevisedPaperStructure())['app-l'];
      expect(anchor).toBeDefined();
      await expect(visit('app-l')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(workingDraft(anchor));
      expect(redirectMock.mock.calls[0][0]).not.toContain(PAPER_WITHHELD_NOTICE_ID);
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
        expect(createClientMock).not.toHaveBeenCalled();
      }
    },
  );

  it('contains no synthetic reader, provider or fixture, and loads paper structure only after both gate redirects and the withheld redirect', () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/app/(dashboard)/matrix-options/paper/v/[documentVersion]/[stableSectionId]/page.tsx',
      ),
      'utf8',
    );
    expect(source).not.toMatch(/PaperSectionReader|paper\/provider|synthetic-fixture/);
    const resolverGate = source.indexOf("gate === 'PAPER_RESOLVER'");
    const withheldRedirect = source.indexOf('if (withheld) redirect(');
    // The open paren keeps this off the import line, so it is the first CALL: the one
    // place this page creates a session client or loads anything.
    const structureLoad = source.indexOf('loadPaperStructureForPage(');
    expect(resolverGate).toBeGreaterThan(0);
    expect(withheldRedirect).toBeGreaterThan(resolverGate);
    expect(structureLoad).toBeGreaterThan(withheldRedirect);
    expect(source.match(/loadPaperStructureForPage\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/createAuthenticatedClient|loadRevisedPaperStructure|getUser/);
    expect(source).toContain('resolveLegacySectionAnchor(');
  });
});

describe('a private-storage release on the section route', () => {
  const release = getPaperRelease(R5_PAPER_VERSION)!;
  const noticeUrl = `/matrix-options/paper/publication/v/${R5_PAPER_VERSION}?mode=working-draft#paper-withheld-notice`;

  beforeEach(async () => {
    await resetLoaders();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  it('binds what these tests rely on: the release is private, withholds app-l, and the notice id is the fragment', () => {
    expect(release.delivery).toBe('private-storage');
    expect(release.withheld?.stableSectionId).toBe('app-l');
    expect(PAPER_WITHHELD_NOTICE_ID).toBe('paper-withheld-notice');
  });

  it.each(['app-l', 'app%2Dl', '%61pp-l'])('sends the old address of the withheld section (%s) to the notice, with no session client, no reader check and no load', async (segment) => {
    // Even a request that could read nothing gets the same answer: nothing is consulted.
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    privateLoadSpy.mockRejectedValue(new PrivateReleaseUnavailableError('STATUS'));
    await expect(visit(segment, R5_PAPER_VERSION)).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith(noticeUrl);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it.each([
    ['workspace flag off', 'false', 'true'],
    ['review navigation flag off', 'true', 'false'],
  ])('with %s, the withheld address is not found like every other address of this release, and nothing is consulted', async (_name, workspace, navigation) => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspace;
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = navigation;
    for (const segment of ['app-l', 'sec-7-8']) {
      await expect(visit(segment, R5_PAPER_VERSION)).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(redirectMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['no user', { data: { user: null }, error: null }],
    ['a user check that errored', { data: { user: { id: 'u', is_anonymous: false } }, error: new Error('session check failed') }],
    ['an anonymous user', { data: { user: { id: 'u', is_anonymous: true } }, error: null }],
    ['a user with no is_anonymous flag', { data: { user: { id: 'u' } }, error: null }],
  ])('two-sided: any other address is resolved only for an allowed reader, and %s is told nothing is here', async (_name, user) => {
    getUserMock.mockResolvedValue(user);
    for (const segment of ['sec-7-8', 'app-k', 'app-l-2', 'unknown-id']) {
      createClientMock.mockClear();
      await expect(visit(segment, R5_PAPER_VERSION)).rejects.toThrow('NEXT_NOT_FOUND');
      // This address DID need the session: exactly one client, one user check.
      expect(createClientMock).toHaveBeenCalledTimes(1);
    }
    expect(redirectMock).not.toHaveBeenCalled();
    expect(getUserMock).toHaveBeenCalledTimes(4);
    // The reader check refused before any loader was asked.
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
  });

  it('a release that cannot be read right now is thrown to the error boundary, never turned into "not found" or a redirect', async () => {
    privateLoadSpy.mockRejectedValue(new PrivateReleaseUnavailableError('STATUS'));
    await expect(visit('sec-7-8', R5_PAPER_VERSION)).rejects.toBeInstanceOf(PrivateReleaseUnavailableError);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    // The error carries a constant message and a reason code only.
    await expect(visit('sec-7-8', R5_PAPER_VERSION)).rejects.toThrow('The private paper release is unavailable.');
  });

  it('with a structure, resolves a stable id and the retired ids of this release, and lands an unknown id on the start', async () => {
    const content = ['<div id="sec-7-8" class="section-anchor"></div>', '', '## 7.8 Synthetic heading', '', 'Body.', ''].join('\n');
    const startByte = content.indexOf('## 7.8');
    const structure = { content, nodes: [{ id: 'node:s', anchor: 'synthetic-7-8', label: '7.8 Synthetic heading', depth: 1, parentId: null, startByte, endByte: content.length, tokenEndByte: startByte + '## 7.8 Synthetic heading'.length }] };
    privateLoadSpy.mockResolvedValue(structure);
    const section = paperWorkspaceHref(R5_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: 'synthetic-7-8' });
    for (const segment of ['sec-7-8', ...Object.keys(release.retiredSectionAnchors)]) {
      redirectMock.mockClear();
      await expect(visit(segment, R5_PAPER_VERSION)).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock).toHaveBeenCalledWith(section);
    }
    expect(Object.keys(release.retiredSectionAnchors).length).toBeGreaterThan(0);
    redirectMock.mockClear();
    await expect(visit('sec-99-9', R5_PAPER_VERSION)).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(paperWorkspaceHref(R5_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: null }));
    // The loader was handed the reader that this request's own check issued.
    const lastCall = privateLoadSpy.mock.calls[privateLoadSpy.mock.calls.length - 1];
    expect(lastCall[0]).toBe(R5_PAPER_VERSION);
    expect(lastCall[1]).toMatchObject({ userId: '11111111-1111-4111-8111-111111111111' });
    expect(requestLoadSpy).not.toHaveBeenCalled();
  });
});
