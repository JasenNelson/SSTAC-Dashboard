import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { candidateModel, figureCandidateAsset } from '@/lib/matrix-options/paper/figure-candidates';
import {
  diagramDescription,
  diagramStructure,
  notationRuns,
  diagramToDsl,
  FIGURE_ADJUDICATION,
  mathGlyphs,
  modelForBinding,
  PAPER_FIGURES,
  paperFigureEntry,
  parseDiagramSummary,
  restoredFigureBinding,
  restoredFigurePrototypeBinding,
  sourceFingerprint,
  splitPaperMarkdown,
  summarySourceText,
  treeFit,
  type DiagramModel,
  type DiagramTreeNode,
} from '../figures';

const paper = loadRevisedPaperStructure().content;
const SUMMARY_LINE = /^\*\*Diagram summary (\d+)\.\*\*\s*$/gm;
const sourceSummaries = Array.from(paper.matchAll(SUMMARY_LINE), (match) => Number(match[1]));
const segments = splitPaperMarkdown(paper);
const figures = segments.flatMap((segment) => (segment.kind === 'figure' ? [segment] : []));
const modelOf = (summary: number): DiagramModel => figures.find((figure) => figure.model.summaryNumber === summary)!.model;

/** Section anchor that holds a given character offset of the paper. */
function anchorAt(offset: number): string | null {
  let anchor: string | null = null;
  for (const match of paper.matchAll(/<div id="([^"]+)" class="section-anchor"><\/div>/g)) {
    if ((match.index ?? 0) > offset) break;
    anchor = match[1];
  }
  return anchor;
}

