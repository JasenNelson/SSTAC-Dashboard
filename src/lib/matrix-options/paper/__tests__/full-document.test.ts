import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadRevisedPaperStructure, type RevisedPaperNode } from '../../revised-paper-structure';
import {
  buildLegacyAnchorMap,
  buildPaperChunks,
  buildPaperOutline,
  PREAMBLE_CHUNK_ID,
  sectionAnchorSet,
  stripStandaloneSectionAnchorLines,
} from '../full-document';
import { PAPER_URL_VALUE_MAX_LENGTH } from '../url-state';

const ANCHOR_LINE_DETECTOR = /^[ \t]*<div[ \t]+id="[^"\r\n]+"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*$/m;
const ANCHOR_LINE_GLOBAL = /^[ \t]*<div[ \t]+id="([^"\r\n]+)"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*(?:\r?\n|$)/gm;

function bytesOf(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function rawRange(content: string, startByte: number, endByte: number): string {
  return Buffer.from(content, 'utf8').subarray(startByte, endByte).toString('utf8');
}

/** Synthetic structure builder: headings are lines starting with 1-6 '#' and a space. */
function synthetic(content: string): { readonly content: string; readonly nodes: readonly RevisedPaperNode[] } {
  const lines = content.split('\n');
  const headings: { depth: number; label: string; startByte: number }[] = [];
  let offset = 0;
  for (const line of lines) {
    const match = /^(#{1,6}) (.*)$/.exec(line);
    if (match) headings.push({ depth: match[1].length, label: match[2], startByte: offset });
    offset += bytesOf(line) + 1;
  }
  const total = bytesOf(content);
  const seen = new Map<string, number>();
  const nodes: RevisedPaperNode[] = [];
  const stack: number[] = [];
  headings.forEach((heading, index) => {
    while (stack.length > 0 && nodes[stack[stack.length - 1]].depth >= heading.depth) stack.pop();
    const parentIndex = stack.length > 0 ? stack[stack.length - 1] : -1;
    const later = headings.slice(index + 1).find((candidate) => candidate.depth <= heading.depth);
    const base = heading.label.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    nodes.push({
      id: `node:${index}`,
      domain: 'node',
      kind: 'heading',
      depth: heading.depth,
      label: heading.label,
      parentId: parentIndex < 0 ? null : nodes[parentIndex].id,
      ancestorIds: parentIndex < 0 ? [] : [...nodes[parentIndex].ancestorIds, nodes[parentIndex].id],
      tokenEndByte: heading.startByte + bytesOf(heading.label) + heading.depth + 1,
      anchor: count === 0 ? base : `${base}-${count}`,
      startByte: heading.startByte,
      endByte: later ? later.startByte : total,
    });
    stack.push(index);
  });
  return { content, nodes };
}

describe('full-document model against the real authenticated paper', () => {
  const structure = loadRevisedPaperStructure();
  const chunks = buildPaperChunks(structure);
  const outline = buildPaperOutline(structure);
  const anchors = sectionAnchorSet(structure);
  const totalBytes = bytesOf(structure.content);

  it('uses UTF-8 byte ranges that tile the whole paper with no gap or overlap', () => {
    expect(totalBytes).toBe(541959);
    // The current release is pure ASCII (bytes == UTF-16 code units); the
    // byte-vs-code-unit distinction is exercised by the multi-byte synthetic test.
    expect(structure.content.length).toBe(totalBytes);
    expect(structure.content.includes('\r')).toBe(false);
    expect(chunks[0].startByte).toBe(0);
    for (let index = 1; index < chunks.length; index += 1) {
      expect(chunks[index].startByte).toBe(chunks[index - 1].endByte);
      expect(chunks[index].endByte).toBeGreaterThan(chunks[index].startByte);
    }
    expect(chunks.at(-1)?.endByte).toBe(totalBytes);
    expect(chunks.map((chunk) => rawRange(structure.content, chunk.startByte, chunk.endByte)).join('')).toBe(structure.content);
  });

  it('has exactly 341 heading chunks in node order and no preamble (the paper starts with a heading)', () => {
    expect(structure.nodes).toHaveLength(341);
    expect(chunks.filter((chunk) => chunk.id === PREAMBLE_CHUNK_ID)).toHaveLength(0);
    expect(chunks).toHaveLength(341);
    expect(chunks.map((chunk) => chunk.nodeId)).toEqual(structure.nodes.map((node) => node.id));
    expect(chunks.map((chunk) => chunk.anchor)).toEqual(structure.nodes.map((node) => node.anchor));
    chunks.forEach((chunk, index) => {
      expect(chunk.startByte).toBe(structure.nodes[index].startByte);
    });
    expect(chunks.some((chunk) => chunk.label === 'Technical Appendices Compendium' && chunk.depth === 1)).toBe(true);
  });

  it('builds a 341-entry outline with unique anchors and consistent child links', () => {
    expect(outline).toHaveLength(341);
    expect(new Set(outline.map((entry) => entry.anchor)).size).toBe(341);
    expect(anchors.size).toBe(341);
    for (const entry of outline) {
      expect(anchors.has(entry.anchor)).toBe(true);
      expect(entry.childIds).toEqual(outline.filter((candidate) => candidate.parentId === entry.id).map((candidate) => candidate.id));
    }
    expect(outline.filter((entry) => entry.parentId === null).every((entry) => entry.depth === 1)).toBe(true);
  });

  it('keeps every heading anchor within the URL value limit', () => {
    expect(Math.max(...[...anchors].map((anchor) => anchor.length))).toBeLessThanOrEqual(PAPER_URL_VALUE_MAX_LENGTH);
  });

  it('removes only standalone section-anchor div lines from chunk markdown', () => {
    const rawAnchorLines = [...structure.content.matchAll(ANCHOR_LINE_GLOBAL)];
    expect(rawAnchorLines).toHaveLength(121);
    let removedBytes = 0;
    for (const chunk of chunks) {
      const raw = rawRange(structure.content, chunk.startByte, chunk.endByte);
      expect(ANCHOR_LINE_DETECTOR.test(chunk.markdown)).toBe(false);
      expect(chunk.markdown).toBe(raw.replace(ANCHOR_LINE_GLOBAL, ''));
      removedBytes += bytesOf(raw) - bytesOf(chunk.markdown);
    }
    expect(removedBytes).toBe(rawAnchorLines.reduce((sum, match) => sum + bytesOf(match[0]), 0));
    expect(chunks.map((chunk) => chunk.markdown).join('')).toBe(structure.content.replace(ANCHOR_LINE_GLOBAL, ''));
  });

  it('has no Appendix J heading', () => {
    expect(structure.nodes.filter((node) => /appendix\s+j\b/i.test(node.label))).toHaveLength(0);
    expect(outline.filter((entry) => /appendix\s+j\b/i.test(entry.label))).toHaveLength(0);
  });

  it('maps legacy section-anchor ids only to valid heading anchors', () => {
    const legacy = buildLegacyAnchorMap(structure);
    const distinctIds = [...new Set([...structure.content.matchAll(ANCHOR_LINE_GLOBAL)].map((match) => match[1]))];
    expect(distinctIds).toHaveLength(120);
    const legacyExpectedIds = distinctIds.filter(id => !['sec-7-8', 'sec-7-8-1', 'sec-7-8-2'].includes(id));
    for (const [id, anchor] of Object.entries(legacy)) {
      expect(legacyExpectedIds).toContain(id);
      expect(anchors.has(anchor)).toBe(true);
    }
    expect(Object.keys(legacy).sort()).toEqual([...legacyExpectedIds].sort());
    const headingAnchor = (prefix: string) => structure.nodes.find((node) => node.label.startsWith(prefix))?.anchor;
    expect(legacy['sec-4-1']).toBe(headingAnchor('4.1 '));
    expect(legacy['sec-10-2']).toBe(headingAnchor('10.2 '));
    expect(legacy['sec-12-0']).toBe(headingAnchor('12.0 '));
    expect(legacy['sec-acknowledgements']).toBe('acknowledgements');
  });
});

describe('full-document model synthetic edge cases', () => {
  it('emits a preamble chunk for bytes before the first heading', () => {
    const input = synthetic('intro text\n\n# A\nbody\n## B\nmore\n');
    const chunks = buildPaperChunks(input);
    expect(chunks.map((chunk) => chunk.id)).toEqual([PREAMBLE_CHUNK_ID, 'node:0', 'node:1']);
    expect(chunks[0]).toMatchObject({ nodeId: null, anchor: null, depth: null, label: null, startByte: 0, endByte: 12, markdown: 'intro text\n\n' });
    expect(chunks[1]).toMatchObject({ startByte: 12, endByte: 21, markdown: '# A\nbody\n' });
    expect(chunks[2]).toMatchObject({ startByte: 21, endByte: bytesOf(input.content), markdown: '## B\nmore\n' });
  });

  it('emits no preamble when content starts with a heading and a single preamble when there are no headings', () => {
    expect(buildPaperChunks(synthetic('# A\nx\n')).map((chunk) => chunk.id)).toEqual(['node:0']);
    expect(buildPaperChunks(synthetic('just text\n')).map((chunk) => [chunk.id, chunk.startByte, chunk.endByte])).toEqual([[PREAMBLE_CHUNK_ID, 0, 10]]);
    expect(buildPaperChunks(synthetic(''))).toEqual([]);
  });

  it('keeps duplicate labels as distinct chunks with distinct anchors', () => {
    const input = synthetic('# Notes\na\n# Notes\nb\n');
    const chunks = buildPaperChunks(input);
    expect(chunks.map((chunk) => chunk.anchor)).toEqual(['notes', 'notes-1']);
    expect(chunks.map((chunk) => chunk.markdown)).toEqual(['# Notes\na\n', '# Notes\nb\n']);
    const outline = buildPaperOutline(input);
    expect(outline.map((entry) => entry.label)).toEqual(['Notes', 'Notes']);
    expect(sectionAnchorSet(input)).toEqual(new Set(['notes', 'notes-1']));
  });

  it('slices multi-byte content by UTF-8 bytes, not UTF-16 code units', () => {
    // Built from code points so this source file stays plain ASCII.
    const eAcute = String.fromCharCode(0xe9);
    const emDash = String.fromCharCode(0x2014);
    const grin = String.fromCodePoint(0x1f600);
    const firstSection = `# Caf${eAcute} ${grin}\nx${emDash}y\n`;
    const content = `${firstSection}## B\nz\n`;
    const input = synthetic(content);
    const chunks = buildPaperChunks(input);
    expect(firstSection.length).toBeLessThan(bytesOf(firstSection));
    expect(chunks[1].startByte).toBe(bytesOf(firstSection));
    expect(chunks.map((chunk) => chunk.markdown).join('')).toBe(content);
    // Byte 6 is the second byte of the two-byte e-acute character.
    expect(() => buildPaperChunks({ content, nodes: [{ ...input.nodes[0], startByte: 6 }] })).toThrow(/character boundary/);
  });

  it('fails closed on out-of-order or out-of-bounds nodes', () => {
    const input = synthetic('# A\nx\n# B\ny\n');
    expect(() => buildPaperChunks({ content: input.content, nodes: [input.nodes[1], input.nodes[0]] })).toThrow(/document order/);
    expect(() => buildPaperChunks({ content: input.content, nodes: [{ ...input.nodes[0], endByte: 999 }] })).toThrow(/out of bounds/);
  });

  it('builds child links from parentId in document order', () => {
    const outline = buildPaperOutline(synthetic('# A\n## A1\n### A1a\n## A2\n# B\n'));
    expect(outline.map((entry) => [entry.label, entry.parentId, entry.childIds])).toEqual([
      ['A', null, ['node:1', 'node:3']],
      ['A1', 'node:0', ['node:2']],
      ['A1a', 'node:1', []],
      ['A2', 'node:0', []],
      ['B', null, []],
    ]);
  });

  it('strips standalone anchor div lines only and leaves other HTML intact', () => {
    const markdown = '<div id="sec-a" class="section-anchor"></div>\n\n<div id="keep">x</div>\ntext <div id="sec-b" class="section-anchor"></div>\n  <div id="sec-c" class="section-anchor"></div>  \n<div id="sec-d" class="section-anchor"></div>';
    expect(stripStandaloneSectionAnchorLines(markdown)).toBe('\n<div id="keep">x</div>\ntext <div id="sec-b" class="section-anchor"></div>\n');
    const input = synthetic('# A\n<div id="sec-x" class="section-anchor"></div>\n\n# B\n<span class="section-anchor"></span>\n');
    expect(buildPaperChunks(input).map((chunk) => chunk.markdown)).toEqual(['# A\n\n', '# B\n<span class="section-anchor"></span>\n']);
  });

  it('maps legacy anchors only when unambiguous', () => {
    const content = [
      '# Front',
      '<div id="sec-adjacent" class="section-anchor"></div>',
      '',
      '<div id="sec-adjacent-2" class="section-anchor"></div>',
      '',
      '## 1.0 Intro',
      'text',
      '<div id="sec-2-1" class="section-anchor"></div>',
      '',
      'intervening paragraph',
      '',
      '## 2.1 Numbered',
      '<div id="sec-loose" class="section-anchor"></div>',
      'intervening paragraph',
      '## 3.0 Other',
      '<div id="sec-9-9" class="section-anchor"></div>',
      'intervening paragraph',
      '## 4.0 Mismatch',
      '<div id="sec-dup" class="section-anchor"></div>',
      '## 5.0 First',
      '<div id="sec-dup" class="section-anchor"></div>',
      '## 6.0 Second',
      '<div id="__proto__" class="section-anchor"></div>',
      '## 7.0 Proto',
      '<div id="70-proto" class="section-anchor"></div>',
      '## 10 First',
      '<div id="sec-trailing" class="section-anchor"></div>',
      '',
    ].join('\n');
    const input = synthetic(content);
    const legacy = buildLegacyAnchorMap(input);
    expect({ ...legacy }).toEqual({
      'sec-adjacent': '10-intro',
      'sec-adjacent-2': '10-intro',
      'sec-2-1': '21-numbered',
      ['__proto__']: '70-proto',
    });
    expect(Object.getPrototypeOf(legacy)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(legacy, '__proto__')).toBe(true);
    // "70-proto" is itself a heading anchor but would map to "10-first": dropped.
    expect(Object.prototype.hasOwnProperty.call(legacy, '70-proto')).toBe(false);
    expect(legacy['sec-dup']).toBeUndefined();
    expect(legacy['sec-loose']).toBeUndefined();
    expect(legacy['sec-9-9']).toBeUndefined();
    expect(legacy['sec-trailing']).toBeUndefined();
  });
});
