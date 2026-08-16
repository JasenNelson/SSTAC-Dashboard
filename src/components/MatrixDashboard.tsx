'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Database, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import MatrixMapLoader from '@/app/(dashboard)/matrix-map/MatrixMapLoader';
import PartialVisibilityBanner from '@/app/(dashboard)/matrix-map/PartialVisibilityBanner';
import {
  EMPTY_MATRIX_MAP_DATA,
  EMPTY_MATRIX_SITE_AGGREGATE_DATA,
  type MatrixMapData,
  type MatrixSample,
  type MatrixSiteAggregateData,
} from '@/app/(dashboard)/matrix-map/types';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';
import BackgroundAdjustment, {
  type AdjustedStandardReport,
  type BackgroundAdjustmentPreliminaryStandard,
  type BackgroundUtlReport,
} from './matrix-options/BackgroundAdjustment';
import EcoDirectEqPCalculator from './matrix-options/EcoDirectEqPCalculator';
import EcoFoodBSAFCalculator from './matrix-options/EcoFoodBSAFCalculator';
import HHDirectContactCalculator from './matrix-options/HHDirectContactCalculator';
import HHFoodWebCalculator from './matrix-options/HHFoodWebCalculator';
import HHInhalationCalculator from './matrix-options/HHInhalationCalculator';
import CumulativeEffectsCalculator from './matrix-options/CumulativeEffectsCalculator';
import EvidenceLibrary from './matrix-options/EvidenceLibrary';
import SsdWorkbench from './matrix-options/SsdWorkbench';
import Phase2TasksSection from './matrix-options/Phase2TasksSection';
import CalculatorValueSearchPanel from './matrix-options/CalculatorValueSearchPanel';
import CategorySelector from './matrix-options/CategorySelector';
import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from './matrix-options/SharedGlobalInputs';
import CalculatorSummaryBar, {
  type SummaryBarSlot,
} from './matrix-options/CalculatorSummaryBar';
import type { StageState } from './matrix-options/CalculatorStage';
import { formatMagnitude } from '@/lib/matrix-options/formatMagnitude';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type {
  CalculatorReceipt,
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import { EQUATION_RECORDS } from '@/lib/matrix-options/provenance/catalog';
import {
  isMatrixCategory,
  type MatrixCategory,
} from './matrix-options/guide/content/types';
import {
  REGULATORY_FRAME_OPTIONS_IDS,
  DEFAULT_REGULATORY_FRAME,
  REGULATORY_FRAME_OPTIONS,
  coerceRegulatoryFrame,
  isRegulatoryFrame,
  type RegulatoryFrame,
} from './matrix-options/guide/content/jurisdictions';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import { demoteLeadingH1 } from '@/lib/matrix-options/demoteLeadingH1';
import DefaultPolicyCandidatesAction, {
  useDefaultPolicyCandidates,
  type CandidateReviewReceipt,
} from './matrix-options/DefaultPolicyCandidatesAction';
import { MatrixMapLeftPanel } from './matrix-options/MatrixMapLeftPanel';
import { MatrixMapRightPanel } from './matrix-options/MatrixMapRightPanel';
import { MatrixMapMobileFallback } from './matrix-options/MatrixMapMobileFallback';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH,
  MATRIX_MAP_LEFT_PANEL_MIN_WIDTH,
  MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH,
  MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH,
  clampMatrixMapPanelWidth,
  getMatrixMapPanelMaxWidth,
} from './matrix-map-panel-layout';

// Audience tier for the Calculator sidebar guide. The value is persisted
// with the rest of the lifted Calculator state so the chosen explanation
// depth survives tab changes and reloads.
type AudienceTier = 'general' | 'practitioner' | 'technical';
const ALL_AUDIENCE_TIERS: ReadonlyArray<AudienceTier> = [
  'general',
  'practitioner',
  'technical',
];
const DEFAULT_AUDIENCE_TIER: AudienceTier = 'general';
const GUIDE_TIER_LABELS: Record<AudienceTier, string> = {
  general: 'General',
  practitioner: 'Practitioner',
  technical: 'Technical',
};
const GUIDE_TIER_CONTENT: Record<
  AudienceTier,
  {
    title: string;
    summary: string;
    bullets: string[];
  }
> = {
  general: {
    title: 'What this calculator can tell you',
    summary:
      'Use this tab to compare screening-level sediment standards by pathway, substance, and regulatory frame.',
    bullets: [
      'All four pathways provide screening calculations today.',
      'Each pathway shows the assumptions behind the result.',
      'Background Adjustment compares the pathway result with reference-site background.',
    ],
  },
  practitioner: {
    title: 'Review workflow',
    summary:
      'Pick the pathway, confirm the shared substance and regulatory frame, then read the hero result before expanding the technical details.',
    bullets: [
      'Changing the substance refreshes defaults unless you typed your own value.',
      'If a measured sediment concentration is entered, read the PASS/FAIL pill as a screening signal.',
      'Use Background Adjustment after the pathway value, not as a replacement for it.',
    ],
  },
  technical: {
    title: 'Technical notes',
    summary:
      'Calculator outputs remain screening-only until the full methodology package and validation gates are complete.',
    bullets: [
      'Eco-Direct uses equilibrium partitioning (EqP) inputs.',
      'Eco-Food uses toxicity reference value (TRV) and biota-sediment accumulation factor (BSAF) inputs.',
      'Human Health Direct Contact combines incidental ingestion and dermal contact.',
      'Human Health Food Web derives a tissue target before back-calculating through BSAF.',
      'Background uses upper tolerance limit (UTL) calculations and one-half detection-limit substitution.',
    ],
  },
};

const LS_KEY_CATEGORY = 'matrix-options-active-category-v1';
const LS_KEY_TIER = 'matrix-options-guide-tier-v1';
const LS_KEY_SUBSTANCE = 'matrix-options-substance-v1';
// Legacy localStorage key name -- kept stable so existing user sessions retain
// their selected regulatory frame across the jurisdiction->regulatory-frame
// relabel. The stored value is a RegulatoryFrameId; only the key NAME is legacy.
const LS_KEY_JURISDICTION = 'matrix-options-jurisdiction-v1';
const MATRIX_ADMIN_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_MATRIX_ADMIN_CONTACT_EMAIL;
// Panel layout constants + clampMatrixMapPanelWidth imported from
// src/components/matrix-map-panel-layout.ts (unit-testable, shared by
// both resize handles and keyboard nudge handlers).
// MATRIX_MAP_RIGHT_PANEL_MAX_WIDTH (720) removed -- max is now viewport-derived.
// Left/right min constants also live in matrix-map-panel-layout.ts.
const CALCULATOR_PROVENANCE_PATHWAYS: Record<MatrixCategory, ProvenancePathway> = {
  'eco-direct': 'eco-direct-eqp',
  'eco-food': 'eco-food-bsaf',
  'hh-direct': 'human-health-direct',
  'hh-food': 'human-health-food',
};
const CALCULATOR_CATEGORY_LABELS: Record<MatrixCategory, string> = {
  'eco-direct': 'Ecological Direct Contact',
  'eco-food': 'Ecological Food Web',
  'hh-direct': 'Human Health Direct Contact',
  'hh-food': 'Human Health Food Web',
};

// Validate-on-load coercion per plan v5 Delta 1. SSR-safe (typeof window
// guard). On invalid / stale localStorage values: clear the entry so the
// next mount does not re-restore the bad value, then fall back to the
// default. Hydration runs in a mount-only useEffect to avoid Next.js
// SSR/CSR hydration mismatches; the flash from default -> restored is
// acceptable for this MVP audience scale (codex review notes accept this
// trade-off vs the complexity of useSyncExternalStore).

function restoreActiveCategory(): MatrixCategory {
  // All four MatrixCategory members are user-selectable in the v1.0
  // calculator surface; isMatrixCategory already validates against the
  // full union.
  if (typeof window === 'undefined') return 'eco-direct';
  const raw = window.localStorage.getItem(LS_KEY_CATEGORY);
  if (raw && isMatrixCategory(raw)) {
    return raw;
  }
  if (raw !== null) window.localStorage.removeItem(LS_KEY_CATEGORY);
  return 'eco-direct';
}

function restoreActiveTier(): AudienceTier {
  if (typeof window === 'undefined') return DEFAULT_AUDIENCE_TIER;
  const raw = window.localStorage.getItem(LS_KEY_TIER);
  if (raw && (ALL_AUDIENCE_TIERS as readonly string[]).includes(raw)) {
    return raw as AudienceTier;
  }
  if (raw !== null) window.localStorage.removeItem(LS_KEY_TIER);
  return DEFAULT_AUDIENCE_TIER;
}

function restoreSubstanceKey(): string {
  if (typeof window === 'undefined') return DEFAULT_SUBSTANCE_KEY;
  const raw = window.localStorage.getItem(LS_KEY_SUBSTANCE);
  if (raw && findSubstance(raw)) return raw;
  if (raw !== null) window.localStorage.removeItem(LS_KEY_SUBSTANCE);
  return DEFAULT_SUBSTANCE_KEY;
}

function restoreJurisdiction(): RegulatoryFrame {
  if (typeof window === 'undefined') return DEFAULT_REGULATORY_FRAME;
  const raw = window.localStorage.getItem(LS_KEY_JURISDICTION);
  const coerced = coerceRegulatoryFrame(raw);
  if (
    coerced &&
    isRegulatoryFrame(coerced) &&
    (REGULATORY_FRAME_OPTIONS_IDS as readonly string[]).includes(coerced)
  ) {
    return coerced;
  }
  if (raw !== null) window.localStorage.removeItem(LS_KEY_JURISDICTION);
  return DEFAULT_REGULATORY_FRAME;
}

interface MatrixDashboardProps {
  eqpCaseStudyContent: string;
  bsafCaseStudyContent: string;
  humanHealthContent: string;
  guideContent: string;
  finalDraftContent: string;
  /**
   * Server-fetched matrix-map RPC payload. Embedded in the 'Interactive Map'
   * tab (BN-RRM tab pattern, owner directive 2026-05-20). Replaces the
   * prior discoverability-card pattern that linked out to /matrix-map.
   * The /matrix-map standalone route still exists; the embed is the
   * primary entry point.
   *
   * Optional ONLY for backward compatibility with existing
   * MatrixDashboard.test.tsx unit tests that pre-date the embed refactor.
   * Production callsite (/matrix-options/page.tsx) always passes it.
   * When omitted, defaults to EMPTY_MATRIX_MAP_DATA so the embedded
   * MatrixMapLoader renders the loading state cleanly in test environments.
   */
  initialMapData?: MatrixMapData;
  /**
   * Optional inline notice surfaced inside the embedded map when the
   * server-side RPC fetch failed; pass-through to MatrixMapLoader.
   */
  fetchErrorMessage?: string | null;
  /** Option C aggregate markers. Separate from sample rows and sample export. */
  siteAggregateData?: MatrixSiteAggregateData;
  siteAggregateFetchErrorMessage?: string | null;
}

// 'Vision for Modernizing Schedule 3.4' (was 'Conceptual Model'): the view now
// states the project's own three-part vision for Schedule 3.4, sourced from the
// Phase 2 project plan, so the generic label no longer described it.
const TABS = ['The Guide', 'Vision for Modernizing Schedule 3.4', 'Jurisdictional Frameworks', 'TWG Review', 'Interactive Map', 'Calculator', 'SSD Workbench', 'References & Values'];
// Display labels for the top tabs. The internal tab IDENTIFIER strings in TABS
// are load-bearing (compared against activeTopTab in control flow throughout
// this file), so they MUST stay stable. Render the user-facing label via this
// lookup instead of renaming the identifier. Only entries that differ from the
// identifier need listing; unlisted tabs render their identifier verbatim.
const TAB_LABELS: Record<string, string> = {
  'Jurisdictional Frameworks': 'Methodology by pathway',
};
const JURISDICTIONAL_SIDE_TABS = ['Ecological: EqP & AVS', 'Ecological: Food Web (BSAF)', 'Human Health Pathways'];
// Maps each Jurisdictional Frameworks side-tab to the derivation equation pathway(s) shown
// in its Quick Reference drawer. The cross-cutting 'background-adjustment' equation is
// intentionally omitted here (it stays in the calculator's Background Adjustment panel).
const JURISDICTIONAL_SIDE_TAB_PATHWAYS: Record<string, ProvenancePathway[]> = {
  'Ecological: EqP & AVS': ['eco-direct-eqp'],
  'Ecological: Food Web (BSAF)': ['eco-food-bsaf'],
  'Human Health Pathways': ['human-health-direct', 'human-health-food'],
};

