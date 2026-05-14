// engine_v2 frontend Lane 2d / Phase A: side-panel shell.
//
// Right-edge resizable side panel mounted on the evaluation page. Three
// tabs: Ask AI (placeholder, Phase D), Search submission (placeholder,
// Phase C), Search policies (relocated PolicySearchPanel).
//
// Discoverability + accessibility (ED-2d4-14):
//   - Labels + icons on the collapsed rail (never icon-only).
//   - role=tablist, role=tab, aria-selected on the tab strip.
//   - aria-expanded on the collapse toggle.
//   - Arrow keys cycle tabs when the tab strip is focused.
//   - Cmd+K / Ctrl+K opens panel and focuses the omni-input.
//   - Cmd+J / Ctrl+J toggles open/closed.
//   - Esc closes (state preserved in localStorage).
//
// Responsive (ED-2d4-10):
//   - Above 1200px viewport, the panel is a resizable split pane on
//     the right edge (default ~35% viewport, min 320px, max 60%).
//     The panel is a flex/grid sibling that reserves layout space; main
//     content reflows to share the viewport with the panel.
//   - Below 1200px, the panel falls back to a full-height drawer
//     overlay (position: fixed) so it does not crowd narrow viewports;
//     in drawer mode main content does NOT reflow.
//   - Breakpoint is read from a debounced (150ms) ResizeObserver.
//
// State (ED-2d4-9):
//   - useSidePanelState persists open/activeTab/lastQueryPerTab/
//     chatMode per evaluation, width globally. SSR-safe; Zod-validated.
//
// Mount contract (ED-2d4-12):
//   - This phase is the ONLY phase that edits the evaluation page.
//     Phases C/D/E populate the tabs by editing files inside the
//     side-panel tree and consuming SidePanelContext.
//
// ASCII only.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
  X,
} from "lucide-react";

import { AskAiTab } from "./AskAiTab";
import { SubmissionSearchTab } from "./SubmissionSearchTab";
import { PolicySearchTab } from "./PolicySearchTab";
// Lane 2d / Phase E: PeekPanel mounts inside the side panel container
// so its absolute positioning resolves to the panel's bounds (the
// outer panel div is sticky/fixed, which creates a containing block).
// Phase E owns this mount per its explicit allowlist exception to the
// ED-2d4-12 Phase A mount contract.
import { PeekPanel } from "./PeekPanel";
import {
  createGlobalKeydownHandler,
  nextTabFromArrowKey,
} from "./side-panel-keymap";
import {
  MAX_WIDTH_RATIO,
  MIN_WIDTH_PX,
  useSidePanelState,
  type SidePanelTab,
} from "./useSidePanelState";

const DRAWER_BREAKPOINT_PX = 1200;
const RESIZE_DEBOUNCE_MS = 150;

interface TabDefinition {
  id: SidePanelTab;
  label: string;
}

const TAB_DEFS: readonly TabDefinition[] = [
  { id: "ask", label: "Ask AI" },
  { id: "search-sub", label: "Search submission" },
  { id: "search-pol", label: "Search policies" },
];

export interface EvaluationSidePanelProps {
  evaluationId: string;
  projectId: string;
}

