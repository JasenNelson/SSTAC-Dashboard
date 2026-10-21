'use client';

import { useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import type { ContainerData, NetworkModel } from '@/types/bn-rrm/network';

interface ViewerNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  states: Array<{ id: string; label: string }>;
  beliefs: Record<string, number>;
}

interface ViewerContainerData extends Record<string, unknown> {
  label: string;
  collapsed: boolean;
  childCount: number;
  onToggle: () => void;
}

type ViewerFlowNode = Node<ViewerNodeData, 'readonly'>;
type ViewerFlowContainer = Node<ViewerContainerData, 'viewerContainer'>;
type ViewerFlowElement = ViewerFlowNode | ViewerFlowContainer;

const CONTAINER_WIDTH = 280;
const COLLAPSED_CONTAINER_HEIGHT = 90;
const EXPANDED_HEADER_HEIGHT = 60;
const EXPANDED_CHILD_HEIGHT = 160;
const EXPANDED_BOTTOM_PADDING = 20;
const CONTAINER_GAP = 20;
const CHILD_HORIZONTAL_OFFSET = 16;
const CHILD_VERTICAL_OFFSET = 60;

function ReadOnlyNode({ data }: NodeProps<ViewerFlowNode>) {
  return (
    <article className="network-node" aria-label={data.label + ', read only'}>
      <Handle type="target" position={Position.Left} className="network-handle" />
      <div className="network-node__category">{data.category}</div>
      <h3>{data.label}</h3>
      <ul>
        {data.states.map((state) => (
          <li key={state.id}>
            <span>{state.label}</span>
            <span>{(data.beliefs[state.id] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
          </li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} className="network-handle" />
    </article>
  );
}

function ReadOnlyContainer({ data }: NodeProps<ViewerFlowContainer>) {
  const action = data.collapsed ? 'Expand' : 'Collapse';
  const frameClass = data.collapsed
    ? 'network-container-frame network-container-frame--collapsed'
    : 'network-container-frame network-container-frame--expanded';

  return (
    <div className={frameClass} aria-label={data.label + ', ' + data.childCount + ' nodes'}>
      <Handle type="target" position={Position.Left} className="network-handle" />
      <div className="network-container-header">
        <strong>{data.label}</strong>
        <span>{data.childCount} nodes</span>
        <button
          type="button"
          aria-expanded={!data.collapsed}
          onClick={(event) => {
            event.stopPropagation();
            data.onToggle();
          }}
        >
          {action} {data.label}
        </button>
      </div>
      <Handle type="source" position={Position.Right} className="network-handle" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  readonly: ReadOnlyNode,
  viewerContainer: ReadOnlyContainer,
};

interface ReadOnlyNetworkCanvasProps {
  model: NetworkModel;
  baseline: Record<string, Record<string, number>>;
  onNodeFocus: (nodeId: string) => void;
}

interface ContainerLayout {
  position: { x: number; y: number };
  height: number;
}

function getContainerHeight(container: ContainerData, collapsed: boolean): number {
  return collapsed
    ? COLLAPSED_CONTAINER_HEIGHT
    : EXPANDED_HEADER_HEIGHT + container.childNodeIds.length * EXPANDED_CHILD_HEIGHT + EXPANDED_BOTTOM_PADDING;
}

export function buildReadOnlyContainerLayout(
  model: NetworkModel,
  collapsedById: ReadonlyMap<string, boolean> = new Map(
    model.containers.map((container) => [container.id, container.collapsed]),
  ),
): Map<string, ContainerLayout> {
  const containersByTier = new Map<string, ContainerData[]>();
  for (const container of model.containers) {
    const tier = containersByTier.get(container.category) ?? [];
    tier.push(container);
    containersByTier.set(container.category, tier);
  }

  const tierHeights = [...containersByTier.entries()].map(([tier, containers]) => {
    const heights = containers.map((container) =>
      getContainerHeight(container, collapsedById.get(container.id) ?? container.collapsed),
    );
    const total = heights.reduce((sum, height) => sum + height, 0) + Math.max(0, containers.length - 1) * CONTAINER_GAP;
    return { tier, containers, heights, total };
  });
  const maximumTierHeight = Math.max(0, ...tierHeights.map((tier) => tier.total));
  const layout = new Map<string, ContainerLayout>();

  for (const tier of tierHeights) {
    let y = 50 + (maximumTierHeight - tier.total) / 2;
    tier.containers.forEach((container, index) => {
      const height = tier.heights[index];
      layout.set(container.id, {
        position: { x: container.position.x, y },
        height,
      });
      y += height + CONTAINER_GAP;
    });
  }

  return layout;
}

export function buildReadOnlyFlow(
  model: NetworkModel,
  baseline: Record<string, Record<string, number>>,
  collapsedById: ReadonlyMap<string, boolean> = new Map(
    model.containers.map((container) => [container.id, container.collapsed]),
  ),
  onToggle: (containerId: string) => void = () => undefined,
) {
  const containerLayout = buildReadOnlyContainerLayout(model, collapsedById);
  const containerByChildId = new Map<string, ContainerData>();
  for (const container of model.containers) {
    for (const childId of container.childNodeIds) containerByChildId.set(childId, container);
  }

  const hiddenById = new Map<string, string>();
  const nodes: ViewerFlowElement[] = model.containers.map((container) => {
    const collapsed = collapsedById.get(container.id) ?? container.collapsed;
    const layout = containerLayout.get(container.id);
    if (!layout) throw new Error('Container layout is missing a model container.');

    return {
      id: container.id,
      type: 'viewerContainer',
      position: layout.position,
      style: { width: CONTAINER_WIDTH, height: layout.height, zIndex: 0 },
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        label: container.label,
        collapsed,
        childCount: container.childNodeIds.length,
        onToggle: () => onToggle(container.id),
      },
    };
  });

  for (const node of model.nodes) {
    const container = containerByChildId.get(node.id);
    if (!container) throw new Error('Every fixed viewer node must belong to a packaged container.');

    const collapsed = collapsedById.get(container.id) ?? container.collapsed;
    if (collapsed) {
      hiddenById.set(node.id, container.id);
      continue;
    }

    const childIndex = container.childNodeIds.indexOf(node.id);
    const layout = containerLayout.get(container.id);
    if (childIndex < 0 || !layout) throw new Error('Expanded child layout is missing its packaged container.');

    nodes.push({
      id: node.id,
      type: 'readonly',
      position: {
        x: layout.position.x + CHILD_HORIZONTAL_OFFSET,
        y: layout.position.y + CHILD_VERTICAL_OFFSET + childIndex * EXPANDED_CHILD_HEIGHT,
      },
      zIndex: 1,
      draggable: false,
      connectable: false,
      data: {
        label: node.label,
        category: node.category,
        states: node.states.map((state) => ({ id: state.id, label: state.label })),
        beliefs: baseline[node.id] ?? node.beliefs,
      },
    });
  }

  const seen = new Set<string>();
  const edges: Edge[] = [];
  for (const edge of model.edges) {
    const source = hiddenById.get(edge.source) ?? edge.source;
    const target = hiddenById.get(edge.target) ?? edge.target;
    if (source === target) continue;

    const directedKey = source + '->' + target;
    if (seen.has(directedKey)) continue;
    seen.add(directedKey);

    edges.push({
      id: edge.id,
      source,
      target,
      type: 'smoothstep',
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
    });
  }

  return { nodes, edges, containerLayout };
}

export function ReadOnlyNetworkCanvas({ model, baseline, onNodeFocus }: ReadOnlyNetworkCanvasProps) {
  const [collapsedById, setCollapsedById] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(model.containers.map((container) => [container.id, container.collapsed])),
  );
  const setAll = (collapsed: boolean) =>
    setCollapsedById(new Map(model.containers.map((container) => [container.id, collapsed])));
  const toggleContainer = (containerId: string) =>
    setCollapsedById((current) => {
      const next = new Map(current);
      next.set(containerId, !(current.get(containerId) ?? true));
      return next;
    });
  const { nodes, edges } = useMemo(
    () => buildReadOnlyFlow(model, baseline, collapsedById, toggleContainer),
    [model, baseline, collapsedById],
  );

  return (
    <div className="network-canvas-wrap-readonly">
      <div className="network-group-controls" aria-label="Network group visibility controls">
        <button type="button" onClick={() => setAll(false)}>
          Expand all
        </button>
        <button type="button" onClick={() => setAll(true)}>
          Collapse all
        </button>
        {model.containers.map((container) => {
          const collapsed = collapsedById.get(container.id) ?? container.collapsed;
          return (
            <button
              key={container.id}
              type="button"
              aria-pressed={!collapsed}
              onClick={() => toggleContainer(container.id)}
            >
              {collapsed ? 'Expand' : 'Collapse'} {container.label}
            </button>
          );
        })}
      </div>
      <div className="network-canvas" aria-label="Read-only grouped causal network">
        <ReactFlow<ViewerFlowElement, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          edgesFocusable={false}
          selectNodesOnDrag={false}
          onNodeClick={(_, node) => {
            if (node.type === 'readonly') onNodeFocus(node.id);
          }}
          panOnDrag
          zoomOnScroll
          fitView
          fitViewOptions={{ padding: 0.16, maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
          <MiniMap nodeColor="#64748b" maskColor="rgba(15, 23, 42, 0.08)" pannable zoomable />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
