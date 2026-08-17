import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_THEME, THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY, VALID_THEMES } from './themeBootstrap';
import { readThemeCookie, resolveThemeFromCookieHeader, themeCookieString, type Theme } from './theme';

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
    //
    // The DEFAULT_THEME check is anchored to its `DEF=` assignment, not a bare
    // `toContain(JSON.stringify(DEFAULT_THEME))`: DEFAULT_THEME is one of VALID_THEMES, and
    // VALID_THEMES' own JSON array text already contains that same quoted substring (e.g.
    // `["light","dark"]` contains `"light"`), so an unanchored check would stay green even
    // if `DEF=` were hand-reverted to a hardcoded literal. Falsified: reverting the script's
    // `DEF=...` segment to a hardcoded `DEF='light'` (still spelled correctly, just not
    // derived) left the unanchored assertion passing and only the anchored one below caught
    // it.
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(VALID_THEMES));
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(`DEF=${JSON.stringify(DEFAULT_THEME)}`);
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

/**
 * PARITY CORPUS -- the drift guard src/lib/theme.ts has always claimed existed and did not.
 *
 * The server and the pre-paint bootstrap are two independent parsers of the same bytes. When
 * they disagree, the served class contradicts what the browser concludes: a repaint plus a
 * genuine ThemeToggle hydration mismatch, which suppressHydrationWarning on <html> does not
 * cover. Adversarial review on 2026-08-16 found four such disagreements at once, all of them
 * because the server went through Next's cookies() parser instead of readThemeCookie:
 * percent-decoding, no trimming, LAST-duplicate-wins, and a valueless `theme` becoming "true".
 * All four are in the corpus below and each one fails this test if it is reintroduced.
 *
 * HOW THE BOOTSTRAP'S VERDICT IS RECOVERED. readThemeCookie is tri-state (null = ABSENT), but
 * the bootstrap only ever leaves a class behind, so 'light' alone cannot tell "the cookie said
 * light" from "there was no cookie". Each header is therefore run TWICE, once with an empty
 * localStorage and once with a 'dark' sentinel in it. Identical results mean the cookie
 * decided; differing results mean the bootstrap fell through to localStorage, i.e. it judged
 * the cookie ABSENT. That is the same distinction readThemeCookie encodes as null.
 *
 * The expected column is spelled out rather than derived, so this pins the SEMANTICS too and
 * does not merely prove the two implementations are wrong in the same way.
 */
describe('cookie-parsing parity: server path vs pre-paint bootstrap', () => {
  function runBootstrapWithCookieHeader(header: string, stored: string | null): string {
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => header,
      // The migration write must not blow up, and must not mutate the header under test.
      set: () => {},
    });
    try {
      window.localStorage.clear();
      if (stored !== null) window.localStorage.setItem(THEME_STORAGE_KEY, stored);
      document.documentElement.classList.remove('light', 'dark');

      runBootstrap();

      const element = document.documentElement;
      if (element.classList.contains('dark')) return 'dark';
      if (element.classList.contains('light')) return 'light';
      return 'none';
    } finally {
      delete (document as unknown as Record<string, unknown>).cookie;
      if (original) Object.defineProperty(Document.prototype, 'cookie', original);
      window.localStorage.clear();
      document.documentElement.classList.remove('light', 'dark');
    }
  }

  /** null means the bootstrap treated the cookie as ABSENT. */
  function bootstrapVerdict(header: string): Theme | null {
    const withoutStore = runBootstrapWithCookieHeader(header, null);
    const withDarkStore = runBootstrapWithCookieHeader(header, 'dark');
    if (withoutStore !== withDarkStore) return null;
    expect(withoutStore, `bootstrap left no theme class for header: ${header}`).not.toBe('none');
    return withoutStore as Theme;
  }

  const corpus: Array<{ header: string; expected: Theme | null; why: string }> = [
    { header: 'theme=dark', expected: 'dark', why: 'the ordinary case' },
    { header: 'theme=light', expected: 'light', why: 'the ordinary case' },
    { header: '', expected: null, why: 'no cookies at all -> ABSENT, fall through to storage' },
    { header: 'other=1', expected: null, why: 'other cookies only -> ABSENT' },
    { header: 'theme=chartreuse', expected: 'light', why: 'PRESENT but corrupt -> light, no fall through' },
    { header: 'theme=', expected: 'light', why: 'PRESENT and empty -> light' },
    { header: 'theme=DARK', expected: 'light', why: 'case-sensitive: not a valid value' },
    {
      header: 'theme=%64ark',
      expected: 'light',
      why: 'divergence 1: Next percent-decoded this to dark; neither client reader does',
    },
    {
      header: 'theme=dark ',
      expected: 'dark',
      why: 'divergence 2: the client trims the value, Next did not',
    },
    {
      header: 'theme=light; theme=dark',
      expected: 'light',
      why: 'divergence 3: FIRST duplicate wins here, Next let the LAST one win',
    },
    {
      header: 'theme=dark; theme=light',
      expected: 'dark',
      why: 'divergence 3, other order -- pins first-wins rather than a lucky value',
    },
    {
      header: 'theme',
      expected: null,
      why: 'divergence 4: a valueless pair is ABSENT here; Next reported it as "true"',
    },
    { header: 'a=1; theme=dark; b=2', expected: 'dark', why: 'mixed with other cookies' },
    { header: 'sb-access-token=abc.def; theme=light; other=1', expected: 'light', why: 'realistic header' },
    { header: 'a=1;   theme=dark', expected: 'dark', why: 'extra separator whitespace' },
    { header: 'themepark=dark; mytheme=dark', expected: null, why: 'name must match exactly' },
    { header: 'theme=dark; theme', expected: 'dark', why: 'valueless duplicate after a real one' },
    { header: 'theme; theme=dark', expected: 'dark', why: 'valueless entry is skipped, not matched' },
  ];

  for (const { header, expected, why } of corpus) {
    it(`agrees on ${JSON.stringify(header)} (${why})`, () => {
      expect(readThemeCookie(header), 'server-path verdict').toBe(expected);
      expect(bootstrapVerdict(header), 'bootstrap verdict').toBe(expected);
      // And the collapsed form the root layout actually renders.
      expect(resolveThemeFromCookieHeader(header)).toBe(expected ?? 'light');
    });
  }
});
