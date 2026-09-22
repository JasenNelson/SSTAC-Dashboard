import 'server-only';

import { createHash } from 'node:crypto';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import {
  loadRevisedPaper,
  REVISED_PAPER_BYTES,
  REVISED_PAPER_RELEASE_IDENTITY,
  REVISED_PAPER_RELATIVE_PATH,
  REVISED_PAPER_SHA256,
  REVISED_PAPER_VERSION,
  type RevisedPaperDescriptor,
} from './revised-paper';

export const REVISED_PAPER_STRUCTURE_SCHEMA_VERSION = 'matrix-paper-v16-structure-v1';
export const REVISED_PAPER_STRUCTURE_COMPILER_VERSION = '1';

export type StructureDomain =
  | 'node'
  | 'object.figure'
  | 'object.table'
  | 'object.equation'
  | 'question';

export type PublicationLens =
  | 'all'
  | 'core'
  | 'appendices'
  | 'evidence'
  | 'objects'
  | 'questions';

export const PUBLICATION_LENSES: readonly PublicationLens[] = Object.freeze([
  'all',
  'core',
  'appendices',
  'evidence',
  'objects',
  'questions',
]);

interface AstPosition {
  readonly start: { readonly offset?: number };
  readonly end: { readonly offset?: number };
}

interface AstNode {
  readonly type: string;
  readonly value?: string;
  readonly url?: string;
  readonly identifier?: string;
  readonly alt?: string;
  readonly depth?: number;
  readonly position?: AstPosition;
  readonly children?: readonly AstNode[];
}

export interface SourceRange {
  readonly startByte: number;
  readonly endByte: number;
}

export interface RevisedPaperNode extends SourceRange {
  readonly id: string;
  readonly domain: 'node';
  readonly kind: 'heading';
  readonly depth: number;
  readonly label: string;
  readonly parentId: string | null;
  readonly ancestorIds: readonly string[];
  readonly tokenEndByte: number;
  readonly anchor: string;
}

export interface RevisedPaperObject extends SourceRange {
  readonly id: string;
  readonly domain: 'object.figure' | 'object.table' | 'object.equation';
  readonly kind: 'image' | 'table' | 'math';
  readonly label: string;
  readonly ownerNodeId: string | null;
}

export interface RevisedPaperQuestion extends SourceRange {
  readonly id: string;
  readonly domain: 'question';
  readonly kind: 'heading' | 'paragraph' | 'listItem';
  readonly label: string;
  readonly containerNodeId: string;
  readonly ownerNodeId: string;
  readonly supportNodeIds: readonly string[];
}

export interface LensTrigger extends SourceRange {
  readonly type: 'heading' | 'link' | 'linkReference' | 'definition' | 'object' | 'question';
  readonly label: string;
  readonly target: string | null;
  readonly targetRange: SourceRange | null;
  readonly provenance: string;
}

export interface LinkDefinition extends SourceRange {
  readonly identifier: string;
  readonly target: string;
}

export interface LensPlacement extends SourceRange {
  readonly id: string;
  readonly domain: StructureDomain;
  readonly lens: PublicationLens;
  readonly label: string;
  readonly reason: string;
  readonly triggers: readonly LensTrigger[];
}

export interface RevisedPaperStructureManifest {
  readonly schemaVersion: typeof REVISED_PAPER_STRUCTURE_SCHEMA_VERSION;
  readonly compilerVersion: typeof REVISED_PAPER_STRUCTURE_COMPILER_VERSION;
  readonly source: {
    readonly path: typeof REVISED_PAPER_RELATIVE_PATH;
    readonly version: typeof REVISED_PAPER_VERSION;
    readonly releaseIdentity: typeof REVISED_PAPER_RELEASE_IDENTITY;
    readonly bytes: typeof REVISED_PAPER_BYTES;
    readonly sha256: typeof REVISED_PAPER_SHA256;
  };
  readonly parsers: readonly {
    readonly name: string;
    readonly version: string;
  }[];
  readonly counts: {
    readonly astBlocks: number;
    readonly headings: number;
    readonly coreNodes: number;
    readonly appendixNodes: number;
    readonly figureObjects: number;
    readonly tableObjects: number;
    readonly equationObjects: number;
    readonly questions: number;
    readonly questionContainers: number;
    readonly duplicateHeadings: number;
  };
  readonly lenses: Readonly<Record<PublicationLens, {
    readonly placements: number;
    readonly canonical: number;
    readonly orderedIdsSha256: string;
  }>>;
  readonly coverage: {
    readonly firstByte: 0;
    readonly lastByteExclusive: typeof REVISED_PAPER_BYTES;
  };
  readonly orderedIdsSha256: {
    readonly nodes: string;
    readonly objects: string;
    readonly questions: string;
  };
}

