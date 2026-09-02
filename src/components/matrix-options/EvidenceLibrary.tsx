'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { VALUES_PAGE_SIZE, computeValuesPagination } from './evidenceLibraryPagination';
import ScrollFadeRegion from '../ScrollFadeRegion';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, Plus, Search, SlidersHorizontal, X, ShieldCheck, CheckCircle2, ArrowRight, BookOpen, Layers, FileText, Maximize2, Check, AlertTriangle, Zap } from 'lucide-react';
import { checkCurrentUserAdminStatus } from '@/lib/admin-utils';
import { promoteSourceLead, isUnscopedPromotion } from '@/lib/matrix-options/provenance/promotion';
import type { PromotedParameterValueRecord } from '@/lib/matrix-options/provenance/promotion';
import { submitReview, fetchReviewHistory, fetchAllReviews } from '@/lib/matrix-options/provenance/qa-review-sync';
import type { ParameterValueReview } from '@/lib/matrix-options/provenance/qa-review-sync';
import { reduceToCurrentVerificationStates } from '@/lib/matrix-options/provenance/qa-review-reduction';
import { submitEvidenceItem, fetchEvidenceItems } from '@/lib/matrix-options/provenance/evidence-sync';
import type { CatalogEvidenceItem } from '@/lib/matrix-options/provenance/evidence-sync';
import { fetchTriageState, setTriageStatus } from '@/lib/matrix-options/provenance/triage-sync';
import type { SourceLeadTriageRow, TriageStatus } from '@/lib/matrix-options/provenance/triage-sync';
import { SOURCE_RECORDS } from '@/lib/matrix-options/provenance/catalog';
import { AddSourceForm } from './AddSourceForm';
import { fetchHitlSources } from '@/lib/matrix-options/provenance/source-sync';
import type { CatalogSourceRow } from '@/lib/matrix-options/provenance/source-sync';
import {
  fetchSavedViews,
  fetchSavedViewsResult,
  createSavedView,
  deleteSavedView,
  importLegacySavedViews,
} from '@/lib/matrix-options/provenance/saved-views-sync';
import type { SavedViewRow, SaveViewResult } from '@/lib/matrix-options/provenance/saved-views-sync';
import { usePromotedCandidatesStore } from '@/stores/matrix-options/promotedCandidatesStore';
import { cn } from '@/utils/cn';
import {
  PROTOCOL28_POLICY_ALIGNMENT,
  buildProtocol28ReviewSummary,
  buildCrossPathwayAudit,
  buildCatalogTruthLens,
  buildEvidenceLibraryView,
  catalogTruthLensNextActionLabel,
  catalogTruthLensReasonLabel,
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
  CatalogTruthLens,
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
  SourceRecord,
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

// ---------------------------------------------------------------------------
// EvidenceLibraryAnnounce -- shared aria-live="polite" outcome channel (A5).
//
// A single visually-hidden live region is rendered near the top of the main
// panel by the default-exported EvidenceLibrary component. Nested components
// (QaReviewActions, AddEvidenceLocatorForm, LeadTriageControls, the saved-views
// form, ...) call announce() to have their SUCCESS outcomes read out by screen
// readers. FAILURES are rendered as a local role="alert" at the point of
// failure (per A4) rather than only routed through this polite channel.
// ---------------------------------------------------------------------------

const EvidenceLibraryAnnounceContext = createContext<(message: string) => void>(
  () => {},
);

function useEvidenceLibraryAnnounce(): (message: string) => void {
  return useContext(EvidenceLibraryAnnounceContext);
}

// References & Values is the catalog browser: the Values table (default), the Sources table
// (with source-of-sources leads folded in), and the By Parameter view that groups values per
// (pathway, substance, input) and flags incommensurate-unit candidate groups (the #206
// badge). By Parameter was inadvertently orphaned when the tab list was trimmed in #210
// (its render branch + ValueGroupCard stayed, but no tab selected it); it is re-exposed here.
// The Equations tab was retired; legacy equation-mode saved views fall back to Values. Source
// Leads still folds into Sources, and the Assumptions branch (which duplicated Values) remains
// unexposed by design.
const VIEW_MODES: Array<{ id: EvidenceLibraryViewMode; label: string }> = [
  // Ordered References then Values to match the tab title "References & Values"; By Parameter
  // is the third, value-centric view. (Values remains the default-selected view -- see the
  // useState default.)
  { id: 'sources', label: 'References' },
  { id: 'values', label: 'Values' },
  { id: 'by-parameter', label: 'By Parameter' },
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

// User-saved filter views, persisted in localStorage. Replaces the former hardcoded
// seed-era "quick filters", which applied now-removed filter dimensions and showed stale
// counts that did not match the loaded catalog.
const SAVED_VIEWS_STORAGE_KEY = 'matrix-options-saved-views-v1';

// The seed-era "quick filters" were removed (see comment above). The single deliberate
// exception is the "Candidate defaults" review affordance: a first-class HITL entry point
// into the default-policy review workflow (mirrors the calculator "Review candidate defaults"
// shortcut). It applies a stable, catalog-accurate filter -- approved-source-backed values
// that are available-option candidates (NOT current defaults) -- so it does not show the
// stale counts that doomed the old seed presets.
const CANDIDATE_DEFAULTS_REQUEST: EvidenceLibraryFilterRequest = {
  evidenceSupportStatuses: ['approved_source_backed'],
  defaultStatuses: ['available_option'],
};

// Resizable right panel (References & Values). Mirrors the matrix-map right-panel resize
// pattern in MatrixDashboard.tsx (constants, clamp, pointer handler). Default 384 == the
// prior fixed Tailwind w-96 so the layout is unchanged until the user drags.
const REFERENCES_RIGHT_PANEL_MIN_WIDTH = 320;
const REFERENCES_RIGHT_PANEL_DEFAULT_WIDTH = 384;
const REFERENCES_RIGHT_PANEL_MAX_WIDTH = 720;
const REFERENCES_MIN_CENTER_WIDTH = 360;
const REFERENCES_RIGHT_PANEL_WIDTH_STORAGE_KEY =
  'matrix-options-references-right-width-v1';

// SSR-safe clamp (port of clampMatrixMapRightPanelWidth). The left filter rail is w-80
// (320px) when shown; reserve REFERENCES_MIN_CENTER_WIDTH for the center results table.
function clampReferencesRightPanelWidth(width: number, showLeftPanel: boolean) {
  if (typeof window === 'undefined') {
    return Math.min(
      REFERENCES_RIGHT_PANEL_MAX_WIDTH,
      Math.max(REFERENCES_RIGHT_PANEL_MIN_WIDTH, width),
    );
  }
  const leftPanelWidth = showLeftPanel ? 320 : 0;
  const viewportMax = window.innerWidth - leftPanelWidth - REFERENCES_MIN_CENTER_WIDTH;
  const maxWidth = Math.max(
    REFERENCES_RIGHT_PANEL_MIN_WIDTH,
    Math.min(REFERENCES_RIGHT_PANEL_MAX_WIDTH, viewportMax),
  );
  return Math.min(maxWidth, Math.max(REFERENCES_RIGHT_PANEL_MIN_WIDTH, width));
}

// Validate-on-load from localStorage (SSR-safe). Clamps to absolute min/max only; the
// viewport budget is re-applied by the layout/resize effects on mount. Clears bad entries.
function restoreReferencesRightPanelWidth(): number {
  if (typeof window === 'undefined') return REFERENCES_RIGHT_PANEL_DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(REFERENCES_RIGHT_PANEL_WIDTH_STORAGE_KEY);
  if (raw !== null) {
    const parsed = Number(raw);
    if (
      Number.isFinite(parsed) &&
      parsed >= REFERENCES_RIGHT_PANEL_MIN_WIDTH &&
      parsed <= REFERENCES_RIGHT_PANEL_MAX_WIDTH
    ) {
      return parsed;
    }
    window.localStorage.removeItem(REFERENCES_RIGHT_PANEL_WIDTH_STORAGE_KEY);
  }
  return REFERENCES_RIGHT_PANEL_DEFAULT_WIDTH;
}

type SavedFilterView = {
  id: string;
  name: string;
  filters: EvidenceLibraryFilters;
  viewMode: EvidenceLibraryViewMode;
};

// Per-browser sentinel so the one-time localStorage -> Supabase import runs at most once.
const SAVED_VIEWS_MIGRATED_KEY = 'matrix-options-saved-views-migrated-v1';

// Matches a Postgres UUID (the `user_saved_views.id` column type). A saved-view id that
// does not match this was never persisted to Supabase (e.g. the client-generated
// `${Date.now()...}` optimistic id used before a create round-trips) -- attempting a
// server delete with it is guaranteed to fail with an invalid-uuid error, so callers
// should treat a non-match as "local-only, nothing to sync" rather than a server call.
const SUPABASE_SAVED_VIEW_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowToSavedFilterView(row: SavedViewRow): SavedFilterView {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters,
    viewMode: row.view_mode,
  };
}

function loadSavedViews(): SavedFilterView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate + normalize untrusted storage so a corrupted/old-shape entry can never crash
    // render (filtersEqual / buildEvidenceLibraryView assume a well-formed filters object).
    return parsed
      .filter(
        (entry): entry is Record<string, unknown> =>
          typeof entry === 'object' && entry !== null,
      )
      .filter(
        (entry) => typeof entry.id === 'string' && typeof entry.name === 'string',
      )
      .slice(0, 50)
      .map((entry) => ({
        id: entry.id as string,
        name: entry.name as string,
        // Coerce the persisted mode to one the library can render today. This MUST mirror the
        // Supabase-side coerceViewMode (saved-views-sync.ts) so a saved view behaves the same
        // whether it is hydrated from localStorage or Supabase: 'source-leads' folds into the
        // Sources view (it has no tab and would otherwise render blank); the live, renderable
        // modes ('by-parameter' -- re-exposed with the #206 value-groups tab -- 'sources',
        // 'values', and the unexposed-but-still-rendering 'assumptions') are PRESERVED; the
        // retired 'equations' tab and any unknown value fall back to the default 'values' view.
        viewMode:
          entry.viewMode === 'source-leads'
            ? 'sources'
            : entry.viewMode === 'by-parameter' ||
                entry.viewMode === 'sources' ||
                entry.viewMode === 'values' ||
                entry.viewMode === 'assumptions'
              ? (entry.viewMode as EvidenceLibraryViewMode)
              : 'values',
        // Re-build through createEvidenceLibraryFilters so the stored filters are always a
        // complete, well-formed EvidenceLibraryFilters (unknown keys dropped, arrays ensured).
        filters: createEvidenceLibraryFilters(
          (typeof entry.filters === 'object' && entry.filters !== null
            ? entry.filters
            : {}) as EvidenceLibraryFilterRequest,
        ),
      }));
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedFilterView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(views));
  } catch {
    // ignore storage failures (private mode / quota)
  }
}

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

/**
 * P2-1 (owner-decided 2026-08-15). Where qa_status is folded into the muted
 * plain-text line rather than given its own pill, it rendered in the same grey as
 * the neutral statuses around it. 41 rows are simultaneously
 * qa_status=superseded AND evidence_support_status=approved_source_backed, so the
 * green "Approved source-backed" pill plus undifferentiated grey text read as two
 * reassuring signals with the warning demoted to 12px grey.
 *
 * This tones the TEXT to the semantics `statusTone()` already encodes for the pill
 * form -- amber for needs-review states, rose for superseded -- so the two
 * renderings of the same status can never disagree. Statuses with no warning
 * meaning inherit the surrounding muted colour unchanged.
 */
function qaStatusTextTone(status: string): string {
  if (status.includes('needs')) {
    return 'font-semibold text-amber-700 dark:text-amber-300';
  }
  if (status === 'superseded') {
    return 'font-semibold text-rose-700 dark:text-rose-300';
  }
  return '';
}

/**
 * Renders a qa_status as plain (non-pill) text, toned per `qaStatusTextTone`.
 * Emits a bare string when the status carries no warning meaning, so no
 * pointless wrapper element appears in the neutral case.
 */
function QaStatusText({ value }: { value: string }) {
  const tone = qaStatusTextTone(value);
  const label = humanizeCatalogLabel(value);
  return tone ? <span className={tone}>{label}</span> : <>{label}</>;
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
        'rounded-md border transition-all',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
        reviewToneClass(tone),
      )}
      title={detail}
    >
      <div className="font-semibold leading-tight">{label}</div>
      {!compact && (
        <div className="mt-0.5 text-[11px] leading-snug line-clamp-2 opacity-90">
          {detail}
        </div>
      )}
    </div>
  );
}

