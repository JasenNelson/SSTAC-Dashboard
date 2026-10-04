/*
 * Presentation of pandoc-flavoured source constructs (the R5 working draft).
 *
 * The R5 Markdown was built for pandoc and carries three constructs that the
 * reader's CommonMark/GFM pipeline does not understand:
 *
 *   1. a YAML front-matter block (title, subtitle, author, date, lang);
 *   2. fenced divs (`::: {.draft-label}` ... `:::`);
 *   3. empty anchor spans (`[]{#fig-6-1}`, `[]{#tbl-2}`).
 *
 * Read literally, the front matter becomes a thematic break followed by a
 * setext heading made of the YAML lines, and the other two show as raw
 * markers. The paper bytes are never changed: these helpers only decide how an
 * already-authenticated range is PARSED (maskFrontMatter) and SHOWN
 * (presentPreambleMarkdown, stripPandocAnchorSpans). Every transform removes
 * or replaces text with something no longer than the source, so a presented
 * chunk never exceeds the byte range it was cut from.
 *
 * Pure and isomorphic: no fs, no crypto, no server-only import.
 */

export interface PaperSourcePresentation {
  /** The source opens with a YAML front-matter block that is shown as a title block. */
  readonly frontMatter: boolean;
  /**
   * Stable section ids of a withheld range (releases.ts `withheld`). An entry for one
   * of them (a list item that is a link to it or that names a withheld appendix: its
   * line in a contents list or in a list of the appendices) is not shown at all; any
   * other link to one of them is shown as its text, never as a link
   * (withheld-sections.ts presentWithheldSections).
   */
  readonly inactiveLinkTargets?: readonly string[];
  /** What the exact contents heading is shown as in this release (releases.ts `contentsHeadingDisplay`). */
  readonly contentsHeadingDisplay?: string;
}

export interface PaperFrontMatter {
  /** UTF-16 length of the block, including the closing `---` line and its newline. */
  readonly length: number;
  readonly fields: Readonly<Record<string, string>>;
}

const FRONT_MATTER_FENCE = '---';
const FRONT_MATTER_FIELD = /^([a-z][a-z0-9_-]*): (?:"([^"\\]*)"|([^"'\s][^\r\n]*?))[ \t]*$/;

/**
 * The front-matter block at the very start of `content`, or null when there is
 * none or it is not the simple `key: value` / `key: "value"` shape (no nested
 * YAML, no escapes). A block this function does not recognise is left alone.
 */
export function parseFrontMatter(content: string): PaperFrontMatter | null {
  if (!content.startsWith(`${FRONT_MATTER_FENCE}\n`)) return null;
  const fields: Record<string, string> = {};
  let offset = FRONT_MATTER_FENCE.length + 1;
  for (;;) {
    const lineEnd = content.indexOf('\n', offset);
    if (lineEnd < 0) return null;
    const line = content.slice(offset, lineEnd);
    offset = lineEnd + 1;
    if (line === FRONT_MATTER_FENCE) break;
    const field = FRONT_MATTER_FIELD.exec(line);
    if (!field || Object.prototype.hasOwnProperty.call(fields, field[1])) return null;
    fields[field[1]] = field[2] ?? field[3];
  }
  if (Object.keys(fields).length === 0) return null;
  return { length: offset, fields: Object.freeze(fields) };
}

/**
 * `content` with every character of its front-matter block except line breaks
 * replaced by a space. Same length, same line breaks, so every offset a
 * Markdown parser reports is still an offset into the real source; the block
 * itself parses as blank lines instead of a heading.
 */
export function maskFrontMatter(content: string): string {
  const frontMatter = parseFrontMatter(content);
  if (!frontMatter) return content;
  return `${content.slice(0, frontMatter.length).replace(/[^\n]/g, ' ')}${content.slice(frontMatter.length)}`;
}

/** The title block shown in place of the front matter: only fields the source carries. */
export function frontMatterTitleBlock(fields: Readonly<Record<string, string>>): string {
  const lines: string[] = [];
  if (fields.title) lines.push(`# ${fields.title}`, '');
  if (fields.subtitle) lines.push(`**${fields.subtitle}**`, '');
  const byline = [fields.author, fields.date].filter((value): value is string => Boolean(value));
  // A trailing backslash is a hard line break, so author and date sit on two lines of one paragraph.
  if (byline.length > 0) lines.push(byline.join('\\\n'), '');
  return lines.join('\n');
}

const FENCED_DIV_OPEN = /^:::[ \t]*\{\.[A-Za-z][A-Za-z0-9_-]*\}[ \t]*$/;
const FENCED_DIV_CLOSE = /^:::[ \t]*$/;

/**
 * Fenced divs become block quotes: the two fence lines are dropped and each
 * line between them is quoted. Only a complete open/close pair is touched; an
 * unmatched fence line is returned unchanged.
 */
export function presentFencedDivs(markdown: string): string {
  if (!markdown.includes(':::')) return markdown;
  const lines = markdown.split('\n');
  const result: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (FENCED_DIV_OPEN.test(lines[index])) {
      const close = lines.findIndex((line, position) => position > index && FENCED_DIV_CLOSE.test(line));
      if (close > index) {
        for (let inner = index + 1; inner < close; inner += 1) result.push(lines[inner] === '' ? '>' : `> ${lines[inner]}`);
        index = close + 1;
        continue;
      }
    }
    result.push(lines[index]);
    index += 1;
  }
  return result.join('\n');
}