export interface RevisedPaperStructure {
  readonly releaseIdentity: typeof REVISED_PAPER_RELEASE_IDENTITY;
  readonly content: string;
  readonly lines: readonly SourceRange[];
  readonly nodes: readonly RevisedPaperNode[];
  readonly objects: readonly RevisedPaperObject[];
  readonly questions: readonly RevisedPaperQuestion[];
  readonly questionContainerIds: readonly string[];
  readonly lenses: Readonly<Record<PublicationLens, readonly LensPlacement[]>>;
  readonly manifest: RevisedPaperStructureManifest;
}

const BLOCK_TYPES = new Set([
  'blockquote',
  'code',
  'definition',
  'heading',
  'html',
  'list',
  'listItem',
  'math',
  'paragraph',
  'table',
  'tableCell',
  'tableRow',
  'thematicBreak',
]);

const EVIDENCE_HEADING_TOKEN = /(?:^|[^a-z0-9])(?:evidence|bibliography|references?|sources?)(?:$|[^a-z0-9])/i;
const QUESTION_HEADING_TOKEN = /(?:^|[^a-z0-9])questions?(?:$|[^a-z0-9])/i;
const QUESTION_HEADING_PHRASES = [
  'asked to decide',
  'asked to choose',
  'asked to test',
  'what the twg needs to choose',
] as const;

function fail(reason: string): never {
  throw new Error(`Authenticated revised-paper structure unavailable: ${reason}`);
}

export function lengthPrefix(value: string): string {
  return `${Buffer.byteLength(value, 'utf8')}#${value}`;
}

export function serializeCanonicalParts(parts: readonly string[]): string {
  return `${parts.length}:${parts.map(lengthPrefix).join('')}`;
}

export function createStructureId(
  domain: StructureDomain,
  releaseIdentity: string,
  kind: string,
  range: SourceRange,
  canonicalPathParts: readonly string[],
): string {
  const canonicalPath = serializeCanonicalParts(canonicalPathParts);
  const serialized = serializeCanonicalParts([
    'matrix-paper-v16-id-v1',
    domain,
    releaseIdentity,
    kind,
    String(range.startByte),
    String(range.endByte),
    canonicalPath,
  ]);
  return `${domain}:${createHash('sha256').update(serialized, 'utf8').digest('hex')}`;
}

