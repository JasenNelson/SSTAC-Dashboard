// engine_v2 frontend Lane 2d / Phase A: useSidePanelState.
//
// localStorage-backed state hook for the evaluation page side panel.
// Per-eval keys (open / activeTab / lastQueryPerTab / chatMode); width
// is GLOBAL (ED-2d4-9). All reads are Zod-validated so corrupted
// localStorage payloads fall back to defaults rather than crashing the
// page. SSR-safe (guards typeof window === 'undefined'). Stores UI
// state only; v2_chat_logs remain PARKED per plan v0.5.
//
// ASCII only.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

export type SidePanelTab = "ask" | "search-sub" | "search-pol";
export type ChatMode = "fast" | "thinking";

export const SIDE_PANEL_TABS: readonly SidePanelTab[] = [
  "ask",
  "search-sub",
  "search-pol",
] as const;

/** Per-evaluation persisted state. */
export interface PerEvalSidePanelState {
  open: boolean;
  activeTab: SidePanelTab;
  lastQueryPerTab: Partial<Record<SidePanelTab, string>>;
  chatMode: ChatMode;
}

/** Global persisted state (not scoped to evaluation_id). */
export interface GlobalSidePanelState {
  width: number;
}

const DEFAULT_PER_EVAL: PerEvalSidePanelState = {
  open: false,
  activeTab: "ask",
  lastQueryPerTab: {},
  chatMode: "fast",
};

/** ~35% of a 1440 viewport; clamped by min/max at runtime. */
const DEFAULT_WIDTH_PX = 504;
export const MIN_WIDTH_PX = 320;
export const MAX_WIDTH_RATIO = 0.6;

const DEFAULT_GLOBAL: GlobalSidePanelState = {
  width: DEFAULT_WIDTH_PX,
};

const PerEvalSchema = z.object({
  open: z.boolean(),
  activeTab: z.enum(["ask", "search-sub", "search-pol"]),
  // Partial record: any subset of the three tab keys is valid; missing
  // keys mean no last-query is persisted for that tab yet.
  lastQueryPerTab: z
    .object({
      ask: z.string().optional(),
      "search-sub": z.string().optional(),
      "search-pol": z.string().optional(),
    })
    .default({}),
  chatMode: z.enum(["fast", "thinking"]),
});

const GlobalSchema = z.object({
  width: z.number().int().positive(),
});

function perEvalKey(evaluationId: string): string {
  return `engine_v2.side_panel.per_eval.${evaluationId}`;
}

const GLOBAL_KEY = "engine_v2.side_panel.global";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readPerEval(evaluationId: string): PerEvalSidePanelState {
  if (!isBrowser()) return DEFAULT_PER_EVAL;
  try {
    const raw = window.localStorage.getItem(perEvalKey(evaluationId));
    if (!raw) return DEFAULT_PER_EVAL;
    const parsed = JSON.parse(raw) as unknown;
    const result = PerEvalSchema.safeParse(parsed);
    if (!result.success) return DEFAULT_PER_EVAL;
    return result.data;
  } catch {
    return DEFAULT_PER_EVAL;
  }
}

function readGlobal(): GlobalSidePanelState {
  if (!isBrowser()) return DEFAULT_GLOBAL;
  try {
    const raw = window.localStorage.getItem(GLOBAL_KEY);
    if (!raw) return DEFAULT_GLOBAL;
    const parsed = JSON.parse(raw) as unknown;
    const result = GlobalSchema.safeParse(parsed);
    if (!result.success) return DEFAULT_GLOBAL;
    return result.data;
  } catch {
    return DEFAULT_GLOBAL;
  }
}

function writePerEval(evaluationId: string, state: PerEvalSidePanelState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(perEvalKey(evaluationId), JSON.stringify(state));
  } catch {
    // Quota exceeded or private mode: silently degrade; in-memory state
    // remains correct for the session.
  }
}

function writeGlobal(state: GlobalSidePanelState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(GLOBAL_KEY, JSON.stringify(state));
  } catch {
    // Same degrade-silently policy as writePerEval.
  }
}

export interface UseSidePanelStateResult {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggleOpen: () => void;

