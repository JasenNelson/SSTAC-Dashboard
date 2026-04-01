'use client';

import { useEffect, useState } from 'react';
// useMemo removed - siteRows computed inline
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeModelOverview, type NormalizedModelOverview } from '@/lib/bn-rrm/normalize-artifacts';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';
import { usePackStore } from '@/stores/bn-rrm/packStore';

type PerClassMetrics = {
  precision: number;
  recall: number;
  f1: number;
  support: number;
};

type SiteStation = {
  station_id: number;
  name: string;
  type: string;
};

type MarginalHighlight = {
  node: string;
  states: Record<string, number>;
};

function EmptyStateNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function formatSignedDelta(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}`;
}



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

function formatClassMetric(metric: number, support: number) {
  if (support === 0 && metric === 0) {
    return 'No support';
  }

  return metric.toFixed(3);
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
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{formatClassMetric(m.precision, m.support)}</td>
            <td className={`text-right py-2 ${m.support > 0 && m.recall === 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>{formatClassMetric(m.recall, m.support)}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{formatClassMetric(m.f1 ?? 0, m.support)}</td>
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
  const [inheritedOverview, setInheritedOverview] = useState<NormalizedModelOverview | null>(null);

  const parentPackId = packManifest?.parent_pack_id ?? rawData?.model_identity?.parent_model ?? null;
  const rawScope = rawData?._meta?.scope ?? packManifest?.scope_type ?? null;

  useEffect(() => {
    let cancelled = false;

    if (rawScope !== 'site_specific' || !parentPackId) {
      setInheritedOverview(null);
      return () => {
        cancelled = true;
      };
    }

    fetch(`/bn-rrm/packs/${parentPackId}/review/model-overview.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load parent overview: ${res.status}`);
        }

        return res.json();
      })
      .then((parentRaw) => {
        if (!cancelled) {
          setInheritedOverview(normalizeModelOverview(parentRaw));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInheritedOverview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [parentPackId, rawScope]);

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
  const inheritedArchitecture = data.architecture ?? inheritedOverview?.architecture ?? null;
  const inheritedIntendedUse = data.intended_use ?? inheritedOverview?.intended_use ?? null;
  const inheritedPublicationBaseline = data.publication_baseline ?? inheritedOverview?.publication_baseline ?? null;
  const inheritedPerformancePlateau = perf.performance_plateau ?? inheritedOverview?.performance.performance_plateau ?? null;
  const kappaScale = perf.kappa_interpretation?.scale ?? inheritedOverview?.performance.kappa_interpretation?.scale ?? [];
  const siteRows = data.training.site_breakdown;
  const isSiteSpecific = data.meta.scope === 'site_specific' || packManifest?.scope_type === 'site_specific';
  const stationRows = data.training.stations;
  const marginalHighlights = data.marginal_highlights;
  const summaryAccuracy = packManifest?.evaluation_profile?.loo_accuracy ?? perf.accuracy;
  const summaryKappa = packManifest?.evaluation_profile?.loo_kappa ?? perf.kappa;
  const metricContextNote = typeof rawData?._meta?.metric_note === 'string' ? rawData._meta.metric_note : '';
  const metricMismatch =
    ((packManifest?.evaluation_profile?.loo_accuracy != null && perf.accuracy != null &&
      Math.abs(packManifest.evaluation_profile.loo_accuracy - perf.accuracy) > 0.0001) ||
    (packManifest?.evaluation_profile?.loo_kappa != null && perf.kappa != null &&
      Math.abs(packManifest.evaluation_profile.loo_kappa - perf.kappa) > 0.0001));
  const performanceHeading = perf.type === 'diagnostic_replay' ? 'Diagnostic Replay' : 'LOO Cross-Validation';
  const unavailableSections = isSiteSpecific
    ? [
        !perf.kappa_interpretation ? 'This site-pack artifact does not include a site-specific kappa interpretation narrative.' : null,
        !inheritedPublicationBaseline ? 'Canonical baseline comparison is not included in the site artifact or inherited parent overview.' : null,
        !inheritedPerformancePlateau ? 'Historical performance plateau lineage is not included in the site artifact or inherited parent overview.' : null,
        !inheritedArchitecture?.tiers?.length ? 'DAG architecture tiers are not included in the site artifact or inherited parent overview.' : null,
        !inheritedIntendedUse ? 'Intended-use context is not included in the site artifact or inherited parent overview.' : null,
      ].filter((item): item is string => Boolean(item))
    : [];
  const trainingStations = data.training.dataset_counts?.stations ?? data.training.n_stations;
  const trainingCoLocated = data.training.dataset_counts?.co_located ?? null;
  const fullTriadsEffective = data.training.dataset_counts?.full_triads_effective;
  const fullTriadsNative = data.training.dataset_counts?.full_triads_native;
  const architectureIsInherited = !data.architecture && !!inheritedOverview?.architecture;
  const intendedUseIsInherited = !data.intended_use && !!inheritedOverview?.intended_use;
  const publicationBaselineIsInherited = !data.publication_baseline && !!inheritedOverview?.publication_baseline;
  const performancePlateauIsInherited = !perf.performance_plateau && !!inheritedOverview?.performance.performance_plateau;

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
        {isSiteSpecific && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Site scope: {data.training.site_name || data.identity.name} ({data.training.registry_id || data.meta.site_registry_id || 'site ID unavailable'})
            {data.training.waterbody ? ` | ${data.training.waterbody}` : ''}
          </p>
        )}
      </div>

      {/* Performance Summary Cards */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          {performanceHeading}{perf.n_complete != null ? ` (n=${perf.n_complete})` : ''}
          <InfoTooltip {...TOOLTIP.looCrossValidation} />
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Accuracy" value={summaryAccuracy != null ? `${(summaryAccuracy * 100).toFixed(1)}%` : '\u2014'} subtitle={perf.type === 'diagnostic_replay' ? 'Diagnostic replay summary' : 'Current pack summary'} />
          <MetricCard label="Kappa" value={summaryKappa != null ? summaryKappa.toFixed(3) : '\u2014'} subtitle={perf.type === 'diagnostic_replay' ? 'Diagnostic replay summary' : 'Current pack summary'} alert={summaryKappa != null && summaryKappa < 0} />
          <MetricCard label="High Recall" value={perf.per_class?.high?.recall != null ? `${(perf.per_class.high.recall * 100).toFixed(1)}%` : '\u2014'} subtitle="High-risk detection rate" />
          <MetricCard label="Moderate Recall" value={perf.per_class?.moderate?.recall != null ? `${(perf.per_class.moderate.recall * 100).toFixed(1)}%` : '\u2014'} subtitle="Moderate-risk detection rate" alert={perf.per_class?.moderate?.recall != null && perf.per_class.moderate.recall < 0.2} />
        </div>
        {perf.disclaimer && (
          <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-800 dark:text-blue-200">
            {perf.disclaimer}
          </div>
        )}
        {(metricMismatch || metricContextNote) && (
          <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200">
            {metricContextNote || 'The headline accuracy and kappa above use the current pack manifest. The detailed narrative below is retained historical benchmark context from an earlier lineage artifact.'}
          </div>
        )}
      </div>

      {/* v1.0 Canonical Baseline */}
      {!!inheritedPublicationBaseline && (() => {
        const pub = inheritedPublicationBaseline as {
          evaluation_set: string;
          loo_entropy_rule: { accuracy: number; kappa: number; low_recall: number; moderate_recall: number; high_recall: number };
          loo_map_comparator: { accuracy: number; kappa: number; low_recall: number; moderate_recall: number; high_recall: number };
        };
        return (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-2">
              v1.0 Canonical Baseline
              {publicationBaselineIsInherited && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-800/50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                  Shared/inherited context from parent general model
                </span>
              )}
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
              High support = 2 stations (not statistically meaningful). v0.4.1 comparison uses different evaluation set (82 vs 33 stations) - not directly comparable.
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
        {summaryKappa != null && kappaScale.length > 0 && <KappaHealthMeter value={summaryKappa} kappaScale={kappaScale} />}
        {perf.kappa_interpretation?.narrative && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
              {perf.kappa_interpretation.narrative}
            </p>
          </div>
        )}
        {!perf.kappa_interpretation && (
          <EmptyStateNotice
            title="No pack-specific kappa interpretation"
            message={perf.type === 'diagnostic_replay'
              ? 'This site-specific artifact reports diagnostic replay metrics but does not include a separate Landis/Koch narrative or scale block.'
              : 'This artifact does not include a separate kappa interpretation block.'}
          />
        )}
      </div>

      {/* Per-Class Metrics */}
      {perf.per_class && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Per-Class Performance</h3>
          {isSiteSpecific && perf.type === 'diagnostic_replay' && (
            <div className="mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs text-slate-600 dark:text-slate-300">
              Site-pack diagnostic replay can yield many zero or blank-looking class metrics because the evaluation set is tiny or concentrated in a single class. When support is 0, metrics are shown as <span className="font-semibold">No support</span> rather than implying model failure.
            </div>
          )}
          <PerClassTable perClass={perf.per_class as Record<string, PerClassMetrics>} />
        </div>
      )}

      {/* Performance Plateau */}
      {inheritedPerformancePlateau && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2 flex items-center gap-2">
            Performance Plateau (DR-003)
            {performancePlateauIsInherited && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-800/50 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
                Shared/inherited context from parent general model
              </span>
            )}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-3">
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Previous n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{inheritedPerformancePlateau.previous_n}</div></div>
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Current n</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">{inheritedPerformancePlateau.current_n}</div></div>
            <div><span className="text-xs text-amber-600 dark:text-amber-400">Delta</span><div className="text-lg font-bold text-amber-800 dark:text-amber-100">0.000</div></div>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300">{inheritedPerformancePlateau.interpretation}</p>
        </div>
      )}

      {/* Training Data Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Training Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MetricCard label="Sites" value={String(data.training.total_sites ?? '\u2014')} />
          <MetricCard label="Stations" value={trainingStations != null ? trainingStations.toLocaleString() : '\u2014'} />
          <MetricCard label="Co-located" value={String(trainingCoLocated ?? '\u2014')} subtitle={isSiteSpecific ? 'Within selected site pack' : 'BDeu target: 50'} />
          {fullTriadsEffective != null ? (
            <MetricCard label="Full Triads" value={`${fullTriadsEffective}`} subtitle={`${fullTriadsNative ?? '?'} raw + 8 Level C merged`} />
          ) : (
            <MetricCard label="Waterbody" value={data.training.waterbody || '\u2014'} subtitle={isSiteSpecific ? 'Selected site pack' : undefined} />
          )}
        </div>
        {fullTriadsEffective != null && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-1">
            <InfoTooltip {...TOOLTIP.triadReconciliation} />
            <span>Co-located: chemistry + toxicity at same event. Full triad: + community data. See triad reconciliation note.</span>
          </div>
        )}

        {isSiteSpecific && stationRows.length > 0 ? (
          <table className="w-full text-sm mt-4">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
                <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">ID</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Type</th>
              </tr>
            </thead>
            <tbody>
              {stationRows.map((station: SiteStation) => (
                <tr key={station.station_id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{station.name}</td>
                  <td className="py-2 text-right text-slate-500 dark:text-slate-400">{station.station_id}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-400">{station.type || '\u2014'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
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
                    {site.triads_effective ?? '\u2014'}
                    {site.triads != null && site.triads_effective != null && site.triads !== site.triads_effective && (
                      <span className="text-xs text-amber-500 ml-1">({site.triads}+DR-002)</span>
                    )}
                  </td>
                  <td className="text-right py-2 text-slate-600 dark:text-slate-400">{site.co_located ?? '\u2014'}</td>
                  <td className="text-right py-2 text-slate-600 dark:text-slate-400">{site.total_stations ?? '\u2014'}</td>
                  <td className="py-2">
                    <span className={`px-1.5 py-0.5 text-xs rounded ${site.waterbody === 'marine' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'}`}>
                      {site.waterbody ?? '\u2014'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Site-Specific Applicability */}
      {isSiteSpecific && (data.anti_overclaim || data.limitations.length > 0) && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Site-Specific Applicability</h3>
          {data.anti_overclaim && (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{data.anti_overclaim}</p>
          )}
          {data.limitations.length > 0 && (
            <div className="space-y-2">
              {data.limitations.map((item, index) => (
                <div key={`${index}-${item}`} className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Site-Specific Marginal Highlights */}
      {isSiteSpecific && marginalHighlights.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Site-Specific Marginal Highlights</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            This site pack provides node-level marginal highlight deltas. Values are shown exactly as provided by the artifact.
          </p>
          <div className="space-y-3">
            {marginalHighlights.map((highlight: MarginalHighlight) => {
              const stateEntries = Object.entries(highlight.states);
              const maxDelta = stateEntries.reduce((best, [, value]) => Math.max(best, value), Number.NEGATIVE_INFINITY);

              return (
                <div key={highlight.node} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{highlight.node}</div>
                  <div className="flex flex-wrap gap-2">
                    {stateEntries.map(([state, value]) => (
                      <span
                        key={state}
                        className={`rounded-full px-2.5 py-1 text-xs font-mono ${
                          value === maxDelta
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {state}: {formatSignedDelta(value)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Architecture Tiers */}
      {inheritedArchitecture?.tiers && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          DAG Architecture (5 Tiers)
          <InfoTooltip {...TOOLTIP.dagArchitectureTiers} />
          {architectureIsInherited && (
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
              Shared/inherited context from parent general model
            </span>
          )}
        </h3>
        <div className="space-y-3">
          {inheritedArchitecture.tiers.map((tier: any) => (
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
      {inheritedIntendedUse && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
          Intended Use
          {intendedUseIsInherited && (
            <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal">
              Shared/inherited context from parent general model
            </span>
          )}
        </h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{inheritedIntendedUse.primary}</p>
        {inheritedIntendedUse.not_suitable_for.length > 0 && (
        <>
        <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Not suitable for:</div>
        <ul className="space-y-1">
          {inheritedIntendedUse.not_suitable_for.map((item: any, i: number) => (
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

      {/* Site-Pack Unavailable Sections */}
      {unavailableSections.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Not Included In This Site Pack</h3>
          <div className="space-y-3">
            {unavailableSections.map((message) => (
              <EmptyStateNotice key={message} title="Unavailable in current artifact" message={message} />
            ))}
          </div>
        </div>
      )}

      {/* Export Metadata */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        Export: {data.meta.export_date} &middot; DB hash: {data.meta.db_hash.slice(0, 12)}... &middot; Release v{data.meta.model_version} &middot; Handoff v{data.meta.handoff_version}
      </div>
    </div>
  );
}
