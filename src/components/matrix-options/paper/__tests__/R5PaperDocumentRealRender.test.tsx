import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { describePrivate, privateFixtureAvailable, readPrivatePresentation } from '@/lib/matrix-options/paper/__tests__/private-fixture';
import {
  ACCEPTED_FIGURE_API_PREFIX,
  acceptedFigureAssetHref,
  acceptedFigureDomId,
  findAcceptedFigureBlocks,
  getAcceptedFiguresContract,
  resolveAcceptedFigure,
} from '@/lib/matrix-options/paper/accepted-figures';
import type { PaperChunk } from '@/lib/matrix-options/paper/full-document';
import { getPaperRelease, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { describeAuthenticatedPaper } from '@/lib/matrix-options/revised-paper';
import { compileAuthenticatedRelease } from '@/lib/matrix-options/revised-paper-structure';
import { getPaperDocumentModel, PaperDocument } from '../PaperDocument';
import type { PaperDocumentModel } from '../PaperDocument';

/*
 * The R5 working draft on the REAL render. Nothing is mocked: every chunk goes
 * through the actual PaperDocument, PaperText, AcceptedPaperFigure and the real
 * MathRenderer.
 *
 * The draft's bytes are not in the repository. The suite that renders them is a
 * private-fixture suite: it runs where the fixture is and is skipped by name
 * everywhere else. It asserts counts, ids and booleans ONLY, so a failure can
 * never print text of the draft. The page checks themselves live in one scanner,
 * and an always-run suite proves on synthetic text that the scanner sees each
 * defect it counts, so "zero found" in the private suite is a real zero.
 */

const BATCH_SIZE = 40;
const BATCH_TIMEOUT_MS = 120000;
const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;

interface RenderedFigure { readonly id: string; readonly figureId: string; readonly src: string; readonly alt: string; readonly width: string; readonly height: string; readonly caption: string; readonly status: string; readonly fullSize: string; readonly section: string }

/** What one rendered page (or batch of chunks) holds. Counts and ids; the texts are kept for comparison only and never printed. */
interface PageScan {
  chunkIds: string[];
  prose: number;
  katex: number;
  unavailable: number;
  images: number;
  figures: RenderedFigure[];
  elementIds: string[];
  hashLinks: string[];
  katexErrorTexts: string[];
  /** Bold standalone lines outside a figure, for the leaked-status check. */
  strongTexts: string[];
  placementMarker: number;
  strayDollar: number;
  rawHeading: number;
  rawEmphasis: number;
  rawLink: number;
  rawCode: number;
  anchorSpan: number;
  fencedDiv: number;
  frontMatter: number;
  rawImage: number;
  relativeImage: number;
  h1: number;
}

function emptyScan(): PageScan {
  return { chunkIds: [], prose: 0, katex: 0, unavailable: 0, images: 0, figures: [], elementIds: [], hashLinks: [], katexErrorTexts: [], strongTexts: [], placementMarker: 0, strayDollar: 0, rawHeading: 0, rawEmphasis: 0, rawLink: 0, rawCode: 0, anchorSpan: 0, fencedDiv: 0, frontMatter: 0, rawImage: 0, relativeImage: 0, h1: 0 };
}

const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();

/** Visible text nodes of the rendered paper markdown, excluding KaTeX output. */
function proseTextNodes(root: Element): string[] {
  const values: string[] = [];
  for (const prose of Array.from(root.querySelectorAll('.reader-prose'))) {
    const walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest('.katex')) continue;
      values.push(node.textContent ?? '');
    }
  }
  return values;
}

