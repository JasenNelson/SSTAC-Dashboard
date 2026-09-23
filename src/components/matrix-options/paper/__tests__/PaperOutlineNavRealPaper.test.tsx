import { render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { outlineAncestorIds, PaperOutlineNav } from '../PaperOutlineNav';
import { getPaperNavOutline } from '../PaperDocument';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';

const CHAPTER_7 = '7.0 Phase 2 Research Topics Supporting the Matrix Options Paper';
const SECTION_7_8 = 'Section 7.8: Input Parameter Inventory and Selection Options';

describe('Working Draft outline on the authenticated release', () => {
  const outline = getPaperNavOutline(loadRevisedPaperStructure());
  // First occurrence wins: the appendices repeat "Matrix Options evidence and method boundary".
  const byLabel = new Map([...outline].reverse().map((entry) => [entry.label, entry]));

  it('carries the reader hierarchy for section 7 while keeping the authored depth for loading', () => {
    const chapter = byLabel.get(CHAPTER_7)!;
    const s78 = byLabel.get(SECTION_7_8)!;
    expect(s78.parentId).toBe(chapter.id);
    expect(s78.level).toBe(3);
    expect(s78.depth).toBe(1);
    expect(byLabel.get('Section 7.2 Bioaccumulation draft text')!.parentId).toBe(chapter.id);
    expect(byLabel.get('Matrix Options evidence and method boundary')!.parentId).toBe(chapter.id);
    expect(byLabel.get('Policy-ready input categories - Phase 2 boundary')!.parentId).toBe(s78.id);
  });

  it('deep-link ancestry for 7.8.2 expands 7.8, 7.0 and the title (not a spurious root)', () => {
    const target = byLabel.get('7.8.2 Source submission and primary verification')!;
    const ancestors = outlineAncestorIds(outline, target.anchor).map((id) => outline.find((entry) => entry.id === id)!.label);
    expect(ancestors).toEqual([SECTION_7_8, CHAPTER_7, 'Matrix Sediment Standards Options Paper']);
  });

  it('renders 7.8 and the policy boundary nested inside chapter 7 in the desktop outline', () => {
    const target = byLabel.get('7.8.2 Source submission and primary verification')!;
    const { getByTestId } = render(<PaperOutlineNav outline={outline} activeAnchor={null} targetAnchor={target.anchor} documentTargetId="doc" onNavigate={() => undefined} />);
    const desktop = getByTestId('paper-outline-desktop');
    const chapterItem = within(desktop).getByRole('link', { name: CHAPTER_7 }).closest('li')!;
    const s78Link = within(chapterItem).getByRole('link', { name: SECTION_7_8 });
    const s78Item = s78Link.closest('li')!;
    expect(within(s78Item).getByRole('link', { name: '7.8.1 Inventory, provenance and status discipline' })).toBeTruthy();
    expect(within(s78Item).getByRole('link', { name: 'Policy-ready input categories - Phase 2 boundary' })).toBeTruthy();
    // Two-sided: the chapters after 7 are siblings of chapter 7, not its descendants.
    expect(within(chapterItem).queryByRole('link', { name: '8.0 Evaluation Criteria' })).toBeNull();
  });
});
