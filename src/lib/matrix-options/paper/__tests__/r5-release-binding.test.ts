import { createHash } from 'node:crypto';
import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  DEFAULT_PAPER_VERSION,
  getDefaultPaperRelease,
  getPaperRelease,
  isPaperReleaseVersion,
  PAPER_RELEASES,
  PAPER_WITHHELD_NOTICE_ID,
  paperReleaseIdentity,
  paperReleaseRelativePath,
  paperReleaseSidecarRelativePath,
  paperReleaseSourceLabel,
  R5_PAPER_VERSION,
  V0991_PAPER_VERSION,
} from '../releases';
import {
  describeAuthenticatedPaper,
  loadRevisedPaper,
  REVISED_PAPER_BYTES,
  REVISED_PAPER_FILENAME,
  REVISED_PAPER_RELATIVE_PATH,
  REVISED_PAPER_RELEASE_IDENTITY,
  REVISED_PAPER_ROUTE,
  REVISED_PAPER_SHA256,
  REVISED_PAPER_VERSION,
  RevisedPaperUnavailableError,
} from '../../revised-paper';
import {
  compileRevisedPaperStructure,
  loadRevisedPaperStructure,
  resetRevisedPaperStructureCacheForTests,
} from '../../revised-paper-structure';
import { MATRIX_OPTIONS_PAPER_REVIEW_ROUTE } from '../../navigation';
import { buildPaperChunks } from '../full-document';
import { getPaperSectionWindowModel } from '../section-window';
import { describePrivate, readPrivatePresentation, readPrivatePresentationBytes } from './private-fixture';
import { privateR5Descriptor, privateR5Structure } from './private-structure';

/*
 * Unit 1: exact release binding.
 *
 * The current review draft (R5 in the code) is bound beside the predecessor as a
 * second, SELECTABLE release whose bytes are NOT in the repository: it is a
 * `private-storage` release. The predecessor stays the default and is unchanged.
 *
 * What can be shown without the private bytes runs everywhere: the release
 * entry, the absence of any repository loader for it, and the failure of every
 * text that is not the bound artifact. What needs the bytes is a
 * `describePrivate` suite and asserts hashes, counts and booleans only.
 */

const R5_SHA256 = 'c215b125757bbc0294f6ea904f7e4236a39d8912c137f226bb6148cced804c84';
const R5_BYTES = 562836;
const R5_IDENTITY = `matrix-options-paper:${R5_PAPER_VERSION}:${R5_SHA256}`;
const sha = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const r5Release = getPaperRelease(R5_PAPER_VERSION)!;

afterEach(() => {
  vi.restoreAllMocks();
  resetRevisedPaperStructureCacheForTests();
});

