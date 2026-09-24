'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Printer } from 'lucide-react';

import { sectionRegion } from '@/lib/matrix-options/paper/contents-heading';
import { APPENDIX_BOUNDARY_LABEL } from '@/lib/matrix-options/paper/outline-hierarchy';
import { createSectionLoader } from '@/lib/matrix-options/paper/section-loader';
import type { SectionLoaderSnapshot, SectionLoadStatus } from '@/lib/matrix-options/paper/section-loader';
import { validatePaperSectionContract } from '@/lib/matrix-options/paper/section-window';
import type { PaperSectionContract, PaperSectionSummary } from '@/lib/matrix-options/paper/section-window';
import { advancePrint, cancelPrint, INITIAL_PRINT_STATE, isPrintBusy, printStatusMessage, requestPrint } from '@/lib/matrix-options/paper/print-orchestrator';
import type { PrintLoaderView, PrintState } from '@/lib/matrix-options/paper/print-orchestrator';
import { cn } from '@/utils/cn';

import { PAPER_DOCUMENT_ARTICLE_CLASSES, PAPER_OVERFLOW_ANCHOR_CLASSES, PAPER_SCROLL_MARGIN_CLASSES, PaperChunkSection } from './PaperChunkSection';
import { isLgViewport } from './paper-viewport';

/*
 * S1 client section window (L2 CP-M1-STRATEGIC-001).
 *
 * The server renders the initial (or deep-linked) depth-1 section as `children`;
 * every other section starts as an ordered placeholder and is fetched from the
 * guarded per-section route as serializable data, then rendered through the same
 * PaperChunkSection/PaperText path. No Server Action returning JSX, no
 * dangerouslySetInnerHTML, no raw HTML, no Flight internals, and no response
 * that carries the whole paper.
 *
 * Loading triggers: a placeholder coming within about one viewport of the
 * scrollport, navigation to an anchor owned by an unloaded section (handled by
 * RevisedPaperWorkspace through ensureLoaded), and the toolbar's Print and
 * "Load entire paper" actions. The queue keeps at most two requests in flight and yields between
 * completions (section-loader.ts).
 */

export interface PaperSectionWindowData {
  readonly paperSha256: string;
  readonly initialIndex: number;
  readonly sections: readonly PaperSectionSummary[];
  readonly linkMap: Readonly<Record<string, string>>;
}

export interface PaperSectionWindowApi {
  readonly total: number;
  readonly loadedCount: number;
  readonly complete: boolean;
  readonly loadingAll: boolean;
  readonly failedCount: number;
  readonly snapshot: SectionLoaderSnapshot<PaperSectionContract>;
  /** Stable key that changes whenever any section's status changes. */
  readonly loadedKey: string;
  ensureLoaded(index: number, priority?: boolean): boolean;
  loadAll(): void;
  retry(index: number): void;
}

const PLACEHOLDER_MIN_HEIGHT_PX = 192;
/*
 * M1R3-03 calibration. Browser run-001 measured the real release at 175,543 px
 * of rendered height for 534,101 markdown bytes at 360 wide, i.e. 0.3287 px per
 * byte. The first estimate of 0.25 under-reserved by about 24 percent (about
 * 12,600 px on section index 2 alone), so a placeholder above the reading
 * position grew when it loaded. 0.329 reserves the measured height to within
 * about 0.1 percent at that width. Widths above 360 wrap less and so render
 * shorter, which makes this an over-reservation there rather than a jump; the
 * value stays a single named constant so run-002 can recalibrate it in one edit.
 */
const PLACEHOLDER_PX_PER_BYTE = 0.329;
/** About one viewport of lookahead in both directions. */
export const PAPER_SECTION_PREFETCH_ROOT_MARGIN = '100% 0px 100% 0px';

/** Cosmetic reserved height for an unloaded section, derived from its markdown size. */
export function placeholderMinHeight(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return PLACEHOLDER_MIN_HEIGHT_PX;
  return Math.max(PLACEHOLDER_MIN_HEIGHT_PX, Math.round(bytes * PLACEHOLDER_PX_PER_BYTE));
}

export function paperSectionRequestUrl(documentVersion: string, anchor: string, paperSha256: string): string {
  return `/api/matrix-options/paper/v/${encodeURIComponent(documentVersion)}/sections/${encodeURIComponent(anchor)}?paper=${encodeURIComponent(paperSha256)}`;
}

