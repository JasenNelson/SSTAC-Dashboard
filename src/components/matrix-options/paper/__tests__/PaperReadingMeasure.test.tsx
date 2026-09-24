import fs from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaperChunkSection } from '../PaperChunkSection';
import { PaperText } from '../PaperText';
import { ReaderWidthControl } from '../ReaderWidthControl';

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8').replace(/\r\n/g, '\n');

/** The `@layer components { ... }` block that holds the paper reading-frame rules (brace matched). */
function paperFrameLayer(source: string): string {
  const at = source.indexOf('.paper-reading-frame {');
  expect(at).toBeGreaterThanOrEqual(0);
  const open = source.lastIndexOf('@layer components {', at);
  expect(open).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let index = source.indexOf('{', open); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(source.indexOf('{', open) + 1, index);
  }
  throw new Error('unbalanced @layer block');
}

type Rule = { selector: string; style: CSSStyleDeclaration; print: boolean; order: number };

/** Parses CSS rules with the browser CSSOM (jsdom); rules inside `@media print` are tagged. */
function parseRules(text: string): Rule[] {
  const style = document.createElement('style');
  style.textContent = text;
  document.head.appendChild(style);
  const rules: Rule[] = [];
  const walk = (list: CSSRuleList, print: boolean) => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSMediaRule) walk(rule.cssRules, print || /\bprint\b/.test(rule.media.mediaText));
      else if (rule instanceof CSSStyleRule) rules.push({ selector: rule.selectorText, style: rule.style, print, order: rules.length });
    }
  };
  walk(style.sheet!.cssRules, false);
  style.remove();
  return rules;
}

