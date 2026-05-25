'use client';

import React, { useMemo, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  PROTOCOL28_POLICY_ALIGNMENT,
  buildProtocol28ReviewSummary,
  buildEvidenceLibraryView,
  createEvidenceLibraryFilters,
  getParameterValueReviewDisposition,
  getSourceLeadReviewDisposition,
  humanizeCatalogLabel,
  isCalculatorEvidenceSource,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFacetOption,
  EvidenceLibraryProtocol28ReviewSummary,
  EvidenceLibrarySourceLeadSummary,
  EvidenceLibraryValueGroup,
  EvidenceLibraryValueRow,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  EvidenceLibraryViewMode,
} from '@/lib/matrix-options/provenance/types';

interface EvidenceLibraryProps {
  filters: EvidenceLibraryFilters;
  onFiltersChange: (filters: EvidenceLibraryFilters) => void;
  className?: string;
}

const VIEW_MODES: Array<{ id: EvidenceLibraryViewMode; label: string }> = [
  { id: 'by-parameter', label: 'By Parameter' },
  { id: 'values', label: 'Values' },
  { id: 'equations', label: 'Equations' },
  { id: 'sources', label: 'Sources' },
  { id: 'source-leads', label: 'Source Leads' },
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
  inputKeys: 'Input',
  qaStatuses: 'QA',
  defaultStatuses: 'Default',
  evidenceSupportStatuses: 'Evidence',
  extractionStatuses: 'Extraction',
  jurisdictions: 'Jurisdiction',
  sourceIds: 'Source',
  sourceAuthorityTiers: 'Tier',
  sourceRoles: 'Source role',
  canonicalSourceStatuses: 'Canonical status',
  bcProtocolAlignments: 'Policy alignment',
  parameterValueIds: 'Value',
  candidateGroupIds: 'Parameter',
  equationIds: 'Equation',
  zoteroStatuses: 'Zotero',
  currentnessStatuses: 'Currentness',
  authorityScopes: 'Authority',
  receptorGroups: 'Receptor',
  populationGroups: 'Population',
  speciesGroups: 'Species',
};

const QUICK_REVIEW_FILTERS: Array<{
  label: string;
  description: string;
  viewMode: EvidenceLibraryViewMode;
  request: EvidenceLibraryFilterRequest;
}> = [
  {
    label: 'Protocol 28',
    description: 'Policy compilation; original source check required.',
    viewMode: 'by-parameter',
    request: {
      search: 'Protocol 28',
      bcProtocolAlignments: [PROTOCOL28_POLICY_ALIGNMENT],
    },
  },
  {
    label: 'Health Canada',
    description: 'Approved alternatives, not automatic defaults.',
    viewMode: 'values',
    request: {
      sourceIds: ['src-health-canada-trv-v4-2025'],
      evidenceSupportStatuses: ['approved_source_backed'],
    },
  },
  {
    label: 'IRIS',
    description: 'Approved alternatives, not automatic defaults.',
    viewMode: 'values',
    request: {
      sourceIds: [
        'src-us-epa-iris-rfd-table-live',
        'src-us-epa-iris-chemical-details-live',
      ],
      evidenceSupportStatuses: ['approved_source_backed'],
    },
  },
  {
    label: 'Eco-SSL',
    description: 'Screening/source leads; exact locators required.',
    viewMode: 'source-leads',
    request: {
      search: 'Eco-SSL',
    },
  },
  {
    label: 'ERDC BSAF',
    description: 'Database candidates; row locator review required.',
    viewMode: 'by-parameter',
    request: {
      search: 'BSAF',
      sourceIds: ['src-erdc-bsaf-db'],
    },
  },
  {
    label: 'WQCIU',
    description: 'Source-of-sources leads only.',
    viewMode: 'source-leads',
    request: {
      search: 'WQCIU',
      sourceIds: ['src-acfn-wqciu'],
    },
  },
  {
    label: 'SSD-derived',
    description: 'Derived preview only until ssdtools parity and QA.',
    viewMode: 'values',
    request: {
      search: 'SSD',
      evidenceSupportStatuses: ['user_entered_or_derived'],
    },
  },
];

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
  if (
    status === 'approved' ||
    status === 'current' ||
    status === 'approved_source_backed'
  ) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800';
  }
  if (
    status.includes('needs') ||
    status === 'pending_owner_export' ||
    status === 'pending_source_locator' ||
    status === 'current_calculator_scaffold' ||
    status === 'reference_mining_lead'
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

function reviewToneClass(tone: 'approved' | 'blocked' | 'derived' | 'scaffold'): string {
  if (tone === 'approved') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (tone === 'derived') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  if (tone === 'scaffold') {
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
}

function ReviewDispositionNote({
  label,
  detail,
  tone,
  compact = false,
}: {
  label: string;
  detail: string;
  tone: 'approved' | 'blocked' | 'derived' | 'scaffold';
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-2 text-xs',
        reviewToneClass(tone),
      )}
    >
      <div className="font-semibold">{label}</div>
      {!compact && <div className="mt-0.5 leading-relaxed">{detail}</div>}
    </div>
  );
}

