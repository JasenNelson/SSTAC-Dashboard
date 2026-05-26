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
  EvidenceLibrarySourceRow,
  EvidenceLibraryValueGroup,
  EvidenceLibraryValueRow,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  EvidenceLibraryViewMode,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import {
  buildDefaultSelectionPolicyDecision,
  type DefaultSelectionDecisionStatus,
  type DefaultSelectionPolicyDecision,
} from '@/lib/matrix-options/defaultSelectionPolicy';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';
import DefaultPolicyDispositionNote, {
  DefaultPolicyDecisionSummaryNote,
} from './DefaultPolicyDispositionNote';

interface EvidenceLibraryProps {
  filters: EvidenceLibraryFilters;
  onFiltersChange: (filters: EvidenceLibraryFilters) => void;
  regulatoryFrameId?: RegulatoryFrameId;
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

const PROTOCOL28_SOURCE_ID = 'src-bc-protocol-28-v3-0-2024';

const DEFAULT_POLICY_STATUS_ORDER: DefaultSelectionDecisionStatus[] = [
  'candidate_pending_approval',
  'manual_decision_required',
  'keep_current_default_no_eligible_candidate',
  'pathway_unsupported',
];

const DEFAULT_POLICY_STATUS_LABELS: Record<
  DefaultSelectionDecisionStatus,
  string
> = {
  candidate_pending_approval: 'Candidate pending approval',
  manual_decision_required: 'Manual decision required',
  keep_current_default_no_eligible_candidate: 'Keep current default',
  pathway_unsupported: 'Unsupported pathway',
};

const DEFAULT_POLICY_STATUS_NOTES: Record<
  DefaultSelectionDecisionStatus,
  string
> = {
  candidate_pending_approval: 'Approved source-backed option exists.',
  manual_decision_required: 'Reviewer must choose among tied candidates.',
  keep_current_default_no_eligible_candidate: 'No approved direct-source option.',
  pathway_unsupported: 'Selected frame blocks this pathway.',
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
    viewMode: 'values',
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

const SOURCE_LEAD_TRIAGE_REQUIREMENTS = [
  {
    label: 'Original source verification',
    detail: 'Check the direct cited source before any calculator use.',
  },
  {
    label: 'Exact locator capture',
    detail: 'Capture page, table, section, or row locators.',
  },
  {
    label: 'Currentness check',
    detail: 'Confirm the cited source is still current.',
  },
  {
    label: 'Applicability review',
    detail: 'Confirm pathway, receptor, medium, unit, and endpoint fit.',
  },
  {
    label: 'QA approval',
    detail: 'Complete technical QA before status changes.',
  },
  {
    label: 'Owner or delegated approval',
    detail: 'Approval is required before calculator default use.',
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

function ResultCountBadge({
  visible,
  total,
  label,
}: {
  visible: number;
  total: number;
  label: string;
}) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      Showing {visible} of {total} {label}
    </span>
  );
}

function resultCountForView(
  library: ReturnType<typeof buildEvidenceLibraryView>,
  viewMode: EvidenceLibraryViewMode,
): { count: number; label: string } {
  if (viewMode === 'by-parameter') {
    return { count: library.valueGroups.length, label: 'parameter groups' };
  }
  if (viewMode === 'values') {
    return { count: library.values.length, label: 'values' };
  }
  if (viewMode === 'assumptions') {
    return {
      count: assumptionRows(library.values).length,
      label: 'assumption/default rows',
    };
  }
  if (viewMode === 'equations') {
    return { count: library.equations.length, label: 'equations' };
  }
  if (viewMode === 'sources') {
    return { count: library.sources.length, label: 'sources' };
  }
  return { count: library.sourceLeads.length, label: 'lead sets' };
}

function formatResultCount({ count, label }: { count: number; label: string }) {
  const singularLabels: Record<string, string> = {
    'parameter groups': 'parameter group',
    values: 'value',
    'assumption/default rows': 'assumption/default row',
    equations: 'equation',
    sources: 'source',
    'lead sets': 'lead set',
  };
  return `${count} ${count === 1 ? singularLabels[label] ?? label : label}`;
}

function filtersEqual(
  left: EvidenceLibraryFilters,
  right: EvidenceLibraryFilters,
): boolean {
  const keys = Object.keys(left) as Array<keyof EvidenceLibraryFilters>;
  return keys.every((key) => {
    const leftValue = left[key];
    const rightValue = right[key];
    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      return leftValue === rightValue;
    }
    return (
      leftValue.length === rightValue.length &&
      leftValue.every((value, index) => value === rightValue[index])
    );
  });
}

function EmptyDatabaseState({
  title,
  activeLabels,
  onClear,
  children,
}: {
  title: string;
  activeLabels: string[];
  onClear: () => void;
  children?: React.ReactNode;
}) {
  const hasActiveFilters = activeLabels.length > 0;

  return (
    <div
      className="rounded-md border border-slate-200 bg-white px-3 py-4 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
      data-testid="evidence-library-empty-state"
    >
      {children}
      <div className={cn('font-semibold', children ? 'mt-3' : undefined)}>
        {title}
      </div>
      {hasActiveFilters ? (
        <>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {activeLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          No catalog records are available for this view.
        </p>
      )}
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

function assumptionRows(rows: EvidenceLibraryValueRow[]): EvidenceLibraryValueRow[] {
  return rows.filter(
    (row) =>
      row.record.default_status !== 'not_default' ||
      row.assumptionTags.length > 0,
  );
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

function defaultPolicyDecisionKey(
  pathway: ProvenancePathway,
  substanceKey: string,
  inputKey: string,
): string {
  return `${pathway}::${substanceKey}::${inputKey}`;
}

function defaultPolicyDecisionForRow(
  decisions: Map<string, DefaultSelectionPolicyDecision>,
  row: EvidenceLibraryValueRow,
): DefaultSelectionPolicyDecision | null {
  return (
    decisions.get(
      defaultPolicyDecisionKey(
        row.record.pathway,
        row.record.substance_key,
        row.record.input_key,
      ),
    ) ?? null
  );
}

function buildDefaultPolicyAuditItems(
  decisions: Map<string, DefaultSelectionPolicyDecision>,
) {
  const counts: Record<DefaultSelectionDecisionStatus, number> = {
    candidate_pending_approval: 0,
    manual_decision_required: 0,
    keep_current_default_no_eligible_candidate: 0,
    pathway_unsupported: 0,
  };

  for (const decision of decisions.values()) {
    counts[decision.status] += 1;
  }

  return DEFAULT_POLICY_STATUS_ORDER.map((status) => ({
    status,
    label: DEFAULT_POLICY_STATUS_LABELS[status],
    note: DEFAULT_POLICY_STATUS_NOTES[status],
    value: counts[status],
  }));
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
  onSelect,
}: {
  audit: ReturnType<typeof buildEvidenceLibraryView>['audit'];
  onSelect: (
    viewMode: EvidenceLibraryViewMode,
    request: EvidenceLibraryFilterRequest,
  ) => void;
}) {
  const sourceLeadCount =
    audit.sourceLeads.equationLeads +
    audit.sourceLeads.parameterValueLeads +
    audit.sourceLeads.canonicalSourceLeads +
    audit.sourceLeads.documentLeads;
  const blockedSourceCount =
    audit.sources.referenceMining + audit.sources.policyCompilations;
  const items: Array<{
    label: string;
    value: number;
    note: string;
    viewMode: EvidenceLibraryViewMode;
    request: EvidenceLibraryFilterRequest;
  }> = [
    {
      label: 'Approved values',
      value: audit.values.approvedSourceBacked,
      note: `${audit.values.total} catalog values`,
      viewMode: 'values' as const,
      request: { evidenceSupportStatuses: ['approved_source_backed'] },
    },
    {
      label: 'Pending locators',
      value: audit.values.pendingSourceLocator,
      note: 'candidate sources attached',
      viewMode: 'values' as const,
      request: { evidenceSupportStatuses: ['pending_source_locator'] },
    },
    {
      label: 'Calculator scaffolds',
      value: audit.values.currentCalculatorScaffold,
      note: 'current UI values only',
      viewMode: 'values' as const,
      request: { evidenceSupportStatuses: ['current_calculator_scaffold'] },
    },
    {
      label: 'Current defaults',
      value: audit.values.currentDefaults,
      note:
        `${audit.values.availableOptions} options; ` +
        `${audit.values.notDefaults} non-default`,
      viewMode: 'values' as const,
      request: { defaultStatuses: ['current_default'] },
    },
    {
      label: 'Equations pending',
      value: audit.equations.pendingReview,
      note:
        `${audit.equations.pendingSourceLocator} locator gaps; ` +
        `${audit.equations.currentCalculatorScaffold} scaffolds`,
      viewMode: 'equations' as const,
      request: { qaStatuses: ['needs_review'] },
    },
    {
      label: 'Source-of-sources leads',
      value: sourceLeadCount,
      note: `${audit.sourceLeads.leadSets} lead sets`,
      viewMode: 'source-leads' as const,
      request: {},
    },
    {
      label: 'Zotero linked',
      value: audit.sources.zoteroLinked,
      note: `${audit.sources.zoteroPending} pending links`,
      viewMode: 'sources' as const,
      request: { zoteroStatuses: ['linked'] },
    },
    {
      label: 'Blocked sources',
      value: blockedSourceCount,
      note: 'reference/policy only',
      viewMode: 'sources' as const,
      request: {
        sourceRoles: ['reference_mining', 'policy_compilation'],
      },
    },
  ];

  return (
    <div
      className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8"
      data-testid="evidence-library-audit-strip"
      aria-label="Catalog provenance audit"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          aria-label={`Show ${item.label}`}
          onClick={() => onSelect(item.viewMode, item.request)}
          className="min-w-0 rounded-md p-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:hover:bg-slate-900"
        >
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {item.label}
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
            {item.value}
          </div>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {item.note}
          </div>
        </button>
      ))}
    </div>
  );
}

function DefaultPolicyAuditPanel({
  decisions,
}: {
  decisions: Map<string, DefaultSelectionPolicyDecision>;
}) {
  const items = buildDefaultPolicyAuditItems(decisions);
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
      data-testid="evidence-library-default-policy-audit"
      aria-label="Default policy audit"
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Default Policy Audit
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Runtime summary for the current filtered value groups. No catalog
            default, QA, or source-status changes are made here.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {total} policy decision{total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.status}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
            data-testid={`default-policy-audit-${item.status}`}
          >
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
    </section>
  );
}

