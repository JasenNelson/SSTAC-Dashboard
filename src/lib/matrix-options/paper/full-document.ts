import type { RevisedPaperNode, RevisedPaperStructure } from '../revised-paper-structure';

/*
 * Pure full-document helpers for the Working Draft reader.
 *
 * UNIT: every startByte/endByte in this module is a UTF-8 byte offset into
 * `structure.content`, identical to the unit used by the compiled
 * RevisedPaperStructure (revised-paper-structure.ts builds its ranges through a
 * UTF-8 byte map). Slicing into the JavaScript string therefore goes through a
 * byte -> UTF-16 code-unit conversion here; ranges are never code-unit offsets.
 *
 * No fs reads, no server-only imports: inputs are the already-authenticated
 * structure objects.
 */

export interface PaperOutlineEntry {
  readonly id: string;
  readonly anchor: string;
  readonly label: string;
  readonly depth: number;
  readonly parentId: string | null;
  readonly childIds: readonly string[];
  readonly startByte: number;
  readonly endByte: number;
}

export interface PaperChunk {
  readonly id: string;
  readonly nodeId: string | null;
  readonly anchor: string | null;
  readonly depth: number | null;
  readonly label: string | null;
  readonly startByte: number;
  readonly endByte: number;
  readonly markdown: string;
}

export const PREAMBLE_CHUNK_ID = 'preamble';

type NodeShape = Pick<RevisedPaperNode, 'id' | 'anchor' | 'label' | 'depth' | 'parentId' | 'startByte' | 'endByte'>;

// Same rule as STANDALONE_SECTION_ANCHOR_LINE in
// src/components/matrix-options/paper/RevisedPaperWorkspace.tsx (kept
// byte-identical so the reader and the full document strip exactly the same
// lines). Only whole standalone section-anchor div lines match; no other HTML.
const STANDALONE_SECTION_ANCHOR_LINE = /^[ \t]*<div[ \t]+id="[^"\r\n]+"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*(?:\r?\n|$)/gm;
// Capturing variant of the same rule (group 1 = the id value).
const STANDALONE_SECTION_ANCHOR_LINE_CAPTURE = /^[ \t]*<div[ \t]+id="([^"\r\n]+)"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*(?:\r?\n|$)/gm;

function fail(reason: string): never {
  throw new Error(`Paper full-document model unavailable: ${reason}`);
}

export function stripStandaloneSectionAnchorLines(markdown: string): string {
  return markdown.replace(STANDALONE_SECTION_ANCHOR_LINE, '');
}

const ATX_HEADING_PREFIX = /^( {0,3})(#{1,6})(?=[ \t]|$)/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Presentation-only heading demotion (M1-09): every ATX heading outside a
 * fenced code block moves down `offset` levels, capped at level 6, so the
 * rendered paper nests under the page's single h1. Only the marker length
 * changes; heading text and every other line are returned unchanged. The
 * release has no setext headings and no heading-like lines inside fences.
 */
export function demoteMarkdownHeadings(markdown: string, offset: number): string {
  if (!Number.isInteger(offset) || offset <= 0) return markdown;
  let fence: string | null = null;
  return markdown.split('\n').map((line) => {
    if (fence !== null) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return line;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      fence = open[1];
      return line;
    }
    const heading = ATX_HEADING_PREFIX.exec(line);
    if (!heading) return line;
    const level = Math.min(6, heading[2].length + offset);
    return `${heading[1]}${'#'.repeat(level)}${line.slice(heading[0].length)}`;
  }).join('\n');
}

/**
 * ATX heading levels (1-6) outside fenced code blocks, in document order. Same
 * line rules as demoteMarkdownHeadings, so the levels are exactly the ones it
 * would shift.
 */
export function markdownHeadingLevels(markdown: string): number[] {
  const levels: number[] = [];
  let fence: string | null = null;
  for (const line of markdown.split('\n')) {
    if (fence !== null) {
      const close = FENCE_CLOSE.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      fence = open[1];
      continue;
    }
    const heading = ATX_HEADING_PREFIX.exec(line);
    if (heading) levels.push(heading[2].length);
  }
  return levels;
}

/** codeUnitToByte[i] = UTF-8 byte offset of UTF-16 code unit i (length + 1 entries). */
function utf8ByteMap(content: string): Uint32Array {
  const map = new Uint32Array(content.length + 1);
  let byte = 0;
  for (let unit = 0; unit < content.length; unit += 1) {
    map[unit] = byte;
    const code = content.charCodeAt(unit);
    if (code < 0x80) byte += 1;
    else if (code < 0x800) byte += 2;
    else if (code >= 0xd800 && code <= 0xdbff && unit + 1 < content.length) {
      const next = content.charCodeAt(unit + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        map[unit + 1] = byte;
        unit += 1;
        byte += 4;
      } else {
        byte += 3;
      }
    } else byte += 3;
  }
  map[content.length] = byte;
  return map;
}

/** Lowest code-unit index whose byte offset equals `byte`; fails on a non-boundary offset. */
function byteToCodeUnit(map: Uint32Array, byte: number): number {
  let low = 0;
  let high = map.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (map[mid] < byte) low = mid + 1;
    else high = mid;
  }
  if (map[low] !== byte) fail(`byte offset ${byte} is not a UTF-8 character boundary`);
  return low;
}

function assertOrderedNodes(nodes: readonly NodeShape[], totalBytes: number): void {
  let previous = -1;
  for (const node of nodes) {
    if (!Number.isInteger(node.startByte) || !Number.isInteger(node.endByte)) fail('non-integer node range');
    if (node.startByte < 0 || node.endByte > totalBytes || node.endByte < node.startByte) fail(`node range out of bounds ${node.id}`);
    if (node.startByte <= previous) fail('nodes are not in strictly increasing document order');
    previous = node.startByte;
  }
}

