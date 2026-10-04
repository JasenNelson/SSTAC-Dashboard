import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import r5FiguresContract from '../contracts/accepted-figures-v0.9.88-r4-presentation-001.json';
import {
  acceptedFigureAssetHref,
  acceptedFigureBlockText,
  acceptedFigureDomId,
  findAcceptedFigureBlocks,
  getAcceptedFiguresContract,
  resolveAcceptedFigure,
  splitAcceptedFigureCaption,
  splitAcceptedFigureSegments,
  validateAcceptedFiguresContract,
  type AcceptedFigureBlock,
  type AcceptedFiguresContract,
} from '../accepted-figures';
import { authenticateAcceptedFigures } from '../accepted-figures-server';
import { DERIVED_FIGURES, paperInlineSegments, paperMarkdownSegments } from '../derived-figures';
import { buildLegacyAnchorMap, buildPandocAnchorMap, buildPaperChunks } from '../full-document';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { loadRevisedPaper, REVISED_PAPER_VERSION } from '../../revised-paper';
import { loadRevisedPaperStructure } from '../../revised-paper-structure';
import { describePrivate, privateFigurePath, readPrivateFigure } from './private-fixture';
import { privateR5Structure } from './private-structure';

/*
 * Unit 2: all 20 accepted placements render the exact accepted PNG.
 *
 * The figures contract holds no text of the release: each placement binds its
 * caption, status and alternative text by ONE hash. What the contract says is
 * checked here without the release bytes. What the release's Markdown and PNGs
 * must be is checked against the private fixture, one mutation at a time (a
 * caption, a status, an alternative text, an anchor, a marker), each of which
 * must make the release unavailable, so a guard that could not have failed is
 * not counted. The same failures are shown on a synthetic release, everywhere,
 * in accepted-figures-synthetic.test.ts.
 */

const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;
const FORMERLY_MISSING = ['7-1', 'B-1', '7-2', 'G-1', '7-7', 'G-2', 'G-3', 'H-1'] as const;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

/** A contract with one field of one asset or placement replaced, validated in place of the real one. */
function withContract(patch: (draft: AcceptedFiguresContract) => void): AcceptedFiguresContract {
  const draft = JSON.parse(JSON.stringify(r5FiguresContract)) as AcceptedFiguresContract;
  patch(draft);
  return draft;
}

