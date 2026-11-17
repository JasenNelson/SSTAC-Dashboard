import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { PaperDocument, getPaperDocumentModel, getPaperNavOutline } from '@/components/matrix-options/paper/PaperDocument';
import { GUIDED_R2_SECTION_ANCHORS } from '../guided-r2-contract';
import { getCohortManifest } from '../../cohort-contract';
import { describeAuthenticatedPaper } from '../../revised-paper';
import { compileAuthenticatedRelease } from '../../revised-paper-structure';
import { getReviewerGuideBinding } from '../../reviewer-guide';
import { getAcceptedFiguresContract } from '../accepted-figures';
import coverage from '../contracts/legacy-coverage-phase2-review-2026-11-fa356b89.json';
import { paperInlineSegments } from '../derived-figures';
import { getReviewLineage } from '../review-lineage';
import { R2_READER_LINKS } from '../r2-reader-links';
import { DEFAULT_PAPER_VERSION, getPaperRelease, PHASE2_PAPER_VERSION, PHASE2_R2_PAPER_VERSION, V0991_PAPER_VERSION } from '../releases';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { parseFrontMatter } from '../source-presentation';

const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

it('keeps R2 distinct from the earlier concise draft and all historical responses', () => {
  const release = getPaperRelease(PHASE2_R2_PAPER_VERSION)!;
  expect(DEFAULT_PAPER_VERSION).toBe(V0991_PAPER_VERSION);
  expect(release).toMatchObject({
    sha256: 'fa356b89f2a80d783a39ef70b8f99b79794c5c5377e3b80567a1b23c624edda2',
    bytes: 74568,
    delivery: 'private-storage',
    activation: 'SELECTABLE_NON_DEFAULT',
    predecessorVersion: PHASE2_PAPER_VERSION,
  });
  expect(release.sha256).not.toBe(getPaperRelease(PHASE2_PAPER_VERSION)?.sha256);
  const questions = getReviewerGuideBinding(PHASE2_R2_PAPER_VERSION).questions;
  const oldQuestions = getReviewerGuideBinding(PHASE2_PAPER_VERSION).questions;
  expect(questions.map((question) => question.id)).toEqual(Array.from({ length: 8 }, (_, index) => `rpq:${PHASE2_R2_PAPER_VERSION}:q${String(index + 1).padStart(2, '0')}`));
  expect(questions.every((question, index) => question.id !== oldQuestions[index].id)).toBe(true);
  expect(getReviewLineage(PHASE2_R2_PAPER_VERSION)?.questions.map((question) => question.predecessorQuestionId)).toEqual([
    null, oldQuestions[1].id, null, oldQuestions[3].id, oldQuestions[4].id, null, oldQuestions[6].id, oldQuestions[7].id,
  ]);
  expect(getCohortManifest(PHASE2_R2_PAPER_VERSION).cohorts.map((cohort) => cohort.name)).toEqual([
    'Structure', 'Sediment uses and waterbodies', 'Substances', 'Human health',
    'Ecological health', 'Common rules', 'Evidence and order of work', 'Other comments',
  ]);
  expect(coverage.entries).toHaveLength(37);
  expect(coverage.entries.every((entry) => entry.responseMigration === 'NONE' && entry.action === 'REFRAME')).toBe(true);
  expect(coverage.entries.find((entry) => entry.legacyId === 'rpq:v0.9.91:q11')?.focusQuestionIds).toEqual([
    `rpq:${PHASE2_R2_PAPER_VERSION}:q02`, `rpq:${PHASE2_R2_PAPER_VERSION}:q05`, `rpq:${PHASE2_R2_PAPER_VERSION}:q06`,
  ]);
  expect(coverage.entries.find((entry) => entry.legacyId === 'N-C02')?.focusQuestionIds).toEqual([
    `rpq:${PHASE2_R2_PAPER_VERSION}:q06`, `rpq:${PHASE2_R2_PAPER_VERSION}:q08`,
  ]);
  expect(R2_READER_LINKS.releaseIdentity).toBe(PHASE2_R2_PAPER_VERSION);
  expect(R2_READER_LINKS.files.map((file) => file.label)).toEqual(['Paper source (Markdown)', 'Paper (Word)', 'Paper (PDF)', 'What changed']);
  expect(R2_READER_LINKS.files[0].sha256).toBe(release.sha256);
});

