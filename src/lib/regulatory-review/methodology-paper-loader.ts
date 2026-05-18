// Server-side loader for the Regulatory Review methodology paper markdown.
//
// Purpose:
//   The methodology paper lives in the engine repo (a sibling directory
//   to SSTAC-Dashboard), NOT inside the dashboard tree. This loader reads
//   the raw markdown files from disk on the server so the
//   /regulatory-review/methodology/paper/[section] route can render them
//   inline. The TSX scenario summaries (V1Content / V2Content /
//   TransitionContent) remain the curated entry surface; this loader
//   powers the "Read the full paper" depth experience.
//
// Server-only:
//   Imports `fs/promises` (Node.js). MUST NOT be imported from a
//   'use client' file. Calling components should be server components
//   (page.tsx) that pass the loaded string to a 'use client'
//   MarkdownPaperView for rendering.
//
// TODO (prod deployment path concern):
//   The METHODOLOGY_ROOT constant below points to an absolute path on
//   the developer machine (C:\Projects\Regulatory-Review\...). For
//   dev this is fine -- both repos sit side-by-side. For prod we need
//   one of:
//     (a) a build-time copy step that snapshots the methodology
//         markdown into the dashboard repo (e.g. under
//         src/content/methodology/) and we read from there; OR
//     (b) an env var (e.g. METHODOLOGY_PAPER_ROOT) that points to a
//         mounted volume or a remote-fetched cache; OR
//     (c) inline the markdown via the build pipeline (e.g. a
//         contentlayer-style transform) at build time.
//   Recommendation: option (a). Add a small npm script
//   `scripts/sync-methodology-paper.mjs` that runs `cp -r` from the
//   engine repo into `src/content/methodology/` and invoke it from
//   the build script. That keeps prod hermetic and removes the
//   cross-repo dev coupling once the paper stabilizes.

import { promises as fs } from 'fs';
import path from 'path';
import { notFound } from 'next/navigation';

// ---------------------------------------------------------------------------
// Section map -- single source of truth for slug -> file + display title
// ---------------------------------------------------------------------------

export interface SectionMeta {
  slug: PaperSectionSlug;
  file: string;
  title: string;
  /** Curated-summary route this section bridges back to. */
  summaryRoute: string;
  /** Short label for compact contexts (sidebar nav, breadcrumbs). */
  shortLabel: string;
}

export type PaperSectionSlug =
  | 'plan'
  | 'parts-i-ii-iii'
  | 'parts-iv-v'
  | 'part-vi'
  | 'parts-vii-viii-ix'
  | 'appendix-a'
  | 'appendix-b'
  | 'appendix-c'
  | 'appendix-d'
  | 'appendix-g';

