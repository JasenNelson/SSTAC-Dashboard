'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Database,
  Download,
  FlaskConical,
  Search,
  Upload,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/utils/cn';
import {
  buildSsdReceiptJson,
  buildSsdSpeciesCsv,
} from '@/lib/matrix-options/ssd/export';
import {
  DEFAULT_SSD_FIXTURE_DATASET_ID,
  getSsdFixtureDataset,
  SSD_FIXTURE_DATASETS,
  type SsdFixtureDatasetReference,
  type SsdFixtureDatasetId,
  type SsdFixtureValidationReference,
} from '@/lib/matrix-options/ssd/fixtures';
import { buildSsdAnalysis } from '@/lib/matrix-options/ssd/hcp';
import { parseSsdUpload } from '@/lib/matrix-options/ssd/upload';
import type {
  RawEcotoxRecord,
  SsdAnalysisMode,
  SsdAnalysisResult,
  SsdDistribution,
  SsdEnvironmentFilter,
  SsdMediaFilter,
  SpeciesAggregationMethod,
} from '@/lib/matrix-options/ssd/types';
import type { EvidenceLibraryFilterRequest } from '@/lib/matrix-options/provenance/types';

interface SsdWorkbenchProps {
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
  className?: string;
}

const ENDPOINT_OPTIONS = ['Mortality', 'Growth', 'Reproduction', 'Development'];
const OWNER_REPORTED_ECOTOX_ROWS = 582125;
type PlotScale = 'log' | 'linear';
type DataSourceMode = 'fixture' | 'upload' | 'ecotox_mirror';
type LiveStatus = 'idle' | 'searching' | 'loading_records' | 'ready' | 'not_configured' | 'error';

interface SsdRunState {
  rows: RawEcotoxRecord[];
  fixtureDatasetId: SsdFixtureDatasetId;
  chemicalName: string;
  mediaFilter: SsdMediaFilter;
  environmentFilter: SsdEnvironmentFilter;
  endpointFilters: string[];
  aggregationMethod: SpeciesAggregationMethod;
  pValue: number;
  analysisMode: SsdAnalysisMode;
  selectedDistribution: SsdDistribution;
  bootstrapIterations: number;
  dataSourceMode: DataSourceMode;
  extractedAt: string;
}

const MEDIA_FILTER_LABELS: Record<SsdMediaFilter, string> = {
  water: 'Water',
  sediment: 'Sediment',
};

const ENVIRONMENT_FILTER_LABELS: Record<SsdEnvironmentFilter, string> = {
  all: 'All environments',
  freshwater: 'Freshwater',
  marine: 'Marine',
};

const DEFAULT_FIXTURE_DATASET = getSsdFixtureDataset(
  DEFAULT_SSD_FIXTURE_DATASET_ID,
);

function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return 'n/a';
  return value.toLocaleString(undefined, {
    maximumSignificantDigits: digits,
  });
}

function modeLabel(mode: SsdAnalysisMode): string {
  switch (mode) {
    case 'model_averaging':
      return 'AICc model averaging';
    case 'single_distribution':
      return 'single distribution';
    default:
      return 'empirical preview';
  }
}

function hcpLabel(pValue: number): string {
  return `HC${Math.round(pValue * 100)}`;
}

function referenceStatus(
  reference: SsdFixtureValidationReference,
  result: SsdAnalysisResult,
): {
  comparable: boolean;
  withinTolerance: boolean;
  delta: number | null;
  label: string;
} {
  const modeMatches = result.settings.analysisMode === reference.analysisMode;
  const percentileMatches = Math.abs(result.pValue - reference.pValue) < 1e-9;
  const unitMatches = result.unit === reference.unit;
  const comparable =
    modeMatches && percentileMatches && unitMatches && Number.isFinite(result.hcp);
  const delta = comparable ? result.hcp - reference.expectedHcp : null;
  const withinTolerance =
    delta !== null && Math.abs(delta) <= reference.tolerance;

  if (!comparable) {
    return {
      comparable,
      withinTolerance: false,
      delta,
      label: `Select ${modeLabel(reference.analysisMode)} ${hcpLabel(
        reference.pValue,
      )}`,
    };
  }

  return {
    comparable,
    withinTolerance,
    delta,
    label: withinTolerance ? 'Within tolerance' : 'Outside tolerance',
  };
}

