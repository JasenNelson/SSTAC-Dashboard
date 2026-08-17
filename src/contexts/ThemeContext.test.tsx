import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

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

/**
 * Regression guard, adversarial review 2026-08-16 (P2, PR #782 stack).
 *
 * The read in readStoredTheme() was wrapped in try/catch; the write in the
 * theme-persistence effect (`localStorage.setItem(THEME_STORAGE_KEY, theme)`) was not.
 * localStorage.setItem throws outright -- not just returns null -- in Safari private
 * browsing, in a sandboxed iframe without allow-same-origin, and when cookies/site-data are
 * blocked. An uncaught throw inside a React effect propagates to the App Router error
 * boundary, so an affected user got the global error page instead of the dashboard, rather
 * than merely losing their persisted preference.
 *
 * Falsification: removing the try/catch around the setItem call in ThemeContext.tsx makes
 * this test FAIL with the mocked SecurityError escaping render().
 */
describe('ThemeProvider localStorage write failure handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('does not throw/crash when localStorage.setItem throws (Safari private mode, blocked cookies)', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is not available');
    });

    function ToggleProbe() {
      const { theme, toggleTheme } = useTheme();
      return (
        <div>
          <span data-testid="theme-probe">{theme}</span>
          <button onClick={toggleTheme}>toggle</button>
        </div>
      );
    }

    expect(() => {
      render(
        <ThemeProvider>
          <ToggleProbe />
        </ThemeProvider>,
      );
    }).not.toThrow();

    // Triggers the persistence effect's setItem call (the write path under test), not just
    // the initial mount-time read.
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    }).not.toThrow();

    // The theme still updates in memory/UI even though persistence silently failed --
    // matching the guarded read's degrade-gracefully intent.
    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');

    setItemSpy.mockRestore();
  });
});

/**
 * Regression guard, adversarial review 2026-08-16 (P2, PR #782 stack).
 *
 * The claim that themeBootstrap.ts and ThemeContext.tsx "cannot disagree" was asserted in
 * PROSE only, while the default theme and the valid-value set were each HARDCODED
 * SEPARATELY in both files. Nothing would catch one side drifting (a new theme value, a
 * different default) while the other stayed the same -- exactly the flash-of-wrong-theme
 * this feature exists to prevent.
 *
 * These tests prove ThemeContext.tsx actually CONSUMES themeBootstrap's exported
 * DEFAULT_THEME / VALID_THEMES at runtime, rather than merely importing-and-ignoring them
 * (or re-typing its own copies). Each test mocks '@/lib/themeBootstrap' to a DIFFERENT value
 * than the real one and asserts the provider's observable behavior follows the mock -- which
 * is only possible if ThemeContext.tsx is reading these values through the import, not a
 * hardcoded literal.
 *
 * Falsification (both verified by actually reverting and re-running): reverting
 * readStoredTheme()'s fallback from `: DEFAULT_THEME` back to a hardcoded `: 'light'` makes
 * the FIRST test below FAIL, because the mocked 'dark' default never surfaces -- the probe
 * still shows 'light' even though nothing is stored. (Reverting only the unrelated
 * `useState<Theme>(DEFAULT_THEME)` initializer does NOT fail this test, because the
 * mount-effect's readStoredTheme() call overwrites that initial state synchronously before
 * the assertion runs -- so this test specifically exercises the readStoredTheme() fallback,
 * not the useState initializer.) Reverting readStoredTheme()'s validation to a hardcoded
 * `stored === 'dark' || stored === 'light'` check instead of
 * `VALID_THEMES.includes(stored)` makes the SECOND test FAIL, because the stored 'light'
 * value gets accepted even though the mocked VALID_THEMES no longer contains it.
 */
describe('ThemeProvider contract with themeBootstrap (structural, not prose)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/lib/themeBootstrap');
    vi.resetModules();
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('uses themeBootstrap DEFAULT_THEME, not a hardcoded literal', async () => {
    vi.doMock('@/lib/themeBootstrap', async () => {
      const actual =
        await vi.importActual<typeof import('@/lib/themeBootstrap')>('@/lib/themeBootstrap');
      return { ...actual, DEFAULT_THEME: 'dark' };
    });

    const { ThemeProvider: MockedThemeProvider, useTheme: mockedUseTheme } =
      await import('./ThemeContext');

    function Probe() {
      const { theme } = mockedUseTheme();
      return <span data-testid="probe">{theme}</span>;
    }

    render(
      <MockedThemeProvider>
        <Probe />
      </MockedThemeProvider>,
    );

    // Nothing is stored, so the provider must fall back to whatever DEFAULT_THEME it
    // imports. The mock says 'dark'; a hardcoded 'light' literal would show 'light' instead.
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
  });

  it('uses themeBootstrap VALID_THEMES, not a hardcoded accepted-value set', async () => {
    window.localStorage.setItem('theme', 'light');

    vi.doMock('@/lib/themeBootstrap', async () => {
      const actual =
        await vi.importActual<typeof import('@/lib/themeBootstrap')>('@/lib/themeBootstrap');
      return { ...actual, VALID_THEMES: ['dark'], DEFAULT_THEME: 'dark' };
    });

    const { ThemeProvider: MockedThemeProvider, useTheme: mockedUseTheme } =
      await import('./ThemeContext');

    function Probe() {
      const { theme } = mockedUseTheme();
      return <span data-testid="probe">{theme}</span>;
    }

    render(
      <MockedThemeProvider>
        <Probe />
      </MockedThemeProvider>,
    );

    // 'light' is stored, but the mocked VALID_THEMES no longer contains it. A provider that
    // actually validates against the IMPORTED set must reject it and fall back to the
    // (also mocked) default. A hardcoded ['light','dark'] check would accept 'light' anyway.
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
  });
});
