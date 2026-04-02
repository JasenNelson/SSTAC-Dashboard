'use client';

import { useMemo, useState } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeRiskComparison } from '@/lib/bn-rrm/normalize-artifacts';
import type { NormalizedExternalSite, NormalizedRiskComparison } from '@/lib/bn-rrm/normalize-artifacts';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { cn } from '@/utils/cn';

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

const EXTERNAL_CLASS_STYLES: Record<string, string> = {
  editorial_only: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
  bn_descriptive_site_level: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  bn_evaluative_not_pooled: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
};

const EXTERNAL_CLASS_LABELS: Record<string, string> = {
  editorial_only: 'Editorial only',
  bn_descriptive_site_level: 'BN descriptive site-level',
  bn_evaluative_not_pooled: 'BN evaluative, not pooled',
};

const INFERENCE_STATUS_LABELS: Record<string, string> = {
  partial_evidence_site_level_ready: 'Partial-evidence site-level ready',
  site_level_run_complete: 'Site-level run complete',
  unsupported_noncanonical_profile: 'Unsupported noncanonical profile',
};

const AUTHORIZATION_LABELS: Record<string, string> = {
  descriptive_only: 'Descriptive only',
  evaluative_not_pooled: 'Evaluative, not pooled',
};

const OVERLAP_LABELS: Record<string, string> = {
  meaningful_partial: 'Meaningful partial overlap',
  minimal_noncanonical: 'Minimal noncanonical overlap',
};

const FLAG_LABELS: Record<string, string> = {
  partial_domain_overlap: 'Partial domain overlap',
  missing_environmental_modifiers: 'Missing environmental modifiers',
  estuarine_overlap_not_training_domain: 'Estuarine overlap outside training domain',
  site_level_or_area_level_conclusions_only: 'Area/site-level conclusions only',
  toxicity_and_community_not_encoded_as_bn_inputs: 'Toxicity and community not encoded as BN inputs',
  aec_1b_profile_only: 'AEC 1B profile only',
  pah_dominant_profile: 'PAH-dominant profile',
  missing_metals_and_modifier_inputs: 'Missing metals and modifier inputs',
  site_level_conclusions_only: 'Site-level conclusions only',
  noncanonical_petroleum_profile: 'Noncanonical petroleum profile',
  minimal_bn_domain_overlap: 'Minimal BN-domain overlap',
  professional_judgment_heavy_comparator: 'Professional-judgment-heavy comparator',
  no_supported_bn_side_external_comparison: 'No supported BN-side external comparison',
};

function humanizeToken(value: string) {
  return value.replaceAll('_', ' ');
}

