/*
 * Derived figures: deterministic re-drawings of tables and lists the paper
 * already contains. Each is drawn immediately AFTER its source block, which stays
 * in the text unchanged. A figure is drawn only when the source block is exactly
 * the bound text (line count + fingerprint); otherwise nothing is added.
 *
 * Rules for every builder: take words only from the bound block (which starts at
 * the heading or lead-in sentence the figure's title and labels come from); keep every
 * qualifier; drop only markdown syntax (emphasis, code ticks, math delimiters);
 * add no quantity, ordering, or conclusion the block does not state. Grouping
 * (PX-2) uses the opening words of each status exactly as written.
 */

import {
  sourceFingerprint,
  splitPaperMarkdown,
  type DiagramModel,
  type DiagramNode,
  type FigureBinding,
  type PaperMarkdownSegment,
  type QuoteKind,
} from './figures';

export interface DerivedFigureSpec {
  readonly id: 'PX-1' | 'PX-2' | 'PX-3' | 'PX-4';
  readonly caption: string;
  /** The exact first line of the source block. */
  readonly startLine: string;
  /** Number of source lines in the block, starting at startLine. */
  readonly lineCount: number;
  /** Source line numbers in the bound release (provenance, for the ledger). */
  readonly sourceLines: string;
  /** sha256 of the block lines joined by LF (verified in tests). */
  readonly sourceSha256: string;
  /** sourceFingerprint of the same text (checked at render time). */
  readonly fingerprint: string;
  readonly build: (block: readonly string[]) => DiagramModel | null;
}

/** Markdown inline syntax to plain text; the words are unchanged. */
export function plainText(markdown: string): string {
  return markdown
    // bold may contain italic ("**Note that *which* pathways is not open**")
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRows(block: readonly string[]): string[][] {
  // The block's table lines: header and alignment rows first; each body row is | a | b | c |.
  return block.filter((line) => line.startsWith('|')).slice(2).map((row) => row.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim()));
}

/** Numbered list items with their continuation lines joined. */
function listItems(lines: readonly string[]): { readonly number: number; readonly text: string }[] {
  const items: { number: number; text: string }[] = [];
  for (const line of lines) {
    const start = /^(\d+)\.\s+(.*)$/.exec(line);
    if (start) items.push({ number: Number(start[1]), text: start[2] });
    else if (items.length > 0 && /^\s+\S/.test(line)) items[items.length - 1].text += ` ${line.trim()}`;
  }
  return items;
}

/** "**Label** - rest" or "**Label:** rest" -> label and rest. */
function leadAndRest(item: string): { readonly lead: string; readonly rest: string } | null {
  const match = /^\*\*(.+?)\*\*\s*(?:-\s+)?(.*)$/.exec(item);
  if (!match) return null;
  return { lead: plainText(match[1]).replace(/:$/, ''), rest: plainText(match[2]) };
}

const node = (id: string, label: string, heads: string[], bullets: string[]): DiagramNode => ({ id, label, heads, bullets });
const chainEdges = (ids: readonly string[]) => ids.slice(1).map((to, index) => ({ from: ids[index], to, label: null }));

function model(layout: DiagramModel['layout'], title: string, nodes: DiagramNode[], edges: DiagramModel['edges'], notes: string[], block: readonly string[]): DiagramModel {
  return { summaryNumber: 0, layout, title, nodes, edges, notes, items: [...block] };
}

/** PX-1: the five steps from this draft to submission (table: Step | What happens | Task | When). */
function buildTimeline(block: readonly string[]): DiagramModel | null {
  const rows = tableRows(block);
  if (rows.length === 0 || rows.some((row) => row.length !== 4)) return null;
  const nodes = rows.map(([step, what, task, when]) => node(`s${step}`, `Step ${plainText(step)}`, [plainText(when), `Plan task ${plainText(task)}`], [plainText(what)]));
  return model('flow', 'THE PATH FROM THIS DRAFT TO SUBMISSION', nodes, chainEdges(nodes.map((item) => item.id)), [], block);
}

/** The opening words of a status: its bold lead up to the first ". ", ", ", "; " or " - ". */
export function statusFamily(statusCell: string): string | null {
  const lead = /\*\*(.+?)\*\*/.exec(statusCell)?.[1];
  if (!lead) return null;
  const cut = /(\. |\.$|, | - |; )/.exec(lead);
  return plainText(cut ? lead.slice(0, cut.index) : lead);
}

/** PX-2: the elements grouped under the opening words of their stated status (table: Element | Status | Basis). */
function buildStatusMap(block: readonly string[]): DiagramModel | null {
  const rows = tableRows(block);
  if (rows.length === 0 || rows.some((row) => row.length !== 3)) return null;
  const groups = new Map<string, string[]>();
  for (const [element, status] of rows) {
    const family = statusFamily(status);
    if (!family) return null;
    groups.set(family, [...(groups.get(family) ?? []), `${plainText(element)}: ${plainText(status)}`]);
  }
  const nodes = Array.from(groups, ([family, members], index) => node(`g${index + 1}`, family, [], members));
  return model('grid', "STATUS OF THE FRAMEWORK'S ELEMENTS", nodes, [], [], block);
}

