import { paperInlineSegments } from './derived-figures';
import { markdownNodeRange, parsePaperMarkdown, walkMarkdown, type MarkdownNode } from './markdown-tree';
import { presentInactiveLinkText } from './source-presentation';

/*
 * How a release that withholds a section (releases.ts `withheld`) presents the
 * text around it. The section itself is not in the artifact; what the artifact
 * still carries are ENTRIES for it: its line in a contents list, a line in a list
 * of the appendices, and links to it from sentences.
 *
 * Where an entry begins and ends is decided by the Markdown parser the reader's
 * renderer uses (markdown-tree.ts), never by reading lines: an entry is one NODE
 * of the parsed tree, and it is removed whole, with every paragraph, quotation,
 * nested list and continuation line the parser gives it.
 *
 * - A LIST ITEM is an entry when the block it opens with (its first paragraph or
 *   heading, looked for through quotations) opens with the designation of a
 *   withheld appendix ("Appendix L", exactly: "Appendix L_1", "Appendix L-1",
 *   "Appendix LA" and "Appendix L.1" are other designations), or is nothing but a
 *   link to a withheld section.
 * - A TABLE ROW is an entry when its first cell opens with such a designation or
 *   is nothing but such a link. A body row is removed; a header row cannot be (the
 *   table would lose its header), so it is left and counted.
 * - RAW HTML is shown by the reader as it is written, so a piece of it that opens
 *   with such a designation, or raw HTML that holds a link to a withheld section,
 *   is counted; it is never rewritten. A FOOTNOTE that opens the same way is drawn
 *   by the reader as an item of its own list; it is counted and not rewritten.
 * - Code is literal text and is not an entry. A sentence that merely mentions the
 *   appendix is not an entry and is shown as it is.
 *
 * REMOVAL HAS A POST-CONDITION, checked with the same parser: the tree parsed from
 * the text after removal must be, node for node, the tree parsed before it without
 * the removed entries: every kept node of the same kind, with the same text, under
 * the same parent, in the same order (a list item is still an item of the same
 * list, a quoted paragraph is still quoted, two lists are still two lists).
 * Removing lines can change how the lines around them parse (a numbered list that
 * no longer starts at 1 cannot interrupt a paragraph; an item indented one column
 * can slide under the item before it; two lists either side of an entry can become
 * one). When the kept content would not be exactly what it was, NOTHING is removed
 * and no link is rewritten: the text is returned as it came, its entries are still
 * there, and the builders refuse it. Not compared, because removal changes them by
 * its nature: where a node stands, whether a list is loose or tight, and the number
 * a numbered list counts from.
 *
 * Whatever is left after removal is counted again on what the reader is handed
 * (shownWithheldEntryCount): the builders refuse text for which that count is not
 * zero. A link inside an entry that could not be removed is left as a link, so
 * that the count still sees the entry.
 *
 * Pure and isomorphic: no fs, no crypto, no server-only import.
 */

/** What the entries for withheld sections in a text are, by kind. Counts only. */
export interface WithheldEntryCounts {
  /** List items that open with the designation of a withheld appendix. */
  readonly namingItems: number;
  /** List items whose opening block is nothing but a link to a withheld section. */
  readonly linkItems: number;
  /** Table rows whose first cell opens with such a designation or is nothing but such a link. */
  readonly tableRows: number;
  /** Raw HTML nodes with a piece that opens with such a designation, or that hold such a link. */
  readonly html: number;
  /** Footnotes that open with such a designation or with nothing but such a link. */
  readonly footnotes: number;
  /** Entries that cannot be removed whole: a table header row, raw HTML, a footnote, a node with no position. */
  readonly unremovable: number;
  /** Every entry, each counted once. */
  readonly total: number;
}

interface WithheldEntry {
  readonly node: MarkdownNode;
  readonly kind: 'list-item' | 'table-row' | 'html' | 'footnote';
  readonly naming: boolean;
  readonly link: boolean;
  readonly removable: boolean;
}

const APPENDIX_ID = /^app-([a-z])$/;

