import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { redirectMock, notFoundMock, workspaceMock, structureMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => { throw new Error('NEXT_REDIRECT'); }),
  notFoundMock: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  workspaceMock: vi.fn(() => <div data-testid="revised-workspace" />),
  structureMock: vi.fn(() => ({ manifest: { source: { version: '1.0.11-remediated-20260913' } }, releaseIdentity: 'release', nodes: [], objects: [], questions: [], lenses: { all: [], core: [], appendices: [], evidence: [], objects: [], questions: [] }, content: '', lines: [], questionContainerIds: [] })),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock('@/components/matrix-options/paper/RevisedPaperWorkspace', () => ({ RevisedPaperWorkspace: workspaceMock }));
vi.mock('@/lib/matrix-options/revised-paper-structure', () => ({ loadRevisedPaperStructure: structureMock }));

import PublicationPage from '../page';
import PublicationNodePage from '../nodes/[canonicalNodeId]/page';
import PublicationQuestionPage from '../questions/[questionId]/page';

const version = '1.0.11-remediated-20260913';

describe('paper publication V16 route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
  });

  it('renders the publication workspace with SSR query windows', async () => {
    const result = await PublicationPage({ params: Promise.resolve({ documentVersion: version }), searchParams: Promise.resolve({ lens: 'questions', q: 'question', page: '1' }) });
    expect(result).toBeTruthy();
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

  it('preserves My Review mode and Atlas query state on canonical node and question children', async () => {
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

    const nodeResult = await PublicationNodePage({
      params: Promise.resolve({ documentVersion: version, canonicalNodeId: 'node%3Acanonical' }),
      searchParams: Promise.resolve({ mode: 'my-review', lens: 'core', q: 'canonical', page: '1' }),
    });
    const nodeModel = (nodeResult as { props: { model: { mode: string; atlas: { query: unknown }; requestedDetail: { id: string; label: string; domain: string; ownerNodeId: string | null } } } }).props.model;
    expect(nodeModel.mode).toBe('my-review');
    expect(nodeModel.atlas.query).toEqual({ lens: 'core', q: 'canonical', page: 1 });
    expect((nodeResult as { props: { readerText: string } }).props.readerText).toBe('Canonical');

    const questionResult = await PublicationQuestionPage({
      params: Promise.resolve({ documentVersion: version, questionId: 'question%3Acanonical' }),
      searchParams: Promise.resolve({ mode: 'my-review', lens: 'questions', q: 'review', page: '1' }),
    });
    const questionModel = (questionResult as { props: { model: { mode: string; atlas: { query: unknown }; requestedDetail: { id: string; label: string; domain: string; ownerNodeId: string | null } } } }).props.model;
    expect(questionModel.mode).toBe('my-review');
    expect(questionModel.atlas.query).toEqual({ lens: 'questions', q: 'review', page: 1 });
    expect((questionResult as { props: { readerText: string } }).props.readerText).toBe('Canonical');
    expect(nodeModel.requestedDetail).toMatchObject({ id: nodePlacement.id, label: nodePlacement.label, domain: 'node' });
    expect(questionModel.requestedDetail).toMatchObject({ id: questionPlacement.id, label: questionPlacement.label, domain: 'question', ownerNodeId: nodePlacement.id });
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
