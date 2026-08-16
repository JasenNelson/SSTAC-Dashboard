import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } from './themeBootstrap';
import { themeCookieString } from './theme';

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

function clearThemeCookie() {
  document.cookie = 'theme=; path=/; max-age=0';
}

describe('THEME_BOOTSTRAP_SCRIPT', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
    clearThemeCookie();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
    clearThemeCookie();
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

/**
 * Owner decision D2, option C. The server now resolves the theme from a cookie and renders
 * the class itself, so this script's job changed: it is the cookie-less FALLBACK and the
 * MIGRATION path. Its resolution must match src/lib/theme.ts exactly -- it is a hand-written
 * string that cannot import that module, so these tests are the only thing holding the two
 * implementations together.
 *
 * As above, these tests EXECUTE the script. And as above, they cannot see paint timing.
 */
describe('THEME_BOOTSTRAP_SCRIPT cookie handling (D2)', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
    clearThemeCookie();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('light', 'dark');
    window.localStorage.clear();
    clearThemeCookie();
  });

  it('prefers the cookie over a disagreeing localStorage value', () => {
    // The cookie is what the SERVER rendered from. Preferring localStorage would repaint the
    // page in the other direction on the very first frame after the server got it right.
    document.cookie = 'theme=dark; path=/';
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    runBootstrap();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('treats a corrupt cookie as light WITHOUT falling through to localStorage', () => {
    // The server resolved this same corrupt cookie to 'light' and served class="light".
    // Falling through to a stored 'dark' here would contradict the served HTML.
    document.cookie = 'theme=chartreuse; path=/';
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runBootstrap();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
  });

  it('migrates an existing user: no cookie + stored dark applies dark AND writes the cookie', () => {
    // This is the entire migration plan. Existing users have localStorage and no cookie, so
    // their first post-deploy request is server-resolved as 'light'. The script corrects the
    // class before paint and writes the cookie, so every later request is server-correct.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runBootstrap();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.cookie).toContain('theme=dark');
  });

  it('does not write a cookie when there is nothing to migrate', () => {
    // A first-time visitor should not be given a cookie asserting a preference they never
    // expressed; the server default and the script default already agree on 'light'.
    runBootstrap();

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.cookie).not.toContain('theme=');
  });

  it('still applies a class when document.cookie throws (sandboxed iframe)', () => {
    // The cookie read must not be able to abort the script before classList.add runs --
    // that would leave the document with no theme class at all.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() {
        throw new Error('SecurityError: cookies are blocked');
      },
      set() {
        throw new Error('SecurityError: cookies are blocked');
      },
    });
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    try {
      expect(() => runBootstrap()).not.toThrow();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
      if (original) Object.defineProperty(Document.prototype, 'cookie', original);
    }
  });

  it('writes the cookie with the same attributes src/lib/theme.ts does', () => {
    // The script cannot import themeCookieString, so this is the drift guard between the two
    // implementations. If they disagree on path or max-age, the migration silently stops
    // working -- no error, just a preference that never reaches the server.
    const expected = themeCookieString('dark', false);
    const attributes = expected.slice(expected.indexOf(';') + 1).trim();

    expect(THEME_BOOTSTRAP_SCRIPT).toContain(attributes);
  });
});
