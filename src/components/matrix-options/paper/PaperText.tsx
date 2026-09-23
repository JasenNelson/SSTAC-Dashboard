import MathRenderer from '@/components/MathRenderer';
import { demoteMarkdownHeadings, markdownHeadingLevels } from '@/lib/matrix-options/paper/full-document';
import { cn } from '@/utils/cn';

/** Heading levels paper markdown is demoted by inside the Working Draft. */
export const PAPER_DOCUMENT_HEADING_OFFSET = 1;

/** The HTML level the shallowest heading of a My Review portion is rendered at. */
export const PAPER_PORTION_TOP_HEADING_LEVEL = 3;

export type PaperHeadingVariant = 'document' | 'portion';

/*
 * M1R2-01: heading styles for the demoted levels, without editing the shared
 * MathRenderer. MathRenderer styles only its own direct children h1-h4
 * (`[&>hN]`, specificity 0-1-1), so demoted h5/h6 had no on-screen style at all
 * and every other level rendered one step too small. These rules target
 * `.math-renderer > hN` from the PaperText wrapper (specificity 0-2-1), so they
 * win over MathRenderer for the same elements and cover h2-h6.
 *
 * Working Draft (headingOffset 1, source h1-h5 -> h2-h6): rendered h2-h5 carry
 * the pre-demotion h1-h4 treatments (h2 drops MathRenderer's h2 underline, h3
 * takes it) and rendered h6 gets its own semibold treatment with margins.
 *
 * My Review portions: a portion is introduced by its own h2, so portion source
 * headings start at h3 (portionHeadingOffset) and step down from there, always
 * visually below the portion heading.
 */
const DOCUMENT_HEADING_CLASSES = [
  '[&_.math-renderer>h2]:mb-6 [&_.math-renderer>h2]:mt-2 [&_.math-renderer>h2]:border-b-0 [&_.math-renderer>h2]:pb-0 [&_.math-renderer>h2]:text-3xl [&_.math-renderer>h2]:font-bold [&_.math-renderer>h2]:text-slate-900 dark:[&_.math-renderer>h2]:text-white',
  '[&_.math-renderer>h3]:mb-4 [&_.math-renderer>h3]:mt-8 [&_.math-renderer>h3]:border-b [&_.math-renderer>h3]:border-slate-200 [&_.math-renderer>h3]:pb-2 [&_.math-renderer>h3]:text-2xl [&_.math-renderer>h3]:font-bold [&_.math-renderer>h3]:text-slate-800 dark:[&_.math-renderer>h3]:border-slate-700 dark:[&_.math-renderer>h3]:text-slate-100',
  '[&_.math-renderer>h4]:mb-4 [&_.math-renderer>h4]:mt-6 [&_.math-renderer>h4]:text-xl [&_.math-renderer>h4]:font-bold [&_.math-renderer>h4]:text-slate-800 dark:[&_.math-renderer>h4]:text-slate-100',
  '[&_.math-renderer>h5]:mb-3 [&_.math-renderer>h5]:mt-5 [&_.math-renderer>h5]:text-lg [&_.math-renderer>h5]:font-semibold [&_.math-renderer>h5]:text-slate-800 dark:[&_.math-renderer>h5]:text-slate-100',
  '[&_.math-renderer>h6]:mb-2 [&_.math-renderer>h6]:mt-4 [&_.math-renderer>h6]:text-base [&_.math-renderer>h6]:font-semibold [&_.math-renderer>h6]:tracking-wide [&_.math-renderer>h6]:text-slate-700 dark:[&_.math-renderer>h6]:text-slate-200',
].join(' ');

