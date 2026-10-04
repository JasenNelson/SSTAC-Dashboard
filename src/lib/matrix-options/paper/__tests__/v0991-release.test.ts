import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const syntheticRelease = vi.hoisted(() => ({ active: false, patch: {} as Record<string, unknown> }));
vi.mock('../releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../releases')>();
  return {
    ...actual,
    getPaperRelease: (documentVersion: string | undefined | null) => {
      const release = actual.getPaperRelease(documentVersion);
      return release && syntheticRelease.active && release.documentVersion === actual.DEFAULT_PAPER_VERSION
        ? { ...release, ...syntheticRelease.patch }
        : release;
    },
  };
});

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { PaperOutlineNav } from '@/components/matrix-options/paper/PaperOutlineNav';
import { PaperText } from '@/components/matrix-options/paper/PaperText';
import { getCohortManifest } from '../../cohort-contract';
import { describeAuthenticatedPaper, RevisedPaperUnavailableError } from '../../revised-paper';
import { compileRevisedPaperStructure } from '../../revised-paper-structure';
import { getReviewerGuideBinding } from '../../reviewer-guide';
import { getAcceptedFiguresContract } from '../accepted-figures';
import { appendixLSourceMediaContract, appendixLSourceMediaMarkdownLine, assertAppendixLSourceMedia } from '../accepted-source-media';
import { paperInlineSegments } from '../derived-figures';
import { getReviewManifest } from '../review-manifest';
import { getPaperSectionWindowModel } from '../section-window';
import { getPaperRelease, DEFAULT_PAPER_VERSION, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '../releases';
import headingContract from '../contracts/heading-anchors-v0.9.91-run109-001.json';
import interfaceDelta from '../contracts/interface-delta-v0.9.91-run109-001.json';

const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

afterEach(() => {
  syntheticRelease.active = false;
  syntheticRelease.patch = {};
});

describe('v0.9.91 release contracts (clean checkout)', () => {
  it('binds the exact version, source identity, activation, anchors, figures, review, and Appendix L metadata', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION);
    expect(release).toMatchObject({
      documentVersion: V0991_PAPER_VERSION,
      sha256: 'a5b1d81d11af23d3437bba4cadcf0a0fa555001be27e9227c6015ff0bad6599e',
      bytes: 607464,
      delivery: 'private-storage',
      filename: null,
      activation: 'SELECTABLE_NON_DEFAULT',
      predecessorVersion: R5_PAPER_VERSION,
      withheld: null,
      acceptedFigures: true,
      frontMatter: true,
      headingDepthShift: 1,
    });
    expect(getPaperRelease(DEFAULT_PAPER_VERSION)?.activation).toBe('DEFAULT');
    expect(release?.retiredSectionAnchors).toEqual(interfaceDelta.retiredSectionAnchors);
    expect(interfaceDelta.releaseIdentity).toBe(V0991_PAPER_VERSION);
    expect(interfaceDelta.headingCount).toBe(364);
    expect(interfaceDelta.stableHeadingCount).toBe(headingContract.headings.length);
    expect(headingContract.headings.at(-1)?.id).toBe('app-l');
    expect(interfaceDelta.appendixL.presentation).toBe('INCLUDED_FROM_AUTHENTICATED_SOURCE');
    const figures = getAcceptedFiguresContract(V0991_PAPER_VERSION)!;
    expect(figures.paperSha256).toBe(release?.sha256);
    expect(figures.assets).toHaveLength(17);
    expect(figures.placements).toHaveLength(20);
    const guide = getReviewerGuideBinding(V0991_PAPER_VERSION);
    expect(guide.questions).toHaveLength(12);
    expect(guide.questions.filter((question) => question.predecessorQuestionId).map((question) => question.number)).toEqual([4, 5, 12]);
    expect(getCohortManifest(V0991_PAPER_VERSION).cohorts).toHaveLength(5);
    expect(getReviewManifest(V0991_PAPER_VERSION).paperSha256).toBe(release?.sha256);
    const media = appendixLSourceMediaContract();
    expect(media).toMatchObject({ releaseIdentity: V0991_PAPER_VERSION, sourceHeadingId: 'app-l', file: 'APPENDIX-L-SOURCE.png', sha256: interfaceDelta.appendixL.sourceMediaSha256, bytes: 270437, width: 1875, height: 913, widthAttribute: '6.5in' });
  });

  it('authenticates synthetic bytes through the production descriptor and rejects byte and hash drift', () => {
    const content = '# Synthetic release\n\nSynthetic text.\n';
    const release = { ...getPaperRelease(V0991_PAPER_VERSION)!, bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content) };
    const descriptor = describeAuthenticatedPaper(release, content);
    expect(descriptor).toMatchObject({ documentVersion: V0991_PAPER_VERSION, bytes: release.bytes, sha256: release.sha256, content });
    expect(() => describeAuthenticatedPaper(release, content.replace('text', 'tExt'))).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(release, `${content}\n`)).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper(release, content.slice(0, -1))).toThrow(RevisedPaperUnavailableError);
    expect(() => describeAuthenticatedPaper({ ...release, sha256: '0'.repeat(64) }, content)).toThrow(RevisedPaperUnavailableError);
  });

  it('validates the exact Appendix L media marker position and rejects marker drift on synthetic text', () => {
    const media = appendixLSourceMediaContract();
    const lines = Array.from({ length: media.sourceLine - 1 }, (_, index) => `Synthetic line ${index + 1}`);
    lines.push(appendixLSourceMediaMarkdownLine());
    const source = lines.join('\n');
    expect(() => assertAppendixLSourceMedia(source)).not.toThrow();
    expect(sha(lines[media.sourceLine - 1])).toBe(media.sourceMarkdownLineSha256);
    expect(() => assertAppendixLSourceMedia(source.replace(media.marker, 'APPENDIX_L_SOURCE_MEDIA: changed'))).toThrow('Authenticated Appendix L source media binding mismatch');
    expect(() => assertAppendixLSourceMedia(`${source}\n${appendixLSourceMediaMarkdownLine()}`)).toThrow('Authenticated Appendix L source media binding mismatch');
    expect(() => assertAppendixLSourceMedia(`${appendixLSourceMediaMarkdownLine()}\n${source}`)).toThrow('Authenticated Appendix L source media binding mismatch');
  });

  it('maps a valid Appendix L image and refuses a mutated marker line', () => {
    const line = appendixLSourceMediaMarkdownLine();
    const valid = paperInlineSegments(`Synthetic before.\n\n${line}\n\nSynthetic after.`);
    expect(valid.filter((segment) => segment.kind === 'appendix-source-media')).toHaveLength(1);
    expect(valid.filter((segment) => segment.kind === 'appendix-source-media-unavailable')).toHaveLength(0);
    const changed = line.replace('6.5in', '6.4in');
    const invalid = paperInlineSegments(`Synthetic before.\n\n${changed}\n\nSynthetic after.`);
    expect(invalid.filter((segment) => segment.kind === 'appendix-source-media')).toHaveLength(0);
    expect(invalid.filter((segment) => segment.kind === 'appendix-source-media-unavailable')).toHaveLength(1);
  });

  it('renders the bound media URL and the unavailable fallback from synthetic markup', () => {
    const line = appendixLSourceMediaMarkdownLine();
    const media = appendixLSourceMediaContract();
    const valid = renderToStaticMarkup(createElement(PaperText, { markdown: line, linkMap: {} }));
    expect(valid).toContain(`/api/matrix-options/paper/v/${V0991_PAPER_VERSION}/figures/${media.file}?sha256=${media.sha256}`);
    expect(valid).toContain('data-appendix-source-media');
    const invalid = renderToStaticMarkup(createElement(PaperText, { markdown: line.replace('6.5in', '6.4in'), linkMap: {} }));
    expect(invalid).toContain('The source image could not be verified, so it is not shown.');
    expect(invalid).not.toContain('data-appendix-source-media=');
  });

  it('navigates, windows, and server-renders an obviously synthetic paper through production functions', () => {
    const content = '# 1.0 Synthetic Overview\n\nSynthetic introduction.\n\n# 2.0 Synthetic Context\n\nSynthetic body.\n\n# Technical Appendices Compendium\n\n# Appendix A: Synthetic Plan\n\nSynthetic ending.\n';
    syntheticRelease.active = true;
    syntheticRelease.patch = { bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content), frontMatter: false, headingDepthShift: 0, acceptedFigures: false, withheld: null };
    const descriptor = describeAuthenticatedPaper(getPaperRelease(DEFAULT_PAPER_VERSION)!, content);
    const structure = compileRevisedPaperStructure(descriptor);
    const outline = getPaperNavOutline(structure);
    const window = getPaperSectionWindowModel(structure);
    expect(outline.map((entry) => entry.label)).toContain('2.0 Synthetic Context');
    expect(window.groups.length).toBeGreaterThan(1);
    expect(window.groups[0].endByte - window.groups[0].startByte).toBeLessThan(window.totalBytes);
    const navigation = createElement(PaperOutlineNav, { outline, activeAnchor: null, targetAnchor: null, documentTargetId: 'paper-document-column', onNavigate: () => {} });
    expect(() => renderToStaticMarkup(navigation)).not.toThrow();
    const document = createElement(PaperDocument, { model: getPaperDocumentModel(structure), layout: 'chunks' });
    expect(() => renderToStaticMarkup(document)).not.toThrow();
  });
});
