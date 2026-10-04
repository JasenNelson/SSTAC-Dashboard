import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/*
 * A SYNTHETIC private-storage release, compiled by the real compiler.
 *
 * The real artifact of the current review draft is not in the repository, so the
 * suites that read it run only where the private fixture is. Every rule those
 * suites rely on is shown here on text written for the test, everywhere:
 * - the release table names a synthetic artifact in place of R5 (its bytes and
 *   hash, and its shape);
 * - the R5 figures contract and the R5 hash-form guide contract are replaced by
 *   synthetic contracts that bind that artifact by hash.
 * compileAuthenticatedRelease is the product's own: a figure, a guide question
 * or a withheld-section reference that does not match makes the whole release
 * unavailable, one mutation at a time, each beside a baseline that compiles.
 */
const synthetic = await vi.hoisted(async () => {
  const { createHash } = await import('node:crypto');
  const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
  const VERSION = 'v0.9.88-r4-presentation-001';
  const anchor = (id: string): string => `<div id="${id}" class="section-anchor"></div>`;
  const HEADING = 'On a synthetic topic';
  const QUESTIONS = Array.from({ length: 12 }, (_, index) => `Synthetic question number ${index + 1}?`);
  const FIGURES = [
    { figureId: '1-1', assetId: 'FIG1-1', sectionAnchor: 'sec-2', caption: 'Figure 1-1. A first synthetic caption.', status: 'SYNTHETIC_ONE', alt: 'A first synthetic description.' },
    { figureId: 'A-1', assetId: 'FIGA1', sectionAnchor: 'app-a', caption: 'Figure A-1. A second synthetic caption.', status: 'SYNTHETIC_TWO', alt: 'A second synthetic description.' },
  ];
  const block = (figure: (typeof FIGURES)[number]): string[] => [`<!-- MATRIX_FIGURE_PLACEMENT: ${figure.figureId} -->`, '', `[]{#fig-${figure.figureId.toLowerCase()}}${figure.caption}`, '', `**Status: ${figure.status}**`, '', `![${figure.alt}](assets/${figure.assetId}.png)`];
  const lines: readonly string[] = [
    '# Synthetic paper', '', anchor('sec-1'), '', '## 1 Reviewer guide', '', `**${HEADING}**`, '',
    ...QUESTIONS.map((question, index) => `${index + 1}. ${question}`), '',
    anchor('sec-2'), '', '## 2 Figures', '',
    ...block(FIGURES[0]), '',
    'See [the appendix](#app-l) for the plan.', '',
    anchor('sec-appendices'), '', '# Technical Appendices Compendium', '', anchor('app-a'), '', '## Appendix A: A kept part', '',
    ...block(FIGURES[1]), '',
    'Text.', '',
  ];
  const lineOf = (text: string): number => lines.indexOf(text) + 1;
  const guideContract = {
    schemaVersion: 'matrix-paper-reviewer-guide-v1',
    releaseIdentity: VERSION,
    sourcePath: `presentation:${VERSION}`,
    predecessorReleaseIdentity: '1.0.11-remediated-7-8-successor-20260918-D',
    questions: QUESTIONS.map((question, index) => ({
      number: index + 1,
      id: `rpq:${VERSION}:q${String(index + 1).padStart(2, '0')}`,
      sourceLines: [lineOf(`${index + 1}. ${question}`), lineOf(`${index + 1}. ${question}`)],
      textSha256: sha(`${HEADING}\n${question}`),
      sectionAnchors: ['sec-1'],
      predecessorEquivalence: 'MATERIALLY_CHANGED_NO_AUTOMATIC_RESPONSE_CARRY_FORWARD',
      predecessorQuestionId: null,
    })),
  };
  const figuresContract = {
    schemaVersion: 'matrix-paper-accepted-figures-v1',
    releaseIdentity: VERSION,
    paperSha256: sha(lines.join('\n')),
    sources: { candidateManifestSha256: 'a'.repeat(64), placementRegistrySha256: 'b'.repeat(64), interfaceOverlaySha256: 'c'.repeat(64) },
    assets: FIGURES.map((figure) => ({ id: figure.assetId, file: `${figure.assetId}.png`, sha256: 'd'.repeat(64), bytes: 1, width: 1, height: 1, placementIds: [figure.figureId] })),
    placements: FIGURES.map((figure) => ({ figureId: figure.figureId, assetId: figure.assetId, textSha256: sha(`${figure.caption}\n${figure.status}\n${figure.alt}`), sectionAnchor: figure.sectionAnchor, anchorSource: 'registry', role: 'primary', markerLine: lineOf(`<!-- MATRIX_FIGURE_PLACEMENT: ${figure.figureId} -->`) })),
  };
  return { sha, VERSION, HEADING, QUESTIONS, FIGURES, lines, anchor, guideContract, figuresContract, override: { active: false, patch: {} as Record<string, unknown> } };
});

