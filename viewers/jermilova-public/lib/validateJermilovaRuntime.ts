import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';

export interface RuntimeNodeShape {
  id: string;
  label?: string;
  category?: string;
  states?: Array<{ id: string; label?: string }>;
}

export interface RuntimeEdgeShape {
  id?: string;
  source: string;
  target: string;
}

export interface RuntimeCptShape {
  nodeId: string;
  parentIds?: string[];
  parentNodeIds?: string[];
  table?: unknown[];
  entries?: unknown[];
}

export interface JermilovaRuntimeShape {
  modelId: string;
  nodes: RuntimeNodeShape[];
  edges: RuntimeEdgeShape[];
  cpts: RuntimeCptShape[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Runtime model has an invalid ${field}.`);
  }
  return value;
}

export function validateJermilovaRuntime(value: unknown): JermilovaRuntimeShape {
  if (!isRecord(value)) {
    throw new Error('Runtime model must be a JSON object.');
  }

  if (value.modelId !== JERMILOVA_VIEWER_CAPABILITIES.modelId) {
    throw new Error('Runtime model identity does not match the approved Jermilova pack.');
  }

  if (!Array.isArray(value.nodes) || value.nodes.length !== 14) {
    throw new Error('Runtime model must contain exactly 14 nodes.');
  }
  if (!Array.isArray(value.edges) || value.edges.length !== 15) {
    throw new Error('Runtime model must contain exactly 15 edges.');
  }
  if (!Array.isArray(value.cpts) || value.cpts.length !== 7) {
    throw new Error('Runtime model must contain exactly 7 CPTs.');
  }

  const nodes = value.nodes.map((node, index) => {
    if (!isRecord(node)) {
      throw new Error(`Runtime node ${index + 1} must be an object.`);
    }
    const id = requireString(node.id, `node ${index + 1} id`);
    if (!Array.isArray(node.states) || node.states.length === 0) {
      throw new Error(`Runtime node '${id}' must define states.`);
    }
    for (const state of node.states) {
      if (!isRecord(state)) {
        throw new Error(`Runtime node '${id}' contains an invalid state.`);
      }
      requireString(state.id, `state id on '${id}'`);
    }
    return { ...node, id, states: node.states as RuntimeNodeShape['states'] };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) {
    throw new Error('Runtime model contains duplicate node ids.');
  }

  const edges = value.edges.map((edge, index) => {
    if (!isRecord(edge)) {
      throw new Error(`Runtime edge ${index + 1} must be an object.`);
    }
    const source = requireString(edge.source, `edge ${index + 1} source`);
    const target = requireString(edge.target, `edge ${index + 1} target`);
    if (!nodeIds.has(source) || !nodeIds.has(target) || source === target) {
      throw new Error(`Runtime edge ${index + 1} references an invalid node.`);
    }
    return { id: typeof edge.id === 'string' ? edge.id : undefined, source, target };
  });

  const targets = new Set(edges.map((edge) => edge.target));
  const roots = nodes.map((node) => node.id).filter((id) => !targets.has(id)).sort();
  const expectedRoots = [...JERMILOVA_VIEWER_CAPABILITIES.evidenceNodeIds].sort();
  if (roots.length !== expectedRoots.length || roots.some((id, i) => id !== expectedRoots[i])) {
    throw new Error('Runtime model root ids do not match the approved seven inputs.');
  }

  const cpts = value.cpts.map((cpt, index) => {
    if (!isRecord(cpt)) {
      throw new Error(`Runtime CPT ${index + 1} must be an object.`);
    }
    const nodeId = requireString(cpt.nodeId, `CPT ${index + 1} node id`);
    if (!nodeIds.has(nodeId)) {
      throw new Error(`Runtime CPT '${nodeId}' references an unknown node.`);
    }
    const parents = cpt.parentIds ?? cpt.parentNodeIds ?? [];
    if (!Array.isArray(parents) || parents.some((id) => typeof id !== 'string' || !nodeIds.has(id))) {
      throw new Error(`Runtime CPT '${nodeId}' references an unknown parent.`);
    }
    return {
      ...cpt,
      nodeId,
      parentIds: parents as string[],
    };
  });
  if (new Set(cpts.map((cpt) => cpt.nodeId)).size !== cpts.length) {
    throw new Error('Runtime model contains duplicate CPT nodes.');
  }

  return {
    ...value,
    modelId: value.modelId,
    nodes: nodes as RuntimeNodeShape[],
    edges,
    cpts,
  };
}
