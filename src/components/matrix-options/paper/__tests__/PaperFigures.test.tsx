import fs from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { DERIVED_FIGURES, plainText } from '@/lib/matrix-options/paper/derived-figures';
import { candidateBinding, candidateModel, figureCandidateAsset } from '@/lib/matrix-options/paper/figure-candidates';
import { modelForBinding, notationRuns, PAPER_FIGURES, restoredFigureBinding, splitPaperMarkdown } from '@/lib/matrix-options/paper/figures';
import { PaperFigure } from '../PaperFigure';
import { getPaperDocumentModel, PaperDocument } from '../PaperDocument';

/*
 * Figure completeness on the REAL render: the chunks of the authenticated release
 * that carry figures go through PaperDocument, PaperText and the real
 * MathRenderer. Every List of Figures entry the paper still carries (registry,
 * v0.9.87 numbering) must come out as a rendered <figure> with its caption, and
 * no flattened "Diagram summary" text may survive. On the pre-fix renderer this
 * fails: the chunks render the summaries as bullet lists and no figure exists.
 */

const structure = loadRevisedPaperStructure();
const model = getPaperDocumentModel(structure);
const figureChunks = model.chunks.filter((chunk) => /\*\*Diagram summary \d+\.\*\*/.test(chunk.markdown));
/** The reader section (heading chunk) each figure belongs to, as in the reference PDF. */
const EXPECTED_CHUNKS: Record<string, string> = {
  '6-1': '60-proposed-matrix-standards-framework',
  '7-3': '76-generic-standards-adoption-procedure',
  '7-4': '761-four-tier-jurisdictional-hierarchy-of-preference',
  '7-5': '77-bc-aquatic-database',
  '7-6': '772-core-environmental-data-structure',
  'A-1': '11-scope-and-objective-of-the-bioavailability-monograph',
  'A-2': '31-fugacity-theory-chemical-activity-and-equilibrium-partitioning',
  'A-3': '41-biogeochemical-mechanisms-of-acid-volatile-sulfide-precipitation',
  'A-4': '85-proposed-three-tier-implementation-architecture-draft-for-discussion',
  'E-1': 'e11-the-four-receptor-pathway-combinations',
  'F-1': '11-scope-of-the-generic-adoption-appendix',
  'F-2': '40-step-by-step-generic-adoption-mathematical-harmonization-workflow',
};
const shown = (text: string, notation: 'plain' | 'math' = 'plain') => notationRuns(text, notation).map((run) => run.text).join('');
const squash = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

function renderFigureChunks() {
  return render(<PaperDocument model={{ ...model, chunks: figureChunks }} />);
}

