import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

const { redirectMock, notFoundMock, workspaceMock, downloadStateMock, getUserMock, createClientMock, loadStructureSpy, requestLoadSpy, privateLoadSpy } = vi.hoisted(() => ({
  redirectMock: vi.fn((_url: string) => { throw new Error('NEXT_REDIRECT'); }),
  notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  workspaceMock: vi.fn((..._args: unknown[]) => null),
  downloadStateMock: vi.fn(async (..._args: unknown[]) => ({ status: 'ready', manifests: { sentinel: true } })),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  loadStructureSpy: vi.fn(),
  requestLoadSpy: vi.fn(),
  privateLoadSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createClientMock }));
vi.mock('@/components/matrix-options/paper/RevisedPaperWorkspace', () => ({ RevisedPaperWorkspace: workspaceMock }));
vi.mock('@/lib/matrix-options/paper/download-manifest-server', () => ({ loadDownloadManifestMapState: downloadStateMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  loadStructureSpy.mockImplementation(actual.loadRevisedPaperStructure);
  return { ...actual, loadRevisedPaperStructure: loadStructureSpy };
});
// The real loaders behind spies: a test can see whether either ran, and can stand a structure
// or a failure in for the private bytes where there is no fixture. A private-storage release
// is loaded by loadPrivatePaperStructure, for the reader the page's own check issued.
vi.mock('@/lib/matrix-options/paper/paper-request-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  requestLoadSpy.mockImplementation(actual.loadPaperStructureForRequest);
  privateLoadSpy.mockImplementation(actual.loadPrivatePaperStructure);
  return { ...actual, loadPaperStructureForRequest: requestLoadSpy, loadPrivatePaperStructure: privateLoadSpy };
});

import { MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH } from '@/lib/matrix-options/navigation';
import { describePrivate } from '@/lib/matrix-options/paper/__tests__/private-fixture';
import { buildLegacyAnchorMap } from '@/lib/matrix-options/paper/full-document';
import { PrivateReleaseUnavailableError, resetPrivateReleaseCacheForTests } from '@/lib/matrix-options/paper/private-release-assets';
import { getPaperRelease, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import { REVISED_PAPER_ROUTE, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { PrivateReleaseSessionGate } from '@/components/matrix-options/paper/PrivateReleaseSessionGate';
import PublicationPage from '../publication/v/[documentVersion]/page';
import PublicationNodePage from '../publication/v/[documentVersion]/nodes/[canonicalNodeId]/page';
import PublicationQuestionPage from '../publication/v/[documentVersion]/questions/[questionId]/page';
import ReviewVersionPage from '../review/v/[documentVersion]/page';
import PaperVersionPage from '../v/[documentVersion]/page';
import PaperSectionPage from '../v/[documentVersion]/[stableSectionId]/page';

/*
 * The paper routes with both bound releases.
 *
 * The predecessor stays the default and behaves as before, on its real bytes.
 * R5 is addressable by its own version only and is a PRIVATE-STORAGE release:
 * its bytes are not in the repository, a page reads them with the request's own
 * session, and only for a signed-in, non-anonymous reader.
 *
 * - The always-run suites prove everything that needs no private byte: the guard
 *   on every page, the two failure outcomes, the order of the checks, and the
 *   release-scoped identities (question ids, versions). Where a structure is
 *   needed, a synthetic one stands in for the loader's result.
 * - The private-fixture suite runs the same pages on the real bytes through the
 *   real loader. It asserts counts, ids and booleans only.
 */

const PREDECESSOR_MANIFEST_SHA256 = '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e';
const READER_ID = '11111111-1111-4111-8111-111111111111';
const r5Release = getPaperRelease(R5_PAPER_VERSION)!;
const r5Base = `/matrix-options/paper/publication/v/${R5_PAPER_VERSION}`;
const predecessorBase = `/matrix-options/paper/publication/v/${REVISED_PAPER_VERSION}`;
const r5Q = (number: number) => `rpq:${R5_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
const predecessorQ = (number: number) => `rpq:${REVISED_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;

const ALLOWED = { data: { user: { id: READER_ID, is_anonymous: false } }, error: null };
const DENIED: readonly (readonly [string, unknown])[] = [
  ['no user', { data: { user: null }, error: null }],
  ['a user check that errored', { data: { user: { id: READER_ID, is_anonymous: false } }, error: new Error('session check failed') }],
  ['an anonymous user', { data: { user: { id: READER_ID, is_anonymous: true } }, error: null }],
  ['a user with no is_anonymous flag', { data: { user: { id: READER_ID } }, error: null }],
];

interface WorkspaceProps {
  readonly documentVersion: string;
  readonly guide?: { readonly releaseIdentity: string; readonly questions: readonly { readonly id: string; readonly heading: string; readonly prompt: string }[] };
  readonly reviewManifestSha256: string;
  readonly urlState: { mode: string; cohort: string | null; q: string | null; section: string | null };
  readonly sectionWindow?: { paperSha256: string; initialIndex: number; sections: readonly { anchor: string; label: string }[] };
  readonly cohortPortions?: readonly { cohortId: string; status: string }[];
  readonly downloadManifests: unknown;
  readonly reviewLineage?: { predecessorVersion: string; predecessorManifestSha256: string; predecessorQuestionIds: Record<string, string | null> };
  readonly stableSectionIds?: Record<string, string>;
  readonly children?: { props: { model: { chunks: readonly { markdown: string }[] } } };
}

/**
 * The workspace element the publication page renders, and whether the page put it inside the
 * client session gate (it does for a private-storage release, and only for one).
 */
async function publication(version: string, searchParams: Record<string, string | string[] | undefined>): Promise<{ type: unknown; props: WorkspaceProps; gated: boolean; servedTo: unknown }> {
  const root = (await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve(searchParams) })) as unknown as { type: unknown; props: WorkspaceProps & { children?: unknown; servedTo?: unknown } };
  if (root.type !== PrivateReleaseSessionGate) return { type: root.type, props: root.props, gated: false, servedTo: undefined };
  const workspace = root.props.children as unknown as { type: unknown; props: WorkspaceProps };
  return { type: workspace.type, props: workspace.props, gated: true, servedTo: root.props.servedTo };
}

async function expectRedirect(run: () => Promise<unknown>, target: string) {
  redirectMock.mockClear();
  await expect(run()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirectMock).toHaveBeenCalledTimes(1);
  expect(redirectMock).toHaveBeenCalledWith(target);
}

async function expectNotFound(run: () => Promise<unknown>) {
  redirectMock.mockClear();
  await expect(run()).rejects.toThrow('NEXT_NOT_FOUND');
  expect(redirectMock).not.toHaveBeenCalled();
}

/** Every string anywhere in a value (page props are data: this walks all of it). */
function allStrings(value: unknown, seen = new Set<unknown>()): string[] {
  if (typeof value === 'string') return [value];
  if (!value || typeof value !== 'object' || seen.has(value)) return [];
  seen.add(value);
  return (Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)).flatMap((entry) => allStrings(entry, seen));
}

/**
 * A stand-in for what the loader returns: two headings, enough for the
 * redirect-only pages and for URL canonicalization. Its text is NOT the bound
 * release, so no page may render it (the guide check refuses it).
 */