export function EvaluationSidePanel({
  evaluationId,
  projectId,
}: EvaluationSidePanelProps): ReactElement {
  const state = useSidePanelState(evaluationId);
  const {
    open,
    setOpen,
    toggleOpen,
    activeTab,
    setActiveTab,
    width,
    setWidth,
  } = state;

  // -- Drawer breakpoint detection (debounced ResizeObserver) ---------------

  const [viewportWidth, setViewportWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 1440;
    return window.innerWidth;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const apply = (): void => {
      setViewportWidth(window.innerWidth);
    };
    const ro = new ResizeObserver(() => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(apply, RESIZE_DEBOUNCE_MS);
    });
    ro.observe(document.documentElement);
    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      ro.disconnect();
    };
  }, []);

  const isDrawer = viewportWidth < DRAWER_BREAKPOINT_PX;

  // -- Computed width clamp (max ratio resolves against viewport) -----------

  const effectiveWidth = useMemo(() => {
    const maxWidth = Math.floor(viewportWidth * MAX_WIDTH_RATIO);
    return Math.max(MIN_WIDTH_PX, Math.min(width, maxWidth));
  }, [width, viewportWidth]);

  // -- Focus management for the omni-input ----------------------------------

  const tabContentRef = useRef<HTMLDivElement | null>(null);

  const focusOmniInput = useCallback(() => {
    // Phase A: there is no real omni-input yet for Ask AI / submission
    // search; Phase C/D wire that. For the policies tab, the existing
    // PolicySearchPanel owns its own input. We attempt to focus the
    // first input inside the active tab content as a best-effort.
    requestAnimationFrame(() => {
      const root = tabContentRef.current;
      if (!root) return;
      const candidate = root.querySelector<HTMLElement>(
        'input, textarea, [data-side-panel-omni-input="true"]',
      );
      if (candidate) {
        candidate.focus();
      }
    });
  }, []);

  // -- Global keymap (Cmd+K, Cmd+J, Esc) ------------------------------------

  useEffect(() => {
    const handler = createGlobalKeydownHandler({
      onOpenAndFocus: () => {
        setOpen(true);
        focusOmniInput();
      },
      onToggleOpen: () => {
        toggleOpen();
      },
      onClose: () => {
        if (open) {
          setOpen(false);
        }
      },
    });
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, [open, setOpen, toggleOpen, focusOmniInput]);

  // -- Tab strip arrow-key navigation ---------------------------------------

  const handleTabStripKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLDivElement>) => {
      const nextTab = nextTabFromArrowKey(ev.key, activeTab);
      if (nextTab) {
        ev.preventDefault();
        setActiveTab(nextTab);
      }
    },
    [activeTab, setActiveTab],
  );

  // -- Resize drag handle ---------------------------------------------------

  const resizingRef = useRef(false);

  const onResizeHandleMouseDown = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>) => {
      if (isDrawer) return;
      ev.preventDefault();
      resizingRef.current = true;
      const startX = ev.clientX;
      const startWidth = effectiveWidth;

      const onMouseMove = (mv: MouseEvent): void => {
        if (!resizingRef.current) return;
        // Dragging the LEFT edge: leftward = wider, rightward = narrower.
        const delta = startX - mv.clientX;
        const nextWidth = startWidth + delta;
        setWidth(nextWidth);
      };
      const onMouseUp = (): void => {
        resizingRef.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [isDrawer, effectiveWidth, setWidth],
  );

  // -- Render ---------------------------------------------------------------

  if (!open) {
    return (
      <CollapsedRail
        onExpand={() => {
          setOpen(true);
          focusOmniInput();
        }}
      />
    );
  }

  // In split mode (>=1200px), the panel renders as a flex sibling of the
  // main content (see evaluation page ED-2d4-12 mount). It reserves
  // layout space via flex-basis = effectiveWidth, so the main column
  // reflows to share the viewport. flex-shrink:0 prevents the column from
  // squashing the panel below MIN_WIDTH_PX when content is wide.
  //
  // In drawer mode (<1200px), the panel is a position:fixed full-height
  // overlay. Main content does not reflow at that breakpoint per
  // ED-2d4-10 (drawer fallback is deliberately overlay so narrow
  // viewports do not have to give up half their width).
  const panelStyle: React.CSSProperties = isDrawer
    ? { width: "100%" }
    : {
        width: `${effectiveWidth}px`,
        flex: `0 0 ${effectiveWidth}px`,
      };

  return (
    <div
      data-testid="evaluation-side-panel"
      data-side-panel-mode={isDrawer ? "drawer" : "split"}
      className={
        isDrawer
          ? "fixed inset-0 z-40 flex flex-col bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700"
          : "sticky top-0 self-start h-screen z-30 flex flex-row bg-white dark:bg-slate-900 shadow-xl border-l border-slate-200 dark:border-slate-700"
      }
      style={panelStyle}
      role="complementary"
      aria-label="Search and Ask side panel"
    >
      {!isDrawer ? (
        <div
          data-testid="side-panel-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize side panel"
          onMouseDown={onResizeHandleMouseDown}
          className="w-1 cursor-col-resize bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
        />
      ) : null}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-3 py-2">
          <div
            data-testid="side-panel-tablist"
            role="tablist"
            aria-label="Side panel tabs"
            tabIndex={0}
            onKeyDown={handleTabStripKeyDown}
            className="flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            {TAB_DEFS.map((t) => {
              const selected = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  data-testid={`side-panel-tab-${t.id}`}
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`side-panel-panel-${t.id}`}
                  id={`side-panel-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  className={
                    "px-2 py-1 text-sm rounded transition-colors " +
                    (selected
                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 font-semibold"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            data-testid="side-panel-collapse-toggle"
            type="button"
            aria-expanded={true}
            aria-controls="side-panel-body"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Collapse side panel"
          >
            {isDrawer ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            )}
            <span>Collapse</span>
          </button>
        </div>

        <div
          id="side-panel-body"
          ref={tabContentRef}
          data-testid="side-panel-body"
          className="flex-1 min-h-0 overflow-hidden"
        >
          {TAB_DEFS.map((t) => {
            const selected = t.id === activeTab;
            return (
              <div
                key={t.id}
                role="tabpanel"
                id={`side-panel-panel-${t.id}`}
                aria-labelledby={`side-panel-tab-${t.id}`}
                hidden={!selected}
                className="h-full"
              >
                {selected ? renderTab(t.id, evaluationId, projectId) : null}
              </div>
            );
          })}
        </div>
      </div>
      {/* Lane 2d / Phase E: peek panel overlay. Renders only when
          peekChunk is non-null in SidePanelContext. Positions itself
          absolutely against the outer panel container (which is
          sticky/fixed and therefore a containing block). */}
      <PeekPanel evaluationId={evaluationId} />
    </div>
  );
}

function renderTab(
  tab: SidePanelTab,
  evaluationId: string,
  projectId: string,
): ReactElement {
  if (tab === "ask") {
    return <AskAiTab evaluationId={evaluationId} />;
  }
  if (tab === "search-sub") {
    return <SubmissionSearchTab evaluationId={evaluationId} />;
  }
  return <PolicySearchTab projectId={projectId} />;
}

// localStorage key that gates the one-time first-launch tooltip on the
// collapsed rail. Once set, the tooltip never re-appears.
const RAIL_TOOLTIP_SEEN_KEY = "engine_v2.side_panel.rail_tooltip_seen";

interface CollapsedRailProps {
  onExpand: () => void;
}

function CollapsedRail({ onExpand }: CollapsedRailProps): ReactElement {
  // Show the first-launch nudge tooltip unless the user has already
  // dismissed it (localStorage flag) or opened the panel before.
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  useEffect(() => {
    // SSR guard: localStorage is not available in server context.
    if (typeof window === "undefined") return;
    // In strict private browsing (Firefox/Safari), localStorage access throws
    // a SecurityError synchronously. Treat any storage error as "not seen" so
    // the tooltip is shown but the failure is recorded via console.warn.
    try {
      const seen = window.localStorage.getItem(RAIL_TOOLTIP_SEEN_KEY);
      if (!seen) {
        setShowTooltip(true);
      }
    } catch {
      // SecurityError or QuotaExceededError: proceed as first-launch so the
      // tooltip is shown. Do not crash the component.
      console.warn("[EvaluationSidePanel] localStorage read failed; showing tooltip as first-launch.");
      setShowTooltip(true);
    }
  }, []);

  const dismissTooltip = useCallback((): void => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(RAIL_TOOLTIP_SEEN_KEY, "1");
      } catch {
        // SecurityError or QuotaExceededError: the dismissal cannot be
        // persisted. The tooltip will re-appear on next load in this
        // private-browsing context, which is acceptable.
        console.warn("[EvaluationSidePanel] localStorage write failed; tooltip dismissal not persisted.");
      }
    }
    setShowTooltip(false);
  }, []);

  const handleExpand = useCallback((): void => {
    dismissTooltip();
    onExpand();
  }, [dismissTooltip, onExpand]);

  return (
    <div
      data-testid="side-panel-collapsed-rail"
      className="fixed top-1/2 right-0 -translate-y-1/2 z-30"
    >
      {showTooltip && (
        <div
          data-testid="side-panel-rail-tooltip"
          role="tooltip"
          className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-48 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 shadow-lg"
        >
          <p className="font-medium text-indigo-700 dark:text-indigo-300">
            Search and Ask
          </p>
          <p className="mt-1">
            Click these tabs for Search submission, Ask AI, and Citation peek.
          </p>
          <button
            type="button"
            data-testid="side-panel-rail-tooltip-dismiss"
            onClick={dismissTooltip}
            className="mt-2 text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Got it
          </button>
        </div>
      )}
      <button
        data-testid="side-panel-expand-toggle"
        type="button"
        onClick={handleExpand}
        aria-expanded={false}
        aria-controls="side-panel-body"
        aria-label="Search and Ask side panel; press Enter to expand"
        className="flex flex-col items-center gap-2 rounded-l-lg border border-r-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-3 shadow-md text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ writingMode: "vertical-rl" }}
        >
          Search and Ask
        </span>
        <Search className="w-4 h-4" aria-hidden="true" />
        <MessageSquare className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default EvaluationSidePanel;