describe('paper figures on the real release render', () => {
  it('renders every List of Figures entry as a captioned figure, in paper order, and no Diagram summary text', () => {
    // Anti-vacuity: the release's figures live in these chunks.
    expect(figureChunks.length).toBeGreaterThan(0);
    const { container, unmount } = renderFigureChunks();
    try {
      const figures = Array.from(container.querySelectorAll('figure.paper-figure'));
      expect(figures.map((figure) => figure.getAttribute('data-paper-figure'))).toEqual(
        ['6-1', '7-3', '7-4', '7-5', '7-6', 'A-1', 'A-2', 'A-3', 'A-4', 'E-1', 'F-1', 'F-2'],
      );
      expect(new Set(figures.map((figure) => figure.getAttribute('data-paper-figure')))).toEqual(new Set(PAPER_FIGURES.map((entry) => entry.figureNumber)));
      const chunkOf: Record<string, string | null> = {};
      for (const entry of PAPER_FIGURES) {
        const figure = container.querySelector(`figure[data-paper-figure="${entry.figureNumber}"]`);
        expect(figure, `Figure ${entry.figureNumber}`).not.toBeNull();
        expect(squash(figure!.querySelector('figcaption')?.textContent)).toBe(`Figure ${entry.figureNumber}. ${entry.caption}`);
        chunkOf[entry.figureNumber] = figure!.closest('section[data-paper-chunk]')?.getAttribute('data-paper-chunk') ?? null;
        // The rendered body is bound to the current summary text by its hash.
        expect(figure!.getAttribute('data-source-sha256')).toBe(entry.summarySha256);
        expect(figure!.getAttribute('data-binding')).toBe('restored');
      }
      // Each figure renders inside the reader section (heading chunk) that introduces it.
      expect(chunkOf).toEqual(EXPECTED_CHUNKS);
      expect(container.textContent).not.toMatch(/Diagram summary \d+/);
      expect(container.textContent).not.toMatch(/Layout: (grid|tree|flow|stack)/);
    } finally {
      unmount();
    }
  }, 120000);

  it.each([
    ['6-1', 8],
    ['A-1', 1],
  ])('Figure %s (Diagram summary %i) carries every box, heading, bullet and branch label of its source', (figureNumber, summary) => {
    const source = splitPaperMarkdown(structure.content).find((segment) => segment.kind === 'figure' && segment.model.summaryNumber === summary);
    expect(source?.kind).toBe('figure');
    if (source?.kind !== 'figure') return;
    const { container, unmount } = renderFigureChunks();
    try {
      const figure = container.querySelector(`figure[data-paper-figure="${figureNumber}"]`)!;
      const text = squash(figure.textContent);
      // What is drawn = the current summary under its binding (6-1: adjudicated pathway names; A-1: math notation).
      const binding = restoredFigureBinding(source.model)!;
      const drawn = modelForBinding(source.model, binding);
      const expected = [
        drawn.title ?? '',
        ...drawn.nodes.flatMap((node) => [node.label, ...node.heads, ...node.bullets]),
        ...drawn.edges.flatMap((edge) => (edge.label ? [edge.label] : [])),
      ].filter(Boolean);
      for (const part of expected) expect(text, part).toContain(squash(shown(part, binding.notation)));
      expect(figure.getAttribute('data-notation')).toBe(binding.notation);
      // The boxes are real list items, one per node, not an image of text.
      expect(figure.querySelectorAll('[data-figure-node]')).toHaveLength(source.model.nodes.length);
      expect(figure.querySelector('img, canvas')).toBeNull();
    } finally {
      unmount();
    }
  }, 120000);

  it('names each figure by its caption and describes its connections for assistive technology', () => {
    const { container, unmount } = renderFigureChunks();
    try {
      for (const figure of Array.from(container.querySelectorAll('figure.paper-figure'))) {
        const caption = document.getElementById(figure.getAttribute('aria-labelledby') ?? '');
        const description = document.getElementById(figure.getAttribute('aria-describedby') ?? '');
        expect(caption?.tagName).toBe('FIGCAPTION');
        expect(caption && figure.contains(caption)).toBe(true);
        expect(description?.textContent).toMatch(/^Diagram with \d+ boxes\./);
      }
      const decision = container.querySelector('figure[data-paper-figure="A-4"]')!;
      expect(document.getElementById(decision.getAttribute('aria-describedby')!)?.textContent).toContain('(YES)');
    } finally {
      unmount();
    }
  }, 120000);
});

describe('TREE_FIT_FIX Revision 2 (2026-09-24): tree fit data attribute gates the branching layout', () => {
  it('emits data-fit on every tree figure, matching its computed geometry; chain figures emit neither', () => {
    const { container, unmount } = renderFigureChunks();
    try {
      // A-3 is the one figure whose narrowest leaf (case1/case2, nested inside disp's own already-
      // narrowed third of the container) needs a wider container before globals.css draws it as
      // branches. A-4 and 7-6 are 'normal-deep' (Revision 5b's depth-aware bucket) -- see
      // figures.test.ts treeFit / minLeafShare / branchDepth for the per-figure numbers.
      const EXPECTED_FIT: Record<string, string> = {
        '6-1': 'normal',
        '7-5': 'normal',
        '7-6': 'normal-deep',
        'A-1': 'normal',
        'A-2': 'normal',
        'A-3': 'wide',
        'A-4': 'normal-deep',
        'E-1': 'normal',
      };
      for (const [figureNumber, expected] of Object.entries(EXPECTED_FIT)) {
        const tree = container.querySelector(`figure[data-paper-figure="${figureNumber}"] .paper-figure__tree`);
        expect(tree, figureNumber).not.toBeNull();
        expect(tree!.getAttribute('data-fit'), figureNumber).toBe(expected);
      }
      // Chains (7-3, 7-4, F-1, F-2) never render a .paper-figure__tree at all, so they never
      // carry this attribute either -- the branching-layout gate does not apply to them.
      for (const figureNumber of ['7-3', '7-4', 'F-1', 'F-2']) {
        const figure = container.querySelector(`figure[data-paper-figure="${figureNumber}"]`);
        expect(figure, figureNumber).not.toBeNull();
        expect(figure!.querySelector('.paper-figure__tree'), figureNumber).toBeNull();
        expect(figure!.querySelector('.paper-figure__chain'), figureNumber).not.toBeNull();
      }
    } finally {
      unmount();
    }
  }, 120000);
});

