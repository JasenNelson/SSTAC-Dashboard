'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Search, X } from 'lucide-react';
import { checkCurrentUserAdminStatus } from '@/lib/admin-utils';
import { promoteSourceLead, isUnscopedPromotion } from '@/lib/matrix-options/provenance/promotion';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';
import { submitReview, fetchReviewHistory } from '@/lib/matrix-options/provenance/qa-review-sync';
import type { ParameterValueReview } from '@/lib/matrix-options/provenance/qa-review-sync';
import { submitEvidenceItem, fetchEvidenceItems } from '@/lib/matrix-options/provenance/evidence-sync';
import type { CatalogEvidenceItem } from '@/lib/matrix-options/provenance/evidence-sync';
import { fetchTriageState, setTriageStatus } from '@/lib/matrix-options/provenance/triage-sync';
import type { SourceLeadTriageRow, TriageStatus } from '@/lib/matrix-options/provenance/triage-sync';
import { SOURCE_RECORDS } from '@/lib/matrix-options/provenance/catalog';
import { AddSourceForm } from './AddSourceForm';
import { fetchHitlSources } from '@/lib/matrix-options/provenance/source-sync';
import type { CatalogSourceRow } from '@/lib/matrix-options/provenance/source-sync';
import { usePromotedCandidatesStore } from '@/stores/matrix-options/promotedCandidatesStore';
import { cn } from '@/utils/cn';
import {
  PROTOCOL28_POLICY_ALIGNMENT,
  buildProtocol28ReviewSummary,
  buildCrossPathwayAudit,
  buildEvidenceLibraryView,
  createEvidenceLibraryFilters,
  getParameterValueReviewDisposition,
  getSourceLeadReviewDisposition,
  humanizeCatalogLabel,
  isCalculatorEvidenceSource,
} from '@/lib/matrix-options/provenance/library';
import type {
  CrossPathwayAuditRow,
  CrossPathwayAuditSummary,
  EvidenceLibraryFacetOption,
  EvidenceLibraryProtocol28ReviewSummary,
  EvidenceLibrarySourceLeadSummary,
  EvidenceLibrarySourceRow,
  EvidenceLibraryValueGroup,
  EvidenceLibraryValueRow,
} from '@/lib/matrix-options/provenance/library';
import type {
  CalculatorReceipt,
  CatalogPathway,
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  EvidenceLibraryViewMode,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import { catalogValueRole, isProvenancePathway } from '@/lib/matrix-options/provenance/pathways';
import {
  buildDefaultSelectionPolicyDecision,
  type DefaultSelectionDecisionStatus,
  type DefaultSelectionPolicyDecision,
} from '@/lib/matrix-options/defaultSelectionPolicy';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';
import DefaultPolicyDispositionNote, {
  DefaultPolicyDecisionSummaryNote,
} from './DefaultPolicyDispositionNote';
import {
  checkZoteroHealth,
  getZoteroItemByKey,
} from '@/lib/matrix-options/zotero/client';
import type { ZoteroItem, ZoteroHealthStatus } from '@/lib/matrix-options/zotero/client';

const PATHWAY_LABELS: Record<ProvenancePathway, string> = {
  'eco-direct-eqp': 'Ecological Direct (EqP)',
  'eco-food-bsaf': 'Ecological Food (BSAF)',
  'background-adjustment': 'Background Adjustment',
  'human-health-direct': 'Human Health Direct',
  'human-health-food': 'Human Health Food',
};

interface EvidenceLibraryProps {
  filters: EvidenceLibraryFilters;
  onFiltersChange: (filters: EvidenceLibraryFilters) => void;
  regulatoryFrameId?: RegulatoryFrameId;
  calculatorReceipt?: CalculatorReceipt | null;
  onDismissReceipt?: () => void;
  className?: string;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
  onRequestOpenRightPanel?: () => void;
}

// References & Values is the catalog browser: the Values table (default) and the Sources
// table (with source-of-sources leads folded in). The former By Parameter, Equations,
// Source Leads, and Assumptions tabs were retired -- equations now live in the
// Jurisdictional Frameworks tab, source leads fold into Sources, and Assumptions duplicated
// Values. The underlying view-mode branches remain for internal/quick-filter use.
const VIEW_MODES: Array<{ id: EvidenceLibraryViewMode; label: string }> = [
  { id: 'values', label: 'Values' },
  // Labelled "References" (not "Sources") to match the tab title "References & Values".
  { id: 'sources', label: 'References' },
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
    label: 'Candidate defaults',
    description: 'Eligible candidates pending default review and approval.',
    viewMode: 'values',
    request: {
      evidenceSupportStatuses: ['approved_source_backed'],
      defaultStatuses: ['available_option'],
    },
  },
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
    viewMode: 'sources',
    request: {
      search: 'Eco-SSL',
    },
  },
  {
    label: 'ERDC BSAF',
    description: 'Database candidates; row locator review required.',
    viewMode: 'values',
    request: {
      search: 'BSAF',
      sourceIds: ['src-erdc-bsaf-db'],
    },
  },
  {
    label: 'WQCIU',
    description: 'Source-of-sources leads only.',
    viewMode: 'sources',
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

function AllScaffoldsBanner() {
  return (
    <div
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      data-testid="evidence-library-all-scaffolds-banner"
    >
      All visible parameter values are current calculator scaffolds pending
      source verification. Adjust filters to check for approved source-backed
      defaults.
    </div>
  );
}

// AssumptionChip: distinct violet tone so assumption tags are visually
// separate from the emerald/amber status chips in the same row.
function AssumptionChip({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-200">
      {label}
    </span>
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
  pathway: CatalogPathway,
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

function decisionMatchesDefaultPolicyStatus(
  decision: DefaultSelectionPolicyDecision | null,
  status: DefaultSelectionDecisionStatus | null,
): boolean {
  return status === null || decision?.status === status;
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
  compact = false,
}: {
  audit: ReturnType<typeof buildEvidenceLibraryView>['audit'];
  onSelect: (
    viewMode: EvidenceLibraryViewMode,
    request: EvidenceLibraryFilterRequest,
  ) => void;
  compact?: boolean;
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
      // Source-of-sources leads now fold into the Sources view (the standalone Source Leads
      // tab and Equations tab were retired from References & Values).
      label: 'Source-of-sources leads',
      value: sourceLeadCount,
      note: `${audit.sourceLeads.leadSets} lead sets`,
      viewMode: 'sources' as const,
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
      className={cn(
        'grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950',
        compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8',
      )}
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
  activeStatus,
  onSelectStatus,
  compact = false,
}: {
  decisions: Map<string, DefaultSelectionPolicyDecision>;
  activeStatus: DefaultSelectionDecisionStatus | null;
  onSelectStatus: (status: DefaultSelectionDecisionStatus | null) => void;
  compact?: boolean;
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
      <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-4')}>
        {items.map((item) => {
          const isActive = activeStatus === item.status;
          return (
            <button
              key={item.status}
              type="button"
              aria-label={`Show ${item.label}`}
              aria-pressed={isActive}
              onClick={() => onSelectStatus(isActive ? null : item.status)}
              className={cn(
                'rounded-md border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-500',
                isActive
                  ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-white hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300',
              )}
              data-testid={`default-policy-audit-${item.status}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {item.label}
                </span>
                {isActive && (
                  <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white dark:bg-sky-500">
                    Active
                  </span>
                )}
              </span>
              <span className="mt-1 block text-2xl font-bold text-slate-950 dark:text-white">
                {item.value}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {item.note}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Protocol28ReviewPanel({
  summary,
  onReview,
  onReviewSourceLeads,
  compact = false,
}: {
  summary: EvidenceLibraryProtocol28ReviewSummary;
  onReview: () => void;
  onReviewSourceLeads: () => void;
  compact?: boolean;
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
      <div className={cn('flex flex-col gap-3', !compact && 'lg:flex-row lg:items-start lg:justify-between')}>
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
        <div className={cn('flex flex-wrap gap-2', !compact && 'lg:justify-end')}>
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
      <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-4')}>
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

function CrossPathwayAuditRowCard({
  row,
  onSelect,
}: {
  row: CrossPathwayAuditRow;
  onSelect?: () => void;
}) {
  const severityColor =
    row.inconsistency_severity === 'major'
      ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
      : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30';

  return (
    <div className={cn('rounded border p-2 text-xs', severityColor)}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 dark:text-white truncate">
            {row.substance_label}
          </div>
          <div className="text-slate-600 dark:text-slate-300">{row.input_label}</div>
        </div>
        <span className={cn(
          'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase',
          row.inconsistency_severity === 'major'
            ? 'bg-red-600 text-white dark:bg-red-500'
            : 'bg-amber-500 text-white',
        )}>
          {row.inconsistency_severity}
        </span>
      </div>
      <div className="mt-1 space-y-0.5">
        {Array.from(row.values_by_pathway.values()).map(entry => (
          <div key={entry.pathway} className="flex items-baseline gap-1 text-[11px]">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{entry.pathway_label}:</span>
            <span className="font-mono text-slate-600 dark:text-slate-300">
              {entry.value || '(empty)'} {entry.unit}
            </span>
          </div>
        ))}
      </div>
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          className="mt-1 text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          Inspect first match -&gt;
        </button>
      )}
    </div>
  );
}

function CrossPathwayAuditPanel({
  compact = false,
  onSelectRow,
}: {
  compact?: boolean;
  onSelectRow?: (row: CrossPathwayAuditRow) => void;
}) {
  const summary: CrossPathwayAuditSummary = useMemo(() => buildCrossPathwayAudit(), []);
  const [showDetails, setShowDetails] = useState(false);

  // Only show inconsistent rows (severity != 'none') in the panel
  const inconsistentRows = summary.rows.filter(r => r.is_inconsistent);

  if (inconsistentRows.length === 0) {
    return null; // Nothing to flag
  }

  return (
    <section
      className="rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-slate-950"
      data-testid="cross-pathway-audit-panel"
    >
      <div className={cn('flex items-start', compact ? 'flex-col gap-2' : 'gap-2 sm:flex-row sm:items-end sm:justify-between')}>
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Cross-pathway audit
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Parameters with values that differ across pathways for the same substance.
          </p>
        </div>
      </div>

      <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-3')}>
        <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-[11px] font-semibold uppercase text-red-700 dark:text-red-300">Major</div>
          <div className="mt-0.5 text-lg font-bold text-red-800 dark:text-red-200">
            {summary.majorIssuesCount}
          </div>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="text-[11px] font-semibold uppercase text-amber-700 dark:text-amber-300">Minor</div>
          <div className="mt-0.5 text-lg font-bold text-amber-800 dark:text-amber-200">
            {summary.minorIssuesCount}
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-800 dark:bg-emerald-900/20">
          <div className="text-[11px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">Consistent</div>
          <div className="mt-0.5 text-lg font-bold text-emerald-800 dark:text-emerald-200">
            {summary.consistentCount}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="mt-2 text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
        data-testid="cross-pathway-audit-toggle"
      >
        {showDetails ? 'Hide' : 'Show'} {inconsistentRows.length} flagged {inconsistentRows.length === 1 ? 'parameter' : 'parameters'}
      </button>

      {showDetails && (
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto" data-testid="cross-pathway-audit-details">
          {inconsistentRows.slice(0, 50).map(row => (
            <CrossPathwayAuditRowCard
              key={`${row.substance_key}__${row.input_key}`}
              row={row}
              onSelect={onSelectRow ? () => onSelectRow(row) : undefined}
            />
          ))}
          {inconsistentRows.length > 50 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
              Showing first 50 of {inconsistentRows.length}. Use filters to narrow the scope.
            </p>
          )}
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

function QaReviewActions({
  parameterValueId,
  currentQaStatus,
  currentEvidenceStatus,
}: {
  parameterValueId: string;
  currentQaStatus: string;
  currentEvidenceStatus: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviews, setReviews] = useState<ParameterValueReview[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [effectiveQaStatus, setEffectiveQaStatus] = useState(currentQaStatus);

  useEffect(() => {
    setEffectiveQaStatus(currentQaStatus);
  }, [currentQaStatus]);

  useEffect(() => {
    fetchReviewHistory(parameterValueId).then(setReviews);
  }, [parameterValueId]);

  const handleSubmit = async () => {
    if (!targetStatus) return;
    setSubmitting(true);
    const ok = await submitReview(
      parameterValueId,
      effectiveQaStatus,
      targetStatus,
      note,
      currentEvidenceStatus,
      undefined,
    );
    if (ok) {
      setEffectiveQaStatus(targetStatus);
      const updated = await fetchReviewHistory(parameterValueId);
      setReviews(updated);
    }
    setSubmitting(false);
    setShowForm(false);
    setNote('');
    setTargetStatus('');
  };

  const transitions =
    effectiveQaStatus === 'needs_review'
      ? [
          { value: 'approved', label: 'Approve' },
          { value: 'superseded', label: 'Supersede' },
        ]
      : effectiveQaStatus === 'approved'
        ? [
            { value: 'needs_review', label: 'Revert to needs review' },
            { value: 'superseded', label: 'Supersede' },
          ]
        : [
            { value: 'needs_review', label: 'Revert to needs review' },
            { value: 'approved', label: 'Approve' },
          ];

  return (
    <div className="space-y-2" data-testid="qa-review-actions">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
          QA Review
        </span>
        {transitions.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setTargetStatus(t.value);
              setShowForm(true);
            }}
            disabled={submitting}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
              t.value === 'approved'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                : t.value === 'superseded'
                  ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
            )}
            data-testid={`qa-review-${t.value}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-800 dark:bg-sky-950/30">
          <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
            Change QA status: {effectiveQaStatus} -&gt; {targetStatus}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note (optional)"
            rows={2}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            data-testid="qa-review-note"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500"
              data-testid="qa-review-submit"
            >
              {submitting ? 'Submitting...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setNote('');
                setTargetStatus('');
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-semibold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
            data-testid="qa-review-history-toggle"
          >
            {showHistory ? 'Hide' : 'Show'} review history ({reviews.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1" data-testid="qa-review-history">
              {reviews.map((r) => (
                <div
                  key={r.id}
                  className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                >
                  <span className="font-semibold">
                    {r.old_qa_status} -&gt; {r.new_qa_status}
                  </span>
                  {' at '}
                  {new Date(r.reviewed_at).toLocaleString()}
                  {r.reviewer_note && (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      {r.reviewer_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SupabaseEvidenceItems -- shows HITL-added evidence items from Supabase
// ---------------------------------------------------------------------------

function SupabaseEvidenceItems({
  parameterValueId,
  refreshToken,
}: {
  parameterValueId: string;
  refreshToken: number;
}) {
  const [items, setItems] = useState<CatalogEvidenceItem[]>([]);

  useEffect(() => {
    fetchEvidenceItems(parameterValueId).then(setItems);
  }, [parameterValueId, refreshToken]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-1" data-testid="supabase-evidence-items">
      <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        HITL-added locators
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-md border border-emerald-200 bg-white p-2 text-xs text-slate-600 dark:border-emerald-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {item.locator}
          </div>
          <div className="mt-1">
            {humanizeCatalogLabel(item.locator_type)};{' '}
            {humanizeCatalogLabel(item.qa_status)}
          </div>
          {item.value_text && (
            <div className="mt-1 font-mono text-slate-700 dark:text-slate-200">
              {item.value_text}
            </div>
          )}
          {item.note && (
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {item.note}
            </div>
          )}
          <div className="mt-1 text-slate-400 dark:text-slate-500">
            Added {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddEvidenceLocatorForm -- inline form for HITL to add source locators
// ---------------------------------------------------------------------------

const LOCATOR_TYPES = [
  { value: 'source_page', label: 'Page number' },
  { value: 'source_table', label: 'Table reference' },
  { value: 'source_section', label: 'Section reference' },
  { value: 'equation_citation', label: 'Equation citation' },
  { value: 'external_file', label: 'External file' },
];

function AddEvidenceLocatorForm({
  parameterValueId,
  onAdded,
}: {
  parameterValueId: string;
  onAdded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [locator, setLocator] = useState('');
  const [locatorType, setLocatorType] = useState('source_page');
  const [valueText, setValueText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmedLocator = locator.trim();
  const canSubmit = !!sourceId && trimmedLocator.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await submitEvidenceItem({
      parameter_value_id: parameterValueId,
      source_id: sourceId,
      locator: trimmedLocator,
      locator_type: locatorType,
      value_text: valueText.trim() || null,
      note: note.trim(),
    });
    if (ok) {
      onAdded();
      setShowForm(false);
      setSourceId('');
      setLocator('');
      setValueText('');
      setNote('');
      setLocatorType('source_page');
    }
    setSubmitting(false);
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="mt-3 inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
        data-testid="add-evidence-locator-button"
      >
        + Add evidence locator
      </button>
    );
  }

  return (
    <div
      className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30"
      data-testid="add-evidence-locator-form"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Add evidence locator
      </p>
      <div className="mt-2 grid gap-2">
        <label className="block text-xs text-slate-600 dark:text-slate-300">
          Source
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            data-testid="evidence-source-select"
          >
            <option value="">Select a source...</option>
            {SOURCE_RECORDS.map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.short_citation} ({s.source_id})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600 dark:text-slate-300">
          Locator type
          <select
            value={locatorType}
            onChange={(e) => setLocatorType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {LOCATOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-600 dark:text-slate-300">
          Locator (page, table ref, section)
          <input
            type="text"
            value={locator}
            onChange={(e) => setLocator(e.target.value)}
            placeholder="e.g., Table 3-1, p. 45"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            data-testid="evidence-locator-input"
          />
        </label>
        <label className="block text-xs text-slate-600 dark:text-slate-300">
          Value text (optional -- the actual value from the source)
          <input
            type="text"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder="e.g., 0.014 ug/L"
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <label className="block text-xs text-slate-600 dark:text-slate-300">
          Note (optional)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500"
          data-testid="evidence-locator-submit"
        >
          {submitting ? 'Saving...' : 'Save locator'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ValueDetailPanel({
  row,
  policyDecision,
  onClose,
  compact = false,
  isAdmin = false,
}: {
  row: EvidenceLibraryValueRow;
  policyDecision: DefaultSelectionPolicyDecision | null;
  onClose: () => void;
  compact?: boolean;
  isAdmin?: boolean;
}) {
  const [evidenceRefreshToken, setEvidenceRefreshToken] = useState(0);
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
      <div className={cn('flex flex-col gap-3', !compact && 'lg:flex-row lg:items-start lg:justify-between')}>
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

      <div className={cn('mt-4 grid gap-3', !compact && 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]')}>
        <div className="space-y-3">
          <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-4')}>
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

          {isAdmin && (
            <QaReviewActions
              parameterValueId={row.record.parameter_value_id}
              currentQaStatus={row.record.qa_status}
              currentEvidenceStatus={row.record.evidence_support_status}
            />
          )}

          <ReviewDispositionNote {...review} />

          {policyDecision && policyCandidate ? (
            <DefaultPolicyDispositionNote
              candidate={policyCandidate}
              decision={policyDecision}
              testId={`evidence-default-policy-detail-${row.record.parameter_value_id}`}
            />
          ) : null}

          <div className={cn('grid gap-3 text-sm', !compact && 'lg:grid-cols-2')}>
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
          <SupabaseEvidenceItems
            parameterValueId={row.record.parameter_value_id}
            refreshToken={evidenceRefreshToken}
          />
          {isAdmin && (
            <AddEvidenceLocatorForm
              parameterValueId={row.record.parameter_value_id}
              onAdded={() => setEvidenceRefreshToken((t) => t + 1)}
            />
          )}
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

function ZoteroStatusBadge({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<ZoteroHealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    checkZoteroHealth().then(result => {
      if (mounted) {
        setStatus(result);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400" data-testid="zotero-status-loading">
        Checking Zotero connection...
      </div>
    );
  }

  if (!status?.available) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900" data-testid="zotero-status-unavailable">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">Zotero offline</span>
        </div>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Start Zotero desktop with local API enabled to link sources.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-emerald-800 dark:bg-emerald-900/20" data-testid="zotero-status-available">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
        <span className="font-semibold text-emerald-700 dark:text-emerald-300">Zotero connected</span>
      </div>
      <p className="mt-1 text-emerald-600 dark:text-emerald-400">
        User ID: {status.userId ?? 'local'}
      </p>
    </div>
  );
}

function ZoteroMetadataPanel({ zoteroKey }: { zoteroKey: string }) {
  const [item, setItem] = useState<ZoteroItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);
    getZoteroItemByKey(zoteroKey).then(result => {
      if (!mounted) return;
      if (result) {
        setItem(result);
      } else {
        setError(true);
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [zoteroKey]);

  if (loading) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading Zotero metadata...
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400" data-testid="zotero-metadata-unavailable">
        Zotero item not available (key: {zoteroKey})
      </div>
    );
  }

  const creatorString = item.creators
    .map(c => c.lastName ?? c.name ?? '')
    .filter(Boolean)
    .join(', ');

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs dark:border-emerald-800 dark:bg-emerald-900/20" data-testid="zotero-metadata">
      <div className="font-semibold text-emerald-700 dark:text-emerald-300">
        Zotero: {item.itemType}
      </div>
      <div className="mt-1 text-slate-700 dark:text-slate-200">{item.title}</div>
      {creatorString && (
        <div className="mt-0.5 text-slate-600 dark:text-slate-300">{creatorString}</div>
      )}
      {item.date && (
        <div className="mt-0.5 text-slate-600 dark:text-slate-300">{item.date}</div>
      )}
      {item.attachments.length > 0 && (
        <div className="mt-1 text-emerald-700 dark:text-emerald-300">
          {item.attachments.length} attachment{item.attachments.length === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

function SourceDetailPanel({
  row,
  onClose,
  compact = false,
}: {
  row: EvidenceLibrarySourceRow;
  onClose: () => void;
  compact?: boolean;
}) {
  return (
    <section
      className="rounded-lg border border-sky-200 bg-white p-4 shadow-sm dark:border-sky-800 dark:bg-slate-950"
      data-testid="evidence-library-source-detail"
      aria-label="Selected source detail"
    >
      <div className={cn('flex flex-col gap-3', !compact && 'lg:flex-row lg:items-start lg:justify-between')}>
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

      <div className={cn('mt-4 grid gap-3', !compact && 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]')}>
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

          <div className={cn('grid gap-3 text-sm', compact ? 'grid-cols-1' : 'md:grid-cols-2 xl:grid-cols-3')}>
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

          {row.record.zotero_item_key && (
            <ZoteroMetadataPanel zoteroKey={row.record.zotero_item_key} />
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
              {humanizeCatalogLabel(group.pathway)}; {group.jurisdictions.join(', ') || '--'};{' '}
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

// ---------------------------------------------------------------------------
// TriageStatusBadge -- visual indicator for triage status
// ---------------------------------------------------------------------------

function TriageStatusBadge({ status }: { status: TriageStatus }) {
  const colors: Record<TriageStatus, string> = {
    untriaged: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    promoted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    dismissed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    deferred: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };
  return (
    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase', colors[status])}>
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// LeadTriageControls -- admin-only; dismiss/defer/reset triage actions
// ---------------------------------------------------------------------------

function LeadTriageControls({
  leadSetId,
  currentStatus,
  onTriaged,
}: {
  leadSetId: string;
  currentStatus: TriageStatus;
  onTriaged: (newStatus: TriageStatus) => void;
}) {
  const [showNoteForm, setShowNoteForm] = useState<TriageStatus | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleTriage = async (status: TriageStatus) => {
    setSubmitting(true);
    const ok = await setTriageStatus(leadSetId, status, note.trim());
    if (ok) {
      onTriaged(status);
      setShowNoteForm(null);
      setNote('');
    }
    setSubmitting(false);
  };

  if (showNoteForm) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/30" data-testid="triage-note-form">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
          {showNoteForm === 'dismissed' ? 'Dismiss this lead' : 'Defer this lead'}
        </p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional reason"
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-2 flex gap-1">
          <button
            type="button"
            onClick={() => handleTriage(showNoteForm)}
            disabled={submitting}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500"
            data-testid="triage-confirm"
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => { setShowNoteForm(null); setNote(''); }}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" data-testid="lead-triage-controls">
      <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
        Triage:
      </span>
      <TriageStatusBadge status={currentStatus} />
      {currentStatus !== 'dismissed' && (
        <button
          type="button"
          onClick={() => setShowNoteForm('dismissed')}
          className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
          data-testid="triage-dismiss"
        >
          Dismiss
        </button>
      )}
      {currentStatus !== 'deferred' && (
        <button
          type="button"
          onClick={() => setShowNoteForm('deferred')}
          className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
          data-testid="triage-defer"
        >
          Defer
        </button>
      )}
      {currentStatus !== 'untriaged' && (
        <button
          type="button"
          onClick={() => handleTriage('untriaged')}
          disabled={submitting}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          data-testid="triage-reset"
        >
          Reset
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromoteLeadButton -- admin-only; source-leads view only
// ---------------------------------------------------------------------------

function PromoteLeadButton({
  lead,
  onPromoted,
}: {
  lead: EvidenceLibrarySourceLeadSummary;
  onPromoted?: () => void;
}) {
  const { addCandidate, isPromoted } = usePromotedCandidatesStore();
  const [showPopover, setShowPopover] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<ProvenancePathway>('eco-direct-eqp');

  const alreadyPromoted = isPromoted(lead.leadSetId);

  const handleConfirm = () => {
    const record = promoteSourceLead(lead, 'admin', selectedPathway);
    addCandidate(record);
    setShowPopover(false);
    onPromoted?.();
  };

  if (alreadyPromoted) {
    return (
      <span
        className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"
        data-testid="promote-lead-success"
      >
        Promoted to candidate
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="promote-lead-button"
        onClick={() => setShowPopover(true)}
        className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 text-xs font-semibold text-amber-800 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/30"
      >
        Promote to candidate
      </button>
      {showPopover && (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          data-testid="promote-lead-popover"
        >
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="mb-1 block">Assign pathway</span>
            <select
              value={selectedPathway}
              onChange={(e) => setSelectedPathway(e.target.value as ProvenancePathway)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              data-testid="promote-lead-pathway-select"
            >
              {(Object.keys(PATHWAY_LABELS) as ProvenancePathway[]).map((pw) => (
                <option key={pw} value={pw}>
                  {PATHWAY_LABELS[pw]}
                </option>
              ))}
            </select>
          </label>
          {selectedPathway === 'eco-direct-eqp' && (
            <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              Default pathway -- reviewer must assign the correct pathway before use.
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              data-testid="promote-lead-confirm"
            >
              Confirm promotion
            </button>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              data-testid="promote-lead-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourceLeadCard({
  lead,
  isAdmin = false,
  triage,
  onTriaged,
}: {
  lead: EvidenceLibrarySourceLeadSummary;
  isAdmin?: boolean;
  triage?: SourceLeadTriageRow;
  onTriaged?: (leadSetId: string, newStatus: TriageStatus) => void;
}) {
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
        {isAdmin && (
          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Admin:
              </span>
              <PromoteLeadButton
                lead={lead}
                onPromoted={async () => {
                  await setTriageStatus(lead.leadSetId, 'promoted', '');
                  onTriaged?.(lead.leadSetId, 'promoted');
                }}
              />
            </div>
            <LeadTriageControls
              leadSetId={lead.leadSetId}
              currentStatus={triage?.triage_status ?? 'untriaged'}
              onTriaged={(newStatus) => onTriaged?.(lead.leadSetId, newStatus)}
            />
          </div>
        )}
      </div>
    </details>
  );
}

function PromotedCandidateCard({
  record,
}: {
  record: PromotedParameterValueRecord;
}) {
  const { updatePathway, updateSubstanceKey, removeCandidate } = usePromotedCandidatesStore();
  const [editingPathway, setEditingPathway] = useState(false);
  const [editingSubstance, setEditingSubstance] = useState(false);
  const [substanceInput, setSubstanceInput] = useState(record.substance_key);
  const [auditExpanded, setAuditExpanded] = useState(false);
  const unscoped = isUnscopedPromotion(record);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
      data-testid="promoted-candidate-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-950 dark:text-white">
            {record.display_name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {editingPathway ? (
              <select
                value={record.pathway}
                onChange={(e) => {
                  updatePathway(record.parameter_value_id, e.target.value as ProvenancePathway, 'admin');
                  setEditingPathway(false);
                }}
                onBlur={() => setEditingPathway(false)}
                autoFocus
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                data-testid="promoted-pathway-edit-select"
              >
                {(Object.keys(PATHWAY_LABELS) as ProvenancePathway[]).map((pw) => (
                  <option key={pw} value={pw}>
                    {PATHWAY_LABELS[pw]}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setEditingPathway(true)}
                className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
                  unscoped
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200',
                )}
                data-testid="promoted-pathway-badge"
              >
                {unscoped
                  ? 'Pathway unscoped'
                  : isProvenancePathway(record.pathway)
                    ? PATHWAY_LABELS[record.pathway]
                    : humanizeCatalogLabel(record.pathway)}
              </button>
            )}
            {editingSubstance ? (
              <input
                type="text"
                value={substanceInput}
                onChange={(e) => setSubstanceInput(e.target.value)}
                onBlur={() => {
                  if (substanceInput !== record.substance_key) {
                    updateSubstanceKey(record.parameter_value_id, substanceInput, 'admin');
                  }
                  setEditingSubstance(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (substanceInput !== record.substance_key) {
                      updateSubstanceKey(record.parameter_value_id, substanceInput, 'admin');
                    }
                    setEditingSubstance(false);
                  }
                }}
                autoFocus
                placeholder="substance key"
                className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                data-testid="promoted-substance-edit-input"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingSubstance(true)}
                className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                data-testid="promoted-substance-badge"
              >
                {record.substance_key || 'No substance key'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAuditExpanded((prev) => !prev)}
              className="inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              data-testid="promoted-audit-toggle"
            >
              {auditExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {record.audit_history.length} audit {record.audit_history.length === 1 ? 'entry' : 'entries'}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => removeCandidate(record.parameter_value_id)}
          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          data-testid="promoted-remove-button"
          title="Remove promoted candidate"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {auditExpanded && (
        <div
          className="mt-2 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800"
          data-testid="promoted-audit-trail"
        >
          {record.audit_history.length === 0 ? (
            <p className="text-[11px] text-slate-400">No audit entries.</p>
          ) : (
            record.audit_history.map((entry, index) => (
              <div key={index} className="text-[11px] text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {entry.action}
                </span>
                {' '}by {entry.actor}{' '}
                <span className="text-slate-400 dark:text-slate-500">
                  ({new Date(entry.timestamp).toLocaleString()})
                </span>
                {entry.note && (
                  <div className="ml-2 mt-0.5 text-slate-500 dark:text-slate-500">
                    {entry.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PromotedCandidatesSection() {
  const { candidates, getCandidateCount, getUnscopedCount } = usePromotedCandidatesStore();
  const count = getCandidateCount();
  const unscopedCount = getUnscopedCount();

  if (count === 0) return null;

  return (
    <div className="space-y-2" data-testid="promoted-candidates-section">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Promoted candidates ({count})
        </h3>
        {unscopedCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {unscopedCount} unscoped
          </span>
        )}
      </div>
      {unscopedCount > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="font-semibold">
            {unscopedCount} promoted {unscopedCount === 1 ? 'candidate needs' : 'candidates need'} pathway assignment
          </span>{' '}
          before {unscopedCount === 1 ? 'it' : 'they'} can route to a calculator.
        </div>
      )}
      <div className="space-y-2">
        {Object.values(candidates).map((record) => (
          <PromotedCandidateCard key={record.parameter_value_id} record={record} />
        ))}
      </div>
    </div>
  );
}

function CalculatorReceiptBanner({
  receipt,
  onDismiss,
}: {
  receipt: CalculatorReceipt;
  onDismiss?: () => void;
}) {
  const inputLabel =
    receipt.inputKeys.length === 1
      ? `1 input key: ${humanizeCatalogLabel(receipt.inputKeys[0])}`
      : `${receipt.inputKeys.length} input keys`;

  return (
    <div
      className="flex items-start justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
      data-testid="calculator-receipt-banner"
    >
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Calculator request
        </p>
        <p className="mt-1 font-semibold">
          {receipt.substanceLabel} -- {receipt.pathwayLabel}
        </p>
        <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-300">
          {inputLabel}; frame: {receipt.frameLabel}
        </p>
        <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">
          Read-only view of candidate defaults. Calculator defaults do not change from this view.
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss calculator receipt"
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sky-500 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-900 dark:hover:text-sky-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HitlSourcesSection -- admin-only collapsible source-registration panel
// ---------------------------------------------------------------------------

function HitlSourcesSection({ isAdmin }: { isAdmin: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const [sources, setSources] = useState<CatalogSourceRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;
    fetchHitlSources().then(rows => {
      if (mounted) setSources(rows);
    });
    return () => { mounted = false; };
  }, [isAdmin, refreshKey]);

  if (!isAdmin) return null;

  const handleAdded = (_sourceId: string) => {
    setShowForm(false);
    setRefreshKey(k => k + 1);
  };

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
      data-testid="hitl-sources-section"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          HITL Sources
          {sources.length > 0 && (
            <span className="ml-1 text-slate-400 dark:text-slate-500">({sources.length})</span>
          )}
        </h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
            data-testid="hitl-sources-add-button"
          >
            + Register
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2">
          <AddSourceForm
            onAdded={handleAdded}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="hitl-sources-list">
          {sources.slice(0, 5).map(source => (
            <div
              key={source.source_id}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {source.short_citation}
              </div>
              <div className="text-slate-500 dark:text-slate-400 truncate">
                {source.source_id}
              </div>
            </div>
          ))}
          {sources.length > 5 && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              +{sources.length - 5} more
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function EvidenceLibrary({
  filters,
  onFiltersChange,
  regulatoryFrameId = 'bc-protocol1-v5-dra',
  calculatorReceipt,
  onDismissReceipt,
  className,
  showLeftPanel = true,
  showRightPanel = true,
  onRequestOpenRightPanel,
}: EvidenceLibraryProps) {
  const [viewMode, setViewMode] = useState<EvidenceLibraryViewMode>('values');
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [defaultPolicyStatusFilter, setDefaultPolicyStatusFilter] =
    useState<DefaultSelectionDecisionStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [triageState, setTriageState] = useState<Record<string, SourceLeadTriageRow>>({});
  const [triageRefreshKey, setTriageRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    checkCurrentUserAdminStatus().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    usePromotedCandidatesStore.persist.rehydrate();
    usePromotedCandidatesStore.getState().hydrateFromSupabase().catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const latestTriageGenRef = useRef(0);

  useEffect(() => {
    const gen = ++latestTriageGenRef.current;
    fetchTriageState().then((result) => {
      if (gen === latestTriageGenRef.current) {
        setTriageState(result);
      }
    });
  }, [triageRefreshKey]);

  const handleLeadTriaged = (leadSetId: string, newStatus: TriageStatus) => {
    setTriageState((prev) => ({
      ...prev,
      [leadSetId]: {
        ...(prev[leadSetId] ?? {
          id: '',
          lead_set_id: leadSetId,
          triage_note: '',
          triaged_by: null,
          triaged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
        triage_status: newStatus,
        updated_at: new Date().toISOString(),
      },
    }));
    setTriageRefreshKey((k) => k + 1);
  };

  // Promoted (approved canonical) records are hydrated from Supabase into the store; merge
  // them into the Evidence Library view so they join the main By-Parameter/Values tables
  // (with pathway, weighting-modifier, and jurisdiction rendering) instead of only the
  // "Promoted candidates" side panel.
  const candidates = usePromotedCandidatesStore((state) => state.candidates);
  const promotedRecords = useMemo(
    () => Object.values(candidates),
    [candidates],
  );
  const library = useMemo(
    () => buildEvidenceLibraryView(filters, promotedRecords),
    [filters, promotedRecords],
  );
  const baselineLibrary = useMemo(
    () => buildEvidenceLibraryView(undefined, promotedRecords),
    [promotedRecords],
  );
  const defaultPolicyDecisions = useMemo(() => {
    const decisions = new Map<string, DefaultSelectionPolicyDecision>();

    for (const row of library.values) {
      // Default-selection policy is a CALCULATOR concept. Catalog evidence categories
      // (toxicity values, weighting modifiers, exposure parameters, eco-soil/screening,
      // reference/background) never drive a calculator default, so they get no policy
      // decision -- guard before calling the calculator-only policy API.
      const pathway = row.record.pathway;
      if (!isProvenancePathway(pathway)) continue;
      const key = defaultPolicyDecisionKey(
        pathway,
        row.record.substance_key,
        row.record.input_key,
      );
      if (!decisions.has(key)) {
        decisions.set(
          key,
          buildDefaultSelectionPolicyDecision({
            frameId: regulatoryFrameId,
            pathway,
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
        const savedLibrary = buildEvidenceLibraryView(savedFilters, promotedRecords);
        return {
          ...filter,
          filters: savedFilters,
          resultCountText: formatResultCount(
            resultCountForView(savedLibrary, filter.viewMode),
          ),
        };
      }),
    [promotedRecords],
  );
  const protocol28Summary = useMemo(() => buildProtocol28ReviewSummary(), []);
  const activeLabels = [
    ...activeFilterLabels(filters),
    ...(defaultPolicyStatusFilter
      ? [
          `Default policy: ${DEFAULT_POLICY_STATUS_LABELS[defaultPolicyStatusFilter]}`,
        ]
      : []),
  ];
  const assumptionValues = assumptionRows(library.values);
  const baselineAssumptionValues = assumptionRows(baselineLibrary.values);
  const valuesForView =
    viewMode === 'assumptions' ? assumptionValues : library.values;
  const visibleValues = defaultPolicyStatusFilter
    ? valuesForView.filter((row) =>
        decisionMatchesDefaultPolicyStatus(
          defaultPolicyDecisionForRow(defaultPolicyDecisions, row),
          defaultPolicyStatusFilter,
        ),
      )
    : valuesForView;
  const visibleValueGroups = defaultPolicyStatusFilter
    ? library.valueGroups.filter((group) =>
        decisionMatchesDefaultPolicyStatus(
          defaultPolicyDecisions.get(
            defaultPolicyDecisionKey(
              group.pathway,
              group.substanceKey,
              group.inputKey,
            ),
          ) ?? null,
          defaultPolicyStatusFilter,
        ),
      )
    : library.valueGroups;
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
    setDefaultPolicyStatusFilter(null);
    onDismissReceipt?.();
    onFiltersChange(createEvidenceLibraryFilters());
  };
  const applyQuickFilter = (filter: (typeof QUICK_REVIEW_FILTERS)[number]) => {
    setViewMode(filter.viewMode);
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(createEvidenceLibraryFilters(filter.request));
  };
  const applyAuditFilter = (
    nextViewMode: EvidenceLibraryViewMode,
    request: EvidenceLibraryFilterRequest,
  ) => {
    setViewMode(nextViewMode);
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(createEvidenceLibraryFilters(request));
  };
  const applyDefaultPolicyStatusFilter = (
    status: DefaultSelectionDecisionStatus | null,
  ) => {
    setViewMode('values');
    closeDetailPanels();
    onDismissReceipt?.();
    setDefaultPolicyStatusFilter(status);
  };
  const openProtocol28Review = () => {
    setViewMode('values');
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(
      createEvidenceLibraryFilters({
        search: 'Protocol 28',
        bcProtocolAlignments: [PROTOCOL28_POLICY_ALIGNMENT],
      }),
    );
  };
  const openProtocol28SourceLeads = () => {
    setViewMode('sources');
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
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
  // Source-of-sources leads now fold into the Sources view rather than a standalone tab.
  const showSourceLeads = viewMode === 'sources';
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

  // The filter grid is shared: it lives in the left panel on desktop, and falls back to the
  // center column when the left panel is unavailable (mobile, where the parent forces both
  // side panels closed, or when the user toggles the left panel off). Rendered in exactly one
  // place at a time so there is no duplicate mount.
  const filtersBlock = (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
      data-testid="evidence-library-filters"
    >
      <div className="grid gap-3">
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
  );

  return (
    <section
      className={cn('flex h-full overflow-hidden', className)}
      data-testid="references-values-tab"
    >
      {/* LEFT PANEL -- catalog dashboard, audit panels, saved review filters */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800',
          showLeftPanel ? 'w-80' : 'w-0',
        )}
      >
        {showLeftPanel && (
        <div className="w-full min-w-[270px] p-5 overflow-y-auto overflow-x-hidden h-full space-y-4">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Filters
          </h3>

          {filtersBlock}

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
        </div>
        )}
      </div>

      {/* MAIN CONTENT -- header and results */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-white dark:bg-slate-950">
        <div className="space-y-5 p-6">
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
          className="grid w-full grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:inline-grid sm:w-auto sm:grid-cols-2"
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

      {calculatorReceipt && (
        <CalculatorReceiptBanner
          receipt={calculatorReceipt}
          onDismiss={onDismissReceipt}
        />
      )}

      {/* Filters fall back to the center when the left panel is unavailable (mobile, where the
          parent forces side panels closed, or when the left panel is toggled off). */}
      {!showLeftPanel && filtersBlock}

      {/* Inline detail when right drawer is toggled off */}
      {!showRightPanel && selectedValue && (
        <ValueDetailPanel
          row={selectedValue}
          policyDecision={defaultPolicyDecisionForRow(
            defaultPolicyDecisions,
            selectedValue,
          )}
          onClose={() => setSelectedValueId(null)}
          isAdmin={isAdmin}
        />
      )}

      {!showRightPanel && selectedSource && (
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
              visible={visibleValueGroups.length}
              total={baselineLibrary.valueGroups.length}
              label="parameter groups"
            />
          </div>
          <div className="grid gap-2">
            {visibleValueGroups.map((group) => (
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
            {visibleValueGroups.length === 0 && (
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
          {viewMode === 'values' &&
            visibleValues.length > 0 &&
            visibleValues.every((row) => row.record.qa_status === 'needs_review' && row.record.evidence_support_status === 'current_calculator_scaffold') && (
              <AllScaffoldsBanner />
            )}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full table-fixed text-sm">
              {/* Fixed column proportions: the text-heavy columns (review status,
                  default/evidence, applicability, sources) get the room; the short
                  numeric "Current value" no longer hogs width. */}
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[20%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-semibold">Parameter</th>
                  <th className="px-3 py-2 font-semibold">Pathway</th>
                  <th className="px-3 py-2 font-semibold">Current value</th>
                  <th className="px-3 py-2 font-semibold">Default / evidence</th>
                  <th className="px-3 py-2 font-semibold">Review status</th>
                  <th className="px-3 py-2 font-semibold">Applicability</th>
                  <th className="px-3 py-2 font-semibold">Sources</th>
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
                  const selectThisValue = () => {
                    setSelectedSourceId(null);
                    setSelectedValueId(row.record.parameter_value_id);
                    if (!showRightPanel) onRequestOpenRightPanel?.();
                  };
                  const isSelectedRow =
                    selectedValueId === row.record.parameter_value_id;
                  return (
                    <React.Fragment key={row.record.parameter_value_id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        aria-label={`Inspect ${row.record.display_name}`}
                        data-testid="evidence-library-inspect-value"
                        onClick={selectThisValue}
                        onKeyDown={(event) => {
                          // Only act on the row itself, not bubbled keys from focusable children.
                          if (event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectThisValue();
                          }
                        }}
                        className={cn(
                          'cursor-pointer align-top text-slate-700 transition-colors hover:bg-sky-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-200 dark:hover:bg-sky-950/30',
                          isSelectedRow &&
                            'bg-sky-50 dark:bg-sky-950/40',
                        )}
                      >
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {row.record.display_name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.substanceLabel}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {humanizeCatalogLabel(row.record.pathway)}
                          {catalogValueRole(row.record.pathway) ===
                            'toxicity-weighting-modifier' && (
                            <span
                              className="ml-1.5 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                              title="TEF/RPF weighting modifier -- modifies a toxicity value; not selectable as a TRV"
                              data-testid="weighting-modifier-badge"
                            >
                              Weighting modifier
                            </span>
                          )}
                        </td>
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
                      </tr>
                      <tr>
                        <td colSpan={7} className="bg-white px-3 py-2 dark:bg-slate-950">
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
                    <td colSpan={7} className="px-3 py-6 text-sm text-slate-500">
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
                      <AssumptionChip key={tag} label={humanizeCatalogLabel(tag)} />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {library.sources.map((row) => {
                  const selectThisSource = () => {
                    setSelectedValueId(null);
                    setSelectedSourceId(row.record.source_id);
                    if (!showRightPanel) onRequestOpenRightPanel?.();
                  };
                  const isSelectedSourceRow =
                    selectedSourceId === row.record.source_id;
                  return (
                  <tr
                    key={row.record.source_id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Inspect ${row.record.short_citation}`}
                    data-testid="evidence-library-inspect-source"
                    onClick={selectThisSource}
                    onKeyDown={(event) => {
                      // Only act on the row itself, not bubbled keys from the nested link.
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectThisSource();
                      }
                    }}
                    className={cn(
                      'cursor-pointer align-top text-slate-700 transition-colors hover:bg-sky-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-200 dark:hover:bg-sky-950/30',
                      isSelectedSourceRow && 'bg-sky-50 dark:bg-sky-950/40',
                    )}
                  >
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {row.record.url ? (
                          <a
                            href={row.record.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
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
                  );
                })}
                {library.sources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-sm text-slate-500">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Source-Of-Sources Leads
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const needsReviewCount = library.sourceLeads.filter(
                  (lead) => lead.status === 'needs_review',
                ).length;
                return needsReviewCount > 0 ? (
                  <span
                    className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
                    data-testid="source-leads-needs-review-badge"
                    title="Lead sets with status needs_review and pending source locator"
                  >
                    {needsReviewCount} needs review
                  </span>
                ) : null;
              })()}
              <ResultCountBadge
                visible={library.sourceLeads.length}
                total={baselineLibrary.sourceLeads.length}
                label="lead sets"
              />
            </div>
          </div>
          {(() => {
            const allLeadIds = baselineLibrary.sourceLeads.map((l) => l.leadSetId);
            const triageCounts = {
              untriaged: allLeadIds.filter(
                (id) => (triageState[id]?.triage_status ?? 'untriaged') === 'untriaged',
              ).length,
              promoted: allLeadIds.filter(
                (id) => triageState[id]?.triage_status === 'promoted',
              ).length,
              dismissed: allLeadIds.filter(
                (id) => triageState[id]?.triage_status === 'dismissed',
              ).length,
              deferred: allLeadIds.filter(
                (id) => triageState[id]?.triage_status === 'deferred',
              ).length,
            };
            return (
              <div
                className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
                data-testid="source-leads-triage-summary"
              >
                <span className="font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Triage:
                </span>
                <span className="text-slate-700 dark:text-slate-300">
                  Untriaged: <strong>{triageCounts.untriaged}</strong>
                </span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  Promoted: <strong>{triageCounts.promoted}</strong>
                </span>
                <span className="text-red-700 dark:text-red-300">
                  Dismissed: <strong>{triageCounts.dismissed}</strong>
                </span>
                <span className="text-amber-700 dark:text-amber-300">
                  Deferred: <strong>{triageCounts.deferred}</strong>
                </span>
              </div>
            );
          })()}
          <div className="grid gap-2">
            {library.sourceLeads.map((lead) => (
              <SourceLeadCard
                key={lead.leadSetId}
                lead={lead}
                isAdmin={isAdmin}
                triage={triageState[lead.leadSetId]}
                onTriaged={handleLeadTriaged}
              />
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
        </div>
      </div>

      {/* RIGHT PANEL -- two-state: the catalog status dashboard "at rest", the
          value/source detail inspector when a row is selected. */}
      <div
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-lg',
          'max-md:hidden',
          showRightPanel ? 'w-96' : 'w-0',
        )}
      >
        {showRightPanel && (
        <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
            <h3
              className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              data-testid="evidence-library-right-mode"
            >
              {selectedValue
                ? 'Inspecting value'
                : selectedSource
                  ? 'Inspecting source'
                  : 'Catalog Dashboard'}
            </h3>
            {(selectedValue || selectedSource) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedValueId(null);
                  setSelectedSourceId(null);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700 dark:hover:text-sky-300"
                aria-label="Back to catalog dashboard"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Dashboard
              </button>
            )}
          </div>

          {selectedValue && (
            <ValueDetailPanel
              row={selectedValue}
              policyDecision={defaultPolicyDecisionForRow(
                defaultPolicyDecisions,
                selectedValue,
              )}
              onClose={() => setSelectedValueId(null)}
              compact
              isAdmin={isAdmin}
            />
          )}
          {selectedSource && (
            <SourceDetailPanel
              row={selectedSource}
              onClose={() => setSelectedSourceId(null)}
              compact
            />
          )}
          {!selectedValue && !selectedSource && (
            <div className="space-y-4" data-testid="evidence-library-right-dashboard">
              <AuditStrip audit={library.audit} onSelect={applyAuditFilter} compact />

              <DefaultPolicyAuditPanel
                decisions={defaultPolicyDecisions}
                activeStatus={defaultPolicyStatusFilter}
                onSelectStatus={applyDefaultPolicyStatusFilter}
                compact
              />

              <Protocol28ReviewPanel
                summary={protocol28Summary}
                onReview={openProtocol28Review}
                onReviewSourceLeads={openProtocol28SourceLeads}
                compact
              />

              <CrossPathwayAuditPanel compact />

              <ZoteroStatusBadge compact />

              {isAdmin && (
                <details className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Admin tools
                  </summary>
                  <div className="space-y-4 p-3 pt-0">
                    <HitlSourcesSection isAdmin={isAdmin} />
                    <PromotedCandidatesSection />
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </section>
  );
}
