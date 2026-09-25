/*
 * Matrix Options Paper figures.
 *
 * The paper's figures were authored as fenced `diagram` blocks (layout, title,
 * node / head / bul, edge / label). The 2026-09-12 remediation stage
 * (V13_STAGE.py, diagram_to_markdown) flattened each block into a
 * "**Diagram summary N.**" bullet list, and every later release -- including the
 * deployed 1.0.11-remediated-7-8-successor-20260918-D source -- carries only that
 * text. The flattening is invertible for display:
 *
 *   layout X            -> "Layout: X"
 *   title T / head H    -> "Diagram note: title T" / "Diagram note: head H"
 *   label L (on edge)   -> "Diagram note: label L"
 *   node id: Label      -> "Node id: Label"
 *   bul B               -> "Criterion: B"
 *   edge a -> b         -> "Relationship: a -> b"
 *
 * One quirk of the flattening regex: a `head` line that itself contains ": " was
 * emitted as "Node <text>: <text>" (e.g. "Node (PATHWAY 3: C_sed,EqP)"). Such a
 * "node" has an id that is not an identifier, so it is read back as a head line.
 *
 * The paper source is never modified: the reader splits a chunk's markdown into
 * prose and figure segments at render time, and a block that does not parse
 * cleanly stays as its original markdown.
 */

export type DiagramLayout = 'grid' | 'tree' | 'flow' | 'stack';

export interface DiagramNode {
  readonly id: string;
  readonly label: string;
  /** Sub-heading lines (`head`), in source order. */
  readonly heads: readonly string[];
  /** Bullet lines (`bul`), in source order. */
  readonly bullets: readonly string[];
}

export interface DiagramEdge {
  readonly from: string;
  readonly to: string;
  readonly label: string | null;
}

export interface DiagramModel {
  /** The N of "Diagram summary N." in the source. */
  readonly summaryNumber: number;
  readonly layout: DiagramLayout;
  readonly title: string | null;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  /** Diagram notes that attach to no node or edge (none in the current release). */
  readonly notes: readonly string[];
  /** The source item texts (after "- "), in order; every one is represented above. */
  readonly items: readonly string[];
}

/**
 * What a rendered figure is bound to. A restored figure's body is the current
 * source summary; its number and caption are presentation only (owner-approved
 * historical v0.9.87 numbering). A derived figure is a deterministic re-drawing
 * of a table or list that stays in the text above it.
 */
export interface FigureBinding {
  /** restored: from a current summary; derived: re-drawing of a table/list; prototype: figure lab only. */
  readonly kind: 'restored' | 'derived' | 'prototype';
  /** '6-1' for a restored figure, 'PX-1' for a derived one. */
  readonly id: string;
  /** Reader-facing label, e.g. 'Figure 6-1'; derived figures carry none. */
  readonly label: string | null;
  readonly caption: string;
  /** sha256 of the exact source text the figure is drawn from. */
  readonly sourceSha256: string;
  /**
   * current: drawn from current text under an accepted disposition;
   * prototype-nonfinal: shown with a visible "not final" note;
   * proposed: an additional figure awaiting adoption;
   * layout-prototype / historical-proposal: structure only, no content.
   */
  readonly status: 'current' | 'prototype-nonfinal' | 'proposed' | 'layout-prototype' | 'historical-proposal' | 'candidate-nonfinal';
  /** Visible note shown in the figure when the status is not 'current'. */
  readonly statusNote: string | null;
  /** 'math' renders ASCII mathematical spellings as notation (notation-only dispositions). */
  readonly notation: 'plain' | 'math';
  /** Box label replacements by node id, from a Matrix MC disposition (6-1 prototype). */
  readonly labelOverrides: Readonly<Record<string, string>> | null;
  /** Where labelOverrides come from (sourceSha256 covers only the body text). */
  readonly overrideAuthority: string | null;
  /** The Matrix MC content-candidate semantic asset this binding draws (figure-candidates.ts), when it is one. */
  readonly assetId?: string;
  /**
   * Where the whole content asset (not a label override) comes from -- distinct from
   * overrideAuthority, which documents labelOverrides only. Candidates set this to the
   * packet file + sha256 and leave overrideAuthority null, since they carry no labelOverrides.
   */
  readonly contentAuthority?: string;
  /**
   * The word describing what an edge means, for the hidden text equivalent and the visible
   * relations list. Candidates set 'contains' when their edges are packet-root-hierarchy (a
   * root heading its child sections, not a causal/sequential connection); omitted otherwise,
   * so diagramDescription's default 'leads to' applies. Restored/derived figures never set this.
   */
  readonly edgeRelation?: 'leads to' | 'contains';
  /**
   * ROUND4_FIX_BRIEF item 3 (Leg1b P2-1): the Matrix MC disposition code for a non-final inline
   * prototype (currently only Figure 6-1), carried as a data attribute so it stays available to
   * tooling and the register without ever appearing in the reader-visible statusNote text. Set
   * only on the inline 6-1 binding; every other binding leaves this undefined.
   */
  readonly disposition?: string;
}

