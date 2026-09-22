import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import {
  buildLegacyAnchorMap,
  buildPaperChunks,
  buildPaperOutline,
  sectionAnchorSet,
} from '@/lib/matrix-options/paper/full-document';
import type { PaperChunk } from '@/lib/matrix-options/paper/full-document';
import { workingDraftSectionHref } from '@/lib/matrix-options/paper/url-state';
import type { PaperUrlContext } from '@/lib/matrix-options/paper/url-state';
import { createWorkspaceModel } from '@/lib/matrix-options/revised-paper-review';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

import { PAPER_DOCUMENT_ARTICLE_CLASSES, PaperChunkSection } from './PaperChunkSection';
import type { PaperOutlineNavEntry } from './PaperOutlineNav';

export { PAPER_DOCUMENT_HEADING_OFFSET } from './PaperText';

/*
 * Working Draft full paper (server component; no 'use client').
 *
 * Every chunk from buildPaperChunks is rendered in order. Heading chunks are
 * focusable sections (id = anchor, tabIndex -1) so the outline, deep links and
 * in-page references can scroll to and focus them. The markdown string never
 * reaches client props: the page passes <PaperDocument> as children into the
 * client workspace.
 *
 * Section semantics (M1-09): each heading chunk is
 * <section role="group" aria-labelledby=... tabIndex={-1}>. A named <section>
 * is a `region` landmark, and 338 of them bury the page's real landmarks. The
 * group role keeps the focus target named by its heading label (focusing a
 * section announces that label) without adding any landmark. Paper headings are
 * demoted one level (headingOffset 1), so the workspace h1 stays the page's only
 * h1; heading text is unchanged.
 *
 * Derived models are cached per structure object. loadRevisedPaperStructure
 * returns one cached, already authenticated structure, so a warm server
 * derives chunks, outline and link map once instead of per request.
 */

export interface PaperDocumentModel {
  readonly chunks: readonly PaperChunk[];
  readonly linkMap: Readonly<Record<string, string>>;
}

const outlineCache = new WeakMap<object, readonly PaperOutlineNavEntry[]>();
const anchorCache = new WeakMap<object, ReadonlySet<string>>();
const legacyCache = new WeakMap<object, Readonly<Record<string, string>>>();
const documentCache = new WeakMap<object, PaperDocumentModel>();

export function getPaperSectionAnchors(structure: Pick<RevisedPaperStructure, 'nodes'>): ReadonlySet<string> {
  const cached = anchorCache.get(structure);
  if (cached) return cached;
  const anchors = sectionAnchorSet(structure);
  anchorCache.set(structure, anchors);
  return anchors;
}

export function getPaperLegacyAnchorMap(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>): Readonly<Record<string, string>> {
  const cached = legacyCache.get(structure);
  if (cached) return cached;
  const legacy = buildLegacyAnchorMap(structure);
  legacyCache.set(structure, legacy);
  return legacy;
}

/** Outline entries for the client navigation (byte ranges omitted to keep client props small). */
export function getPaperNavOutline(structure: Pick<RevisedPaperStructure, 'nodes'>): readonly PaperOutlineNavEntry[] {
  const cached = outlineCache.get(structure);
  if (cached) return cached;
  const outline = Object.freeze(buildPaperOutline(structure).map((entry) => Object.freeze({
    id: entry.id,
    anchor: entry.anchor,
    label: entry.label,
    depth: entry.depth,
    parentId: entry.parentId,
    childIds: entry.childIds,
  })));
  outlineCache.set(structure, outline);
  return outline;
}

/**
 * In-page link map for MathRenderer: `#<id>` -> the canonical Working Draft
 * query for its section, `?mode=working-draft&section=<anchor>` (M1-04).
 * Precedence (later wins):
 * 1. hand-authored section references resolved by the existing workspace
 *    heuristics (createWorkspaceModel internal link map; node route targets are
 *    converted back to that node's anchor);
 * 2. every heading anchor maps to itself;
 * 3. legacy standalone section-anchor div ids (buildLegacyAnchorMap).
 */
