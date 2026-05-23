'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  buildEvidenceLibraryView,
  createEvidenceLibraryFilters,
  humanizeCatalogLabel,
  isCalculatorEvidenceSource,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFacetOption,
  EvidenceLibraryValueRow,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFilters,
  EvidenceLibraryViewMode,
} from '@/lib/matrix-options/provenance/types';

interface EvidenceLibraryProps {
  filters: EvidenceLibraryFilters;
  onFiltersChange: (filters: EvidenceLibraryFilters) => void;
  className?: string;
}

const VIEW_MODES: Array<{ id: EvidenceLibraryViewMode; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'values', label: 'Values' },
  { id: 'equations', label: 'Equations' },
  { id: 'sources', label: 'Sources' },
  { id: 'assumptions', label: 'Assumptions' },
];

type FilterArrayKey = {
  [K in keyof EvidenceLibraryFilters]: EvidenceLibraryFilters[K] extends string[]
    ? K
    : never;
}[keyof EvidenceLibraryFilters];

const FILTER_LABELS: Partial<Record<keyof EvidenceLibraryFilters, string>> = {
  pathways: 'Pathway',
  substanceKeys: 'Substance',
  qaStatuses: 'QA',
  defaultStatuses: 'Default',
  extractionStatuses: 'Extraction',
  jurisdictions: 'Jurisdiction',
  sourceIds: 'Source',
  parameterValueIds: 'Value',
  equationIds: 'Equation',
  zoteroStatuses: 'Zotero',
  currentnessStatuses: 'Currentness',
  authorityScopes: 'Authority',
  receptorGroups: 'Receptor',
  populationGroups: 'Population',
  speciesGroups: 'Species',
};

function setSingleFilter(
  filters: EvidenceLibraryFilters,
  key: FilterArrayKey,
  value: string,
): EvidenceLibraryFilters {
  return {
    ...filters,
    [key]: value ? [value] : [],
  };
}

function firstValue(filters: EvidenceLibraryFilters, key: FilterArrayKey): string {
  return filters[key][0] ?? '';
}

function formatValue(value: number | string, unit: string): string {
  const suffix = unit && unit !== 'unitless' ? ` ${unit}` : '';
  return `${value}${suffix}`;
}

function statusTone(status: string): string {
  if (status === 'approved' || status === 'current') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (
    status.includes('needs') ||
    status === 'placeholder_default' ||
    status === 'pending_owner_export'
  ) {
    return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800';
  }
  if (status === 'superseded') {
    return 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700';
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
        statusTone(value),
      )}
    >
      {humanizeCatalogLabel(value)}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: EvidenceLibraryFacetOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  );
}

function tagList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'Not specified';
}

function sourceLabels(row: EvidenceLibraryValueRow): string {
  const evidenceSources = row.sources.filter(isCalculatorEvidenceSource);
  if (evidenceSources.length === 0) {
    return row.sources.length > 0
      ? 'Source review pending; current calculator scaffold only'
      : 'No source linked';
  }
  const first = evidenceSources[0].short_citation;
  return evidenceSources.length === 1
    ? first
    : `${first}; +${evidenceSources.length - 1}`;
}

function activeFilterLabels(filters: EvidenceLibraryFilters): string[] {
  const labels: string[] = [];
  if (filters.search.trim()) labels.push(`search: ${filters.search.trim()}`);
  for (const [key, values] of Object.entries(filters)) {
    if (key === 'search' || !Array.isArray(values)) continue;
    const label = FILTER_LABELS[key as keyof EvidenceLibraryFilters] ?? humanizeCatalogLabel(key);
    for (const value of values) {
      labels.push(`${label}: ${humanizeCatalogLabel(value)}`);
    }
  }
  return labels;
}

