import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';

// The component reads useTheme(); stub the context so this suite tests the BUTTON,
// not the theme provider.
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
}));

describe('ThemeToggle', () => {
  it('audit B14: meets the 44px touch floor on both axes', () => {
    // WHAT THIS TEST CAN AND CANNOT PROVE.
    // jsdom has no layout engine -- offsetWidth/getBoundingClientRect are always 0
    // here -- so a real 44x44 measurement is IMPOSSIBLE at unit level. This asserts
    // the CLASS CONTRACT only. The actual rendered size was confirmed separately in
    // a browser; if this component is restyled, re-measure there rather than trusting
    // this test alone.
    //
    // Two-sided falsification:
    //  - Positive: the 44px utilities are present on both axes.
    //  - Negative: the superseded 40px pair must be ABSENT. Asserting only that
    //    `h-11` exists would pass if someone left `h-10 w-10` alongside it, which
    //    Tailwind would resolve unpredictably by source order -- so the absence half
    //    is what actually pins the fix.
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /switch to dark mode/i });

    expect(button.className).toMatch(/\bh-11\b/);
    expect(button.className).toMatch(/\bw-11\b/);

    expect(button.className).not.toMatch(/\bh-10\b/);
    expect(button.className).not.toMatch(/\bw-10\b/);
  });

  it('keeps the icon at its original size so only the hit area grew', () => {
    // B14 asks for a bigger TARGET, not a bigger glyph. If a future change scales the
    // icon to fill the larger box, the control's visual weight changes across every
    // surface that renders it (landing header + app-wide Header, 3 call sites).
    render(<ThemeToggle />);

    const icon = screen.getByRole('button').querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('class')).toMatch(/\bh-5\b/);
    expect(icon?.getAttribute('class')).toMatch(/\bw-5\b/);
  });

  it('keeps an accessible name that states the destination mode', () => {
    // Guards the aria-label/title pair against being dropped during a restyle: the
    // button has no visible text, so the accessible name is the ONLY thing naming it.
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(button.getAttribute('aria-label')).toMatch(/switch to dark mode/i);
    expect(button.getAttribute('title')).toMatch(/switch to dark mode/i);
  });
});
