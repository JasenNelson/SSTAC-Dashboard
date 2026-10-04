import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline, getPaperStableSectionIds } from '@/components/matrix-options/paper/PaperDocument';
import { PaperOutlineNav } from '@/components/matrix-options/paper/PaperOutlineNav';
import { RevisedPaperWorkspace } from '@/components/matrix-options/paper/RevisedPaperWorkspace';
import { getProductionAssignment } from '@/lib/matrix-options/revised-paper-review';
import { getPaperSectionWindowModel, paperSectionIdentity, summarizePaperSections } from '../../paper/section-window';
import { getReviewLineage, reviewLineageView } from '../../paper/review-lineage';
import { getReviewManifest } from '../../paper/review-manifest';
import { getPaperRelease, DEFAULT_PAPER_VERSION, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '../releases';
import { describeAuthenticatedPaper } from '../../revised-paper';
import { compileAuthenticatedRelease } from '../../revised-paper-structure';
import { getAcceptedFiguresContract } from '../accepted-figures';
import { getReviewerGuideBinding } from '../../reviewer-guide';
import { getCohortManifest } from '../../cohort-contract';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { deriveCohortPortions } from '../cohort-portions';
import { paperInlineSegments } from '../derived-figures';
import { appendixLSourceMediaContract } from '../accepted-source-media';

describe('v0.9.91 private review draft', () => {
  it('authenticates the full source and includes Appendix L with its bound source image', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION);
    expect(release).not.toBeNull();
    expect(release).toMatchObject({
      activation: 'SELECTABLE_NON_DEFAULT',
      predecessorVersion: R5_PAPER_VERSION,
      withheld: null,
      acceptedFigures: true,
    });
    expect(release?.retiredSectionAnchors).toEqual({
      'sec-scope-note': 'sec-status-notice',
      'sec-audience': 'sec-status-notice',
      'sec-10-0-1': 'sec-10-3',
      'sec-11-6': 'sec-18-7',
      'sec-16-1': 'sec-16-0',
      'sec-16-2': 'sec-16-0',
      'sec-16-3': 'sec-16-0',
    });
    expect(getPaperRelease(DEFAULT_PAPER_VERSION)?.activation).toBe('DEFAULT');
    expect(getPaperRelease(R5_PAPER_VERSION)).not.toBeNull();

    const sourcePath = path.resolve(process.cwd(), 'candidate/paper/v0.9.91/presentation.md');
    const source = readFileSync(sourcePath, 'utf8');
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release!, source));

    expect(structure.manifest.source.sha256).toBe(release!.sha256);
    expect(structure.manifest.source.bytes).toBe(release!.bytes);
    expect(structure.nodes).toHaveLength(364);
    expect(structure.nodes.some((node) => node.anchor === 'app-l')).toBe(true);
    expect(structure.content).toMatch(/\(#app-l\)/i);
    expect(structure.content).toContain('appendix_l_media/image1.png');
    expect(structure.content).toContain('[Appendix L: Phase 2 Project Plan V2]');
    expect(structure.content).toContain('## Appendix L: Phase 2 Project Plan V2 {#app-l .chapter}');
    expect(structure.content).toContain('in the body of this paper. The plan transcription at Appendix L, which this paper does not edit, names them as the plan does (Appendix I, I.2.2).');
    expect(structure.content).toContain('The working Phase 2 project plan (Appendix L) supports coordination, sequencing and resourcing; it does not determine scientific conclusions or confer scope authority, and its schedule is tentative.');
    expect(source).toContain('## Appendix L: Phase 2 Project Plan V2 {#app-l .chapter}');
    const sourceMediaPath = path.resolve(process.cwd(), 'candidate/paper/v0.9.91/appendix_l_media/image1.png');
    expect(existsSync(sourceMediaPath)).toBe(true);
    const sourceMediaBytes = readFileSync(sourceMediaPath);
    const sourceMedia = appendixLSourceMediaContract();
    expect(sourceMedia).toMatchObject({ file: 'APPENDIX-L-SOURCE.png', sha256: '9e511fa96cd4f642b5fd3c06de35fc5891ebb26e838c3e6cc982d88eea5aa7a5', bytes: 270437, width: 1875, height: 913, widthAttribute: '6.5in' });
    expect(createHash('sha256').update(source.split('\n')[sourceMedia.sourceLine - 1], 'utf8').digest('hex')).toBe(sourceMedia.sourceMarkdownLineSha256);
    expect(createHash('sha256').update(sourceMediaBytes).digest('hex')).toBe(sourceMedia.sha256);
    expect(sourceMediaBytes.readUInt32BE(16)).toBe(sourceMedia.width);
    expect(sourceMediaBytes.readUInt32BE(20)).toBe(sourceMedia.height);
    const mediaSegments = paperInlineSegments(structure.content).filter((segment) => segment.kind === 'appendix-source-media');
    expect(mediaSegments).toHaveLength(1);
    if (mediaSegments[0]?.kind === 'appendix-source-media') expect(mediaSegments[0].media.alt).toBe(sourceMedia.alt);
    expect(paperInlineSegments(structure.content).filter((segment) => segment.kind === 'markdown').map((segment) => segment.markdown).join('\n')).not.toContain('appendix_l_media/image1.png');

    expect(getAcceptedFiguresContract(V0991_PAPER_VERSION)?.assets).toHaveLength(17);
    expect(getAcceptedFiguresContract(V0991_PAPER_VERSION)?.placements).toHaveLength(20);
    const guideBinding = getReviewerGuideBinding(V0991_PAPER_VERSION);
    expect(guideBinding.questions).toHaveLength(12);
    expect(guideBinding.questions.filter((question) => question.predecessorQuestionId).map((question) => question.number)).toEqual([4, 5, 12]);
    expect(resolveReviewerGuide(structure).questions.every((question) => !/Appendix L/i.test(`${question.heading} ${question.prompt}`))).toBe(true);
    const cohortManifest = getCohortManifest(V0991_PAPER_VERSION);
    expect(cohortManifest.cohorts).toHaveLength(5);
    expect(deriveCohortPortions(structure, cohortManifest)).toHaveLength(14);
    expect(getReviewManifest(V0991_PAPER_VERSION).documentVersion).toBe(V0991_PAPER_VERSION);
  });

  it('server-renders the authenticated v0.9.91 paper without overflowing the stack', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const source = readFileSync(path.resolve(process.cwd(), 'candidate/paper/v0.9.91/presentation.md'), 'utf8');
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, source));
    const document = createElement(PaperDocument, { model: getPaperDocumentModel(structure), layout: 'chunks' });

    expect(() => renderToStaticMarkup(document)).not.toThrow();
  });

  it('server-renders the v0.9.91 hierarchical outline without overflowing the stack', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const source = readFileSync(path.resolve(process.cwd(), 'candidate/paper/v0.9.91/presentation.md'), 'utf8');
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, source));
    const outline = getPaperNavOutline(structure);
    const navigation = createElement(PaperOutlineNav, {
      outline,
      activeAnchor: null,
      targetAnchor: null,
      documentTargetId: 'paper-document-column',
      onNavigate: () => {},
    });

    expect(() => renderToStaticMarkup(navigation)).not.toThrow();
  });

  it('splits v0.9.91 into chapter-sized server-render windows', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const source = readFileSync(path.resolve(process.cwd(), 'candidate/paper/v0.9.91/presentation.md'), 'utf8');
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, source));
    const window = getPaperSectionWindowModel(structure);
    expect(window.groups.length).toBeGreaterThan(1);
    expect(window.groups[0].endByte - window.groups[0].startByte).toBeLessThan(window.totalBytes / 2);
    expect(window.groups.map((group) => group.label)).toContain('2.0 Context and Problem Statement');
  });

  it('server-renders the complete v0.9.91 Working Draft workspace', () => {
    const release = getPaperRelease(V0991_PAPER_VERSION)!;
    const source = readFileSync(path.resolve(process.cwd(), 'candidate/paper/v0.9.91/presentation.md'), 'utf8');
    const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, source));
    const fullModel = getPaperDocumentModel(structure);
    const window = getPaperSectionWindowModel(structure);
    const identity = paperSectionIdentity(structure, V0991_PAPER_VERSION);
    const initialGroup = window.groups[0];
    const guide = resolveReviewerGuide(structure);
    const reviewLineage = (() => {
      const lineage = getReviewLineage(V0991_PAPER_VERSION);
      return lineage ? reviewLineageView(lineage, getReviewManifest(lineage.predecessorVersion).sha256) : undefined;
    })();
    const clientProps = {
      documentVersion: V0991_PAPER_VERSION,
      guide,
      reviewManifestSha256: getReviewManifest(V0991_PAPER_VERSION).sha256,
      urlState: { mode: 'working-draft' as const, cohort: null, q: null, section: null },
      assignment: getProductionAssignment(),
      outline: getPaperNavOutline(structure),
      sectionWindow: {
        paperSha256: identity.paperSha256,
        initialIndex: 0,
        sections: summarizePaperSections(window.groups),
        linkMap: fullModel.linkMap,
      },
      downloadManifests: null,
      reviewLineage,
      stableSectionIds: getPaperStableSectionIds(structure),
    };
    const serializedClientProps = JSON.stringify(clientProps);
    expect(serializedClientProps.length).toBeGreaterThan(0);
    const document = createElement(PaperDocument, {
      model: { ...fullModel, chunks: window.chunks.slice(initialGroup.chunkStart, initialGroup.chunkEnd) },
      layout: 'chunks',
      region: 'main',
    });
    const workspace = createElement(RevisedPaperWorkspace, {
      ...clientProps,
    }, document);

    expect(() => renderToStaticMarkup(workspace)).not.toThrow();
  });

});
