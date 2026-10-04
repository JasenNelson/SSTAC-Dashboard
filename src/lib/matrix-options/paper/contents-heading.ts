import { CONTENTS_HEADING_LABEL, isContentsHeading } from './paper-nav-groups';

/*
 * The paper authors a "Master Table of Contents" heading before the main report
 * and again inside several appendices. The paper bytes are never changed; at
 * render time the exact heading is SHOWN as "Paper contents" (main report) or
 * "Appendix contents" (after the appendix boundary). Anchors are unaffected:
 * they come from the paper structure (the chunk section id), not heading text.
 *
 * A release that names its own display label (releases.ts `contentsHeadingDisplay`)
 * is handled earlier, in buildPaperChunks (presentContentsHeadingFirstLine below):
 * its contents chunks arrive here already carrying that label, so neither region
 * label above is shown for it.
 */
export type PaperRegion = 'main' | 'appendix';

export const CONTENTS_DISPLAY_LABELS: Readonly<Record<PaperRegion, string>> = Object.freeze({
  main: 'Paper contents',
  appendix: 'Appendix contents',
});

/** The label to show for a chunk: the region's contents label for the exact heading, else unchanged. */
export function presentChunkLabel<T extends string | null>(label: T, region: PaperRegion): T | string {
  return isContentsHeading(label) ? CONTENTS_DISPLAY_LABELS[region] : label;
}

const EXACT_HEADING_LINE = new RegExp(`^(#{1,6})[ \\t]+${CONTENTS_HEADING_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*#*[ \\t]*$`, 'm');

/**
 * Relabels the chunk's own exact "Master Table of Contents" markdown heading
 * for display. Only a chunk whose label is exactly that heading is touched,
 * and only its first matching heading line; everything else is returned as is.
 */
export function presentChunkMarkdown(markdown: string, label: string | null, region: PaperRegion): string {
  if (!isContentsHeading(label)) return markdown;
  return markdown.replace(EXACT_HEADING_LINE, (_line, hashes: string) => `${hashes} ${CONTENTS_DISPLAY_LABELS[region]}`);
}

/**
 * Whether a release display label is one line of plain words: letters and digits
 * with spaces between them, nothing else. Such a label can be written into a
 * heading line without adding a line, a heading or any markup of its own. A
 * label with other characters needs this rule widened deliberately, in code.
 */
export function isPlainDisplayLabel(label: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9 ]*[A-Za-z0-9])?$/.test(label);
}

// No `m` flag: only the very first line of the text can match.
const EXACT_HEADING_FIRST_LINE = new RegExp(`^(#{1,6})[ \\t]+${CONTENTS_HEADING_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*(?=\\n|$)`);

/**
 * Release-scoped display label (releases.ts `contentsHeadingDisplay`): when the
 * FIRST line of `markdown` is exactly the contents heading, returns the text
 * with that one line shown as `display`; otherwise null and nothing is changed.
 * No other line is ever touched. Used by buildPaperChunks, which also changes
 * the chunk label, so the two always change together.
 */
export function presentContentsHeadingFirstLine(markdown: string, display: string): string | null {
  const match = EXACT_HEADING_FIRST_LINE.exec(markdown);
  return match ? `${match[1]} ${display}${markdown.slice(match[0].length)}` : null;
}

/**
 * Region of each section, given the sections in document order: a section is
 * in the appendix region from the boundary section onward.
 */
export function sectionRegion(sectionLabels: readonly string[], index: number, boundaryLabel: string): PaperRegion {
  const boundary = sectionLabels.findIndex((label) => label.trim() === boundaryLabel);
  return boundary >= 0 && index >= boundary ? 'appendix' : 'main';
}
