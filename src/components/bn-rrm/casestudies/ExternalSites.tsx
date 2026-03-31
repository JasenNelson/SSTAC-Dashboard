'use client';

import { useState, useMemo } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeRiskComparison } from '@/lib/bn-rrm/normalize-artifacts';
import type { NormalizedRiskComparison } from '@/lib/bn-rrm/normalize-artifacts';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { cn } from '@/utils/cn';

type ExternalSite = {
  siteId: string;
  siteName: string;
  registryId: string;
  region: string;
  waterbody: string;
  gateOutcome: string;
  gateReason: string;
  consultant: string;
  reportDate: string;
  reportTitle: string;
  comparisonType: string;
  bnInputCoverage: {
    metals: boolean;
    pahs: boolean;
    pcbs: boolean;
    toc: boolean;
    grainSize: boolean;
    sulfideBinding: boolean;
    toxicity: boolean;
    community: boolean;
    note: string;
  };
  reportConclusions: {
    receptor: string;
    loeCount: number;
    loes: string[];
    woeConclusion: string;
    woeIntegrationNote?: string;
    mappedBNClass: string | null;
    mappingConfidence: string;
    mappingJustification: string;
    comparisonLevel: string;
    provenance: {
      sourceDocument: string;
      sourcePage: number;
      sourceTableFigure?: string;
      extractedLabel: string;
      extractionMethod: string;
      extractionDate: string;
      extractor: string;
    };
    isTrainingTarget: false;
  }[];
  toxicityStations?: {
    stationId: string;
    amphipodSurvival: number;
    polychaeteSurvival: number;
    polychaeteGrowth: number;
    bivalveDev: number;
  }[];
  statisticalAuthorization: {
    kappa: boolean;
    confusionMatrix: boolean;
    agreement: boolean;
    reason: string;
  };
};

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

export function ExternalSites() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: comparisonDataRaw, loading, error } = usePackArtifact<any>('risk_comparison');

  // Normalize artifact through the standard normalizer layer
  const normalized: NormalizedRiskComparison | null = useMemo(
    () => comparisonDataRaw ? normalizeRiskComparison(comparisonDataRaw) : null,
    [comparisonDataRaw],
  );

  // Extract external sites from the raw data (externalSites is not in normalized shape)
  const rawData = comparisonDataRaw as { externalSites?: ExternalSite[] } | null;
  const externalSites = rawData?.externalSites ?? [];

  // Hook: useState — must be above early returns
  const [expandedSite, setExpandedSite] = useState<string | null>(
    externalSites.length === 1 ? externalSites[0].siteId : null
  );

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading external sites...</span>
        </div>
      </div>
    );
  }

  if (error || !comparisonDataRaw) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{error ?? 'Failed to load comparison data'}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">External Sites</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Non-training sites with descriptive comparison to report-stated risk assessments
        </p>
      </div>

      {/* Boundary note */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Descriptive comparison only.</strong> External sites are not part of the BN-RRM
          training dataset. Report-stated risk conclusions are external reference labels presented
          alongside BN-RRM posterior estimates for comparison. No agreement statistics are shown
          unless station-level paired labels exist with defensible mapping.
        </p>
      </div>

      {externalSites.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {externalSites.map((site) => (
            <SiteCard
              key={site.siteId}
              site={site}
              expanded={expandedSite === site.siteId}
              onToggle={() => setExpandedSite(expandedSite === site.siteId ? null : site.siteId)}
            />
          ))}
        </div>
      )}

      {/* Requirements */}
      <ExpandableSection title="Requirements for external case studies">
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-3">
          <p>Before a non-training site can be added as a case study:</p>
          <ul className="list-disc ml-5 space-y-1.5">
            <li><strong>BN-RRM input data:</strong> Chemistry, conditions, and/or effect data must be available with provenance. Partial-evidence inference must be labeled as such.</li>
            <li><strong>Report-stated risk:</strong> The consultant ERA must contain explicit risk conclusions (WOE, SQT, or other framework).</li>
            <li><strong>Defensible mapping:</strong> Where mapping to BN 3-class is not defensible, the comparison remains descriptive only with parallel labels.</li>
            <li><strong>Provenance completeness:</strong> Every comparator label must include source document, page reference, extraction method, and extractor identity.</li>
          </ul>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Adding a site as a case study does not add it to the BN-RRM training dataset.
          </p>
        </div>
      </ExpandableSection>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center">
      <div className="text-slate-400 dark:text-slate-500 mb-3">
        <svg className="w-12 h-12 mx-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No external case studies yet</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
        External case studies will be added as non-training sites are identified and assessed.
      </p>
    </div>
  );
}