vi.mock('../contracts/accepted-figures-v0.9.88-r4-presentation-001.json', () => ({ default: synthetic.figuresContract }));
vi.mock('../contracts/reviewer-guide-v0.9.88-r4-presentation-001.json', () => ({ default: synthetic.guideContract }));
vi.mock('../releases', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../releases')>();
  return {
    ...actual,
    getPaperRelease: (documentVersion: string | undefined | null) => {
      const release = actual.getPaperRelease(documentVersion);
      return release && synthetic.override.active && release.documentVersion === synthetic.VERSION ? { ...release, ...synthetic.override.patch } : release;
    },
  };
});

import { describeAuthenticatedPaper, RevisedPaperUnavailableError } from '../../revised-paper';
import type { RevisedPaperDescriptor } from '../../revised-paper';
import { compileAuthenticatedRelease, loadRevisedPaperStructure } from '../../revised-paper-structure';
import { getReviewerGuideBinding, getReviewerGuideContract } from '../../reviewer-guide';
import { findAcceptedFigureBlocks, getAcceptedFiguresContract, resolveAcceptedFigure } from '../accepted-figures';
import { authenticateAcceptedFigures } from '../accepted-figures-server';
import { buildPaperChunks } from '../full-document';
import { getPaperRelease, R5_PAPER_VERSION } from '../releases';
import { resolveReviewerGuide } from '../reviewer-guide-server';
import { appendixHeadingCount, appendixHeadingLineCount, sectionAnchorLineCount } from './r5-withheld-probes';

const { sha, VERSION, HEADING, QUESTIONS, FIGURES, lines: LINES, anchor } = synthetic;
const UNAVAILABLE = 'Authenticated revised-paper structure unavailable: ';
const BOUND_PAPER_SHA256 = synthetic.figuresContract.paperSha256;

/** The synthetic artifact with its lines edited. */
function edited(edit: (lines: string[]) => void = () => {}): string {
  const lines = [...LINES];
  edit(lines);
  return lines.join('\n');
}

/** Binds `content` in place of R5: the table names its bytes and hash, and the figures contract its hash. */
function bind(content: string, patch: Record<string, unknown> = {}): RevisedPaperDescriptor {
  synthetic.override.active = true;
  synthetic.override.patch = { bytes: Buffer.byteLength(content, 'utf8'), sha256: sha(content), frontMatter: false, headingDepthShift: 0, acceptedFigures: true, contentsHeadingDisplay: null, withheld: { stableSectionId: 'app-l', notice: 'n' }, ...patch };
  synthetic.figuresContract.paperSha256 = sha(content);
  return describeAuthenticatedPaper(getPaperRelease(VERSION)!, content);
}

const compileFailure = (content: string, patch: Record<string, unknown> = {}): string => {
  try {
    compileAuthenticatedRelease(bind(content, patch));
    return 'compiled';
  } catch (error) {
    return error instanceof Error ? error.message : 'unknown';
  }
};

const indexOfLine = (lines: readonly string[], text: string): number => {
  const index = lines.indexOf(text);
  if (index < 0) throw new Error('synthetic line not found');
  return index;
};
const marker = (figureId: string): string => `<!-- MATRIX_FIGURE_PLACEMENT: ${figureId} -->`;

afterEach(() => {
  synthetic.override.active = false;
  synthetic.override.patch = {};
  synthetic.figuresContract.paperSha256 = BOUND_PAPER_SHA256;
});

