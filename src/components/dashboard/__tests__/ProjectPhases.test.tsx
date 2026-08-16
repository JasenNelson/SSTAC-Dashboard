import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ProjectPhases from '../ProjectPhases';

describe('ProjectPhases', () => {
  it('renders an "Active" chip for Phase 2 and a "Complete" chip for Phase 1', () => {
    render(<ProjectPhases />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('does not render emoji tiles or numbered circle badges', () => {
    const { container } = render(<ProjectPhases />);

    expect(container.textContent).not.toMatch(/\u{1F680}|\u{2705}/u); // no rocket / check-mark emoji
    // Numbered circle badges used to be `rounded-full` spans containing digits 1/2.
    const numberedCircles = Array.from(
      container.querySelectorAll('span.rounded-full'),
    ).filter((el) => /^[12]$/.test(el.textContent ?? ''));
    expect(numberedCircles.length).toBe(0);
  });

  it('gives Active a solid/saturated chip and Complete a muted outline chip, with no green anywhere (#17)', () => {
    // The original assertion ("not bg-blue-*") could not discriminate #17's actual decision
    // in either direction: the real Active chip is `bg-sky-600` (sky, not the literal string
    // "blue", so the old check passed trivially) and nothing here ever asserted the POSITIVE
    // shape (solid Active vs muted-outline Complete) #17 called for. Two-sided:
    //  - Positive: Active must be a solid, filled, saturated-background chip (bg-sky-*
    //    variant that is not `bg-transparent`); Complete must be the muted outline (bordered,
    //    bg-transparent, muted text).
    //  - Negative: neither chip may use any green/emerald tone, and neither the literal
    //    `bg-blue-*` Tailwind scale nor `bg-transparent` may appear on Active (a regression to
    //    the fabricated blue class, or a regression to the muted style for Active, both fail).
    render(<ProjectPhases />);

    const activeChip = screen.getByText('Active');
    expect(activeChip.className).toMatch(/\bbg-sky-\d{3}\b/);
    expect(activeChip.className).not.toMatch(/bg-transparent/);
    expect(activeChip.className).not.toMatch(/bg-blue-|bg-green-|bg-emerald-/);

    const completeChip = screen.getByText('Complete');
    expect(completeChip.className).toMatch(/\bbg-transparent\b/);
    expect(completeChip.className).toMatch(/\bborder\b/);
    expect(completeChip.className).not.toMatch(/bg-green-|bg-emerald-|bg-blue-|bg-sky-/);
  });

  it('round-4 P2: keeps the Active chip above the AA contrast floor in BOTH colour modes', () => {
    // The chip shipped `bg-sky-600` light / `dark:bg-sky-500` with an unconditional
    // `text-white`. Measured against white that is 4.09:1 and 2.77:1 -- both under the
    // 4.5:1 AA floor, and 12px bold does NOT qualify for the relaxed 3:1 "large text"
    // threshold (that starts at 18.66px bold). Only the background varied by mode, so
    // dark mode was materially worse than light: the exact "tuned for one mode only"
    // defect. sky-700 is 5.93:1 against white and is used in BOTH modes now.
    //
    // jsdom computes no colours, so this asserts the CLASS CONTRACT rather than a
    // measured ratio -- the ratios above were computed by hand from the Tailwind hexes
    // and are recorded here so a future reader can re-derive them.
    //
    // Two-sided falsification:
    //  - Positive: sky-700 must be present in both the base and the `dark:` variant.
    //  - Negative: the two specific failing classes must be ABSENT. Reverting either
    //    `bg-sky-600` or `dark:bg-sky-500` fails a named expectation rather than
    //    silently passing the loose `bg-sky-\d{3}` shape check above, which cannot tell
    //    a passing sky from a failing one.
    render(<ProjectPhases />);

    const activeChip = screen.getByText('Active');

    expect(activeChip.className).toMatch(/\bbg-sky-700\b/);
    expect(activeChip.className).toMatch(/\bdark:bg-sky-700\b/);
    expect(activeChip.className).toMatch(/\btext-white\b/);

    // The measured-failing combinations must not come back.
    expect(activeChip.className).not.toMatch(/\bbg-sky-600\b/);
    expect(activeChip.className).not.toMatch(/\bdark:bg-sky-500\b/);
    expect(activeChip.className).not.toMatch(/\bbg-sky-[1-5]\d{2}\b/);
    // Decision #17 chose Option A WITHOUT the colour inversion, so the fix must not have
    // flipped the chip to dark-text-on-light-chip in dark mode.
    expect(activeChip.className).not.toMatch(/\bdark:text-sky-9\d{2}\b/);
  });

  it('expands the SABCS White Paper sub-bullets on click (existing interaction, unchanged)', () => {
    render(<ProjectPhases />);

    const toggle = screen.getByRole('button', {
      name: /SABCS White Paper/i,
    });
    expect(screen.queryByText('Jurisdictional Scan')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText('Jurisdictional Scan')).toBeInTheDocument();
  });
});