function syntheticStructure(): RevisedPaperStructure {
  const content = '## One\n\nBody one.\n\n## Two\n\nBody two.\n';
  const node = (label: string, next: number | null) => {
    const startByte = content.indexOf(`## ${label}`);
    return { id: `node:${label.toLowerCase()}`, domain: 'node', kind: 'heading', depth: 1, label, parentId: null, ancestorIds: [], anchor: label.toLowerCase(), startByte, endByte: next ?? content.length, tokenEndByte: startByte + `## ${label}`.length };
  };
  return { content, lines: content.split('\n'), nodes: [node('One', content.indexOf('## Two')), node('Two', null)], objects: [], questions: [], manifest: { source: { version: R5_PAPER_VERSION, sha256: r5Release.sha256 } } } as unknown as RevisedPaperStructure;
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(async () => {
  vi.clearAllMocks();
  const structureModule = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
  const loaderModule = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  loadStructureSpy.mockImplementation(structureModule.loadRevisedPaperStructure);
  requestLoadSpy.mockImplementation(loaderModule.loadPaperStructureForRequest);
  privateLoadSpy.mockImplementation(loaderModule.loadPrivatePaperStructure);
  getUserMock.mockResolvedValue(ALLOWED);
  createClientMock.mockImplementation(async () => ({ auth: { getUser: getUserMock, getSession: vi.fn(async () => ({ data: { session: { access_token: 'synthetic-session-token-for-tests' } }, error: null })) } }));
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
  process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('private-storage release: every page that loads it checks the reader first', () => {
  const pages: readonly (readonly [string, () => Promise<unknown>])[] = [
    ['the publication workspace', () => publication(R5_PAPER_VERSION, { mode: 'working-draft' })],
    ['My Review', () => publication(R5_PAPER_VERSION, { mode: 'my-review', cohort: 'categories' })],
    ['a node deep link', () => PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent('node:one') }) })],
    ['a question deep link', () => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, questionId: encodeURIComponent(r5Q(11)) }) })],
    ['a section deep link', () => PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: 'sec-7-8' }) })],
  ];

  it('is bound as private storage, with nothing in the repository to load', () => {
    expect(r5Release.delivery).toBe('private-storage');
    expect(r5Release.filename).toBeNull();
    expect(getPaperRelease(REVISED_PAPER_VERSION)?.delivery).toBe('repository');
  });

  it.each(DENIED)('%s: every page says nothing is here, through the real loader, and nothing is read', async (_name, user) => {
    getUserMock.mockResolvedValue(user);
    for (const [name, run] of pages) {
      notFoundMock.mockClear();
      await expect(run(), name).rejects.toThrow('NEXT_NOT_FOUND');
      expect(notFoundMock, name).toHaveBeenCalledTimes(1);
    }
    expect(redirectMock).not.toHaveBeenCalled();
    expect(workspaceMock).not.toHaveBeenCalled();
    // One client and one user check per request, and the check refuses before any loader is asked.
    expect(createClientMock).toHaveBeenCalledTimes(pages.length);
    expect(getUserMock).toHaveBeenCalledTimes(pages.length);
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
    expect(downloadStateMock).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('a release that cannot be read right now is thrown to the error boundary on every page: never "not found", never a redirect', async () => {
    privateLoadSpy.mockRejectedValue(new PrivateReleaseUnavailableError('STATUS'));
    for (const [name, run] of pages) {
      await expect(run(), name).rejects.toBeInstanceOf(PrivateReleaseUnavailableError);
    }
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(workspaceMock).not.toHaveBeenCalled();
    // Constant message and a reason code; nothing of the release is in the error.
    await expect(pages[0][1]()).rejects.toThrow('The private paper release is unavailable.');
  });

  it('an unexpected failure of the load surfaces as itself', async () => {
    privateLoadSpy.mockRejectedValue(new TypeError('loader is not a function'));
    for (const [name, run] of pages) await expect(run(), name).rejects.toBeInstanceOf(TypeError);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('hands the loader the exact version and the reader its own check issued on this request\'s session client: one user check', async () => {
    privateLoadSpy.mockResolvedValue(syntheticStructure());
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent('node:two') }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(`${r5Base}?mode=working-draft&section=two`);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(privateLoadSpy).toHaveBeenCalledTimes(1);
    expect(privateLoadSpy.mock.calls[0][0]).toBe(R5_PAPER_VERSION);
    expect(privateLoadSpy.mock.calls[0][1]).toMatchObject({ userId: READER_ID });
    expect(requestLoadSpy).not.toHaveBeenCalled();
  });

  it('never renders a loaded structure whose text is not the bound release: the guide check refuses it', async () => {
    privateLoadSpy.mockResolvedValue(syntheticStructure());
    await expectNotFound(() => publication(R5_PAPER_VERSION, { mode: 'working-draft' }));
    expect(consoleError).toHaveBeenCalledWith('[matrix-options-paper] publication route unavailable: GUIDE_AUTHENTICATION_FAILED');
    expect(workspaceMock).not.toHaveBeenCalled();
  });

  it.each(['unknown', `${R5_PAPER_VERSION}-x`, 'v0.9.88', 'v0.9.88-run106-r4-c1-c3-001', ''])('is not found for a version that is not a bound release (%s), before any session client', async (version) => {
    await expectNotFound(() => publication(version, { mode: 'working-draft' }));
    await expectNotFound(() => PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: 'node%3Aone' }) }));
    await expectNotFound(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: version, questionId: encodeURIComponent(r5Q(11)) }) }));
    await expectNotFound(() => PaperSectionPage({ params: Promise.resolve({ documentVersion: version, stableSectionId: 'sec-7-8' }) }));
    expect(createClientMock).not.toHaveBeenCalled();
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
    expect(workspaceMock).not.toHaveBeenCalled();
  });

  it.each([
    ['workspace flag off', 'false', 'true', MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH],
    ['review navigation flag off', 'true', 'false', REVISED_PAPER_ROUTE],
  ])('with %s, R5 is not served: the request goes to the default destination, and no session or release is consulted', async (_name, workspace, navigation, target) => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspace;
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = navigation;
    await expectRedirect(() => publication(R5_PAPER_VERSION, { mode: 'working-draft' }), target);
    expect(target).not.toContain(R5_PAPER_VERSION);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
  });
});

