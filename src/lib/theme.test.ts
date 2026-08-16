import { describe, it, expect } from 'vitest';
import {
  THEME_COOKIE_NAME,
  parseTheme,
  readThemeCookie,
  resolveTheme,
  themeCookieString,
} from './theme';

/**
 * Owner decision D2, option C -- cookie-based theme resolution.
 *
 * These are pure-function tests with no DOM. They matter because this module is the single
 * place three separate callers (the server layout, the inline pre-paint bootstrap, and
 * ThemeProvider) get their agreement from. If it resolves a value differently from any of
 * them, the page flips after hydration.
 *
 * WHAT THESE TESTS CANNOT PROVE, stated so a green run is not mistaken for coverage it is not:
 *  - Nothing about cookie ATTRIBUTE BEHAVIOUR. themeCookieString's output is checked as a
 *    string; that SameSite=Lax is actually honoured, that Secure suppresses the cookie over
 *    http, and how cookie-blocking browser modes behave are all browser concerns invisible
 *    here (jsdom does not even expose these attributes on read-back).
 *  - Nothing about first paint or flash timing. jsdom has no paint pipeline.
 *  - Nothing about whether the root layout actually became dynamic. That is only observable
 *    in the `next build` route table.
 */

describe('parseTheme / resolveTheme', () => {
  it('accepts exactly the two valid themes', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
  });

  it('rejects everything else rather than casting it', () => {
    // The value reaches a className and a classList.add(). A cast here is how this codebase
    // previously ended up with NO theme class at all on <html> (see ThemeContext.test.tsx).
    for (const raw of ['chartreuse', '', ' dark', 'DARK', 'dark light', null, undefined]) {
      expect(parseTheme(raw)).toBeNull();
    }
  });

  it('is total: resolveTheme always yields a real theme', () => {
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    for (const raw of ['chartreuse', '', 'DARK', null, undefined]) {
      expect(resolveTheme(raw)).toBe('light');
    }
  });
});

describe('readThemeCookie', () => {
  it('returns null when there is no cookie at all', () => {
    expect(readThemeCookie('')).toBeNull();
    expect(readThemeCookie(null)).toBeNull();
    expect(readThemeCookie(undefined)).toBeNull();
  });

  it('reads the theme cookie from among others, whatever its position', () => {
    expect(readThemeCookie('theme=dark')).toBe('dark');
    expect(readThemeCookie('sb-access-token=abc; theme=dark; other=1')).toBe('dark');
    expect(readThemeCookie('a=1; b=2; theme=light')).toBe('light');
  });

  it('does not match a cookie whose name merely contains "theme"', () => {
    // Substring matching here would let an unrelated cookie drive the whole page's theme.
    expect(readThemeCookie('themepark=dark')).toBeNull();
    expect(readThemeCookie('mytheme=dark')).toBeNull();
    expect(readThemeCookie('theme_v2=dark')).toBeNull();
  });

  it('distinguishes ABSENT from PRESENT-BUT-CORRUPT, which is the load-bearing case', () => {
    // Absent -> null, so the bootstrap falls through to localStorage (the migration path).
    expect(readThemeCookie('other=1')).toBeNull();
    // Present but junk -> 'light', because that is what the SERVER resolved from the same
    // junk. Falling through to localStorage here would let the client pick 'dark' while the
    // served HTML said 'light' -- a post-hydration flip.
    expect(readThemeCookie('theme=chartreuse')).toBe('light');
    expect(readThemeCookie('theme=')).toBe('light');
  });

  it('tolerates the spaces browsers put after the separator', () => {
    expect(readThemeCookie('a=1;theme=dark')).toBe('dark');
    expect(readThemeCookie('a=1;   theme=dark')).toBe('dark');
  });
});

describe('themeCookieString', () => {
  it('carries the attributes the bootstrap needs to read it back on the next request', () => {
    const cookie = themeCookieString('dark', false);

    expect(cookie.startsWith(`${THEME_COOKIE_NAME}=dark;`)).toBe(true);
    // path=/ or the cookie is invisible to every route but the one that set it.
    expect(cookie).toContain('path=/');
    // A session cookie would silently lose the preference on browser restart.
    expect(cookie).toContain('max-age=31536000');
    expect(cookie).toContain('samesite=lax');
  });

  it('omits Secure over http so local development is not silently broken', () => {
    // A Secure cookie is dropped by the browser over plain http, which would leave dev with
    // no cookie ever written and the server resolving light forever.
    expect(themeCookieString('dark', false)).not.toContain('secure');
    expect(themeCookieString('dark', true)).toContain('; secure');
  });

  it('round-trips through readThemeCookie for both themes', () => {
    // The two halves of this module must agree, or a written preference reads back as absent.
    for (const theme of ['dark', 'light'] as const) {
      const nameValue = themeCookieString(theme, true).split(';')[0];
      expect(readThemeCookie(nameValue)).toBe(theme);
    }
  });
});
