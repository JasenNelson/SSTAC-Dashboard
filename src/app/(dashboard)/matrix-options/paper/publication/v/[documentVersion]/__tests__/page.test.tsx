import { describe, expect, it, beforeEach, vi } from 'vitest';

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
    const nodeModel = (nodeResult as { props: { model: { mode: string; atlas: { query: unknown } } } }).props.model;
    expect(nodeModel.mode).toBe('my-review');
    expect(nodeModel.atlas.query).toEqual({ lens: 'core', q: 'canonical', page: 1 });

    const questionResult = await PublicationQuestionPage({
      params: Promise.resolve({ documentVersion: version, questionId: 'question%3Acanonical' }),
      searchParams: Promise.resolve({ mode: 'my-review', lens: 'questions', q: 'review', page: '1' }),
    });
    const questionModel = (questionResult as { props: { model: { mode: string; atlas: { query: unknown } } } }).props.model;
    expect(questionModel.mode).toBe('my-review');
    expect(questionModel.atlas.query).toEqual({ lens: 'questions', q: 'review', page: 1 });
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
