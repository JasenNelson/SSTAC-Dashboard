'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  buildEvidenceLibraryView,
  createEvidenceLibraryFilters,
  getParameterValueReviewDisposition,
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
import {
  regulatoryFrameEvidenceFilter,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';

interface CalculatorValueSearchPanelProps {
  pathway: ProvenancePathway;
  pathwayLabel: string;
  substanceKey: string;
  substanceLabel: string;
  jurisdictionLabel: string;
  regulatoryFrameId: RegulatoryFrameId;
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

type SearchSuggestion = {
  label: string;
  query: string;
  pathways: ProvenancePathway[];
  matchTerms?: string[];
};

const SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  {
    label: 'RfD',
    query: 'RfD',
    pathways: ['human-health-direct', 'human-health-food'],
  },
  {
    label: 'Slope factor',
    query: 'slope factor',
    pathways: ['human-health-direct', 'human-health-food'],
  },
  {
    label: 'RfC',
    query: 'RfC',
    pathways: ['human-health-direct'],
  },
  {
    label: 'Unit risk',
    query: 'unit risk',
    pathways: ['human-health-direct'],
  },
  {
    label: 'TDI',
    query: 'TDI',
    pathways: ['human-health-direct', 'human-health-food'],
  },
  {
    label: 'Dermal absorption',
    query: 'dermal absorption',
    pathways: ['human-health-direct'],
    matchTerms: ['abs_dermal', 'dermal absorption', 'dermal RAF'],
  },
  {
    label: 'Bioavailability',
    query: 'bioavailability',
    pathways: ['human-health-direct', 'human-health-food'],
    matchTerms: ['ba_oral', 'bioavailability', 'oral bioavailability'],
  },
  {
    label: 'IRIS',
    query: 'IRIS',
    pathways: ['human-health-direct', 'human-health-food'],
  },
  {
    label: 'Health Canada',
    query: 'Health Canada',
    pathways: ['human-health-direct', 'human-health-food'],
  },
  {
    label: 'Protocol 28',
    query: 'Protocol 28',
    pathways: ['human-health-direct', 'human-health-food', 'eco-food-bsaf'],
  },
  {
    label: 'FCV',
    query: 'FCV',
    pathways: ['eco-direct-eqp'],
  },
  {
    label: 'Log Kow',
    query: 'log Kow',
    pathways: ['eco-direct-eqp'],
  },
  {
    label: 'EqP',
    query: 'EqP',
    pathways: ['eco-direct-eqp'],
  },
  {
    label: 'ESB',
    query: 'ESB',
    pathways: ['eco-direct-eqp'],
  },
  {
    label: 'AVS/SEM',
    query: 'AVS',
    pathways: ['eco-direct-eqp'],
    matchTerms: ['AVS', 'SEM'],
  },
  {
    label: 'TRV',
    query: 'TRV',
    pathways: ['eco-food-bsaf'],
  },
  {
    label: 'BSAF',
    query: 'BSAF',
    pathways: ['eco-food-bsaf', 'human-health-food'],
  },
  {
    label: 'Eco-SSL',
    query: 'Eco-SSL',
    pathways: ['eco-food-bsaf'],
  },
  {
    label: 'Wildlife',
    query: 'wildlife',
    pathways: ['eco-food-bsaf'],
  },
  {
    label: 'Avian',
    query: 'avian',
    pathways: ['eco-food-bsaf'],
  },
  {
    label: 'Mammalian',
    query: 'mammalian',
    pathways: ['eco-food-bsaf'],
  },
  {
    label: 'FCSAP',
    query: 'FCSAP',
    pathways: ['eco-food-bsaf'],
  },
];

const SEARCH_ALIASES_BY_INPUT_KEY: Record<string, string[]> = {
  abs_dermal: ['dermal absorption', 'dermal RAF'],
  ba_oral: ['oral bioavailability', 'relative bioavailability'],
  bsaf_loc_freshwater: ['BSAF', 'bioaccumulation'],
  fcv_ug_per_L: ['FCV', 'final chronic value'],
  logKow: ['log Kow', 'octanol water partition coefficient'],
  rfc_inhalation_mg_per_m3: ['RfC', 'reference concentration', 'inhalation TRV'],
  rfd_oral_mg_per_kg_bw_day: ['RfD', 'reference dose', 'oral TRV'],
  sf_oral_per_mg_per_kg_bw_per_day: ['slope factor', 'oral slope factor'],
  trv_eco_mg_per_kg_bw_day: ['TRV', 'wildlife TRV'],
  unit_risk_inhalation_per_ug_m3: ['unit risk', 'inhalation unit risk'],
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

function StatusChip({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border font-semibold capitalize',
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        statusTone(value),
      )}
    >
      {humanizeCatalogLabel(value)}
    </span>
  );
}

