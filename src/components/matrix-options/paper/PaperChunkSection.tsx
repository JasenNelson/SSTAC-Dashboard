import type { PaperSectionContractChunk } from '@/lib/matrix-options/paper/section-window';

import { PAPER_DOCUMENT_HEADING_OFFSET, PaperText } from './PaperText';

/*
 * One paper chunk as a focusable, labelled section. No directive: the server
 * PaperDocument and the client section window both render THIS component, so a
 * section fetched by the client is structurally identical to the same section
 * server-rendered in the initial window.
 *
 * The chunk classes no longer carry [content-visibility:auto] /
 * [contain-intrinsic-size:...]: the browser's skipped-content height estimates
 * made depth-1 outline jumps land thousands of pixels short (browser run-001,
 * cause CV-SCROLL), and the section window now bounds how much is in the DOM.
 * Scroll margin below lg follows the measured sticky header height
 * (--paper-sticky-header-height, set by RevisedPaperWorkspace) so a jump target
 * is never hidden under it; scrollMarginTopOf reads the computed value back.
 */

export const PAPER_STICKY_HEADER_HEIGHT_VAR = '--paper-sticky-header-height';
/** Class contract of the document surface, shared by the server document and the client window. */
export const PAPER_DOCUMENT_ARTICLE_CLASSES = 'min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:border-0 print:bg-transparent print:p-0';
export const PAPER_SCROLL_MARGIN_CLASSES = 'scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] lg:scroll-mt-4';
/*
 * M1R3-03 overflow-anchor strategy. The prefetch rootMargin loads one viewport
 * BEHIND as well as ahead, so a placeholder above the reading position can be
 * replaced by its real chunks while the user reads. Browser scroll anchoring is
 * what keeps the reading position stable across that resize, so the elements
 * whose height changes (placeholders) and the elements that must stay eligible
 * anchors (chunk sections) declare `overflow-anchor: auto` explicitly instead of
 * relying on the initial value surviving a future ancestor or utility rule that
 * sets `none`. Arbitrary-property idiom, as `[overflow-wrap:anywhere]` already
 * used in RevisedPaperWorkspace. CSS only: no globals.css rule and no script.
 */
export const PAPER_OVERFLOW_ANCHOR_CLASSES = '[overflow-anchor:auto]';
export const PAPER_CHUNK_CLASSES = `min-w-0 rounded-sm ${PAPER_SCROLL_MARGIN_CLASSES} ${PAPER_OVERFLOW_ANCHOR_CLASSES} focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600`;

export type PaperChunkView = Pick<PaperSectionContractChunk, 'id' | 'anchor' | 'depth' | 'label' | 'markdown'>;

export function paperSectionLabelId(anchor: string): string {
  return `paper-section-label-${anchor}`;
}

export function PaperChunkSection({ chunk, linkMap }: { readonly chunk: PaperChunkView; readonly linkMap?: Readonly<Record<string, string>> }) {
  if (chunk.anchor === null) {
    return (
      <section data-paper-preamble="" className={PAPER_CHUNK_CLASSES}>
        <PaperText markdown={chunk.markdown} linkMap={linkMap} headingOffset={PAPER_DOCUMENT_HEADING_OFFSET} />
      </section>
    );
  }
  const labelId = paperSectionLabelId(chunk.anchor);
  return (
    <section
      id={chunk.anchor}
      role="group"
      data-paper-chunk={chunk.anchor}
      data-depth={chunk.depth ?? undefined}
      tabIndex={-1}
      aria-labelledby={labelId}
      className={PAPER_CHUNK_CLASSES}
    >
      <span id={labelId} hidden>{chunk.label}</span>
      <PaperText markdown={chunk.markdown} linkMap={linkMap} headingOffset={PAPER_DOCUMENT_HEADING_OFFSET} />
    </section>
  );
}
