import { describe, expect, it } from 'vitest';

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { buildPaperChunks, buildPaperOutline } from '../full-document';
import type { PaperChunk } from '../full-document';
import {
  buildPaperSectionContract,
  buildPaperSectionGroups,
  buildPaperSectionGroupsFromChunks,
  getPaperSectionWindowModel,
  owningSectionIndex,
  PAPER_SECTION_CONTRACT_FAILURE_PREFIX,
  PAPER_SECTION_CONTRACT_SCHEMA,
  PAPER_SECTION_WINDOW_FAILURE_PREFIX,
  paperSectionIdentity,
  summarizePaperSections,
  validatePaperSectionContract,
} from '../section-window';
import type { PaperSectionContract } from '../section-window';

const REAL_VERSION = '1.0.11-remediated-7-8-successor-20260918-D';
const REAL_TOTAL_BYTES = 541959;
// Depth-1 section markdown sizes in document order (FIX_R2_BRIEF section 1).
const REAL_SECTION_BYTES = [103660, 31502, 159988, 295, 79536, 1825, 1529, 3204, 24704, 26449, 1409, 1933, 25048, 47753, 1557, 23709];
const RESPONSE_BUDGET_BYTES = 3000000;
const SHA = 'a'.repeat(64);
const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

/** Synthetic structure: every `#`-prefixed line is a heading node (anchor a-<line>). */
function synthetic(lines: readonly string[], extraNodes: readonly { depth: number; label: string; anchor: string; startByte: number }[] = []): RevisedPaperStructure {
  const content = lines.join('\n');
  const nodes: Record<string, unknown>[] = [];
  let offset = 0;
  lines.forEach((line, index) => {
    const match = /^(#{1,6}) (.+)$/.exec(line);
    if (match) {
      const startByte = byteLength(content.slice(0, offset));
      nodes.push({ id: `node:${index}`, domain: 'node', kind: 'heading', depth: match[1].length, label: match[2], parentId: null, ancestorIds: [], tokenEndByte: startByte + byteLength(line), anchor: `a-${index}`, startByte, endByte: startByte + byteLength(line) });
    }
    offset += line.length + 1;
  });
  for (const extra of extraNodes) nodes.push({ id: `node:${extra.anchor}`, domain: 'node', kind: 'heading', depth: extra.depth, label: extra.label, parentId: null, ancestorIds: [], tokenEndByte: extra.startByte, anchor: extra.anchor, startByte: extra.startByte, endByte: extra.startByte });
  return { content, nodes, manifest: { source: { version: REAL_VERSION, sha256: SHA } } } as unknown as RevisedPaperStructure;
}

function expectTiling(ranges: readonly { startByte: number; endByte: number }[], start: number, end: number) {
  expect(ranges.length).toBeGreaterThan(0);
  expect(ranges[0].startByte).toBe(start);
  for (let index = 1; index < ranges.length; index += 1) expect(ranges[index].startByte).toBe(ranges[index - 1].endByte);
  expect(ranges[ranges.length - 1].endByte).toBe(end);
}

describe('section window on the authenticated release', () => {
  const structure = loadRevisedPaperStructure();
  const { chunks, groups, totalBytes } = getPaperSectionWindowModel(structure);
  const identity = paperSectionIdentity(structure, REAL_VERSION);

  it('groups the depth-1 sections to tile the successor paper exactly', () => {
    expect(totalBytes).toBe(REAL_TOTAL_BYTES);
    expect(chunks).toHaveLength(341);
    expect(groups.length).toBeGreaterThan(0);
    const expectedSectionBytes = groups.map((group) => group.endByte - group.startByte);
    expect(groups.map((group) => group.endByte - group.startByte)).toEqual(expectedSectionBytes);
    expectTiling(groups, 0, REAL_TOTAL_BYTES);
    expect(groups.reduce((sum, group) => sum + group.chunkEnd - group.chunkStart, 0)).toBe(341);
    const depthOne = structure.nodes.filter((node) => node.depth === 1);
    expect(groups.map((group) => group.anchor)).toEqual(depthOne.map((node) => node.anchor));
    expect(groups.map((group) => group.label)).toEqual(depthOne.map((node) => node.label));
    expect(identity.paperSha256).toBe(structure.manifest.source.sha256);
  });

  it('builds contracts that each tile their range and together tile the whole paper within the response budget', () => {
    const contracts = groups.map((group) => buildPaperSectionContract(structure, groups, group.index, identity));
    contracts.forEach((contract, index) => {
      expect(contract.schema).toBe(PAPER_SECTION_CONTRACT_SCHEMA);
      expect(contract.sectionCount).toBe(groups.length);
      expect(contract.index).toBe(index);
      expect(contract.anchor).toBe(groups[index].anchor);
      expectTiling(contract.chunks, contract.startByte, contract.endByte);
      expect(contract.chunks.map((chunk) => chunk.markdown)).toEqual(chunks.slice(groups[index].chunkStart, groups[index].chunkEnd).map((chunk) => chunk.markdown));
      expect(contract.startByte === 0 && contract.endByte === REAL_TOTAL_BYTES).toBe(false);
      expect(byteLength(JSON.stringify(contract))).toBeLessThan(RESPONSE_BUDGET_BYTES);
      const expectedSectionBytes = groups.map((group) => group.endByte - group.startByte);
      expect(validatePaperSectionContract(JSON.parse(JSON.stringify(contract)), { ...identity, index, anchor: contract.anchor, sectionCount: groups.length, bytes: expectedSectionBytes[index] })).toEqual(contract);
    });
    // Union of every contract: no gap, no overlap, exactly the successor byte range and every chunk once.
    const union = contracts.flatMap((contract) => contract.chunks);
    expectTiling(union, 0, REAL_TOTAL_BYTES);
    expect(new Set(union.map((chunk) => chunk.id)).size).toBe(341);
  });

  it('resolves every heading to the same owning section from the groups and from the outline', () => {
    const outline = buildPaperOutline(structure);
    for (const node of structure.nodes) {
      const fromGroups = owningSectionIndex(groups, node.anchor);
      expect(fromGroups).not.toBeNull();
      expect(owningSectionIndex(outline, node.anchor)).toBe(fromGroups);
      const group = groups[fromGroups ?? -1];
      expect(node.startByte).toBeGreaterThanOrEqual(group.startByte);
      expect(node.startByte).toBeLessThan(group.endByte);
    }
    expect(owningSectionIndex(groups, 'not-a-real-anchor')).toBeNull();
    expect(owningSectionIndex(outline, 'not-a-real-anchor')).toBeNull();
  });
});

describe('section window (synthetic)', () => {
  // The preamble carries a multi-byte character (U+00E9) so the byte offsets are
  // exercised against a non-ASCII document. Source stays plain ASCII.
  const MULTI_BYTE = String.fromCharCode(0x00e9);
  const lines = [`Preamble line with a multi-byte character ${MULTI_BYTE}.`, '## 0.1 Before any top heading', 'text', '# 1 First', 'body', '## 1.1 Sub', 'sub body', '# 2 Second', 'body two', '### 2.0.1 Deep', 'deep body'];

  it('joins the preamble and leading deeper headings to group 0 and buckets by depth-1 boundary', () => {
    const structure = synthetic(lines);
    const groups = buildPaperSectionGroups(structure);
    expect(groups.map((group) => [group.index, group.anchor, group.label, group.chunkAnchors])).toEqual([
      [0, 'a-3', '1 First', [null, 'a-1', 'a-3', 'a-5']],
      [1, 'a-7', '2 Second', ['a-7', 'a-9']],
    ]);
    expectTiling(groups, 0, byteLength(structure.content));
    expect(owningSectionIndex(groups, 'a-1')).toBe(0);
    expect(owningSectionIndex(groups, 'a-5')).toBe(0);
    expect(owningSectionIndex(groups, 'a-9')).toBe(1);
    const outline = buildPaperOutline(structure);
    expect(['a-1', 'a-3', 'a-5', 'a-7', 'a-9'].map((anchor) => owningSectionIndex(outline, anchor))).toEqual([0, 0, 0, 1, 1]);
    expect(summarizePaperSections(groups)).toEqual([
      { index: 0, anchor: 'a-3', label: '1 First', bytes: groups[0].endByte },
      { index: 1, anchor: 'a-7', label: '2 Second', bytes: groups[1].endByte - groups[1].startByte },
    ]);
    expect(Object.keys(summarizePaperSections(groups)[0]).sort()).toEqual(['anchor', 'bytes', 'index', 'label']);
  });

  it('caches the window model per structure object', () => {
    const structure = synthetic(lines);
    expect(getPaperSectionWindowModel(structure)).toBe(getPaperSectionWindowModel(structure));
    expect(getPaperSectionWindowModel(structure)).not.toBe(getPaperSectionWindowModel(synthetic(lines)));
  });

  it('fails closed without a depth-1 heading, on broken tiling, and on duplicate anchors', () => {
    const noTop = synthetic(['intro', '## Only deep', 'x']);
    expect(() => buildPaperSectionGroups(noTop)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}a section group has no depth-1 heading`);
    const chunks = buildPaperChunks(synthetic(lines));
    const total = byteLength(synthetic(lines).content);
    expect(() => buildPaperSectionGroupsFromChunks([], 0)).toThrow(PAPER_SECTION_WINDOW_FAILURE_PREFIX);
    const gap: PaperChunk[] = chunks.map((chunk, index) => (index === 2 ? { ...chunk, startByte: chunk.startByte + 1 } : chunk));
    expect(() => buildPaperSectionGroupsFromChunks(gap, total)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}chunk 2 is not contiguous`);
    expect(() => buildPaperSectionGroupsFromChunks(chunks, total + 1)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}chunks do not end at the paper length`);
    const duplicate: PaperChunk[] = chunks.map((chunk) => (chunk.anchor === 'a-7' ? { ...chunk, anchor: 'a-3' } : chunk));
    expect(() => buildPaperSectionGroupsFromChunks(duplicate, total)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}duplicate section anchor a-3`);
  });

  it('never builds a contract that spans the whole paper while more than one section exists', () => {
    const base = synthetic(['# 1 Only', 'all the text']);
    const end = byteLength(base.content);
    const structure = synthetic(['# 1 Only', 'all the text'], [{ depth: 1, label: '2 Empty tail', anchor: 'tail', startByte: end }]);
    const groups = buildPaperSectionGroups(structure);
    expect(groups.map((group) => [group.startByte, group.endByte])).toEqual([[0, end], [end, end]]);
    const identity = paperSectionIdentity(structure, REAL_VERSION);
    expect(() => buildPaperSectionContract(structure, groups, 0, identity)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}a section contract would span the whole paper`);
    // A genuinely single-section paper is allowed to be served whole.
    const single = synthetic(['# 1 Only', 'all the text']);
    expect(buildPaperSectionContract(single, buildPaperSectionGroups(single), 0, identity).endByte).toBe(end);
  });

  it('rejects an out-of-range index, groups from another structure, and a missing paper SHA-256', () => {
    const structure = synthetic(lines);
    const groups = buildPaperSectionGroups(structure);
    const identity = paperSectionIdentity(structure, REAL_VERSION);
    expect(() => buildPaperSectionContract(structure, groups, 2, identity)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}section index out of range`);
    expect(() => buildPaperSectionContract(structure, groups, 0.5, identity)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}section index out of range`);
    const other = synthetic(['# X', 'y', '# Z', 'w']);
    expect(() => buildPaperSectionContract(other, groups, 1, identity)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}section groups do not match the structure`);
    expect(() => paperSectionIdentity({ manifest: { source: {} } } as unknown as RevisedPaperStructure, REAL_VERSION)).toThrow(`${PAPER_SECTION_WINDOW_FAILURE_PREFIX}paper SHA-256 is unavailable`);
    expect(() => paperSectionIdentity({ manifest: { source: { sha256: 'ABC' } } } as unknown as RevisedPaperStructure, REAL_VERSION)).toThrow(PAPER_SECTION_WINDOW_FAILURE_PREFIX);
  });
});

