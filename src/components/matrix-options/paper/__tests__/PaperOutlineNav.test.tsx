import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { outlineAncestorIds, PaperOutlineNav } from '../PaperOutlineNav';
import type { PaperOutlineNavEntry } from '../PaperOutlineNav';

const outline: readonly PaperOutlineNavEntry[] = [
  { id: 'a', anchor: 'a', label: 'A', depth: 1, parentId: null, childIds: ['a1'] },
  { id: 'a1', anchor: 'a1', label: 'A1', depth: 2, parentId: 'a', childIds: ['a1a'] },
  { id: 'a1a', anchor: 'a1a', label: 'A1a', depth: 3, parentId: 'a1', childIds: ['a1a-i'] },
  { id: 'a1a-i', anchor: 'a1a-i', label: 'A1a-i', depth: 4, parentId: 'a1a', childIds: [] },
  { id: 'b', anchor: 'b', label: 'B', depth: 1, parentId: null, childIds: ['b1'] },
  { id: 'b1', anchor: 'b1', label: 'B1', depth: 2, parentId: 'b', childIds: [] },
  { id: 'c', anchor: 'c', label: 'C', depth: 1, parentId: null, childIds: [] },
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

describe('PaperOutlineNav', () => {
  it('shows depth 1-2 at lg and hides deeper levels in collapsed disclosures', () => {
    const { desktop } = renderNav();
    expect(desktop).toHaveClass('hidden', 'lg:block');
    expect(within(desktop).getByRole('navigation', { name: 'Paper outline' })).toBeInTheDocument();
    expect(linkNames(desktop)).toEqual(['A', 'A1', 'B', 'B1', 'C']);
    expect(within(desktop).queryByRole('button', { name: 'Subsections of A' })).toBeNull();
    const disclosure = within(desktop).getByRole('button', { name: 'Subsections of A1' });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    const controlled = document.getElementById(disclosure.getAttribute('aria-controls') ?? '');
    expect(controlled).not.toBeNull();
    expect(controlled).toHaveAttribute('hidden');
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(controlled).not.toHaveAttribute('hidden');
    expect(linkNames(desktop)).toEqual(['A', 'A1', 'A1a', 'B', 'B1', 'C']);
    expect(within(desktop).getByRole('button', { name: 'Subsections of A1a' })).toHaveAttribute('aria-expanded', 'false');
    for (const button of within(desktop).getAllByRole('button')) expect(button).not.toHaveAttribute('aria-pressed');
  });

  it('M1-09: gives every desktop and stacked link and disclosure a target of at least 44px', () => {
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
        expect(button).toHaveClass('h-11', 'w-11');
        expect(button).not.toHaveClass('h-8', 'w-8');
      }
    }
  });

  it('shows only depth-1 entries below lg, each with a disclosure, plus a skip link', () => {
    const { stacked, onSkipToDocument } = renderNav();
    expect(stacked).toHaveClass('lg:hidden');
    const skip = within(stacked).getByRole('link', { name: 'Skip to document' });
    expect(skip).toHaveAttribute('href', '#doc-column');
    expect(linkNames(stacked)).toEqual(['Skip to document', 'A', 'B', 'C']);
    expect(within(stacked).getByRole('button', { name: 'Subsections of A' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(stacked).getByRole('button', { name: 'Subsections of B' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(stacked).queryByRole('button', { name: 'Subsections of C' })).toBeNull();
    for (const link of within(stacked).getAllByRole('link')) expect(link).toHaveClass('min-h-[44px]');
    fireEvent.click(within(stacked).getByRole('button', { name: 'Subsections of A' }));
    expect(linkNames(stacked)).toEqual(['Skip to document', 'A', 'A1', 'B', 'C']);
    expect(fireEvent.click(skip)).toBe(false);
    expect(onSkipToDocument).toHaveBeenCalledTimes(1);
  });

  it('expands every ancestor of the target section in both variants', () => {
    const { desktop, stacked } = renderNav({ targetAnchor: 'a1a-i' });
    expect(within(desktop).getByRole('button', { name: 'Subsections of A1' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktop).getByRole('button', { name: 'Subsections of A1a' })).toHaveAttribute('aria-expanded', 'true');
    expect(linkNames(desktop)).toContain('A1a-i');
    expect(within(stacked).getByRole('button', { name: 'Subsections of A' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(stacked).getByRole('button', { name: 'Subsections of B' })).toHaveAttribute('aria-expanded', 'false');
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
    const { desktop, stacked, onNavigate } = renderNav();
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
});