/** The model as drawn: the bound body with any disposition-sanctioned label replacements. */
export function modelForBinding(model: DiagramModel, binding: FigureBinding | null): DiagramModel {
  const overrides = binding?.labelOverrides;
  if (!overrides) return model;
  return { ...model, nodes: model.nodes.map((node) => (overrides[node.id] ? { ...node, label: overrides[node.id] } : node)) };
}

/**
 * A top-level blockquote's role, read from its source text (CSS cannot see the
 * text node before a <strong>): an editorial note opens with a bold lead
 * ("> **Successor identity.** ..."); anything else is a quotation.
 */
export type QuoteKind = 'note' | 'quotation';

export type PaperMarkdownSegment =
  | { readonly kind: 'markdown'; readonly markdown: string; readonly quote?: QuoteKind }
  | { readonly kind: 'figure'; readonly model: DiagramModel; readonly source: string; readonly binding: FigureBinding | null };

/**
 * FNV-1a (32-bit) over UTF-16 code units, as 8 hex digits. A cheap, synchronous
 * content check that runs identically on the server and in the browser; the
 * sha256 recorded beside it is the provenance hash (verified in tests).
 */
export function sourceFingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The text a restored figure is bound to: its summary items, one per line. */
export function summarySourceText(model: DiagramModel): string {
  return model.items.join('\n');
}

const LAYOUTS: ReadonlySet<string> = new Set(['grid', 'tree', 'flow', 'stack']);
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
const SUMMARY_HEADING = /^\*\*Diagram summary (\d+)\.\*\*[ \t]*$/;
const RELATIONSHIP = /^(\S+)\s+->\s+(\S+)$/;

interface MutableNode { id: string; label: string; heads: string[]; bullets: string[] }
interface MutableEdge { from: string; to: string; label: string | null }

/**
 * Parse the items of one "Diagram summary" block. Returns null for anything that
 * is not a complete, consistent diagram, so the caller keeps the original text.
 */
export function parseDiagramSummary(summaryNumber: number, items: readonly string[]): DiagramModel | null {
  let layout: DiagramLayout | null = null;
  let title: string | null = null;
  const nodes: MutableNode[] = [];
  const edges: MutableEdge[] = [];
  const notes: string[] = [];
  let lastKind: 'node' | 'edge' | null = null;
  for (const item of items) {
    const colon = item.indexOf(': ');
    if (colon < 0) return null;
    const key = item.slice(0, colon);
    const value = item.slice(colon + 2).trim();
    if (value === '') return null;
    if (key === 'Layout') {
      if (layout !== null || !LAYOUTS.has(value)) return null;
      layout = value as DiagramLayout;
    } else if (key === 'Diagram note') {
      const space = value.indexOf(' ');
      const keyword = space < 0 ? value : value.slice(0, space);
      const text = space < 0 ? '' : value.slice(space + 1).trim();
      const current = nodes[nodes.length - 1];
      if (keyword === 'title' && text !== '' && title === null) {
        title = text;
      } else if (keyword === 'head' && text !== '' && current && lastKind === 'node') {
        // Heads are drawn before bullets, so a head after a bullet cannot be drawn in source order.
        if (current.bullets.length > 0) return null;
        current.heads.push(text);
      } else if (keyword === 'label' && text !== '' && lastKind === 'edge') {
        const edge = edges[edges.length - 1];
        if (edge.label !== null) return null;
        edge.label = text;
      } else {
        notes.push(value);
      }
    } else if (key.startsWith('Node ')) {
      const id = key.slice('Node '.length);
      if (IDENTIFIER.test(id)) {
        if (nodes.some((node) => node.id === id)) return null;
        nodes.push({ id, label: value, heads: [], bullets: [] });
        lastKind = 'node';
      } else {
        // A flattened `head` line that contained ": " -- rejoin it and attach it
        // to the node it followed.
        const current = nodes[nodes.length - 1];
        if (!current || lastKind !== 'node' || current.bullets.length > 0) return null;
        current.heads.push(`${id}: ${value}`);
      }
    } else if (key === 'Criterion') {
      const current = nodes[nodes.length - 1];
      if (!current || lastKind !== 'node') return null;
      current.bullets.push(value);
    } else if (key === 'Relationship') {
      const match = RELATIONSHIP.exec(value);
      if (!match) return null;
      edges.push({ from: match[1], to: match[2], label: null });
      lastKind = 'edge';
    } else {
      return null;
    }
  }
  if (layout === null || nodes.length === 0) return null;
  const ids = new Set(nodes.map((node) => node.id));
  if (edges.some((edge) => !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to)) return null;
  return { summaryNumber, layout, title, nodes, edges, notes, items: [...items] };
}

/**
 * Split paper markdown into prose and figure segments. A "**Diagram summary N.**"
 * line, optional blank lines, then a contiguous run of "- " items is one figure
 * candidate; if it does not parse it stays in the prose unchanged.
 */
