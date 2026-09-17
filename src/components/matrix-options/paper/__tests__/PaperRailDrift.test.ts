import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as rail from '../PaperRail';

/**
 * Drift guard: the paper workspace rails copy the Catalogue/Calculator rail
 * class contract from MatrixDashboard.tsx instead of importing it (MatrixDashboard
 * is not modified). Every PaperRail class constant must still appear in the
 * MatrixDashboard source as a complete quoted string literal, so a change on
 * either side fails here. Same technique as demotedDocumentTabsDrift.test.ts:
 * read source text, strip comments, match literals.
 */

const DASHBOARD = path.join(process.cwd(), 'src', 'components', 'MatrixDashboard.tsx');

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quotedLiteral(value: string): RegExp {
  return new RegExp(`(['"\`])${escapeRegExp(value)}\\1`);
}

const PINNED: readonly (readonly [string, string])[] = [
  ['PAPER_TOGGLE_BASE_CLASSES', rail.PAPER_TOGGLE_BASE_CLASSES],
  ['PAPER_TOGGLE_ACTIVE_CLASSES', rail.PAPER_TOGGLE_ACTIVE_CLASSES],
  ['PAPER_TOGGLE_INACTIVE_CLASSES', rail.PAPER_TOGGLE_INACTIVE_CLASSES],
  ['PAPER_SHELL_CLASSES', rail.PAPER_SHELL_CLASSES],
  ['PAPER_LEFT_RAIL_BASE_CLASSES', rail.PAPER_LEFT_RAIL_BASE_CLASSES],
  ['PAPER_LEFT_RAIL_BORDER_CLASSES', rail.PAPER_LEFT_RAIL_BORDER_CLASSES],
  ['PAPER_LEFT_RAIL_SURFACE_CLASSES', rail.PAPER_LEFT_RAIL_SURFACE_CLASSES],
  ['PAPER_LEFT_RAIL_OPEN_CLASSES', rail.PAPER_LEFT_RAIL_OPEN_CLASSES],
  ['PAPER_LEFT_RAIL_OPEN_WIDTH', rail.PAPER_LEFT_RAIL_OPEN_WIDTH],
  ['PAPER_LEFT_RAIL_CLOSED_CLASSES', rail.PAPER_LEFT_RAIL_CLOSED_CLASSES],
  ['PAPER_LEFT_RAIL_INNER_CLASSES', rail.PAPER_LEFT_RAIL_INNER_CLASSES],
  ['PAPER_RIGHT_RAIL_BASE_CLASSES', rail.PAPER_RIGHT_RAIL_BASE_CLASSES],
  ['PAPER_RIGHT_RAIL_BORDER_CLASSES', rail.PAPER_RIGHT_RAIL_BORDER_CLASSES],
  ['PAPER_RIGHT_RAIL_SURFACE_CLASSES', rail.PAPER_RIGHT_RAIL_SURFACE_CLASSES],
  ['PAPER_RIGHT_RAIL_OPEN_CLASSES', rail.PAPER_RIGHT_RAIL_OPEN_CLASSES],
  ['PAPER_RIGHT_RAIL_OPEN_WIDTH', rail.PAPER_RIGHT_RAIL_OPEN_WIDTH],
  ['PAPER_RIGHT_RAIL_CLOSED_CLASSES', rail.PAPER_RIGHT_RAIL_CLOSED_CLASSES],
  ['PAPER_RIGHT_RAIL_INNER_WIDTH', rail.PAPER_RIGHT_RAIL_INNER_WIDTH],
];

describe('PaperRail class parity with MatrixDashboard', () => {
  const code = stripComments(fs.readFileSync(DASHBOARD, 'utf8'));

  it('pins every exported rail class constant', () => {
    const exported = Object.entries(rail)
      .filter(([name, value]) => /^PAPER_.*(?:_CLASSES|_WIDTH)$/.test(name) && typeof value === 'string')
      .map(([name]) => name)
      .sort();
    expect(exported).toEqual(PINNED.map(([name]) => name).sort());
  });

  it.each(PINNED)('%s appears verbatim as a string literal in MatrixDashboard.tsx', (_name, value) => {
    expect(value.trim().length).toBeGreaterThan(0);
    expect(code).toMatch(quotedLiteral(value));
  });

  it('keeps the width bindings MatrixDashboard uses for the Catalogue left rail and Calculator right rail', () => {
    expect(code).toMatch(/isCalculatorMode \? 'lg:w-96' : 'lg:w-80'/);
    expect(code).toMatch(/rightPanelOpenWidth =\s*activeTopTab === 'Calculator' \? 'lg:w-96' : 'lg:w-80'/);
    expect(code).toMatch(/rightPanelInnerWidth =\s*activeTopTab === 'Calculator' \? 'w-full lg:w-\[384px\]'/);
    expect(code).toMatch(/inert=\{effectiveShowLeftPanel \? undefined : true\}/);
    expect(code).toMatch(/inert=\{effectiveShowRightPanel \? undefined : true\}/);
  });

  it('applies the pinned constants in the rendered rail class names', () => {
    const tokens = (value: string) => value.split(/\s+/).filter(Boolean);
    const leftOpen = rail.paperRailClassName('left', true).split(' ');
    for (const token of [...tokens(rail.PAPER_LEFT_RAIL_BASE_CLASSES), ...tokens(rail.PAPER_LEFT_RAIL_SURFACE_CLASSES), ...tokens(rail.PAPER_LEFT_RAIL_OPEN_CLASSES), rail.PAPER_LEFT_RAIL_OPEN_WIDTH]) {
      expect(leftOpen).toContain(token);
    }
    const leftClosed = rail.paperRailClassName('left', false).split(' ');
    for (const token of tokens(rail.PAPER_LEFT_RAIL_CLOSED_CLASSES)) expect(leftClosed).toContain(token);
    const rightOpen = rail.paperRailClassName('right', true).split(' ');
    for (const token of [...tokens(rail.PAPER_RIGHT_RAIL_BASE_CLASSES), ...tokens(rail.PAPER_RIGHT_RAIL_SURFACE_CLASSES), rail.PAPER_RIGHT_RAIL_OPEN_CLASSES, rail.PAPER_RIGHT_RAIL_OPEN_WIDTH]) {
      expect(rightOpen).toContain(token);
    }
    const rightClosed = rail.paperRailClassName('right', false).split(' ');
    for (const token of tokens(rail.PAPER_RIGHT_RAIL_CLOSED_CLASSES)) expect(rightClosed).toContain(token);
  });
});