function evidenceSummary(row: EvidenceLibraryValueRow): {
  label: string;
  detail: string;
  icon: React.ReactNode;
  className: string;
} {
  const review = getParameterValueReviewDisposition(row.record, row.sources);

  if (review.tone === 'approved') {
    return {
      label: review.label,
      detail: review.detail,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (review.tone === 'blocked') {
    return {
      label: review.label,
      detail: review.detail,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      className: 'text-amber-700 dark:text-amber-300',
    };
  }
  if (review.tone === 'scaffold') {
    return {
      label: review.label,
      detail: review.detail,
      icon: <CircleDot className="h-3.5 w-3.5" />,
      className: 'text-slate-600 dark:text-slate-300',
    };
  }
  return {
    label: review.label,
    detail: review.detail,
    icon: <CircleDot className="h-3.5 w-3.5" />,
    className: 'text-sky-700 dark:text-sky-300',
  };
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

function extractionDateLabel(row: EvidenceLibraryValueRow): string | null {
  const dates = Array.from(
    new Set(row.record.evidence_items.map((evidence) => evidence.extracted_at)),
  ).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.join(', ');
}

function searchableText(row: EvidenceLibraryValueRow): string {
  return [
    row.record.display_name,
    row.record.pathway,
    row.record.input_key,
    humanizeCatalogLabel(row.record.input_key),
    ...(SEARCH_ALIASES_BY_INPUT_KEY[row.record.input_key] ?? []),
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
    ...row.record.evidence_items.map((evidence) => evidence.extracted_at),
    ...row.sources.map((source) => source.short_citation),
  ]
    .filter((part): part is string | number => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase();
}

function rowMatchesSearch(row: EvidenceLibraryValueRow, queryText: string): boolean {
  return searchableText(row).includes(queryText);
}

function suggestionMatchesRows(
  suggestion: SearchSuggestion,
  rows: EvidenceLibraryValueRow[],
): boolean {
  const terms = [suggestion.query, ...(suggestion.matchTerms ?? [])]
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

  return rows.some((row) =>
    terms.some((term) => rowMatchesSearch(row, term)),
  );
}

function sortValueRows(rows: EvidenceLibraryValueRow[]): EvidenceLibraryValueRow[] {
  return [...rows].sort((a, b) => {
    const evidenceDelta =
      EVIDENCE_STATUS_ORDER[a.record.evidence_support_status] -
      EVIDENCE_STATUS_ORDER[b.record.evidence_support_status];
    if (evidenceDelta !== 0) return evidenceDelta;

    const defaultDelta =
      DEFAULT_STATUS_ORDER[a.record.default_status] -
      DEFAULT_STATUS_ORDER[b.record.default_status];
    if (defaultDelta !== 0) return defaultDelta;

    return a.record.display_name.localeCompare(b.record.display_name);
  });
}

export default function CalculatorValueSearchPanel({
  pathway,
  pathwayLabel,
  substanceKey,
  substanceLabel,
  jurisdictionLabel,
  regulatoryFrameId,
  onOpenEvidenceLibrary,
  className,
}: CalculatorValueSearchPanelProps) {
  const [query, setQuery] = useState('');
  const regulatoryFrameFilters = useMemo(
    () => regulatoryFrameEvidenceFilter(regulatoryFrameId),
    [regulatoryFrameId],
  );
  const library = useMemo(
    () =>
      buildEvidenceLibraryView(
        createEvidenceLibraryFilters({
          pathways: [pathway],
          substanceKeys: [substanceKey],
          ...regulatoryFrameFilters,
        }),
      ),
    [pathway, substanceKey, regulatoryFrameFilters],
  );

  const queryText = query.trim().toLowerCase();
  const rows = useMemo(() => sortValueRows(library.values), [library.values]);
  const filteredRows = useMemo(
    () =>
      queryText
        ? rows.filter((row) => rowMatchesSearch(row, queryText))
        : rows,
    [queryText, rows],
  );
  const searchSuggestions = useMemo(
    () =>
      SEARCH_SUGGESTIONS.filter(
        (suggestion) =>
          suggestion.pathways.includes(pathway) &&
          suggestionMatchesRows(suggestion, rows),
      ).slice(0, 9),
    [pathway, rows],
  );
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
  const alternatives = rows.filter(
    (row) => row.record.default_status === 'available_option',
  ).length;
  const qaNeeds = pendingLocators + scaffolds;
  const qualitySummary = [
    `${approved} source-backed`,
    `${qaNeeds} need QA`,
    alternatives > 0 ? `${alternatives} alternatives` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const visibleRows = queryText ? filteredRows : filteredRows.slice(0, 3);
  const hiddenRowCount = filteredRows.length - visibleRows.length;

  const openCurrentView = () => {
    onOpenEvidenceLibrary({
      pathways: [pathway],
      substanceKeys: [substanceKey],
      ...regulatoryFrameFilters,
      ...(queryText ? { search: queryText } : {}),
    });
  };

  const openValueDetails = (row: EvidenceLibraryValueRow) => {
    onOpenEvidenceLibrary({
      pathways: [row.record.pathway],
      substanceKeys: [row.record.substance_key],
      inputKeys: [row.record.input_key],
      parameterValueIds: [row.record.parameter_value_id],
      ...regulatoryFrameFilters,
    });
  };

  return (
    <div
      className={cn('space-y-4', className)}
      data-testid="calculator-value-search-panel"
    >
      <div>
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Value lookup
            </p>
            <h4 className="truncate text-sm font-bold text-slate-950 dark:text-white">
              {substanceLabel}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {pathwayLabel}; {jurisdictionLabel}
            </p>
          </div>
        </div>
        <div
          className="mt-3 flex items-center justify-between gap-3 border-y border-slate-200 py-2 text-xs dark:border-slate-800"
          data-testid="calculator-value-search-audit"
        >
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {rows.length} values
          </span>
          <span className="truncate text-slate-500 dark:text-slate-400">
            {qualitySummary}
          </span>
        </div>
        <p
          className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
          data-testid="calculator-value-search-guidance"
        >
          Choose the substance of interest in the main calculator. Then narrow
          these values by type or source.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Search calculator values</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search parameter or source"
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

      {searchSuggestions.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          data-testid="value-search-suggestions"
        >
          {searchSuggestions.map((suggestion) => {
            const isActive = queryText === suggestion.query.toLowerCase();
            return (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => setQuery(suggestion.query)}
                aria-pressed={isActive}
                className={cn(
                  'min-h-8 rounded-full border px-2.5 text-xs font-semibold transition',
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300',
                )}
              >
                {suggestion.label}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={openCurrentView}
        className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
      >
        <ExternalLink className="h-4 w-4" />
        Full reference details
      </button>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No catalog values match this calculator view and search.
        </div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => {
            const support = evidenceSummary(row);
            const extractedAt = extractionDateLabel(row);
            return (
            <article
              key={row.record.parameter_value_id}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="min-w-0">
                <h4 className="text-sm font-semibold leading-snug text-slate-950 dark:text-white">
                  {row.record.display_name}
                </h4>
                <div className="mt-1 break-words font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatValue(row.record.value, row.record.unit)}
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{humanizeCatalogLabel(row.record.input_key)}</span>
                  <span className={cn('inline-flex items-center gap-1 font-semibold', support.className)}>
                    {support.icon}
                    {support.label}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {support.detail}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusChip value={row.record.default_status} compact />
                {row.record.evidence_support_status === 'approved_source_backed' &&
                row.record.source_authority_tier ? (
                  <StatusChip value={row.record.source_authority_tier} compact />
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => openValueDetails(row)}
                aria-label={`Open reference details for ${row.record.display_name}`}
                className="mt-2 flex w-full items-start gap-1.5 rounded-md px-0 text-left text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{sourceReferenceLabel(row)}</span>
              </button>
              {extractedAt && (
                <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Extracted {extractedAt}
                </div>
              )}
            </article>
            );
          })}
          {hiddenRowCount > 0 && (
            <button
              type="button"
              onClick={openCurrentView}
              className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-xs font-semibold text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-300"
            >
              {hiddenRowCount} more in reference details
            </button>
          )}
        </div>
      )}
    </div>
  );
}