describe('release-scoped identities (no private byte needed)', () => {
  beforeEach(() => {
    // Whatever R5 structure is loaded, ids and versions are scoped by the contracts.
    privateLoadSpy.mockResolvedValue(syntheticStructure());
  });

  it('never accepts a question id of the other release', async () => {
    // A predecessor question under R5, and an R5 question under the predecessor: the id is dropped.
    await expectRedirect(() => publication(R5_PAPER_VERSION, { mode: 'my-review', q: predecessorQ(1) }), `${r5Base}?mode=my-review`);
    await expectRedirect(() => publication(REVISED_PAPER_VERSION, { mode: 'my-review', q: r5Q(1) }), `${predecessorBase}?mode=my-review`);
    // Two-sided: each release resolves its own question to its own topic.
    await expectRedirect(() => publication(R5_PAPER_VERSION, { mode: 'my-review', q: r5Q(11) }), `${r5Base}?mode=my-review&cohort=methods-water-type&q=${encodeURIComponent(r5Q(11))}`);
    await expectRedirect(() => publication(REVISED_PAPER_VERSION, { mode: 'my-review', q: predecessorQ(11) }), `${predecessorBase}?mode=my-review&cohort=methods-water-type&q=${encodeURIComponent(predecessorQ(11))}`);
  });

  it('resolves a question deep link only within its own release', async () => {
    await expectRedirect(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, questionId: encodeURIComponent(r5Q(11)) }) }), `${r5Base}?mode=my-review&cohort=methods-water-type&q=${encodeURIComponent(r5Q(11))}`);
    await expectNotFound(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, questionId: encodeURIComponent(predecessorQ(11)) }) }));
    await expectNotFound(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, questionId: encodeURIComponent(r5Q(11)) }) }));
    await expectRedirect(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, questionId: encodeURIComponent(predecessorQ(11)) }) }), `${predecessorBase}?mode=my-review&cohort=methods-water-type&q=${encodeURIComponent(predecessorQ(11))}`);
    await expectNotFound(() => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: 'unknown', questionId: encodeURIComponent(r5Q(11)) }) }));
  });

  it('resolves a node deep link only within its own release, and an id that release does not have is not found', async () => {
    await expectRedirect(() => PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent('node:one') }) }), `${r5Base}?mode=working-draft&section=one`);
    await expectNotFound(() => PublicationNodePage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, canonicalNodeId: encodeURIComponent('node:one') }) }));
    await expectNotFound(() => PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent(`node:${'0'.repeat(64)}`) }) }));
    await expectNotFound(() => PublicationNodePage({ params: Promise.resolve({ documentVersion: 'unknown', canonicalNodeId: encodeURIComponent('node:one') }) }));
  });

  it('lands the version root and the legacy review route of each release on that release, without loading either', async () => {
    for (const version of [REVISED_PAPER_VERSION, R5_PAPER_VERSION]) {
      const target = paperWorkspaceHref(version, { mode: 'working-draft', cohort: null, q: null, section: null });
      expect(target).toContain(version);
      await expectRedirect(() => PaperVersionPage({ params: Promise.resolve({ documentVersion: version }) }), target);
      await expectRedirect(() => ReviewVersionPage({ params: Promise.resolve({ documentVersion: version }) }), target);
    }
    await expectNotFound(() => PaperVersionPage({ params: Promise.resolve({ documentVersion: 'unknown' }) }));
    await expectNotFound(() => ReviewVersionPage({ params: Promise.resolve({ documentVersion: 'unknown' }) }));
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it.each([
    ['workspace flag off', 'false', 'true'],
    ['review navigation flag off (the resolver page renders the default release only)', 'true', 'false'],
  ])('with %s, the R5 version root and section routes are not found', async (_name, workspace, navigation) => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = workspace;
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = navigation;
    await expectNotFound(() => PaperVersionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION }) }));
    await expectNotFound(() => PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: 'sec-7-8' }) }));
    expect(requestLoadSpy).not.toHaveBeenCalled();
    expect(privateLoadSpy).not.toHaveBeenCalled();
    expect(loadStructureSpy).not.toHaveBeenCalled();
  });
});

