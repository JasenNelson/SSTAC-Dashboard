import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

const { redirectMock, notFoundMock, workspaceMock, structureMock, requestLoadSpy, privateLoadSpy, defaultStructure, resolveReviewerGuideMock, cohortManifestMock, defaultManifest, downloadServerMock, supabaseMock, createAuthenticatedClientMock, roleMaybeSingleMock, roleEqMock } = vi.hoisted(() => {
  const labels = ['4.1 Categories and uses', '9.9 Water lot use classes', '6.0 Proposed framework', '18.1 Three-part structure', '7.5.1 Scope', '7.5.2 Evidence', '7.5.3 Boundary', '7.8 Exposure terms', '9.5 Matrix derivation options', '7.7 BC Aquatic Database', '15.0 Limitations of this draft', '4.4.2 Existing schedule structure', 'Technical Appendices Compendium', 'unrelated-sentinel'];
  // Depth-1 headings are the S1 section boundaries: sections are [0,1], [2..9], [10,11], [12].
  const TOP_LEVEL_LABELS = ['4.1 Categories and uses', '6.0 Proposed framework', '15.0 Limitations of this draft', 'Technical Appendices Compendium'];
  const content = labels.join('\n');
  const buildStructure = () => {
    const nodes = labels.slice(0, -1).map((label, index) => {
      const startByte = content.indexOf(label);
      return { id: `node:test-${index}`, domain: 'node' as const, kind: 'heading' as const, depth: TOP_LEVEL_LABELS.includes(label) ? 1 : 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: `test-${index}`, startByte, endByte: startByte + label.length };
    });
    const placements = nodes.map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
    return { manifest: { source: { version: '1.0.11-remediated-7-8-successor-20260918-D', sha256: 'f'.repeat(64) } }, releaseIdentity: 'release', nodes, objects: [] as unknown[], questions: [] as unknown[], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] };
  };
  const buildManifest = () => ({
    schemaVersion: 'matrix-paper-cohorts-v1',
    releaseIdentity: '1.0.11-remediated-7-8-successor-20260918-D',
    status: 'PROPOSED_PENDING_OWNER_QP_APPROVAL',
    cohorts: [
      { id: 'categories', name: 'Categories', questionNumbers: [1, 2, 3], sourceLocators: ['Sections 4.1 and 9.9', "Reviewer's Guide lines 181-190"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'pathway-grid', name: 'Pathway and grid', questionNumbers: [4, 5], sourceLocators: ['Sections 4.1 and 6.0', 'Section 18.1', "Reviewer's Guide lines 191-197"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'exposure-assumptions', name: 'Exposure assumptions', questionNumbers: [6, 7], sourceLocators: ['Sections 7.5 and 7.8', 'Section 9.5', "Reviewer's Guide lines 198-204"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'inputs-evidence', name: 'Inputs and evidence', questionNumbers: [8, 9, 12], sourceLocators: ['Sections 7.7 and 7.8', 'Section 15', "Reviewer's Guide lines 205-226"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'methods-water-type', name: 'Methods and water type', questionNumbers: [10, 11], sourceLocators: ['Sections 6.0 and 7.5', 'Section 4.4.2', "Reviewer's Guide lines 212-222"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
    ],
  });
  const roleMaybeSingleMock = vi.fn(async () => ({ data: { role: 'admin' }, error: null }));
  const roleEqMock = vi.fn(() => ({ eq: roleEqMock, maybeSingle: roleMaybeSingleMock }));
  const roleSelectMock = vi.fn(() => ({ eq: roleEqMock }));
  const roleFromMock = vi.fn(() => ({ select: roleSelectMock }));
  const supabaseMock = {
    from: roleFromMock,
    auth: { getUser: vi.fn(async () => ({ data: { user: { is_anonymous: false } }, error: null })) },
  };
  const createAuthenticatedClientMock = vi.fn(async () => supabaseMock);
  return {
    createAuthenticatedClientMock,
    roleMaybeSingleMock,
    roleEqMock,
    redirectMock: vi.fn((_url: string) => { throw new Error('NEXT_REDIRECT'); }),
    notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
    workspaceMock: vi.fn((..._args: any[]) => <div data-testid="revised-workspace" />),
    structureMock: vi.fn(buildStructure),
    requestLoadSpy: vi.fn(),
    privateLoadSpy: vi.fn(),
    defaultStructure: buildStructure,
    resolveReviewerGuideMock: vi.fn((_structure: unknown): unknown => undefined),
    cohortManifestMock: vi.fn(buildManifest),
    defaultManifest: buildManifest,
    downloadServerMock: {
      loadTrustedDownloadContext: vi.fn(async () => ({ documentVersion: '1.0.11-remediated-7-8-successor-20260918-D', manifestSha256: 'a'.repeat(64), paperSha256: 'b'.repeat(64), releaseIdentity: 'release', paperReleaseIdentity: 'paper', cohortQuestionIds: {}, reviewManifest: {} })),
      loadAuthenticatedPrintPackageCatalog: vi.fn(async (): Promise<any> => null),
      buildValidatedDownloadManifest: vi.fn(),
      loadDownloadManifestMapState: vi.fn<typeof loadDownloadManifestMapState>(async () => ({ status: 'ready', manifests: {} as any })),
    },
    supabaseMock,
  };
});

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/lib/supabase-auth', () => ({ createAuthenticatedClient: createAuthenticatedClientMock }));
vi.mock('@/components/matrix-options/paper/RevisedPaperWorkspace', () => ({ RevisedPaperWorkspace: workspaceMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', () => ({ loadRevisedPaperStructure: structureMock }));
// The real loaders behind spies: the default release goes through the request loader to
// structureMock; one test stands a structure in for a private-storage release (loaded by
// loadPrivatePaperStructure for the reader the page's own check issued), whose bytes are not here.
vi.mock('@/lib/matrix-options/paper/paper-request-loader', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
  requestLoadSpy.mockImplementation(actual.loadPaperStructureForRequest);
  privateLoadSpy.mockImplementation(actual.loadPrivatePaperStructure);
  return { ...actual, loadPaperStructureForRequest: requestLoadSpy, loadPrivatePaperStructure: privateLoadSpy };
});
vi.mock('@/lib/matrix-options/cohort-contract', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/cohort-contract')>('@/lib/matrix-options/cohort-contract');
  return { ...actual, getCohortManifest: cohortManifestMock };
});
vi.mock('@/lib/matrix-options/paper/reviewer-guide-server', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/paper/reviewer-guide-server')>('@/lib/matrix-options/paper/reviewer-guide-server');
  return { ...actual, resolveReviewerGuide: resolveReviewerGuideMock };
});
vi.mock('@/lib/matrix-options/paper/download-manifest-server', () => ({ ...downloadServerMock }));

import PublicationPage from '../page';
import { loadDownloadManifestMapState } from '@/lib/matrix-options/paper/download-manifest-server';
import PublicationNodePage from '../nodes/[canonicalNodeId]/page';
import PublicationQuestionPage from '../questions/[questionId]/page';
import { PaperDocument } from '@/components/matrix-options/paper/PaperDocument';
import { PrivateReleaseSessionGate, privateReleaseReaderState } from '@/components/matrix-options/paper/PrivateReleaseSessionGate';
import { syntheticResolvedR5Guide } from '@/components/matrix-options/paper/__tests__/r5-synthetic-guide';
import { R5_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { PrivateReleaseUnavailableError } from '@/lib/matrix-options/paper/private-release-assets';
import { getReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const base = `/matrix-options/paper/publication/v/${version}`;
const guideId = (number: number) => `rpq:${version}:q${String(number).padStart(2, '0')}`;

interface WorkspaceElement {
  readonly type: unknown;
  readonly props: {
    readonly documentVersion: string;
    readonly guide?: unknown;
    readonly reviewManifestSha256?: string;
    readonly urlState: { mode: string; cohort: string | null; q: string | null; section: string | null };
    readonly outline?: readonly { anchor: string }[];
    readonly sectionWindow?: { paperSha256: string; initialIndex: number; sections: readonly { index: number; anchor: string; label: string; bytes: number }[]; linkMap: Record<string, string> };
    readonly cohortPortions?: readonly { cohortId: string; status: string; sourceNodeId?: string; sectionLabel?: string; sectionNumber: string; startByte?: number; endByte?: number; text?: string }[];
    readonly children?: { type: unknown; props: { layout?: string; model: { chunks: readonly { anchor: string | null; markdown: string; startByte: number; endByte: number }[] } } };
  };
}

async function page(searchParams: Record<string, string | string[] | undefined>): Promise<WorkspaceElement> {
  return (await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve(searchParams) })) as unknown as WorkspaceElement;
}

async function expectRedirect(run: () => Promise<unknown>, target: string) {
  redirectMock.mockClear();
  await expect(run()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirectMock).toHaveBeenCalledTimes(1);
  expect(redirectMock).toHaveBeenCalledWith(target);
}

let consoleError: MockInstance<typeof console.error>;

describe('paper publication V16 route', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const loaderModule = await vi.importActual<typeof import('@/lib/matrix-options/paper/paper-request-loader')>('@/lib/matrix-options/paper/paper-request-loader');
    requestLoadSpy.mockImplementation(loaderModule.loadPaperStructureForRequest);
    privateLoadSpy.mockImplementation(loaderModule.loadPrivatePaperStructure);
    structureMock.mockImplementation(defaultStructure);
    cohortManifestMock.mockImplementation(defaultManifest);
    // The resolved guide of the default release is its stored contract.
    resolveReviewerGuideMock.mockImplementation(() => getReviewerGuideContract());
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { is_anonymous: false } }, error: null });
    roleMaybeSingleMock.mockResolvedValue({ data: { role: 'admin' }, error: null });
    createAuthenticatedClientMock.mockReset();
    createAuthenticatedClientMock.mockResolvedValue(supabaseMock);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('canonicalizes missing, aliased, invalid, repeated, and reordered query state with redirect() before authentication', async () => {
    await expectRedirect(() => page({}), `${base}?mode=working-draft`);
    await expectRedirect(() => page({ mode: 'publication' }), `${base}?mode=working-draft`);
    await expectRedirect(() => page({ mode: 'working-draft', section: 'not-a-heading' }), `${base}?mode=working-draft`);
    await expectRedirect(() => page({ section: 'test-3', mode: 'working-draft' }), `${base}?mode=working-draft&section=test-3`);
    // Item 8: in working-draft mode a valid q is KEPT (only cohort is dropped).
    await expectRedirect(() => page({ mode: 'working-draft', cohort: 'categories', q: guideId(1) }), `${base}?mode=working-draft&q=${encodeURIComponent(guideId(1))}`);
    await expectRedirect(() => page({ mode: ['my-review', 'working-draft'] }), `${base}?mode=my-review`);
    await expectRedirect(() => page({ mode: 'my-review', lens: 'all', page: '1' }), `${base}?mode=my-review`);
    await expectRedirect(() => page({ mode: 'my-review', q: guideId(4) }), `${base}?mode=my-review&cohort=pathway-grid&q=${encodeURIComponent(guideId(4))}`);
    await expectRedirect(() => page({ mode: 'my-review', cohort: 'categories', q: guideId(4) }), `${base}?mode=my-review&cohort=pathway-grid&q=${encodeURIComponent(guideId(4))}`);
    expect(resolveReviewerGuideMock).not.toHaveBeenCalled();
    expect(workspaceMock).not.toHaveBeenCalled();
  });

  it('S1: server-renders only the deep-linked section window and ships no paper text in client props', async () => {
    const result = await page({ mode: 'working-draft', section: 'test-3' });
    expect(result.type).toBe(workspaceMock);
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result.props.urlState).toEqual({ mode: 'working-draft', cohort: null, q: null, section: 'test-3' });
    expect(result.props.documentVersion).toBe(version);
    expect(result.props.reviewManifestSha256).toBe(getReviewManifest().sha256);
    expect(result.props.outline?.map((entry) => entry.anchor)).toEqual(Array.from({ length: 13 }, (_, index) => `test-${index}`));
    expect(result.props.cohortPortions).toBeUndefined();
    expect(result.props.children?.type).toBe(PaperDocument);
    // test-3 is a depth-2 heading: its owning depth-1 section (test-2..test-9) is the window.
    expect(result.props.children?.props.layout).toBe('chunks');
    const chunks = result.props.children?.props.model.chunks ?? [];
    expect(chunks.map((chunk) => chunk.anchor)).toEqual(['test-2', 'test-3', 'test-4', 'test-5', 'test-6', 'test-7', 'test-8', 'test-9']);
    expect(chunks.some((chunk) => chunk.markdown.includes('unrelated-sentinel'))).toBe(false);

    const sectionWindow = result.props.sectionWindow;
    expect(sectionWindow?.initialIndex).toBe(1);
    expect(sectionWindow?.paperSha256).toBe('f'.repeat(64));
    // Ordered placeholders exist for every other depth-1 section, in document order.
    expect(sectionWindow?.sections.map((section) => [section.index, section.anchor, section.label])).toEqual([
      [0, 'test-0', '4.1 Categories and uses'],
      [1, 'test-2', '6.0 Proposed framework'],
      [2, 'test-10', '15.0 Limitations of this draft'],
      [3, 'test-12', 'Technical Appendices Compendium'],
    ]);
    expect(sectionWindow?.sections.every((section) => Object.keys(section).sort().join(',') === 'anchor,bytes,index,label')).toBe(true);
    expect(sectionWindow?.sections.reduce((sum, section) => sum + section.bytes, 0)).toBe(Buffer.byteLength(defaultStructure().content, 'utf8'));

    const { children: _children, ...clientProps } = result.props;
    expect(JSON.stringify(clientProps)).not.toContain('unrelated-sentinel');
    expect(JSON.stringify(clientProps)).not.toContain('markdown');
    expect(Object.keys(result.props)).not.toContain('readerText');
    expect(Object.keys(result.props)).not.toContain('model');
    // The guide is resolved from the loaded structure itself, and the workspace is handed exactly that guide.
    expect(resolveReviewerGuideMock).toHaveBeenCalledWith(expect.objectContaining({ content: defaultStructure().content }));
    expect(result.props.guide).toBe(resolveReviewerGuideMock.mock.results[0].value);
    expect(result.props.guide).toMatchObject({ schemaVersion: 'matrix-paper-reviewer-guide-v1', releaseIdentity: version });
  });

  it('S1: falls back to the first section without a deep link and keeps every section reachable', async () => {
    const result = await page({ mode: 'working-draft' });
    expect(result.props.sectionWindow?.initialIndex).toBe(0);
    expect((result.props.children?.props.model.chunks ?? []).map((chunk) => chunk.anchor)).toEqual(['test-0', 'test-1']);
    const deepLinkedLast = await page({ mode: 'working-draft', section: 'test-11' });
    expect(deepLinkedLast.props.sectionWindow?.initialIndex).toBe(2);
    expect((deepLinkedLast.props.children?.props.model.chunks ?? []).map((chunk) => chunk.anchor)).toEqual(['test-10', 'test-11']);
    // Every section of the paper is covered exactly once by the window descriptors.
    const sections = deepLinkedLast.props.sectionWindow?.sections ?? [];
    expect(sections.map((section) => section.index)).toEqual([0, 1, 2, 3]);
  });

  it('R2-01: My Review always receives authenticated cohort portions and never the full document', async () => {
    const result = await page({ mode: 'my-review' });
    expect(result.type).toBe(workspaceMock);
    expect(result.props.urlState).toEqual({ mode: 'my-review', cohort: null, q: null, section: null });
    expect(result.props.children).toBeUndefined();
    expect(result.props.outline).toBeUndefined();
    const portions = result.props.cohortPortions ?? [];
    expect(portions).toHaveLength(14);
    expect(portions.filter((portion) => portion.cohortId === 'categories').map((portion) => portion.sectionLabel)).toEqual(['4.1 Categories and uses', '9.9 Water lot use classes']);
    expect(portions.every((portion) => portion.status === 'unavailable' ? portion.text === undefined && portion.startByte === undefined && portion.endByte === undefined : Boolean(portion.sourceNodeId?.startsWith('node:test-') && portion.endByte !== undefined && portion.startByte !== undefined && portion.endByte > portion.startByte && portion.text && !portion.text.includes('unrelated-sentinel')))).toBe(true);
    const withQuestion = await page({ mode: 'my-review', cohort: 'pathway-grid', q: guideId(5) });
    expect(withQuestion.props.urlState).toEqual({ mode: 'my-review', cohort: 'pathway-grid', q: guideId(5), section: null });
    expect(withQuestion.props.cohortPortions).toHaveLength(14);
  });

  it('renders the real release only after authenticating its guide against paper bytes', async () => {
    const actualStructureModule = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
    const actualGuideModule = await vi.importActual<typeof import('@/lib/matrix-options/paper/reviewer-guide-server')>('@/lib/matrix-options/paper/reviewer-guide-server');
    const structure = actualStructureModule.loadRevisedPaperStructure();
    structureMock.mockReturnValue(structure as never);
    resolveReviewerGuideMock.mockImplementationOnce((source) => actualGuideModule.resolveReviewerGuide(source as Parameters<typeof actualGuideModule.resolveReviewerGuide>[0]));

    const result = await page({ mode: 'my-review' });
    expect(resolveReviewerGuideMock).toHaveBeenCalledWith(structure);
    // The real resolver proves the stored guide against the real paper text and returns it: My Review is handed that guide.
    expect(result.props.guide).toBe(getReviewerGuideContract());
    const portions = result.props.cohortPortions ?? [];
    const aggregate = portions.find((portion) => portion.sectionNumber === '7.5');
    expect(aggregate).toMatchObject({ status: 'available', sectionLabel: 'Section 7.5 (7.5.1-7.5.3)' });
    expect(aggregate?.endByte).toBeGreaterThan(aggregate?.startByte ?? -1);
    expect(aggregate?.text).toContain('7.5.1');
    expect(aggregate?.text).toContain('7.5.3');
    const unavailable = portions.find((portion) => portion.status === 'unavailable');
    expect(unavailable).toBeUndefined();

    const workingDraft = await page({ mode: 'working-draft' });
    expect(workingDraft.props.outline).toHaveLength(341);
    // S1 on the real release: 17 depth-1 sections, only the first is server-rendered.
    const realWindow = workingDraft.props.sectionWindow;
    expect(realWindow?.sections).toHaveLength(17);
    expect(realWindow?.initialIndex).toBe(0);
    expect(realWindow?.paperSha256).toBe(structure.manifest.source.sha256);
    expect(realWindow?.sections.reduce((sum, section) => sum + section.bytes, 0)).toBe(541959);
    const initialChunks = workingDraft.props.children?.props.model.chunks ?? [];
    expect(initialChunks).toHaveLength(50);
    expect(initialChunks[0].startByte).toBe(0);
    expect(initialChunks[initialChunks.length - 1].endByte).toBe(realWindow?.sections[0].bytes);
    expect(initialChunks.length).toBeLessThan(338);
  });

  it('aggregates consecutive direct children across valid newline and prose gaps', async () => {
    const content = '7.5.1 Scope\nprose between sections\n7.5.2 Evidence\nmore prose\n7.5.3 Boundary\n';
    const labels = ['7.5.1 Scope', '7.5.2 Evidence', '7.5.3 Boundary'];
    const nodes = labels.map((label, index) => {
      const startByte = content.indexOf(label);
      return { id: `node:${label}`, domain: 'node' as const, kind: 'heading' as const, depth: 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: `agg-${index}`, startByte, endByte: startByte + label.length };
    });
    const appendix = { id: 'node:appendix', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Technical Appendices Compendium', parentId: null, ancestorIds: [], tokenEndByte: content.length, anchor: 'appendix', startByte: content.length, endByte: content.length };
    const placements = [...nodes, appendix].map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
    structureMock.mockReturnValue({ manifest: { source: { version } }, releaseIdentity: 'release', nodes: [...nodes, appendix], objects: [], questions: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] } as never);
    const result = await page({ mode: 'my-review' });
    const aggregate = (result.props.cohortPortions ?? []).find((portion) => portion.sectionNumber === '7.5');
    expect(aggregate).toMatchObject({ sectionNumber: '7.5', status: 'available' });
    expect(aggregate?.text).toContain('prose between sections');
  });

  it('marks a missing direct child number unavailable instead of bridging it', async () => {
    const content = '7.5.1 Scope\n7.5.3 Boundary\n';
    const labels = ['7.5.1 Scope', '7.5.3 Boundary'];
    const nodes = labels.map((label, index) => {
      const startByte = content.indexOf(label);
      return { id: `node:${label}`, domain: 'node' as const, kind: 'heading' as const, depth: 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: `gap-${index}`, startByte, endByte: startByte + label.length };
    });
    const appendix = { id: 'node:appendix', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Technical Appendices Compendium', parentId: null, ancestorIds: [], tokenEndByte: content.length, anchor: 'appendix', startByte: content.length, endByte: content.length };
    const placements = [...nodes, appendix].map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
    structureMock.mockReturnValue({ manifest: { source: { version } }, releaseIdentity: 'release', nodes: [...nodes, appendix], objects: [], questions: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] } as never);
    const result = await page({ mode: 'my-review' });
    const unavailable = (result.props.cohortPortions ?? []).find((portion) => portion.sectionNumber === '7.5');
    expect(unavailable).toMatchObject({ sectionNumber: '7.5', status: 'unavailable' });
    expect(unavailable?.text).toBeUndefined();
  });

  it.each(['guide', 'range', 'paper'])('fails closed with a logged reason code when authenticated %s verification rejects (F-04)', async (tamperedPart) => {
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new Error(`reviewer guide: Invalid reviewer guide contract: prompt source 1 (tampered ${tamperedPart} secret-detail)`); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(workspaceMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('[matrix-options-paper] publication route unavailable: GUIDE_AUTHENTICATION_FAILED');
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret-detail');
  });

  it('logs distinct reason codes for contract and derivation failures, and lets unexpected errors propagate', async () => {
    cohortManifestMock.mockImplementation(() => { throw new Error('Invalid cohort contract: schema version'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(consoleError).toHaveBeenLastCalledWith('[matrix-options-paper] publication route unavailable: URL_CONTEXT_UNAVAILABLE');

    cohortManifestMock.mockImplementation(() => ({ ...defaultManifest(), releaseIdentity: 'other-release' }) as never);
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(consoleError).toHaveBeenLastCalledWith('[matrix-options-paper] publication route unavailable: COHORT_RELEASE_MISMATCH');

    cohortManifestMock.mockImplementation(defaultManifest);
    const withoutBoundary = defaultStructure();
    structureMock.mockReturnValue({ ...withoutBoundary, nodes: withoutBoundary.nodes.filter((node) => node.label !== 'Technical Appendices Compendium') } as never);
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(consoleError).toHaveBeenLastCalledWith('[matrix-options-paper] publication route unavailable: COHORT_PORTIONS_UNAVAILABLE');

    notFoundMock.mockClear();
    consoleError.mockClear();
    structureMock.mockImplementation(() => { throw new Error('structure disk failure'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('structure disk failure');
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('M1-05: rethrows unexpected programming errors instead of converting them to a reason-coded 404', async () => {
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new TypeError('contract.questions is not iterable'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow(TypeError);
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new Error('unexpected guide failure'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('unexpected guide failure');
    class ContractLikeError extends Error {}
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new ContractLikeError('Invalid reviewer guide contract: subclass'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('Invalid reviewer guide contract: subclass');
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new ContractLikeError('reviewer guide: subclass'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('reviewer guide: subclass');

    cohortManifestMock.mockImplementation(() => { throw new TypeError('manifest builder is not a function'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow(TypeError);
    cohortManifestMock.mockImplementation(defaultManifest);

    // Document stage: createWorkspaceModel reads structure.lenses (URL context, guide and portions do not).
    structureMock.mockReturnValue({ ...defaultStructure(), lenses: undefined } as never);
    await expect(page({ mode: 'working-draft' })).rejects.toThrow(TypeError);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(workspaceMock).not.toHaveBeenCalled();
  });

  it('M1-05: still converts a known document-model failure to a logged PAPER_DOCUMENT_UNAVAILABLE 404', async () => {
    const structure = defaultStructure();
    structureMock.mockReturnValue({ ...structure, lenses: { ...structure.lenses, all: [] } } as never);
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenLastCalledWith('[matrix-options-paper] publication route unavailable: PAPER_DOCUMENT_UNAVAILABLE');
  });

  it('authenticates a cached structure once across requests and does not cache failures (F-04)', async () => {
    const structure = defaultStructure();
    structureMock.mockReturnValue(structure as never);
    await page({ mode: 'working-draft' });
    await page({ mode: 'my-review' });
    expect(resolveReviewerGuideMock).toHaveBeenCalledTimes(1);

    const other = defaultStructure();
    structureMock.mockReturnValue(other as never);
    resolveReviewerGuideMock.mockImplementationOnce(() => { throw new Error('reviewer guide: paper SHA-256'); });
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('NEXT_NOT_FOUND');
    const recovered = await page({ mode: 'working-draft' });
    expect(recovered.type).toBe(workspaceMock);
    expect(resolveReviewerGuideMock).toHaveBeenCalledTimes(3);
  });

  it('redirects legacy and resolver states before loading real content', async () => {
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'false';
    await expectRedirect(() => page({}), '/matrix-options?view=TWG%20Review');
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'false';
    await expectRedirect(() => page({}), '/matrix-options/paper/v/1.0.11-remediated-7-8-successor-20260918-D');
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('F-07: node and object child routes redirect to the canonical URL with their section anchor', async () => {
    const node = (id: string, searchParams?: Record<string, string | string[]>) => PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent(id) }), searchParams: searchParams ? Promise.resolve(searchParams) : undefined });
    await expectRedirect(() => node('node:test-3'), `${base}?mode=working-draft&section=test-3`);
    await expectRedirect(() => node('node:test-3', { mode: 'publication', lens: 'all', page: '2' }), `${base}?mode=working-draft&section=test-3`);
    await expectRedirect(() => node('node:test-3', { mode: 'my-review', lens: 'core', q: 'canonical phrase', page: '2' }), `${base}?mode=my-review&section=test-3`);
    await expectRedirect(() => node('node:test-3', { mode: ['my-review', 'publication'] }), `${base}?mode=my-review&section=test-3`);
    await expectRedirect(() => node('node:test-3', { mode: 'my-review', q: guideId(8) }), `${base}?mode=my-review&cohort=inputs-evidence&q=${encodeURIComponent(guideId(8))}&section=test-3`);

    const withObjects = defaultStructure();
    const objects = [
      { id: 'object.table:owned', domain: 'object.table', kind: 'table', label: 'Owned table', ownerNodeId: 'node:test-2', startByte: withObjects.nodes[9].startByte, endByte: withObjects.nodes[9].startByte + 2 },
      { id: 'object.figure:loose', domain: 'object.figure', kind: 'image', label: 'Loose figure', ownerNodeId: null, startByte: withObjects.nodes[5].startByte + 1, endByte: withObjects.nodes[5].startByte + 2 },
    ];
    structureMock.mockReturnValue({ ...withObjects, objects } as never);
    await expectRedirect(() => node('object.table:owned'), `${base}?mode=working-draft&section=test-2`);
    await expectRedirect(() => node('object.figure:loose'), `${base}?mode=working-draft&section=test-5`);

    notFoundMock.mockClear();
    redirectMock.mockClear();
    await expect(node('object.figure:missing')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('F-07: question child routes keep the question identity as a section anchor or a My Review question', async () => {
    const question = (id: string, searchParams?: Record<string, string | string[]>) => PublicationQuestionPage({ params: Promise.resolve({ documentVersion: version, questionId: encodeURIComponent(id) }), searchParams: searchParams ? Promise.resolve(searchParams) : undefined });
    const structure = defaultStructure();
    const questions = [
      { id: 'question:owned', domain: 'question', kind: 'paragraph', label: 'Owned question', containerNodeId: 'node:test-1', ownerNodeId: 'node:test-4', supportNodeIds: [], startByte: structure.nodes[4].startByte, endByte: structure.nodes[4].startByte + 3 },
      { id: 'question:container', domain: 'question', kind: 'paragraph', label: 'Container question', containerNodeId: 'node:test-1', ownerNodeId: 'node:missing', supportNodeIds: [], startByte: structure.nodes[6].startByte, endByte: structure.nodes[6].startByte + 3 },
    ];
    structureMock.mockReturnValue({ ...structure, questions } as never);
    await expectRedirect(() => question('question:owned'), `${base}?mode=working-draft&section=test-4`);
    await expectRedirect(() => question('question:owned', { mode: 'my-review', lens: 'questions', q: 'review', page: '1' }), `${base}?mode=my-review&section=test-4`);
    await expectRedirect(() => question('question:container'), `${base}?mode=working-draft&section=test-1`);
    await expectRedirect(() => question(guideId(4)), `${base}?mode=my-review&cohort=pathway-grid&q=${encodeURIComponent(guideId(4))}`);
    await expectRedirect(() => question(guideId(12), { mode: 'working-draft' }), `${base}?mode=my-review&cohort=inputs-evidence&q=${encodeURIComponent(guideId(12))}`);

    notFoundMock.mockClear();
    await expect(question('question:missing')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it.each(['%', '%E0%A4%A'])('fails closed for malformed canonical node encoding: %s', async (canonicalNodeId) => {
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(structureMock).not.toHaveBeenCalled();
  });

  it.each(['%', '%E0%A4%A'])('fails closed for malformed question ID encoding: %s', async (questionId) => {
    await expect(PublicationQuestionPage({ params: Promise.resolve({ documentVersion: version, questionId }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('fails closed for unknown versions on every publication route', async () => {
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: 'unknown' }), searchParams: Promise.resolve({ mode: 'working-draft' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: 'unknown', canonicalNodeId: 'node%3Atest-1' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(PublicationQuestionPage({ params: Promise.resolve({ documentVersion: 'unknown', questionId: 'question%3Aone' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(structureMock).not.toHaveBeenCalled();
  });

  it('keeps paper routes free of Candidate-015 imports and permanent redirects', () => {
    const root = resolve(process.cwd(), 'src/app/(dashboard)/matrix-options/paper');
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== '__tests__') walk(full);
        } else if (name === 'page.tsx') {
          pages.push(full);
        }
      }
    };
    walk(root);
    expect(pages.length).toBe(11);
    expect(pages.some((routePath) => routePath.endsWith(join('figure-lab', 'page.tsx')))).toBe(true);
    for (const routePath of pages) {
      const source = readFileSync(routePath, 'utf8');
      expect(source).not.toContain('Candidate-015');
      expect(source).not.toMatch(/@\/components\/matrix-options\/paper\/ReviewNavigation|@\/lib\/matrix-options\/paper\/review-navigation/);
      expect(source).not.toContain('permanentRedirect');
    }
  });

  it('passes pending through the full publication page and rethrows boundary failures', async () => {
    downloadServerMock.loadDownloadManifestMapState.mockResolvedValueOnce({ status: 'pending', manifests: null });
    const result = await page({ mode: 'working-draft' });
    expect(result.props).toMatchObject({ downloadManifests: null });
    downloadServerMock.loadDownloadManifestMapState.mockRejectedValueOnce(new Error('private transport failure'));
    await expect(page({ mode: 'working-draft' })).rejects.toThrow('private transport failure');
  });

  it('default release: a session with no user is still served (the page gate is the middleware) and no download is consulted', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null } as never);
    const result = await page({ mode: 'working-draft' });
    expect(result.type).toBe(workspaceMock);
    expect(notFoundMock).not.toHaveBeenCalled();
    expect(downloadServerMock.loadDownloadManifestMapState).not.toHaveBeenCalled();
    expect(result.props).toMatchObject({ downloadManifests: null });
  });

  it('wraps everything a private-storage release renders in the client session gate, bound to the reader the load was authorized for, in both modes, and returns the default release with no gate and no reader id', async () => {
    interface Gated { readonly type: unknown; readonly props: { readonly servedTo: unknown; readonly children: WorkspaceElement } }
    const READER_ID = '44444444-4444-4444-8444-444444444444';
    // The real reader check runs on this request's client; the loader it hands its reader to is a
    // stand-in for the private release: the default synthetic text under that release's identity.
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: READER_ID, is_anonymous: false } }, error: null } as never);
    const resolved = syntheticResolvedR5Guide();
    privateLoadSpy.mockImplementation(async () => ({ ...defaultStructure(), manifest: { source: { version: R5_PAPER_VERSION, sha256: 'f'.repeat(64) } } }));
    cohortManifestMock.mockImplementation(() => ({ ...defaultManifest(), releaseIdentity: R5_PAPER_VERSION }) as never);
    resolveReviewerGuideMock.mockImplementation(() => resolved);
    for (const mode of ['working-draft', 'my-review']) {
      const result = (await PublicationPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION }), searchParams: Promise.resolve({ mode }) })) as unknown as Gated;
      expect(result.type, mode).toBe(PrivateReleaseSessionGate);
      // The gate holds the whole workspace and nothing sits beside it: guide, portions and
      // the first section are all inside.
      expect(Object.keys(result.props).sort(), mode).toEqual(['children', 'servedTo']);
      // The page is bound to the reader of THIS load: the id the reader check issued, which is
      // the very reader the loader was called with.
      expect(result.props.servedTo, mode).toBe(READER_ID);
      expect(privateLoadSpy.mock.calls[privateLoadSpy.mock.calls.length - 1][1], mode).toMatchObject({ userId: READER_ID });
      const workspace = result.props.children;
      expect(workspace.type, mode).toBe(workspaceMock);
      expect(workspace.props.documentVersion, mode).toBe(R5_PAPER_VERSION);
      expect(workspace.props.guide, mode).toBe(resolved);
      if (mode === 'working-draft') expect(workspace.props.children?.type).toBe(PaperDocument);
      else expect(workspace.props.cohortPortions).toHaveLength(14);
    }
    expect(workspaceMock).not.toHaveBeenCalled();
    // One user check per page request, and the default-release loader was never asked.
    expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(2);
    expect(requestLoadSpy).not.toHaveBeenCalled();
    // Another reader's request is bound to that reader.
    supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'another-reader', is_anonymous: false } }, error: null } as never);
    const other = (await PublicationPage({ params: Promise.resolve({ documentVersion: R5_PAPER_VERSION }), searchParams: Promise.resolve({ mode: 'my-review' }) })) as unknown as Gated;
    expect(other.props.servedTo).toBe('another-reader');

    // The default release: the workspace itself is the page's root, exactly as before, and
    // carries no reader id.
    privateLoadSpy.mockClear();
    cohortManifestMock.mockImplementation(defaultManifest);
    resolveReviewerGuideMock.mockImplementation(() => getReviewerGuideContract());
    for (const mode of ['working-draft', 'my-review']) {
      const result = await page({ mode });
      expect(result.type, mode).toBe(workspaceMock);
      expect(result.type, mode).not.toBe(PrivateReleaseSessionGate);
      expect(result.props.documentVersion, mode).toBe(version);
      expect(Object.keys(result.props), mode).not.toContain('servedTo');
    }
    expect(privateLoadSpy).not.toHaveBeenCalled();
  });

  it('hides the complete manifest map from anonymous readers', async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({ data: { user: { is_anonymous: true } }, error: null });
    const { default: PublicationPage } = await import('../page');
    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: '1.0.11-remediated-7-8-successor-20260918-D' }), searchParams: Promise.resolve({ mode: 'my-review' }) });
    expect(result.type).toBe(workspaceMock);
    expect(result.props.downloadManifests).toBeNull();
  });

  describe('v0.9.91 admin-only private release diagnostic', () => {
    const readerId = '44444444-4444-4444-8444-444444444444';
    const request = (documentVersion: string = V0991_PAPER_VERSION) => PublicationPage({
      params: Promise.resolve({ documentVersion }),
      searchParams: Promise.resolve({ mode: 'working-draft' }),
    });

    beforeEach(() => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: readerId, is_anonymous: false } }, error: null } as never);
    });

    it.each(['STATUS', 'STRUCTURE', 'SHA256'] as const)('shows only an allowlisted %s code to a verified admin on the bound release', async (code) => {
      privateLoadSpy.mockRejectedValue(new PrivateReleaseUnavailableError(code));
      const result = await request();
      expect(result.type).toBe(PrivateReleaseSessionGate);
      expect(result.props.servedTo).toBe(readerId);
      const html = renderToStaticMarkup(result.props.children);
      expect(html).toContain('Options Paper unavailable');
      expect(html).toContain(`Diagnostic code: <code>${code}</code>`);
      expect(html).not.toContain(readerId);
      expect(html).not.toContain('presentation.md');
      expect(createAuthenticatedClientMock).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(2);
      expect(supabaseMock.from).toHaveBeenCalledWith('user_roles');
      expect(roleEqMock.mock.calls).toEqual([['user_id', readerId], ['role', 'admin']]);
      expect(privateLoadSpy).toHaveBeenCalledTimes(1);
      expect(requestLoadSpy).not.toHaveBeenCalled();
      expect(workspaceMock).not.toHaveBeenCalled();
    });

    it('never grants access from a substituted second client', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      privateLoadSpy.mockRejectedValue(failure);
      roleMaybeSingleMock.mockResolvedValue({ data: null, error: null } as never);
      const secondClient = {
        auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'substituted-admin', is_anonymous: false } }, error: null })) },
        from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'admin' }, error: null }) }) }) }) })),
      };
      createAuthenticatedClientMock.mockResolvedValueOnce(supabaseMock).mockResolvedValueOnce(secondClient as never);
      await expect(request()).rejects.toBe(failure);
      expect(createAuthenticatedClientMock).toHaveBeenCalledTimes(1);
      expect(secondClient.from).not.toHaveBeenCalled();
    });

    it('fails closed if the authenticated user changes on the same client after the load fails', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      privateLoadSpy.mockRejectedValue(failure);
      supabaseMock.auth.getUser
        .mockResolvedValueOnce({ data: { user: { id: readerId, is_anonymous: false } }, error: null } as never)
        .mockResolvedValueOnce({ data: { user: { id: 'changed-reader', is_anonymous: false } }, error: null } as never);
      await expect(request()).rejects.toBe(failure);
      expect(createAuthenticatedClientMock).toHaveBeenCalledTimes(1);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('preserves the successful bound private-release path without consulting the admin role', async () => {
      const resolved = syntheticResolvedR5Guide();
      privateLoadSpy.mockImplementation(async () => ({ ...defaultStructure(), manifest: { source: { version: V0991_PAPER_VERSION, sha256: 'f'.repeat(64) } } }));
      cohortManifestMock.mockImplementation(() => ({ ...defaultManifest(), releaseIdentity: V0991_PAPER_VERSION }) as never);
      resolveReviewerGuideMock.mockImplementation(() => resolved);
      const result = await request();
      expect(result.type).toBe(PrivateReleaseSessionGate);
      expect(result.props.servedTo).toBe(readerId);
      expect(result.props.children.type).toBe(workspaceMock);
      expect(privateLoadSpy).toHaveBeenCalledTimes(1);
      expect(createAuthenticatedClientMock).toHaveBeenCalledTimes(1);
      expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(1);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('hides the gated diagnostic for a signed-out or changed browser session', async () => {
      privateLoadSpy.mockRejectedValue(new PrivateReleaseUnavailableError('STATUS'));
      const result = await request();
      expect(result.type).toBe(PrivateReleaseSessionGate);
      expect(result.props.servedTo).toBe(readerId);
      expect(privateReleaseReaderState({ session: null, isLoading: false }, readerId)).toBe('denied');
      expect(privateReleaseReaderState({ session: { user: { id: 'other-reader', is_anonymous: false } }, isLoading: false }, readerId)).toBe('denied');
    });

    it('keeps the original generic failure for an ordinary reader', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      privateLoadSpy.mockRejectedValue(failure);
      roleMaybeSingleMock.mockResolvedValue({ data: null, error: null } as never);
      await expect(request()).rejects.toBe(failure);
      expect(workspaceMock).not.toHaveBeenCalled();
    });

    it('keeps anonymous readers out before the private loader and admin lookup', async () => {
      supabaseMock.auth.getUser.mockResolvedValue({ data: { user: { id: readerId, is_anonymous: true } }, error: null } as never);
      await expect(request()).rejects.toThrow('NEXT_NOT_FOUND');
      expect(privateLoadSpy).not.toHaveBeenCalled();
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('fails closed when the admin role lookup errors', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      privateLoadSpy.mockRejectedValue(failure);
      roleMaybeSingleMock.mockResolvedValue({ data: { role: 'admin' }, error: new Error('role sentinel') } as never);
      await expect(request()).rejects.toBe(failure);
    });

    it('does not expose a diagnostic for a different bound release', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      privateLoadSpy.mockRejectedValue(failure);
      await expect(request(R5_PAPER_VERSION)).rejects.toBe(failure);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('does not expose a diagnostic for an unbound version', async () => {
      await expect(request('v0.9.91-wrong-hash')).rejects.toThrow('NEXT_NOT_FOUND');
      expect(privateLoadSpy).not.toHaveBeenCalled();
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it('rejects an unknown forged code and never reflects its sentinel', async () => {
      const failure = new PrivateReleaseUnavailableError('STATUS');
      Object.defineProperty(failure, 'code', { value: 'SENTINEL_PRIVATE_BYTES_URL_TOKEN' });
      privateLoadSpy.mockRejectedValue(failure);
      await expect(request()).rejects.toBe(failure);
      expect(supabaseMock.from).not.toHaveBeenCalled();
      expect(workspaceMock).not.toHaveBeenCalled();
    });

    it('does not mask unrelated errors or change a successful repository release', async () => {
      privateLoadSpy.mockRejectedValue(new TypeError('unrelated sentinel'));
      await expect(request()).rejects.toThrow('unrelated sentinel');
      expect(supabaseMock.from).not.toHaveBeenCalled();
      const result = await page({ mode: 'working-draft' });
      expect(result.type).toBe(workspaceMock);
      expect(supabaseMock.from).not.toHaveBeenCalled();
    });
  });
});