// NOTE: this constant matches the README + agentic-os defense-in-depth
// pattern: data lives in ONE map; consumers index by slug.
const SECTION_MAP: Record<PaperSectionSlug, Omit<SectionMeta, 'slug'>> = {
  plan: {
    file: 'PLAN.md',
    title: 'PLAN (governing design doc)',
    summaryRoute: '/regulatory-review/methodology',
    shortLabel: 'PLAN',
  },
  'parts-i-ii-iii': {
    file: 'body/parts_I_II_III.md',
    title: 'Part I-III: Background, KB, v1 Architecture',
    summaryRoute: '/regulatory-review/methodology/v1',
    shortLabel: 'Part I-III',
  },
  'parts-iv-v': {
    file: 'body/parts_IV_V.md',
    title: 'Part IV-V: v1 Failures + v1->v2 Decision',
    summaryRoute: '/regulatory-review/methodology/transition',
    shortLabel: 'Part IV-V',
  },
  'part-vi': {
    file: 'body/part_VI.md',
    title: 'Part VI: Engine v2 Architecture',
    summaryRoute: '/regulatory-review/methodology/v2',
    shortLabel: 'Part VI',
  },
  'parts-vii-viii-ix': {
    file: 'body/parts_VII_VIII_IX.md',
    title: 'Part VII-IX: HITL Framing, AI Process, Reproducibility',
    summaryRoute: '/regulatory-review/methodology/v2',
    shortLabel: 'Part VII-IX',
  },
  'appendix-a': {
    file: 'appendices/appendix_A_component_inventory.md',
    title: 'Appendix A: Component Inventory',
    summaryRoute: '/regulatory-review/methodology',
    shortLabel: 'Appendix A',
  },
  'appendix-b': {
    file: 'appendices/appendix_B_disproven_hypotheses.md',
    title: 'Appendix B: 14 Disproven Hypotheses (v1)',
    summaryRoute: '/regulatory-review/methodology/v1',
    shortLabel: 'Appendix B',
  },
  'appendix-c': {
    file: 'appendices/appendix_C_canary_log_summary.md',
    title: 'Appendix C: Canary Log Summary (v2)',
    summaryRoute: '/regulatory-review/methodology/v2',
    shortLabel: 'Appendix C',
  },
  'appendix-d': {
    file: 'appendices/appendix_D_architecture_locks.md',
    title: 'Appendix D: Architecture Locks (v74.0 + v74.1+ M-4)',
    summaryRoute: '/regulatory-review/methodology',
    shortLabel: 'Appendix D',
  },
  'appendix-g': {
    file: 'appendices/appendix_G_kb_fact_ledger.md',
    title: 'Appendix G: KB Fact Ledger',
    summaryRoute: '/regulatory-review/methodology',
    shortLabel: 'Appendix G',
  },
};

// Cross-repo absolute path. See TODO at top of file for prod plan.
const METHODOLOGY_ROOT =
  'C:\\Projects\\Regulatory-Review\\engine\\docs\\active\\methodology';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ordered list of all sections in their canonical paper-reading order.
 * Used by the landing TOC and by MarkdownPaperView's prev/next nav.
 */
export const ALL_SECTIONS: SectionMeta[] = (
  Object.keys(SECTION_MAP) as PaperSectionSlug[]
).map((slug) => ({ slug, ...SECTION_MAP[slug] }));

/**
 * Return section metadata for a slug without reading from disk.
 * Returns null for invalid slugs (caller decides whether to notFound()).
 */
export function getSectionMeta(slug: string): SectionMeta | null {
  // Use Object.hasOwn (NOT `in`) so prototype keys like `toString` /
  // `constructor` return null -> 404, rather than matching and throwing
  // later. Per codex front-end review P2 fix 2026-05-17.
  if (!Object.hasOwn(SECTION_MAP, slug)) {
    return null;
  }
  const typed = slug as PaperSectionSlug;
  return { slug: typed, ...SECTION_MAP[typed] };
}

export interface LoadedSection {
  content: string;
  title: string;
  /** Relative path under the methodology/ root, for footer attribution. */
  sourcePath: string;
  meta: SectionMeta;
}

/**
 * Load a methodology paper section from disk by slug.
 *
 * Throws via `notFound()` for invalid slugs OR file-read errors so the
 * caller (a server component page.tsx) renders the standard Next.js
 * 404 surface. File-read errors are intentionally collapsed into 404
 * here -- if the cross-repo path is unavailable in this environment,
 * the user-visible result is "this section is not available" rather
 * than a stack trace.
 */
export async function loadMethodologyPaperSection(
  slug: string,
): Promise<LoadedSection> {
  const meta = getSectionMeta(slug);
  if (!meta) {
    notFound();
  }

  const absolutePath = path.join(METHODOLOGY_ROOT, meta.file);

  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch (err) {
    // File missing or unreadable in this environment. Logged for ops
    // visibility, but user surface is the standard 404.
    console.error(
      `[methodology-paper-loader] failed to read ${absolutePath}:`,
      err,
    );
    notFound();
  }

  return {
    content,
    title: meta.title,
    sourcePath: meta.file,
    meta,
  };
}
