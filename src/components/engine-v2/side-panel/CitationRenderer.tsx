// engine_v2 frontend Lane 2d / Phase E: shared citation pill component.
//
// A small, accessible button that renders a single submission-chunk
// citation pill. Clicking (or Enter / Space) invokes openPeek on the
// SidePanelContext AND setPendingHighlight so the per-policy results
// table can scroll the matching row into view with a pulse animation.
//
// SCOPE LOCK (feedback_no_tier_judgment_for_ai, 2026-05-12, HIGH
// AUTHORITY): when the citation references Indigenous-uses content, the
// pill renders a NEUTRAL content-type badge ("Indigenous uses content").
// This is a pathway-relevance signal, NOT a procedural/consultation
// gate. No language alterations beyond the neutral badge.
//
// This component is the canonical citation-pill primitive going
// forward. Phase C (SubmissionSearchTab) and Phase D (AskAiTab) already
// shipped their own inline pill rendering; refactoring them to use this
// shared component is OUT OF SCOPE for Phase E and can land in a later
// hygiene pass.
//
// ASCII only.

"use client";

import { useCallback, type KeyboardEvent, type ReactElement } from "react";

import { useSidePanel } from "./SidePanelContext";

export interface CitationRendererProps {
  /** Stable join key into v2_submission_chunks. */
  evidenceItemId: string;
  /** Optional engine cross-reference id. Surfaced to openPeek only. */
  sourceChunkId?: string | null;
  /** Section label (e.g. "S2.3 Sampling Plan"). Displayed on the pill. */
  docSection?: string | null;
  /** Page number for display when present. */
  pageNum?: number | null;
  /** Indigenous-uses content flag (renders the neutral badge). */
  indigenousFlagged?: boolean;
  /** Optional positional label (e.g. "S1", "S2"); rendered as a leading chip. */
  positionLabel?: string | null;
  /** Optional tooltip override; defaults to a section/page summary. */
  title?: string | null;
  /** Optional className passthrough (defensive; primarily for tests/storybook). */
  className?: string;
}

const DEFAULT_PILL_CLASS =
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] " +
  "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 " +
  "hover:bg-indigo-200 dark:hover:bg-indigo-800 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

function buildTitle(
  section: string | null | undefined,
  page: number | null | undefined,
): string {
  const sec = section && section.length > 0 ? section : "unknown section";
  if (page !== null && page !== undefined) {
    return sec + " - p." + page;
  }
  return sec;
}

export function CitationRenderer(props: CitationRendererProps): ReactElement {
  const {
    evidenceItemId,
    sourceChunkId = null,
    docSection = null,
    pageNum = null,
    indigenousFlagged = false,
    positionLabel = null,
    title = null,
    className = DEFAULT_PILL_CLASS,
  } = props;
  const sidePanel = useSidePanel();

  const activate = useCallback((): void => {
    if (!sidePanel) return;
    sidePanel.openPeek({
      evidenceItemId,
      sourceChunkId,
      docSection,
      pageNum,
      // Phase E will hydrate content via the chunk-detail endpoint when
      // the peek panel opens; the pill itself does not fetch.
      content: null,
    });
    sidePanel.setPendingHighlight({ evidenceItemId });
  }, [sidePanel, evidenceItemId, sourceChunkId, docSection, pageNum]);

  // Buttons activate on Enter / Space by default in browsers, but tests
  // (and screen readers in some configurations) benefit from an explicit
  // handler. Re-implementing it here is harmless and documents intent.
  const onKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLButtonElement>): void => {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        activate();
      }
    },
    [activate],
  );

  const tooltip = title ?? buildTitle(docSection, pageNum);

  return (
    <button
      type="button"
      onClick={activate}
      onKeyDown={onKeyDown}
      data-testid="citation-pill"
      data-evidence-item-id={evidenceItemId}
      title={tooltip}
      aria-label={"Open chunk peek for " + tooltip}
      className={className}
    >
      {positionLabel ? (
        <span data-testid="citation-pill-position">{positionLabel}</span>
      ) : null}
      <span
        data-testid="citation-pill-section"
        className="text-slate-500 dark:text-slate-400"
      >
        {docSection ?? ""}
        {pageNum !== null && pageNum !== undefined
          ? " p." + pageNum
          : ""}
      </span>
      {indigenousFlagged ? (
        <span
          data-testid="citation-pill-indigenous-badge"
          className="ml-1 px-1 rounded bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300"
          title="Content references Indigenous uses (gardens, hunting, fishing, medicines)"
        >
          Indigenous uses content
        </span>
      ) : null}
    </button>
  );
}

export default CitationRenderer;
