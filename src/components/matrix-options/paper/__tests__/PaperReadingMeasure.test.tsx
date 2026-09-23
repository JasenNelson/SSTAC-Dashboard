import fs from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaperChunkSection } from '../PaperChunkSection';
import { PaperText } from '../PaperText';
import { ReaderWidthControl } from '../ReaderWidthControl';

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n');
/** The block of CSS rules inside one `@container paper-column (min-width: X)` query. */
function containerTier(minWidth: string): string {
  const start = css.indexOf(`@container paper-column (min-width: ${minWidth})`);
  expect(start).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}\n  }', start) + 4);
}

describe('adaptive reading measure (globals.css contract)', () => {
  it('makes the document column an inline-size container, so panel resizing changes the measure', () => {
    expect(css).toMatch(/\.paper-reading-column\s*\{\s*container:\s*paper-column\s*\/\s*inline-size;/);
  });

  it('prose is fluid below the first tier, then comfortable ~80/~92/~102 characters, wide scaled up', () => {
    expect(css).toMatch(/\.paper-reading-frame\s*\{\s*--paper-measure:\s*100%;/);
    const tiers = [['44rem', '67ch', '75ch'], ['64rem', '78ch', '88ch'], ['104rem', '85ch', '96ch']] as const;
    for (const [width, comfortable, wide] of tiers) {
      const tier = containerTier(width);
      expect(tier).toContain(`.paper-reading-frame { --paper-measure: ${comfortable}; }`);
      expect(tier).toContain(`.paper-reading-frame[data-reader-width='wide'] { --paper-measure: ${wide}; }`);
    }
  });

  it('print uses the whole page for BOTH preferences: the print override is at least as specific as every tier rule', () => {
    // Specificity of a simple compound selector: classes plus attribute selectors.
    const weight = (selector: string) => (selector.match(/\.[\w-]+/g) ?? []).length + (selector.match(/\[[^\]]+\]/g) ?? []).length;
    const print = /@media print\s*\{\s*(?:\/\*[\s\S]*?\*\/\s*)?([^{]+)\{\s*--paper-measure:\s*none;/.exec(css.slice(css.indexOf('.paper-reading-column')));
    expect(print).not.toBeNull();
    const printSelectors = print![1].split(',').map((item) => item.trim());
    // One print selector must match a Wide frame (attribute presence or the wide value).
    const wideMatching = printSelectors.filter((selector) => /^\.paper-reading-frame(\[data-reader-width(='wide')?\])?$/.test(selector) && selector.includes('[data-reader-width'));
    // Two-sided: the previous override was only `.paper-reading-frame` (weight 1),
    // which the Wide tier rule (weight 2) beat inside a container tier.
    expect(wideMatching.length).toBeGreaterThan(0);
    for (const width of ['44rem', '64rem', '104rem']) {
      const tier = containerTier(width);
      for (const rule of tier.match(/\.paper-reading-frame[^{]*/g) ?? []) {
        expect(Math.max(...wideMatching.map(weight))).toBeGreaterThanOrEqual(weight(rule.trim()));
      }
    }
    // The print block comes after the tiers, so equal specificity wins by source order.
    expect(css.lastIndexOf('@media print')).toBeGreaterThan(css.indexOf("@container paper-column (min-width: 104rem)"));
  });

  it('applies the measure to prose only; tables, code and display maths break out to the full frame', () => {
    const rule = /\.paper-reading-frame \.reader-prose \.math-renderer > :where\(([^)]*)\)\s*\{\s*max-width: var\(--paper-measure\);\s*margin-inline: auto;/.exec(css);
    expect(rule).not.toBeNull();
    const selectors = rule![1].split(',').map((item) => item.trim());
    expect(selectors).toEqual(expect.arrayContaining(['p', 'ul', 'ol', 'blockquote', 'h2', 'h3']));
    for (const wide of ['table', 'pre', 'div', 'figure', 'span']) expect(selectors).not.toContain(wide);
  });

  it('PaperText no longer hard-codes the previous fixed 84ch prose cap (the measure is adaptive)', () => {
    const { container } = render(<PaperText markdown={'A paragraph.\n\n| a | b |\n|---|---|\n| 1 | 2 |'} />);
    const wrapper = container.querySelector('.reader-prose');
    expect(wrapper?.className).not.toMatch(/84ch/);
    // Two-sided: outside a reading frame a fallback keeps the old measure.
    expect(css).toMatch(/\.reader-prose \.math-renderer > :where\(p, ul, ol, blockquote\)\s*\{\s*max-width:\s*84ch;/);
  });
});

describe('ReaderWidthControl', () => {
  it('is a two-option radio group that reports the choice and moves with arrow keys (roving focus)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ReaderWidthControl value="comfortable" onChange={onChange} />);
    const comfortable = screen.getByRole('radio', { name: 'Comfortable' });
    const wide = screen.getByRole('radio', { name: 'Wide' });
    expect(screen.getByRole('radiogroup', { name: 'Reading width' })).toBeInTheDocument();
    expect(comfortable).toHaveAttribute('aria-checked', 'true');
    expect(wide).toHaveAttribute('aria-checked', 'false');
    expect(comfortable).toHaveAttribute('tabindex', '0');
    expect(wide).toHaveAttribute('tabindex', '-1');
    fireEvent.click(wide);
    expect(onChange).toHaveBeenLastCalledWith('wide');
    rerender(<ReaderWidthControl value="wide" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Wide' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('comfortable');
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveClass('min-h-[44px]');
  });
});

describe('in-paper contents heading (presentation relabel)', () => {
  const chunk = (label: string, markdown: string) => ({ id: `c-${label}`, anchor: 'master-table-of-contents', depth: 2, label, markdown });

  it('shows the exact "Master Table of Contents" heading as "Paper contents" in the main report and keeps the anchor', () => {
    const { container } = render(<PaperChunkSection chunk={chunk('Master Table of Contents', '## Master Table of Contents\n\n1. [Intro](#intro)')} region="main" />);
    expect(screen.getByRole('heading', { name: 'Paper contents' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Master Table of Contents' })).toBeNull();
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('id', 'master-table-of-contents');
    expect(section).toHaveAccessibleName('Paper contents');
  });

  it('shows it as "Appendix contents" after the appendix boundary, and leaves every other heading alone', () => {
    render(<PaperChunkSection chunk={chunk('Master Table of Contents', '## Master Table of Contents\n\ntext')} region="appendix" />);
    expect(screen.getByRole('heading', { name: 'Appendix contents' })).toBeInTheDocument();
    render(<PaperChunkSection chunk={{ ...chunk('1.0 Introduction', '## 1.0 Introduction\n\ntext'), anchor: 'intro' }} region="appendix" />);
    expect(screen.getByRole('heading', { name: '1.0 Introduction' })).toBeInTheDocument();
  });
});
