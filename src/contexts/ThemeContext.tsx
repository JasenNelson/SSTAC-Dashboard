'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/themeBootstrap';
import { parseTheme, readThemeCookie, themeCookieString, type Theme } from '@/lib/theme';

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Resolves the persisted theme after mount, in the SAME precedence the pre-paint bootstrap
 * and the server use: cookie first, then localStorage, then "no usable value" (null).
 *
 * The cookie wins because it is what the server actually rendered. Preferring localStorage
 * would guarantee a post-hydration flip whenever the two disagree -- which happens routinely:
 * a second tab, a page restored from bfcache, or a user who cleared one store and not the
 * other. The loser gets rewritten by the persistence effect below, so they reconverge.
 *
 * A cookie that is PRESENT but corrupt resolves to 'light' and does NOT fall through to
 * localStorage, because the server resolved that same corrupt cookie to 'light' too.
 */
function readPersistedTheme(): Theme | null {
  let fromCookie: Theme | null = null;
  try {
    fromCookie = readThemeCookie(document.cookie);
  } catch {
    // document.cookie throws in sandboxed iframes without allow-same-origin.
  }
  if (fromCookie !== null) return fromCookie;

  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // localStorage throws in Safari private mode and under some cookie-blocking settings.
    return null;
  }
}

/**
 * Seed for the provider's FIRST render (audit item D2).
 *
 * The defect this fixes: state used to start at the literal 'light' and only reach the true
 * value in a post-mount effect. The pre-paint bootstrap had ALREADY painted the page dark by
 * then, so on the first render every consumer -- notably ThemeToggle -- was told 'light' and
 * drew a moon glyph plus an aria-label saying "Switch to dark mode" on top of an already-dark
 * page. Reading the theme in a `useState` initialiser instead of an effect closes that window
 * entirely: initialisers run during the render itself, and by the time the client renders at
 * all, the <head> bootstrap has already run.
 *
 * Resolution order:
 *  1. `initialTheme` -- what the SERVER resolved (from the cookie). Authoritative when present,
 *     because it is what the server-rendered HTML actually says, and disagreeing with it would
 *     guarantee a hydration mismatch.
 *  2. The class the pre-paint bootstrap put on <html>. Defensive only -- see below.
 *  3. 'light'.
 *
 * STEP 2 IS UNREACHABLE IN PRODUCTION. src/app/layout.tsx is the only production render of
 * ThemeProvider and it always passes an `initialTheme` that has already been validated, so
 * step 1 always wins there. The branch is kept for non-layout consumers (tests, Storybook-style
 * harnesses, any future provider mounted without a server-resolved value) and it costs one
 * classList read; it is NOT load-bearing for any user-facing path. An earlier version of this
 * comment claimed step 2's absence on the server caused a hydration mismatch for cookie-less
 * dark users. That cannot happen: with no cookie the server resolves 'light' AND passes
 * 'light' as initialTheme, so server and first client render agree exactly.
 *
 * THE ACTUAL RESIDUAL BEHAVIOUR for a cookie-less user whose localStorage says 'dark': the
 * pre-paint bootstrap paints the page dark, but React's first render is seeded from the
 * server's 'light', so for that one render ThemeToggle draws the moon glyph and the label
 * "Switch to dark mode" on an already-dark page. The mount effect reads localStorage and
 * corrects it one tick later. No hydration mismatch is involved -- server and client render 0
 * are identical -- and it lasts one browser for one request, because the bootstrap writes the
 * cookie on that same visit and every request after it is server-correct.
 */
function seedTheme(initialTheme: Theme | undefined): Theme {
  const fromServer = parseTheme(initialTheme);
  if (fromServer !== null) return fromServer;
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(() => seedTheme(initialTheme));
  const [mounted, setMounted] = useState(false);

  // Reconcile with the persisted value after mount; default to 'light' (not OS preference).
  useEffect(() => {
    // Validate rather than cast. The previous `localStorage.getItem('theme') as Theme`
    // accepted ANY truthy string: a stored value of 'chartreuse' was written to
    // document.documentElement.classList by the effect below, immediately after
    // classList.remove('light','dark') -- leaving the document with NO theme class at all,
    // and re-persisting the junk value. The synchronous bootstrap in <head>
    // (src/lib/themeBootstrap.ts) already sanitises; this makes the two agree, which is
    // what stops a second, post-hydration flip. Found by adversarial review, 2026-08-16.
    //
    // A MISSING stored value must not clobber the seed: an absent localStorage entry is not
    // evidence for 'light', and overwriting a correctly-seeded 'dark' with it would reintroduce
    // exactly the post-hydration flip the seed exists to prevent.
    const savedTheme = readPersistedTheme();
    if (savedTheme !== null) {
      setThemeState(savedTheme);
    }
    setMounted(true);
  }, []);

  // Update the document classes and the localStorage mirror when theme changes.
  useEffect(() => {
    if (mounted) {
      // Apply theme class to both html and body elements
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);

      // NO COOKIE WRITE HERE. This effect runs on mount for EVERY visitor, so writing the
      // cookie from it handed a `theme=light` to first-time visitors who had expressed no
      // preference at all -- one tick after the bootstrap had deliberately declined to write
      // one (themeBootstrap.test.ts asserts that decline). A preference cookie is written by
      // exactly two things now: an explicit user choice (persistThemeChoice below) and the
      // bootstrap's localStorage migration. Found by adversarial review, 2026-08-16.
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Safari private mode.
      }
    }
  }, [theme, mounted]);

  // The single write path for an EXPRESSED preference. Both the toggle and the programmatic
  // setTheme go through it, so they cannot drift, and nothing else in the provider writes the
  // cookie -- which is what keeps a visitor who never chose anything cookie-free.
  const persistThemeChoice = (next: Theme) => {
    setThemeState(next);
    try {
      document.cookie = themeCookieString(next, window.location.protocol === 'https:');
    } catch {
      // Sandboxed iframes and hard cookie-blocking modes. Losing the cookie costs a wrong
      // server-rendered class that the pre-paint bootstrap still corrects, so this degrades
      // to the pre-D2 behaviour rather than breaking the page.
    }
  };

  const toggleTheme = () => {
    persistThemeChoice(theme === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    persistThemeChoice(newTheme);
  };

  // Prevent hydration mismatch by not rendering until mounted.
  //
  // `theme` here is the SEED, not the literal 'light' this used to hand out. Handing out
  // 'light' was the actual cause of audit item D2: the seed can be right and the toggle would
  // still have been told 'light' for the whole unmounted window. The toggle/setTheme no-ops
  // are pre-existing and deliberately left alone -- the unmounted window closes on the first
  // effect tick, and changing them is a separate concern from what D2 is about.
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme, toggleTheme: () => {}, setTheme: () => {} }}>
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          {children}
        </div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // During SSR, return a default theme to prevent hydration mismatches
    if (typeof window === 'undefined') {
      return { theme: DEFAULT_THEME, toggleTheme: () => {}, setTheme: () => {} };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
