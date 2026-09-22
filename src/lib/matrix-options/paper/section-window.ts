import { buildPaperChunks } from './full-document';
import type { PaperChunk } from './full-document';
import type { RevisedPaperStructure } from '../revised-paper-structure';

/*
 * S1 incremental section window (L2 CP-M1-STRATEGIC-001).
 *
 * The Working Draft is served one depth-1 section at a time. A section group is
 * the contiguous run of buildPaperChunks chunks from one depth-1 heading up to
 * the next depth-1 heading (chunks before the first depth-1 heading, including
 * a preamble, join group 0). Groups tile the paper exactly, so the union of all
 * section contracts covers bytes 0..totalBytes with no gap or overlap.
 *
 * Pure and isomorphic: no server-only import, no fs, no crypto. The server page
 * and the section Route Handler build groups and contracts; client code only
 * resolves owning sections from the outline and validates fetched contracts.
 * Every byte offset is a UTF-8 byte offset into structure.content.
 */

export const PAPER_SECTION_CONTRACT_SCHEMA = 'matrix-paper-section-v1';
export const PAPER_SECTION_WINDOW_FAILURE_PREFIX = 'Paper section window unavailable: ';
export const PAPER_SECTION_CONTRACT_FAILURE_PREFIX = 'Invalid paper section contract: ';

export interface PaperSectionGroup {
  readonly index: number;
  /** Anchor of the group's depth-1 heading. */
  readonly anchor: string;
  readonly label: string;
  readonly startByte: number;
  readonly endByte: number;
  /** Chunk index range [chunkStart, chunkEnd) into the buildPaperChunks output. */
  readonly chunkStart: number;
  readonly chunkEnd: number;
  /** Anchors of every chunk in the group, in order (null for a preamble chunk). */
  readonly chunkAnchors: readonly (string | null)[];
}

export interface PaperSectionWindowModel {
  readonly chunks: readonly PaperChunk[];
  readonly groups: readonly PaperSectionGroup[];
  readonly totalBytes: number;
}

export interface PaperSectionIdentity {
  readonly documentVersion: string;
  readonly paperSha256: string;
}

export interface PaperSectionContractChunk {
  readonly id: string;
  readonly anchor: string | null;
  readonly depth: number | null;
  readonly label: string | null;
  readonly startByte: number;
  readonly endByte: number;
  readonly markdown: string;
}

export interface PaperSectionContract {
  readonly schema: typeof PAPER_SECTION_CONTRACT_SCHEMA;
  readonly documentVersion: string;
  readonly paperSha256: string;
  readonly index: number;
  readonly sectionCount: number;
  readonly anchor: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly chunks: readonly PaperSectionContractChunk[];
}

/** Client-safe section descriptor: no markdown and no byte offsets, only the section size. */
export interface PaperSectionSummary {
  readonly index: number;
  readonly anchor: string;
  readonly label: string;
  readonly bytes: number;
}

/** Minimal outline shape (document order) accepted by owningSectionIndex. */
export interface PaperSectionOutlineEntry {
  readonly anchor: string;
  readonly depth: number;
}