/** Fetches one section and returns it only if it is the section that was asked for. */
export async function fetchPaperSection(documentVersion: string, data: PaperSectionWindowData, index: number, signal: AbortSignal): Promise<PaperSectionContract> {
  const section = data.sections[index];
  if (!section) throw new Error(`Paper section request failed: unknown section ${index}`);
  const response = await fetch(paperSectionRequestUrl(documentVersion, section.anchor, data.paperSha256), {
    credentials: 'same-origin',
    signal,
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`Paper section request failed: ${response.status}`);
  return validatePaperSectionContract(await response.json(), {
    documentVersion,
    paperSha256: data.paperSha256,
    index,
    anchor: section.anchor,
    sectionCount: data.sections.length,
    bytes: section.bytes,
  });
}

export function usePaperSectionWindow(documentVersion: string, data: PaperSectionWindowData | undefined): PaperSectionWindowApi {
  const total = data?.sections.length ?? 0;
  const dataRef = useRef(data);
  dataRef.current = data;
  const [loader] = useState(() => createSectionLoader<PaperSectionContract>({
    total,
    initiallyLoaded: data ? [data.initialIndex] : [],
    load: (index, signal) => {
      const current = dataRef.current;
      if (!current) return Promise.reject(new Error('Paper section request failed: no section window'));
      return fetchPaperSection(documentVersion, current, index, signal);
    },
  }));
  const [snapshot, setSnapshot] = useState(() => loader.getSnapshot());

  useEffect(() => {
    setSnapshot(loader.getSnapshot());
    const unsubscribe = loader.subscribe(() => setSnapshot(loader.getSnapshot()));
    return () => {
      unsubscribe();
      loader.abort();
    };
  }, [loader]);

  const ensureLoaded = useCallback((index: number, priority = true): boolean => {
    if (!Number.isInteger(index) || index < 0 || index >= total) return false;
    if (loader.getSnapshot().statuses[index] === 'loaded') return true;
    loader.request(index, { priority });
    return true;
  }, [loader, total]);
  const loadAll = useCallback(() => loader.loadAll(), [loader]);
  const retry = useCallback((index: number) => loader.retry(index), [loader]);

  return useMemo(() => ({
    total,
    loadedCount: snapshot.loadedCount,
    complete: total > 0 && snapshot.complete,
    loadingAll: snapshot.loadingAll,
    failedCount: snapshot.statuses.filter((status) => status === 'error').length,
    snapshot,
    loadedKey: snapshot.statuses.join(','),
    ensureLoaded,
    loadAll,
    retry,
  }), [total, snapshot, ensureLoaded, loadAll, retry]);
}

function placeholderMessage(status: SectionLoadStatus): string {
  if (status === 'loading' || status === 'queued') return 'Loading this section.';
  if (status === 'error') return 'This section could not be loaded.';
  return 'This section is not loaded yet.';
}

function PaperSectionPlaceholder({ section, status, error, onLoad, register }: {
  readonly section: PaperSectionSummary;
  readonly status: SectionLoadStatus;
  readonly error: string | null;
  readonly onLoad: () => void;
  readonly register: (element: HTMLElement | null) => void;
}) {
  const labelId = `paper-section-placeholder-label-${section.anchor}`;
  const busy = status === 'loading' || status === 'queued';
  return (
    <section
      ref={register}
      data-paper-section-placeholder={section.anchor}
      data-paper-section-index={section.index}
      data-paper-section-status={status}
      aria-labelledby={labelId}
      aria-busy={busy || undefined}
      style={{ minHeight: `${placeholderMinHeight(section.bytes)}px` }}
      className={cn('min-w-0 rounded-sm border border-dashed border-slate-300 p-4 dark:border-slate-700', PAPER_SCROLL_MARGIN_CLASSES, PAPER_OVERFLOW_ANCHOR_CLASSES)}
    >
      <h2 id={labelId} className="text-xl font-bold text-slate-800 dark:text-slate-100">{section.label}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{placeholderMessage(status)}</p>
      {status === 'error' && error ? <p role="alert" className="mt-2 text-sm text-amber-900 dark:text-amber-200">{error}</p> : null}
      <button
        type="button"
        onClick={onLoad}
        disabled={busy}
        className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 print:hidden"
      >
        {status === 'error' ? 'Retry section' : 'Load section'}
      </button>
    </section>
  );
}

export function PaperSectionWindowView({ sectionWindow, api, scrollRootRef, children }: {
  readonly sectionWindow: PaperSectionWindowData;
  readonly api: PaperSectionWindowApi;
  readonly scrollRootRef?: RefObject<HTMLElement | null>;
  readonly children?: ReactNode;
}) {
  const placeholders = useRef(new Map<number, HTMLElement>());
  const { ensureLoaded, loadedKey, snapshot } = api;

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const root = isLgViewport() ? scrollRootRef?.current ?? null : null;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        /*
         * M1R4-01 (codex r3-luna-1, blocks-commit). AUTOMATIC prefetch never
         * retries a section that failed. `enqueue` clears errors[index] when it
         * re-queues (section-loader.ts), and `loadedKey` changes on every
         * error -> queued -> loading -> error transition, which rebuilds this
         * observer; `observe()` then re-fires for a still-intersecting target,
         * so an on-screen failing section retried without bound and its error
         * text and Retry button never stayed visible. Skipping status `error`
         * here leaves retries to explicit user action ONLY: the Retry button
         * (loader.retry), Load entire paper / Print (loader.loadAll, which
         * deliberately re-queues errors) and navigation (ensureLoaded with
         * priority) are all untouched.
         */
        if (entry.target.getAttribute('data-paper-section-status') === 'error') continue;
        const index = Number(entry.target.getAttribute('data-paper-section-index'));
        if (Number.isInteger(index)) ensureLoaded(index, false);
      }
    }, { root, rootMargin: PAPER_SECTION_PREFETCH_ROOT_MARGIN, threshold: 0 });
    for (const element of placeholders.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [ensureLoaded, scrollRootRef, loadedKey]);

  const sectionLabels = sectionWindow.sections.map((section) => section.label);
  return (
    <article data-testid="paper-document" aria-label="Working Draft paper" className={PAPER_DOCUMENT_ARTICLE_CLASSES}>
      {api.complete ? null : (
        <p data-testid="paper-partial-print-notice" className="hidden text-sm print:block">
          This printout contains only the sections loaded so far. Use the Print button in the Working Draft to print the whole paper.
        </p>
      )}
      {sectionWindow.sections.map((section) => {
        if (section.index === sectionWindow.initialIndex) {
          return <div key={section.anchor} data-paper-section={section.anchor} className="min-w-0 space-y-2">{children}</div>;
        }
        const contract = snapshot.results[section.index];
        if (contract) {
          return (
            <div key={section.anchor} data-paper-section={section.anchor} className="min-w-0 space-y-2">
              {contract.chunks.map((chunk) => <PaperChunkSection key={chunk.id} chunk={chunk} linkMap={sectionWindow.linkMap} region={sectionRegion(sectionLabels, section.index, APPENDIX_BOUNDARY_LABEL)} />)}
            </div>
          );
        }
        return (
          <PaperSectionPlaceholder
            key={section.anchor}
            section={section}
            status={snapshot.statuses[section.index] ?? 'idle'}
            error={snapshot.errors[section.index] ?? null}
            onLoad={() => (snapshot.statuses[section.index] === 'error' ? api.retry(section.index) : ensureLoaded(section.index))}
            register={(element) => {
              if (element) placeholders.current.set(section.index, element);
              else placeholders.current.delete(section.index);
            }}
          />
        );
      })}
    </article>
  );
}

