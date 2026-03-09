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

import { memo, useMemo, useState, useCallback } from 'react';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { BeliefBar } from '@/components/bn-rrm/canvas/BeliefBar';
import { cn } from '@/utils/cn';
import type { NetworkNodeData, NodeCategory, NodeState, ConditionalProbabilityTable, CPTEntry } from '@/types/bn-rrm/network';
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
  Filter,
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
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
  },
  effect: {
    icon: Activity,
    label: 'Effect',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
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

  // Build root node set from graph edges: root = no incoming edges
  const rootNodeIds = useMemo(() => {
    if (!model) return new Set<string>();
    const allNodeIds = new Set(model.nodes.map((n) => n.id));
    const hasIncoming = new Set(model.edges.map((e) => e.target));
    const roots = new Set<string>();
    for (const id of allNodeIds) {
      if (!hasIncoming.has(id)) roots.add(id);
    }
    return roots;
  }, [model]);

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

        {/* CPT Viewer */}
        <Section title="Conditional Probability Table" icon={Table}>
          <CPTViewer
            nodeId={selectedNode.id}
            states={selectedNode.states}
            parentNodes={parentNodes}
            cpts={model?.cpts}
            isRoot={rootNodeIds.has(selectedNode.id)}
          />
        </Section>
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

// =============================================================================
// CPT VIEWER (read-only, CPT-first rendering)
// =============================================================================

const PAGE_SIZE = 25;

interface CPTViewerProps {
  nodeId: string;
  states: NodeState[];
  parentNodes: NetworkNodeData[];
  cpts?: ConditionalProbabilityTable[];
  isRoot: boolean;
}

function CPTViewer({ nodeId, states, parentNodes, cpts, isRoot }: CPTViewerProps) {
  const cpt = cpts?.find((c) => c.nodeId === nodeId);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);

  // Reset filters/page when node changes
  const [prevNodeId, setPrevNodeId] = useState(nodeId);
  if (nodeId !== prevNodeId) {
    setPrevNodeId(nodeId);
    setFilters({});
    setPage(0);
  }

  // (a) CPT exists with entries → smart viewer
  if (cpt && cpt.entries.length > 0) {
    return (
      <SmartCPTTable
        cpt={cpt}
        states={states}
        parentNodes={parentNodes}
        filters={filters}
        setFilters={setFilters}
        page={page}
        setPage={setPage}
      />
    );
  }

  // (b) Root node without CPT → prior probabilities message
  if (isRoot) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Root node &mdash; beliefs represent prior probabilities.
      </p>
    );
  }

  // (c) Non-root node missing CPT → explicit error with debug info
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <p className="text-xs font-medium text-red-700 dark:text-red-400">
        CPT missing for non-root node <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{nodeId}</code>
      </p>
      <div className="mt-2 text-[10px] text-red-600/80 dark:text-red-400/70 space-y-0.5">
        <p>Parents: {parentNodes.map((n) => n.id).join(', ') || 'none detected'}</p>
        <p>Model CPTs loaded: {cpts?.length ?? 0}</p>
      </div>
    </div>
  );
}

// =============================================================================
// SMART CPT TABLE
// =============================================================================

interface SmartCPTTableProps {
  cpt: ConditionalProbabilityTable;
  states: NodeState[];
  parentNodes: NetworkNodeData[];
  filters: Record<string, string>;
  setFilters: (f: Record<string, string>) => void;
  page: number;
  setPage: (p: number) => void;
}

