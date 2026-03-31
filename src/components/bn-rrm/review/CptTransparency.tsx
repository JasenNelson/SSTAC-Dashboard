'use client';

import { useState } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeCptTransparency, type NormalizedCptNode } from '@/lib/bn-rrm/normalize-artifacts';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';

// Types are now in normalize-artifacts.ts — using NormalizedCptNode directly

const SOURCE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  'Noisy-OR': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Noisy-OR' },
  Expert: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'Expert' },
  Hybrid: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300', label: 'Hybrid' },
  'Data-Learned': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Data-Learned' },
};

function SourceBadge({ source }: { source: string }) {
  const badge = SOURCE_BADGES[source] ?? SOURCE_BADGES.Expert;
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
      {badge.label}
    </span>
  );
}

function DistributionBar({ distribution, label }: { distribution: Record<string, number>; label: string }) {
  const states = Object.entries(distribution);
  const colors = ['bg-green-400', 'bg-amber-400', 'bg-red-400'];
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</div>
      <div className="flex h-6 rounded-full overflow-hidden">
        {states.map(([state, prob], i) => (
          <div
            key={state}
            className={`${colors[i % colors.length]} flex items-center justify-center`}
            style={{ width: `${prob * 100}%` }}
          >
            {prob >= 0.1 && (
              <span className="text-[10px] font-bold text-white">{(prob * 100).toFixed(0)}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        {states.map(([state]) => (
          <span key={state}>{state}</span>
        ))}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function NodeCard({ node }: { node: NormalizedCptNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl border ${
      node.dr001_affected
        ? 'border-red-300 dark:border-red-700'
        : 'border-slate-200 dark:border-slate-700'
    } overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-medium text-slate-800 dark:text-slate-100">{node.label}</span>
            <SourceBadge source={node.cpt_source} />
            {node.dr001_affected && (
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                DR-001
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 flex-wrap">
            <span>Tier {node.tier} &middot; N = {node.sample_count} stations</span>
            {node.config_coverage && (
              <>
                <span>&middot; {node.config_coverage.observed}/{node.config_coverage.possible} configs ({node.config_coverage.coverage_pct}%)</span>
                <InfoTooltip
                  {...TOOLTIP.configCoverage(node.config_coverage.observed, node.config_coverage.possible, node.config_coverage.coverage_pct)}
                  iconSize={11}
                />
              </>
            )}
          </div>
        </div>
        <svg className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-5 space-y-4">
          {/* ESS / Prior Weight */}
          {node.ess_prior_weight && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3.5">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                {node.ess_prior_weight.method}
                <InfoTooltip {...TOOLTIP.cptLearningMethod} iconSize={12} />
              </div>
              {node.ess_prior_weight.ess !== null && (
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  ESS = {node.ess_prior_weight.ess}
                  <InfoTooltip {...TOOLTIP.ess} iconSize={11} />
                </div>
              )}
              <div className="text-xs text-slate-400 mt-1">{node.ess_prior_weight.note}</div>
            </div>
          )}

          {/* Expert vs Learned side-by-side */}
          {node.expert_distribution && (
            <DistributionBar
              distribution={node.expert_distribution.marginal}
              label="Expert Prior (marginal)"
            />
          )}
          {node.learned_distribution && (
            <DistributionBar
              distribution={node.learned_distribution.marginal}
              label="Data-Learned (BDeu marginal)"
            />
          )}
          {!node.expert_distribution && !node.learned_distribution && (
            <div className="text-sm text-slate-400 italic">
              No distribution data available for this node.
            </div>
          )}

          {/* Parameter/unit info */}
          {node.parameter && (
            <div className="text-xs text-slate-400">
              Parameter: {node.parameter} {node.unit && `(${node.unit})`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function CptTransparency() {
  const { data: rawData, loading, error } = usePackArtifact<any>('cpt_transparency');
  const [filterTier, setFilterTier] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const data = rawData ? normalizeCptTransparency(rawData) : null;

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    );
  }

  const filteredNodes = filterTier !== null
    ? data.nodes.filter(n => n.tier === filterTier)
    : data.nodes;

  return (
    <div className="space-y-6">
      {/* Header with export toolbar */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            CPT Transparency
            <InfoTooltip {...TOOLTIP.cptTransparency} />
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Per-node conditional probability table source, sample counts, and distribution comparisons
          </p>
        </div>
        <div className="flex gap-2 shrink-0 ml-4">
          <button
            onClick={() => downloadFile(JSON.stringify(data, null, 2), 'cpt_transparency.json', 'application/json')}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => {
              const header = 'id,label,tier,cpt_source,sample_count,parameter,unit,dr001_affected,config_observed,config_possible,config_pct\n';
              const rows = (data.nodes ?? []).map(n =>
                [n.id, `"${n.label}"`, n.tier, n.cpt_source, n.sample_count, n.parameter ?? '', n.unit ?? '', n.dr001_affected,
                  n.config_coverage?.observed ?? '', n.config_coverage?.possible ?? '', n.config_coverage?.coverage_pct ?? ''].join(',')
              ).join('\n');
              downloadFile(header + rows, 'cpt_transparency.csv', 'text/csv');
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* DR-001 Callout */}
      {data.dr001_callout && (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200">
            {data.dr001_callout.id}
          </span>
          <span className="text-sm font-semibold text-red-800 dark:text-red-200">{data.dr001_callout.title}</span>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300">{data.dr001_callout.description}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(data.dr001_callout.affected_nodes ?? []).map((nid: string) => (
            <span key={nid} className="px-2 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-mono">
              {nid}
            </span>
          ))}
        </div>
      </div>
      )}

      {/* Tier summary cards */}
      <div className="grid grid-cols-5 gap-2">
        {(data.tier_summary ?? []).map(ts => (
          <button
            key={ts.tier}
            onClick={() => setFilterTier(filterTier === ts.tier ? null : ts.tier)}
            className={`p-3.5 rounded-lg border text-left transition-colors ${
              filterTier === ts.tier
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <div className="text-xs text-slate-500 dark:text-slate-400">Tier {ts.tier}</div>
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100 mt-0.5">{ts.name}</div>
            <div className="text-xs text-slate-400 mt-1">{ts.node_count} nodes</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(ts.cpt_methods ?? []).map(m => (
                <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  {m}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {/* Source legend */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Source:</span>
        {Object.entries(SOURCE_BADGES).map(([key, badge]) => (
          <span key={key} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        ))}
      </div>

      {/* Node cards */}
      <div className="space-y-2">
        {filteredNodes.map(node => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
