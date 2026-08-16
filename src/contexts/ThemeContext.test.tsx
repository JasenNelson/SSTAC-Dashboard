import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ThemeProvider, useTheme } from './ThemeContext';

/**
 * Regression guard for the adversarial-review finding of 2026-08-16 (audit B11 follow-up).
 *
 * The provider read the stored theme with `localStorage.getItem('theme') as Theme` -- a cast,
 * not a check -- so ANY truthy string was accepted. A stored 'chartreuse' was then passed to
 * `classList.add(theme)` immediately after `classList.remove('light','dark')`, leaving the
 * document with NO theme class at all and re-persisting the junk value. The pre-paint
 * bootstrap in <head> already sanitised, so the two halves of the contract disagreed.
 *
 * Falsification record: restoring the old `const savedTheme = localStorage.getItem('theme')
 * as Theme; const initialTheme = savedTheme || 'light';` makes "falls back to light on a
 * corrupt stored value" FAIL on both the class assertion and the exposed theme value.
 */

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-probe">{theme}</span>;
}

describe('ThemeProvider stored-value handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark', 'chartreuse');
    document.body.classList.remove('light', 'dark', 'chartreuse');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark', 'chartreuse');
    document.body.classList.remove('light', 'dark', 'chartreuse');
  });

  it('restores a valid stored dark preference', () => {
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to light on a corrupt stored value instead of applying it as a class', () => {
    window.localStorage.setItem('theme', 'chartreuse');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    // The defect was not "wrong theme" -- it was NO theme class at all, because the junk
    // value replaced light/dark on the element.
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('rewrites a corrupt stored value with a valid one rather than leaving it to spread', () => {
    window.localStorage.setItem('theme', 'chartreuse');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('defaults to light when nothing is stored, not to the OS preference', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});