export function buildPaperLinkMap(structure: RevisedPaperStructure): Readonly<Record<string, string>> {
  const anchorByNodeId = new Map(structure.nodes.map((node) => [node.id, node.anchor]));
  const entries = new Map<string, string>();
  const heuristic = createWorkspaceModel(structure, { lens: 'all', q: '', page: 1 }, 'working-draft').internalLinkMap;
  for (const [key, href] of Object.entries(heuristic)) {
    const match = /\/nodes\/([^?#]+)/.exec(href);
    if (!match) continue;
    let nodeId: string;
    try {
      nodeId = decodeURIComponent(match[1]);
    } catch {
      continue;
    }
    const anchor = anchorByNodeId.get(nodeId);
    if (anchor) entries.set(key, workingDraftSectionHref(anchor));
  }
  for (const anchor of getPaperSectionAnchors(structure)) entries.set(anchor, workingDraftSectionHref(anchor));
  for (const [legacyId, anchor] of Object.entries(getPaperLegacyAnchorMap(structure))) entries.set(legacyId, workingDraftSectionHref(anchor));
  return Object.freeze(Object.fromEntries(entries));
}

export function getPaperDocumentModel(structure: RevisedPaperStructure): PaperDocumentModel {
  const cached = documentCache.get(structure);
  if (cached) return cached;
  const model: PaperDocumentModel = Object.freeze({ chunks: buildPaperChunks(structure), linkMap: buildPaperLinkMap(structure) });
  documentCache.set(structure, model);
  return model;
}

/** URL-state context: heading anchors plus reviewer-guide question -> cohort bindings. */
export function buildPaperUrlContext(structure: Pick<RevisedPaperStructure, 'nodes'>): PaperUrlContext {
  const manifest = getCohortManifest();
  const guide = getReviewerGuideContract();
  const questionCohort = new Map<string, string>();
  for (const cohort of manifest.cohorts) {
    for (const number of cohort.questionNumbers) {
      const question = guide.questions.find((candidate) => candidate.number === number);
      if (question) questionCohort.set(question.id, cohort.id);
    }
  }
  return { anchors: getPaperSectionAnchors(structure), questionCohort, cohortIds: new Set(manifest.cohorts.map((cohort) => cohort.id)) };
}

/**
 * Section anchor for a child-route identity: the named heading node when it
 * exists, else the heading whose chunk contains `byte` (chunks run from a
 * heading's start to the next heading's start). Null before the first heading.
 */
export function resolveSectionAnchor(structure: Pick<RevisedPaperStructure, 'nodes'>, nodeId: string | null, byte: number): string | null {
  if (nodeId !== null) {
    const node = structure.nodes.find((candidate) => candidate.id === nodeId);
    if (node) return node.anchor;
  }
  let containing: string | null = null;
  for (const node of structure.nodes) {
    if (node.startByte > byte) break;
    containing = node.anchor;
  }
  return containing;
}

/**
 * M1-07: the heading anchor a legacy section id names in this release: the id
 * itself when it is a heading anchor, else its legacy section-anchor div
 * mapping. The percent-decoded id is tried first and the raw id second; a
 * malformed encoding is tried raw only. Unknown ids resolve to null.
 */
export function resolveLegacySectionAnchor(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>, rawId: string): string | null {
  const candidates = [rawId];
  try {
    const decoded = decodeURIComponent(rawId);
    if (decoded !== rawId) candidates.unshift(decoded);
  } catch {
    // Malformed percent-encoding: only the raw value is considered.
  }
  const anchors = getPaperSectionAnchors(structure);
  const legacy = getPaperLegacyAnchorMap(structure);
  for (const id of candidates) {
    if (anchors.has(id)) return id;
    if (Object.prototype.hasOwnProperty.call(legacy, id)) return legacy[id];
  }
  return null;
}

/**
 * `layout='article'` renders the whole document surface (the full-document and
 * print path). `layout='chunks'` renders only the section's chunks, so the
 * client section window can place the server-rendered initial section inside its
 * own ordered article next to placeholders and client-loaded sections (S1).
 */
export function PaperDocument({ model, layout = 'article' }: { readonly model: PaperDocumentModel; readonly layout?: 'article' | 'chunks' }) {
  const chunks = model.chunks.map((chunk) => <PaperChunkSection key={chunk.id} chunk={chunk} linkMap={model.linkMap} />);
  if (layout === 'chunks') return <>{chunks}</>;
  return (
    <article data-testid="paper-document" aria-label="Working Draft paper" className={PAPER_DOCUMENT_ARTICLE_CLASSES}>
      {chunks}
    </article>
  );
}
