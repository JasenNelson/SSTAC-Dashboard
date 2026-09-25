import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  applyDerivedFigures,
  DERIVED_FIGURES,
  derivedBlock,
  paperMarkdownSegments,
  plainText,
  quoteKind,
  splitQuoteSegments,
  statusFamily,
} from '../derived-figures';
import { diagramStructure, sourceFingerprint, type DiagramModel } from '../figures';

const paper = loadRevisedPaperStructure().content;
const lines = paper.split('\n');
const segments = paperMarkdownSegments(paper);
const derived = segments.flatMap((segment, index) => (segment.kind === 'figure' && segment.binding?.kind === 'derived' ? [{ segment, index }] : []));
const specOf = (id: string) => DERIVED_FIGURES.find((spec) => spec.id === id)!;
const modelOf = (id: string): DiagramModel => derived.find(({ segment }) => segment.kind === 'figure' && segment.binding?.id === id)!.segment.kind === 'figure'
  ? (derived.find(({ segment }) => segment.kind === 'figure' && segment.binding?.id === id)!.segment as { model: DiagramModel }).model
  : (null as never);
const figureText = (model: DiagramModel) => [model.title ?? '', ...model.nodes.flatMap((node) => [node.label, ...node.heads, ...node.bullets]), ...model.notes].join(' ');
const words = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);