/** Adds what `container` holds to `scan`. `offset` only names preamble sections, which have no id of their own. */
function scanPage(container: Element, scan: PageScan, offset = 0): void {
  scan.chunkIds.push(...Array.from(container.querySelectorAll('section[data-paper-chunk], section[data-paper-preamble]')).map((section, index) => section.getAttribute('data-paper-chunk') ?? `preamble:${offset + index}`));
  scan.prose += container.querySelectorAll('.reader-prose').length;
  scan.katex += container.querySelectorAll('.katex').length;
  scan.unavailable += container.querySelectorAll('[data-accepted-figure-unavailable]').length;
  for (const error of Array.from(container.querySelectorAll('.katex-error'))) scan.katexErrorTexts.push(collapse(error.textContent ?? ''));
  // The HTML as a whole: a placement marker must not survive even as a comment.
  if (container.innerHTML.includes('MATRIX_FIGURE_PLACEMENT')) scan.placementMarker += 1;
  for (const text of proseTextNodes(container)) {
    if (text.includes('$')) scan.strayDollar += 1;
    if (/^\s*#{1,6}\s/.test(text)) scan.rawHeading += 1;
    if (text.includes('**')) scan.rawEmphasis += 1;
    if (text.includes('](')) scan.rawLink += 1;
    if (text.includes('`')) scan.rawCode += 1;
    if (text.includes('[]{#') || /\{#[a-z]/.test(text)) scan.anchorSpan += 1;
    if (text.includes(':::') || text.includes('.draft-label')) scan.fencedDiv += 1;
    if (/\b(?:documentclass|subtitle|lang): /.test(text) || /^title: /m.test(text)) scan.frontMatter += 1;
    if (text.includes('![')) scan.rawImage += 1;
  }
  for (const strong of Array.from(container.querySelectorAll('.reader-prose strong'))) {
    if (!strong.closest('figure')) scan.strongTexts.push(collapse(strong.textContent ?? ''));
  }
  for (const image of Array.from(container.querySelectorAll('img'))) {
    scan.images += 1;
    if (!(image.getAttribute('src') ?? '').startsWith(ACCEPTED_FIGURE_API_PREFIX)) scan.relativeImage += 1;
  }
  for (const figure of Array.from(container.querySelectorAll('figure[data-accepted-figure]'))) {
    const image = figure.querySelector('img');
    scan.figures.push({
      id: figure.id,
      figureId: figure.getAttribute('data-accepted-figure') ?? '',
      src: image?.getAttribute('src') ?? '',
      alt: image?.getAttribute('alt') ?? '',
      width: image?.getAttribute('width') ?? '',
      height: image?.getAttribute('height') ?? '',
      caption: collapse(figure.querySelector('figcaption')?.textContent ?? ''),
      status: figure.querySelector('.paper-figure__status-line')?.textContent ?? '',
      fullSize: figure.querySelector('.paper-figure__actions a')?.getAttribute('href') ?? '',
      section: figure.getAttribute('data-section-anchor') ?? '',
    });
  }
  for (const element of Array.from(container.querySelectorAll('[id]'))) scan.elementIds.push(element.id);
  for (const link of Array.from(container.querySelectorAll('.reader-prose a[href^="#"]'))) scan.hashLinks.push(link.getAttribute('href') ?? '');
  scan.h1 += container.querySelectorAll('h1').length;
}

/** The raw-source defects a clean page has none of, as one list of [name, count]. */
function rawSourceCounts(scan: PageScan): readonly (readonly [string, number])[] {
  return [
    ['placementMarker', scan.placementMarker], ['anchorSpan', scan.anchorSpan], ['fencedDiv', scan.fencedDiv], ['frontMatter', scan.frontMatter],
    ['rawImage', scan.rawImage], ['relativeImage', scan.relativeImage], ['strayDollar', scan.strayDollar], ['rawHeading', scan.rawHeading],
    ['rawEmphasis', scan.rawEmphasis], ['rawLink', scan.rawLink], ['rawCode', scan.rawCode], ['h1', scan.h1],
  ];
}

function duplicateIdCount(elementIds: readonly string[]): number {
  return elementIds.length - new Set(elementIds).size;
}

function deadHashLinkCount(scan: PageScan): number {
  const ids = new Set(scan.elementIds);
  return [...new Set(scan.hashLinks)].filter((href) => !ids.has(href.slice(1))).length;
}

function chunk(index: number, markdown: string, overrides: Partial<PaperChunk> = {}): PaperChunk {
  return { id: `node:synthetic-${index}`, nodeId: `node:synthetic-${index}`, anchor: `synthetic-${index}`, depth: 2, label: `Synthetic section ${index}`, startByte: index * 1000, endByte: index * 1000 + markdown.length, markdown, ...overrides };
}

function syntheticBlock(figureId: string, file: string): string {
  return [`<!-- MATRIX_FIGURE_PLACEMENT: ${figureId} -->`, '', `[]{#fig-${figureId.toLowerCase()}}Figure ${figureId}. A synthetic caption.`, '', '**Status: SYNTHETIC_STATUS**', '', `![A synthetic description.](assets/${file})`].join('\n');
}

describe('the page scanner on a synthetic document through the real MathRenderer', () => {
  const placement = contract.placements[0];
  const asset = contract.assets.find((candidate) => candidate.id === placement.assetId)!;
  const figureDomId = acceptedFigureDomId(placement.figureId);
  const cleanModel: PaperDocumentModel = {
    chunks: [
      chunk(0, `## Synthetic section 0\n\nA paragraph with *emphasis*, \`code\`, inline math $a + b$ and [a figure reference](#${figureDomId}).\n\n${syntheticBlock(placement.figureId, asset.file)}\n\nProse after the figure.`),
      chunk(1, '### Synthetic section 1\n\n[]{#tbl-1}Table 1. A synthetic table title.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n'),
    ],
    linkMap: { 'synthetic-0': '?mode=working-draft&section=synthetic-0' },
  };

  it('finds nothing wrong with a clean document: one figure drawn from the bound PNG, nothing raw left on the page', () => {
    const scan = emptyScan();
    const { container, unmount } = render(<PaperDocument model={cleanModel} />);
    scanPage(container, scan);
    unmount();
    expect(scan.chunkIds).toEqual(['synthetic-0', 'synthetic-1']);
    expect(scan.prose).toBe(2);
    expect(scan.katex).toBeGreaterThan(0);
    expect(scan.katexErrorTexts).toHaveLength(0);
    expect(scan.figures.map((figure) => figure.figureId)).toEqual([placement.figureId]);
    expect(scan.figures[0].src).toBe(acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset }));
    expect(scan.figures[0].alt).toBe('A synthetic description.');
    expect(scan.figures[0].status).toBe('Status: SYNTHETIC_STATUS');
    expect(scan.figures[0].section).toBe(placement.sectionAnchor);
    expect(scan.unavailable).toBe(0);
    expect(scan.images).toBe(1);
    expect(rawSourceCounts(scan).filter(([, count]) => count !== 0)).toEqual([]);
    expect(duplicateIdCount(scan.elementIds)).toBe(0);
    // The in-page reference names the figure's own id, which is on the page.
    expect(scan.hashLinks).toEqual([`#${figureDomId}`]);
    expect(deadHashLinkCount(scan)).toBe(0);
    // The block's own status is inside the figure, so it is not a leaked bold line.
    expect(scan.strongTexts).not.toContain('Status: SYNTHETIC_STATUS');
  });

  it.each([
    ['a placement block that does not resolve', syntheticBlock(placement.figureId, 'FIG9-9.png'), (scan: PageScan) => scan.unavailable],
    ['an unclosed math delimiter', 'A price of $5 left as it is.', (scan: PageScan) => scan.strayDollar],
    ['a pandoc anchor span with text', '[label]{#tbl-9} stays in the prose.', (scan: PageScan) => scan.anchorSpan],
    ['a fenced div', '::: {.draft-label}\nDRAFT\n:::', (scan: PageScan) => scan.fencedDiv],
    ['a front-matter line', 'subtitle: left in the prose', (scan: PageScan) => scan.frontMatter],
    ['an image from a relative path', '![alt](assets/FIG6-1.png)', (scan: PageScan) => scan.relativeImage],
    ['a status line left in the prose', '**Status: SYNTHETIC_STATUS**', (scan: PageScan) => scan.strongTexts.filter((text) => text === 'Status: SYNTHETIC_STATUS').length],
    ['an in-page link to nothing', '[gone](#not-on-the-page)', (scan: PageScan) => deadHashLinkCount(scan)],
    ['a formula KaTeX cannot typeset', 'Inline $\\text{a_b} < 1$ here.', (scan: PageScan) => scan.katexErrorTexts.length],
  ] as const)('sees %s', (_name, markdown, count) => {
    const scan = emptyScan();
    const { container, unmount } = render(<PaperDocument model={{ chunks: [chunk(0, `## Synthetic section 0\n\n${markdown}\n`)], linkMap: {} }} />);
    scanPage(container, scan);
    unmount();
    expect(count(scan)).toBeGreaterThan(0);
  });

  it('sees a duplicate element id and a second h1', () => {
    const scan = emptyScan();
    const { container, unmount } = render(<><PaperDocument model={{ chunks: [chunk(0, '## Synthetic section 0\n\nText.\n')], linkMap: {} }} /><PaperDocument model={{ chunks: [chunk(0, '## Synthetic section 0\n\nText.\n')], linkMap: {} }} /><h1>Another</h1></>);
    scanPage(container, scan);
    unmount();
    expect(duplicateIdCount(scan.elementIds)).toBeGreaterThan(0);
    expect(scan.h1).toBe(1);
  });
});

// The private bytes are read only where the fixture is; with no fixture nothing below touches them.
const structure = privateFixtureAvailable ? compileAuthenticatedRelease(describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, readPrivatePresentation())) : null;
const model = structure ? getPaperDocumentModel(structure) : null;
const batchStarts = model ? Array.from({ length: Math.ceil(model.chunks.length / BATCH_SIZE) }, (_, index) => index * BATCH_SIZE) : [];