/**
 * "Appendix <LETTER>" as a WHOLE designation at the start of a text: the letter is
 * not followed by another letter, a digit, `_` or `-`, nor by a full stop that
 * runs on into a letter or digit. Ids of any other form than `app-<letter>` name
 * no appendix and give no pattern.
 */
function designationPatterns(ids: readonly string[]): readonly RegExp[] {
  return ids.flatMap((id) => {
    const letter = APPENDIX_ID.exec(id)?.[1];
    return letter ? [new RegExp(`^Appendix ${letter}(?![\\p{L}\\p{N}_-])(?!\\.[\\p{L}\\p{N}])`, 'iu')] : [];
  });
}

/** The text a node shows to a reader: raw HTML adds none, a line break is a space. */
function shownText(node: MarkdownNode): string {
  if (node.type === 'html') return '';
  if (node.type === 'break') return ' ';
  if (typeof node.value === 'string') return node.value;
  if (node.type === 'image') return typeof node.alt === 'string' ? node.alt : '';
  return (node.children ?? []).map(shownText).join('');
}

/**
 * Whether `text` opens with one of the designations. White space of any kind and
 * length (a no-break space too) counts as one space, and whatever stands before
 * the first letter or digit (a bracket, a quote mark) is not part of the text.
 */
function opensWithDesignation(text: string, patterns: readonly RegExp[]): boolean {
  const lead = text.replace(/\s+/gu, ' ').replace(/^[^\p{L}\p{N}]+/u, '');
  return patterns.some((pattern) => pattern.test(lead));
}

/** The block a list item or a footnote opens with: its first paragraph or heading, looked for through quotations. */
function leadBlock(node: MarkdownNode): MarkdownNode | null {
  const first = node.children?.[0];
  if (!first) return null;
  if (first.type === 'paragraph' || first.type === 'heading') return first;
  return first.type === 'blockquote' ? leadBlock(first) : null;
}

/** Whether a block (a paragraph, a heading, a table cell) is one link to one of `targets` (`#id`) and nothing else. */
function isOnlyALink(block: MarkdownNode | null | undefined, targets: readonly string[]): boolean {
  if (!block) return false;
  const inline = (block.children ?? []).filter((child) => !(child.type === 'text' && (child.value ?? '').trim() === ''));
  return inline.length === 1 && inline[0].type === 'link' && targets.includes(inline[0].url ?? '');
}

/** Raw HTML is shown as written: the pieces between its tags are what a reader would read. */
function htmlOpensWithDesignation(value: string, patterns: readonly RegExp[]): boolean {
  return value.split(/<\/?[A-Za-z][^>]*>|\n/).some((piece) => opensWithDesignation(piece, patterns));
}

/** Every entry for a withheld section in a parsed text, in document order. */
function withheldEntries(tree: MarkdownNode, ids: readonly string[]): readonly WithheldEntry[] {
  const patterns = designationPatterns(ids);
  const targets = ids.map((id) => `#${id}`);
  const entries: WithheldEntry[] = [];
  walkMarkdown(tree, (node, ancestors) => {
    if (node.type === 'listItem' || node.type === 'footnoteDefinition') {
      const lead = leadBlock(node);
      const naming = lead !== null && opensWithDesignation(shownText(lead), patterns);
      const link = isOnlyALink(lead, targets);
      if (!naming && !link) return;
      // A footnote is drawn in a list of its own, away from where it is written: it is not rewritten.
      if (node.type === 'footnoteDefinition') entries.push({ node, kind: 'footnote', naming, link, removable: false });
      else entries.push({ node, kind: 'list-item', naming, link, removable: markdownNodeRange(node) !== null });
    } else if (node.type === 'tableRow') {
      const cell = node.children?.[0];
      const naming = cell !== undefined && opensWithDesignation(shownText(cell), patterns);
      const link = isOnlyALink(cell, targets);
      if (!naming && !link) return;
      const isHeader = ancestors[ancestors.length - 1]?.children?.[0] === node;
      entries.push({ node, kind: 'table-row', naming, link, removable: !isHeader && markdownNodeRange(node) !== null });
    } else if (node.type === 'html') {
      const value = node.value ?? '';
      const naming = htmlOpensWithDesignation(value, patterns);
      // A link written inside raw HTML is not a link node; as text it would be shown where the HTML is.
      const link = targets.some((target) => value.includes(`](${target})`));
      if (naming || link) entries.push({ node, kind: 'html', naming, link, removable: false });
    }
  });
  return entries;
}

