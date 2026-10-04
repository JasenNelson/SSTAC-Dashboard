import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

/*
 * The ONE Markdown parse of paper text.
 *
 * The reader draws paper Markdown through react-markdown with remark-gfm and
 * remark-math (components/MathRenderer.tsx); react-markdown parses with
 * remark-parse. This module builds that same parser once, so every rule that has
 * to know where a block of the paper begins and ends (the structure compiler, the
 * presentation of a withheld section) reads the tree the reader's renderer reads,
 * and never a line-by-line approximation of it.
 *
 * Pure and isomorphic: no fs, no crypto, no server-only import.
 */

export interface MarkdownPoint {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
}

/** A node of the parsed tree (mdast), with the members the paper rules read. */
export interface MarkdownNode {
  readonly type: string;
  readonly value?: string;
  readonly url?: string;
  readonly alt?: string | null;
  readonly ordered?: boolean | null;
  readonly start?: number | null;
  readonly spread?: boolean | null;
  readonly children?: readonly MarkdownNode[];
  readonly position?: { readonly start: MarkdownPoint; readonly end: MarkdownPoint };
}

/** The plugins of the parse, in order: the ones MathRenderer hands to react-markdown. */
export const PAPER_MARKDOWN_PLUGINS = Object.freeze(['remark-gfm', 'remark-math'] as const);

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath).freeze();

/** `markdown` as the reader's renderer parses it. Offsets are UTF-16 offsets into `markdown`. */
export function parsePaperMarkdown(markdown: string): MarkdownNode {
  return parser.parse(markdown) as unknown as MarkdownNode;
}

/** Depth-first, in document order; `ancestors` runs from the root to the parent of `node`. */
export function walkMarkdown(node: MarkdownNode, visit: (node: MarkdownNode, ancestors: readonly MarkdownNode[]) => void, ancestors: readonly MarkdownNode[] = []): void {
  visit(node, ancestors);
  if (!node.children) return;
  const below = [...ancestors, node];
  for (const child of node.children) walkMarkdown(child, visit, below);
}

/** The text a node shows: its own value, an image's alternative text, or its children's text joined. */
export function markdownNodeText(node: MarkdownNode): string {
  if (typeof node.value === 'string') return node.value;
  if (node.type === 'image' && typeof node.alt === 'string') return node.alt;
  return (node.children ?? []).map(markdownNodeText).join('');
}

/** The UTF-16 range of a node in the text it was parsed from, or null for a node the parser gave no position. */
export function markdownNodeRange(node: MarkdownNode): { readonly start: number; readonly end: number } | null {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return typeof start === 'number' && typeof end === 'number' && end >= start ? { start, end } : null;
}
