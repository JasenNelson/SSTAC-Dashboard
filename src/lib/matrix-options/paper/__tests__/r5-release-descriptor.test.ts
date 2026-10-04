import { createHash } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * The release table says three things about a paper's SHAPE that the compiler relies on:
 * whether it opens with front matter, how far its heading levels are shifted, and whether
 * it carries accepted figures. The paper bytes are fixed by their hash, so these checks can
 * only ever fire when the TABLE is wrong for the bytes. That is exactly the mistake a later
 * release entry could make, so each one is driven here by handing the compiler a paper with
 * one table field changed:
 * - the default release's real bytes, and a synthetic paper bound in place of R5, always;
 * - the real R5 artifact where the private fixture is available.
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

import { describeAuthenticatedPaper, loadRevisedPaper } from '../../revised-paper';
import type { RevisedPaperDescriptor } from '../../revised-paper';
import { compileRevisedPaperStructure } from '../../revised-paper-structure';
import { DEFAULT_PAPER_VERSION, getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { describePrivate, readPrivatePresentation } from './private-fixture';

const sha = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

function withTable(version: string, patch: Record<string, unknown>) {
  override.version = version;
  override.patch = patch;
}

/** A synthetic paper bound in place of R5: the table names its bytes and hash, and its shape as given. */
function bindSynthetic(content: string, shape: Record<string, unknown>): RevisedPaperDescriptor {
  withTable(R5_PAPER_VERSION, { bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content), frontMatter: false, headingDepthShift: 0, acceptedFigures: false, contentsHeadingDisplay: null, withheld: null, ...shape });
  return describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, content);
}

const BODY = 'Paper\n\nText.\n\n# Technical Appendices Compendium\n\nMore text.\n';
const FRONT_MATTER = '---\ntitle: "A synthetic paper"\n---\n\n';

afterEach(() => {
  override.version = null;
  override.patch = {};
});

describe('release table shape checks: the default release (real bytes, one table field wrong)', () => {
  it('two-sided: the default release compiles when the table is as bound', () => {
    expect(compileRevisedPaperStructure(loadRevisedPaper(DEFAULT_PAPER_VERSION)).nodes.length).toBeGreaterThan(0);
  });

  it('refuses the default paper when the table says it opens with front matter', () => {
    const predecessor = loadRevisedPaper(DEFAULT_PAPER_VERSION);
    withTable(DEFAULT_PAPER_VERSION, { frontMatter: true });
    expect(() => compileRevisedPaperStructure(predecessor)).toThrow(/front matter does not match the release/);
  });

  it('refuses the default paper under a heading depth shift that does not put its shallowest heading at depth 1', () => {
    const predecessor = loadRevisedPaper(DEFAULT_PAPER_VERSION);
    withTable(DEFAULT_PAPER_VERSION, { headingDepthShift: 1 });
    expect(() => compileRevisedPaperStructure(predecessor)).toThrow(/heading depth shift does not match the source/);
  });

  it('carries no figure placement marker, which is why it compiles with no figure contract', () => {
    expect(loadRevisedPaper(DEFAULT_PAPER_VERSION).content.includes('MATRIX_FIGURE_PLACEMENT')).toBe(false);
  });
});

describe('release table shape checks: a synthetic paper bound in place of R5', () => {
  it('two-sided: each shape compiles when the table matches it', () => {
    expect(compileRevisedPaperStructure(bindSynthetic(`# ${BODY}`, {})).nodes.map((node) => node.depth)).toEqual([1, 1]);
    expect(compileRevisedPaperStructure(bindSynthetic(`${FRONT_MATTER}# ${BODY}`, { frontMatter: true })).nodes.map((node) => node.depth)).toEqual([1, 1]);
    expect(compileRevisedPaperStructure(bindSynthetic(`# ${BODY}`.replace(/^# /gm, '## '), { headingDepthShift: 1 })).nodes.map((node) => node.depth)).toEqual([1, 1]);
  });

  it('refuses a paper whose front matter does not match the table, in both directions', () => {
    expect(() => compileRevisedPaperStructure(bindSynthetic(`${FRONT_MATTER}# ${BODY}`, { frontMatter: false }))).toThrow(/front matter does not match the release/);
    expect(() => compileRevisedPaperStructure(bindSynthetic(`# ${BODY}`, { frontMatter: true }))).toThrow(/front matter does not match the release/);
  });

  it('refuses a heading depth shift that does not put the shallowest authored heading at depth 1, in both directions', () => {
    expect(() => compileRevisedPaperStructure(bindSynthetic(`# ${BODY}`.replace(/^# /gm, '## '), { headingDepthShift: 0 }))).toThrow(/heading depth shift does not match the source/);
    expect(() => compileRevisedPaperStructure(bindSynthetic(`# ${BODY}`, { headingDepthShift: 1 }))).toThrow(/heading depth shift does not match the source/);
  });

  it('refuses a figure placement marker in a release the table says has no accepted figures', () => {
    const withMarker = `# ${BODY}\n<!-- MATRIX_FIGURE_PLACEMENT: 1-1 -->\n`;
    expect(() => compileRevisedPaperStructure(bindSynthetic(withMarker, { acceptedFigures: false }))).toThrow(/figure placement marker in a release with no accepted figures/);
    // Two-sided: the compiler itself accepts the marker when the table says the release has figures.
    expect(compileRevisedPaperStructure(bindSynthetic(withMarker, { acceptedFigures: true })).nodes).toHaveLength(2);
  });
});

describePrivate('release table shape checks: the real R5 artifact (private fixture), one table field wrong', () => {
  const r5 = (): RevisedPaperDescriptor => describeAuthenticatedPaper(getPaperRelease(R5_PAPER_VERSION)!, readPrivatePresentation());
  const failure = (descriptor: RevisedPaperDescriptor): string => {
    try {
      compileRevisedPaperStructure(descriptor);
      return 'compiled';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  };

  it('two-sided: the artifact compiles when the table is as bound', () => {
    expect(failure(r5())).toBe('compiled');
  });

  it('refuses the artifact when the table says it has no front matter', () => {
    const descriptor = r5();
    withTable(R5_PAPER_VERSION, { frontMatter: false });
    expect(failure(descriptor)).toMatch(/front matter does not match the release/);
  });

  it('refuses the artifact under a heading depth shift of zero', () => {
    const descriptor = r5();
    withTable(R5_PAPER_VERSION, { headingDepthShift: 0 });
    expect(failure(descriptor)).toMatch(/heading depth shift does not match the source/);
  });

  it('refuses the artifact, which carries placement markers, when the table says it has no accepted figures', () => {
    const descriptor = r5();
    expect(descriptor.content.includes('MATRIX_FIGURE_PLACEMENT')).toBe(true);
    withTable(R5_PAPER_VERSION, { acceptedFigures: false });
    expect(failure(descriptor)).toMatch(/figure placement marker in a release with no accepted figures/);
  });
});
