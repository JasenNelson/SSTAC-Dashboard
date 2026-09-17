import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { getPaperDocumentModel, PaperDocument } from '../PaperDocument';

/*
 * PLAN-R4 3.A items 3 and 9 on the REAL render (M1-02). Nothing is mocked: every
 * chunk of the authenticated release goes through the actual PaperDocument
 * output, PaperText and the real MathRenderer (react-markdown, remark-gfm,
 * remark-math, rehype-katex). Chunks render in batches to keep each test
 * bounded; the final test proves the batches covered every chunk exactly once
 * and compares the aggregated counts with the source.
 */

const VERIFICATION_OPEN = /VERIFICATION OPEN/gi;
const BATCH_SIZE = 40;
const BATCH_TIMEOUT_MS = 120000;

const structure = loadRevisedPaperStructure();
const model = getPaperDocumentModel(structure);
const batchStarts = Array.from({ length: Math.ceil(model.chunks.length / BATCH_SIZE) }, (_, index) => index * BATCH_SIZE);
const KNOWN_UNBALANCED_EMPHASIS_SNIPPET = '**[Protocol 13 (';
// M1R2-03 frozen-source pins, one per marker class (see the aggregate test below).
const KNOWN_DOUBLE_UNDERSCORE_SNIPPET = 'https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__ja';
const KNOWN_LONE_UNDERSCORE_SNIPPET = '_sources';
const KNOWN_LONE_STAR_SNIPPET = 'C_pw = C_sed / (K_oc*f_oc) Bounds: 0.2% <= f_oc <= 10.0%';
// A lone delimiter next to a word character; `**`/`__` runs are excluded (their own buckets).
const LONE_UNDERSCORE = /(?<![\w_])_(?=\w)|(?<=\w)_(?![\w_])/;
const LONE_STAR = /(?<!\*)\*(?!\*)(?=\w)|(?<=\w)(?<!\*)\*(?!\*)/;
const renderedChunkIds: string[] = [];
const totals = { notices: 0, prose: 0, katex: 0 };
const findings = {
  katexErrors: [] as string[],
  strayDollar: [] as string[],
  rawHeading: [] as string[],
  rawEmphasis: [] as string[],
  rawLink: [] as string[],
  rawCode: [] as string[],
  rawDoubleUnderscore: [] as string[],
  rawLoneUnderscore: [] as string[],
  rawLoneStar: [] as string[],
  appendixJ: [] as string[],
  h1: [] as string[],
};

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(new RegExp(pattern.source, pattern.flags)) ?? []).length;
}

function snippet(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 100);
}

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