const PORTION_HEADING_CLASSES = [
  '[&_.math-renderer>h2]:mb-4 [&_.math-renderer>h2]:mt-6 [&_.math-renderer>h2]:border-b-0 [&_.math-renderer>h2]:pb-0 [&_.math-renderer>h2]:text-xl [&_.math-renderer>h2]:font-bold [&_.math-renderer>h2]:text-slate-800 dark:[&_.math-renderer>h2]:text-slate-100',
  '[&_.math-renderer>h3]:mb-3 [&_.math-renderer>h3]:mt-5 [&_.math-renderer>h3]:border-b-0 [&_.math-renderer>h3]:pb-0 [&_.math-renderer>h3]:text-lg [&_.math-renderer>h3]:font-bold [&_.math-renderer>h3]:text-slate-800 dark:[&_.math-renderer>h3]:text-slate-100',
  '[&_.math-renderer>h4]:mb-2 [&_.math-renderer>h4]:mt-4 [&_.math-renderer>h4]:text-base [&_.math-renderer>h4]:font-semibold [&_.math-renderer>h4]:text-slate-800 dark:[&_.math-renderer>h4]:text-slate-100',
  '[&_.math-renderer>h5]:mb-2 [&_.math-renderer>h5]:mt-4 [&_.math-renderer>h5]:text-sm [&_.math-renderer>h5]:font-semibold [&_.math-renderer>h5]:uppercase [&_.math-renderer>h5]:tracking-wide [&_.math-renderer>h5]:text-slate-700 dark:[&_.math-renderer>h5]:text-slate-200',
  '[&_.math-renderer>h6]:mb-1 [&_.math-renderer>h6]:mt-3 [&_.math-renderer>h6]:text-sm [&_.math-renderer>h6]:font-semibold [&_.math-renderer>h6]:italic [&_.math-renderer>h6]:text-slate-700 dark:[&_.math-renderer>h6]:text-slate-200',
].join(' ');

/**
 * The heading style map for a render. The Working Draft document offset selects
 * the document map; anything else (a My Review portion, whose offset depends on
 * the portion's own shallowest heading) selects the portion map. Callers may
 * pass the variant explicitly.
 */
export function paperHeadingClasses(headingOffset: number, variant?: PaperHeadingVariant): string {
  const resolved = variant ?? (headingOffset === PAPER_DOCUMENT_HEADING_OFFSET ? 'document' : 'portion');
  return resolved === 'document' ? DOCUMENT_HEADING_CLASSES : PORTION_HEADING_CLASSES;
}

/**
 * Demotion offset for a My Review portion: its shallowest source heading renders
 * at PAPER_PORTION_TOP_HEADING_LEVEL (h3), below the portion's own h2, and every
 * deeper source level keeps a distinct rendered level under it.
 */
export function portionHeadingOffset(markdown: string): number {
  const levels = markdownHeadingLevels(markdown);
  if (levels.length === 0) return 0;
  return Math.max(0, PAPER_PORTION_TOP_HEADING_LEVEL - Math.min(...levels));
}

export interface PaperTextProps {
  readonly markdown: string;
  readonly linkMap?: Readonly<Record<string, string>>;
  readonly className?: string;
  /**
   * Heading levels to demote for presentation (M1-09), so paper headings nest
   * under the page's single h1. The markdown text itself is unchanged.
   */
  readonly headingOffset?: number;
  /** Heading style map; defaults from headingOffset (M1R2-01). */
  readonly headingVariant?: PaperHeadingVariant;
}

/**
 * Paper markdown through the shared MathRenderer (not modified). No
 * directive: usable from the server PaperDocument and from client components.
 */
export function PaperText({ markdown, linkMap, className, headingOffset = 0, headingVariant }: PaperTextProps) {
  return (
    // The prose measure is adaptive (globals.css .paper-reading-frame); wide blocks use the full frame.
    <div className={cn('reader-prose min-w-0 max-w-none', paperHeadingClasses(headingOffset, headingVariant), className)}>
      <MathRenderer content={demoteMarkdownHeadings(markdown, headingOffset)} internalLinkMap={linkMap} />
    </div>
  );
}