function countEntries(entries: readonly WithheldEntry[]): WithheldEntryCounts {
  const count = (test: (entry: WithheldEntry) => boolean): number => entries.filter(test).length;
  return {
    namingItems: count((entry) => entry.kind === 'list-item' && entry.naming),
    linkItems: count((entry) => entry.kind === 'list-item' && entry.link),
    tableRows: count((entry) => entry.kind === 'table-row'),
    html: count((entry) => entry.kind === 'html'),
    footnotes: count((entry) => entry.kind === 'footnote'),
    unremovable: count((entry) => !entry.removable),
    total: entries.length,
  };
}

const NO_ENTRIES: WithheldEntryCounts = Object.freeze({ namingItems: 0, linkItems: 0, tableRows: 0, html: 0, footnotes: 0, unremovable: 0, total: 0 });

/** The entries for the withheld sections `ids` in `markdown`, as the parser reads it. */
export function withheldEntryCounts(markdown: string, ids: readonly string[] | undefined): WithheldEntryCounts {
  if (!ids || ids.length === 0) return NO_ENTRIES;
  return countEntries(withheldEntries(parsePaperMarkdown(markdown), ids));
}

/**
 * The members of a node that say WHERE it stands, how its list is spaced and which
 * number its list counts from. Taking an entry out moves what follows it, may leave
 * a list tight that was loose only because of the entry, and leaves a numbered list
 * to count on from its first remaining item (the numerals stay as written). Every
 * other member of every node is compared.
 */
const NOT_COMPARED: ReadonlySet<string> = new Set(['position', 'children', 'spread', 'start']);

/**
 * A parsed text as plain data, without the nodes in `without` and everything inside
 * them: every node with its kind, its text and its other members, its children in
 * order. A container left with no content because all of it was taken (a list of
 * nothing but entries) is left out with them; one that was written empty stays.
 * Two texts with equal data here are, node for node, the same document.
 */
function keptTree(node: MarkdownNode, without: ReadonlySet<MarkdownNode>): unknown {
  if (without.has(node)) return undefined;
  const members = Object.entries(node as unknown as Record<string, unknown>)
    .filter(([name]) => !NOT_COMPARED.has(name))
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  if (!node.children) return members;
  const children = node.children.map((child) => keptTree(child, without)).filter((child) => child !== undefined);
  if (node.type !== 'root' && node.children.length > 0 && children.length === 0) return undefined;
  return [...members, ['children', children]];
}

/** Whether `after` is, node for node, what `before` is without the nodes in `taken`. */
function isTreeWithout(before: MarkdownNode, taken: ReadonlySet<MarkdownNode>, after: MarkdownNode): boolean {
  return JSON.stringify(keptTree(before, taken)) === JSON.stringify(keptTree(after, new Set()));
}

/**
 * `markdown` without the given node ranges. A node that has its lines to itself
 * (only indentation and quote marks before it, only blanks after it) goes with
 * those lines, line feed included; any other node goes alone, and what shares
 * its line stays. A range inside one already taken is skipped. What this leaves
 * is checked by the caller against the parsed tree (withoutEntries).
 */
function withoutRanges(markdown: string, ranges: readonly { readonly start: number; readonly end: number }[]): string {
  let result = '';
  let cursor = 0;
  for (const range of ranges) {
    if (range.start < cursor) continue;
    const lineStart = range.start === 0 ? 0 : markdown.lastIndexOf('\n', range.start - 1) + 1;
    const lineFeed = markdown.indexOf('\n', range.end);
    const lineEnd = lineFeed < 0 ? markdown.length : lineFeed;
    const ownLines = lineStart >= cursor && /^[ \t>]*$/.test(markdown.slice(lineStart, range.start)) && markdown.slice(range.end, lineEnd).trim() === '';
    result += markdown.slice(cursor, ownLines ? lineStart : range.start);
    cursor = ownLines ? (lineFeed < 0 ? markdown.length : lineFeed + 1) : range.end;
  }
  return result + markdown.slice(cursor);
}

