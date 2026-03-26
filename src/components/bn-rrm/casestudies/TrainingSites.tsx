'use client';

import { useState, useMemo } from 'react';
import comparisonDataRaw from '@/data/bn-rrm/transparency/risk_comparison.json';
import siteReportsRaw from '@/data/bn-rrm/transparency/site_reports.json';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { cn } from '@/utils/cn';

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

type ComparisonData = typeof comparisonDataRaw;
type SiteReportsData = typeof siteReportsRaw;

const ALL_TRAINING_SITES = [
  { registryId: '9930', name: 'Woodfibre', waterbody: 'marine' },
  { registryId: '0311', name: 'CP Nelson', waterbody: 'freshwater' },
  { registryId: '4205', name: 'Island Copper', waterbody: 'marine' },
  { registryId: '15125', name: 'Blue Water', waterbody: 'marine' },
  { registryId: '3130', name: 'IOCO', waterbody: 'marine' },
  { registryId: '15184', name: 'Toquaht', waterbody: 'marine' },
  { registryId: '0331', name: 'ALCAN', waterbody: 'marine' },
  { registryId: '16029', name: 'Brunette River', waterbody: 'freshwater' },
];

export function TrainingSites() {
  const data = comparisonDataRaw as ComparisonData;
  const siteReports = siteReportsRaw as SiteReportsData;
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const sitesWithWOE = useMemo(() => {
    return new Set(data.siteComparisons.map((s) => s.registryId));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Training Sites</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Descriptive comparison of BN-RRM LOO predictions with report-stated WOE classifications
          for the 8 sites used in model training.
        </p>
      </div>

      {/* Scope note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Comparison scope.</strong> WOE classifications are available for 5 of 8 training
          sites ({data.summary.matchedStations} matched stations). The remaining 3 sites
          ({data.summary.sitesWithoutWOENames.join(', ')}) have no WOE records in the
          database. WOE labels are report-stated classifications extracted from consultant ERA
          documents — they are external reference labels, not BN training targets.
        </p>
      </div>

      {/* Site cards */}
      <div className="grid grid-cols-1 gap-3">
        {ALL_TRAINING_SITES.map((site) => {
          const hasWOE = sitesWithWOE.has(site.registryId);
          const compSite = data.siteComparisons.find((s) => s.registryId === site.registryId);
          const siteReport = (siteReports as SiteReportsData).sites?.find(
            (s: { registry_id: string }) => s.registry_id === site.registryId
          );
          const isSelected = selectedSiteId === site.registryId;

          const matched = compSite?.stationComparisons.filter((s) => s.bnrrmPredicted).length ?? 0;
          const excluded = compSite ? compSite.stationComparisons.length - matched : 0;

          return (
            <div
              key={site.registryId}
              className={cn(
                'rounded-xl border-2 transition-all',
                isSelected
                  ? 'border-blue-500 dark:border-blue-400'
                  : 'border-slate-200 dark:border-slate-700',
                hasWOE ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800/50'
              )}
            >
              {/* Card header */}
              <button
                onClick={() => setSelectedSiteId(isSelected ? null : site.registryId)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2 py-0.5 text-xs rounded font-mono',
                    site.waterbody === 'marine'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  )}>
                    {site.registryId}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-100">{site.name}</span>
                  {!hasWOE && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">No WOE data</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  {hasWOE && (
                    <span>{matched} matched, {excluded} excluded</span>
                  )}
                  <svg className={cn('w-4 h-4 transition-transform', isSelected && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Expanded detail */}
              {isSelected && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
                  {hasWOE && compSite ? (
                    <>
                      {/* Source document */}
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <strong>WOE source:</strong>{' '}
                        {compSite.stationComparisons[0]?.reportEstimate.provenance.sourceDocument}
                      </div>

                      {/* Distribution comparison */}
                      <ExpandableSection title="Distribution Comparison" defaultOpen>
                        <SiteDistributionComparison site={compSite} />
                      </ExpandableSection>

                      {/* Station detail */}
                      <ExpandableSection title={`Station Detail (${compSite.stationComparisons.length} records)`}>
                        <SiteStationTable site={compSite} />
                      </ExpandableSection>

                      {/* Data quality notes */}
                      <div className="text-xs text-slate-400 dark:text-slate-500 space-y-1">
                        {excluded > 0 && (
                          <p>{excluded} station(s) excluded: WOE record present but no LOO prediction
                            (Level C rejected or non-LOO-eligible).</p>
                        )}
                        <p>Framework: {compSite.stationComparisons[0]?.reportEstimate.frameworkType}</p>
                        <p>Mapping basis: {data.mappingTable.source}</p>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <p>
                        No WOE integration records exist for this site in the BN-RRM training
                        database. This site contributed to model training through chemistry,
                        toxicity, and/or community data, but the consultant ERA report either
                        did not include a WOE assessment or the WOE conclusions have not yet
                        been extracted.
                      </p>
                      {siteReport && (
                        <p className="mt-2">
                          Station count: {siteReport.station_count} &middot;
                          Waterbody: {siteReport.waterbody_type}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
        <p>Model: {data._meta.modelVersion} &middot; Governance: {data._meta.governanceSpec}</p>
        <p className="italic mt-1">{data._meta.note}</p>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SiteDistributionComparison({ site }: { site: ComparisonData['siteComparisons'][0] }) {
  const matched = site.stationComparisons.filter((s) => s.bnrrmPredicted && s.reportEstimate.mappedBNClass);

  const bnDist = { low: 0, moderate: 0, high: 0 };
  const woeDist = { low: 0, moderate: 0, high: 0 };

  for (const sc of matched) {
    const bn = sc.bnrrmPredicted as keyof typeof bnDist;
    const woe = sc.reportEstimate.mappedBNClass as keyof typeof woeDist;
    if (bn in bnDist) bnDist[bn]++;
    if (woe in woeDist) woeDist[woe]++;
  }

  const n = matched.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 mb-1">
        <InfoTooltip
          title="Aggregated Comparison Summary"
          description={`Distribution of classifications across ${n} matched stations at this site. This is an aggregated comparison view, not a site-level risk determination. Each bar shows the count of stations classified at each level by the respective method.`}
        />
        <span className="text-xs text-slate-400 dark:text-slate-500">n = {n} matched stations</span>
      </div>

      <DistributionRow label="BN-RRM (LOO MAP)" dist={bnDist} n={n} />
      <DistributionRow label="WOE (mapped)" dist={woeDist} n={n} />
    </div>
  );
}

function DistributionRow({ label, dist, n }: { label: string; dist: Record<string, number>; n: number }) {
  const colors = { low: 'bg-green-400', moderate: 'bg-amber-400', high: 'bg-red-400' };

  return (
    <div>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</div>
      <div className="flex h-6 rounded-full overflow-hidden">
        {(['low', 'moderate', 'high'] as const).map((cls) => {
          const pct = n > 0 ? (dist[cls] / n) * 100 : 0;
          return (
            <div
              key={cls}
              className={cn('flex items-center justify-center', colors[cls])}
              style={{ width: `${Math.max(pct, pct > 0 ? 8 : 0)}%` }}
            >
              {pct >= 12 && (
                <span className="text-[10px] font-bold text-white">{dist[cls]}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>Low: {dist.low}</span>
        <span>Mod: {dist.moderate}</span>
        <span>High: {dist.high}</span>
      </div>
    </div>
  );
}

function SiteStationTable({ site }: { site: ComparisonData['siteComparisons'][0] }) {
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white dark:bg-slate-800">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Station</th>
            <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">BN-RRM</th>
            <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">WOE (original)</th>
            <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">WOE (mapped)</th>
            <th className="text-center py-1.5 font-medium text-slate-500 dark:text-slate-400">Match</th>
            <th className="text-right py-1.5 font-medium text-slate-500 dark:text-slate-400">Page</th>
          </tr>
        </thead>
        <tbody>
          {site.stationComparisons.map((sc) => {
            const mapped = sc.reportEstimate.mappedBNClass;
            const match = sc.bnrrmPredicted && mapped ? sc.bnrrmPredicted === mapped : null;
            return (
              <tr key={sc.stationId} className={cn('border-b border-slate-100 dark:border-slate-800', !sc.bnrrmPredicted && 'opacity-50')}>
                <td className="py-1.5 font-mono text-slate-700 dark:text-slate-300">{sc.stationName}</td>
                <td className="py-1.5">
                  {sc.bnrrmPredicted ? (
                    <span className={cn('px-1 py-0.5 rounded capitalize', CLASS_COLORS[sc.bnrrmPredicted]?.bg, CLASS_COLORS[sc.bnrrmPredicted]?.text)}>
                      {sc.bnrrmPredicted}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">excluded</span>
                  )}
                </td>
                <td className="py-1.5 text-slate-500 dark:text-slate-400">{sc.reportEstimate.originalLabel}</td>
                <td className="py-1.5">
                  {mapped && (
                    <span className={cn('px-1 py-0.5 rounded capitalize', CLASS_COLORS[mapped]?.bg, CLASS_COLORS[mapped]?.text)}>
                      {mapped}
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-center">
                  {match === true && <span className="text-green-600 dark:text-green-400 font-bold">&#x2713;</span>}
                  {match === false && <span className="text-red-500 dark:text-red-400 font-bold">&#x2717;</span>}
                  {match === null && <span className="text-slate-300">—</span>}
                </td>
                <td className="py-1.5 text-right text-slate-400">{sc.reportEstimate.provenance.sourcePage ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
