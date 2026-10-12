import type { AcceptedFigureBinding, AcceptedFiguresContract } from './accepted-figures';
import type { DiagramModel, FigureBinding } from './figures';

export const NATIVE_FIGURE_SCHEMA_VERSION = 'matrix-private-native-figures-v1' as const;

export interface NativeFigureSource {
  readonly file: string;
  readonly sha256: string;
  readonly width: number;
  readonly height: number;
}

export interface NativeFigureGroup {
  readonly id: string;
  readonly members: readonly string[];
}

export interface NativeFigureModel {
  readonly id: string;
  readonly source: NativeFigureSource;
  readonly title: string;
  readonly layout: DiagramModel['layout'];
  readonly nodes: DiagramModel['nodes'];
  readonly edges: DiagramModel['edges'];
  readonly groups: readonly NativeFigureGroup[];
}

export interface NativeFigurePlacement {
  readonly figureId: string;
  readonly modelId: string;
  readonly caption: string;
  readonly sectionAnchor: string;
}

export interface NativeFigureSet {
  readonly schemaVersion: typeof NATIVE_FIGURE_SCHEMA_VERSION;
  readonly releaseIdentity: string;
  readonly paperSha256: string;
  readonly models: readonly NativeFigureModel[];
  readonly placements: readonly NativeFigurePlacement[];
}

const ID = /^[A-Za-z0-9-]+$/;
const SHA256 = /^[0-9a-f]{64}$/;
const LAYOUTS = new Set(['grid', 'tree', 'flow', 'stack']);
const OWN = Object.prototype.hasOwnProperty;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => OWN.call(value, key));
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && /^[\x20-\x7e]+$/.test(value);
}

function textArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(text);
}

function fail(): never {
  throw new Error('Private native figure is unavailable.');
}