export function splitPaperMarkdown(markdown: string): PaperMarkdownSegment[] {
  const lines = markdown.split('\n');
  const segments: PaperMarkdownSegment[] = [];
  let prose: string[] = [];
  const flushProse = () => {
    if (prose.some((line) => line.trim() !== '')) segments.push({ kind: 'markdown', markdown: prose.join('\n') });
    prose = [];
  };
  let index = 0;
  while (index < lines.length) {
    const heading = SUMMARY_HEADING.exec(lines[index]);
    if (heading) {
      let cursor = index + 1;
      while (cursor < lines.length && lines[cursor].trim() === '') cursor += 1;
      const items: string[] = [];
      while (cursor < lines.length && lines[cursor].startsWith('- ')) {
        items.push(lines[cursor].slice(2).trimEnd());
        cursor += 1;
      }
      const model = items.length > 0 ? parseDiagramSummary(Number(heading[1]), items) : null;
      if (model) {
        flushProse();
        segments.push({ kind: 'figure', model, source: lines.slice(index, cursor).join('\n'), binding: restoredFigureBinding(model) });
        index = cursor;
        continue;
      }
    }
    prose.push(lines[index]);
    index += 1;
  }
  flushProse();
  // Markdown with no figure and no visible prose renders exactly as before.
  return segments.length > 0 ? segments : [{ kind: 'markdown', markdown }];
}

/** A node and the branches that leave it, for tree and grid layouts. */
export interface DiagramTreeNode {
  readonly node: DiagramNode;
  /** Label of the edge that reaches this node, if any. */
  readonly incomingLabel: string | null;
  readonly children: readonly DiagramTreeNode[];
}

export type DiagramStructure =
  | { readonly kind: 'chain'; readonly steps: readonly { readonly node: DiagramNode; readonly incomingLabel: string | null }[] }
  | { readonly kind: 'tree'; readonly roots: readonly DiagramTreeNode[] }
  | { readonly kind: 'graph' };

/**
 * TREE_FIT_FIX Revision 2 (2026-09-24): whether a tree's branching drawing (globals.css
 * .paper-figure__tree) fits the container, derived from the tree's own shape rather than a
 * leaves/depth pair keyed to today's specific figures (Revision 1's leaves=4/depth=3 exception
 * was a band-aid for Figure A-3 alone -- a differently-shaped future tree could clip again
 * without tripping it). Revision 5b split what was a single 'normal' bucket into two, using a
 * depth-aware formula (see the doc comment on treeFit below): 'normal' draws as branches from
 * 36rem; 'normal-deep' (a tree whose deepest branching node needs the extra room) needs 38.5rem;
 * 'wide' needs 54rem; 'outline' never draws as branches, at any width (verified: no inline figure
 * reaches this today).
 */
export type TreeFit = 'normal' | 'normal-deep' | 'wide' | 'outline';

/**
 * The narrowest share of the container width any leaf gets in the branching drawing: each level
 * of the tree splits ITS OWN share evenly among its children (that is what the flex layout in
 * globals.css actually does), so a leaf's share is the product of 1/(sibling count) over every
 * branching ancestor on its path from the root. A leaf that is the whole branch (no children of
 * its own to divide among) gets the full share it was handed, hence the base case of 1.
 */
function minLeafShare(branch: DiagramTreeNode): number {
  if (branch.children.length === 0) return 1;
  const childShare = 1 / branch.children.length;
  return Math.min(...branch.children.map((child) => childShare * minLeafShare(child)));
}

/**
 * TREE_FIT_FIX Revision 5b (2026-09-24): the owner's exact list (Revision 5's `isMultiLevelTree`
 * counted BRANCHING LEVELS and could not reproduce it -- Figure 7-6 has only one) is instead
 * reproduced by a depth-aware requiredRem formula: `9 / minShare + 1.25 * (branchDepth - 1)`,
 * where branchDepth is the depth (root = 1) of the DEEPEST node with 2+ children, counting
 * single-child pass-through levels on the way there. Figure 7-6's only branching node (`events`,
 * 4 children) sits at depth 3 (`sites` -> `stations` -> `events`, both pass-throughs on the way),
 * so it picks up `1.25 * 2 = 2.5rem` of extra required width even though its SHARE (1/4) is the
 * same as Figure E-1's -- which is exactly the accumulated-pass-through-padding cost Revision 3's
 * P3-2 documented and declined to model, now given a concrete (if approximate) coefficient rather
 * than left as an uncorrected gap in the plain share-only formula. `branchDepth` (below) is an
 * internal helper, consumed only by treeFit; figures.test.ts verifies its effect through treeFit's
 * own output and an independent re-implementation, the same pattern minLeafShare already uses.
 */
function branchDepth(roots: readonly DiagramTreeNode[]): number {
  let level: readonly DiagramTreeNode[] = roots;
  let depth = 1;
  let deepestBranch = 1;
  let sawBranch = false;
  while (level.length > 0) {
    if (level.some((node) => node.children.length >= 2)) {
      deepestBranch = depth;
      sawBranch = true;
    }
    level = level.flatMap((node) => node.children);
    depth += 1;
  }
  return sawBranch ? deepestBranch : 1;
}