function SiteCard({ site, expanded, onToggle }: { site: ExternalSite; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      'rounded-xl border-2 transition-all bg-white dark:bg-slate-800',
      expanded ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700'
    )}>
      {/* Header */}
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-xs rounded font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {site.registryId}
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{site.siteName}</span>
          <span className={cn(
            'px-2 py-0.5 text-xs rounded font-medium',
            site.gateOutcome === 'DESCRIPTIVE_ONLY'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          )}>
            {site.gateOutcome.replace('_', ' ')}
          </span>
        </div>
        <svg className={cn('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
          {/* Site info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Consultant</span>
              <p className="text-slate-700 dark:text-slate-300">{site.consultant} ({site.reportDate})</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Waterbody</span>
              <p className="text-slate-700 dark:text-slate-300 capitalize">{site.waterbody} &middot; {site.region}</p>
            </div>
          </div>

          {/* Gate reason */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Gate: {site.gateOutcome.replace('_', ' ')}.</strong> {site.gateReason}
            </p>
          </div>

          {/* BN Input Coverage */}
          <ExpandableSection title="BN-RRM Input Coverage" badge="Partial">
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['metals', 'pahs', 'pcbs', 'toc', 'grainSize', 'sulfideBinding', 'toxicity', 'community'] as const).map((param) => {
                  const available = site.bnInputCoverage[param];
                  const labels: Record<string, string> = {
                    metals: 'Metals (7)', pahs: 'PAHs', pcbs: 'PCBs', toc: 'TOC',
                    grainSize: 'Grain Size', sulfideBinding: 'Sulfide Binding',
                    toxicity: 'Toxicity', community: 'Community',
                  };
                  return (
                    <div key={param} className={cn(
                      'rounded px-2 py-1 text-center',
                      available
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                    )}>
                      {labels[param]}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">{site.bnInputCoverage.note}</p>
            </div>
          </ExpandableSection>

          {/* Report Conclusions */}
          <ExpandableSection title="Report-Stated Risk Conclusions (WOE)" defaultOpen>
            <div className="space-y-3">
              <div className="flex items-center gap-1 mb-1">
                <InfoTooltip
                  title="External Reference Labels"
                  description="These are the consultant's WOE conclusions from the DRA report. They are external reference labels, not BN training targets or ground truth. Presented alongside BN-RRM posterior estimates for descriptive comparison only."
                />
                <span className="text-xs text-slate-400 dark:text-slate-500">Report: {site.reportTitle}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Receptor</th>
                    <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">WOE (original)</th>
                    <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">BN Mapping</th>
                    <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">LOEs</th>
                    <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {site.reportConclusions.map((rc) => (
                    <tr key={rc.receptor} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 text-slate-700 dark:text-slate-300">{rc.receptor}</td>
                      <td className="py-2">
                        <span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {rc.woeConclusion}
                        </span>
                      </td>
                      <td className="py-2">
                        {rc.mappedBNClass ? (
                          <span className={cn('px-1.5 py-0.5 text-xs rounded capitalize', CLASS_COLORS[rc.mappedBNClass]?.bg, CLASS_COLORS[rc.mappedBNClass]?.text)}>
                            {rc.mappedBNClass} ({rc.mappingConfidence})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{rc.mappingConfidence === 'not_mappable' ? 'Not mappable' : '—'}</span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{rc.loeCount} LOE{rc.loeCount > 1 ? 's' : ''}</td>
                      <td className="py-2 text-right text-xs text-slate-400">p{rc.provenance.sourcePage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandableSection>

          {/* LOE Detail for benthic */}
          {site.reportConclusions.find(rc => rc.receptor === 'Benthic Invertebrates') && (
            <ExpandableSection title="Benthic Invertebrate LOE Detail">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                {site.reportConclusions
                  .filter(rc => rc.receptor === 'Benthic Invertebrates')
                  .map(rc => (
                    <div key={rc.receptor}>
                      <ul className="list-disc ml-5 space-y-1 text-xs">
                        {rc.loes.map((loe, i) => <li key={i}>{loe}</li>)}
                      </ul>
                      {rc.woeIntegrationNote && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
                          WOE integration: {rc.woeIntegrationNote}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </ExpandableSection>
          )}

          {/* Toxicity station data */}
          {site.toxicityStations && site.toxicityStations.length > 0 && (
            <ExpandableSection title={`Toxicity Test Results (${site.toxicityStations.length} stations)`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-1.5 font-medium text-slate-500 dark:text-slate-400">Station</th>
                    <th className="text-right py-1.5 font-medium text-slate-500 dark:text-slate-400">Amphipod (%)</th>
                    <th className="text-right py-1.5 font-medium text-slate-500 dark:text-slate-400">Polychaete (%)</th>
                    <th className="text-right py-1.5 font-medium text-slate-500 dark:text-slate-400">Growth (mg/d)</th>
                    <th className="text-right py-1.5 font-medium text-slate-500 dark:text-slate-400">Bivalve (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {site.toxicityStations.map((st) => (
                    <tr key={st.stationId} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-mono text-slate-700 dark:text-slate-300">{st.stationId}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{st.amphipodSurvival}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{st.polychaeteSurvival}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{st.polychaeteGrowth.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{st.bivalveDev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Note: These are station-level toxicity results but the WOE risk conclusion is site-level, not per-station.
                No station-level risk labels are available for paired comparison.
              </p>
            </ExpandableSection>
          )}

          {/* Statistical authorization */}
          <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-3">
            <p><strong>Statistical authorization:</strong> {site.statisticalAuthorization.reason}</p>
            <p className="mt-1">Comparison type: {site.comparisonType} &middot; Gate: {site.gateOutcome}</p>
          </div>
        </div>
      )}
    </div>
  );
}