const PANDOC_ANCHOR_SPAN = /\[\]\{#([A-Za-z][A-Za-z0-9_-]*)\}/g;

/** Masks trailing Pandoc heading attributes for parsing without changing source offsets. */
export function maskPandocHeadingAttributes(markdown: string): string {
  return markdown.replace(/^(#{1,6} .+?) \{#[A-Za-z][A-Za-z0-9_-]*(?: \.[A-Za-z][A-Za-z0-9_-]*)*\}[ \t]*$/gm, (line, heading: string) => `${heading}${' '.repeat(line.length - heading.length)}`);
}

/** Removes empty Pandoc anchors and trailing heading attributes from presented Markdown. */
export function stripPandocAnchorSpans(markdown: string): string {
  const withoutAnchors = markdown.includes('[]{#') ? markdown.replace(PANDOC_ANCHOR_SPAN, '') : markdown;
  return withoutAnchors.replace(/^(#{1,6} .+?) \{#[A-Za-z][A-Za-z0-9_-]*(?: \.[A-Za-z][A-Za-z0-9_-]*)*\}[ \t]*$/gm, '$1');
}

/** The ids of every empty pandoc anchor span, with the UTF-16 offset each one starts at. */
export function pandocAnchorSpans(content: string): readonly { readonly id: string; readonly offset: number }[] {
  if (!content.includes('[]{#')) return [];
  return Array.from(content.matchAll(PANDOC_ANCHOR_SPAN), (match) => ({ id: match[1], offset: match.index ?? 0 }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Masks fenced and inline code without shifting any source offsets. */
function maskMarkdownCode(markdown: string): string {
  const chars = markdown.split('');
  let offset = 0;
  let fence: { readonly char: string; readonly length: number } | null = null;
  const mask = (start: number, end: number) => {
    for (let index = start; index < end; index += 1) if (chars[index] !== '\n') chars[index] = ' ';
  };
  for (const line of markdown.split(/(?<=\n)/)) {
    const start = offset;
    const end = start + line.length;
    const text = line.replace(/\n$/, '');
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(text);
    if (fence) {
      mask(start, end);
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && new RegExp(`^ {0,3}${fence.char === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`).test(text)) fence = null;
    } else if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
      mask(start, end);
    }
    offset = end;
  }
  const outsideFences = chars.join('');
  const codeSpan = /(`+)([\s\S]*?)\1/g;
  for (const match of outsideFences.matchAll(codeSpan)) {
    const start = match.index ?? 0;
    mask(start, start + match[0].length);
  }
  return chars.join('');
}

/**
 * The ONE rule for a link into a withheld section: a simple inline link
 * `[text](#id)` whose target is exactly `id`, with no title, no angle brackets
 * and no brackets or line break in its text. Used both to count such links
 * (inactiveLinkAudit) and to show them as text (presentInactiveLinkText), so the
 * two can never disagree. No lookbehind: this module reaches the browser, and an image
 * (`![alt](#id)`) is excluded by looking at the character before the match.
 */
function simpleInlineLinks(markdown: string, id: string): readonly { readonly index: number; readonly length: number; readonly text: string }[] {
  const searchable = maskMarkdownCode(markdown);
  const pattern = new RegExp(`\\[([^\\[\\]\\r\\n]*)\\]\\(#${escapeRegExp(id)}\\)`, 'g');
  return Array.from(searchable.matchAll(pattern))
    .filter((match) => (match.index ?? 0) === 0 || markdown[(match.index ?? 0) - 1] !== '!')
    .map((match) => {
      const index = match.index ?? 0;
      const source = markdown.slice(index, index + match[0].length);
      return { index, length: match[0].length, text: source.slice(1, source.indexOf(']')) };
    });
}

/**
 * How `markdown` refers to one withheld stable id: `tokens` counts every literal
 * `#id` not followed by another id character, `links` counts the simple inline
 * links presentInactiveLinkText rewrites. Equal counts mean every literal
 * reference is a link that will be shown as plain text or removed with its entry.
 */
export function inactiveLinkAudit(markdown: string, id: string): { readonly tokens: number; readonly links: number } {
  const tokens = Array.from(maskMarkdownCode(markdown).matchAll(new RegExp(`#${escapeRegExp(id)}(?![A-Za-z0-9_-])`, 'g'))).length;
  return { tokens, links: simpleInlineLinks(markdown, id).length };
}

/**
 * `markdown` with every simple inline link to one of `ids` (the ONE rule above)
 * shown as its link text. Nothing else is changed, and the result is never
 * longer than the input. Which ENTRIES for a withheld section are not shown at
 * all is decided on the parsed tree, in withheld-sections.ts; this is only the
 * rule for the links that remain.
 */
export function presentInactiveLinkText(markdown: string, ids: readonly string[] | undefined): string {
  if (!ids || ids.length === 0 || !markdown.includes('](#')) return markdown;
  let result = markdown;
  for (const id of ids) {
    const links = simpleInlineLinks(result, id);
    if (links.length === 0) continue;
    let rebuilt = '';
    let cursor = 0;
    for (const link of links) {
      rebuilt += result.slice(cursor, link.index) + link.text;
      cursor = link.index + link.length;
    }
    result = rebuilt + result.slice(cursor);
  }
  return result;
}

/**
 * The preamble (everything before the first heading) as it is shown: the front
 * matter as a title block, fenced divs as block quotes. Returns the input
 * unchanged when the release has no front matter to present.
 */
export function presentPreambleMarkdown(markdown: string, presentation: PaperSourcePresentation | undefined): string {
  if (!presentation?.frontMatter) return markdown;
  const frontMatter = parseFrontMatter(markdown);
  const body = frontMatter ? `${frontMatterTitleBlock(frontMatter.fields)}${markdown.slice(frontMatter.length)}` : markdown;
  return presentFencedDivs(body);
}
