import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildPaperSectionContract,
  buildPaperSectionGroups,
  paperSectionIdentity,
  validatePaperSectionContract,
} from '@/lib/matrix-options/paper/section-window';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { getPaperDocumentModel, PaperDocument } from '../PaperDocument';
import { PaperChunkSection } from '../PaperChunkSection';

/*
 * Server/client markup parity (S1). The server renders the initial section with
 * PaperDocument; the client renders a fetched section's chunks itself. Both go
 * through PaperChunkSection, so the two markups must be identical for the same
 * chunks -- otherwise a loaded section would differ from a server-rendered one
 * (hydration, selectors, focus targets and scroll margins all depend on it).
 */

const VERSION = '1.0.11-remediated-7-8-successor-20260918-D';
const SHA = 'c'.repeat(64);
const encoder = new TextEncoder();
const byteLength = (text: string) => encoder.encode(text).length;

function synthetic(): RevisedPaperStructure {
  const lines = [
    'Preamble prose before any heading.',
    '',
    '# 1 First section',
    '',
    'Body with [a link](#sec-2) and inline math $x^2$.',
    '',
    '## 1.1 Sub section',
    '',
    'Sub body.',
    '',
    '# 2 Second section',
    '',
    'Second body.',
    '',
  ];
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
  const placements = nodes.map((node) => ({ id: node.id, domain: 'node', lens: 'all', label: node.label, reason: 'test', triggers: [], startByte: node.startByte, endByte: node.endByte }));
  return { releaseIdentity: 'release', content, lines: [], nodes, objects: [], questions: [], questionContainerIds: [], lenses: { all: placements, core: [], appendices: [], evidence: [], objects: [], questions: [] }, manifest: { source: { version: VERSION, sha256: SHA } } } as unknown as RevisedPaperStructure;
}

describe('server and client section markup parity', () => {
  const structure = synthetic();
  const groups = buildPaperSectionGroups(structure);
  const identity = paperSectionIdentity(structure, VERSION);
  const model = getPaperDocumentModel(structure);

  it.each([0, 1])('renders section %i identically from the server document and from a fetched contract', (index) => {
    const group = groups[index];
    const serverModel = { chunks: model.chunks.slice(group.chunkStart, group.chunkEnd), linkMap: model.linkMap };
    const server = render(<PaperDocument model={serverModel} layout="chunks" />);
    const serverHtml = server.container.innerHTML;
    server.unmount();

    const overWire = JSON.parse(JSON.stringify(buildPaperSectionContract(structure, groups, index, identity)));
    const contract = validatePaperSectionContract(overWire, { ...identity, index, anchor: group.anchor, sectionCount: groups.length, bytes: group.endByte - group.startByte });
    const client = render(<>{contract.chunks.map((chunk) => <PaperChunkSection key={chunk.id} chunk={chunk} linkMap={model.linkMap} />)}</>);
    const clientHtml = client.container.innerHTML;
    client.unmount();

    expect(clientHtml).toBe(serverHtml);
    expect(serverHtml).toContain('data-paper-chunk="');
    expect(serverHtml).toContain('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
    // M1R3-03: a chunk section stays an explicit scroll-anchor candidate, so a
    // placeholder resizing above the reading position cannot move the reader.
    expect(serverHtml).toContain('[overflow-anchor:auto]');
    expect(serverHtml).not.toContain('content-visibility');
  });

  it('renders the document surface only for the article layout', () => {
    const chunksOnly = render(<PaperDocument model={model} layout="chunks" />);
    expect(chunksOnly.container.querySelector('[data-testid="paper-document"]')).toBeNull();
    expect(chunksOnly.container.querySelectorAll('section[data-paper-chunk]')).toHaveLength(3);
    chunksOnly.unmount();
    const article = render(<PaperDocument model={model} />);
    expect(article.container.querySelector('[data-testid="paper-document"]')).not.toBeNull();
    expect(article.container.querySelectorAll('section[data-paper-chunk]')).toHaveLength(3);
  });
});
