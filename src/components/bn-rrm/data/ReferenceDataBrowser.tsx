'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import type { PackManifest, PackRegistryEntry } from '@/lib/bn-rrm/pack-types';
import {
  Database,
  BookOpen,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';
import { TrainingDataTable, type TrainingData } from './TrainingDataTable';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACK_BASE_URL = '/bn-rrm';

// ---------------------------------------------------------------------------
// Sub-component: Benchmark pack list
// ---------------------------------------------------------------------------

interface BenchmarkPackInfo {
  entry: PackRegistryEntry;
  manifest: PackManifest | null;
  loading: boolean;
  error: string | null;
  totalObservations: number | null;
}

function BenchmarkPackList({
  packs,
  onSelect,
}: {
  packs: BenchmarkPackInfo[];
  onSelect: (entry: PackRegistryEntry) => void;
}) {
  if (packs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-3">
          <BookOpen className="w-6 h-6 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
          No Reference Datasets Available
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Reference datasets come from benchmark packs with published training data.
          None are currently registered in the pack registry.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        Reference Datasets
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-6">
        Browse published benchmark training data. These are read-only datasets from peer-reviewed
        or validated BN-RRM case studies.
      </p>
      <div className="space-y-3">
        {packs.map((pack) => (
          <button
            key={pack.entry.pack_id}
            onClick={() => onSelect(pack.entry)}
            className="w-full text-left bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                    {pack.entry.display_name}
                  </h3>
                </div>
                {pack.loading && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Loading metadata...
                  </p>
                )}
                {pack.error && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-1">{pack.error}</p>
                )}
                {pack.manifest && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {pack.manifest.training_corpus.cohort_rule}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                        {pack.manifest.release_stage}
                      </span>
                      {pack.totalObservations !== null && (
                        <span>{pack.totalObservations.toLocaleString()} total observations</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <ExternalLink className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors mt-1 shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ReferenceDataBrowser() {
  const registry = usePackStore((s) => s.registry);

  // Track which benchmark pack the user has selected for viewing
  const [selectedEntry, setSelectedEntry] = useState<PackRegistryEntry | null>(null);

  // Manifests for benchmark packs (fetched on mount)
  const [manifests, setManifests] = useState<Record<string, PackManifest | null>>({});
  const [manifestLoading, setManifestLoading] = useState<Record<string, boolean>>({});
  const [manifestErrors, setManifestErrors] = useState<Record<string, string | null>>({});

  // Training data for selected pack
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Get benchmark packs from registry
  const benchmarkEntries = useMemo(() => {
    if (!registry) return [];
    return registry.packs.filter((p) => p.scope_type === 'benchmark');
  }, [registry]);

  // Fetch manifests for all benchmark packs on mount.
  // Uses a ref to track which pack IDs have already been fetched, avoiding
  // stale closure over manifests/manifestLoading state.
  const fetchedRef = useRef(new Set<string>());

  useEffect(() => {
    const controller = new AbortController();

    benchmarkEntries.forEach((entry) => {
      if (fetchedRef.current.has(entry.pack_id)) return;
      fetchedRef.current.add(entry.pack_id);

      setManifestLoading((prev) => ({ ...prev, [entry.pack_id]: true }));

      const url = `${PACK_BASE_URL}/${entry.path}/pack.json`;
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((manifest: PackManifest) => {
          if (controller.signal.aborted) return;
          setManifests((prev) => ({ ...prev, [entry.pack_id]: manifest }));
          setManifestErrors((prev) => ({ ...prev, [entry.pack_id]: null }));
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setManifests((prev) => ({ ...prev, [entry.pack_id]: null }));
          setManifestErrors((prev) => ({
            ...prev,
            [entry.pack_id]: err instanceof Error ? err.message : String(err),
          }));
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setManifestLoading((prev) => ({ ...prev, [entry.pack_id]: false }));
          }
        });
    });

    return () => controller.abort();
  }, [benchmarkEntries]);

  // Fetch training data when a pack is selected
  useEffect(() => {
    if (!selectedEntry) {
      setTrainingData(null);
      return;
    }

    const manifest = manifests[selectedEntry.pack_id];
    if (!manifest) return;

    const trainingDataPath = manifest.artifacts.training_data;
    if (!trainingDataPath) {
      setDataError('No training_data artifact in this pack');
      return;
    }

    const controller = new AbortController();
    setDataLoading(true);
    setDataError(null);

    const url = `${PACK_BASE_URL}/${selectedEntry.path}/${trainingDataPath}`;
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TrainingData) => {
        if (!controller.signal.aborted) setTrainingData(json);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setDataError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setDataLoading(false);
      });

    return () => controller.abort();
  }, [selectedEntry, manifests]);

  // Build pack info list for the list view
  const packInfoList: BenchmarkPackInfo[] = useMemo(() => {
    return benchmarkEntries.map((entry) => {
      const manifest = manifests[entry.pack_id] ?? null;
      let totalObservations: number | null = null;
      if (manifest) {
        const tc = manifest.training_corpus;
        if (tc.n_fish_cases != null && tc.n_water_cases != null) {
          totalObservations = tc.n_fish_cases + tc.n_water_cases;
        } else {
          totalObservations = tc.n_stations;
        }
      }
      return {
        entry,
        manifest,
        loading: manifestLoading[entry.pack_id] ?? false,
        error: manifestErrors[entry.pack_id] ?? null,
        totalObservations,
      };
    });
  }, [benchmarkEntries, manifests, manifestLoading, manifestErrors]);

  // --- Render ---

  // If a pack is selected and we're viewing its data
  if (selectedEntry && trainingData) {
    return (
      <TrainingDataTable
        data={trainingData}
        sidebarHeader={
          <>
            <button
              onClick={() => {
                setSelectedEntry(null);
                setTrainingData(null);
                setDataError(null);
              }}
              className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              All reference data
            </button>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 text-sm">
                {selectedEntry.display_name}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Read-only reference</p>
            </div>
          </>
        }
      />
    );
  }

  // Loading state for selected pack's training data
  if (selectedEntry && dataLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">Loading training data...</span>
        </div>
      </div>
    );
  }

  // Error state for selected pack's training data
  if (selectedEntry && dataError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
            <Database className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
            Failed to Load Training Data
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{dataError}</p>
          <button
            onClick={() => {
              setSelectedEntry(null);
              setDataError(null);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to reference datasets
          </button>
        </div>
      </div>
    );
  }

  // Default: show list of benchmark packs
  return <BenchmarkPackList packs={packInfoList} onSelect={setSelectedEntry} />;
}
