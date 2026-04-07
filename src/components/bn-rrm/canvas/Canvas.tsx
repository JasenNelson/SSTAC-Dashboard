/**
 * Canvas Component
 *
 * Main React Flow canvas for the BN-RRM visualization.
 * Features:
 * - Custom node types by category
 * - Collapsible containers
 * - Causal path highlighting
 * - Interactive evidence setting
 */

'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { BaseNode, ImpactNode, CompactNode } from './nodes/BaseNode';
import { ContainerNode } from './nodes/ContainerNode';
import { calculateNodePositions } from '@/lib/bn-rrm/dummy-data';
import { cn } from '@/utils/cn';
import type { NetworkNodeData, NodeCategory } from '@/types/bn-rrm/network';
import { Expand, Shrink, RotateCcw } from 'lucide-react';

// Node types registry
const nodeTypes = {
  substanceNode: BaseNode,
  conditionNode: BaseNode,
  effectNode: BaseNode,
  impactNode: ImpactNode,
  compactNode: CompactNode,
  containerNode: ContainerNode,
};

// Edge styling
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: {
    stroke: 'var(--edge-color, #cbd5e1)',
    strokeWidth: 2,
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'var(--edge-color, #cbd5e1)',
    width: 20,
    height: 20,
  },
};

interface CanvasProps {
  className?: string;
  showMinimap?: boolean;
  showControls?: boolean;
}

