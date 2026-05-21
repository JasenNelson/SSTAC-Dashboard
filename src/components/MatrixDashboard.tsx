'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/utils/cn';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, FileText } from 'lucide-react';
import MatrixMapLoader from '@/app/(dashboard)/matrix-map/MatrixMapLoader';
import { EMPTY_MATRIX_MAP_DATA, type MatrixMapData } from '@/app/(dashboard)/matrix-map/types';
import MathRenderer from './MathRenderer';
import ConceptualMatrix from './ConceptualMatrix';
import TWGReviewPortal from './TWGReviewPortal';
import BackgroundAdjustment from './matrix-options/BackgroundAdjustment';
import EcoDirectEqPCalculator from './matrix-options/EcoDirectEqPCalculator';
import EcoFoodBSAFCalculator from './matrix-options/EcoFoodBSAFCalculator';
import HHDirectPlaceholder from './matrix-options/HHDirectPlaceholder';
import HHFoodPlaceholder from './matrix-options/HHFoodPlaceholder';
import CategorySelector from './matrix-options/CategorySelector';
import SharedGlobalInputs, {
  DEFAULT_SUBSTANCE_KEY,
} from './matrix-options/SharedGlobalInputs';
import {
  isMatrixCategory,
  type MatrixCategory,
} from './matrix-options/guide/content/types';
import {
  ALL_JURISDICTIONS,
  DEFAULT_JURISDICTION,
  isJurisdiction,
  type Jurisdiction,
} from './matrix-options/guide/content/jurisdictions';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';

// Audience tier for the sidebar guide (PR-A3 will consume; the state +
// validate-on-load coercion is established here per kickoff memo so the
// 4-state lifted contract is in place once PR-A3 wires the sidebar).
type AudienceTier = 'general' | 'practitioner' | 'technical';
const ALL_AUDIENCE_TIERS: ReadonlyArray<AudienceTier> = [
  'general',
  'practitioner',
  'technical',
];
const DEFAULT_AUDIENCE_TIER: AudienceTier = 'general';

const LS_KEY_CATEGORY = 'matrix-options-active-category-v1';
const LS_KEY_TIER = 'matrix-options-guide-tier-v1';
const LS_KEY_SUBSTANCE = 'matrix-options-substance-v1';
const LS_KEY_JURISDICTION = 'matrix-options-jurisdiction-v1';

// Validate-on-load coercion per plan v5 Delta 1. SSR-safe (typeof window
// guard). On invalid / stale localStorage values: clear the entry so the
// next mount does not re-restore the bad value, then fall back to the
// default. Hydration runs in a mount-only useEffect to avoid Next.js
// SSR/CSR hydration mismatches; the flash from default -> restored is
// acceptable for this MVP audience scale (codex review notes accept this
// trade-off vs the complexity of useSyncExternalStore).

