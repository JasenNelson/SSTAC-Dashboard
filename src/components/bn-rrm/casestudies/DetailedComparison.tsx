'use client';

// Detailed Comparison view -- side-by-side per-CPT-node breakdown of the
// reconstructed Jermilova BN-RRM vs the published Jermilova et al. 2025
// model. Sits alongside "Published Benchmark" in the Case Studies tab
// when the Jermilova pack is selected.
//
// Audience: peer reviewers + regulators reading the case study who want
// more depth than the Published Benchmark headlines but less than the
// full peer-reviewer-grade methodology paper (linked from AI-assisted
// BN-RRM development > Technical tier).
//
// Source of truth: every number on this page comes from one of three
// pack artifacts (comparison_results.json, cpt_transparency.json,
// validation.json). The component does no math beyond joining + table
// presentation.

import React, { useMemo, useState } from 'react';
import { Download, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';

// ---------------------------------------------------------------------------
// Data shapes (mirrors PublishedComparison + cpt_transparency artifacts)
// ---------------------------------------------------------------------------

interface MIRankingEntry {
  rank: number;
  source: string;
  MI: number;
}

interface PublishedRankingEntry {
  rank: number;
  slope_coefficient?: string;
}

interface SensitivityEndpoint {
  our_MI_ranking: MIRankingEntry[];
  published_ranking: Record<string, PublishedRankingEntry>;
}

interface LOOEndpoint {
  accuracy: number;
  kappa: number;
  n: number;
}

interface ComparisonResults {
  structural: { match: boolean };
  sensitivity_ranking_comparison: Record<string, string | SensitivityEndpoint>;
  loo_accuracy_summary: {
    GSL: Record<string, LOOEndpoint>;
    GBS: Record<string, LOOEndpoint>;
    interpretation: string;
  };
}

interface CptNode {
  id: string;
  label: string;
  tier: number;
  cpt_source: string;
  sample_count: number;
  parameter?: string;
  unit?: string;
  dr001_affected: boolean;
  learned_distribution?: {
    states: string[];
    marginal: Record<string, number>;
  };
  expert_distribution?: unknown;
  ess_prior_weight?: { ess: number; method: string; note?: string };
}

interface CptTransparencyData {
  _meta?: Record<string, unknown>;
  nodes: CptNode[];
}

interface ValidationNodeEntry {
  kappa?: number;
  accuracy?: number;
  n?: number;
}
interface ValidationData {
  summary?: {
    GSL?: Record<string, ValidationNodeEntry>;
    GBS?: Record<string, ValidationNodeEntry>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENDPOINT_KEYS = [
  'GSL_fish_tissue_hg',
  'GSL_freshwater_thg',
  'GBS_fish_tissue_hg',
  'GBS_freshwater_thg',
] as const;
type EndpointKey = typeof ENDPOINT_KEYS[number];

// Map raw published-ranking keys (which use prose labels) to our node ids
// so we can place a rank against each CPT node row. Conservative: only
// covers entries actually present in the Jermilova published_reference.
const PUBLISHED_LABEL_TO_NODE_ID: Record<string, string> = {
  'Total Hg input': 'total_hg_deposition',
  'Proximity to historic mining': 'proximity_historic_mine',
  'Proximity to mining': 'proximity_mine_gsl',
  'Proximity to RPTS': 'proximity_rpts_gbs',
  'Proximity to fossil fuel': 'proximity_oil_gbs',
  'Fish length': 'fish_length',
  'Fish species': 'fish_species',
};

// Compute the modal state of a learned distribution (the most likely
// state). Returns null when the node has no learned distribution. The
// returned object also carries the probability so callers can render
// "medium (60%)" -- avoids the surprise where a near-uniform
// distribution silently picks the first-encountered state.
function modalState(node: CptNode): { state: string; p: number } | null {
  const ld = node.learned_distribution;
  if (!ld) return null;
  const entries = Object.entries(ld.marginal);
  if (entries.length === 0) return null;
  let best = entries[0];
  for (const e of entries) if (e[1] > best[1]) best = e;
  return { state: best[0], p: best[1] };
}

function formatProb(p: number): string {
  if (p == null || isNaN(p)) return '-';
  if (p < 0.001) return '<0.1%';
  return `${(p * 100).toFixed(1)}%`;
}

function tierColor(tier: number): string {
  if (tier === 1) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (tier === 2) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
  if (tier === 3) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
}

function sourceColor(source: string): string {
  if (source === 'Data-Learned') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (source === 'Expert') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  if (source === 'Hybrid') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
  if (source === 'Noisy-OR') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
}

// Join: for each CPT node, return aggregated rank info (where it appears
// as a driver across the 4 published endpoint rankings).
function publishedRanksForNode(
  nodeId: string,
  sensitivityComparison: Record<string, string | SensitivityEndpoint>,
): { endpoint: EndpointKey; ourRank: number | null; pubRank: number | null }[] {
  const out: { endpoint: EndpointKey; ourRank: number | null; pubRank: number | null }[] = [];
  for (const ep of ENDPOINT_KEYS) {
    const entry = sensitivityComparison[ep];
    if (!entry || typeof entry === 'string') continue;
    // Our MI ranking is per-node-id.
    const ourEntry = entry.our_MI_ranking.find((r) => r.source === nodeId);
    const ourRank = ourEntry ? ourEntry.rank : null;
    // Published ranking is per-label; map back via PUBLISHED_LABEL_TO_NODE_ID.
    let pubRank: number | null = null;
    for (const [label, ranking] of Object.entries(entry.published_ranking)) {
      if (PUBLISHED_LABEL_TO_NODE_ID[label] === nodeId) {
        pubRank = ranking.rank;
        break;
      }
    }
    if (ourRank != null || pubRank != null) out.push({ endpoint: ep, ourRank, pubRank });
  }
  return out;
}

// LOO kappa for a CPT node, taken from comparison_results.loo_accuracy_summary.
// Returns N-WEIGHTED mean kappa + accuracy across submodels where the
// node appears as an endpoint. Weighting matters for peer-reviewer
// clarity: a node with 584 cases in GSL and 258 in GBS shouldn't have
// the two submodels weighted equally just because count=2. Returns
// null when the node is not an endpoint anywhere.
function looKappaForNode(
  nodeId: string,
  loo: ComparisonResults['loo_accuracy_summary'],
): { kappa: number; accuracy: number; n: number; submodels: string[] } | null {
  const submodels: string[] = [];
  let kappaWeightedSum = 0;
  let accuracyWeightedSum = 0;
  let n = 0;
  for (const sub of ['GSL', 'GBS'] as const) {
    const subMap = loo[sub];
    if (!subMap) continue;
    const entry = subMap[nodeId];
    if (!entry) continue;
    submodels.push(sub);
    kappaWeightedSum += entry.kappa * entry.n;
    accuracyWeightedSum += entry.accuracy * entry.n;
    n += entry.n;
  }
  if (n === 0) return null;
  return {
    kappa: kappaWeightedSum / n,
    accuracy: accuracyWeightedSum / n,
    n,
    submodels,
  };
}

// ---------------------------------------------------------------------------
// Comparison-dimension status -- frozen at M2 per the methodology paper
// ---------------------------------------------------------------------------

type DimStatus = 'done' | 'partial' | 'not-run';
interface ComparisonDimension {
  id: number;
  name: string;
  description: string;
  status: DimStatus;
  result: string;
}

const COMPARISON_DIMENSIONS: ComparisonDimension[] = [
  {
    id: 1,
    name: 'Structural',
    description: 'Node count, edge count, topological ordering vs published DAG.',
    status: 'done',
    result: 'MATCH -- 14 nodes / 15 edges per submodel',
  },
  {
    id: 2,
    name: 'CPT divergence',
    description: 'Jensen-Shannon divergence per shared CPT (BDeu vs lme+predictSE).',
    status: 'not-run',
    result: 'Pending; planned follow-up.',
  },
  {
    id: 3,
    name: 'Per-region marginal',
    description: 'Pearson r between per-region marginals (ours vs published).',
    status: 'not-run',
    result: 'Pending; planned follow-up.',
  },
  {
    id: 4,
    name: 'Sensitivity rankings',
    description: 'MI ranking (ours) vs published Table 2 slope-coefficient ranking.',
    status: 'partial',
    result: 'Top-3 narrative match; full rank-displacement metric not yet computed.',
  },
  {
    id: 5,
    name: 'Minamata fold-change',
    description: '35-60% atmospheric-Hg reduction counterfactual fold-change in fish-tissue Hg.',
    status: 'not-run',
    result: 'Pending; planned follow-up.',
  },
];

function statusBadge(status: DimStatus): { label: string; bg: string; text: string; Icon: typeof CheckCircle2 } {
  if (status === 'done') return { label: 'done', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', Icon: CheckCircle2 };
  if (status === 'partial') return { label: 'partial', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', Icon: AlertTriangle };
  return { label: 'not run', bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', Icon: Circle };
}

// ---------------------------------------------------------------------------
// CSV / JSON export helpers
// ---------------------------------------------------------------------------

function downloadBlob(content: string, filename: string, mime: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportNodeRowsToCsv(rows: NodeRow[]): string {
  const headers = ['node_id', 'label', 'tier', 'source', 'sample_count', 'modal_state', 'loo_kappa', 'loo_accuracy', 'loo_n', 'driver_endpoints_count'];
  const csvRows = rows.map((r) => [
    r.node.id,
    `"${r.node.label.replace(/"/g, '""')}"`,
    r.node.tier,
    r.node.cpt_source,
    r.node.sample_count,
    r.modalState ? `${r.modalState.state} (${(r.modalState.p * 100).toFixed(1)}%)` : '',
    r.loo ? r.loo.kappa.toFixed(3) : '',
    r.loo ? (r.loo.accuracy * 100).toFixed(1) + '%' : '',
    r.loo ? r.loo.n : '',
    r.publishedRanks.length,
  ].join(','));
  return [headers.join(','), ...csvRows].join('\n');
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface NodeRow {
  node: CptNode;
  modalState: { state: string; p: number } | null;
  loo: ReturnType<typeof looKappaForNode>;
  publishedRanks: ReturnType<typeof publishedRanksForNode>;
}

export function DetailedComparison() {
  const { data: comparisonRaw, loading: loadingCmp, error: errCmp } =
    usePackArtifact<ComparisonResults>('comparison_results');
  const { data: cptRaw, loading: loadingCpt, error: errCpt } =
    usePackArtifact<CptTransparencyData>('cpt_transparency');
  const { data: validationRaw, loading: loadingVal, error: errVal } =
    usePackArtifact<ValidationData>('validation');

  const loading = loadingCmp || loadingCpt || loadingVal;
  const error = errCmp || errCpt || errVal;

  // Filter state. Tier filter is `'all' | <tier-number>` derived
  // dynamically from the row data (codex H-3: Jermilova has Tier 4
  // deterministic nodes -- eligible_commercial_catch, mehg_ingested,
  // ptwi_exceedance -- that a hard-coded 1/2/3 chip list missed).
  const [tierFilter, setTierFilter] = useState<'all' | number>('all');
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  // Build NodeRow[] -- per-CPT-node merge of cpt_transparency + LOO + ranks.
  const rows: NodeRow[] = useMemo(() => {
    if (!cptRaw || !comparisonRaw) return [];
    return cptRaw.nodes.map((node) => ({
      node,
      modalState: modalState(node),
      loo: looKappaForNode(node.id, comparisonRaw.loo_accuracy_summary),
      publishedRanks: publishedRanksForNode(node.id, comparisonRaw.sensitivity_ranking_comparison),
    }));
  }, [cptRaw, comparisonRaw]);

  const filteredRows = useMemo(() => {
    if (tierFilter === 'all') return rows;
    return rows.filter((r) => r.node.tier === tierFilter);
  }, [rows, tierFilter]);

  // Tier values present in the pack, derived from the row data so the
  // chip set is correct for any Jermilova-like pack (Tier 4 in current
  // Jermilova; could be different in a future pack). Codex H-3 fix.
  const availableTiers = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) set.add(r.node.tier);
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  // Summary stats for the 3-up cards.
  const summary = useMemo(() => {
    const totalNodes = rows.length;
    const loonodes = rows.filter((r) => r.loo != null);
    const meanKappa = loonodes.length === 0
      ? null
      : loonodes.reduce((s, r) => s + (r.loo?.kappa ?? 0), 0) / loonodes.length;
    const doneDims = COMPARISON_DIMENSIONS.filter((d) => d.status === 'done').length;
    const partialDims = COMPARISON_DIMENSIONS.filter((d) => d.status === 'partial').length;
    return { totalNodes, meanKappa, looNodeCount: loonodes.length, doneDims, partialDims };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Loading detailed comparison data...</span>
        </div>
      </div>
    );
  }

  if (error || !comparisonRaw || !cptRaw) {
    return (
      <div className="p-6 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
          Detailed comparison data not available
        </p>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
          {error ?? 'Required pack artifacts (comparison_results, cpt_transparency) are missing.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="detailed-comparison-root">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Detailed Comparison
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
          Per-CPT-node breakdown of how the reconstructed Mackenzie Mercury BN-RRM
          compares with the published Jermilova et al. 2025 model. Each row joins
          the CPT-transparency record (BDeu posterior, ESS=1.0, sample size) with
          the LOO cross-validation kappa for endpoint nodes and the mutual-information
          rank for each node when it appears as a driver in the published ranking.
        </p>
      </div>

      {/* Summary cards (3-up) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            CPT Nodes
          </div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1" data-testid="detailed-stat-nodes">
            {summary.totalNodes}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            14 total across GSL + GBS submodels (12 shared + 2 point-source).
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            LOO Mean Kappa
          </div>
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1" data-testid="detailed-stat-kappa">
            {summary.meanKappa != null ? summary.meanKappa.toFixed(2) : '-'}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Average across {summary.looNodeCount} endpoint nodes with cross-validation data.
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Comparison Dimensions
          </div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1" data-testid="detailed-stat-dims">
            {summary.doneDims} <span className="text-base font-normal text-slate-400">/ {COMPARISON_DIMENSIONS.length}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {summary.doneDims} done, {summary.partialDims} partial, {COMPARISON_DIMENSIONS.length - summary.doneDims - summary.partialDims} pending.
          </p>
        </div>
      </div>

      {/* Explainer panel */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
          How the comparison works
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          We compare against Jermilova et al. 2025 across five protocol dimensions
          frozen at milestone M2 (before fitting started, to prevent retro-shaping
          the comparison). One dimension is fully done, one is partial (narrative
          match), three are open follow-ups. For each CPT node below, the row
          shows what the reconstruction learned (BDeu posterior mode + sample size)
          and -- where the node is an endpoint or appears as a driver -- its LOO
          kappa and its rank vs the paper&apos;s Table 2 ranking. Click a row to
          expand the full posterior distribution.
        </p>
      </div>

      {/* Comparison-dimension status table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Comparison Dimensions
        </h3>
        <ul className="space-y-2">
          {COMPARISON_DIMENSIONS.map((dim) => {
            const badge = statusBadge(dim.status);
            const Icon = badge.Icon;
            return (
              <li
                key={dim.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700"
                data-testid={`comparison-dimension-${dim.id}`}
              >
                <div className={`shrink-0 mt-0.5 ${badge.text}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Dimension {dim.id} -- {dim.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{dim.description}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 italic">{dim.result}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Uncertainty & Sensitivity Analysis section.
          Headlines the four families of uncertainty/sensitivity that
          peer reviewers care about: (a) CPT-development priors,
          (b) predictive validation, (c) input-importance ranking, and
          (d) counterfactual scenarios. Each family card pulls from the
          existing pack artifacts (cpt_transparency, validation,
          comparison_results) without authoring new data. */}
      <UncertaintyAndSensitivitySection rows={rows} comparison={comparisonRaw} />

      {/* Per-CPT-node table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Per-CPT-Node Results
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {(['all' as const, ...availableTiers]).map((t) => (
                <button
                  key={String(t)}
                  type="button"
                  onClick={() => setTierFilter(t)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    tierFilter === t
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  data-testid={`detailed-tier-filter-${String(t)}`}
                >
                  {t === 'all' ? 'All tiers' : `Tier ${t}`}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => downloadBlob(exportNodeRowsToCsv(filteredRows), 'jermilova-detailed-comparison.csv', 'text/csv')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              data-testid="detailed-export-csv"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(JSON.stringify(filteredRows.map((r) => ({ id: r.node.id, label: r.node.label, tier: r.node.tier, source: r.node.cpt_source, n: r.node.sample_count, modal_state: r.modalState, loo: r.loo, published_ranks: r.publishedRanks })), null, 2), 'jermilova-detailed-comparison.json', 'application/json')}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              data-testid="detailed-export-json"
            >
              <Download className="w-3 h-3" /> JSON
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400 w-8" />
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Node</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Tier / Source</th>
                <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">N</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Modal State</th>
                <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">LOO k</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Pub Rank (Ours)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
                    No nodes match the current filter.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => {
                const expanded = expandedNodeId === row.node.id;
                const ChevronIcon = expanded ? ChevronDown : ChevronRight;
                return (
                  <React.Fragment key={row.node.id}>
                    <tr
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                        row.node.dr001_affected ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                      }`}
                      data-testid={`detailed-node-row-${row.node.id}`}
                    >
                      <td className="py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setExpandedNodeId(expanded ? null : row.node.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${row.node.label} details`}
                          data-testid={`detailed-node-row-toggle-${row.node.id}`}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                        >
                          <ChevronIcon className="w-4 h-4" />
                        </button>
                      </td>
                      <td className="py-2 align-top">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{row.node.label}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{row.node.id}</div>
                      </td>
                      <td className="py-2 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${tierColor(row.node.tier)}`}>
                            T{row.node.tier}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sourceColor(row.node.cpt_source)}`}>
                            {row.node.cpt_source}
                          </span>
                          {row.node.dr001_affected && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                              DR-001
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 align-top text-right text-slate-600 dark:text-slate-400 tabular-nums">
                        {row.node.sample_count}
                      </td>
                      <td className="py-2 align-top">
                        {row.modalState ? (
                          <span
                            className="px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono"
                            title={`Modal state probability: ${formatProb(row.modalState.p)}`}
                          >
                            {row.modalState.state}{' '}
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              ({(row.modalState.p * 100).toFixed(0)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-2 align-top text-right text-slate-700 dark:text-slate-300 tabular-nums">
                        {row.loo ? row.loo.kappa.toFixed(2) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-2 align-top">
                        {row.publishedRanks.length === 0 ? (
                          <span className="text-xs text-slate-400">n/a</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {row.publishedRanks.map((rk) => {
                              const endpointHuman = rk.endpoint.replace(/_/g, ' ');
                              const ariaLabel = `${endpointHuman}: paper rank ${rk.pubRank ?? 'n/a'}, our MI rank ${rk.ourRank ?? 'n/a'}`;
                              return (
                                <span
                                  key={rk.endpoint}
                                  title={ariaLabel}
                                  aria-label={ariaLabel}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                >
                                  {rk.pubRank ?? '-'} ({rk.ourRank ?? '-'})
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-700/20">
                        <td />
                        <td colSpan={6} className="py-3">
                          <ExpandedNodeDetail row={row} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          Pub Rank (Ours): paper Table 2 ranking on the left, our mutual-information ranking on the right.
          A node may appear as a driver in multiple endpoint rankings -- one cell per endpoint.
        </p>
      </div>

      {/* Footer pointer */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
          For peer-reviewer-grade detail
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          The values on this page are headlines. The full construction record -- nine
          Parts and six Appendices including the BDeu hand-calculation fixture, the
          ESS sensitivity sweep plan, and per-CPT divergence methodology -- lives in
          the methodology paper linked from the AI-assisted BN-RRM development tab.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expanded row detail -- shows full BDeu posterior bar + parameter info.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Uncertainty & Sensitivity Analysis section
//
// Four families per the advisory:
//   (a) CPT-development -- BDeu ESS, soft-edging, sample size
//   (b) Predictive -- LOO kappa per endpoint
//   (c) Input-importance -- MI ranking vs published slope ranking
//   (d) Counterfactual -- Minamata 35-60% atmospheric Hg reduction (not run)
// All four are headlines into either the per-CPT-node table below or the
// Review tab's CPT Transparency / Validation Dashboard. No new artifacts
// are authored; everything here is data-reshape over existing JSON.
// ---------------------------------------------------------------------------

function UncertaintyAndSensitivitySection({
  rows,
  comparison,
}: {
  rows: NodeRow[];
  comparison: ComparisonResults;
}) {
  // (a) CPT-development -- ESS distribution + sample-size range.
  const essValues = useMemo(() => {
    const set = new Set<number>();
    for (const r of rows) {
      const ess = r.node.ess_prior_weight?.ess;
      if (typeof ess === 'number') set.add(ess);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);
  const sampleSizes = useMemo(() => {
    const counts = rows.map((r) => r.node.sample_count).filter((n) => n > 0);
    if (counts.length === 0) return null;
    return {
      min: Math.min(...counts),
      max: Math.max(...counts),
      median: counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)],
    };
  }, [rows]);

  // (b) Predictive -- LOO kappa per endpoint as a compact heatmap row.
  const looEndpoints = useMemo(() => {
    const out: { node: NodeRow; kappa: number; n: number }[] = [];
    for (const r of rows) {
      if (r.loo) out.push({ node: r, kappa: r.loo.kappa, n: r.loo.n });
    }
    return out;
  }, [rows]);

  // (c) Input-importance -- top driver per endpoint comparison.
  const topDriversByEndpoint = useMemo(() => {
    const out: { endpoint: string; ourTop?: MIRankingEntry; pubTopLabel?: string }[] = [];
    for (const ep of ENDPOINT_KEYS) {
      const entry = comparison.sensitivity_ranking_comparison[ep];
      if (!entry || typeof entry === 'string') continue;
      const ourTop = entry.our_MI_ranking.find((r) => r.rank === 1);
      const pubTop = Object.entries(entry.published_ranking).find(([, v]) => v.rank === 1);
      out.push({ endpoint: ep, ourTop, pubTopLabel: pubTop ? pubTop[0] : undefined });
    }
    return out;
  }, [comparison.sensitivity_ranking_comparison]);

  function kappaColor(k: number): string {
    if (k <= 0) return 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300';
    if (k < 0.2) return 'bg-orange-200 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300';
    if (k < 0.4) return 'bg-amber-200 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
    if (k < 0.6) return 'bg-lime-200 dark:bg-lime-900/40 text-lime-800 dark:text-lime-300';
    return 'bg-emerald-200 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300';
  }

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
      data-testid="us-section-root"
    >
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
        Uncertainty &amp; Sensitivity Analysis
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-3xl">
        Four families. CPT-development priors (a) and predictive
        cross-validation (b) describe the reconstruction&apos;s own
        uncertainty. Input-importance sensitivity (c) compares our
        mutual-information ranking to the paper&apos;s slope-coefficient
        ranking. Counterfactual sensitivity (d) is the Minamata Treaty
        scenario from the paper, not yet implemented in this dashboard.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* (a) CPT-development */}
        <div
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2"
          data-testid="us-family-a"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              a
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              CPT-development priors
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">BDeu ESS:</span>{' '}
              {essValues.length === 1
                ? `${essValues[0]} (uniform across all nodes)`
                : essValues.length === 0
                  ? 'not specified'
                  : essValues.join(', ')}
            </div>
            {sampleSizes && (
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300">Sample size N:</span>{' '}
                min={sampleSizes.min}, median={sampleSizes.median}, max={sampleSizes.max}
              </div>
            )}
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Soft-edging:</span>{' '}
              0.90/0.10 multi-state, 0.95/0.05 binary (prevents zero-prob blocking).
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-500 italic pt-1 leading-relaxed">
              ESS=1.0 is a low-information BDeu prior. The methodology paper
              records this as a documented choice; the proper empirical
              defense is an ESS sensitivity sweep (Plan Q6: re-run LOO at
              ESS in {`{0.5, 1.0, 5.0, 10.0}`}). Not yet run.
            </p>
          </div>
        </div>

        {/* (b) Predictive */}
        <div
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2"
          data-testid="us-family-b"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              b
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Predictive validation (LOO)
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Cohen&apos;s kappa per endpoint node, N-weighted across GSL +
            GBS submodels:
          </p>
          {looEndpoints.length === 0 ? (
            <p className="text-xs text-slate-400">No LOO data in this pack.</p>
          ) : (
            <ul className="space-y-1">
              {looEndpoints.map((ep) => (
                <li
                  key={ep.node.node.id}
                  className="flex items-center gap-2 text-xs"
                  data-testid={`us-loo-row-${ep.node.node.id}`}
                >
                  <span
                    className={`tabular-nums w-12 text-center px-1.5 py-0.5 rounded font-mono font-semibold ${kappaColor(ep.kappa)}`}
                  >
                    {ep.kappa.toFixed(2)}
                  </span>
                  <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">
                    {ep.node.node.label}
                  </span>
                  <span className="text-[10px] text-slate-400">n={ep.n}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-500 italic pt-1 leading-relaxed">
            kappa &gt;= 0.6 substantial; 0.4-0.6 moderate; &lt; 0.4 limited.
            kappa = 0 indicates majority-class collapse (model predicts the
            modal class regardless of evidence) -- this is the water-THg
            pattern, expected from the published class imbalance.
          </p>
        </div>

        {/* (c) Input-importance */}
        <div
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2"
          data-testid="us-family-c"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              c
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Input-importance ranking
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Top driver per endpoint: ours (mutual information) vs published
            (Table 2 slope coefficient).
          </p>
          {topDriversByEndpoint.length === 0 ? (
            <p className="text-xs text-slate-400">No ranking data in this pack.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400">
                  <th className="text-left py-1 font-medium">Endpoint</th>
                  <th className="text-left py-1 font-medium">Ours (MI)</th>
                  <th className="text-left py-1 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {topDriversByEndpoint.map((d) => (
                  <tr key={d.endpoint} data-testid={`us-driver-row-${d.endpoint}`}>
                    <td className="py-1 text-slate-700 dark:text-slate-300">
                      {d.endpoint.replace(/_/g, ' ')}
                    </td>
                    <td className="py-1 text-slate-600 dark:text-slate-400 font-mono">
                      {d.ourTop ? d.ourTop.source : '-'}
                    </td>
                    <td className="py-1 text-slate-600 dark:text-slate-400">
                      {d.pubTopLabel ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-500 italic pt-1 leading-relaxed">
            MI measures statistical dependence; slope coefficients measure
            linear effect size. Comparison is approximate. Full Spearman
            rho / rank-displacement metric is a follow-up.
          </p>
        </div>

        {/* (d) Counterfactual */}
        <div
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-2"
          data-testid="us-family-d"
        >
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              d
            </span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Counterfactual scenarios
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Minamata Treaty:</span>{' '}
              35-60% atmospheric-Hg reduction. Apply intervention; report
              fold-change in fish-tissue Hg across regions and species.
            </div>
            <div>
              <span className="font-medium text-slate-700 dark:text-slate-300">Threshold:</span>{' '}
              same direction (decrease) + magnitude within 0.5x of the
              paper&apos;s reported ~1.2-fold reduction.
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              not run
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-500 italic">
              Requires Python pipeline work in the Regulatory-Review repo;
              not yet authored.
            </span>
          </div>
        </div>
      </div>

      {/* Deep-link pointers to Review-tab transparency surfaces */}
      <div className="mt-4 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
        For per-node detail beyond what this section surfaces: the Review tab&apos;s{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-300">CPT Transparency</span>{' '}
        view exposes the full BDeu posterior + tier-by-tier source breakdown, and{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-300">QA/QC &amp; Validation</span>{' '}
        exposes the per-endpoint LOO confusion (Jermilova is per-CPT not
        per-station; aggregate confusion matrix is not applicable).
      </div>
    </div>
  );
}

function ExpandedNodeDetail({ row }: { row: NodeRow }) {
  const { node } = row;
  const ld = node.learned_distribution;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold mb-1">
            Parameter
          </div>
          <div className="text-slate-700 dark:text-slate-300">
            {node.parameter ?? '-'}
            {node.unit ? <span className="text-slate-400"> ({node.unit})</span> : null}
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold mb-1">
            BDeu prior
          </div>
          <div className="text-slate-700 dark:text-slate-300">
            ESS = {node.ess_prior_weight?.ess ?? '-'} ({node.ess_prior_weight?.method ?? '-'})
          </div>
        </div>
        <div>
          <div className="text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold mb-1">
            LOO cross-validation
          </div>
          <div className="text-slate-700 dark:text-slate-300">
            {row.loo
              ? `kappa ${row.loo.kappa.toFixed(3)}, accuracy ${(row.loo.accuracy * 100).toFixed(1)}%, n=${row.loo.n}`
              : 'Not an endpoint node (no LOO).'}
          </div>
        </div>
      </div>
      {ld && (
        <div>
          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Learned marginal distribution
          </div>
          <div className="flex h-6 rounded overflow-hidden border border-slate-200 dark:border-slate-700">
            {ld.states.map((state, i) => {
              const p = ld.marginal[state] ?? 0;
              if (p < 0.005) return null;
              const colors = ['bg-emerald-400', 'bg-lime-400', 'bg-amber-400', 'bg-orange-400', 'bg-rose-400', 'bg-fuchsia-400'];
              return (
                <div
                  key={state}
                  className={`${colors[i % colors.length]} flex items-center justify-center`}
                  style={{ width: `${p * 100}%` }}
                  title={`${state}: ${formatProb(p)}`}
                >
                  {p >= 0.08 && (
                    <span className="text-[10px] font-bold text-white whitespace-nowrap px-1">
                      {formatProb(p)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
            {ld.states.map((s) => <span key={s}>{s}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