describe('derived figures are figure-lab only, never on the inline stakeholder paper (owner decision 2026-09-24)', () => {
  const derivedChunks = model.chunks.filter((chunk) => DERIVED_FIGURES.some((spec) => chunk.markdown.split('\n').includes(spec.startLine)));

  it('renders no PX-1..PX-4 figure inline; each source table or list still renders as plain text, exactly as before derived figures existed', () => {
    expect(derivedChunks.length).toBeGreaterThan(0);
    const { container, unmount } = render(<PaperDocument model={{ ...model, chunks: derivedChunks }} />);
    try {
      expect(container.querySelectorAll('figure[data-derived-figure]')).toHaveLength(0);
      for (const spec of DERIVED_FIGURES) {
        // The bound block's own words are still on the page as ordinary prose/table/list text.
        const firstWords = plainText(spec.startLine.replace(/^#{1,6}\s*/, '')).slice(0, 24);
        expect(container.textContent, spec.id).toContain(firstWords);
      }
      // The flattened summary text never reaches the page either way.
      expect(container.textContent).not.toMatch(/Diagram summary \d+/);
      expect(container.querySelectorAll('figure[data-paper-figure]')).toHaveLength(0);
    } finally {
      unmount();
    }
  }, 120000);
});
describe('Matrix MC dispositions on the real release render', () => {
  it('marks Figure 6-1 as a non-final prototype drawn with its OWN current-paper labels, never the adjudicated SedS names or their override authority (owner decision 2026-09-24, two-sided), and A-1/A-3/A-4 as math notation', () => {
    const { container, unmount } = render(<PaperDocument model={{ ...model, chunks: figureChunks }} />);
    try {
      const six = container.querySelector('figure[data-paper-figure="6-1"]')!;
      expect(six.getAttribute('data-status')).toBe('prototype-nonfinal');
      // Visible text is plain reader wording (ROUND4_FIX_BRIEF item 3 / Leg1b P2-1): the internal
      // "Matrix MC" lane name and the raw disposition enum never reach a stakeholder reviewer's
      // screen. The disposition is still machine-readable via the data attribute.
      // ROUND6_FIX_BRIEF item 2 (leg1a_r6 P3-1): pin the EXACT sentence (toBe), not an unanchored
      // `toMatch(/Draft figure: .../)` substring, which would still pass with extra text around it.
      expect(six.querySelector('.paper-figure__status')?.textContent).toBe('Draft figure: current paper content, being corrected; not final.');
      expect(six.querySelector('.paper-figure__status')?.textContent).not.toMatch(/Matrix MC/);
      expect(six.getAttribute('data-disposition')).toBe('CONTENT_CORRECTION_REQUIRED_BEFORE_FINAL_BINDING');
      // No label-override authority is ever emitted on the inline figure.
      expect(six.hasAttribute('data-label-authority')).toBe(false);
      for (const name of ['PATHWAY 1: SedS-contactHH', 'PATHWAY 2: SedS-foodHH', 'PATHWAY 3: SedS-contactECO', 'PATHWAY 4: SedS-foodECO']) expect(six.textContent).not.toContain(name);
      for (const name of ['PATHWAY 1: HH-DIR', 'PATHWAY 2: HH-FOOD', 'PATHWAY 3: ECO-DIR', 'PATHWAY 4: ECO-FOOD']) expect(six.textContent).toContain(name);
      expect(Array.from(container.querySelectorAll('figure[data-notation="math"]')).map((figure) => figure.getAttribute('data-paper-figure'))).toEqual(['A-1', 'A-3', 'A-4']);
      expect(container.querySelector('figure[data-paper-figure="A-3"] sup')?.textContent).toBe('2+');
      // Every other restored figure is current and carries no status note.
      for (const figure of Array.from(container.querySelectorAll('figure[data-paper-figure]'))) {
        if (figure.getAttribute('data-paper-figure') === '6-1') continue;
        expect(figure.getAttribute('data-status'), figure.getAttribute('data-paper-figure') ?? '').toBe('current');
        expect(figure.querySelector('.paper-figure__status')).toBeNull();
      }
    } finally {
      unmount();
    }
  }, 120000);
});

describe('Matrix MC content-candidate figures (figure-candidates.ts)', () => {
  it('renders data-semantic-asset only when the binding carries an assetId, and shows the not-final status note for candidate-nonfinal', () => {
    const asset = figureCandidateAsset('mx-asset-receptor-pathways-4')!;
    const model = candidateModel(asset);
    const binding = candidateBinding(asset, '6-1');
    const { container: withAsset, unmount: unmountWithAsset } = render(<PaperFigure model={model} binding={binding} />);
    try {
      const figure = withAsset.querySelector('figure.paper-figure')!;
      expect(figure.getAttribute('data-semantic-asset')).toBe('mx-asset-receptor-pathways-4');
      expect(figure.getAttribute('data-status')).toBe('candidate-nonfinal');
      const status = figure.querySelector('.paper-figure__status');
      expect(status).not.toBeNull();
      expect(status?.textContent).toMatch(/not final and not scientifically accepted/);
      // A candidate carries no labelOverrides, so data-label-authority is absent; contentAuthority (a
      // separate field, documenting the whole content asset) is emitted as data-content-authority instead (P3-3).
      expect(figure.hasAttribute('data-label-authority')).toBe(false);
      expect(figure.getAttribute('data-content-authority')).toMatch(/^MATRIX_FOUNDATIONAL_FIGURE_CONTENT_CANDIDATES_20260924\.md sha256 ffe4281c/);
    } finally {
      unmountWithAsset();
    }

    // A restored figure's binding carries no assetId, so no data-semantic-asset attribute is emitted at all.
    const restoredSegment = splitPaperMarkdown(structure.content).find((segment) => segment.kind === 'figure' && segment.model.summaryNumber === 8)!;
    if (restoredSegment.kind !== 'figure') throw new Error('expected a figure segment');
    const restored = restoredFigureBinding(restoredSegment.model)!;
    const { container: withoutAsset, unmount: unmountWithoutAsset } = render(<PaperFigure model={restoredSegment.model} binding={restored} />);
    try {
      expect(withoutAsset.querySelector('figure.paper-figure')?.hasAttribute('data-semantic-asset')).toBe(false);
      expect(withoutAsset.querySelector('figure.paper-figure')?.hasAttribute('data-content-authority')).toBe(false);
    } finally {
      unmountWithoutAsset();
    }
  });
});

/*
 * P3-5 (leg1a_r9.md, 2026-09-24; thresholds and the connector assertion updated for Revision 4,
 * leg1a_r10.md P2-1/P2-2, and leg1b_situation_r6.md P2-1; extended to a third block for Revision
 * 5b's 'normal-deep' bucket): the unit tests above pin treeFit's TypeScript half two-sided, but
 * nothing checked that globals.css actually CONSUMES data-fit the way the doc comments claim --
 * jsdom has no container queries, so a renamed data-fit value or a dropped block would still pass
 * every render test. This reads the real globals.css source text (as PaperReadingMeasure.test.tsx
 * already does for a different rule) and asserts all three @container branching blocks exist, are
 * identical apart from their data-fit value and rem threshold, that no rule anywhere targets
 * data-fit='outline' with a branch-mode declaration ('outline' must stay the ABSENCE of a rule,
 * never a fourth copy of the block), and that the labelled edge-label rule in EVERY block carries
 * the connector (border-left) onward from the bracket, not just avoids occlusion (Round 9's P2-1
 * fix alone regressed the connector -- Round 10 caught it live).
 */
describe("P3-5: globals.css's normal/normal-deep/wide @container blocks stay consistent with data-fit", () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
  const BUCKETS = [
    { fit: 'normal', widthRem: 36 },
    { fit: 'normal-deep', widthRem: 38.5 },
    { fit: 'wide', widthRem: 54 },
  ] as const;

  /** The full text of one `@container paper-figure (min-width: <n>rem) { ... }` block, brace-matched. */
  function containerBlock(minWidthRem: number): string {
    const marker = `@container paper-figure (min-width: ${minWidthRem}rem) {`;
    const start = css.indexOf(marker);
    expect(start, marker).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let index = start + marker.length - 1; // the marker's own opening brace
    do {
      if (css[index] === '{') depth += 1;
      else if (css[index] === '}') depth -= 1;
      index += 1;
    } while (depth > 0 && index < css.length);
    expect(depth, `${marker} never closed`).toBe(0);
    return css.slice(start, index);
  }

  /** Strips CSS comments and normalises the two things the blocks are allowed to differ by. */
  function normalize(block: string, fit: string, widthRem: number): string {
    return block
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replaceAll(`[data-fit='${fit}']`, "[data-fit='FIT']")
      .replaceAll(`(min-width: ${widthRem}rem)`, '(min-width: WIDTHrem)')
      .replace(/\s+/g, ' ')
      .trim();
  }

  it('the 36rem (normal), 38.5rem (normal-deep) and 54rem (wide) branching blocks exist and are all identical apart from data-fit and the threshold', () => {
    const normalized = BUCKETS.map(({ fit, widthRem }) => {
      const block = containerBlock(widthRem);
      expect(block, fit).toContain(`[data-fit='${fit}']`);
      return normalize(block, fit, widthRem);
    });
    expect(normalized[1]).toBe(normalized[0]); // normal-deep == normal
    expect(normalized[2]).toBe(normalized[0]); // wide == normal
    // Anti-vacuity: the normalized text is not accidentally empty and does carry the branching
    // declarations (display: flex is the tell -- outline mode never sets it).
    expect(normalized[0].length).toBeGreaterThan(500);
    expect(normalized[0]).toContain('display: flex');
  });

  it("no rule anywhere targets data-fit='outline' -- the outline layout is the absence of a rule, never a fourth copy of the block", () => {
    expect(css).not.toMatch(/data-fit=['"]outline['"]/);
  });

  it('P2-1 (Revision 4, restyled 5b): the edge-label rule inside EVERY branch block is a normal in-flow paragraph that carries the connector onward, never position: absolute and never a dead-end stub', () => {
    for (const { fit, widthRem } of BUCKETS) {
      const block = containerBlock(widthRem);
      const labelRuleStart = block.indexOf(`.paper-figure__tree[data-fit='${fit}'] .paper-figure__children > .paper-figure__branch > .paper-figure__edge-label {`);
      expect(labelRuleStart, `${fit} block edge-label rule`).toBeGreaterThanOrEqual(0);
      const labelRuleEnd = block.indexOf('}', labelRuleStart);
      const labelRule = block.slice(labelRuleStart, labelRuleEnd);
      expect(labelRule, fit).toContain('position: static');
      expect(labelRule, fit).not.toContain('position: absolute');
      // No fixed-height reservation survives either (Round 9's P2-1 defect: a hardcoded one-line
      // slot that a wrapped, two-line label could not fit inside).
      expect(block, fit).not.toMatch(/\[data-labelled\][^{]*\{\s*padding-top: 1\.625rem/);
      expect(block, fit).not.toMatch(/\[data-labelled\]::after \{\s*height: 1\.625rem/);
      // Round 10's P2-1 regression: the label must carry the connector itself (border-left, the
      // figure-line token), landed at the same x the branch's own centred drop line uses (margin-
      // left 50%, so its border-box left edge sits at the branch's content-box centre, which the
      // branch's symmetric 0.375rem padding makes the same point as the drop line's own padding-
      // box centre), with zero margin-bottom so the border reaches the node's own top edge where
      // the (unconditional, unchanged) arrowhead begins.
      expect(labelRule, fit).toContain('border-left: 1px solid var(--paper-figure-line)');
      expect(labelRule, fit).toMatch(/margin:\s*0 0\.375rem 0 50%/);
      expect(labelRule, fit).toMatch(/padding:\s*0 0 0\.375rem 0\.4375rem/);
    }
  });
});

/*
 * P2-3 (leg1a_r11.md, 2026-09-24): the tree branch's occlusion defect (Round 9) and its
 * disconnected-stem regression (Round 10) both had a chain-mode twin that nobody had fixed yet --
 * a labelled chain step (Figures 7-4 and F-1's "(If unavailable ...)" labels) reserved a fixed
 * one-line height for an absolutely positioned label, so a two-line label ran under the next
 * step's node. Fixed the same way as the tree branch: the label is now a normal, static, in-flow
 * paragraph that carries the connecting stem itself.
 */
describe('P2-3: chain step edge labels carry the stem in flow, never occluded by the next node', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n');

  function ruleBody(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, selector).toBeGreaterThanOrEqual(0);
    const end = css.indexOf('}', start);
    return css.slice(start, end);
  }

  it('the chain step edge-label rule is a normal in-flow paragraph carrying the connector, never position: absolute and never a fixed-height reservation', () => {
    const labelRule = ruleBody('.paper-figure__step > .paper-figure__edge-label');
    expect(labelRule).toContain('position: static');
    expect(labelRule).not.toContain('position: absolute');
    expect(labelRule).toContain('border-left: 1px solid var(--paper-figure-line)');
    expect(labelRule).toMatch(/margin:\s*0 0\.5rem 0 50%/);
    expect(labelRule).toMatch(/padding:\s*0 0 0\.375rem 0\.5rem/);
    // The old fixed-height reservations for a labelled step (2.25rem padding-top, 2.25rem stem
    // height) are gone -- every step now shares the same unconditional 1.75rem, labelled or not.
    expect(css).not.toMatch(/\.paper-figure__step \+ \.paper-figure__step\[data-labelled\]/);
  });
});