function datasetReferenceStatus(
  reference: SsdFixtureDatasetReference,
  rows: RawEcotoxRecord[],
): {
  rowsMatch: boolean;
  unitMatches: boolean;
  label: string;
  currentUnit: string;
} {
  const units = Array.from(
    new Set(
      rows
        .map((row) => row.unit?.trim())
        .filter((unit): unit is string => Boolean(unit)),
    ),
  );
  const currentUnit = units.length === 1 ? units[0] : 'mixed units';
  const rowsMatch = rows.length === reference.expectedRows;
  const unitMatches = currentUnit === reference.expectedUnit;

  return {
    rowsMatch,
    unitMatches,
    label: rowsMatch && unitMatches ? 'Dataset matches' : 'Dataset mismatch',
    currentUnit,
  };
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function liveStatusLabel(status: LiveStatus): string {
  switch (status) {
    case 'searching':
      return 'Searching ECOTOX mirror...';
    case 'loading_records':
      return 'Loading selected ECOTOX records...';
    case 'ready':
      return 'Live ECOTOX mirror records loaded.';
    case 'not_configured':
      return 'ECOTOX mirror is not configured in this environment.';
    case 'error':
      return 'ECOTOX mirror request failed.';
    default:
      return 'Use validation mode or search the ECOTOX mirror.';
  }
}

function endpointLabel(endpointFilters: string[]): string {
  return endpointFilters.length === 0
    ? 'All endpoints'
    : endpointFilters.join(', ');
}

function runStateMatchesDraft(
  runState: SsdRunState,
  draftState: SsdRunState,
): boolean {
  return (
    runState.rows === draftState.rows &&
    runState.fixtureDatasetId === draftState.fixtureDatasetId &&
    runState.chemicalName === draftState.chemicalName &&
    runState.mediaFilter === draftState.mediaFilter &&
    runState.environmentFilter === draftState.environmentFilter &&
    runState.aggregationMethod === draftState.aggregationMethod &&
    runState.pValue === draftState.pValue &&
    runState.analysisMode === draftState.analysisMode &&
    runState.selectedDistribution === draftState.selectedDistribution &&
    runState.bootstrapIterations === draftState.bootstrapIterations &&
    runState.dataSourceMode === draftState.dataSourceMode &&
    runState.endpointFilters.length === draftState.endpointFilters.length &&
    runState.endpointFilters.every(
      (value, index) => value === draftState.endpointFilters[index],
    )
  );
}

function slugifyFilePart(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'ssd';
}

function downloadTextFile(
  fileName: string,
  content: string,
  type: string,
): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildConcentrationTicks(
  chartData: Array<{ value: number }>,
): number[] {
  const sortedValues = Array.from(
    new Set(
      chartData
        .map((point) => point.value)
        .filter((value) => Number.isFinite(value) && value > 0),
    ),
  ).sort((a, b) => a - b);

  if (sortedValues.length <= 5) return sortedValues;
  const indices = [
    0,
    Math.floor((sortedValues.length - 1) * 0.25),
    Math.floor((sortedValues.length - 1) * 0.5),
    Math.floor((sortedValues.length - 1) * 0.75),
    sortedValues.length - 1,
  ];
  return Array.from(new Set(indices.map((index) => sortedValues[index])));
}

function ToggleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'border-sky-600 bg-sky-600 text-white shadow-sm dark:border-sky-500 dark:bg-sky-500'
          : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
      )}
    >
      {children}
    </button>
  );
}