describe('synthetic private-storage release: baseline', () => {
  it('is the bound R5 version, and the synthetic contracts stand in for the stored ones', () => {
    expect(VERSION).toBe(R5_PAPER_VERSION);
    expect(getAcceptedFiguresContract(VERSION)).toBe(synthetic.figuresContract);
    expect(getReviewerGuideBinding(VERSION)).toBe(synthetic.guideContract);
    expect(() => getReviewerGuideContract(VERSION)).toThrow(/resolved from its paper/);
  });

  it('compiles, with every figure authenticated and the guide resolved from the artifact', () => {
    const structure = compileAuthenticatedRelease(bind(edited()));
    expect(structure.presentation).toEqual({ frontMatter: false, inactiveLinkTargets: ['app-l'] });
    expect(structure.manifest.source).toMatchObject({ path: `presentation:${VERSION}`, version: VERSION, sha256: sha(edited()) });
    expect(authenticateAcceptedFigures(structure)).toBe(synthetic.figuresContract);
    const guide = resolveReviewerGuide(structure);
    expect(guide.questions.map((question) => [question.number, question.heading, question.prompt])).toEqual(QUESTIONS.map((question, index) => [index + 1, HEADING, question]));
    expect(guide.questions.some((question) => 'textSha256' in question)).toBe(false);
    expect(resolveReviewerGuide(structure)).toBe(guide);
    // The resolved guide is frozen all the way down; the stored contract it came from is left as it is.
    expect(Object.isFrozen(guide) && guide.questions.every((question) => Object.isFrozen(question) && Object.isFrozen(question.sourceLines) && Object.isFrozen(question.sectionAnchors))).toBe(true);
    expect(synthetic.guideContract.questions.some((question) => Object.isFrozen(question) || Object.isFrozen(question.sourceLines) || Object.isFrozen(question.sectionAnchors))).toBe(false);
    // The reader draws each figure with the text of its own block.
    const figures = buildPaperChunks(structure).flatMap((chunk) => findAcceptedFigureBlocks(chunk.markdown.split('\n'))).map((block) => resolveAcceptedFigure(block));
    expect(figures.map((figure) => [figure?.placement.figureId, figure?.caption, figure?.status, figure?.alt])).toEqual(FIGURES.map((figure) => [figure.figureId, figure.caption, figure.status, figure.alt]));
  });

  it('has no repository loader, whatever the table says about its bytes', () => {
    bind(edited());
    expect(() => loadRevisedPaperStructure(VERSION)).toThrow(RevisedPaperUnavailableError);
  });
});

describe('synthetic private-storage release: a guide that does not match makes the release unavailable', () => {
  const GUIDE = `${UNAVAILABLE}reviewer guide: Invalid reviewer guide contract: `;

  it('refuses a question whose wording is not the bound wording', () => {
    expect(compileFailure(edited((lines) => { lines[indexOfLine(lines, `3. ${QUESTIONS[2]}`)] = '3. Synthetic question number 3, reworded?'; }))).toBe(`${GUIDE}text SHA-256 3`);
  });

  it('refuses a heading that is not the bound heading, or that is not a bold line', () => {
    expect(compileFailure(edited((lines) => { lines[indexOfLine(lines, `**${HEADING}**`)] = '**On another topic**'; }))).toBe(`${GUIDE}text SHA-256 1`);
    expect(compileFailure(edited((lines) => { lines[indexOfLine(lines, `**${HEADING}**`)] = HEADING; }))).toBe(`${GUIDE}heading source 1`);
  });

  it('refuses a question anchored to a section the artifact does not carry', () => {
    expect(compileFailure(edited((lines) => { lines[indexOfLine(lines, anchor('sec-1'))] = anchor('sec-9'); }))).toBe(`${GUIDE}section anchor source 1`);
  });

  it('refuses a stored guide whose hash or source lines are wrong for the artifact', () => {
    const question = synthetic.guideContract.questions[4];
    const original = { textSha256: question.textSha256, sourceLines: question.sourceLines };
    try {
      question.textSha256 = '0'.repeat(64);
      expect(compileFailure(edited())).toBe(`${GUIDE}text SHA-256 5`);
      question.textSha256 = original.textSha256;
      question.sourceLines = [LINES.length + 1, LINES.length + 1];
      expect(compileFailure(edited())).toBe(`${GUIDE}source range 5`);
      question.sourceLines = [original.sourceLines[0] + 1, original.sourceLines[1] + 1];
      expect(compileFailure(edited())).toBe(`${GUIDE}text SHA-256 5`);
    } finally {
      Object.assign(question, original);
    }
    expect(compileFailure(edited())).toBe('compiled');
  });

  it('two-sided: the same reworded question compiles when the release guide is not hash form, so the refusal is the guide check', () => {
    const reworded = edited((lines) => { lines[indexOfLine(lines, `3. ${QUESTIONS[2]}`)] = '3. Synthetic question number 3, reworded?'; });
    expect(compileFailure(reworded, { delivery: 'repository' })).toBe('compiled');
    expect(compileFailure(reworded)).toBe(`${GUIDE}text SHA-256 3`);
  });
});