it.skipIf(!process.env.MATRIX_R2_SOURCE_PATH)('authenticates the exact R2 paper and its four figures', () => {
  const sourcePath = process.env.MATRIX_R2_SOURCE_PATH!;
  const source = readFileSync(sourcePath);
  const release = getPaperRelease(PHASE2_R2_PAPER_VERSION)!;
  expect(source).toHaveLength(release.bytes);
  expect(digest(source)).toBe(release.sha256);
  const text = source.toString('utf8');
  const frontMatter = parseFrontMatter(text);
  expect(frontMatter?.fields).toMatchObject({ title: 'Matrix Options Paper', subtitle: "Proposed Approaches for Modernizing British Columbia's Sediment Standards" });
  for (const phrase of ['Current requirement:', 'Proposed:', 'Proposed, to be tested:', 'To be decided:', 'waterbody group', 'mandatory pathway missing', 'Tier 2', 'lifetime', '34 PAHs', 'human technical review']) {
    expect(text.toLowerCase()).toContain(phrase.toLowerCase());
  }
  const figureRoot = join(dirname(dirname(sourcePath)), 'src', 'figures');
  const figureContract = getAcceptedFiguresContract(PHASE2_R2_PAPER_VERSION)!;
  expect(figureContract.assets).toHaveLength(4);
  for (const asset of figureContract.assets) {
    const bytes = readFileSync(join(figureRoot, asset.file));
    expect(bytes).toHaveLength(asset.bytes);
    expect(digest(bytes)).toBe(asset.sha256);
    expect(bytes.readUInt32BE(16)).toBe(asset.width);
    expect(bytes.readUInt32BE(20)).toBe(asset.height);
  }
  const structure = compileAuthenticatedRelease(describeAuthenticatedPaper(release, text));
  expect(getPaperNavOutline(structure).map((entry) => entry.anchor).filter((anchor) => anchor.startsWith('sec-phase2-'))).toEqual([...GUIDED_R2_SECTION_ANCHORS]);
  const guide = resolveReviewerGuide(structure);
  expect(guide.questions.map((question) => question.heading)).toEqual(getCohortManifest(PHASE2_R2_PAPER_VERSION).cohorts.map((cohort) => cohort.name));
  const figures = paperInlineSegments(structure.content, PHASE2_R2_PAPER_VERSION).filter((segment) => segment.kind === 'accepted-figure');
  expect(figures).toHaveLength(4);
  expect(figures.map((segment) => segment.figure.releaseIdentity)).toEqual(Array(4).fill(PHASE2_R2_PAPER_VERSION));
  const html = renderToStaticMarkup(createElement(PaperDocument, { model: getPaperDocumentModel(structure), layout: 'chunks' }));
  const figureUrls = new Set(html.match(new RegExp(`/api/matrix-options/paper/v/${PHASE2_R2_PAPER_VERSION}/figures/[A-Za-z0-9_]+\\.png`, 'g')) ?? []);
  expect(figureUrls.size).toBe(4);
  expect(html).not.toContain(`/api/matrix-options/paper/v/${PHASE2_PAPER_VERSION}/figures/`);
});

it.skipIf(!process.env.MATRIX_R2_INPUT_MANIFEST_PATH)('matches the reviewed source, Word, PDF and summary reader links', () => {
  const manifest = JSON.parse(readFileSync(process.env.MATRIX_R2_INPUT_MANIFEST_PATH!, 'utf8')) as {
    Drive_reader_files: readonly { readonly name: string; readonly sha256: string; readonly url: string }[];
  };
  expect(R2_READER_LINKS.files.map((file) => [file.href, file.sha256]).sort()).toEqual(manifest.Drive_reader_files.map((file) => [file.url, file.sha256.toLowerCase()]).sort());
});
