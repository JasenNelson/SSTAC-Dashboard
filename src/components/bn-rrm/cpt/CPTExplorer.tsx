'use client';

import { useState, useMemo, useCallback } from 'react';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { cn } from '@/utils/cn';
import type { NetworkNodeData, NodeState, ConditionalProbabilityTable, CPTEntry } from '@/types/bn-rrm/network';
import { Filter, ChevronLeft, ChevronRight, Search } from 'lucide-react';

const PAGE_SIZE = 50;

interface CPTExplorerProps {
  className?: string;
  initialNodeId?: string | null;
}

export function CPTExplorer({ className, initialNodeId }: CPTExplorerProps) {
  const model = useNetworkStore((state) => state.model);
  const nodeMap = useNetworkStore((state) => state.nodeMap);
  const selectedNodeId = useNetworkStore((state) => state.selectedNodeId);

  // Node selector — prefer explicit prop, then store selection, then first CPT node
  const defaultNodeId = initialNodeId ?? selectedNodeId ?? model?.cpts[0]?.nodeId ?? null;
  const [activeNodeId, setActiveNodeId] = useState<string | null>(defaultNodeId);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  // All nodes that have a CPT
  const cptNodes = useMemo(() => {
    if (!model) return [];
    return model.cpts.map((cpt) => {
      const node = nodeMap.get(cpt.nodeId);
      return { id: cpt.nodeId, label: node?.label ?? cpt.nodeId, category: node?.category ?? 'substance' };
    });
  }, [model, nodeMap]);

  // Root nodes (no incoming edges)
  const rootNodeIds = useMemo(() => {
    if (!model) return new Set<string>();
    const targets = new Set(model.edges.map((e) => e.target));
    return new Set(model.nodes.filter((n) => !targets.has(n.id)).map((n) => n.id));
  }, [model]);

  // Non-CPT nodes for the sidebar
  const nonCptNodes = useMemo(() => {
    if (!model) return [];
    const cptIds = new Set(model.cpts.map((c) => c.nodeId));
    return model.nodes
      .filter((n) => !cptIds.has(n.id))
      .map((n) => ({ id: n.id, label: n.label, category: n.category, isRoot: rootNodeIds.has(n.id) }));
  }, [model, rootNodeIds]);

  const activeCpt = model?.cpts.find((c) => c.nodeId === activeNodeId) ?? null;
  const activeNode = activeNodeId ? nodeMap.get(activeNodeId) : null;

  // Reset filters/page when node changes
  const handleSelectNode = useCallback((nodeId: string) => {
    setActiveNodeId(nodeId);
    setFilters({});
    setPage(0);
  }, []);

  // Filtered sidebar list
  const filteredCptNodes = useMemo(() => {
    if (!search) return cptNodes;
    const q = search.toLowerCase();
    return cptNodes.filter((n) => n.label.toLowerCase().includes(q));
  }, [cptNodes, search]);

  const filteredNonCptNodes = useMemo(() => {
    if (!search) return nonCptNodes;
    const q = search.toLowerCase();
    return nonCptNodes.filter((n) => n.label.toLowerCase().includes(q));
  }, [nonCptNodes, search]);

  if (!model) {
    return <div className={cn('flex items-center justify-center text-slate-400 dark:text-slate-500', className)}>Loading model...</div>;
  }

  return (
    <div className={cn('flex-1 flex overflow-hidden', className)}>
      {/* Sidebar — node picker */}
      <div className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-2">Select Node</h3>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter nodes..."
              className="w-full text-xs pl-7 pr-2 py-1.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* Nodes with CPTs */}
          <div>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
              With CPT ({filteredCptNodes.length})
            </p>
            {filteredCptNodes.map((n) => (
              <SidebarNode
                key={n.id}
                id={n.id}
                label={n.label}
                category={n.category}
                active={n.id === activeNodeId}
                onClick={() => handleSelectNode(n.id)}
              />
            ))}
          </div>
          {/* Root / prior-only nodes */}
          {filteredNonCptNodes.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-1">
                Root / Prior Only ({filteredNonCptNodes.length})
              </p>
              {filteredNonCptNodes.map((n) => (
                <SidebarNode
                  key={n.id}
                  id={n.id}
                  label={n.label}
                  category={n.category}
                  active={n.id === activeNodeId}
                  onClick={() => handleSelectNode(n.id)}
                  dim
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content — CPT table */}
      <div className="flex-1 overflow-auto p-6">
        {!activeNodeId || !activeNode ? (
          <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
            <p className="text-sm">Select a node to view its CPT</p>
          </div>
        ) : !activeCpt || activeCpt.entries.length === 0 ? (
          <div className="max-w-lg mx-auto mt-12 text-center">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">{activeNode.label}</h2>
            {rootNodeIds.has(activeNodeId) ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Root node &mdash; beliefs represent prior probabilities. No conditional probability table.
              </p>
            ) : (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  CPT missing for non-root node <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">{activeNodeId}</code>
                </p>
              </div>
            )}
          </div>
        ) : (
          <FullPageCPTTable
            cpt={activeCpt}
            node={activeNode}
            states={activeNode.states}
            nodeMap={nodeMap}
            filters={filters}
            setFilters={setFilters}
            page={page}
            setPage={setPage}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SIDEBAR NODE BUTTON
// =============================================================================

const categoryDot: Record<string, string> = {
  substance: 'bg-blue-500',
  condition: 'bg-violet-500',
  effect: 'bg-amber-500',
  impact: 'bg-red-500',
};

function SidebarNode({ id: _id, label, category, active, onClick, dim }: {
  id: string; label: string; category: string; active: boolean; onClick: () => void; dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left',
        active
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
          : dim
            ? 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', categoryDot[category] ?? 'bg-slate-400')} />
      <span className="truncate">{label}</span>
    </button>
  );
}

// =============================================================================
// FULL-PAGE CPT TABLE
// =============================================================================

interface FullPageCPTTableProps {
  cpt: ConditionalProbabilityTable;
  node: NetworkNodeData;
  states: NodeState[];
  nodeMap: Map<string, NetworkNodeData>;
  filters: Record<string, string>;
  setFilters: (f: Record<string, string>) => void;
  page: number;
  setPage: (p: number) => void;
}

function FullPageCPTTable({ cpt, node, states, nodeMap, filters, setFilters, page, setPage }: FullPageCPTTableProps) {
  const parentIds = cpt.parentNodeIds;

  const parentLabel = useCallback((pid: string) => {
    return nodeMap.get(pid)?.label ?? pid;
  }, [nodeMap]);

  // Unique values per parent
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

  // Filter
  const filtered = useMemo(() => {
    return cpt.entries.filter((entry) =>
      parentIds.every((pid) => {
        const f = filters[pid];
        return !f || entry.parentStates[pid] === f;
      })
    );
  }, [cpt, parentIds, filters]);

  // Stats
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
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Repeat suppression: track which parent cols changed from previous row
  const changedFlags = useMemo(() => {
    const flags: boolean[][] = [];
    for (let i = 0; i < paged.length; i++) {
      if (i === 0) {
        flags.push(parentIds.map(() => true));
      } else {
        flags.push(parentIds.map((pid) => paged[i].parentStates[pid] !== paged[i - 1].parentStates[pid]));
      }
    }
    return flags;
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{node.label}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Conditional Probability Table &middot; {cpt.entries.length} rows &middot; {parentIds.length} parents &middot; {states.length} states &middot; {uniqueDistributions} unique distributions
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter by parent state</span>
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setFilters({}); setPage(0); }}
              className="ml-auto text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
            >
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {parentIds.map((pid) => (
            <div key={pid} className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {parentLabel(pid)}
              </label>
              <select
                value={filters[pid] ?? ''}
                onChange={(e) => handleFilterChange(pid, e.target.value)}
                className={cn(
                  'text-xs rounded border px-2 py-1 bg-white dark:bg-slate-700',
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
        {activeFilterCount > 0 && (
          <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
            Showing {filtered.length} of {cpt.entries.length} rows
          </p>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          No rows match current filters.
        </p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-600 w-8">
                    #
                  </th>
                  {parentIds.map((pid) => (
                    <th
                      key={pid}
                      className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600"
                    >
                      {parentLabel(pid)}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-600/30">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Distribution</span>
                  </th>
                  {states.map((s) => (
                    <th
                      key={s.id}
                      className="px-3 py-2.5 text-right text-xs font-semibold border-b border-slate-200 dark:border-slate-600"
                      style={{ color: s.color || undefined }}
                    >
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((entry, idx) => {
                  const rowNum = safePage * PAGE_SIZE + idx + 1;
                  const changed = changedFlags[idx];
                  // Is this the start of a new group? (first parent changed)
                  const isGroupStart = idx === 0 || changed[0];

                  return (
                    <tr
                      key={rowNum}
                      className={cn(
                        'transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
                        isGroupStart && idx > 0 && 'border-t-2 border-slate-200 dark:border-slate-600',
                        idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/30 dark:bg-slate-800/50'
                      )}
                    >
                      <td className="px-3 py-2 text-xs text-slate-300 dark:text-slate-600 border-b border-slate-100 dark:border-slate-700 tabular-nums">
                        {rowNum}
                      </td>
                      {parentIds.map((pid, pIdx) => {
                        const val = entry.parentStates[pid] ?? '\u2014';
                        const isChanged = changed[pIdx];
                        return (
                          <td
                            key={pid}
                            className={cn(
                              'px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-sm',
                              isChanged
                                ? 'text-slate-700 dark:text-slate-300 font-medium'
                                : 'text-slate-300 dark:text-slate-600'
                            )}
                          >
                            {isChanged ? val : <span className="select-none">{val}</span>}
                          </td>
                        );
                      })}
                      {/* Inline distribution bar */}
                      <td className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                        <DistributionBar entry={entry} states={states} />
                      </td>
                      {states.map((s) => {
                        const prob = entry.distribution[s.id] ?? 0;
                        const pct = prob * 100;
                        return (
                          <td
                            key={s.id}
                            className={cn(
                              'px-3 py-2 text-right tabular-nums border-b border-slate-100 dark:border-slate-700 text-sm',
                              pct >= 50 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                            )}
                          >
                            {pct.toFixed(1)}%
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              <button
                onClick={() => setPage(Math.max(0, safePage - 1))}
                disabled={safePage === 0}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                <ChevronLeft className="w-3 h-3" /> Prev
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {safePage + 1} of {totalPages} &middot; Rows {safePage * PAGE_SIZE + 1}&ndash;{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                disabled={safePage >= totalPages - 1}
                className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                Next <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// INLINE DISTRIBUTION BAR (fits in a table cell)
// =============================================================================

function DistributionBar({ entry, states }: { entry: CPTEntry; states: NodeState[] }) {
  return (
    <div className="flex h-4 w-28 rounded overflow-hidden bg-slate-100 dark:bg-slate-700">
      {states.map((s) => {
        const prob = entry.distribution[s.id] ?? 0;
        return (
          <div
            key={s.id}
            className="h-full transition-all"
            style={{
              width: `${prob * 100}%`,
              backgroundColor: s.color || '#94a3b8',
              minWidth: prob > 0 ? '1px' : '0',
            }}
            title={`${s.label}: ${(prob * 100).toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

export default CPTExplorer;
