/**
 * NodeInspector Panel
 *
 * Side panel showing details of the selected node:
 * - Node metadata (name, category, description)
 * - Current beliefs with interactive bars
 * - CPT viewer/editor
 * - Parent/child relationships
 */

'use client';

import { memo, useMemo } from 'react';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { BeliefBar } from '@/components/bn-rrm/canvas/BeliefBar';
import { cn } from '@/utils/cn';
import type { NetworkNodeData, NodeCategory } from '@/types/bn-rrm/network';
import {
  X,
  Beaker,
  Thermometer,
  Activity,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  Table,
  ArrowRight,
  ArrowLeft,
  Info,
  BookOpen,
} from 'lucide-react';

// =============================================================================
// CATEGORY CONFIG
// =============================================================================

const categoryConfig: Record<
  NodeCategory,
  {
    icon: typeof Beaker;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  substance: {
    icon: Beaker,
    label: 'Substance',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
  },
  condition: {
    icon: Thermometer,
    label: 'Environmental Condition',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-900/30',
  },
  effect: {
    icon: Activity,
    label: 'Effect',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-900/30',
  },
  impact: {
    icon: AlertTriangle,
    label: 'Impact',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
  },
};

// =============================================================================
// NODE INSPECTOR COMPONENT
// =============================================================================

interface NodeInspectorProps {
  className?: string;
  onClose?: () => void;
}

