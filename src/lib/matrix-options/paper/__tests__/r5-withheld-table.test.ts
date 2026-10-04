import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * What a release entry that leaves a section out makes the COMPILER require of the
 * artifact, driven by the release TABLE. Each test hands the real compiler a paper with
 * one table entry changed (the pattern of r5-release-descriptor.test.ts):
 * - the notice must be one line of text and the stable id an appendix id;
 * - a reference to the withheld section must be a simple link, the one form that is
 *   shown as plain text;
 * - a contents display label must be one line of plain words;
 * - with `withheld: null` none of these rules applies, which is how a later release
 *   entry that contains the section is bound: by its own entry, with no code change.
 * A synthetic paper bound in place of R5 shows each rule everywhere; the real artifact
 * shows the display-label rule where the private fixture is available.
 */
const override = vi.hoisted(() => ({ version: null as string | null, patch: {} as Record<string, unknown> }));

vi.mock('../releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../releases')>();
  return {
    ...actual,
    getPaperRelease: (documentVersion: string | undefined | null) => {
      const release = actual.getPaperRelease(documentVersion);
      return release && release.documentVersion === override.version ? { ...release, ...override.patch } : release;
    },
  };
});

import { describeAuthenticatedPaper } from '../../revised-paper';
import type { RevisedPaperDescriptor } from '../../revised-paper';
import { compileAuthenticatedRelease, compileRevisedPaperStructure } from '../../revised-paper-structure';
import { buildPaperChunks } from '../full-document';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { getPaperSectionWindowModel } from '../section-window';
import { describePrivate, readPrivatePresentation } from './private-fixture';

const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function withTable(patch: Record<string, unknown>) {
  override.version = R5_PAPER_VERSION;
  override.patch = patch;
}

afterEach(() => {
  override.version = null;
  override.patch = {};
});

const WITHHELD = { stableSectionId: 'app-l', notice: 'n' };
const paper = (reference: string, preamble = '') => `${preamble}# Paper\n\nSee ${reference} for the plan.\n\n<div id="sec-appendices" class="section-anchor"></div>\n\n# Technical Appendices Compendium\n\n## Appendix K: A kept part\n\nText.\n`;

/** A synthetic paper bound in place of R5: the table names its bytes and hash, and what it leaves out. */
function bind(content: string, patch: Record<string, unknown> = {}): RevisedPaperDescriptor {
  withTable({ bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content), frontMatter: false, headingDepthShift: 0, acceptedFigures: false, contentsHeadingDisplay: null, withheld: WITHHELD, ...patch });
  return describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, content);
}

describe('a reference to the withheld section must be a simple link (synthetic paper)', () => {
  it('baseline: the paper compiles when the reference is a simple inline link, and that link is shown as text', () => {
    const structure = compileRevisedPaperStructure(bind(paper('[the appendix](#app-l)')));
    expect(structure.presentation).toEqual({ frontMatter: false, inactiveLinkTargets: ['app-l'] });
    const shown = buildPaperChunks(structure).map((chunk) => chunk.markdown).join('');
    expect(shown).toContain('See the appendix for the plan.');
    expect(shown).not.toContain('#app-l');
  });

  it('the preamble (the text before the first heading) shows a simple link to the withheld section as text too', () => {
    const chunks = buildPaperChunks(compileRevisedPaperStructure(bind(paper('[the appendix](#app-l)', 'Before the title, see [the appendix](#app-l) and [the kept part](#sec-appendices).\n\n'))));
    expect(chunks[0].nodeId).toBeNull();
    expect(chunks[0].markdown).toContain('Before the title, see the appendix and [the kept part](#sec-appendices).');
    expect(chunks.map((chunk) => chunk.markdown).join('')).not.toContain('#app-l');
  });

  it.each([
    ['a link with a title', '[the appendix](#app-l "Appendix")'],
    ['an image', '![the appendix](#app-l)'],
    ['a bare reference', 'the appendix (#app-l)'],
    ['a link in angle brackets', '[the appendix](<#app-l>)'],
    ['a simple link beside a bare reference', '[the appendix](#app-l) or #app-l'],
  ])('refuses %s', (_name, reference) => {
    expect(() => compileRevisedPaperStructure(bind(paper(reference)))).toThrow('Authenticated revised-paper structure unavailable: a reference to the withheld section is not a simple link');
  });

  it('does not apply the rule to a release that leaves nothing out: the same text compiles, and a section under that id is an ordinary section', () => {
    const content = `${paper('[the appendix](#app-l "Appendix")')}\n<div id="app-l" class="section-anchor"></div>\n\n## Appendix L: A part this release contains\n\nTail body.\n`;
    const structure = compileAuthenticatedRelease(bind(content, { withheld: null, delivery: 'repository' }));
    expect(structure.presentation).toBeUndefined();
    expect(structure.nodes.map((node) => node.label)).toEqual(['Paper', 'Technical Appendices Compendium', 'Appendix K: A kept part', 'Appendix L: A part this release contains']);
  });
});