export function buildPaperOutline(structure: Pick<RevisedPaperStructure, 'nodes'>): readonly PaperOutlineEntry[] {
  const children = new Map<string, string[]>();
  const ids = new Set<string>();
  for (const node of structure.nodes) {
    if (ids.has(node.id)) fail(`duplicate node id ${node.id}`);
    ids.add(node.id);
  }
  for (const node of structure.nodes) {
    if (node.parentId === null) continue;
    if (!ids.has(node.parentId)) fail(`unknown parent ${node.parentId}`);
    const list = children.get(node.parentId) ?? [];
    list.push(node.id);
    children.set(node.parentId, list);
  }
  return Object.freeze(structure.nodes.map((node) => Object.freeze({
    id: node.id,
    anchor: node.anchor,
    label: node.label,
    depth: node.depth,
    parentId: node.parentId,
    childIds: Object.freeze([...(children.get(node.id) ?? [])]),
    startByte: node.startByte,
    endByte: node.endByte,
  })));
}

/**
 * Tiles the whole content: an optional preamble chunk for bytes before the
 * first heading, then one chunk per heading from its start to the next
 * heading's start (the last heading runs to the end of content). Heading chunk
 * id = the heading node id. markdown = raw range text with only standalone
 * section-anchor div lines removed.
 */
export function buildPaperChunks(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>): readonly PaperChunk[] {
  const { content, nodes } = structure;
  const map = utf8ByteMap(content);
  const totalBytes = map[content.length];
  assertOrderedNodes(nodes, totalBytes);
  const slice = (startByte: number, endByte: number): string => content.slice(byteToCodeUnit(map, startByte), byteToCodeUnit(map, endByte));
  const chunks: PaperChunk[] = [];
  const firstStart = nodes.length > 0 ? nodes[0].startByte : totalBytes;
  if (firstStart > 0) {
    chunks.push(Object.freeze({
      id: PREAMBLE_CHUNK_ID,
      nodeId: null,
      anchor: null,
      depth: null,
      label: null,
      startByte: 0,
      endByte: firstStart,
      markdown: stripStandaloneSectionAnchorLines(slice(0, firstStart)),
    }));
  }
  nodes.forEach((node, index) => {
    const endByte = index + 1 < nodes.length ? nodes[index + 1].startByte : totalBytes;
    chunks.push(Object.freeze({
      id: node.id,
      nodeId: node.id,
      anchor: node.anchor,
      depth: node.depth,
      label: node.label,
      startByte: node.startByte,
      endByte,
      markdown: stripStandaloneSectionAnchorLines(slice(node.startByte, endByte)),
    }));
  });
  return Object.freeze(chunks);
}

export function sectionAnchorSet(structure: Pick<RevisedPaperStructure, 'nodes'>): ReadonlySet<string> {
  return new Set(structure.nodes.map((node) => node.anchor));
}

function leadingSectionNumber(label: string): string | null {
  const match = /^\s*(\d{1,2}(?:\.\d{1,2})*)(?:\.?(?:\s|$)|:)/.exec(label);
  return match ? match[1] : null;
}

/**
 * Maps legacy standalone `<div id="X" class="section-anchor"></div>` ids to
 * the anchor of the heading node the div belongs to.
 *
 * Rule (only unambiguous mappings are emitted):
 * 1. The target is the next heading node whose startByte is at or after the
 *    end of the div line.
 * 2. The mapping is accepted when the bytes between the div line and that
 *    heading are only whitespace and/or other standalone section-anchor div
 *    lines (the div directly labels the heading).
 * 3. Otherwise (other content sits between the div and the heading) the
 *    mapping is accepted only when X has the numeric form `sec-N-N...` or
 *    `app-N-N...` and the heading label starts with exactly the dotted number
 *    N.N... (for example sec-10-2 -> a heading starting "10.2 ").
 * 4. An id that resolves to different anchors at different occurrences is
 *    dropped. An id that is itself an existing heading anchor is dropped
 *    unless it maps to itself. Ids with no following heading are dropped.
 */
export function buildLegacyAnchorMap(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>): Readonly<Record<string, string>> {
  const { content, nodes } = structure;
  const map = utf8ByteMap(content);
  const totalBytes = map[content.length];
  assertOrderedNodes(nodes, totalBytes);
  const anchors = sectionAnchorSet(structure);
  const resolved = new Map<string, string | null>();
  for (const match of content.matchAll(STANDALONE_SECTION_ANCHOR_LINE_CAPTURE)) {
    const id = match[1];
    const lineEndUnit = (match.index ?? 0) + match[0].length;
    const lineEndByte = map[lineEndUnit];
    const target = nodes.find((node) => node.startByte >= lineEndByte);
    let anchor: string | null = null;
    if (target) {
      const between = content.slice(lineEndUnit, byteToCodeUnit(map, target.startByte));
      if (stripStandaloneSectionAnchorLines(between).trim() === '') {
        anchor = target.anchor;
      } else {
        const numeric = /^(?:sec|app)-(\d{1,2}(?:-\d{1,2})*)$/.exec(id);
        if (numeric && leadingSectionNumber(target.label) === numeric[1].replace(/-/g, '.')) anchor = target.anchor;
      }
    }
    if (anchor !== null && anchors.has(id) && anchor !== id) anchor = null;
    if (!resolved.has(id)) resolved.set(id, anchor);
    else if (resolved.get(id) !== anchor) resolved.set(id, null);
  }
  // Object.fromEntries defines own data properties, so an id such as
  // "__proto__" cannot mutate the result's prototype.
  const entries = [...resolved].filter((entry): entry is [string, string] => entry[1] !== null);
  return Object.freeze(Object.fromEntries(entries));
}
