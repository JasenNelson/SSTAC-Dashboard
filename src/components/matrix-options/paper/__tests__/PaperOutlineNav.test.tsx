import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { outlineAncestorIds, PaperOutlineNav } from '../PaperOutlineNav';
import type { PaperOutlineNavEntry } from '../PaperOutlineNav';
import { APPENDIX_BOUNDARY_LABEL } from '@/lib/matrix-options/paper/outline-hierarchy';

// A: the document title (first level-1 root with children): shown as one row,
// its chapters (A1) become Main Report rows. B: a chapter-like root with a
// child. C: a leaf.
const outline: readonly PaperOutlineNavEntry[] = [
  { id: 'a', anchor: 'a', label: 'A', depth: 1, level: 1, parentId: null, childIds: ['a1'] },
  { id: 'a1', anchor: 'a1', label: 'A1', depth: 2, level: 2, parentId: 'a', childIds: ['a1a'] },
  { id: 'a1a', anchor: 'a1a', label: 'A1a', depth: 3, level: 3, parentId: 'a1', childIds: ['a1a-i'] },
  { id: 'a1a-i', anchor: 'a1a-i', label: 'A1a-i', depth: 4, level: 4, parentId: 'a1a', childIds: [] },
  { id: 'b', anchor: 'b', label: 'B', depth: 1, level: 1, parentId: null, childIds: ['b1'] },
  { id: 'b1', anchor: 'b1', label: 'B1', depth: 2, level: 2, parentId: 'b', childIds: [] },
  { id: 'c', anchor: 'c', label: 'C', depth: 1, level: 1, parentId: null, childIds: [] },
];

// With a contents heading in each part and an appendix boundary.
const withAppendices: readonly PaperOutlineNavEntry[] = [
  { id: 't', anchor: 't', label: 'Title', depth: 1, level: 1, parentId: null, childIds: ['toc', 'ch1'] },
  { id: 'toc', anchor: 'toc', label: 'Master Table of Contents', depth: 2, level: 2, parentId: 't', childIds: [] },
  { id: 'ch1', anchor: 'ch1', label: '1.0 Chapter', depth: 2, level: 2, parentId: 't', childIds: ['ch11'] },
  { id: 'ch11', anchor: 'ch11', label: '1.1 Part', depth: 3, level: 3, parentId: 'ch1', childIds: [] },
  { id: 'bd', anchor: 'bd', label: APPENDIX_BOUNDARY_LABEL, depth: 1, level: 1, parentId: null, childIds: [] },
  { id: 'apa', anchor: 'apa', label: 'Appendix A: First', depth: 1, level: 1, parentId: null, childIds: ['apatoc', 'apa1'] },
  { id: 'apatoc', anchor: 'apatoc', label: 'Master Table of Contents', depth: 2, level: 2, parentId: 'apa', childIds: [] },
  { id: 'apa1', anchor: 'apa1', label: 'A.1 Section', depth: 2, level: 2, parentId: 'apa', childIds: [] },
];

function renderNav(props: Partial<Parameters<typeof PaperOutlineNav>[0]> = {}) {
  const onNavigate = vi.fn();
  const onSkipToDocument = vi.fn();
  const result = render(<PaperOutlineNav outline={outline} activeAnchor={null} targetAnchor={null} documentTargetId="doc-column" onNavigate={onNavigate} onSkipToDocument={onSkipToDocument} {...props} />);
  return { ...result, onNavigate, onSkipToDocument, desktop: screen.getByTestId('paper-outline-desktop'), stacked: screen.getByTestId('paper-outline-stacked') };
}

function linkNames(container: HTMLElement): string[] {
  return within(container).queryAllByRole('link').map((link) => link.textContent ?? '');
}