function restoreActiveCategory(): MatrixCategory {
  // PR-A4 HH wire-up enabled by default: all four MatrixCategory members
  // are user-selectable (eco-direct + eco-food render calculators;
  // hh-direct + hh-food render the HITL-reviewed placeholder panels).
  // The enabled-category allowlist that previously gated HH out has been
  // dropped; isMatrixCategory already validates against the full union.
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
  if (
    raw &&
    isJurisdiction(raw) &&
    (ALL_JURISDICTIONS as readonly string[]).includes(raw)
  ) {
    return raw;
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

const TABS = ['The Guide', 'Conceptual Model', 'Jurisdictional Frameworks', 'Interactive Map', 'TWG Review', 'Calculator'];
const JURISDICTIONAL_SIDE_TABS = ['Ecological: EqP & AVS', 'Ecological: Food Web (BSAF)', 'Human Health Pathways'];

export default function MatrixDashboard({ eqpCaseStudyContent, bsafCaseStudyContent, humanHealthContent, guideContent, finalDraftContent, initialMapData = EMPTY_MATRIX_MAP_DATA, fetchErrorMessage = null }: MatrixDashboardProps) {
  const [activeTopTab, setActiveTopTab] = useState('The Guide');
  const [activeSideTab, setActiveSideTab] = useState('Ecological: EqP & AVS');
  // Both side panels open by default per owner UX preference 2026-05-19
  // (was: right panel hidden by default). Users can still toggle each
  // panel independently via the chrome buttons in the header.
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);

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

  // Hydrate from localStorage on mount (client-only). Each restore* helper
  // validates the stored value against the current allowlist and clears
  // stale entries. activeTier is wired here even though PR-A2 does not
  // yet render the sidebar guide; PR-A3 will consume the state. The
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
      case 'The Guide':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Welcome to the Matrix Options Dashboard. Please read the full guide in the main content area.</p>;
      case 'Conceptual Model':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Explore the scientific and regulatory pathways in the main content area.</p>;
      case 'Interactive Map':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Geospatial visualization of sediment sample sites.</p>;
      case 'TWG Review':
        return <p className="text-sm text-slate-500 dark:text-slate-400">Workspace for formal evaluation and feedback. See the main content area.</p>;
      default:
        return null;
    }
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
      case 'Calculator':
        return (
          <div className="w-full space-y-6" data-testid="calculator-tab-content">
            {/*
              Calculator-tab vertical flow per plan v3 section 1:
                1. CategorySelector (1x4 row at top; HH disabled in PR-A2)
                2. SharedGlobalInputs (substance + jurisdiction selectors)
                3. Active category calculator (switches on activeCategory)
                4. BackgroundAdjustment (post-derivation panel; PR #127)
              Legacy DerivationSimulator is retired in this commit per
              plan v3 section 5.A.
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
              />
            )}
            {activeCategory === 'eco-food' && (
              <EcoFoodBSAFCalculator
                substanceKey={substanceKey}
                jurisdiction={jurisdiction}
              />
            )}
            {/*
              PR-A4 HH wire-up: CategorySelector enables HH categories by
              default; selecting hh-direct or hh-food renders the
              HITL-reviewed non-functional disclaimer panels (no numeric
              output, amber alert block, pointers to canonical regulatory
              science). The HH placeholders intentionally do NOT consume
              substanceKey / jurisdiction -- they render fixed disclaimer
              copy regardless of the shared inputs above. This is the
              codebase-shaped PR-A4 unblock; the prior inline "unavailable
              stub" (PR-A2 commit 6 defense-in-depth) is retired.
            */}
            {activeCategory === 'hh-direct' && <HHDirectPlaceholder />}
            {activeCategory === 'hh-food' && <HHFoodPlaceholder />}
            <div className="flex items-center gap-3 py-2" aria-hidden="true">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Background Adjustment (post-derivation)
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
            <BackgroundAdjustment />
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
        // PR-MAP-4 (this PR) ships the LAYOUT scaffold with placeholder
        // content -- so owner sees the 3-column shape immediately.
        // Selection Stats CONTENT per PLAN_V3_4_2 sec 3.5 (composition
        // line, Provincial/Site-specific Background stats with UTL
        // 95/95, censoring fraction, methodology badge, Calculator
        // action buttons) lands in PR-MAP-4-content follow-on. Same
        // pattern for PR-MAP-5 MeasurementWorkbench content.
        return (
          <div
            className="flex-1 flex overflow-hidden"
            data-testid="matrix-options-interactive-map-embed"
          >
            {/* Left panel: Selection Stats (PR-MAP-4 scaffold) */}
            <div
              data-testid="matrix-map-left-panel-wrapper"
              className={cn(
                'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm',
                showLeftPanel ? 'w-80' : 'w-0',
              )}
            >
              <MatrixMapLeftPanelScaffold />
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
                'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-sm',
                showRightPanel ? 'w-96' : 'w-0',
              )}
            >
              <MatrixMapRightPanelScaffold />
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
              Content for <span className="text-slate-700 dark:text-slate-300 font-bold">{activeTopTab}</span> is currently under construction.
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
           {(isToolMode || isReviewMode || isMapMode) && (
             <>
               <button onClick={() => setShowLeftPanel(!showLeftPanel)} className={cn('p-2 rounded-lg transition-colors', showLeftPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showLeftPanel ? 'Hide left panel' : 'Show left panel'}>
                 {showLeftPanel ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
               </button>
               <button onClick={() => setShowRightPanel(!showRightPanel)} className={cn('p-2 rounded-lg transition-colors', showRightPanel ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700')} title={showRightPanel ? 'Hide right panel' : 'Show right panel'}>
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
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">JURISDICTION / REGION</h3>
                {renderSidebar()}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 p-8">
              {renderContent()}
            </div>

            {/* Right Drawer (Smart Tray) */}
            <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl', showRightPanel ? 'w-80' : 'w-0')}>
              <div className="w-[320px] h-full flex flex-col">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Quick Reference / Polls</span>
                  </h3>
                </div>
                <div className="p-5 overflow-y-auto flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                    Live polling and reference material will dynamically appear here during active Technical Working Group (TWG) sessions.
                  </p>
                  
                  <div className="p-4 bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/50 rounded-xl">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                      </span>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Active Poll: AVS/SEM Ratio</p>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">Which molar valency multiplier for silver do you support adopting for the unified matrix framework?</p>
                    <div className="space-y-3">
                      <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all shadow-sm">
                        Support US EPA (0.5 Ag multiplier)
                      </button>
                      <button className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all shadow-sm">
                        Support ANZG (2.0 Ag multiplier)
                      </button>
                    </div>
                  </div>
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
// PR-MAP-4 Selection Stats LEFT PANEL scaffold
// ---------------------------------------------------------------------
// Owner directive 2026-05-20: ship the 3-column LAYOUT immediately so
// the matrix-options Interactive Map tab visually matches the BN-RRM
// MapView pattern. Real Selection Stats CONTENT (composition line,
// Provincial / Site-specific Background stats with UTL 95/95, censoring
// fraction, methodology badge, Calculator action buttons -- per
// PLAN_V3_4_2 section 3.5) lands in a follow-on PR-MAP-4-content PR.
//
// Scaffold is intentionally minimal: a header strip + a placeholder
// body block. Mirrors BN-RRM's SiteDetails panel chrome (header bar +
// scrollable body + footer action area) so the follow-on content PR
// drops into a familiar shape.
// ---------------------------------------------------------------------
function MatrixMapLeftPanelScaffold() {
  return (
    <div className="w-80 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Map Selection
        </p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          Selection Stats
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            PR-MAP-4 content -- coming next
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Per PLAN_V3_4_2 section 3.5: selection summary with classification
            composition; Provincial Background stats (n, mean, median, sd, min,
            max, 95th percentile, UTL 95/95, 90% UCL, censoring fraction);
            Site-specific Background stats (same 10 stats); methodology badge;
            Calculator action buttons; admin-only CSV export.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            State A: identify just fired
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            When no samples are selected but identify has fired on a WMS layer:
            scrollable identified-features list grouped by layer with
            collapse/expand and per-layer suppress filter.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// PR-MAP-5 MeasurementWorkbench RIGHT PANEL scaffold
// ---------------------------------------------------------------------
// Same scaffolding rationale as MatrixMapLeftPanelScaffold. Real content
// (tabular view of raw measurements with columns Sample / Date / Medium /
// Substance / Value / Unit / DL Flag / Censoring / Coord Quality /
// Source DRA; filter chips; pagination 100/page; click-to-zoom on map;
// admin-only CSV export -- per PLAN_V3_4_2 section 3.6) lands in
// PR-MAP-5-content follow-on.
// ---------------------------------------------------------------------
function MatrixMapRightPanelScaffold() {
  return (
    <div className="w-96 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Map Selection
        </p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          Measurement Workbench
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            PR-MAP-5 content -- coming next
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Per PLAN_V3_4_2 section 3.6: tabular view of raw measurements
            behind the current selection. Columns: Sample, Date, Medium,
            Substance, Value, Unit, DL Flag, Censoring, Coord Quality,
            Source DRA. Filter chips for medium / QA flag / date range /
            classification. Pagination at 100 rows/page. Click row to
            highlight + scroll to sample on map. Admin-only CSV export.
          </p>
        </div>
      </div>
    </div>
  );
}