export const NodeInspector = memo(function NodeInspector({
  className,
  onClose: _onClose,
}: NodeInspectorProps) {
  const {
    selectedNodeId,
    nodeMap,
    selectNode,
    setEvidence,
    clearEvidence,
    getParentNodes,
    getChildNodes,
    toggleContainer,
    model,
  } = useNetworkStore();

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;

  const parentNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    return getParentNodes(selectedNodeId);
  }, [selectedNodeId, getParentNodes]);

  const childNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    return getChildNodes(selectedNodeId);
  }, [selectedNodeId, getChildNodes]);

  // Find the container this node belongs to
  const containerId = selectedNode?.containerId;
  const container = containerId && model
    ? model.containers.find(c => c.id === containerId)
    : null;

  // Sibling nodes in same container (for quick navigation)
  const siblingNodes = useMemo(() => {
    if (!container || !model || !selectedNode) return [];
    return model.nodes.filter(
      n => n.containerId === containerId && n.id !== selectedNode.id
    );
  }, [container, containerId, model, selectedNode]);

  if (!selectedNode) {
    return (
      <div className={cn('bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-4', className)}>
        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <Info className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">No node selected</p>
          <p className="text-xs mt-1">Click a node to view details</p>
        </div>
      </div>
    );
  }

  const config = categoryConfig[selectedNode.category];
  const Icon = config.icon;
  const hasEvidence = selectedNode.evidence !== null;

  const handleStateClick = (stateId: string) => {
    if (selectedNode.evidence === stateId) {
      clearEvidence(selectedNode.id);
    } else {
      setEvidence(selectedNode.id, stateId);
    }
  };

  const handleClearEvidence = () => {
    clearEvidence(selectedNode.id);
  };

  return (
    <div className={cn('bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col', className)}>
      {/* Header */}
      <div className={cn('p-4 border-b border-slate-100 dark:border-slate-700', config.bgColor)}>
        {/* Container breadcrumb + collapse action */}
        {container && (
          <div className="flex items-center gap-2 mb-2 text-xs">
            <button
              onClick={() => {
                selectNode(null);
                toggleContainer(containerId!);
              }}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>{container.label}</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium truncate">{selectedNode.label}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm', config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                {selectedNode.label}
              </h3>
              <p className={cn('text-xs', config.color)}>{config.label}</p>
            </div>
          </div>
          <button
            onClick={() => selectNode(null)}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors"
            title="Deselect node"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Evidence badge */}
        {hasEvidence && (
          <div className="mt-3 flex items-center justify-between bg-blue-100 dark:bg-blue-900/40 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Evidence: {selectedNode.evidence}
              </span>
            </div>
            <button
              onClick={handleClearEvidence}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 flex items-center gap-1"
            >
              <EyeOff className="w-3 h-3" />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        {selectedNode.description && (
          <Section title="Description" icon={BookOpen}>
            <p className="text-sm text-slate-600 dark:text-slate-400">{selectedNode.description}</p>
          </Section>
        )}

        {/* Parameter info for substance/condition nodes */}
        {'parameter' in selectedNode && (
          <Section title="Parameter" icon={Info}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Name:</span>
                <span className="ml-2 font-medium">{selectedNode.parameter}</span>
              </div>
              {'unit' in selectedNode && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Unit:</span>
                  <span className="ml-2 font-medium">{selectedNode.unit}</span>
                </div>
              )}
              {'mediaType' in selectedNode && (
                <div>
                  <span className="text-slate-500 dark:text-slate-400">Media:</span>
                  <span className="ml-2 font-medium capitalize">
                    {selectedNode.mediaType}
                  </span>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Guidelines for substance nodes */}
        {'guidelines' in selectedNode && selectedNode.guidelines && (
          <Section title="Guidelines" icon={Table}>
            <div className="space-y-2">
              {selectedNode.guidelines.map((guideline) => (
                <div
                  key={guideline.name}
                  className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-700/50 rounded px-3 py-2"
                >
                  <span className="font-medium">{guideline.name}</span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {guideline.value} {'unit' in selectedNode ? selectedNode.unit : ''}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Current Beliefs */}
        <Section title="Probability Distribution" icon={Activity}>
          <BeliefBar
            states={selectedNode.states}
            beliefs={selectedNode.beliefs}
            evidence={selectedNode.evidence}
            guidelines={'guidelines' in selectedNode ? selectedNode.guidelines : undefined}
            onStateClick={handleStateClick}
            showLabels
            showPercentages
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Click a state to set as evidence
          </p>
        </Section>

        {/* Sibling nodes (same container — quick navigation) */}
        {siblingNodes.length > 0 && (
          <Section title={`Other ${container?.label ?? 'Nodes'}`} icon={Beaker}>
            <div className="space-y-1">
              {siblingNodes.map((node) => (
                <NodeLink
                  key={node.id}
                  node={node}
                  onClick={() => selectNode(node.id)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Parent nodes */}
        {parentNodes.length > 0 && (
          <Section title="Parent Nodes (Causes)" icon={ArrowLeft}>
            <div className="space-y-1">
              {parentNodes.map((node) => (
                <NodeLink
                  key={node.id}
                  node={node}
                  onClick={() => selectNode(node.id)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Child nodes */}
        {childNodes.length > 0 && (
          <Section title="Child Nodes (Effects)" icon={ArrowRight}>
            <div className="space-y-1">
              {childNodes.map((node) => (
                <NodeLink
                  key={node.id}
                  node={node}
                  onClick={() => selectNode(node.id)}
                />
              ))}
            </div>
          </Section>
        )}

      </div>
    </div>
  );
});

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface SectionProps {
  title: string;
  icon: typeof Info;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, children }: SectionProps) {
  return (
    <div className="p-4 border-b border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h4>
      </div>
      {children}
    </div>
  );
}

interface NodeLinkProps {
  node: NetworkNodeData;
  onClick: () => void;
}

function NodeLink({ node, onClick }: NodeLinkProps) {
  const config = categoryConfig[node.category];
  const Icon = config.icon;

  // Find the most likely state
  const topState = Object.entries(node.beliefs).reduce(
    (max, [state, prob]) => (prob > max.prob ? { state, prob } : max),
    { state: '', prob: 0 }
  );

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left group"
    >
      <Icon className={cn('w-4 h-4', config.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate group-hover:text-slate-900 dark:group-hover:text-slate-100">
          {node.label}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {topState.state}: {(topState.prob * 100).toFixed(0)}%
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400" />
    </button>
  );
}

export default NodeInspector;
