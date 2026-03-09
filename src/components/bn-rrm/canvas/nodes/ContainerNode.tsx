'use client';

import { memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/utils/cn';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { CompactBeliefBar } from '../BeliefBar';
import type { ContainerData, NodeCategory, BeliefDistribution } from '@/types/bn-rrm/network';
import { Beaker, Thermometer, Activity, AlertTriangle, ChevronDown, ChevronRight, X } from 'lucide-react';

const categoryConfig: Record<NodeCategory, { icon: typeof Beaker; bgColor: string; borderColor: string; headerBg: string; }> = {
  substance: { icon: Beaker, bgColor: 'bg-blue-50/50 dark:bg-blue-950/80', borderColor: 'border-blue-200 dark:border-blue-600', headerBg: 'bg-blue-100 dark:bg-blue-900/70' },
  condition: { icon: Thermometer, bgColor: 'bg-violet-50/50 dark:bg-violet-950/80', borderColor: 'border-violet-200 dark:border-violet-600', headerBg: 'bg-violet-100 dark:bg-violet-900/70' },
  effect: { icon: Activity, bgColor: 'bg-amber-50/50 dark:bg-amber-950/80', borderColor: 'border-amber-200 dark:border-amber-600', headerBg: 'bg-amber-100 dark:bg-amber-900/70' },
  impact: { icon: AlertTriangle, bgColor: 'bg-red-50/50 dark:bg-red-950/80', borderColor: 'border-red-200 dark:border-red-600', headerBg: 'bg-red-100 dark:bg-red-900/70' },
};

// Contamination summary node IDs per container
const containerSummaryNode: Record<string, string> = {
  container_metals: 'metal_contamination',
  container_organics: 'organic_contamination',
};

export const ContainerNode = memo(function ContainerNode({ data, selected }: { data: ContainerData; selected?: boolean }) {
  const { toggleContainer, getNodesInContainer, model, nodeMap } = useNetworkStore();

  const config = categoryConfig[data.category];
  const Icon = config.icon;

  const childNodes = useMemo(() => getNodesInContainer(data.id), [data.id, getNodesInContainer, model]);

  // Find the contamination summary node for this container (if any)
  const summaryNodeId = containerSummaryNode[data.id];
  const summaryNode = summaryNodeId ? nodeMap.get(summaryNodeId) : null;

  // Substance nodes (exclude the summary/contamination node)
  const substanceNodes = useMemo(
    () => childNodes.filter(n => n.id !== summaryNodeId),
    [childNodes, summaryNodeId]
  );

  // Summary beliefs — use the contamination node's beliefs if available
  const summaryBeliefs = useMemo(() => {
    if (summaryNode) {
      return {
        states: summaryNode.states.map(s => ({ id: s.id, label: s.label, color: s.color || '#94a3b8' })),
        beliefs: summaryNode.beliefs,
      };
    }
    // Fallback: aggregate from child beliefs
    if (data.category === 'impact' && childNodes.length > 0) {
      const impactNode = childNodes[0];
      return {
        states: impactNode.states.map(s => ({ id: s.id, label: s.label, color: s.color || '#94a3b8' })),
        beliefs: impactNode.beliefs,
      };
    }
    return {
      states: [
        { id: 'low', label: 'Low', color: '#22c55e' },
        { id: 'medium', label: 'Medium', color: '#eab308' },
        { id: 'high', label: 'High', color: '#ef4444' },
      ],
      beliefs: { low: 0.5, medium: 0.35, high: 0.15 } as BeliefDistribution,
    };
  }, [summaryNode, childNodes, data.category]);

  // Collapsed view — compact card with contamination summary
  if (data.collapsed) {
    return (
      <div
        className={cn(
          'rounded-xl shadow-lg border-2 min-w-[240px] max-w-[280px] cursor-pointer',
          'transition-all duration-200 hover:shadow-xl hover:scale-[1.02]',
          config.bgColor, config.borderColor,
          selected && 'ring-2 ring-offset-2 ring-blue-500'
        )}
        onClick={() => toggleContainer(data.id)}
      >
        <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !shadow-md" style={{ backgroundColor: '#3b82f6' }} />

        {/* Header */}
        <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-t-lg', config.headerBg)}>
          <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex-1">{data.label}</span>
          <span className="text-[10px] text-slate-400 bg-white/60 dark:bg-slate-900/50 px-1.5 py-0.5 rounded-full">
            {substanceNodes.length}
          </span>
        </div>

        {/* Contamination summary */}
        <div className="p-3 space-y-2">
          {summaryNode && (
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{summaryNode.label}</div>
          )}
          <div className="rounded-lg p-1.5 shadow-inner bg-white dark:bg-slate-800">
            <CompactBeliefBar
              states={summaryBeliefs.states}
              beliefs={summaryBeliefs.beliefs}
              evidence={summaryNode?.evidence ?? null}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span>
              {substanceNodes.length} constituent{substanceNodes.length !== 1 ? 's' : ''}
            </span>
            <span className="text-blue-400 font-medium">Click to expand</span>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className="!w-3 !h-3 !border-2 !border-white !shadow-md" style={{ backgroundColor: '#3b82f6' }} />
      </div>
    );
  }

  // Expanded view — shows child nodes are rendered separately by Canvas
  // This is just the container frame with a prominent collapse header
  return (
    <div
      className={cn(
        'rounded-xl border-2 border-dashed transition-all duration-200',
        config.bgColor, config.borderColor,
        selected && 'ring-2 ring-offset-2 ring-blue-500'
      )}
      style={{ width: 300, minHeight: 400, padding: 16 }}
    >
      {/* Collapse header — prominent, always visible */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer',
          'hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors',
          config.headerBg
        )}
        onClick={() => toggleContainer(data.id)}
      >
        <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <Icon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 flex-1">{data.label}</span>
        <button
          className="p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            toggleContainer(data.id);
          }}
          title="Collapse"
        >
          <X className="w-4 h-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
        </button>
      </div>
      <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 text-center">
        {substanceNodes.length} constituents + summary
      </div>
    </div>
  );
});

export default ContainerNode;