export interface PaperSectionContractExpectation extends PaperSectionIdentity {
  readonly index: number;
  readonly anchor: string;
  readonly sectionCount: number;
  /** When known (client descriptor), the contract range must span exactly this many bytes. */
  readonly bytes?: number;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

function fail(reason: string): never {
  throw new Error(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}${reason}`);
}

function invalid(reason: string): never {
  throw new Error(`${PAPER_SECTION_CONTRACT_FAILURE_PREFIX}${reason}`);
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

interface MutableGroup {
  anchor: string | null;
  label: string | null;
  startByte: number;
  chunkStart: number;
  chunkAnchors: (string | null)[];
}

/**
 * Buckets an exact chunk tiling by depth-1 boundary and proves the result:
 * groups are contiguous from 0 to totalBytes, every chunk lands in exactly one
 * group, and every group has a unique depth-1 anchor.
 */
export function buildPaperSectionGroupsFromChunks(chunks: readonly PaperChunk[], totalBytes: number): readonly PaperSectionGroup[] {
  if (chunks.length === 0) fail('no chunks');
  if (chunks[0].startByte !== 0) fail('chunks do not start at byte 0');
  for (let index = 1; index < chunks.length; index += 1) {
    if (chunks[index].startByte !== chunks[index - 1].endByte) fail(`chunk ${index} is not contiguous`);
  }
  if (chunks[chunks.length - 1].endByte !== totalBytes) fail('chunks do not end at the paper length');

  const groups: PaperSectionGroup[] = [];
  let current: MutableGroup | null = null;
  const close = (group: MutableGroup, chunkEnd: number, endByte: number) => {
    if (group.anchor === null || group.label === null) fail('a section group has no depth-1 heading');
    groups.push(Object.freeze({
      index: groups.length,
      anchor: group.anchor,
      label: group.label,
      startByte: group.startByte,
      endByte,
      chunkStart: group.chunkStart,
      chunkEnd,
      chunkAnchors: Object.freeze([...group.chunkAnchors]),
    }));
  };
  chunks.forEach((chunk, index) => {
    const isTop = chunk.depth === 1 && chunk.anchor !== null && chunk.label !== null;
    if (current === null) {
      current = { anchor: isTop ? chunk.anchor : null, label: isTop ? chunk.label : null, startByte: chunk.startByte, chunkStart: index, chunkAnchors: [] };
    } else if (isTop) {
      if (current.anchor === null) {
        current.anchor = chunk.anchor;
        current.label = chunk.label;
      } else {
        close(current, index, chunk.startByte);
        current = { anchor: chunk.anchor, label: chunk.label, startByte: chunk.startByte, chunkStart: index, chunkAnchors: [] };
      }
    }
    current.chunkAnchors.push(chunk.anchor);
  });
  if (current === null) fail('no chunks');
  close(current, chunks.length, totalBytes);

  // Proof of exact tiling and single membership.
  if (groups[0].startByte !== 0 || groups[0].chunkStart !== 0) fail('group 0 does not start the paper');
  const anchors = new Set<string>();
  let covered = 0;
  groups.forEach((group, index) => {
    if (index > 0 && (group.startByte !== groups[index - 1].endByte || group.chunkStart !== groups[index - 1].chunkEnd)) fail(`group ${index} is not contiguous`);
    if (group.chunkEnd <= group.chunkStart) fail(`group ${index} is empty`);
    if (chunks[group.chunkStart].startByte !== group.startByte || chunks[group.chunkEnd - 1].endByte !== group.endByte) fail(`group ${index} range does not match its chunks`);
    if (anchors.has(group.anchor)) fail(`duplicate section anchor ${group.anchor}`);
    anchors.add(group.anchor);
    covered += group.chunkEnd - group.chunkStart;
  });
  if (covered !== chunks.length || groups[groups.length - 1].chunkEnd !== chunks.length) fail('chunks are not each in exactly one group');
  if (groups[groups.length - 1].endByte !== totalBytes) fail('groups do not end at the paper length');
  return Object.freeze(groups);
}

export function buildPaperSectionGroups(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>): readonly PaperSectionGroup[] {
  return buildPaperSectionGroupsFromChunks(buildPaperChunks(structure), utf8ByteLength(structure.content));
}

const modelCache = new WeakMap<object, PaperSectionWindowModel>();

/** Chunks, groups and paper length, derived once per (process-cached) structure object. */
export function getPaperSectionWindowModel(structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>): PaperSectionWindowModel {
  const cached = modelCache.get(structure);
  if (cached) return cached;
  const chunks = buildPaperChunks(structure);
  const totalBytes = utf8ByteLength(structure.content);
  const model: PaperSectionWindowModel = Object.freeze({ chunks, groups: buildPaperSectionGroupsFromChunks(chunks, totalBytes), totalBytes });
  modelCache.set(structure, model);
  return model;
}

const groupIndexCache = new WeakMap<object, ReadonlyMap<string, number>>();

function isGroupList(source: readonly PaperSectionGroup[] | readonly PaperSectionOutlineEntry[]): source is readonly PaperSectionGroup[] {
  return source.length > 0 && 'chunkAnchors' in source[0];
}

/**
 * The depth-1 section index that owns an anchor of any depth, from either the
 * section groups or the document-order outline (a heading belongs to the most
 * recent depth-1 heading; headings before the first depth-1 heading belong to
 * group 0). Unknown anchors resolve to null.
 */
export function owningSectionIndex(source: readonly PaperSectionGroup[] | readonly PaperSectionOutlineEntry[], anchor: string): number | null {
  if (isGroupList(source)) {
    let byAnchor = groupIndexCache.get(source);
    if (!byAnchor) {
      const map = new Map<string, number>();
      for (const group of source) for (const chunkAnchor of group.chunkAnchors) if (chunkAnchor !== null) map.set(chunkAnchor, group.index);
      byAnchor = map;
      groupIndexCache.set(source, byAnchor);
    }
    return byAnchor.get(anchor) ?? null;
  }
  let index = -1;
  for (const entry of source) {
    if (entry.depth === 1) index += 1;
    if (entry.anchor === anchor) return Math.max(index, 0);
  }
  return null;
}

/** Version and authenticated paper SHA-256 that bind every section request and contract. */
export function paperSectionIdentity(structure: Pick<RevisedPaperStructure, 'manifest'>, documentVersion: string): PaperSectionIdentity {
  const paperSha256 = structure.manifest?.source?.sha256;
  if (typeof paperSha256 !== 'string' || !SHA256_HEX.test(paperSha256)) fail('paper SHA-256 is unavailable');
  return Object.freeze({ documentVersion, paperSha256 });
}

export function summarizePaperSections(groups: readonly PaperSectionGroup[]): readonly PaperSectionSummary[] {
  return Object.freeze(groups.map((group) => Object.freeze({ index: group.index, anchor: group.anchor, label: group.label, bytes: group.endByte - group.startByte })));
}

/** One depth-1 section as serializable data only (never JSX, never the whole paper). */
export function buildPaperSectionContract(
  structure: Pick<RevisedPaperStructure, 'content' | 'nodes'>,
  groups: readonly PaperSectionGroup[],
  index: number,
  identity: PaperSectionIdentity,
): PaperSectionContract {
  if (!Number.isInteger(index) || index < 0 || index >= groups.length) fail('section index out of range');
  const { chunks, totalBytes } = getPaperSectionWindowModel(structure);
  const group = groups[index];
  const selected = chunks.slice(group.chunkStart, group.chunkEnd);
  if (selected.length === 0 || selected[0].startByte !== group.startByte || selected[selected.length - 1].endByte !== group.endByte) fail('section groups do not match the structure');
  if (groups.length > 1 && group.startByte === 0 && group.endByte === totalBytes) fail('a section contract would span the whole paper');
  return Object.freeze({
    schema: PAPER_SECTION_CONTRACT_SCHEMA,
    documentVersion: identity.documentVersion,
    paperSha256: identity.paperSha256,
    index,
    sectionCount: groups.length,
    anchor: group.anchor,
    startByte: group.startByte,
    endByte: group.endByte,
    chunks: Object.freeze(selected.map((chunk) => Object.freeze({
      id: chunk.id,
      anchor: chunk.anchor,
      depth: chunk.depth,
      label: chunk.label,
      startByte: chunk.startByte,
      endByte: chunk.endByte,
      markdown: chunk.markdown,
    }))),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isByte(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Client-side check of a fetched section contract against what the client asked
 * for. Returns a fresh contract holding only the known fields, or throws an
 * Error prefixed with PAPER_SECTION_CONTRACT_FAILURE_PREFIX.
 */
export function validatePaperSectionContract(value: unknown, expected: PaperSectionContractExpectation): PaperSectionContract {
  if (!isRecord(value)) invalid('not an object');
  if (value.schema !== PAPER_SECTION_CONTRACT_SCHEMA) invalid('schema');
  if (value.documentVersion !== expected.documentVersion) invalid('document version');
  if (value.paperSha256 !== expected.paperSha256) invalid('paper SHA-256');
  if (value.index !== expected.index) invalid('section index');
  if (value.sectionCount !== expected.sectionCount) invalid('section count');
  if (value.anchor !== expected.anchor) invalid('section anchor');
  const { startByte, endByte, chunks } = value;
  if (!isByte(startByte) || !isByte(endByte) || endByte <= startByte) invalid('section range');
  if (expected.bytes !== undefined && endByte - startByte !== expected.bytes) invalid('section size');
  if (!Array.isArray(chunks) || chunks.length === 0) invalid('chunks');
  const seen = new Set<string>();
  let cursor = startByte;
  let owningHeadings = 0;
  const copies: PaperSectionContractChunk[] = chunks.map((chunk: unknown, position: number) => {
    if (!isRecord(chunk)) invalid(`chunk ${position} is not an object`);
    const { id, anchor, depth, label, markdown } = chunk;
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) invalid(`chunk ${position} id`);
    seen.add(id);
    if (anchor !== null && (typeof anchor !== 'string' || anchor.length === 0)) invalid(`chunk ${position} anchor`);
    if (depth !== null && (typeof depth !== 'number' || !Number.isInteger(depth) || depth < 1 || depth > 6)) invalid(`chunk ${position} depth`);
    if (label !== null && typeof label !== 'string') invalid(`chunk ${position} label`);
    if ((anchor === null) !== (depth === null) || (anchor === null) !== (label === null)) invalid(`chunk ${position} heading fields`);
    if (anchor === null && (position !== 0 || expected.index !== 0)) invalid(`chunk ${position} preamble position`);
    if (typeof markdown !== 'string') invalid(`chunk ${position} markdown`);
    if (!isByte(chunk.startByte) || !isByte(chunk.endByte) || chunk.startByte !== cursor || chunk.endByte < chunk.startByte) invalid(`chunk ${position} range`);
    if (utf8ByteLength(markdown) > chunk.endByte - chunk.startByte) invalid(`chunk ${position} markdown exceeds its range`);
    cursor = chunk.endByte;
    if (depth === 1 && anchor === expected.anchor) owningHeadings += 1;
    return Object.freeze({ id, anchor: anchor as string | null, depth: depth as number | null, label: label as string | null, startByte: chunk.startByte, endByte: chunk.endByte, markdown });
  });
  if (cursor !== endByte) invalid('chunks do not tile the section range');
  if (owningHeadings !== 1) invalid('section heading');
  return Object.freeze({
    schema: PAPER_SECTION_CONTRACT_SCHEMA,
    documentVersion: expected.documentVersion,
    paperSha256: expected.paperSha256,
    index: expected.index,
    sectionCount: expected.sectionCount,
    anchor: expected.anchor,
    startByte,
    endByte,
    chunks: Object.freeze(copies),
  });
}