describe('publication workspace: the predecessor is still the default and is unchanged', () => {
  it('is the default release, and R5 is selectable but not the default', () => {
    expect(getPaperRelease(REVISED_PAPER_VERSION)?.activation).toBe('DEFAULT');
    expect(r5Release.activation).toBe('SELECTABLE_NON_DEFAULT');
    expect(REVISED_PAPER_ROUTE).toContain(REVISED_PAPER_VERSION);
    expect(REVISED_PAPER_ROUTE).not.toContain(R5_PAPER_VERSION);
  });

  it('opens with the predecessor structure, its own guide, its persisted manifest digest, its downloads and no lineage', async () => {
    const result = await publication(REVISED_PAPER_VERSION, { mode: 'working-draft' });
    const props = result.props;
    // The workspace is the page's root: the default release is not put behind the session gate.
    expect(result.type).toBe(workspaceMock);
    expect(result.gated).toBe(false);
    expect(result.servedTo).toBeUndefined();
    expect(props.documentVersion).toBe(REVISED_PAPER_VERSION);
    expect(props.guide?.releaseIdentity).toBe(REVISED_PAPER_VERSION);
    expect(props.guide?.questions.map((question) => question.id)).toEqual(Array.from({ length: 12 }, (_, index) => predecessorQ(index + 1)));
    expect(props.reviewManifestSha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(props.sectionWindow?.paperSha256).toBe(getPaperRelease(REVISED_PAPER_VERSION)?.sha256);
    expect(props.sectionWindow?.sections).toHaveLength(17);
    expect(props.reviewLineage).toBeUndefined();
    expect(downloadStateMock).toHaveBeenCalledTimes(1);
    expect(downloadStateMock).toHaveBeenCalledWith(REVISED_PAPER_VERSION, PREDECESSOR_MANIFEST_SHA256);
    expect(props.downloadManifests).toEqual({ sentinel: true });
    // Rendering the default never loads, authenticates or depends on R5.
    expect(loadStructureSpy).toHaveBeenCalledWith(REVISED_PAPER_VERSION);
    expect(loadStructureSpy).not.toHaveBeenCalledWith(R5_PAPER_VERSION);
  });

  it.each([
    ['no user', { data: { user: null }, error: null }, false],
    ['an anonymous user', { data: { user: { id: READER_ID, is_anonymous: true } }, error: null }, false],
    ['a signed-in reader', ALLOWED, true],
  ])('is served to any session the page gate let through (%s): the reader rule of the private release is not applied to it', async (_name, user, downloads) => {
    getUserMock.mockResolvedValue(user);
    const result = await publication(REVISED_PAPER_VERSION, { mode: 'working-draft' });
    expect(result.type).toBe(workspaceMock);
    // No client session gate either: the default release renders as it always has.
    expect(result.gated).toBe(false);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(downloadStateMock).toHaveBeenCalledTimes(downloads ? 1 : 0);
    // Its section and child routes resolve the same way, with no user check at all.
    getUserMock.mockClear();
    await expect(PaperSectionPage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, stableSectionId: 'sec-4-4' }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('carries a stable section id into the predecessor, and an id it does not have opens it at its start', async () => {
    const predecessor = (await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure')).loadRevisedPaperStructure();
    const section44 = buildLegacyAnchorMap(predecessor)['sec-4-4'];
    expect(section44).toBeDefined();
    await expectRedirect(() => PaperSectionPage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, stableSectionId: 'sec-4-4' }) }), paperWorkspaceHref(REVISED_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: section44 }));
    // An R5-only section has no place in the predecessor: that draft opens at its start.
    await expectRedirect(() => PaperSectionPage({ params: Promise.resolve({ documentVersion: REVISED_PAPER_VERSION, stableSectionId: 'sec-7-1' }) }), paperWorkspaceHref(REVISED_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: null }));
  });
});

