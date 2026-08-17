import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY, VALID_THEMES, DEFAULT_THEME } from './themeBootstrap';

/**
 * Audit B11. These tests EXECUTE the bootstrap string in jsdom rather than pattern-matching
 * it. A regex over the source text would pass against a script that throws on line 1 and
 * never sets a class -- exactly the vacuous-assertion class this project hit on 2026-08-15.
 *
 * Falsification record (each assertion was watched failing before it was allowed to pass):
 *  - Removing `classList.add(t)` from the script -> "restores a stored dark preference" and
 *    "defaults to light" both FAIL with "expected false to be true".
 *  - Changing the storage key in the script to 'colour-theme' -> the dark test FAILS
 *    (reads nothing, falls through to light).
 *  - Dropping the `t!=='dark'&&t!=='light'` guard -> "ignores a corrupt stored value" FAILS
 *    because the junk value lands on <html> as a class.
 *  - Dropping the try/catch -> "survives a localStorage that throws" FAILS by rethrowing.
 *  - Deleting the classList.remove call -> "does not leave both classes on <html>" FAILS.
 *
 * What these tests CANNOT see: paint timing. jsdom has no layout or paint engine, so the
 * actual absence of a flash is NOT proven here -- it is proven in
 * e2e/theme-flash.spec.ts, which seeds localStorage before navigation and asserts the class
 * is present on the very first document state the browser reports.
 */

function runBootstrap() {
  new Function(THEME_BOOTSTRAP_SCRIPT)();
}

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
  });

  it('restores a stored dark preference onto <html> synchronously', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runBootstrap();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('restores a stored light preference onto <html>', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    runBootstrap();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('defaults to light when nothing is stored, matching ThemeContext (not OS preference)', () => {
    runBootstrap();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores a corrupt stored value instead of writing it to <html> as a class', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');

    runBootstrap();

    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('does not leave both classes on <html> when one is already present', () => {
    document.documentElement.classList.add('light');
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runBootstrap();

    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('survives a localStorage that throws (Safari private mode) without rethrowing', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is not available');
    });

    expect(() => runBootstrap()).not.toThrow();
  });

  it('generates its storage key, valid-value guard, and default from the exported constants, not retyped literals', () => {
    // Non-tautological: this does not compare an export to itself. It proves the script
    // TEXT was actually built from VALID_THEMES / DEFAULT_THEME / THEME_STORAGE_KEY (as
    // themeBootstrap.ts's THEME_BOOTSTRAP_SCRIPT construction does), so a future edit that
    // hand-writes a diverging literal directly into the template string -- instead of
    // changing the shared constants -- makes this fail. ThemeContext.test.tsx separately
    // proves ThemeContext.tsx itself consumes these same exports rather than its own copies.
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(VALID_THEMES));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(DEFAULT_THEME));
  });
});
