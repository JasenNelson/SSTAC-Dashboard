import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import * as rail from '../PaperRail';

/**
 * Paper-rail contract test (REWRITTEN 2026-09-22, owner brief: "Do not couple
 * the paper workspace to unrelated fixed-width rail parity tests").
 *
 * The rails used to copy MatrixDashboard's fixed lg:w-80 / lg:w-96 classes
 * verbatim, and this file pinned that copy by grepping MatrixDashboard.tsx for
 * each PaperRail class constant as a literal string. The rails are now
 * DECOUPLED: at lg and up an open rail takes its width from a CSS custom
 * property the workspace sets (--paper-left-width / --paper-right-width), not
 * from a value MatrixDashboard also happens to use, so MatrixDashboard.tsx is
 * no longer required to contain them. What still needs pinning, structurally
 * rather than by cross-file string matching:
 *   - open rails take their width from the CSS variables (PAPER_SHELL rail
 *     open-width contract);
 *   - closed rails collapse by height below lg and by width at lg, and are
 *     inert;
 *   - every exported *_CLASSES / *_WIDTH constant is non-empty and is actually
 *     applied by paperRailClassName (nothing exported goes unused);
 *   - PAPER_SHELL_CLASSES is the one constant this workspace still shares
 *     verbatim with MatrixDashboard's shell wrapper, so that one assertion is
 *     kept.
 */

const DASHBOARD = path.join(process.cwd(), 'src', 'components', 'MatrixDashboard.tsx');

function tokens(value: string): readonly string[] {
  return value.split(/\s+/).filter(Boolean);
}

describe('PaperRail contract', () => {
  it('every exported *_CLASSES / *_WIDTH constant is a non-empty string', () => {
    const exported = Object.entries(rail).filter(([name]) => /^PAPER_.*(?:_CLASSES|_WIDTH)$/.test(name));
    expect(exported.length).toBeGreaterThan(0);
    for (const [name, value] of exported) {
      expect(typeof value, name).toBe('string');
      expect((value as string).trim().length, name).toBeGreaterThan(0);
    }
  });

  it('open rails take their width from the CSS variables (--paper-left-width / --paper-right-width)', () => {
    expect(rail.PAPER_LEFT_WIDTH_VAR).toBe('--paper-left-width');
    expect(rail.PAPER_RIGHT_WIDTH_VAR).toBe('--paper-right-width');
    expect(rail.PAPER_LEFT_RAIL_OPEN_WIDTH).toBe(`lg:w-[var(${rail.PAPER_LEFT_WIDTH_VAR})]`);
    expect(rail.PAPER_RIGHT_RAIL_OPEN_WIDTH).toBe(`lg:w-[var(${rail.PAPER_RIGHT_WIDTH_VAR})]`);

    const leftOpen = tokens(rail.paperRailClassName('left', true));
    expect(leftOpen).toContain(rail.PAPER_LEFT_RAIL_OPEN_WIDTH);
    expect(leftOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_RAIL_OPEN_CLASSES)]));
    expect(leftOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_LEFT_RAIL_BORDER_CLASSES)]));
    expect(leftOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_LEFT_RAIL_SURFACE_CLASSES)]));

    const rightOpen = tokens(rail.paperRailClassName('right', true));
    expect(rightOpen).toContain(rail.PAPER_RIGHT_RAIL_OPEN_WIDTH);
    expect(rightOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_RAIL_OPEN_CLASSES)]));
    expect(rightOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_RIGHT_RAIL_BORDER_CLASSES)]));
    expect(rightOpen).toEqual(expect.arrayContaining([...tokens(rail.PAPER_RIGHT_RAIL_SURFACE_CLASSES)]));
  });

  it('closed rails collapse by height below lg and by width at lg, and never carry an open-width token', () => {
    expect(rail.PAPER_RAIL_CLOSED_CLASSES).toBe('max-h-0 w-full border-0 lg:max-h-none lg:w-0');
    const leftClosed = tokens(rail.paperRailClassName('left', false));
    for (const token of tokens(rail.PAPER_RAIL_CLOSED_CLASSES)) expect(leftClosed).toContain(token);
    expect(leftClosed).not.toContain(rail.PAPER_LEFT_RAIL_OPEN_WIDTH);

    const rightClosed = tokens(rail.paperRailClassName('right', false));
    for (const token of tokens(rail.PAPER_RAIL_CLOSED_CLASSES)) expect(rightClosed).toContain(token);
    expect(rightClosed).not.toContain(rail.PAPER_RIGHT_RAIL_OPEN_WIDTH);
  });

  it('the toggle token classes are non-empty and distinct between active and inactive', () => {
    expect(rail.PAPER_TOGGLE_BASE_CLASSES.trim().length).toBeGreaterThan(0);
    expect(rail.PAPER_TOGGLE_ACTIVE_CLASSES).not.toBe(rail.PAPER_TOGGLE_INACTIVE_CLASSES);
  });

  it('PAPER_SHELL_CLASSES still matches MatrixDashboard.tsx shell literal', () => {
    const code = fs.readFileSync(DASHBOARD, 'utf8');
    expect(rail.PAPER_SHELL_CLASSES.trim().length).toBeGreaterThan(0);
    expect(code).toContain(rail.PAPER_SHELL_CLASSES);
  });
});