describePrivate('R5 pages on the real private bytes, through the real loader (private fixture)', () => {
  let r5Structure: RevisedPaperStructure;
  let r5Section78: string;

  beforeAll(() => {
    resetPrivateReleaseCacheForTests();
  });

  afterAll(() => {
    resetPrivateReleaseCacheForTests();
  });

  beforeEach(async () => {
    // The structure the pages themselves get: loaded by the real loader for an allowed reader.
    const loaderModule = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
    r5Structure = await loaderModule.loadPaperStructureForRequest(R5_PAPER_VERSION, { auth: { getUser: async () => ALLOWED, getSession: async () => ({ data: { session: { access_token: 'synthetic-session-token-for-tests' } }, error: null }) } });
    r5Section78 = buildLegacyAnchorMap(r5Structure)['sec-7-8'];
  });

  it('opens the R5 Working Draft with the R5 structure, its resolved guide, manifest, lineage and no downloads', async () => {
    const result = await publication(R5_PAPER_VERSION, { mode: 'working-draft' });
    expect(result.type).toBe(workspaceMock);
    // Everything the page renders for this release is inside the client session gate, bound to
    // the reader the load was authorized for.
    expect(result.gated).toBe(true);
    expect(result.servedTo).toBe(READER_ID);
    expect(redirectMock).not.toHaveBeenCalled();
    const props = result.props;
    expect(props.documentVersion).toBe(R5_PAPER_VERSION);
    expect(props.reviewManifestSha256).toBe(getReviewManifest(R5_PAPER_VERSION).sha256);
    expect(props.reviewManifestSha256).not.toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(props.sectionWindow?.paperSha256).toBe(r5Release.sha256);
    expect(props.sectionWindow?.sections.length).toBe(98);
    expect(props.sectionWindow?.initialIndex).toBe(0);
    // The guide handed to the workspace is this release's, resolved from its text: twelve
    // questions under its own ids, each with a heading and a prompt.
    expect(props.guide?.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(props.guide?.questions.map((question) => question.id)).toEqual(Array.from({ length: 12 }, (_, index) => r5Q(index + 1)));
    expect(props.guide?.questions.filter((question) => typeof question.heading === 'string' && question.heading !== '' && typeof question.prompt === 'string' && question.prompt !== '').length).toBe(12);
    // The predecessor's responses are named for read-only reference, under the predecessor's own identity.
    expect(props.reviewLineage?.predecessorVersion).toBe(REVISED_PAPER_VERSION);
    expect(props.reviewLineage?.predecessorManifestSha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(props.reviewLineage?.predecessorQuestionIds[r5Q(1)]).toBe(predecessorQ(1));
    expect(props.reviewLineage?.predecessorQuestionIds[r5Q(11)]).toBeNull();
    // Print packages belong to the default release: neither the boundary nor a second user check is consulted.
    expect(props.downloadManifests).toBeNull();
    expect(downloadStateMock).not.toHaveBeenCalled();
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(props.stableSectionIds?.[r5Section78]).toBe('sec-7-8');
    expect(loadStructureSpy).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('server-renders the title block of R5 from its front matter, with no YAML on the page', async () => {
    const result = await publication(R5_PAPER_VERSION, { mode: 'working-draft' });
    const first = result.props.children?.props.model.chunks[0].markdown ?? '';
    expect(first.startsWith('# ')).toBe(true);
    expect(/^---$/m.test(first)).toBe(false);
    expect(/^title: /m.test(first)).toBe(false);
    expect(first.includes(':::')).toBe(false);
  });

  it('opens an R5 section deep link on the section that owns it', async () => {
    const result = await publication(R5_PAPER_VERSION, { mode: 'working-draft', section: r5Section78 });
    const { sectionWindow } = result.props;
    // Section 7.8 sits inside a top-level section that is not the first: that window is server-rendered.
    expect(sectionWindow?.initialIndex).toBeGreaterThan(0);
    expect(result.props.urlState.section).toBe(r5Section78);
    const rendered = result.props.children?.props.model.chunks.map((chunk) => chunk.markdown).join('\n') ?? '';
    // That window carries Section 7's accepted figure placements as authored blocks.
    expect(rendered.includes('<!-- MATRIX_FIGURE_PLACEMENT: 7-1 -->')).toBe(true);
  });

  it('opens R5 My Review with the R5 cohort portions and an R5 question', async () => {
    const result = await publication(R5_PAPER_VERSION, { mode: 'my-review', cohort: 'methods-water-type', q: r5Q(11) });
    expect(result.type).toBe(workspaceMock);
    expect(result.gated).toBe(true);
    expect(result.servedTo).toBe(READER_ID);
    expect(result.props.urlState).toEqual({ mode: 'my-review', cohort: 'methods-water-type', q: r5Q(11), section: null });
    expect(result.props.cohortPortions?.length).toBe(14);
    expect(result.props.cohortPortions?.every((portion) => portion.status === 'available')).toBe(true);
    expect(result.props.reviewLineage?.predecessorManifestSha256).toBe(PREDECESSOR_MANIFEST_SHA256);
    expect(result.props.downloadManifests).toBeNull();
  });

  it('never accepts a section anchor that only the other release has', async () => {
    const predecessorAnchors = new Set((await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure')).loadRevisedPaperStructure().nodes.map((node) => node.anchor));
    const r5Only = r5Structure.nodes.find((node) => !predecessorAnchors.has(node.anchor));
    expect(r5Only !== undefined).toBe(true);
    redirectMock.mockClear();
    await expect(publication(REVISED_PAPER_VERSION, { mode: 'working-draft', section: r5Only!.anchor })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock.mock.calls.length === 1 && redirectMock.mock.calls[0][0] === `${predecessorBase}?mode=working-draft`).toBe(true);
  });

  it('carries a stable section id into R5, and lands the retired ids sec-7-8-1 and sec-7-8-2 on sec-7-8', async () => {
    const section78 = paperWorkspaceHref(R5_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: r5Section78 });
    let landed = 0;
    for (const id of ['sec-7-8', 'sec-7-8-1', 'sec-7-8-2']) {
      redirectMock.mockClear();
      await expect(PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: id }) })).rejects.toThrow('NEXT_REDIRECT');
      if (redirectMock.mock.calls.length === 1 && redirectMock.mock.calls[0][0] === section78) landed += 1;
    }
    expect(landed).toBe(3);
    // Every other appendix of R5 opens on its own section; an id R5 does not have opens it at its start.
    const start = paperWorkspaceHref(R5_PAPER_VERSION, { mode: 'working-draft', cohort: null, q: null, section: null });
    let appendices = 0;
    for (const id of ['app-a', 'app-e', 'app-k']) {
      const anchor = buildLegacyAnchorMap(r5Structure)[id];
      redirectMock.mockClear();
      await expect(PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: id }) })).rejects.toThrow('NEXT_REDIRECT');
      if (typeof anchor === 'string' && redirectMock.mock.calls[0][0] === `${r5Base}?mode=working-draft&section=${encodeURIComponent(anchor)}`) appendices += 1;
    }
    expect(appendices).toBe(3);
    for (const id of ['app-z', 'sec-99-9']) {
      redirectMock.mockClear();
      await expect(PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: id }) })).rejects.toThrow('NEXT_REDIRECT');
      expect(redirectMock.mock.calls[0][0] === start).toBe(true);
    }
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it('page data of R5 names every presented appendix and never the withheld section: its stable id occurs nowhere', async () => {
    const workingDraft = allStrings((await publication(R5_PAPER_VERSION, { mode: 'working-draft' })).props);
    const myReview = allStrings((await publication(R5_PAPER_VERSION, { mode: 'my-review', cohort: 'categories' })).props);
    const appendixK = allStrings((await publication(R5_PAPER_VERSION, { mode: 'working-draft', section: buildLegacyAnchorMap(r5Structure)['app-k'] })).props);
    for (const strings of [workingDraft, myReview, appendixK]) {
      expect(strings.filter((value) => value.includes('app-l')).length).toBe(0);
    }
    // Controls: the walk does see stable ids where they are, and the page data is not empty.
    expect(workingDraft.filter((value) => value === 'app-k').length).toBeGreaterThan(0);
    expect(workingDraft.length).toBeGreaterThan(500);
    // The release ends where its last presented node ends: there is no node or object past it.
    const last = r5Structure.nodes[r5Structure.nodes.length - 1];
    expect(last.endByte).toBe(r5Release.bytes);
    expect(r5Structure.nodes.filter((node) => node.startByte >= r5Release.bytes).length).toBe(0);
    expect(r5Structure.objects.filter((object) => object.startByte >= r5Release.bytes).length).toBe(0);
    redirectMock.mockClear();
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent(last.id) }) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock.mock.calls[0][0] === `${r5Base}?mode=working-draft&section=${encodeURIComponent(last.anchor)}`).toBe(true);
  });

  it.each(DENIED)('with the release already in memory, %s is still told nothing is here on every page', async (_name, user) => {
    // Warm: an allowed reader has just loaded the release (beforeEach), so the verified bytes and
    // the compiled structure are cached. The guard is not the cache: it runs first, every time.
    expect((await publication(R5_PAPER_VERSION, { mode: 'working-draft' })).type).toBe(workspaceMock);
    getUserMock.mockResolvedValue(user);
    workspaceMock.mockClear();
    const runs: readonly (() => Promise<unknown>)[] = [
      () => publication(R5_PAPER_VERSION, { mode: 'working-draft' }),
      () => publication(R5_PAPER_VERSION, { mode: 'my-review', cohort: 'categories' }),
      () => PublicationNodePage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, canonicalNodeId: encodeURIComponent(r5Structure.nodes[0].id) }) }),
      () => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, questionId: encodeURIComponent(r5Q(1)) }) }),
      () => PaperSectionPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION, stableSectionId: 'sec-7-8' }) }),
    ];
    let refused = 0;
    for (const run of runs) {
      redirectMock.mockClear();
      await expect(run()).rejects.toThrow('NEXT_NOT_FOUND');
      if (redirectMock.mock.calls.length === 0) refused += 1;
    }
    expect(refused).toBe(runs.length);
    expect(workspaceMock).not.toHaveBeenCalled();
    // Two-sided: the same pages, the same warm cache, an allowed reader again.
    getUserMock.mockResolvedValue(ALLOWED);
    expect((await publication(R5_PAPER_VERSION, { mode: 'working-draft' })).type).toBe(workspaceMock);
  });
});