describe('PaperOutlineNav (Paper Navigation groups)', () => {
  it('starts with both groups collapsed when neither holds the URL target or the section in view', () => {
    const { desktop } = renderNav({ outline: withAppendices });
    expect(desktop).toHaveClass('hidden', 'lg:block');
    expect(within(desktop).getByRole('navigation', { name: 'Paper navigation' })).toBeInTheDocument();
    const main = within(desktop).getByRole('button', { name: 'Main Report' });
    const appendices = within(desktop).getByRole('button', { name: 'Appendices' });
    expect(main).toHaveAttribute('aria-expanded', 'false');
    expect(appendices).toHaveAttribute('aria-expanded', 'false');
    // Two-sided: the old outline listed depth 1-2 links immediately.
    expect(linkNames(desktop)).toEqual([]);
    fireEvent.click(main);
    expect(main).toHaveAttribute('aria-expanded', 'true');
    expect(linkNames(desktop)).toEqual(['Title', '1.0 Chapter']);
  });

  it('Main Report: the title is one row and each chapter is its own collapsible unit', () => {
    const { desktop } = renderNav();
    fireEvent.click(within(desktop).getByRole('button', { name: 'Main Report' }));
    expect(linkNames(desktop)).toEqual(['A', 'A1', 'B', 'C']);
    // The title row has no disclosure of its own (its chapters are the rows).
    expect(within(desktop).queryByRole('button', { name: 'Subsections of A' })).toBeNull();
    const disclosure = within(desktop).getByRole('button', { name: 'Subsections of A1' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const controlled = document.getElementById(disclosure.getAttribute('aria-controls') ?? '');
    expect(controlled).toHaveAttribute('hidden');
    fireEvent.click(disclosure);
    expect(controlled).not.toHaveAttribute('hidden');
    expect(linkNames(desktop)).toEqual(['A', 'A1', 'A1a', 'B', 'C']);
    // Chapters are collapsible (the old outline kept level-1 entries always open).
    expect(within(desktop).getByRole('button', { name: 'Subsections of B' })).toHaveAttribute('aria-expanded', 'false');
    for (const button of within(desktop).getAllByRole('button')) expect(button).not.toHaveAttribute('aria-pressed');
  });

  it('Appendices: one lettered row per appendix, exact "Master Table of Contents" entries never listed', () => {
    const { desktop } = renderNav({ outline: withAppendices });
    fireEvent.click(within(desktop).getByRole('button', { name: 'Main Report' }));
    fireEvent.click(within(desktop).getByRole('button', { name: 'Appendices' }));
    fireEvent.click(within(desktop).getByRole('button', { name: 'Subsections of Appendix A: First' }));
    expect(linkNames(desktop).map((name) => name.replace(/^A(?=Appendix)/, ''))).toEqual(['Title', '1.0 Chapter', APPENDIX_BOUNDARY_LABEL, 'Appendix A: First', 'A.1 Section']);
    expect(linkNames(desktop).join('|')).not.toContain('Master Table of Contents');
    const appendixRow = within(desktop).getByRole('link', { name: /Appendix A: First/ }).closest('li');
    expect(appendixRow).toHaveAttribute('data-appendix', 'A');
  });

  it('M1-09: gives every link and disclosure, in both variants, a target of at least 44px', () => {
    const { desktop, stacked } = renderNav({ targetAnchor: 'a1a-i' });
    for (const variant of [desktop, stacked]) {
      const links = within(variant).getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link).toHaveClass('min-h-[44px]');
        expect(link.className).not.toMatch(/min-h-\[(?:[0-3]\d|4[0-3])px\]/);
      }
      const buttons = within(variant).getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        const disclosure = button.getAttribute('aria-label')?.startsWith('Subsections of');
        if (disclosure) expect(button).toHaveClass('h-11', 'w-11');
        else expect(button).toHaveClass('min-h-[44px]');
      }
    }
  });

  it('below lg: a skip link leads the same grouped list', () => {
    const { stacked, onSkipToDocument } = renderNav();
    expect(stacked).toHaveClass('lg:hidden');
    const skip = within(stacked).getByRole('link', { name: 'Skip to document' });
    expect(skip).toHaveAttribute('href', '#doc-column');
    expect(linkNames(stacked)).toEqual(['Skip to document']);
    fireEvent.click(within(stacked).getByRole('button', { name: 'Main Report' }));
    expect(linkNames(stacked)).toEqual(['Skip to document', 'A', 'A1', 'B', 'C']);
    expect(fireEvent.click(skip)).toBe(false);
    expect(onSkipToDocument).toHaveBeenCalledTimes(1);
  });

  it('a URL target opens only its group and its ancestors, in both variants', () => {
    const { desktop, stacked } = renderNav({ outline: withAppendices, targetAnchor: 'ch11' });
    for (const variant of [desktop, stacked]) {
      expect(within(variant).getByRole('button', { name: 'Main Report' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(variant).getByRole('button', { name: 'Subsections of 1.0 Chapter' })).toHaveAttribute('aria-expanded', 'true');
      expect(within(variant).getByRole('button', { name: 'Appendices' })).toHaveAttribute('aria-expanded', 'false');
      expect(linkNames(variant)).toContain('1.1 Part');
    }
  });

  it('expands every ancestor of a deep target', () => {
    const { desktop } = renderNav({ targetAnchor: 'a1a-i' });
    expect(within(desktop).getByRole('button', { name: 'Subsections of A1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktop).getByRole('button', { name: 'Subsections of A1a' })).toHaveAttribute('aria-expanded', 'true');
    expect(linkNames(desktop)).toContain('A1a-i');
    expect(within(desktop).getByRole('button', { name: 'Subsections of B' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the active section with aria-current="location" and expands its ancestors when it changes', () => {
    const { desktop, stacked, rerender, onNavigate, onSkipToDocument } = renderNav({ activeAnchor: 'a' });
    expect(within(desktop).getByRole('link', { name: 'A' })).toHaveAttribute('aria-current', 'location');
    rerender(<PaperOutlineNav outline={outline} activeAnchor="b1" targetAnchor={null} documentTargetId="doc-column" onNavigate={onNavigate} onSkipToDocument={onSkipToDocument} />);
    expect(within(desktop).getByRole('link', { name: 'A' })).not.toHaveAttribute('aria-current');
    expect(within(desktop).getByRole('link', { name: 'B1' })).toHaveAttribute('aria-current', 'location');
    expect(within(stacked).getByRole('button', { name: 'Subsections of B' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(stacked).getByRole('link', { name: 'B1' })).toHaveAttribute('aria-current', 'location');
  });

  it('navigates on a plain click and leaves modified clicks to the browser with a canonical section href (M1-04)', () => {
    const { desktop, stacked, onNavigate } = renderNav({ targetAnchor: 'b1' });
    const link = within(desktop).getByRole('link', { name: 'B1' });
    expect(link).toHaveAttribute('href', '?mode=working-draft&section=b1');
    expect(within(stacked).getByRole('link', { name: 'B' })).toHaveAttribute('href', '?mode=working-draft&section=b');
    for (const entry of within(desktop).getAllByRole('link')) expect(entry.getAttribute('href')).not.toMatch(/^#/);
    expect(fireEvent.click(link)).toBe(false);
    expect(onNavigate).toHaveBeenCalledWith('b1');
    onNavigate.mockClear();
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('resolves ancestors nearest first and ignores unknown anchors', () => {
    expect(outlineAncestorIds(outline, 'a1a-i')).toEqual(['a1a', 'a1', 'a']);
    expect(outlineAncestorIds(outline, 'c')).toEqual([]);
    expect(outlineAncestorIds(outline, 'missing')).toEqual([]);
    expect(outlineAncestorIds(outline, null)).toEqual([]);
  });

  it('a group the reader closed stays closed while the section in view changes; a new navigation target reopens it', () => {
    const { desktop, rerender, onNavigate, onSkipToDocument } = renderNav({ activeAnchor: 'a1' });
    const main = within(desktop).getByRole('button', { name: 'Main Report' });
    expect(main).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(main);
    expect(main).toHaveAttribute('aria-expanded', 'false');
    rerender(<PaperOutlineNav outline={outline} activeAnchor="b1" targetAnchor={null} documentTargetId="doc-column" onNavigate={onNavigate} onSkipToDocument={onSkipToDocument} />);
    // Two-sided: scrolling used to reopen it on every section change.
    expect(within(desktop).getByRole('button', { name: 'Main Report' })).toHaveAttribute('aria-expanded', 'false');
    rerender(<PaperOutlineNav outline={outline} activeAnchor="b1" targetAnchor="a1a" documentTargetId="doc-column" onNavigate={onNavigate} onSkipToDocument={onSkipToDocument} />);
    expect(within(desktop).getByRole('button', { name: 'Main Report' })).toHaveAttribute('aria-expanded', 'true');
  });
});