describe('the withheld entry itself: one-line notice, appendix id (synthetic paper)', () => {
  it('refuses an entry whose notice is not one non-empty line of text', () => {
    for (const notice of ['', '   ', ' padded', 'padded ', 'two\nlines', 'carriage\rreturn', undefined]) {
      expect(() => compileRevisedPaperStructure(bind(paper('[the appendix](#app-l)'), { withheld: { stableSectionId: 'app-l', notice } }))).toThrow('Authenticated revised-paper structure unavailable: the withheld notice is not one line of text');
    }
    // Two-sided: any one-line sentence passes, and the bound notice is one.
    expect(compileRevisedPaperStructure(bind(paper('[the appendix](#app-l)'), { withheld: { stableSectionId: 'app-l', notice: 'One line.' } })).nodes).toHaveLength(3);
    override.version = null;
    const bound = getPaperRelease(R5_PAPER_VERSION)!.withheld!.notice;
    expect(bound).toBe(bound.trim());
    expect(/[\r\n]/.test(bound)).toBe(false);
    expect(bound.length).toBeGreaterThan(0);
  });

  it('refuses a stable id that is not app-<letter>', () => {
    for (const stableSectionId of ['APP-L', 'app-', 'app-ll', 'sec-l', 'app-1', '', 'app-l-extra']) {
      expect(() => compileRevisedPaperStructure(bind(paper('the appendix'), { withheld: { stableSectionId, notice: 'n' } }))).toThrow('Authenticated revised-paper structure unavailable: the withheld stable id form');
    }
    // Two-sided: another appendix letter is a valid id.
    expect(compileRevisedPaperStructure(bind(paper('the appendix'), { withheld: { stableSectionId: 'app-m', notice: 'n' } })).presentation?.inactiveLinkTargets).toEqual(['app-m']);
  });
});

describe('a contents display label must be one line of plain words (synthetic paper)', () => {
  const withContents = `${paper('the appendix')}\n## Master Table of Contents\n\n1. Item\n`;

  it('makes the whole release unavailable, at the compiler, for any other label', () => {
    for (const contentsHeadingDisplay of ['X\n# Injected', '', '*Contents*']) {
      expect(() => compileRevisedPaperStructure(bind(withContents, { contentsHeadingDisplay }))).toThrow('Authenticated revised-paper structure unavailable: the contents display label is not one line of plain words');
    }
    // Two-sided: a label of plain words compiles, and is the label the structure carries.
    expect(compileRevisedPaperStructure(bind(withContents, { contentsHeadingDisplay: 'Contents' })).presentation?.contentsHeadingDisplay).toBe('Contents');
  });
});

describePrivate('what the release table decides for the real artifact (private fixture)', () => {
  const failure = (patch: Record<string, unknown>): string => {
    const descriptor = describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, readPrivatePresentation());
    withTable(patch);
    try {
      compileAuthenticatedRelease(descriptor);
      return 'compiled';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  };

  it('two-sided baseline: the bound entry compiles and presents 98 sections', () => {
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, readPrivatePresentation()));
    expect(getPaperSectionWindowModel(structure).groups).toHaveLength(98);
    expect(failure({})).toBe('compiled');
  });

  it('a display label that is not one line of plain words makes the whole release unavailable', () => {
    for (const contentsHeadingDisplay of ['X\n# Injected', '', '*Contents*']) {
      expect(failure({ contentsHeadingDisplay })).toBe('Authenticated revised-paper structure unavailable: the contents display label is not one line of plain words');
    }
    expect(failure({ contentsHeadingDisplay: 'Contents' })).toBe('compiled');
  });

  it('a notice that is not one line, or a stable id that is not an appendix id, makes the whole release unavailable', () => {
    expect(failure({ withheld: { stableSectionId: 'app-l', notice: 'two\nlines' } })).toBe('Authenticated revised-paper structure unavailable: the withheld notice is not one line of text');
    expect(failure({ withheld: { stableSectionId: 'sec-appendices', notice: 'n' } })).toBe('Authenticated revised-paper structure unavailable: the withheld stable id form');
  });

  it('a stable id that names a section the artifact DOES contain makes the whole release unavailable', () => {
    // Appendix K is in the artifact: an entry that claimed to leave it out is refused.
    expect(failure({ withheld: { stableSectionId: 'app-k', notice: 'n' } })).toMatch(/^Authenticated revised-paper structure unavailable: /);
    expect(failure({ withheld: { stableSectionId: 'app-k', notice: 'n' } })).not.toBe('compiled');
  });
});
