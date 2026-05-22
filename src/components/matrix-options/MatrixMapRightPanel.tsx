'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { checkCurrentUserAdminStatus } from '@/lib/admin-utils';
import { cn } from '@/utils/cn';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import {
  useMatrixMapMeasurementStore,
  type MatrixMapMeasurementRow,
} from '@/stores/matrix-map/measurementStore';
import type {
  Classification,
  CoordinateQualityTier,
  MatrixMapData,
} from '@/app/(dashboard)/matrix-map/types';

const PAGE_SIZE = 100;
const MEDIUMS = ['all', 'sediment', 'water', 'tissue', 'toxicity', 'community'] as const;
const QA_FLAGS = ['all', 'detected', 'censored'] as const;
const CLASSIFICATIONS = ['all', 'reference', 'impacted', 'unknown'] as const;

type MediumFilter = (typeof MEDIUMS)[number];
type QaFilter = (typeof QA_FLAGS)[number];
type ClassificationFilter = (typeof CLASSIFICATIONS)[number];

interface MatrixMapRightPanelProps {
  initialMapData: MatrixMapData;
}

type MeasurementRow = MatrixMapMeasurementRow;

export function MatrixMapRightPanel({ initialMapData }: MatrixMapRightPanelProps) {
  const selectedSampleIds = useMatrixMapSelectionStore((s) => s.selectedSampleIds);
  const requestPanToSample = useMatrixMapSelectionStore((s) => s.requestPanToSample);
  const setMeasurementLoading = useMatrixMapMeasurementStore((s) => s.setLoading);
  const setMeasurementRows = useMatrixMapMeasurementStore((s) => s.setRows);
  const setMeasurementError = useMatrixMapMeasurementStore((s) => s.setError);
  const clearMeasurements = useMatrixMapMeasurementStore((s) => s.clear);
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediumFilter, setMediumFilter] = useState<MediumFilter>('all');
  const [qaFilter, setQaFilter] = useState<QaFilter>('all');
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const selectedIdKey = selectedSampleIds.join('|');
  const selectedIdsForFetch = useMemo(
    () => (selectedIdKey ? selectedIdKey.split('|') : []),
    [selectedIdKey],
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchMeasurements() {
      if (selectedIdsForFetch.length === 0) {
        setRows([]);
        setErrorMessage(null);
        setIsLoading(false);
        clearMeasurements();
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setMeasurementLoading(selectedIdKey);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .schema('matrix_map')
          .rpc('fetch_measurements_for_samples', {
            p_sample_ids: selectedIdsForFetch,
          });

        if (cancelled) return;
        if (error) {
          setRows([]);
          const message = 'Unable to load measurements for this selection. Check RPC permissions or try again.';
          setErrorMessage(message);
          setMeasurementError(selectedIdKey, message);
        } else {
          const nextRows = normalizeMeasurementRows(data);
          setRows(nextRows);
          setMeasurementRows(selectedIdKey, nextRows);
        }
      } catch {
        if (cancelled) return;
        setRows([]);
        const message = 'Unable to load measurements for this selection. Check RPC permissions or try again.';
        setErrorMessage(message);
        setMeasurementError(selectedIdKey, message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchMeasurements();

    return () => {
      cancelled = true;
    };
  }, [
    clearMeasurements,
    selectedIdKey,
    selectedIdsForFetch,
    setMeasurementError,
    setMeasurementLoading,
    setMeasurementRows,
  ]);

  useEffect(() => {
    let cancelled = false;
    checkCurrentUserAdminStatus().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [mediumFilter, qaFilter, classificationFilter, dateFrom, dateTo, selectedIdKey]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (mediumFilter !== 'all' && row.medium !== mediumFilter) return false;
      if (qaFilter === 'detected' && row.censored) return false;
      if (qaFilter === 'censored' && !row.censored) return false;
      if (classificationFilter !== 'all' && row.classification !== classificationFilter) return false;
      if (dateFrom && row.event_date < dateFrom) return false;
      if (dateTo && row.event_date > dateTo) return false;
      return true;
    });
  }, [rows, mediumFilter, qaFilter, classificationFilter, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedSamples = initialMapData.visible_samples.filter((sample) =>
    selectedSampleIds.includes(sample.id),
  );

  return (
    <div className="w-96 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Map Selection
        </p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          Measurement Workbench
        </h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {selectedSampleIds.length === 0 ? (
          <div
            data-testid="matrix-map-right-panel-empty"
            className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              No samples selected
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Select one or more samples on the map to review raw measurements.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSamples.length} selected samples, {filteredRows.length} matching measurements
              </p>
            </div>

            <FilterControls
              mediumFilter={mediumFilter}
              qaFilter={qaFilter}
              classificationFilter={classificationFilter}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onMediumFilter={setMediumFilter}
              onQaFilter={setQaFilter}
              onClassificationFilter={setClassificationFilter}
              onDateFrom={setDateFrom}
              onDateTo={setDateTo}
            />

            {isAdmin && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void exportMeasurementRows({
                    selectedSampleIds,
                    filters: {
                      medium: mediumFilter,
                      qa: qaFilter,
                      classification: classificationFilter,
                      date_from: dateFrom,
                      date_to: dateTo,
                    },
                    setIsExporting,
                    setExportError,
                  })}
                  disabled={filteredRows.length === 0 || isExporting}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-xs font-semibold',
                    filteredRows.length === 0 || isExporting
                      ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white',
                  )}
                >
                  {isExporting ? 'Exporting...' : 'Export current view as CSV'}
                </button>
                {exportError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {exportError}
                  </p>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500 dark:text-slate-400">
                Loading measurements...
              </div>
            ) : errorMessage ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-xs text-amber-900 dark:text-amber-100">
                {errorMessage}
              </div>
            ) : (
              <>
                <MeasurementTable rows={pageRows} onRowClick={requestPanToSample} />
                <Pagination
                  currentPage={currentPage}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterControls({
  mediumFilter,
  qaFilter,
  classificationFilter,
  dateFrom,
  dateTo,
  onMediumFilter,
  onQaFilter,
  onClassificationFilter,
  onDateFrom,
  onDateTo,
}: {
  mediumFilter: MediumFilter;
  qaFilter: QaFilter;
  classificationFilter: ClassificationFilter;
  dateFrom: string;
  dateTo: string;
  onMediumFilter: (value: MediumFilter) => void;
  onQaFilter: (value: QaFilter) => void;
  onClassificationFilter: (value: ClassificationFilter) => void;
  onDateFrom: (value: string) => void;
  onDateTo: (value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3">
      <ChipGroup label="Medium" values={MEDIUMS} value={mediumFilter} onChange={onMediumFilter} />
      <ChipGroup label="QA" values={QA_FLAGS} value={qaFilter} onChange={onQaFilter} />
      <ChipGroup
        label="Classification"
        values={CLASSIFICATIONS}
        value={classificationFilter}
        onChange={onClassificationFilter}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFrom(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateTo(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
        </label>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {values.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-semibold capitalize',
              value === item
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
            )}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function MeasurementTable({
  rows,
  onRowClick,
}: {
  rows: MeasurementRow[];
  onRowClick: (sampleId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-500 dark:text-slate-400">
        No measurements match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-[900px] text-left text-xs">
        <thead className="bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          <tr>
            {['Sample', 'Date', 'Medium', 'Substance', 'Value', 'Unit', 'DL Flag', 'Censoring', 'Coord Quality', 'Source DRA'].map((header) => (
              <th key={header} className="px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, index) => (
            <tr
              key={`${row.sample_id}-${row.substance_display_name}-${row.event_date}-${index}`}
              className="cursor-pointer bg-white hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-blue-950/40"
              onClick={() => onRowClick(row.sample_id)}
            >
              <td className="px-2 py-2 font-semibold text-slate-800 dark:text-slate-100">
                {row.sample_station_id}
              </td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.event_date}</td>
              <td className="px-2 py-2 capitalize text-slate-600 dark:text-slate-300">{row.medium}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.substance_display_name}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{formatCell(row.value)}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.unit ?? ''}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.qualifier ?? ''}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.censored ? 'Censored' : 'Detected'}</td>
              <td className="px-2 py-2 capitalize text-slate-600 dark:text-slate-300">{row.coordinate_quality_tier}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.source_dra_title ?? row.source_dra_id ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  currentPage,
  pageCount,
  onPage,
}: {
  currentPage: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPage(currentPage - 1)}
        className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-700"
      >
        Previous
      </button>
      <span>
        Page {currentPage} of {pageCount}
      </span>
      <button
        type="button"
        disabled={currentPage >= pageCount}
        onClick={() => onPage(currentPage + 1)}
        className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 dark:border-slate-700"
      >
        Next
      </button>
    </div>
  );
}

function normalizeMeasurementRows(value: unknown): MeasurementRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeMeasurementRow(item))
    .filter((item): item is MeasurementRow => item !== null);
}

function normalizeMeasurementRow(value: unknown): MeasurementRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.sample_id !== 'string') return null;
  return {
    sample_id: row.sample_id,
    sample_display_name: stringField(row.sample_display_name) || stringField(row.display_name) || row.sample_id,
    sample_station_id: stringField(row.sample_station_id) || stringField(row.station_id) || row.sample_id,
    event_date: stringField(row.event_date),
    medium: stringField(row.medium),
    substance_display_name: stringField(row.substance_display_name) || stringField(row.substance) || '',
    value: scalarField(row.value),
    unit: nullableString(row.unit),
    detection_limit: scalarField(row.detection_limit),
    qualifier: nullableString(row.qualifier),
    censored: typeof row.censored === 'boolean' ? row.censored : null,
    coordinate_quality_tier: coordinateTier(row.coordinate_quality_tier),
    classification: classification(row.classification),
    source_dra_id: nullableString(row.source_dra_id),
    source_dra_title: nullableString(row.source_dra_title) || nullableString(row.dra_title),
  };
}

