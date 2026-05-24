'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { Database, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import MatrixMapLoader from '@/app/(dashboard)/matrix-map/MatrixMapLoader';
import PartialVisibilityBanner from '@/app/(dashboard)/matrix-map/PartialVisibilityBanner';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData } from '@/app/(dashboard)/matrix-map/types';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';
import BackgroundAdjustment from './matrix-options/BackgroundAdjustment';
import EcoDirectEqPCalculator from './matrix-options/EcoDirectEqPCalculator';
import EcoFoodBSAFCalculator from './matrix-options/EcoFoodBSAFCalculator';
import HHDirectContactCalculator from './matrix-options/HHDirectContactCalculator';
import HHFoodWebCalculator from './matrix-options/HHFoodWebCalculator';
import EvidenceLibrary from './matrix-options/EvidenceLibrary';
import SsdWorkbench from './matrix-options/SsdWorkbench';
import CalculatorValueSearchPanel from './matrix-options/CalculatorValueSearchPanel';
import CategorySelector from './matrix-options/CategorySelector';
import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from './matrix-options/SharedGlobalInputs';
import {
  createEvidenceLibraryFilters,
} from '@/lib/matrix-options/provenance/library';
import type {
  EvidenceLibraryFilterRequest,
  EvidenceLibraryFilters,
  ProvenancePathway,
} from '@/lib/matrix-options/provenance/types';
import {
  isMatrixCategory,
  type MatrixCategory,
} from './matrix-options/guide/content/types';
import {
  ALL_JURISDICTIONS,
  DEFAULT_JURISDICTION,
  JURISDICTION_OPTIONS,
  coerceJurisdiction,
  isJurisdiction,
  type Jurisdiction,
} from './matrix-options/guide/content/jurisdictions';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import { MatrixMapLeftPanel } from './matrix-options/MatrixMapLeftPanel';
import { MatrixMapRightPanel } from './matrix-options/MatrixMapRightPanel';
import { MatrixMapMobileFallback } from './matrix-options/MatrixMapMobileFallback';
import { useIsMobile } from '@/hooks/useIsMobile';

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
      'Use this tab to compare screening-level sediment standards by pathway, substance, and jurisdictional frame.',
    bullets: [
      'All four pathways provide screening calculations today.',
      'Each pathway shows the assumptions behind the result.',
      'Background Adjustment compares the pathway result with reference-site background.',
    ],
  },
  practitioner: {
    title: 'Review workflow',
    summary:
      'Pick the pathway, confirm the shared substance and jurisdiction, then read the hero result before expanding the technical details.',
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
const LS_KEY_JURISDICTION = 'matrix-options-jurisdiction-v1';
const MATRIX_ADMIN_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_MATRIX_ADMIN_CONTACT_EMAIL;
const MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH = 360;
const MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH = 480;
const MATRIX_MAP_RIGHT_PANEL_MAX_WIDTH = 720;
const MATRIX_MAP_MIN_MAP_WIDTH = 360;
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

function clampMatrixMapRightPanelWidth(width: number, showLeftPanel: boolean) {
  if (typeof window === 'undefined') {
    return Math.min(
      MATRIX_MAP_RIGHT_PANEL_MAX_WIDTH,
      Math.max(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH, width),
    );
  }

  const leftPanelWidth = showLeftPanel ? 320 : 0;
  const viewportMax = window.innerWidth - leftPanelWidth - MATRIX_MAP_MIN_MAP_WIDTH;
  const maxWidth = Math.max(
    MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH,
    Math.min(MATRIX_MAP_RIGHT_PANEL_MAX_WIDTH, viewportMax),
  );
  return Math.min(maxWidth, Math.max(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH, width));
}

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

function restoreJurisdiction(): Jurisdiction {
  if (typeof window === 'undefined') return DEFAULT_JURISDICTION;
  const raw = window.localStorage.getItem(LS_KEY_JURISDICTION);
  const coerced = coerceJurisdiction(raw);
  if (
    coerced &&
    isJurisdiction(coerced) &&
    (ALL_JURISDICTIONS as readonly string[]).includes(coerced)
  ) {
    return coerced;
  }
  if (raw !== null) window.localStorage.removeItem(LS_KEY_JURISDICTION);
  return DEFAULT_JURISDICTION;
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

const TABS = ['The Guide', 'Conceptual Model', 'Jurisdictional Frameworks', 'Interactive Map', 'TWG Review', 'Calculator', 'SSD Workbench', 'References & Values'];
const JURISDICTIONAL_SIDE_TABS = ['Ecological: EqP & AVS', 'Ecological: Food Web (BSAF)', 'Human Health Pathways'];

export default function MatrixDashboard({ eqpCaseStudyContent, bsafCaseStudyContent, humanHealthContent, guideContent, finalDraftContent, initialMapData = EMPTY_MATRIX_MAP_DATA, fetchErrorMessage = null }: MatrixDashboardProps) {
  const router = useRouter();
  const [activeTopTab, setActiveTopTab] = useState('The Guide');
  const [activeSideTab, setActiveSideTab] = useState('Ecological: EqP & AVS');
  // Both side panels open by default per owner UX preference 2026-05-19
  // (was: right panel hidden by default). Users can still toggle each
  // panel independently via the chrome buttons in the header.
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [matrixMapRightPanelWidth, setMatrixMapRightPanelWidth] = useState(
    MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH,
  );
  const [matrixMapWorkbenchFocused, setMatrixMapWorkbenchFocused] = useState(false);

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
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>(
    DEFAULT_JURISDICTION,
  );
  const [evidenceLibraryFilters, setEvidenceLibraryFilters] =
    useState<EvidenceLibraryFilters>(() => createEvidenceLibraryFilters());

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
    (request: EvidenceLibraryFilterRequest) => {
      setEvidenceLibraryFilters(createEvidenceLibraryFilters(request));
      setActiveTopTab('References & Values');
    },
    [],
  );
  const toggleRightPanel = useCallback(() => {
    setShowRightPanel((current) => {
      if (current) setMatrixMapWorkbenchFocused(false);
      return !current;
    });
  }, []);
  const handleRightPanelResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = matrixMapRightPanelWidth;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = startWidth + (startX - moveEvent.clientX);
        setMatrixMapRightPanelWidth(
          clampMatrixMapRightPanelWidth(nextWidth, showLeftPanel),
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
    [matrixMapRightPanelWidth, showLeftPanel],
  );

  useEffect(() => {
    setMatrixMapRightPanelWidth((current) =>
      clampMatrixMapRightPanelWidth(current, showLeftPanel),
    );
  }, [showLeftPanel]);

  useEffect(() => {
    if (!showRightPanel) setMatrixMapWorkbenchFocused(false);
  }, [showRightPanel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setMatrixMapRightPanelWidth((current) =>
        clampMatrixMapRightPanelWidth(current, showLeftPanel),
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [showLeftPanel]);

  const selectedSubstance = findSubstance(substanceKey);
  const selectedJurisdiction = JURISDICTION_OPTIONS.find(
    (option) => option.id === jurisdiction,
  );
  const calculatorPathway = CALCULATOR_PROVENANCE_PATHWAYS[activeCategory];
  const calculatorCategoryLabel = CALCULATOR_CATEGORY_LABELS[activeCategory];
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
        ? 'JURISDICTION / REGION'
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
            Jurisdictional Quick Reference
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Use the jurisdictional material to compare method choices, not to
            copy a single standard.
          </p>
        </div>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <li>Start with the selected pathway group: {activeSideTab}.</li>
          <li>Look for receptor groups, exposure routes, and endpoint choices.</li>
          <li>Note how each program handles bioavailability and uncertainty.</li>
          <li>Carry useful assumptions into the calculator for testing.</li>
        </ol>
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
                Currently reviewing the <span className="font-bold">{activeSideTab}</span> methodology. Scroll to locate specific jurisdictional derivations within the document below.
              </p>
            </div>
            <MathRenderer content={contentToRender} />
          </div>
        );
      case 'The Guide':
        return (
          <div className="space-y-6">
            <MathRenderer content={guideContent} />
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
        return (
          <div className="w-full">
            <EvidenceLibrary
              filters={evidenceLibraryFilters}
              onFiltersChange={setEvidenceLibraryFilters}
            />
          </div>
        );
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
              {/* Left panel: Selection Stats (PR-MAP-4 scaffold) */}
              <div
                data-testid="matrix-map-left-panel-wrapper"
                className={cn(
                  'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm',
                  showLeftPanel ? 'w-80' : 'w-0',
                )}
              >
                <MatrixMapLeftPanel
                  initialMapData={initialMapData}
                  substanceKey={substanceKey}
                />
              </div>

              {/* Center: map */}
              <div className="flex-1 relative">
                <MatrixMapLoader
                  initialMapData={initialMapData}
                  fetchErrorMessage={fetchErrorMessage}
                />
              </div>

              {/* Right panel: MeasurementWorkbench (PR-MAP-5 scaffold) */}
              <div
                data-testid="matrix-map-right-panel-wrapper"
                className={cn(
                  'relative transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-sm',
                  matrixMapWorkbenchFocused &&
                    'absolute inset-y-4 right-4 z-[1200] rounded-lg border border-slate-200 shadow-2xl dark:border-slate-700',
                  !showRightPanel && !matrixMapWorkbenchFocused && 'pointer-events-none',
                )}
                style={{
                  width: matrixMapWorkbenchFocused
                    ? 'min(960px, calc(100% - 96px))'
                    : showRightPanel
                      ? `${matrixMapRightPanelWidth}px`
                      : '0px',
                }}
              >
                {showRightPanel && !matrixMapWorkbenchFocused && (
                  <button
                    type="button"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize measurement workbench"
                    onPointerDown={handleRightPanelResizePointerDown}
                    className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize border-l border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none dark:hover:border-blue-700"
                  />
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
                <span>{tab}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-1 ml-auto pl-4 border-l border-slate-200 dark:border-slate-700">
           {(isToolMode || isReviewMode || (isMapMode && !isMobile)) && (
             <>
               <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'}>
                 {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
               </button>
               <button onClick={toggleRightPanel} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide right panel' : 'Show right panel'}>
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
        ) : isEvidenceLibraryMode || isSsdWorkbenchMode ? (
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