describe('paper figures: the deployed release', () => {
  it('draws every Diagram summary in the release as a figure and leaves none as text', () => {
    // Anti-vacuity: the release really carries the flattened figures.
    expect(sourceSummaries).toHaveLength(12);
    expect(figures.map((figure) => figure.model.summaryNumber).sort((a, b) => a - b)).toEqual([...sourceSummaries].sort((a, b) => a - b));
    for (const segment of segments) {
      if (segment.kind === 'markdown') expect(segment.markdown).not.toMatch(/Diagram summary \d+/);
    }
  });

  it('keeps every source byte: prose plus figure sources reassemble the paper exactly', () => {
    const rebuilt = segments.map((segment) => (segment.kind === 'figure' ? segment.source : segment.markdown));
    // Segments are joined on the line boundaries the splitter cut at.
    expect(rebuilt.join('\n').replace(/\n+/g, '\n')).toBe(paper.replace(/\n+/g, '\n'));
  });

  it('binds each figure to exactly one reference-PDF entry, and each entry to exactly one figure (two-sided)', () => {
    const bound = figures.map((figure) => paperFigureEntry(figure.model)?.figureNumber ?? null);
    expect(bound).not.toContain(null);
    expect(new Set(bound).size).toBe(figures.length);
    expect([...bound].sort()).toEqual(PAPER_FIGURES.map((entry) => entry.figureNumber).sort());
    expect(new Set(PAPER_FIGURES.map((entry) => entry.summaryNumber))).toEqual(new Set(sourceSummaries));
  });

  it('binds each figure body to the exact current summary text: sha256 and runtime fingerprint (two-sided)', () => {
    for (const entry of PAPER_FIGURES) {
      const text = summarySourceText(modelOf(entry.summaryNumber));
      expect(createHash('sha256').update(text, 'utf8').digest('hex'), `Figure ${entry.figureNumber}`).toBe(entry.summarySha256);
      expect(sourceFingerprint(text)).toBe(entry.summaryFingerprint);
      expect(restoredFigureBinding(modelOf(entry.summaryNumber))).toMatchObject({
        kind: 'restored', id: entry.figureNumber, label: `Figure ${entry.figureNumber}`, caption: entry.caption, sourceSha256: entry.summarySha256,
        status: entry.prototype ? 'prototype-nonfinal' : 'current', notation: entry.notation,
      });
    }
    // One changed character in the current summary unbinds the historical number and caption.
    const six = modelOf(8);
    const edited = parseDiagramSummary(8, six.items.map((item) => item.replace('Shoreline Wading', 'Shoreline wading')))!;
    expect(edited).not.toBeNull();
    expect(paperFigureEntry(edited)).toBeNull();
    expect(restoredFigureBinding(edited)).toBeNull();
    const reordered = parseDiagramSummary(8, [...six.items.slice(0, -2), six.items[six.items.length - 1], six.items[six.items.length - 2]])!;
    expect(paperFigureEntry(reordered)).toBeNull();
  });

  it('exports each figure as the paper diagram language, which parses back to the same drawing', () => {
    for (const { model } of figures) {
      const dsl = diagramToDsl(model);
      expect(dsl.startsWith('```diagram\n') && dsl.endsWith('\n```')).toBe(true);
      // Re-flatten with the same mapping the remediation stage used, then parse: same nodes, edges, labels.
      const items = dsl.split('\n').slice(1, -1).map((line) => line.trim()).map((line) => {
        const [keyword, ...rest] = line.split(' ');
        const value = rest.join(' ');
        if (keyword === 'layout') return `Layout: ${value}`;
        if (keyword === 'node') return `Node ${value}`;
        if (keyword === 'bul') return `Criterion: ${value}`;
        if (keyword === 'edge') return `Relationship: ${value}`;
        return `Diagram note: ${line}`;
      });
      const back = parseDiagramSummary(model.summaryNumber, items)!;
      expect(back.nodes, `summary ${model.summaryNumber}`).toEqual(model.nodes);
      expect(back.edges).toEqual(model.edges);
      expect(back.title).toBe(model.title);
    }
  });
  it('places each figure in the section its registry entry names', () => {
    for (const entry of PAPER_FIGURES) {
      const offset = paper.indexOf(`**Diagram summary ${entry.summaryNumber}.**`);
      expect(offset, `summary ${entry.summaryNumber}`).toBeGreaterThan(0);
      expect(anchorAt(offset), `Figure ${entry.figureNumber}`).toBe(entry.sectionAnchor);
    }
  });

  it('pins the two figures the owner reproduced: Section 6.0 summary 8 is Figure 6-1, Appendix A summary 1 is Figure A-1', () => {
    const six = modelOf(8);
    expect(paperFigureEntry(six)).toMatchObject({ figureNumber: '6-1', sectionAnchor: 'sec-6-0' });
    expect(six.title).toBe('CSR SCHEDULE 3.4 PART 1 - THE FOUR RECEPTOR-PATHWAYS');
    expect(six.nodes.map((node) => node.label)).toEqual([
      'SEDIMENT CONTAMINATION (C_sed)',
      'PATHWAY 1: HH-DIR',
      'PATHWAY 2: HH-FOOD',
      'PATHWAY 3: ECO-DIR',
      'PATHWAY 4: ECO-FOOD',
    ]);
    expect(six.edges.map((edge) => `${edge.from}->${edge.to}`)).toEqual(['root->p1', 'root->p2', 'root->p3', 'root->p4']);
    const a1 = modelOf(1);
    expect(paperFigureEntry(a1)).toMatchObject({ figureNumber: 'A-1', sectionAnchor: 'app-a' });
    // The flattening emitted these head lines as "Node (PATHWAY 3: ...)"; they are read back as heads.
    expect(a1.nodes.map((node) => node.id)).toEqual(['root', 'eco', 'hh']);
    expect(a1.nodes[1].heads).toEqual(['(PATHWAY 3: C_sed,EqP)']);
    expect(a1.nodes[2].heads).toEqual(['(PATHWAY 1: C_sed,HH-direct)']);
  });

  it('represents every source item of every figure (no content dropped)', () => {
    for (const { model } of figures) {
      const represented = 1 // layout
        + (model.title ? 1 : 0)
        + model.nodes.reduce((sum, node) => sum + 1 + node.heads.length + node.bullets.length, 0)
        + model.edges.reduce((sum, edge) => sum + 1 + (edge.label ? 1 : 0), 0)
        + model.notes.length;
      expect(represented, `summary ${model.summaryNumber}`).toBe(model.items.length);
    }
  });

  it('draws chains for flow/stack paths and trees for the rest, with edge labels kept', () => {
    const kinds = Object.fromEntries(figures.map(({ model }) => [paperFigureEntry(model)!.figureNumber, diagramStructure(model).kind]));
    expect(kinds).toEqual({
      '6-1': 'tree', '7-3': 'chain', '7-4': 'chain', '7-5': 'tree', '7-6': 'tree',
      'A-1': 'tree', 'A-2': 'tree', 'A-3': 'tree', 'A-4': 'tree', 'E-1': 'tree', 'F-1': 'chain', 'F-2': 'chain',
    });
    const hierarchy = diagramStructure(modelOf(10));
    expect(hierarchy.kind).toBe('chain');
    if (hierarchy.kind === 'chain') {
      expect(hierarchy.steps.map((step) => step.incomingLabel)).toEqual([null, null, '(If unavailable or outdated)', '(If unavailable)', '(If unavailable)']);
    }
    const decision = diagramStructure(modelOf(4));
    expect(decision.kind).toBe('tree');
    if (decision.kind === 'tree') {
      expect(decision.roots.map((root) => root.node.id)).toEqual(['tier1']);
      expect(decision.roots[0].children.map((child) => `${child.node.id}:${child.incomingLabel}`)).toEqual(['tier2:YES', 'appr1:NO']);
    }
  });

  /*
   * TREE_FIT_FIX Revision 2 (2026-09-24): the branching drawing (globals.css
   * .paper-figure__tree, container queries keyed on data-fit) only fits a tree whose narrowest
   * leaf keeps a large-enough share of the container -- each level splits ITS OWN share evenly
   * among its children, so a leaf nested inside two branching levels (Figure A-3's second, nested
   * split: sed -> {avs, sem, disp}, then disp -> {case1, case2}) drew its case1/case2 boxes at
   * 81-85px wide (QA measured, below the 110px minimum) despite looking no "wider" by total leaf
   * count than several figures that never had a problem. treeFit computes the real physical
   * quantity (the narrowest leaf's width share) instead of a leaves/depth pair, so a differently
   * shaped future tree is judged on its own geometry, not on matching today's one known-bad shape.
   */
  it("computes each real tree figure's minimum leaf share and fit, exactly as globals.css keys off data-fit", () => {
    const treeOf = (summary: number) => {
      const structure = diagramStructure(modelOf(summary));
      if (structure.kind !== 'tree') throw new Error(`Diagram summary ${summary} is not a tree`);
      return structure.roots;
    };
    // Independent re-implementation of the same recursive share calculation treeFit itself uses
    // (figures.ts minLeafShare is not exported -- this proves treeFit's result against a
    // second, hand-checked derivation of the geometry, not just against its own internals).
    const walk = (node: DiagramTreeNode): number => {
      if (node.children.length === 0) return 1;
      const share = 1 / node.children.length;
      return Math.min(...node.children.map((child) => share * walk(child)));
    };
    const minShare = (roots: ReturnType<typeof treeOf>) => Math.min(...roots.map(walk));
    // Every shallow (branchDepth 1) real tree figure: minShare = 1/2 or 1/4, requiredRem <= 36,
    // 'normal'. A-4 and 7-6 are depth-2/3 and land in 'normal-deep' instead (Revision 5b; see the
    // dedicated depth-aware bucket test below for their exact worked values).
    for (const [summary, figureNumber] of [[1, 'A-1'], [2, 'A-2'], [5, 'E-1'], [8, '6-1'], [11, '7-5']] as const) {
      expect(treeFit(treeOf(summary)), figureNumber).toBe('normal');
    }
    for (const [summary, figureNumber] of [[4, 'A-4'], [12, '7-6']] as const) {
      expect(treeFit(treeOf(summary)), figureNumber).toBe('normal-deep');
    }
    // A-3: sed -> {avs, sem, disp} (share 1/3 each), disp -> {case1, case2} (share 1/2 of disp's
    // own 1/3 = 1/6). minShare = 1/6, requiredRem = 9 / (1/6) = 54 -- 'wide' (matches the task's
    // own worked example).
    const a3Roots = treeOf(3);
    expect(minShare(a3Roots)).toBeCloseTo(1 / 6, 10);
    expect(treeFit(a3Roots)).toBe('wide');
    // E-1: root -> {p1, p2, p3, p4}, no grandchildren. minShare = 1/4, requiredRem = 36 -- 'normal'
    // (matches the task's own worked example; also the boundary value: exactly 36 counts as fitting).
    const e1Roots = treeOf(5);
    expect(minShare(e1Roots)).toBeCloseTo(1 / 4, 10);
    expect(treeFit(e1Roots)).toBe('normal');
  });

  it("computes minLeafShare-driven fit for a synthetic tree wide enough to need 'outline'", () => {
    const leaf = (id: string): DiagramTreeNode => ({ node: { id, label: id, heads: [], bullets: [] }, incomingLabel: null, children: [] });
    // root -> 8 children, each a leaf: minShare = 1/8, requiredRem = 9 * 8 = 72 -- past 54, 'outline'.
    const wide: DiagramTreeNode = {
      node: { id: 'root', label: 'root', heads: [], bullets: [] },
      incomingLabel: null,
      children: Array.from({ length: 8 }, (_, index) => leaf(`leaf${index}`)),
    };
    expect(treeFit([wide])).toBe('outline');
    // A tree with no roots at all (defensive case; diagramStructure never actually returns this
    // for kind 'tree') also falls back to 'outline' rather than throwing or dividing by zero.
    expect(treeFit([])).toBe('outline');
  });

  /*
   * P3-1 (leg1a_r9.md), refined P3-3 (leg1a_r10.md, 2026-09-24): minLeafShare assumes a root spans
   * the FULL container width, true for a single root and for a multi-root layer stack (layout
   * 'stack', still one column), but not for a multi-root GRID board (globals.css
   * .paper-figure__tree[data-roots='many'] under [data-layout='grid']: CSS Grid auto-fit columns of
   * minmax(min(100%, 15rem), 1fr), so each root gets only its own column once that many columns
   * actually fit). treeFit's second argument divides minShare by the root count for that case --
   * an exact model at the point auto-fit expands that far, not just a single-bucket bump (Revision
   * 3's coarser fix, which could never reach 'outline').
   */
  it('divides minShare by root count for a multi-root GRID tree, but leaves a multi-root STACK (still full width) alone', () => {
    const leaf = (id: string): DiagramTreeNode => ({ node: { id, label: id, heads: [], bullets: [] }, incomingLabel: null, children: [] });
    const branchingRoot: DiagramTreeNode = {
      node: { id: 'root', label: 'root', heads: [], bullets: [] },
      incomingLabel: null,
      children: [leaf('p2'), leaf('p4')],
    };
    const isolatedLeafRoot: DiagramTreeNode = leaf('shared-evidence-gate');
    const roots = [branchingRoot, isolatedLeafRoot];
    // Without the layout argument (or for a non-grid layout), the single-share model alone applies:
    // minShare = 1/2 (branchingRoot's two leaf children), requiredRem = 18 -- 'normal'.
    expect(treeFit(roots)).toBe('normal');
    expect(treeFit(roots, 'stack')).toBe('normal');
    expect(treeFit(roots, 'tree')).toBe('normal');
    // Grid + multi-root: minShare divided by 2 roots -> 1/2 * 1/2 = 1/4, requiredRem = 36 -- still
    // 'normal' under the 38.5rem threshold (this is exactly the mx-asset-bioaccumulation-pathways
    // lab candidate's shape, confirmed live below: 2 columns of ~half the container each, then the
    // branching root's own 2 children split that half again, landing at the same effective 1/4
    // share as a plain 4-way single-root split like E-1).
    expect(treeFit(roots, 'grid')).toBe('normal');
    // A flat multi-root grid also divides by root count: 3 flat leaf roots -> minShare = 1/3,
    // requiredRem = 27 -- 'normal' (still well within margin; a grid with enough flat roots to
    // cross a threshold would correctly need more room too, unlike Revision 3's exemption for
    // "no root branches further").
    const flatRoots = [leaf('a'), leaf('b'), leaf('c')];
    expect(treeFit(flatRoots, 'grid')).toBe('normal');
    // Two roots, one branching 4 ways (leg1a_r10.md P3-3's own example): without dividing,
    // minShare = 1/4 (the branching root's own share), requiredRem = 36 -- 'normal'; dividing by
    // the 2 roots (minShare = 1/8, requiredRem = 72) correctly reaches 'outline', not capped at
    // 'wide' the way Revision 3's single-bucket bump was.
    const fourWayRoot: DiagramTreeNode = {
      node: { id: 'root2', label: 'root2', heads: [], bullets: [] },
      incomingLabel: null,
      children: ['w', 'x', 'y', 'z'].map(leaf),
    };
    expect(treeFit([fourWayRoot, isolatedLeafRoot])).toBe('normal');
    expect(treeFit([fourWayRoot, isolatedLeafRoot], 'grid')).toBe('outline');
    // A multi-root grid whose plain-share fit was ALREADY 'outline' before dividing stays there.
    const deepRoot: DiagramTreeNode = {
      node: { id: 'root3', label: 'root3', heads: [], bullets: [] },
      incomingLabel: null,
      children: [{ node: { id: 'mid', label: 'mid', heads: [], bullets: [] }, incomingLabel: null, children: ['x', 'y', 'z', 'p', 'q', 'r', 'u', 'v'].map(leaf) }],
    };
    expect(treeFit([deepRoot, isolatedLeafRoot])).toBe('outline');
    expect(treeFit([deepRoot, isolatedLeafRoot], 'grid')).toBe('outline');
  });

  it('confirms the live mx-asset-bioaccumulation-pathways lab candidate is exactly the grid multi-root shape treeFit now corrects for', () => {
    const asset = figureCandidateAsset('mx-asset-bioaccumulation-pathways')!;
    const model = candidateModel(asset);
    expect(model.layout).toBe('grid');
    const structure = diagramStructure(model);
    expect(structure.kind).toBe('tree');
    if (structure.kind !== 'tree') return;
    expect(structure.roots.length).toBeGreaterThan(1);
    expect(structure.roots.some((root) => root.children.length > 0)).toBe(true);
    // Without the layout argument, the single-root model over-estimates the room this candidate
    // gets (minShare 1/2, requiredRem 18); dividing by its 2 roots (minShare 1/4, requiredRem 36)
    // still lands 'normal' under the 38.5rem threshold -- both calls agree here, which is expected
    // for this particular shallow shape (see the root-count-division test above for a shape where
    // they diverge).
    expect(treeFit(structure.roots)).toBe('normal');
    expect(treeFit(structure.roots, model.layout)).toBe('normal');
  });

  /*
   * P3-2 (leg1a_r9.md) gap, CLOSED by Revision 5b's depth-aware formula (2026-09-24): the plain
   * share-only model could not tell a deep pass-through tree (narrow in practice, e.g. Figure 7-6)
   * from a shallow one at the same nominal share (e.g. Figure E-1) -- Revisions 3/4 documented this
   * as an accepted gap and compensated only by raising the whole 'normal' entry point uniformly.
   * Revision 5b's branchDepth term directly charges for accumulated pass-through depth, so the
   * SAME synthetic deep tree this test previously used to PIN the gap now correctly reports it
   * needs more room than 'normal' or 'normal-deep' can give it.
   */
  it("confirms the depth-aware formula now correctly flags a deep pass-through tree as needing more room (P3-2 gap closed)", () => {
    // A single 1-in-4-out split (same 1/4 share as E-1) buried under 6 single-child pass-through
    // levels -- each pass-through level costs its own real horizontal padding in the layout without
    // narrowing the share at all, which minLeafShare alone cannot see, but branchDepth now counts.
    const leaf = (id: string): DiagramTreeNode => ({ node: { id, label: id, heads: [], bullets: [] }, incomingLabel: null, children: [] });
    let deep: DiagramTreeNode = {
      node: { id: 'split', label: 'split', heads: [], bullets: [] },
      incomingLabel: null,
      children: [leaf('a'), leaf('b'), leaf('c'), leaf('d')],
    };
    for (let index = 0; index < 6; index += 1) deep = { node: { id: `chain${index}`, label: `chain${index}`, heads: [], bullets: [] }, incomingLabel: null, children: [deep] };
    // Independent re-implementation of branchDepth: split sits at depth 7 (6 wrapping levels + the
    // split node itself), same 1/4 share as E-1. plainRequiredRem = 36 (same as E-1); adjusted =
    // 36 + 1.25 * (7 - 1) = 43.5, past 38.5 -- treeFit's own two-stage logic then reports 'wide'
    // (not 'outline': the escalation only happens because the ADJUSTED value crosses 38.5, which
    // treeFit's fallback branch maps to 'wide', consistent with never reaching 'outline' for a tree
    // whose plain share was already comfortably 'normal').
    const depthOf = (node: DiagramTreeNode, depth: number): number => (node.children.length >= 2 ? depth : node.children.length === 1 ? depthOf(node.children[0], depth + 1) : depth - 1);
    expect(depthOf(deep, 1)).toBe(7);
    expect(treeFit([deep])).toBe('wide');
  });

  /*
   * TREE_FIT_FIX Revision 5b (2026-09-24): the owner's exact list is reproduced by a depth-aware
   * requiredRem formula (9 / minShare + 1.25 * (branchDepth - 1), applied only within the plain
   * 'normal' range -- see the doc comment above treeFit for why applying it everywhere would wrongly
   * push Figure A-3 into 'outline'). This test pins every one of the 8 tree-structured inline
   * figures' buckets against the owner's own list, using an independent, test-only re-implementation
   * of branchDepth (not a call into figures.ts internals) to compute the expected adjusted value by
   * hand for the two figures that need it (A-4, 7-6).
   */
  it("computes treeFit's depth-aware bucket for every tree-structured inline figure, matching the owner's exact list", () => {
    const treeOf = (summary: number) => {
      const structure = diagramStructure(modelOf(summary));
      if (structure.kind !== 'tree') throw new Error(`Diagram summary ${summary} is not a tree`);
      return structure.roots;
    };
    // Independent re-implementation of minLeafShare (figures.ts's own version is internal).
    const minShareOf = (roots: readonly DiagramTreeNode[]): number => {
      const walk = (node: DiagramTreeNode): number => (node.children.length === 0 ? 1 : Math.min(...node.children.map((child) => walk(child) / node.children.length)));
      return Math.min(...roots.map(walk));
    };
    // Independent re-implementation of branchDepth (figures.ts's own version is internal).
    const depthOf = (roots: readonly DiagramTreeNode[]): number => {
      let level: readonly DiagramTreeNode[] = roots;
      let depth = 1;
      let deepest = 1;
      let saw = false;
      while (level.length > 0) {
        if (level.some((node) => node.children.length >= 2)) { deepest = depth; saw = true; }
        level = level.flatMap((node) => node.children);
        depth += 1;
      }
      return saw ? deepest : 1;
    };
    const OWNER_BUCKET: Record<string, 'normal' | 'normal-deep' | 'wide'> = {
      '6-1': 'normal', 'A-1': 'normal', 'A-2': 'normal', 'E-1': 'normal', '7-5': 'normal',
      'A-4': 'normal-deep', '7-6': 'normal-deep',
      'A-3': 'wide',
    };
    const SUMMARY_OF: Record<string, number> = { '6-1': 8, 'A-1': 1, 'A-2': 2, 'A-3': 3, 'A-4': 4, 'E-1': 5, '7-5': 11, '7-6': 12 };
    for (const [figureNumber, summary] of Object.entries(SUMMARY_OF)) {
      expect(treeFit(treeOf(summary)), figureNumber).toBe(OWNER_BUCKET[figureNumber]);
    }
    // Worked values for the two figures the depth term actually moves (matches the coordinator's
    // own "about 37.25" / "about 38.5" figures exactly).
    const a4Roots = treeOf(4);
    expect(depthOf(a4Roots)).toBe(2); // tier1 -> {tier2, appr1}, tier2 -> {tier3, appr2}
    expect(9 / minShareOf(a4Roots) + 1.25 * (depthOf(a4Roots) - 1)).toBeCloseTo(37.25, 10);
    const sevenSixRoots = treeOf(12);
    expect(depthOf(sevenSixRoots)).toBe(3); // sites -> stations -> events (4 children) -> ..., benthic -> prov
    expect(9 / minShareOf(sevenSixRoots) + 1.25 * (depthOf(sevenSixRoots) - 1)).toBeCloseTo(38.5, 10);
    // A-3: depth 2 (sed -> 3 children, disp -> 2 children), plain requiredRem exactly 54 -- applying
    // the depth term here would give 55.25, past the 54rem 'wide' ceiling; treeFit does NOT do this
    // (confirmed 'wide' above, not 'outline').
    const a3Roots = treeOf(3);
    expect(depthOf(a3Roots)).toBe(2);
    expect(9 / minShareOf(a3Roots)).toBe(54);
  });

  it('verifies no inline tree figure reaches outline (plain requiredRem <= 54 for all 8)', () => {
    const treeOf = (summary: number) => {
      const structure = diagramStructure(modelOf(summary));
      if (structure.kind !== 'tree') throw new Error(`Diagram summary ${summary} is not a tree`);
      return structure.roots;
    };
    for (const summary of [8, 1, 2, 3, 4, 5, 11, 12]) {
      expect(treeFit(treeOf(summary))).not.toBe('outline');
    }
  });

  it("pins the lab candidates' buckets too (figure-lab only, never on the inline paper)", () => {
    const bucketOf = (assetId: string) => {
      const asset = figureCandidateAsset(assetId)!;
      const model = candidateModel(asset);
      const structure = diagramStructure(model);
      if (structure.kind !== 'tree') return structure.kind;
      return treeFit(structure.roots, model.layout);
    };
    expect(bucketOf('mx-asset-receptor-pathways-4')).toBe('normal'); // root -> 4 leaves, same shape as 6-1
    expect(bucketOf('mx-asset-bioaccumulation-pathways')).toBe('normal'); // grid multi-root, divides to the same 1/4 share as E-1
    expect(bucketOf('mx-asset-parameter-evidence-modules')).toBe('wide'); // root -> 5 leaves, plain requiredRem 45
    expect(bucketOf('mx-asset-future-pathway-testing')).toBe('normal'); // root -> 4 leaves
    expect(bucketOf('mx-asset-parameter-evidence-governance')).toBe('chain'); // packet-sequence -> flow layout
    expect(bucketOf('mx-asset-database-vv-workflow')).toBe('chain');
  });
});