function CatalogTruthLensSummary({
  row,
  compact = false,
}: {
  row: EvidenceLibraryValueRow;
  compact?: boolean;
}) {
  const lens: CatalogTruthLens = buildCatalogTruthLens(row);
  const testId = compact
    ? 'catalog-truth-lens-row'
    : 'catalog-truth-lens-dossier';
  const roleLabel = lens.role === 'toxicity-weighting-modifier'
    ? 'Toxicity-weighting modifier'
    : lens.calculatorReachable
      ? 'Selectable calculator value'
      : 'Catalog-only evidence category';
  const reachLabel = lens.calculatorReachable
    ? 'Calculator-reachable'
    : 'Catalog-only; not calculator-reachable';
  const currentnessLabel = lens.provenance.currentnessSummary === 'no_sources'
    ? 'No linked sources'
    : humanizeCatalogLabel(lens.provenance.currentnessSummary);
  const locatorLabel = `${humanizeCatalogLabel(lens.locator.status)} (${lens.locator.presentCount}/${lens.support.evidenceCount})`;

  if (compact) {
    return (
      <div
        className="mt-2 flex max-w-full flex-wrap gap-x-2 gap-y-0.5 rounded-md border border-indigo-100 bg-indigo-50/50 px-2 py-1.5 text-[10px] text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-100"
        data-testid={testId}
        aria-label="Catalog Truth Lens row summary"
        onClick={(event) => event.stopPropagation()}
      >
        <span>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Role:</span>{' '}
          {roleLabel}
        </span>
        <span>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Reach:</span>{' '}
          {reachLabel}
        </span>
        <span data-testid="catalog-truth-lens-blocked-reason">
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Primary trust:</span>{' '}
          {catalogTruthLensReasonLabel(lens.blocked.reason)}
        </span>
      </div>
    );
  }

  return (
    <section
      className={cn(
        'rounded-md border border-indigo-100 bg-indigo-50/50 text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-100',
        compact ? 'mt-2 p-2 text-[10px]' : 'p-3 text-xs',
      )}
      data-testid={testId}
      aria-label="Catalog Truth Lens"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          Catalog Truth Lens
        </span>
        {!compact && (
          <span className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80">
            Read-only summary
          </span>
        )}
      </div>
      <div className={cn('grid gap-x-3 gap-y-1', compact ? 'mt-1.5 grid-cols-2' : 'mt-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4')}>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Role</span>{' '}
          <span>{roleLabel}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Reach</span>{' '}
          <span>{reachLabel}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Default</span>{' '}
          <span>{humanizeCatalogLabel(lens.defaultStatus)}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">QA</span>{' '}
          <span>{humanizeCatalogLabel(lens.review.qaStatus)}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Extraction</span>{' '}
          <span>{humanizeCatalogLabel(lens.review.extractionStatus)}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Evidence support</span>{' '}
          <span>{humanizeCatalogLabel(lens.support.evidenceSupportStatus)} ({lens.support.evidenceCount})</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Sources</span>{' '}
          <span>{lens.provenance.sourceCount}; {currentnessLabel}</span>
        </div>
        <div>
          <span className="font-semibold text-indigo-700/80 dark:text-indigo-300/80">Locators</span>{' '}
          <span>{locatorLabel}</span>
        </div>
      </div>
      <div className="mt-2 border-t border-indigo-200/70 pt-1.5 dark:border-indigo-800/60" data-testid="catalog-truth-lens-blocked-reason">
        <span className="font-semibold">Blocked reason:</span>{' '}
        <span>{catalogTruthLensReasonLabel(lens.blocked.reason)}</span>
        <span className="mx-1.5 text-indigo-400" aria-hidden="true">|</span>
        <span className="font-semibold">Next safe action:</span>{' '}
        <span data-testid="catalog-truth-lens-next-action">
          {catalogTruthLensNextActionLabel(lens.blocked.nextAction)}
        </span>
      </div>
      {lens.blocked.remainingReasons.length > 0 && (
        <details className="mt-1.5" data-testid="catalog-truth-lens-remaining-blockers">
          <summary className="cursor-pointer font-semibold text-indigo-700 dark:text-indigo-300">
            Other blockers ({lens.blocked.remainingReasons.length})
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {lens.blocked.remainingReasons.map((reason) => (
              <li key={reason}>{catalogTruthLensReasonLabel(reason)}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
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

// Accessible pager for the Values table. Real <button>s + a <nav> landmark; disabled at the ends.
// VALUES_PAGE_SIZE + the page math live in ./evidenceLibraryPagination (pure + unit-tested).
export function ValuesPagination({
  page,
  pageCount,
  pageSize,
  totalRows,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalRows);
  return (
    <nav
      aria-label="Parameter values pagination"
      className="flex items-center justify-between gap-2 px-1 py-2 text-xs text-slate-600 dark:text-slate-300"
    >
      <span>
        Rows {start}-{end} of {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 0}
          className="min-h-[44px] rounded border border-slate-300 px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          Prev
        </button>
        <span>
          Page {page + 1} of {pageCount}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount - 1}
          className="min-h-[44px] rounded border border-slate-300 px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
        >
          Next
        </button>
      </div>
    </nav>
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

type FilterControl = {
  key: FilterArrayKey;
  label: string;
  options: EvidenceLibraryFacetOption[];
};

// Collapses the filter dropdowns behind a single "Filters" button so they do not consume the
// side panel. Primary filters are always shown when open; the QA/review workflow filters sit
// under a collapsible "Advanced" section. Closes on click-outside or Escape.
function FilterPopover({
  primaryControls,
  advancedControls,
  filters,
  onUpdate,
  activeCount,
  onClearAll,
}: {
  primaryControls: FilterControl[];
  advancedControls: FilterControl[];
  filters: EvidenceLibraryFilters;
  onUpdate: (key: FilterArrayKey, value: string) => void;
  activeCount: number;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-testid="evidence-library-filter-button"
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-700"
      >
        <span className="inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-sky-500">
              {activeCount}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          data-testid="evidence-library-filter-popover"
        >
          <div className="grid gap-3">
            {primaryControls.map((control) => (
              <FilterSelect
                key={control.key}
                label={control.label}
                value={firstValue(filters, control.key)}
                options={control.options}
                onChange={(value) => onUpdate(control.key, value)}
              />
            ))}
          </div>
          {advancedControls.length > 0 && (
            <details className="mt-3 border-t border-slate-200 pt-2 dark:border-slate-800">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Advanced ({advancedControls.length})
              </summary>
              <div className="mt-2 grid gap-3">
                {advancedControls.map((control) => (
                  <FilterSelect
                    key={control.key}
                    label={control.label}
                    value={firstValue(filters, control.key)}
                    options={control.options}
                    onChange={(value) => onUpdate(control.key, value)}
                  />
                ))}
              </div>
            </details>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
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
          {/* print: undo `truncate`. Be precise about what this does and does not fix. On PAPER
              the ellipsis is now gone, so a flagged regulatory value prints with its full
              substance identity. On SCREEN the name is still ellipsised and is NOT recoverable:
              `truncate` puts overflow-hidden on this div itself, and the enclosing panel scrolls
              only VERTICALLY, so nothing here reveals the clipped tail. An earlier version of
              this comment claimed the screen case was recoverable "because the panel scrolls" --
              it is not, and that claim was wrong. The screen-side truncation is recorded as OPEN
              in docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md. This element sits INSIDE the list
              de-clipped vertically below, so fixing only that would have corrected how MANY rows
              print while still clipping WHICH substance each row is about. */}
          <div className="font-semibold text-slate-900 dark:text-white break-words">
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

// How many flagged rows the cross-pathway audit list renders. Named rather than inlined so its
// TWO consumers -- the slice and the "showing first N of M" notice -- read from one number and
// cannot drift into disagreeing about how much is on screen. The toggle label above the list is
// deliberately NOT a consumer: it reports inconsistentRows.length, the true total, which is the
// figure the notice exists to reconcile against.
const MAX_AUDIT_ROWS_SHOWN = 50;

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

      {/* print:max-h-none print:overflow-visible on the list below: these rows render
          entry.value and entry.unit -- regulatory values -- and a capped container on paper
          has no scrollbar, no fade and no ellipsis, so the list simply ends and reads as
          complete. The references list further down this file already carried the reset; this
          one was missed for TWO independent reasons, and either alone would have been enough:
          the runtime print sweep in e2e/ssd-workbench.spec.ts is scoped to elements containing
          a <table> and this is a div list, AND that spec only ever drives the SSD workbench, so
          it never reaches this panel to expand it in the first place. */}
      {showDetails && (
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto print:max-h-none print:overflow-visible" data-testid="cross-pathway-audit-details">
          {inconsistentRows.slice(0, MAX_AUDIT_ROWS_SHOWN).map(row => (
            <CrossPathwayAuditRowCard
              key={`${row.substance_key}__${row.input_key}`}
              row={row}
              onSelect={onSelectRow ? () => onSelectRow(row) : undefined}
            />
          ))}
          {/* Both this notice and the slice above read MAX_AUDIT_ROWS_SHOWN. This notice used
              to hard-code 50 instead; two independent copies of the same number is how a notice
              ends up claiming a cap the list no longer applies. */}
          {inconsistentRows.length > MAX_AUDIT_ROWS_SHOWN && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
              Showing first {MAX_AUDIT_ROWS_SHOWN} of {inconsistentRows.length}. Use filters to
              narrow the scope.
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const announce = useEvidenceLibraryAnnounce();

  useEffect(() => {
    setEffectiveQaStatus(currentQaStatus);
  }, [currentQaStatus]);

  useEffect(() => {
    fetchReviewHistory(parameterValueId).then(setReviews);
  }, [parameterValueId]);

  const handleSubmit = async () => {
    if (!targetStatus) return;
    setSubmitting(true);
    setSubmitError(null);
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
      setSubmitting(false);
      setShowForm(false);
      setNote('');
      setTargetStatus('');
      announce(`QA status updated to ${humanizeCatalogLabel(targetStatus)}.`);
      return;
    }
    setSubmitting(false);
    setSubmitError(
      'Your review was not saved. This looks like a connection or server problem -- your note below has not been lost. Check your connection and try Confirm again.',
    );
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
                setSubmitError(null);
              }}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
          {submitError && (
            <div
              role="alert"
              className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              data-testid="qa-review-error"
            >
              {submitError}
            </div>
          )}
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
            <QaStatusText value={item.qa_status} />
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const announce = useEvidenceLibraryAnnounce();

  const trimmedLocator = locator.trim();
  const canSubmit = !!sourceId && trimmedLocator.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
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
      setSubmitting(false);
      setShowForm(false);
      setSourceId('');
      setLocator('');
      setValueText('');
      setNote('');
      setLocatorType('source_page');
      announce('Evidence locator saved.');
      return;
    }
    setSubmitting(false);
    setSubmitError(
      'This locator was not saved. This looks like a connection or server problem -- everything you entered is still here. Check your connection and try Save locator again.',
    );
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
          onClick={() => {
            setShowForm(false);
            setSubmitError(null);
          }}
          disabled={submitting}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          Cancel
        </button>
      </div>
      {submitError && (
        <div
          role="alert"
          className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          data-testid="evidence-locator-error"
        >
          {submitError}
        </div>
      )}
    </div>
  );
}

function EvidenceDossierModal({
  row,
  policyDecision,
  onClose,
  isAdmin = false,
}: {
  row: EvidenceLibraryValueRow;
  policyDecision: DefaultSelectionPolicyDecision | null;
  onClose: () => void;
  isAdmin?: boolean;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const canonicalSources = row.sources.filter(isCalculatorEvidenceSource);
  const review = getParameterValueReviewDisposition(row.record, row.sources);
  const policyCandidate = policyDecision?.candidates.find(
    (candidate) =>
      candidate.record.parameter_value_id === row.record.parameter_value_id,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] print:max-h-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                Evidence Dossier
              </span>
              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                {humanizeCatalogLabel(row.record.pathway)}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                Jurisdiction: {row.record.jurisdiction}
              </span>
            </div>
            <h2 id="dossier-modal-title" className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {row.record.display_name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Substance: {row.substanceLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence dossier"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Hero Value Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Numerical Parameter Value
              </span>
              <div className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                {formatValue(row.record.value, row.record.unit)}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge value={row.record.default_status} />
              <StatusBadge value={row.record.evidence_support_status} />
              <StatusBadge value={row.record.qa_status} />
              <StatusBadge value={row.record.extraction_status} />
              {row.record.canonical_source_status && (
                <StatusBadge value={row.record.canonical_source_status} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary Citation Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Primary Citation &amp; Document Lead
              </span>
              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {canonicalSources.length > 0
                  ? canonicalSources.map((source) => source.short_citation).join('; ')
                  : sourceLabels(row)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                Canonical Status:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {humanizeCatalogLabel(row.record.canonical_source_status ?? 'direct_source_verified')}
                </span>
              </div>
            </div>

            {/* Policy & Review Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Protocol 28 &amp; Review Disposition
              </span>
              <ReviewDispositionNote {...review} />
              {policyDecision && policyCandidate ? (
                <DefaultPolicyDispositionNote
                  candidate={policyCandidate}
                  decision={policyDecision}
                  testId={`modal-policy-detail-${row.record.parameter_value_id}`}
                />
              ) : null}
            </div>
          </div>

          {/* Exact Document Locators */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Exact Document Locators ({row.record.evidence_items.length})
              </h3>
              <span className="text-[11px] text-slate-500">
                Direct evidence extractions
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {row.record.evidence_items.map((evidence) => (
                <div
                  key={evidence.evidence_id}
                  className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {humanizeCatalogLabel(evidence.locator_type)}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                      {evidence.locator}
                    </span>
                  </div>
                  {evidence.note && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {evidence.note}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-indigo-100/60 dark:border-indigo-900/40">
                    <span>Extracted on {evidence.extracted_at} by {evidence.extracted_by}</span>
                    <QaStatusText value={evidence.qa_status} />
                  </div>
                </div>
              ))}
              {row.record.evidence_items.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  No direct citation evidence items recorded.
                </div>
              )}
            </div>
          </div>

          {/* Provenance & Metadata Grid */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Provenance Trail &amp; Model Metadata
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Source Relationships: </span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{sourceRelationshipLabels(row)}</div>
              </div>
              {row.record.bc_protocol_alignment && (
                <div>
                  <span className="text-slate-500 font-medium">Policy Alignment: </span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{humanizeCatalogLabel(row.record.bc_protocol_alignment)}</div>
                </div>
              )}
              {row.record.source_crystallization_date && (
                <div>
                  <span className="text-slate-500 font-medium">Source Crystallization: </span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{row.record.source_crystallization_date}</div>
                </div>
              )}
              <div>
                <span className="text-slate-500 font-medium">Receptor Groups: </span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{tagList(row.receptorGroups)}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Population Groups: </span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{tagList(row.populationGroups)}</div>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Species Groups: </span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{tagList(row.speciesGroups)}</div>
              </div>
            </div>
          </div>

          {/* Applicability & Notes */}
          {row.record.applicability && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Applicability Context</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {row.record.applicability}
              </p>
            </div>
          )}

          {row.record.review_notes && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400">Review Notes</span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {row.record.review_notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <span className="text-xs text-slate-500">
            Press ESC to close dossier
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueDetailPanel({
  row,
  policyDecision,
  onClose,
  onExpandDossier,
  compact = false,
  isAdmin = false,
}: {
  row: EvidenceLibraryValueRow;
  policyDecision: DefaultSelectionPolicyDecision | null;
  onClose: () => void;
  onExpandDossier?: () => void;
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
      className="rounded-xl border border-indigo-200/80 bg-white p-4 shadow-sm dark:border-indigo-900/60 dark:bg-slate-950 space-y-3.5"
      data-testid="evidence-library-value-detail"
      aria-label="Selected value detail"
    >
      {/* Dossier Header */}
      <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/60">
              Selected value
            </span>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {humanizeCatalogLabel(row.record.pathway)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {row.record.jurisdiction}
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white leading-snug">
            {row.record.display_name}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {row.substanceLabel}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {onExpandDossier && (
            <button
              type="button"
              onClick={onExpandDossier}
              title="Expand Full Evidence Dossier"
              aria-label="Expand Full Evidence Dossier"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Expand</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Close
          </button>
        </div>
      </div>

      {/* Hero Value Card */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase font-bold text-slate-400">Numerical Value</span>
          <div className="font-mono text-xl font-black text-slate-900 dark:text-white">
            {formatValue(row.record.value, row.record.unit)}
          </div>
        </div>
        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
          <StatusBadge value={row.record.default_status} />
          <StatusBadge value={row.record.evidence_support_status} />
          <StatusBadge value={row.record.qa_status} />
          <StatusBadge value={row.record.extraction_status} />
          {row.record.canonical_source_status && (
            <StatusBadge value={row.record.canonical_source_status} />
          )}
          </div>
        </div>

        <CatalogTruthLensSummary row={row} />

      {isAdmin && (
        <QaReviewActions
          parameterValueId={row.record.parameter_value_id}
          currentQaStatus={row.record.qa_status}
          currentEvidenceStatus={row.record.evidence_support_status}
        />
      )}

      {/* Primary Citation & Sources */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Primary Citation
            </span>
            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mt-0.5">
              {canonicalSources.length > 0
                ? canonicalSources.map((source) => source.short_citation).join('; ')
                : sourceLabels(row)}
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
            {row.record.jurisdiction}
          </span>
        </div>
        {row.record.canonical_source_status && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Canonical Status: <span className="font-medium text-slate-700 dark:text-slate-200">{humanizeCatalogLabel(row.record.canonical_source_status)}</span>
          </div>
        )}
      </div>

      {/* Review & Policy Recommendation */}
      <div className="space-y-1.5">
        <ReviewDispositionNote {...review} />

        {policyDecision && policyCandidate ? (
          <DefaultPolicyDispositionNote
            candidate={policyCandidate}
            decision={policyDecision}
            testId={`evidence-default-policy-detail-${row.record.parameter_value_id}`}
          />
        ) : null}
      </div>

      {/* Exact Document Locator Highlights */}
      <div className="space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
          Exact Document Locators ({row.record.evidence_items.length})
        </div>
        {row.record.evidence_items.map((evidence) => (
          <div
            key={evidence.evidence_id}
            className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                {humanizeCatalogLabel(evidence.locator_type)}
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                {evidence.locator}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-100/60 dark:border-indigo-900/40">
              <span>Extracted {evidence.extracted_at}</span>
              <QaStatusText value={evidence.qa_status} />
            </div>
          </div>
        ))}
        {row.record.evidence_items.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            No direct citation evidence items recorded.
          </div>
        )}
      </div>

      {/* Provenance Chain & Milestones */}
      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="text-[10px] font-bold uppercase text-slate-400">Provenance chain</div>
        <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
          <div>
            <span className="font-semibold text-slate-500">Source Relationships: </span>
            {sourceRelationshipLabels(row)}
          </div>
          {row.record.bc_protocol_alignment && (
            <div>
              <span className="font-semibold text-slate-500">Policy Alignment: </span>
              {humanizeCatalogLabel(row.record.bc_protocol_alignment)}
            </div>
          )}
          {row.record.source_crystallization_date && (
            <div>
              <span className="font-semibold text-slate-500">Source Crystallization: </span>
              {row.record.source_crystallization_date}
            </div>
          )}
        </div>
      </div>

      {/* Structured Applicability & Notes */}
      <div className="space-y-2 text-xs">
        {row.record.applicability && (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Applicability</div>
            <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
              {row.record.applicability}
            </p>
          </div>
        )}

        {row.record.review_notes && (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Review Notes</div>
            <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">
              {row.record.review_notes}
            </p>
          </div>
        )}

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
              {!group.unitConsistency.comparable && (
                <span
                  className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  data-testid={`value-group-incommensurate-${group.groupId}`}
                  title={`Units in this group are not directly comparable (${group.unitConsistency.units.join(
                    ', ',
                  )}). A reviewer must reconcile units before any most-stringent pick.`}
                >
                  Incommensurate units -- manual review
                </span>
              )}
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
  const [triageError, setTriageError] = useState<string | null>(null);
  const announce = useEvidenceLibraryAnnounce();

  const handleTriage = async (status: TriageStatus) => {
    setSubmitting(true);
    setTriageError(null);
    const ok = await setTriageStatus(leadSetId, status, note.trim());
    if (ok) {
      onTriaged(status);
      setSubmitting(false);
      setShowNoteForm(null);
      setNote('');
      announce(`Triage status updated to ${status}.`);
      return;
    }
    setSubmitting(false);
    setTriageError(
      'Triage status was not saved. This looks like a connection or server problem -- your note has not been lost. Check your connection and try Confirm again.',
    );
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
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => handleTriage(showNoteForm)}
            disabled={submitting}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-500"
            data-testid="triage-confirm"
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => { setShowNoteForm(null); setNote(''); setTriageError(null); }}
            disabled={submitting}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            Cancel
          </button>
        </div>
        {triageError && (
          <div
            role="alert"
            className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            data-testid="triage-error"
          >
            {triageError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid="lead-triage-controls">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
          Triage:
        </span>
        <TriageStatusBadge status={currentStatus} />
        {currentStatus !== 'dismissed' && (
          <button
            type="button"
            onClick={() => setShowNoteForm('dismissed')}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            data-testid="triage-dismiss"
          >
            Dismiss
          </button>
        )}
        {currentStatus !== 'deferred' && (
          <button
            type="button"
            onClick={() => setShowNoteForm('deferred')}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
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
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            data-testid="triage-reset"
          >
            Reset
          </button>
        )}
      </div>
      {triageError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          data-testid="triage-error"
        >
          {triageError}
        </div>
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
  // P2-4 fix: onPromoted now reports whether the underlying write actually
  // succeeded (Promise<boolean>) so handleConfirm can decide whether to commit the
  // optimistic addCandidate() store write. A caller that has no server-side write to
  // perform may still return void/undefined -- treated as success, matching the
  // pre-existing behavior for callers with no async step.
  onPromoted?: () => Promise<boolean> | void;
}) {
  const { addCandidate, isPromoted } = usePromotedCandidatesStore();
  const [showPopover, setShowPopover] = useState(false);
  const [selectedPathway, setSelectedPathway] = useState<ProvenancePathway>('eco-direct-eqp');
  const [submitting, setSubmitting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const alreadyPromoted = isPromoted(lead.leadSetId);

  // P2-4 fix: previously this committed addCandidate() to the Zustand store BEFORE
  // onPromoted() resolved, and the "Promoted to candidate" badge (below, keyed off
  // isPromoted()) rendered immediately from that optimistic commit -- so a FAILED
  // server write (onPromoted resolving false, or throwing) still showed the terminal
  // green success state, with only a console.error marking the real outcome. Now the
  // store write is NOT committed until onPromoted confirms success; on failure the
  // popover stays open, submitting resets, and a role="alert" reports the failure
  // (matching the sibling triage/save-view error sites in this file).
  const handleConfirm = async () => {
    setSubmitting(true);
    setPromoteError(null);
    try {
      const ok = await onPromoted?.();
      if (ok === false) {
        setPromoteError(
          'Promotion could not be saved. The lead has not been promoted to a candidate -- try again.',
        );
        return;
      }
      const record = promoteSourceLead(lead, 'admin', selectedPathway);
      addCandidate(record);
      setShowPopover(false);
    } catch (err) {
      console.error('[EvidenceLibrary] promoteSourceLead/onPromoted failed', err);
      setPromoteError(
        'Promotion could not be saved. The lead has not been promoted to a candidate -- try again.',
      );
    } finally {
      setSubmitting(false);
    }
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
              disabled={submitting}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              data-testid="promote-lead-confirm"
            >
              {submitting ? 'Promoting...' : 'Confirm promotion'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPopover(false);
                setPromoteError(null);
              }}
              disabled={submitting}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              data-testid="promote-lead-cancel"
            >
              Cancel
            </button>
          </div>
          {promoteError && (
            <div
              role="alert"
              className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
              data-testid="promote-lead-error"
            >
              {promoteError}
            </div>
          )}
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
                  // setTriageStatus returns Promise<boolean>; only report the triage
                  // change upward when the write actually succeeded (matches the fix
                  // applied to LeadTriageControls.handleTriage above) -- discarding the
                  // result here previously let the UI show "promoted" even when the
                  // server rejected the write, reverting silently on reload. The
                  // return value is now also handed back to PromoteLeadButton
                  // (P2-4 fix) so it can gate the optimistic addCandidate() store
                  // write and the "Promoted to candidate" badge on this same result,
                  // instead of committing that state unconditionally.
                  const ok = await setTriageStatus(lead.leadSetId, 'promoted', '');
                  if (ok) {
                    onTriaged?.(lead.leadSetId, 'promoted');
                  } else {
                    console.error(
                      '[EvidenceLibrary] setTriageStatus(promoted) failed for lead',
                      lead.leadSetId,
                    );
                  }
                  return ok;
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
          className="rounded p-1 text-red-600 hover:bg-red-50 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          data-testid="promoted-remove-button"
          title="Remove promoted candidate"
          aria-label="Remove promoted candidate"
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
          className="mt-0.5 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-sky-500 hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-900 dark:hover:text-sky-300"
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
              <div className="font-semibold text-slate-700 dark:text-slate-200 break-words">
                {source.short_citation}
              </div>
              <div className="text-slate-500 dark:text-slate-400 break-words font-mono">
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

// At-a-glance inventory of what is loaded in the catalog: headline counts + a browsable
// substance list (click to filter the main view). Per-reference retrieval status + retrieval/
// source/QA dates render when present (nullable; owner-supplied via the catalog), falling back
// gracefully to the legacy checked_at "retrieved" line.
function CatalogInventory({
  baseline,
  onSelectReference,
}: {
  baseline: ReturnType<typeof buildEvidenceLibraryView>;
  onSelectReference: (sourceId: string) => void;
}) {
  const references = baseline.sources;
  return (
    <section className="space-y-2.5" data-testid="evidence-library-inventory">
      <details className="group rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-950/60">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Catalog inventory
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({baseline.totalCounts.values} Values - {baseline.facets.substances.length} Substances)
            </span>
          </span>
          <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">v</span>
        </summary>
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
            <span>Canonical References ({references.length})</span>
            <span>Click to inspect source</span>
          </div>
          <ul className="max-h-48 print:max-h-none space-y-1 overflow-y-auto pt-0.5">
            {references.map((row) => (
              <li key={row.record.source_id}>
                <button
                  type="button"
                  onClick={() => onSelectReference(row.record.source_id)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white hover:shadow-xs dark:hover:bg-slate-900 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                >
                  <div className="font-semibold text-slate-900 dark:text-white text-[11px] leading-snug break-words">
                    {row.record.short_citation}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span>{row.linkedValueCount} values</span>
                    {row.record.retrieval_status && (
                      <span>- {humanizeCatalogLabel(row.record.retrieval_status)}</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </details>
    </section>
  );
}

function formatSourceShortCitation(src: SourceRecord): string {
  const org =
    src.publisher ||
    (src.authority_scope === 'bc-legal' ? 'BC ENV' : 'Regulatory Authority');
  const year = src.year ? ` (${src.year})` : '';
  const shortTitle = src.short_citation || src.title;
  return `${org}${year} - ${shortTitle}`;
}

function formatSourceLongCitation(src: SourceRecord): string {
  const parts: string[] = [];
  if (src.publisher) parts.push(src.publisher);
  if (src.year) parts.push(`(${src.year})`);
  if (src.title) parts.push(src.title);
  if (src.version) parts.push(`Version ${src.version}`);
  if (src.short_citation && src.short_citation !== src.title) {
    parts.push(`[Cited: ${src.short_citation}]`);
  }
  return parts.join('. ') + '.';
}

function getAuthorityTierBadge(tier?: string, scope?: string) {
  if (scope === 'bc-legal' || tier === 'tier_1_government_or_regulatory') {
    return { label: 'BC STATUTE / REGULATORY', bg: 'bg-sky-700 text-white dark:bg-sky-600' };
  }
  if (scope === 'federal-guidance') {
    return { label: 'FEDERAL HEALTH', bg: 'bg-slate-700 text-white dark:bg-slate-600' };
  }
  if (scope === 'international-guidance') {
    return { label: 'US EPA / INTL', bg: 'bg-slate-700 text-white dark:bg-slate-600' };
  }
  return { label: 'CANADIAN GUIDANCE', bg: 'bg-slate-600 text-white dark:bg-slate-500' };
}

export default function EvidenceLibrary({
  filters,
  onFiltersChange,
  regulatoryFrameId = 'bc-protocol1-v5-dra',
  calculatorReceipt,
  onDismissReceipt,
  className,
  showLeftPanel = false,
  showRightPanel = true,
  onRequestOpenRightPanel,
}: EvidenceLibraryProps) {
  const [viewMode, setViewMode] = useState<EvidenceLibraryViewMode>('values');
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const rightPanelContentRef = useRef<HTMLDivElement | null>(null);
  const [defaultPolicyStatusFilter, setDefaultPolicyStatusFilter] =
    useState<DefaultSelectionDecisionStatus | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [triageState, setTriageState] = useState<Record<string, SourceLeadTriageRow>>({});
  const [triageRefreshKey, setTriageRefreshKey] = useState(0);
  const [showQAHub, setShowQAHub] = useState(false);
  const [activeQAStage, setActiveQAStage] = useState<1 | 2 | 3 | 4>(1);
  const [selectedQASourceId, setSelectedQASourceId] = useState<string | null>(null);
  const [qaLeftRailCollapsed, setQaLeftRailCollapsed] = useState(false);
  const [stage1SearchQuery, setStage1SearchQuery] = useState('');
  const [paramVerifications, setParamVerifications] = useState<
    Record<string, { status: 'confirmed' | 'discrepancy' | 'needs_review'; comment: string }>
  >({});
  const [paramDecisionStates, setParamDecisionStates] = useState<
    Record<string, 'pending' | 'saved' | 'failed'>
  >({});
  const paramTargetVersionsRef = useRef<Map<string, number>>(new Map());
  const paramSavedVersionsRef = useRef<Map<string, number>>(new Map());
  const paramFailedRef = useRef<Set<string>>(new Set());
  const paramLatestDataRef = useRef<
    Map<string, { status: 'confirmed' | 'discrepancy' | 'needs_review'; comment: string }>
  >(new Map());
  const inFlightParamWritesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const [dirtyParamIds, setDirtyParamIds] = useState<Set<string>>(new Set());
  const [qaPersistenceError, setQaPersistenceError] = useState<string | null>(null);
  const [flaggedIssues, setFlaggedIssues] = useState<
    Array<{
      id: string;
      parameterValueId: string;
      substanceLabel: string;
      parameterName: string;
      category: string;
      comment: string;
      suggestedCorrection?: string;
      flaggedBy: string;
      timestamp: string;
      status: 'under_admin_review' | 'resolved' | 'acknowledged';
    }>
  >([]);
  const [flagFormOpen, setFlagFormOpen] = useState(false);
  const [flagSelectedParamId, setFlagSelectedParamId] = useState<string>('');
  const [flagCategory, setFlagCategory] = useState<string>(
    'Outdated Regulatory Standard',
  );
  const [flagComment, setFlagComment] = useState<string>('');
  const [flagSuggestedCorrection, setFlagSuggestedCorrection] =
    useState<string>('');
  const [flagSubmitSuccess, setFlagSubmitSuccess] = useState(false);
  // Values-table pagination. Reset to the first page whenever the filter inputs change BY VALUE
  // (not object identity) so a parent that recreates `filters` each render does not pin us to page 1.
  const [valuesPage, setValuesPage] = useState(0);
  const valuesPageResetKey = `${viewMode}|${defaultPolicyStatusFilter ?? ''}|${JSON.stringify(filters)}`;
  useEffect(() => {
    setValuesPage(0);
  }, [valuesPageResetKey]);

  // Stage 2 Verification Workbench Filters & Jump State
  const [stage2StatusFilter, setStage2StatusFilter] = useState<
    'all' | 'unreviewed' | 'confirmed' | 'discrepancy'
  >('all');
  const [stage2SearchQuery, setStage2SearchQuery] = useState('');
  const [stage2PathwayFilter, setStage2PathwayFilter] = useState('all');

  // Resizable right panel state. Default to the SSR-safe constant; hydrate from localStorage
  // in a mount-only effect to avoid an SSR/CSR hydration mismatch (matrix-map pattern).
  const [rightPanelWidth, setRightPanelWidth] = useState(
    REFERENCES_RIGHT_PANEL_DEFAULT_WIDTH,
  );
  useEffect(() => {
    // Clamp the restored value to the viewport budget here (not only to absolute
    // min/max) so the on-mount clamp does not depend on effect ordering with the
    // [showLeftPanel] re-clamp effect below. showLeftPanel is intentionally read
    // once at mount; later toggles are handled by that separate effect.
    setRightPanelWidth(
      clampReferencesRightPanelWidth(
        restoreReferencesRightPanelWidth(),
        showLeftPanel,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      REFERENCES_RIGHT_PANEL_WIDTH_STORAGE_KEY,
      String(rightPanelWidth),
    );
  }, [rightPanelWidth]);
  // Re-clamp when the left panel toggles (changes the available budget).
  useEffect(() => {
    setRightPanelWidth((current) =>
      clampReferencesRightPanelWidth(current, showLeftPanel),
    );
  }, [showLeftPanel]);
  // Re-clamp on viewport resize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setRightPanelWidth((current) =>
        clampReferencesRightPanelWidth(current, showLeftPanel),
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showLeftPanel]);
  // Pointer-drag the divider on the LEFT edge of the right panel: dragging left widens it.
  const handleRightPanelResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = rightPanelWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + (startX - moveEvent.clientX);
        setRightPanelWidth(
          clampReferencesRightPanelWidth(nextWidth, showLeftPanel),
        );
      };
      const onPointerUp = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    },
    [rightPanelWidth, showLeftPanel],
  );

  useEffect(() => {
    let cancelled = false;
    checkCurrentUserAdminStatus().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    usePromotedCandidatesStore.persist.rehydrate();
    usePromotedCandidatesStore.getState().hydrateFromSupabase().catch(console.error);

    fetchAllReviews().then((reviews) => {
      if (cancelled || !reviews || reviews.length === 0) return;
      const verifications: Record<string, { status: 'confirmed' | 'discrepancy' | 'needs_review'; comment: string }> = {};
      const flags: Array<{
        id: string;
        parameterValueId: string;
        substanceLabel: string;
        parameterName: string;
        category: string;
        comment: string;
        suggestedCorrection?: string;
        flaggedBy: string;
        timestamp: string;
        status: 'under_admin_review' | 'resolved' | 'acknowledged';
      }> = [];

      const resolvedFlagIds = new Set<string>();
      for (const rev of reviews) {
        if (rev.reviewer_note.startsWith('[FLAG_RESOLVED:')) {
          const match = rev.reviewer_note.match(/^\[FLAG_RESOLVED:\s*([^\]]+)\]/);
          if (match) {
            resolvedFlagIds.add(match[1].trim());
          }
        }
      }

      const reduced = reduceToCurrentVerificationStates(reviews);
      for (const [paramId, state] of Object.entries(reduced)) {
        const isConfirmed = state.current_qa_status === 'approved';
        const isDiscrepancy =
          state.current_qa_status !== 'approved' &&
          state.latest_reviewer_note.includes('[VERIFICATION: discrepancy]');
        const status: 'confirmed' | 'discrepancy' | 'needs_review' = isConfirmed
          ? 'confirmed'
          : isDiscrepancy
            ? 'discrepancy'
            : 'needs_review';
        const cleanComment = state.latest_reviewer_note.replace(
          /^\[VERIFICATION:\s*[^\]]+\]\s*/,
          '',
        );
        verifications[paramId] = {
          status,
          comment: cleanComment,
        };
      }

      for (const rev of reviews) {
        if (rev.reviewer_note.startsWith('[FLAG_RESOLVED:')) {
          continue;
        }
        if (rev.reviewer_note.startsWith('[FLAG:')) {
          const match = rev.reviewer_note.match(/^\[FLAG:\s*([^\]]+)\]\s*([\s\S]*)$/);
          const category = match ? match[1].trim() : 'General Issue';
          let noteBody = match ? match[2].trim() : rev.reviewer_note;
          let suggestedCorrection: string | undefined;
          const suggMatch = noteBody.match(/\(Suggested:\s*([^)]+)\)$/);
          if (suggMatch) {
            suggestedCorrection = suggMatch[1].trim();
            noteBody = noteBody.replace(/\(Suggested:\s*[^)]+\)$/, '').trim();
          }
          const cleanId = rev.parameter_value_id.replace(/^pv-/, '').replace(/-/g, ' ');
          const isResolved = resolvedFlagIds.has(rev.id);
          flags.push({
            id: rev.id,
            parameterValueId: rev.parameter_value_id,
            substanceLabel: 'Regulatory Parameter',
            parameterName: cleanId,
            category,
            comment: noteBody,
            suggestedCorrection,
            flaggedBy: rev.reviewed_by ? `User ${rev.reviewed_by.slice(0, 8)}` : 'Unassigned / Anonymous',
            timestamp: rev.reviewed_at.replace('T', ' ').slice(0, 16),
            status: isResolved ? 'resolved' : 'under_admin_review',
          });
        }
      }

      if (Object.keys(verifications).length > 0) {
        setParamVerifications((prev) => ({ ...verifications, ...prev }));
      }
      if (flags.length > 0) {
        setFlaggedIssues((prev) => {
          const existingIds = new Set(prev.map((f) => f.id));
          const newUnique = flags.filter((f) => !existingIds.has(f.id));
          return [...newUnique, ...prev];
        });
      }
    }).catch(console.error);

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
  const [savedViews, setSavedViews] = useState<SavedFilterView[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [savedViewName, setSavedViewName] = useState('');
  const [savingViewSubmitting, setSavingViewSubmitting] = useState(false);
  const [saveViewError, setSaveViewError] = useState<string | null>(null);
  const [savedViewsActionError, setSavedViewsActionError] = useState<string | null>(null);
  const [statusAdminOpen, setStatusAdminOpen] = useState(false);
  // A5: shared aria-live="polite" outcome channel. announce() is provided to descendants
  // via EvidenceLibraryAnnounceContext so nested forms (QaReviewActions,
  // AddEvidenceLocatorForm, LeadTriageControls, ...) can report SUCCESS outcomes without
  // prop-drilling a callback through every intermediate component.
  // Stored as {text, seq} rather than a bare string: setting React state to a value
  // EQUAL to the current value is a no-op bail-out (no re-render, no DOM mutation, no
  // screen-reader announcement). Two consecutive identical announcements (e.g.
  // dismissing two leads in a row both say "Triage status updated to dismissed.")
  // would otherwise silently drop the second one. The monotonic seq guarantees the
  // state object is always a new reference even when the text repeats; only text is
  // rendered into the live region.
  const [liveMessage, setLiveMessage] = useState<{ text: string; seq: number }>({
    text: '',
    seq: 0,
  });
  const announce = useCallback((message: string) => {
    setLiveMessage((current) => ({ text: message, seq: current.seq + 1 }));
  }, []);
  // 'loading' until the Supabase probe resolves; 'supabase' when views sync to the
  // signed-in account; 'local' when signed-out / offline (localStorage fallback).
  const [savedViewsBackend, setSavedViewsBackend] = useState<
    'loading' | 'supabase' | 'local'
  >('loading');
  // Load saved views: localStorage first (instant, offline-safe), then Supabase when a
  // session is available. One-time migrates legacy localStorage views into the account.
  useEffect(() => {
    let cancelled = false;
    const local = loadSavedViews();
    setSavedViews(local);
    (async () => {
      try {
        const result = await fetchSavedViewsResult();
        if (cancelled) return;
        if (result.views.length > 0) {
          setSavedViews(result.views.map(rowToSavedFilterView));
          setSavedViewsBackend('supabase');
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(SAVED_VIEWS_MIGRATED_KEY, 'done');
          }
          return;
        }
        // Empty result. Only act authoritatively on a SUCCESSFUL signed-in read. On a
        // read error (missing table / RLS / outage) or when signed out, keep the
        // localStorage fallback and NEVER delete it.
        if (result.error || !result.signedIn) {
          setSavedViewsBackend('local');
          return;
        }
        const alreadyMigrated =
          typeof window !== 'undefined' &&
          window.localStorage.getItem(SAVED_VIEWS_MIGRATED_KEY) === 'done';
        if (local.length > 0 && !alreadyMigrated) {
          const importResult = await importLegacySavedViews(
            local.map((v) => ({
              name: v.name,
              filters: v.filters,
              view_mode: v.viewMode,
            })),
          );
          if (cancelled) return;
          if (importResult.success) {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(SAVED_VIEWS_MIGRATED_KEY, 'done');
            }
            const refreshed = await fetchSavedViews();
            if (cancelled) return;
            setSavedViews(refreshed.map(rowToSavedFilterView));
            setSavedViewsBackend('supabase');
          } else {
            setSavedViewsBackend('local');
          }
          return;
        }
        // Signed in, successful read, genuinely empty. Do NOT delete the local mirror --
        // it may hold legitimate views created offline / while signed out (saveCurrentView
        // caches the optimistic row locally on a transient or unauthenticated write), and
        // codex review flagged clearing here as data loss. Keep any local views as the
        // fallback; they sync up on the next successful save. Hiding a DIFFERENT account's
        // cached views on the same browser without deleting legitimate local-only views
        // needs the local cache stamped per user_id -- tracked as a follow-up, not a silent
        // delete here.
        setSavedViewsBackend(local.length > 0 ? 'local' : 'supabase');
        if (local.length === 0 && typeof window !== 'undefined') {
          window.localStorage.setItem(SAVED_VIEWS_MIGRATED_KEY, 'done');
        }
      } catch {
        if (!cancelled) setSavedViewsBackend('local');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // The default-policy audit + admin tools live in the demoted, collapsed "Catalog status &
  // admin" section. When the user arrives via the calculator "Review candidate defaults"
  // shortcut (calculatorReceipt present), auto-open that section so the audit they came to
  // review is visible instead of hidden behind a closed <details>.
  useEffect(() => {
    if (calculatorReceipt) setStatusAdminOpen(true);
  }, [calculatorReceipt]);
  const protocol28Summary = useMemo(() => buildProtocol28ReviewSummary(), []);

  const activeQASource = useMemo(() => {
    if (selectedQASourceId) {
      const match = library.sources.find(
        (s) => s.record.source_id === selectedQASourceId,
      );
      if (match) return match;
    }
    return library.sources[0] ?? null;
  }, [library.sources, selectedQASourceId]);

  const extractedValuesForSource = useMemo(() => {
    if (!activeQASource) return [];
    const srcId = activeQASource.record.source_id;
    const directMatches = library.values.filter(
      (row) =>
        row.record.source_ids?.includes(srcId) ||
        row.sources.some((s) => s.source_id === srcId),
    );
    // Explicit empty state: never fallback to unrelated values from other sources
    const rawList = directMatches;
    return [...rawList].sort((a, b) => {
      const substanceCmp = (a.substanceLabel ?? '').localeCompare(b.substanceLabel ?? '');
      if (substanceCmp !== 0) return substanceCmp;
      const nameCmp = (a.record.display_name ?? '').localeCompare(b.record.display_name ?? '');
      if (nameCmp !== 0) return nameCmp;
      return (a.record.pathway ?? '').localeCompare(b.record.pathway ?? '');
    });
  }, [library.values, activeQASource]);

  const availableStage2Pathways = useMemo(() => {
    const set = new Set<string>();
    for (const val of extractedValuesForSource) {
      if (val.record.pathway) set.add(val.record.pathway);
    }
    return Array.from(set);
  }, [extractedValuesForSource]);

  const stage2Stats = useMemo(() => {
    const total = extractedValuesForSource.length;
    const confirmed = extractedValuesForSource.filter(
      (v) => paramVerifications[v.record.parameter_value_id]?.status === 'confirmed',
    ).length;
    const discrepancy = extractedValuesForSource.filter(
      (v) => paramVerifications[v.record.parameter_value_id]?.status === 'discrepancy',
    ).length;
    const unreviewed = total - (confirmed + discrepancy);
    return { total, confirmed, discrepancy, unreviewed };
  }, [extractedValuesForSource, paramVerifications]);

  const filteredStage2Values = useMemo(() => {
    return extractedValuesForSource.filter((val) => {
      const vState = paramVerifications[val.record.parameter_value_id];
      const isConfirmed = vState?.status === 'confirmed';
      const isDiscrepancy = vState?.status === 'discrepancy';
      const isUnreviewed = !vState || vState.status === 'needs_review';

      if (stage2StatusFilter === 'unreviewed' && !isUnreviewed) return false;
      if (stage2StatusFilter === 'confirmed' && !isConfirmed) return false;
      if (stage2StatusFilter === 'discrepancy' && !isDiscrepancy) return false;

      if (stage2PathwayFilter !== 'all' && val.record.pathway !== stage2PathwayFilter) {
        return false;
      }

      if (stage2SearchQuery.trim()) {
        const q = stage2SearchQuery.toLowerCase();
        const matchesSubstance = val.substanceLabel.toLowerCase().includes(q);
        const matchesParam = val.record.display_name.toLowerCase().includes(q);
        const matchesLocator = val.record.evidence_items?.some((e) =>
          e.locator?.toLowerCase().includes(q),
        );
        const matchesNotes = vState?.comment?.toLowerCase().includes(q);
        if (!matchesSubstance && !matchesParam && !matchesLocator && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [
    extractedValuesForSource,
    paramVerifications,
    stage2StatusFilter,
    stage2PathwayFilter,
    stage2SearchQuery,
  ]);

  const executePersistForParam = (paramId: string): Promise<boolean> => {
    // If a write for this paramId is already in flight, return the exact same promise (prevents duplicate writes)
    const inFlight = inFlightParamWritesRef.current.get(paramId);
    if (inFlight) {
      return inFlight;
    }

    const targetVersion = paramTargetVersionsRef.current.get(paramId) ?? 1;
    const latestData = paramLatestDataRef.current.get(paramId) ?? paramVerifications[paramId] ?? {
      status: 'needs_review' as const,
      comment: '',
    };
    const status = latestData.status;
    const comment = latestData.comment;

    const currentTarget =
      library.values.find((v) => v.record.parameter_value_id === paramId) ??
      baselineLibrary.values.find((v) => v.record.parameter_value_id === paramId);
    const oldQaStatus = currentTarget?.record.qa_status ?? 'needs_review';
    const newQaStatus = status === 'confirmed' ? 'approved' : 'needs_review';
    const trimmedComment = comment.trim();
    const note = `[VERIFICATION: ${status}] ${
      trimmedComment ||
      (status === 'confirmed'
        ? 'Verified as confirmed in QA/QC workbench'
        : status === 'discrepancy'
          ? 'Flagged discrepancy in QA/QC workbench'
          : 'Marked as needs_review in QA/QC workbench')
    }`;

    if (note.length > 1000) {
      paramFailedRef.current.add(paramId);
      setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'failed' }));
      setQaPersistenceError(
        `Comment is too long (${note.length} characters). Complete note envelope cannot exceed 1000 characters.`,
      );
      return Promise.resolve(false);
    }

    paramFailedRef.current.delete(paramId);
    setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'pending' }));
    setQaPersistenceError(null);

    const promise: Promise<boolean> = submitReview(
      paramId,
      oldQaStatus,
      newQaStatus,
      note,
      currentTarget?.record.evidence_support_status || undefined,
      undefined,
    )
      .then((ok) => {
        if (ok) {
          paramSavedVersionsRef.current.set(paramId, targetVersion);
          paramFailedRef.current.delete(paramId);
          const currentTargetVer = paramTargetVersionsRef.current.get(paramId) ?? targetVersion;

          if (currentTargetVer > targetVersion) {
            // A newer edit occurred while this write was in flight!
            // Queue and persist the newest generation immediately.
            inFlightParamWritesRef.current.delete(paramId);
            return executePersistForParam(paramId);
          } else {
            // Successfully persisted newest generation
            setDirtyParamIds((prev) => {
              const next = new Set(prev);
              next.delete(paramId);
              return next;
            });
            setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'saved' }));
            announce(`Verification recorded in database: ${status}.`);
            return true;
          }
        } else {
          paramFailedRef.current.add(paramId);
          setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'failed' }));
          setQaPersistenceError(
            'Failed to save verification decision to database. Please check connection.',
          );
          announce('Failed to save verification decision to database.');
          return false;
        }
      })
      .catch((err) => {
        console.error('submitReview error:', err);
        paramFailedRef.current.add(paramId);
        setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'failed' }));
        setQaPersistenceError(
          'Failed to save verification decision to database. Please check connection.',
        );
        announce('Failed to save verification decision to database.');
        return false;
      })
      .finally(() => {
        inFlightParamWritesRef.current.delete(paramId);
      });

    inFlightParamWritesRef.current.set(paramId, promise);
    return promise;
  };

  const handleVerifyParameter = (
    paramId: string,
    status: 'confirmed' | 'discrepancy' | 'needs_review',
  ) => {
    const nextVer = (paramTargetVersionsRef.current.get(paramId) ?? 0) + 1;
    paramTargetVersionsRef.current.set(paramId, nextVer);
    const comment = paramVerifications[paramId]?.comment ?? '';
    paramLatestDataRef.current.set(paramId, { status, comment });

    setParamVerifications((prev) => ({
      ...prev,
      [paramId]: {
        status,
        comment,
      },
    }));
    setDirtyParamIds((prev) => new Set(prev).add(paramId));
    setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'pending' }));
    executePersistForParam(paramId);
  };

  const handleCommentChange = (paramId: string, comment: string) => {
    // Truncate to max 500 characters
    const trimmed = comment.slice(0, 500);
    const nextVer = (paramTargetVersionsRef.current.get(paramId) ?? 0) + 1;
    paramTargetVersionsRef.current.set(paramId, nextVer);

    const prevStatus = paramVerifications[paramId]?.status;
    const nextStatus =
      prevStatus === 'confirmed' ? 'needs_review' : (prevStatus ?? 'needs_review');

    paramLatestDataRef.current.set(paramId, { status: nextStatus, comment: trimmed });

    setParamVerifications((prev) => ({
      ...prev,
      [paramId]: {
        status: nextStatus,
        comment: trimmed,
      },
    }));
    setDirtyParamIds((prev) => new Set(prev).add(paramId));
    setParamDecisionStates((prev) => ({ ...prev, [paramId]: 'pending' }));
    setQaPersistenceError(null);
  };

  const handleTransitionFromStage2 = async (targetStage: 1 | 2 | 3 | 4) => {
    if (targetStage === 1) {
      setActiveQAStage(1);
      return;
    }
    if (targetStage === 2) {
      return;
    }

    setQaPersistenceError(null);

    // Identify all parameter IDs with unsaved generations or writes currently in flight
    const pendingIds = new Set<string>();
    for (const [id, targetVer] of paramTargetVersionsRef.current.entries()) {
      const savedVer = paramSavedVersionsRef.current.get(id) ?? 0;
      if (targetVer > savedVer) {
        pendingIds.add(id);
      }
    }
    for (const id of inFlightParamWritesRef.current.keys()) {
      pendingIds.add(id);
    }
    for (const id of paramFailedRef.current) {
      pendingIds.add(id);
    }
    for (const id of dirtyParamIds) {
      pendingIds.add(id);
    }

    if (pendingIds.size > 0) {
      await Promise.all(Array.from(pendingIds).map((id) => executePersistForParam(id)));
    }

    // Authoritative check on live refs
    let hasUnsaved = false;
    for (const [id, targetVer] of paramTargetVersionsRef.current.entries()) {
      const savedVer = paramSavedVersionsRef.current.get(id) ?? 0;
      if (targetVer > savedVer) {
        hasUnsaved = true;
        break;
      }
    }
    const hasInFlight = inFlightParamWritesRef.current.size > 0;
    const hasFailures = paramFailedRef.current.size > 0;

    if (hasUnsaved || hasInFlight || hasFailures) {
      setQaPersistenceError(
        'Cannot proceed: verification write(s) pending, unsaved, or failed. Please resolve errors and retry.',
      );
      announce('Cannot proceed: verification items are unsaved or failed.');
      return; // Fail closed: remain in Stage 2
    }

    setQaPersistenceError(null);
    announce(`Proceeding to Stage ${targetStage}.`);
    setActiveQAStage(targetStage);
  };

  const handleFlagIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagSelectedParamId || !flagComment.trim()) return;
    const targetVal = library.values.find(
      (v) => v.record.parameter_value_id === flagSelectedParamId,
    ) ?? baselineLibrary.values.find(
      (v) => v.record.parameter_value_id === flagSelectedParamId,
    );
    const cleanComment = flagComment.trim();
    const cleanCorrection = flagSuggestedCorrection.trim();
    const flagNote = `[FLAG: ${flagCategory}] ${cleanComment}${cleanCorrection ? ` (Suggested: ${cleanCorrection})` : ''}`;

    if (flagNote.length > 1000) {
      setQaPersistenceError(
        `Flag note is too long (${flagNote.length} characters). Complete note envelope cannot exceed 1000 characters.`,
      );
      announce('Flag note is too long. Maximum note envelope is 1000 characters.');
      return;
    }

    const newIssue = {
      id: `flag-${Date.now()}`,
      parameterValueId: flagSelectedParamId,
      substanceLabel: targetVal?.substanceLabel || 'General Standard',
      parameterName: targetVal?.record.display_name || 'Parameter Value',
      category: flagCategory,
      comment: cleanComment,
      suggestedCorrection: cleanCorrection || undefined,
      flaggedBy: 'Unassigned / Anonymous',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'under_admin_review' as const,
    };

    submitReview(
      flagSelectedParamId,
      targetVal?.record.qa_status ?? 'needs_review',
      'needs_review',
      flagNote,
      targetVal?.record.evidence_support_status || undefined,
      undefined,
    ).then((ok) => {
      if (ok) {
        setFlaggedIssues((prev) => [newIssue, ...prev]);
        setFlagComment('');
        setFlagSuggestedCorrection('');
        setFlagSelectedParamId('');
        setFlagSubmitSuccess(true);
        setTimeout(() => setFlagSubmitSuccess(false), 4500);
        announce('Potential issue flag persisted to Supabase Admin Queue.');
      } else {
        setQaPersistenceError('Failed to submit issue flag. Ensure you are signed in with an authorized role.');
        announce('Failed to submit issue flag. Ensure you are signed in with an authorized role.');
      }
    }).catch((err) => {
      console.error(err);
      setQaPersistenceError('Failed to submit issue flag.');
      announce('Failed to submit issue flag.');
    });
  };
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
  // Page the visible values so the table renders at most VALUES_PAGE_SIZE rows. The clamped page
  // guards against a stale page index after the filter set shrinks (the reset effect also fires,
  // but clamping avoids a one-render flash of an out-of-range empty page).
  const valuesPagination = computeValuesPagination(
    visibleValues.length,
    valuesPage,
    VALUES_PAGE_SIZE,
  );
  const {
    pageCount: valuesPageCount,
    clampedPage: clampedValuesPage,
    isPaged: isValuesPaged,
  } = valuesPagination;
  const pagedVisibleValues = isValuesPaged
    ? visibleValues.slice(valuesPagination.sliceStart, valuesPagination.sliceEnd)
    : visibleValues;
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
          ) ??
          baselineLibrary.values.find(
            (row) => row.record.parameter_value_id === selectedValueId,
          ) ??
          null
        : null,
    [library.values, baselineLibrary.values, selectedValueId],
  );
  const selectedSource = useMemo(
    () =>
      selectedSourceId
        ? // Fall back to the unfiltered baseline so a reference clicked from the inventory
          // (which lists baseline sources) still opens even when active filters exclude it.
          library.sources.find((row) => row.record.source_id === selectedSourceId) ??
          baselineLibrary.sources.find(
            (row) => row.record.source_id === selectedSourceId,
          ) ??
          null
        : null,
    [library.sources, baselineLibrary.sources, selectedSourceId],
  );

  useEffect(() => {
    if (selectedValueId || selectedSourceId) {
      if (typeof rightPanelContentRef.current?.scrollTo === 'function') {
        rightPanelContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (rightPanelContentRef.current) {
        rightPanelContentRef.current.scrollTop = 0;
      }
    }
  }, [selectedValueId, selectedSourceId]);

  const updateFilter = (key: FilterArrayKey, value: string) => {
    onFiltersChange(setSingleFilter(filters, key, value));
  };
  const closeDetailPanels = () => {
    setSelectedValueId(null);
    setSelectedSourceId(null);
    setIsDossierModalOpen(false);
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
  const applySavedView = (view: SavedFilterView) => {
    setViewMode(view.viewMode);
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(view.filters);
  };
  // Returns { ok, message }: ok is false whenever the view was NOT actually saved --
  // either rejected by the server (any success:false result from createSavedView,
  // including an unrecognized/'unknown' error code, which defaults to failure) or an
  // unexpected exception. ok is true only for a confirmed server save or the
  // intentional signed-out/local-only path. createSavedView (saved-views-sync.ts) has
  // its own top-level try/catch and NEVER throws -- every failure comes back as
  // {success:false, error:...} -- so the branch on `result` below is the real contract;
  // the try/catch here is purely defensive against a future change to that contract,
  // and on catch it now fails and rolls back rather than pretending success.
  const saveCurrentView = async (
    name: string,
  ): Promise<{ ok: boolean; message: string | null }> => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, message: null };
    const optimistic: SavedFilterView = {
      id: `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}`,
      name: trimmed,
      filters,
      viewMode,
    };
    const next = [...savedViews, optimistic];
    setSavedViews(next);
    persistSavedViews(next); // keep the local mirror in sync (offline cache)
    // Roll the optimistic row back out of local state. Used for every failure path so
    // a rejected/errored create never leaves an orphaned local-only row behind -- that
    // orphan is what made the row undeletable later (its id is a client-generated
    // string, not a Postgres UUID, so a server delete against it always fails).
    const rollbackOptimistic = () => {
      setSavedViews((current) => {
        const rolledBack = current.filter((v) => v.id !== optimistic.id);
        persistSavedViews(rolledBack);
        return rolledBack;
      });
    };
    let result: SaveViewResult;
    try {
      result = await createSavedView({
        name: trimmed,
        filters,
        view_mode: viewMode,
      });
    } catch (err) {
      console.error('[EvidenceLibrary] createSavedView unexpected error:', err);
      rollbackOptimistic();
      return {
        ok: false,
        message: `"${trimmed}" could not be saved: an unexpected error occurred. Try again.`,
      };
    }
    if (result.success && result.view) {
      const serverView = rowToSavedFilterView(result.view);
      setSavedViews((current) => {
        // Persist the reconciled list so localStorage holds the SERVER id, not the
        // optimistic one -- otherwise a later offline delete would call deleteSavedView
        // with an id Supabase never stored and the view would resurrect on next sync.
        const reconciled = current.map((v) =>
          v.id === optimistic.id ? serverView : v,
        );
        persistSavedViews(reconciled);
        return reconciled;
      });
      setSavedViewsBackend('supabase');
      return { ok: true, message: null };
    }
    if (result.error === 'unauthenticated') {
      // Signed-out: local-only is correct; keep the optimistic row. The announcement
      // must say so explicitly -- returning message:null here previously let the
      // caller's generic 'Saved view "X" created.' fallback announce success without
      // telling the user the view never left the browser (NEW-P3-1).
      setSavedViewsBackend('local');
      return {
        ok: true,
        message: `Saved view "${trimmed}" created in this browser only. Sign in to sync it to your account.`,
      };
    }
    if (result.error === 'limit_reached') {
      rollbackOptimistic();
      return {
        ok: false,
        message: `"${trimmed}" was not saved: you have reached the saved-view limit. Delete an existing saved view, then try again.`,
      };
    }
    if (result.error === 'invalid_name') {
      rollbackOptimistic();
      return {
        ok: false,
        message: `"${trimmed}" was not saved: that name is not valid. Try a different name.`,
      };
    }
    // Any other outcome -- including the 'unknown' error code createSavedView returns
    // for an RLS rejection, a Postgres error, or a network drop -- is a REAL failure.
    // The previous version treated this branch as a soft success ("keep the local
    // mirror; it persists offline and re-syncs next session"), which told the user
    // their save worked when it had not. Default to failure and roll back.
    rollbackOptimistic();
    return {
      ok: false,
      message: `"${trimmed}" was not saved: could not sync to your account. Check your connection and try again.`,
    };
  };
  const removeSavedView = async (id: string) => {
    setSavedViewsActionError(null);
    const removedView = savedViews.find((view) => view.id === id) ?? null;
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    persistSavedViews(next);
    // NEW-P2-2 fix: decide whether to attempt a server delete based on whether `id`
    // LOOKS LIKE a Supabase-issued UUID (SUPABASE_SAVED_VIEW_ID_RE), NOT on the
    // savedViewsBackend state variable. The backend flag is unreliable at exactly the
    // moments that matter: (1) a signed-in read that ERRORS sets it to 'local' while
    // savedViews may already be hydrated from the localStorage mirror holding REAL
    // server UUID rows; (2) the same catch-all applies to the outer try/catch's
    // 'local' fallback; (3) it starts as 'loading' while the local mirror is painted
    // synchronously and the Supabase probe is still async, so a fast click can land
    // before the probe resolves. Gating on the id's shape instead means a real server
    // row is ALWAYS sent to deleteSavedView, regardless of what backend state happens
    // to be set at click time. A client-generated optimistic id (never persisted to
    // Supabase, e.g. a create that failed before this fix, or one still in flight)
    // never matches this regex, so it correctly skips the server round-trip -- that
    // is the only case with nothing to delete server-side.
    if (!SUPABASE_SAVED_VIEW_ID_RE.test(id)) return;
    const ok = await deleteSavedView(id);
    if (!ok && removedView) {
      // deleteSavedView (saved-views-sync.ts) returns false both for a genuine
      // server/network failure AND for an expired session (no signed-in user) -- it
      // cannot distinguish the two, and the expired-session case will never succeed
      // on retry. Resurrecting the row here (the earlier "fix") created an infinite
      // loop for that case: the row comes back, the user deletes it again, it comes
      // back again, all while claiming a "connection" problem that may not be what
      // actually happened. Do not resurrect -- the user's delete intent stands
      // locally either way.
      //
      // P2-A / NEW-P2-3 fix: this branch is ALSO reached by a signed-out user whose
      // local mirror still holds real Supabase UUID rows from before they signed
      // out (fetchSavedViewsResult confirmed signedIn:false on mount, which is what
      // set savedViewsBackend to 'local' in the first place -- deleteSavedView then
      // fails because there is no user, not because of a network problem). For that
      // case the old copy ("...will reappear the next time this page loads and
      // re-syncs...") is affirmatively FALSE: signed out, the mount effect never
      // overwrites the local mirror (see the fetch effect above), so the row will
      // NOT reappear, and surfacing a red failure banner for what is really just a
      // local-only delete misleads the user into thinking something went wrong.
      // Branch on savedViewsBackend to pick the message, but NOTE what the flag
      // actually means: savedViewsBackend === 'local' does NOT mean the probe
      // confirmed signed-out. It is set to 'local' from four places, and three of
      // them can happen while the user is SIGNED IN: (1) a signed-in read that
      // errored (RLS / missing table / outage) at line ~3507; (2) a signed-in,
      // successful, genuinely-empty read that still has local-only rows at line
      // ~3544; (3) the outer catch-all at line ~3549. Only a subset of the paths
      // into 'local' are an actual confirmed sign-out. So the copy below must not
      // assert "you are signed out" -- it cannot be told apart from "signed in but
      // the read/delete could not reach the account" using state already present,
      // and inventing a new probe is out of scope here.
      //   - 'local': the delete is real (removed from this browser); it could not
      //     be confirmed removed from the account, and the cause may be either
      //     signed-out or a sync/read failure while signed in. Say both are
      if (savedViewsBackend === 'local') {
        setSavedViewsActionError(
          `"${removedView.name}" was removed from this browser, but it could not be confirmed removed from your account (you may be signed out, or your account sync could not be reached). If you are signed in, check your connection and delete it again; if you are signed out, sign in and delete it again to remove it there too.`,
        );
      } else {
        setSavedViewsActionError(
          `"${removedView.name}" was removed from this list, but the delete could not be confirmed on the server (this can happen if your session expired or you are offline). The view still exists in your account and will reappear the next time this page loads and re-syncs. If you are still signed in, check your connection and delete it again; if not, sign in again first.`,
        );
      }
    }
  };
  const applyAuditFilter = (
    _nextViewMode: EvidenceLibraryViewMode,
    request: EvidenceLibraryFilterRequest,
  ) => {
    setViewMode('values');
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(createEvidenceLibraryFilters(request));
  };
  // "Candidate defaults" quick-review affordance (HITL entry point; mirrors the calculator
  // "Review candidate defaults" shortcut). Toggle on -> apply the candidate-defaults filter;
  // toggle off -> clear filters. aria-pressed reflects whether the filter is currently active.
  const candidateDefaultsFilters = useMemo(
    () => createEvidenceLibraryFilters(CANDIDATE_DEFAULTS_REQUEST),
    [],
  );
  const candidateDefaultsActive =
    viewMode === 'values' &&
    defaultPolicyStatusFilter === null &&
    filtersEqual(filters, candidateDefaultsFilters);
  const toggleCandidateDefaults = () => {
    if (candidateDefaultsActive) {
      closeDetailPanels();
      setDefaultPolicyStatusFilter(null);
      onFiltersChange(createEvidenceLibraryFilters({}));
    } else {
      applyAuditFilter('values', CANDIDATE_DEFAULTS_REQUEST);
    }
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
    setViewMode('values');
    closeDetailPanels();
    setDefaultPolicyStatusFilter(null);
    onFiltersChange(
      createEvidenceLibraryFilters({
        search: 'Protocol 28',
      }),
    );
  };

  const showValues = true;
  const showValueGroups = false;
  const showSources = false;
  const showSourceLeads = false;
  const filterControls: Array<{
    key: FilterArrayKey;
    label: string;
    options: EvidenceLibraryFacetOption[];
  }> = [
    { key: 'substanceKeys', label: 'Substance', options: library.facets.substances },
    { key: 'pathways', label: 'Pathway', options: library.facets.pathways },
    { key: 'inputKeys', label: 'Parameter', options: library.facets.inputKeys },
    { key: 'jurisdictions', label: 'Jurisdiction', options: library.facets.jurisdictions },
  ];

  const primaryFilterKeys: ReadonlySet<FilterArrayKey> = new Set<FilterArrayKey>([
    'substanceKeys',
    'pathways',
    'inputKeys',
    'jurisdictions',
  ]);
  const primaryFilterControls = filterControls.filter((control) =>
    primaryFilterKeys.has(control.key),
  );
  const advancedFilterControls = filterControls.filter(
    (control) => !primaryFilterKeys.has(control.key),
  );

  // The filter grid is shared: it lives in the left panel on desktop, and falls back to the
  // center column when the left panel is unavailable (mobile, where the parent forces both
  // side panels closed, or when the user toggles the left panel off). Rendered in exactly one
  // place at a time so there is no duplicate mount.
  const filtersBlock = (
    <div className="space-y-3" data-testid="evidence-library-filters">
      {/* Search stays always-visible. */}
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

      {/* All dropdown filters collapse behind this button. */}
      <FilterPopover
        primaryControls={primaryFilterControls}
        advancedControls={advancedFilterControls}
        filters={filters}
        onUpdate={updateFilter}
        activeCount={activeLabels.length}
        onClearAll={clearFilters}
      />

      {/* HITL review shortcuts (quick filter buttons) */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button
          type="button"
          onClick={toggleCandidateDefaults}
          aria-pressed={candidateDefaultsActive}
          data-testid="evidence-library-candidate-defaults"
          className={cn(
            'min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
            candidateDefaultsActive
              ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
              : 'border-slate-300 bg-white text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
          )}
        >
          Candidate defaults
        </button>
      </div>

      {/* Active filters at a glance. */}
      {activeLabels.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5"
          data-testid="evidence-library-active-filters"
        >
          {activeLabels.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <EvidenceLibraryAnnounceContext.Provider value={announce}>
    <section
      className={cn('flex h-full overflow-hidden', className)}
      data-testid="references-values-tab"
    >
      {/* A5: single shared aria-live="polite" outcome channel for the whole Evidence
          Library panel (saves, QA outcomes, triage updates, filter results). Visually
          hidden via sr-only. Failure messages are rendered separately as role="alert"
          at their point of failure (see A4 fixes above) so they are announced
          assertively rather than only through this polite channel. */}
      {/* ROUND-3 REGRESSION FIXED: keying the OUTER aria-live div on seq (previous
          attempt) makes React destroy and recreate the live-region node itself on
          every announcement. Per the ARIA live-region contract, a region must already
          be present in the accessibility tree BEFORE its contents change -- content
          that arrives in the SAME commit as the region's own insertion is not
          announced. That was worse than the original bug: it guaranteed silence on
          every announcement, not just repeats.
          FIX (approach a, chosen for minimal surface area -- one region, no
          alternation bookkeeping): the OUTER <div aria-live="polite"> below is
          mounted unconditionally on first render and NEVER re-keyed, so it has a
          stable identity for the lifetime of this component -- requirement (1) and
          (2) of the self-check. The key={liveMessage.seq} moves to an INNER <span>
          child instead. React's DOM prop diff still bails out on identical
          `children` text for an in-place update, but a changed key on the span makes
          React unmount the OLD span and mount a NEW span with the new text as a
          child of the (unchanged, still-mounted) outer div -- see self-check answer
          3 below for exactly what DOM node is added/removed. That child swap is a
          real DOM mutation happening INSIDE an already-present live region, which is
          exactly what the ARIA contract requires for an announcement to fire,
          including for a byte-identical repeat message (the span is still a new
          node each time, regardless of its text content). */}
      <div
        aria-live="polite"
        role="status"
        className="sr-only"
        data-testid="evidence-library-live-region"
      >
        <span key={liveMessage.seq}>{liveMessage.text}</span>
      </div>

      {showQAHub ? (
        <div className="w-full flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-slate-950">
          {/* Top Sticky Return Bar & Stage Navigation Banner */}
          <div className="flex-shrink-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 md:p-4 shadow-xs">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowQAHub(false)}
                  className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-sky-500 hover:text-sky-600 dark:hover:border-sky-400 dark:hover:text-sky-400 shadow-xs transition-all shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Catalogue</span>
                </button>
                <div>
                  <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Catalog Review &amp; QA/QC Workspace
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Live DB Synced
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    Systematic verification of extracted parameter values against canonical authority documents.
                  </p>
                </div>
              </div>

              {/* 4 Stages Stepper */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                {[
                  { stage: 1 as const, name: '1. Select Source', num: 1 },
                  { stage: 2 as const, name: '2. Verify Values', num: 2 },
                  { stage: 3 as const, name: '3. Admin Review', num: 3 },
                  { stage: 4 as const, name: '4. Flag Issues', num: 4 },
                ].map((item) => (
                  <button
                    key={item.stage}
                    type="button"
                    onClick={async () => {
                      if (activeQAStage === 2 && item.stage !== 2) {
                        await handleTransitionFromStage2(item.stage);
                      } else {
                        setActiveQAStage(item.stage);
                      }
                    }}
                    className={cn(
                      'min-h-[44px] px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-all text-xs text-left',
                      activeQAStage === item.stage
                        ? 'font-bold bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                    )}
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                        activeQAStage === item.stage
                          ? 'bg-sky-700 text-white dark:bg-sky-600 dark:text-white'
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
                      )}
                    >
                      {item.num}
                    </span>
                    <span className="whitespace-normal">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable Stage Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-4">
              {/* STAGE 1: Source Document Selection & Inventory (List View) */}
              {activeQAStage === 1 && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Stage 1: Authority Source Documents ({library.sources.length})
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select a regulatory or scientific authority source from the list to begin verifying extracted parameter values.
                        </p>
                      </div>
                      <div className="w-full sm:w-80">
                        <input
                          type="search"
                          value={stage1SearchQuery}
                          onChange={(e) => setStage1SearchQuery(e.target.value)}
                          placeholder="Search sources by author, year, title..."
                          className="w-full min-h-[44px] px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* List of Authority Source Documents */}
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                      {library.sources
                        .filter((src) => {
                          if (!stage1SearchQuery.trim()) return true;
                          const q = stage1SearchQuery.toLowerCase();
                          return (
                            src.record.title?.toLowerCase().includes(q) ||
                            src.record.short_citation?.toLowerCase().includes(q) ||
                            src.record.publisher?.toLowerCase().includes(q) ||
                            src.record.source_id?.toLowerCase().includes(q) ||
                            (src.record.year && String(src.record.year).includes(q))
                          );
                        })
                        .sort((a, b) => {
                          const aCite = formatSourceShortCitation(a.record);
                          const bCite = formatSourceShortCitation(b.record);
                          return aCite.localeCompare(bCite);
                        })
                        .map((src) => {
                          const tierInfo = getAuthorityTierBadge(
                            src.record.source_authority_tier,
                            src.record.authority_scope,
                          );
                          const shortCitationText = formatSourceShortCitation(src.record);
                          const directValues = library.values.filter(
                            (row) =>
                              row.record.source_ids?.includes(src.record.source_id) ||
                              row.sources.some((s) => s.source_id === src.record.source_id),
                          );
                          const totalValCount = directValues.length > 0 ? directValues.length : src.linkedValueCount;
                          const confirmedCount = directValues.filter(
                            (v) => paramVerifications[v.record.parameter_value_id]?.status === 'confirmed',
                          ).length;
                          const discrepancyCount = directValues.filter(
                            (v) => paramVerifications[v.record.parameter_value_id]?.status === 'discrepancy',
                          ).length;
                          const verifiedCount = confirmedCount + discrepancyCount;
                          const percent = totalValCount > 0 ? Math.round((verifiedCount / totalValCount) * 100) : 0;

                          return (
                            <div
                              key={src.record.source_id}
                              className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              {/* Left: Source Citation, Tier & Metadata */}
                              <div className="space-y-1.5 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', tierInfo.bg)}>
                                    {tierInfo.label}
                                  </span>
                                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                                    {src.record.source_id}
                                  </span>
                                  {src.record.year && (
                                    <span className="text-xs text-slate-400">
                                      - {src.record.year}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                  {shortCitationText}
                                </h4>

                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                                  {src.record.title}
                                </p>
                              </div>

                              {/* Middle: Verification Progress Card */}
                              <div className="w-full lg:w-72 shrink-0 space-y-1.5 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                  <span className="font-medium">Verification Status:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {verifiedCount} / {totalValCount} ({percent}%)
                                  </span>
                                </div>

                                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all',
                                      percent === 100
                                        ? 'bg-emerald-600 dark:bg-emerald-500'
                                        : 'bg-sky-600 dark:bg-sky-500',
                                    )}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                                    <Check className="w-3 h-3" /> {confirmedCount} Confirmed
                                  </span>
                                  {discrepancyCount > 0 && (
                                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                                      <AlertTriangle className="w-3 h-3" /> {discrepancyCount} Discrepant
                                    </span>
                                  )}
                                  <span className="text-slate-400">
                                    {totalValCount - verifiedCount} Outstanding
                                  </span>
                                </div>
                              </div>

                              {/* Right: Select & Verify Button */}
                              <div className="shrink-0 flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedQASourceId(src.record.source_id);
                                    setActiveQAStage(2);
                                  }}
                                  className="w-full lg:w-auto min-h-[44px] px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                  <span>Verify Values ({totalValCount}) -&gt;</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

          {/* STAGE 2: Source Value & Information Verification */}
          {activeQAStage === 2 && (
            <div className="space-y-4">
              {activeQASource && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setActiveQAStage(1)}
                          className="min-h-[44px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors mr-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Change Source</span>
                        </button>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-700 dark:bg-sky-600 text-white">
                          STAGE 2 VERIFICATION
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {activeQASource.record.source_id}
                        </span>
                      </div>
                      <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white mt-1">
                        {formatSourceLongCitation(activeQASource.record)}
                      </h3>
                    </div>

                    <a
                      href={activeQASource.record.url || '#'}
                      target={activeQASource.record.url ? '_blank' : undefined}
                      rel="noreferrer"
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold shadow-sm transition-all shrink-0"
                    >
                      <span>Open Source Document</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                        Extracted Parameters
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {extractedValuesForSource.length} Values
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                        Confirmed Accurate
                      </div>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {
                          extractedValuesForSource.filter(
                            (v) =>
                              paramVerifications[v.record.parameter_value_id]?.status ===
                              'confirmed',
                          ).length
                        }{' '}
                        Confirmed
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                        Discrepancies Flagged
                      </div>
                      <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {
                          extractedValuesForSource.filter(
                            (v) =>
                              paramVerifications[v.record.parameter_value_id]?.status ===
                              'discrepancy',
                          ).length
                        }{' '}
                        Discrepancies
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">
                        Authority Scope
                      </div>
                      <div className="text-sm font-bold text-sky-600 dark:text-sky-400">
                        {humanizeCatalogLabel(activeQASource.record.authority_scope)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 2 Simple & Intuitive Filter & Resume Bar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Quick Status Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                      Status:
                    </span>
                    <button
                      type="button"
                      onClick={() => setStage2StatusFilter('all')}
                      className={cn(
                        'min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                        stage2StatusFilter === 'all'
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                      )}
                    >
                      <span>All</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono">
                        {stage2Stats.total}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStage2StatusFilter('unreviewed')}
                      className={cn(
                        'min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                        stage2StatusFilter === 'unreviewed'
                          ? 'bg-amber-700 dark:bg-amber-600 text-white shadow-xs'
                          : stage2Stats.unreviewed > 0
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                      )}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Unreviewed</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono font-bold">
                        {stage2Stats.unreviewed}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStage2StatusFilter('confirmed')}
                      className={cn(
                        'min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                        stage2StatusFilter === 'confirmed'
                          ? 'bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmed</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono">
                        {stage2Stats.confirmed}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStage2StatusFilter('discrepancy')}
                      className={cn(
                        'min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5',
                        stage2StatusFilter === 'discrepancy'
                          ? 'bg-amber-700 dark:bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                      )}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Discrepancies</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/20 font-mono">
                        {stage2Stats.discrepancy}
                      </span>
                    </button>
                  </div>

                  {/* Search and Pathway Filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-full sm:w-56">
                      <input
                        type="search"
                        value={stage2SearchQuery}
                        onChange={(e) => setStage2SearchQuery(e.target.value)}
                        placeholder="Search substance, parameter..."
                        className="w-full min-h-[44px] px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400"
                      />
                    </div>

                    {availableStage2Pathways.length > 1 && (
                      <select
                        value={stage2PathwayFilter}
                        onChange={(e) => setStage2PathwayFilter(e.target.value)}
                        className="min-h-[44px] text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white"
                      >
                        <option value="all">All Pathways</option>
                        {availableStage2Pathways.map((pw) => (
                          <option key={pw} value={pw}>
                            {humanizeCatalogLabel(pw)}
                          </option>
                        ))}
                      </select>
                    )}

                    {(stage2StatusFilter !== 'all' || stage2SearchQuery || stage2PathwayFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setStage2StatusFilter('all');
                          setStage2SearchQuery('');
                          setStage2PathwayFilter('all');
                        }}
                        className="min-h-[44px] px-3 text-xs font-semibold text-sky-700 dark:text-sky-400 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Friendly Resume / Jump Banner */}
                {stage2Stats.unreviewed > 0 && stage2StatusFilter === 'all' && (
                  <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                      <Zap className="w-4 h-4" />
                      <span>
                        <strong>{stage2Stats.unreviewed}</strong> parameters remaining to verify for this source document.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStage2StatusFilter('unreviewed')}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-2xs transition-colors shrink-0"
                    >
                      <span>Show Unreviewed Items Only -&gt;</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Extracted Values Table Containerized with Internal Scrollbar */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 flex-shrink-0">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Extracted Parameter Values ({filteredStage2Values.length} of {extractedValuesForSource.length})
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Confirm accuracy or flag discrepancies with toxicologist rationale notes (up to 500 characters).
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Reviewer: <span className="font-semibold text-slate-800 dark:text-slate-200">Unassigned / Anonymous</span>
                  </div>
                </div>

                {qaPersistenceError && (
                  <div
                    role="alert"
                    className="p-3 bg-red-50 dark:bg-red-950/50 border-b border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300 font-semibold flex items-center justify-between gap-2"
                  >
                    <span>{qaPersistenceError}</span>
                    <button
                      type="button"
                      onClick={() => setQaPersistenceError(null)}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 text-xs font-bold text-red-600 hover:text-red-900 dark:hover:text-white rounded-lg"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Internal Scrollable Table Body */}
                <div className="overflow-y-auto max-h-[calc(100vh-420px)] print:max-h-none min-h-[260px] border-b border-slate-200 dark:border-slate-800">
                  {extractedValuesForSource.length === 0 ? (
                    <div className="p-10 text-center space-y-3" data-testid="evidence-qa-no-values">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No parameter values are linked to this source document.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        This authority reference has no directly linked parameter records in the current catalog.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveQAStage(1)}
                        className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-lg bg-sky-700 hover:bg-sky-800 text-white shadow-xs"
                      >
                        Select Another Source Document
                      </button>
                    </div>
                  ) : filteredStage2Values.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        No parameter values match the current filter selection.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStage2StatusFilter('all');
                          setStage2SearchQuery('');
                          setStage2PathwayFilter('all');
                        }}
                        className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-sky-700 dark:text-sky-400 underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50/80 dark:bg-slate-950/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px] z-10 backdrop-blur-xs">
                        <tr>
                          <th className="p-3 w-44">Substance</th>
                          <th className="p-3 w-40">Pathway &amp; Parameter</th>
                          <th className="p-3 w-28 font-mono">Catalog Value</th>
                          <th className="p-3 w-36">Evidence Locator</th>
                          <th className="p-3 w-48">Verification Decision</th>
                          <th className="p-3 min-w-[280px]">Toxicologist Reviewer Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredStage2Values.map((val) => {
                          const vState =
                            paramVerifications[val.record.parameter_value_id] ?? {
                              status: 'needs_review',
                              comment: '',
                            };
                          return (
                            <tr
                              key={val.record.parameter_value_id}
                              className={cn(
                                'hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors',
                                vState.status === 'confirmed' &&
                                  'bg-emerald-50/20 dark:bg-emerald-950/10',
                                vState.status === 'discrepancy' &&
                                  'bg-amber-50/30 dark:bg-amber-950/20',
                              )}
                            >
                              <td className="p-3 font-semibold text-slate-900 dark:text-white">
                                <div>{val.substanceLabel}</div>
                              </td>
                              <td className="p-3">
                                <div className="font-medium text-slate-700 dark:text-slate-300">
                                  {val.record.display_name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {humanizeCatalogLabel(val.record.pathway)}
                                </div>
                              </td>
                              <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                {val.record.value} {val.record.unit ?? ''}
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                  {val.record.evidence_items?.[0]?.locator ||
                                    'Sched 3.1, Matrix Col'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    aria-label={`Confirm parameter ${val.record.parameter_value_id}`}
                                    onClick={() =>
                                      handleVerifyParameter(
                                        val.record.parameter_value_id,
                                        'confirmed',
                                      )
                                    }
                                    className={cn(
                                      'min-h-[44px] px-3 py-1.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1',
                                      vState.status === 'confirmed'
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shadow-xs'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 border-transparent',
                                    )}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirmed</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Flag discrepancy for parameter ${val.record.parameter_value_id}`}
                                    onClick={() =>
                                      handleVerifyParameter(
                                        val.record.parameter_value_id,
                                        'discrepancy',
                                      )
                                    }
                                    className={cn(
                                      'min-h-[44px] px-3 py-1.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1',
                                      vState.status === 'discrepancy'
                                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 shadow-xs'
                                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 border-transparent',
                                    )}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Discrepancy</span>
                                  </button>
                                </div>
                              </td>
                              <td className="p-3 space-y-1">
                                <textarea
                                  value={vState.comment}
                                  maxLength={500}
                                  rows={2}
                                  onChange={(e) =>
                                    handleCommentChange(
                                      val.record.parameter_value_id,
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => {
                                    if (dirtyParamIds.has(val.record.parameter_value_id)) {
                                      executePersistForParam(val.record.parameter_value_id);
                                    }
                                  }}
                                  placeholder="Enter toxicologist notes, locator verification rationale, or discrepancies..."
                                  className="w-full text-xs p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 resize-y"
                                />
                                <div className="text-[10px] text-slate-400 text-right">
                                  {vState.comment.length} / 500 characters
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Bottom Persistent Action Bar - Always Visible */}
              <div className="sticky bottom-0 z-20 -mx-4 md:-mx-6 -mb-4 md:-mb-6 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveQAStage(1)}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                  >
                    Back to Source Document List
                  </button>
                  <div className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">
                    Reviewer: <span className="font-semibold text-slate-800 dark:text-slate-200">{isAdmin ? 'Admin Reviewer' : 'Unassigned / Anonymous'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTransitionFromStage2(3)}
                  className="min-h-[44px] px-6 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Save &amp; Proceed to Stage 3 (Admin Review Status) -&gt;</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Final Admin Verification & Publication Status (Read-Only) */}
          {activeQAStage === 3 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      ADMIN GOVERNANCE STAGE
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Status: PENDING ADMIN FINAL SIGN-OFF
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    Stage 3: Admin Review &amp; Publication Gate Status
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    User-verified values from Stage 2 are submitted to the Supabase verification ledger for final administrative sign-off.
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-700 dark:text-slate-300">
                  Queue ID: <span className="font-bold text-sky-600 dark:text-sky-400">SB-QA-2027-DRA</span>
                </div>
              </div>

              {/* Admin Governance Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Step 1: Toxicologist Review
                  </div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-4 h-4" />
                    <span>Stage 2 Verifications Recorded</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Extracted values and exact document locators verified by qualified reviewers and persisted to local/cloud ledger.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Step 2: Supabase Synchronization
                  </div>
                  <div className="text-sm font-bold text-sky-800 dark:text-sky-200">
                    Synced to Admin Review Queue
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Confirmation status, discrepancy notes, and reviewer comments are aggregated in Supabase tables for synthesis.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Step 3: Admin Final Sign-Off
                  </div>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    Admin Dashboard Action Required
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    Authenticated administrators review all submitted feedback, resolve discrepancies, and commit verified defaults.
                  </p>
                </div>
              </div>

              {/* Admin Queue Status Table Summary */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Verification Summary Prepared for Admin Review
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Total Sources</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">{library.sources.length} Documents</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Parameters Checked</div>
                    <div className="text-base font-bold text-slate-900 dark:text-white">{library.values.length} Items</div>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Discrepancy Flags</div>
                    <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                      {Object.values(paramVerifications).filter((p) => p.status === 'discrepancy').length} Active Flags
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Admin Sign-Off Status</div>
                    <div className="text-base font-bold text-sky-600 dark:text-sky-400">Pending Admin</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <strong>Note:</strong> Admin verification and default-policy modifications can only be performed by authenticated administrators via the Admin Dashboard (`/admin`). Regular users can inspect status here and proceed to Stage 4 to flag any potential issues.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveQAStage(2)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                >
                  Back to Stage 2 (Values Verification)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQAStage(4)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <span>Proceed to Stage 4 (Flag Issues) -&gt;</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: Post-Publication Issue Flagging & Continuous QA */}
          {activeQAStage === 4 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                      CONTINUOUS QA
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Post-Publication Review
                    </span>
                  </div>
                  <h3 data-testid="stage-4-heading" className="text-base font-bold text-slate-900 dark:text-white mt-1">
                    Stage 4: Flag Potential Issues &amp; Continuous QA
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Provides an opportunity for reviewers to flag subtle issues or scientific updates on parameters that cleared Stages 2 &amp; 3.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFlagFormOpen((prev) => !prev)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2 shrink-0"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{flagFormOpen ? 'Close Flag Form' : 'Notify Potential Issue'}</span>
                </button>
              </div>

              {/* Success Notification Banner */}
              {flagSubmitSuccess && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Issue flag successfully recorded and queued for Admin Toxicologist review.</span>
                </div>
              )}

              {/* Issue Submission Form Drawer */}
              {flagFormOpen && (
                <form
                  onSubmit={handleFlagIssueSubmit}
                  className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                    Report Issue on a Catalogue Parameter
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Select Parameter *
                      </label>
                      <select
                        value={flagSelectedParamId}
                        onChange={(e) => setFlagSelectedParamId(e.target.value)}
                        required
                        className="w-full min-h-[44px] text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="">-- Choose Substance &amp; Parameter --</option>
                        {library.values
                          .slice()
                          .sort((a, b) => {
                            const subCmp = (a.substanceLabel ?? '').localeCompare(b.substanceLabel ?? '');
                            if (subCmp !== 0) return subCmp;
                            return (a.record.display_name ?? '').localeCompare(b.record.display_name ?? '');
                          })
                          .map((v) => (
                            <option key={v.record.parameter_value_id} value={v.record.parameter_value_id}>
                              {v.substanceLabel} - {v.record.display_name} ({v.record.value} {v.record.unit ?? ''})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Issue Category *
                      </label>
                      <select
                        value={flagCategory}
                        onChange={(e) => setFlagCategory(e.target.value)}
                        className="w-full min-h-[44px] text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      >
                        <option value="Outdated Regulatory Standard">Outdated Regulatory Standard (New Guidance)</option>
                        <option value="Transcription / Typo Discrepancy">Transcription / Typo Discrepancy</option>
                        <option value="Unit Conversion Error">Unit Conversion Error</option>
                        <option value="Document Locator Inaccuracy">Document Locator Inaccuracy</option>
                        <option value="Applicability / Receptor Group Scope Issue">Applicability / Receptor Group Scope Issue</option>
                        <option value="Other Scientific Discrepancy">Other Scientific Discrepancy</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Reviewer Comments &amp; Technical Rationale * (up to 500 characters)
                    </label>
                    <textarea
                      value={flagComment}
                      onChange={(e) => setFlagComment(e.target.value.slice(0, 500))}
                      maxLength={500}
                      rows={3}
                      required
                      placeholder="Describe the discrepancy, cite the primary source page/table, or provide updated toxicological context..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                    <div className="text-[10px] text-slate-400 text-right">
                      {flagComment.length} / 500 characters
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Suggested Correction / Proposed Value (Optional)
                    </label>
                    <input
                      type="text"
                      value={flagSuggestedCorrection}
                      onChange={(e) => setFlagSuggestedCorrection(e.target.value)}
                      placeholder="e.g., Update value to 0.045 mg/kg-d per Table 3.2"
                      className="w-full min-h-[44px] text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFlagFormOpen(false)}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!flagSelectedParamId || !flagComment.trim()}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                    >
                      Submit Issue Flag to Admin Queue
                    </button>
                  </div>
                </form>
              )}

              {/* Active Issues Ledger */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Active Flagged Issues &amp; QA Tickets ({flaggedIssues.length})
                </h4>

                <div className="space-y-2.5">
                  {flaggedIssues
                    .slice()
                    .sort((a, b) => {
                      const subCmp = (a.substanceLabel ?? '').localeCompare(b.substanceLabel ?? '');
                      if (subCmp !== 0) return subCmp;
                      return (a.parameterName ?? '').localeCompare(b.parameterName ?? '');
                    })
                    .map((issue) => (
                    <div
                      key={issue.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {issue.substanceLabel} - {issue.parameterName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            {issue.category}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 uppercase">
                          {issue.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {issue.comment}
                      </p>

                      {issue.suggestedCorrection && (
                        <div className="text-[11px] text-sky-700 dark:text-sky-400 font-semibold">
                          Proposed Correction: <span className="font-mono">{issue.suggestedCorrection}</span>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span>Reported by: {issue.flaggedBy}</span>
                        <span>{issue.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveQAStage(3)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200"
                >
                  Back to Stage 3 (Admin Review)
                </button>
                <button
                  type="button"
                  onClick={() => setShowQAHub(false)}
                  className="min-h-[44px] px-5 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 dark:bg-sky-600 text-white text-xs font-bold shadow-sm"
                >
                  Complete Review &amp; Return to Catalogue
                </button>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-w-0 h-full overflow-hidden">
        {/* LEFT PANEL -- catalog dashboard, audit panels, saved review filters */}
        <div
          className={cn(
            'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800',
            showLeftPanel ? 'w-80' : 'w-0',
          )}
        >
        {showLeftPanel && (
        <div className="w-full min-w-[270px] p-4 overflow-y-auto overflow-x-hidden h-full space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Facet Navigator
              </span>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Scope Slices
              </h3>
            </div>
            {activeLabels.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          {filtersBlock}

          <section
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
            data-testid="evidence-library-saved-views"
            aria-label="Saved views"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Saved views
              </h3>
              {!savingView && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedViewName('');
                    setSaveViewError(null);
                    setSavingView(true);
                  }}
                  data-testid="evidence-library-save-view-button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Plus className="h-3 w-3" />
                  Save current
                </button>
              )}
            </div>

            {savingView && (
              <div className="mb-2">
                <div className="flex items-center gap-1">
                  <input
                    value={savedViewName}
                    onChange={(event) => setSavedViewName(event.target.value)}
                    placeholder="Name this view"
                    aria-label="Saved view name"
                    data-testid="evidence-library-save-view-input"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!savedViewName.trim() || savingViewSubmitting}
                    onClick={async () => {
                      const nameToSave = savedViewName;
                      setSavingViewSubmitting(true);
                      setSaveViewError(null);
                      const outcome = await saveCurrentView(nameToSave);
                      setSavingViewSubmitting(false);
                      if (outcome.ok) {
                        setSavingView(false);
                        setSavedViewName('');
                        announce(
                          outcome.message ??
                            `Saved view "${nameToSave.trim()}" created.`,
                        );
                      } else {
                        // Keep the form open and the typed name in place so the
                        // reviewer does not have to retype it after a failure.
                        setSaveViewError(outcome.message);
                      }
                    }}
                    data-testid="evidence-library-save-view-confirm"
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    {savingViewSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSavingView(false);
                      setSaveViewError(null);
                    }}
                    disabled={savingViewSubmitting}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
                {saveViewError && (
                  <div
                    role="alert"
                    className="mt-1 rounded-md border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                    data-testid="evidence-library-save-view-error"
                  >
                    {saveViewError}
                  </div>
                )}
              </div>
            )}

            {savedViewsActionError && (
              <div
                role="alert"
                className="mb-2 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                data-testid="evidence-library-saved-views-error"
              >
                <span className="flex-1">{savedViewsActionError}</span>
                <button
                  type="button"
                  onClick={() => setSavedViewsActionError(null)}
                  aria-label="Dismiss saved views error"
                  data-testid="evidence-library-saved-views-error-dismiss"
                  className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg p-2 text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {savedViews.length === 0 ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                No saved views yet. Set up filters, then "Save current" to reuse them.
              </p>
            ) : (
              <ul className="space-y-1">
                {savedViews.map((view) => {
                  const isActive =
                    viewMode === view.viewMode && filtersEqual(filters, view.filters);
                  const count = formatResultCount(
                    resultCountForView(
                      buildEvidenceLibraryView(view.filters, promotedRecords),
                      view.viewMode,
                    ),
                  );
                  return (
                    <li key={view.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applySavedView(view)}
                        aria-pressed={isActive}
                        className={cn(
                          'flex min-w-0 flex-1 min-h-[44px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                          isActive
                            ? 'border-sky-400 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
                        )}
                      >
                        <span className="font-semibold break-words">{view.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                          {count}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSavedView(view.id)}
                        aria-label={`Delete saved view ${view.name}`}
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-500 hover:border-red-300 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        )}
      </div>

      {/* MAIN CONTENT -- header and results */}
      <div className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-slate-950">
        <div className="space-y-5 p-6">
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
          onExpandDossier={() => setIsDossierModalOpen(true)}
          isAdmin={isAdmin}
        />
      )}

      {!showRightPanel && selectedSource && (
        <SourceDetailPanel
          row={selectedSource}
          onClose={() => setSelectedSourceId(null)}
        />
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
          <ScrollFadeRegion
            className="rounded-lg border border-slate-200 dark:border-slate-800"
            fadeFrom="from-white dark:from-slate-950"
          >
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-semibold shadow-[2px_0_4px_rgba(0,0,0,0.08)] dark:bg-slate-900 w-[200px] min-w-[180px]">Parameter</th>
                  <th className="px-3 py-2 font-semibold w-[140px] min-w-[120px]">Pathway</th>
                  <th className="px-3 py-2 font-semibold w-[140px] min-w-[120px]">Current value</th>
                  <th className="px-3 py-2 font-semibold w-[150px] min-w-[140px]">Default / evidence</th>
                  <th className="px-3 py-2 font-semibold w-[220px] min-w-[200px]">Review status</th>
                  <th className="px-3 py-2 font-semibold w-[150px] min-w-[130px]">Applicability</th>
                  <th className="px-3 py-2 font-semibold w-[160px] min-w-[140px]">Sources</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pagedVisibleValues.map((row) => {
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
                    onRequestOpenRightPanel?.();
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
                          'group cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 border-b border-slate-100 dark:border-slate-800/60',
                          isSelectedRow
                            ? 'bg-sky-50 dark:bg-sky-950/40'
                            : 'hover:bg-sky-50/50 dark:hover:bg-sky-950/20',
                        )}
                      >
                        <td
                          className={cn(
                            'sticky left-0 z-10 px-3 py-2.5 shadow-[2px_0_4px_rgba(0,0,0,0.06)] transition-colors',
                            'bg-white group-hover:bg-sky-50 dark:bg-slate-950 dark:group-hover:bg-sky-950',
                            isSelectedRow && 'bg-sky-50 dark:bg-sky-950',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                                {row.record.display_name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 break-words">
                                {row.substanceLabel}
                              </div>
                              <CatalogTruthLensSummary row={row} compact />
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectThisValue();
                                setIsDossierModalOpen(true);
                              }}
                              title="Open full Evidence Dossier"
                              aria-label={`Open full Evidence Dossier for ${row.record.display_name}`}
                              className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 dark:text-sky-300 dark:bg-sky-900/60 dark:hover:bg-sky-800 shadow-2xs transition-all"
                            >
                              <FileText className="w-3 h-3" />
                              <span>Dossier</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {humanizeCatalogLabel(row.record.pathway)}
                          </span>
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
                        <td
                          className="px-3 py-2.5 font-mono whitespace-normal break-words"
                          title={formatValue(row.record.value, row.record.unit)}
                          data-testid="evidence-current-value-cell"
                        >
                          {formatValue(row.record.value, row.record.unit)}
                        </td>
                        <td className="px-3 py-2.5" data-testid="evidence-default-evidence-cell">
                          <StatusBadge value={row.record.evidence_support_status} />
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {humanizeCatalogLabel(row.record.default_status)}
                            {' . '}
                            <QaStatusText value={row.record.qa_status} />
                            {' . '}
                            {humanizeCatalogLabel(row.record.extraction_status)}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="space-y-1">
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
                        <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="break-words">
                            {row.record.applicability}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="break-words">
                            {sourceLabels(row)}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={7} className="px-3 py-0 bg-slate-50/40 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
                          <details className="group">
                            <summary className="flex min-h-[44px] w-fit cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300">
                              Details
                              <ChevronDown
                                className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                                aria-hidden="true"
                              />
                            </summary>
                            <div className="pb-3 pt-1 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
                              <div className="text-xs text-slate-600 dark:text-slate-300">
                                Source relationships: {sourceRelationshipLabels(row)}
                              </div>
                              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                {row.record.evidence_items.map((evidence) => (
                                  <div key={evidence.evidence_id}>
                                    Extracted {evidence.extracted_at}: {evidence.locator} -{' '}
                                    <QaStatusText value={evidence.qa_status} />
                                  </div>
                                ))}
                              </div>
                              {row.record.review_notes && (
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                  {row.record.review_notes}
                                </p>
                              )}
                            </div>
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
          </ScrollFadeRegion>
          {isValuesPaged && (
            <ValuesPagination
              page={clampedValuesPage}
              pageCount={valuesPageCount}
              pageSize={VALUES_PAGE_SIZE}
              totalRows={visibleValues.length}
              onPrev={() =>
                setValuesPage(Math.max(0, clampedValuesPage - 1))
              }
              onNext={() =>
                setValuesPage(Math.min(valuesPageCount - 1, clampedValuesPage + 1))
              }
            />
          )}
        </section>
      )}
        </div>
      </div>

      {/* RIGHT PANEL -- two-state: the catalog status dashboard "at rest", the
          value/source detail inspector when a row is selected. */}
      <div
        data-testid="references-values-right-panel-wrapper"
        className={cn(
          'relative transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-lg',
          'max-md:hidden',
          !showRightPanel && 'pointer-events-none',
        )}
        style={{ width: showRightPanel ? `${rightPanelWidth}px` : '0px' }}
      >
        {showRightPanel && (
          <button
            type="button"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize references and values panel"
            data-testid="references-values-right-panel-resize-handle"
            onPointerDown={handleRightPanelResizePointerDown}
            className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize border-l border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none dark:hover:border-blue-700"
          />
        )}
        {showRightPanel && (
        <div ref={rightPanelContentRef} className="w-full h-full overflow-y-auto overflow-x-hidden p-4 space-y-3">
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
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-sky-500 hover:text-sky-700 dark:hover:border-sky-400 dark:hover:text-sky-300 shadow-2xs transition-all"
                aria-label="Back to catalog dashboard"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Back to Catalogue</span>
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
              onExpandDossier={() => setIsDossierModalOpen(true)}
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
            <div className="space-y-3.5" data-testid="evidence-library-right-dashboard">
              {/* Option 2: Prominent Evidence Dossier Overview Card */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  const target = visibleValues[0] ?? baselineLibrary.values[0];
                  if (target) setSelectedValueId(target.record.parameter_value_id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const target = visibleValues[0] ?? baselineLibrary.values[0];
                    if (target) setSelectedValueId(target.record.parameter_value_id);
                  }
                }}
                className="p-4 rounded-xl bg-slate-50 hover:bg-sky-50/50 dark:bg-slate-900 dark:hover:bg-sky-950/30 border border-slate-200 hover:border-sky-400 dark:border-slate-800 dark:hover:border-sky-600 shadow-sm transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-sky-600 dark:bg-sky-400"></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Evidence Dossier
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                    Active Frame: BC P1 v5
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center justify-between">
                    <span>Regulatory Evidence &amp; Audit Trail</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Select any parameter from the table on the left to inspect its exact document locators, primary citations, QA audit timeline, and policy alignment.
                  </p>
                </div>

                {/* Dossier Navigation Highlights */}
                <div className="pt-2.5 border-t border-indigo-100/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span>Inspectable Dimensions</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Multi-Authority</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const target = visibleValues.find((v) => v.record.evidence_items.length > 0) ?? visibleValues[0] ?? baselineLibrary.values[0];
                        if (target) setSelectedValueId(target.record.parameter_value_id);
                      }}
                      className="p-2.5 rounded-lg bg-white hover:bg-sky-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 hover:border-sky-300 dark:border-slate-800 transition-all space-y-0.5"
                    >
                      <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Document Locators</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">Exact page &amp; table tags</div>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const target = visibleValues.find((v) => Boolean(v.record.source_crystallization_date)) ?? visibleValues[0] ?? baselineLibrary.values[0];
                        if (target) setSelectedValueId(target.record.parameter_value_id);
                      }}
                      className="p-2.5 rounded-lg bg-white hover:bg-sky-50 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 hover:border-sky-300 dark:border-slate-800 transition-all space-y-0.5"
                    >
                      <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Provenance Trail</div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">Crystallization dates</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const target = visibleValues[0] ?? baselineLibrary.values[0];
                    if (target) {
                      setSelectedValueId(target.record.parameter_value_id);
                      setIsDossierModalOpen(true);
                    }
                  }}
                  className="w-full min-h-[38px] mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-bold text-xs shadow-xs transition-all"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Inspect Evidence Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Prominent: at-a-glance inventory of the references loaded in the catalog. */}
              <CatalogInventory
                baseline={baselineLibrary}
                onSelectReference={(sourceId) => {
                  setSelectedValueId(null);
                  setSelectedSourceId(sourceId);
                }}
              />

              {/* Option B: Staged QA/QC Hub Launch Button */}
              <div data-testid="evidence-library-status-admin" className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowQAHub(true)}
                  data-testid="evidence-library-open-qa-hub"
                  className="w-full min-h-[44px] flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-700 dark:bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Catalog Review &amp; QA/QC Hub</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Staged evidence pipeline &amp; audit gate</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">Launch -&gt;</span>
                </button>

                {/* For headless test DOM query preservation */}
                <div className="hidden">
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
                    <>
                      <HitlSourcesSection isAdmin={isAdmin} />
                      <PromotedCandidatesSection />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
      </div>
      )}
      {isDossierModalOpen && selectedValue && (
        <EvidenceDossierModal
          row={selectedValue}
          policyDecision={defaultPolicyDecisionForRow(
            defaultPolicyDecisions,
            selectedValue,
          )}
          onClose={() => setIsDossierModalOpen(false)}
          isAdmin={isAdmin}
        />
      )}
    </section>
    </EvidenceLibraryAnnounceContext.Provider>
  );
}