/** PX-3: the four principal option layers and the fifth (numbered list, blank line, the "fifth layer" sentence). */
function buildOptionLayers(block: readonly string[]): DiagramModel | null {
  const trailer = block[block.length - 1];
  const items = listItems(block.slice(0, -1));
  if (items.length !== 4 || !/^Equation form is a fifth layer/.test(trailer)) return null;
  const nodes: DiagramNode[] = [];
  for (const item of items) {
    const parts = leadAndRest(item.text);
    if (!parts) return null;
    nodes.push(node(`l${item.number}`, parts.lead, [`Principal layer ${item.number}`], [parts.rest]));
  }
  nodes.push(node('l5', 'Equation form', ['Fifth layer'], [plainText(trailer)]));
  return model('stack', 'WHAT IS ACTUALLY BEING DECIDED - THE OPTION LAYERS', nodes, [], [], block);
}

/** PX-4: the proposed four-stage process (lead paragraph, blank line, numbered list). */
function buildVerificationPipeline(block: readonly string[]): DiagramModel | null {
  const status = /\*\*(.+?)\*\*/.exec(block[0])?.[1];
  const items = listItems(block.slice(1));
  if (!status || items.length !== 4 || !/proposed four-stage/.test(block[0])) return null;
  const nodes: DiagramNode[] = [];
  for (const item of items) {
    const parts = leadAndRest(item.text);
    if (!parts) return null;
    nodes.push(node(`v${item.number}`, `Stage ${item.number}: ${parts.lead}`, [], [parts.rest]));
  }
  return model('flow', 'PROPOSED FOUR-STAGE VERIFICATION AND VALIDATION PROCESS', nodes, chainEdges(nodes.map((item) => item.id)), [plainText(status).replace(/:$/, '')], block);
}

export const DERIVED_FIGURES: readonly DerivedFigureSpec[] = [
  {
    id: 'PX-1',
    caption: 'The five steps from this draft to submission, each with its plan task and timing, as listed in the table above.',
    startLine: 'The path from this draft to that submission has five steps, each with its plan task and month:',
    lineCount: 9,
    sourceLines: '80-88',
    sourceSha256: '8b8423264bcf709bffc1026cf9298106ab1952de14219f626f6f223f44ec0342',
    fingerprint: 'ba717e03',
    build: buildTimeline,
  },
  {
    id: 'PX-2',
    caption: 'The same elements grouped by the opening words of their stated status. The basis for each status is in the table above.',
    startLine: "### Status of the framework's elements - what is fixed, scheduled, and open",
    lineCount: 20,
    sourceLines: '144-163',
    sourceSha256: 'e5855c09b3c890110557b50bba50eb53036c8f00b6392fcbff5c8037dc7f51be',
    fingerprint: '578133ff',
    build: buildStatusMap,
  },
  {
    id: 'PX-3',
    caption: 'The four principal option layers and the fifth, equation form, as set out above.',
    startLine: '### What is actually being decided - the option layers',
    lineCount: 15,
    sourceLines: '165-179',
    sourceSha256: '9e09b4b44afc09b6312dc9b6b194cbc5d233d3264d0ea4414e932959f66d4145',
    fingerprint: '325e002b',
    build: buildOptionLayers,
  },
  {
    id: 'PX-4',
    caption: 'The proposed four-stage verification and validation process listed above. It is proposed only; no data have yet passed through any stage of it.',
    startLine: 'To ensure scientific defensibility, all environmental data would pass through the following proposed four-stage verification and validation process before analytical use. **QA/QC and data usability screening is scheduled for month 7; no data have yet passed through any stage of it:**',
    lineCount: 6,
    sourceLines: '1333-1338',
    sourceSha256: 'b0515d95989fce9d17dcbc9b1673d5766e8f49117e9b6802e8071a497c228200',
    fingerprint: '656a19ad',
    build: buildVerificationPipeline,
  },
];

/** The block for a spec inside some lines, when it is exactly the bound text. */
export function derivedBlock(lines: readonly string[], spec: DerivedFigureSpec): { readonly start: number; readonly block: readonly string[] } | null {
  const start = lines.indexOf(spec.startLine);
  if (start < 0) return null;
  const block = lines.slice(start, start + spec.lineCount);
  if (block.length !== spec.lineCount || sourceFingerprint(block.join('\n')) !== spec.fingerprint) return null;
  // The block must END where the binding says: a row or item appended after it (a longer
  // table or list in a later release) would otherwise put the figure inside that block.
  const next = lines[start + spec.lineCount];
  if (next !== undefined && next.trim() !== '') return null;
  return { start, block };
}