  activeTab: SidePanelTab;
  setActiveTab: (next: SidePanelTab) => void;

  lastQueryPerTab: Partial<Record<SidePanelTab, string>>;
  setLastQuery: (tab: SidePanelTab, query: string) => void;

  chatMode: ChatMode;
  setChatMode: (next: ChatMode) => void;

  width: number;
  setWidth: (next: number) => void;

  /** True after the initial localStorage hydration pass completes. */
  hydrated: boolean;
}

/**
 * Hook returning persistent panel state. Hydration is deferred to a
 * useEffect on mount so SSR markup matches the first client render
 * (Lane 1 Finding 50 hydration pattern).
 */
export function useSidePanelState(evaluationId: string): UseSidePanelStateResult {
  const [perEval, setPerEval] = useState<PerEvalSidePanelState>(DEFAULT_PER_EVAL);
  const [global, setGlobal] = useState<GlobalSidePanelState>(DEFAULT_GLOBAL);
  const [hydrated, setHydrated] = useState(false);

  // Track the evaluation_id so a navigation between evaluations does not
  // bleed previous-eval state into the new mount.
  const evalRef = useRef(evaluationId);

  useEffect(() => {
    evalRef.current = evaluationId;
    setPerEval(readPerEval(evaluationId));
    setGlobal(readGlobal());
    setHydrated(true);
  }, [evaluationId]);

  // Functional updater form so consecutive setters inside a single
  // React batch read the latest in-flight state, not the stale closure
  // value from the render that produced these callbacks. The localStorage
  // write must therefore happen INSIDE the updater so the persisted
  // payload matches what we just dispatched.
  const updatePerEval = useCallback(
    (mutate: (prev: PerEvalSidePanelState) => PerEvalSidePanelState) => {
      setPerEval((prev) => {
        const next = mutate(prev);
        writePerEval(evalRef.current, next);
        return next;
      });
    },
    [],
  );

  const updateGlobal = useCallback(
    (mutate: (prev: GlobalSidePanelState) => GlobalSidePanelState) => {
      setGlobal((prev) => {
        const next = mutate(prev);
        writeGlobal(next);
        return next;
      });
    },
    [],
  );

  const setOpen = useCallback(
    (next: boolean) => {
      updatePerEval((prev) => ({ ...prev, open: next }));
    },
    [updatePerEval],
  );

  const toggleOpen = useCallback(() => {
    updatePerEval((prev) => ({ ...prev, open: !prev.open }));
  }, [updatePerEval]);

  const setActiveTab = useCallback(
    (next: SidePanelTab) => {
      updatePerEval((prev) => ({ ...prev, activeTab: next }));
    },
    [updatePerEval],
  );

  const setLastQuery = useCallback(
    (tab: SidePanelTab, query: string) => {
      updatePerEval((prev) => ({
        ...prev,
        lastQueryPerTab: { ...prev.lastQueryPerTab, [tab]: query },
      }));
    },
    [updatePerEval],
  );

  const setChatMode = useCallback(
    (next: ChatMode) => {
      updatePerEval((prev) => ({ ...prev, chatMode: next }));
    },
    [updatePerEval],
  );

  const setWidth = useCallback(
    (next: number) => {
      // Clamp on write; max ratio resolves at render time using the
      // viewport, so we only enforce the absolute MIN here.
      const clamped = Math.max(MIN_WIDTH_PX, Math.floor(next));
      updateGlobal(() => ({ width: clamped }));
    },
    [updateGlobal],
  );

  return {
    open: perEval.open,
    setOpen,
    toggleOpen,

    activeTab: perEval.activeTab,
    setActiveTab,

    lastQueryPerTab: perEval.lastQueryPerTab,
    setLastQuery,

    chatMode: perEval.chatMode,
    setChatMode,

    width: global.width,
    setWidth,

    hydrated,
  };
}

// Exported for testing.
export const __test__ = {
  perEvalKey,
  GLOBAL_KEY,
  DEFAULT_PER_EVAL,
  DEFAULT_GLOBAL,
  PerEvalSchema,
  GlobalSchema,
};
