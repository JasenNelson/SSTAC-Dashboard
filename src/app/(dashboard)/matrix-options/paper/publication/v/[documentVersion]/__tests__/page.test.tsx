import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { redirectMock, notFoundMock, workspaceMock, structureMock, authenticateReviewerGuideMock, cohortManifestMock, paperContent } = vi.hoisted(() => {
  const labels = ['4.1 Categories and uses', '9.9 Water lot use classes', '6.0 Proposed framework', '18.1 Three-part structure', '7.5.1 Scope', '7.5.2 Evidence', '7.5.3 Boundary', '7.8 Exposure terms', '9.5 Matrix derivation options', '7.7 BC Aquatic Database', '15.0 Limitations of this draft', '4.4.2 Existing schedule structure', 'Technical Appendices Compendium', 'unrelated-sentinel'];
  const content = labels.join('\n');
  const nodes = labels.slice(0, -1).map((label, index) => {
    const startByte = content.indexOf(label);
    return { id: `node:test-${index}`, domain: 'node' as const, kind: 'heading' as const, depth: label === 'Technical Appendices Compendium' ? 1 : 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: `test-${index}`, startByte, endByte: startByte + label.length };
  });
  const placements = nodes.map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
  return {
  redirectMock: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  workspaceMock: vi.fn(() => <div data-testid="revised-workspace" />),
  structureMock: vi.fn(() => ({ manifest: { source: { version: '1.0.11-remediated-20260913' } }, releaseIdentity: 'release', nodes, objects: [], questions: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] })),
  authenticateReviewerGuideMock: vi.fn(async (_contract: unknown, _paperText: string): Promise<void> => undefined),
  cohortManifestMock: vi.fn(() => ({
    schemaVersion: 'matrix-paper-cohorts-v1',
    releaseIdentity: '1.0.11-remediated-20260913',
    status: 'PROPOSED_PENDING_OWNER_QP_APPROVAL',
    cohorts: [
      { id: 'categories', name: 'Categories', questionNumbers: [1, 2, 3], sourceLocators: ['Sections 4.1 and 9.9', "Reviewer's Guide lines 181-190"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'pathway-grid', name: 'Pathway and grid', questionNumbers: [4, 5], sourceLocators: ['Sections 4.1 and 6.0', 'Section 18.1', "Reviewer's Guide lines 191-197"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'exposure-assumptions', name: 'Exposure assumptions', questionNumbers: [6, 7], sourceLocators: ['Sections 7.5 and 7.8', 'Section 9.5', "Reviewer's Guide lines 198-204"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'inputs-evidence', name: 'Inputs and evidence', questionNumbers: [8, 9, 12], sourceLocators: ['Sections 7.7 and 7.8', 'Section 15', "Reviewer's Guide lines 205-226"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
      { id: 'methods-water-type', name: 'Methods and water type', questionNumbers: [10, 11], sourceLocators: ['Sections 6.0 and 7.5', 'Section 4.4.2', "Reviewer's Guide lines 212-222"], guideEvidenceRanges: [[1, 1]], purpose: 'test', packageContents: ['test'], limitations: 'test' },
    ],
  })),
    paperContent: content,
  };
});

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/components/matrix-options/paper/RevisedPaperWorkspace', () => ({ RevisedPaperWorkspace: workspaceMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', () => ({ loadRevisedPaperStructure: structureMock }));
vi.mock('@/lib/matrix-options/cohort-contract', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/cohort-contract')>('@/lib/matrix-options/cohort-contract');
  return { ...actual, getCohortManifest: cohortManifestMock };
});
vi.mock('@/lib/matrix-options/reviewer-guide', async () => {
  const actual = await vi.importActual<typeof import('@/lib/matrix-options/reviewer-guide')>('@/lib/matrix-options/reviewer-guide');
  return { ...actual, authenticateReviewerGuideAgainstPaper: authenticateReviewerGuideMock };
});

import PublicationPage from '../page';
import PublicationNodePage from '../nodes/[canonicalNodeId]/page';
import PublicationQuestionPage from '../questions/[questionId]/page';

const version = '1.0.11-remediated-20260913';

describe('paper publication V16 route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticateReviewerGuideMock.mockResolvedValue(undefined);
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  it('renders the publication workspace with SSR query windows', async () => {
    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ lens: 'questions', q: 'question', page: '1' }) });
    expect(result).toBeTruthy();
    expect(authenticateReviewerGuideMock).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: 'matrix-paper-reviewer-guide-v1' }), expect.any(String));
    const props = (result as { props: { cohortPortions: readonly { cohortId: string; status: string; sourceNodeId?: string; sectionLabel: string; startByte?: number; endByte?: number; text?: string }[] } }).props;
    expect(props.cohortPortions).toHaveLength(14);
    expect(props.cohortPortions.filter((portion) => portion.cohortId === 'categories').map((portion) => portion.sectionLabel)).toEqual(['4.1 Categories and uses', '9.9 Water lot use classes']);
    expect(props.cohortPortions.every((portion) => portion.status === 'unavailable' ? portion.text === undefined && portion.startByte === undefined && portion.endByte === undefined : Boolean(portion.sourceNodeId?.startsWith('node:test-') && portion.endByte !== undefined && portion.startByte !== undefined && portion.endByte > portion.startByte && portion.text && portion.text !== paperContent && portion.text !== 'fixture\nunrelated-sentinel' && !portion.text.includes('unrelated-sentinel')))).toBe(true);
  });

  it('renders the real release only after authenticating its guide against paper bytes', async () => {
    const actualStructureModule = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
    const actualGuideModule = await vi.importActual<typeof import('@/lib/matrix-options/reviewer-guide')>('@/lib/matrix-options/reviewer-guide');
    const structure = actualStructureModule.loadRevisedPaperStructure();
    structureMock.mockReturnValueOnce(structure as never);
    authenticateReviewerGuideMock.mockImplementationOnce((contract, paperText) => actualGuideModule.authenticateReviewerGuideAgainstPaper(contract as Parameters<typeof actualGuideModule.authenticateReviewerGuideAgainstPaper>[0], paperText));

    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'my-review' }) });
    expect(result).toBeTruthy();
    expect(authenticateReviewerGuideMock).toHaveBeenCalledWith(expect.objectContaining({ releaseIdentity: version }), structure.content);
    const props = (result as { props: { cohortPortions: readonly { sectionNumber: string; status: string; text?: string; startByte?: number; endByte?: number; sectionLabel?: string }[] } }).props;
    const aggregate = props.cohortPortions.find((portion) => portion.sectionNumber === '7.5');
    expect(aggregate).toMatchObject({ status: 'available', sectionLabel: 'Section 7.5 (7.5.1-7.5.3)' });
    expect(aggregate?.endByte).toBeGreaterThan(aggregate?.startByte ?? -1);
    expect(aggregate?.text).toContain('7.5.1');
    expect(aggregate?.text).toContain('7.5.3');
    const unavailable = props.cohortPortions.find((portion) => portion.sectionNumber === '7.8');
    expect(unavailable).toMatchObject({ status: 'unavailable', sectionLabel: 'Section 7.8' });
    expect(unavailable?.text).toBeUndefined();
    expect(unavailable?.startByte).toBeUndefined();
    expect(unavailable?.endByte).toBeUndefined();
  });

  it('aggregates consecutive direct children across valid newline and prose gaps', async () => {
    const content = '7.5.1 Scope\nprose between sections\n7.5.2 Evidence\nmore prose\n7.5.3 Boundary\n';
    const labels = ['7.5.1 Scope', '7.5.2 Evidence', '7.5.3 Boundary'];
    const nodes = labels.map((label) => {
      const startByte = content.indexOf(label);
      return { id: `node:${label}`, domain: 'node' as const, kind: 'heading' as const, depth: 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: label, startByte, endByte: startByte + label.length };
    });
    const appendix = { id: 'node:appendix', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Technical Appendices Compendium', parentId: null, ancestorIds: [], tokenEndByte: content.length, anchor: 'appendix', startByte: content.length, endByte: content.length };
    const placements = [...nodes, appendix].map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
    structureMock.mockReturnValueOnce({ manifest: { source: { version } }, releaseIdentity: 'release', nodes: [...nodes, appendix], objects: [], questions: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] } as never);
    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'my-review' }) });
    const props = (result as { props: { cohortPortions: readonly { sectionNumber: string; status: string; text?: string }[] } }).props;
    const aggregate = props.cohortPortions.find((portion) => portion.sectionNumber === '7.5');
    expect(aggregate).toMatchObject({ sectionNumber: '7.5', status: 'available' });
    expect(aggregate?.text).toContain('prose between sections');
  });

  it('marks a missing direct child number unavailable instead of bridging it', async () => {
    const content = '7.5.1 Scope\n7.5.3 Boundary\n';
    const labels = ['7.5.1 Scope', '7.5.3 Boundary'];
    const nodes = labels.map((label) => {
      const startByte = content.indexOf(label);
      return { id: `node:${label}`, domain: 'node' as const, kind: 'heading' as const, depth: 2, label, parentId: null, ancestorIds: [], tokenEndByte: startByte + label.length, anchor: label, startByte, endByte: startByte + label.length };
    });
    const appendix = { id: 'node:appendix', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Technical Appendices Compendium', parentId: null, ancestorIds: [], tokenEndByte: content.length, anchor: 'appendix', startByte: content.length, endByte: content.length };
    const placements = [...nodes, appendix].map((node) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
    structureMock.mockReturnValueOnce({ manifest: { source: { version } }, releaseIdentity: 'release', nodes: [...nodes, appendix], objects: [], questions: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, content, lines: content.split('\n'), questionContainerIds: [] } as never);
    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'my-review' }) });
    const props = (result as { props: { cohortPortions: readonly { sectionNumber: string; status: string; text?: string }[] } }).props;
    const unavailable = props.cohortPortions.find((portion) => portion.sectionNumber === '7.5');
    expect(unavailable).toMatchObject({ sectionNumber: '7.5', status: 'unavailable' });
    expect(unavailable?.text).toBeUndefined();
  });

  it.each(['guide', 'range', 'paper'])('fails closed when authenticated %s verification rejects', async (tamperedPart) => {
    authenticateReviewerGuideMock.mockRejectedValueOnce(new Error(`tampered ${tamperedPart}`));
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(workspaceMock).not.toHaveBeenCalled();
  });

  it('redirects legacy and resolver states before loading real content', async () => {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
    redirectMock.mockClear();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper/v/1.0.11-remediated-20260913');
  });

  it('resolves one encoded canonical node identity through the real release', async () => {
    const placement = { id: 'node:canonical', domain: 'node' as const, lens: 'all' as const, label: 'Canonical section', reason: 'section', triggers: [], startByte: 0, endByte: 8 };
    structureMock.mockReturnValueOnce({
      manifest: { source: { version } },
      releaseIdentity: 'release',
      nodes: [{ id: placement.id, domain: 'node', kind: 'heading', depth: 1, label: placement.label, parentId: null, ancestorIds: [], tokenEndByte: 8, anchor: 'canonical', startByte: 0, endByte: 8 }],
      objects: [],
      questions: [],
      lenses: { all: [placement], core: [], appendices: [], evidence: [], objects: [], questions: [] },
      content: 'Canonical',
      lines: [],
      questionContainerIds: [],
    } as never);
    const result = await PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: 'node%3Acanonical' }) });
    expect(result).toBeTruthy();
    expect(structureMock).toHaveBeenCalledTimes(1);
    expect((result as { type: unknown }).type).toBe(workspaceMock);
  });

  it('resolves the live first Atlas identity from the authenticated compiler output', async () => {
    const actual = await vi.importActual<typeof import('@/lib/matrix-options/revised-paper-structure')>('@/lib/matrix-options/revised-paper-structure');
    const structure = actual.loadRevisedPaperStructure();
    const firstNode = structure.nodes[0];
    expect(firstNode?.id).toBe('node:d91ee5bfdfd4352f8c9562698ffcd32d0f80d4182704cd7e30c202d1e2290e37');
    structureMock.mockReturnValueOnce(structure as never);
    const result = await PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent(firstNode.id) }) });
    expect(result).toBeTruthy();
    expect((result as { type: unknown }).type).toBe(workspaceMock);
  });

  it('opens figure, table, and equation atlas objects with requested identity and exact range', async () => {
    const owner = { id: 'node:owner', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Owner section', parentId: null, ancestorIds: [], tokenEndByte: 3, anchor: 'owner', startByte: 0, endByte: 3 };
    const domains = [
      ['object.figure', 'Figure object', 3, 9, 'FIGURE'] as const,
      ['object.table', 'Table object', 9, 14, 'TABLE'] as const,
      ['object.equation', 'Equation object', 14, 18, 'MATH'] as const,
    ];
    const objects = domains.map(([domain, label, startByte, endByte]) => ({
      id: `${domain}:one`, domain, kind: domain === 'object.figure' ? 'image' : domain === 'object.table' ? 'table' : 'math', label, ownerNodeId: owner.id, startByte, endByte,
    }));
    const placements = [
      { id: owner.id, domain: 'node' as const, lens: 'all' as const, label: owner.label, reason: 'owner', triggers: [], startByte: owner.startByte, endByte: owner.endByte },
      ...objects.map((object) => ({ id: object.id, domain: object.domain, lens: 'objects' as const, label: object.label, reason: 'object', triggers: [], startByte: object.startByte, endByte: object.endByte })),
    ];
    const structure = {
      manifest: { source: { version } },
      releaseIdentity: 'release',
      nodes: [owner],
      objects,
      questions: [],
      lenses: { all: placements, core: [], appendices: [], evidence: [], objects: placements.slice(1), questions: [] },
      content: 'OWNFIGURETABLEMATH',
      lines: [],
      questionContainerIds: [],
    } as never;

    for (const [domain, label, , , source] of domains) {
      const id = `${domain}:one`;
      structureMock.mockReturnValueOnce(structure);
      const result = await PublicationNodePage({
        params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent(id) }),
      });
      const props = (result as { props: { model: { requestedDetail: { id: string; domain: string; label: string }; readerContext: { selectedOwnerNodeId: string | null }; }; readerText: string } }).props;
      expect(props.model.requestedDetail).toMatchObject({ id, domain, label });
      expect(props.model.readerContext.selectedOwnerNodeId).toBe(owner.id);
      expect(props.readerText).toBe(source);
    }
  });

  it('fails closed for an unknown object identity and preserves publication modes', async () => {
    structureMock.mockReturnValueOnce({
      manifest: { source: { version } }, releaseIdentity: 'release', nodes: [], objects: [], questions: [],
      lenses: { all: [], core: [], appendices: [], evidence: [], objects: [], questions: [] }, content: '', lines: [], questionContainerIds: [],
    } as never);
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent('object.figure:missing') }) })).rejects.toThrow('NEXT_NOT_FOUND');

    const publication = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'publication' }) });
    expect((publication as { props: { model: { mode: string } } }).props.model.mode).toBe('publication');
    const review = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'my-review' }) });
    expect((review as { props: { model: { mode: string } } }).props.model.mode).toBe('my-review');
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: 'invalid' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ mode: ['publication', 'my-review'] }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('redirects My Review child details to the canonical publication workspace with query state', async () => {
    const nodePlacement = { id: 'node:canonical', domain: 'node' as const, lens: 'all' as const, label: 'Canonical section', reason: 'section', triggers: [], startByte: 0, endByte: 9 };
    const questionPlacement = { id: 'question:canonical', domain: 'question' as const, lens: 'questions' as const, label: 'Review question', reason: 'question', triggers: [], startByte: 0, endByte: 9 };
    const structure = {
      manifest: { source: { version } },
      releaseIdentity: 'release',
      nodes: [{ id: nodePlacement.id, domain: 'node', kind: 'heading', depth: 1, label: nodePlacement.label, parentId: null, ancestorIds: [], tokenEndByte: 9, anchor: 'canonical', startByte: 0, endByte: 9 }],
      objects: [],
      questions: [{ id: questionPlacement.id, domain: 'question', kind: 'heading', label: questionPlacement.label, containerNodeId: nodePlacement.id, ownerNodeId: nodePlacement.id, supportNodeIds: [], startByte: 0, endByte: 9 }],
      lenses: { all: [nodePlacement], core: [nodePlacement], appendices: [], evidence: [], objects: [], questions: [questionPlacement] },
      content: 'Canonical',
      lines: [],
      questionContainerIds: [],
    } as never;
    structureMock.mockReturnValue(structure);

    await expect(PublicationNodePage({
      params: Promise.resolve({ documentVersion: version, canonicalNodeId: 'node%3Acanonical' }),
      searchParams: Promise.resolve({ mode: 'my-review', lens: 'core', q: 'canonical phrase', page: '2' }),
    })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper/publication/v/1.0.11-remediated-20260913?mode=my-review&lens=core&page=2&q=canonical+phrase');
    redirectMock.mockClear();
    await expect(PublicationQuestionPage({
      params: Promise.resolve({ documentVersion: version, questionId: 'question%3Acanonical' }),
      searchParams: Promise.resolve({ mode: 'my-review', lens: 'questions', q: 'review', page: '1' }),
    })).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper/publication/v/1.0.11-remediated-20260913?mode=my-review&lens=questions&page=1&q=review');
    await expect(PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: 'node%3Acanonical' }), searchParams: Promise.resolve({ mode: ['my-review', 'publication'] }) })).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('keeps publication routes free of Candidate-015 navigation imports', () => {
    const routePaths = [
      'src/app/(dashboard)/matrix-options/paper/publication/v/[documentVersion]/page.tsx',
      'src/app/(dashboard)/matrix-options/paper/publication/v/[documentVersion]/nodes/[canonicalNodeId]/page.tsx',
      'src/app/(dashboard)/matrix-options/paper/publication/v/[documentVersion]/questions/[questionId]/page.tsx',
    ];
    for (const routePath of routePaths) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      expect(source).not.toContain('Candidate-015');
      expect(source).not.toMatch(/@\/components\/matrix-options\/paper\/ReviewNavigation|@\/lib\/matrix-options\/paper\/review-navigation/);
    }
  });

  it('keeps requested detail selected when q is broad and resets inherited page without q', async () => {
    const first = { id: 'node:first', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Canonical sibling', parentId: null, ancestorIds: [], tokenEndByte: 9, anchor: 'first', startByte: 0, endByte: 9 };
    const target = { id: 'node:target', domain: 'node' as const, kind: 'heading' as const, depth: 1, label: 'Canonical target', parentId: null, ancestorIds: [], tokenEndByte: 9, anchor: 'target', startByte: 0, endByte: 9 };
    const placement = (node: typeof first) => ({ id: node.id, domain: 'node' as const, lens: 'all' as const, label: node.label, reason: 'section', triggers: [], startByte: node.startByte, endByte: node.endByte });
    const structure = { manifest: { source: { version } }, releaseIdentity: 'release', nodes: [first, target], objects: [], questions: [], lenses: { all: [placement(first), placement(target)], core: [], appendices: [], evidence: [], objects: [], questions: [] }, content: 'Canonical', lines: [], questionContainerIds: [] } as never;
    structureMock.mockReturnValue(structure);
    const inheritedPage = await PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent(target.id) }), searchParams: Promise.resolve({ page: '2' }) });
    const inheritedModel = (inheritedPage as { props: { model: { atlas: { query: { page: number } }; requestedDetail: { id: string }; readerContext: { selectedId: string | null } } } }).props.model;
    expect(inheritedModel.atlas.query.page).toBe(1);
    expect(inheritedModel.requestedDetail.id).toBe(target.id);
    expect(inheritedModel.readerContext.selectedId).toBe(target.id);
    const broadPage = await PublicationNodePage({ params: Promise.resolve({ documentVersion: version, canonicalNodeId: encodeURIComponent(target.id) }), searchParams: Promise.resolve({ q: 'canonical', page: '1' }) });
    const broadModel = (broadPage as { props: { model: { atlas: { query: { q: string; page: number } }; requestedDetail: { id: string }; readerContext: { selectedId: string | null } } } }).props.model;
    expect(broadModel.atlas.query).toEqual({ lens: 'all', q: 'canonical', page: 1 });
    expect(broadModel.requestedDetail.id).toBe(target.id);
    expect(broadModel.readerContext.selectedId).toBe(target.id);
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
});
