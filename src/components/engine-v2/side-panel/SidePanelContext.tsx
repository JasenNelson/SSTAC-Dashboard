// engine_v2 frontend Lane 2d / Phase A: SidePanelContext.
//
// Stable contract that downstream Lane 2d phases (C submission search,
// D ask AI, E bidirectional citation linking) reach into without
// re-editing the evaluation page (ED-2d4-12 mount contract).
//
// Phase A ships ONLY the provider + hook surface. The peek-chunk
// rendering UI itself is owned by Phase C / E; this file just owns the
// state and the open/close callbacks. The "peek" surface is a UI
// affordance for jumping a reviewer to a cited chunk.
//
// ASCII only.

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** A chunk the reviewer asked the side panel to "peek". */
export interface PeekChunk {
  /** Stable join key into v2_submission_chunks (evidence_slices map key). */
  evidenceItemId: string;
  /** Optional engine cross-reference id; not the join key. */
  sourceChunkId?: string | null;
  /** Free-form section label for the rail header. */
  docSection?: string | null;
  /** Page number for display when present. */
  pageNum?: number | null;
  /** Verbatim content snippet; rendered by Phase C/E. */
  content?: string | null;
}

/** A pending highlight target produced by the per-policy results table. */
export interface PendingHighlight {
  /** Join key into v2_submission_chunks; matches PeekChunk.evidenceItemId. */
  evidenceItemId: string;
  /** Optional policy_id used by Phase E to bias the side panel tab. */
  policyId?: string | null;
}

export interface SidePanelContextValue {
  pendingHighlight: PendingHighlight | null;
  setPendingHighlight: (next: PendingHighlight | null) => void;
  /** Phase C/E entrypoint: jump the panel to a peeked chunk. */
  openPeek: (chunk: PeekChunk) => void;
  closePeek: () => void;
  /** Currently peeked chunk, if any. */
  peekChunk: PeekChunk | null;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

export interface SidePanelProviderProps {
  children: ReactNode;
}

/**
 * Wraps both the main evaluation content column (per-policy results
 * table, telemetry sidebar) AND the EvaluationSidePanel as siblings, so
 * descendants on either side of the layout can call useSidePanel() to
 * read peekChunk / pendingHighlight or invoke openPeek (ED-2d4-12 mount
 * contract). Phase E will exercise the cross-pane path; Phase A only
 * establishes the provider scope.
 */
export function SidePanelProvider({
  children,
}: SidePanelProviderProps): React.ReactElement {
  const [pendingHighlight, setPendingHighlight] =
    useState<PendingHighlight | null>(null);
  const [peekChunk, setPeekChunk] = useState<PeekChunk | null>(null);

  const openPeek = useCallback((chunk: PeekChunk) => {
    setPeekChunk(chunk);
  }, []);

  const closePeek = useCallback(() => {
    setPeekChunk(null);
  }, []);

  const value = useMemo<SidePanelContextValue>(
    () => ({
      pendingHighlight,
      setPendingHighlight,
      openPeek,
      closePeek,
      peekChunk,
    }),
    [pendingHighlight, peekChunk, openPeek, closePeek],
  );

  return (
    <SidePanelContext.Provider value={value}>
      {children}
    </SidePanelContext.Provider>
  );
}

/**
 * Consumer hook. Returns null when called outside a provider so
 * downstream surfaces (e.g., placeholder tabs or the per-policy results
 * table mounted off-tree) can degrade gracefully.
 */
export function useSidePanel(): SidePanelContextValue | null {
  return useContext(SidePanelContext);
}

/**
 * Strict variant: throws when called outside the provider. Use inside
 * Phase C/D/E surfaces that REQUIRE the context to function.
 */
export function useSidePanelStrict(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (ctx === null) {
    throw new Error(
      "useSidePanelStrict must be used inside a <SidePanelProvider>.",
    );
  }
  return ctx;
}
