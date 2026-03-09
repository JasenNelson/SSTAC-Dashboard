'use client';

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { cn } from '@/utils/cn';
import { BeliefBar, CompactBeliefBar } from '../BeliefBar';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import type { NetworkNodeData, NodeCategory } from '@/types/bn-rrm/network';
import { Beaker, Thermometer, Activity, AlertTriangle, Eye, Sparkles } from 'lucide-react';

const categoryConfig: Record<
  NodeCategory,
  {
    icon: typeof Beaker;
    gradient: string;
    bg: string;
    border: string;
    handleHex: string;
  }
> = {
  substance: {
    icon: Beaker,
    gradient: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50 dark:bg-slate-800',
    border: 'border-blue-300 dark:border-blue-600',
    handleHex: '#3b82f6',
  },
  condition: {
    icon: Thermometer,
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50 dark:bg-slate-800',
    border: 'border-violet-300 dark:border-violet-600',
    handleHex: '#8b5cf6',
  },
  effect: {
    icon: Activity,
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50 dark:bg-slate-800',
    border: 'border-amber-300 dark:border-amber-600',
    handleHex: '#f59e0b',
  },
  impact: {
    icon: AlertTriangle,
    gradient: 'from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-slate-800',
    border: 'border-red-300 dark:border-red-600',
    handleHex: '#ef4444',
  },
};