function orderedIdsHash(ids: readonly string[]): string {
  return createHash('sha256')
    .update(serializeCanonicalParts(ids), 'utf8')
    .digest('hex');
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function utf8ByteMap(content: string): Uint32Array {
  const map = new Uint32Array(content.length + 1);
  let codeUnit = 0;
  let byte = 0;
  for (const symbol of content) {
    const codeUnits = symbol.length;
    const bytes = Buffer.byteLength(symbol, 'utf8');
    map[codeUnit] = byte;
    if (codeUnits === 2) map[codeUnit + 1] = byte;
    codeUnit += codeUnits;
    byte += bytes;
    map[codeUnit] = byte;
  }
  return map;
}

function exactAstRange(node: AstNode, content: string, byteMap: Uint32Array): SourceRange {
  const start = node.position?.start.offset;
  const rawEnd = node.position?.end.offset;
  if (start === undefined || rawEnd === undefined || start < 0 || rawEnd < start) {
    fail(`missing or invalid ${node.type} position`);
  }
  let end = rawEnd;
  if (content[end] === '\n') end += 1;
  const startByte = byteMap[start];
  const endByte = byteMap[end];
  if (startByte === undefined || endByte === undefined) fail(`non-boundary ${node.type} position`);
  return { startByte, endByte };
}

function plainText(node: AstNode): string {
  if (typeof node.value === 'string') return node.value;
  if (node.type === 'image') return node.alt ?? '';
  return (node.children ?? []).map(plainText).join('');
}

function walk(
  node: AstNode,
  visitor: (node: AstNode, parent: AstNode | null) => void,
  parent: AstNode | null = null,
): void {
  visitor(node, parent);
  for (const child of node.children ?? []) walk(child, visitor, node);
}

function githubAnchor(label: string, prior: Map<string, number>): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const seen = prior.get(base) ?? 0;
  prior.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen}`;
}

function normalizeQuestionHeading(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isQuestionContainer(label: string): boolean {
  const normalized = normalizeQuestionHeading(label);
  return QUESTION_HEADING_TOKEN.test(normalized)
    || QUESTION_HEADING_PHRASES.some((phrase) => normalized.includes(phrase));
}

function domainOrder(domain: StructureDomain): number {
  switch (domain) {
    case 'node': return 0;
    case 'object.figure': return 1;
    case 'object.table': return 2;
    case 'object.equation': return 3;
    case 'question': return 4;
  }
}

function placementOrder(a: LensPlacement, b: LensPlacement): number {
  return a.startByte - b.startByte
    || domainOrder(a.domain) - domainOrder(b.domain)
    || a.id.localeCompare(b.id, 'en');
}

export function findAppendixBoundary(
  nodes: readonly Pick<RevisedPaperNode, 'depth' | 'label'>[],
): number {
  const matches = nodes.reduce<number[]>((indexes, node, index) => {
    if (node.depth === 1 && node.label === 'Technical Appendices Compendium') indexes.push(index);
    return indexes;
  }, []);
  if (matches.length !== 1) fail(`expected exactly one appendix boundary, found ${matches.length}`);
  return matches[0];
}

export function resolveLinkTarget(
  link: { readonly type: string; readonly url?: string; readonly identifier?: string },
  definitions: ReadonlyMap<string, LinkDefinition>,
): { readonly target: string | null; readonly targetRange: SourceRange | null } {
  if (link.type === 'link') return { target: link.url ?? null, targetRange: null };
  if (!link.identifier) return { target: null, targetRange: null };
  const definition = definitions.get(link.identifier.trim().toLowerCase().replace(/\s+/g, ' '));
  return definition
    ? { target: definition.target, targetRange: definition }
    : { target: null, targetRange: null };
}

function lensSummary(placements: readonly LensPlacement[]) {
  const canonicalIds = [...new Set(placements.map((placement) => placement.id))];
  return {
    placements: placements.length,
    canonical: canonicalIds.length,
    orderedIdsSha256: orderedIdsHash(canonicalIds),
  };
}

export function compileRevisedPaperStructure(
  paper: RevisedPaperDescriptor,
): RevisedPaperStructure {
  if (paper.releaseIdentity !== REVISED_PAPER_RELEASE_IDENTITY) fail('release identity mismatch');
  if (paper.bytes !== REVISED_PAPER_BYTES || Buffer.byteLength(paper.content, 'utf8') !== REVISED_PAPER_BYTES) {
    fail('byte length mismatch');
  }
  const contentSha256 = createHash('sha256').update(paper.content, 'utf8').digest('hex');
  if (contentSha256 !== REVISED_PAPER_SHA256) fail('content SHA-256 mismatch');
  if (paper.content.includes('\r')) fail('CR is not permitted');

  const byteMap = utf8ByteMap(paper.content);
  if (byteMap[paper.content.length] !== REVISED_PAPER_BYTES) fail('UTF-8 byte map mismatch');

  const lines: SourceRange[] = [];
  let lineStart = 0;
  for (let offset = 0; offset < paper.content.length; offset += 1) {
    if (paper.content[offset] !== '\n') continue;
    lines.push({ startByte: byteMap[lineStart], endByte: byteMap[offset + 1] });
    lineStart = offset + 1;
  }
  if (lineStart < paper.content.length) {
    lines.push({ startByte: byteMap[lineStart], endByte: byteMap[paper.content.length] });
  }
  if (lines.length === 0 || lines[0].startByte !== 0 || lines.at(-1)?.endByte !== REVISED_PAPER_BYTES) {
    fail('physical line coverage mismatch');
  }
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index - 1].endByte !== lines[index].startByte) fail('physical line gap or overlap');
  }

  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(paper.content) as AstNode;
  const definitions = new Map<string, LinkDefinition>();
  walk(tree, (ast) => {
    if (ast.type !== 'definition' || !ast.identifier) return;
    const identifier = ast.identifier.trim().toLowerCase().replace(/\s+/g, ' ');
    if (definitions.has(identifier)) fail(`duplicate link definition ${ast.identifier}`);
    const target = ast.url;
    if (!target) fail(`link definition ${ast.identifier} has no target`);
    definitions.set(identifier, {
      identifier: ast.identifier,
      target,
      ...exactAstRange(ast, paper.content, byteMap),
    });
  });
  const headingAsts: AstNode[] = [];
  const allAsts: Array<{ node: AstNode; parent: AstNode | null }> = [];
  let astBlocks = 0;
  walk(tree, (node, parent) => {
    allAsts.push({ node, parent });
    if (BLOCK_TYPES.has(node.type)) astBlocks += 1;
    if (node.type === 'heading') headingAsts.push(node);
  });
  if (headingAsts.length === 0) fail('paper has no headings');

  const anchors = new Map<string, number>();
  const mutableNodes: Array<RevisedPaperNode & { ast: AstNode }> = [];
  const parentIndexes: number[] = [];
  const stack: number[] = [];
  for (let index = 0; index < headingAsts.length; index += 1) {
    const ast = headingAsts[index];
    const depth = ast.depth;
    if (!depth || depth < 1 || depth > 6) fail('invalid heading depth');
    while (stack.length > 0 && mutableNodes[stack.at(-1)!].depth >= depth) stack.pop();
    const parentIndex = stack.at(-1) ?? -1;
    if (parentIndex >= 0 && mutableNodes[parentIndex].depth >= depth) fail('invalid heading ancestry');
    parentIndexes.push(parentIndex);

    const tokenRange = exactAstRange(ast, paper.content, byteMap);
    let sectionEndByte = REVISED_PAPER_BYTES;
    for (let later = index + 1; later < headingAsts.length; later += 1) {
      const laterDepth = headingAsts[later].depth;
      if (!laterDepth) fail('invalid later heading depth');
      if (laterDepth <= depth) {
        sectionEndByte = exactAstRange(headingAsts[later], paper.content, byteMap).startByte;
        break;
      }
    }
    const label = plainText(ast);
    const ancestorIds = parentIndex < 0
      ? []
      : [...mutableNodes[parentIndex].ancestorIds, mutableNodes[parentIndex].id];
    const range = { startByte: tokenRange.startByte, endByte: sectionEndByte };
    const id = createStructureId('node', paper.releaseIdentity, 'heading', range, [...ancestorIds, label]);
    mutableNodes.push({
      id,
      domain: 'node',
      kind: 'heading',
      depth,
      label,
      parentId: parentIndex < 0 ? null : mutableNodes[parentIndex].id,
      ancestorIds,
      tokenEndByte: tokenRange.endByte,
      anchor: githubAnchor(label, anchors),
      ...range,
      ast,
    });
    stack.push(index);
  }

  const nodeIds = new Set<string>();
  for (const node of mutableNodes) {
    if (nodeIds.has(node.id)) fail('duplicate node ID');
    nodeIds.add(node.id);
  }

  const ownerForRange = (range: SourceRange): RevisedPaperNode | null => {
    let owner: RevisedPaperNode | null = null;
    for (const node of mutableNodes) {
      if (node.startByte <= range.startByte && range.startByte < node.endByte) {
        if (!owner || node.depth > owner.depth) owner = node;
      }
    }
    return owner;
  };

  const objects: RevisedPaperObject[] = [];
  walk(tree, (ast) => {
    let domain: RevisedPaperObject['domain'] | null = null;
    let kind: RevisedPaperObject['kind'] | null = null;
    let label = '';
    if (ast.type === 'image') {
      domain = 'object.figure'; kind = 'image'; label = ast.alt ?? '';
    } else if (ast.type === 'table') {
      domain = 'object.table'; kind = 'table'; label = paper.content.slice(ast.position?.start.offset, ast.position?.end.offset);
    } else if (ast.type === 'math') {
      domain = 'object.equation'; kind = 'math'; label = ast.value ?? '';
    }
    if (!domain || !kind) return;
    const range = exactAstRange(ast, paper.content, byteMap);
    const owner = ownerForRange(range);
    const pathParts = [...(owner?.ancestorIds ?? []), ...(owner ? [owner.id] : []), label];
    objects.push({
      id: createStructureId(domain, paper.releaseIdentity, kind, range, pathParts),
      domain,
      kind,
      label,
      ownerNodeId: owner?.id ?? null,
      ...range,
    });
  });

  const objectIds = new Set<string>();
  for (const object of objects) {
    if (objectIds.has(object.id)) fail('duplicate object ID');
    objectIds.add(object.id);
  }

  const anchorOwners = new Map(mutableNodes.map((node) => [node.anchor, node.id]));
  const questionContainers = mutableNodes.filter((node) => isQuestionContainer(node.label));
  const questions: RevisedPaperQuestion[] = [];
  const seenQuestionRanges = new Set<string>();
  for (const container of questionContainers) {
    for (const { node: ast, parent } of allAsts) {
      if (!['heading', 'paragraph', 'listItem'].includes(ast.type)) continue;
      if (ast.type === 'paragraph' && parent?.type === 'listItem') continue;
      const range = exactAstRange(ast, paper.content, byteMap);
      if (range.startByte < container.startByte || range.endByte > container.endByte) continue;
      const label = plainText(ast).trim();
      if (!label.endsWith('?')) continue;
      const rangeKey = `${range.startByte}:${range.endByte}`;
      if (seenQuestionRanges.has(rangeKey)) continue;
      seenQuestionRanges.add(rangeKey);
      const owner = ownerForRange(range);
      if (!owner) fail('question has no owning heading');
      const supportNodeIds = new Set<string>([container.id]);
      walk(ast, (descendant) => {
        if (!['link', 'linkReference'].includes(descendant.type)) return;
        const resolved = descendant.type === 'link' || descendant.type === 'linkReference'
          ? resolveLinkTarget(descendant, definitions)
          : { target: null, targetRange: null };
        const target = resolved.target;
        if (!target?.startsWith('#')) return;
        const resolvedOwner = anchorOwners.get(decodeURIComponent(target.slice(1)));
        if (resolvedOwner) supportNodeIds.add(resolvedOwner);
      });
      const pathParts = [...owner.ancestorIds, owner.id, label];
      questions.push({
        id: createStructureId('question', paper.releaseIdentity, ast.type, range, pathParts),
        domain: 'question',
        kind: ast.type as RevisedPaperQuestion['kind'],
        label,
        containerNodeId: container.id,
        ownerNodeId: owner.id,
        supportNodeIds: [...supportNodeIds],
        ...range,
      });
    }
  }

  const questionIds = new Set<string>();
  for (const question of questions) {
    if (questionIds.has(question.id)) fail('duplicate question ID');
    questionIds.add(question.id);
  }

  const appendixBoundary = findAppendixBoundary(mutableNodes);

  const toPlacement = (
    record: { id: string; domain: StructureDomain; label: string } & SourceRange,
    lens: PublicationLens,
    reason: string,
    trigger: LensTrigger,
  ): LensPlacement => ({
    id: record.id,
    domain: record.domain,
    lens,
    label: record.label,
    reason,
    triggers: [trigger],
    startByte: record.startByte,
    endByte: record.endByte,
  });
  const headingTrigger = (record: { label: string } & SourceRange): LensTrigger => ({
    type: 'heading',
    label: record.label,
    target: null,
    targetRange: null,
    provenance: 'heading',
    startByte: record.startByte,
    endByte: record.endByte,
  });
  const evidencePlacements: LensPlacement[] = [];
  for (const node of mutableNodes) {
    if (EVIDENCE_HEADING_TOKEN.test(node.label)) {
      evidencePlacements.push(toPlacement(
        node,
        'evidence',
        'evidence heading token',
        headingTrigger(node),
      ));
    }
  }
  walk(tree, (ast) => {
    if (!['link', 'linkReference', 'definition'].includes(ast.type)) return;
    const range = exactAstRange(ast, paper.content, byteMap);
    const owner = ownerForRange(range);
    if (!owner) return;
    const resolved = ast.type === 'link' || ast.type === 'linkReference'
      ? resolveLinkTarget(ast, definitions)
      : { target: ast.url ?? null, targetRange: null };
    const trigger: LensTrigger = {
      type: ast.type as LensTrigger['type'],
      label: plainText(ast),
      target: resolved.target,
      targetRange: resolved.targetRange,
      provenance: ast.type === 'linkReference' && resolved.targetRange
        ? `linkReference:${(resolved.targetRange as LinkDefinition).identifier}`
        : ast.type,
      ...range,
    };
    evidencePlacements.push(toPlacement(owner, 'evidence', 'supporting link or definition', trigger));
  });

  const nodeRecords: RevisedPaperNode[] = mutableNodes.map(({ ast: _ast, ...node }) => node);
  const lensPlacements: Record<PublicationLens, LensPlacement[]> = {
    all: nodeRecords.map((node) => toPlacement(node, 'all', 'canonical heading', headingTrigger(node))),
    core: nodeRecords
      .slice(0, appendixBoundary)
      .map((node) => toPlacement(node, 'core', 'heading before appendix boundary', headingTrigger(node))),
    appendices: nodeRecords
      .slice(appendixBoundary)
      .map((node) => toPlacement(node, 'appendices', 'appendix boundary or later heading', headingTrigger(node))),
    evidence: evidencePlacements.sort(placementOrder),
    objects: objects
      .map((object) => toPlacement(
        object,
        'objects',
        `${object.kind} AST object`,
        {
          type: 'object',
          label: object.label,
          target: null,
          targetRange: null,
          provenance: `${object.kind} AST node`,
          startByte: object.startByte,
          endByte: object.endByte,
        },
      ))
      .sort(placementOrder),
    questions: questions
      .map((question) => toPlacement(
        question,
        'questions',
        'atomic question block',
        {
          type: 'question',
          label: question.label,
          target: null,
          targetRange: null,
          provenance: 'question AST node',
          startByte: question.startByte,
          endByte: question.endByte,
        },
      ))
      .sort(placementOrder),
  };

  const headingLabels = new Map<string, number>();
  for (const node of nodeRecords) headingLabels.set(node.label, (headingLabels.get(node.label) ?? 0) + 1);
  const duplicateHeadings = [...headingLabels.values()].reduce(
    (count, occurrences) => count + Math.max(0, occurrences - 1),
    0,
  );
  const manifest: RevisedPaperStructureManifest = {
    schemaVersion: REVISED_PAPER_STRUCTURE_SCHEMA_VERSION,
    compilerVersion: REVISED_PAPER_STRUCTURE_COMPILER_VERSION,
    source: {
      path: REVISED_PAPER_RELATIVE_PATH,
      version: REVISED_PAPER_VERSION,
      releaseIdentity: REVISED_PAPER_RELEASE_IDENTITY,
      bytes: REVISED_PAPER_BYTES,
      sha256: REVISED_PAPER_SHA256,
    },
    parsers: [
      { name: 'remark-gfm', version: '4.0.1' },
      { name: 'remark-math', version: '6.0.0' },
      { name: 'remark-parse', version: '11.0.0' },
      { name: 'unified', version: '11.0.5' },
    ],
    counts: {
      astBlocks,
      headings: nodeRecords.length,
      coreNodes: lensPlacements.core.length,
      appendixNodes: lensPlacements.appendices.length,
      figureObjects: objects.filter((object) => object.domain === 'object.figure').length,
      tableObjects: objects.filter((object) => object.domain === 'object.table').length,
      equationObjects: objects.filter((object) => object.domain === 'object.equation').length,
      questions: questions.length,
      questionContainers: questionContainers.length,
      duplicateHeadings,
    },
    lenses: {
      all: lensSummary(lensPlacements.all),
      core: lensSummary(lensPlacements.core),
      appendices: lensSummary(lensPlacements.appendices),
      evidence: lensSummary(lensPlacements.evidence),
      objects: lensSummary(lensPlacements.objects),
      questions: lensSummary(lensPlacements.questions),
    },
    coverage: { firstByte: 0, lastByteExclusive: REVISED_PAPER_BYTES },
    orderedIdsSha256: {
      nodes: orderedIdsHash(nodeRecords.map((node) => node.id)),
      objects: orderedIdsHash(objects.map((object) => object.id)),
      questions: orderedIdsHash(questions.map((question) => question.id)),
    },
  };

  return deepFreeze({
    releaseIdentity: paper.releaseIdentity,
    content: paper.content,
    lines,
    nodes: nodeRecords,
    objects,
    questions,
    questionContainerIds: questionContainers.map((node) => node.id),
    lenses: lensPlacements,
    manifest,
  });
}

let cachedStructure: RevisedPaperStructure | undefined;

export function loadRevisedPaperStructure(): RevisedPaperStructure {
  if (!cachedStructure) cachedStructure = compileRevisedPaperStructure(loadRevisedPaper(REVISED_PAPER_VERSION));
  return cachedStructure;
}

export function resetRevisedPaperStructureCacheForTests(): void {
  cachedStructure = undefined;
}