function DerivedPreviewEmptyState() {
  return (
    <div
      className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200"
      data-testid="derived-preview-empty-state"
    >
      <div className="font-semibold">Derived preview only</div>
      <p className="mt-1 text-xs leading-relaxed">
        SSD-derived candidates are generated in the SSD Workbench receipt and
        remain read-only until official ssdtools parity, source review, QA, and
        owner approval are complete. They are not stored as catalog defaults.
      </p>
    </div>
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

function extractionDateLabel(row: EvidenceLibraryValueRow): string {
  const dates = Array.from(
    new Set(row.record.evidence_items.map((evidence) => evidence.extracted_at)),
  ).filter(Boolean);
  if (dates.length === 0) return 'Not recorded';
  return dates.join(', ');
}

function sourceLabels(row: EvidenceLibraryValueRow): string {
  const evidenceSources = row.sources.filter(isCalculatorEvidenceSource);
  const policyCompilationSources = row.sources.filter(
    (source) => source.calculator_source_role === 'policy_compilation',
  );
  const referenceMiningSources = row.sources.filter(
    (source) => source.calculator_source_role === 'reference_mining',
  );
  if (evidenceSources.length === 0) {
    if (policyCompilationSources.length > 0) {
      const first = policyCompilationSources[0].short_citation;
      return `${first}; original source pending`;
    }
    if (referenceMiningSources.length > 0) {
      const first = referenceMiningSources[0].short_citation;
      return `${first}; reference-mining only`;
    }
    return row.record.evidence_support_status === 'user_entered_or_derived'
      ? 'User-entered or derived value'
      : 'Current calculator scaffold only';
  }
  if (row.record.evidence_support_status === 'pending_source_locator') {
    const first = evidenceSources[0].short_citation;
    return evidenceSources.length === 1
      ? `${first}; pending exact locator`
      : `${first}; +${evidenceSources.length - 1}; pending exact locators`;
  }
  const first = evidenceSources[0].short_citation;
  return evidenceSources.length === 1
    ? first
    : `${first}; +${evidenceSources.length - 1}`;
}

function sourceRelationshipLabels(row: EvidenceLibraryValueRow): string {
  if (row.sourceRelationships.length === 0) return 'No source relationships';
  return row.sourceRelationships
    .map((relationship) => {
      const source = row.sources.find(
        (candidate) => candidate.source_id === relationship.source_id,
      );
      const citation = source?.short_citation ?? relationship.source_id ?? 'No source';
      return `${citation}: ${humanizeCatalogLabel(relationship.role)}`;
    })
    .join('; ');
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

function AuditStrip({
  audit,
}: {
  audit: ReturnType<typeof buildEvidenceLibraryView>['audit'];
}) {
  const sourceLeadCount =
    audit.sourceLeads.equationLeads +
    audit.sourceLeads.parameterValueLeads +
    audit.sourceLeads.canonicalSourceLeads +
    audit.sourceLeads.documentLeads;
  const items = [
    {
      label: 'Approved values',
      value: audit.values.approvedSourceBacked,
      note: `${audit.values.total} catalog values`,
    },
    {
      label: 'Pending locators',
      value: audit.values.pendingSourceLocator,
      note: 'candidate sources attached',
    },
    {
      label: 'Calculator scaffolds',
      value: audit.values.currentCalculatorScaffold,
      note: 'current UI values only',
    },
    {
      label: 'Equations pending',
      value: audit.equations.pendingReview,
      note: `${audit.equations.total} equations total`,
    },
    {
      label: 'Source-of-sources leads',
      value: sourceLeadCount,
      note: `${audit.sourceLeads.leadSets} lead sets`,
    },
  ];

  return (
    <div
      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 xl:grid-cols-5"
      aria-label="Catalog provenance audit"
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {item.label}
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {item.value}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {item.note}
          </div>
        </div>
      ))}
    </div>
  );
}

