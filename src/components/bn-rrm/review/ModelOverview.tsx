'use client';

import { useMemo } from 'react';
import modelOverviewData from '@/data/bn-rrm/transparency/model-overview.json';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';

type PerClassMetrics = {
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

const kappaScale = modelOverviewData.performance.kappa_interpretation.scale as {
  range: [number, number];
  label: string;
  color: string;
}[];

function KappaHealthMeter({ value }: { value: number }) {
  const bandColors: Record<string, string> = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    yellow: 'bg-yellow-400',
    green: 'bg-green-500',
    emerald: 'bg-emerald-500',
  };

  // Position as percentage of the bar (0-1 scale)
  const pct = Math.min(Math.max(value * 100, 0), 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>0.0</span>
        <span>Cohen&apos;s Kappa</span>
        <span>1.0</span>
      </div>
      <div className="relative h-6 rounded-full overflow-hidden flex">
        {kappaScale.map((band) => (
          <div
            key={band.label}
            className={`${bandColors[band.color]} flex-1 flex items-center justify-center`}
          >
            <span className="text-[9px] font-bold text-white/80 uppercase tracking-wider">
              {band.label}
            </span>
          </div>
        ))}
        {/* Indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${pct}%` }}
        >
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
            {value.toFixed(3)}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtitle, alert }: { label: string; value: string; subtitle?: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>{value}</div>
      {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function PerClassTable({ perClass }: { perClass: Record<string, PerClassMetrics> }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Class</th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Precision <InfoTooltip {...TOOLTIP.precision} iconSize={12} /></span>
          </th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Recall <InfoTooltip {...TOOLTIP.recall} iconSize={12} /></span>
          </th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">F1 <InfoTooltip {...TOOLTIP.f1Score} iconSize={12} /></span>
          </th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Support <InfoTooltip {...TOOLTIP.support} iconSize={12} /></span>
          </th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(perClass).map(([cls, m]) => (
          <tr key={cls} className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2 font-medium text-slate-700 dark:text-slate-300 capitalize">{cls}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.precision.toFixed(3)}</td>
            <td className={`text-right py-2 ${m.recall === 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{m.recall.toFixed(3)}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{(m.f1 ?? 0).toFixed(3)}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.support}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ModelOverview() {
  const overview = modelOverviewData;
  const perf = overview.performance;
  const data = overview.training_data;

  const siteRows = useMemo(() => data.site_breakdown, [data]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Model Overview</h2>
          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-full">
            {overview._meta.dataset_status}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {overview.model_identity.framework} &mdash; {overview.model_identity.nodes} nodes, {overview.model_identity.edges} edges, {overview.model_identity.states_per_node} states/node
        </p>
      </div>

      {/* Performance Summary Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          LOO Cross-Validation (n={perf.n_complete})
          <InfoTooltip {...TOOLTIP.looCrossValidation} />
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Accuracy" value={`${(perf.loo_accuracy * 100).toFixed(1)}%`} subtitle="Combined (all sites)" />
          <MetricCard label="Kappa" value={perf.loo_kappa.toFixed(3)} subtitle="Cohen's kappa (unweighted)" alert />
          <MetricCard label="High Recall" value={`${(perf.per_class.high.recall * 100).toFixed(1)}%`} subtitle="12/17 high-risk detected" />
          <MetricCard label="Moderate Recall" value={`${(perf.per_class.moderate.recall * 100).toFixed(1)}%`} subtitle={`${Math.round(perf.per_class.moderate.recall * perf.per_class.moderate.support)}/${perf.per_class.moderate.support} moderate detected`} alert={perf.per_class.moderate.recall < 0.2} />
        </div>
      </div>

      {/* Kappa Health Meter with Narrative */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          Kappa Interpretation (Landis/Koch Scale)
          <InfoTooltip {...TOOLTIP.cohensKappa} />
        </h3>
        <KappaHealthMeter value={perf.loo_kappa} />
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
            {perf.kappa_interpretation.narrative}
          </p>
        </div>
      </div>

      {/* Per-Class Metrics */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Per-Class Performance</h3>
        <PerClassTable perClass={perf.per_class as Record<string, PerClassMetrics>} />
      </div>

      {/* Performance Plateau */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2">Performance Plateau (DR-003)</h3>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div><span className="text-xs text-amber-600 dark:text-amber-400">Previous n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{perf.performance_plateau.previous_n}</div></div>
          <div><span className="text-xs text-amber-600 dark:text-amber-400">Current n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{perf.performance_plateau.current_n}</div></div>
          <div><span className="text-xs text-amber-600 dark:text-amber-400">Delta</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">0.000</div></div>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-300">{perf.performance_plateau.interpretation}</p>
      </div>

      {/* Training Data Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Training Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Sites" value={String(data.total_sites)} />
          <MetricCard label="Stations" value={data.dataset_counts.stations.toLocaleString()} />
          <MetricCard label="Co-located" value={String(data.dataset_counts.co_located)} subtitle="BDeu target: 50" />
          <MetricCard label="Full Triads" value={`${data.dataset_counts.full_triads_effective}`} subtitle={`${data.dataset_counts.full_triads_native} raw + 8 Level C merged`} />
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1">
          <InfoTooltip {...TOOLTIP.triadReconciliation} />
          <span>Co-located: chemistry + toxicity at same event. Full triad: + community data. See triad reconciliation note.</span>
        </div>

        {/* Site Breakdown Table */}
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Site</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">ID</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Triads</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Co-located</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Stations</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Type</th>
            </tr>
          </thead>
          <tbody>
            {siteRows.map((site) => (
              <tr key={site.registry_id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{site.name}</td>
                <td className="py-2 text-slate-500 dark:text-slate-400">{site.registry_id}</td>
                <td className="text-right py-2 text-slate-600 dark:text-slate-400">
                  {site.triads_effective}
                  {site.triads !== site.triads_effective && (
                    <span className="text-xs text-amber-500 ml-1">({site.triads}+DR-002)</span>
                  )}
                </td>
                <td className="text-right py-2 text-slate-600 dark:text-slate-400">{site.co_located}</td>
                <td className="text-right py-2 text-slate-600 dark:text-slate-400">{site.total_stations}</td>
                <td className="py-2">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${site.waterbody === 'marine' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                    {site.waterbody}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Architecture Tiers */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          DAG Architecture (5 Tiers)
          <InfoTooltip {...TOOLTIP.dagArchitectureTiers} />
        </h3>
        <div className="space-y-3">
          {overview.architecture.tiers.map((tier) => (
            <div key={tier.tier} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                T{tier.tier}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-700 dark:text-slate-200">{tier.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{tier.description}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">CPT: {tier.cpt_method} &middot; {tier.nodes.length} nodes</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Intended Use */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Intended Use</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{overview.intended_use.primary}</p>
        <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Not suitable for:</div>
        <ul className="space-y-1">
          {overview.intended_use.not_suitable_for.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="text-red-400 mt-0.5">&#x2717;</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Export Metadata */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        Export: {overview._meta.export_date} &middot; DB hash: {overview._meta.db_hash.slice(0, 12)}... &middot; Model Card v{overview._meta.model_version} &middot; Handoff v{overview._meta.handoff_version}
      </div>
    </div>
  );
}