describe('paper figures: parsing rules', () => {
  const base = ['Layout: tree', 'Node a: Alpha', 'Criterion: first', 'Node b: Beta', 'Relationship: a -> b', 'Diagram note: label YES'];

  it('parses a well-formed block', () => {
    const model = parseDiagramSummary(99, base)!;
    expect(model.nodes).toEqual([
      { id: 'a', label: 'Alpha', heads: [], bullets: ['first'] },
      { id: 'b', label: 'Beta', heads: [], bullets: [] },
    ]);
    expect(model.edges).toEqual([{ from: 'a', to: 'b', label: 'YES' }]);
  });

  it.each([
    ['no layout', base.slice(1)],
    ['unknown layout', ['Layout: radial', ...base.slice(1)]],
    ['unknown item kind', [...base, 'Colour: red']],
    ['edge to a missing node', [...base, 'Relationship: a -> z']],
    ['duplicate node id', [...base, 'Node a: Again']],
    ['bullet before any node', ['Layout: tree', 'Criterion: orphan', 'Node a: Alpha']],
    ['item without a value', ['Layout: tree', 'Node a:']],
    ['a head after a bullet (would be drawn out of source order)', ['Layout: tree', 'Node a: Alpha', 'Criterion: first', 'Diagram note: head Late']],
    ['a colon head after a bullet', ['Layout: tree', 'Node a: Alpha', 'Criterion: first', 'Node (LATE: x)']],
  ])('refuses %s, so the text stays as written', (_name, items) => {
    expect(parseDiagramSummary(1, items)).toBeNull();
  });

  it('leaves a malformed or cut-off block in the prose unchanged', () => {
    const markdown = ['Intro.', '', '**Diagram summary 3.**', '', '- Layout: tree', '- Colour: red', '', 'After.'].join('\n');
    const result = splitPaperMarkdown(markdown);
    expect(result).toEqual([{ kind: 'markdown', markdown }]);
  });

  it('splits prose around a figure without touching the prose', () => {
    const markdown = ['Before **bold**.', '', '**Diagram summary 2.**', '', ...base.map((item) => `- ${item}`), '', 'After.'].join('\n');
    const result = splitPaperMarkdown(markdown);
    expect(result.map((segment) => segment.kind)).toEqual(['markdown', 'figure', 'markdown']);
    expect(result[0]).toEqual({ kind: 'markdown', markdown: 'Before **bold**.\n' });
    expect(result[2]).toEqual({ kind: 'markdown', markdown: '\nAfter.' });
  });

  it('renders whitespace-only markdown exactly as before', () => {
    expect(splitPaperMarkdown('')).toEqual([{ kind: 'markdown', markdown: '' }]);
  });

  it('draws a node with two parents as boxes plus stated relationships, never as an implied tree', () => {
    const model = parseDiagramSummary(5, ['Layout: tree', 'Node a: A', 'Node b: B', 'Node c: C', 'Relationship: a -> c', 'Relationship: b -> c'])!;
    expect(diagramStructure(model).kind).toBe('graph');
  });

  it('does not bind a registry caption to a diagram whose content differs', () => {
    const model = parseDiagramSummary(8, base)!;
    expect(paperFigureEntry(model)).toBeNull();
  });
});