export function ExternalSites() {
  const packManifest = usePackStore((s) => s.packManifest);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: comparisonDataRaw, loading, error } = usePackArtifact<any>('risk_comparison');

  const normalized: NormalizedRiskComparison | null = useMemo(
    () => comparisonDataRaw ? normalizeRiskComparison(comparisonDataRaw) : null,
    [comparisonDataRaw],
  );

  const externalSites = normalized?.externalSites ?? [];

  const [expandedSite, setExpandedSite] = useState<string | null>(
    externalSites.length === 1 ? externalSites[0].siteId : null,
  );

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
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">External Sites</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Non-training sites with governed external comparison semantics and explicit uncertainty limits
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>External comparison is governed and bounded.</strong> External sites are not part of
          the BN-RRM training dataset. Current BN-oriented semantics are site-level only, non-pooled,
          and not benchmark-comparable. Report-stated risk conclusions remain external reference labels
          with explicit uncertainty and interpretation limits.
        </p>
      </div>

      {normalized?.meta.externalSitesStatus && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>External semantics status:</strong>{' '}
            {normalized.meta.externalSitesStatus === 'site_level_semantics_operationalized'
              ? 'Site-level semantics operationalized'
              : humanizeToken(normalized.meta.externalSitesStatus)}
          </p>
          {normalized.meta.externalSitesNote && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              {normalized.meta.externalSitesNote}
            </p>
          )}
        </div>
      )}

      {normalized?.meta.externalInterpretationRules && (
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <p className="text-xs text-slate-700 dark:text-slate-300">
            <strong>Authorized interpretation.</strong> Output granularity defaults to{' '}
            <span className="font-mono">{normalized.meta.externalInterpretationRules.defaultOutputGranularity}</span>.
            {' '}Pooled statistics: {normalized.meta.externalInterpretationRules.pooledStatisticsAuthorized ? 'allowed' : 'not allowed'}.
            {' '}Benchmark comparable: {normalized.meta.externalInterpretationRules.benchmarkComparable ? 'yes' : 'no'}.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {normalized.meta.externalInterpretationRules.interpretationNote}
          </p>
        </div>
      )}

      {(() => {
        const artifactVersion = comparisonDataRaw?._meta?.modelVersion;
        const packVersion = packManifest?.version_history?.model_version;
        if (artifactVersion && packVersion && !artifactVersion.includes(packVersion)) {
          return (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Comparison data predates the current BN-RRM v1.0 model. A refresh against v1.0 is pending.
              </p>
            </div>
          );
        }
        return null;
      })()}

      {externalSites.length === 0 ? (
        packManifest?.scope_type === 'site_specific' ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              External site comparisons apply to the general model.
              Switch to the <strong>General</strong> pack to see comparisons with BC contaminated sites
              that were not part of BN-RRM training.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Site-specific packs compare the site model against the general model for the same stations.
              See the <strong>Risk Comparison</strong> section in the Review tab.
            </p>
          </div>
        ) : (
          <EmptyState />
        )
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

function SiteCard({
  site,
  expanded,
  onToggle,
}: {
  site: NormalizedExternalSite;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border-2 transition-all bg-white dark:bg-slate-800',
        expanded ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700',
      )}
    >
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-2 py-0.5 text-xs rounded font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
            {site.registryId}
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">{site.siteName}</span>
          <span
            className={cn(
              'px-2 py-0.5 text-xs rounded font-medium',
              site.gateOutcome === 'DESCRIPTIVE_ONLY'
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
            )}
          >
            {site.gateOutcome.replace('_', ' ')}
          </span>
          <span
            className={cn(
              'px-2 py-0.5 text-xs rounded font-medium',
              EXTERNAL_CLASS_STYLES[site.externalComparisonClass] ?? EXTERNAL_CLASS_STYLES.editorial_only,
            )}
          >
            {EXTERNAL_CLASS_LABELS[site.externalComparisonClass] ?? humanizeToken(site.externalComparisonClass)}
          </span>
        </div>
        <svg
          className={cn('w-4 h-4 text-slate-400 transition-transform', expanded && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-4">
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

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Gate: {site.gateOutcome.replace('_', ' ')}.</strong> {site.gateReason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            <SemanticCard
              label="Comparison class"
              value={EXTERNAL_CLASS_LABELS[site.externalComparisonClass] ?? humanizeToken(site.externalComparisonClass)}
              tone={EXTERNAL_CLASS_STYLES[site.externalComparisonClass] ?? EXTERNAL_CLASS_STYLES.editorial_only}
            />
            <SemanticCard
              label="BN inference"
              value={INFERENCE_STATUS_LABELS[site.bnInferenceStatus] ?? humanizeToken(site.bnInferenceStatus)}
              tone="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            />
            <SemanticCard
              label="Authorization"
              value={AUTHORIZATION_LABELS[site.interpretationAuthorization] ?? humanizeToken(site.interpretationAuthorization)}
              tone="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            />
            <SemanticCard
              label="Granularity"
              value={humanizeToken(site.outputGranularity)}
              tone="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              <strong>Uncertainty and scope.</strong> {site.uncertaintyNote}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Contaminant overlap: {OVERLAP_LABELS[site.contaminantOverlap] ?? humanizeToken(site.contaminantOverlap)}
              {' · '}
              Modifiers: {site.modifierEffectsStatus ? humanizeToken(site.modifierEffectsStatus.modifiers) : 'not specified'}
              {' · '}
              Effects evidence: {site.modifierEffectsStatus ? humanizeToken(site.modifierEffectsStatus.effectsEvidence) : 'not specified'}
            </p>
            {site.uncertaintyFlags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {site.uncertaintyFlags.map((flag) => (
                  <span
                    key={flag}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {FLAG_LABELS[flag] ?? humanizeToken(flag)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <ExpandableSection title="BN-RRM Input Coverage" badge="Partial">
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-xs">
                {(['metals', 'pahs', 'pcbs', 'toc', 'grainSize', 'sulfideBinding', 'toxicity', 'community'] as const).map((param) => {
                  const available = site.bnInputCoverage[param];
                  const labels: Record<string, string> = {
                    metals: 'Metals (7)',
                    pahs: 'PAHs',
                    pcbs: 'PCBs',
                    toc: 'TOC',
                    grainSize: 'Grain Size',
                    sulfideBinding: 'Sulfide Binding',
                    toxicity: 'Toxicity',
                    community: 'Community',
                  };

                  return (
                    <div
                      key={param}
                      className={cn(
                        'rounded px-2 py-1 text-center',
                        available
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {labels[param]}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">{site.bnInputCoverage.note}</p>
            </div>
          </ExpandableSection>

          {site.bnRunRecord?.posteriorSummary && (
            <ExpandableSection title="BN Run Record" badge="Run complete" defaultOpen>
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Descriptive BN run only.</strong> This 0139 record uses the existing v1.0 screening path
                    with an explicit AEC 1B input profile. It is not validation evidence, not pooled, and not
                    benchmark-comparable.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
                  <SemanticCard
                    label="Spatial unit"
                    value={site.bnInputAssembly?.authorizedSpatialUnit?.id ?? humanizeToken(site.outputGranularity)}
                    tone="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  />
                  <SemanticCard
                    label="MAP class"
                    value={site.bnRunRecord.posteriorSummary.map}
                    tone={cn(
                      CLASS_COLORS[site.bnRunRecord.posteriorSummary.map]?.bg ?? 'bg-slate-100 dark:bg-slate-700',
                      CLASS_COLORS[site.bnRunRecord.posteriorSummary.map]?.text ?? 'text-slate-700 dark:text-slate-300',
                    )}
                  />
                  <PosteriorMetric label="Low" value={site.bnRunRecord.posteriorSummary.low} />
                  <PosteriorMetric label="Moderate" value={site.bnRunRecord.posteriorSummary.moderate} />
                  <PosteriorMetric label="High" value={site.bnRunRecord.posteriorSummary.high} />
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                  <p><strong>Run date:</strong> {site.bnRunRecord.runDate || 'not recorded'}</p>
                  <p><strong>Evidence source:</strong> {site.bnRunRecord.evidenceSourceSummary}</p>
                  <p><strong>Encoding basis:</strong> {site.bnRunRecord.encodingBasis}</p>
                  <p><strong>Method:</strong> {site.bnRunRecord.runMethod}</p>
                  <p>
                    <strong>Authorization guardrails:</strong> pooled stats eligible = {site.pooledStatsEligible ? 'yes' : 'no'} /
                    benchmark comparable = {site.benchmarkComparable ? 'yes' : 'no'}.
                  </p>
                </div>

                {site.bnRunRecord.limitations.length > 0 && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Limitations</div>
                    <ul className="list-disc ml-5 mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {site.bnRunRecord.limitations.map((item, index) => (
                        <li key={`${site.siteId}-limit-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ExpandableSection>
          )}

          <ExpandableSection title="Report-Stated Risk Conclusions (WOE)" defaultOpen>
            <div className="space-y-3">
              <div className="flex items-center gap-1 mb-1">
                <InfoTooltip
                  title="External Reference Labels"
                  description="These are the consultant's WOE conclusions from the DRA report. They are external reference labels, not BN training targets or ground truth. Presented alongside BN-RRM-oriented semantics for descriptive site-level comparison only."
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
                    <tr key={`${site.siteId}-${rc.receptor}`} className="border-b border-slate-100 dark:border-slate-800">
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
                          <span className="text-xs text-slate-400 italic">
                            {rc.mappingConfidence === 'not_mappable' ? 'Not mappable' : '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{rc.loeCount} LOE{rc.loeCount > 1 ? 's' : ''}</td>
                      <td className="py-2 text-right text-xs text-slate-400">p{rc.provenance.sourcePage ?? '?'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandableSection>

          {site.reportConclusions.find((rc) => rc.receptor === 'Benthic Invertebrates') && (
            <ExpandableSection title="Benthic Invertebrate LOE Detail">
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
                {site.reportConclusions
                  .filter((rc) => rc.receptor === 'Benthic Invertebrates')
                  .map((rc) => (
                    <div key={`${site.siteId}-${rc.receptor}-detail`}>
                      <ul className="list-disc ml-5 space-y-1 text-xs">
                        {rc.loes.map((loe, index) => (
                          <li key={`${site.siteId}-${rc.receptor}-${index}`}>{loe}</li>
                        ))}
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

          {site.toxicityStations.length > 0 && (
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
                  {site.toxicityStations.map((station) => (
                    <tr key={`${site.siteId}-${station.stationId}`} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-mono text-slate-700 dark:text-slate-300">{station.stationId}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{station.amphipodSurvival}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{station.polychaeteSurvival}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{station.polychaeteGrowth.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-slate-600 dark:text-slate-400">{station.bivalveDev}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Note: These are station-level toxicity results but the consultant risk conclusion remains site-level.
                No station-level paired risk labels are available for pooled or agreement interpretation.
              </p>
            </ExpandableSection>
          )}

          <div className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-3">
            <p><strong>Statistical authorization:</strong> {site.statisticalAuthorization.reason}</p>
            <p className="mt-1">Comparison type: {site.comparisonType} &middot; Gate: {site.gateOutcome}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PosteriorMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">{value.toFixed(3)}</div>
    </div>
  );
}

function SemanticCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn('mt-2 inline-flex rounded px-2 py-1 text-xs font-medium', tone)}>
        {value}
      </div>
    </div>
  );
}
