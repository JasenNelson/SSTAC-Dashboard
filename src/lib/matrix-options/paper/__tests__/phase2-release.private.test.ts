import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline, resolveLegacySectionAnchor } from '@/components/matrix-options/paper/PaperDocument';
import { getCohortManifest } from '../../cohort-contract';
import { describeAuthenticatedPaper } from '../../revised-paper';
import { compileAuthenticatedRelease } from '../../revised-paper-structure';
import { getReviewerGuideBinding } from '../../reviewer-guide';
import { getAcceptedFiguresContract } from '../accepted-figures';
import coverage from '../contracts/legacy-coverage-phase2-review-2026-11-186bcf53.json';
import oldHeadingContract from '../contracts/heading-anchors-v0.9.91-run109-001.json';
import { deriveCohortPortions } from '../cohort-portions';
import { paperInlineSegments } from '../derived-figures';
import { buildPaperNavGroups } from '../paper-nav-groups';
import { getPaperSectionWindowModel } from '../section-window';
import { getReviewLineage } from '../review-lineage';
import { PHASE2_PAPER_VERSION, DEFAULT_PAPER_VERSION, V0991_PAPER_VERSION, getPaperRelease } from '../releases';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { parseFrontMatter } from '../source-presentation';

it('binds a nondefault read-only Phase 2 release with eight focus prompts', () => {
  const release = getPaperRelease(PHASE2_PAPER_VERSION);
  expect(DEFAULT_PAPER_VERSION).toBe(V0991_PAPER_VERSION);
  expect(release).toMatchObject({ delivery: 'private-storage', activation: 'SELECTABLE_NON_DEFAULT', bytes: 63040, predecessorVersion: V0991_PAPER_VERSION });
  const guide = getReviewerGuideBinding(PHASE2_PAPER_VERSION);
  const cohorts = getCohortManifest(PHASE2_PAPER_VERSION);
  expect(guide.questions.map((question) => question.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(guide.questions.every((question) => question.predecessorQuestionId === null)).toBe(true);
  expect(getReviewLineage(PHASE2_PAPER_VERSION)?.questions.every((question) => question.predecessorQuestionId === null)).toBe(true);
  expect(cohorts.cohorts.map((cohort) => cohort.questionNumbers)).toEqual([[1], [2], [3], [4], [5], [6], [7], [8]]);
  expect(new Set(cohorts.cohorts.map((cohort) => cohort.name)).size).toBe(8);
  expect(getAcceptedFiguresContract(PHASE2_PAPER_VERSION)?.assets).toHaveLength(4);
});

it('accounts for all 37 legacy items without moving responses into the new release', () => {
  const newQuestionIds = new Set(getReviewerGuideBinding(PHASE2_PAPER_VERSION).questions.map((question) => question.id));
  expect(coverage.entries).toHaveLength(37);
  expect(new Set(coverage.entries.map((entry) => entry.legacyId)).size).toBe(37);
  expect(coverage.entries.slice(0, 12).map((entry) => entry.legacyId)).toEqual(getReviewerGuideBinding(V0991_PAPER_VERSION).questions.map((question) => question.id));
  expect(coverage.entries.every((entry) => entry.action === 'REFRAME' && entry.responseMigration === 'NONE' && entry.focusQuestionIds.length > 0 && entry.focusQuestionIds.every((id) => newQuestionIds.has(id)))).toBe(true);
});

it.skipIf(!process.env.MATRIX_PHASE2_SOURCE_PATH)('authenticates the exact private paper, all figures and focus text', () => {
  const source = readFileSync(process.env.MATRIX_PHASE2_SOURCE_PATH!);
  const release = getPaperRelease(PHASE2_PAPER_VERSION)!;
  expect(createHash('sha256').update(source).digest('hex')).toBe(release.sha256);
  const figureRoot = join(dirname(dirname(process.env.MATRIX_PHASE2_SOURCE_PATH!)), 'src', 'figures');
  for (const asset of getAcceptedFiguresContract(PHASE2_PAPER_VERSION)!.assets) {
    const bytes = readFileSync(join(figureRoot, asset.file));
    expect(bytes).toHaveLength(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    expect(bytes.readUInt32BE(16)).toBe(asset.width);
    expect(bytes.readUInt32BE(20)).toBe(asset.height);
  }
  const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, source.toString('utf8')));
  expect(structure.nodes.map((node) => node.anchor)).toContain('app-phase2-a');
  expect(structure.nodes.map((node) => node.anchor)).toContain('sec-phase2-references');
  expect(structure.nodes.map((node) => node.anchor)).toContain('sec-phase2-9');
  const oldAnchors = new Set(oldHeadingContract.headings.map((heading) => heading.id));
  expect(structure.nodes.every((node) => !oldAnchors.has(node.anchor))).toBe(true);
  expect(resolveLegacySectionAnchor(structure, 'sec-6-1', release.retiredSectionAnchors)).toBeNull();
  const guide = resolveReviewerGuide(structure);
  expect(guide.questions.map((question) => question.heading)).toEqual(getCohortManifest(PHASE2_PAPER_VERSION).cohorts.map((cohort) => cohort.name));
  expect(createHash('sha256').update(`${guide.questions[7].heading}\n${guide.questions[7].prompt}`).digest('hex')).toBe(getReviewerGuideBinding(PHASE2_PAPER_VERSION).questions[7].textSha256);
  expect(deriveCohortPortions(structure, getCohortManifest(PHASE2_PAPER_VERSION))).toHaveLength(8);
  expect(paperInlineSegments(structure.content).filter((segment) => segment.kind === 'accepted-figure')).toHaveLength(4);
  const outline = getPaperNavOutline(structure);
  expect(outline.some((entry) => entry.label === 'Technical Annex')).toBe(true);
  expect(outline.some((entry) => entry.label === 'References')).toBe(true);
  const groups = buildPaperNavGroups(outline);
  expect(groups.find((group) => group.id === 'appendices')?.nodes.some((node) => node.entry.label === 'Technical Annex')).toBe(true);
  expect(getPaperSectionWindowModel(structure).groups.some((group) => group.anchor === 'sec-phase2-about-this-paper')).toBe(true);
  const html = renderToStaticMarkup(createElement(PaperDocument, { model: getPaperDocumentModel(structure), layout: 'chunks' }));
  const frontMatter = parseFrontMatter(source.toString('utf8'));
  expect(frontMatter).not.toBeNull();
  expect(html.includes(`${frontMatter!.fields.title}: ${frontMatter!.fields.subtitle}`.replaceAll("'", '&#x27;'))).toBe(true);
  const editorialPlaceholder = source.toString('utf8').split('\n')[537].trim();
  expect(editorialPlaceholder).toMatch(/^\[.+\]$/);
  expect(html.includes(editorialPlaceholder.slice(1, -1))).toBe(true);
  expect(html).toContain('fig1_framework.png');
  expect(html).toContain('fig4_final_setting.png');
});