describe('derived figures: bound to exact current source blocks', () => {
  it('finds each source block exactly once and binds it by sha256 and fingerprint', () => {
    expect(DERIVED_FIGURES.map((spec) => spec.id)).toEqual(['PX-1', 'PX-2', 'PX-3', 'PX-4']);
    for (const spec of DERIVED_FIGURES) {
      expect(lines.filter((line) => line === spec.startLine), spec.id).toHaveLength(1);
      const found = derivedBlock(lines, spec)!;
      expect(found, spec.id).not.toBeNull();
      const text = found.block.join('\n');
      expect(createHash('sha256').update(text, 'utf8').digest('hex'), spec.id).toBe(spec.sourceSha256);
      expect(sourceFingerprint(text)).toBe(spec.fingerprint);
      const [first, last] = spec.sourceLines.split('-').map(Number);
      expect(found.start + 1, spec.id).toBe(first);
      expect(found.start + spec.lineCount, spec.id).toBe(last);
    }
  });

  it('draws each figure immediately after its source block, and the block stays in the text', () => {
    expect(derived.map(({ segment }) => segment.kind === 'figure' && segment.binding?.id)).toEqual(['PX-1', 'PX-2', 'PX-3', 'PX-4']);
    for (const { segment, index } of derived) {
      if (segment.kind !== 'figure') continue;
      const before = segments[index - 1];
      expect(before.kind).toBe('markdown');
      if (before.kind === 'markdown') expect(before.markdown.endsWith(segment.source), segment.binding?.id).toBe(true);
      expect(segment.binding).toMatchObject({ kind: 'derived', label: null, sourceSha256: specOf(segment.binding!.id).sourceSha256 });
    }
    // Nothing is removed from the paper: prose plus figure sources still hold every source line.
    const prose = segments.flatMap((segment) => (segment.kind === 'markdown' ? [segment.markdown] : [])).join('\n');
    for (const spec of DERIVED_FIGURES) expect(prose.includes(derivedBlock(lines, spec)!.block.join('\n'))).toBe(true);
  });

  it.each(DERIVED_FIGURES.map((spec) => [spec.id]))('%s adds no word that is not in its bound source block (title and labels included)', (id) => {
    const spec = specOf(id);
    const block = words(plainText(derivedBlock(lines, spec)!.block.join(' ')));
    const extra = [...words(figureText(modelOf(id)))].filter((word) => !block.has(word));
    expect(extra, id).toEqual([]);
    // No markdown syntax survives (none of these blocks uses a literal asterisk).
    expect(figureText(modelOf(id))).not.toMatch(/\*|`|\$|\]\(/);
  });});

describe('derived figures: faithful content', () => {
  it('PX-1 carries every step with its timing and plan task, in order', () => {
    const model = modelOf('PX-1');
    expect(diagramStructure(model).kind).toBe('chain');
    expect(model.nodes.map((node) => node.label)).toEqual(['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5']);
    expect(model.nodes[2].heads).toEqual(['Months 10-11 (April - May 2027)', 'Plan task 9.1']);
    expect(model.nodes[4].bullets).toEqual(['The paper is finalized and the deliverables package submitted to ENV executive leadership']);
  });

  it('PX-2 groups all thirteen elements under the opening words of their status and keeps every status note', () => {
    const model = modelOf('PX-2');
    expect(model.nodes.map((node) => node.label)).toEqual(['Plan-given', 'Open', 'Remains within the existing CSR framework', 'Settled in principle for this paper', 'Out of scope for Phase 2']);
    expect(model.nodes.map((node) => node.bullets.length)).toEqual([2, 8, 1, 1, 1]);
    const all = model.nodes.flatMap((node) => node.bullets).join('\n');
    expect(all).toContain('The four Sediment Use Categories (AW, AR/TH, CA, IA) - how many, what they are, where boundaries fall: Open - a proposal of this draft, against a requirement of the plan. The plan requires "water lot use classes" to be defined at Task 3.7 but does not specify them; these four are this draft\'s proposal for that requirement, and Section 9.9 sets them out as one option among four.');
    expect(all).toContain('Indigenous Uses as a distinct pathway: Open, and a divergence from Phase 1. The Phase 1 framework treated Indigenous Uses as a distinct pathway; this draft places Indigenous receptors within the two human-health pathways.');
    expect(statusFamily('**Open, but with few live alternatives.**')).toBe('Open');
    expect(statusFamily('**Remains within the existing CSR framework; not re-opened as an option in this paper.**')).toBe('Remains within the existing CSR framework');
  });

  it('PX-3 keeps the four principal layers, the fifth, and the qualifier that which pathways is not open', () => {
    const model = modelOf('PX-3');
    expect(model.nodes.map((node) => `${node.heads[0]}: ${node.label}`)).toEqual([
      'Principal layer 1: Sediment uses',
      'Principal layer 2: Receptors within each pathway',
      'Principal layer 3: Exposure assumptions and receptor characteristics',
      'Principal layer 4: Input parameter selection',
      'Fifth layer: Equation form',
    ]);
    expect(model.nodes[1].bullets[0]).toContain('Note that which pathways is not open: the project plan names the four');
    expect(model.nodes[4].bullets).toEqual(['Equation form is a fifth layer, and it matters, but it is the layer with the fewest live alternatives.']);
    expect(model.edges).toEqual([]);
  });

  it('PX-4 is labelled proposed and keeps the not-yet-run and not-yet-designed qualifiers', () => {
    const model = modelOf('PX-4');
    expect(model.title).toContain('PROPOSED');
    expect(specOf('PX-4').caption).toContain('proposed only; no data have yet passed through any stage of it');
    expect(model.notes).toEqual(['QA/QC and data usability screening is scheduled for month 7; no data have yet passed through any stage of it']);
    expect(model.nodes.map((node) => node.label)).toEqual([
      'Stage 1: Structural Conformance & Referential Integrity',
      'Stage 2: Chemical Nomenclature & Unit Harmonization',
      'Stage 3: Sample Identity and Co-Location Verification',
      'Stage 4: Censored Data Standardization',
    ]);
    expect(model.nodes[2].bullets[0]).toContain('The attributes that would compose that identifier have not been settled: no such scheme has been designed, specified or built.');
    expect(model.nodes[3].bullets[0]).toContain('non-detects (< MDL)');
  });
});

describe('derived figures: fail closed (two-sided)', () => {
  it.each(DERIVED_FIGURES.map((spec) => [spec.id]))('%s is not drawn when one character of its source block changes', (id) => {
    const spec = specOf(id);
    const found = derivedBlock(lines, spec)!;
    const target = found.start + spec.lineCount - 1;
    const mutated = lines.map((line, index) => (index === target ? line.replace(/[a-z]/, (c) => c.toUpperCase()) : line)).join('\n');
    expect(mutated).not.toBe(paper);
    const result = applyDerivedFigures([{ kind: 'markdown', markdown: mutated }], [spec]);
    expect(result).toEqual([{ kind: 'markdown', markdown: mutated }]);
    // And the unmutated block IS drawn, so the check can fail.
    expect(applyDerivedFigures([{ kind: 'markdown', markdown: paper }], [spec]).some((segment) => segment.kind === 'figure')).toBe(true);
  });

  it('is not drawn when a row or item is appended to its source block (the block must end where it is bound)', () => {
    for (const spec of DERIVED_FIGURES) {
      const found = derivedBlock(lines, spec)!;
      const end = found.start + spec.lineCount;
      const extra = spec.startLine.startsWith('|') ? '| appended | row | x | y |' : '5. **Appended item** - an extra item.';
      const grown = [...lines.slice(0, end), extra, ...lines.slice(end)].join('\n');
      expect(applyDerivedFigures([{ kind: 'markdown', markdown: grown }], [spec]), spec.id).toEqual([{ kind: 'markdown', markdown: grown }]);
    }
  });
});

describe('quoted material: note or quotation, read from the source text', () => {
  const quotes = segments.flatMap((segment) => (segment.kind === 'markdown' && segment.quote ? [segment] : []));

  // Hand-checked against the release: every blockquote that opens with a quote mark, plus the
  // Protocol 28 Chapter 7 passage quoted in full ("> **7.1 Introduction**", line 5071).
  const QUOTATION_LINES = [70, 75, 1747, 1749, 1751, 1763, 2403, 2684, 2694, 4809, 5027, 5029, 5071, 5091, 5097, 5103, 5219, 5223, 5227, 5237, 5246];

  it('tags all 55 top-level blockquotes: the 21 hand-checked quotations and 34 editorial notes', () => {
    expect(quotes).toHaveLength(55);
    const startLine = (markdown: string) => lines.indexOf(markdown.split('\n')[0]) + 1;
    const quotationLines = quotes.flatMap((quote) => (quote.kind === 'markdown' && quote.quote === 'quotation' ? [startLine(quote.markdown)] : []));
    expect(quotationLines).toEqual(QUOTATION_LINES);
    expect(quotes.filter((quote) => quote.kind === 'markdown' && quote.quote === 'note')).toHaveLength(34);
    for (const quote of quotes) if (quote.kind === 'markdown') expect(quote.markdown.startsWith('>')).toBe(true);
    expect(quoteKind('> **7.1 Introduction**')).toBe('quotation');
    expect(quoteKind('> **Successor identity.** This is')).toBe('note');
    expect(quoteKind('> **Basis:** the plan')).toBe('note');
    expect(quoteKind('> "**The TEL was calculated')).toBe('quotation');
  });

  it('keeps a quotation that opens with a quote mark and then bold as a quotation (source line 5097)', () => {
    const line = lines[5096];
    expect(line.startsWith('> "**')).toBe(true);
    const quote = quotes.find((segment) => segment.kind === 'markdown' && segment.markdown.startsWith(line));
    expect(quote && quote.kind === 'markdown' && quote.quote).toBe('quotation');
  });

  it('keeps lazy continuation lines with their quote, leaves fenced code alone, and loses no text', () => {
    const markdown = ['Before.', '> **Note.** First line', 'lazy continuation', '', '```', '> not a quote', '```', '', '> "Quoted."', '## After'].join('\n');
    const result = splitQuoteSegments([{ kind: 'markdown', markdown }]);
    expect(result).toEqual([
      { kind: 'markdown', markdown: 'Before.' },
      { kind: 'markdown', markdown: '> **Note.** First line\nlazy continuation', quote: 'note' },
      { kind: 'markdown', markdown: '\n```\n> not a quote\n```\n' },
      { kind: 'markdown', markdown: '> "Quoted."', quote: 'quotation' },
      { kind: 'markdown', markdown: '## After' },
    ]);
    expect(result.map((segment) => (segment.kind === 'markdown' ? segment.markdown : '')).join('\n')).toBe(markdown);
  });
});
