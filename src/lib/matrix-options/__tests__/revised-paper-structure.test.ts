import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  compileRevisedPaperStructure,
  createStructureId,
  findAppendixBoundary,
  lengthPrefix,
  loadRevisedPaperStructure,
  PUBLICATION_LENSES,
  resolveLinkTarget,
  serializeCanonicalParts,
} from '../revised-paper-structure';
import {
  REVISED_PAPER_BYTES,
  REVISED_PAPER_RELEASE_IDENTITY,
  REVISED_PAPER_VERSION,
  loadRevisedPaper,
} from '../revised-paper';

const fixturePath = path.join(
  process.cwd(),
  'src/lib/matrix-options/__fixtures__/revised-paper-structure-v1.json',
);
const sidecarPath = `${fixturePath}.sha256`;

describe('authenticated revised-paper structure compiler', () => {
  it('uses the frozen byte-length-prefixed ID serialization without normalization', () => {
    expect(lengthPrefix('A')).toBe('1#A');
    expect(lengthPrefix('e\u0301')).toBe('3#e\u0301');
    expect(serializeCanonicalParts(['A', 'e\u0301'])).toBe('2:1#A3#e\u0301');
    expect(
      createStructureId(
        'node',
        'release',
        'heading',
        { startByte: 12, endByte: 34 },
        ['Parent', 'Child'],
      ),
    ).toBe(
      'node:e286d996430fc877e52cfafa71d25ad3488b0a1344fce2e3dde47e68acd184c0',
    );
  });

  it('compiles the real artifact into immutable, exact byte-owned structure', () => {
    const structure = loadRevisedPaperStructure();

    expect(structure.releaseIdentity).toBe(REVISED_PAPER_RELEASE_IDENTITY);
    expect(Object.isFrozen(structure)).toBe(true);
    expect(Object.isFrozen(structure.nodes)).toBe(true);
    expect(structure.lines[0].startByte).toBe(0);
    expect(structure.lines.at(-1)?.endByte).toBe(REVISED_PAPER_BYTES);
    for (let index = 1; index < structure.lines.length; index += 1) {
      expect(structure.lines[index].startByte).toBe(structure.lines[index - 1].endByte);
    }

    expect(new Set(structure.nodes.map((node) => node.id)).size).toBe(structure.nodes.length);
    expect(new Set(structure.objects.map((object) => object.id)).size).toBe(structure.objects.length);
    expect(new Set(structure.questions.map((question) => question.id)).size).toBe(
      structure.questions.length,
    );
    for (const node of structure.nodes) {
      expect(node.startByte).toBeLessThan(node.tokenEndByte);
      expect(node.tokenEndByte).toBeLessThanOrEqual(node.endByte);
      if (node.parentId) {
        const parent = structure.nodes.find((candidate) => candidate.id === node.parentId);
        expect(parent).toBeDefined();
        expect(parent!.startByte).toBeLessThanOrEqual(node.startByte);
        expect(parent!.endByte).toBeGreaterThanOrEqual(node.endByte);
        expect(parent!.depth).toBeLessThan(node.depth);
      }
    }
  });

  it('derives every required lens and typed object/question boundary from the same graph', () => {
    const structure = loadRevisedPaperStructure();
    expect(Object.keys(structure.lenses)).toEqual(PUBLICATION_LENSES);
    expect(structure.lenses.all).toHaveLength(structure.nodes.length);
    expect(structure.lenses.core.length + structure.lenses.appendices.length).toBe(
      structure.nodes.length,
    );
    expect(structure.lenses.appendices[0]?.startByte).toBe(
      structure.nodes.find(
        (node) => node.depth === 1 && node.label === 'Technical Appendices Compendium',
      )?.startByte,
    );
    expect(structure.objects.length).toBeGreaterThan(0);
    expect(structure.questions.length).toBeGreaterThan(0);
    for (const question of structure.questions) {
      expect(question.label.endsWith('?')).toBe(true);
      expect(structure.questionContainerIds).toContain(question.containerNodeId);
      expect(question.supportNodeIds).toContain(question.containerNodeId);
    }
  });

  it('requires exactly one appendix boundary', () => {
    const node = { depth: 1 as const, label: 'Technical Appendices Compendium' };
    expect(() => findAppendixBoundary([])).toThrow(/found 0/);
    expect(findAppendixBoundary([node])).toBe(0);
    expect(() => findAppendixBoundary([node, node])).toThrow(/found 2/);
  });

  it('preserves lens metadata and resolves direct and reference supporting links', () => {
    const structure = loadRevisedPaperStructure();
    for (const lens of PUBLICATION_LENSES) {
      for (const placement of structure.lenses[lens]) {
        expect(placement.lens).toBe(lens);
        expect(typeof placement.label).toBe('string');
        expect(typeof placement.reason).toBe('string');
        expect(placement.triggers.length).toBeGreaterThan(0);
        for (const trigger of placement.triggers) {
          expect(trigger.startByte).toBeLessThan(trigger.endByte);
          expect(typeof trigger.provenance).toBe('string');
        }
      }
    }
    const triggerTypes = new Set(
      structure.lenses.evidence.flatMap((placement) => placement.triggers.map((trigger) => trigger.type)),
    );
    expect(triggerTypes).toContain('link');
    const definitions = new Map([
      ['target', { identifier: 'target', target: '#Evidence', startByte: 10, endByte: 25 }],
    ]);
    expect(resolveLinkTarget({ type: 'link', url: '#Evidence' }, definitions)).toEqual({
      target: '#Evidence',
      targetRange: null,
    });
    expect(resolveLinkTarget({ type: 'linkReference', identifier: 'TARGET' }, definitions)).toEqual({
      target: '#Evidence',
      targetRange: definitions.get('target'),
    });
  });

  it('rejects a same-length content mutation at the exported compiler boundary', () => {
    const paper = loadRevisedPaper(REVISED_PAPER_VERSION);
    const replacement = paper.content.includes('Technical Appendices Compendium')
      ? paper.content.replace('Technical Appendices Compendium', 'Technical Appendices Compendium')
      : paper.content;
    const mutated = `${replacement[0] === ' ' ? '!' : ' '}${replacement.slice(1)}`;
    expect(Buffer.byteLength(mutated, 'utf8')).toBe(REVISED_PAPER_BYTES);
    expect(() => compileRevisedPaperStructure({ ...paper, content: mutated })).toThrow(/SHA-256 mismatch/);
  });

  it('matches the authenticated deterministic manifest and exact sidecar bytes', () => {
    const structure = loadRevisedPaperStructure();
    const expectedJson = `${JSON.stringify(structure.manifest, null, 2)}\n`;
    const expectedHash = createHash('sha256').update(expectedJson, 'utf8').digest('hex');
    expect(fs.existsSync(fixturePath)).toBe(true);
    expect(fs.existsSync(sidecarPath)).toBe(true);
    expect(fs.readFileSync(fixturePath, 'utf8')).toBe(expectedJson);
    expect(fs.readFileSync(sidecarPath, 'ascii')).toBe(
      `${expectedHash}  revised-paper-structure-v1.json\n`,
    );
    expect(structure.manifest.source.version).toBe(REVISED_PAPER_VERSION);
  });
});
