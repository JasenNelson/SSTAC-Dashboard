'use client';

import { useMemo } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { ExpandableSection } from '@/components/bn-rrm/shared/ExpandableSection';

// ---------------------------------------------------------------------------
// Data types for the three JSON artifacts
// ---------------------------------------------------------------------------

interface StructuralSubModel {
  nodes: number;
  edges: number;
  regions: number;
  source?: string;
}

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
  structural: {
    our_model: Record<string, StructuralSubModel>;
    published: Record<string, StructuralSubModel>;
    match: boolean;
    notes: string;
  };
  sensitivity_ranking_comparison: {
    method: string;
    note: string;
    [key: string]: string | SensitivityEndpoint;
  };
  loo_accuracy_summary: {
    GSL: Record<string, LOOEndpoint>;
    GBS: Record<string, LOOEndpoint>;
    interpretation: string;
  };
}

interface PublishedReference {
  _metadata: {
    source: string;
    doi: string;
    digitized_date: string;
    notes: string;
  };
  sensitivity_rankings: Record<string, Record<string, PublishedRankingEntry>>;
  linear_mixed_effect_models: {
    fish_tissue_Hg_formula: string;
    freshwater_THg_formula: string;
    R_packages: string[];
    note: string;
  };
}

interface ValidationData {
  method: string;
  ess: number;
  summary: {
    GSL: Record<string, { n: number; accuracy: number; kappa: number }>;
    GBS: Record<string, { n: number; accuracy: number; kappa: number }>;
  };
}

interface PackReference {
  citation: string;
  doi: string;
  data_repository: string;
}

// ---------------------------------------------------------------------------
// Helper: human-readable labels for node identifiers
// ---------------------------------------------------------------------------

const NODE_LABELS: Record<string, string> = {
  fish_species: 'Fish species',
  fish_length: 'Fish length',
  proximity_mine_gsl: 'Proximity to mine (GSL)',
  proximity_historic_mine: 'Proximity to historic mine',
  proximity_oil_gbs: 'Proximity to oil (GBS)',
  proximity_rpts_gbs: 'Proximity to RPTS (GBS)',
  atmospheric_hg_deposition: 'Atmospheric Hg deposition',
  permafrost_hg_release: 'Permafrost Hg release',
  soil_erosion_hg_release: 'Soil erosion Hg release',
  total_hg_deposition: 'Total Hg deposition',
};

function humanizeNodeId(id: string): string {
  return NODE_LABELS[id] ?? id.replace(/_/g, ' ');
}

