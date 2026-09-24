import { CONTENTS_HEADING_LABEL, isContentsHeading } from './paper-nav-groups';

/*
 * The paper authors a "Master Table of Contents" heading before the main report
 * and again inside several appendices. The paper bytes are never changed; at
 * render time the exact heading is SHOWN as "Paper contents" (main report) or
 * "Appendix contents" (after the appendix boundary). Anchors are unaffected:
 * they come from the paper structure (the chunk section id), not heading text.
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
 * Region of each section, given the sections in document order: a section is
 * in the appendix region from the boundary section onward.
 */
export function sectionRegion(sectionLabels: readonly string[], index: number, boundaryLabel: string): PaperRegion {
  const boundary = sectionLabels.findIndex((label) => label.trim() === boundaryLabel);
  return boundary >= 0 && index >= boundary ? 'appendix' : 'main';
}