/**
 * Print orchestration for the Working Draft (print-orchestrator.ts). Print is a
 * single action: missing sections are loaded first, the page is given two
 * frames (and web fonts) to render them, and only then is the browser print
 * dialog opened -- once, however many times the button is pressed.
 */
export function usePaperPrint(api: PaperSectionWindowApi) {
  const [state, setState] = useState<PrintState>(INITIAL_PRINT_STATE);
  /** The browser's print dialog could not be opened (window.print threw). */
  const [dialogFailed, setDialogFailed] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pending = api.snapshot.statuses.some((status) => status === 'queued' || status === 'loading');
  const view = useMemo<PrintLoaderView>(() => ({ complete: api.complete, loadingAll: api.loadingAll, pending, failedCount: api.failedCount }), [api.complete, api.loadingAll, pending, api.failedCount]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const { loadAll } = api;

  const request = useCallback(() => {
    setDialogFailed(false);
    const { state: next, shouldLoadAll } = requestPrint(stateRef.current, viewRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    if (shouldLoadAll) loadAll();
  }, [loadAll]);
  const cancel = useCallback(() => setState((current) => cancelPrint(current)), []);

  useEffect(() => {
    setState((current) => advancePrint(current, view));
  }, [view]);

  useEffect(() => {
    if (state.phase !== 'rendering' || typeof window === 'undefined') return undefined;
    let cancelled = false;
    const nextFrame = () => new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 16);
    });
    void (async () => {
      await nextFrame();
      await nextFrame();
      try {
        await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
      } catch {
        // Fonts failing to load never blocks printing.
      }
      if (cancelled) return;
      try {
        window.print();
        if (!cancelled) setDialogFailed(false);
      } catch {
        // The browser refused to open its print dialog: say so, never silently.
        if (!cancelled) setDialogFailed(true);
      } finally {
        if (!cancelled) setState(INITIAL_PRINT_STATE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state.phase]);

  return { state, request, cancel, dialogFailed };
}

/**
 * Working Draft toolbar: Print (one step) and loading the entire paper for
 * browser Find. Progress is announced politely; a failure is an alert that
 * names what happened and offers the retry.
 */
export function PaperDocumentToolbar({ api }: { readonly api: PaperSectionWindowApi }) {
  const { complete, loadedCount, loadingAll, total, failedCount } = api;
  const print = usePaperPrint(api);
  const busy = isPrintBusy(print.state);
  const message = printStatusMessage(print.state, loadedCount, total, failedCount);
  const buttonClasses = 'inline-flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]';
  return (
    <div data-testid="paper-load-full-document" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <button
        type="button"
        data-testid="paper-print-button"
        aria-disabled={busy || undefined}
        aria-describedby="paper-print-status"
        onClick={print.request}
        className={cn(buttonClasses, 'border-[var(--db-accent)] bg-[var(--db-accent)] text-[var(--db-text-on-accent)] hover:bg-[var(--db-accent-strong)] aria-disabled:cursor-progress aria-disabled:opacity-80')}
      >
        <Printer aria-hidden="true" className="h-4 w-4" />
        {print.state.phase === 'loading' ? 'Preparing print' : print.state.phase === 'rendering' ? 'Opening print' : 'Print'}
      </button>
      {print.state.phase === 'idle' || print.state.phase === 'failed' ? (
        <button
          type="button"
          data-testid="paper-load-full-document-button"
          onClick={api.loadAll}
          disabled={complete || loadingAll}
          className={cn(buttonClasses, 'border-[var(--db-border-strong)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)] disabled:cursor-not-allowed disabled:opacity-60')}
        >
          {complete ? 'Entire paper loaded' : loadingAll ? 'Loading entire paper' : 'Load entire paper for search'}
        </button>
      ) : (
        <button type="button" data-testid="paper-print-cancel" onClick={print.cancel} disabled={print.state.phase !== 'loading'} className={cn(buttonClasses, 'border-[var(--db-border-strong)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)] disabled:opacity-60')}>
          Cancel
        </button>
      )}
      {(loadingAll || busy) && !complete ? (
        <progress data-testid="paper-load-progress-bar" aria-label="Sections loaded" value={loadedCount} max={total} className="h-2 w-32 accent-[var(--db-accent)]" />
      ) : null}
      <p id="paper-print-status" data-testid="paper-load-progress" role="status" aria-live="polite" className="min-w-0 text-sm text-[var(--db-text-secondary)]">
        {print.state.phase === 'failed' ? null : message ?? (complete ? 'Entire paper loaded. Browser Find (Ctrl+F) searches all of it.' : `${loadedCount} of ${total} sections loaded. Print loads the rest automatically.`)}
      </p>
      {print.dialogFailed ? (
        <p role="alert" data-testid="paper-print-dialog-failed" className="text-sm text-[var(--db-text-primary)]">The browser could not open its print dialog. Try again, or use the browser&apos;s own Print command (Ctrl+P).</p>
      ) : null}
      {print.state.phase === 'failed' ? (
        <div role="alert" data-testid="paper-print-failed" className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-[var(--db-text-primary)]">
          <span>{message}</span>
          <button type="button" onClick={print.request} className={cn(buttonClasses, 'border-[var(--db-border-strong)] hover:bg-[var(--db-depth-1)]')}>Try printing again</button>
        </div>
      ) : failedCount > 0 && !busy ? (
        <p role="alert" className="text-sm text-[var(--db-text-primary)]">{failedCount} {failedCount === 1 ? 'section' : 'sections'} did not load. Retry from the section, or press Print to try again.</p>
      ) : null}
    </div>
  );
}