export const BaseNode = memo(function BaseNode({ data, selected }: { data: NetworkNodeData; selected?: boolean }) {
  const { setEvidence, clearEvidence, highlightedPath } = useNetworkStore();

  const config = categoryConfig[data.category];
  const Icon = config.icon;
  const isInPath = highlightedPath.includes(data.id);
  const hasEvidence = data.evidence !== null;

  const handleStateClick = (stateId: string) => {
    if (data.evidence === stateId) {
      clearEvidence(data.id);
    } else {
      setEvidence(data.id, stateId);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl shadow-lg transition-all duration-200',
        'min-w-[220px] max-w-[280px]',
        'border-2',
        config.bg,
        hasEvidence ? 'border-blue-500 shadow-blue-500/25' : config.border,
        selected && 'ring-2 ring-offset-2 ring-blue-500 shadow-xl',
        isInPath && !selected && 'ring-2 ring-offset-1 ring-yellow-400 shadow-yellow-400/25',
        !selected && !isInPath && 'hover:shadow-xl hover:scale-[1.02]'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !border-2 !border-white !shadow-md"
        style={{ backgroundColor: config.handleHex }}
      />

      <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-t-lg bg-gradient-to-r', config.gradient)}>
        <div className="p-1 bg-white/20 rounded-md">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm text-white truncate flex-1" title={data.label}>
          {data.label}
        </span>
        {hasEvidence && (
          <div className="flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded text-[10px] text-white">
            <Eye className="w-3 h-3" />
            <span>Obs</span>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {data.description && (
          <p className="text-xs text-slate-500 dark:text-slate-300 line-clamp-2 leading-relaxed">{data.description}</p>
        )}

        <div className="rounded-lg p-2 shadow-inner bg-white dark:bg-slate-900">
          <BeliefBar
            states={data.states}
            beliefs={data.beliefs}
            evidence={data.evidence}
            guidelines={'guidelines' in data ? data.guidelines : undefined}
            onStateClick={handleStateClick}
            compact={data.states.length > 3}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400">
          {'parameter' in data && (data as { parameter?: string }).parameter && (
            <span className="truncate">
              {'unit' in data ? `${(data as { parameter: string }).parameter} (${(data as { unit: string }).unit})` : (data as { parameter: string }).parameter}
            </span>
          )}
          {'endpoint' in data && (data as { endpoint?: string }).endpoint && <span className="truncate">{(data as { endpoint: string }).endpoint}</span>}
          {!hasEvidence && (
            <span className="flex items-center gap-1 text-slate-300 dark:text-slate-500">
              <Sparkles className="w-3 h-3" />
              Click bar to observe
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !border-2 !border-white !shadow-md"
        style={{ backgroundColor: config.handleHex }}
      />
    </div>
  );
});

export const ImpactNode = memo(function ImpactNode({ data, selected }: { data: NetworkNodeData; selected?: boolean }) {
  const { setEvidence, clearEvidence, highlightedPath } = useNetworkStore();

  const isInPath = highlightedPath.includes(data.id);
  const hasEvidence = data.evidence !== null;

  const dominantState = Object.entries(data.beliefs).reduce(
    (max, [state, prob]) => (prob > max.prob ? { state, prob } : max),
    { state: '', prob: 0 }
  );

  const impactColors: Record<string, string> = {
    none: 'from-green-400 to-green-500',
    Low: 'from-green-400 to-green-500',
    minor: 'from-yellow-400 to-yellow-500',
    moderate: 'from-orange-400 to-orange-500',
    Moderate: 'from-orange-400 to-orange-500',
    severe: 'from-red-400 to-red-500',
    High: 'from-red-400 to-red-500',
  };

  const handleStateClick = (stateId: string) => {
    if (data.evidence === stateId) {
      clearEvidence(data.id);
    } else {
      setEvidence(data.id, stateId);
    }
  };

  return (
    <div
      className={cn(
        'rounded-xl shadow-lg transition-all duration-200',
        'min-w-[240px] max-w-[300px]',
        'border-2 bg-red-50 dark:bg-slate-800',
        hasEvidence ? 'border-blue-500' : 'border-red-300 dark:border-red-600',
        selected && 'ring-2 ring-offset-2 ring-blue-500 shadow-xl',
        isInPath && !selected && 'ring-2 ring-offset-1 ring-yellow-400'
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !border-2 !border-white !shadow-md" style={{ backgroundColor: '#ef4444' }} />

      <div className={cn('flex items-center gap-2 px-3 py-3 rounded-t-lg bg-gradient-to-r', impactColors[dominantState.state] || 'from-slate-500 to-slate-600')}>
        <AlertTriangle className="w-5 h-5 text-white" />
        <span className="font-bold text-white">{data.label}</span>
      </div>

      <div className="p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex h-8 rounded-lg overflow-hidden shadow-inner">
            {data.states.map((state) => {
              const probability = data.beliefs[state.id] ?? 0;
              return (
                <button
                  key={state.id}
                  onClick={() => handleStateClick(state.id)}
                  className={cn(
                    'h-full flex items-center justify-center transition-all hover:brightness-110 focus:outline-none',
                    data.evidence === state.id && 'ring-2 ring-white ring-inset'
                  )}
                  style={{
                    width: `${Math.max(probability * 100, probability > 0 ? 5 : 0)}%`,
                    backgroundColor: state.color,
                  }}
                  title={`${state.label}: ${(probability * 100).toFixed(1)}%`}
                >
                  {probability >= 0.12 && (
                    <span className="text-xs font-bold text-white drop-shadow">{(probability * 100).toFixed(0)}%</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between text-[10px]">
            {data.states.map((state) => (
              <div key={state.id} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} />
                <span className="text-slate-500 dark:text-slate-400">{state.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 text-center shadow-inner">
          <p className="text-xs text-slate-500 dark:text-slate-400">Most likely outcome</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100 capitalize">{dominantState.state || 'Unknown'}</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{(dominantState.prob * 100).toFixed(1)}% probability</p>
        </div>
      </div>
    </div>
  );
});

export const CompactNode = memo(function CompactNode({ data }: { data: NetworkNodeData }) {
  const config = categoryConfig[data.category];
  const Icon = config.icon;

  return (
    <div className={cn('rounded-lg shadow-sm border w-[160px]', config.bg, config.border)}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" />
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Icon className="w-3 h-3 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-medium truncate flex-1">{data.label}</span>
      </div>
      <div className="px-2 pb-1.5">
        <CompactBeliefBar states={data.states} beliefs={data.beliefs} evidence={data.evidence} />
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2" />
    </div>
  );
});

export const nodeTypes = {
  substanceNode: BaseNode,
  conditionNode: BaseNode,
  effectNode: BaseNode,
  impactNode: ImpactNode,
  compactNode: CompactNode,
};