/**
 * TREE_FIT_FIX Revision 3 (2026-09-24), P2/P3-2 limitation this model does not correct for
 * (documented, not fixed -- see TREE_FIT_FIX_RECEIPT.md Revision 3 for why): minLeafShare, and
 * therefore requiredRem below, treats each level as dividing the FULL remaining width among its
 * children. In reality the canvas itself costs about 2.5rem of padding, and every nested
 * `.paper-figure__children > .paper-figure__branch` level -- including a single-child
 * pass-through level that does not narrow the share at all -- costs about 0.75rem of its own
 * horizontal padding. A tree that is deep only because of several pass-through levels (e.g.
 * Figure 7-6: sites -> stations -> events -> {4 leaves}, then benthic -> prov) draws narrower
 * than this model reports at the same nominal share (measured live: E-1 at 1/4 share, 1 level,
 * 137px; 7-6 at the same 1/4 share, up to 4 levels, live-measured as low as 106-109px in the
 * 36.0-37.4rem band -- Revision 4's P2-2 fix raised the 'normal' entry point to 38.5rem
 * specifically because of this, but the underlying per-level cost is still not modelled, only
 * given more headroom). A per-level-padding-aware formula was evaluated and rejected for Revision
 * 3 because it changes Figure 7-6 (and, depending on the exact per-leaf comfort constant chosen,
 * Figure A-4 too) from 'normal' to 'wide' at the thresholds then in force -- i.e. it is not a
 * drop-in correction, it is a threshold recalibration that reaches beyond Figure A-3, which this
 * fix's mandate does not cover. Left as a documented, tested (figures.test.ts) gap rather than
 * shipped, per instruction: stop and report a bucket change outside Figure A-3 rather than ship
 * it. Revision 4 re-ran this same gap-pinning test against the raised 38.5rem threshold; the gap
 * remains real (a deep enough pass-through tree still crosses it) but no longer touches any of
 * today's catalogued figures at the widths this reader is measured against.
 */

/**
 * The branching drawing's fit for a tree structure. The PLAIN requiredRem (9 / minShare) decides
 * 'wide' (needs more than 38.5rem) and 'outline' (needs more than 54rem) exactly as Revisions 2-5
 * always have -- unchanged, so Figure A-3 (plain requiredRem exactly 54) stays 'wide', not
 * 'outline', regardless of its own depth (see below). Only once a tree's PLAIN requiredRem already
 * qualifies for what used to be the single 'normal' bucket (<= 38.5) does Revision 5b's
 * depth-aware ADJUSTED requiredRem (9 / minShare + 1.25 * (branchDepth - 1)) decide the finer
 * split: 'normal' (<= 36rem, e.g. Figures 6-1/A-1/A-2/E-1/7-5, all branchDepth 1) or 'normal-deep'
 * (> 36 and <= 38.5rem, e.g. Figure A-4 at ~37.25rem and Figure 7-6 at exactly 38.5rem). Applying
 * the depth term to EVERY tree (rather than only within the already-'normal' plain range) was
 * tried and rejected: it would push Figure A-3's adjusted value to 55.25rem, past the 54rem 'wide'
 * ceiling, reclassifying it as 'outline' and undoing this whole fix's original purpose -- exactly
 * the kind of unwanted bucket change outside the owner's list this project keeps stopping on
 * rather than shipping. See TREE_FIT_FIX_RECEIPT.md Revision 5b for the full per-figure table.
 *
 * P3-1 fix (2026-09-24), refined P3-3 (Revision 4): minLeafShare (and the model above) assumes
 * every root spans the FULL container width, which is only true for the single-root case.
 * globals.css draws >1 root (data-roots='many') either as a layer stack (layout 'stack', one
 * column, still full width -- the single-root assumption holds) or, for layout 'grid', as CSS
 * Grid auto-fit columns of minmax(min(100%, 15rem), 1fr): each root there gets only its own
 * column, not the full container. Once the container is wide enough for auto-fit to actually
 * expand to `roots.length` columns, each root's share of the container is exactly
 * 1/roots.length -- the worst case, and the exact case at that point -- so minShare is divided by
 * the root count for a multi-root grid (Revision 3's coarser fix only ever bumped 'normal' to
 * 'wide'; this reaches 'outline' too, when the shape needs it).
 */
