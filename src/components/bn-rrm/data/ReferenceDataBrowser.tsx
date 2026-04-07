'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import type { PackManifest, PackRegistryEntry } from '@/lib/bn-rrm/pack-types';
import {
  Database,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  BookOpen,
  ChevronLeft,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirrored from BenchmarkDataViewer)
// ---------------------------------------------------------------------------

interface TrainingDataModel {
  display_name: string;
  fish_count: number;
  water_count: number;
  fish_columns: string[];
  water_columns: string[];
  fish_cases: Record<string, string>[];
  water_cases: Record<string, string>[];
}

interface TrainingData {
  source: string;
  doi: string;
  models: Record<string, TrainingDataModel>;
  totals: { fish: number; water: number; total: number };
}

type SortDir = 'asc' | 'desc' | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PACK_BASE_URL = '/bn-rrm';

function formatColumnHeader(col: string): string {
  return col
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Hg\b/i, 'Hg')
    .replace(/Thg\b/i, 'THg')
    .replace(/Gsl\b/i, 'GSL')
    .replace(/Gbs\b/i, 'GBS');
}

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
// Sub-component: Training data table viewer (reuses BenchmarkDataViewer logic)
// ---------------------------------------------------------------------------

function TrainingDataTableViewer({
  data,
  packDisplayName,
  onBack,
}: {
  data: TrainingData;
  packDisplayName: string;
  onBack: () => void;
}) {
  const modelKeys = Object.keys(data.models);
  const [selectedModel, setSelectedModel] = useState(modelKeys[0] ?? '');
  const [selectedDataset, setSelectedDataset] = useState<'fish' | 'water'>('fish');

  // Table state
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filterText, setFilterText] = useState('');
  const [filterCol, setFilterCol] = useState<string>('__all__');
  const [page, setPage] = useState(0);

  const model = data.models[selectedModel] ?? null;

  const rows = useMemo(() => {
    if (!model) return [];
    return selectedDataset === 'fish' ? model.fish_cases : model.water_cases;
  }, [model, selectedDataset]);

  const columns = useMemo(() => {
    if (!model) return [];
    return selectedDataset === 'fish' ? model.fish_columns : model.water_columns;
  }, [model, selectedDataset]);

  // Filter
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const needle = filterText.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterCol === '__all__') {
        return Object.values(row).some((v) => String(v).toLowerCase().includes(needle));
      }
      return String(row[filterCol] ?? '').toLowerCase().includes(needle);
    });
  }, [rows, filterText, filterCol]);

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return filteredRows;
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      const va = String(a[sortCol] ?? '');
      const vb = String(b[sortCol] ?? '');
      const cmp = va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredRows, sortCol, sortDir]);

  // Pagination
  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);
  const pageRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page on filter/sort/model/dataset change
  useEffect(() => {
    setPage(0);
  }, [filterText, filterCol, sortCol, sortDir, selectedModel, selectedDataset]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') {
        setSortCol(null);
        setSortDir(null);
      } else setSortDir('asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Value frequency for filtered column
  const valueFrequency = useMemo(() => {
    if (!filterCol || filterCol === '__all__' || rows.length === 0) return null;
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const v = String(r[filterCol] ?? '');
      counts[v] = (counts[v] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [rows, filterCol]);

  if (!model) return null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-5 overflow-y-auto">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All reference data
        </button>

        {/* Pack name */}
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 text-sm">
            {packDisplayName}
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Read-only reference</p>
        </div>

        {/* Model selector */}
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">
            Sub-model
          </h3>
          <div className="space-y-1">
            {modelKeys.map((key) => (
              <button
                key={key}
                onClick={() => setSelectedModel(key)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  selectedModel === key
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                )}
              >
                <div>{data.models[key].display_name}</div>
                <div className="text-[10px] opacity-70 mt-0.5">
                  {data.models[key].fish_count} fish, {data.models[key].water_count} water
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dataset selector */}
        <div>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">
            Dataset
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedDataset('fish')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedDataset === 'fish'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              Fish Tissue Hg
              <div className="text-[10px] opacity-70 mt-0.5">
                {model.fish_count} observations
              </div>
            </button>
            <button
              onClick={() => setSelectedDataset('water')}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedDataset === 'water'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              Freshwater THg
              <div className="text-[10px] opacity-70 mt-0.5">
                {model.water_count} observations
              </div>
            </button>
          </div>
        </div>

        {/* Quick stats for filtered column */}
        {valueFrequency && (
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 text-sm">
              {formatColumnHeader(filterCol)} values
            </h3>
            <div className="space-y-1">
              {valueFrequency.map(([val, count]) => (
                <button
                  key={val}
                  onClick={() => setFilterText(val)}
                  className="w-full flex items-center justify-between px-2 py-1 rounded text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="truncate">{val}</span>
                  <span className="text-slate-400 dark:text-slate-500 ml-2 tabular-nums">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Provenance */}
        <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Source: {data.source}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">DOI: {data.doi}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            {data.totals.total.toLocaleString()} total observations
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter values..."
                className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterCol}
                onChange={(e) => setFilterCol(e.target.value)}
                className="text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="__all__">All columns</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {formatColumnHeader(col)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {sortedRows.length === rows.length
              ? `${rows.length.toLocaleString()} rows`
              : `${sortedRows.length.toLocaleString()} / ${rows.length.toLocaleString()} rows`}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-12">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {formatColumnHeader(col)}
                      {sortCol === col ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {pageRows.map((row, i) => (
                <tr
                  key={page * PAGE_SIZE + i}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-1.5 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {(page * PAGE_SIZE + i + 1).toLocaleString()}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                    >
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="px-3 py-8 text-center text-slate-400 dark:text-slate-500"
                  >
                    {filterText ? 'No matching rows' : 'No data'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
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

  // Fetch manifests for all benchmark packs on mount
  useEffect(() => {
    benchmarkEntries.forEach((entry) => {
      if (manifests[entry.pack_id] !== undefined || manifestLoading[entry.pack_id]) return;

      setManifestLoading((prev) => ({ ...prev, [entry.pack_id]: true }));

      const url = `${PACK_BASE_URL}/${entry.path}/pack.json`;
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((manifest: PackManifest) => {
          setManifests((prev) => ({ ...prev, [entry.pack_id]: manifest }));
          setManifestErrors((prev) => ({ ...prev, [entry.pack_id]: null }));
        })
        .catch((err) => {
          setManifests((prev) => ({ ...prev, [entry.pack_id]: null }));
          setManifestErrors((prev) => ({
            ...prev,
            [entry.pack_id]: err instanceof Error ? err.message : String(err),
          }));
        })
        .finally(() => {
          setManifestLoading((prev) => ({ ...prev, [entry.pack_id]: false }));
        });
    });
  }, [benchmarkEntries]); // eslint-disable-line react-hooks/exhaustive-deps

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

    setDataLoading(true);
    setDataError(null);

    const url = `${PACK_BASE_URL}/${selectedEntry.path}/${trainingDataPath}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: TrainingData) => {
        setTrainingData(json);
      })
      .catch((err) => {
        setDataError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setDataLoading(false);
      });
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
      <TrainingDataTableViewer
        data={trainingData}
        packDisplayName={selectedEntry.display_name}
        onBack={() => {
          setSelectedEntry(null);
          setTrainingData(null);
          setDataError(null);
        }}
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
