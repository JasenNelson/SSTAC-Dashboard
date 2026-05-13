// engine_v2 frontend Lane 2d / Phase E: chunk peek panel.
//
// Right-edge slide-in overlay rendered inside EvaluationSidePanel. Reads
// the currently-peeked chunk from SidePanelContext, hydrates the full
// chunk body via the chunk-detail route, and renders:
//   - Verbatim chunk content (whitespace-pre-wrap).
//   - Section + page breadcrumb.
//   - Neutral "Indigenous uses content" badge when the chunk is flagged
//     (feedback_no_tier_judgment_for_ai, 2026-05-12, HIGH AUTHORITY --
//     pathway-relevance signal, NOT a procedural/consultation gate).
//   - "Policies citing this" list from chunk-detail.cited_by.
//
// Routing:
//   - The evaluationId is passed in via the EvaluationSidePanel mount
//     (already known there) rather than discovered from useParams. This
//     avoids a hard dependency on the Next.js navigation context inside
//     a UI subtree that may be unit-tested with the SidePanelProvider
//     alone. The Phase E test suite renders this with an explicit
//     evaluationId prop; the production mount passes the same id that
//     EvaluationSidePanel already receives from the page.
//
// Esc closes the peek; the side panel itself remains mounted. Clicking
// the visible Close button has the same effect. The peek does not trap
// focus -- it is an inline disclosure, not a modal dialog.
//
// ASCII only.

"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

import { useSidePanel } from "./SidePanelContext";

export interface PeekPanelProps {
  evaluationId: string;
}

interface ChunkDetail {
  evidence_item_id: string;
  source_chunk_id: string | null;
  section: string | null;
  page: number | null;
  content: string | null;
  indigenous_flagged: boolean;
  cited_by: Array<{ policy_id: string }>;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; detail: ChunkDetail }
  | { kind: "error"; message: string };

