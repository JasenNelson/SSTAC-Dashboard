'use client';

import React, { useMemo } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function riskColor(risk: string | null | undefined): string {
  if (!risk) return 'text-slate-400 dark:text-slate-500';
  const r = risk.toLowerCase();
  if (r === 'low') return 'text-green-600 dark:text-green-400';
  if (r === 'moderate') return 'text-amber-600 dark:text-amber-400';
  if (r === 'high') return 'text-red-600 dark:text-red-400';
  return 'text-slate-600 dark:text-slate-400';
}

function _riskBg(risk: string | null | undefined): string {
  if (!risk) return '';
  const r = risk.toLowerCase();
  if (r === 'low') return 'bg-green-50 dark:bg-green-900/10';
  if (r === 'moderate') return 'bg-amber-50 dark:bg-amber-900/10';
  if (r === 'high') return 'bg-red-50 dark:bg-red-900/10';
  return '';
}

function agreementIcon(predicted: string | null, observed: string | null): React.ReactNode {
  if (!predicted || !observed) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  if (predicted.toLowerCase() === observed.toLowerCase()) {
    return <span className="text-green-600 dark:text-green-400 font-bold">&#10003;</span>;
  }
  return <span className="text-red-500 dark:text-red-400 font-bold">&#10007;</span>;
}

// ---------------------------------------------------------------------------
// Normalize station data from various sensitivity JSON formats
// ---------------------------------------------------------------------------

function normalizeStation(raw: any): {
  name: string;
  observed: string | null;
  predicted: string | null;
  correct: boolean;
  evidenceNodes: string[];
  inferredNodes: string[];
} {
  const name = raw.station_name ?? raw.station ?? raw.station_id ?? '?';
  const observed = raw.observed_risk ?? null;

  // Get the model prediction — prefer assessment (observed-evidence) result
  const predicted =
    raw.site_assessment?.map ??
    raw.assessment?.map_prediction ??
    raw.assessment_map ??
    raw.site_screening?.map ??
    raw.screening?.map_prediction ??
    raw.screening_map ??
    null;

  const correct = observed && predicted ? observed.toLowerCase() === predicted.toLowerCase() : false;

  // Determine which effect nodes had observed evidence
  const effects = raw.effects_as_evidence ?? raw.observed_effects ?? {};
  const evidenceNodes: string[] = [];
  const inferredNodes: string[] = [];

  for (const node of ['tox_amphipod', 'taxa_richness', 'diversity']) {
    if (effects[node] != null) {
      evidenceNodes.push(node);
    } else {
      inferredNodes.push(node);
    }
  }

  return { name, observed, predicted, correct, evidenceNodes, inferredNodes };
}

// Node display names
const NODE_LABELS: Record<string, string> = {
  tox_amphipod: 'Amphipod Toxicity',
  taxa_richness: 'Taxa Richness',
  diversity: 'Shannon Diversity',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EvidenceView() {
  const { data: rawData, loading, error } = usePackArtifact<any>('sensitivity');

  const stations: any[] = rawData?.stations ?? [];

  const { total, correct, withEvidence } = useMemo(() => {
    if (stations.length === 0) return { total: 0, correct: 0, withEvidence: 0 };
    const normalized = stations.map(normalizeStation);
    return {
      total: normalized.length,
      correct: normalized.filter(s => s.correct).length,
      withEvidence: normalized.filter(s => s.evidenceNodes.length > 0).length,
    };
  }, [stations]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading evidence data...</span>
        </div>
      </div>
    );
  }

  if (error || !rawData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-md">
          <div className="text-slate-400 dark:text-slate-500 text-3xl mb-3">&#128202;</div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Evidence data not available
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ?? 'The evidence artifact is not available for this pack.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          Evidence &amp; Predictions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          The BN-RRM integrates all available evidence — chemistry, environmental conditions,
          toxicity test results, and benthic community data — to produce an ecological risk
          assessment at each station. This view shows what evidence was available, what the
          model predicted, and whether the prediction agrees with the observed risk.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Stations
          </div>
          <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">
            {total}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Correct Predictions
          </div>
          <div className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
            {correct} <span className="text-base font-normal text-slate-400">of {total}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            With Observed Effects
          </div>
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {withEvidence} <span className="text-base font-normal text-slate-400">of {total}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stations where toxicity or community data was directly observed
          </p>
        </div>
      </div>

      {/* Evidence explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
          How Evidence Is Used
        </h3>
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          When toxicity and community measurements are available at a station, the model uses
          them directly as observed evidence. Chemistry and environmental conditions are always
          used. The ecological risk prediction reflects all available evidence — observed biological
          effects carry the strongest weight because they represent actual measured outcomes, not
          inferred potential.
        </p>
      </div>

      {/* Per-station table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Per-Station Results
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Observed Risk</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Predicted Risk</th>
                <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Match</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Observed Evidence</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((raw: any, i: number) => {
                const s = normalizeStation(raw);
                return (
                  <tr
                    key={i}
                    className={`border-b border-slate-100 dark:border-slate-800 ${!s.correct && s.observed ? 'bg-red-50/50 dark:bg-red-900/5' : ''}`}
                  >
                    <td className="py-2 font-medium text-slate-700 dark:text-slate-300">
                      {s.name}
                    </td>
                    <td className={`py-2 capitalize ${riskColor(s.observed)}`}>
                      {s.observed ?? '—'}
                    </td>
                    <td className={`py-2 capitalize ${riskColor(s.predicted)}`}>
                      {s.predicted ?? '—'}
                    </td>
                    <td className="py-2 text-center">
                      {agreementIcon(s.predicted, s.observed)}
                    </td>
                    <td className="py-2">
                      {s.evidenceNodes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.evidenceNodes.map(node => (
                            <span
                              key={node}
                              className="inline-block px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            >
                              {NODE_LABELS[node] ?? node}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Chemistry only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