function SmartCPTTable({ cpt, states, parentNodes, filters, setFilters, page, setPage }: SmartCPTTableProps) {
  const parentIds = cpt.parentNodeIds;

  // Collect unique values per parent for filter dropdowns
  const parentStateOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const pid of parentIds) {
      const seen = new Set<string>();
      for (const entry of cpt.entries) {
        const v = entry.parentStates[pid];
        if (v) seen.add(v);
      }
      opts[pid] = Array.from(seen).sort();
    }
    return opts;
  }, [cpt, parentIds]);

  // Filter entries
  const filtered = useMemo(() => {
    return cpt.entries.filter((entry) =>
      parentIds.every((pid) => {
        const f = filters[pid];
        return !f || entry.parentStates[pid] === f;
      })
    );
  }, [cpt, parentIds, filters]);

  // Count unique distributions
  const uniqueDistributions = useMemo(() => {
    const set = new Set<string>();
    for (const entry of filtered) {
      const key = states.map((s) => (entry.distribution[s.id] ?? 0).toFixed(4)).join(',');
      set.add(key);
    }
    return set.size;
  }, [filtered, states]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Determine which parent values changed vs previous row (suppress repeats)
  const prevValues = useMemo(() => {
    const result: Record<string, string>[] = [];
    for (let i = 0; i < paged.length; i++) {
      if (i === 0) {
        result.push({});
      } else {
        const prev: Record<string, string> = {};
        for (const pid of parentIds) {
          prev[pid] = paged[i - 1].parentStates[pid] ?? '';
        }
        result.push(prev);
      }
    }
    return result;
  }, [paged, parentIds]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleFilterChange = useCallback((pid: string, value: string) => {
    const next = { ...filters };
    if (value) {
      next[pid] = value;
    } else {
      delete next[pid];
    }
    setFilters(next);
    setPage(0);
  }, [filters, setFilters, setPage]);

  const parentLabel = useCallback((pid: string) => {
    return parentNodes.find((n) => n.id === pid)?.label ?? pid;
  }, [parentNodes]);

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
        <span>{cpt.entries.length} rows</span>
        <span>&middot;</span>
        <span>{parentIds.length} parents</span>
        <span>&middot;</span>
        <span>{uniqueDistributions} unique</span>
      </div>

      {/* Parent filter dropdowns */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
          <Filter className="w-3 h-3" />
          <span>Filter by parent state</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilters({}); setPage(0); }}
              className="ml-auto text-blue-500 hover:text-blue-700 dark:text-blue-400"
            >
              Clear all
            </button>
          )}
        </div>
        {parentIds.map((pid) => (
          <div key={pid} className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-20 shrink-0" title={parentLabel(pid)}>
              {parentLabel(pid)}
            </span>
            <select
              value={filters[pid] ?? ''}
              onChange={(e) => handleFilterChange(pid, e.target.value)}
              className={cn(
                'flex-1 text-[11px] rounded border px-1.5 py-1 bg-white dark:bg-slate-700',
                'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300',
                'focus:outline-none focus:ring-1 focus:ring-blue-500',
                filters[pid] && 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/30'
              )}
            >
              <option value="">All</option>
              {parentStateOptions[pid]?.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Filtered count */}
      {activeFilterCount > 0 && (
        <p className="text-[10px] text-blue-500 dark:text-blue-400">
          Showing {filtered.length} of {cpt.entries.length} rows
        </p>
      )}

      {/* CPT rows as cards (fits narrow panel) */}
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
          No rows match current filters.
        </p>
      ) : (
        <div className="space-y-1">
          {paged.map((entry, idx) => (
            <CPTRow
              key={page * PAGE_SIZE + idx}
              entry={entry}
              states={states}
              parentIds={parentIds}
              parentLabel={parentLabel}
              prevRow={prevValues[idx]}
              isFirst={idx === 0}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            Prev
          </button>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-600"
          >
            Next
          </button>
        </div>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        read-only
      </p>
    </div>
  );
}

// =============================================================================
// CPT ROW CARD
// =============================================================================

interface CPTRowProps {
  entry: CPTEntry;
  states: NodeState[];
  parentIds: string[];
  parentLabel: (pid: string) => string;
  prevRow: Record<string, string>;
  isFirst: boolean;
}

function CPTRow({ entry, states, parentIds, parentLabel, prevRow, isFirst }: CPTRowProps) {
  // Determine which parent values changed from previous row
  const changedParents = parentIds.filter((pid) => {
    if (isFirst) return true;
    return entry.parentStates[pid] !== prevRow[pid];
  });

  // Show parent pills only for changed values, or show a dim "same" indicator
  const showParentHeader = changedParents.length > 0;

  return (
    <div className={cn(
      'rounded-lg border px-2.5 py-2',
      'border-slate-100 dark:border-slate-700',
      'bg-white dark:bg-slate-800/50',
      showParentHeader ? 'mt-1.5' : 'mt-0.5 border-dashed border-slate-100/60 dark:border-slate-700/40'
    )}>
      {/* Parent state combination */}
      {showParentHeader ? (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {parentIds.map((pid) => {
            const val = entry.parentStates[pid] ?? '\u2014';
            const changed = changedParents.includes(pid);
            return (
              <span
                key={pid}
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
                  changed
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium'
                    : 'text-slate-400 dark:text-slate-500'
                )}
                title={`${parentLabel(pid)}: ${val}`}
              >
                <span className="text-slate-400 dark:text-slate-500 truncate max-w-[60px]">
                  {parentLabel(pid).split(' ').pop()}
                </span>
                <span className={changed ? '' : 'opacity-50'}>{val}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1 mb-1 text-[10px] text-slate-300 dark:text-slate-600">
          <span>\u22EE same parents</span>
        </div>
      )}

      {/* Distribution bars */}
      <div className="space-y-0.5">
        {states.map((s) => {
          const prob = entry.distribution[s.id] ?? 0;
          const pct = prob * 100;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <span className="text-[10px] w-14 truncate text-slate-500 dark:text-slate-400" title={s.label}>
                {s.label}
              </span>
              <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: s.color || '#94a3b8',
                    minWidth: pct > 0 ? '2px' : '0',
                  }}
                />
              </div>
              <span className="text-[10px] w-10 text-right tabular-nums text-slate-600 dark:text-slate-400">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NodeInspector;
