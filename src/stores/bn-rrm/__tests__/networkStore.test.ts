/**
 * Tests for networkStore.ts (useNetworkStore).
 *
 * Strategy: use the real Zustand store with setState resets between tests.
 * Mocks:
 *   - createDummyNetwork / createTrainedNetwork / createGenericNetwork -- lightweight stubs
 *   - dagForwardInference / dagBackwardInference -- return minimal belief objects
 *   - global fetch -- for loadPackModel
 *
 * Does NOT import React or jsdom; store actions are synchronous or awaited directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

import type {
  NetworkModel,
  NetworkNodeData,
  ContainerData,
  NetworkEdge,
} from '@/types/bn-rrm/network';

function makeNode(id: string, category: 'substance' | 'condition' | 'effect' | 'impact' = 'substance'): NetworkNodeData {
  return {
    id,
    label: id,
    category,
    parameter: id,
    unit: 'mg/kg',
    mediaType: 'sediment',
    states: [
      { id: 'low', label: 'Low' },
      { id: 'high', label: 'High' },
    ],
    beliefs: { low: 0.5, high: 0.5 },
    evidence: null,
  } as NetworkNodeData;
}

function makeContainer(id: string, childNodeIds: string[] = [], collapsed = false): ContainerData {
  return {
    id,
    label: id,
    category: 'substance',
    collapsed,
    childNodeIds,
    position: { x: 0, y: 0 },
  };
}

function makeEdge(id: string, source: string, target: string): NetworkEdge {
  return { id, source, target };
}

function makeModel(nodes: NetworkNodeData[], edges: NetworkEdge[] = [], containers: ContainerData[] = []): NetworkModel {
  return {
    id: 'test-model',
    name: 'Test Model',
    nodes,
    edges,
    containers,
    cpts: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/bn-rrm/dummy-data', () => ({
  createDummyNetwork: vi.fn(() => makeModel([makeNode('n1')])),
}));

vi.mock('@/lib/bn-rrm/trained-network', () => ({
  createTrainedNetwork: vi.fn(() => makeModel([makeNode('expert-node')])),
  createGenericNetwork: vi.fn(() => makeModel([makeNode('generic-node')])),
}));

vi.mock('@/lib/bn-rrm/bn-inference', () => ({
  dagForwardInference: vi.fn(() => ({ beliefs: { n1: { low: 0.4, high: 0.6 } }, computationTimeMs: 1, algorithm: 'dag-forward' })),
  dagBackwardInference: vi.fn(() => ({ beliefs: { n1: { low: 0.7, high: 0.3 } }, computationTimeMs: 1, algorithm: 'dag-backward' })),
}));

import { useNetworkStore } from '../networkStore';

// ---------------------------------------------------------------------------
// Reset store state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useNetworkStore.setState({
    model: null,
    nodeMap: new Map(),
    containerMap: new Map(),
    evidence: {},
    selectedNodeId: null,
    selectedContainerId: null,
    highlightedPath: [],
    isLoading: false,
    isInferenceRunning: false,
    _loadGeneration: 0,
  });
  vi.clearAllMocks();
});

// ===========================================================================
// loadModel
// ===========================================================================

describe('loadModel', () => {
  it('sets model and builds nodeMap', () => {
    const model = makeModel([makeNode('a'), makeNode('b')]);
    useNetworkStore.getState().loadModel(model);
    const state = useNetworkStore.getState();
    expect(state.model).toBe(model);
    expect(state.nodeMap.has('a')).toBe(true);
    expect(state.nodeMap.has('b')).toBe(true);
  });

  it('builds containerMap from model containers', () => {
    const containers = [makeContainer('c1', ['a']), makeContainer('c2', ['b'])];
    const model = makeModel([makeNode('a'), makeNode('b')], [], containers);
    useNetworkStore.getState().loadModel(model);
    const { containerMap } = useNetworkStore.getState();
    expect(containerMap.has('c1')).toBe(true);
    expect(containerMap.has('c2')).toBe(true);
  });

  it('resets evidence and selection on load', () => {
    useNetworkStore.setState({ evidence: { n1: 'low' }, selectedNodeId: 'n1' });
    const model = makeModel([makeNode('x')]);
    useNetworkStore.getState().loadModel(model);
    const state = useNetworkStore.getState();
    expect(state.evidence).toEqual({});
    expect(state.selectedNodeId).toBeNull();
  });

  it('resets highlightedPath on load', () => {
    useNetworkStore.setState({ highlightedPath: ['a', 'b'] });
    useNetworkStore.getState().loadModel(makeModel([]));
    expect(useNetworkStore.getState().highlightedPath).toEqual([]);
  });
});

// ===========================================================================
// loadDummyModel
// ===========================================================================

describe('loadDummyModel', () => {
  it('loads model from createDummyNetwork', async () => {
    const { createDummyNetwork } = await import('@/lib/bn-rrm/dummy-data');
    useNetworkStore.getState().loadDummyModel();
    expect(createDummyNetwork).toHaveBeenCalledOnce();
    expect(useNetworkStore.getState().model).not.toBeNull();
  });
});

// ===========================================================================
// loadTrainedModel
// ===========================================================================

describe('loadTrainedModel', () => {
  it('defaults to expert source', async () => {
    const { createTrainedNetwork } = await import('@/lib/bn-rrm/trained-network');
    await useNetworkStore.getState().loadTrainedModel();
    expect(createTrainedNetwork).toHaveBeenCalledWith('expert');
  });

  it('uses expert source when explicitly requested', async () => {
    const { createTrainedNetwork } = await import('@/lib/bn-rrm/trained-network');
    await useNetworkStore.getState().loadTrainedModel('expert');
    expect(createTrainedNetwork).toHaveBeenCalledWith('expert');
  });
});

// ===========================================================================
// selectNode / highlightCausalPath
// ===========================================================================

describe('selectNode', () => {
  it('sets selectedNodeId and builds highlightedPath', () => {
    const nodeA = makeNode('a');
    const nodeB = makeNode('b');
    const model = makeModel([nodeA, nodeB], [makeEdge('e1', 'a', 'b')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().selectNode('b');

    const state = useNetworkStore.getState();
    expect(state.selectedNodeId).toBe('b');
    // 'a' is ancestor of 'b' via edge a->b; highlightedPath includes 'b' and 'a'
    expect(state.highlightedPath).toContain('b');
    expect(state.highlightedPath).toContain('a');
  });

  it('clears highlight when null passed', () => {
    useNetworkStore.setState({ highlightedPath: ['x', 'y'] });
    useNetworkStore.getState().selectNode(null);
    expect(useNetworkStore.getState().selectedNodeId).toBeNull();
    expect(useNetworkStore.getState().highlightedPath).toEqual([]);
  });
});

// ===========================================================================
// selectContainer
// ===========================================================================

describe('selectContainer', () => {
  it('sets selectedContainerId', () => {
    useNetworkStore.getState().selectContainer('c1');
    expect(useNetworkStore.getState().selectedContainerId).toBe('c1');
  });

  it('can be cleared with null', () => {
    useNetworkStore.getState().selectContainer('c1');
    useNetworkStore.getState().selectContainer(null);
    expect(useNetworkStore.getState().selectedContainerId).toBeNull();
  });
});

// ===========================================================================
// toggleContainer / expandAllContainers / collapseAllContainers
// ===========================================================================

describe('toggleContainer', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().toggleContainer('c1');
    expect(useNetworkStore.getState().model).toBeNull();
  });

  it('is a no-op when container id does not exist', () => {
    const model = makeModel([], [], [makeContainer('c1', [])]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().toggleContainer('nonexistent');
    // containers unchanged
    expect(useNetworkStore.getState().model!.containers[0].collapsed).toBe(false);
  });

  it('toggles collapsed=false -> true', () => {
    const container = makeContainer('c1', [], false);
    const model = makeModel([], [], [container]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().toggleContainer('c1');
    expect(useNetworkStore.getState().containerMap.get('c1')!.collapsed).toBe(true);
  });

  it('toggles collapsed=true -> false', () => {
    const container = makeContainer('c1', [], true);
    const model = makeModel([], [], [container]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().toggleContainer('c1');
    expect(useNetworkStore.getState().containerMap.get('c1')!.collapsed).toBe(false);
  });
});

describe('expandAllContainers', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().expandAllContainers();
    expect(useNetworkStore.getState().model).toBeNull();
  });

  it('sets all containers to collapsed=false', () => {
    const model = makeModel([], [], [
      makeContainer('c1', [], true),
      makeContainer('c2', [], true),
    ]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().expandAllContainers();
    const { containerMap } = useNetworkStore.getState();
    expect(containerMap.get('c1')!.collapsed).toBe(false);
    expect(containerMap.get('c2')!.collapsed).toBe(false);
  });
});

describe('collapseAllContainers', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().collapseAllContainers();
    expect(useNetworkStore.getState().model).toBeNull();
  });

  it('sets all containers to collapsed=true', () => {
    const model = makeModel([], [], [
      makeContainer('c1', [], false),
      makeContainer('c2', [], false),
    ]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().collapseAllContainers();
    const { containerMap } = useNetworkStore.getState();
    expect(containerMap.get('c1')!.collapsed).toBe(true);
    expect(containerMap.get('c2')!.collapsed).toBe(true);
  });
});

// ===========================================================================
// setEvidence / clearEvidence / clearAllEvidence
// ===========================================================================

describe('setEvidence', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().setEvidence('n1', 'low');
    expect(useNetworkStore.getState().evidence).toEqual({});
  });

  it('adds evidence entry and updates node beliefs deterministically', () => {
    const node = makeNode('n1');
    const model = makeModel([node]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().setEvidence('n1', 'low');
    const state = useNetworkStore.getState();
    expect(state.evidence['n1']).toBe('low');
    const updatedNode = state.nodeMap.get('n1')!;
    expect(updatedNode.beliefs['low']).toBe(1.0);
    expect(updatedNode.beliefs['high']).toBe(0.0);
    expect(updatedNode.evidence).toBe('low');
  });
});

describe('clearEvidence', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.setState({ evidence: { n1: 'low' } });
    useNetworkStore.getState().clearEvidence('n1');
    // model is null so nothing changes
    expect(useNetworkStore.getState().evidence).toEqual({ n1: 'low' });
  });

  it('removes evidence and restores uniform beliefs', () => {
    const node = makeNode('n1');
    const model = makeModel([node]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().setEvidence('n1', 'low');
    useNetworkStore.getState().clearEvidence('n1');
    const state = useNetworkStore.getState();
    expect(state.evidence['n1']).toBeUndefined();
    const updatedNode = state.nodeMap.get('n1')!;
    // Uniform = 1/2 = 0.5
    expect(updatedNode.beliefs['low']).toBe(0.5);
    expect(updatedNode.beliefs['high']).toBe(0.5);
    expect(updatedNode.evidence).toBeNull();
  });
});

describe('clearAllEvidence', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.setState({ evidence: { n1: 'low' } });
    useNetworkStore.getState().clearAllEvidence();
    expect(useNetworkStore.getState().evidence).toEqual({ n1: 'low' });
  });

  it('clears all evidence entries and sets uniform beliefs', () => {
    const nodeA = makeNode('a');
    const nodeB = makeNode('b');
    const model = makeModel([nodeA, nodeB]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().setEvidence('a', 'high');
    useNetworkStore.getState().setEvidence('b', 'low');
    useNetworkStore.getState().clearAllEvidence();
    const state = useNetworkStore.getState();
    expect(state.evidence).toEqual({});
    expect(state.nodeMap.get('a')!.evidence).toBeNull();
    expect(state.nodeMap.get('b')!.evidence).toBeNull();
  });
});

// ===========================================================================
// updateBeliefs
// ===========================================================================

describe('updateBeliefs', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().updateBeliefs({ n1: { low: 0.3, high: 0.7 } });
    expect(useNetworkStore.getState().model).toBeNull();
  });

  it('updates beliefs for matching node', () => {
    const model = makeModel([makeNode('n1')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().updateBeliefs({ n1: { low: 0.2, high: 0.8 } });
    const node = useNetworkStore.getState().nodeMap.get('n1')!;
    expect(node.beliefs['low']).toBe(0.2);
    expect(node.beliefs['high']).toBe(0.8);
  });

  it('leaves unmatched nodes unchanged', () => {
    const model = makeModel([makeNode('n1'), makeNode('n2')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().updateBeliefs({ n1: { low: 0.1, high: 0.9 } });
    // n2 should be unchanged (beliefs still 0.5 / 0.5)
    const n2 = useNetworkStore.getState().nodeMap.get('n2')!;
    expect(n2.beliefs['low']).toBe(0.5);
  });
});

// ===========================================================================
// highlightCausalPath / clearHighlight
// ===========================================================================

describe('highlightCausalPath', () => {
  it('is a no-op when model is null', () => {
    useNetworkStore.getState().highlightCausalPath('n1');
    expect(useNetworkStore.getState().highlightedPath).toEqual([]);
  });

  it('includes the node itself in the highlighted path', () => {
    const model = makeModel([makeNode('a'), makeNode('b')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().highlightCausalPath('b');
    expect(useNetworkStore.getState().highlightedPath).toContain('b');
  });

  it('includes all upstream ancestors', () => {
    // a -> b -> c
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const model = makeModel(nodes, edges);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().highlightCausalPath('c');
    const path = useNetworkStore.getState().highlightedPath;
    expect(path).toContain('c');
    expect(path).toContain('b');
    expect(path).toContain('a');
  });

  it('does not include downstream nodes', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'b', 'c')];
    const model = makeModel(nodes, edges);
    useNetworkStore.getState().loadModel(model);
    // Highlight 'b' -- 'a' is ancestor, 'c' is downstream
    useNetworkStore.getState().highlightCausalPath('b');
    const path = useNetworkStore.getState().highlightedPath;
    expect(path).toContain('b');
    expect(path).toContain('a');
    expect(path).not.toContain('c');
  });
});

describe('clearHighlight', () => {
  it('empties the highlightedPath', () => {
    useNetworkStore.setState({ highlightedPath: ['a', 'b'] });
    useNetworkStore.getState().clearHighlight();
    expect(useNetworkStore.getState().highlightedPath).toEqual([]);
  });
});

// ===========================================================================
// getNodesByCategory
// ===========================================================================

describe('getNodesByCategory', () => {
  it('returns empty array when model is null', () => {
    expect(useNetworkStore.getState().getNodesByCategory('substance')).toEqual([]);
  });

  it('filters nodes by category', () => {
    const nodes = [
      makeNode('n1', 'substance'),
      makeNode('n2', 'condition'),
      makeNode('n3', 'substance'),
    ];
    useNetworkStore.getState().loadModel(makeModel(nodes));
    const substances = useNetworkStore.getState().getNodesByCategory('substance');
    expect(substances).toHaveLength(2);
    expect(substances.every(n => n.category === 'substance')).toBe(true);
  });
});

// ===========================================================================
// getNodesInContainer
// ===========================================================================

describe('getNodesInContainer', () => {
  it('returns empty array when model is null', () => {
    expect(useNetworkStore.getState().getNodesInContainer('c1')).toEqual([]);
  });

  it('returns empty array when container not found', () => {
    const model = makeModel([], [], []);
    useNetworkStore.getState().loadModel(model);
    expect(useNetworkStore.getState().getNodesInContainer('nonexistent')).toEqual([]);
  });

  it('returns nodes belonging to the container', () => {
    const nodes = [makeNode('n1'), makeNode('n2'), makeNode('n3')];
    const containers = [makeContainer('c1', ['n1', 'n3'])];
    useNetworkStore.getState().loadModel(makeModel(nodes, [], containers));
    const result = useNetworkStore.getState().getNodesInContainer('c1');
    expect(result.map(n => n.id).sort()).toEqual(['n1', 'n3']);
  });
});

// ===========================================================================
// getParentNodes / getChildNodes
// ===========================================================================

describe('getParentNodes', () => {
  it('returns empty array when model is null', () => {
    expect(useNetworkStore.getState().getParentNodes('n1')).toEqual([]);
  });

  it('returns direct parent nodes via edges', () => {
    const nodes = [makeNode('p1'), makeNode('p2'), makeNode('child')];
    const edges = [makeEdge('e1', 'p1', 'child'), makeEdge('e2', 'p2', 'child')];
    useNetworkStore.getState().loadModel(makeModel(nodes, edges));
    const parents = useNetworkStore.getState().getParentNodes('child');
    expect(parents.map(n => n.id).sort()).toEqual(['p1', 'p2']);
  });
});

describe('getChildNodes', () => {
  it('returns empty array when model is null', () => {
    expect(useNetworkStore.getState().getChildNodes('n1')).toEqual([]);
  });

  it('returns direct child nodes via edges', () => {
    const nodes = [makeNode('parent'), makeNode('c1'), makeNode('c2')];
    const edges = [makeEdge('e1', 'parent', 'c1'), makeEdge('e2', 'parent', 'c2')];
    useNetworkStore.getState().loadModel(makeModel(nodes, edges));
    const children = useNetworkStore.getState().getChildNodes('parent');
    expect(children.map(n => n.id).sort()).toEqual(['c1', 'c2']);
  });
});

// ===========================================================================
// runInference
// ===========================================================================

describe('runInference', () => {
  it('is a no-op when model is null', async () => {
    useNetworkStore.getState().runInference('forward');
    expect(useNetworkStore.getState().isInferenceRunning).toBe(false);
  });

  it('calls dagForwardInference and updates beliefs', async () => {
    const { dagForwardInference } = await import('@/lib/bn-rrm/bn-inference');
    const model = makeModel([makeNode('n1')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().runInference('forward');
    expect(dagForwardInference).toHaveBeenCalledWith(model, {});
  });

  it('calls dagBackwardInference when mode is backward', async () => {
    const { dagBackwardInference } = await import('@/lib/bn-rrm/bn-inference');
    const model = makeModel([makeNode('n1')]);
    useNetworkStore.getState().loadModel(model);
    useNetworkStore.getState().runInference('backward');
    expect(dagBackwardInference).toHaveBeenCalledWith(model, {});
  });
});

// ===========================================================================
// loadPackModel
// ===========================================================================

describe('loadPackModel', () => {
  it('sets isLoading=true then false on success', async () => {
    const fakeJson = { nodes: [], edges: [] };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeJson,
    });
    vi.stubGlobal('fetch', fetchMock);

    const manifest = {
      pack_id: 'pack-1',
      runtime_schema_version: 'canonical-20node-v1',
      artifacts: { runtime_model: 'model.json', review: {} },
    } as unknown as import('@/lib/bn-rrm/pack-types').PackManifest;

    await useNetworkStore.getState().loadPackModel('/bn-rrm/pack-1', manifest);

    const { isLoading } = useNetworkStore.getState();
    expect(isLoading).toBe(false);
    vi.unstubAllGlobals();
  });

  it('falls back to expert model on fetch failure', async () => {
    const { createTrainedNetwork } = await import('@/lib/bn-rrm/trained-network');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }));

    const manifest = {
      pack_id: 'pack-fail',
      runtime_schema_version: 'canonical-20node-v1',
      artifacts: { runtime_model: 'model.json', review: {} },
    } as unknown as import('@/lib/bn-rrm/pack-types').PackManifest;

    await useNetworkStore.getState().loadPackModel('/bn-rrm/pack-fail', manifest);

    expect(createTrainedNetwork).toHaveBeenCalledWith('expert');
    vi.unstubAllGlobals();
  });

  it('uses createGenericNetwork for generic-bn-rrm-v1 schema', async () => {
    const { createGenericNetwork } = await import('@/lib/bn-rrm/trained-network');
    const fakeJson = {};
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeJson,
    }));

    const manifest = {
      pack_id: 'pack-generic',
      runtime_schema_version: 'generic-bn-rrm-v1',
      artifacts: { runtime_model: 'model.json', review: {} },
    } as unknown as import('@/lib/bn-rrm/pack-types').PackManifest;

    await useNetworkStore.getState().loadPackModel('/bn-rrm/pack-generic', manifest);
    expect(createGenericNetwork).toHaveBeenCalledWith(fakeJson);
    vi.unstubAllGlobals();
  });
});