describe('paper releases: review drafts are selectable and non-default', () => {
  it('binds the three releases in lineage order, with the predecessor as the only default', () => {
    expect(PAPER_RELEASES.map((release) => release.documentVersion)).toEqual([DEFAULT_PAPER_VERSION, R5_PAPER_VERSION, V0991_PAPER_VERSION]);
    expect(PAPER_RELEASES.filter((release) => release.activation === 'DEFAULT').map((release) => release.documentVersion)).toEqual([DEFAULT_PAPER_VERSION]);
    expect(getDefaultPaperRelease().documentVersion).toBe(DEFAULT_PAPER_VERSION);
    expect(r5Release.activation).toBe('SELECTABLE_NON_DEFAULT');
    expect(R5_PAPER_VERSION).toBe('v0.9.88-r4-presentation-001');
    expect(getPaperRelease(V0991_PAPER_VERSION)).toMatchObject({
      delivery: 'private-storage',
      filename: null,
      activation: 'SELECTABLE_NON_DEFAULT',
      predecessorVersion: R5_PAPER_VERSION,
    });
  });

  it('keeps every default constant, route and review route on the predecessor', () => {
    expect(DEFAULT_PAPER_VERSION).toBe(REVISED_PAPER_VERSION);
    expect(REVISED_PAPER_VERSION).toBe('1.0.11-remediated-7-8-successor-20260918-D');
    expect(REVISED_PAPER_ROUTE).toBe(`/matrix-options/paper/v/${REVISED_PAPER_VERSION}`);
    expect(MATRIX_OPTIONS_PAPER_REVIEW_ROUTE).toBe(`/matrix-options/paper/review/v/${REVISED_PAPER_VERSION}`);
    const predecessor = getPaperRelease(REVISED_PAPER_VERSION);
    expect(predecessor).toMatchObject({ sha256: REVISED_PAPER_SHA256, bytes: REVISED_PAPER_BYTES, delivery: 'repository', filename: REVISED_PAPER_FILENAME, provenance: null, headingDepthShift: 0, frontMatter: false, acceptedFigures: false, predecessorVersion: null });
    expect(paperReleaseIdentity(predecessor!)).toBe(REVISED_PAPER_RELEASE_IDENTITY);
    expect(paperReleaseRelativePath(predecessor!)).toBe(REVISED_PAPER_RELATIVE_PATH);
    expect(paperReleaseSidecarRelativePath(predecessor!)).toBe(`${REVISED_PAPER_RELATIVE_PATH}.sha256`);
    expect(paperReleaseSourceLabel(predecessor!)).toBe(REVISED_PAPER_RELATIVE_PATH);
  });

  it('binds the R5 artifact by version, hash and byte count, as a private-storage release with the predecessor as its lineage parent', () => {
    expect(r5Release).toMatchObject({ sha256: R5_SHA256, bytes: R5_BYTES, delivery: 'private-storage', filename: null, headingDepthShift: 1, frontMatter: true, acceptedFigures: true, predecessorVersion: REVISED_PAPER_VERSION });
    expect(paperReleaseIdentity(r5Release)).toBe(R5_IDENTITY);
    // The artifact was derived from a larger source, named by hash only.
    expect(r5Release.provenance).toEqual({
      sourceVersion: 'v0.9.88-run106-r4-c1-c3-001',
      sourceSha256: '561eef1aee9806c257936299bf9f7d4ccb89bcaa5de756c6f0ca77517805e020',
      sourceBytes: 588609,
      sourceManifestSha256: '8846254f358cd322bf9509f8dd8976dd690004d4bd6d558bf4511df77138eeff',
      derivation: 'source-prefix',
    });
    expect(r5Release.bytes).toBeLessThan(r5Release.provenance!.sourceBytes);
    expect(r5Release.sha256).not.toBe(r5Release.provenance!.sourceSha256);
  });

  it('gives a private-storage release no repository path: its source is named by a label, never by a location', () => {
    expect(paperReleaseRelativePath(r5Release)).toBeNull();
    expect(paperReleaseSidecarRelativePath(r5Release)).toBeNull();
    expect(paperReleaseSourceLabel(r5Release)).toBe(`presentation:${R5_PAPER_VERSION}`);
    // A repository entry with no file name has no path either.
    expect(paperReleaseRelativePath({ delivery: 'repository', filename: null })).toBeNull();
    expect(paperReleaseSidecarRelativePath({ delivery: 'private-storage', filename: 'x.md' })).toBeNull();
    // Nothing in the entry names a file, a folder or a file of the source it was derived from.
    expect(JSON.stringify(r5Release)).not.toMatch(/candidate\/|\.md|\.png|assets\//);
    expect(PAPER_WITHHELD_NOTICE_ID).toBe('paper-withheld-notice');
  });

  it('resolves only the exact bound versions: no prefix, case or whitespace match, no source version, and no fallback to the default', () => {
    for (const version of ['', 'v0.9.88', 'V0.9.88-R4-PRESENTATION-001', ` ${R5_PAPER_VERSION}`, `${R5_PAPER_VERSION} `, r5Release.provenance!.sourceVersion, '1.0.11', '__proto__', 'constructor']) {
      expect(isPaperReleaseVersion(version)).toBe(false);
      expect(getPaperRelease(version)).toBeNull();
    }
    expect(getPaperRelease(undefined)).toBeNull();
    expect(getPaperRelease(null)).toBeNull();
    expect(isPaperReleaseVersion(R5_PAPER_VERSION)).toBe(true);
    expect(isPaperReleaseVersion(REVISED_PAPER_VERSION)).toBe(true);
  });

  it('retires the two predecessor 7.8 subsection ids to sec-7-8, for navigation only', () => {
    expect(r5Release.retiredSectionAnchors).toEqual({ 'sec-7-8-1': 'sec-7-8', 'sec-7-8-2': 'sec-7-8' });
    expect(getPaperRelease(REVISED_PAPER_VERSION)?.retiredSectionAnchors).toEqual({});
  });
});

describe('repository loaders: unavailable for the private-storage release, unchanged for the default', () => {
  it('loadRevisedPaper refuses R5 before any file is read', () => {
    const read = vi.spyOn(fs, 'readFileSync');
    expect(() => loadRevisedPaper(R5_PAPER_VERSION)).toThrow(RevisedPaperUnavailableError);
    expect(read).not.toHaveBeenCalled();
  });

  it('loadRevisedPaperStructure refuses R5, every time, and caches nothing for it', () => {
    expect(() => loadRevisedPaperStructure(R5_PAPER_VERSION)).toThrow(RevisedPaperUnavailableError);
    expect(() => loadRevisedPaperStructure(R5_PAPER_VERSION)).toThrow(RevisedPaperUnavailableError);
  });

  it('refuses an unknown or absent version with no fallback to the default', () => {
    for (const version of [undefined, '', 'unknown', r5Release.provenance!.sourceVersion]) {
      expect(() => loadRevisedPaper(version)).toThrow(RevisedPaperUnavailableError);
    }
  });

  it('still loads the predecessor, byte for byte, with no argument and by its version', () => {
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    expect(Object.isFrozen(predecessor)).toBe(true);
    expect(predecessor).toMatchObject({ documentVersion: REVISED_PAPER_VERSION, sha256: REVISED_PAPER_SHA256, bytes: REVISED_PAPER_BYTES, releaseIdentity: REVISED_PAPER_RELEASE_IDENTITY });
    expect(Buffer.byteLength(predecessor.content, 'utf8')).toBe(REVISED_PAPER_BYTES);
    expect(sha(predecessor.content)).toBe(REVISED_PAPER_SHA256);
    expect(predecessor.content.startsWith('# Matrix Sediment Standards Options Paper')).toBe(true);
    // A refused R5 load leaves the predecessor loadable.
    expect(() => loadRevisedPaper(R5_PAPER_VERSION)).toThrow(RevisedPaperUnavailableError);
    expect(loadRevisedPaper(REVISED_PAPER_VERSION).sha256).toBe(REVISED_PAPER_SHA256);
  });

  it('leaves the predecessor structure exactly as it was: no presentation field, authored depths, its repository path', () => {
    const structure = loadRevisedPaperStructure();
    expect(structure.manifest.source).toEqual({ path: REVISED_PAPER_RELATIVE_PATH, version: REVISED_PAPER_VERSION, releaseIdentity: REVISED_PAPER_RELEASE_IDENTITY, bytes: REVISED_PAPER_BYTES, sha256: REVISED_PAPER_SHA256 });
    expect('presentation' in structure).toBe(false);
    expect('presented' in structure.manifest).toBe(false);
    expect(structure.nodes[0]).toMatchObject({ depth: 1, label: 'Matrix Sediment Standards Options Paper' });
    expect(loadRevisedPaperStructure(REVISED_PAPER_VERSION)).toBe(structure);
  });
});

describe('describeAuthenticatedPaper: the bound artifact or nothing', () => {
  it('describes the predecessor text under the predecessor entry, and nothing else under it', () => {
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    const release = getPaperRelease(REVISED_PAPER_VERSION)!;
    const described = describeAuthenticatedPaper(release, predecessor.content);
    expect(Object.isFrozen(described)).toBe(true);
    expect(described).toEqual(predecessor);
    expect(() => describeAuthenticatedPaper(release, `${predecessor.content.slice(0, -1)}`)).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(release, `${predecessor.content.slice(0, -2)}X\n`)).toThrow(RevisedPaperUnavailableError);
  });

  it('refuses, under the R5 entry, any text that is not the bound artifact: a wrong length, the right length with other content, the predecessor', () => {
    expect(() => describeAuthenticatedPaper(r5Release, '')).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(r5Release, 'x'.repeat(R5_BYTES - 1))).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(r5Release, 'x'.repeat(R5_BYTES + 1))).toThrow(RevisedPaperUnavailableError);
    // Exactly the bound length, so only the hash can refuse it.
    expect(Buffer.byteLength('x'.repeat(R5_BYTES), 'utf8')).toBe(r5Release.bytes);
    expect(() => describeAuthenticatedPaper(r5Release, 'x'.repeat(R5_BYTES))).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(r5Release, loadRevisedPaper(REVISED_PAPER_VERSION).content)).toThrow(RevisedPaperUnavailableError);
  });

  it('the compiler refuses a descriptor whose identity, hash or length belongs to another release', () => {
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    expect(() => compileRevisedPaperStructure({ ...predecessor, releaseIdentity: R5_IDENTITY })).toThrow(/release identity mismatch/);
    expect(() => compileRevisedPaperStructure({ ...predecessor, documentVersion: R5_PAPER_VERSION })).toThrow(/release identity mismatch/);
    expect(() => compileRevisedPaperStructure({ ...predecessor, documentVersion: R5_PAPER_VERSION, releaseIdentity: R5_IDENTITY })).toThrow(/byte length mismatch/);
    expect(() => compileRevisedPaperStructure({ ...predecessor, documentVersion: R5_PAPER_VERSION, releaseIdentity: R5_IDENTITY, bytes: R5_BYTES, sha256: R5_SHA256 })).toThrow(/byte length mismatch/);
    // A descriptor that claims the bound identity over text of the bound length is refused by its hash.
    expect(() => compileRevisedPaperStructure({ ...predecessor, documentVersion: R5_PAPER_VERSION, releaseIdentity: R5_IDENTITY, bytes: R5_BYTES, sha256: R5_SHA256, content: 'x'.repeat(R5_BYTES) })).toThrow(/SHA-256 mismatch/);
    expect(() => compileRevisedPaperStructure({ ...predecessor, sha256: R5_SHA256 })).toThrow(/SHA-256 mismatch/);
  });
});

