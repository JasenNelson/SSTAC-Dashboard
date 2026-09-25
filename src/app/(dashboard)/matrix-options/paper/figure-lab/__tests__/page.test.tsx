import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import MatrixOptionsPaperFigureLabPage from '../page';
import * as pageModule from '../page';
import { DERIVED_FIGURES } from '@/lib/matrix-options/paper/derived-figures';
import { notDrawnFallback } from '@/lib/matrix-options/paper/figure-lab-fallback';
import { FIGURE_REGISTER, FIGURE_SOURCE_LEDGER, type FigureRegisterRow } from '@/lib/matrix-options/paper/figure-register';

const FLAGS = ['MATRIX_OPTIONS_PAPER_WORKSPACE', 'MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION', 'MATRIX_OPTIONS_PAPER_FIGURE_LAB'] as const;
const saved = Object.fromEntries(FLAGS.map((flag) => [flag, process.env[flag]]));

afterEach(() => {
  for (const flag of FLAGS) {
    if (saved[flag] === undefined) delete process.env[flag];
    else process.env[flag] = saved[flag];
  }
});

describe('internal paper figure lab', () => {
  it('exports exactly [\'default\',\'dynamic\'] from page.tsx (P1 fix: an App Router page file may export only the page-export fields Next\'s build-time type check allows; a stray named export like the old notDrawnFallback fails next build even though tsc/vitest stay green in a worktree with no .next/types yet)', () => {
    expect(Object.keys(pageModule).sort()).toEqual(['default', 'dynamic']);
  });

  it.each([
    ['lab flag unset', { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true' }],
    ['lab flag not exactly true', { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'TRUE' }],
    ['workspace off', { MATRIX_OPTIONS_PAPER_WORKSPACE: 'false', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' }],
    ['review navigation off', { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'false', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' }],
  ])('is not found when %s', async (_name, env) => {
    for (const flag of FLAGS) delete process.env[flag];
    Object.assign(process.env, env);
    await expect(MatrixOptionsPaperFigureLabPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('shows all 20 register rows with their figure or prototype, and the four proposed figures', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const rows = Array.from(container.querySelectorAll('section[data-register-row]'));
    expect(rows).toHaveLength(20);
    for (const row of rows) expect(row.querySelector('figure.paper-figure'), row.getAttribute('data-register-row') ?? '').not.toBeNull();
    const status = (number: string) => container.querySelector(`section[data-register-row="${number}"] figure`)?.getAttribute('data-status');
    expect(status('6-1')).toBe('prototype-nonfinal');
    expect(status('7-3')).toBe('current');
    // 7-1's own layout-only skeleton is superseded by its Matrix MC content candidate (querySelector finds the
    // candidate figure, the section's first <figure>, since labFigureFor(row) now returns null for this row).
    expect(status('7-1')).toBe('candidate-nonfinal');
    expect(status('G-2')).toBe('historical-proposal');
    // Duplicate placements draw the reused asset under their own historical number.
    const dup = container.querySelector('section[data-register-row="7-2"] figure')!;
    expect(dup.getAttribute('id')).toBe('figure-7-2');
    expect(dup.querySelector('figcaption')?.textContent).toContain('Same scientific asset as Figure E-1.');
    expect(container.querySelectorAll('figure[data-derived-figure]')).toHaveLength(4);
    // No two figures share a DOM id.
    const ids = Array.from(container.querySelectorAll('figure[id]')).map((figure) => figure.id);
    expect(new Set(ids).size).toBe(ids.length);
    // No two elements of any kind share an id, and every figure's caption and description references resolve to
    // its OWN caption and description (6-1's paper prototype and content candidate share a register number).
    const allIds = Array.from(container.querySelectorAll('[id]')).map((element) => element.id);
    expect(new Set(allIds).size).toBe(allIds.length);
    for (const figure of Array.from(container.querySelectorAll('figure'))) {
      const caption = container.querySelector(`[id="${figure.getAttribute('aria-labelledby')}"]`);
      const description = container.querySelector(`[id="${figure.getAttribute('aria-describedby')}"]`);
      expect(caption?.closest('figure')).toBe(figure);
      expect(description?.closest('figure')).toBe(figure);
    }
  }, 120000);

  // ROUND4_FIX_BRIEF item 6 (Leg1a r4 P3): these per-PX rendered-status assertions were dropped
  // when PX became figure-lab-only inline (owner decision 2026-09-24) with no lab-side
  // replacement; the underlying bindings are still covered by derived-figures.test.ts, but nothing
  // asserted what the LAB actually renders for a PX figure until now.
  it('renders each PX-1..PX-4 proposed figure with a "Proposed visual summary." caption, proposed status, a status note, its own source sha256, and no data-paper-figure', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const proposedSection = container.querySelector('section[aria-labelledby="figure-lab-proposed"]')!;
    expect(proposedSection).not.toBeNull();
    const proposedFigures = Array.from(proposedSection.querySelectorAll('figure[data-derived-figure]'));
    expect(proposedFigures.map((figure) => figure.getAttribute('data-derived-figure')).sort()).toEqual(DERIVED_FIGURES.map((spec) => spec.id).sort());
    for (const figure of proposedFigures) {
      const id = figure.getAttribute('data-derived-figure')!;
      const spec = DERIVED_FIGURES.find((candidate) => candidate.id === id)!;
      expect(figure.querySelector('figcaption')?.textContent, id).toContain('Proposed visual summary.');
      expect(figure.querySelector('figcaption')?.textContent, id).toContain(spec.caption);
      expect(figure.getAttribute('data-status'), id).toBe('proposed');
      expect(figure.querySelector('.paper-figure__status')?.textContent, id).toMatch(/^Proposed figure/);
      expect(figure.getAttribute('data-source-sha256'), id).toBe(spec.sourceSha256);
      expect(figure.hasAttribute('data-paper-figure'), id).toBe(false);
    }
  }, 120000);

  it('shows the adjudicated SedS-labelled prototype of Figure 6-1 as its own lab-only figure, in addition to the plain (no-override) figure and the packet candidate (owner decision 2026-09-24)', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const row = container.querySelector('section[data-register-row="6-1"]')!;
    // The row's own (first) figure carries no SedS names and no label-override authority.
    const plain = row.querySelector('.reader-prose.mt-4 > figure.paper-figure')!;
    expect(plain.hasAttribute('data-label-authority')).toBe(false);
    expect(plain.textContent).not.toContain('SedS');
    // The SedS-labelled prototype is a distinct figure, with its own DOM id and heading.
    const sedsSection = row.querySelector('[data-seds-prototype-section="6-1"]')!;
    expect(sedsSection).not.toBeNull();
    expect(sedsSection.textContent).toContain('Adjudicated label prototype (SedS names) -- lab only');
    const seds = sedsSection.querySelector('figure.paper-figure')!;
    expect(seds.getAttribute('id')).toBe('figure-6-1-seds');
    expect(seds.getAttribute('data-label-authority')).toMatch(/^MATRIX_FIGURE_LINEAGE_ADJUDICATION_20260924\.md sha256 9e6f5e19/);
    for (const name of ['PATHWAY 1: SedS-contactHH', 'PATHWAY 2: SedS-foodHH', 'PATHWAY 3: SedS-contactECO', 'PATHWAY 4: SedS-foodECO']) {
      expect(seds.textContent).toContain(name);
    }
    // Plus the packet candidate, still shown for comparison (three figures total in this row's section).
    const candidateSection = row.querySelector('[data-candidate-section="6-1"]')!;
    expect(candidateSection).not.toBeNull();
    expect(row.querySelectorAll('figure.paper-figure')).toHaveLength(3);
    // No two figures in the row share a DOM id.
    const ids = Array.from(row.querySelectorAll('figure[id]')).map((figure) => figure.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every other row (no adjudicated override) shows no SedS-prototype section.
    for (const other of FIGURE_REGISTER.filter((r) => r.number !== '6-1')) {
      expect(container.querySelector(`section[data-register-row="${other.number}"] [data-seds-prototype-section]`), other.number).toBeNull();
    }
  }, 120000);

  it('shows a Matrix MC content candidate sub-section for each candidate row at its bound placement, and none for rows with no candidate', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const candidateRows = ['6-1', '7-1', 'B-1', '7-7', 'G-3', 'H-1', 'G-2'];
    for (const number of candidateRows) {
      const section = container.querySelector(`section[data-register-row="${number}"] [data-candidate-section]`);
      expect(section, number).not.toBeNull();
      expect(section?.textContent).toContain('Matrix MC content candidate');
    }
    const noCandidateRows = ['7-2', '7-3', '7-4', '7-5', '7-6', 'A-1', 'A-2', 'A-3', 'A-4', 'E-1', 'F-1', 'F-2', 'G-1'];
    for (const number of noCandidateRows) {
      expect(container.querySelector(`section[data-register-row="${number}"] [data-candidate-section]`), number).toBeNull();
    }
    // G-2 has one owner-selected placement, still lab-only and non-final.
    const g2Candidate = container.querySelector('section[data-register-row="G-2"] [data-candidate-section]')!;
    expect(g2Candidate.textContent).not.toMatch(/treatment A|treatment B|new figure number|owner decision/i);
    expect(g2Candidate.querySelectorAll('figure.paper-figure')).toHaveLength(1);
    expect(g2Candidate.querySelector('figure.paper-figure')?.querySelector('figcaption')?.textContent).toContain('Figure G-2.');
    expect(g2Candidate.querySelector('.paper-figure__status')?.textContent).toContain('PROPOSED; NO COMPLETE RESOURCE PASSED');
    expect(g2Candidate.querySelector('.paper-figure__status')?.textContent).toContain('Final binding pending.');
    for (const [number, assetId, marker, sha256] of [
      ['G-2', 'FIGG2', 'APPENDIX_G_BC_AQUATIC_DATABASE_SUMMARY.md#FIGG2', 'C2874D16FBF916B4BB55CF122C763CA95EF689413F4252F6B350A2335C063211'],
      ['H-1', 'FIGH1', 'APPENDIX_H_POLICY_READY_INPUT_PARAMETER_COMPENDIUM.md#FIGH1', '78865C89BFD1A1F89784C6787F05C6D0DA05EEF5F5F4780DCC095D31FAC236A0'],
    ]) {
      const row = container.querySelector(`section[data-register-row="${number}"]`)!;
      expect(row.querySelector('[data-field="canonical-semantic-asset"]')?.textContent).toBe(assetId);
      expect(row.querySelector('[data-field="canonical-semantic-marker"]')?.textContent).toBe(marker);
      expect(row.querySelector('[data-field="canonical-semantic-sha256"]')?.textContent).toBe(sha256);
      expect(row.querySelector('[data-field="stable-local-marker"]')?.textContent).toContain(`FIGURE_SOURCE: ${assetId}`);
      expect(row.textContent).not.toMatch(/identity remains an OWNER decision|unresolved between treatments/i);
    }
    // 7-1 and B-1 render the same semantic asset (same source hash), only label/caption differ.
    const sevenOneFigure = container.querySelector('section[data-register-row="7-1"] [data-candidate-section] figure')!;
    const bOneFigure = container.querySelector('section[data-register-row="B-1"] [data-candidate-section] figure')!;
    expect(sevenOneFigure.getAttribute('data-source-sha256')).toBe(bOneFigure.getAttribute('data-source-sha256'));
    expect(sevenOneFigure.getAttribute('data-semantic-asset')).toBe(bOneFigure.getAttribute('data-semantic-asset'));
    expect(sevenOneFigure.querySelector('figcaption')?.textContent).not.toBe(bOneFigure.querySelector('figcaption')?.textContent);
    // Every candidate figure carries the new status and a visible non-final note (never color alone).
    for (const number of candidateRows) {
      const figures = Array.from(container.querySelectorAll(`section[data-register-row="${number}"] [data-candidate-section] figure`));
      for (const figure of figures) {
        expect(figure.getAttribute('data-status'), number).toBe('candidate-nonfinal');
        expect(figure.querySelector('.paper-figure__status')?.textContent, number).toMatch(/not final and not scientifically accepted/);
      }
    }
  }, 120000);

  it('never announces a false "Not drawn" for a candidate-prototype-nonfinal row, but keeps the live announcement for a genuinely missing figure (P2-3, two-sided)', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const candidateOnlyRows = FIGURE_REGISTER.filter((row) => row.implementation === 'candidate-prototype-nonfinal');
    expect(candidateOnlyRows.length).toBeGreaterThan(0);
    for (const row of candidateOnlyRows) {
      const section = container.querySelector(`section[data-register-row="${row.number}"]`)!;
      expect(section.textContent, row.number).not.toContain('Not drawn');
      expect(section.querySelector('[role="status"]'), row.number).toBeNull();
      expect(section.textContent, row.number).toContain('No current-paper figure at this placement');
    }
    // Side 1 (unit level): a candidate-prototype-nonfinal row never gets the live "Not drawn" fallback.
    const candidateRow = candidateOnlyRows[0];
    expect(notDrawnFallback(candidateRow)).toEqual({
      text: 'No current-paper figure at this placement; the Matrix MC content candidate is shown below.',
      live: false,
    });
    // Side 2: any other implementation (a genuinely missing bound restored/layout figure) keeps the
    // original live announcement -- the fallback logic still distinguishes the two cases.
    const nonCandidateRow: FigureRegisterRow = { ...candidateRow, implementation: 'prototype-nonfinal' };
    expect(notDrawnFallback(nonCandidateRow)).toEqual({
      text: 'Not drawn: the bound source text was not found in the current paper.',
      live: true,
    });
  }, 120000);

  it('the rendered Visible status field never claims "accepted" except F-2, and never "final"/"canonical" without negation (P2-4, scanned on the rendered page)', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const withoutNegatedAccepted = (text: string) => text.replace(/not\s+(?:final\s+and\s+not\s+)?scientifically accepted/gi, '');
    for (const row of FIGURE_REGISTER) {
      const section = container.querySelector(`section[data-register-row="${row.number}"]`)!;
      const dts = Array.from(section.querySelectorAll('dt'));
      const statusDt = dts.find((dt) => dt.textContent === 'Visible status')!;
      const statusText = statusDt.nextElementSibling?.textContent ?? '';
      if (row.number === 'F-2') {
        expect(statusText).toContain('direction accepted');
      } else {
        expect(withoutNegatedAccepted(statusText).toLowerCase(), row.number).not.toContain('accepted');
      }
      if (/\bfinal\b/i.test(statusText)) expect(statusText, row.number).toMatch(/not final|final binding pending/i);
      if (/\bcanonical\b/i.test(statusText)) expect(statusText, row.number).toMatch(/not (the )?canonical/i);
    }
  }, 120000);

  it('wraps hash-bearing prose at 390px with overflow-wrap:anywhere (not break-all, which also breaks ordinary words): the Content source dd, the packet/ledger intro paragraphs and the adjudication paragraph (P2-5 / round-2 P3)', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    const WRAP_ANYWHERE = '[overflow-wrap:anywhere]';
    const contentSourceDts = Array.from(container.querySelectorAll('dt')).filter((dt) => dt.textContent === 'Content source');
    expect(contentSourceDts.length).toBeGreaterThan(0);
    for (const dt of contentSourceDts) expect(dt.nextElementSibling?.className ?? '').toContain(WRAP_ANYWHERE);
    const paragraphs = Array.from(container.querySelectorAll('p'));
    const adjudicationIntro = paragraphs.find((p) => p.textContent?.includes('Content dispositions follow'));
    const packetIntro = paragraphs.find((p) => p.textContent?.includes('Seven rows carry one of six Matrix MC content candidates'));
    const ledgerIntro = paragraphs.find((p) => p.textContent?.includes("Every row's lineage below is checked against"));
    expect(adjudicationIntro?.className ?? '').toContain(WRAP_ANYWHERE);
    expect(packetIntro?.className ?? '').toContain(WRAP_ANYWHERE);
    expect(ledgerIntro?.className ?? '').toContain(WRAP_ANYWHERE);
    // None of these prose containers use break-all any more (it breaks ordinary words mid-word, not only hashes).
    expect(adjudicationIntro?.className ?? '').not.toContain('break-all');
    expect(packetIntro?.className ?? '').not.toContain('break-all');
    expect(ledgerIntro?.className ?? '').not.toContain('break-all');
    for (const dt of contentSourceDts) expect(dt.nextElementSibling?.className ?? '').not.toContain('break-all');
  }, 120000);

  it('names the source ledger and shows every row lineage kind', async () => {
    Object.assign(process.env, { MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true', MATRIX_OPTIONS_PAPER_FIGURE_LAB: 'true' });
    const { container } = render(await MatrixOptionsPaperFigureLabPage());
    expect(container.textContent).toContain(FIGURE_SOURCE_LEDGER.file);
    expect(container.textContent).toContain(FIGURE_SOURCE_LEDGER.sha256);
    expect(container.textContent).toContain(FIGURE_SOURCE_LEDGER.verdict);
    for (const row of FIGURE_REGISTER) {
      const kindField = container.querySelector(`section[data-register-row="${row.number}"] [data-field="lineage-kind"]`);
      expect(kindField, row.number).not.toBeNull();
      expect(kindField?.textContent, row.number).toBe(row.lineage.kind);
    }
  }, 120000);
});
