'use client';

import { useMemo, useState } from 'react';
import comparisonDataRaw from '@/data/bn-rrm/transparency/risk_comparison.json';
import { computeComparisonReport } from '@/lib/bn-rrm/comparison-stats';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';
import { cn } from '@/utils/cn';

const CLASSES = ['low', 'moderate', 'high'] as const;

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

type StationComparison = {
  stationId: number;
  stationName: string;
  bnrrmPredicted: string | null;
  bnrrmObserved: string | null;
  reportEstimate: {
    originalLabel: string;
    mappedBNClass: string | null;
    mappingConfidence: string;
    mappingJustification: string;
    comparatorType: string;
    frameworkType: string;
    provenance: {
      sourceDocument: string;
      sourcePage: number | null;
    };
  };
};

type SiteComparison = {
  siteId: number;
  siteName: string;
  registryId: string;
  stationComparisons: StationComparison[];
  excludedStations: {
    noLOOPrediction: string[];
    noWOERecord: string[];
  };
};

type ComparisonData = {
  _meta: { governanceSpec: string; modelVersion: string; note: string };
  summary: {
    matchedStations: number;
    excludedNoLOO: number;
    excludedNoWOE: number;
    sitesWithWOE: number;
    sitesWithoutWOE: number;
    sitesWithoutWOENames: string[];
  };
  mappingTable: {
    source: string;
    mappings: Record<string, { mapped: string; confidence: string; justification: string }>;
  };
  siteComparisons: SiteComparison[];
};