describePrivate('R5 artifact (private fixture): exact bytes', () => {
  it('is the bound artifact: length, hash, LF only, plain ASCII, ending with a line feed', () => {
    const bytes = readPrivatePresentationBytes();
    expect(bytes.byteLength).toBe(R5_BYTES);
    expect(sha(bytes)).toBe(R5_SHA256);
    expect(bytes.includes(0x0d)).toBe(false);
    expect(bytes.some((byte) => byte > 0x7f)).toBe(false);
    expect(bytes[bytes.byteLength - 1]).toBe(0x0a);
  });

  it('describes to a frozen R5 descriptor that carries the whole artifact', () => {
    const paper = privateR5Descriptor();
    expect(Object.isFrozen(paper)).toBe(true);
    expect({ documentVersion: paper.documentVersion, sha256: paper.sha256, bytes: paper.bytes, releaseIdentity: paper.releaseIdentity }).toEqual({ documentVersion: R5_PAPER_VERSION, sha256: R5_SHA256, bytes: R5_BYTES, releaseIdentity: R5_IDENTITY });
    expect(Buffer.byteLength(paper.content, 'utf8')).toBe(R5_BYTES);
    expect(sha(paper.content)).toBe(R5_SHA256);
  });

  it('fails closed when one character of the artifact changes, or it is one character longer or shorter', () => {
    const text = readPrivatePresentation();
    const refused = (candidate: string): boolean => {
      try {
        describeAuthenticatedPaper(r5Release, candidate);
        return false;
      } catch (error) {
        return error instanceof RevisedPaperUnavailableError;
      }
    };
    expect(refused(`${text.slice(0, -2)}${text.at(-2) === 'X' ? 'Y' : 'X'}\n`)).toBe(true);
    expect(refused(`${text}\n`)).toBe(true);
    expect(refused(text.slice(0, -1))).toBe(true);
    // Two-sided: the artifact itself is accepted.
    expect(refused(text)).toBe(false);
  });

  it('is not the predecessor, and is never accepted under the predecessor entry', () => {
    const text = readPrivatePresentation();
    let accepted = true;
    try {
      describeAuthenticatedPaper(getPaperRelease(REVISED_PAPER_VERSION)!, text);
    } catch {
      accepted = false;
    }
    expect(accepted).toBe(false);
    expect(text === loadRevisedPaper(REVISED_PAPER_VERSION).content).toBe(false);
  });
});