/** Removal is repeated until the parser finds nothing more to take; text never needs more than a few passes. */
const MAX_REMOVAL_PASSES = 4;

/**
 * `markdown` without every entry `select` picks that can be removed whole, or null
 * when that cannot be done without changing the content that is kept: after each
 * pass the tree the parser reads from the new text must be exactly the tree it
 * read before, without the removed entries (isTreeWithout). Null also when entries
 * are still found after the last pass.
 */
function withoutEntries(markdown: string, ids: readonly string[], select: (entry: WithheldEntry) => boolean): string | null {
  let result = markdown;
  for (let pass = 0; pass <= MAX_REMOVAL_PASSES; pass += 1) {
    const tree = parsePaperMarkdown(result);
    const taken = withheldEntries(tree, ids).filter((entry) => entry.removable && select(entry));
    if (taken.length === 0) return result;
    if (pass === MAX_REMOVAL_PASSES) return null;
    const next = withoutRanges(result, taken.flatMap((entry) => markdownNodeRange(entry.node) ?? []));
    if (!isTreeWithout(tree, new Set(taken.map((entry) => entry.node)), parsePaperMarkdown(next))) return null;
    result = next;
  }
  return null;
}

/**
 * The links of `markdown` to `ids` shown as their text, unless an entry that is a
 * link is still in the text: its link is then left as it is, because as plain
 * text the entry could no longer be counted (and so no longer be refused).
 */
function withLinkText(markdown: string, ids: readonly string[]): string {
  if (withheldEntries(parsePaperMarkdown(markdown), ids).some((entry) => entry.link)) return markdown;
  return presentInactiveLinkText(markdown, ids);
}

/**
 * `markdown` as it is shown with respect to LINKS to one of `ids`: a list item or
 * a table body row that is nothing but such a link (a contents list's entry for
 * that section) is not shown, with everything under it; every other simple inline
 * link is shown as its link text. Nothing else is changed, and the result is never
 * longer than the input. Returned unchanged when the entries cannot be removed
 * without changing what is kept.
 */
export function presentInactiveLinks(markdown: string, ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0) return markdown;
  const removed = withoutEntries(markdown, ids, (entry) => entry.link);
  return removed === null ? markdown : withLinkText(removed, ids);
}

/**
 * `markdown` without the entries that NAME a withheld appendix: the list items
 * and table body rows that open with its designation, each removed as the whole
 * node the parser gives it. Nothing else is changed, and the result is never
 * longer than the input. Returned unchanged when the entries cannot be removed
 * without changing what is kept.
 */
export function presentWithheldAppendixEntries(markdown: string, ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0) return markdown;
  return withoutEntries(markdown, ids, (entry) => entry.naming) ?? markdown;
}

/**
 * `markdown` as a release that withholds the sections `ids` shows it: no entry
 * for them (a list item or a table body row that names a withheld appendix or is
 * a link to a withheld section), and every other link to them as its text. The
 * one presentation every reader surface uses. Returned unchanged, entries and
 * links included, when the entries cannot be removed without changing what is
 * kept: the builders then refuse it.
 */
export function presentWithheldSections(markdown: string, ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0) return markdown;
  const removed = withoutEntries(markdown, ids, () => true);
  return removed === null ? markdown : withLinkText(removed, ids);
}

/**
 * How many entries for the withheld sections `ids` a reader would still be SHOWN
 * in `markdown`: counted on the text as a whole and again on each piece of prose
 * the reader's renderer is handed (paperInlineSegments, the split PaperText draws
 * from), because that piece is what the renderer parses. The builders refuse
 * text for which this is not zero. A caller that hands the reader the text after
 * a further transform applies that transform BEFORE it presents and counts (the
 * builders strip the standalone section-anchor lines first).
 */
export function shownWithheldEntryCount(markdown: string, ids: readonly string[] | undefined): number {
  if (!ids || ids.length === 0) return 0;
  let shown = withheldEntryCounts(markdown, ids).total;
  for (const segment of paperInlineSegments(markdown)) {
    if (segment.kind === 'markdown') shown += withheldEntryCounts(segment.markdown, ids).total;
  }
  return shown;
}