describe('paper figures: notation and description', () => {
  it.each([
    ['C_sed', [['C', false], ['sed', true]]],
    ['C_sed,dw / (K_oc * f_oc)', [['C', false], ['sed,dw', true], [' / (K', false], ['oc', true], [' * f', false], ['oc', true], [')', false]]],
    ['(PATHWAY 3: C_sed,EqP)', [['(PATHWAY 3: C', false], ['sed', true], [',EqP)', false]]],
    ['RAF_oral = IVBA', [['RAF', false], ['oral', true], [' = IVBA', false]]],
    ['Excess_SEM_OC < 130', [['Excess_SEM_OC < 130', false]]],
  ])('reads %s', (text, expected) => {
    expect(notationRuns(text).map((run) => [run.text, run.sub])).toEqual(expected);
  });

  it('states every connection in the description', () => {
    const description = diagramDescription(modelOf(4));
    expect(description).toContain('Diagram with 5 boxes.');
    expect(description).toContain('TIER 1: SCREENING AGAINST GENERIC MATRIX STANDARDS leads to TIER 2: SITE-SPECIFIC ADJUST. (YES)');
    expect(description).toContain('leads to SITE APPROVED / REMEDIATED (NO)');
    // Plain text only: the paper's raw-marker checks scan the prose wrapper, which holds this text.
    expect(description).not.toMatch(/\*\*|`|\$|\]\(/);
  });

  it('leaves an existing restored figure\'s description byte-identical with no options argument (P3-1: options are candidate-binding-only)', () => {
    const withNoArgument = diagramDescription(modelOf(4));
    const withExplicitDefault = diagramDescription(modelOf(4), 'plain');
    const withUndefinedOptions = diagramDescription(modelOf(4), 'plain', undefined);
    expect(withExplicitDefault).toBe(withNoArgument);
    expect(withUndefinedOptions).toBe(withNoArgument);
    // Round-2 P3 fix: the three-way self-comparison above would still pass if the shared default
    // wording changed underneath all three calls, so pin the exact literal too. Captured
    // programmatically (never retyped) from the PRE-P3-1 snapshot implementation
    // (.tmp/run-mo-paper-figures-20260924/preserved_20260924_083149/untracked/src/lib/matrix-options/paper/figures.ts,
    // via .tmp/run-mo-paper-figures-20260924/dump_snapshot_description.ts) and independently
    // re-derived from the current implementation (dump_current_description.ts) -- both printed the
    // identical string.
    expect(withNoArgument).toBe(
      'Diagram with 5 boxes. Connections: TIER 1: SCREENING AGAINST GENERIC MATRIX STANDARDS leads to TIER 2: SITE-SPECIFIC ADJUST. (YES); '
      + 'TIER 1: SCREENING AGAINST GENERIC MATRIX STANDARDS leads to SITE APPROVED / REMEDIATED (NO); '
      + 'TIER 2: SITE-SPECIFIC ADJUST. leads to TIER 3: DETAILED RISK ASSESS. (YES); '
      + 'TIER 2: SITE-SPECIFIC ADJUST. leads to SITE APPROVED / REMEDIATED (NO).',
    );
    // Still says "leads to" (the pre-P3-1 wording) and never the candidate-only
    // "Shown without a drawn connection" callout (Round 4: the callout's wording changed since
    // this negative was written; the exact literal pin above still guards the default description).
    expect(withNoArgument).toContain('leads to');
    expect(withNoArgument).not.toContain('contains');
    expect(withNoArgument).not.toContain('Shown without a drawn connection');
  });

  it('a relation option renames "leads to" without adding a not-connected callout when every node has an edge', () => {
    const withRelation = diagramDescription(modelOf(4), 'plain', { relation: 'contains' });
    expect(withRelation).toContain('contains');
    expect(withRelation).not.toContain('leads to');
    expect(withRelation).not.toContain('Shown without a drawn connection');
  });
});

describe('paper figures: Matrix MC dispositions (adjudication 9e6f5e19)', () => {
  it('records the governing adjudication and a disposition for every registry entry', () => {
    expect(FIGURE_ADJUDICATION.sha256).toBe('9e6f5e191458891bcbf730ba803c84806ae6478b2a4d0077ec9fa21a75bd4ddd');
    expect(Object.fromEntries(PAPER_FIGURES.map((entry) => [entry.figureNumber, entry.disposition]))).toEqual({
      '6-1': 'CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING',
      '7-3': 'CURRENT_CONTENT_RESTORE', '7-4': 'CURRENT_CONTENT_RESTORE', '7-5': 'CURRENT_CONTENT_RESTORE', '7-6': 'CURRENT_CONTENT_RESTORE',
      'A-1': 'NOTATION_ONLY_VARIANT', 'A-2': 'CURRENT_CONTENT_RESTORE', 'A-3': 'NOTATION_ONLY_VARIANT', 'A-4': 'NOTATION_ONLY_VARIANT',
      'E-1': 'CURRENT_CONTENT_RESTORE', 'F-1': 'CURRENT_CONTENT_RESTORE', 'F-2': 'CURRENT_CONTENT_DIRECTION_ACCEPTED',
    });
  });

  it('draws inline Figure 6-1 with its own current-paper labels, never the adjudicated SedS names (owner decision 2026-09-24)', () => {
    const binding = restoredFigureBinding(modelOf(8))!;
    expect(binding.status).toBe('prototype-nonfinal');
    // Visible text is plain reader wording (ROUND4_FIX_BRIEF item 3 / Leg1b P2-1); the internal
    // "Matrix MC" lane name and the raw disposition enum stay out of it. The disposition is still
    // carried, machine-readably, on binding.disposition (rendered as data-disposition).
    // ROUND6_FIX_BRIEF item 2 (leg1a_r6 P3-1): pin the EXACT sentence, not an unanchored substring
    // match -- `toMatch(/Draft figure: .../)` (no `^`/`$`) still passes with arbitrary text before
    // or after the sentence, so it does not actually pin "the exact sentence" the receipt claimed.
    expect(binding.statusNote).toBe('Draft figure: current paper content, being corrected; not final.');
    expect(binding.statusNote).not.toContain('Matrix MC');
    expect(binding.statusNote).not.toContain('CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING');
    expect(binding.disposition).toBe('CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING');
    expect(binding.statusNote).not.toContain('SedS');
    expect(binding.labelOverrides).toBeNull();
    expect(binding.overrideAuthority).toBeNull();
    const drawn = modelForBinding(modelOf(8), binding);
    // No override applied: the model is returned byte-identical (modelForBinding is a no-op with no overrides).
    expect(drawn).toBe(modelOf(8));
    expect(drawn.nodes.map((node) => node.label)).toEqual([
      'SEDIMENT CONTAMINATION (C_sed)',
      'PATHWAY 1: HH-DIR',
      'PATHWAY 2: HH-FOOD',
      'PATHWAY 3: ECO-DIR',
      'PATHWAY 4: ECO-FOOD',
    ]);
    // Every other figure is drawn unchanged.
    for (const entry of PAPER_FIGURES.filter((candidate) => !candidate.prototype)) {
      const model = modelOf(entry.summaryNumber);
      expect(modelForBinding(model, restoredFigureBinding(model))).toBe(model);
    }
  });

  it('the figure lab\'s own SedS-labelled prototype of Figure 6-1 still carries the adjudicated pathway names and their authority, over the same current summary body (lab only)', () => {
    const binding = restoredFigurePrototypeBinding(modelOf(8))!;
    expect(binding.id).toBe('6-1-seds');
    expect(binding.status).toBe('prototype-nonfinal');
    expect(binding.statusNote).toMatch(/^Prototype, not final/);
    expect(binding.overrideAuthority).toMatch(/^MATRIX_FIGURE_LINEAGE_ADJUDICATION_20260924\.md sha256 9e6f5e19/);
    const drawn = modelForBinding(modelOf(8), binding);
    expect(drawn.nodes.map((node) => node.label)).toEqual([
      'SEDIMENT CONTAMINATION (C_sed)',
      'PATHWAY 1: SedS-contactHH',
      'PATHWAY 2: SedS-foodHH',
      'PATHWAY 3: SedS-contactECO',
      'PATHWAY 4: SedS-foodECO',
    ]);
    // The body (headings, bullets, edges) is still exactly the current summary.
    expect(drawn.nodes.map((node) => [node.heads, node.bullets])).toEqual(modelOf(8).nodes.map((node) => [node.heads, node.bullets]));
    expect(drawn.edges).toEqual(modelOf(8).edges);
    // No other figure has an adjudicated override to prototype.
    for (const entry of PAPER_FIGURES.filter((candidate) => !candidate.prototype)) {
      expect(restoredFigurePrototypeBinding(modelOf(entry.summaryNumber))).toBeNull();
    }
  });

  it('draws F-2 from current content: Classification Category 2, never the obsolete Tranche 3 entry condition', () => {
    const text = modelOf(7).nodes.flatMap((node) => [node.label, ...node.bullets]).join(' ');
    expect(text).toContain('Classification Category 2');
    expect(text).not.toMatch(/Tranche 3/);
  });

  it('renders the ASCII mathematical spellings of A-1, A-3 and A-4 as notation (notation-only variant)', () => {
    expect(PAPER_FIGURES.filter((entry) => entry.notation === 'math').map((entry) => entry.figureNumber)).toEqual(['A-1', 'A-3', 'A-4']);
    const cp = (code: number) => String.fromCharCode(code);
    expect(mathGlyphs('Sigma[SEM] - [AVS] <= 0 ==> Non-Toxic')).toBe(`${cp(0x03a3)}[SEM] - [AVS] ${cp(0x2264)} 0 ${cp(0x21d2)} Non-Toxic`);
    expect(mathGlyphs('C_pw = C_sed,dw / (K_oc * f_oc)')).toBe(`C_pw = C_sed,dw / (K_oc ${cp(0x00d7)} f_oc)`);
    expect(mathGlyphs('FeS(s) ---> MeS(s)')).toBe(`FeS(s) ${cp(0x2192)} MeS(s)`);
    expect(mathGlyphs('Acid Volatile Sulfide (AVS umol/g)')).toBe(`Acid Volatile Sulfide (AVS ${cp(0x00b5)}mol/g)`);
    // Words that merely contain the letters are untouched.
    expect(mathGlyphs('Sigmaville <=> x')).toBe(`Sigmaville ${cp(0x2264)}> x`.replace(`${cp(0x2264)}>`, `${cp(0x2264)}>`));
    expect(notationRuns('Me^(2+) + FeS(s)', 'math').map((run) => [run.text, run.sub, run.sup])).toEqual([['Me', false, false], ['2+', false, true], [' + FeS(s)', false, false]]);
    // Plain notation keeps the source text (only subscripts), so non-math figures are unchanged.
    expect(notationRuns('a <= b', 'plain').map((run) => run.text).join('')).toBe('a <= b');
  });

  it('keeps the figure source plain ASCII: glyphs are built from code points', () => {
    for (const file of ['figures.ts', 'derived-figures.ts', 'figure-register.ts']) {
      const bytes = readFileSync(resolve(process.cwd(), 'src/lib/matrix-options/paper', file));
      expect(bytes.some((byte) => byte > 127), file).toBe(false);
    }
  });
});