import { describe, expect, it } from 'vitest';

import type { RevisedPaperNode, RevisedPaperStructure } from '../../revised-paper-structure';
import { paperInlineSegments } from '../derived-figures';
import { buildPaperChunks } from '../full-document';
import { markdownNodeText, PAPER_MARKDOWN_PLUGINS, parsePaperMarkdown, walkMarkdown, type MarkdownNode } from '../markdown-tree';
import { inactiveLinkAudit, presentInactiveLinkText } from '../source-presentation';
import { presentInactiveLinks, presentWithheldAppendixEntries, presentWithheldSections, shownWithheldEntryCount, withheldEntryCounts } from '../withheld-sections';

/*
 * Entries for a withheld section are found and removed as NODES of the parsed tree
 * (the parser the reader's renderer uses), never by reading lines. Synthetic text
 * only: "Appendix X" under the stable id `app-x` stands for the withheld appendix,
 * and every paragraph that is not part of its entry carries the word "Kept".
 */

const IDS = ['app-x'];
const TAB = String.fromCharCode(9);
const NO_BREAK_SPACE = String.fromCharCode(160);

/** The text of every paragraph the parser finds, in document order. */
function paragraphs(markdown: string): string[] {
  const found: string[] = [];
  walkMarkdown(parsePaperMarkdown(markdown), (node) => {
    if (node.type === 'paragraph') found.push(markdownNodeText(node));
  });
  return found;
}

function nodesOfType(markdown: string, type: string): MarkdownNode[] {
  const found: MarkdownNode[] = [];
  walkMarkdown(parsePaperMarkdown(markdown), (node) => {
    if (node.type === type) found.push(node);
  });
  return found;
}

