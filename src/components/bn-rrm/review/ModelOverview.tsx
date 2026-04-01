'use client';

// useMemo removed — siteRows computed inline
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeModelOverview } from '@/lib/bn-rrm/normalize-artifacts';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';
import { usePackStore } from '@/stores/bn-rrm/packStore';

type PerClassMetrics = {
  precision: number;
  recall: number;
  f1: number;
  support: number;
};



function KappaHealthMeter({ value, kappaScale }: { value: number; kappaScale: { range: [number, number]; label: string; color: string }[] }) {
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
  const { data: rawData, loading, error } = usePackArtifact<any>('model_overview');
  const packManifest = usePackStore((s) => s.packManifest);

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

  const data = rawData ? normalizeModelOverview(rawData) : null;

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    );
  }

  const perf = data.performance;
  const kappaScale = perf.kappa_interpretation?.scale ?? [];
  const siteRows = data.training.site_breakdown;
  const summaryAccuracy = packManifest?.evaluation_profile?.loo_accuracy ?? perf.accuracy;
  const summaryKappa = packManifest?.evaluation_profile?.loo_kappa ?? perf.kappa;
  const metricContextNote = typeof rawData?._meta?.metric_note === 'string' ? rawData._meta.metric_note : '';
  const metricMismatch =
    ((packManifest?.evaluation_profile?.loo_accuracy != null && perf.accuracy != null &&
      Math.abs(packManifest.evaluation_profile.loo_accuracy - perf.accuracy) > 0.0001) ||
    (packManifest?.evaluation_profile?.loo_kappa != null && perf.kappa != null &&
      Math.abs(packManifest.evaluation_profile.loo_kappa - perf.kappa) > 0.0001));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Model Overview</h2>
          {data.meta.dataset_status && (
          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-full">
            {data.meta.dataset_status}
          </span>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {data.identity.framework} &mdash; {data.identity.nodes} nodes, {data.identity.edges} edges, {data.identity.states_per_node} states/node
        </p>
      </div>

      {/* Performance Summary Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          LOO Cross-Validation{perf.n_complete != null ? ` (n=${perf.n_complete})` : ''}
          <InfoTooltip {...TOOLTIP.looCrossValidation} />
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Accuracy" value={summaryAccuracy != null ? `${(summaryAccuracy * 100).toFixed(1)}%` : '\u2014'} subtitle="Current pack summary" />
          <MetricCard label="Kappa" value={summaryKappa != null ? summaryKappa.toFixed(3) : '\u2014'} subtitle="Current pack summary" alert />
          <MetricCard label="High Recall" value={perf.per_class?.high?.recall != null ? `${(perf.per_class.high.recall * 100).toFixed(1)}%` : '\u2014'} subtitle="High-risk detection rate" />
          <MetricCard label="Moderate Recall" value={perf.per_class?.moderate?.recall != null ? `${(perf.per_class.moderate.recall * 100).toFixed(1)}%` : '\u2014'} subtitle="Moderate-risk detection rate" alert={perf.per_class?.moderate?.recall != null && perf.per_class.moderate.recall < 0.2} />
        </div>
        {(metricMismatch || metricContextNote) && (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
            {metricContextNote || 'The headline accuracy and kappa above use the current pack manifest. The detailed narrative below is retained historical benchmark context from an earlier lineage artifact.'}
          </div>
        )}
      </div>

      {/* v1.0 Canonical Baseline */}
      {!!data.publication_baseline && (() => {
        const pub = data.publication_baseline as {
          evaluation_set: string;
          loo_entropy_rule: { accuracy: number; kappa: number; low_recall: number; moderate_recall: number; high_recall: number };
          loo_map_comparator: { accuracy: number; kappa: number; low_recall: number; moderate_recall: number; high_recall: number };
        };
        return (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
              v1.0 Canonical Baseline
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              v1.0 canonical development line, under active review. v0.4.1 is the legacy baseline.
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Evaluation: {pub.evaluation_set}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">Entropy Rule (adopted)</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>Accuracy</span><span className="font-mono">{(pub.loo_entropy_rule.accuracy * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Kappa</span><span className="font-mono">{pub.loo_entropy_rule.kappa.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Low recall (n=19)</span><span className="font-mono">{(pub.loo_entropy_rule.low_recall * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Moderate recall (n=12)</span><span className="font-mono font-bold">{(pub.loo_entropy_rule.moderate_recall * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>High recall (n=2)</span><span className="font-mono">{(pub.loo_entropy_rule.high_recall * 100).toFixed(1)}%</span></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">MAP (comparator)</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>Accuracy</span><span className="font-mono">{(pub.loo_map_comparator.accuracy * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Kappa</span><span className="font-mono">{pub.loo_map_comparator.kappa.toFixed(3)}</span></div>
                  <div className="flex justify-between"><span>Low recall (n=19)</span><span className="font-mono">{(pub.loo_map_comparator.low_recall * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>Moderate recall (n=12)</span><span className="font-mono">{(pub.loo_map_comparator.moderate_recall * 100).toFixed(1)}%</span></div>
                  <div className="flex justify-between"><span>High recall (n=2)</span><span className="font-mono">{(pub.loo_map_comparator.high_recall * 100).toFixed(1)}%</span></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              High support = 2 stations (not statistically meaningful). v0.4.1 comparison uses different evaluation set (82 vs 33 stations) — not directly comparable.
            </p>
          </div>
        );
      })()}

      {/* Kappa Health Meter with Narrative */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          Kappa Interpretation (Landis/Koch Scale)
          <InfoTooltip {...TOOLTIP.cohensKappa} />
        </h3>
        {perf.kappa != null && <KappaHealthMeter value={perf.kappa} kappaScale={kappaScale} />}
        {perf.kappa_interpretation?.narrative && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {perf.kappa_interpretation.narrative}
            </p>
          </div>
        )}
      </div>

      {/* Per-Class Metrics */}
      {perf.per_class && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Per-Class Performance</h3>
          <PerClassTable perClass={perf.per_class as Record<string, PerClassMetrics>} />
        </div>
      )}

      {/* Performance Plateau */}
      {perf.performance_plateau && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2">Performance Plateau (DR-003)</h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Previous n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{perf.performance_plateau.previous_n}</div></div>
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Current n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{perf.performance_plateau.current_n}</div></div>
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Delta</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">0.000</div></div>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">{perf.performance_plateau.interpretation}</p>
        </div>
      )}

      {/* Training Data Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Training Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Sites" value={String(data.training.total_sites ?? '\u2014')} />
          <MetricCard label="Stations" value={data.training.dataset_counts?.stations != null ? data.training.dataset_counts.stations.toLocaleString() : '\u2014'} />
          <MetricCard label="Co-located" value={String(data.training.dataset_counts?.co_located ?? '\u2014')} subtitle="BDeu target: 50" />
          <MetricCard label="Full Triads" value={`${data.training.dataset_counts?.full_triads_effective ?? '\u2014'}`} subtitle={`${data.training.dataset_counts?.full_triads_native ?? '?'} raw + 8 Level C merged`} />
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
            {siteRows.map((site: any) => (
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
      {data.architecture?.tiers && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          DAG Architecture (5 Tiers)
          <InfoTooltip {...TOOLTIP.dagArchitectureTiers} />
        </h3>
        <div className="space-y-3">
          {data.architecture.tiers.map((tier: any) => (
            <div key={tier.tier} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 shrink-0">
                T{tier.tier}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-700 dark:text-slate-200">{tier.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{tier.description}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">CPT: {tier.cpt_method} &middot; {tier.nodes?.length ?? 0} nodes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Intended Use */}
      {data.intended_use && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Intended Use</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{data.intended_use.primary}</p>
        {data.intended_use.not_suitable_for.length > 0 && (
        <>
        <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Not suitable for:</div>
        <ul className="space-y-1">
          {data.intended_use.not_suitable_for.map((item: any, i: number) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="text-red-400 mt-0.5">&#x2717;</span>
              {item}
            </li>
          ))}
        </ul>
        </>
        )}
      </div>
      )}

      {/* Export Metadata */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        Export: {data.meta.export_date} &middot; DB hash: {data.meta.db_hash.slice(0, 12)}... &middot; Release v{data.meta.model_version} &middot; Handoff v{data.meta.handoff_version}
      </div>
    </div>
  );
}