export function treeFit(roots: readonly DiagramTreeNode[], layout?: DiagramLayout): TreeFit {
  if (roots.length === 0) return 'outline';
  const rawMinShare = Math.min(...roots.map(minLeafShare));
  // P3-1 fix (2026-09-24), replaced by the exact-division form in Revision 4 (P3-3): a multi-root
  // GRID board lays roots out in CSS Grid auto-fit columns (minmax(min(100%, 15rem), 1fr)), not the
  // full container width the single-root model above assumes. Once the container is wide enough for
  // auto-fit to actually expand to `roots.length` columns, each root's own share of the container is
  // exactly 1/roots.length -- the worst case, and the exact case at that point, so dividing by it
  // (rather than only bumping 'normal' to 'wide', Revision 3's coarser fix) also correctly reaches
  // 'outline' for a multi-root grid narrow enough to need it (e.g. two roots, one branching 4 ways,
  // needs 9 * 4 * 2 = 72rem -- 'outline', not capped at 'wide'). A multi-root layer STACK
  // (layout 'stack') keeps one full-width column, so it is not divided.
  const columns = layout === 'grid' && roots.length > 1 ? roots.length : 1;
  const minShare = rawMinShare / columns;
  const plainRequiredRem = 9 / minShare;
  if (plainRequiredRem > 54) return 'outline';
  if (plainRequiredRem > 38.5) return 'wide';
  const adjustedRequiredRem = plainRequiredRem + 1.25 * (branchDepth(roots) - 1);
  if (adjustedRequiredRem <= 36) return 'normal';
  if (adjustedRequiredRem <= 38.5) return 'normal-deep';
  return 'wide'; // depth pushed an otherwise-plain-normal tree past 38.5rem; none of today's figures reach this
}

/**
 * How a diagram is drawn. flow/stack draw as a vertical chain when the edges form
 * one path through every node; everything else draws as a top-down tree when each
 * node has at most one parent. Anything else is drawn as boxes plus an explicit
 * relationship list ('graph'), so no relationship is ever implied that the source
 * does not state.
 */