function Protocol28ReviewPanel({
  summary,
  onReview,
}: {
  summary: EvidenceLibraryProtocol28ReviewSummary;
  onReview: () => void;
}) {
  const items = [
    {
      label: 'Candidate values',
      value: summary.candidateValueCount,
    },
    {
      label: 'Blocked candidates',
      value: summary.blockedCandidateCount,
    },
    {
      label: 'Calculation defaults',
      value: summary.currentDefaultCount,
    },
    {
      label: 'Source lead sets',
      value: summary.sourceLeadSetCount,
    },
  ];

  return (
    <section
      data-testid="protocol28-review-panel"
      className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Protocol 28 review queue
          </p>
          <h3 className="mt-1 text-base font-bold">
            Policy compilation leads stay blocked from defaults
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            Protocol 28 points to potentially relevant TRVs, but Matrix Options
            treats those rows as read-only until the original cited source,
            exact locator, currentness, applicability, QA, and approval are
            complete.
          </p>
        </div>
        <button
          type="button"
          onClick={onReview}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 shadow-sm hover:border-amber-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          Review Protocol 28 queue
        </button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-amber-200 bg-white px-3 py-2 dark:border-amber-800 dark:bg-amber-950/60"
          >
            <div className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-200">
              {item.label}
            </div>
            <div className="mt-1 text-xl font-bold">{item.value}</div>
          </div>
        ))}
      </div>
      {summary.nextActions.length > 0 && (
        <div className="mt-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
          Next source checks: {summary.nextActions.join('; ')}
        </div>
      )}
    </section>
  );
}