function Protocol28ReviewPanel({
  summary,
  onReview,
  onReviewSourceLeads,
}: {
  summary: EvidenceLibraryProtocol28ReviewSummary;
  onReview: () => void;
  onReviewSourceLeads: () => void;
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
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onReview}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 shadow-sm hover:border-amber-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            Review Protocol 28 queue
          </button>
          <button
            type="button"
            onClick={onReviewSourceLeads}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 shadow-sm hover:border-amber-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <Search className="h-3.5 w-3.5" />
            Review Protocol 28 source leads
          </button>
        </div>
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

function SourceLeadTriageChecklist({
  lead,
}: {
  lead: EvidenceLibrarySourceLeadSummary;
}) {
  const locatorLeadCount = lead.counts.documentLeads + lead.counts.hubPages;
  const locatorSummary =
    locatorLeadCount > 0
      ? `${locatorLeadCount} document or hub lead${locatorLeadCount === 1 ? '' : 's'} to inspect`
      : 'No document or hub locators summarized';
  const roleSummary = lead.primarySourceRole
    ? `Primary role: ${humanizeCatalogLabel(lead.primarySourceRole)}`
    : 'Primary role not cataloged';

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
            Read-only triage checklist
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Lead triage only; not calculator evidence or calculator default
            support.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 sm:justify-end">
          <StatusBadge value="not_default" />
          <StatusBadge value={lead.status} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {SOURCE_LEAD_TRIAGE_REQUIREMENTS.map((item) => (
          <div
            key={item.label}
            className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {item.label}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
        {roleSummary}; {locatorSummary}.
      </div>
    </div>
  );
}

function ValueDetailPanel({
  row,
  policyDecision,
  onClose,
}: {
  row: EvidenceLibraryValueRow;
  policyDecision: DefaultSelectionPolicyDecision | null;
  onClose: () => void;
}) {
  const review = getParameterValueReviewDisposition(row.record, row.sources);
  const canonicalSources = row.sources.filter(isCalculatorEvidenceSource);
  const policyCandidate = policyDecision?.candidates.find(
    (candidate) =>
      candidate.record.parameter_value_id === row.record.parameter_value_id,
  );

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

          {policyDecision && policyCandidate ? (
            <DefaultPolicyDispositionNote
              candidate={policyCandidate}
              decision={policyDecision}
              testId={`evidence-default-policy-detail-${row.record.parameter_value_id}`}
            />
          ) : null}

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

function sourceDefaultUseText(row: EvidenceLibrarySourceRow): string {
  if (!isCalculatorEvidenceSource(row.record)) {
    return 'Blocked from calculator defaults. This source is reference-mining, policy-compilation, metadata-only, or implementation context until a directly verified canonical source record supports an approved value.';
  }

  if (row.record.canonical_source_status !== 'direct_source_verified') {
    return 'Not enough for calculator defaults. The source can support review, but default promotion still needs exact locator verification, currentness checks, applicability review, QA approval, and owner or delegated approval.';
  }

  return 'Source is directly verified. It can support a future approved value, but the source alone does not change calculator defaults without value-level QA and owner or delegated approval.';
}

function SourceDetailPanel({
  row,
  onClose,
}: {
  row: EvidenceLibrarySourceRow;
  onClose: () => void;
}) {
  return (
    <section
      className="rounded-lg border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-800 dark:bg-slate-950"
      data-testid="evidence-library-source-detail"
      aria-label="Selected source detail"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
            Selected source
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
            {row.record.short_citation}
          </h3>
          <p className="mt-1 max-w-4xl text-sm text-slate-600 dark:text-slate-300">
            {row.record.title}
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
          <div className="flex flex-wrap gap-1">
            <StatusBadge value={row.record.calculator_source_role ?? 'canonical_candidate'} />
            {row.record.source_authority_tier && (
              <StatusBadge value={row.record.source_authority_tier} />
            )}
            {row.record.canonical_source_status && (
              <StatusBadge value={row.record.canonical_source_status} />
            )}
            <StatusBadge value={row.record.authority_scope} />
            <StatusBadge value={row.record.currentness_status} />
            <StatusBadge value={row.record.zotero_status} />
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {sourceDefaultUseText(row)}
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Publisher
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.publisher ?? 'Not recorded'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Version / year
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.version ?? row.record.year ?? 'Not recorded'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Checked
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.checked_at ?? 'Not recorded'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Page modified
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.page_last_modified ?? 'Not recorded'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                DOI
              </div>
              <div className="mt-1 break-all text-slate-700 dark:text-slate-200">
                {row.record.doi ?? 'Not recorded'}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                Policy alignment
              </div>
              <div className="mt-1 text-slate-700 dark:text-slate-200">
                {row.record.bc_protocol_alignment
                  ? humanizeCatalogLabel(row.record.bc_protocol_alignment)
                  : 'Not recorded'}
              </div>
            </div>
          </div>

          {row.record.notes && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {row.record.notes}
            </p>
          )}
          {row.record.conflict_rule && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              Conflict rule: {row.record.conflict_rule}
            </p>
          )}
        </div>

        <aside className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
            Locator and catalog links
          </div>
          <div className="mt-2 space-y-2 text-slate-700 dark:text-slate-200">
            <div>
              <span className="font-semibold">File storage: </span>
              {humanizeCatalogLabel(row.record.file_storage)}
            </div>
            <div>
              <span className="font-semibold">External hint: </span>
              {row.record.external_file_hint ?? 'Not recorded'}
            </div>
            <div>
              <span className="font-semibold">Zotero key: </span>
              {row.record.zotero_item_key ?? 'Not linked'}
            </div>
            <div>
              <span className="font-semibold">Zotero collection: </span>
              {row.record.zotero_collection_path ?? 'Not recorded'}
            </div>
            <div>
              <span className="font-semibold">Attachments: </span>
              {row.record.zotero_attachment_keys.length > 0
                ? row.record.zotero_attachment_keys.join(', ')
                : 'None recorded'}
            </div>
            <div>
              <span className="font-semibold">Catalog links: </span>
              {row.linkedValueCount} values; {row.linkedEquationCount} equations
            </div>
            <div>
              <span className="font-semibold">Supersedes: </span>
              {row.record.supersedes_source_ids.length > 0
                ? row.record.supersedes_source_ids.join(', ')
                : 'None recorded'}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ValueGroupCard({
  group,
  policyDecision,
}: {
  group: EvidenceLibraryValueGroup;
  policyDecision: DefaultSelectionPolicyDecision | null;
}) {
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
        {policyDecision ? (
          <DefaultPolicyDecisionSummaryNote
            decision={policyDecision}
            className="mb-2"
            testId={`evidence-default-policy-group-${group.groupId}`}
          />
        ) : null}
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
                const policyCandidate = policyDecision?.candidates.find(
                  (candidate) =>
                    candidate.record.parameter_value_id ===
                    row.record.parameter_value_id,
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
                      <div className="space-y-1.5">
                        <ReviewDispositionNote {...review} compact />
                        {policyDecision && policyCandidate ? (
                          <DefaultPolicyDispositionNote
                            candidate={policyCandidate}
                            decision={policyDecision}
                            compact
                            testId={`evidence-default-policy-group-row-${row.record.parameter_value_id}`}
                          />
                        ) : null}
                      </div>
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
    lead.counts.documentLeads +
    lead.counts.hubPages;
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
        <SourceLeadTriageChecklist lead={lead} />
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
  regulatoryFrameId = 'bc-protocol1-v5-dra',
  className,
}: EvidenceLibraryProps) {
  const [viewMode, setViewMode] = useState<EvidenceLibraryViewMode>('by-parameter');
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const library = useMemo(() => buildEvidenceLibraryView(filters), [filters]);
  const baselineLibrary = useMemo(() => buildEvidenceLibraryView(), []);
  const defaultPolicyDecisions = useMemo(() => {
    const decisions = new Map<string, DefaultSelectionPolicyDecision>();

    for (const row of library.values) {
      const key = defaultPolicyDecisionKey(
        row.record.pathway,
        row.record.substance_key,
        row.record.input_key,
      );
      if (!decisions.has(key)) {
        decisions.set(
          key,
          buildDefaultSelectionPolicyDecision({
            frameId: regulatoryFrameId,
            pathway: row.record.pathway,
            substanceKey: row.record.substance_key,
            inputKey: row.record.input_key,
          }),
        );
      }
    }

    return decisions;
  }, [library.values, regulatoryFrameId]);
  const savedReviewViews = useMemo(
    () =>
      QUICK_REVIEW_FILTERS.map((filter) => {
        const savedFilters = createEvidenceLibraryFilters(filter.request);
        const savedLibrary = buildEvidenceLibraryView(savedFilters);
        return {
          ...filter,
          filters: savedFilters,
          resultCountText: formatResultCount(
            resultCountForView(savedLibrary, filter.viewMode),
          ),
        };
      }),
    [],
  );
  const protocol28Summary = useMemo(() => buildProtocol28ReviewSummary(), []);
  const activeLabels = activeFilterLabels(filters);
  const assumptionValues = assumptionRows(library.values);
  const baselineAssumptionValues = assumptionRows(baselineLibrary.values);
  const visibleValues =
    viewMode === 'assumptions' ? assumptionValues : library.values;
  const totalVisibleValues =
    viewMode === 'assumptions'
      ? baselineAssumptionValues.length
      : baselineLibrary.values.length;
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
  const selectedSource = useMemo(
    () =>
      selectedSourceId
        ? library.sources.find((row) => row.record.source_id === selectedSourceId) ??
          null
        : null,
    [library.sources, selectedSourceId],
  );

  const updateFilter = (key: FilterArrayKey, value: string) => {
    onFiltersChange(setSingleFilter(filters, key, value));
  };
  const closeDetailPanels = () => {
    setSelectedValueId(null);
    setSelectedSourceId(null);
  };
  const changeViewMode = (nextViewMode: EvidenceLibraryViewMode) => {
    if (nextViewMode !== viewMode) {
      closeDetailPanels();
    }
    setViewMode(nextViewMode);
  };
  const clearFilters = () => {
    closeDetailPanels();
    onFiltersChange(createEvidenceLibraryFilters());
  };
  const applyQuickFilter = (filter: (typeof QUICK_REVIEW_FILTERS)[number]) => {
    setViewMode(filter.viewMode);
    closeDetailPanels();
    onFiltersChange(createEvidenceLibraryFilters(filter.request));
  };
  const applyAuditFilter = (
    nextViewMode: EvidenceLibraryViewMode,
    request: EvidenceLibraryFilterRequest,
  ) => {
    setViewMode(nextViewMode);
    closeDetailPanels();
    onFiltersChange(createEvidenceLibraryFilters(request));
  };
  const openProtocol28Review = () => {
    setViewMode('values');
    closeDetailPanels();
    onFiltersChange(
      createEvidenceLibraryFilters({
        search: 'Protocol 28',
        bcProtocolAlignments: [PROTOCOL28_POLICY_ALIGNMENT],
      }),
    );
  };
  const openProtocol28SourceLeads = () => {
    setViewMode('source-leads');
    closeDetailPanels();
    onFiltersChange(
      createEvidenceLibraryFilters({
        search: 'Protocol 28',
        sourceIds: [PROTOCOL28_SOURCE_ID],
        sourceRoles: ['policy_compilation'],
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
              onClick={() => changeViewMode(mode.id)}
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

      <AuditStrip audit={library.audit} onSelect={applyAuditFilter} />

      <DefaultPolicyAuditPanel decisions={defaultPolicyDecisions} />

      <Protocol28ReviewPanel
        summary={protocol28Summary}
        onReview={openProtocol28Review}
        onReviewSourceLeads={openProtocol28SourceLeads}
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
          {savedReviewViews.map((filter) => {
            const isActive =
              viewMode === filter.viewMode && filtersEqual(filters, filter.filters);
            return (
              <button
                key={filter.label}
                type="button"
                aria-label={`${filter.label}: ${filter.description}`}
                aria-pressed={isActive}
                onClick={() => applyQuickFilter(filter)}
                className={cn(
                  'min-h-10 rounded-md border px-3 text-left text-xs transition-colors',
                  isActive
                    ? 'border-sky-400 bg-sky-50 text-sky-800 shadow-sm dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-white hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{filter.label}</span>
                  {isActive && (
                    <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-sky-500">
                      Active
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                  {filter.description}
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {filter.resultCountText}
                </span>
              </button>
            );
          })}
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
              onClick={clearFilters}
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
          policyDecision={defaultPolicyDecisionForRow(
            defaultPolicyDecisions,
            selectedValue,
          )}
          onClose={() => setSelectedValueId(null)}
        />
      )}

      {selectedSource && (
        <SourceDetailPanel
          row={selectedSource}
          onClose={() => setSelectedSourceId(null)}
        />
      )}

      {showValueGroups && (
        <section className="space-y-2" data-testid="evidence-library-value-groups">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Values By Parameter
            </h3>
            <ResultCountBadge
              visible={library.valueGroups.length}
              total={baselineLibrary.valueGroups.length}
              label="parameter groups"
            />
          </div>
          <div className="grid gap-2">
            {library.valueGroups.map((group) => (
              <ValueGroupCard
                key={group.groupId}
                group={group}
                policyDecision={
                  defaultPolicyDecisions.get(
                    defaultPolicyDecisionKey(
                      group.pathway,
                      group.substanceKey,
                      group.inputKey,
                    ),
                  ) ?? null
                }
              />
            ))}
            {library.valueGroups.length === 0 && (
              <EmptyDatabaseState
                title="No parameter groups match."
                activeLabels={activeLabels}
                onClear={clearFilters}
              >
                {isDerivedPreviewFilter ? <DerivedPreviewEmptyState /> : null}
              </EmptyDatabaseState>
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
            <ResultCountBadge
              visible={visibleValues.length}
              total={totalVisibleValues}
              label={viewMode === 'assumptions' ? 'assumption/default rows' : 'values'}
            />
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
                  const policyDecision = defaultPolicyDecisionForRow(
                    defaultPolicyDecisions,
                    row,
                  );
                  const policyCandidate = policyDecision?.candidates.find(
                    (candidate) =>
                      candidate.record.parameter_value_id ===
                      row.record.parameter_value_id,
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
                          <div className="space-y-2">
                            <ReviewDispositionNote {...review} />
                            {policyDecision && policyCandidate ? (
                              <DefaultPolicyDispositionNote
                                candidate={policyCandidate}
                                decision={policyDecision}
                                testId={`evidence-default-policy-value-${row.record.parameter_value_id}`}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 max-w-xs">{row.record.applicability}</td>
                        <td className="px-3 py-2 max-w-xs">{sourceLabels(row)}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            aria-label={`Inspect ${row.record.display_name}`}
                            data-testid="evidence-library-inspect-value"
                            onClick={() => {
                              setSelectedSourceId(null);
                              setSelectedValueId(row.record.parameter_value_id);
                            }}
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
                      <EmptyDatabaseState
                        title={
                          viewMode === 'assumptions'
                            ? 'No assumption/default rows match.'
                            : 'No parameter values match.'
                        }
                        activeLabels={activeLabels}
                        onClear={clearFilters}
                      >
                        {isDerivedPreviewFilter ? <DerivedPreviewEmptyState /> : null}
                      </EmptyDatabaseState>
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
            <ResultCountBadge
              visible={library.equations.length}
              total={baselineLibrary.equations.length}
              label="equations"
            />
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
              <EmptyDatabaseState
                title="No equations match."
                activeLabels={activeLabels}
                onClear={clearFilters}
              />
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
            <ResultCountBadge
              visible={library.sources.length}
              total={baselineLibrary.sources.length}
              label="sources"
            />
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
                  <th className="px-3 py-2 font-semibold">Inspect</th>
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
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-label={`Inspect ${row.record.short_citation}`}
                        data-testid="evidence-library-inspect-source"
                        onClick={() => {
                          setSelectedValueId(null);
                          setSelectedSourceId(row.record.source_id);
                        }}
                        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {library.sources.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-sm text-slate-500">
                      <EmptyDatabaseState
                        title="No sources match."
                        activeLabels={activeLabels}
                        onClear={clearFilters}
                      />
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
            <ResultCountBadge
              visible={library.sourceLeads.length}
              total={baselineLibrary.sourceLeads.length}
              label="lead sets"
            />
          </div>
          <div className="grid gap-2">
            {library.sourceLeads.map((lead) => (
              <SourceLeadCard key={lead.leadSetId} lead={lead} />
            ))}
            {library.sourceLeads.length === 0 && (
              <EmptyDatabaseState
                title="No source leads match."
                activeLabels={activeLabels}
                onClear={clearFilters}
              />
            )}
          </div>
        </section>
      )}
    </section>
  );
}
