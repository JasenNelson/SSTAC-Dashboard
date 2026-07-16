'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Database, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import MatrixMapLoader from '@/app/(dashboard)/matrix-map/MatrixMapLoader';
import PartialVisibilityBanner from '@/app/(dashboard)/matrix-map/PartialVisibilityBanner';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData, type MatrixSample } from '@/app/(dashboard)/matrix-map/types';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';
import BackgroundAdjustment from './matrix-options/BackgroundAdjustment';
import EcoDirectEqPCalculator from './matrix-options/EcoDirectEqPCalculator';
import EcoFoodBSAFCalculator from './matrix-options/EcoFoodBSAFCalculator';
import HHDirectContactCalculator from './matrix-options/HHDirectContactCalculator';
import HHFoodWebCalculator from './matrix-options/HHFoodWebCalculator';
import CumulativeEffectsCalculator from './matrix-options/CumulativeEffectsCalculator';
import EvidenceLibrary from './matrix-options/EvidenceLibrary';
import SsdWorkbench from './matrix-options/SsdWorkbench';
import Phase2TasksSection from './matrix-options/Phase2TasksSection';
import CalculatorValueSearchPanel from './matrix-options/CalculatorValueSearchPanel';
import CategorySelector from './matrix-options/CategorySelector';
import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from './matrix-options/SharedGlobalInputs';
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
}

const TABS = ['The Guide', 'Conceptual Model', 'Jurisdictional Frameworks', 'TWG Review', 'Interactive Map', 'Calculator', 'SSD Workbench', 'References & Values'];
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

export default function MatrixDashboard({ eqpCaseStudyContent, bsafCaseStudyContent, humanHealthContent, guideContent, finalDraftContent, initialMapData = EMPTY_MATRIX_MAP_DATA, fetchErrorMessage = null }: MatrixDashboardProps) {
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
  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((current) => {
      if (current) setMatrixMapWorkbenchFocused(false);
      return !current;
    });
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
  const rightPanelOpenWidth =
    activeTopTab === 'Calculator' ? 'w-96' : 'w-80';
  const rightPanelInnerWidth =
    activeTopTab === 'Calculator' ? 'w-[384px]' : 'w-[320px]';

  const renderSidebar = () => {
    switch (activeTopTab) {
      case 'Jurisdictional Frameworks':
        return (
          <ul className="space-y-2">
            {JURISDICTIONAL_SIDE_TABS.map((tab) => (
              <li
                key={tab}
                onClick={() => setActiveSideTab(tab)}
                className={`p-3 rounded-lg cursor-pointer font-medium transition-colors ${
                  activeSideTab === tab
                    ? 'bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 font-semibold text-sky-700 dark:text-sky-400'
                    : 'hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab}
              </li>
            ))}
          </ul>
        );
      case 'Calculator': {
        const tierContent = GUIDE_TIER_CONTENT[activeTier];
        return (
          <div
            className="space-y-5"
            data-testid="calculator-guide-sidebar"
          >
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
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
              Screening-only outputs still require professional judgment before
              regulator-facing use.
            </div>
          </div>
        );
      }
      case 'The Guide':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Use the guide to understand the project phases, workspace tabs, and key terms.</p>;
      case 'Conceptual Model':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Review how pathways, receptors, and site conditions fit together.</p>;
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
      ? 'CALCULATOR GUIDE'
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
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-800 dark:text-slate-100">
                      {eq.equation_latex}
                    </pre>
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
          <div className="space-y-6">
            <div className="bg-sky-50 dark:bg-sky-900/20 border-l-4 border-sky-500 p-4 rounded-r-lg">
              <p className="text-sm text-sky-800 dark:text-sky-200 font-medium">
                Currently reviewing the <span className="font-bold">{activeSideTab}</span> methodology. Scroll to locate specific regulatory derivations within the document below.
              </p>
            </div>
            <MathRenderer content={contentToRender} />
          </div>
        );
      case 'The Guide':
        return (
          <div className="space-y-6">
            <MathRenderer content={guideContent} />
            <Phase2TasksSection />
          </div>
        );
      case 'Conceptual Model':
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
              Calculator-tab vertical flow:
                1. CategorySelector (1x4 row at top)
                2. SharedGlobalInputs (substance + jurisdiction selectors)
                3. Active category calculator (switches on activeCategory)
                4. BackgroundAdjustment (post-derivation panel)
            */}
            <CategorySelector
              activeCategory={activeCategory}
              onChange={setActiveCategory}
            />
            <SharedGlobalInputs
              substanceKey={substanceKey}
              jurisdiction={jurisdiction}
              onSubstanceKeyChange={setSubstanceKey}
              onJurisdictionChange={setJurisdiction}
            />
            {activeCategory === 'eco-direct' && (
              <EcoDirectEqPCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              />
            )}
            {activeCategory === 'eco-food' && (
              <EcoFoodBSAFCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              />
            )}
            {activeCategory === 'hh-direct' && (
              <HHDirectContactCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
              />
            )}
            {activeCategory === 'hh-food' && (
              <HHFoodWebCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
                onOpenEvidenceLibrary={handleOpenEvidenceLibrary}
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
          <nav className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTopTab(tab)}
                className={cn('relative flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap', activeTopTab === tab ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-600/50')}
              >
                <span>{TAB_LABELS[tab] ?? tab}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 ml-auto pl-4 border-l border-slate-200 dark:border-slate-700">
           {(isToolMode || isReviewMode || (isEvidenceLibraryMode && !isMobile) || (isMapMode && !isMobile)) && (
             <>
               <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'} aria-label={showLeftPanel ? 'Hide left panel' : 'Show left panel'}>
                 {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
               </button>
               <button onClick={toggleRightPanel} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide right panel' : 'Show right panel'} aria-label={showRightPanel ? 'Hide right panel' : 'Show right panel'}>
                 {showRightPanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
               </button>
             </>
           )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden print:block print:overflow-visible print:h-auto">
        {isToolMode ? (
          <>
            {/* Left Sidebar */}
            <div
              data-testid="left-sidebar-wrapper"
              className={cn(
                'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800',
                showLeftPanel ? 'w-80 p-6' : 'w-0',
                // Plan v3 section 4.2 + section 10: hide the entire left
                // sidebar when printing the Calculator tab so window.print()
                // produces a chrome-free PDF anchored on the calculator
                // body + Background Adjustment panel.
                hideSidebarOnPrint && 'print:hidden',
              )}
            >
              <div className="w-full min-w-[270px]">
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">{leftSidebarHeading}</h3>
                {renderSidebar()}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 p-8">
              {renderContent()}
            </div>

            {/* Right Drawer */}
            <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl', showRightPanel ? rightPanelOpenWidth : 'w-0')}>
              <div className={cn(rightPanelInnerWidth, 'h-full flex flex-col')}>
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    {activeTopTab === 'Calculator' ? (
                      <Database className="w-5 h-5 text-sky-500" />
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
          <div className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto">
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
          <div className="flex-1 flex overflow-hidden print:hidden">
            {renderContent()}
          </div>
        ) : isEvidenceLibraryMode ? (
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
        ) : isSsdWorkbenchMode ? (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:px-8">
              {renderContent()}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
            <div className="max-w-4xl mx-auto px-8 py-12">
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