describe('validatePaperSectionContract', () => {
  const structure = synthetic(['intro', '# 1 First', 'body', '## 1.1 Sub', 'more', '# 2 Second', 'last']);
  const groups = buildPaperSectionGroups(structure);
  const identity = paperSectionIdentity(structure, REAL_VERSION);
  const second = buildPaperSectionContract(structure, groups, 1, identity);
  const first = buildPaperSectionContract(structure, groups, 0, identity);
  const expectation = { ...identity, index: 1, anchor: second.anchor, sectionCount: 2, bytes: second.endByte - second.startByte };
  const clone = (contract: PaperSectionContract) => JSON.parse(JSON.stringify(contract)) as Record<string, unknown> & { chunks: Record<string, unknown>[] };

  it('accepts a contract that matches the request and returns only known fields', () => {
    const value = { ...clone(second), extra: 'ignored' };
    const result = validatePaperSectionContract(value, expectation);
    expect(result).toEqual(second);
    expect(Object.keys(result)).not.toContain('extra');
    expect(validatePaperSectionContract(clone(first), { ...identity, index: 0, anchor: first.anchor, sectionCount: 2 }).chunks[0].anchor).toBeNull();
  });

  // Explicitly typed so the inline builders never infer an implicit any return.
  const invalidCases: readonly (readonly [string, () => unknown, string])[] = [
    ['not an object', () => 'text', 'not an object'],
    ['schema', () => ({ ...clone(second), schema: 'other' }), 'schema'],
    ['document version', () => ({ ...clone(second), documentVersion: 'other' }), 'document version'],
    ['paper SHA-256', () => ({ ...clone(second), paperSha256: 'b'.repeat(64) }), 'paper SHA-256'],
    ['section index', () => ({ ...clone(second), index: 0 }), 'section index'],
    ['section count', () => ({ ...clone(second), sectionCount: 3 }), 'section count'],
    ['section anchor', () => ({ ...clone(second), anchor: 'a-1' }), 'section anchor'],
    ['section size', () => ({ ...clone(second), endByte: second.endByte + 1 }), 'section size'],
    ['empty chunks', () => ({ ...clone(second), chunks: [] }), 'chunks'],
    ['chunk gap', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], startByte: (value.chunks[0].startByte as number) + 1 }; return value; }, 'chunk 0 range'],
    ['untiled tail', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], endByte: (value.chunks[0].endByte as number) - 1, markdown: '' }; return value; }, 'chunks do not tile the section range'],
    ['duplicate chunk id', () => { const value = clone(first); value.chunks[2] = { ...value.chunks[2], id: value.chunks[1].id }; return value; }, 'chunk 2 id'],
    ['markdown beyond its range', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], markdown: `${value.chunks[0].markdown as string}${'x'.repeat(40)}` }; return value; }, 'chunk 0 markdown exceeds its range'],
    ['missing owning heading', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], depth: 2 }; return value; }, 'section heading'],
    ['preamble outside section 0', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], anchor: null, depth: null, label: null }; return value; }, 'chunk 0 preamble position'],
    ['mixed heading fields', () => { const value = clone(second); value.chunks[0] = { ...value.chunks[0], label: null }; return value; }, 'chunk 0 heading fields'],
  ];

  it.each(invalidCases)('rejects %s', (_name, build, reason) => {
    const expected = reason === 'chunk 2 id' ? { ...identity, index: 0, anchor: first.anchor, sectionCount: 2 } : expectation;
    expect(() => validatePaperSectionContract(build(), expected)).toThrow(`${PAPER_SECTION_CONTRACT_FAILURE_PREFIX}${reason}`);
  });
});