export function PeekPanel(props: PeekPanelProps): ReactElement | null {
  const { evaluationId } = props;
  const sidePanel = useSidePanel();
  const peek = sidePanel?.peekChunk ?? null;

  const [fetchState, setFetchState] = useState<FetchState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Fetch chunk detail when peek opens / changes. We always re-fetch on
  // evidence_item_id change so a re-open on the same chunk after a
  // sleep is still consistent with the server view. The chunk-detail
  // route is cheap (one row + a small cited_by list).
  useEffect(() => {
    if (!peek) {
      setFetchState({ kind: "idle" });
      return;
    }
    // Seed from any content the caller already provided so the panel
    // renders text immediately instead of a loading flash.
    if (peek.content && peek.content.length > 0) {
      setFetchState({
        kind: "ready",
        detail: {
          evidence_item_id: peek.evidenceItemId,
          source_chunk_id: peek.sourceChunkId ?? null,
          section: peek.docSection ?? null,
          page: peek.pageNum ?? null,
          content: peek.content,
          indigenous_flagged: false,
          cited_by: [],
        },
      });
    } else {
      setFetchState({ kind: "loading" });
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const evalIdEnc = encodeURIComponent(evaluationId);
    const itemIdEnc = encodeURIComponent(peek.evidenceItemId);
    const url =
      "/api/engine-v2/evaluations/" +
      evalIdEnc +
      "/submission/chunk/" +
      itemIdEnc;

    void (async (): Promise<void> => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (abortRef.current !== controller) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setFetchState({
            kind: "error",
            message: body.error ?? "http_" + res.status,
          });
          return;
        }
        const body = (await res.json()) as ChunkDetail;
        if (abortRef.current !== controller) return;
        setFetchState({ kind: "ready", detail: body });
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        if (abortRef.current !== controller) return;
        setFetchState({
          kind: "error",
          message: err instanceof Error ? err.message : "network_error",
        });
      }
    })();

    return () => {
      controller.abort();
    };
    // Only re-fetch when the targeted evidence_item_id changes; other
    // PeekChunk fields are display-only and would cause unnecessary
    // re-fetches if included. Pulling peek.evidenceItemId directly
    // keeps the dependency identity stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluationId, peek?.evidenceItemId]);

  const onClose = useCallback((): void => {
    if (!sidePanel) return;
    sidePanel.closePeek();
  }, [sidePanel]);

  // Esc-to-close. Bound at the window level so the user does not have
  // to first move focus to the peek panel. Active only while a peek
  // is open.
  //
  // Round 2 fix (Phase E IMPORTANT 2): use CAPTURE phase and call
  // stopImmediatePropagation() + preventDefault() so the peek's Esc
  // handler runs before Phase A's bubble-phase side-panel keymap (which
  // is registered in EvaluationSidePanel.tsx via the standard
  // addEventListener('keydown', handler) bubble path). Without capture,
  // both listeners fire on Esc and the side panel closes simultaneously
  // with the peek. We intentionally intercept only when peek is open;
  // when peek is closed this listener is not mounted at all.
  useEffect(() => {
    if (!peek) return;
    const handler = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
    };
  }, [peek, onClose]);

  // Move focus to the Close button when a peek opens so keyboard users
  // can dismiss without first finding the panel. Guarded for jsdom (no
  // requestAnimationFrame in some environments) and for environments
  // where focus() is not a function.
  useEffect(() => {
    if (!peek) return;
    const el = closeButtonRef.current;
    if (el && typeof el.focus === "function") {
      el.focus();
    }
  }, [peek?.evidenceItemId, peek]);

  if (!sidePanel || !peek) return null;

  return (
    <div
      data-testid="peek-panel"
      data-evidence-item-id={peek.evidenceItemId}
      role="region"
      aria-label="Chunk peek panel"
      className={
        "absolute inset-y-0 right-0 z-40 w-[420px] max-w-full " +
        "flex flex-col bg-white dark:bg-slate-900 " +
        "border-l border-slate-200 dark:border-slate-700 shadow-2xl"
      }
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-3 py-2">
        <div
          data-testid="peek-panel-breadcrumb"
          className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate"
        >
          {peek.docSection ?? "(no section)"}
          {peek.pageNum !== null && peek.pageNum !== undefined
            ? " - p." + peek.pageNum
            : ""}
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          data-testid="peek-panel-close"
          aria-label="Close peek panel"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span>Close</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {fetchState.kind === "loading" ? (
          <div
            data-testid="peek-panel-loading"
            className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Loading chunk text...
          </div>
        ) : null}

        {fetchState.kind === "error" ? (
          <div
            data-testid="peek-panel-error"
            role="alert"
            className="text-xs text-rose-700 dark:text-rose-300 inline-flex items-start gap-2"
          >
            <AlertTriangle
              className="w-4 h-4 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>Could not load chunk ({fetchState.message}).</span>
          </div>
        ) : null}

        {fetchState.kind === "ready" ? (
          <PeekPanelBody detail={fetchState.detail} />
        ) : null}
      </div>
    </div>
  );
}

interface PeekPanelBodyProps {
  detail: ChunkDetail;
}

function PeekPanelBody(props: PeekPanelBodyProps): ReactElement {
  const { detail } = props;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {detail.indigenous_flagged ? (
          <span
            data-testid="peek-panel-indigenous-badge"
            title="Content references Indigenous uses (gardens, hunting, fishing, medicines)"
            className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 text-[10px] font-medium"
          >
            Indigenous uses content
          </span>
        ) : null}
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
          {detail.evidence_item_id}
        </span>
      </div>

      <blockquote
        data-testid="peek-panel-content"
        className="border-l-4 border-indigo-300 dark:border-indigo-500/60 pl-3 whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100"
      >
        {detail.content ?? "(no content)"}
      </blockquote>

      <div data-testid="peek-panel-cited-by">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          Policies citing this chunk
        </div>
        {detail.cited_by.length === 0 ? (
          <div
            data-testid="peek-panel-cited-by-empty"
            className="text-xs italic text-slate-400 dark:text-slate-500"
          >
            No policies cite this chunk yet.
          </div>
        ) : (
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5 list-disc list-inside">
            {detail.cited_by.map((c) => (
              <li
                key={c.policy_id}
                data-testid="peek-panel-cited-by-row"
                data-policy-id={c.policy_id}
                className="font-mono break-words"
              >
                {c.policy_id}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default PeekPanel;