describe('accepted figures contract', () => {
  it('binds exactly 17 accepted assets and 20 placements for R5, and nothing for the predecessor', () => {
    expect(contract.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(contract.assets).toHaveLength(17);
    expect(contract.placements).toHaveLength(20);
    expect(contract.paperSha256).toBe(getPaperRelease(R5_PAPER_VERSION)?.sha256);
    expect(getAcceptedFiguresContract(REVISED_PAPER_VERSION)).toBeNull();
    expect(getAcceptedFiguresContract('unknown')).toBeNull();
  });

  it('records the three authenticated sources it was generated from', () => {
    expect(contract.sources).toEqual({
      candidateManifestSha256: '8846254f358cd322bf9509f8dd8976dd690004d4bd6d558bf4511df77138eeff',
      placementRegistrySha256: 'c5b83ff8e4f8a2ab29cc070841de678b7bff8da7c3ee8e0f1c8356b4623ba125',
      interfaceOverlaySha256: 'bc2dd239f8b4ba358aa90ec3029f0d1594b4dddead9f1485b0ce420c27650f91',
    });
    expect(contract.sources.candidateManifestSha256).toBe(getPaperRelease(R5_PAPER_VERSION)?.provenance?.sourceManifestSha256);
  });

  it('lists the placements in document order with the accepted figure numbers', () => {
    expect(contract.placements.map((placement) => placement.figureId)).toEqual(['6-1', '7-1', '7-2', '7-3', '7-4', '7-5', '7-6', '7-7', 'A-1', 'A-2', 'A-3', 'A-4', 'B-1', 'E-1', 'F-1', 'F-2', 'G-3', 'G-2', 'G-1', 'H-1']);
    const lines = contract.placements.map((placement) => placement.markerLine);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });

  it('binds the text of each placement by one hash, and holds no caption, status or alternative text', () => {
    expect(contract.placements.every((placement) => SHA256_HEX.test(placement.textSha256))).toBe(true);
    // Twenty placements, twenty different texts (each caption carries its own figure number).
    expect(new Set(contract.placements.map((placement) => placement.textSha256)).size).toBe(20);
    expect(contract.placements.some((placement) => 'caption' in placement)).toBe(false);
    expect(contract.assets.some((asset) => 'alt' in asset || 'status' in asset)).toBe(false);
  });

  it('preserves reuse: three assets are each drawn by two placements, every other asset by one', () => {
    const shared = contract.assets.filter((asset) => asset.placementIds.length > 1).map((asset) => [asset.id, [...asset.placementIds].sort()]);
    expect(shared).toEqual([['FIG7-1B1', ['7-1', 'B-1']], ['FIG7-2E1', ['7-2', 'E-1']], ['FIG7-5G1', ['7-5', 'G-1']]]);
    expect(contract.assets.filter((asset) => asset.placementIds.length === 1)).toHaveLength(14);
    for (const placement of contract.placements) {
      const asset = contract.assets.find((candidate) => candidate.id === placement.assetId);
      expect(asset?.placementIds).toContain(placement.figureId);
    }
  });

  it('applies the three overlay anchor corrections and takes every other anchor from the registry', () => {
    const corrected = contract.placements.filter((placement) => placement.anchorSource === 'overlay-correction').map((placement) => [placement.figureId, placement.sectionAnchor]);
    expect(corrected).toEqual([['7-5', 'sec-7-7'], ['B-1', 'app-b'], ['E-1', 'app-e']]);
    expect(contract.placements.filter((placement) => placement.anchorSource === 'registry')).toHaveLength(17);
    expect(contract.placements.some((placement) => (placement.sectionAnchor as string) === 'secondary')).toBe(false);
    const expected: Record<string, string> = { '7-1': 'sec-7-2', 'B-1': 'app-b', '7-2': 'sec-7-5', 'G-1': 'app-g', '7-7': 'sec-7-8', 'G-2': 'app-g', 'G-3': 'app-g', 'H-1': 'app-h' };
    for (const figureId of FORMERLY_MISSING) expect(contract.placements.find((candidate) => candidate.figureId === figureId)?.sectionAnchor).toBe(expected[figureId]);
  });

  it.each([
    ['a duplicated placement', (draft: AcceptedFiguresContract) => { (draft.placements as unknown[]).push(draft.placements[0]); }, /placement id 6-1/],
    ['a placement of an unknown asset', (draft: AcceptedFiguresContract) => { (draft.placements[0] as { assetId: string }).assetId = 'FIGX'; }, /placement asset 6-1/],
    ['a text hash that is not a lowercase SHA-256', (draft: AcceptedFiguresContract) => { (draft.placements[0] as { textSha256: string }).textSha256 = draft.placements[0].textSha256.toUpperCase(); }, /placement text SHA-256 6-1/],
    ['a placement with no text hash', (draft: AcceptedFiguresContract) => { delete (draft.placements[0] as { textSha256?: string }).textSha256; }, /unverified placement field 6-1/],
    ['a caption beside the text hash', (draft: AcceptedFiguresContract) => { (draft.placements[0] as unknown as { caption: string }).caption = 'Figure 6-1. A synthetic caption.'; }, /unverified placement field 6-1/],
    ['alternative text on an asset', (draft: AcceptedFiguresContract) => { (draft.assets[0] as unknown as { alt: string }).alt = 'A synthetic description.'; }, /unverified asset field FIG6-1/],
    ['a status on an asset', (draft: AcceptedFiguresContract) => { (draft.assets[0] as unknown as { status: string }).status = 'SYNTHETIC'; }, /unverified asset field FIG6-1/],
    ['a member no check reads', (draft: AcceptedFiguresContract) => { (draft as unknown as { note: string }).note = 'anything'; }, /unverified field/],
    ['a fourth source', (draft: AcceptedFiguresContract) => { (draft.sources as unknown as { other: string }).other = 'a'.repeat(64); }, /source hashes/],
    ['an unresolved "secondary" anchor', (draft: AcceptedFiguresContract) => { (draft.placements[2] as { sectionAnchor: string }).sectionAnchor = 'secondary'; }, /placement section 7-2/],
    ['one placement entry that joins two figure ids', (draft: AcceptedFiguresContract) => { (draft.assets[1] as unknown as { placementIds: string[] }).placementIds = ['7-1|B-1']; }, /asset placements FIG7-1B1/],
    ['a placement id listed twice', (draft: AcceptedFiguresContract) => { (draft.assets[1] as unknown as { placementIds: string[] }).placementIds = ['7-1', '7-1', 'B-1']; }, /asset placements FIG7-1B1/],
    ['a placement entry that is not a string', (draft: AcceptedFiguresContract) => { (draft.assets[1] as unknown as { placementIds: unknown[] }).placementIds = ['7-1', 7]; }, /asset placements FIG7-1B1/],
    ['an asset whose placement list omits a placement', (draft: AcceptedFiguresContract) => { (draft.assets[1] as unknown as { placementIds: string[] }).placementIds = ['7-1']; }, /asset placement list FIG7-1B1/],
    ['an upper-case asset hash', (draft: AcceptedFiguresContract) => { (draft.assets[0] as { sha256: string }).sha256 = draft.assets[0].sha256.toUpperCase(); }, /asset SHA-256 FIG6-1/],
    ['an asset file that is not its own id', (draft: AcceptedFiguresContract) => { (draft.assets[0] as { file: string }).file = 'FIG7-3.png'; }, /asset file FIG6-1/],
    ['a path in an asset file name', (draft: AcceptedFiguresContract) => { (draft.assets[0] as { file: string }).file = '../FIG6-1.png'; }, /asset file FIG6-1/],
    ['another release identity', (draft: AcceptedFiguresContract) => { (draft as { releaseIdentity: string }).releaseIdentity = REVISED_PAPER_VERSION; }, /release identity/],
  ])('rejects a contract with %s', (_name, patch, message) => {
    expect(() => validateAcceptedFiguresContract(withContract(patch), R5_PAPER_VERSION)).toThrow(message);
  });

  it('two-sided: the stored contract itself validates', () => {
    expect(validateAcceptedFiguresContract(withContract(() => {}), R5_PAPER_VERSION).placements).toHaveLength(20);
  });
});

describe('accepted figure blocks: what a block resolves to (synthetic text)', () => {
  const block = (figureId: string, caption: string, file: string): readonly string[] => [`<!-- MATRIX_FIGURE_PLACEMENT: ${figureId} -->`, '', `[]{#fig-${figureId.toLowerCase()}}${caption}`, '', '**Status: SYNTHETIC**', '', `![A synthetic description.](assets/${file})`];
  const only = (lines: readonly string[]): AcceptedFigureBlock => findAcceptedFigureBlocks(lines)[0];

  it('resolves a block of a bound placement to its asset, with the block own caption, status and alternative text', () => {
    const binding = resolveAcceptedFigure(only(block('B-1', 'Figure B-1. A synthetic caption.', 'FIG7-1B1.png')))!;
    expect(binding.releaseIdentity).toBe(R5_PAPER_VERSION);
    expect(binding.placement).toBe(contract.placements.find((placement) => placement.figureId === 'B-1'));
    expect(binding.asset).toBe(contract.assets.find((asset) => asset.id === 'FIG7-1B1'));
    expect({ caption: binding.caption, status: binding.status, alt: binding.alt }).toEqual({ caption: 'Figure B-1. A synthetic caption.', status: 'SYNTHETIC', alt: 'A synthetic description.' });
    expect(splitAcceptedFigureCaption({ figureId: binding.placement.figureId, caption: binding.caption })).toEqual({ label: 'Figure B-1.', text: 'A synthetic caption.' });
    expect(acceptedFigureDomId('B-1')).toBe('fig-b-1');
    expect(acceptedFigureAssetHref(binding)).toBe(`/api/matrix-options/paper/v/${R5_PAPER_VERSION}/figures/FIG7-1B1.png?sha256=${binding.asset.sha256}`);
    // The same asset under its other placement is that placement's own binding.
    const first = resolveAcceptedFigure(only(block('7-1', 'Figure 7-1. A synthetic caption.', 'FIG7-1B1.png')))!;
    expect(first.asset).toBe(binding.asset);
    expect(first.placement).not.toBe(binding.placement);
  });

  it('joins caption, status and alternative text into the one value a placement binds', () => {
    expect(acceptedFigureBlockText({ caption: 'c', status: 's', alt: 'a' })).toBe('c\ns\na');
    const content = only(block('6-1', 'Figure 6-1. A synthetic caption.', 'FIG6-1.png')).content!;
    expect(acceptedFigureBlockText(content)).toBe('Figure 6-1. A synthetic caption.\nSYNTHETIC\nA synthetic description.');
    // A synthetic text is not the bound text: the server check would refuse it.
    expect(sha(acceptedFigureBlockText(content))).not.toBe(contract.placements[0].textSha256);
  });

  it.each([
    ['a caption that does not carry its own figure number', block('6-1', 'Figure 7-1. A synthetic caption.', 'FIG6-1.png')],
    ['a caption with no figure label', block('6-1', 'A synthetic caption.', 'FIG6-1.png')],
    ['another accepted asset under the placement', block('6-1', 'Figure 6-1. A synthetic caption.', 'FIG7-3.png')],
    ['an unknown figure id', block('9-9', 'Figure 9-9. A synthetic caption.', 'FIG6-1.png')],
    ['a block without a status line', ['<!-- MATRIX_FIGURE_PLACEMENT: 6-1 -->', '', 'Figure 6-1. A synthetic caption.', '', '![x](assets/FIG6-1.png)']],
  ])('draws a visible unavailable note, never an image, for %s', (_name, lines) => {
    const segments = splitAcceptedFigureSegments([{ kind: 'markdown', markdown: ['Before.', '', ...lines, '', 'After.'].join('\n') }]);
    expect(segments.map((segment) => segment.kind)).toEqual(['markdown', 'accepted-figure-unavailable', 'markdown']);
    for (const segment of segments) {
      if (segment.kind === 'markdown') expect(segment.markdown).not.toContain('assets/');
    }
  });

  it('two-sided: a block of the bound shape, id and asset is drawn as a figure', () => {
    const segments = splitAcceptedFigureSegments([{ kind: 'markdown', markdown: ['Before.', '', ...block('6-1', 'Figure 6-1. A synthetic caption.', 'FIG6-1.png'), '', 'After.'].join('\n') }]);
    expect(segments.map((segment) => segment.kind)).toEqual(['markdown', 'accepted-figure', 'markdown']);
  });

  it('returns prose without a marker as the same segment object, so the predecessor is segmented as before', () => {
    const prose = { kind: 'markdown' as const, markdown: 'No figure here.\n\n**Diagram summary 1.**' };
    expect(splitAcceptedFigureSegments([prose])[0]).toBe(prose);
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION).content;
    expect(predecessor).not.toContain('MATRIX_FIGURE_PLACEMENT');
    expect(predecessor).not.toMatch(/\[\]\{#/);
    expect(paperInlineSegments(predecessor).some((segment) => segment.kind === 'accepted-figure' || segment.kind === 'accepted-figure-unavailable')).toBe(false);
    expect(buildPandocAnchorMap(loadRevisedPaperStructure())).toEqual({});
  });
});

describe('accepted figures: bound to one paper', () => {
  it('fails closed for any text under another version or another paper hash', () => {
    const content = '# Paper\n\nText.\n';
    expect(() => authenticateAcceptedFigures({ content, manifest: { source: { version: R5_PAPER_VERSION, sha256: '0'.repeat(64) } } })).toThrow('accepted figures: contract is bound to another paper');
    expect(() => authenticateAcceptedFigures({ content, manifest: { source: { version: REVISED_PAPER_VERSION, sha256: contract.paperSha256 } } })).toThrow(`accepted figures: no contract for ${REVISED_PAPER_VERSION}`);
    // Under the bound hash, a text with no placements is refused by its count.
    expect(() => authenticateAcceptedFigures({ content, manifest: { source: { version: R5_PAPER_VERSION, sha256: contract.paperSha256 } } })).toThrow('accepted figures: placement count 0');
  });
});

describe('figure lab proposals stay out of the stakeholder paper: the predecessor', () => {
  it('keeps PX-1 through PX-4 available to the figure lab from the predecessor, still not inline', () => {
    expect(DERIVED_FIGURES.map((spec) => spec.id)).toEqual(['PX-1', 'PX-2', 'PX-3', 'PX-4']);
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION).content;
    const lab = paperMarkdownSegments(predecessor).flatMap((segment) => (segment.kind === 'figure' && segment.binding?.kind === 'derived' ? [segment.binding] : []));
    expect(lab.map((binding) => binding.id).sort()).toEqual(['PX-1', 'PX-2', 'PX-3', 'PX-4']);
    for (const binding of lab) expect(binding.status).toBe('proposed');
    expect(paperInlineSegments(predecessor).some((segment) => segment.kind === 'figure' && segment.binding?.kind === 'derived')).toBe(false);
  });
});

describePrivate('accepted assets (private fixture): exact bytes', () => {
  it('holds exactly the 17 accepted PNGs, each with the bound hash, byte count and pixel size', () => {
    expect(fs.readdirSync(path.dirname(privateFigurePath('x'))).sort()).toEqual(contract.assets.map((asset) => asset.file).sort());
    const mismatched = contract.assets.filter((asset) => {
      const bytes = readPrivateFigure(asset.file);
      const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && bytes.toString('ascii', 12, 16) === 'IHDR';
      return !png || bytes.byteLength !== asset.bytes || sha(bytes) !== asset.sha256 || bytes.readUInt32BE(16) !== asset.width || bytes.readUInt32BE(20) !== asset.height;
    }).map((asset) => asset.id);
    expect(mismatched).toEqual([]);
  });
});

describePrivate('accepted placements (private fixture): authenticated against the artifact', () => {
  /** The artifact with its lines edited, under the artifact's own manifest, as authenticateAcceptedFigures sees it. */
  function outcome(edit: (lines: string[], blockOf: (figureId: string) => AcceptedFigureBlock) => void): string {
    const structure = privateR5Structure();
    const lines = structure.content.split('\n');
    const blocks = findAcceptedFigureBlocks(lines);
    edit(lines, (figureId) => blocks.find((candidate) => candidate.figureId === figureId)!);
    try {
      authenticateAcceptedFigures({ content: lines.join('\n'), manifest: structure.manifest });
      return 'authenticated';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  }
  const sectionAnchorLineAbove = (lines: readonly string[], from: number): number => {
    for (let cursor = from - 1; cursor >= 0; cursor -= 1) if (/^<div id="[^"]+" class="section-anchor"><\/div>$/.test(lines[cursor])) return cursor;
    return -1;
  };

  it('authenticates all 20 placements against the artifact, each block hashing to its bound text', () => {
    const structure = privateR5Structure();
    expect(authenticateAcceptedFigures(structure)).toBe(contract);
    const blocks = findAcceptedFigureBlocks(structure.content.split('\n'));
    expect(blocks).toHaveLength(20);
    for (const [index, block] of blocks.entries()) {
      const binding = resolveAcceptedFigure(block);
      expect(binding?.placement).toBe(contract.placements[index]);
      expect(block.startLine + 1).toBe(contract.placements[index].markerLine);
      expect(sha(acceptedFigureBlockText(block.content!))).toBe(contract.placements[index].textSha256);
      expect(binding !== null && binding.caption === block.content!.caption && binding.status === block.content!.status && binding.alt === block.content!.alt).toBe(true);
      expect(binding !== null && binding.alt.trim().length > 0 && binding.status.trim().length > 0).toBe(true);
    }
    expect(outcome(() => {})).toBe('authenticated');
  });

  it('places every figure in its bound section, which is a real section of the release', () => {
    const structure = privateR5Structure();
    const legacy = buildLegacyAnchorMap(structure);
    const lines = structure.content.split('\n');
    for (const placement of contract.placements) {
      const anchorLine = sectionAnchorLineAbove(lines, placement.markerLine - 1);
      expect(anchorLine).toBeGreaterThanOrEqual(0);
      expect(lines[anchorLine] === `<div id="${placement.sectionAnchor}" class="section-anchor"></div>`).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(legacy, placement.sectionAnchor)).toBe(true);
    }
  });

  it('fails closed when the text of a block is not the bound text: caption, status or alternative text', () => {
    expect(outcome((lines, blockOf) => { lines[blockOf('7-1').startLine + 2] += ' revised'; })).toBe('accepted figures: placement text 7-1');
    expect(outcome((lines, blockOf) => { lines[blockOf('H-1').startLine + 4] = '**Status: SYNTHETIC**'; })).toBe('accepted figures: placement text H-1');
    expect(outcome((lines, blockOf) => { const line = blockOf('7-7').startLine + 6; lines[line] = lines[line].replace('](assets/', ' revised](assets/'); })).toBe('accepted figures: placement text 7-7');
    // The two placements of one asset have the same status and alternative text and different captions.
    expect(outcome((lines, blockOf) => { const first = blockOf('7-1').startLine + 2; const second = blockOf('B-1').startLine + 2; [lines[first], lines[second]] = [lines[second], lines[first]]; })).toBe('accepted figures: placement content 7-1');
  });

  it('fails closed when a block does not resolve to its placement', () => {
    expect(outcome((lines, blockOf) => { lines[blockOf('7-1').startLine + 2] = '[]{#fig-7-1}Figure 7-9. A synthetic caption.'; })).toBe('accepted figures: placement content 7-1');
    expect(outcome((lines, blockOf) => { const line = blockOf('G-2').startLine + 6; lines[line] = lines[line].replace('](assets/FIGG2.png)', '](assets/FIGG3.png)'); })).toBe('accepted figures: placement content G-2');
    expect(outcome((lines, blockOf) => { lines[blockOf('6-1').startLine + 4] = 'Status: SYNTHETIC'; })).toBe('accepted figures: placement content 6-1');
  });

  it('fails closed when a marker is renumbered, removed or moved, or a section anchor changes above it', () => {
    expect(outcome((lines, blockOf) => { lines[blockOf('G-3').startLine] = '<!-- MATRIX_FIGURE_PLACEMENT: G-9 -->'; })).toBe('accepted figures: placement order G-9');
    expect(outcome((lines, blockOf) => { lines.splice(blockOf('H-1').startLine, 1); })).toBe('accepted figures: placement count 19');
    expect(outcome((lines, blockOf) => { lines[sectionAnchorLineAbove(lines, blockOf('H-1').startLine)] = '<div id="app-x" class="section-anchor"></div>'; })).toBe('accepted figures: placement section H-1');
    expect(outcome((lines, blockOf) => { lines.splice(blockOf('7-2').startLine, 0, '<div id="sec-7-9" class="section-anchor"></div>'); })).toBe('accepted figures: placement line 7-2');
  });

  it('fails closed for shapes the block finder cannot see: they must fail the release, not stay in the prose', () => {
    expect(outcome((lines, blockOf) => { lines.splice(blockOf('H-1').startLine, 0, '<!--matrix_figure_placement: 9-9-->', ''); })).toBe('accepted figures: placement marker spelling 21');
    expect(outcome((lines, blockOf) => { lines.splice(blockOf('H-1').startLine, 0, '![An unbound image.](assets/FIG9-9.png)', ''); })).toBe('accepted figures: asset image outside a placement 21');
  });

  it('fails closed when the contract is bound to another paper', () => {
    const structure = privateR5Structure();
    const failure = (source: Parameters<typeof authenticateAcceptedFigures>[0]): string => {
      try {
        authenticateAcceptedFigures(source);
        return 'authenticated';
      } catch (error) {
        return error instanceof Error ? error.message : 'unknown';
      }
    };
    expect(failure({ content: structure.content, manifest: { source: { version: R5_PAPER_VERSION, sha256: '0'.repeat(64) } } })).toBe('accepted figures: contract is bound to another paper');
    expect(failure({ content: structure.content, manifest: { source: { version: REVISED_PAPER_VERSION, sha256: structure.manifest.source.sha256 } } })).toBe(`accepted figures: no contract for ${REVISED_PAPER_VERSION}`);
  });
});

describePrivate('accepted figure segments (private fixture)', () => {
  it('draws all 20 placements from the reader chunks, each exactly once and in its bound section', () => {
    const structure = privateR5Structure();
    const legacy = buildLegacyAnchorMap(structure);
    const drawn = new Map<string, string>();
    let unavailable = 0;
    let repeated = 0;
    for (const chunk of buildPaperChunks(structure)) {
      for (const segment of paperInlineSegments(chunk.markdown)) {
        if (segment.kind === 'accepted-figure-unavailable') unavailable += 1;
        if (segment.kind !== 'accepted-figure') continue;
        if (drawn.has(segment.figure.placement.figureId)) repeated += 1;
        drawn.set(segment.figure.placement.figureId, chunk.anchor ?? '');
      }
    }
    expect([unavailable, repeated]).toEqual([0, 0]);
    expect([...drawn.keys()]).toEqual(contract.placements.map((placement) => placement.figureId));
    // The chunk that draws a figure lies inside the placement's stable section:
    // it is that section's heading or a heading after it and before the next stable section.
    const order = structure.nodes.map((node) => node.anchor);
    const stableStarts = Object.values(legacy).map((anchor) => order.indexOf(anchor)).sort((a, b) => a - b);
    for (const placement of contract.placements) {
      const sectionStart = order.indexOf(legacy[placement.sectionAnchor]);
      const sectionEnd = stableStarts.find((index) => index > sectionStart) ?? order.length;
      const chunkIndex = order.indexOf(drawn.get(placement.figureId) ?? '');
      expect(chunkIndex).toBeGreaterThanOrEqual(sectionStart);
      expect(chunkIndex).toBeLessThan(sectionEnd);
    }
    for (const figureId of FORMERLY_MISSING) expect(drawn.has(figureId)).toBe(true);
  });

  it('draws each figure with the text of its own block, and a shared asset under each placement own caption', () => {
    const structure = privateR5Structure();
    const figures = buildPaperChunks(structure).flatMap((chunk) => paperInlineSegments(chunk.markdown)).flatMap((segment) => (segment.kind === 'accepted-figure' ? [segment.figure] : []));
    expect(figures).toHaveLength(20);
    // What the reader shows hashes to what the placement binds.
    expect(figures.filter((figure) => sha(acceptedFigureBlockText(figure)) !== figure.placement.textSha256)).toHaveLength(0);
    const of = (figureId: string) => figures.find((figure) => figure.placement.figureId === figureId)!;
    const shared = of('B-1');
    const first = of('7-1');
    expect(shared.asset).toBe(first.asset);
    expect([shared.asset.id, shared.asset.file]).toEqual(['FIG7-1B1', 'FIG7-1B1.png']);
    expect(shared.status === first.status && shared.alt === first.alt).toBe(true);
    expect(shared.caption === first.caption).toBe(false);
    const split = splitAcceptedFigureCaption({ figureId: 'B-1', caption: shared.caption });
    expect(split.label).toBe('Figure B-1.');
    expect(`${split.label} ${split.text}` === shared.caption).toBe(true);
    expect(acceptedFigureAssetHref(shared)).toBe(`/api/matrix-options/paper/v/${R5_PAPER_VERSION}/figures/FIG7-1B1.png?sha256=${shared.asset.sha256}`);
  });

  it('leaves no raw marker, anchor span, status line or image syntax in the prose around a figure', () => {
    const structure = privateR5Structure();
    let leaks = 0;
    for (const chunk of buildPaperChunks(structure)) {
      for (const segment of paperInlineSegments(chunk.markdown)) {
        if (segment.kind !== 'markdown') continue;
        // A figure's status is a whole line of its own. (Appendix prose also opens some
        // paragraphs with a bold "Status: ..." lead; that is paper text and stays.)
        if (segment.markdown.includes('MATRIX_FIGURE_PLACEMENT') || /\[\]\{#/.test(segment.markdown) || /!\[[^\]]*\]\(assets\//.test(segment.markdown) || /^\*\*Status: [^*]+\*\*[ \t]*$/m.test(segment.markdown)) leaks += 1;
      }
    }
    expect(leaks).toBe(0);
    // The status pattern is not vacuous: the raw source carries exactly 20 such lines.
    expect(structure.content.match(/^\*\*Status: [^*]+\*\*[ \t]*$/gm)).toHaveLength(20);
  });

  it('maps every List-of-Figures and List-of-Tables target to the section that holds it', () => {
    const structure = privateR5Structure();
    const anchors = new Set(structure.nodes.map((node) => node.anchor));
    const map = buildPandocAnchorMap(structure);
    const targets = Array.from(structure.content.matchAll(/\]\(#((?:fig|tbl)-[a-z0-9-]+)\)/g), (match) => match[1]);
    expect(targets).toHaveLength(29);
    expect(targets.filter((target) => !anchors.has(map[target]))).toHaveLength(0);
    expect(Object.keys(map).filter((id) => id.startsWith('fig-'))).toHaveLength(20);
  });

  it('never draws a derived PX figure, a semantic redraw or a diagram-summary figure inline', () => {
    let inlineFigures = 0;
    let labFigures = 0;
    for (const chunk of buildPaperChunks(privateR5Structure())) {
      // Inline reader path: accepted PNGs only.
      if (paperInlineSegments(chunk.markdown).some((segment) => segment.kind === 'figure')) inlineFigures += 1;
      // Even the figure-lab path (which applies derived figures) finds no PX source block.
      if (paperMarkdownSegments(chunk.markdown).some((segment) => segment.kind === 'figure')) labFigures += 1;
    }
    expect([inlineFigures, labFigures]).toEqual([0, 0]);
  });
});