describePrivate('R5 working draft real render through the real MathRenderer (private fixture)', () => {
  const scan = emptyScan();
  // The bound text of each placement, read from the release's own Markdown blocks at run time.
  const bindings = structure ? findAcceptedFigureBlocks(structure.content.split('\n')).map((block) => resolveAcceptedFigure(block)) : [];

  it.each(batchStarts)('renders chunks from index %i', (start) => {
    const chunks = model!.chunks.slice(start, start + BATCH_SIZE);
    const { container, unmount } = render(<PaperDocument model={{ ...model!, chunks }} />);
    try {
      scanPage(container, scan, start);
    } finally {
      unmount();
    }
  }, BATCH_TIMEOUT_MS);

  it('covered every chunk exactly once', () => {
    expect(scan.chunkIds.length).toBe(model!.chunks.length);
    expect(new Set(scan.chunkIds).size).toBe(model!.chunks.length);
    // Anti-vacuity: every chunk went through PaperText.
    expect(scan.prose).toBe(model!.chunks.length);
  });

  it('draws all 20 accepted placements once each, in document order, from their bound PNGs and with their own block text', () => {
    expect(scan.figures.map((figure) => figure.figureId)).toEqual(contract.placements.map((entry) => entry.figureId));
    expect(scan.figures.length).toBe(20);
    expect(bindings.length).toBe(20);
    expect(scan.unavailable).toBe(0);
    // Every image on the page is an accepted figure: the predecessor's flattened diagram redraws are not in R5.
    expect(scan.images).toBe(20);
    expect(new Set(scan.figures.map((figure) => figure.src)).size).toBe(17);
    let mismatched = 0;
    for (const [index, figure] of scan.figures.entries()) {
      const entry = contract.placements[index];
      const asset = contract.assets.find((candidate) => candidate.id === entry.assetId)!;
      const binding = bindings[index];
      const href = acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset });
      // Ids, addresses and sizes come from the contract and may be shown.
      expect(figure.id).toBe(acceptedFigureDomId(entry.figureId));
      expect(figure.src).toBe(href);
      // A private-storage release: no figure links to its image in a tab of its own.
      expect(figure.fullSize).toBe('');
      expect(figure.width).toBe(String(asset.width));
      expect(figure.height).toBe(String(asset.height));
      expect(figure.section).toBe(entry.sectionAnchor);
      // The caption is the block's caption followed by its status, word for word; the
      // alternative text is the block's. Compared here, never printed.
      const sameText = binding !== null
        && binding.placement === entry
        && figure.alt === binding.alt
        && figure.caption === `${collapse(binding.caption)}Status: ${binding.status}`
        && figure.status === `Status: ${binding.status}`;
      if (!sameText) mismatched += 1;
    }
    expect(mismatched).toBe(0);
    // The eight placements the predecessor did not show are all present.
    for (const id of ['7-1', 'B-1', '7-2', 'G-1', '7-7', 'G-2', 'G-3', 'H-1']) expect(scan.figures.some((figure) => figure.figureId === id)).toBe(true);
  });

  it('leaves no pandoc construct, placement marker or raw Markdown on the page', () => {
    expect(rawSourceCounts(scan).filter(([, count]) => count !== 0)).toEqual([]);
    // No placement block's own status line was left in the prose as a bold standalone line.
    const boundStatusLines = new Set(bindings.flatMap((binding) => (binding ? [collapse(`Status: ${binding.status}`)] : [])));
    expect(scan.strongTexts.filter((text) => boundStatusLines.has(text)).length).toBe(0);
    // Anti-vacuity: the guard knows the bound statuses, including the ones with spaces and semicolons,
    // and each of them really is a bold standalone line in the source it guards.
    expect(boundStatusLines.size).toBeGreaterThanOrEqual(10);
    expect([...boundStatusLines].some((line) => line.includes('; '))).toBe(true);
    expect([...boundStatusLines].filter((line) => !structure!.content.includes(`**${line}**`)).length).toBe(0);
  });

  it('has exactly one formula KaTeX cannot typeset, and it is the one source line that carries an underscore in text mode (source defect, recorded for L2)', () => {
    // One inline formula of the release has an unescaped underscore inside \text{...}, which is
    // not valid TeX text mode, so KaTeX shows it as its source text. The accepted bytes are not
    // rewritten for display. The pin is exact without naming the formula: a NEW KaTeX error
    // fails here, and so does a corrected source.
    expect(scan.katex).toBeGreaterThan(0);
    expect(scan.katexErrorTexts.length).toBe(1);
    const lines = structure!.content.split('\n');
    const carrying = lines.flatMap((line, index) => (/\\text\{[^}]*_[^}]*\}/.test(line) ? [index + 1] : []));
    expect(carrying).toEqual([1466]);
    expect(structure!.content.match(/\\text\{[^}]*_[^}]*\}/g)?.length).toBe(1);
    // The error on the page is that formula: its source, between its own math delimiters.
    const formulas = [...lines[1465].matchAll(/\$([^$]+)\$/g)].map((match) => collapse(match[1])).filter((formula) => /\\text\{[^}]*_[^}]*\}/.test(formula));
    expect(formulas.length).toBe(1);
    expect(scan.katexErrorTexts[0] === formulas[0]).toBe(true);
  });

  it('has no duplicate element id anywhere in the document', () => {
    expect(duplicateIdCount(scan.elementIds)).toBe(0);
    // Anti-vacuity: the 20 figure ids are among them.
    const seen = new Set(scan.elementIds);
    for (const entry of contract.placements) expect(seen.has(acceptedFigureDomId(entry.figureId))).toBe(true);
  });

  it('leaves no in-page link that goes nowhere', () => {
    // A link the map resolved is no longer a bare `#id`. Any that remain must name an element of the document.
    expect(deadHashLinkCount(scan)).toBe(0);
    // Anti-vacuity: the List of Figures and List of Tables targets (20 figures, 9 tables) are all in the link map,
    // and every one of them is linked from the source.
    const pandocTargets = Object.keys(model!.linkMap).filter((id) => /^(?:fig|tbl)-/.test(id));
    expect(pandocTargets.length).toBe(29);
    expect(pandocTargets.filter((id) => !structure!.content.includes(`](#${id})`)).length).toBe(0);
    expect(pandocTargets.filter((id) => !/^\?mode=working-draft&section=/.test(model!.linkMap[id])).length).toBe(0);
  });
});