describe('PaperDocument real release render through the real MathRenderer', () => {
  it.each(batchStarts)('renders chunks from index %i cleanly', (start) => {
    const chunks = model.chunks.slice(start, start + BATCH_SIZE);
    const { container, unmount } = render(<PaperDocument model={{ ...model, chunks }} />);
    try {
      renderedChunkIds.push(...Array.from(container.querySelectorAll('section[data-paper-chunk], section[data-paper-preamble]')).map((section, index) => section.getAttribute('data-paper-chunk') ?? `preamble:${start + index}`));
      totals.prose += container.querySelectorAll('.reader-prose').length;
      totals.katex += container.querySelectorAll('.katex').length;
      for (const error of Array.from(container.querySelectorAll('.katex-error'))) findings.katexErrors.push(snippet(error.textContent ?? ''));
      for (const prose of Array.from(container.querySelectorAll('.reader-prose'))) totals.notices += countMatches(prose.textContent ?? '', VERIFICATION_OPEN);
      for (const text of proseTextNodes(container)) {
        if (text.includes('$')) findings.strayDollar.push(snippet(text));
        if (/^\s*#{1,6}\s/.test(text)) findings.rawHeading.push(snippet(text));
        if (text.includes('**')) findings.rawEmphasis.push(snippet(text));
        if (text.includes('](')) findings.rawLink.push(snippet(text));
        if (text.includes('`')) findings.rawCode.push(snippet(text));
        if (text.includes('__')) findings.rawDoubleUnderscore.push(snippet(text));
        if (LONE_UNDERSCORE.test(text)) findings.rawLoneUnderscore.push(snippet(text));
        if (LONE_STAR.test(text)) findings.rawLoneStar.push(snippet(text));
      }
      for (const heading of Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))) {
        if (/^\s*Appendix J\b/i.test(heading.textContent ?? '')) findings.appendixJ.push(snippet(heading.textContent ?? ''));
      }
      for (const heading of Array.from(container.querySelectorAll('h1'))) findings.h1.push(snippet(heading.textContent ?? ''));
    } finally {
      unmount();
    }
  }, BATCH_TIMEOUT_MS);

  it('covered every chunk exactly once and matches the source notice count with no raw markers or errors', () => {
    expect(renderedChunkIds).toHaveLength(model.chunks.length);
    expect(new Set(renderedChunkIds).size).toBe(model.chunks.length);
    // Anti-vacuity: every chunk went through PaperText and real KaTeX output exists,
    // so the katex-error and stray-dollar checks below cannot pass because math never rendered.
    expect(totals.prose).toBe(model.chunks.length);
    expect(totals.katex).toBeGreaterThan(0);
    const sourceNotices = countMatches(structure.content, VERIFICATION_OPEN);
    expect(sourceNotices).toBeGreaterThan(0);
    expect(totals.notices).toBe(sourceNotices);
    expect(findings.katexErrors).toEqual([]);
    expect(findings.strayDollar).toEqual([]);
    expect(findings.rawHeading).toEqual([]);
    // M1R2-03: unrendered link syntax and inline-code backticks never survive to the page.
    expect(findings.rawLink).toEqual([]);
    expect(findings.rawCode).toEqual([]);
    expect(findings.appendixJ).toEqual([]);
    expect(findings.h1).toEqual([]);
  });

  it('pins each remaining marker class to its exact frozen-source text (M1R2-03)', () => {
    // Each of these is a single literal occurrence in the authenticated source, not
    // a rendering defect: CommonMark leaves an intraword `__`/`*` and an unpaired
    // leading `_` as text. The pins are exact, so a NEW occurrence of any class, or a
    // corrected source, fails here. Each is recorded as a pin candidate for L2.
    expect(findings.rawDoubleUnderscore).toEqual([KNOWN_DOUBLE_UNDERSCORE_SNIPPET]);
    expect(findings.rawLoneUnderscore).toEqual([KNOWN_LONE_UNDERSCORE_SNIPPET]);
    expect(findings.rawLoneStar).toEqual([KNOWN_LONE_STAR_SNIPPET]);
    // Source parity: each pinned string is exactly what the frozen source carries,
    // once backslash escapes are resolved the way CommonMark resolves them. The
    // star pin comes from an escaped table cell (source line 991,
    // "C\_pw = C\_sed / (K\_oc\*f\_oc)"), so the literal `*` is intended text, not
    // a failed emphasis marker.
    const unescapedSource = structure.content.replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1').replace(/\s+/g, ' ');
    for (const pinned of [KNOWN_DOUBLE_UNDERSCORE_SNIPPET, KNOWN_LONE_UNDERSCORE_SNIPPET, KNOWN_LONE_STAR_SNIPPET]) {
      expect(unescapedSource.split(pinned)).toHaveLength(2);
    }
    expect(structure.content.split('\\*')).toHaveLength(4);
  });

  it('pins the single known raw emphasis marker to its unbalanced source line (A9 source defect, recorded for L2/HITL)', () => {
    // The release line carrying "**[Protocol 13 (" has an odd number of "**" delimiters: the
    // marker opens emphasis that the source never closes, so CommonMark correctly renders it
    // literally. Source text is outside the M1 writer lock and is not rewritten for display.
    // This pin fails if any NEW raw "**" appears, and also once the source is corrected.
    expect(findings.rawEmphasis).toEqual([KNOWN_UNBALANCED_EMPHASIS_SNIPPET]);
    const sourceLine = structure.content.split('\n').find((line) => line.includes(KNOWN_UNBALANCED_EMPHASIS_SNIPPET)) ?? '';
    expect(sourceLine).not.toBe('');
    expect(countMatches(sourceLine, /\*\*/g) % 2).toBe(1);
  });
});
