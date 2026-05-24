'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FlaskConical,
  Search,
} from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/utils/cn';
import { SSD_FIXTURE_ROWS } from '@/lib/matrix-options/ssd/fixtures';
import { buildSsdAnalysis } from '@/lib/matrix-options/ssd/hcp';
import type {
  SsdAnalysisMode,
  SsdAnalysisResult,
  SsdMedium,
  SpeciesAggregationMethod,
} from '@/lib/matrix-options/ssd/types';
import type { EvidenceLibraryFilterRequest } from '@/lib/matrix-options/provenance/types';

interface SsdWorkbenchProps {
  onOpenEvidenceLibrary?: (request: EvidenceLibraryFilterRequest) => void;
  className?: string;
}

const ENDPOINT_OPTIONS = ['Mortality', 'Growth', 'Reproduction', 'Development'];
const OWNER_REPORTED_ECOTOX_ROWS = 582125;

function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return 'n/a';
  return value.toLocaleString(undefined, {
    maximumSignificantDigits: digits,
  });
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [chemicalSearch, setChemicalSearch] = useState('Copper');
  const [medium, setMedium] = useState<SsdMedium>('freshwater');
  const [endpointFilters, setEndpointFilters] = useState<string[]>([]);
  const [aggregationMethod, setAggregationMethod] =
    useState<SpeciesAggregationMethod>('geometric_mean');
  const [pValue, setPValue] = useState(0.05);
  const [analysisMode, setAnalysisMode] =
    useState<SsdAnalysisMode>('empirical_preview');

  const result: SsdAnalysisResult = useMemo(
    () =>
      buildSsdAnalysis(SSD_FIXTURE_ROWS, {
        chemicalNames: [chemicalSearch.trim() || 'Copper'],
        medium,
        endpointFilters,
        aggregationMethod,
        pValue,
        analysisMode,
        bootstrapIterations: 0,
        randomSeed: 42,
        sourceMode: 'fixture',
        ecotoxMirrorRecordCount: OWNER_REPORTED_ECOTOX_ROWS,
        extractedAt: todayIsoDate(),
      }),
    [aggregationMethod, analysisMode, chemicalSearch, endpointFilters, medium, pValue],
  );

  const chartData = result.empiricalPoints.map((point) => ({
    species: point.speciesScientificName,
    group: point.broadGroup,
    value: point.value,
    percentAffected: point.percentAffected,
  }));
  const canPlotPreview = chartData.length >= 2;
  const hasHcpPreview = Number.isFinite(result.hcp);

  const activeEndpointLabel =
    endpointFilters.length === 0 ? 'All endpoints' : endpointFilters.join(', ');

  const toggleEndpoint = (endpoint: string): void => {
    setEndpointFilters((current) =>
      current.includes(endpoint)
        ? current.filter((value) => value !== endpoint)
        : [...current, endpoint],
    );
  };

  return (
    <section
      className={cn('space-y-6', className)}
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
            This first slice runs a deterministic fixture preview while the live
            read-only ECOTOX mirror connection is gated behind schema verification.
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
          Derived candidate only. Not calculation-driving.
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
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
              Fixture mode uses Copper records. Live search will query the
              ECOTOX mirror with capped server-side pagination.
            </p>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Medium
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ToggleButton
                active={medium === 'freshwater'}
                onClick={() => setMedium('freshwater')}
              >
                Freshwater
              </ToggleButton>
              <ToggleButton
                active={medium === 'marine'}
                onClick={() => setMedium('marine')}
              >
                Marine
              </ToggleButton>
            </div>
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
            Analysis mode
            <select
              value={analysisMode}
              onChange={(event) =>
                setAnalysisMode(event.target.value as SsdAnalysisMode)
              }
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="empirical_preview">Empirical preview</option>
              <option value="model_averaging">AICc model averaging (gated)</option>
              <option value="single_distribution">Single distribution (gated)</option>
            </select>
          </label>
        </aside>

        <div className="space-y-5">
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

          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950 dark:text-white">
                  Empirical SSD preview
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {activeEndpointLabel}; {result.settings.aggregationMethod.replace('_', ' ')}.
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
            <div className="mt-4 h-80">
              {canPlotPreview ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ left: 8, right: 24, top: 16, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="value"
                      type="number"
                      scale="log"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(value: number) => formatNumber(value, 2)}
                      label={{ value: 'Concentration (mg/L)', position: 'insideBottom', offset: -12 }}
                    />
                    <YAxis
                      dataKey="percentAffected"
                      type="number"
                      domain={[0, 100]}
                      tickFormatter={(value: number) => `${value}%`}
                      label={{ value: 'Species affected (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: unknown, name: string) => {
                        const numericValue =
                          typeof value === 'number' ? value : Number(value);
                        return [
                          name === 'value'
                            ? `${formatNumber(numericValue)} mg/L`
                            : `${formatNumber(numericValue)}%`,
                          name === 'value' ? 'Concentration' : 'Affected',
                        ];
                      }}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.species ?? 'Species'
                      }
                    />
                    <Legend />
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
                    <Scatter
                      data={chartData}
                      dataKey="percentAffected"
                      name="Species value"
                      fill="#f59e0b"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900">
                  <p className="max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Insufficient data for HCp preview. Adjust the medium or endpoint
                    filters until at least five species are available.
                  </p>
                </div>
              )}
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
                  <li>No warnings for the current fixture filters.</li>
                )}
              </ul>
              <div className="mt-4 max-h-44 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                <table className="min-w-full text-left text-xs">
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