function derivedBinding(spec: DerivedFigureSpec): FigureBinding {
  return {
    kind: 'derived',
    id: spec.id,
    label: null,
    caption: spec.caption,
    sourceSha256: spec.sourceSha256,
    status: 'proposed',
    statusNote: 'Proposed figure: drawn only from the text above it; not yet adopted into the foundational paper.',
    notation: 'plain',
    labelOverrides: null,
    overrideAuthority: null,
  };
}

/** Insert each derived figure after its source block, in whichever prose segment holds it. */
export function applyDerivedFigures(segments: readonly PaperMarkdownSegment[], specs: readonly DerivedFigureSpec[] = DERIVED_FIGURES): PaperMarkdownSegment[] {
  let result = [...segments];
  for (const spec of specs) {
    const next: PaperMarkdownSegment[] = [];
    for (const segment of result) {
      if (segment.kind !== 'markdown') { next.push(segment); continue; }
      const lines = segment.markdown.split('\n');
      const found = derivedBlock(lines, spec);
      const built = found ? spec.build(found.block) : null;
      if (!found || !built) { next.push(segment); continue; }
      const end = found.start + spec.lineCount;
      next.push({ kind: 'markdown', markdown: lines.slice(0, end).join('\n') });
      next.push({ kind: 'figure', model: built, source: found.block.join('\n'), binding: derivedBinding(spec) });
      const after = lines.slice(end).join('\n');
      if (after.trim() !== '') next.push({ kind: 'markdown', markdown: after });
    }
    result = next;
  }
  return result;
}

/**
 * An editorial note opens with a bold LEAD that ends like a label -- "**Successor identity.**",
 * "**[Protocol 13 ...]**", "**Basis:**". A quoted document that opens with its own bold heading
 * ("> **7.1 Introduction**", after "Quoted in full:") is a quotation, as is anything opening with a
 * quote mark.
 */
export function quoteKind(firstLine: string): QuoteKind {
  const lead = /^\*\*(.+?)\*\*/.exec(firstLine.replace(/^>\s?/, ''))?.[1];
  return lead !== undefined && /[.:\]]$/.test(lead) ? 'note' : 'quotation';
}

// A line that starts a new block, so it cannot be a lazy continuation of a quote's paragraph.
const BLOCK_START = /^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|\||```|~~~|---\s*$|\*\*\*\s*$|<)/;

/**
 * Give each top-level blockquote its own prose segment, tagged note or quotation
 * from its source text. The quote keeps every line CommonMark would give it
 * (">" lines and lazy continuation lines up to a blank line or a new block), so
 * the rendered output is the same; only the styling hook is added. Fenced code
 * is skipped.
 */
export function splitQuoteSegments(segments: readonly PaperMarkdownSegment[]): PaperMarkdownSegment[] {
  const result: PaperMarkdownSegment[] = [];
  for (const segment of segments) {
    if (segment.kind !== 'markdown' || segment.quote) { result.push(segment); continue; }
    const lines = segment.markdown.split('\n');
    let prose: string[] = [];
    let fenced = false;
    const flush = () => {
      if (prose.some((line) => line.trim() !== '')) result.push({ kind: 'markdown', markdown: prose.join('\n') });
      prose = [];
    };
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      if (fenced || !line.startsWith('>')) { prose.push(line); index += 1; continue; }
      let end = index + 1;
      while (end < lines.length && lines[end].trim() !== '' && (lines[end].startsWith('>') || !BLOCK_START.test(lines[end]))) end += 1;
      const quote = lines.slice(index, end);
      flush();
      result.push({ kind: 'markdown', markdown: quote.join('\n'), quote: quoteKind(quote[0]) });
      index = end;
    }
    flush();
  }
  return result.length > 0 ? result : [...segments];
}

/**
 * Everything the reader draws for a piece of paper markdown: prose, restored figures, derived
 * figures, tagged quotes. Used by the figure lab (which shows the derived PX-1..PX-4 figures in
 * its own "Proposed additional figures" section) and by anything that needs the full set,
 * including derived figures.
 */
export function paperMarkdownSegments(markdown: string): PaperMarkdownSegment[] {
  return splitQuoteSegments(applyDerivedFigures(splitPaperMarkdown(markdown)));
}

/**
 * The default-on inline stakeholder paper's segments (owner decision 2026-09-24): prose, restored
 * figures and tagged quotes, but NEVER the derived PX-1..PX-4 figures -- those stay figure-lab
 * only, and the tables/lists they would redraw render exactly as they did before derived figures
 * existed. Restored figures never carry a label override here either (figures.ts,
 * restoredFigureBinding); the smallest possible change from paperMarkdownSegments is simply
 * skipping applyDerivedFigures.
 */
export function paperInlineSegments(markdown: string): PaperMarkdownSegment[] {
  return splitQuoteSegments(splitPaperMarkdown(markdown));
}