export function Canvas({
  className,
  showMinimap = true,
  showControls = true,
}: CanvasProps) {
  const {
    model,
    containerMap,
    selectedNodeId,
    selectNode,
    expandAllContainers,
    collapseAllContainers,
    clearAllEvidence,
    highlightedPath,
    evidence,
  } = useNetworkStore();

  // Model is loaded by BNRRMClient via loadTrainedModel()

  // Convert model to React Flow nodes
  const initialNodes = useMemo((): Node[] => {
    if (!model) return [];

    const positions = calculateNodePositions(model);
    const nodes: Node[] = [];

    // Dynamic container positioning: recalculate vertical stacking per tier
    // based on current collapsed/expanded state.
    const tierX: Record<NodeCategory, number> = { substance: 50, condition: 500, effect: 950, impact: 1400 };
    const COLLAPSED_H = 90;
    const NODE_SPACING = 160;
    const GAP = 20;

    // Group containers by category tier
    const tierContainers: Record<NodeCategory, typeof model.containers> = {
      substance: [], condition: [], effect: [], impact: [],
    };
    for (const c of model.containers) {
      tierContainers[c.category]?.push(c);
    }

    // Compute per-container height (collapsed vs expanded based on child count)
    function containerHeight(c: import('@/types/bn-rrm/network').ContainerData): number {
      if (c.collapsed) return COLLAPSED_H;
      return 60 + c.childNodeIds.length * NODE_SPACING + 20; // header + nodes + padding
    }

    // Compute total height per tier, then center vertically
    const tierTotalH: Record<NodeCategory, number> = { substance: 0, condition: 0, effect: 0, impact: 0 };
    for (const cat of Object.keys(tierContainers) as NodeCategory[]) {
      const containers = tierContainers[cat];
      const n = containers.length;
      tierTotalH[cat] = containers.reduce((sum, c) => sum + containerHeight(c), 0) + (n > 0 ? (n - 1) * GAP : 0);
    }
    const maxTierH = Math.max(...Object.values(tierTotalH));

    // Build dynamic positions per container
    const dynamicPos = new Map<string, { x: number; y: number }>();
    for (const cat of Object.keys(tierContainers) as NodeCategory[]) {
      let y = 50 + (maxTierH - tierTotalH[cat]) / 2;
      for (const c of tierContainers[cat]) {
        dynamicPos.set(c.id, { x: tierX[cat] ?? c.position.x, y });
        y += containerHeight(c) + GAP;
      }
    }

    // Add container nodes — always visible for both collapsed and expanded states
    model.containers.forEach((container) => {
      const pos = dynamicPos.get(container.id) ?? container.position;
      nodes.push({
        id: container.id,
        type: 'containerNode',
        position: { x: pos.x, y: pos.y },
        data: container as unknown as Record<string, unknown>,
        selected: false,
        ...(container.collapsed ? {} : { zIndex: -1 }), // Expanded containers behind child nodes
      });
    });

    model.nodes.forEach((node) => {
      const container = node.containerId ? containerMap.get(node.containerId) : null;
      const isContainerCollapsed = container?.collapsed ?? false;

      if (isContainerCollapsed) return;

      const position = positions[node.id] || { x: 0, y: 0 };
      const containerPos = container ? (dynamicPos.get(container.id) ?? container.position) : null;
      const containerOffset = containerPos
        ? { x: containerPos.x + 30, y: containerPos.y + 60 }
        : { x: 0, y: 0 };

      nodes.push({
        id: node.id,
        type: `${node.category}Node`,
        position: {
          x: position.x + containerOffset.x,
          y: position.y + containerOffset.y,
        },
        data: node as unknown as Record<string, unknown>,
        selected: selectedNodeId === node.id,
      });
    });

    return nodes;
  }, [model, containerMap, selectedNodeId]);

  // Convert model to React Flow edges
  // When a container is collapsed, re-route edges from hidden nodes through the container node
  const initialEdges = useMemo((): Edge[] => {
    if (!model) return [];

    // Build lookup: nodeId -> containerId (for collapsed containers only)
    const hiddenNodeToContainer = new Map<string, string>();
    const visibleNodeIds = new Set<string>();

    model.nodes.forEach(n => {
      const container = n.containerId ? containerMap.get(n.containerId) : null;
      if (container?.collapsed) {
        hiddenNodeToContainer.set(n.id, n.containerId!);
      } else {
        visibleNodeIds.add(n.id);
      }
    });

    // Container nodes are always visible
    model.containers.forEach(c => visibleNodeIds.add(c.id));

    const edgeSet = new Set<string>(); // Deduplicate re-routed edges
    const edges: Edge[] = [];

    model.edges.forEach(edge => {
      let source = edge.source;
      let target = edge.target;

      // Re-route hidden sources through their container
      if (hiddenNodeToContainer.has(source)) {
        source = hiddenNodeToContainer.get(source)!;
      }
      // Re-route hidden targets through their container
      if (hiddenNodeToContainer.has(target)) {
        target = hiddenNodeToContainer.get(target)!;
      }

      // Skip internal container edges (both endpoints in same container)
      if (source === target) return;

      // Skip if neither endpoint is visible
      if (!visibleNodeIds.has(source) || !visibleNodeIds.has(target)) return;

      // Deduplicate (multiple internal edges may collapse to same container edge)
      const edgeKey = `${source}->${target}`;
      if (edgeSet.has(edgeKey)) return;
      edgeSet.add(edgeKey);

      const isHighlighted = highlightedPath.includes(edge.source) && highlightedPath.includes(edge.target);

      edges.push({
        id: `${edge.id}_${source}_${target}`,
        source,
        target,
        type: 'smoothstep',
        style: {
          stroke: isHighlighted ? '#3b82f6' : '#cbd5e1',
          strokeWidth: isHighlighted ? 3 : 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isHighlighted ? '#3b82f6' : '#cbd5e1',
          width: 20,
          height: 20,
        },
        animated: isHighlighted,
      });
    });

    return edges;
  }, [model, containerMap, highlightedPath]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'containerNode') return;
      selectNode(node.id);
    },
    [selectNode]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const minimapNodeColor = useCallback((node: Node) => {
    const category = (node.data as unknown as NetworkNodeData)?.category;
    const colors: Record<NodeCategory, string> = {
      substance: '#3b82f6',
      condition: '#8b5cf6',
      effect: '#f59e0b',
      impact: '#ef4444',
    };
    return colors[category] || '#94a3b8';
  }, []);

  const evidenceCount = Object.keys(evidence).length;

  return (
    <div className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!bg-slate-50 dark:!bg-slate-900 [&>pattern>circle]:!fill-slate-300 dark:[&>pattern>circle]:!fill-slate-700"
        />

        {showControls && (
          <Controls
            position="bottom-right"
            showInteractive={false}
            className="!shadow-lg !rounded-xl !border-0 overflow-hidden"
          />
        )}

        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(0, 0, 0, 0.08)"
            position="bottom-left"
            pannable
            zoomable
            className="!rounded-xl !shadow-lg !border-0"
            style={{ width: 150, height: 100 }}
          />
        )}

        {/* Toolbar Panel */}
        <Panel position="top-right" className="flex gap-1.5">
          <ToolbarButton
            onClick={expandAllContainers}
            icon={<Expand className="w-4 h-4" />}
            title="Expand all containers"
          />
          <ToolbarButton
            onClick={collapseAllContainers}
            icon={<Shrink className="w-4 h-4" />}
            title="Collapse all containers"
          />
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-600 mx-1" />
          <ToolbarButton
            onClick={clearAllEvidence}
            icon={<RotateCcw className="w-4 h-4" />}
            title="Clear all evidence"
            badge={evidenceCount > 0 ? evidenceCount.toString() : undefined}
          />
        </Panel>

        {/* Model Info Panel */}
        <Panel position="top-left">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-lg p-4 max-w-xs border border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{model?.name || 'Loading...'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{model?.description}</p>
            <div className="flex gap-3 mt-3 text-xs">
              <Stat label="Nodes" value={model?.nodes.length || 0} />
              <Stat label="Edges" value={model?.edges.length || 0} />
              <Stat
                label="Evidence"
                value={evidenceCount}
                highlight={evidenceCount > 0}
              />
            </div>
          </div>
        </Panel>

        {/* Legend */}
        <Panel position="bottom-right" className="!bottom-16 !right-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 flex gap-3 text-[10px]">
            <LegendItem color="bg-blue-500" label="Substance" />
            <LegendItem color="bg-violet-500" label="Condition" />
            <LegendItem color="bg-amber-500" label="Effect" />
            <LegendItem color="bg-red-500" label="Impact" />
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// Helper Components
interface ToolbarButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  badge?: string;
}

function ToolbarButton({ onClick, icon, title, badge }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-lg transition-all text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      title={title}
    >
      {icon}
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn('px-2 py-1 rounded-md', highlight ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400')}>
      <span className="font-semibold">{value}</span>
      <span className="ml-1 text-slate-400 dark:text-slate-500">{label}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-2.5 h-2.5 rounded-sm', color)} />
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

export default Canvas;