describePrivate('R5 structure (private fixture): compiled from the exact artifact', () => {
  it('compiles with depth-1 top-level sections, no front-matter heading and one appendix boundary', () => {
    const structure = privateR5Structure();
    expect(structure.manifest.source).toEqual({ path: `presentation:${R5_PAPER_VERSION}`, version: R5_PAPER_VERSION, releaseIdentity: R5_IDENTITY, bytes: R5_BYTES, sha256: R5_SHA256 });
    expect('presented' in structure.manifest).toBe(false);
    expect(structure.presentation).toEqual({ frontMatter: true, inactiveLinkTargets: ['app-l'], contentsHeadingDisplay: 'Table of Contents' });
    // Every section is authored as `##`: 98 of them. None is deeper than depth 4 after the shift.
    expect(structure.nodes.filter((node) => node.depth === 1)).toHaveLength(98);
    expect(structure.nodes).toHaveLength(340);
    expect(Math.min(...structure.nodes.map((node) => node.depth))).toBe(1);
    expect(Math.max(...structure.nodes.map((node) => node.depth))).toBeLessThanOrEqual(4);
    // The YAML front matter is not a heading.
    expect(structure.nodes.filter((node) => /title:|subtitle:|lang:/.test(node.label))).toHaveLength(0);
    expect(structure.nodes.filter((node) => node.depth === 1 && node.label === 'Technical Appendices Compendium')).toHaveLength(1);
    expect(structure.lines.at(-1)?.endByte).toBe(R5_BYTES);
    expect(structure.manifest.coverage).toEqual({ firstByte: 0, lastByteExclusive: R5_BYTES });
    expect(structure.manifest.counts.headings).toBe(340);
    expect(structure.manifest.counts.figureObjects).toBe(20);
  });

  it('ends every record at or before the end of the artifact, and the tiling exactly at it', () => {
    const structure = privateR5Structure();
    const ends = [
      ...structure.nodes.map((node) => node.endByte),
      ...structure.nodes.map((node) => node.tokenEndByte),
      ...structure.objects.map((object) => object.endByte),
      ...structure.questions.map((question) => question.endByte),
      ...structure.lines.map((line) => line.endByte),
      ...Object.values(structure.lenses).flatMap((placements) => placements.flatMap((placement) => [placement.endByte, ...placement.triggers.flatMap((trigger) => [trigger.endByte, trigger.targetRange?.endByte ?? 0])])),
      ...buildPaperChunks(structure).map((chunk) => chunk.endByte),
    ];
    expect(Math.max(...ends)).toBe(R5_BYTES);
    expect(ends.filter((end) => end > R5_BYTES)).toHaveLength(0);
  });

  it('tiles the artifact into sections that cover every byte exactly once', () => {
    const structure = privateR5Structure();
    const { chunks, groups, totalBytes } = getPaperSectionWindowModel(structure);
    expect(totalBytes).toBe(R5_BYTES);
    expect(groups).toHaveLength(98);
    expect(groups[0].startByte).toBe(0);
    expect(groups.at(-1)?.endByte).toBe(R5_BYTES);
    expect(groups.every((group, index) => index === 0 || group.startByte === groups[index - 1].endByte)).toBe(true);
    expect(new Set(groups.map((group) => group.anchor)).size).toBe(groups.length);
    expect({ id: chunks[0].id, anchor: chunks[0].anchor, startByte: chunks[0].startByte }).toEqual({ id: 'preamble', anchor: null, startByte: 0 });
    expect(chunks.filter((chunk) => Buffer.byteLength(chunk.markdown, 'utf8') > chunk.endByte - chunk.startByte)).toHaveLength(0);
  });

  it('shows the front matter as a title block and never as raw YAML or a raw fenced div', () => {
    const preamble = buildPaperChunks(privateR5Structure())[0].markdown;
    expect(preamble.startsWith('# ')).toBe(true);
    expect(/^---$/m.test(preamble)).toBe(false);
    expect(/^(title|subtitle|author|date|lang):/m.test(preamble)).toBe(false);
    expect(preamble.includes(':::')).toBe(false);
  });

  it('refuses the same text under any other identity, hash or length', () => {
    const r5 = privateR5Descriptor();
    const predecessor = loadRevisedPaper(REVISED_PAPER_VERSION);
    const failure = (descriptor: Parameters<typeof compileRevisedPaperStructure>[0]): string => {
      try {
        compileRevisedPaperStructure(descriptor);
        return 'compiled';
      } catch (error) {
        return error instanceof Error ? error.message : 'unknown';
      }
    };
    expect(failure({ ...r5, releaseIdentity: predecessor.releaseIdentity })).toMatch(/release identity mismatch/);
    expect(failure({ ...r5, documentVersion: REVISED_PAPER_VERSION })).toMatch(/release identity mismatch/);
    expect(failure({ ...r5, sha256: predecessor.sha256 })).toMatch(/SHA-256 mismatch/);
    expect(failure({ ...r5, bytes: R5_BYTES + 1 })).toMatch(/byte length mismatch/);
    expect(failure({ ...r5, content: `${r5.content.slice(0, -2)}${r5.content.at(-2) === 'X' ? 'Y' : 'X'}\n` })).toMatch(/SHA-256 mismatch/);
    expect(failure({ ...r5, content: `${r5.content}\n` })).toMatch(/byte length mismatch/);
  });
});