export default function SsdWorkbench({
  onOpenEvidenceLibrary,
  className,
}: SsdWorkbenchProps) {
  const [fixtureDatasetId, setFixtureDatasetId] =
    useState<SsdFixtureDatasetId>(DEFAULT_SSD_FIXTURE_DATASET_ID);
  const [chemicalSearch, setChemicalSearch] = useState(
    DEFAULT_FIXTURE_DATASET.chemicalName,
  );
  const [mediaFilter, setMediaFilter] =
    useState<SsdMediaFilter>('water');
  const [environmentFilter, setEnvironmentFilter] =
    useState<SsdEnvironmentFilter>('freshwater');
  const [endpointFilters, setEndpointFilters] = useState<string[]>([]);
  const [aggregationMethod, setAggregationMethod] =
    useState<SpeciesAggregationMethod>('geometric_mean');
  const [pValue, setPValue] = useState(0.05);
  const [bootstrapIterations, setBootstrapIterations] = useState(0);
  const [analysisMode, setAnalysisMode] =
    useState<SsdAnalysisMode>('empirical_preview');
  const [selectedDistribution, setSelectedDistribution] =
    useState<SsdDistribution>('Log-Normal');
  const [plotScale, setPlotScale] = useState<PlotScale>('log');
  const [showEmpiricalCurve, setShowEmpiricalCurve] = useState(true);
  const [showFittedCurve, setShowFittedCurve] = useState(true);
  const [showSpeciesPoints, setShowSpeciesPoints] = useState(true);
  const [dataSourceMode, setDataSourceMode] =
    useState<DataSourceMode>('fixture');
  const [uploadedRows, setUploadedRows] = useState<RawEcotoxRecord[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [chemicalSuggestions, setChemicalSuggestions] = useState<string[]>([]);
  const [liveRows, setLiveRows] = useState<RawEcotoxRecord[]>([]);
  const [liveStatus, setLiveStatus] = useState<LiveStatus>('idle');
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [liveRowsTruncated, setLiveRowsTruncated] = useState(false);
  const [runState, setRunState] = useState<SsdRunState>(() => ({
    rows: DEFAULT_FIXTURE_DATASET.rows,
    fixtureDatasetId: DEFAULT_FIXTURE_DATASET.id,
    chemicalName: DEFAULT_FIXTURE_DATASET.chemicalName,
    mediaFilter: 'water',
    environmentFilter: 'freshwater',
    endpointFilters: [],
    aggregationMethod: 'geometric_mean',
    pValue: 0.05,
    analysisMode: 'empirical_preview',
    selectedDistribution: 'Log-Normal',
    bootstrapIterations: 0,
    dataSourceMode: 'fixture',
    extractedAt: todayIsoDate(),
  }));

  const selectedFixtureDataset = getSsdFixtureDataset(fixtureDatasetId);
  const runFixtureDataset = getSsdFixtureDataset(runState.fixtureDatasetId);
  const selectedRows =
    dataSourceMode === 'fixture'
      ? selectedFixtureDataset.rows
      : dataSourceMode === 'upload'
        ? uploadedRows
        : liveRows;
  const selectedChemicalName =
    chemicalSearch.trim() || selectedFixtureDataset.chemicalName;
  const draftRunState: SsdRunState = useMemo(
    () => ({
      rows: selectedRows,
      fixtureDatasetId,
      chemicalName: selectedChemicalName,
      mediaFilter,
      environmentFilter,
      endpointFilters,
      aggregationMethod,
      pValue,
      analysisMode,
      selectedDistribution,
      bootstrapIterations,
      dataSourceMode,
      extractedAt: todayIsoDate(),
    }),
    [
      aggregationMethod,
      analysisMode,
      bootstrapIterations,
      dataSourceMode,
      endpointFilters,
      environmentFilter,
      fixtureDatasetId,
      mediaFilter,
      pValue,
      selectedDistribution,
      selectedChemicalName,
      selectedRows,
    ],
  );
  const hasPendingRunChanges = !runStateMatchesDraft(runState, draftRunState);

  const result: SsdAnalysisResult = useMemo(
    () =>
      buildSsdAnalysis(runState.rows, {
        chemicalNames: [runState.chemicalName],
        mediaFilter: runState.mediaFilter,
        environmentFilter: runState.environmentFilter,
        endpointFilters: runState.endpointFilters,
        aggregationMethod: runState.aggregationMethod,
        pValue: runState.pValue,
        analysisMode: runState.analysisMode,
        selectedDistribution: runState.selectedDistribution,
        bootstrapIterations: runState.bootstrapIterations,
        randomSeed: 42,
        sourceMode: runState.dataSourceMode,
        ecotoxMirrorRecordCount: OWNER_REPORTED_ECOTOX_ROWS,
        extractedAt: runState.extractedAt,
      }),
    [runState],
  );

  const chartData = result.empiricalPoints.map((point) => ({
    species: point.speciesScientificName,
    group: point.broadGroup,
    value: point.value,
    percentAffected: point.percentAffected,
  }));
  const canPlotPreview = chartData.length >= 2;
  const hasHcpPreview = Number.isFinite(result.hcp);
  const concentrationTicks = buildConcentrationTicks(chartData);
  const canPlotFittedCurve =
    showFittedCurve && result.fittedCurvePoints.length >= 2;
  const fittedCurveLabel =
    result.fittedCurvePoints[0]?.distribution === 'Model Average'
      ? 'Model average'
      : result.fittedCurvePoints[0]?.distribution
        ? `${result.fittedCurvePoints[0].distribution} fit`
        : 'Fitted curve';

  const activeEndpointLabel = endpointLabel(result.settings.endpointFilters);
  const activeMediaLabel = MEDIA_FILTER_LABELS[result.settings.mediaFilter];
  const activeEnvironmentLabel =
    ENVIRONMENT_FILTER_LABELS[result.settings.environmentFilter];
  const exportFileStem = slugifyFilePart(
    `${result.settings.chemicalNames[0] ?? 'ssd'}-${activeMediaLabel}-${activeEnvironmentLabel}`,
  );

  const toggleEndpoint = (endpoint: string): void => {
    setEndpointFilters((current) =>
      current.includes(endpoint)
        ? current.filter((value) => value !== endpoint)
        : [...current, endpoint],
    );
  };

  const selectFixtureDataset = (nextFixtureId: SsdFixtureDatasetId): void => {
    const nextFixture = getSsdFixtureDataset(nextFixtureId);
    setFixtureDatasetId(nextFixture.id);
    setDataSourceMode('fixture');
    setChemicalSearch(nextFixture.chemicalName);
    setMediaFilter('water');
    setEnvironmentFilter('freshwater');
    setEndpointFilters([]);
    setLiveMessage(null);
    setUploadMessage(null);
  };

  const selectMediaFilter = (nextMediaFilter: SsdMediaFilter): void => {
    setMediaFilter(nextMediaFilter);
    if (nextMediaFilter === 'sediment') {
      setEnvironmentFilter('all');
    }
  };

  const handleUploadFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseSsdUpload(text, file.name);
      const uploadedChemicals = Array.from(
        new Set(
          rows
            .map((row) => row.chemical_name?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      );
      setUploadedRows(rows);
      setDataSourceMode('upload');
      if (uploadedChemicals.length === 1) {
        setChemicalSearch(uploadedChemicals[0]);
      }
      setUploadMessage(
        `${rows.length.toLocaleString()} uploaded records loaded.`,
      );
      setLiveMessage(null);
    } catch (err) {
      setUploadedRows([]);
      setDataSourceMode('upload');
      setUploadMessage(
        err instanceof Error
          ? err.message
          : 'Upload could not be parsed. Use CSV or JSON.',
      );
    } finally {
      event.target.value = '';
    }
  };

  const searchLiveChemicals = async (): Promise<void> => {
    const term = chemicalSearch.trim();
    if (term.length < 2) {
      setChemicalSuggestions([]);
      setLiveStatus('idle');
      setLiveMessage('Enter at least two characters to search.');
      return;
    }

    setDataSourceMode('ecotox_mirror');
    setLiveStatus('searching');
    setLiveMessage(null);
    try {
      const response = await fetch(
        `/api/matrix-options/ssd/chemicals?q=${encodeURIComponent(term)}`,
      );
      const payload = await response.json();
      if (response.status === 503) {
        setChemicalSuggestions([]);
        setLiveStatus('not_configured');
        setLiveMessage(liveStatusLabel('not_configured'));
        return;
      }
      if (!response.ok) throw new Error('chemical_search_failed');
      const chemicals = Array.isArray(payload.chemicals)
        ? payload.chemicals.filter((value: unknown): value is string =>
            typeof value === 'string',
          )
        : [];
      setChemicalSuggestions(chemicals);
      setLiveStatus('idle');
      setLiveMessage(
        chemicals.length > 0
          ? `${chemicals.length} chemical matches returned.`
          : 'No chemical matches returned.',
      );
    } catch {
      setChemicalSuggestions([]);
      setLiveStatus('error');
      setLiveMessage(liveStatusLabel('error'));
    }
  };

  const loadLiveRows = async (): Promise<void> => {
    const chemicalName = chemicalSearch.trim();
    if (!chemicalName) {
      setLiveMessage('Select or enter a chemical before loading records.');
      return;
    }

    setDataSourceMode('ecotox_mirror');
    setLiveStatus('loading_records');
    setLiveMessage(null);
    try {
      const response = await fetch('/api/matrix-options/ssd/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chemicalNames: [chemicalName],
          medium:
            environmentFilter === 'all' ? undefined : environmentFilter,
          mediaFilter,
          endpointFilters,
          maxRows: 5000,
        }),
      });
      const payload = await response.json();
      if (response.status === 503) {
        setLiveRows([]);
        setLiveRowsTruncated(false);
        setLiveStatus('not_configured');
        setLiveMessage(liveStatusLabel('not_configured'));
        return;
      }
      if (!response.ok) throw new Error('ecotox_record_fetch_failed');
      const rows = Array.isArray(payload.rows)
        ? (payload.rows as RawEcotoxRecord[])
        : [];
      setLiveRows(rows);
      setLiveRowsTruncated(Boolean(payload.truncated));
      setLiveStatus('ready');
      setLiveMessage(
        `${rows.length.toLocaleString()} ECOTOX mirror records loaded${
          payload.truncated ? ' before the 5,000-row cap.' : '.'
        }`,
      );
    } catch {
      setLiveRows([]);
      setLiveRowsTruncated(false);
      setLiveStatus('error');
      setLiveMessage(liveStatusLabel('error'));
    }
  };

  const downloadSpeciesCsv = (): void => {
    downloadTextFile(
      `${exportFileStem}-species-aggregates.csv`,
      buildSsdSpeciesCsv(result),
      'text/csv;charset=utf-8',
    );
  };

  const downloadReceiptJson = (): void => {
    downloadTextFile(
      `${exportFileStem}-receipt.json`,
      buildSsdReceiptJson(result),
      'application/json;charset=utf-8',
    );
  };

  const runSsdAnalysis = (): void => {
    setRunState({
      ...draftRunState,
      endpointFilters: [...draftRunState.endpointFilters],
      extractedAt: todayIsoDate(),
    });
  };

  return (
    <section
      className={cn('min-w-0 space-y-6', className)}
      data-testid="ssd-workbench"
    >
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            <FlaskConical className="h-4 w-4" />
            SSD Workbench
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Species Sensitivity Distribution candidate generator
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Build a reviewable HCp candidate from selected ECOTOX-style records.
            This slice exposes validation datasets, upload, and read-only ECOTOX mirror
            inputs with an ssdtools-aligned TypeScript fitting path pending
            official R snapshot validation.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Derived candidate only. Not calculation-driving.
        </div>
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Data source
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ToggleButton
                active={dataSourceMode === 'fixture'}
                onClick={() => selectFixtureDataset(fixtureDatasetId)}
              >
                Validation
              </ToggleButton>
              <ToggleButton
                active={dataSourceMode === 'upload'}
                onClick={() => setDataSourceMode('upload')}
              >
                Upload
              </ToggleButton>
              <ToggleButton
                active={dataSourceMode === 'ecotox_mirror'}
                onClick={() => setDataSourceMode('ecotox_mirror')}
              >
                ECOTOX mirror
              </ToggleButton>
            </div>
            {dataSourceMode === 'fixture' && (
              <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <label className="block font-semibold text-slate-700 dark:text-slate-100">
                  Validation dataset
                  <select
                    value={fixtureDatasetId}
                    onChange={(event) =>
                      selectFixtureDataset(
                        event.target.value as SsdFixtureDatasetId,
                      )
                    }
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {SSD_FIXTURE_DATASETS.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
                      selectedFixtureDataset.role === 'validation'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200',
                    )}
                  >
                    {selectedFixtureDataset.role === 'validation'
                      ? 'Validation dataset'
                      : 'Preview dataset'}
                  </span>
                  <span>{selectedFixtureDataset.rows.length} source rows</span>
                </div>
                <p className="mt-2">{selectedFixtureDataset.sourceLabel}</p>
              </div>
            )}
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <Upload className="h-4 w-4" />
              Upload CSV or JSON
              <input
                type="file"
                accept=".csv,.json,application/json,text/csv"
                onChange={(event) => void handleUploadFile(event)}
                className="sr-only"
              />
            </label>
            {dataSourceMode === 'upload' && (
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                  Uploaded file mode
                </p>
                <p className="mt-1">
                  {uploadMessage ??
                    'Upload a CSV or JSON file with chemical, species, value, unit, media, and endpoint columns.'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="ssd-chemical-search"
              className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Chemical search
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                id="ssd-chemical-search"
                value={chemicalSearch}
                onChange={(event) => setChemicalSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none dark:text-white"
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Validation mode can load preview and validation datasets. Upload mode
              accepts local ECOTOX-style extracts. ECOTOX mirror mode queries capped
              server-side API routes when configured.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void searchLiveChemicals()}
                disabled={liveStatus === 'searching'}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                Search mirror
              </button>
              <button
                type="button"
                onClick={() => void loadLiveRows()}
                disabled={liveStatus === 'loading_records'}
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Load records
              </button>
            </div>
            {chemicalSuggestions.length > 0 && (
              <div className="mt-3 max-h-36 overflow-auto rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
                {chemicalSuggestions.slice(0, 8).map((chemical) => (
                  <button
                    key={chemical}
                    type="button"
                    onClick={() => setChemicalSearch(chemical)}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {chemical}
                  </button>
                ))}
              </div>
            )}
            {dataSourceMode === 'ecotox_mirror' && (
              <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                  {liveStatusLabel(liveStatus)}
                </p>
                {liveMessage && <p className="mt-1">{liveMessage}</p>}
                {liveRowsTruncated && (
                  <p className="mt-1 text-amber-700 dark:text-amber-300">
                    Results were capped at 5,000 rows for browser safety.
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Media filter
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ToggleButton
                active={mediaFilter === 'water'}
                onClick={() => selectMediaFilter('water')}
              >
                Water
              </ToggleButton>
              <ToggleButton
                active={mediaFilter === 'sediment'}
                onClick={() => selectMediaFilter('sediment')}
              >
                Sediment
              </ToggleButton>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aquatic environment
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <ToggleButton
                active={environmentFilter === 'all'}
                onClick={() => setEnvironmentFilter('all')}
              >
                All
              </ToggleButton>
              <ToggleButton
                active={environmentFilter === 'freshwater'}
                onClick={() => setEnvironmentFilter('freshwater')}
              >
                Freshwater
              </ToggleButton>
              <ToggleButton
                active={environmentFilter === 'marine'}
                onClick={() => setEnvironmentFilter('marine')}
              >
                Marine
              </ToggleButton>
            </div>
            {mediaFilter === 'sediment' && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sediment records use All by default until ECOTOX sediment
                freshwater/marine mapping is verified.
              </p>
            )}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Endpoint filters
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ENDPOINT_OPTIONS.map((endpoint) => (
                <ToggleButton
                  key={endpoint}
                  active={endpointFilters.includes(endpoint)}
                  onClick={() => toggleEndpoint(endpoint)}
                >
                  {endpoint}
                </ToggleButton>
              ))}
            </div>
          </div>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Species aggregation
            <select
              value={aggregationMethod}
              onChange={(event) =>
                setAggregationMethod(event.target.value as SpeciesAggregationMethod)
              }
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="geometric_mean">Geometric mean</option>
              <option value="most_sensitive">Most sensitive</option>
            </select>
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            HCp percentile
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={pValue}
              onChange={(event) => setPValue(Number(event.target.value))}
              className="mt-3 w-full accent-sky-600"
            />
            <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-white">
              HC{Math.round(pValue * 100)}
            </span>
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Bootstrap CI
            <select
              value={bootstrapIterations}
              onChange={(event) => setBootstrapIterations(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value={0}>Off</option>
              <option value={25}>25 iterations</option>
              <option value={100}>100 iterations</option>
              <option value={250}>250 iterations</option>
            </select>
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Analysis mode
            <select
              value={analysisMode}
              onChange={(event) =>
                setAnalysisMode(event.target.value as SsdAnalysisMode)
              }
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="empirical_preview">Empirical preview</option>
              <option value="single_distribution">Single distribution</option>
              <option value="model_averaging">AICc model averaging</option>
            </select>
          </label>

          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Distribution
            <select
              value={selectedDistribution}
              onChange={(event) =>
                setSelectedDistribution(event.target.value as SsdDistribution)
              }
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="Gamma">Gamma</option>
              <option value="Log-Gumbel">Log-Gumbel</option>
              <option value="Log-Logistic">Log-Logistic</option>
              <option value="Log-Normal">Log-Normal</option>
              <option value="Log-Normal Mixture">Log-Normal Mixture</option>
              <option value="Weibull">Weibull</option>
            </select>
          </label>

          <div
            className={cn(
              'rounded-lg border p-3',
              hasPendingRunChanges
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-900/20',
            )}
            data-testid="ssd-run-panel"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Run control
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {hasPendingRunChanges
                    ? 'Settings are staged. Results below still show the last run.'
                    : 'Results match the current staged settings.'}
                </p>
              </div>
              <button
                type="button"
                onClick={runSsdAnalysis}
                className="shrink-0 rounded-md bg-sky-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-800 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                Run SSD
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div>
                <dt className="font-semibold">Last run</dt>
                <dd>
                  HC{Math.round(result.settings.pValue * 100)};{' '}
                  {modeLabel(result.settings.analysisMode)}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Bootstrap</dt>
                <dd>
                  {result.settings.bootstrapIterations > 0
                    ? `${result.settings.bootstrapIterations} iterations`
                    : 'Off'}
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Plot options
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ToggleButton
                active={plotScale === 'log'}
                onClick={() => setPlotScale('log')}
              >
                Log scale
              </ToggleButton>
              <ToggleButton
                active={plotScale === 'linear'}
                onClick={() => setPlotScale('linear')}
              >
                Linear
              </ToggleButton>
            </div>
            <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showEmpiricalCurve}
                  onChange={(event) => setShowEmpiricalCurve(event.target.checked)}
                  className="h-4 w-4 accent-sky-600"
                />
                Empirical curve
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showFittedCurve}
                  onChange={(event) => setShowFittedCurve(event.target.checked)}
                  className="h-4 w-4 accent-violet-600"
                />
                Fitted curve
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showSpeciesPoints}
                  onChange={(event) => setShowSpeciesPoints(event.target.checked)}
                  className="h-4 w-4 accent-amber-500"
                />
                Species points
              </label>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          {hasPendingRunChanges && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
              <div className="font-bold">Pending SSD settings</div>
              <p className="mt-1 leading-relaxed">
                Results below are from the last run. Use Run SSD after changing
                filters, model mode, HCp percentile, distribution, or bootstrap
                settings.
              </p>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['HCp', hasHcpPreview ? `${formatNumber(result.hcp)} ${result.unit}` : 'Needs data'],
              ['Species', String(result.speciesCount)],
              ['Records used', String(result.cleanedRecordCount)],
              ['Excluded', String(result.excludedRecordCount)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {label}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <details
            className="group rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
            data-testid="ssd-validation-panel"
          >
            <summary className="flex cursor-pointer list-none flex-col gap-2 text-sm font-bold text-slate-950 dark:text-white sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                Validation and verification
              </span>
              <span className="ml-6 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:ml-0">
                {result.settings.sourceMode === 'fixture'
                  ? runFixtureDataset.label
                  : result.settings.sourceMode === 'upload'
                    ? 'Uploaded data'
                    : 'ECOTOX mirror data'}
              </span>
            </summary>
            <div className="mt-4 grid gap-4 text-sm text-slate-600 dark:text-slate-300 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current source
                </div>
                <dl className="mt-3 space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt>Dataset</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {result.settings.sourceMode === 'fixture'
                        ? runFixtureDataset.label
                        : result.settings.sourceMode === 'upload'
                          ? 'Local upload'
                          : 'Read-only ECOTOX mirror'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Rows loaded</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {runState.rows.length.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Rows used</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {result.cleanedRecordCount.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Unit</dt>
                    <dd className="font-semibold text-slate-900 dark:text-white">
                      {result.unit}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Verification status
                </div>
                <p className="mt-3 leading-relaxed">
                  {result.settings.sourceMode === 'fixture'
                    ? runFixtureDataset.validationNote
                    : 'Use validation datasets to compare the TypeScript output against official ssdtools and ssddata reference behavior.'}
                </p>
                {result.settings.sourceMode === 'fixture' && (
                  <dl className="mt-3 space-y-2">
                    <div className="flex justify-between gap-4">
                      <dt>Source</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {runFixtureDataset.sourceLabel}
                      </dd>
                    </div>
                    {runFixtureDataset.sourceUrl.startsWith('https://') && (
                      <div className="flex justify-between gap-4">
                        <dt>Reference page</dt>
                        <dd>
                          <a
                            href={runFixtureDataset.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300"
                          >
                            Open reference
                          </a>
                        </dd>
                      </div>
                    )}
                    {runFixtureDataset.sourceDetailUrl.startsWith(
                      'https://',
                    ) && (
                      <div className="flex justify-between gap-4">
                        <dt>CCME page</dt>
                        <dd>
                          <a
                            href={runFixtureDataset.sourceDetailUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300"
                          >
                            Open source
                          </a>
                        </dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4">
                      <dt>Accessed</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">
                        {runFixtureDataset.sourceAccessedAt}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
              {result.settings.sourceMode === 'fixture' &&
              (runFixtureDataset.validationReferences?.length ||
                runFixtureDataset.datasetReferences?.length) ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40 lg:col-span-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Reference checks
                    </div>
                    <div className="mt-3 space-y-3">
                      {runFixtureDataset.validationReferences?.map((reference) => {
                        const status = referenceStatus(reference, result);
                        return (
                          <div
                            key={reference.label}
                            className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {reference.label}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                  Reference {hcpLabel(reference.pValue)}:{' '}
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {formatNumber(reference.expectedHcp, 6)}{' '}
                                    {reference.unit}
                                  </span>
                                  . Compared with the current run using the
                                  same validation dataset and model mode.
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                                  status.comparable && status.withinTolerance
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
                                    : status.comparable
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-100'
                                      : 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100',
                                )}
                              >
                                {status.comparable && status.withinTolerance ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                                {status.label}
                              </span>
                            </div>
                            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Current
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  {status.comparable
                                    ? `${formatNumber(result.hcp, 6)} ${result.unit}`
                                    : 'Not comparable'}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Delta
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  {status.delta === null
                                    ? 'n/a'
                                    : `${formatNumber(Math.abs(status.delta), 4)} ${reference.unit}`}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Tolerance
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  {formatNumber(reference.tolerance, 4)}{' '}
                                  {reference.unit}
                                </dd>
                              </div>
                            </dl>
                            {reference.sourceUrl.startsWith('https://') && (
                              <a
                                href={reference.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300"
                              >
                                Open reference source
                              </a>
                            )}
                          </div>
                        );
                      })}
                      {runFixtureDataset.datasetReferences?.map((reference) => {
                        const status = datasetReferenceStatus(
                          reference,
                          runState.rows,
                        );
                        return (
                          <div
                            key={reference.label}
                            className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {reference.label}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                  Expected {reference.expectedRows} source rows
                                  with {reference.expectedUnit} units from{' '}
                                  {reference.sourceLabel}.
                                </p>
                              </div>
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                                  status.rowsMatch && status.unitMatches
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-100',
                                )}
                              >
                                {status.rowsMatch && status.unitMatches ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                )}
                                {status.label}
                              </span>
                            </div>
                            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Current
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  {runState.rows.length} source rows
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  Units
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  {status.currentUnit}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-slate-500 dark:text-slate-400">
                                  HCp snapshot
                                </dt>
                                <dd className="font-semibold text-slate-900 dark:text-white">
                                  Not yet added
                                </dd>
                              </div>
                            </dl>
                            {reference.sourceUrl.startsWith('https://') && (
                              <a
                                href={reference.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-300"
                              >
                                Open dataset source
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : result.settings.sourceMode === 'fixture' &&
                  runFixtureDataset.role === 'validation' ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100 lg:col-span-2">
                    <div className="text-xs font-bold uppercase tracking-wider">
                      Reference checks pending
                    </div>
                    <p className="mt-2 leading-relaxed">
                      This validation dataset is loaded for transparency, but
                      no official ssdtools HCp snapshot has been added to the
                      local reference-check table yet. Use it for validation
                      regression coverage until an R-generated snapshot is
                      reviewed.
                    </p>
                  </div>
                ) : null}
            </div>
          </details>

          <details className="group rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <summary className="flex cursor-pointer list-none flex-col gap-2 text-sm font-bold text-slate-950 dark:text-white sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                Model diagnostics
              </span>
              <span className="ml-6 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:ml-0">
                {result.diagnostics.length} rows;{' '}
                {result.settings.analysisMode.replace('_', ' ')}
              </span>
            </summary>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Compare empirical HCp, single-distribution fits, and the
              ssdtools-style AICc model average before treating the result as a
              candidate.
            </p>
            <div className="mt-4 max-h-64 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table
                className="min-w-full text-left text-xs"
                data-testid="ssd-model-diagnostics-table"
              >
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Model</th>
                    <th className="px-3 py-2 font-semibold">HCp</th>
                    <th className="px-3 py-2 font-semibold">Weight</th>
                    <th className="px-3 py-2 font-semibold">Delta</th>
                    <th className="px-3 py-2 font-semibold">AICc</th>
                    <th className="px-3 py-2 font-semibold">Parameters</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.diagnostics.length > 0 ? (
                    result.diagnostics.map((diagnostic) => (
                      <tr key={`${diagnostic.name}-${diagnostic.mode}`}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          {diagnostic.name}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {formatNumber(diagnostic.hcp)} {result.unit}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {formatNumber(diagnostic.weight, 3)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {diagnostic.deltaAicc === null ||
                          diagnostic.deltaAicc === undefined
                            ? 'n/a'
                            : formatNumber(diagnostic.deltaAicc, 3)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {diagnostic.aicc === null
                            ? 'n/a'
                            : formatNumber(diagnostic.aicc)}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {diagnostic.parameters.length === 0
                            ? 'n/a'
                            : diagnostic.parameters
                                .map(
                                  (parameter) =>
                                    `${parameter.name}=${formatNumber(
                                      parameter.value,
                                      4,
                                    )}`,
                                )
                                .join('; ')}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {diagnostic.note}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No model diagnostics are available for the current
                        filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Empirical SSD preview
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activeMediaLabel}; {activeEnvironmentLabel};{' '}
                  {activeEndpointLabel};{' '}
                  {result.settings.aggregationMethod.replace('_', ' ')}.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-100">
                <Database className="h-3.5 w-3.5" />
                ECOTOX mirror approx {OWNER_REPORTED_ECOTOX_ROWS.toLocaleString()} rows
              </div>
            </div>
            {!hasHcpPreview && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                Insufficient data for HCp preview. At least five species are
                required before the candidate value is calculated.
              </div>
            )}
            <div className="mt-4 min-w-0 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              {canPlotPreview ? (
                <>
                  <div className="mb-2 flex flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>Species affected (%)</span>
                    <span>
                      Concentration ({result.unit},{' '}
                      {plotScale === 'log' ? 'log scale' : 'linear scale'})
                    </span>
                  </div>
                  <div className="h-[19rem] min-w-0 overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ left: 8, right: 18, top: 10, bottom: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="value"
                          type="number"
                          scale={plotScale}
                          domain={plotScale === 'log' ? ['dataMin', 'dataMax'] : [0, 'dataMax']}
                          ticks={concentrationTicks}
                          tickFormatter={(value: number) => formatNumber(value, 2)}
                          tickMargin={10}
                          minTickGap={16}
                        />
                        <YAxis
                          dataKey="percentAffected"
                          type="number"
                          domain={[0, 100]}
                          width={56}
                          tickMargin={8}
                          tickFormatter={(value: number) => `${value}%`}
                        />
                        <Tooltip
                          formatter={(value: unknown, name: string) => {
                            const numericValue =
                              typeof value === 'number' ? value : Number(value);
                            return [
                              name === 'value'
                                ? `${formatNumber(numericValue)} ${result.unit}`
                                : `${formatNumber(numericValue)}%`,
                              name === 'value' ? 'Concentration' : 'Affected',
                            ];
                          }}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.species ??
                            payload?.[0]?.payload?.distribution ??
                            'Species'
                          }
                        />
                        {showEmpiricalCurve && (
                          <Line
                            data={chartData}
                            type="monotone"
                            dataKey="percentAffected"
                            name="Empirical curve"
                            stroke="#0369a1"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        )}
                        {canPlotFittedCurve && (
                          <Line
                            data={result.fittedCurvePoints}
                            type="monotone"
                            dataKey="percentAffected"
                            name={fittedCurveLabel}
                            stroke="#7c3aed"
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="5 4"
                            isAnimationActive={false}
                          />
                        )}
                        {showSpeciesPoints && (
                          <Scatter
                            data={chartData}
                            dataKey="percentAffected"
                            name="Species value"
                            fill="#f59e0b"
                            isAnimationActive={false}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {showEmpiricalCurve && (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-0.5 w-5 bg-sky-700" />
                        Empirical curve
                      </span>
                    )}
                    {canPlotFittedCurve && (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-0.5 w-5 border-t-2 border-dashed border-violet-700" />
                        {fittedCurveLabel}
                      </span>
                    )}
                    {showSpeciesPoints && (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        Species value
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex h-[19rem] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900">
                  <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Insufficient data for HCp preview. Adjust the media,
                    environment, or endpoint filters until at least five species
                    are available.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Species aggregates
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review the species-level values used by the empirical HCp
                  preview before treating the output as a candidate.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadSpeciesCsv}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="h-4 w-4" />
                  Species CSV
                </button>
                <button
                  type="button"
                  onClick={downloadReceiptJson}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200"
                >
                  <Download className="h-4 w-4" />
                  Receipt JSON
                </button>
              </div>
            </div>
            <div className="mt-4 max-h-72 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table
                className="min-w-full text-left text-xs"
                data-testid="ssd-species-aggregate-table"
              >
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Species</th>
                    <th className="px-3 py-2 font-semibold">Group</th>
                    <th className="px-3 py-2 font-semibold">SSD value</th>
                    <th className="px-3 py-2 font-semibold">Records</th>
                    <th className="px-3 py-2 font-semibold">Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.speciesAggregates.length > 0 ? (
                    result.speciesAggregates.map((aggregate) => (
                      <tr key={aggregate.speciesScientificName}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          {aggregate.speciesScientificName}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {aggregate.broadGroup}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {formatNumber(aggregate.value)} {result.unit}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {aggregate.sourceRecordCount}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {formatNumber(aggregate.minValue)} -{' '}
                          {formatNumber(aggregate.maxValue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        No species aggregates are available for the current
                        filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  Derived candidate receipt
                </h3>
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Candidate</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {result.derivedCandidate.label}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Evidence status</dt>
                  <dd className="font-semibold text-amber-700 dark:text-amber-300">
                    {result.derivedCandidate.evidenceSupportStatus.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">QA</dt>
                  <dd className="font-semibold text-amber-700 dark:text-amber-300">
                    {result.derivedCandidate.qaStatus.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 dark:text-slate-400">Extraction date</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {result.settings.extractedAt}
                  </dd>
                </div>
                {result.bootstrapInterval && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">
                      Bootstrap CI
                    </dt>
                    <dd className="text-right font-semibold text-slate-900 dark:text-white">
                      {Math.round(
                        result.bootstrapInterval.confidenceLevel * 100,
                      )}
                      %: {formatNumber(result.bootstrapInterval.lower)} -{' '}
                      {formatNumber(result.bootstrapInterval.upper)} {result.unit}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {result.derivedCandidate.provenanceNote}
              </p>
              <button
                type="button"
                onClick={() =>
                  onOpenEvidenceLibrary?.({
                    evidenceSupportStatuses: ['user_entered_or_derived'],
                    search: 'SSD',
                  })
                }
                className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200"
              >
                Compare in References & Values
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                  Warnings and exclusions
                </h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {result.warnings.length === 0 && (
                  <li>No warnings for the current validation filters.</li>
                )}
              </ul>
              <div className="mt-4 max-h-44 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                <table
                  className="min-w-full text-left text-xs"
                  data-testid="ssd-exclusions-table"
                >
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Reason</th>
                      <th className="px-3 py-2 font-semibold">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {result.excludedRecords.slice(0, 8).map((record, index) => (
                      <tr key={`${record.reason}-${index}`}>
                        <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                          {record.reason.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                          {record.detail}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
