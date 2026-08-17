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
 * Callers 1 and 3 both go through readThemeCookie below -- caller 1 by handing it the RAW
 * `cookie` request header rather than letting Next's own cookie parser see it first. That
 * detour is deliberate and load-bearing: Next's parser percent-decodes values, does not trim,
 * lets the LAST duplicate entry win, and turns a valueless `theme` into the string "true".
 * All four differ from what the browser-side readers do with the same bytes, and each
 * difference is a server class that contradicts the client -- a repaint plus a real
 * ThemeToggle hydration mismatch, which `suppressHydrationWarning` on <html> does not cover
 * (it does not cascade to descendants). Found by adversarial review, 2026-08-16.
 *
 * Caller 2 is a hand-written string that cannot import this module, so it reimplements the
 * same rules inline. themeBootstrap.test.ts holds a PARITY CORPUS that runs the same cookie
 * header strings through readThemeCookie and through the bootstrap script executed in jsdom,
 * and asserts identical verdicts; treat that pairing as load-bearing when editing either side.
 *
 * The cookie is deliberately NOT HttpOnly -- the bootstrap has to read it from
 * document.cookie before first paint. It therefore holds an attacker-writable string, which
 * is why every read here validates rather than casts: the value ends up in a class attribute.
 * A cookie holding one of two public enum values is not a secret, so non-HttpOnly is fine.
 */

/**
 * The single source of truth for the theme value set. Every consumer that needs to know
 * "what are the valid theme values" or "what do we default to" imports these two constants
 * (or re-exports of them) instead of retyping the literals -- that retyping is exactly what
 * let src/lib/themeBootstrap.ts's inline script and src/contexts/ThemeContext.tsx drift from
 * this module in the past.
 */
export const VALID_THEMES = ['light', 'dark'] as const;

export type Theme = (typeof VALID_THEMES)[number];

/** Matches the documented product decision: default is 'light', NOT OS prefers-color-scheme. */
export const DEFAULT_THEME: Theme = VALID_THEMES[0];

export const THEME_COOKIE_NAME = 'theme';

/** One year. Matches the intent of localStorage: a preference, not a session. */
export const THEME_COOKIE_MAX_AGE_SECONDS = 31536000;

/**
 * Type predicate, not a bare cast. `VALID_THEMES.includes(x)` cannot be called directly with
 * an arbitrary string -- `ReadonlyArray<Theme>.includes` requires its argument to already be
 * of type `Theme`, so checking whether an arbitrary string is a member requires widening the
 * tuple to `readonly string[]` first. Returning `value is Theme` is what lets parseTheme keep
 * narrowing to `Theme | null` without a second, unchecked cast at its own return site -- if
 * this predicate's body ever stopped checking VALID_THEMES, tsc would not catch it, but a
 * genuinely-invalid value could also never get past it silently.
 */
function isValidTheme(value: string): value is Theme {
  return (VALID_THEMES as readonly string[]).includes(value);
}

/**
 * Returns the value only if it is EXACTLY one of the two valid themes, else null.
 *
 * null means "no usable value", which callers need to tell apart from "explicitly light" --
 * an absent cookie must fall through to localStorage, whereas a cookie that is present but
 * corrupt must NOT, because the server already resolved that same corrupt cookie to 'light'
 * and falling through would make the client disagree with the served HTML.
 */
export function parseTheme(raw: string | null | undefined): Theme | null {
  return typeof raw === 'string' && isValidTheme(raw) ? raw : null;
}

/** Total function: anything unrecognised resolves to DEFAULT_THEME. Never throws, never casts. */
export function resolveTheme(raw: string | null | undefined): Theme {
  return parseTheme(raw) ?? DEFAULT_THEME;
}

/**
 * Reads the theme cookie out of a `document.cookie`-style string.
 *
 * Returns null when the cookie is ABSENT, and a resolved Theme when it is PRESENT -- including
 * when it is present with a junk value, which resolves to 'light'. That asymmetry is the point:
 * see parseTheme.
 *
 * FIRST match wins. The earlier version of this comment claimed that agreed with what the
 * server did; it did not. Next's cookie parser builds a Map, so its `map.set` makes the LAST
 * duplicate win, and `theme=light; theme=dark` therefore resolved 'dark' on the server and
 * 'light' on the client on EVERY load. The fix was to stop routing the server through that
 * parser (see the module header), not to change this rule: first-match is what
 * `document.cookie` readers do, and both the request header and `document.cookie` are emitted
 * by the browser in the same order (RFC 6265 puts the most specific path first), so the two
 * client-side readers and the server now agree by construction.
 *
 * The value is NOT percent-decoded and the name is compared after trimming, because that is
 * exactly what the inline bootstrap does with the same bytes. `theme=%64ark` is junk here, on
 * purpose, in all three callers.
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
 * The SERVER entry point: resolve a Theme from a raw `cookie` REQUEST HEADER.
 *
 * Same parser as the client, so the served class cannot contradict what the browser-side
 * readers will conclude from the identical bytes. Absent collapses to 'light' here because the
 * server has no localStorage to fall through to -- the bootstrap owns that fallback, and the
 * one request per browser where the two disagree is the migration window documented in
 * src/lib/themeBootstrap.ts.
 */
export function resolveThemeFromCookieHeader(cookieHeader: string | null | undefined): Theme {
  return readThemeCookie(cookieHeader) ?? DEFAULT_THEME;
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