/** Validate an untrusted private model against the already bound release contract. */
export function validateNativeFigureSet(value: unknown, contract: AcceptedFiguresContract): NativeFigureSet {
  if (!record(value) || !keys(value, ['schemaVersion', 'releaseIdentity', 'paperSha256', 'models', 'placements']) ||
      value.schemaVersion !== NATIVE_FIGURE_SCHEMA_VERSION || value.releaseIdentity !== contract.releaseIdentity ||
      value.paperSha256 !== contract.paperSha256 ||
      !Array.isArray(value.models) || value.models.length !== contract.assets.length ||
      !Array.isArray(value.placements) || value.placements.length !== contract.placements.length) fail();
  const modelIds = new Set<string>();
  for (const rawModel of value.models) {
    if (!record(rawModel) || !keys(rawModel, ['id', 'source', 'title', 'layout', 'nodes', 'edges', 'groups']) ||
        !text(rawModel.id) || !ID.test(rawModel.id) || modelIds.has(rawModel.id) ||
        !text(rawModel.title) || !LAYOUTS.has(String(rawModel.layout)) ||
        !record(rawModel.source) || !keys(rawModel.source, ['file', 'sha256', 'width', 'height']) ||
        !Array.isArray(rawModel.nodes) || rawModel.nodes.length < 2 ||
        !Array.isArray(rawModel.edges) || rawModel.edges.length !== rawModel.nodes.length - 1 ||
        !Array.isArray(rawModel.groups)) fail();
    const asset = contract.assets.find((candidate) => candidate.id === rawModel.id);
    if (!asset || rawModel.source.file !== asset.file || rawModel.source.sha256 !== asset.sha256 ||
        rawModel.source.width !== asset.width || rawModel.source.height !== asset.height ||
        typeof rawModel.source.sha256 !== 'string' || !SHA256.test(rawModel.source.sha256)) fail();
    modelIds.add(rawModel.id);
    const nodeIds = new Set<string>();
    for (const node of rawModel.nodes) {
      if (!record(node) || !keys(node, ['id', 'label', 'heads', 'bullets']) ||
          !text(node.id) || !ID.test(node.id) || nodeIds.has(node.id) || !text(node.label) ||
          !textArray(node.heads) || !textArray(node.bullets)) fail();
      nodeIds.add(node.id);
    }
    const edgeKeys = new Set<string>();
    const incoming = new Map<string, number>();
    const children = new Map<string, string[]>();
    for (const edge of rawModel.edges) {
      if (!record(edge) || !keys(edge, ['from', 'to', 'label']) ||
          typeof edge.from !== 'string' || typeof edge.to !== 'string' ||
          !nodeIds.has(edge.from) || !nodeIds.has(edge.to) || edge.from === edge.to ||
          (edge.label !== null && !text(edge.label))) fail();
      const key = `${edge.from}\0${edge.to}`;
      if (edgeKeys.has(key)) fail();
      edgeKeys.add(key);
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
      children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
    }
    const roots = [...nodeIds].filter((id) => !incoming.has(id));
    if (roots.length !== 1 || [...incoming.values()].some((count) => count !== 1)) fail();
    const visited = new Set<string>();
    const walk = (id: string): void => {
      if (visited.has(id)) fail();
      visited.add(id);
      for (const child of children.get(id) ?? []) walk(child);
    };
    walk(roots[0]);
    if (visited.size !== nodeIds.size) fail();
    const groupIds = new Set<string>();
    for (const group of rawModel.groups) {
      if (!record(group) || !keys(group, ['id', 'members']) ||
          !text(group.id) || !ID.test(group.id) || groupIds.has(group.id) ||
          !Array.isArray(group.members) || group.members.length < 2 ||
          new Set(group.members).size !== group.members.length ||
          group.members.some((id) => typeof id !== 'string' || !nodeIds.has(id))) fail();
      groupIds.add(group.id);
    }
  }
  const placementIds = new Set<string>();
  for (const rawPlacement of value.placements) {
    if (!record(rawPlacement) ||
        !keys(rawPlacement, ['figureId', 'modelId', 'caption', 'sectionAnchor']) ||
        !text(rawPlacement.figureId) || placementIds.has(rawPlacement.figureId) ||
        !text(rawPlacement.modelId) || !modelIds.has(rawPlacement.modelId) ||
        !text(rawPlacement.caption) ||
        !rawPlacement.caption.startsWith(`Figure ${rawPlacement.figureId}. `) ||
        !text(rawPlacement.sectionAnchor)) fail();
    const bound = contract.placements.find((candidate) => candidate.figureId === rawPlacement.figureId);
    if (!bound || bound.assetId !== rawPlacement.modelId || bound.sectionAnchor !== rawPlacement.sectionAnchor) fail();
    placementIds.add(rawPlacement.figureId);
  }
  for (const asset of contract.assets) {
    const actual = value.placements
      .filter((placement: NativeFigurePlacement) => placement.modelId === asset.id)
      .map((placement: NativeFigurePlacement) => placement.figureId);
    if (actual.length !== asset.placementIds.length ||
        asset.placementIds.some((id) => !actual.includes(id))) fail();
  }
  return value as unknown as NativeFigureSet;
}

/** A placement returns its one canonical model, or fails closed on caption or identity drift. */
export function nativeFigureForBinding(set: NativeFigureSet, figure: AcceptedFigureBinding): {
  readonly model: DiagramModel;
  readonly binding: FigureBinding;
} {
  const placement = set.placements.find((item) => item.figureId === figure.placement.figureId);
  const model = set.models.find((item) => item.id === placement?.modelId);
  if (!placement || !model || placement.caption !== figure.caption ||
      placement.modelId !== figure.asset.id || model.source.sha256 !== figure.asset.sha256 ||
      set.releaseIdentity !== figure.releaseIdentity) fail();
  const prefix = `Figure ${placement.figureId}. `;
  return {
    model: { summaryNumber: 0, layout: model.layout, title: model.title,
      nodes: model.nodes, edges: model.edges, groups: model.groups, notes: [], items: [] },
    binding: { kind: 'restored', id: placement.figureId, label: `Figure ${placement.figureId}`,
      caption: placement.caption.slice(prefix.length), sourceSha256: model.source.sha256,
      status: 'current', statusNote: null, notation: 'math', labelOverrides: null, overrideAuthority: null },
  };
}