function stringField(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function scalarField(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string') return value;
  return null;
}

function coordinateTier(value: unknown): CoordinateQualityTier {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function classification(value: unknown): Classification {
  return value === 'reference' || value === 'impacted' || value === 'unknown'
    ? value
    : 'unknown';
}

async function exportMeasurementRows({
  selectedSampleIds,
  filters,
  setIsExporting,
  setExportError,
}: {
  selectedSampleIds: string[];
  filters: {
    medium: MediumFilter;
    qa: QaFilter;
    classification: ClassificationFilter;
    date_from: string;
    date_to: string;
  };
  setIsExporting: (value: boolean) => void;
  setExportError: (value: string | null) => void;
}) {
  if (typeof window === 'undefined' || selectedSampleIds.length === 0) return;
  setIsExporting(true);
  setExportError(null);
  try {
    const response = await fetch('/api/matrix-map/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        export_type: 'measurements',
        selected_sample_ids: selectedSampleIds,
        filters,
      }),
    });
    if (!response.ok) {
      throw new Error('Measurement export failed.');
    }
    await downloadCsvResponse(response);
  } catch (err) {
    setExportError(err instanceof Error ? err.message : 'Measurement export failed.');
  } finally {
    setIsExporting(false);
  }
}

async function downloadCsvResponse(response: Response) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  anchor.href = url;
  anchor.download = filenameMatch?.[1] ?? 'matrix-map-measurements.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatCell(value: string | number | null) {
  return value === null ? '' : String(value);
}
