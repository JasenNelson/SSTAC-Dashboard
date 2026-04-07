'use client';

import { useState, useEffect } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { Database } from 'lucide-react';
import { TrainingDataTable, type TrainingData } from './TrainingDataTable';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarkDataViewer() {
  const packBaseUrl = usePackStore((s) => s.getPackBaseUrl());
  const packManifest = usePackStore((s) => s.packManifest);

  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch training data from pack
  useEffect(() => {
    if (!packBaseUrl || !packManifest) return;

    const trainingDataPath = packManifest.artifacts.training_data;
    if (!trainingDataPath) {
      setError('No training_data artifact in pack manifest');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`${packBaseUrl}/${trainingDataPath}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TrainingData) => {
        setData(json);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [packBaseUrl, packManifest]);

  // --- Render ---

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Loading training data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
            <Database className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Failed to Load Training Data</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <Database className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Published Training Data</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {!packBaseUrl || !packManifest
              ? 'Select a benchmark pack to view its published training data.'
              : 'Loading training data...'}
          </p>
        </div>
      </div>
    );
  }

  return <TrainingDataTable data={data} />;
}
