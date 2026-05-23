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
  EvidenceLibraryValueRow,
} from '@/lib/matrix-options/provenance/library';
import type {
  DefaultStatus,
  EvidenceLibraryFilterRequest,
  EvidenceSupportStatus,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';

interface CalculatorValueSearchPanelProps {
  pathway: ProvenancePathway;
  pathwayLabel: string;
  substanceKey: string;
  substanceLabel: string;
  jurisdictionLabel: string;
  onOpenEvidenceLibrary: (request: EvidenceLibraryFilterRequest) => void;
  className?: string;
}

const DEFAULT_STATUS_ORDER: Record<DefaultStatus, number> = {
  current_default: 0,
  available_option: 1,
  not_default: 2,
};

const EVIDENCE_STATUS_ORDER: Record<EvidenceSupportStatus, number> = {
  approved_source_backed: 0,
  pending_source_locator: 1,
  current_calculator_scaffold: 2,
  reference_mining_lead: 3,
  user_entered_or_derived: 4,
};

function formatValue(value: number | string, unit: string): string {
  const suffix = unit && unit !== 'unitless' ? ` ${unit}` : '';
  return `${value}${suffix}`;
}

function statusTone(status: string): string {
  if (status === 'approved' || status === 'approved_source_backed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (
    status === 'current_default' ||
    status === 'available_option' ||
    status === 'user_entered_or_derived'
  ) {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  if (
    status.includes('needs') ||
    status === 'pending_source_locator' ||
    status === 'current_calculator_scaffold' ||
    status === 'reference_mining_lead'
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
}

function StatusChip({ value }: { value: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize',
        statusTone(value),
      )}
    >
      {humanizeCatalogLabel(value)}
    </span>
  );
}

function sourceReferenceLabel(row: EvidenceLibraryValueRow): string {
  const evidenceSource = row.sources.find(isCalculatorEvidenceSource);
  const source = evidenceSource ?? row.sources[0];

  if (
    row.record.evidence_support_status === 'current_calculator_scaffold' ||
    source?.calculator_source_role === 'implementation_scaffold'
  ) {
    return 'Current calculator scaffold';
  }

  if (source?.calculator_source_role === 'policy_compilation') {
    return `${source.short_citation}; original source pending`;
  }

  if (source?.calculator_source_role === 'reference_mining') {
    return `${source.short_citation}; source-of-sources lead`;
  }

  if (source) return source.short_citation;
  return humanizeCatalogLabel(row.record.evidence_support_status);
}

function searchableText(row: EvidenceLibraryValueRow): string {
  return [
    row.record.display_name,
    row.record.input_key,
    row.record.value,
    row.record.unit,
    row.record.default_status,
    row.record.evidence_support_status,
    row.record.qa_status,
    row.record.jurisdiction,
    row.record.applicability,
    row.record.review_notes,
    row.record.bc_protocol_alignment,
    row.record.canonical_source_status,
    ...row.sources.map((source) => source.short_citation),
  ]
    .filter((part): part is string | number => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase();
}

function sortValueRows(rows: EvidenceLibraryValueRow[]): EvidenceLibraryValueRow[] {
  return [...rows].sort((a, b) => {
    const defaultDelta =
      DEFAULT_STATUS_ORDER[a.record.default_status] -
      DEFAULT_STATUS_ORDER[b.record.default_status];
    if (defaultDelta !== 0) return defaultDelta;

    const evidenceDelta =
      EVIDENCE_STATUS_ORDER[a.record.evidence_support_status] -
      EVIDENCE_STATUS_ORDER[b.record.evidence_support_status];
    if (evidenceDelta !== 0) return evidenceDelta;

    return a.record.display_name.localeCompare(b.record.display_name);
  });
}

export default function CalculatorValueSearchPanel({
  pathway,
  pathwayLabel,
  substanceKey,
  substanceLabel,
  jurisdictionLabel,
  onOpenEvidenceLibrary,
  className,
}: CalculatorValueSearchPanelProps) {
  const [query, setQuery] = useState('');
  const library = useMemo(
    () =>
      buildEvidenceLibraryView(
        createEvidenceLibraryFilters({
          pathways: [pathway],
          substanceKeys: [substanceKey],
        }),
      ),
    [pathway, substanceKey],
  );

  const queryText = query.trim().toLowerCase();
  const rows = useMemo(() => sortValueRows(library.values), [library.values]);
  const filteredRows = useMemo(
    () =>
      queryText
        ? rows.filter((row) => searchableText(row).includes(queryText))
        : rows,
    [queryText, rows],
  );
  const currentDefaults = rows.filter(
    (row) => row.record.default_status === 'current_default',
  ).length;
  const pendingLocators = rows.filter(
    (row) => row.record.evidence_support_status === 'pending_source_locator',
  ).length;
  const scaffolds = rows.filter(
    (row) =>
      row.record.evidence_support_status === 'current_calculator_scaffold',
  ).length;
  const approved = rows.filter(
    (row) => row.record.evidence_support_status === 'approved_source_backed',
  ).length;

  const openCurrentView = () => {
    onOpenEvidenceLibrary({
      pathways: [pathway],
      substanceKeys: [substanceKey],
      ...(queryText ? { search: queryText } : {}),
    });
  };

  const openValueDetails = (row: EvidenceLibraryValueRow) => {
    onOpenEvidenceLibrary({
      pathways: [row.record.pathway],
      substanceKeys: [row.record.substance_key],
      inputKeys: [row.record.input_key],
      parameterValueIds: [row.record.parameter_value_id],
    });
  };

  return (
    <div
      className={cn('space-y-4', className)}
      data-testid="calculator-value-search-panel"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
          Value Database
        </p>
        <h4 className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
          {substanceLabel}
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {pathwayLabel}; {jurisdictionLabel}
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2 text-xs"
        data-testid="calculator-value-search-audit"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="font-bold text-slate-950 dark:text-white">
            {rows.length}
          </div>
          <div className="text-slate-500 dark:text-slate-400">values</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="font-bold text-slate-950 dark:text-white">
            {currentDefaults}
          </div>
          <div className="text-slate-500 dark:text-slate-400">defaults</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="font-bold text-slate-950 dark:text-white">
            {approved}
          </div>
          <div className="text-slate-500 dark:text-slate-400">approved</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="font-bold text-slate-950 dark:text-white">
            {pendingLocators + scaffolds}
          </div>
          <div className="text-slate-500 dark:text-slate-400">pending/scaffold</div>
        </div>
      </div>

      <label className="block">
        <span className="sr-only">Search calculator values</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search values, refs, status"
            className="min-h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear value search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </label>

      <button
        type="button"
        onClick={openCurrentView}
        className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-sky-800 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200 dark:hover:bg-sky-900/30"
      >
        <ExternalLink className="h-4 w-4" />
        Open matching values
      </button>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No catalog values match this calculator view and search.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((row) => (
            <article
              key={row.record.parameter_value_id}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold leading-snug text-slate-950 dark:text-white">
                    {row.record.display_name}
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {humanizeCatalogLabel(row.record.input_key)}
                  </p>
                </div>
                <div className="shrink-0 text-right font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatValue(row.record.value, row.record.unit)}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                <StatusChip value={row.record.default_status} />
                <StatusChip value={row.record.evidence_support_status} />
                <StatusChip value={row.record.qa_status} />
                <StatusChip value={row.record.jurisdiction} />
              </div>

              <button
                type="button"
                onClick={() => openValueDetails(row)}
                aria-label={`Open reference details for ${row.record.display_name}`}
                className="mt-2 flex w-full items-start gap-1.5 rounded-md px-0 text-left text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Ref: {sourceReferenceLabel(row)}</span>
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