describe('synthetic private-storage release: a figure that does not match makes the release unavailable', () => {
  const FIGURE = `${UNAVAILABLE}accepted figures: `;
  /** authenticateAcceptedFigures on edited text under the BOUND paper hash, so each check below is reached. */
  const figureFailure = (edit: (lines: string[]) => void): string => {
    try {
      authenticateAcceptedFigures({ content: edited(edit), manifest: { source: { version: VERSION, sha256: BOUND_PAPER_SHA256 } } });
      return 'authenticated';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  };
  const at = (lines: readonly string[], figureId: string, offset: number): number => indexOfLine(lines, marker(figureId)) + offset;

  it('through the compiler: a changed caption, status or alternative text', () => {
    expect(compileFailure(edited((lines) => { lines[at(lines, '1-1', 2)] += ' Revised.'; }))).toBe(`${FIGURE}placement text 1-1`);
    expect(compileFailure(edited((lines) => { lines[at(lines, 'A-1', 4)] = '**Status: OTHER**'; }))).toBe(`${FIGURE}placement text A-1`);
    expect(compileFailure(edited((lines) => { lines[at(lines, 'A-1', 6)] = '![Another description.](assets/FIGA1.png)'; }))).toBe(`${FIGURE}placement text A-1`);
  });

  it('the text is bound as ONE joined value: moving words between caption, status and alternative text is refused', () => {
    expect(figureFailure((lines) => {
      lines[at(lines, '1-1', 2)] = '[]{#fig-1-1}Figure 1-1. A first synthetic';
      lines[at(lines, '1-1', 4)] = '**Status: caption. SYNTHETIC_ONE**';
    })).toBe('accepted figures: placement text 1-1');
    // Two placements with each other's status and alternative text.
    expect(figureFailure((lines) => {
      for (const offset of [4, 6]) [lines[at(lines, '1-1', offset)], lines[at(lines, 'A-1', offset)]] = [lines[at(lines, 'A-1', offset)].replace('FIGA1', 'FIG1-1'), lines[at(lines, '1-1', offset)].replace('FIG1-1', 'FIGA1')];
    })).toBe('accepted figures: placement text 1-1');
  });

  it('a block that does not resolve to its placement', () => {
    expect(figureFailure((lines) => { lines[at(lines, '1-1', 2)] = '[]{#fig-1-1}Figure 1-2. A first synthetic caption.'; })).toBe('accepted figures: placement content 1-1');
    expect(figureFailure((lines) => { lines[at(lines, '1-1', 6)] = lines[at(lines, '1-1', 6)].replace('FIG1-1.png', 'FIGA1.png'); })).toBe('accepted figures: placement content 1-1');
    expect(figureFailure((lines) => { lines[at(lines, '1-1', 4)] = 'Status: SYNTHETIC_ONE'; })).toBe('accepted figures: placement content 1-1');
  });

  it('a marker renumbered, removed or moved, or a section anchor changed above it', () => {
    expect(figureFailure((lines) => { lines[at(lines, 'A-1', 0)] = marker('A-9'); })).toBe('accepted figures: placement order A-9');
    expect(figureFailure((lines) => { lines.splice(at(lines, 'A-1', 0), 1); })).toBe('accepted figures: placement count 1');
    expect(figureFailure((lines) => { lines[indexOfLine(lines, anchor('app-a'))] = anchor('app-x'); })).toBe('accepted figures: placement section A-1');
    expect(figureFailure((lines) => { lines.splice(at(lines, 'A-1', 0), 0, anchor('sec-9')); })).toBe('accepted figures: placement line A-1');
  });

  it('shapes the block finder cannot see', () => {
    expect(figureFailure((lines) => { lines.splice(at(lines, 'A-1', 0), 0, '<!--matrix_figure_placement: 9-9-->', ''); })).toBe('accepted figures: placement marker spelling 3');
    expect(figureFailure((lines) => { lines.splice(at(lines, 'A-1', 0), 0, '![An unbound image.](assets/FIG9-9.png)', ''); })).toBe('accepted figures: asset image outside a placement 3');
  });

  it('another paper, another version', () => {
    expect(() => authenticateAcceptedFigures({ content: edited(), manifest: { source: { version: VERSION, sha256: '0'.repeat(64) } } })).toThrow('accepted figures: contract is bound to another paper');
    expect(() => authenticateAcceptedFigures({ content: edited(), manifest: { source: { version: 'unknown', sha256: BOUND_PAPER_SHA256 } } })).toThrow('accepted figures: no contract for unknown');
    expect(figureFailure(() => {})).toBe('authenticated');
  });
});

describe('synthetic private-storage release: the section left out', () => {
  const NAVIGATION = `${UNAVAILABLE}Paper full-document model unavailable: `;
  const appended = (...tail: string[]): string => edited((lines) => { lines.push(...tail, ''); });

  it('baseline: the artifact names the stable id only in one simple link, which is shown as text', () => {
    const structure = compileAuthenticatedRelease(bind(edited()));
    expect(sectionAnchorLineCount(structure.content, 'app-l')).toBe(0);
    expect([appendixHeadingCount(structure, 'L'), appendixHeadingLineCount(structure.content, 'L')]).toEqual([0, 0]);
    expect([appendixHeadingCount(structure, 'A'), appendixHeadingLineCount(structure.content, 'A')]).toEqual([1, 1]);
    const shown = buildPaperChunks(structure).map((chunk) => chunk.markdown).join('');
    expect(shown).toContain('See the appendix for the plan.');
    expect(shown).not.toContain('#app-l');
  });

  it('fails closed when the artifact holds the anchor line of the section it leaves out', () => {
    expect(compileFailure(appended(anchor('app-l'), '', '## Appendix L: A part the artifact must not hold', '', 'Tail.'))).toBe(`${NAVIGATION}the withheld stable id has an anchor line in the presented text`);
    expect(compileFailure(appended(anchor('app-l')))).toBe(`${NAVIGATION}the withheld stable id has an anchor line in the presented text`);
  });

  it('fails closed when the stable id is a heading anchor or a span id of the artifact', () => {
    expect(compileFailure(appended('# app-l', '', 'Text.'))).toBe(`${NAVIGATION}the withheld stable id is a heading anchor of the presented text`);
    // A span id is a literal `#id` that is not a simple link, so the compiler refuses it first.
    expect(compileFailure(appended('[]{#app-l}A caption.'))).toBe(`${UNAVAILABLE}a reference to the withheld section is not a simple link`);
  });

  it('fails closed when a reference to the section is not a simple link', () => {
    for (const reference of ['[the appendix](#app-l "Appendix")', '![the appendix](#app-l)', 'the appendix (#app-l)']) {
      expect(compileFailure(edited((lines) => { lines[indexOfLine(lines, 'See [the appendix](#app-l) for the plan.')] = `See ${reference} for the plan.`; }))).toBe(`${UNAVAILABLE}a reference to the withheld section is not a simple link`);
    }
  });

  it('a heading of that appendix with no anchor line makes the release unavailable', () => {
    // A heading that only NAMES the appendix carries no stable id, so the id checks do not see
    // it. assertWithheldNavigation refuses the heading itself.
    const content = appended('## Appendix L: A part the artifact must not hold', '', 'Tail.');
    expect(compileFailure(content)).toBe(`${UNAVAILABLE}Paper full-document model unavailable: the withheld appendix has a heading in the presented text`);
    // In any letter case.
    for (const heading of ['## APPENDIX L: A PART THE ARTIFACT MUST NOT HOLD', '## appendix l. a part the artifact must not hold']) {
      expect(compileFailure(appended(heading, '', 'Tail.'))).toBe(`${UNAVAILABLE}Paper full-document model unavailable: the withheld appendix has a heading in the presented text`);
    }
    // Another appendix's heading is not refused, and the probes still count what they are asked for.
    const other = appended('## Appendix M: A part the artifact may hold', '', 'Tail.');
    expect(compileFailure(other)).toBe('compiled');
    const structure = compileAuthenticatedRelease(bind(other));
    expect([appendixHeadingCount(structure, 'M'), appendixHeadingLineCount(structure.content, 'M'), appendixHeadingCount(structure, 'L')]).toEqual([1, 1, 0]);
  });
});