export function RiskComparison() {
  const data = comparisonDataRaw as unknown as ComparisonData;
  const [selectedSite, setSelectedSite] = useState<number | null>(null);
  const [showExclusions, setShowExclusions] = useState(false);

  // Extract matched pairs
  const { pairs, bnrrm, woe } = useMemo(() => {
    const p: [string, string][] = [];
    const bn: string[] = [];
    const w: string[] = [];

    for (const site of data.siteComparisons) {
      for (const sc of site.stationComparisons) {
        if (sc.bnrrmPredicted && sc.reportEstimate.mappedBNClass) {
          p.push([sc.bnrrmPredicted, sc.reportEstimate.mappedBNClass]);
          bn.push(sc.bnrrmPredicted);
          w.push(sc.reportEstimate.mappedBNClass);
        }
      }
    }

    return { pairs: p, bnrrm: bn, woe: w };
  }, [data]);

  // Compute agreement report
  const report = useMemo(() => {
    if (pairs.length === 0) return null;
    return computeComparisonReport(
      bnrrm,
      woe,
      data.summary.excludedNoLOO,
      data.summary.excludedNoWOE,
      true
    );
  }, [pairs, bnrrm, woe, data.summary]);

  if (!report) {
    return <div className="text-slate-400 p-8 text-center">No matched comparison data available.</div>;
  }

  const selectedSiteData = selectedSite !== null
    ? data.siteComparisons.find((s) => s.siteId === selectedSite)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
          Risk Comparison
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          BN-RRM posterior MAP predictions compared with report-stated WOE classifications
        </p>
      </div>

      {/* Methodology disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Inter-method comparison.</strong> This section compares BN-RRM LOO predictions
          (MAP state of the ecological_risk posterior) with report-stated WOE risk classifications
          mapped to the BN 3-class space. These are different assessment methods — agreement metrics
          measure consistency between methods, not accuracy against ground truth.
          The {data._meta.modelVersion} model was not trained on WOE labels.
        </p>
        <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
          Governance: {data._meta.governanceSpec} &middot;
          n = {report.n} matched stations across {data.summary.sitesWithWOE} sites &middot;
          {report.nExcludedNoLOO} excluded (WOE but no LOO) &middot;
          {report.nExcludedNoWOE} excluded (LOO but no WOE)
        </p>
      </div>

      {/* Agreement summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Weighted Kappa"
          value={report.weightedKappa.point.toFixed(3)}
          subtitle={`95% CI: [${report.weightedKappa.lower.toFixed(3)}, ${report.weightedKappa.upper.toFixed(3)}]`}
          tooltip={TOOLTIP.comparisonWeightedKappa.description}
        />
        <MetricCard
          label="Unweighted Kappa"
          value={report.unweightedKappa.point.toFixed(3)}
          subtitle={`95% CI: [${report.unweightedKappa.lower.toFixed(3)}, ${report.unweightedKappa.upper.toFixed(3)}]`}
          tooltip={TOOLTIP.comparisonUnweightedKappa.description}
        />
        <MetricCard
          label="Agreement"
          value={`${(report.overallAgreement * 100).toFixed(1)}%`}
          subtitle={`${Math.round(report.overallAgreement * report.n)}/${report.n} stations`}
          tooltip={TOOLTIP.comparisonAgreement.description}
        />
        <MetricCard
          label="Matched Stations"
          value={String(report.n)}
          subtitle={`${data.summary.sitesWithWOE} of 8 training sites`}
          tooltip={`${report.n} stations have both a LOO prediction and a WOE record with defensible mapping. ${report.nExcludedNoLOO + report.nExcludedNoWOE} stations excluded.`}
        />
      </div>

      {/* Confusion matrix */}
      <ExpandableSection title="Confusion Matrix (WOE rows × BN-RRM columns)" defaultOpen>
        <div className="flex items-center gap-1 mb-3">
          <InfoTooltip {...TOOLTIP.comparisonConfusionMatrix} />
          <span className="text-xs text-slate-400 dark:text-slate-500">n = {report.n} matched stations</span>
        </div>
        <ComparisonMatrix matrix={report.confusionMatrix} />
      </ExpandableSection>

      {/* Per-class metrics */}
      <ExpandableSection title="Per-Class Agreement">
        <div className="flex items-center gap-1 mb-3">
          <InfoTooltip {...TOOLTIP.comparisonPerClass} />
          <span className="text-xs text-slate-400 dark:text-slate-500">Reference = mapped WOE label</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Class</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">Precision <InfoTooltip {...TOOLTIP.precision} iconSize={11} /></span>
              </th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">Recall <InfoTooltip {...TOOLTIP.recall} iconSize={11} /></span>
              </th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">F1</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Support</th>
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((cls) => {
              const m = report.perClass[cls];
              if (!m) return null;
              return (
                <tr key={cls} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium text-slate-700 dark:text-slate-300 capitalize">{cls}</td>
                  <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.precision.toFixed(3)}</td>
                  <td className={cn('text-right py-2', m.recall === 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-400')}>{m.recall.toFixed(3)}</td>
                  <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.f1.toFixed(3)}</td>
                  <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.support}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ExpandableSection>

      {/* McNemar test (binary: elevated vs low) */}
      {report.mcNemar && (
        <ExpandableSection title="McNemar Test (Elevated vs Low)" badge="Binary reduction">
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              Binary reduction: &ldquo;Elevated&rdquo; (Moderate + High) vs Low. Tests whether
              BN-RRM and WOE disagree asymmetrically in the screening-relevant direction.
            </p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400">BN elevated, WOE low</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{report.mcNemar.b}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400">BN low, WOE elevated</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{report.mcNemar.c}</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500 dark:text-slate-400">p-value</div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {report.mcNemar.pValue < 0.001 ? '<0.001' : report.mcNemar.pValue.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        </ExpandableSection>
      )}

      {/* Mapping table */}
      <ExpandableSection title="Label Mapping Rules">
        <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">
          Source: {data.mappingTable.source}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">WOE Label</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">BN Class</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Confidence</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Justification</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.mappingTable.mappings).map(([label, mapping]) => (
              <tr key={label} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 text-slate-700 dark:text-slate-300">{label}</td>
                <td className="py-2">
                  <span className={cn('px-1.5 py-0.5 text-xs rounded capitalize', CLASS_COLORS[mapping.mapped]?.bg, CLASS_COLORS[mapping.mapped]?.text)}>
                    {mapping.mapped}
                  </span>
                </td>
                <td className="py-2">
                  <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                    {mapping.confidence}
                  </span>
                </td>
                <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{mapping.justification}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ExpandableSection>

      {/* Per-site station table */}
      <ExpandableSection title="Station-Level Detail">
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setSelectedSite(null)}
            className={cn('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
              selectedSite === null ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400')}
          >
            All sites ({report.n})
          </button>
          {data.siteComparisons.map((site) => {
            const n = site.stationComparisons.filter((s) => s.bnrrmPredicted && s.reportEstimate.mappedBNClass).length;
            return (
              <button
                key={site.siteId}
                onClick={() => setSelectedSite(site.siteId)}
                className={cn('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                  selectedSite === site.siteId ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400')}
              >
                {site.registryId} ({n})
              </button>
            );
          })}
        </div>
        <StationTable
          sites={selectedSiteData ? [selectedSiteData] : data.siteComparisons}
          showExclusions={showExclusions}
        />
        <label className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500 cursor-pointer">
          <input type="checkbox" checked={showExclusions} onChange={(e) => setShowExclusions(e.target.checked)} className="rounded" />
          Show excluded stations (no LOO prediction)
        </label>
      </ExpandableSection>

      {/* Exclusion transparency */}
      <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4 space-y-1">
        <p>Sites without WOE data: {data.summary.sitesWithoutWOENames.join(', ')}</p>
        <p>Governance: {data._meta.governanceSpec} &middot; Model: {data._meta.modelVersion}</p>
        <p className="italic">{data._meta.note}</p>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, subtitle, tooltip }: {
  label: string; value: string; subtitle?: string; tooltip?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-center gap-1">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
        {tooltip && <InfoTooltip title={label} description={tooltip} iconSize={11} />}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function ComparisonMatrix({ matrix }: { matrix: number[][] }) {
  const maxCount = Math.max(...matrix.flat());

  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2 font-medium">
        BN-RRM Predicted (LOO MAP)
      </div>
      <div className="flex items-start gap-2">
        <div className="flex flex-col justify-center mt-7 mr-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium -rotate-90 whitespace-nowrap origin-center" style={{ height: '80px', lineHeight: '80px' }}>
            WOE Mapped
          </div>
        </div>
        <div>
          <div className="flex ml-20">
            {CLASSES.map((cls) => (
              <div key={cls} className="w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-400 capitalize pb-1">{cls}</div>
            ))}
          </div>
          {CLASSES.map((woeClass, i) => (
            <div key={woeClass} className="flex items-center">
              <div className="w-20 text-right pr-3 text-xs font-medium text-slate-600 dark:text-slate-400 capitalize">{woeClass}</div>
              {CLASSES.map((bnClass, j) => {
                const count = matrix[i][j];
                const isAgree = i === j;
                return (
                  <div
                    key={bnClass}
                    className={cn(
                      'w-20 h-20 flex items-center justify-center border border-slate-200 dark:border-slate-700',
                      isAgree ? 'bg-green-100 dark:bg-green-900/40' : count > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800'
                    )}
                    style={isAgree && maxCount > 0 ? { opacity: 0.5 + (count / maxCount) * 0.5 } : undefined}
                  >
                    <span className={cn(
                      'text-lg font-bold',
                      isAgree ? 'text-green-700 dark:text-green-300' : count > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'
                    )}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StationTable({ sites, showExclusions }: { sites: SiteComparison[]; showExclusions: boolean }) {
  const rows: StationComparison[] = [];
  for (const site of sites) {
    for (const sc of site.stationComparisons) {
      if (sc.bnrrmPredicted || showExclusions) {
        rows.push(sc);
      }
    }
  }

  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-slate-800">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">BN-RRM</th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">WOE (original)</th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">WOE (mapped)</th>
            <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Match</th>
            <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Page</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((sc) => {
            const mapped = sc.reportEstimate.mappedBNClass;
            const match = sc.bnrrmPredicted && mapped ? sc.bnrrmPredicted === mapped : null;
            return (
              <tr key={sc.stationId} className={cn('border-b border-slate-100 dark:border-slate-800', !sc.bnrrmPredicted && 'opacity-50')}>
                <td className="py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">{sc.stationName}</td>
                <td className="py-1.5">
                  {sc.bnrrmPredicted ? (
                    <span className={cn('px-1.5 py-0.5 text-xs rounded capitalize', CLASS_COLORS[sc.bnrrmPredicted]?.bg, CLASS_COLORS[sc.bnrrmPredicted]?.text)}>
                      {sc.bnrrmPredicted}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">excluded</span>
                  )}
                </td>
                <td className="py-1.5 text-xs text-slate-500 dark:text-slate-400">{sc.reportEstimate.originalLabel}</td>
                <td className="py-1.5">
                  {mapped ? (
                    <span className={cn('px-1.5 py-0.5 text-xs rounded capitalize', CLASS_COLORS[mapped]?.bg, CLASS_COLORS[mapped]?.text)}>
                      {mapped}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-1.5 text-center">
                  {match === true && <span className="text-green-600 dark:text-green-400 text-xs font-bold">&#x2713;</span>}
                  {match === false && <span className="text-red-500 dark:text-red-400 text-xs font-bold">&#x2717;</span>}
                  {match === null && <span className="text-slate-300">—</span>}
                </td>
                <td className="py-1.5 text-right text-xs text-slate-400">{sc.reportEstimate.provenance.sourcePage ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">{rows.length} stations shown</div>
    </div>
  );
}