export default function EvidenceLibrary({
  filters,
  onFiltersChange,
  className,
}: EvidenceLibraryProps) {
  const [viewMode, setViewMode] = useState<EvidenceLibraryViewMode>('all');
  const library = useMemo(() => buildEvidenceLibraryView(filters), [filters]);
  const activeLabels = activeFilterLabels(filters);
  const assumptionValues = library.values.filter(
    (row) =>
      row.record.default_status !== 'not_default' ||
      row.assumptionTags.length > 0,
  );
  const visibleValues =
    viewMode === 'assumptions' ? assumptionValues : library.values;

  const updateFilter = (key: FilterArrayKey, value: string) => {
    onFiltersChange(setSingleFilter(filters, key, value));
  };

  const showValues =
    viewMode === 'all' || viewMode === 'values' || viewMode === 'assumptions';
  const showEquations = viewMode === 'all' || viewMode === 'equations';
  const showSources = viewMode === 'all' || viewMode === 'sources';

  return (
    <section
      className={cn('space-y-5', className)}
      data-testid="references-values-tab"
    >
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white">
            References & Values
          </h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>{library.totalCounts.sources} sources</span>
            <span>{library.totalCounts.values} values</span>
            <span>{library.totalCounts.equations} equations</span>
          </div>
        </div>
        <div
          className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:inline-grid sm:w-auto sm:grid-cols-5"
          aria-label="Evidence library view"
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setViewMode(mode.id)}
              aria-pressed={viewMode === mode.id}
              className={cn(
                'min-h-9 whitespace-nowrap px-3 text-xs font-semibold transition-colors',
                viewMode === mode.id
                  ? 'rounded-md bg-sky-600 text-white shadow-sm dark:bg-sky-500'
                  : 'rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </header>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_repeat(4,minmax(150px,1fr))]">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="mb-1 block">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) =>
                  onFiltersChange({ ...filters, search: event.target.value })
                }
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-8 pr-2 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </span>
          </label>
          <FilterSelect
            label="Pathway"
            value={firstValue(filters, 'pathways')}
            options={library.facets.pathways}
            onChange={(value) => updateFilter('pathways', value)}
          />
          <FilterSelect
            label="Substance"
            value={firstValue(filters, 'substanceKeys')}
            options={library.facets.substances}
            onChange={(value) => updateFilter('substanceKeys', value)}
          />
          <FilterSelect
            label="QA"
            value={firstValue(filters, 'qaStatuses')}
            options={library.facets.qaStatuses}
            onChange={(value) => updateFilter('qaStatuses', value)}
          />
          <FilterSelect
            label="Currentness"
            value={firstValue(filters, 'currentnessStatuses')}
            options={library.facets.currentnessStatuses}
            onChange={(value) => updateFilter('currentnessStatuses', value)}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect
            label="Extraction"
            value={firstValue(filters, 'extractionStatuses')}
            options={library.facets.extractionStatuses}
            onChange={(value) => updateFilter('extractionStatuses', value)}
          />
          <FilterSelect
            label="Default"
            value={firstValue(filters, 'defaultStatuses')}
            options={library.facets.defaultStatuses}
            onChange={(value) => updateFilter('defaultStatuses', value)}
          />
          <FilterSelect
            label="Zotero"
            value={firstValue(filters, 'zoteroStatuses')}
            options={library.facets.zoteroStatuses}
            onChange={(value) => updateFilter('zoteroStatuses', value)}
          />
          <FilterSelect
            label="Authority"
            value={firstValue(filters, 'authorityScopes')}
            options={library.facets.authorityScopes}
            onChange={(value) => updateFilter('authorityScopes', value)}
          />
          <FilterSelect
            label="Jurisdiction"
            value={firstValue(filters, 'jurisdictions')}
            options={library.facets.jurisdictions}
            onChange={(value) => updateFilter('jurisdictions', value)}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <FilterSelect
            label="Receptor"
            value={firstValue(filters, 'receptorGroups')}
            options={library.facets.receptorGroups}
            onChange={(value) => updateFilter('receptorGroups', value)}
          />
          <FilterSelect
            label="Population"
            value={firstValue(filters, 'populationGroups')}
            options={library.facets.populationGroups}
            onChange={(value) => updateFilter('populationGroups', value)}
          />
          <FilterSelect
            label="Species"
            value={firstValue(filters, 'speciesGroups')}
            options={library.facets.speciesGroups}
            onChange={(value) => updateFilter('speciesGroups', value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {label}
            </span>
          ))}
          {activeLabels.length > 0 && (
            <button
              type="button"
              onClick={() => onFiltersChange(createEvidenceLibraryFilters())}
              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {showValues && (
        <section className="space-y-2" data-testid="evidence-library-values">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Parameter Values
            </h3>
            <span className="text-xs text-slate-500">{visibleValues.length}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Value</th>
                  <th className="px-3 py-2 font-semibold">Pathway</th>
                  <th className="px-3 py-2 font-semibold">Current value</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Applicability</th>
                  <th className="px-3 py-2 font-semibold">Sources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleValues.map((row) => (
                  <React.Fragment key={row.record.parameter_value_id}>
                    <tr className="align-top text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {row.record.display_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {row.substanceLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2">{humanizeCatalogLabel(row.record.pathway)}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {formatValue(row.record.value, row.record.unit)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge value={row.record.qa_status} />
                          <StatusBadge value={row.record.default_status} />
                          <StatusBadge value={row.record.extraction_status} />
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-xs">{row.record.applicability}</td>
                      <td className="px-3 py-2 max-w-xs">{sourceLabels(row)}</td>
                    </tr>
                    <tr>
                      <td colSpan={6} className="bg-white px-3 py-2 dark:bg-slate-950">
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
                            Details
                          </summary>
                          <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2 xl:grid-cols-4">
                            <div>Units: {row.record.unit}</div>
                            <div>Uncertainty: {row.record.uncertainty ?? 'Not recorded'}</div>
                            <div>Receptors: {tagList(row.receptorGroups)}</div>
                            <div>Populations: {tagList(row.populationGroups)}</div>
                            <div>Species: {tagList(row.speciesGroups)}</div>
                            <div>Assumptions: {tagList(row.assumptionTags)}</div>
                            <div>Jurisdiction: {row.record.jurisdiction}</div>
                            <div>Evidence: {row.record.evidence_items.length}</div>
                          </div>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                            {row.record.review_notes}
                          </p>
                        </details>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                {visibleValues.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                      No parameter values match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showEquations && (
        <section className="space-y-2" data-testid="evidence-library-equations">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Equations
            </h3>
            <span className="text-xs text-slate-500">{library.equations.length}</span>
          </div>
          <div className="grid gap-2">
            {library.equations.map((row) => (
              <details
                key={row.record.equation_id}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
              >
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white">
                  {row.record.display_name}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {humanizeCatalogLabel(row.record.pathway)}
                  </span>
                </summary>
                <div className="border-t border-slate-200 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
                  <p>{row.record.plain_language}</p>
                  <p className="mt-2 font-mono text-xs">{row.record.equation_latex}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusBadge value={row.record.qa_status} />
                    {row.assumptionTags.map((tag) => (
                      <StatusBadge key={tag} value={tag} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Units: {row.record.unit_notes}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Sources:{' '}
                    {row.sources.filter(isCalculatorEvidenceSource).length > 0
                      ? row.sources
                          .filter(isCalculatorEvidenceSource)
                          .map((source) => source.short_citation)
                          .join('; ')
                      : 'Source review pending; current calculator scaffold only'}
                  </p>
                </div>
              </details>
            ))}
            {library.equations.length === 0 && (
              <div className="rounded-lg border border-slate-200 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-800">
                No equations match.
              </div>
            )}
          </div>
        </section>
      )}

      {showSources && (
        <section className="space-y-2" data-testid="evidence-library-sources">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Sources
            </h3>
            <span className="text-xs text-slate-500">{library.sources.length}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Source</th>
                  <th className="px-3 py-2 font-semibold">Authority</th>
                  <th className="px-3 py-2 font-semibold">Currentness</th>
                  <th className="px-3 py-2 font-semibold">Zotero</th>
                  <th className="px-3 py-2 font-semibold">Total catalog links</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {library.sources.map((row) => (
                  <tr
                    key={row.record.source_id}
                    className="align-top text-slate-700 dark:text-slate-200"
                  >
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {row.record.url ? (
                          <a
                            href={row.record.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sky-700 hover:underline dark:text-sky-300"
                          >
                            {row.record.short_citation}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          row.record.short_citation
                        )}
                      </div>
                      <div className="mt-1 max-w-lg text-xs text-slate-500">
                        {row.record.title}
                      </div>
                      {row.record.notes && (
                        <div className="mt-1 max-w-lg text-xs text-slate-500">
                          {row.record.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={row.record.authority_scope} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={row.record.currentness_status} />
                      {row.record.checked_at && (
                        <div className="mt-1 text-xs text-slate-500">
                          checked {row.record.checked_at}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={row.record.zotero_status} />
                      {row.record.zotero_item_key && (
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          {row.record.zotero_item_key}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.linkedValueCount} total values;{' '}
                      {row.linkedEquationCount} total equations
                    </td>
                  </tr>
                ))}
                {library.sources.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">
                      No sources match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  );
}