// A11y (A1/A2 fixes, 2026-08-14): id helpers for the two tab/tabpanel pairs
// in this file -- the primary 8-tab top nav and the Jurisdictional
// Frameworks side-tab list. Same roving-tabindex pattern as
// matrix-options/CategorySelector.tsx (the in-repo reference
// implementation); forked here rather than re-invented.
function slugifyTabId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

const PRIMARY_TABPANEL_ID = 'matrix-dashboard-tabpanel';

// Audit #16: the tabs whose markdown document has its leading `# ` demoted to `##` by
// demoteLeadingH1, and therefore the ONLY tabs that need a replacement level-1 heading when
// printed. Kept beside the call sites it mirrors so the two cannot drift apart silently.
const DEMOTED_DOCUMENT_TABS = new Set(['Jurisdictional Frameworks', 'The Guide']);
const JURISDICTIONAL_SIDE_TABPANEL_ID = 'matrix-jurisdictional-side-tabpanel';

function primaryTabId(tab: string): string {
  return `matrix-tab-${slugifyTabId(tab)}`;
}

function sideTabId(tab: string): string {
  return `matrix-side-tab-${slugifyTabId(tab)}`;
}

export default function MatrixDashboard({
  eqpCaseStudyContent,
  bsafCaseStudyContent,
  humanHealthContent,
  guideContent,
  finalDraftContent,
  initialMapData = EMPTY_MATRIX_MAP_DATA,
  fetchErrorMessage = null,
  siteAggregateData = EMPTY_MATRIX_SITE_AGGREGATE_DATA,
  siteAggregateFetchErrorMessage = null,
}: MatrixDashboardProps) {
  const router = useRouter();
  // bbox-lane Stage 2 (codex P1): MatrixMap refetches per-viewport, so a user can
  // select a marker that exists only in a viewport-fetch payload -- not in the
  // (capped) province-wide initialMapData. Keep a CUMULATIVE union of every sample
  // seen so MatrixMapLeftPanel always resolves selected samples for its
  // composition stats. The map still renders its own current-viewport set; this
  // union is only for sibling-panel selection resolution.
  const [knownSamples, setKnownSamples] = useState<MatrixSample[]>(
    initialMapData.visible_samples,
  );
  // Re-seed on a genuine server refresh (router.refresh delivers a new prop).
  useEffect(() => {
    setKnownSamples(initialMapData.visible_samples);
  }, [initialMapData]);
  const handleViewportData = useCallback((data: MatrixMapData) => {
    setKnownSamples((prev) => {
      const byId = new Map(prev.map((s) => [s.id, s]));
      for (const s of data.visible_samples) byId.set(s.id, s);
      return Array.from(byId.values());
    });
  }, []);
  const [activeTopTab, setActiveTopTab] = useState('The Guide');
  const [activeSideTab, setActiveSideTab] = useState('Ecological: EqP & AVS');
  // Both side panels open by default per owner UX preference 2026-05-19
  // (was: right panel hidden by default). Users can still toggle each
  // panel independently via the chrome buttons in the header.
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  // Calculator's reference rail is DERIVED from backgroundReferenceNeedsAttention
  // (see that flag's declaration below), never written by an effect -- an
  // effect-writer painted the rail open on the first Calculator frame and then
  // closed it, producing a visible flash on every entry. `null` = follow
  // Stage 3; a boolean = the user's explicit manual toggle. See the
  // override-clearing effect near backgroundReferenceNeedsAttention.
  const [calcRailOverride, setCalcRailOverride] = useState<boolean | null>(
    null,
  );
  // A11y fix (F1, 2026-08-14 adversarial review): the right rail wrapper
  // (calculator-reference-rail, shared by Calculator + Jurisdictional
  // Frameworks) goes `inert` whenever it closes, including the AUTOMATIC
  // close driven by backgroundReferenceNeedsAttention flipping to false. If
  // the user's focus was inside the rail when that happens (e.g. a Value
  // Search input), the browser drops focus to <body> with no announcement.
  // rightPanelFocusInsideRef is kept current by onFocus/onBlur handlers on
  // the wrapper div (see its JSX below), NOT by a render-driven effect --
  // ordinary focus changes (a plain `.focus()` call, or a user Tab/click)
  // never touch React state, so an effect keyed on re-renders would miss
  // them entirely.
  //
  // D2 fix (2026-08-15 adversarial review): the ref used to be cleared
  // "only when relatedTarget is a real element outside the wrapper", on the
  // theory that a null relatedTarget only ever happens from the browser's
  // own inert-triggered blur. That theory is false -- EVERY blur to a
  // non-focusable target (a tap on a paragraph, or the iOS soft keyboard
  // being dismissed) also reports relatedTarget === null, and those are
  // ordinary "user left the rail" events, not the closing blur. Inferring
  // cause from relatedTarget alone cannot tell the two apart, so a user who
  // taps blank space to dismiss the keyboard kept the flag set, and a later
  // unrelated auto-close then yanked focus to the toggle button and scrolled
  // the page back to the header -- away from whatever field the user had
  // moved on to.
  //
  // The explicit signal that actually distinguishes them: the wrapper's own
  // `inert` DOM property. E3 fix (third adversarial round, 2026-08-15): the
  // prior version of this comment claimed the browser applies `inert` and
  // unfocuses the wrapper "synchronously, as part of the same commit" that
  // closes the rail. MEASURED across chromium, firefox and webkit: that is
  // false -- the inert-triggered focusout fires ASYNCHRONOUSLY, in a later
  // task, in every engine tested; nothing about it is synchronous. The
  // conclusion this relies on is still correct, and was verified in all
  // three engines: whenever that focusout does eventually arrive,
  // `event.currentTarget.inert` already reads true, because `inert` was set
  // on the wrapper before the focusout task ran. So checking `inert` still
  // needs no relatedTarget inference: only clear the ref when the wrapper is
  // NOT inert (a genuine "user left" event); when it IS inert, leave the ref
  // untouched so the closing effect below still knows focus was inside right
  // up to the close.
  //
  // See E1 below (the rescue effect) for a second, independent gap this
  // onBlur/onFocus tracking cannot close on its own: on firefox and webkit,
  // removing the focused element from the DOM (rather than blurring it)
  // fires no focusout at all, so this handler never runs and the ref can go
  // stale. The rescue effect reconciles against document.activeElement to
  // cover that case; this handler is unchanged.
  //
  // (A queueMicrotask-based document.activeElement re-check was considered
  // and rejected: by the time a queued microtask runs, the rescue effect
  // below has not yet fired -- passive effects are scheduled on a later
  // macrotask -- but the microtask itself would ALSO observe focus already
  // moved off the wrapper for the legitimate inert-close case, clearing the
  // ref before the rescue effect ever reads it and silently defeating F1.
  // The `inert` property check has no such race in the SYNCHRONOUS-handler
  // sense: whichever task the focusout runs in, `inert` already reads true
  // by the time that handler runs, so it never needs to race a microtask.)
  const rightPanelWrapperRef = useRef<HTMLDivElement | null>(null);
  const rightPanelToggleRef = useRef<HTMLButtonElement | null>(null);
  const rightPanelFocusInsideRef = useRef(false);
  const [matrixMapLeftPanelWidth, setMatrixMapLeftPanelWidth] = useState(
    MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH,
  );
  const [matrixMapRightPanelWidth, setMatrixMapRightPanelWidth] = useState(
    MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH,
  );
  const [matrixMapWorkbenchFocused, setMatrixMapWorkbenchFocused] = useState(false);
  // useRef mirrors keep the resize listener from re-subscribing on every
  // width change. We compute nextLeft locally when re-clamping both panels
  // so left + right <= viewport - 48px (MATRIX_MAP_MIN_MAP_WIDTH) holds in a
  // single recompute without waiting for the ref to update post-render.
  const leftWidthRef = useRef(MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH);
  const rightWidthRef = useRef(MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH);
  // A11y (A1/A2): roving-tabindex focus targets for the two tab lists in
  // this file, keyed by tab label. Same pattern as CategorySelector's
  // buttonRefs.
  const primaryTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sideTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // P3-1 (a11y audit 2026-08-14): manual-activation roving-tabindex focus
  // target for the primary 8-tab top nav, tracked separately from
  // activeTopTab. See handlePrimaryTabKeyDown below for why this tablist
  // uses manual (not automatic) activation.
  const [focusedPrimaryTab, setFocusedPrimaryTab] = useState(TABS[0]);
  // Interactivity marker for the primary tablist (2026-08-14 a11y e2e).
  // /matrix-options paints its full SSR markup -- including every tab button
  // with correct role/ARIA/tabindex -- before React has client-rendered this
  // component. Inside that window the buttons are inert DOM: no onKeyDown, no
  // onClick. Worse, the client render REPLACES those nodes rather than
  // hydrating them in place (measured 2026-08-14: the SSR node identity does
  // not survive, and DOM focus is dropped to <body> when it happens), so a
  // real-browser test that focuses a tab and presses a key during that window
  // silently no-ops against a doomed node. Waiting on any SSR-present element
  // (a heading, the tablist itself) cannot detect this. This flag is set in a
  // mount-only effect, so the data attribute below can only ever appear on the
  // live, handler-bearing render -- making it a deterministic "the tablist is
  // interactive now" gate for e2e (see gotoMatrixOptionsOrSkip in
  // e2e/matrix-options.spec.ts).
  const [primaryTablistReady, setPrimaryTablistReady] = useState(false);
  useEffect(() => {
    setPrimaryTablistReady(true);
  }, []);
  // ARIA ranges for the resize separators. aria-valuemax depends on
  // window.innerWidth, which differs between SSR and the client; computing
  // it at render time would ship an invalid SSR range (valuemax below
  // valuenow) and a hydration mismatch. Initialize hydration-stable
  // (max == the default width, so valuenow <= valuemax on the server and
  // the first client render) and compute the real viewport-derived max in
  // the post-mount effect below + the window resize handler.
  const [leftPanelAriaMax, setLeftPanelAriaMax] = useState(
    MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH,
  );
  const [rightPanelAriaMax, setRightPanelAriaMax] = useState(
    MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH,
  );

  // PR-MAP-17a mobile fallback: when the viewport is narrower than
  // 768 px (docs/design/matrix-map/PLAN_V3_4_2.md section 3.8), the
  // Interactive Map tab renders MatrixMapMobileFallback instead of the
  // 3-column desktop layout. Other tabs are unaffected.
  const isMobile = useIsMobile();

  // Lifted Calculator-tab state (plan v3 section 4.3 + v5 Delta 1).
  // Initial values are the SSR-safe defaults; the mount-only hydrate
  // effect below restores any valid persisted values from localStorage.
  const [activeCategory, setActiveCategory] =
    useState<MatrixCategory>('eco-direct');
  const [activeTier, setActiveTier] = useState<AudienceTier>(
    DEFAULT_AUDIENCE_TIER,
  );
  const [substanceKey, setSubstanceKey] = useState<string>(
    DEFAULT_SUBSTANCE_KEY,
  );
  const [jurisdiction, setJurisdiction] = useState<RegulatoryFrame>(
    DEFAULT_REGULATORY_FRAME,
  );
  const [evidenceLibraryFilters, setEvidenceLibraryFilters] =
    useState<EvidenceLibraryFilters>(() => createEvidenceLibraryFilters());
  const [calculatorReceipt, setCalculatorReceipt] = useState<CalculatorReceipt | null>(null);
  // Calculator summary bar (step 3 of the redesign): the HH Direct Contact
  // calculator is the only pathway currently wrapped in numbered stages, so
  // this is the only preliminary-standard value the summary bar can show
  // today. Background UTL 95/95 and the adjusted standard stay PENDING
  // until step 4 wires BackgroundAdjustment into the stage sequence.
  // Each of the five *Preliminary states below carries `state` (a StageState, per DESIGN.md's
  // "Four states, not two": COMPUTED / PENDING / WAITING / BLOCKED) alongside `value`, mirroring
  // each calculator's own onPreliminaryStandardChange contract. The outer `| null` here means
  // only "this calculator has not mounted / reported yet" (the transient pre-effect state);
  // once mounted, the calculator always reports a full object, including its own PENDING /
  // WAITING / BLOCKED state -- never a bare null -- so the summary bar below can read
  // `?.state ?? 'pending'` and get the real reason, not an inferred guess from value presence.
  const [hhDirectPreliminary, setHhDirectPreliminary] = useState<{
    value: number | null;
    unit: string;
    driver?: string;
    state: StageState;
  } | null>(null);
  // Step 3b: the same wiring extended to the four sibling calculators wrapped in stages.
  // eco-direct and eco-food have no MIN-selected "driver" concept (single-pathway result), so
  // their reported shape carries an optional `note` instead of a required `driver`.
  const [ecoDirectPreliminary, setEcoDirectPreliminary] = useState<{
    value: number | null;
    unit: string;
    note?: string;
    state: StageState;
  } | null>(null);
  const [ecoFoodPreliminary, setEcoFoodPreliminary] = useState<{
    value: number | null;
    unit: string;
    note?: string;
    state: StageState;
  } | null>(null);
  const [hhFoodPreliminary, setHhFoodPreliminary] = useState<{
    value: number | null;
    unit: string;
    driver?: string;
    state: StageState;
  } | null>(null);
  // Human Health Inhalation is orthogonal to the activeCategory CategorySelector (see the
  // "Human Health Inhalation" stacking comment near its render call below) -- it renders
  // unconditionally regardless of which of the four eco/hh categories is active. The summary
  // bar's single "preliminary standard" slot is scoped to calculatorCategoryLabel (the ACTIVE
  // category), so merging inhalation's value into that slot would misrepresent it as belonging
  // to whichever category happens to be selected. Its preliminary value is still captured here
  // (same reporting contract as the other four) for a future inhalation-specific display; it is
  // deliberately NOT read by preliminarySlot below. Only the setter is used today (no display
  // reads the captured value yet), so the value half is intentionally left undestructured.
  const [, setHhInhalationPreliminary] = useState<{
    value: number | null;
    unit: string;
    driver?: string;
    state: StageState;
  } | null>(null);
  // Step 4 of the redesign: BackgroundAdjustment now reports its Stage 3
  // (UTL) and Stage 4 (adjusted standard = max(preliminary, UTL)) results
  // upward via callback, same pattern as onPreliminaryStandardChange above.
  // Neither state here recomputes anything -- both are plain reads of
  // BackgroundAdjustment's own already-memoized values.
  const [backgroundUtlReport, setBackgroundUtlReport] =
    useState<BackgroundUtlReport | null>(null);
  const [adjustedStandardReport, setAdjustedStandardReport] =
    useState<AdjustedStandardReport | null>(null);

  // Hydrate from localStorage on mount (client-only). Each restore* helper
  // validates the stored value against the current allowlist and clears
  // stale entries. activeTier renders the Calculator sidebar guide. The
  // useState setters have stable identities per React contract so an
  // empty deps array is correct here (no eslint-disable needed).
  useEffect(() => {
    setActiveCategory(restoreActiveCategory());
    setActiveTier(restoreActiveTier());
    setSubstanceKey(restoreSubstanceKey());
    setJurisdiction(restoreJurisdiction());
  }, []);

  // Persist each piece of lifted state on change. Guarded by typeof
  // window for SSR safety.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY_CATEGORY, activeCategory);
    }
  }, [activeCategory]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY_TIER, activeTier);
    }
  }, [activeTier]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY_SUBSTANCE, substanceKey);
    }
  }, [substanceKey]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LS_KEY_JURISDICTION, jurisdiction);
    }
  }, [jurisdiction]);

  const isToolMode = activeTopTab === 'Calculator' || activeTopTab === 'Jurisdictional Frameworks';
  const isReviewMode = activeTopTab === 'TWG Review';
  const isEvidenceLibraryMode = activeTopTab === 'References & Values';
  const isSsdWorkbenchMode = activeTopTab === 'SSD Workbench';
  // 2026-05-20 embed refactor: the Interactive Map tab renders the live
  // matrix-map full-bleed (mirrors BN-RRM MapView tab pattern). Distinct
  // from isToolMode because the matrix-map has its own internal floating
  // chrome (legend / tool palette / count card) and does NOT use the
  // dashboard-level left-sidebar / right-drawer until PR-MAP-4 + PR-MAP-5
  // populate Selection Stats + MeasurementWorkbench.
  const isMapMode = activeTopTab === 'Interactive Map';
  // Step-2 shell restructure: gates the new top-of-tab pathway-switch band
  // and the Bathymetric --db-* token styling on the shared left-sidebar /
  // main-content / right-drawer wrapper elements. Scoped tightly to the
  // Calculator tab only (isToolMode also covers Jurisdictional Frameworks,
  // which must render exactly as before).
  const isCalculatorMode = activeTopTab === 'Calculator';
  // print:hidden on the entire left sidebar column when the Calculator tab
  // is active, per plan v3 section 4.2 + section 10. The sidebar stays
  // visible on print for the Jurisdictional Frameworks tab (where the
  // jurisdiction selector is the user's anchor) and for non-tool modes.
  const hideSidebarOnPrint =
    isToolMode && activeTopTab === 'Calculator';
  const handleRefreshMapData = useCallback(() => {
    router.refresh();
  }, [router]);
  const handleOpenEvidenceLibrary = useCallback(
    (request: EvidenceLibraryFilterRequest, receipt?: CalculatorReceipt) => {
      setEvidenceLibraryFilters(createEvidenceLibraryFilters(request));
      setCalculatorReceipt(receipt ?? null);
      setActiveTopTab('References & Values');
    },
    [],
  );
  const handleEvidenceLibraryFiltersChange = useCallback(
    (nextFilters: EvidenceLibraryFilters) => {
      setEvidenceLibraryFilters(nextFilters);
      setCalculatorReceipt(null);
    },
    [],
  );
  const handleDismissReceipt = useCallback(() => {
    setCalculatorReceipt(null);
  }, []);
  // Left separator is on the panel's RIGHT edge. Dragging right widens the
  // left panel; dragging left narrows it.
  // delta = clientX - startX (positive = moving right = wider left panel).
  const handleLeftPanelResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = leftWidthRef.current;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + (moveEvent.clientX - startX);
        const clamped = clampMatrixMapPanelWidth(
          'left',
          nextWidth,
          showRightPanel ? rightWidthRef.current : 0,
        );
        leftWidthRef.current = clamped;
        setMatrixMapLeftPanelWidth(clamped);
      };
      const onDragEnd = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onDragEnd);
        window.removeEventListener('pointercancel', onDragEnd);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onDragEnd);
      window.addEventListener('pointercancel', onDragEnd);
    },
    [showRightPanel],
  );

  // Right separator is on the panel's LEFT edge. Dragging left widens the
  // right panel; dragging right narrows it.
  // delta = startX - clientX (positive = moving left = wider right panel).
  const handleRightPanelResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = rightWidthRef.current;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + (startX - moveEvent.clientX);
        const clamped = clampMatrixMapPanelWidth(
          'right',
          nextWidth,
          showLeftPanel ? leftWidthRef.current : 0,
        );
        rightWidthRef.current = clamped;
        setMatrixMapRightPanelWidth(clamped);
      };
      const onDragEnd = () => {
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onDragEnd);
        window.removeEventListener('pointercancel', onDragEnd);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onDragEnd);
      window.addEventListener('pointercancel', onDragEnd);
    },
    [showLeftPanel],
  );

  // Re-clamp both widths when either panel is toggled. Compute nextLeft
  // first as a local value so right can be clamped against it in the same
  // recompute (left + right <= viewport - 48 invariant holds within a
  // single setState batch). Widths are read from the refs (kept in sync at
  // every width write) rather than inside setState updaters -- updaters
  // must stay pure (StrictMode double-invokes them); this mirrors the
  // resize handler's ref-read pattern below.
  useEffect(() => {
    const nextLeft = clampMatrixMapPanelWidth(
      'left',
      leftWidthRef.current,
      showRightPanel ? rightWidthRef.current : 0,
    );
    leftWidthRef.current = nextLeft;
    setMatrixMapLeftPanelWidth(nextLeft);

    const nextRight = clampMatrixMapPanelWidth(
      'right',
      rightWidthRef.current,
      showLeftPanel ? nextLeft : 0,
    );
    rightWidthRef.current = nextRight;
    setMatrixMapRightPanelWidth(nextRight);
  }, [showLeftPanel, showRightPanel]);

  // Post-mount (and on any width/toggle change): recompute the separators'
  // viewport-derived aria-valuemax. Runs only on the client, so the SSR
  // markup keeps the hydration-stable defaults.
  useEffect(() => {
    setLeftPanelAriaMax(
      getMatrixMapPanelMaxWidth(
        'left',
        showRightPanel ? matrixMapRightPanelWidth : 0,
      ),
    );
    setRightPanelAriaMax(
      getMatrixMapPanelMaxWidth(
        'right',
        showLeftPanel ? matrixMapLeftPanelWidth : 0,
      ),
    );
  }, [
    matrixMapLeftPanelWidth,
    matrixMapRightPanelWidth,
    showLeftPanel,
    showRightPanel,
  ]);

  useEffect(() => {
    if (!showRightPanel) setMatrixMapWorkbenchFocused(false);
  }, [showRightPanel]);

  // Keep the primary tablist's roving-tabindex focus target in sync when
  // activeTopTab changes by any means other than an explicit arrow-key
  // focus move (click activation, or a programmatic jump such as
  // handleOpenEvidenceLibrary switching to 'References & Values'), so the
  // next Tab-into-the-tablist lands on the now-active tab.
  useEffect(() => {
    setFocusedPrimaryTab(activeTopTab);
  }, [activeTopTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      // Re-clamp both panels on viewport resize using ref values to avoid
      // stale closure over the in-render state. Left first, then right
      // against fresh left.
      const nextLeft = clampMatrixMapPanelWidth(
        'left',
        leftWidthRef.current,
        showRightPanel ? rightWidthRef.current : 0,
      );
      leftWidthRef.current = nextLeft;
      setMatrixMapLeftPanelWidth(nextLeft);

      const nextRight = clampMatrixMapPanelWidth(
        'right',
        rightWidthRef.current,
        showLeftPanel ? nextLeft : 0,
      );
      rightWidthRef.current = nextRight;
      setMatrixMapRightPanelWidth(nextRight);

      // The viewport-derived aria-valuemax can change even when both
      // widths stay in bounds (no width state change), so recompute it
      // here too -- the width-keyed effect above would not fire.
      setLeftPanelAriaMax(
        getMatrixMapPanelMaxWidth('left', showRightPanel ? nextRight : 0),
      );
      setRightPanelAriaMax(
        getMatrixMapPanelMaxWidth('right', showLeftPanel ? nextLeft : 0),
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  // showLeftPanel + showRightPanel are stable booleans; the listener reads
  // them via closure and is re-registered when they change.
  }, [showLeftPanel, showRightPanel]);

  const selectedSubstance = findSubstance(substanceKey);
  const selectedJurisdiction = REGULATORY_FRAME_OPTIONS.find(
    (option) => option.id === jurisdiction,
  );
  const calculatorPathway = CALCULATOR_PROVENANCE_PATHWAYS[activeCategory];
  const calculatorCategoryLabel = CALCULATOR_CATEGORY_LABELS[activeCategory];
  // Audit P1: the "Review candidate defaults" receipt timestamp. It lives here, not in
  // CalculatorValueSearchPanel, because the action now renders in the calculator body AND in
  // the Stage-3 rail; one owner means the two receipts can never disagree.
  const [candidateReview, setCandidateReview] = useState<CandidateReviewReceipt | null>(null);
  const calculatorCandidateInputKeys = useDefaultPolicyCandidates({
    pathway: calculatorPathway,
    substanceKey,
    regulatoryFrameId: jurisdiction,
    // Only the Calculator branch reads this, and deriving it costs a full
    // buildEvidenceLibraryView pass (~1783 records, ~40ms). Do not pay it on the
    // Interactive Map, the Guide, or during SSR.
    enabled: activeTopTab === 'Calculator',
  });
  // Summary bar slots (step 3 of the redesign, DESIGN.md "sticky summary
  // bar ... carries the preliminary, the UTL, and the adjusted standard").
  // Step 3b: all four activeCategory pathways (hh-direct, eco-direct, eco-food, hh-food) are
  // now wired to a real stage sequence. The UTL / adjusted slots for every pathway correctly
  // read PENDING until the corresponding wiring step lands -- PENDING is the honest "not
  // entered yet, no error" state here, not an error.
  // P1-1 fix: no explicit formatValue here -- CalculatorSummaryBar's default
  // (formatMagnitude) is magnitude-aware and never renders a real sub-5e-5
  // standard as "0.0000" the way the previous ad hoc toPrecision(4)/
  // toFixed(4) overrides risked when mixed across slots. See
  // src/lib/matrix-options/formatMagnitude.ts.
  // Fix (state-machine defect, 2026-08-14 external review): state is read directly from each
  // calculator's own report (`?.state`), NOT inferred from whether `value` is null. A calculator
  // reports null value for THREE distinct reasons -- Stage 1 blocked upstream (state 'waiting'),
  // a Stage-2-only invalid/blocked input (state 'blocked'), or genuinely nothing entered yet
  // (state 'pending') -- and inferring "value present -> computed, else pending" (the prior code)
  // collapsed all three into PENDING, telling a user with a real upstream error that nothing had
  // been entered. `?? 'pending'` only covers the transient window before the calculator's first
  // report effect has run (local state still null), which IS genuinely "nothing yet" -- not a
  // loss of a real state the calculator already computed.
  const preliminarySlot: SummaryBarSlot =
    activeCategory === 'hh-direct'
      ? {
          label: 'Preliminary standard',
          value: hhDirectPreliminary?.value ?? null,
          unit: hhDirectPreliminary?.unit ?? 'mg/kg dry',
          state: hhDirectPreliminary?.state ?? 'pending',
          note:
            hhDirectPreliminary?.state === 'computed' && hhDirectPreliminary.driver
              ? `Driver: ${hhDirectPreliminary.driver}.`
              : undefined,
        }
      : activeCategory === 'eco-direct'
        ? {
            label: 'Preliminary standard',
            value: ecoDirectPreliminary?.value ?? null,
            unit: ecoDirectPreliminary?.unit ?? 'mg/kg dry',
            state: ecoDirectPreliminary?.state ?? 'pending',
            note: ecoDirectPreliminary?.note,
          }
        : activeCategory === 'eco-food'
          ? {
              label: 'Preliminary standard',
              value: ecoFoodPreliminary?.value ?? null,
              unit: ecoFoodPreliminary?.unit ?? 'mg/kg dry',
              state: ecoFoodPreliminary?.state ?? 'pending',
              note: ecoFoodPreliminary?.note,
            }
          : activeCategory === 'hh-food'
            ? {
                label: 'Preliminary standard',
                value: hhFoodPreliminary?.value ?? null,
                unit: hhFoodPreliminary?.unit ?? 'mg/kg dry',
                state: hhFoodPreliminary?.state ?? 'pending',
                note:
                  hhFoodPreliminary?.state === 'computed' && hhFoodPreliminary.driver
                    ? `Driver: ${hhFoodPreliminary.driver}.`
                    : undefined,
              }
              : {
                  label: 'Preliminary standard',
                  value: null,
                  unit: 'mg/kg dry',
                  state: 'pending',
                  note: 'Not yet wired into the staged summary for this pathway.',
                };
  // Step 4: the preliminary standard for whichever pathway is active is the
  // OTHER operand BackgroundAdjustment's Stage 4 needs for max(preliminary,
  // UTL). Built from the same preliminarySlot computed above -- no new value,
  // just relabeled for BackgroundAdjustment's prop shape.
  const preliminaryStandardForBackground: BackgroundAdjustmentPreliminaryStandard = {
    value: preliminarySlot.value,
    unit: preliminarySlot.unit,
    state: preliminarySlot.state,
    label: `Preliminary standard (${calculatorCategoryLabel})`,
  };
  // Background UTL 95/95 (Stage 3) is mathematically independent of the
  // preliminary standard (DESIGN.md), so its state/value come straight from
  // BackgroundAdjustment's own onUtlChange report, never gated on
  // preliminarySlot.
  // Unit string reconciled with the preliminary/adjusted slots (P2-1): the
  // UTL slot used to show a bare "mg/kg" default while the other two slots
  // default to "mg/kg dry" for the same physical quantity. BackgroundAdjustment
  // itself now reports 'mg/kg dry' via onUtlChange; this fallback (used only
  // before that report arrives) matches it.
  const utlSlot: SummaryBarSlot = {
    label: 'Background UTL 95/95',
    value: backgroundUtlReport?.value ?? null,
    unit: backgroundUtlReport?.unit ?? 'mg/kg dry',
    state: backgroundUtlReport?.state ?? 'pending',
    note: backgroundUtlReport
      ? `${backgroundUtlReport.scope === 'provincial' ? 'Provincial' : 'Regional'} scope, n = ${backgroundUtlReport.n}. Screening-only K.`
      : 'Computed from reference samples only -- see Stage 3.',
  };
  // Fix 3 (P2, third adversarial round, 2026-08-14): explicit shared state
  // for the "exactly one current stage" invariant across the two components
  // that make up the 4-stage chain (the active pathway calculator for
  // Stages 1-2, BackgroundAdjustment for Stages 3-4). Neither component can
  // see the other's internals, so this parent -- the only place that
  // already reads BOTH preliminarySlot.state (Stage 2's output) and
  // utlSlot.state (Stage 3's output, via backgroundUtlReport) -- is where
  // the arbitration has to happen. True exactly when Stage 2 has already
  // produced a preliminary standard AND Stage 3 has not yet computed the
  // background UTL: at that point Stage 3, not Stage 2, is the single next
  // actionable step, so the active pathway calculator's Stage 2 defers its
  // own `current` flag to BackgroundAdjustment's Stage 3 (whose `current`
  // now separately checks the mirror-image condition -- see
  // BackgroundAdjustment.tsx). Passed to whichever of the 4 pathway
  // calculators is active; HHInhalationCalculator and
  // CumulativeEffectsCalculator are excluded because neither renders
  // numbered stages (see the assembled-page test asserting exactly that).
  const backgroundReferenceNeedsAttention =
    preliminarySlot.state === 'computed' && utlSlot.state !== 'computed';
  // P3-1 fix (2026-08-14 adversarial review): toggleRightPanel used to live
  // above this declaration and read a ref (backgroundReferenceRef) synced
  // in-render on every pass purely to dodge a hook-reorder. Defining the
  // callback HERE instead -- after backgroundReferenceNeedsAttention already
  // exists -- lets it close over the value directly; no ref, no in-render
  // side-write. Hook order stays stable across renders (this useCallback call
  // itself is unconditional, same as it was above), so this move does not
  // violate the rules of hooks.
  const toggleRightPanel = useCallback(() => {
    if (isCalculatorMode) {
      setCalcRailOverride(
        (current) => !(current ?? backgroundReferenceNeedsAttention),
      );
      return;
    }
    setShowRightPanel((current) => {
      if (current) setMatrixMapWorkbenchFocused(false);
      return !current;
    });
  }, [isCalculatorMode, backgroundReferenceNeedsAttention]);
  // Owner 2026-08-14: "reference only shown when working in stage 3". The flag
  // above already means exactly "Stage 3 is the actionable step", so the
  // Calculator reference rail follows it -- as a DERIVED value, not an
  // effect-driven write. See calculatorRailOpen / effectiveShowRightPanel
  // below: deriving means the first Calculator frame already paints the
  // correct state, instead of painting open and then closing on the next
  // effect pass (the flash the prior effect-writer produced).
  //
  // Deliberately NOT a hard lock: calcRailOverride lets the header toggle
  // still work, and a manual choice survives until the stage genuinely
  // changes OR the pathway is switched (a pathway switch is a CONTEXT change,
  // not a parameter change -- the new pathway's rail is a fresh derivation).
  // A user who opens the rail early to read the K-factor table is not fought
  // by an effect on every render.
  //
  // P3-2 fix (2026-08-14 adversarial review): isCalculatorMode is now also a
  // dep. Without it, a manual override set while ON the Calculator tab
  // survived a round trip through another top tab and back -- leaving the
  // rail's derivation frozen from before the visit, even though re-entering
  // the Calculator tab is exactly the kind of "context change" this effect
  // already treats a pathway switch as. Keying on isCalculatorMode clears the
  // override on EVERY tab transition into or out of Calculator, so
  // re-entering always restores stage-following.
  useEffect(() => {
    setCalcRailOverride(null);
  }, [backgroundReferenceNeedsAttention, activeCategory, isCalculatorMode]);
  const calculatorRailOpen = calcRailOverride ?? backgroundReferenceNeedsAttention;
  const effectiveShowRightPanel = isCalculatorMode
    ? calculatorRailOpen
    : showRightPanel;
  // F1 fix, part 2: on the transition from open -> closed, if focus was
  // inside the rail, move it to the rail's own toggle button -- the control
  // that can bring the rail back, and an announced, sensible landing spot.
  // Never fires when focus was NOT inside the rail (manual toggle by a user
  // whose focus is elsewhere, or an auto-close nobody was reading).
  const prevEffectiveShowRightPanelRef = useRef(effectiveShowRightPanel);
  useEffect(() => {
    const wasOpen = prevEffectiveShowRightPanelRef.current;
    prevEffectiveShowRightPanelRef.current = effectiveShowRightPanel;
    // E1 fix (third adversarial round, 2026-08-15): the flag alone is not
    // trustworthy. It is maintained only by onFocus/onBlur on the wrapper,
    // and a focusout is not guaranteed to fire when the focused element is
    // removed from the DOM out from under it -- MEASURED across engines:
    // chromium fires focusout on element removal (activeElement -> body);
    // firefox and webkit do NOT fire it (activeElement also ends up at
    // body, but silently, with no onBlur call to clear the ref). That is
    // reachable here: CalculatorValueSearchPanel's "Clear value search" X
    // button unmounts itself on click while holding focus. On
    // firefox/webkit the ref then stays stuck true, and a later, unrelated
    // auto-close would wrongly steal focus from whatever the user moved on
    // to next.
    //
    // Reconcile the flag against document.activeElement at the point of
    // use rather than trusting it blindly: only rescue when the flag says
    // focus was inside AND activeElement is either genuinely orphaned
    // (reset to body, the state left behind by both the tracked-blur path
    // and the untracked DOM-removal path) or still physically inside the
    // wrapper (defensive; covers a focus that never blurred at all). A
    // pure activeElement check without the flag was rejected: whether the
    // passive effect below runs before or after the browser's own
    // deferred focus fixup after an inert-close is not established, so the
    // flag remains the primary signal and activeElement is the
    // reconciliation, not a replacement.
    if (
      wasOpen &&
      !effectiveShowRightPanel &&
      rightPanelFocusInsideRef.current &&
      (document.activeElement === document.body ||
        rightPanelWrapperRef.current?.contains(document.activeElement))
    ) {
      rightPanelFocusInsideRef.current = false;
      // preventScroll: true is deliberate. The toggle lives in the header
      // chrome, so there is nothing to gain by scrolling to it, and this
      // rescue can fire while the page is scrolled far down a stacked phone
      // layout (~11,000px tall on some routes). Without preventScroll,
      // WebKit's focus() call scrolls the whole page back up to the header
      // -- a jarring jump, not a correctness defect (nothing is stolen and
      // no value is hidden; focus was genuinely orphaned), but avoidable.
      rightPanelToggleRef.current?.focus({ preventScroll: true });
    }
  }, [effectiveShowRightPanel]);
  // Adjusted standard (Stage 4) = max(preliminary, UTL), reported by
  // BackgroundAdjustment via onAdjustedStandardChange. WAITING whenever
  // either operand is unavailable -- see BackgroundAdjustment.tsx Stage 4.
  const adjustedSlot: SummaryBarSlot = {
    label: 'Adjusted standard',
    value: adjustedStandardReport?.value ?? null,
    unit: adjustedStandardReport?.unit ?? preliminarySlot.unit,
    state: adjustedStandardReport?.state ?? 'waiting',
    note:
      adjustedStandardReport?.state === 'computed'
        ? `${adjustedStandardReport.governedBy === 'background' ? 'Background UTL' : 'Preliminary standard'} governs -- see Stage 4.`
        : 'Depends on the preliminary standard and the background UTL.',
  };
  const governingLabel =
    adjustedStandardReport?.state === 'computed' && adjustedStandardReport.value != null
      ? adjustedStandardReport.governedBy === 'background'
        ? `background UTL 95/95 (${formatMagnitude(adjustedStandardReport.value)} ${adjustedStandardReport.unit})`
        : `preliminary standard (${formatMagnitude(adjustedStandardReport.value)} ${adjustedStandardReport.unit})`
      : undefined;
  const governingNote =
    adjustedStandardReport?.state === 'computed'
      ? adjustedStandardReport.governedBy === 'background'
        ? 'It exceeds the preliminary standard, so it sets the adjusted standard.'
        : 'It is at or above the background UTL, so it sets the adjusted standard.'
      : undefined;
  // Derivation equations shown in the Jurisdictional Frameworks Quick Reference,
  // filtered to the active side-tab's pathway(s). The cross-cutting
  // 'background-adjustment' equation is intentionally excluded (see
  // JURISDICTIONAL_SIDE_TAB_PATHWAYS) so it stays in the calculator only.
  const jurisdictionalEquations = useMemo(
    () =>
      EQUATION_RECORDS.filter((eq) =>
        (JURISDICTIONAL_SIDE_TAB_PATHWAYS[activeSideTab] ?? []).includes(eq.pathway),
      ),
    [activeSideTab],
  );
  const rightPanelTitle =
    activeTopTab === 'Calculator' ? 'Value Search' : 'Quick Reference';
  // A11y fix (F2, 2026-08-14 adversarial review): the toggle's aria-label
  // used to read the generic "Show/Hide right panel" in every mode, telling
  // a screen-reader user a layout term instead of what the panel holds. In
  // Calculator mode the rail's own on-screen heading already reads
  // "Value Search" (rightPanelTitle above), so reuse that exact, verified
  // string rather than inventing new copy. Scoped to Calculator only, per
  // the finding: Jurisdictional Frameworks shares the same wrapper but was
  // not named in the finding, so it keeps the generic label.
  const rightPanelToggleLabel = isCalculatorMode
    ? `${effectiveShowRightPanel ? 'Hide' : 'Show'} ${rightPanelTitle} panel`
    : `${effectiveShowRightPanel ? 'Hide' : 'Show'} right panel`;
  // Both are lg-scoped so the rail is full-width when the shell is stacked and
  // fixed-width only once it sits beside the content. The INNER width matters
  // most: a bare w-[384px] is wider than a 375 px viewport, so the old value
  // overflowed the page horizontally on a phone no matter what the outer
  // wrapper did. Scoping (rather than replacing) keeps the desktop widths
  // exactly as they were.
  const rightPanelOpenWidth =
    activeTopTab === 'Calculator' ? 'lg:w-96' : 'lg:w-80';
  const rightPanelInnerWidth =
    activeTopTab === 'Calculator' ? 'w-full lg:w-[384px]' : 'w-full lg:w-[320px]';

  // A11y (A2/P3-1): roving-tabindex arrow-key navigation for the primary
  // 8-tab top nav, using MANUAL activation per the ARIA Authoring
  // Practices Guide (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/ --
  // "Tabs With Manual Activation"). Arrow/Home/End move DOM focus only
  // (roving tabindex, tracked by focusedPrimaryTab); they do NOT call
  // setActiveTopTab. Activation happens on click or on Enter/Space, which
  // native <button> already turns into a click event, so no separate
  // Enter/Space handling is needed here.
  //
  // Manual activation was chosen for THIS tablist because its panels are
  // expensive to mount/unmount: the Vision page, the Jurisdictional
  // Frameworks document, TWG Review, the Leaflet-based Interactive Map,
  // the Calculator (5 stacked calculators + in-progress user input), and
  // the SSD Workbench. Automatic activation would mount-then-unmount each
  // of these in sequence while a keyboard user simply arrows past them to
  // reach a farther tab, and would silently discard any in-progress
  // Calculator input the moment the user arrowed off that tab.
  //
  // The Jurisdictional Frameworks side-tab list (handleSideTabKeyDown
  // below) keeps AUTOMATIC activation: its three panels only swap which
  // already-in-memory case-study string is passed to MathRenderer, no
  // component mount/unmount, so there is no expensive-panel cost to avoid.
  const handlePrimaryTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: string,
  ): void => {
    const navKeys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!navKeys.includes(event.key)) return;
    event.preventDefault();

    const currentIdx = TABS.indexOf(currentTab);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextIdx = safeIdx;
    if (event.key === 'ArrowRight') {
      nextIdx = (safeIdx + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIdx = (safeIdx - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = TABS.length - 1;
    }

    const nextTab = TABS[nextIdx];
    setFocusedPrimaryTab(nextTab);
    primaryTabRefs.current[nextTab]?.focus();
  };

  // A11y (A1): roving-tabindex arrow-key navigation for the Jurisdictional
  // Frameworks side-tab list (vertical list -> ArrowUp/ArrowDown).
  const handleSideTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: string,
  ): void => {
    const navKeys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navKeys.includes(event.key)) return;
    event.preventDefault();

    const currentIdx = JURISDICTIONAL_SIDE_TABS.indexOf(currentTab);
    const safeIdx = currentIdx === -1 ? 0 : currentIdx;
    let nextIdx = safeIdx;
    if (event.key === 'ArrowDown') {
      nextIdx = (safeIdx + 1) % JURISDICTIONAL_SIDE_TABS.length;
    } else if (event.key === 'ArrowUp') {
      nextIdx = (safeIdx - 1 + JURISDICTIONAL_SIDE_TABS.length) % JURISDICTIONAL_SIDE_TABS.length;
    } else if (event.key === 'Home') {
      nextIdx = 0;
    } else if (event.key === 'End') {
      nextIdx = JURISDICTIONAL_SIDE_TABS.length - 1;
    }

    const nextTab = JURISDICTIONAL_SIDE_TABS[nextIdx];
    setActiveSideTab(nextTab);
    sideTabRefs.current[nextTab]?.focus();
  };

  const renderSidebar = () => {
    switch (activeTopTab) {
      case 'Jurisdictional Frameworks':
        return (
          <div
            role="tablist"
            aria-orientation="vertical"
            aria-label="Pathway sections"
            className="space-y-2"
          >
            {JURISDICTIONAL_SIDE_TABS.map((tab) => {
              const selected = activeSideTab === tab;
              return (
                <button
                  key={tab}
                  ref={(el) => {
                    sideTabRefs.current[tab] = el;
                  }}
                  type="button"
                  role="tab"
                  id={sideTabId(tab)}
                  aria-selected={selected}
                  aria-controls={JURISDICTIONAL_SIDE_TABPANEL_ID}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveSideTab(tab)}
                  onKeyDown={(e) => handleSideTabKeyDown(e, tab)}
                  className={`w-full text-left p-3 rounded-lg cursor-pointer font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                    selected
                      ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 font-semibold text-sky-700 dark:text-sky-400'
                      : 'hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        );
      case 'Calculator': {
        const tierContent = GUIDE_TIER_CONTENT[activeTier];
        return (
          <div
            className="space-y-5"
            data-testid="calculator-guide-sidebar"
          >
            {/*
              Left rail = OPTIONS (DESIGN.md "Layout: stages inside rails").
              SharedGlobalInputs (substance + regulatory frame) moved here
              from the centre column in the step-2 shell restructure -- it
              is a shared input, not a per-pathway calculation, so it
              belongs with the other options rather than stacked above the
              active calculator. Component internals are untouched.
            */}
            <SharedGlobalInputs
              substanceKey={substanceKey}
              jurisdiction={jurisdiction}
              onSubstanceKeyChange={setSubstanceKey}
              onJurisdictionChange={setJurisdiction}
            />
            {/*
              Fix 1 (owner decision, 2026-08-14 UI QA audit): the inert
              ExposureScenarioControl (single "Custom" option) that used to
              render here has been removed. It duplicated the ALREADY-WORKING
              receptor-scenario selector inside the pathway calculators
              (HHDirectContactCalculator's hh-direct-receptor-scenario-select,
              HHFoodWebCalculator's hh-food-receptor-scenario-select), which
              actually switches real exposure-factor defaults. Later Protocol
              28 preset work extends THAT control rather than adding a
              parallel one here.
            */}
            <div className="border-t border-[var(--db-border)] pt-5">
              <div
                className="grid grid-cols-3 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
                aria-label="Calculator guide audience"
              >
                {ALL_AUDIENCE_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    aria-pressed={activeTier === tier}
                    onClick={() => setActiveTier(tier)}
                    className={cn(
                      'rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors',
                      activeTier === tier
                        ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                    )}
                  >
                    {GUIDE_TIER_LABELS[tier]}
                  </button>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {tierContent.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {tierContent.summary}
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {tierContent.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                Screening-only outputs still require professional judgment
                before regulator-facing use.
              </div>
            </div>
          </div>
        );
      }
      case 'The Guide':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Use the guide to understand the project phases, workspace tabs, and key terms.</p>;
      case 'Vision for Modernizing Schedule 3.4':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Review the three-part vision for Schedule 3.4 and the four Part 1 receptor-pathways.</p>;
      case 'Interactive Map':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Inspect sediment samples, measurements, filters, and map-linked selections.</p>;
      case 'TWG Review':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Use the review tools to record Technical Working Group feedback.</p>;
      case 'References & Values':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Review source metadata, calculator values, equations, and QA states.</p>;
      case 'SSD Workbench':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Derive review-only SSD HCp candidates from ECOTOX-style toxicity records.</p>;
      default:
        return null;
    }
  };

  const leftSidebarHeading =
    activeTopTab === 'Calculator'
      ? 'OPTIONS'
      : activeTopTab === 'Jurisdictional Frameworks'
        ? 'PATHWAY / APPROACH'
        : 'CONTEXT';

  const renderToolReference = () => {
    if (activeTopTab === 'Calculator') {
      return (
        <CalculatorValueSearchPanel
          pathway={calculatorPathway}
          pathwayLabel={calculatorCategoryLabel}
          substanceKey={substanceKey}
          substanceLabel={selectedSubstance?.displayName ?? substanceKey}
          jurisdictionLabel={selectedJurisdiction?.label ?? jurisdiction}
          regulatoryFrameId={jurisdiction}
          onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
          candidateReview={candidateReview}
          onCandidateReviewed={setCandidateReview}
        />
      );
    }

    return (
      <div className="space-y-4" data-testid="matrix-options-right-reference">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            Methodology Quick Reference
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Use the methodology material to compare method choices, not to
            copy a single standard.
          </p>
        </div>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>Start with the selected pathway group: {activeSideTab}.</li>
          <li>Look for receptor groups, exposure routes, and endpoint choices.</li>
          <li>Note how each program handles bioavailability and uncertainty.</li>
          <li>Carry useful assumptions into the calculator for testing.</li>
        </ol>
        {jurisdictionalEquations.length > 0 && (
          <div
            className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700"
            data-testid="jurisdictional-equation-reference"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              Derivation equations
            </p>
            <div className="grid gap-2">
              {jurisdictionalEquations.map((eq) => (
                <details
                  key={eq.equation_id}
                  className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                >
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white">
                    {eq.display_name}
                  </summary>
                  <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-200">
                    {/* remark-math only recognizes $$...$$ as BLOCK/display
                        math (KaTeX displayMode) when the delimiters sit on
                        their own lines; a same-line `$$...$$` parses as
                        inline math instead. The surrounding newlines here
                        are required, not stylistic. */}
                    {/* Round-2 P2-2: this drawer's <details> surface is
                        `bg-white dark:bg-slate-950` (see the className two
                        elements up), NOT the ScrollFadeRegion default of
                        dark:slate-900 -- pass the real surface or the fade
                        paints a mismatched stripe in dark mode. */}
                    <MathRenderer
                      content={`$$\n${eq.equation_latex}\n$$`}
                      fadeFrom="from-white dark:from-slate-950"
                    />
                    <p className="leading-relaxed text-slate-600 dark:text-slate-300">
                      {eq.plain_language}
                    </p>
                    {eq.unit_notes && (
                      <p className="text-slate-500 dark:text-slate-400">
                        Units: {eq.unit_notes}
                      </p>
                    )}
                    <p className="text-slate-500 dark:text-slate-400">
                      Status: {eq.qa_status.replace(/_/g, ' ')}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTopTab) {
      case 'Jurisdictional Frameworks':
        let contentToRender = '';
        if (activeSideTab === 'Ecological: EqP & AVS') contentToRender = eqpCaseStudyContent;
        else if (activeSideTab === 'Ecological: Food Web (BSAF)') contentToRender = bsafCaseStudyContent;
        else if (activeSideTab === 'Human Health Pathways') contentToRender = humanHealthContent;

        return (
          <div
            className="space-y-6"
            role="tabpanel"
            id={JURISDICTIONAL_SIDE_TABPANEL_ID}
            aria-labelledby={sideTabId(activeSideTab)}
          >
            {/* Round-2 P2-2: this panel paints on the shell's main-content
                surface (`bg-white dark:bg-slate-950`, non-calculator branch). */}
            {/* Audit #16: these source documents each open with their own `# ` title, which
                would render a SECOND <h1> under the shell's `<h1>Matrix Options</h1>`
                (:1783). Demoted at the call site, never inside MathRenderer -- see
                demoteLeadingH1's module comment for why. */}
            <MathRenderer content={demoteLeadingH1(contentToRender)} fadeFrom="from-white dark:from-slate-950" />
          </div>
        );
      case 'The Guide': {
        const guideParts = guideContent.split('<!-- SECTION_BOUNDARY -->');
        const introContent = guideParts[0] || '';
        const section1Content = guideParts[1] || '';
        const section2Content = guideParts[2] || '';

        // Audit #20 (layer 2 of 2): the bare `p-8` stacked with the shell's `px-8` at :2264
        // for 64px of horizontal chrome on a 375px viewport -- 17% of the screen. Responsive
        // now, matching this file's own precedent at :2048 (`p-4 lg:p-8`).
        const cardClassName = "bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 lg:p-8 border border-slate-200 dark:border-slate-700";
        // Round-2 P2-2: Guide section cards are dark:bg-slate-800 -- a DIFFERENT
        // surface from the Calculator drawer's dark:bg-slate-950 above, which is
        // exactly why ScrollFadeRegion/MathRenderer cannot have one right default.
        const guideFadeFrom = 'from-white dark:from-slate-800';

        return (
          <div className="space-y-6">
            <div className={cardClassName} data-testid="guide-section-card">
              {/* Audit #16: The_Guide.md opens with `# The Guide: Matrix Options Workspace`.
                  Only part 0 of the SECTION_BOUNDARY split can carry a leading title, so the
                  helper is applied here alone; on parts 1 and 2 it would be a no-op. */}
              <MathRenderer content={demoteLeadingH1(introContent)} fadeFrom={guideFadeFrom} />
            </div>
            {section1Content && (
              <div className={cardClassName} data-testid="guide-section-card">
                <MathRenderer content={section1Content} fadeFrom={guideFadeFrom} />
              </div>
            )}
            {section2Content && (
              <div className={cardClassName} data-testid="guide-section-card">
                <MathRenderer content={section2Content} fadeFrom={guideFadeFrom} />
              </div>
            )}
            <div className={cardClassName} data-testid="guide-section-card">
              <Phase2TasksSection />
            </div>
          </div>
        );
      }
      case 'Vision for Modernizing Schedule 3.4':
        return (
          <div className="w-full">
            <ConceptualMatrix />
          </div>
        );
      case 'TWG Review':
        return (
          <TWGReviewPortal finalDraftContent={finalDraftContent} showLeftPanel={showLeftPanel} showRightPanel={showRightPanel} />
        );
      case 'References & Values':
        // EvidenceLibrary is now rendered directly in the isEvidenceLibraryMode
        // layout branch (3-column shell) rather than via renderContent().
        // This case is kept as a no-op fallback only.
        return null;
      case 'SSD Workbench':
        return (
          <div className="w-full">
            <SsdWorkbench onOpenEvidenceLibrary={handleOpenEvidenceLibrary} />
          </div>
        );
      case 'Calculator':
        return (
          <div className="w-full space-y-6" data-testid="calculator-tab-content">
            {/*
              Calculator-tab vertical flow (step-2 shell restructure):
                1. Active category calculator (switches on activeCategory).
                   CategorySelector (the pathway switch) now renders in the
                   top chrome band, above the 3-column shell, at primary
                   navigation weight -- see the isCalculatorMode block in
                   the component return below. SharedGlobalInputs (substance
                   + regulatory frame) now renders in the left OPTIONS rail
                   -- see renderSidebar()'s 'Calculator' case. Both moved
                   out of this centre column without any change to their
                   own internals, props, or behaviour.
                2. BackgroundAdjustment (post-derivation panel)
            */}
            <CalculatorSummaryBar
              pathwayLabel={calculatorCategoryLabel}
              preliminary={preliminarySlot}
              utl={utlSlot}
              adjusted={adjustedSlot}
              governingLabel={governingLabel}
              governingNote={governingNote}
            />
            {/* Audit P2: below `lg` the Value Search rail does not sit beside the calculator
                -- it stacks BELOW the main content (no order utility on its wrapper, so DOM
                order decides). When Stage 3 opens the rail, a narrow-screen user gets no
                indication that anything appeared, because it is off the bottom of the view.
                Gated with the CSS `lg:hidden` rather than `useIsMobile()`: that hook's
                breakpoint is 768px while this layout stacks at 1024px, so it would leave
                768-1023px uncovered. */}
            {calculatorRailOpen && (
              <p
                className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 lg:hidden dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100"
                data-testid="calculator-stage3-rail-hint"
              >
                The {rightPanelTitle} panel is open. On this screen width it appears below
                the calculator rather than beside it -- scroll down to reach it.
              </p>
            )}
            {/* Audit P1: "Review candidate defaults" is an ACTION, but it used to live only
                inside the Stage-3-gated right rail, which is collapsed (and inert) until
                Stage 3. It now also renders here, in the body, so it is reachable throughout
                the calculator. The rail instance is unchanged and the gating of reference
                DATA is untouched -- only this action is duplicated, sharing one timestamp. */}
            <DefaultPolicyCandidatesAction
              pathway={calculatorPathway}
              pathwayLabel={calculatorCategoryLabel}
              substanceKey={substanceKey}
              substanceLabel={selectedSubstance?.displayName ?? substanceKey}
              regulatoryFrameId={jurisdiction}
              candidateInputKeys={calculatorCandidateInputKeys}
              receipt={candidateReview}
              onReviewed={setCandidateReview}
              onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              surface="body"
              className="mx-auto max-w-md"
            />
            {activeCategory === 'eco-direct' && (
              <EcoDirectEqPCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
                onPreliminaryStandardChange={setEcoDirectPreliminary}
                backgroundReferenceNeedsAttention={backgroundReferenceNeedsAttention}
              />
            )}
            {activeCategory === 'eco-food' && (
              <EcoFoodBSAFCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
                onPreliminaryStandardChange={setEcoFoodPreliminary}
                backgroundReferenceNeedsAttention={backgroundReferenceNeedsAttention}
              />
            )}
            {activeCategory === 'hh-direct' && (
              <HHDirectContactCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
                onPreliminaryStandardChange={setHhDirectPreliminary}
                backgroundReferenceNeedsAttention={backgroundReferenceNeedsAttention}
              />
            )}
            {activeCategory === 'hh-food' && (
              <HHFoodWebCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
                onPreliminaryStandardChange={setHhFoodPreliminary}
                backgroundReferenceNeedsAttention={backgroundReferenceNeedsAttention}
              />
            )}
            {/*
              Cumulative Effects (TEQ + BaP-eq) is orthogonal to the eco/hh CategorySelector -- it
              works over its own list of PAH/congener entries rather than a single substanceKey, so
              it is stacked unconditionally below the active category calculator (same pattern as
              BackgroundAdjustment below), not gated by activeCategory.
            */}
            <CumulativeEffectsCalculator
              substanceKey={substanceKey}
              jurisdiction={jurisdiction}
              onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
            />
            {/*
              Human Health Inhalation (Matrix Options row #31) is orthogonal to the
              eco/hh CategorySelector for the same reason CumulativeEffectsCalculator is
              (see comment above): it is a distinct pathway with a fail-closed,
              user-supplied-VF/PEF contract (owner ruling 2026-07-17), not one of the
              4 eco/hh-direct/food quadrant calculators the 1x4 CategorySelector's
              exhaustiveness-checked MatrixCategory type is locked to. Stacking it here
              (rather than adding a 5th CategorySelector category) keeps that tightly
              scoped component's layout and accessibility contract unchanged.
            */}
            <div className="flex items-center gap-3 py-2" aria-hidden="true">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Human Health Inhalation
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
            <HHInhalationCalculator
              substanceKey={substanceKey}
              jurisdiction={jurisdiction}
              onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              onPreliminaryStandardChange={setHhInhalationPreliminary}
            />
            <div className="flex items-center gap-3 py-2" aria-hidden="true">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Background Adjustment (post-derivation)
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
            <BackgroundAdjustment
              jurisdiction={jurisdiction}
              onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              preliminaryStandard={preliminaryStandardForBackground}
              onUtlChange={setBackgroundUtlReport}
              onAdjustedStandardChange={setAdjustedStandardReport}
            />
          </div>
        );
      case 'Interactive Map':
        // Matrix Interactive Map 3-column layout (owner directive
        // 2026-05-20): mirrors BN-RRM MapView pattern -- left panel
        // | map | right panel. Panel toggles live in the dashboard
        // sub-header (showLeftPanel + showRightPanel state, see
        // chrome buttons block below). Both panels collapse to w-0
        // with the same transition pattern BNRRMClient.tsx uses for
        // its DetailedView + MapView tabs.
        //
        // PR-MAP-17a: below 768 px we render MatrixMapMobileFallback
        // (banner only; the read-only summary view per PLAN_V3_4_2
        // section 3.8 is deferred to PR-MAP-17b). The desktop layout
        // assumes >= 768 px width (left w-80 + right w-96 alone
        // exceeds 700 px) so the early-return prevents the broken
        // overflow that mobile viewports otherwise hit.
        if (isMobile) {
          return (
            <div
              className="flex-1 flex flex-col overflow-hidden"
              data-testid="matrix-options-interactive-map-embed"
            >
              <MatrixMapMobileFallback />
            </div>
          );
        }
        return (
          <div
            className="flex-1 flex flex-col overflow-hidden"
            data-testid="matrix-options-interactive-map-embed"
          >
            <PartialVisibilityBanner
              hiddenSampleCount={initialMapData.hidden_sample_count}
              hiddenDraCount={initialMapData.hidden_dra_count}
              hiddenDraIds={initialMapData.hidden_dra_ids}
              contactEmail={MATRIX_ADMIN_CONTACT_EMAIL}
              onRefresh={handleRefreshMapData}
            />
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {/* Left panel: Selection Stats (Phase 0 redesign) */}
              <div
                data-testid="matrix-map-left-panel-wrapper"
                className={cn(
                  'relative transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm',
                  !showLeftPanel && 'pointer-events-none',
                )}
                style={{ width: showLeftPanel ? `${matrixMapLeftPanelWidth}px` : '0px' }}
                // NEW-P3-3 (a11y audit round 3): same zero-width-collapse
                // pattern as left-sidebar-wrapper below -- pointer-events-none
                // only blocks the mouse, so keyboard-focusable content inside
                // (e.g. the MatrixMapLeftPanel UCL retry button) stayed
                // reachable by Tab while visually clipped to 0px. inert
                // removes it from the focus/tab order (and AT) without
                // touching the width transition.
                inert={showLeftPanel ? undefined : true}
              >
                {/* Left separator: handle on the RIGHT edge of the left panel */}
                {showLeftPanel && !matrixMapWorkbenchFocused && (
                  <button
                    type="button"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize selection stats panel"
                    aria-valuenow={matrixMapLeftPanelWidth}
                    aria-valuemin={MATRIX_MAP_LEFT_PANEL_MIN_WIDTH}
                    aria-valuemax={leftPanelAriaMax}
                    onPointerDown={handleLeftPanelResizePointerDown}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        const next = clampMatrixMapPanelWidth(
                          'left',
                          leftWidthRef.current + 16,
                          showRightPanel ? rightWidthRef.current : 0,
                        );
                        leftWidthRef.current = next;
                        setMatrixMapLeftPanelWidth(next);
                      } else if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const next = clampMatrixMapPanelWidth(
                          'left',
                          leftWidthRef.current - 16,
                          showRightPanel ? rightWidthRef.current : 0,
                        );
                        leftWidthRef.current = next;
                        setMatrixMapLeftPanelWidth(next);
                      }
                    }}
                    className="absolute inset-y-0 right-0 z-10 w-3 cursor-col-resize border-r border-transparent hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:hover:border-blue-700"
                  >
                    {/* Grip dots: 3 small dots centered on the handle */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1"
                    >
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </span>
                  </button>
                )}
                <MatrixMapLeftPanel
                  initialMapData={initialMapData}
                  selectableSamples={knownSamples}
                />
              </div>

              {/* Center: map */}
              <div className="flex-1 relative">
                <MatrixMapLoader
                  initialMapData={initialMapData}
                  fetchErrorMessage={fetchErrorMessage}
                  siteAggregateData={siteAggregateData}
                  siteAggregateFetchErrorMessage={siteAggregateFetchErrorMessage}
                  onMapDataChange={handleViewportData}
                />
              </div>

              {/* Right panel: MeasurementWorkbench (PR-MAP-5 scaffold) */}
              <div
                data-testid="matrix-map-right-panel-wrapper"
                className={cn(
                  'relative transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-sm',
                  matrixMapWorkbenchFocused &&
                    'absolute inset-y-2 right-3 z-[1200] rounded-lg border border-slate-200 shadow-2xl dark:border-slate-700',
                  !showRightPanel && !matrixMapWorkbenchFocused && 'pointer-events-none',
                )}
                style={{
                  width: matrixMapWorkbenchFocused
                    ? 'calc(100% - 24px)'
                    : showRightPanel
                      ? `${matrixMapRightPanelWidth}px`
                      : '0px',
                }}
                // NEW-P3-3 (a11y audit round 3): same fix as
                // matrix-map-left-panel-wrapper above -- this panel also
                // collapses to 0px width via pointer-events-none alone,
                // leaving MatrixMapRightPanel's focusable controls (and the
                // resize separator button, when rendered) keyboard-reachable
                // while clipped. inert only when actually collapsed (not
                // shown and not focused-fullscreen).
                inert={!showRightPanel && !matrixMapWorkbenchFocused ? true : undefined}
              >
                {/* Right separator: handle on the LEFT edge of the right panel */}
                {showRightPanel && !matrixMapWorkbenchFocused && (
                  <button
                    type="button"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize measurement workbench"
                    aria-valuenow={matrixMapRightPanelWidth}
                    aria-valuemin={MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH}
                    aria-valuemax={rightPanelAriaMax}
                    onPointerDown={handleRightPanelResizePointerDown}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const next = clampMatrixMapPanelWidth(
                          'right',
                          rightWidthRef.current + 16,
                          showLeftPanel ? leftWidthRef.current : 0,
                        );
                        rightWidthRef.current = next;
                        setMatrixMapRightPanelWidth(next);
                      } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        const next = clampMatrixMapPanelWidth(
                          'right',
                          rightWidthRef.current - 16,
                          showLeftPanel ? leftWidthRef.current : 0,
                        );
                        rightWidthRef.current = next;
                        setMatrixMapRightPanelWidth(next);
                      }
                    }}
                    className="absolute inset-y-0 left-0 z-10 w-3 cursor-col-resize border-l border-transparent hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 dark:hover:border-blue-700"
                  >
                    {/* Grip dots: 3 small dots centered on the handle */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1"
                    >
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </span>
                  </button>
                )}
                <MatrixMapRightPanel
                  initialMapData={initialMapData}
                  substanceKey={substanceKey}
                  isFocused={matrixMapWorkbenchFocused}
                  onToggleFocus={() => setMatrixMapWorkbenchFocused((current) => !current)}
                />
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 pt-20">
            <svg className="w-16 h-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
              Select a Matrix Options tab to continue.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-slate-100 dark:bg-slate-900 relative print:block print:h-auto print:overflow-visible">
      {/* Sub-header / Toolbar -- hidden in print so window.print() from the
          TWG Review tab produces a chrome-free PDF of the paper body. */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm overflow-x-auto print:hidden">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200 dark:border-slate-700">
             <div className="w-9 h-9 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
             <div><h1 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">Matrix Options</h1><p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">Policy Review</p></div>
          </div>
          <nav aria-label="Matrix Options primary">
            <div
              role="tablist"
              aria-label="Matrix Options"
              data-primary-tablist-ready={primaryTablistReady ? 'true' : undefined}
              className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1"
            >
            {TABS.map((tab) => {
              const selected = activeTopTab === tab;
              return (
                <button
                  key={tab}
                  ref={(el) => {
                    primaryTabRefs.current[tab] = el;
                  }}
                  type="button"
                  role="tab"
                  id={primaryTabId(tab)}
                  aria-selected={selected}
                  aria-controls={PRIMARY_TABPANEL_ID}
                  tabIndex={focusedPrimaryTab === tab ? 0 : -1}
                  onClick={() => {
                    // NEW-P3-2 (a11y audit round 3): set focusedPrimaryTab
                    // directly here instead of relying solely on the
                    // activeTopTab-sync effect above. Clicking the already-
                    // active tab (e.g. after an arrow key moved DOM focus to
                    // a different, not-yet-activated tab) makes
                    // setActiveTopTab(tab) a same-value no-op, so that effect
                    // never re-fires and tabIndex=0 would otherwise stay on
                    // the previously-arrowed-to tab while focus is here.
                    setFocusedPrimaryTab(tab);
                    setActiveTopTab(tab);
                  }}
                  onKeyDown={(e) => handlePrimaryTabKeyDown(e, tab)}
                  className={cn('relative flex min-h-[44px] items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900', selected ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-600/50')}
                >
                  <span>{TAB_LABELS[tab] ?? tab}</span>
                </button>
              );
            })}
            </div>
          </nav>
        </div>
        <div className="flex items-center gap-1 ml-auto pl-4 border-l border-slate-200 dark:border-slate-700">
           {(isToolMode || isReviewMode || (isEvidenceLibraryMode && !isMobile) || (isMapMode && !isMobile)) && (
             <>
               {/*
                 F3 fix (2026-08-14 adversarial review): aria-expanded reflects
                 the actual panel state (not a static role). aria-controls is
                 deliberately omitted -- this single toggle drives a DIFFERENT
                 underlying wrapper depending on the active tab (left-sidebar-
                 wrapper / matrix-map-left-panel-wrapper), none of which carry a
                 stable id, and inventing one solely for this attribute was out
                 of scope per the finding's own caveat.
               */}
               <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors', showLeftPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'} aria-label={showLeftPanel ? 'Hide left panel' : 'Show left panel'} aria-expanded={showLeftPanel}>
                 {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
               </button>
               {/*
                 F1 fix: rightPanelToggleRef is the focus-rescue target when
                 the rail closes (auto or manual) while focus was inside it --
                 see the onFocus/onBlur handlers on the rail wrapper and the
                 closing effect near effectiveShowRightPanel's declaration.
                 F2/F3 fix: rightPanelToggleLabel is content-aware
                 in Calculator mode (reuses the rail's own on-screen heading,
                 rightPanelTitle) instead of the generic "right panel" term;
                 aria-expanded reflects effectiveShowRightPanel (same
                 aria-controls caveat as the left toggle above).
               */}
               <button ref={rightPanelToggleRef} onClick={toggleRightPanel} className={cn('flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 transition-colors', effectiveShowRightPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700')} title={rightPanelToggleLabel} aria-label={rightPanelToggleLabel} aria-expanded={effectiveShowRightPanel}>
                 {effectiveShowRightPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
               </button>
             </>
           )}
        </div>
      </div>

      {/*
        Pathway switch (DESIGN.md "Layout: stages inside rails" +
        "The four pathways are four independent derivations"): a primary-
        navigation-weight control directly beneath the app tab bar,
        Calculator-tab only. Promotes CategorySelector's four options out
        of the centre column without touching its internals -- its roving
        tabindex, arrow-key handling, and radiogroup ARIA semantics are
        unchanged; only the calling location moved.
      */}
      {isCalculatorMode && (
        <div
          data-testid="calculator-pathway-switch"
          className="shrink-0 border-b border-[var(--db-border)] bg-[var(--db-depth-1)] px-4 py-4 print:hidden md:px-8"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--db-text-secondary)]">
              Pathway
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--db-text-primary)]">
              Each pathway below is an independent derivation. Switching
              pathways produces a separate concentration -- not a different
              view of the same number.
            </p>
            <CategorySelector
              activeCategory={activeCategory}
              onChange={setActiveCategory}
              className="mt-3"
            />
          </div>
        </div>
      )}

      {/*
        Option A responsive shell (owner-selected 2026-08-14). Below `lg` the
        three zones stack into one column: DOM order puts the left rail ABOVE
        the main content and the right rail BELOW it (no `order-first` or
        other order utility is applied anywhere in this shell, so plain DOM
        order decides stacked position -- see the right rail's own P2-2
        comment below). At `lg` and up the original three-column layout is
        byte-for-byte what it was. The breakpoint work is pure CSS rather than a
        JS `isMobile` branch on purpose: this subtree is server-rendered before
        React attaches, and a JS breakpoint would render the desktop shell on
        the server and the phone shell on the client -- the same
        SSR-before-hydration mismatch that the e2e readiness gate exists to
        absorb. CSS reflows identically in both renders.

        Stacked, the column must scroll as a whole (each zone is auto-height),
        so overflow-hidden is deferred to `lg` where the inner panes scroll
        themselves. P1 fix (2026-08-14 adversarial review): "each zone is
        auto-height" was the INTENT here, but the Main Content zone below did
        not actually implement it -- see the comment on that div for the
        mechanism and the fix.
      */}
      {/* Audit #16, PRINT correction. Demoting each document's leading `# ` to `##` is right
          ON SCREEN, because the shell supplies the page <h1> in the toolbar above. It is WRONG
          IN PRINT: that toolbar carries `print:hidden`, so on paper the shell heading vanishes
          and the demoted document heading is an h2 -- leaving the four regulatory documents
          printing with NO level-1 heading at all, where before the demotion they printed with
          one.
          Placed HERE, above the isToolMode branch, deliberately: renderContent() has FIVE call
          sites across the two layout branches, and an earlier version of this fix sat inside
          only one of them, so the tool-mode tabs (Methodology by pathway, Calculator) still
          printed with none. One heading above the split covers every tab.
          `hidden` keeps it out of the screen accessibility tree (display:none), so it cannot
          reintroduce the duplicate-H1 defect #16 exists to fix; `print:block` restores it for
          the print medium only.
          jsdom implements no print medium, so NO unit test can observe any of this. It is
          covered by e2e/matrix-options-print.spec.ts under emulateMedia({ media: 'print' }),
          which is the only check in this repo that can see it. */}
      {/* Scoped to EXACTLY the tabs whose document heading was demoted. Rendering it on every
          tab was wrong twice over: it reintroduced chrome on TWG Review, whose toolbar is
          `print:hidden` specifically so window.print() yields a chrome-free PDF (see the comment
          on that toolbar above), and TWG Review renders its paper RAW -- demoteLeadingH1 is not
          applied there -- so its printed h1 count went 2 -> 3 rather than 0 -> 1.
          The heading exists to replace an h1 that the demotion removed, so it belongs only where
          the demotion happens: MatrixDashboard.tsx:1421 (Jurisdictional Frameworks) and :1445
          (The Guide). */}
      {DEMOTED_DOCUMENT_TABS.has(activeTopTab) && (
        <h1
          data-testid="matrix-print-title"
          className="hidden print:block px-4 pt-4 text-2xl font-bold text-slate-900"
        >
          Matrix Options -- {TAB_LABELS[activeTopTab] ?? activeTopTab}
        </h1>
      )}
      <div className="flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden print:block print:overflow-visible print:h-auto">
        {isToolMode ? (
          <>
            {/* Left Sidebar */}
            <div
              data-testid="left-sidebar-wrapper"
              className={cn(
                // F4 fix (2026-08-14 adversarial review): motion-reduce:transition-none
                // honours prefers-reduced-motion -- this wrapper's own width/height
                // collapse animation is exactly the kind of non-essential motion that
                // preference asks to skip.
                'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 motion-reduce:transition-none',
                // Stacked below lg, the divider belongs on the bottom edge;
                // side-by-side at lg and up, on the right edge as before.
                'border-b lg:border-b-0 lg:border-r',
                // Bathymetric shell chrome (DESIGN.md), Calculator tab only.
                // Jurisdictional Frameworks (the other isToolMode tab) keeps
                // its original slate styling unchanged.
                isCalculatorMode
                  ? 'bg-[var(--db-depth-1)] border-[var(--db-border)]'
                  : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800',
                // Collapse axis differs by layout. Side-by-side it is WIDTH
                // (w-0), which is what the transition has always animated.
                // Stacked, w-0 would collapse the rail to a zero-width strip
                // that still occupies full column height, so the collapse must
                // be HEIGHT instead -- full width, max-h-0, no padding.
                //
                // D1 fix (2026-08-15 adversarial review): a P3-4 fix
                // (2026-08-14) previously gave the OPEN branch an explicit
                // `max-h-[2400px]` here, paired with `max-h-0` on the CLOSED
                // branch, so `transition-all` had two interpolable px values
                // to animate between below `lg`. That cap was ITSELF a
                // silent-hiding defect and has been reverted:
                //   - Below `lg` this wrapper's height is `auto` (only
                //     max-height is constrained), so per CSS 2.1 10.5 the
                //     inner `h-full` pane resolves to auto too -- the
                //     `flex-1 overflow-y-auto` body pane inside never gets a
                //     bounded box to scroll within. Content past 2400px was
                //     CLIPPED with no scrollbar and no indicator, not
                //     scrolled.
                //   - This is reachable in normal use: the value-search list
                //     is capped at 3 rows only while its query is empty; one
                //     tap on a suggestion chip makes it unbounded, and at
                //     ~180-230px/row on a 375px viewport the cap was exceeded
                //     at roughly 8-10 rows of regulatory values with units
                //     and source attribution.
                //   - Print is worse: Tailwind `lg:` is a min-width query, so
                //     `lg:max-h-none` does not apply to the print page box
                //     (~624-816 CSS px), and this rail has no `print:hidden`
                //     -- printing the Calculator truncated the rail at
                //     2400px in the PDF, a path that was uncapped before the
                //     P3-4 fix.
                // A cosmetic snap-instead-of-animate collapse is preferable
                // to a silent-hiding path on regulatory values. If the
                // animation is wanted later, the safe technique is an
                // interpolable `grid-template-rows: 0fr <-> 1fr` pair, which
                // needs no max-height cap at all.
                showLeftPanel
                  ? cn(
                      'w-full p-6',
                      isCalculatorMode ? 'lg:w-96' : 'lg:w-80',
                    )
                  : 'max-h-0 w-full border-b-0 p-0 lg:max-h-none lg:w-0',
                // Plan v3 section 4.2 + section 10: hide the entire left
                // sidebar when printing the Calculator tab so window.print()
                // produces a chrome-free PDF anchored on the calculator
                // body + Background Adjustment panel.
                hideSidebarOnPrint && 'print:hidden',
              )}
              // P3-6 (a11y audit 2026-08-14): the collapsed (w-0) state uses
              // overflow-hidden, not `hidden`, so children (side-tab
              // buttons here, and the Calculator audience-tier buttons at
              // renderSidebar()'s 'Calculator' case, which renders inside
              // this same wrapper -- one fix covers both) stay in the DOM
              // and, without this, stay keyboard-focusable while clipped to
              // zero width. `inert` removes them from focus/tab order (and
              // hides them from AT) without touching the width/opacity
              // transition classes that drive the collapse animation.
              inert={showLeftPanel ? undefined : true}
            >
              {/* min-w-[270px] is a desktop guard against the rail being
                  squeezed narrower than its controls read at. Stacked, the rail
                  is already full viewport width and the floor instead becomes an
                  overflow source on a 320 px phone (320 - 48 px padding = 272),
                  so it applies only from lg up. */}
              <div className="w-full min-w-0 lg:min-w-[270px]">
                <h2
                  className={cn(
                    'text-xs font-bold uppercase tracking-wider mb-4',
                    isCalculatorMode
                      ? 'text-[var(--db-text-secondary)]'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                >
                  {leftSidebarHeading}
                </h2>
                {renderSidebar()}
              </div>
            </div>

            {/* Main Content */}
            <div
              className={cn(
                // p-8 (32 px each side) costs 64 px of a 375 px viewport before
                // any content renders; halved below lg, unchanged at desktop.
                //
                // P1 fix (2026-08-14 adversarial review): this div is a flex
                // item (flex-1) inside a flex-col container below `lg`. Per
                // CSS Flexbox 4.5 (automatic minimum size), a flex item's
                // default min-height along the main axis is its CONTENT size --
                // UNLESS the item's own overflow is something other than
                // `visible`, in which case the automatic minimum resolves to 0
                // instead. This div used to carry an unscoped `overflow-y-auto`,
                // so below `lg` its minimum size was 0: with the left/right
                // rails both flex-shrink-0 (refusing to shrink) and the shell
                // height definite (page.tsx's h-[calc(100vh-4rem)]), free space
                // went negative and this flex-1 item was squeezed to 0px --
                // silently clipping the entire calculator body on a phone,
                // values and all. Scoping overflow-y-auto to `lg:` restores
                // `min-height: auto` (content-based) below `lg`, so this zone
                // takes its natural content height and the SHELL wrapper's own
                // overflow-y-auto (see the comment above this three-zone
                // container) does the scrolling instead -- which is what that
                // comment already claimed happened. At `lg` and up the layout
                // is unchanged: this pane scrolls itself again, byte-for-byte
                // the prior desktop behavior.
                'flex-1 relative p-4 lg:overflow-y-auto lg:p-8',
                isCalculatorMode
                  ? 'bg-[var(--db-surface)]'
                  : 'bg-white dark:bg-slate-950',
              )}
              role="tabpanel"
              id={PRIMARY_TABPANEL_ID}
              aria-labelledby={primaryTabId(activeTopTab)}
              tabIndex={-1}
            >
              {renderContent()}
            </div>

            {/* Right Drawer */}
            <div
              // F5 fix (2026-08-14 adversarial review): this testid used to be
              // unconditional, so it was also present when isToolMode covers
              // Jurisdictional Frameworks -- a test selecting by this testid
              // could silently pass against the wrong tab's drawer. No existing
              // test relies on it being present outside Calculator mode (the
              // only describe block that reads it is scoped to Calculator, per
              // MatrixDashboard.test.tsx), so restricting it is safe.
              data-testid={isCalculatorMode ? 'calculator-reference-rail' : undefined}
              ref={rightPanelWrapperRef}
              // F1 fix: React's onFocus/onBlur use the focusin/focusout event
              // model, so they fire for ANY descendant gaining/losing focus,
              // not just this element itself -- see the ref declaration's
              // comment above for why this is event-driven rather than
              // render-driven.
              onFocus={() => {
                rightPanelFocusInsideRef.current = true;
              }}
              onBlur={(event) => {
                // D2 fix: see the rightPanelFocusInsideRef declaration above
                // for why this reads `inert` instead of inferring cause from
                // relatedTarget. `inert` true means the browser is
                // unfocusing this element as a synchronous consequence of
                // the rail closing -- leave the ref alone. `inert` false
                // means the rail is still open and focus genuinely left on
                // its own (a real element, or null from a tap on
                // non-focusable content / keyboard dismissal) -- clear it.
                if (!event.currentTarget.inert) {
                  rightPanelFocusInsideRef.current = false;
                }
              }}
              className={cn(
                // F4 fix: see the matching motion-reduce comment on the left
                // sidebar wrapper above -- same rationale, same fix.
                'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 shadow-2xl motion-reduce:transition-none',
                // P2-2 fix (2026-08-14 adversarial review): this rail has no
                // `order-first` (or any order utility) anywhere in its class
                // list, so DOM order alone decides stacked position -- and DOM
                // order puts it AFTER Main Content, i.e. it renders BELOW the
                // main content when stacked, not above. The old comment and
                // border-b/lg:border-l pairing both assumed an ordering trick
                // that is not present in this code; border-t is the correct
                // divider edge for a zone that sits below its neighbor.
                'border-t lg:border-t-0 lg:border-l',
                isCalculatorMode
                  ? 'bg-[var(--db-surface)] border-[var(--db-border)]'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
                // Height-collapse when stacked, width-collapse when side by
                // side -- same reasoning as the left rail. D1 fix
                // (2026-08-15 adversarial review): this rail carried the same
                // `max-h-[2400px]` cap the left sidebar did, and the same
                // fix applies -- see the D1 comment on the left sidebar
                // wrapper above for the full reasoning (no inner scroller
                // below `lg`, so the cap clips value-search results instead
                // of scrolling them; `lg:` does not apply in print, so the
                // cap truncated printed output). Reverted; the collapse
                // snaps instead of animating below `lg`.
                effectiveShowRightPanel
                  ? cn('w-full', rightPanelOpenWidth)
                  : 'max-h-0 w-full border-t-0 lg:max-h-none lg:w-0',
              )}
              // NEW-P3-3 (a11y audit round 3): same collapse pattern as the
              // left-sidebar-wrapper and the two matrix-map panel wrappers
              // above -- w-0 + overflow-hidden alone leaves this drawer's
              // renderToolReference() content (details/summary disclosures,
              // CalculatorValueSearchPanel controls) keyboard-focusable while
              // visually clipped to zero width. inert removes it from the
              // focus/tab order (and AT) without touching the width
              // transition.
              inert={effectiveShowRightPanel ? undefined : true}
            >
              <div className={cn(rightPanelInnerWidth, 'h-full flex flex-col')}>
                <div
                  className={cn(
                    'p-5 border-b flex justify-between items-center',
                    isCalculatorMode
                      ? 'border-[var(--db-border)] bg-[var(--db-depth-1)]'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50',
                  )}
                >
                  <h3
                    className={cn(
                      'font-bold flex items-center space-x-2',
                      isCalculatorMode
                        ? 'text-[var(--db-text-primary)]'
                        : 'text-slate-900 dark:text-white',
                    )}
                  >
                    {activeTopTab === 'Calculator' ? (
                      <Database
                        className={cn(
                          'w-5 h-5',
                          isCalculatorMode
                            ? 'text-[var(--db-accent)]'
                            : 'text-sky-500',
                        )}
                      />
                    ) : (
                      <FileText className="w-5 h-5 text-sky-500" />
                    )}
                    <span>{rightPanelTitle}</span>
                  </h3>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  {renderToolReference()}
                </div>
              </div>
            </div>
          </>
        ) : isReviewMode ? (
          <div
            className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto"
            role="tabpanel"
            id={PRIMARY_TABPANEL_ID}
            aria-labelledby={primaryTabId(activeTopTab)}
            tabIndex={-1}
          >
            {renderContent()}
          </div>
        ) : isMapMode ? (
          // Interactive Map tab: full-bleed embed of the matrix-map
          // component (BN-RRM MapView pattern). flex-1 + overflow-hidden
          // so the leaflet container sizes to the available area; the
          // map's internal floating widgets (legend / tool palette /
          // count card) are absolutely positioned inside this box.
          // PR-MAP-4 + PR-MAP-5 will introduce left + right side panels
          // around the map inside this same container.
          <div
            className="flex-1 flex overflow-hidden print:hidden"
            role="tabpanel"
            id={PRIMARY_TABPANEL_ID}
            aria-labelledby={primaryTabId(activeTopTab)}
            tabIndex={-1}
          >
            {renderContent()}
          </div>
        ) : isEvidenceLibraryMode ? (
          // P2-5 (a11y audit 2026-08-14): give this branch a real tabpanel,
          // same id/aria-labelledby/tabIndex contract as its five sibling
          // branches above, so the 8-tab tablist's aria-controls IDREF is
          // never dangling when 'References & Values' is active. An
          // ordinary wrapper (not display:contents, which would drop the
          // role/id ARIA semantics) carrying the same flex layout class the
          // isMapMode/isReviewMode wrappers use; EvidenceLibrary keeps its
          // own "flex-1 w-full" so it still fills the wrapper exactly as
          // before.
          <div
            className="flex-1 flex overflow-hidden"
            role="tabpanel"
            id={PRIMARY_TABPANEL_ID}
            aria-labelledby={primaryTabId(activeTopTab)}
            tabIndex={-1}
          >
            <EvidenceLibrary
              filters={evidenceLibraryFilters}
              onFiltersChange={handleEvidenceLibraryFiltersChange}
              regulatoryFrameId={jurisdiction}
              calculatorReceipt={calculatorReceipt}
              onDismissReceipt={handleDismissReceipt}
              showLeftPanel={!isMobile && showLeftPanel}
              showRightPanel={!isMobile && showRightPanel}
              onRequestOpenRightPanel={isMobile ? undefined : () => setShowRightPanel(true)}
              className="flex-1 w-full"
            />
          </div>
        ) : isSsdWorkbenchMode ? (
          <div
            className="flex-1 overflow-y-auto bg-white dark:bg-slate-950"
            role="tabpanel"
            id={PRIMARY_TABPANEL_ID}
            aria-labelledby={primaryTabId(activeTopTab)}
            tabIndex={-1}
          >
            <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-8">
              {renderContent()}
            </div>
          </div>
        ) : (
          <div
            className={`flex-1 overflow-y-auto ${activeTopTab === 'The Guide' ? 'bg-slate-50' : 'bg-white'} dark:bg-slate-900`}
            role="tabpanel"
            id={PRIMARY_TABPANEL_ID}
            aria-labelledby={primaryTabId(activeTopTab)}
            // NEW-P3-2 (a11y audit 2026-08-14): this wrapper serves two
            // different tabs with different focusable-content shapes. 'The
            // Guide' always renders Phase2TasksSection's Expand-all /
            // Collapse-all / per-task toggle buttons, so it already has a
            // keyboard path in and tabIndex={-1} (per APG) is correct.
            // The Vision tab USED to need tabIndex={0}: ConceptualMatrix had no
            // interactive elements, so without it a keyboard user could not focus
            // the panel to scroll it. That is no longer true -- the rebuilt Vision
            // page gives every receptor-pathway a <details>/<summary> disclosure,
            // which is focusable. Per APG, a tabpanel that CONTAINS focusable
            // children must not itself be in the tab order, so it now takes
            // tabIndex={-1} like every other tab. Leaving it at 0 would insert a
            // redundant stop before the four disclosures.
            tabIndex={-1}
          >
            {/* The Vision tab joins The Guide at the wider measure. Its content is a
                2x2 matrix of four content-bearing quadrants, which at max-w-4xl left
                the quadrants cramped and the page mostly empty on a desktop display.
                Prose-only tabs keep the narrower, more readable measure. */}
            {/* Audit #20 (layer 1 of 2): `px-8 py-12` was unconditional, and on The Guide it
                stacked with the section cards' own `p-8` (:1409). The max-width switch above
                is unaffected -- only the padding scale is now viewport-dependent. */}
            <div
              data-testid="matrix-content-measure"
              className={`${activeTopTab === 'The Guide' || activeTopTab === 'Vision for Modernizing Schedule 3.4' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-4 py-8 lg:px-8 lg:py-12`}
            >
              {renderContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Matrix Map left and right panels live in src/components/matrix-options
// so map selection, identify results, and measurement workbench state do
// not bloat this dashboard shell.
