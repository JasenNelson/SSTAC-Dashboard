import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider, useTheme } from './ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

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
 * Audit item D2 -- the provider used to hand every consumer the literal 'light' until its
 * post-mount effect ran, so a returning dark-mode user saw a moon glyph and the label
 * "Switch to dark mode" on a page the pre-paint bootstrap had already painted dark.
 *
 * WHY THESE TESTS RECORD EVERY RENDER INSTEAD OF ASSERTING AFTER render().
 * React Testing Library runs `render` inside `act()`, which flushes effects before it
 * returns. Asserting on the DOM afterwards therefore CANNOT distinguish "correct on the
 * first render" from "wrong on the first render and corrected by an effect" -- which is
 * precisely the defect. The probe below appends the theme it was given on every render, so
 * `renders[0]` is the value from the initial render, before any effect has run. That index
 * is the whole point of the test; an assertion on the last value would be vacuous.
 *
 * WHAT THESE TESTS CANNOT PROVE. jsdom has no paint pipeline and no layout engine. Nothing
 * here shows that the user does not SEE the wrong glyph for a frame -- only that React was
 * given the right value at render 0. Frame-level proof requires a real browser and lives in
 * e2e/theme-flash.spec.ts, which blocks the JS bundle so only the inline bootstrap can act.
 */
describe('ThemeProvider first-render seed (audit D2)', () => {
  let renders: string[] = [];

  function RecordingProbe() {
    const { theme } = useTheme();
    renders.push(theme);
    return <span data-testid="theme-probe">{theme}</span>;
  }

  beforeEach(() => {
    renders = [];
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('hands consumers dark on the FIRST render when the bootstrap already darkened <html>', () => {
    // Exactly the returning-dark-user state at the moment React starts: the <head> script has
    // run, the class is on <html>, React has not rendered yet.
    document.documentElement.classList.add('dark');
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('dark');
  });

  it('prefers an explicit initialTheme over the DOM class, because the server rendered it', () => {
    // The server has no `document`; whatever it resolved is what the HTML on the wire says,
    // so it must win over anything inferred client-side or hydration mismatches.
    document.documentElement.classList.add('light');

    render(
      <ThemeProvider initialTheme="dark">
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('dark');
  });

  it('does not let an absent stored value clobber a correctly seeded dark theme', () => {
    // The seed is only useful if the post-mount effect leaves it alone. If the effect wrote
    // 'light' whenever localStorage was empty, a cookie-seeded dark user would flip to light
    // one tick after hydration -- the same visible defect, just later.
    render(
      <ThemeProvider initialTheme="dark">
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[renders.length - 1]).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores a bogus initialTheme rather than putting it on <html> as a class', () => {
    // initialTheme arrives from a client-writable cookie via the server. Validate, never cast.
    render(
      <ThemeProvider initialTheme={'chartreuse' as unknown as 'dark'}>
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('light');
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
  });

  it('gives ThemeToggle a correct accessible name and glyph on its first render', () => {
    // The behaviour D2 is actually about, asserted through the real component and the real
    // provider (the ThemeToggle unit suite mocks useTheme, so it cannot see this at all).
    //
    // This uses renderToStaticMarkup, NOT RTL's render, and the reason is load-bearing:
    // `render` flushes effects inside act(), so the first draft of this test PASSED against a
    // deliberately broken seed -- the effect had already corrected the label by the time the
    // assertion ran. renderToStaticMarkup performs exactly one render and never runs an
    // effect, so what it produces IS the first render, which is the only thing under test.
    document.documentElement.classList.add('dark');
    window.localStorage.setItem('theme', 'dark');

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);

    // Accessible NAME, computed by the a11y tree, not a raw attribute string: the name is what
    // a screen-reader user is told, and it was the half that actively lied.
    const button = within(container).getByRole('button', { name: /switch to light mode/i });

    // And the glyph, so a correct label paired with the wrong icon still fails. The sun path
    // is the light-mode-destination icon; the moon path is what the defect drew.
    const path = button.querySelector('path')?.getAttribute('d') ?? '';
    expect(path).toContain('M12 3v1m0 16v1');
    expect(path).not.toContain('M20.354 15.354');

    container.remove();
  });
});
