'use client';

import { useState, useMemo } from 'react';
import { usePackArtifact } from '@/hooks/bn-rrm/usePackArtifact';
import { normalizeValidation } from '@/lib/bn-rrm/normalize-artifacts';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';

type Prediction = {
  station_id: number;
  station_name: string;
  predicted: string;
  observed: string;
};

const CLASSES = ['low', 'moderate', 'high'] as const;

const CLASS_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  moderate: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  high: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

function ConfusionMatrix({ predictions }: { predictions: Prediction[] }) {
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const cls of CLASSES) {
      m[cls] = {};
      for (const cls2 of CLASSES) m[cls][cls2] = 0;
    }
    for (const p of predictions) {
      const obs = (p.observed ?? "").toLowerCase();
      const pred = (p.predicted ?? "").toLowerCase();
      if (m[obs] && m[obs][pred] !== undefined) m[obs][pred]++;
    }
    return m;
  }, [predictions]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const row of CLASSES)
      for (const col of CLASSES)
        max = Math.max(max, matrix[row][col]);
    return max || 1;
  }, [matrix]);

  return (
    <div>
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2 font-medium flex items-center justify-center gap-1">
        Predicted
        <InfoTooltip
          {...TOOLTIP.confusionMatrix}
          iconSize={12}
        />
      </div>
      <div className="flex items-start gap-2">
        <div className="flex flex-col justify-center gap-0 mt-7 mr-1">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium -rotate-90 whitespace-nowrap origin-center" style={{ height: '80px', lineHeight: '80px' }}>Observed</div>
        </div>
        <div>
          {/* Column headers */}
          <div className="flex ml-20">
            {CLASSES.map((cls) => (
              <div key={cls} className="w-20 text-center text-xs font-medium text-slate-600 dark:text-slate-400 capitalize pb-1">{cls}</div>
            ))}
          </div>
          {/* Rows */}
          {CLASSES.map((obsClass) => (
            <div key={obsClass} className="flex items-center">
              <div className="w-20 text-right pr-3 text-xs font-medium text-slate-600 dark:text-slate-400 capitalize">{obsClass}</div>
              {CLASSES.map((predClass) => {
                const count = matrix[obsClass][predClass];
                const isCorrect = obsClass === predClass;
                const intensity = count / maxCount;
                return (
                  <div
                    key={predClass}
                    className={`w-20 h-20 flex items-center justify-center border border-slate-200 dark:border-slate-700 ${
                      isCorrect
                        ? 'bg-green-100 dark:bg-green-900/40'
                        : count > 0
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-slate-50 dark:bg-slate-800'
                    }`}
                    style={isCorrect ? { opacity: 0.5 + intensity * 0.5 } : undefined}
                  >
                    <span className={`text-lg font-bold ${isCorrect ? 'text-green-700 dark:text-green-300' : count > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>
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

function PredictionsTable({ predictions, filter }: { predictions: Prediction[]; filter: string }) {
  const filtered = useMemo(() => {
    if (filter === 'all') return predictions;
    if (filter === 'correct') return predictions.filter((p) => p.predicted === p.observed);
    if (filter === 'incorrect') return predictions.filter((p) => p.predicted !== p.observed);
    return predictions.filter((p) => p.observed === filter || p.predicted === filter);
  }, [predictions, filter]);

  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-slate-800">
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Station</th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">Predicted <InfoTooltip {...TOOLTIP.predicted} iconSize={12} /></span>
            </th>
            <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">Observed <InfoTooltip {...TOOLTIP.observed} iconSize={12} /></span>
            </th>
            <th className="text-center py-2 font-medium text-slate-500 dark:text-slate-400">Result</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const correct = p.predicted === p.observed;
            return (
              <tr key={p.station_id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">{p.station_name}</td>
                <td className="py-1.5">
                  <span className={`px-1.5 py-0.5 text-xs rounded capitalize ${CLASS_COLORS[p.predicted]?.bg ?? ''} ${CLASS_COLORS[p.predicted]?.text ?? ''}`}>
                    {p.predicted}
                  </span>
                </td>
                <td className="py-1.5">
                  <span className={`px-1.5 py-0.5 text-xs rounded capitalize ${CLASS_COLORS[p.observed]?.bg ?? ''} ${CLASS_COLORS[p.observed]?.text ?? ''}`}>
                    {p.observed}
                  </span>
                </td>
                <td className="py-1.5 text-center">
                  {correct
                    ? <span className="text-green-600 dark:text-green-400 text-xs font-bold">&#x2713;</span>
                    : <span className="text-red-500 dark:text-red-400 text-xs font-bold">&#x2717;</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">{filtered.length} of {predictions.length} stations shown</div>
    </div>
  );
}

function ModelComparisonTable({ modelComparisonData }: { modelComparisonData: any }) {
  const threeClass = (modelComparisonData as Record<string, unknown>).three_class as Record<string, {
    accuracy: number;
    n: number;
    cohen_kappa: number;
    brier_score?: number;
    per_class: Record<string, { precision: number; recall: number; f1: number }>;
  }>;

  if (!threeClass) return null;

  const models = Object.entries(threeClass);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-700">
          <th className="text-left py-2 font-medium text-slate-500 dark:text-slate-400">Model</th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">n</th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Accuracy <InfoTooltip {...TOOLTIP.accuracy} iconSize={12} /></span>
          </th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Kappa <InfoTooltip {...TOOLTIP.cohensKappaShort} iconSize={12} /></span>
          </th>
          <th className="text-right py-2 font-medium text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">High Recall <InfoTooltip {...TOOLTIP.highRiskRecall} iconSize={12} /></span>
          </th>
        </tr>
      </thead>
      <tbody>
        {models.map(([name, m]) => (
          <tr key={name} className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2 font-medium text-slate-700 dark:text-slate-300">{name.replace('_', ' ')}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.n}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{(m.accuracy * 100).toFixed(1)}%</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{m.cohen_kappa != null ? m.cohen_kappa.toFixed(3) : '\u2014'}</td>
            <td className="text-right py-2 text-slate-600 dark:text-slate-400">{(m.per_class?.High?.recall ?? 0).toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExportButton({ data, filename, label }: { data: unknown; filename: string; label: string }) {
  const handleExportCSV = () => {
    if (!Array.isArray(data) || data.length === 0) return;
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map((row: Record<string, unknown>) =>
        headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.replace('.csv', '.json');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-1">
      <button onClick={handleExportCSV} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        {label} CSV
      </button>
      <button onClick={handleExportJSON} className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
        JSON
      </button>
    </div>
  );
}

export function ValidationDashboard() {
  const { data: rawValData, loading: loadingVal, error: errorVal } = usePackArtifact<any>('validation');
  const { data: modelComparisonData, loading: loadingComp, error: errorComp } = usePackArtifact<any>('comparison');
  const [predFilter, setPredFilter] = useState('all');

  const loading = loadingVal || loadingComp;
  const error = errorVal || errorComp;

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

  const validationData = rawValData ? normalizeValidation(rawValData) : null;

  if (error || !validationData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{error ?? 'Failed to load data'}</div>
      </div>
    );
  }

  if (!modelComparisonData) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-red-500 text-sm">{errorComp ?? 'Failed to load comparison data'}</div>
      </div>
    );
  }

  const predictions: Prediction[] = validationData.predictions;
  const correctCount = predictions.filter((p) => p.predicted === p.observed).length;
  const nComplete = validationData.n_complete;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">QA/QC & Validation</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Leave-One-Out cross-validation results{nComplete ? ` for ${nComplete} stations` : ''}. {correctCount} correct{nComplete ? ` (${(correctCount / nComplete * 100).toFixed(1)}%)` : ''}.
        </p>
      </div>

      {predictions.length === 0 && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">No station-level predictions available for this pack.</p>
        </div>
      )}

      {/* Confusion Matrix */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Confusion Matrix</h3>
          <ExportButton data={predictions} filename="loo_predictions.csv" label="Export" />
        </div>
        <div className="flex justify-center">
          <ConfusionMatrix predictions={predictions} />
        </div>
      </div>

      {/* LOO Predictions Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">LOO Predictions</h3>
          <div className="flex gap-1">
            {['all', 'correct', 'incorrect', 'low', 'moderate', 'high'].map((f) => (
              <button
                key={f}
                onClick={() => setPredFilter(f)}
                className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                  predFilter === f
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <PredictionsTable predictions={predictions} filter={predFilter} />
      </div>

      {/* Model Comparison */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Model Comparison (M1-M4)</h3>
        <ModelComparisonTable modelComparisonData={modelComparisonData} />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          M1 Baseline uses raw WOE data. M2 Expert uses expert-elicited CPTs. M3 LoE uses harmonized ranks. M4 Split uses framework-specific models.
        </p>
      </div>
    </div>
  );
}
