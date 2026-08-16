/**
 * Shared theme resolution (owner decision D2, option C).
 *
 * The theme is carried in a cookie so the SERVER can resolve it and render the correct
 * class on <html> and the correct ThemeToggle glyph/label. Three different callers have to
 * agree on that resolution or the page visibly flips after hydration:
 *
 *   1. The root layout (server)            -- src/app/layout.tsx
 *   2. The pre-paint bootstrap (inline JS)  -- src/lib/themeBootstrap.ts
 *   3. ThemeProvider (client)               -- src/contexts/ThemeContext.tsx
 *
 * Caller 2 is a hand-written string that cannot import this module, so it reimplements the
 * same rules inline. The tests in theme.test.ts and themeBootstrap.test.ts assert the two
 * implementations agree on the cases that matter; treat that pairing as load-bearing when
 * editing either side.
 *
 * The cookie is deliberately NOT HttpOnly -- the bootstrap has to read it from
 * document.cookie before first paint. It therefore holds an attacker-writable string, which
 * is why every read here validates rather than casts: the value ends up in a class attribute.
 * A cookie holding one of two public enum values is not a secret, so non-HttpOnly is fine.
 */

export type Theme = 'light' | 'dark';

export const THEME_COOKIE_NAME = 'theme';

/** One year. Matches the intent of localStorage: a preference, not a session. */
export const THEME_COOKIE_MAX_AGE_SECONDS = 31536000;

/**
 * Returns the value only if it is EXACTLY one of the two valid themes, else null.
 *
 * null means "no usable value", which callers need to tell apart from "explicitly light" --
 * an absent cookie must fall through to localStorage, whereas a cookie that is present but
 * corrupt must NOT, because the server already resolved that same corrupt cookie to 'light'
 * and falling through would make the client disagree with the served HTML.
 */
export function parseTheme(raw: string | null | undefined): Theme | null {
  return raw === 'dark' || raw === 'light' ? raw : null;
}

/** Total function: anything unrecognised resolves to 'light'. Never throws, never casts. */
export function resolveTheme(raw: string | null | undefined): Theme {
  return parseTheme(raw) ?? 'light';
}

/**
 * Reads the theme cookie out of a `document.cookie`-style string.
 *
 * Returns null when the cookie is ABSENT, and a resolved Theme when it is PRESENT -- including
 * when it is present with a junk value, which resolves to 'light'. That asymmetry is the point:
 * see parseTheme. Only the first entry with a matching name is considered, which matches
 * browser ordering (most specific path first).
 */
export function readThemeCookie(cookieString: string | null | undefined): Theme | null {
  if (!cookieString) return null;

  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== THEME_COOKIE_NAME) continue;
    return resolveTheme(part.slice(eq + 1).trim());
  }

  return null;
}

/**
 * Builds the `document.cookie` assignment string.
 *
 * `secure` is caller-supplied rather than read from `location` here so this stays a pure
 * function; callers pass `location.protocol === 'https:'`. A Secure cookie is simply ignored
 * by the browser over plain http, which would silently break local development.
 */
export function themeCookieString(theme: Theme, secure: boolean): string {
  const attributes = `path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  return `${THEME_COOKIE_NAME}=${theme}; ${attributes}${secure ? '; secure' : ''}`;
}