const ENDPOINT_LABELS: Record<string, string> = {
  GSL_fish_tissue_hg: 'GSL Fish Tissue Hg',
  GSL_freshwater_thg: 'GSL Freshwater THg',
  GBS_fish_tissue_hg: 'GBS Fish Tissue Hg',
  GBS_freshwater_thg: 'GBS Freshwater THg',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PublishedComparison() {
  const packManifest = usePackStore((s) => s.packManifest);

  // Load the three review artifacts via the pack system.
  // comparison_results and published_reference are benchmark-specific artifact keys.
  const {
    data: comparisonRaw,
    loading: loadingComparison,
    error: errorComparison,
  } = usePackArtifact<ComparisonResults>('comparison_results');

  const {
    data: publishedRaw,
    loading: loadingPublished,
    error: errorPublished,
  } = usePackArtifact<PublishedReference>('published_reference');

  const {
    data: validationRaw,
    loading: loadingValidation,
    error: errorValidation,
  } = usePackArtifact<ValidationData>('validation');

  const loading = loadingComparison || loadingPublished || loadingValidation;
  const error = errorComparison || errorPublished || errorValidation;

  // Extract reference info from pack manifest
  const reference = (packManifest as PackManifestWithRef | null)?.reference ?? null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading benchmark comparison data...</span>
        </div>
      </div>
    );
  }

  if (error || !comparisonRaw) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">
          {error ?? 'Failed to load comparison data. Ensure the benchmark pack is selected.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* HEADER                                                           */}
      {/* ================================================================= */}
      <HeaderSection reference={reference} />

      {/* ================================================================= */}
      {/* STRUCTURAL COMPARISON                                            */}
      {/* ================================================================= */}
      <StructuralSection data={comparisonRaw} />

      {/* ================================================================= */}
      {/* SENSITIVITY RANKING COMPARISON                                   */}
      {/* ================================================================= */}
      <SensitivitySection data={comparisonRaw} />

      {/* ================================================================= */}
      {/* LOO VALIDATION SUMMARY                                           */}
      {/* ================================================================= */}
      <LOOSection
        data={comparisonRaw}
        validation={validationRaw}
      />

      {/* ================================================================= */}
      {/* METHODOLOGY COMPARISON                                           */}
      {/* ================================================================= */}
      <MethodologySection published={publishedRaw} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pack manifest extended with reference field (benchmark packs only)
// ---------------------------------------------------------------------------

interface PackManifestWithRef {
  reference?: PackReference;
}

// ---------------------------------------------------------------------------
// Section: Header
// ---------------------------------------------------------------------------

function HeaderSection({ reference }: { reference: PackReference | null }) {
  const citation = reference?.citation ?? 'Jermilova et al. 2025, IEAM 21(2):396-413';
  const doi = reference?.doi ?? '10.1093/inteam/vjae011';
  const doiUrl = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
        Published Benchmark Comparison
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Jermilova et al. 2025 -- Mackenzie Mercury BN-RRM
      </p>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">Citation:</span>{' '}
        {citation}{' '}
        <a
          href={doiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          doi:{doi}
        </a>
      </div>

      <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Disclaimer:</strong> This comparison demonstrates independent reconstruction.
          It does not evaluate which model is &quot;better.&quot; Differences in CPT learning method
          (lme() regression vs BDeu frequency counting) and software platform (Netica vs custom Python)
          mean the models are methodologically distinct despite sharing the same DAG structure.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Structural Comparison
// ---------------------------------------------------------------------------

function StructuralSection({ data }: { data: ComparisonResults }) {
  const { structural } = data;
  const subModels = Object.keys(structural.our_model);

  return (
    <ExpandableSection title="Structural Comparison" defaultOpen badge={structural.match ? 'Match' : 'Mismatch'}
      badgeColor={structural.match
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}
    >
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Metric</th>
              {subModels.map((m) => (
                <th key={`pub-${m}`} className="text-center py-2 font-medium text-slate-500 dark:text-slate-400" colSpan={1}>
                  Published ({m})
                </th>
              ))}
              {subModels.map((m) => (
                <th key={`our-${m}`} className="text-center py-2 font-medium text-slate-500 dark:text-slate-400" colSpan={1}>
                  Our Model ({m})
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">Node count</td>
              {subModels.map((m) => (
                <td key={`pub-n-${m}`} className="py-2 text-center">{structural.published[m]?.nodes ?? '--'}</td>
              ))}
              {subModels.map((m) => (
                <td key={`our-n-${m}`} className="py-2 text-center">{structural.our_model[m]?.nodes ?? '--'}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">Edge count</td>
              {subModels.map((m) => (
                <td key={`pub-e-${m}`} className="py-2 text-center">{structural.published[m]?.edges ?? '--'}</td>
              ))}
              {subModels.map((m) => (
                <td key={`our-e-${m}`} className="py-2 text-center">{structural.our_model[m]?.edges ?? '--'}</td>
              ))}
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-2 font-medium">Regions</td>
              {subModels.map((m) => (
                <td key={`pub-r-${m}`} className="py-2 text-center">{structural.published[m]?.regions ?? '--'}</td>
              ))}
              {subModels.map((m) => (
                <td key={`our-r-${m}`} className="py-2 text-center">{structural.our_model[m]?.regions ?? '--'}</td>
              ))}
            </tr>
          </tbody>
        </table>

        {structural.notes && (
          <p className="text-xs text-slate-500 dark:text-slate-400 italic">
            {structural.notes}
          </p>
        )}
      </div>
    </ExpandableSection>
  );
}

// ---------------------------------------------------------------------------
// Section: Sensitivity Ranking Comparison
// ---------------------------------------------------------------------------

function SensitivitySection({ data }: { data: ComparisonResults }) {
  const comp = data.sensitivity_ranking_comparison;

  // Extract the endpoint keys (skip 'method' and 'note')
  const endpointKeys = useMemo(
    () => Object.keys(comp).filter((k) => k !== 'method' && k !== 'note'),
    [comp],
  );

  return (
    <ExpandableSection title="Sensitivity Ranking Comparison" defaultOpen>
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {comp.note}
        </p>

        {endpointKeys.map((endpointKey) => {
          const endpoint = comp[endpointKey] as SensitivityEndpoint;
          if (!endpoint || !endpoint.our_MI_ranking) return null;

          return (
            <div key={endpointKey} className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {ENDPOINT_LABELS[endpointKey] ?? endpointKey.replace(/_/g, ' ')}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Our rankings */}
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Our Model (Mutual Information)
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-1 text-slate-500 dark:text-slate-400">Rank</th>
                        <th className="text-left py-1 text-slate-500 dark:text-slate-400">Variable</th>
                        <th className="text-right py-1 text-slate-500 dark:text-slate-400">MI</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300">
                      {endpoint.our_MI_ranking.map((entry) => (
                        <tr key={entry.source} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1">{entry.rank}</td>
                          <td className="py-1">{humanizeNodeId(entry.source)}</td>
                          <td className="py-1 text-right font-mono">{entry.MI.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Published rankings */}
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Published (Table 2 Slope Coefficients)
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-1 text-slate-500 dark:text-slate-400">Rank</th>
                        <th className="text-left py-1 text-slate-500 dark:text-slate-400">Variable</th>
                        <th className="text-right py-1 text-slate-500 dark:text-slate-400">Coefficient</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-slate-300">
                      {Object.entries(endpoint.published_ranking)
                        .sort(([, a], [, b]) => a.rank - b.rank)
                        .map(([name, entry]) => (
                          <tr key={name} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="py-1">{entry.rank}</td>
                            <td className="py-1">{name}</td>
                            <td className="py-1 text-right font-mono">{entry.slope_coefficient ?? '--'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
          Method: {comp.method}
        </p>
      </div>
    </ExpandableSection>
  );
}

// ---------------------------------------------------------------------------
// Section: LOO Validation Summary
// ---------------------------------------------------------------------------

function LOOSection({
  data,
  validation,
}: {
  data: ComparisonResults;
  validation: ValidationData | null;
}) {
  const loo = data.loo_accuracy_summary;

  // Build rows from the summary data
  const rows: { model: string; variable: string; accuracy: number; kappa: number; n: number }[] = [];
  for (const modelKey of ['GSL', 'GBS'] as const) {
    const modelData = loo[modelKey];
    if (!modelData) continue;
    for (const [varKey, metrics] of Object.entries(modelData)) {
      rows.push({
        model: modelKey,
        variable: varKey === 'fish_tissue_hg' ? 'Fish tissue Hg' : 'Freshwater THg',
        accuracy: metrics.accuracy,
        kappa: metrics.kappa,
        n: metrics.n,
      });
    }
  }

  return (
    <ExpandableSection title="LOO Validation Summary" defaultOpen>
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Model</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Variable</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Accuracy</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">Kappa</th>
              <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">N</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {rows.map((row) => (
              <tr key={`${row.model}-${row.variable}`} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">{row.model}</td>
                <td className="py-2">{row.variable}</td>
                <td className="py-2 text-right font-mono">
                  {(row.accuracy * 100).toFixed(1)}%
                </td>
                <td className="py-2 text-right font-mono">
                  {row.kappa > 0 ? row.kappa.toFixed(3) : (
                    <span className="text-slate-400">--</span>
                  )}
                </td>
                <td className="py-2 text-right">{row.n.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          {loo.interpretation}
        </p>

        {validation && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Validation method: {validation.method} (ESS={validation.ess})
          </p>
        )}
      </div>
    </ExpandableSection>
  );
}

// ---------------------------------------------------------------------------
// Section: Methodology Comparison
// ---------------------------------------------------------------------------

function MethodologySection({ published }: { published: PublishedReference | null }) {
  const methodRows: { aspect: string; published: string; ours: string }[] = [
    {
      aspect: 'CPT method',
      published: 'lme() regression (predictSE.lme)',
      ours: 'BDeu frequency counting (ESS=1.0)',
    },
    {
      aspect: 'Software',
      published: 'Netica + R (nlme)',
      ours: 'Custom Python (numpy)',
    },
    {
      aspect: 'Random effects',
      published: 'Yes (~1|SampleID)',
      ours: 'No',
    },
    {
      aspect: 'Validation',
      published: 'Sensitivity (MI via Netica)',
      ours: 'LOO + Sensitivity (MI)',
    },
    {
      aspect: 'DAG structure',
      published: 'Expert-elicited (Figure 2)',
      ours: 'Reconstructed from Figure 2 + R code',
    },
    {
      aspect: 'Discretization',
      published: 'Table S4 + R code breakpoints',
      ours: 'Reproduced from same breakpoints',
    },
  ];

  return (
    <ExpandableSection title="Methodology Comparison" defaultOpen>
      <div className="space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Aspect</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Published (Netica)</th>
              <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Our Approach (Python)</th>
            </tr>
          </thead>
          <tbody className="text-slate-700 dark:text-slate-300">
            {methodRows.map((row) => (
              <tr key={row.aspect} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 font-medium">{row.aspect}</td>
                <td className="py-2">{row.published}</td>
                <td className="py-2">{row.ours}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {published?.linear_mixed_effect_models && (
          <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Published lme() Formulas
            </div>
            <div className="space-y-1 text-xs font-mono text-slate-600 dark:text-slate-400">
              <p><span className="text-slate-500">Fish tissue Hg:</span> {published.linear_mixed_effect_models.fish_tissue_Hg_formula}</p>
              <p><span className="text-slate-500">Freshwater THg:</span> {published.linear_mixed_effect_models.freshwater_THg_formula}</p>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
              {published.linear_mixed_effect_models.note}
            </p>
          </div>
        )}
      </div>
    </ExpandableSection>
  );
}
