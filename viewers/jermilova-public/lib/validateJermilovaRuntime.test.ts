import { describe, expect, it } from 'vitest';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';
import { validateJermilovaRuntime, type JermilovaRuntimeShape } from './validateJermilovaRuntime';

const childIds = [
  'test_child_01',
  'test_child_02',
  'test_child_03',
  'test_child_04',
  'test_child_05',
  'test_child_06',
  'test_child_07',
];

function validRuntime(): JermilovaRuntimeShape {
  const roots = [...JERMILOVA_VIEWER_CAPABILITIES.evidenceNodeIds];
  const nodes = [...roots, ...childIds].map((id) => ({
    id,
    label: id,
    category: 'substance',
    states: [{ id: 'state_a' }, { id: 'state_b' }],
  }));
  const edges = childIds.map((target, i) => ({
    source: roots[i],
    target,
  }));
  for (let i = 0; i < 8; i += 1) {
    edges.push({ source: roots[i % roots.length], target: childIds[(i + 1) % childIds.length] });
  }
  const cpts = childIds.map((nodeId, i) => ({ nodeId, parentIds: [roots[i % roots.length]], table: [] }));
  return {
    modelId: JERMILOVA_VIEWER_CAPABILITIES.modelId,
    nodes,
    edges,
    cpts,
  };
}

describe('validateJermilovaRuntime', () => {
  it('accepts the approved 14-node generic model shape and seven roots', () => {
    expect(() => validateJermilovaRuntime(validRuntime())).not.toThrow();
  });

  it('rejects a different model identity', () => {
    expect(() => validateJermilovaRuntime({ ...validRuntime(), modelId: 'other-model' })).toThrow(
      /identity/,
    );
  });

  it('rejects a 20-node model before rendering', () => {
    const runtime = validRuntime();
    runtime.nodes.push({
      id: 'unexpected_node',
      label: 'unexpected_node',
      category: 'substance',
      states: [{ id: 'state_a' }],
    });
    expect(() => validateJermilovaRuntime(runtime)).toThrow(/exactly 14 nodes/);
  });

  it('rejects roots outside the approved seven inputs', () => {
    const runtime = validRuntime();
    const approvedRootId = runtime.nodes[0].id;
    const unexpectedRootId = 'unexpected_root';
    runtime.nodes[0].id = unexpectedRootId;
    for (const edge of runtime.edges) {
      if (edge.source === approvedRootId) edge.source = unexpectedRootId;
    }
    for (const cpt of runtime.cpts) {
      cpt.parentIds = (cpt.parentIds ?? []).map((parentId) =>
        parentId === approvedRootId ? unexpectedRootId : parentId,
      );
    }
    expect(() => validateJermilovaRuntime(runtime)).toThrow(/root ids/);
  });

  it('rejects an edge that references a missing node', () => {
    const runtime = validRuntime();
    runtime.edges[0].target = 'missing_node';
    expect(() => validateJermilovaRuntime(runtime)).toThrow(/invalid node/);
  });
});