export function diagramStructure(model: DiagramModel): DiagramStructure {
  const byId = new Map(model.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, DiagramEdge[]>();
  const outgoing = new Map<string, DiagramEdge[]>();
  for (const edge of model.edges) {
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  if (model.nodes.some((node) => (incoming.get(node.id)?.length ?? 0) > 1)) return { kind: 'graph' };
  const roots = model.nodes.filter((node) => !incoming.has(node.id));
  if (roots.length === 0) return { kind: 'graph' };

  if (model.layout === 'flow' || model.layout === 'stack') {
    const chainable = roots.length === 1 && model.nodes.every((node) => (outgoing.get(node.id)?.length ?? 0) <= 1);
    if (chainable) {
      const steps: { node: DiagramNode; incomingLabel: string | null }[] = [];
      let current: DiagramNode | undefined = roots[0];
      let label: string | null = null;
      while (current) {
        steps.push({ node: current, incomingLabel: label });
        const next: DiagramEdge | undefined = outgoing.get(current.id)?.[0];
        label = next?.label ?? null;
        current = next ? byId.get(next.to) : undefined;
      }
      if (steps.length === model.nodes.length) return { kind: 'chain', steps };
    }
  }

  const seen = new Set<string>();
  const build = (node: DiagramNode, incomingLabel: string | null): DiagramTreeNode => {
    seen.add(node.id);
    const children = (outgoing.get(node.id) ?? []).map((edge) => build(byId.get(edge.to)!, edge.label));
    return { node, incomingLabel, children };
  };
  const built = roots.map((root) => build(root, null));
  if (seen.size !== model.nodes.length) return { kind: 'graph' };
  return { kind: 'tree', roots: built };
}

/**
 * Restored figures. The figure BODY is always the current source summary; the
 * number and caption are presentation only -- the owner-approved historical
 * v0.9.87 List of Figures numbering, kept pending Matrix MC's register. Each
 * entry is bound to the exact current summary text: summarySha256 is its
 * provenance hash (verified in tests), summaryFingerprint is checked at render
 * time, so a changed summary is drawn unnumbered and uncaptioned rather than
 * under a caption that belongs to other text.
 */
export interface PaperFigureEntry {
  readonly summaryNumber: number;
  readonly figureNumber: string;
  readonly caption: string;
  /** Section anchor of the paper chunk that holds the figure. */
  readonly sectionAnchor: string;
  /** Page of the figure in the v0.9.87 reference PDF (historical placement). */
  readonly referencePdfPage: number;
  /** sha256 of the summary items joined by LF (summarySourceText). */
  readonly summarySha256: string;
  /** sourceFingerprint of the same text. */
  readonly summaryFingerprint: string;
  /** Matrix MC disposition code (MATRIX_FIGURE_LINEAGE_ADJUDICATION_20260924). */
  readonly disposition: string;
  readonly notation: 'plain' | 'math';
  /**
   * Present only while the figure is a non-final prototype under a Matrix MC disposition.
   * `labels` and `note` (the adjudicated-nomenclature wording) are used ONLY by
   * restoredFigurePrototypeBinding, for the figure lab's own labelled prototype row
   * (owner decision 2026-09-24: label overrides are never applied on the default-on inline
   * stakeholder paper). `inlineNote` is the status note shown on the inline figure itself: a
   * plain-language draft note (owner decision 2026-09-24) that says the figure is a draft, its
   * content is being corrected, and it is not final -- it never names the disposition code, the
   * Matrix MC lane, or the adjudicated labels (see figure-register.ts INLINE_6_1_ACCESSIBLE_EQUIVALENT).
   */
  readonly prototype?: { readonly labels: Readonly<Record<string, string>>; readonly note: string; readonly inlineNote: string };
}

export const PAPER_FIGURE_REFERENCE = 'Draft Matrix Options Paper v0.9.87 (2026-09-05), List of Figures';
/** The Matrix MC content disposition these entries follow. */
export const FIGURE_ADJUDICATION = { file: 'MATRIX_FIGURE_LINEAGE_ADJUDICATION_20260924.md', sha256: '9e6f5e191458891bcbf730ba803c84806ae6478b2a4d0077ec9fa21a75bd4ddd' } as const;

const CURRENT = 'CURRENT_CONTENT_RESTORE';
const NOTATION_ONLY = 'NOTATION_ONLY_VARIANT';

export const PAPER_FIGURES: readonly PaperFigureEntry[] = [
  {
    summaryNumber: 8, figureNumber: '6-1', caption: 'CSR Schedule 3.4 Part 1: the four receptor-pathways.', sectionAnchor: 'sec-6-0', referencePdfPage: 35, summarySha256: '3ef00f9dc1b204e33d362a18dbcb7cc2f249f0061dd56f6abc97bbd64c019733', summaryFingerprint: 'a99421fd',
    disposition: 'CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING', notation: 'plain',
    prototype: {
      labels: { p1: 'PATHWAY 1: SedS-contactHH', p2: 'PATHWAY 2: SedS-foodHH', p3: 'PATHWAY 3: SedS-contactECO', p4: 'PATHWAY 4: SedS-foodECO' },
      note: 'Prototype, not final: the pathway names follow the owner-approved nomenclature recorded by Matrix MC; the box wording awaits Matrix MC\'s accepted source block. Figure lab only; not shown on the stakeholder paper.',
      inlineNote: 'Draft figure: current paper content, being corrected; not final.',
    },
  },
  { summaryNumber: 9, figureNumber: '7-3', caption: 'Generic standards adoption procedure.', sectionAnchor: 'sec-7-0', referencePdfPage: 64, summarySha256: 'd6b599346c993bb66722f43d2af2f87212a3fff612c738533eea9b46cf79cd1b', summaryFingerprint: 'ef87c72d', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 10, figureNumber: '7-4', caption: 'Four-Tier jurisdictional hierarchy of preference.', sectionAnchor: 'sec-7-0', referencePdfPage: 65, summarySha256: '7b800be865d3d95e10c4a3b277ec658c973c4dece7dfc8fdf6a6a9823049558a', summaryFingerprint: '46734c2f', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 11, figureNumber: '7-5', caption: 'BC aquatic database.', sectionAnchor: 'sec-7-0', referencePdfPage: 70, summarySha256: '5b4d753a05233a71be5f1df84ea58a7e133d16482ef05c01ee361d8d94d1ed0a', summaryFingerprint: '5c19357a', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 12, figureNumber: '7-6', caption: 'Environmental data compilation model.', sectionAnchor: 'sec-7-0', referencePdfPage: 72, summarySha256: 'ca48edc10357e5a61c43aee492330beaca766ea7259bac0e4f6d821ff6a62527', summaryFingerprint: 'db4251e6', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 1, figureNumber: 'A-1', caption: 'The two bioavailability pathways.', sectionAnchor: 'app-a', referencePdfPage: 173, summarySha256: 'c4dd042f36369d353b575f9f2f372b3754f65ef01e01005ec5b762d6067dca47', summaryFingerprint: 'e588622d', disposition: NOTATION_ONLY, notation: 'math' },
  { summaryNumber: 2, figureNumber: 'A-2', caption: 'Equilibrium partitioning (EqP) phase distribution.', sectionAnchor: 'app-a', referencePdfPage: 178, summarySha256: '4c7ac65b746d8001b5bddc707d70721ba0bd293e6010e64d6339663db0bc558c', summaryFingerprint: 'bb3017db', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 3, figureNumber: 'A-3', caption: 'AVS-SEM metal displacement and neutralization.', sectionAnchor: 'app-a', referencePdfPage: 183, summarySha256: '153311d073fea08db5952c49c0d2a0396bd1eec8cccf03fd4f75def1be326d18', summaryFingerprint: '327b9fbc', disposition: NOTATION_ONLY, notation: 'math' },
  { summaryNumber: 4, figureNumber: 'A-4', caption: 'Tiered bioavailability decision tree.', sectionAnchor: 'app-a', referencePdfPage: 195, summarySha256: '152e2e1f647a8d53d1e7fab4fe80a2596b7cb379951b1d2b40615be673e7c699', summaryFingerprint: '127156f6', disposition: NOTATION_ONLY, notation: 'math' },
  { summaryNumber: 5, figureNumber: 'E-1', caption: 'CSR Schedule 3.4 Part 1 matrix architecture.', sectionAnchor: 'app-e', referencePdfPage: 281, summarySha256: '5212439df55c334a16e453cbe08428f3ffa379a886f1d01df34cb08f93127915', summaryFingerprint: '78b50005', disposition: CURRENT, notation: 'plain' },
  { summaryNumber: 6, figureNumber: 'F-1', caption: 'Generic standards adoption architecture.', sectionAnchor: 'app-f', referencePdfPage: 305, summarySha256: '902d70ba4293e82cef786af8ec94fa01895ab868aabe11d722e9df71e68569c2', summaryFingerprint: '5ed6b1f2', disposition: CURRENT, notation: 'plain' },
  // F-2: CURRENT_CONTENT_DIRECTION_ACCEPTED -- the current summary's "Classification Category 2" entry condition, never the obsolete v1.0 "Tranche 3".
  { summaryNumber: 7, figureNumber: 'F-2', caption: 'Step-by-Step generic adoption & mathematical harmonization workflow.', sectionAnchor: 'app-f', referencePdfPage: 310, summarySha256: '4a13a3414ad4694682d12cb306294f52ff97e4103c21c7d777594cdf4a7574f8', summaryFingerprint: 'aed8adf7', disposition: 'CURRENT_CONTENT_DIRECTION_ACCEPTED', notation: 'plain' },
];

/** The registry entry for a parsed diagram, only when the diagram is exactly the bound text. */
export function paperFigureEntry(model: DiagramModel): PaperFigureEntry | null {
  const entry = PAPER_FIGURES.find((candidate) => candidate.summaryNumber === model.summaryNumber);
  if (!entry) return null;
  return sourceFingerprint(summarySourceText(model)) === entry.summaryFingerprint ? entry : null;
}

/**
 * The binding for a restored figure, or null when its summary is not the bound text. This is the
 * binding used everywhere a figure is drawn from the deployed paper -- the default-on inline
 * stakeholder paper AND the figure lab's own row for that figure number -- and it NEVER carries a
 * label override (owner decision 2026-09-24): a non-final prototype (currently only Figure 6-1)
 * is drawn with its own current-paper labels and a plain-language draft status note (it does not
 * name the disposition code or the Matrix MC lane -- see the inlineNote doc comment above), never
 * with the adjudicated SedS pathway names. See restoredFigurePrototypeBinding for the separate,
 * lab-only labelled prototype.
 */
export function restoredFigureBinding(model: DiagramModel): FigureBinding | null {
  const entry = paperFigureEntry(model);
  if (!entry) return null;
  return {
    kind: 'restored',
    id: entry.figureNumber,
    label: `Figure ${entry.figureNumber}`,
    caption: entry.caption,
    sourceSha256: entry.summarySha256,
    status: entry.prototype ? 'prototype-nonfinal' : 'current',
    statusNote: entry.prototype?.inlineNote ?? null,
    notation: entry.notation,
    labelOverrides: null,
    overrideAuthority: null,
    disposition: entry.prototype ? entry.disposition : undefined,
  };
}

/**
 * The figure lab's own labelled prototype (owner decision 2026-09-24): the same restored figure,
 * still drawn from the current deployed summary body, but with the Matrix MC adjudicated pathway
 * label overrides applied and their authority named. Null for any figure with no adjudicated
 * override (every current entry but Figure 6-1). Never used by the inline stakeholder paper; the
 * id carries a '-seds' suffix so it never collides with the plain restored figure's DOM id when
 * the lab shows both in the same row.
 */
export function restoredFigurePrototypeBinding(model: DiagramModel): FigureBinding | null {
  const entry = paperFigureEntry(model);
  if (!entry?.prototype) return null;
  return {
    kind: 'restored',
    id: `${entry.figureNumber}-seds`,
    label: `Figure ${entry.figureNumber}`,
    caption: entry.caption,
    sourceSha256: entry.summarySha256,
    status: 'prototype-nonfinal',
    statusNote: entry.prototype.note,
    notation: entry.notation,
    labelOverrides: entry.prototype.labels,
    overrideAuthority: `${FIGURE_ADJUDICATION.file} sha256 ${FIGURE_ADJUDICATION.sha256}`,
  };
}

/** Text run: plain, subscript (C_sed, K_oc, IR_food) or superscript (Me^(2+), math notation only). */
export type NotationRun = { readonly text: string; readonly sub: boolean; readonly sup: boolean };

// A one-to-three letter symbol, an underscore, then a lowercase subscript with an
// optional comma-separated lowercase qualifier ("C_sed,dw"). Longer words joined by
// underscores ("Excess_SEM_OC") are identifiers, not notation, and stay as written.
// No lookbehind: this runs in the browser, and Safari before 16.4 cannot parse one. The
// leading boundary is captured instead (group 1) and kept as plain text.
const SUBSCRIPT = /(^|[^A-Za-z0-9])([A-Za-z]{1,3})_([a-z][a-z0-9]*(?:,[a-z][a-z0-9]*)?)(?![A-Za-z0-9_])/g;
const SUPERSCRIPT = /\^\(([^)\s]+)\)/g;

// Math glyphs are built from code points so this source stays plain ASCII.
const GLYPH = {
  implies: String.fromCharCode(0x21d2),
  arrow: String.fromCharCode(0x2192),
  le: String.fromCharCode(0x2264),
  ge: String.fromCharCode(0x2265),
  sigma: String.fromCharCode(0x03a3),
  times: String.fromCharCode(0x00d7),
  micro: String.fromCharCode(0x00b5),
};

/**
 * ASCII mathematical spellings as notation, for figures whose disposition is
 * notation-only (the scientific content is unchanged). Longest forms first.
 */
export function mathGlyphs(text: string): string {
  return text
    .replace(/==>/g, GLYPH.implies)
    .replace(/-{2,3}>/g, GLYPH.arrow)
    .replace(/<=/g, GLYPH.le)
    .replace(/>=/g, GLYPH.ge)
    .replace(/\bSigma(?=[[(])/g, GLYPH.sigma)
    .replace(/ \* /g, ` ${GLYPH.times} `)
    .replace(/\bumol\b/g, `${GLYPH.micro}mol`);
}

function subscriptRuns(text: string, sup: false): NotationRun[] {
  const runs: NotationRun[] = [];
  let last = 0;
  for (const match of text.matchAll(SUBSCRIPT)) {
    const start = match.index ?? 0;
    runs.push({ text: `${text.slice(last, start)}${match[1]}${match[2]}`, sub: false, sup });
    runs.push({ text: match[3], sub: true, sup });
    last = start + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), sub: false, sup });
  return runs;
}

export function notationRuns(text: string, notation: 'plain' | 'math' = 'plain'): NotationRun[] {
  if (notation === 'plain') return subscriptRuns(text, false).filter((run) => run.text !== '');
  const runs: NotationRun[] = [];
  let last = 0;
  for (const match of text.matchAll(SUPERSCRIPT)) {
    const start = match.index ?? 0;
    runs.push(...subscriptRuns(text.slice(last, start), false));
    runs.push({ text: match[1], sub: false, sup: true });
    last = start + match[0].length;
  }
  runs.push(...subscriptRuns(text.slice(last), false));
  return runs.map((run) => ({ ...run, text: mathGlyphs(run.text) })).filter((run) => run.text !== '');
}
/** Options for diagramDescription, passed only by candidate bindings (P3-1); omitting this argument leaves the description byte-identical to before. */
export interface DiagramDescriptionOptions {
  /** Replaces "leads to" in the Connections sentence and the visible relations list. */
  readonly relation?: string;
}

/**
 * Plain-language description of the diagram's structure for assistive technology.
 * Box text is read from the figure itself; this states what the connectors show. When
 * `options` is passed (candidate bindings only), a node with edges present but none touching
 * it is called out by name, so a reader is told it has no connection rather than left to infer
 * that from its absence in the Connections sentence.
 */
export function diagramDescription(model: DiagramModel, notation: 'plain' | 'math' = 'plain', options?: DiagramDescriptionOptions): string {
  // Read the labels as the figure shows them (subscripts joined, math spellings as notation).
  const shown = (text: string) => notationRuns(text, notation).map((run) => run.text).join('');
  const labelOf = new Map(model.nodes.map((node) => [node.id, shown(node.label)]));
  const relation = options?.relation ?? 'leads to';
  const parts = [`Diagram with ${model.nodes.length} ${model.nodes.length === 1 ? 'box' : 'boxes'}.`];
  if (model.edges.length > 0) {
    const links = model.edges.map((edge) => `${labelOf.get(edge.from)} ${relation} ${labelOf.get(edge.to)}${edge.label ? ` (${shown(edge.label)})` : ''}`);
    parts.push(`Connections: ${links.join('; ')}.`);
    if (options) {
      const touched = new Set(model.edges.flatMap((edge) => [edge.from, edge.to]));
      const untouched = model.nodes.filter((node) => !touched.has(node.id));
      if (untouched.length > 0) parts.push(`Shown without a drawn connection: ${untouched.map((node) => labelOf.get(node.id)).join('; ')}.`);
    }
  } else if (model.nodes.length > 1) {
    parts.push(`No connections; the boxes are, in order: ${model.nodes.map((node) => shown(node.label)).join('; ')}.`);
  }
  return parts.join(' ');
}

/**
 * The figure as the paper's own diagram language (the ```diagram block form the
 * v0.9.87 build rendered), for handing a figure definition to the foundational
 * paper. Inverse of the flattening; a head line keeps any ": " it contains.
 */
export function diagramToDsl(model: DiagramModel): string {
  const lines = [`layout ${model.layout}`];
  if (model.title) lines.push(`title ${model.title}`);
  for (const node of model.nodes) {
    lines.push(`node ${node.id}: ${node.label}`);
    for (const head of node.heads) lines.push(`  head ${head}`);
    for (const bullet of node.bullets) lines.push(`  bul ${bullet}`);
  }
  for (const edge of model.edges) {
    lines.push(`edge ${edge.from} -> ${edge.to}`);
    if (edge.label) lines.push(`label ${edge.label}`);
  }
  for (const note of model.notes) lines.push(`note ${note}`);
  return ['```diagram', ...lines, '```'].join('\n');
}