function ValueDetailPanel({
  row,
  onClose,
}: {
  row: EvidenceLibraryValueRow;
  onClose: () => void;
}) {
  const review = getParameterValueReviewDisposition(row.record, row.sources);
  const canonicalSources = row.sources.filter(isCalculatorEvidenceSource);

  return (
    <section
      className="rounded-lg border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-800 dark:bg-slate-950"
      data-testid="evidence-library-value-detail"
      aria-label="Selected value detail"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Selected value
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
            {row.record.display_name}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {row.substanceLabel}; {humanizeCatalogLabel(row.record.pathway)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Value
              </div>
              <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                {formatValue(row.record.value, row.record.unit)}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Jurisdiction
              </div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                {row.record.jurisdiction}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Evidence items
              </div>
              <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                {row.record.evidence_items.length}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Candidate group
              </div>
              <div className="mt-1 break-all text-xs text-slate-800 dark:text-slate-100">
                {row.record.candidate_group_id}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <StatusBadge value={row.record.default_status} />
            <StatusBadge value={row.record.evidence_support_status} />
            <StatusBadge value={row.record.qa_status} />
            <StatusBadge value={row.record.extraction_status} />
            {row.record.canonical_source_status && (
              <StatusBadge value={row.record.canonical_source_status} />
            )}
          </div>

          <ReviewDispositionNote {...review} />

          <div className="grid gap-3 text-sm lg:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Applicability
              </div>
              <p className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.applicability}
              </p>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Review notes
              </div>
              <p className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.review_notes}
              </p>
            </div>
          </div>
        </div>

        <aside className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Provenance chain
          </div>
          <div className="mt-2 space-y-2 text-slate-700 dark:text-slate-200">
            <div>
              <span className="font-semibold">Canonical sources: </span>
              {canonicalSources.length > 0
                ? canonicalSources.map((source) => source.short_citation).join('; ')
                : sourceLabels(row)}
            </div>
            <div>
              <span className="font-semibold">Source relationships: </span>
              {sourceRelationshipLabels(row)}
            </div>
            <div>
              <span className="font-semibold">Policy alignment: </span>
              {row.record.bc_protocol_alignment
                ? humanizeCatalogLabel(row.record.bc_protocol_alignment)
                : 'Not recorded'}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {row.record.evidence_items.map((evidence) => (
              <div
                key={evidence.evidence_id}
                className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {evidence.locator}
                </div>
                <div className="mt-1">
                  {humanizeCatalogLabel(evidence.locator_type)};{' '}
                  {humanizeCatalogLabel(evidence.qa_status)}
                </div>
                <div className="mt-1">Extracted {evidence.extracted_at}</div>
              </div>
            ))}
            {row.record.evidence_items.length === 0 && (
              <div className="rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                No evidence items recorded.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ValueGroupCard({ group }: { group: EvidenceLibraryValueGroup }) {
  const currentDefault = group.currentDefault;
  const currentValue = currentDefault
    ? formatValue(currentDefault.record.value, currentDefault.record.unit)
    : 'No current default';

  return (
    <details className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <summary className="cursor-pointer px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">
              {group.substanceLabel}: {humanizeCatalogLabel(group.inputKey)}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {humanizeCatalogLabel(group.pathway)}; {group.jurisdiction};{' '}
              {group.records.length} candidate
              {group.records.length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-sm text-slate-800 dark:text-slate-100">
              {currentValue}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 sm:justify-end">
              {group.evidenceSupportStatuses.map((status) => (
                <StatusBadge key={status} value={status} />
              ))}
              {group.qaStatuses.map((status) => (
                <StatusBadge key={status} value={status} />
              ))}
            </div>
          </div>
        </div>
      </summary>
      <div className="border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
        <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
          Candidate values are read-only until exact locators and QA are approved.
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-semibold">Value</th>
                <th className="py-2 pr-4 font-semibold">Default role</th>
                <th className="py-2 pr-4 font-semibold">Evidence support</th>
                <th className="py-2 pr-4 font-semibold">Review status</th>
                <th className="py-2 pr-4 font-semibold">Extracted</th>
                <th className="py-2 pr-4 font-semibold">QA</th>
                <th className="py-2 font-semibold">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {group.records.map((row) => {
                const review = getParameterValueReviewDisposition(
                  row.record,
                  row.sources,
                );
                return (
                  <tr key={row.record.parameter_value_id} className="align-top">
                    <td className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-100">
                      {formatValue(row.record.value, row.record.unit)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge value={row.record.default_status} />
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge value={row.record.evidence_support_status} />
                    </td>
                    <td className="py-2 pr-4">
                      <ReviewDispositionNote {...review} compact />
                    </td>
                    <td className="py-2 pr-4 text-xs text-slate-500 dark:text-slate-400">
                      {extractionDateLabel(row)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge value={row.record.qa_status} />
                    </td>
                    <td className="py-2 text-slate-600 dark:text-slate-300">
                      {sourceLabels(row)}
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {sourceRelationshipLabels(row)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {group.relatedSourceLeads.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Related source-of-sources leads
            </div>
            <div className="flex flex-wrap gap-1">
              {group.relatedSourceLeads.map((lead) => (
                <span
                  key={lead.leadSetId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  {lead.label}: {humanizeCatalogLabel(lead.status)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function SourceLeadCard({ lead }: { lead: EvidenceLibrarySourceLeadSummary }) {
  const totalLeads =
    lead.counts.equationLeads +
    lead.counts.parameterValueLeads +
    lead.counts.canonicalSourceLeads +
    lead.counts.documentLeads;
  const review = getSourceLeadReviewDisposition(lead);

  return (
    <details className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <summary className="cursor-pointer px-3 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">
              {lead.label}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Source-of-sources or policy-compilation context only; not canonical calculator evidence.
            </div>
            <div className="mt-2 max-w-xl">
              <ReviewDispositionNote {...review} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1 sm:justify-end">
            <StatusBadge value={lead.status} />
            <StatusBadge value={lead.primarySourceRole ?? 'reference_mining_lead'} />
          </div>
        </div>
      </summary>
      <div className="space-y-3 border-t border-slate-200 px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-200">
        {lead.rule && (
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {lead.rule}
          </p>
        )}
        <div className="grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2 xl:grid-cols-5">
          <div>{totalLeads} total leads</div>
          <div>{lead.counts.equationLeads} equation leads</div>
          <div>{lead.counts.parameterValueLeads} value leads</div>
          <div>{lead.counts.canonicalSourceLeads} canonical leads</div>
          <div>{lead.counts.documentLeads + lead.counts.hubPages} document or hub leads</div>
        </div>
        {lead.nextActions.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {lead.nextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default function EvidenceLibrary({
  filters,
  onFiltersChange,
  className,
}: EvidenceLibraryProps) {
  const [viewMode, setViewMode] = useState<EvidenceLibraryViewMode>('by-parameter');
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const library = useMemo(() => buildEvidenceLibraryView(filters), [filters]);
  const protocol28Summary = useMemo(() => buildProtocol28ReviewSummary(), []);
  const activeLabels = activeFilterLabels(filters);
  const assumptionValues = library.values.filter(
    (row) =>
      row.record.default_status !== 'not_default' ||
      row.assumptionTags.length > 0,
  );
  const visibleValues =
    viewMode === 'assumptions' ? assumptionValues : library.values;
  const isDerivedPreviewFilter = filters.evidenceSupportStatuses.includes(
    'user_entered_or_derived',
  );
  const selectedValue = useMemo(
    () =>
      selectedValueId
        ? library.values.find(
            (row) => row.record.parameter_value_id === selectedValueId,
          ) ?? null
        : null,
    [library.values, selectedValueId],
  );

  const updateFilter = (key: FilterArrayKey, value: string) => {
    onFiltersChange(setSingleFilter(filters, key, value));
  };
  const applyQuickFilter = (filter: (typeof QUICK_REVIEW_FILTERS)[number]) => {
    setViewMode(filter.viewMode);
    onFiltersChange(createEvidenceLibraryFilters(filter.request));
  };
  const openProtocol28Review = () => {
    setViewMode('by-parameter');
    onFiltersChange(
      createEvidenceLibraryFilters({
        search: 'Protocol 28',
        bcProtocolAlignments: [PROTOCOL28_POLICY_ALIGNMENT],
      }),
    );
  };

  const showValues = viewMode === 'values' || viewMode === 'assumptions';
  const showValueGroups = viewMode === 'by-parameter';
  const showEquations = viewMode === 'equations';
  const showSources = viewMode === 'sources';
  const showSourceLeads = viewMode === 'source-leads';
  const filterControls: Array<{
    key: FilterArrayKey;
    label: string;
    options: EvidenceLibraryFacetOption[];
  }> =
    viewMode === 'sources'
      ? [
          { key: 'authorityScopes', label: 'Authority', options: library.facets.authorityScopes },
          { key: 'sourceAuthorityTiers', label: 'Tier', options: library.facets.sourceAuthorityTiers },
          { key: 'sourceRoles', label: 'Source role', options: library.facets.sourceRoles },
          {
            key: 'canonicalSourceStatuses',
            label: 'Canonical status',
            options: library.facets.canonicalSourceStatuses,
          },
          {
            key: 'currentnessStatuses',
            label: 'Currentness',
            options: library.facets.currentnessStatuses,
          },
          { key: 'zoteroStatuses', label: 'Zotero', options: library.facets.zoteroStatuses },
          {
            key: 'bcProtocolAlignments',
            label: 'Policy alignment',
            options: library.facets.bcProtocolAlignments,
          },
        ]
      : viewMode === 'equations'
        ? [
            { key: 'pathways', label: 'Pathway', options: library.facets.pathways },
            { key: 'evidenceSupportStatuses', label: 'Evidence', options: library.facets.evidenceSupportStatuses },
            { key: 'qaStatuses', label: 'QA', options: library.facets.qaStatuses },
            { key: 'authorityScopes', label: 'Authority', options: library.facets.authorityScopes },
            { key: 'sourceAuthorityTiers', label: 'Tier', options: library.facets.sourceAuthorityTiers },
            { key: 'sourceRoles', label: 'Source role', options: library.facets.sourceRoles },
            {
              key: 'currentnessStatuses',
              label: 'Currentness',
              options: library.facets.currentnessStatuses,
            },
          ]
        : viewMode === 'source-leads'
          ? [
              { key: 'sourceRoles', label: 'Source role', options: library.facets.sourceRoles },
            ]
          : [
              { key: 'pathways', label: 'Pathway', options: library.facets.pathways },
              { key: 'substanceKeys', label: 'Substance', options: library.facets.substances },
              { key: 'inputKeys', label: 'Input', options: library.facets.inputKeys },
              { key: 'evidenceSupportStatuses', label: 'Evidence', options: library.facets.evidenceSupportStatuses },
              { key: 'defaultStatuses', label: 'Default', options: library.facets.defaultStatuses },
              { key: 'qaStatuses', label: 'QA', options: library.facets.qaStatuses },
              { key: 'extractionStatuses', label: 'Extraction', options: library.facets.extractionStatuses },
              { key: 'jurisdictions', label: 'Jurisdiction', options: library.facets.jurisdictions },
              {
                key: 'bcProtocolAlignments',
                label: 'Policy alignment',
                options: library.facets.bcProtocolAlignments,
              },
              { key: 'receptorGroups', label: 'Receptor', options: library.facets.receptorGroups },
              { key: 'populationGroups', label: 'Population', options: library.facets.populationGroups },
              { key: 'speciesGroups', label: 'Species', options: library.facets.speciesGroups },
            ];

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
          className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:inline-grid sm:w-auto sm:grid-cols-6"
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

      <AuditStrip audit={library.audit} />

      <Protocol28ReviewPanel
        summary={protocol28Summary}
        onReview={openProtocol28Review}
      />

      <section
        className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
        data-testid="evidence-library-quick-filters"
        aria-label="Candidate review quick filters"
      >
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Saved Review Views
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              These filters inspect alternatives and source leads only; they do not promote calculator defaults.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_REVIEW_FILTERS.map((filter) => (
            <button
              key={filter.label}
              type="button"
              aria-label={`${filter.label}: ${filter.description}`}
              onClick={() => applyQuickFilter(filter)}
              className="min-h-10 rounded-md border border-slate-200 bg-slate-50 px-3 text-left text-xs text-slate-700 hover:border-sky-300 hover:bg-white hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
            >
              <span className="block font-semibold">{filter.label}</span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {filter.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          {filterControls.map((control) => (
            <FilterSelect
              key={control.key}
              label={control.label}
              value={firstValue(filters, control.key)}
              options={control.options}
              onChange={(value) => updateFilter(control.key, value)}
            />
          ))}
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

      {selectedValue && (
        <ValueDetailPanel
          row={selectedValue}
          onClose={() => setSelectedValueId(null)}
        />
      )}

      {showValueGroups && (
        <section className="space-y-2" data-testid="evidence-library-value-groups">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Values By Parameter
            </h3>
            <span className="text-xs text-slate-500">
              {library.valueGroups.length}
            </span>
          </div>
          <div className="grid gap-2">
            {library.valueGroups.map((group) => (
              <ValueGroupCard key={group.groupId} group={group} />
            ))}
            {library.valueGroups.length === 0 && (
              <div className="rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500 dark:border-slate-800">
                {isDerivedPreviewFilter ? (
                  <DerivedPreviewEmptyState />
                ) : (
                  <div className="text-center">No parameter groups match.</div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

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
                  <th className="px-3 py-2 font-semibold">Default / evidence</th>
                  <th className="px-3 py-2 font-semibold">Review status</th>
                  <th className="px-3 py-2 font-semibold">Applicability</th>
                  <th className="px-3 py-2 font-semibold">Sources</th>
                  <th className="px-3 py-2 font-semibold">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {visibleValues.map((row) => {
                  const review = getParameterValueReviewDisposition(
                    row.record,
                    row.sources,
                  );
                  return (
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
                            <StatusBadge value={row.record.default_status} />
                            <StatusBadge value={row.record.evidence_support_status} />
                            <StatusBadge value={row.record.qa_status} />
                            <StatusBadge value={row.record.extraction_status} />
                          </div>
                        </td>
                        <td className="px-3 py-2 max-w-xs">
                          <ReviewDispositionNote {...review} />
                        </td>
                        <td className="px-3 py-2 max-w-xs">{row.record.applicability}</td>
                        <td className="px-3 py-2 max-w-xs">{sourceLabels(row)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            aria-label={`Inspect ${row.record.display_name}`}
                            data-testid="evidence-library-inspect-value"
                            onClick={() =>
                              setSelectedValueId(row.record.parameter_value_id)
                            }
                            className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <Search className="h-3.5 w-3.5" />
                            Inspect
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={8} className="bg-white px-3 py-2 dark:bg-slate-950">
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
                              <div>Candidate group: {row.record.candidate_group_id}</div>
                              <div>Evidence: {row.record.evidence_items.length}</div>
                              <div>
                                Canonical source:{' '}
                                {row.record.canonical_source_status
                                  ? humanizeCatalogLabel(row.record.canonical_source_status)
                                  : 'Not recorded'}
                              </div>
                              <div>
                                Policy alignment:{' '}
                                {row.record.bc_protocol_alignment
                                  ? humanizeCatalogLabel(row.record.bc_protocol_alignment)
                                  : 'Not recorded'}
                              </div>
                              <div>
                                Source crystallization:{' '}
                                {row.record.source_crystallization_date ?? 'Not recorded'}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                              Source relationships: {sourceRelationshipLabels(row)}
                            </div>
                            <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              {row.record.evidence_items.map((evidence) => (
                                <div key={evidence.evidence_id}>
                                  Extracted {evidence.extracted_at}: {evidence.locator} -{' '}
                                  {humanizeCatalogLabel(evidence.qa_status)}
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                              {row.record.review_notes}
                            </p>
                          </details>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
                {visibleValues.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-sm text-slate-500">
                      {isDerivedPreviewFilter ? (
                        <DerivedPreviewEmptyState />
                      ) : (
                        <div className="text-center">No parameter values match.</div>
                      )}
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
                    <StatusBadge value={row.record.evidence_support_status} />
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
                  <th className="px-3 py-2 font-semibold">Role / tier</th>
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
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge
                          value={
                            row.record.calculator_source_role ??
                            'canonical_candidate'
                          }
                        />
                        {row.record.source_authority_tier && (
                          <StatusBadge value={row.record.source_authority_tier} />
                        )}
                        {row.record.canonical_source_status && (
                          <StatusBadge value={row.record.canonical_source_status} />
                        )}
                      </div>
                      {row.record.bc_protocol_alignment && (
                        <div className="mt-1 text-xs text-slate-500">
                          {humanizeCatalogLabel(row.record.bc_protocol_alignment)}
                        </div>
                      )}
                      {row.record.source_crystallization_date && (
                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          crystallized {row.record.source_crystallization_date}
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
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                      No sources match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showSourceLeads && (
        <section className="space-y-2" data-testid="evidence-library-source-leads">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Source-Of-Sources Leads
            </h3>
            <span className="text-xs text-slate-500">
              {library.sourceLeads.length}
            </span>
          </div>
          <div className="grid gap-2">
            {library.sourceLeads.map((lead) => (
              <SourceLeadCard key={lead.leadSetId} lead={lead} />
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