/** Selector specificity [ids, classes/attributes/pseudo-classes, types]; :where() contributes nothing. */
function specificity(selector: string): [number, number, number] {
  const plain = selector.replace(/:where\([^)]*\)/g, '');
  const ids = (plain.match(/#[\w-]+/g) ?? []).length;
  const classes = (plain.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = (plain.replace(/\[[^\]]+\]|\.[\w-]+|#[\w-]+|:[\w-]+/g, ' ').match(/(^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length;
  return [ids, classes, types];
}

/** Splits a selector list at top-level commas only (commas inside :where(...) stay). */
function topLevelSelectors(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) { parts.push(current.trim()); current = ''; } else current += char;
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/** The cascaded value of one property for an element: highest specificity, then latest rule. */
function cascaded(rules: Rule[], element: Element, property: string, media: 'screen' | 'print'): string | undefined {
  let winner: { value: string; spec: [number, number, number]; order: number } | undefined;
  for (const rule of rules) {
    if (rule.print && media !== 'print') continue;
    const value = rule.style.getPropertyValue(property);
    if (!value) continue;
    for (const part of topLevelSelectors(rule.selector)) {
      if (!element.matches(part)) continue;
      const spec = specificity(part);
      const beats = !winner || spec[0] > winner.spec[0] || (spec[0] === winner.spec[0] && (spec[1] > winner.spec[1] || (spec[1] === winner.spec[1] && (spec[2] > winner.spec[2] || (spec[2] === winner.spec[2] && rule.order >= winner.order)))));
      if (beats) winner = { value, spec, order: rule.order };
    }
  }
  return winner?.value;
}

/** A reading frame holding one of every body block and one table, as the paper renders them. */
function paperFrame(width: 'comfortable' | 'wide') {
  document.body.innerHTML = `<div class="paper-reading-frame" data-reader-width="${width}"><section><div class="reader-prose"><div class="math-renderer"><h2>H</h2><h3>H</h3><p>P</p><ul><li>L</li></ul><ol><li>L</li></ol><dl><dt>T</dt></dl><blockquote>Q</blockquote><hr><table><tbody><tr><td>T</td></tr></tbody></table></div></div></section></div>`;
  const frame = document.querySelector('.paper-reading-frame')!;
  const blocks = Array.from(document.querySelectorAll('.math-renderer > :not(table)'));
  const table = document.querySelector('.math-renderer > table')!;
  return { frame, blocks, table };
}

/** An inner cap on a body block: ANY max-width other than none/100% (ch, rem, px, a variable), or per-block centring. */
function innerMeasure(rules: Rule[], element: Element, media: 'screen' | 'print'): string | null {
  const maxWidth = cascaded(rules, element, 'max-width', media);
  if (maxWidth && !['none', '100%', 'initial', 'unset'].includes(maxWidth)) return `max-width ${maxWidth}`;
  for (const property of ['margin-inline', 'margin-left', 'margin-right', 'margin']) {
    const value = cascaded(rules, element, property, media);
    if (value && /\bauto\b/.test(value)) return `${property} ${value}`;
  }
  return null;
}

/**
 * Tailwind utilities outrank @layer components, so a width cap or centring can
 * also arrive as a class. Any class that would cap or centre a body block --
 * on the block itself, or as an arbitrary child variant on an ancestor
 * (e.g. `[&_p]:max-w-prose`) -- is reported. The wrapper's own `max-w-none`
 * (which removes a cap) is allowed.
 */
function cappingUtilities(root: Element): string[] {
  const found: string[] = [];
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    for (const name of Array.from(element.classList)) {
      const utility = name.includes(']:') ? name.slice(name.lastIndexOf(']:') + 2) : name.replace(/^(?:[a-z0-9-]+:)+/, '');
      if (/^max-w-(?!none$|full$)/.test(utility) || /^mx-auto$/.test(utility) || /^w-\[[0-9.]+ch\]$/.test(utility)) {
        if (!name.startsWith('print:')) found.push(`${element.tagName.toLowerCase()}.${name}`);
      }
    }
  }
  return found;
}

const frameRules = parseRules(paperFrameLayer(css));

describe('paper reading frame width (globals.css, resolved through the cascade)', () => {
  it('positive control: the checker flags the previous per-block measure (a ch cap centred with margin-inline: auto)', () => {
    const previous = parseRules(`.paper-reading-frame { --paper-measure: 100%; }
      .paper-reading-frame .reader-prose .math-renderer > :where(p, ul, ol, dl, blockquote, h1, h2, h3, h4, h5, h6, hr) { max-width: var(--paper-measure); margin-inline: auto; }`);
    const { blocks } = paperFrame('comfortable');
    for (const block of blocks) expect(innerMeasure(previous, block, 'screen')).not.toBeNull();
  });

  it('positive control: the checker also flags a non-ch cap (rem) on headings and lists, and a margin shorthand centring', () => {
    const capped = parseRules(`.paper-reading-frame .reader-prose .math-renderer > :where(h2, h3, ul, ol, dl) { max-width: 60rem; }
      .paper-reading-frame .reader-prose .math-renderer > hr { margin: 0 auto; }`);
    const { blocks } = paperFrame('comfortable');
    for (const tag of ['H2', 'H3', 'UL', 'OL', 'DL', 'HR']) expect(innerMeasure(capped, blocks.find((block) => block.tagName === tag)!, 'screen')).not.toBeNull();
  });

  it('no utility class caps or centres a rendered body block (utilities outrank the component layer)', () => {
    const markdown = '## Heading\n\n### Sub heading\n\nA paragraph of body text.\n\n- one\n- two\n\n1. first\n2. second\n\n> A quoted note.\n\n---\n\n| a | b |\n|---|---|\n| 1 | 2 |';
    const { container } = render(<PaperText markdown={markdown} />);
    const prose = container.querySelector('.reader-prose')!;
    for (const tag of ['h2', 'h3', 'p', 'ul', 'ol', 'blockquote', 'hr', 'table']) expect(prose.querySelector(tag)).not.toBeNull();
    expect(cappingUtilities(prose)).toEqual([]);
    const { container: section } = render(<PaperChunkSection chunk={{ id: 'c-1', anchor: 'one', depth: 2, label: 'One', markdown }} region="main" />);
    expect(cappingUtilities(section.firstElementChild!)).toEqual([]);
    // Positive control: the guard sees a child-variant cap and a direct one.
    const probe = document.createElement('div');
    probe.innerHTML = '<div class="reader-prose [&_p]:max-w-prose"><h2 class="mx-auto">H</h2><p class="lg:max-w-[70ch]">P</p></div>';
    expect(cappingUtilities(probe.firstElementChild!)).toEqual(['div.[&_p]:max-w-prose', 'h2.mx-auto', 'p.lg:max-w-[70ch]']);
  });

  it('body blocks (paragraphs, lists, definition lists, quotes, headings, rules) get no inner ch measure and no per-block centring, in both preferences', () => {
    for (const width of ['comfortable', 'wide'] as const) {
      const { blocks } = paperFrame(width);
      expect(blocks.map((block) => block.tagName)).toEqual(['H2', 'H3', 'P', 'UL', 'OL', 'DL', 'BLOCKQUOTE', 'HR']);
      for (const block of blocks) expect({ tag: block.tagName, width, inner: innerMeasure(frameRules, block, 'screen') }).toEqual({ tag: block.tagName, width, inner: null });
    }
  });

  it('body prose and tables share the same available frame: neither is capped inside it', () => {
    const { blocks, table } = paperFrame('comfortable');
    const paragraph = blocks.find((block) => block.tagName === 'P')!;
    // The fallback 84ch cap for prose OUTSIDE a reading frame is overridden inside it.
    expect(cascaded(frameRules, paragraph, 'max-width', 'screen')).toBe('none');
    expect(['none', undefined]).toContain(cascaded(frameRules, table, 'max-width', 'screen'));
  });

  it('Comfortable and Wide set the FRAME maximum (80rem / 96rem) and the frame stays fluid below it', () => {
    const comfortable = paperFrame('comfortable').frame;
    expect(cascaded(frameRules, comfortable, 'max-width', 'screen')).toBe('80rem');
    expect(cascaded(frameRules, comfortable, 'width', 'screen')).toBe('100%');
    const wide = paperFrame('wide').frame;
    expect(cascaded(frameRules, wide, 'max-width', 'screen')).toBe('96rem');
    expect(cascaded(frameRules, wide, 'width', 'screen')).toBe('100%');
  });

  it('print is uncapped for both preferences (the frame and every body block)', () => {
    for (const width of ['comfortable', 'wide'] as const) {
      const { frame, blocks } = paperFrame(width);
      expect(cascaded(frameRules, frame, 'max-width', 'print')).toBe('none');
      for (const block of blocks) expect(innerMeasure(frameRules, block, 'print')).toBeNull();
    }
  });

  it('outside a reading frame, prose keeps the previous fixed 84ch measure, and PaperText adds no cap of its own', () => {
    document.body.innerHTML = '<div class="reader-prose"><div class="math-renderer"><p>P</p></div></div>';
    expect(cascaded(frameRules, document.querySelector('p')!, 'max-width', 'screen')).toBe('84ch');
    const { container } = render(<PaperText markdown={'A paragraph.\n\n| a | b |\n|---|---|\n| 1 | 2 |'} />);
    expect(container.querySelector('.reader-prose')?.className).not.toMatch(/84ch|max-w-\[/);
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