/** A minimal structure for the builders: one node per ATX heading line of `content`. */
function syntheticStructure(content: string, presentation?: RevisedPaperStructure['presentation']): Pick<RevisedPaperStructure, 'content' | 'nodes' | 'presentation'> {
  const headings = Array.from(content.matchAll(/^(#{1,6})[ \t]+([^\n]*?)[ \t#]*$/gm));
  const nodes = headings.map((match, index): RevisedPaperNode => {
    const startByte = match.index ?? 0;
    return { id: `node:${index}`, domain: 'node', kind: 'heading', depth: match[1].length, label: match[2], parentId: null, ancestorIds: [], tokenEndByte: startByte + match[0].length + 1, anchor: `anchor-${index}`, startByte, endByte: index + 1 < headings.length ? headings[index + 1].index ?? content.length : content.length };
  });
  return { content, nodes, ...(presentation ? { presentation } : {}) };
}

describe('the one parse of paper text', () => {
  it('is the parse the reader renderer is given: the same plugins, and list items with the ranges the renderer draws', () => {
    expect([...PAPER_MARKDOWN_PLUGINS]).toEqual(['remark-gfm', 'remark-math']);
    // GFM is on (a table is a table) and math is on (a dollar span is math, not text).
    expect(nodesOfType('| a | b |\n|---|---|\n| 1 | 2 |\n', 'tableRow')).toHaveLength(2);
    expect(nodesOfType('An inline $x^2$ term.\n', 'inlineMath')).toHaveLength(1);
    // A tab reaches the next multiple of four columns: this line is UNDER the nested item, not beside it.
    const items = nodesOfType(`- Kept parent\n  - Nested\n${TAB}- Under the nested item\n`, 'listItem');
    expect(items).toHaveLength(3);
    expect(items[1].position?.end.line).toBe(3);
  });
});

/*
 * Each row: a name, the text, and exactly what is shown. In every row the entry is ONE node
 * and it goes whole. The first five are the forms the two line-based rules before this one
 * got wrong (successor-002 review, cases A1, A2, A3, B1, B2).
 */
const REMOVED_WHOLE: readonly (readonly [string, string, string])[] = [
  ['A1 loose entry, quoted paragraph with no space after the quote mark', 'Kept before.\n\n- Appendix X: A title\n\n  >A quoted paragraph of the same entry.\n\nKept after.\n', 'Kept before.\n\n\nKept after.\n'],
  ['A2 loose nested entry, quoted paragraph', 'Kept before.\n\n  - Appendix X: A title\n\n    > A quoted paragraph of the same entry.\n\nKept after.\n', 'Kept before.\n\n\nKept after.\n'],
  ['A3 tight nested entry, quoted sub-list', 'Kept before.\n\n  - Appendix X: A title\n    > - An entry under it\n\nKept after.\n', 'Kept before.\n\n\nKept after.\n'],
  ['B1 tight entry, tab-indented entry under it', `- Kept parent\n  - Appendix X: A title\n${TAB}- An entry under it\n- Kept sibling\n`, '- Kept parent\n- Kept sibling\n'],
  ['B2 loose entry, tab-indented second paragraph', `Kept before.\n\n  - Appendix X: A title\n\n${TAB}A second paragraph of the same entry.\n\nKept after.\n`, 'Kept before.\n\n\nKept after.\n'],
  ['an entry that runs on to a second line', '- Kept first\n- Appendix X: A title\n  that runs on to a second line\n- Kept last\n', '- Kept first\n- Kept last\n'],
  ['an entry with a lazy second line', '- Kept first\n- Appendix X: A title\nwith a lazy second line\n- Kept last\n', '- Kept first\n- Kept last\n'],
  ['an entry with a nested list two levels deep', '- Kept first\n- Appendix X\n  - An entry under it\n    - And one deeper\n- Kept last\n', '- Kept first\n- Kept last\n'],
  ['a loose-list entry with a second paragraph', '- Kept first\n\n- **Appendix X** holds a title\n\n  A second paragraph of the same entry.\n\n- Kept last\n', '- Kept first\n\n\n- Kept last\n'],
  ['a second paragraph after two blank lines, tab-indented', `- Appendix X: A title\n\n\n${TAB}A second paragraph after two blank lines.\n\nKept after.\n`, '\nKept after.\n'],
  ['an entry and its second paragraph inside one quotation', '> - Kept first\n> - Appendix X: A title\n>\n>   A second paragraph inside a quote.\n> - Kept last\n', '> - Kept first\n> - Kept last\n'],
  ['an entry and an entry under it inside one quotation', '> - Kept first\n> - Appendix X: A title\n>   - An entry under it inside a quote\n> - Kept last\n', '> - Kept first\n> - Kept last\n'],
  ['an entry whose own content is a quotation', '- > Appendix X: A title\n- Kept last\n', '- Kept last\n'],
  ['a single-line entry before a paragraph', 'Kept before.\n\n- Appendix X: A title\n\nKept after.\n', 'Kept before.\n\n\nKept after.\n'],
  ['a nested entry before a paragraph of its parent', '- Kept parent\n\n  - Appendix X: A title\n\n  Kept: the parent entry goes on at the same depth.\n', '- Kept parent\n\n\n  Kept: the parent entry goes on at the same depth.\n'],
  ['the last line, with no line feed', 'Kept before.\n\n- Appendix X: A title', 'Kept before.\n\n'],
  ['an entry that shares its line with the marker of its parent', '- - Appendix X: A title\n  - Kept last\n', '- \n  - Kept last\n'],
];

/** One-line entries in every form a list names an appendix in: each goes, the entry after it stays. */
const NAMING_FORMS: readonly string[] = [
  '- Appendix X: A title', '3. Appendix X', '7) Appendix X: A title', '* [Appendix X: A title](#somewhere)', '+ [Appendix X: A title](#app-x)', '- **Appendix X** holds a title and a description',
  '- _Appendix X_', '- appendix x: a title', '- Appendix  X - A title', `- Appendix${NO_BREAK_SPACE}X: A title`, '- `Appendix X`: A title', '- [ ] Appendix X: A title', '- <b>Appendix X</b>: A title',
  '- (Appendix X) A title', '- Appendix X.', '- Appendix X, with a title',
];

/** Near matches and mentions: another designation, or not an entry at all. Returned as the very same string. */
const UNTOUCHED: readonly (readonly [string, string])[] = [
  ['Appendix X_1 is another designation', '- Appendix X_1: Kept other\n'],
  ['Appendix X-1 is another designation', '- Appendix X-1: Kept other\n'],
  ['Appendix XA is another designation', '- Appendix XA: Kept other\n'],
  ['Appendix X1 is another designation', '- Appendix X1 Kept other\n'],
  ['Appendix X.1 is another designation', '- Appendix X.1: Kept part\n'],
  ['Appendix Y is another appendix', '- Appendix Y: A kept part\n'],
  ['an entry that only mentions it later', '- Kept: see Appendix X\n'],
  ['an entry that opens with another word', '- The Appendix X is kept\n'],
  ['a sentence', 'Kept: see Appendix X for more.\n'],
  ['a sentence that opens with the designation', 'Appendix X is kept as a sentence.\n'],
  ['a heading', '## Appendix X: Kept heading\n'],
  ['a fenced code block', '```\n- Appendix X: Kept as code\n```\n'],
  ['an indented code block', 'Kept before.\n\n    - Appendix X: Kept as code\n'],
  ['a line of cells with no delimiter row (not a table)', '| Appendix X | Kept |\n'],
  ['raw HTML that names nothing', '<div class="note">Kept</div>\n'],
];

describe('an entry for a withheld appendix is one parsed node, removed whole', () => {
  it.each(REMOVED_WHOLE)('%s', (_name, text, shown) => {
    // Control: the parser finds exactly one entry, and it can be removed.
    expect(withheldEntryCounts(text, IDS)).toMatchObject({ namingItems: 1, total: 1, unremovable: 0 });
    expect(presentWithheldSections(text, IDS)).toBe(shown);
    expect(presentWithheldAppendixEntries(text, IDS)).toBe(shown);
    // Nothing of the entry is left, and every other paragraph is as it was, in order.
    expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
    const before = paragraphs(text);
    const kept = before.filter((paragraph) => paragraph.includes('Kept'));
    expect(before.length).toBeGreaterThan(kept.length);
    expect(paragraphs(shown)).toEqual(kept);
    expect(shown.includes('Appendix X')).toBe(false);
    expect(shown.length).toBeLessThan(text.length);
    // The other side: a release that withholds nothing, or another section, shows the same string.
    for (const ids of [undefined, [], ['sec-x'], ['app-y']]) expect(presentWithheldSections(text, ids)).toBe(text);
  });

  it.each(NAMING_FORMS)('one-line entry %j', (entry) => {
    for (const [text, shown] of [
      [`Kept before.\n\n${entry}\n\nKept after.\n`, 'Kept before.\n\n\nKept after.\n'],
      [`Kept before.\n\n${entry}\n- Appendix Y: A kept part\n`, 'Kept before.\n\n- Appendix Y: A kept part\n'],
      [`Kept before.\n\n${entry}`, 'Kept before.\n\n'],
      [`  ${entry}\n  - Kept last\n`, '  - Kept last\n'],
      [`> ${entry}\n> - Kept last\n`, '> - Kept last\n'],
      [`${entry}\n`, ''],
    ] as const) {
      expect(withheldEntryCounts(text, IDS).namingItems).toBe(1);
      expect(presentWithheldSections(text, IDS)).toBe(shown);
      expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
    }
  });

  it.each(UNTOUCHED)('untouched: %s', (_name, text) => {
    expect(withheldEntryCounts(text, IDS).total).toBe(0);
    expect(presentWithheldSections(text, IDS)).toBe(text);
    expect(presentWithheldAppendixEntries(text, IDS)).toBe(text);
    expect(shownWithheldEntryCount(text, IDS)).toBe(0);
    // The other side: the same text with the exact designation in an entry is not left alone.
    expect(presentWithheldSections(`${text}\n- Appendix X: A title\n`, IDS)).not.toContain('Appendix X: A title');
  });

  it('keeps a near match and removes the exact designation beside it', () => {
    const list = '- Appendix W: Kept\n- Appendix X: A title\n- Appendix X_1: Kept\n- Appendix X-1: Kept\n- Appendix XA: Kept\n- Appendix X.1: Kept\n';
    expect(presentWithheldSections(list, IDS)).toBe('- Appendix W: Kept\n- Appendix X_1: Kept\n- Appendix X-1: Kept\n- Appendix XA: Kept\n- Appendix X.1: Kept\n');
    expect(withheldEntryCounts(list, IDS)).toMatchObject({ namingItems: 1, total: 1 });
  });

  it('only ids of the appendix form name an appendix, each id its own letter', () => {
    const list = '- Appendix X: A\n- Appendix Y: B\n- Appendix X again\n';
    expect(withheldEntryCounts(list, ['app-x']).namingItems).toBe(2);
    expect(withheldEntryCounts(list, ['app-x', 'app-y']).namingItems).toBe(3);
    expect(presentWithheldSections(list, ['app-x', 'app-y'])).toBe('');
    for (const ids of [undefined, [], ['sec-x'], ['app-xy'], ['APP-X']]) expect(withheldEntryCounts(list, ids).total).toBe(0);
  });
});

describe('removal never changes the content that is kept: it is checked with the parser, and refused otherwise', () => {
  const presentation = { frontMatter: false, inactiveLinkTargets: ['app-x'] };
  const REFUSAL = 'Paper full-document model unavailable: the withheld appendix has a list entry in the presented text';
  /*
   * Each text: taking the entry's lines out would change how a KEPT neighbour parses. Nothing is
   * removed, the text is returned as the very same string, the entry is still counted, and the build
   * stops. (Found by the independent review of successor 003: inputs A and B and the related one.)
   */
  const WOULD_CHANGE_NEIGHBOURS: readonly (readonly [string, string])[] = [
    ['a numbered list directly under its lead-in line: without item 1 the list cannot interrupt the paragraph', 'Kept paragraph\n1. Appendix X: A title\n2. Kept two\n'],
    ['stepped indentation: without the entry the item after it slides under the item before it', '- Kept one\n - Appendix X: A title\n  - Kept three\n'],
    ['the entry shares the line of its parent marker and a paragraph of the parent follows: the paragraph would leave the list', '1. - Appendix X: A title\n\n   Kept paragraph of item 1\n'],
    ['the same with a link entry', 'Kept paragraph\n1. [A linked title](#app-x)\n2. Kept two\n'],
    ['two numbered lists either side of the entry would become one list, the second numbered on from the first', '1. Kept one\n\n- Appendix X: A title\n\n5. Kept five\n'],
    ['two bulleted lists either side of the entry would become one list', '- Kept one\n* Appendix X: A title\n- Kept three\n'],
    ['a list item that holds nothing but the entry would be left as an empty item', '1. - Appendix X: A title\n'],
    ['a kept sentence uses a link reference that is defined inside the entry', '- Appendix X: A title\n\n  [ref]: https://example.test/\n\nKept [text][ref].\n'],
    ['the line under the entry would become the underline of a heading', 'Kept line\n- Appendix X: A title\n---\n'],
  ];

  it.each(WOULD_CHANGE_NEIGHBOURS)('refused: %s', (_name, text) => {
    expect(withheldEntryCounts(text, IDS)).toMatchObject({ total: 1, unremovable: 0 });
    expect(presentWithheldSections(text, IDS)).toBe(text);
    expect(presentWithheldAppendixEntries(text, IDS)).toBe(text);
    expect(presentInactiveLinks(text, IDS)).toBe(text);
    expect(shownWithheldEntryCount(presentWithheldSections(text, IDS), IDS)).toBeGreaterThan(0);
    expect(() => buildPaperChunks(syntheticStructure(`# Paper\n\n${text}`, presentation))).toThrow(REFUSAL);
    // The other side: a release that withholds nothing builds the same text.
    expect(() => buildPaperChunks(syntheticStructure(`# Paper\n\n${text}`))).not.toThrow();
  });

  it('the other side: the same entries are removed where the kept content parses as before', () => {
    for (const [text, shown] of [
      // A blank line before the list: it is a list with or without its first item.
      ['Kept paragraph\n\n1. Appendix X: A title\n2. Kept two\n', 'Kept paragraph\n\n2. Kept two\n'],
      // Siblings at one indentation.
      ['- Kept one\n- Appendix X: A title\n- Kept three\n', '- Kept one\n- Kept three\n'],
      // The paragraph of the parent is indented under an item that keeps its own text.
      ['1. Kept item 1\n   - Appendix X: A title\n\n   Kept paragraph of item 1\n', '1. Kept item 1\n\n   Kept paragraph of item 1\n'],
      // Two numbered lists with a kept paragraph between them stay two lists.
      ['1. Kept one\n\n- Appendix X: A title\n\nKept between\n\n5. Kept five\n', '1. Kept one\n\n\nKept between\n\n5. Kept five\n'],
      // One bulleted list: the items either side of the entry were already items of one list.
      ['- Kept one\n- Appendix X: A title\n\n  [ref]: https://example.test/\n- Kept [text][other]\n\n[other]: https://example.test/\n', '- Kept one\n- Kept [text][other]\n\n[other]: https://example.test/\n'],
    ] as const) {
      expect(presentWithheldSections(text, IDS)).toBe(shown);
      expect(paragraphs(shown)).toEqual(paragraphs(text).filter((paragraph) => paragraph.includes('Kept')));
      expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
    }
  });

  it('when nothing can be removed, no link is rewritten either: an entry shown as plain text could not be counted', () => {
    // One entry cannot be removed (the numbered list), so the link in the sentence stays a link as well.
    const text = 'See [the appendix](#app-x).\n\nKept paragraph\n1. [A linked title](#app-x)\n2. Kept two\n';
    expect(presentWithheldSections(text, IDS)).toBe(text);
    expect(withheldEntryCounts(presentWithheldSections(text, IDS), IDS).linkItems).toBe(1);
    // The other side: with the entry removable, it goes and the sentence link becomes text.
    expect(presentWithheldSections('See [the appendix](#app-x).\n\n1. [A linked title](#app-x)\n2. Kept two\n', IDS)).toBe('See the appendix.\n\n2. Kept two\n');
  });
});

describe('entries the reader would draw that are not plain list items', () => {
  it('a list item whose link is inside a quotation or a heading, and a table body row that is only a link, are entries and go whole', () => {
    for (const [text, shown] of [
      ['- Kept first\n- > [A linked title](#app-x)\n- Kept last\n', '- Kept first\n- Kept last\n'],
      ['- Kept first\n- ### [A linked title](#app-x)\n- Kept last\n', '- Kept first\n- Kept last\n'],
      ['| Section | Note |\n|---|---|\n| [A linked title](#app-x) | x |\n| Kept | y |\n', '| Section | Note |\n|---|---|\n| Kept | y |\n'],
    ] as const) {
      expect(withheldEntryCounts(text, IDS)).toMatchObject({ total: 1, unremovable: 0 });
      expect(presentWithheldSections(text, IDS)).toBe(shown);
      expect(shown.includes('A linked title')).toBe(false);
      expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
      // The other side: the same shapes with a link to a section that is not withheld are left alone.
      const other = text.split('#app-x').join('#app-y');
      expect(presentWithheldSections(other, IDS)).toBe(other);
    }
  });

  it('a footnote that opens with the designation, or is only a link to the withheld section, is counted and never rewritten', () => {
    for (const text of ['Kept text.[^1]\n\n[^1]: Appendix X: A title\n', 'Kept text.[^1]\n\n[^1]: [A linked title](#app-x)\n']) {
      expect(withheldEntryCounts(text, IDS)).toMatchObject({ footnotes: 1, unremovable: 1, total: 1 });
      expect(presentWithheldSections(text, IDS)).toBe(text);
      expect(shownWithheldEntryCount(presentWithheldSections(text, IDS), IDS)).toBeGreaterThan(0);
    }
    // The other side: a footnote about another appendix, and one that merely mentions it.
    for (const text of ['Kept text.[^1]\n\n[^1]: Appendix Y: A kept part\n', 'Kept text.[^1]\n\n[^1]: Kept: see Appendix X.\n']) {
      expect(withheldEntryCounts(text, IDS).total).toBe(0);
      expect(shownWithheldEntryCount(presentWithheldSections(text, IDS), IDS)).toBe(0);
    }
  });

  it('raw HTML that holds a link to the withheld section is counted, and the link is not rewritten into text', () => {
    const text = '<div>\n- [A linked title](#app-x)\n</div>\n';
    expect(withheldEntryCounts(text, IDS)).toMatchObject({ html: 1, unremovable: 1, total: 1 });
    expect(presentWithheldSections(text, IDS)).toBe(text);
    expect(shownWithheldEntryCount(presentWithheldSections(text, IDS), IDS)).toBeGreaterThan(0);
    // The other side: the same raw HTML with a link to a section that is not withheld.
    const other = '<div>\n- [A kept title](#app-y)\n</div>\n';
    expect(withheldEntryCounts(other, IDS).total).toBe(0);
    expect(presentWithheldSections(other, IDS)).toBe(other);
  });
});

describe('ordered and unordered lists around a removed entry', () => {
  it('leaves every other item as it was written, numerals included, in one list', () => {
    for (const [text, shown, start, items] of [
      ['1. Kept one\n2. Appendix X: A title\n3. Kept three\n', '1. Kept one\n3. Kept three\n', 1, 2],
      ['4. Appendix X: A title\n5. Kept five\n6. Kept six\n', '5. Kept five\n6. Kept six\n', 5, 2],
      ['1) Kept one\n2) [Appendix X: A title](#app-x)\n3) Kept three\n', '1) Kept one\n3) Kept three\n', 1, 2],
      ['7. Kept seven\n8. Kept eight\n9. Appendix X: A title\n', '7. Kept seven\n8. Kept eight\n', 7, 2],
    ] as const) {
      expect(presentWithheldSections(text, IDS)).toBe(shown);
      const lists = nodesOfType(shown, 'list');
      expect(lists).toHaveLength(1);
      expect(lists[0].ordered).toBe(true);
      // The list starts at the numeral of its first remaining item; the items keep their order.
      expect(lists[0].start).toBe(start);
      expect(lists[0].children).toHaveLength(items);
    }
    const unordered = '* Kept one\n* Appendix X: A title\n* Kept three\n';
    expect(presentWithheldSections(unordered, IDS)).toBe('* Kept one\n* Kept three\n');
    expect(nodesOfType(presentWithheldSections(unordered, IDS), 'list')[0].ordered).toBe(false);
  });

  it('does not turn a tight list loose or a loose list tight', () => {
    const tight = presentWithheldSections('- Kept one\n- Appendix X: A title\n- Kept three\n', IDS);
    expect(nodesOfType(tight, 'list')[0].spread).toBe(false);
    const loose = presentWithheldSections('- Kept one\n\n- Appendix X: A title\n\n- Kept three\n', IDS);
    expect(loose).toBe('- Kept one\n\n\n- Kept three\n');
    expect(nodesOfType(loose, 'listItem')).toHaveLength(2);
  });
});

describe('tables, raw HTML and code', () => {
  it('removes a table body row that names the appendix, and nothing else of the table', () => {
    const table = '| Appendix | Title |\n|---|---|\n| Appendix W | Kept |\n| Appendix X | A title |\n| Appendix X_1 | Kept |\n| Appendix Y | Kept |\n';
    expect(withheldEntryCounts(table, IDS)).toMatchObject({ tableRows: 1, total: 1, unremovable: 0 });
    const shown = presentWithheldSections(table, IDS);
    expect(shown).toBe('| Appendix | Title |\n|---|---|\n| Appendix W | Kept |\n| Appendix X_1 | Kept |\n| Appendix Y | Kept |\n');
    expect(nodesOfType(shown, 'tableRow')).toHaveLength(4);
    expect(shownWithheldEntryCount(shown, IDS)).toBe(0);
    // A row that names it in a later cell is a mention, not the row's own entry.
    const later = '| Topic | Where |\n|---|---|\n| Kept | Appendix X |\n';
    expect(presentWithheldSections(later, IDS)).toBe(later);
  });

  it('cannot remove a header row or raw HTML: the text is left as it is and counted, so the builders refuse it', () => {
    for (const [text, kind] of [
      ['| Appendix X | A title |\n|---|---|\n| Appendix Y | Kept |\n', 'tableRows'],
      ['<ul>\n<li>Appendix X: A title</li>\n</ul>\n', 'html'],
      ['<!-- Appendix X: A title -->\n', 'html'],
    ] as const) {
      expect(withheldEntryCounts(text, IDS)).toMatchObject({ [kind]: 1, total: 1, unremovable: 1 });
      expect(presentWithheldSections(text, IDS)).toBe(text);
      expect(shownWithheldEntryCount(presentWithheldSections(text, IDS), IDS)).toBeGreaterThan(0);
      expect(shownWithheldEntryCount(text, undefined)).toBe(0);
    }
  });

  it('reads code as literal text: a list line inside code is not an entry', () => {
    const fenced = 'Kept before.\n\n```\n- Appendix X: Kept as code\n```\n\n- Appendix X: A title\n';
    expect(withheldEntryCounts(fenced, IDS)).toMatchObject({ namingItems: 1, total: 1 });
    expect(presentWithheldSections(fenced, IDS)).toBe('Kept before.\n\n```\n- Appendix X: Kept as code\n```\n\n');
  });
});

describe('links into the withheld section', () => {
  it('shows a simple inline link to a named id as its text and changes nothing else', () => {
    const markdown = 'See [Appendix X](#app-x), [Appendix Y](#app-y) and [the site](https://example.test/#app-x).\n\n- Second, see [it](#app-x)\n';
    expect(presentInactiveLinks(markdown, ['app-x'])).toBe('See Appendix X, [Appendix Y](#app-y) and [the site](https://example.test/#app-x).\n\n- Second, see it\n');
    expect(presentInactiveLinks(markdown, ['app-x', 'app-y'])).toBe('See Appendix X, Appendix Y and [the site](https://example.test/#app-x).\n\n- Second, see it\n');
    expect(presentWithheldSections(markdown, ['app-x'])).toBe(presentInactiveLinks(markdown, ['app-x']));
    // Not a simple link to exactly that id: a longer id, a title, an image, nested brackets, a line break.
    for (const untouched of ['[a](#app-xy)', '[a](#app-x "title")', '![a](#app-x)', '[a [b]](#app-x)', '[a\nb](#app-x)', '[a](<#app-x>)', 'plain #app-x text']) {
      expect(presentInactiveLinkText(untouched, ['app-x'])).toBe(untouched);
    }
    expect(presentInactiveLinks(markdown, [])).toBe(markdown);
    expect(presentInactiveLinks(markdown, undefined)).toBe(markdown);
    expect(presentInactiveLinks('[a](#app-x)', ['app-x']).length).toBeLessThan('[a](#app-x)'.length);
  });

  it('rewrites and audits links outside code while preserving inline and fenced code literals', () => {
    const markdown = 'See [Appendix X](#app-x) and `[Appendix X](#app-x)` literally.\n\n```md\n[Appendix X](#app-x)\n```\n';
    expect(presentInactiveLinkText(markdown, ['app-x'])).toBe('See Appendix X and `[Appendix X](#app-x)` literally.\n\n```md\n[Appendix X](#app-x)\n```\n');
    expect(inactiveLinkAudit(markdown, 'app-x')).toEqual({ tokens: 1, links: 1 });
    expect(presentInactiveLinkText('`[Appendix X](#app-x)`\n\n```md\n[Appendix X](#app-x)\n```', ['app-x']))
      .toBe('`[Appendix X](#app-x)`\n\n```md\n[Appendix X](#app-x)\n```');
    expect(inactiveLinkAudit('`[Appendix X](#app-x)`\n\n```md\n[Appendix X](#app-x)\n```', 'app-x'))
      .toEqual({ tokens: 0, links: 0 });
  });

  it('does not show a list item that is nothing but a link to a named id, with everything under it', () => {
    const list = '1. [Appendix J: A kept part](#app-j)\n2. [A synthetic title that is not to be shown](#app-x)\n3. [Appendix Y: Another kept part](#app-y)\n';
    expect(withheldEntryCounts(list, IDS)).toMatchObject({ linkItems: 1, namingItems: 0, total: 1 });
    const shown = presentInactiveLinks(list, IDS);
    expect(shown).toBe('1. [Appendix J: A kept part](#app-j)\n3. [Appendix Y: Another kept part](#app-y)\n');
    expect(shown.includes('synthetic title')).toBe(false);
    for (const entry of ['- [T](#app-x)', '* [T](#app-x)', '+ [T](#app-x)', '7. [T](#app-x)', '12) [T](#app-x)', '  - [T](#app-x)', '> - [T](#app-x)', '- [T](#app-x)  ', '- [T](#app-x)\n  - An entry under it', '- [T](#app-x)\n\n  A second paragraph of the same entry.']) {
      expect(presentInactiveLinks(`Kept before.\n\n${entry}\n\nKept after.\n`, IDS)).toBe('Kept before.\n\n\nKept after.\n');
      expect(withheldEntryCounts(`Kept before.\n\n${entry}\n\nKept after.\n`, IDS).linkItems).toBe(1);
    }
    // The other side: a link that is not the whole first paragraph of an item is shown as its text, and the item stays.
    for (const [source, text] of [
      ['- See [T](#app-x)', '- See T'],
      ['- [T](#app-x) and more', '- T and more'],
      ['- [T](#app-x) [U](#app-x)', '- T U'],
      ['- [T](#app-x)\n  and a second line', '- T\n  and a second line'],
      ['[T](#app-x)', 'T'],
      ['-[T](#app-x)', '-T'],
      ['| [T](#app-x) |', '| T |'],
    ] as const) {
      expect(presentInactiveLinks(`Kept before.\n\n${source}\n\nKept after.\n`, IDS)).toBe(`Kept before.\n\n${text}\n\nKept after.\n`);
      expect(withheldEntryCounts(`${source}\n`, IDS).total).toBe(0);
    }
    // Only an entry for a named id goes.
    expect(presentInactiveLinks(list, ['app-q'])).toBe(list);
    expect(presentInactiveLinks(list, ['app-x', 'app-y'])).toBe('1. [Appendix J: A kept part](#app-j)\n');
  });

  it('applies both rules as the one presentation the reader surfaces use', () => {
    const both = 'See [Appendix X](#app-x).\n\n- [Appendix K: A kept part](#app-k)\n- [Appendix X: A title](#app-x)\n\n- **Appendix K** holds one thing\n- **Appendix X** holds another thing\n';
    expect(withheldEntryCounts(both, IDS)).toMatchObject({ namingItems: 2, linkItems: 1, total: 2 });
    expect(presentWithheldSections(both, IDS)).toBe('See Appendix X.\n\n- [Appendix K: A kept part](#app-k)\n\n- **Appendix K** holds one thing\n');
    expect(presentWithheldSections(both, undefined)).toBe(both);
    // An item that is a link to the withheld section but does not name the appendix goes too, with what is under it.
    expect(presentWithheldSections('- Kept first\n- [A linked title](#app-x)\n  - An entry under it\n- Kept last\n', IDS)).toBe('- Kept first\n- Kept last\n');
  });
});

describe('what the reader is handed has no entry left, or the build stops', () => {
  const presentation = { frontMatter: false, inactiveLinkTargets: ['app-x'] };
  const paper = (entry: string): string => `# Paper\n\nKept text.\n\n## Contents\n\n- [Appendix K: A kept part](#app-k)\n${entry}\n\n## Body\n\nSee Appendix X for more.\n`;
  const without = '# Paper\n\nKept text.\n\n## Contents\n\n- [Appendix K: A kept part](#app-k)\n\n## Body\n\nSee Appendix X for more.\n';
  const shownText = (content: string, presented?: typeof presentation): string => buildPaperChunks(syntheticStructure(content, presented)).map((chunk) => chunk.markdown).join('');
  const REFUSAL = 'Paper full-document model unavailable: the withheld appendix has a list entry in the presented text';

  it('buildPaperChunks shows no entry in any form, single line or not, and keeps the sentence that mentions the appendix', () => {
    for (const entry of [
      '- [Appendix X: A synthetic title](#app-x)', '- Appendix X: A synthetic title', '- **Appendix X** holds a synthetic title and a description', '- [Appendix X: A synthetic title](#app-x) (under revision)',
      '- Appendix X: A synthetic title\n  that runs on to a second line', '- [Appendix X: A synthetic title](#app-x)\n  - An entry under it', '- **Appendix X** holds\na lazy second line',
      '- **Appendix X** holds a synthetic title\n\n  A second paragraph of the same entry.', '- Appendix X: A synthetic title\n\n  >A quoted paragraph of the same entry.', `- Appendix X: A synthetic title\n${TAB}- An entry under it`,
    ]) {
      expect(shownText(paper(entry), presentation)).toBe(without);
      // The other side: for a release that withholds nothing the same text is shown whole, entry included.
      expect(shownText(paper(entry))).toBe(paper(entry));
    }
    // In the preamble (before the first heading) as well.
    expect(buildPaperChunks(syntheticStructure('- [Appendix X: A synthetic title](#app-x)\n\n# Paper\n\nText.\n', presentation))[0].markdown).toBe('\n');
    expect(buildPaperChunks(syntheticStructure('- Appendix X: A synthetic title\n  that runs on\n\n# Paper\n\nText.\n', presentation))[0].markdown).toBe('\n');
  });

  it('buildPaperChunks refuses text in which an entry cannot be removed', () => {
    for (const content of [
      '# Paper\n\n| Appendix X | A synthetic title |\n|---|---|\n| Appendix Y | Kept |\n',
      '# Paper\n\n<ul>\n<li>Appendix X: A synthetic title</li>\n</ul>\n',
      '<ul>\n<li>Appendix X: A synthetic title</li>\n</ul>\n\n# Paper\n\nText.\n',
    ]) {
      expect(() => buildPaperChunks(syntheticStructure(content, presentation))).toThrow(REFUSAL);
      expect(() => buildPaperChunks(syntheticStructure(content))).not.toThrow();
    }
  });

  it('counts on what the renderer is handed: an entry hidden from the whole text by an anchor span is still refused', () => {
    // The reader drops empty anchor spans before it parses a piece of prose (paperInlineSegments),
    // so THAT text opens with the designation although the chunk text does not.
    const hidden = '- []{#tbl-9}Appendix X: A synthetic title\n- Kept last\n';
    expect(withheldEntryCounts(hidden, IDS).total).toBe(0);
    const handed = paperInlineSegments(hidden).flatMap((segment) => (segment.kind === 'markdown' ? [segment.markdown] : []));
    expect(handed.map((markdown) => withheldEntryCounts(markdown, IDS).total)).toEqual([1]);
    expect(shownWithheldEntryCount(hidden, IDS)).toBe(1);
    expect(() => buildPaperChunks(syntheticStructure(`# Paper\n\n${hidden}`, presentation))).toThrow(REFUSAL);
    // The other side: the same span in an entry for another appendix builds.
    expect(() => buildPaperChunks(syntheticStructure('# Paper\n\n- []{#tbl-9}Appendix Y: A kept part\n', presentation))).not.toThrow();
    expect(shownWithheldEntryCount('- []{#tbl-9}Appendix Y: A kept part\n', IDS)).toBe(0);
  });

  it('shownWithheldEntryCount is zero for text with no entry and for a release that withholds nothing', () => {
    expect(shownWithheldEntryCount('- Appendix X: A title\n', IDS)).toBeGreaterThan(0);
    expect(shownWithheldEntryCount('- Appendix X: A title\n', undefined)).toBe(0);
    expect(shownWithheldEntryCount('- Appendix X: A title\n', [])).toBe(0);
    expect(shownWithheldEntryCount('Kept: see Appendix X for more.\n', IDS)).toBe(0);
  });
});
