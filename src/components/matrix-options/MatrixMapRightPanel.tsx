'use client';

import { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { checkCurrentUserAdminStatus } from '@/lib/admin-utils';
import { cn } from '@/utils/cn';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import {
  useMatrixMapMeasurementStore,
  type MatrixMapMeasurementRow,
} from '@/stores/matrix-map/measurementStore';
import {
  MATRIX_MAP_CLASSIFICATION_FILTERS,
  MATRIX_MAP_MEDIA,
  MATRIX_MAP_QA_FILTERS,
  getHiddenSelectedSampleIds,
  hasActiveMatrixMapFilters,
  useMatrixMapFilterStore,
  type MatrixMapFilterState,
  type MatrixMapMedium,
} from '@/stores/matrix-map/filterStore';
import type {
  Classification,
  CoordinateQualityTier,
  MatrixMapData,
} from '@/app/(dashboard)/matrix-map/types';

const PAGE_SIZE = 100;
const TABLE_HEADERS = [
  'Sample',
  'Date',
  'Medium',
  'Substance',
  'Value',
  'Unit',
  'DL Flag',
  'Censoring',
  'Coord Quality',
  'Source DRA',
] as const;

interface MatrixMapRightPanelProps {
  initialMapData: MatrixMapData;
  substanceKey: string;
  isFocused: boolean;
  onToggleFocus: () => void;
}

type MeasurementRow = MatrixMapMeasurementRow;

interface SubstanceOption {
  id: string;
  key: string | null;
  label: string;
}

export function MatrixMapRightPanel({
  initialMapData,
  substanceKey,
  isFocused,
  onToggleFocus,
}: MatrixMapRightPanelProps) {
  const selectedSampleIds = useMatrixMapSelectionStore((s) => s.selectedSampleIds);
  const requestPanToSample = useMatrixMapSelectionStore((s) => s.requestPanToSample);
  const removeMultipleSamples = useMatrixMapSelectionStore((s) => s.removeMultipleSamples);
  const setMeasurementLoading = useMatrixMapMeasurementStore((s) => s.setLoading);
  const setMeasurementRows = useMatrixMapMeasurementStore((s) => s.setRows);
  const setMeasurementError = useMatrixMapMeasurementStore((s) => s.setError);
  const clearMeasurements = useMatrixMapMeasurementStore((s) => s.clear);
  const filterState = useMatrixMapFilterStore((s) => s.filterState);
  const setFilterState = useMatrixMapFilterStore((s) => s.setFilterState);
  const resetFilters = useMatrixMapFilterStore((s) => s.resetFilters);
  const setMatchingSampleIds = useMatrixMapFilterStore((s) => s.setMatchingSampleIds);
  const matchingSampleIds = useMatrixMapFilterStore((s) => s.matchingSampleIds);
  const matchingSampleIdsReady = useMatrixMapFilterStore((s) => s.matchingSampleIdsReady);
  const showSelectedDespiteFilters = useMatrixMapFilterStore((s) => s.showSelectedDespiteFilters);
  const setShowSelectedDespiteFilters = useMatrixMapFilterStore((s) => s.setShowSelectedDespiteFilters);
  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [substanceSearch, setSubstanceSearch] = useState('');
  const [isSubstancePickerOpen, setIsSubstancePickerOpen] = useState(false);
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

  const selectedIdKey = selectedSampleIds.join('|');
  const selectedIdsForFetch = useMemo(
    () => (selectedIdKey ? selectedIdKey.split('|') : []),
    [selectedIdKey],
  );
  const filterKey = createFilterKey(filterState);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeasurements() {
      if (selectedIdsForFetch.length === 0) {
        setRows([]);
        setErrorMessage(null);
        setIsLoading(false);
        clearMeasurements();
        setMatchingSampleIds([], false);
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
    setMatchingSampleIds,
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
  }, [filterKey, selectedIdKey]);

  const filteredRows = useMemo(
    () => filterMeasurementRows(rows, filterState),
    [rows, filterState],
  );

  const matchingSampleIdsForRows = useMemo(
    () => Array.from(new Set(filteredRows.map((row) => row.sample_id))),
    [filteredRows],
  );

  useEffect(() => {
    setMatchingSampleIds(
      matchingSampleIdsForRows,
      selectedSampleIds.length > 0 && !isLoading && !errorMessage,
    );
  }, [
    errorMessage,
    isLoading,
    matchingSampleIdsForRows,
    selectedSampleIds.length,
    setMatchingSampleIds,
  ]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedSamples = initialMapData.visible_samples.filter((sample) =>
    selectedSampleIds.includes(sample.id),
  );
  const activeFilters = hasActiveMatrixMapFilters(filterState);
  const substanceOptions = useMemo(() => extractSubstanceOptions(rows), [rows]);
  const selectedSubstanceOptions = useMemo(
    () => substanceOptions.filter((option) => filterState.substance_ids.includes(option.id)),
    [filterState.substance_ids, substanceOptions],
  );
  const calculatorSubstanceOption = useMemo(
    () => substanceOptions.find((option) => option.key === substanceKey) ?? null,
    [substanceKey, substanceOptions],
  );
  const hiddenSelectedSampleIds = useMemo(
    () =>
      getHiddenSelectedSampleIds({
        filterState,
        matchingSampleIds,
        matchingSampleIdsReady,
        selectedSampleIds,
      }),
    [filterState, matchingSampleIds, matchingSampleIdsReady, selectedSampleIds],
  );

  return (
    <div className="h-full w-full min-w-0 flex flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Map Selection
          </p>
          <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            Measurement Workbench
          </h3>
        </div>
        <button
          type="button"
          onClick={onToggleFocus}
          aria-label={isFocused ? 'Collapse measurement workbench focus' : 'Focus measurement workbench'}
          title={isFocused ? 'Collapse measurement workbench focus' : 'Focus measurement workbench'}
          className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isFocused ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-4">
        {selectedSampleIds.length === 0 ? (
          <div
            data-testid="matrix-map-right-panel-empty"
            className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/30"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              No samples selected
            </p>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Select one or more samples on the map to review raw measurements.
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/30">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedSamples.length} selected samples, {filteredRows.length} matching measurements
              </p>
            </div>

            <FilterControls
              filterState={filterState}
              onFilterState={setFilterState}
              onReset={resetFilters}
              substanceOptions={substanceOptions}
              selectedSubstanceOptions={selectedSubstanceOptions}
              calculatorSubstanceOption={calculatorSubstanceOption}
              substanceSearch={substanceSearch}
              onSubstanceSearch={setSubstanceSearch}
              isSubstancePickerOpen={isSubstancePickerOpen}
              onSubstancePickerOpen={setIsSubstancePickerOpen}
            />

            {hiddenSelectedSampleIds.length > 0 && activeFilters && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p>
                  {hiddenSelectedSampleIds.length} selected {hiddenSelectedSampleIds.length === 1 ? 'sample is' : 'samples are'} outside the active filters.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSelectedDespiteFilters(!showSelectedDespiteFilters)}
                    className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                  >
                    {showSelectedDespiteFilters ? 'Hide selected again' : 'Show selected despite filters'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMultipleSamples(hiddenSelectedSampleIds)}
                    className="rounded-md border border-amber-300 bg-white px-2 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                  >
                    Clear hidden selections
                  </button>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void exportMeasurementRows({
                    selectedSampleIds,
                    filters: filterState,
                    setIsExporting,
                    setExportError,
                  })}
                  disabled={filteredRows.length === 0 || isExporting}
                  className={cn(
                    'w-full rounded-md px-3 py-2 text-xs font-semibold',
                    filteredRows.length === 0 || isExporting
                      ? 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
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
              <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Loading measurements...
              </div>
            ) : errorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                {errorMessage}
              </div>
            ) : (
              <>
                <MeasurementTable
                  rows={pageRows}
                  isFocused={isFocused}
                  activeRowKey={activeRowKey}
                  onRowClick={(row) => {
                    setActiveRowKey(getMeasurementRowKey(row));
                    requestPanToSample(row.sample_id);
                  }}
                />
                <Pagination
                  currentPage={currentPage}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterControls({
  filterState,
  onFilterState,
  onReset,
  substanceOptions,
  selectedSubstanceOptions,
  calculatorSubstanceOption,
  substanceSearch,
  onSubstanceSearch,
  isSubstancePickerOpen,
  onSubstancePickerOpen,
}: {
  filterState: MatrixMapFilterState;
  onFilterState: (patch: Partial<MatrixMapFilterState>) => void;
  onReset: () => void;
  substanceOptions: SubstanceOption[];
  selectedSubstanceOptions: SubstanceOption[];
  calculatorSubstanceOption: SubstanceOption | null;
  substanceSearch: string;
  onSubstanceSearch: (value: string) => void;
  isSubstancePickerOpen: boolean;
  onSubstancePickerOpen: (value: boolean) => void;
}) {
  const activeFilters = hasActiveMatrixMapFilters(filterState);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/30">
      <SubstanceMultiSelect
        options={substanceOptions}
        selectedOptions={selectedSubstanceOptions}
        selectedIds={filterState.substance_ids}
        calculatorSubstanceOption={calculatorSubstanceOption}
        search={substanceSearch}
        onSearch={onSubstanceSearch}
        isOpen={isSubstancePickerOpen}
        onOpen={onSubstancePickerOpen}
        onChange={(substanceIds) => onFilterState({ substance_ids: substanceIds })}
      />
      <MultiChipGroup
        label="Medium"
        values={MATRIX_MAP_MEDIA}
        selectedValues={filterState.mediums}
        onChange={(mediums) => onFilterState({ mediums })}
      />
      <ChipGroup
        label="QA"
        values={MATRIX_MAP_QA_FILTERS}
        value={filterState.qa}
        onChange={(qa) => onFilterState({ qa })}
      />
      <ChipGroup
        label="Classification"
        values={MATRIX_MAP_CLASSIFICATION_FILTERS}
        value={filterState.classification}
        onChange={(classification) => onFilterState({ classification })}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          From
          <input
            type="date"
            value={filterState.date_from}
            onChange={(event) => onFilterState({ date_from: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
        </label>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          To
          <input
            type="date"
            value={filterState.date_to}
            onChange={(event) => onFilterState({ date_to: event.target.value })}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          />
        </label>
      </div>
      {activeFilters && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

function SubstanceMultiSelect({
  options,
  selectedOptions,
  selectedIds,
  calculatorSubstanceOption,
  search,
  onSearch,
  isOpen,
  onOpen,
  onChange,
}: {
  options: SubstanceOption[];
  selectedOptions: SubstanceOption[];
  selectedIds: string[];
  calculatorSubstanceOption: SubstanceOption | null;
  search: string;
  onSearch: (value: string) => void;
  isOpen: boolean;
  onOpen: (value: boolean) => void;
  onChange: (substanceIds: string[]) => void;
}) {
  const selectedIdSet = new Set(selectedIds);
  const visibleOptions = options.filter((option) =>
    `${option.label} ${option.key ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const updateSelected = (nextIds: string[]) => {
    onChange(Array.from(new Set(nextIds)));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Substance
        </p>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {selectedIds.length} selected
        </span>
      </div>

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.slice(0, 4).map((option) => (
            <span
              key={option.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
            >
              <span className="truncate">{option.label}</span>
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() => updateSelected(selectedIds.filter((id) => id !== option.id))}
                className="text-blue-600 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedOptions.length > 4 && (
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              +{selectedOptions.length - 4}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => onOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span>{selectedIds.length === 0 ? 'All substances' : 'Edit substances'}</span>
        <Search className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950">
          <label className="sr-only" htmlFor="matrix-map-substance-search">
            Search substances
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              id="matrix-map-substance-search"
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search substances"
              className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={visibleOptions.length === 0}
              onClick={() => updateSelected([...selectedIds, ...visibleOptions.map((option) => option.id)])}
              className="text-[11px] font-semibold text-blue-600 disabled:text-slate-400 dark:text-blue-300 dark:disabled:text-slate-500"
            >
              Select all visible
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => updateSelected([])}
              className="text-[11px] font-semibold text-slate-600 disabled:text-slate-400 dark:text-slate-300 dark:disabled:text-slate-500"
            >
              Clear
            </button>
            {calculatorSubstanceOption && (
              <button
                type="button"
                onClick={() => updateSelected([calculatorSubstanceOption.id])}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Filter to Calculator substance
              </button>
            )}
          </div>
          <div
            role="listbox"
            aria-label="Measurement substances"
            className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-100 dark:border-slate-800"
          >
            {visibleOptions.length === 0 ? (
              <p className="p-3 text-xs text-slate-500 dark:text-slate-400">
                No substances found.
              </p>
            ) : (
              visibleOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-2 py-1.5 text-xs text-slate-700 last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(option.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        updateSelected([...selectedIds, option.id]);
                      } else {
                        updateSelected(selectedIds.filter((id) => id !== option.id));
                      }
                    }}
                    className="h-3 w-3"
                  />
                  <span>{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiChipGroup<T extends string>({
  label,
  values,
  selectedValues,
  onChange,
}: {
  label: string;
  values: readonly T[];
  selectedValues: T[];
  onChange: (value: T[]) => void;
}) {
  const selectedSet = new Set(selectedValues);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-300"
          >
            All
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {values.map((item) => {
          const selected = selectedSet.has(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() =>
                onChange(
                  selected
                    ? selectedValues.filter((value) => value !== item)
                    : [...selectedValues, item],
                )
              }
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-semibold capitalize',
                selected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300',
              )}
            >
              {item}
            </button>
          );
        })}
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
  isFocused,
  activeRowKey,
  onRowClick,
}: {
  rows: MeasurementRow[];
  isFocused: boolean;
  activeRowKey: string | null;
  onRowClick: (row: MeasurementRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
        No measurements match the current filters.
      </div>
    );
  }

  return (
    <div
      data-testid="matrix-map-measurement-table-scroll"
      className={cn(
        'min-h-[260px] flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700',
        isFocused ? 'max-h-[68vh]' : 'max-h-[42vh]',
      )}
      style={{ scrollbarGutter: 'stable both-edges' }}
    >
      <table className="min-w-[1080px] text-left text-xs">
        <thead className="text-slate-600 dark:text-slate-300">
          <tr>
            {TABLE_HEADERS.map((header) => (
              <th
                key={header}
                className="sticky top-0 z-10 bg-slate-100 px-2 py-2 font-semibold dark:bg-slate-900"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const rowKey = getMeasurementRowKey(row);
            const active = activeRowKey === rowKey;
            return (
              <tr
                key={rowKey}
                className={cn(
                  'cursor-pointer bg-white hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-blue-950/40',
                  active && 'bg-blue-50 dark:bg-blue-950/40',
                )}
                onClick={() => onRowClick(row)}
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
            );
          })}
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
    sample_event_id: nullableString(row.sample_event_id),
    event_date: stringField(row.event_date),
    measurement_id: nullableString(row.measurement_id),
    medium: stringField(row.medium),
    substance_id: nullableString(row.substance_id),
    substance_key: nullableString(row.substance_key),
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
    source_dra_citation: nullableString(row.source_dra_citation),
  };
}

function filterMeasurementRows(rows: MeasurementRow[], filterState: MatrixMapFilterState) {
  const substanceIds = new Set(filterState.substance_ids);
  const mediums = new Set(filterState.mediums);

  return rows.filter((row) => {
    if (substanceIds.size > 0 && (!row.substance_id || !substanceIds.has(row.substance_id))) return false;
    if (mediums.size > 0 && !mediums.has(row.medium as MatrixMapMedium)) return false;
    if (filterState.qa === 'detected' && row.censored) return false;
    if (filterState.qa === 'censored' && !row.censored) return false;
    if (filterState.classification !== 'all' && row.classification !== filterState.classification) return false;
    if (filterState.date_from && row.event_date < filterState.date_from) return false;
    if (filterState.date_to && row.event_date > filterState.date_to) return false;
    return true;
  });
}

function extractSubstanceOptions(rows: MeasurementRow[]) {
  const options = new Map<string, SubstanceOption>();
  for (const row of rows) {
    if (!row.substance_id) continue;
    options.set(row.substance_id, {
      id: row.substance_id,
      key: row.substance_key,
      label: row.substance_display_name || row.substance_key || row.substance_id,
    });
  }
  return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function createFilterKey(filterState: MatrixMapFilterState) {
  return JSON.stringify(filterState);
}

function getMeasurementRowKey(row: MeasurementRow) {
  return row.measurement_id ?? `${row.sample_id}-${row.substance_id ?? row.substance_display_name}-${row.event_date}`;
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
  filters: MatrixMapFilterState;
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
