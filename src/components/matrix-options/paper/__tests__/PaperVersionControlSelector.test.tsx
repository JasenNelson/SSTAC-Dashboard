import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PAPER_RELEASES, PREDECESSOR_PAPER_VERSION, R5_PAPER_VERSION, SELECTABLE_PAPER_RELEASES, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';

import { PaperVersionControl } from '../PaperVersionControl';

/*
 * R5 stays in the registry (lineage, historical contracts) but is not offered in the selector.
 * A page that IS R5 (direct address) still names itself as the current entry.
 */

const context = { mode: 'working-draft', cohort: null, stableSectionId: 'sec-7-8' } as const;

function openPopover(documentVersion: string) {
  render(<PaperVersionControl documentVersion={documentVersion} buttonClassName="btn" {...context} />);
  fireEvent.click(screen.getByTestId('paper-version-toggle'));
  return screen.getByTestId('paper-version-popover');
}

describe('R5 is out of the draft selector', () => {
  it('the selectable list excludes R5 and keeps the registry whole', () => {
    expect(SELECTABLE_PAPER_RELEASES.map((release) => release.documentVersion)).toEqual([V0991_PAPER_VERSION, PREDECESSOR_PAPER_VERSION]);
    expect(PAPER_RELEASES.map((release) => release.documentVersion)).toContain(R5_PAPER_VERSION);
  });

  it.each([['v0.9.91', V0991_PAPER_VERSION], ['the predecessor', PREDECESSOR_PAPER_VERSION]])('viewing %s: no R5 entry and no R5 link', (_name, version) => {
    const popover = openPopover(version);
    expect(within(popover).queryByTestId(`paper-version-option-${R5_PAPER_VERSION}`)).toBeNull();
    expect(popover.querySelector(`a[href*="${R5_PAPER_VERSION}"]`)).toBeNull();
    expect(within(popover).getAllByRole('listitem')).toHaveLength(SELECTABLE_PAPER_RELEASES.length);
  });

  it('viewing R5 directly: it is still shown, as the current entry and not a link', () => {
    const popover = openPopover(R5_PAPER_VERSION);
    const current = within(popover).getByTestId(`paper-version-option-${R5_PAPER_VERSION}`);
    expect(current.tagName).toBe('DIV');
    expect(current).toHaveAttribute('aria-current', 'true');
    expect(popover.querySelector(`a[href*="${R5_PAPER_VERSION}"]`)).toBeNull();
    expect(within(popover).getAllByRole('listitem')).toHaveLength(SELECTABLE_PAPER_RELEASES.length + 1);
  });
});
