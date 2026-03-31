'use client';

import { useMemo } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { ModeIndicator } from '@/components/bn-rrm/shared/ModeIndicator';

// ---------------------------------------------------------------------------
// Types for the sensitivity artifact
// ---------------------------------------------------------------------------

interface StationSensitivity {
  station: string;
  observed_risk: string;
  screening_map: string;
  assessment_map: string;
  changed: boolean;
  /** Optional posterior probability arrays for shift visualisation */
  screening_posterior?: Record<string, number>;
  assessment_posterior?: Record<string, number>;
}

interface SensitivityData {
  stations: StationSensitivity[];
  summary?: string;
}

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

function riskBgSubtle(risk: string | null | undefined): string {
  if (!risk) return '';
  const r = risk.toLowerCase();
  if (r === 'low') return 'bg-green-50 dark:bg-green-900/10';
  if (r === 'moderate') return 'bg-amber-50 dark:bg-amber-900/10';
  if (r === 'high') return 'bg-red-50 dark:bg-red-900/10';
  return '';
}

/**
 * Render a small horizontal bar showing the posterior shift direction.
 * Green = risk decreased (improvement), Red = risk increased (regression).
 */
function PosteriorShiftBar({ station }: { station: StationSensitivity }) {
  // Determine direction from MAP classes
  const riskOrder: Record<string, number> = { low: 0, moderate: 1, high: 2 };
  const screenVal = riskOrder[station.screening_map.toLowerCase()] ?? 0;
  const assessVal = riskOrder[station.assessment_map.toLowerCase()] ?? 0;
  const delta = assessVal - screenVal; // negative = improvement, positive = regression

  if (delta === 0) return null;

  const isImprovement = delta < 0;
  const magnitude = Math.abs(delta);
  const widthPct = magnitude === 1 ? 40 : 80;

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isImprovement ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className={`text-[10px] font-medium ${isImprovement ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {isImprovement ? 'Improved' : 'Regressed'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EvidenceView() {
  const { data, loading, error } = usePackArtifact<SensitivityData>('sensitivity');

  const stats = useMemo(() => {
    if (!data?.stations) return null;
    const total = data.stations?.length ?? 0;
    const changed = (data.stations ?? []).filter((s: any) => {
      if (s.changed != null || s.map_changed != null) return s.changed ?? s.map_changed;
      // Derive from nested structure
      const sMap = s.screening_map ?? s.screening?.map_prediction ?? s.site_screening?.map;
      const aMap = s.assessment_map ?? s.assessment?.map_prediction ?? s.site_assessment?.map;
      return sMap && aMap && sMap !== aMap;
    }).length;
    return { total, changed };
  }, [data]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading evidence...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center max-w-md">
          <div className="text-slate-400 dark:text-slate-500 text-3xl mb-3">&#128202;</div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Sensitivity data not available
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {error ?? 'The sensitivity artifact is not available for this pack. It will be generated during the next model build.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            Evidence Sensitivity
          </h2>
          <ModeIndicator mode="both" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          Compares model predictions under screening mode (chemistry only) versus assessment mode
          (all available evidence). Stations where the prediction changes indicate that toxicity or
          community data meaningfully shifts the risk determination.
        </p>
      </div>

      {/* Summary card */}
      {stats && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Stations Changed
              </div>
              <div className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                {stats.changed}{' '}
                <span className="text-base font-normal text-slate-400">of {stats.total}</span>
              </div>
            </div>
            <div className="flex-1 text-sm text-slate-500 dark:text-slate-400">
              {data.summary ??
                `${stats.changed} of ${stats.total} stations change prediction between screening and assessment mode.`}
            </div>
          </div>
        </div>
      )}

      {/* Mode explanation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ModeIndicator mode="screening" />
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
            Chemistry data only. Toxicity and community nodes are unobserved,
            so the model uses prior probabilities propagated through the DAG.
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ModeIndicator mode="assessment" />
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">
            All available evidence entered. Toxicity and community observations
            constrain the posterior, producing a refined risk prediction.
          </p>
        </div>
      </div>

      {/* Per-station table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
          Per-Station Comparison
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Observed Risk</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Screening MAP</th>
                <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Assessment MAP</th>
                <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Changed?</th>
              </tr>
            </thead>
            <tbody>
              {data.stations.map((raw: any, i: number) => {
                // Normalize field names — handle both flat and nested JSON formats
                const name = raw.station ?? raw.station_name ?? raw.station_id ?? `Station ${i}`;
                const observed = raw.observed_risk;
                const screeningMap = raw.screening_map ?? raw.screening?.map_prediction ?? raw.site_screening?.map ?? raw.screening?.map;
                const assessmentMap = raw.assessment_map ?? raw.assessment?.map_prediction ?? raw.site_assessment?.map ?? raw.assessment?.map;
                const changed = raw.changed ?? raw.map_changed ?? (screeningMap !== assessmentMap);

                return (
                <tr
                  key={i}
                  className={`border-b border-slate-100 dark:border-slate-800 ${changed ? riskBgSubtle(assessmentMap) : ''}`}
                >
                  <td className="py-2 font-medium text-slate-700 dark:text-slate-300">
                    {name}
                  </td>
                  <td className={`py-2 capitalize ${riskColor(observed)}`}>
                    {observed ?? '—'}
                  </td>
                  <td className={`py-2 capitalize ${riskColor(screeningMap)}`}>
                    {screeningMap ?? '—'}
                  </td>
                  <td className="py-2">
                    <span className={`capitalize ${riskColor(assessmentMap)}`}>
                      {assessmentMap ?? '—'}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    {changed ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                        &#8800;
                      </span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">&#8212;</span>
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
