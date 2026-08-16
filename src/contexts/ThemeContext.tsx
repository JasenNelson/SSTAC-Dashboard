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
 *  2. The class the pre-paint bootstrap put on <html>. This is the cookie-less fallback path.
 *  3. 'light'.
 *
 * HONEST LIMITATION: on the SERVER `document` does not exist, so step 2 is unavailable there.
 * A cookie-less dark-mode user therefore gets server HTML that says 'light' and a first client
 * render that says 'dark' -- a real hydration mismatch on ThemeToggle's attributes, which
 * `suppressHydrationWarning` on <html> does NOT cover (it does not cascade to descendants).
 * React patches the attributes and logs. This is a once-per-browser event, because the
 * bootstrap writes the cookie on that same first visit, so the next request is server-correct.
 * It is strictly less wrong than the previous behaviour, which showed the contradiction to
 * EVERY dark-mode user on EVERY page load.
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

  // Update document class and both persistence stores when theme changes
  useEffect(() => {
    if (mounted) {
      // Apply theme class to both html and body elements
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);

      // The cookie write lives HERE and not in ThemeToggle, so that the programmatic
      // setTheme path persists too and cannot drift from the toggle path. It is what makes
      // the NEXT request server-correct; without it the server would resolve 'light' forever
      // and the whole D2 change would do nothing.
      try {
        document.cookie = themeCookieString(theme, window.location.protocol === 'https:');
      } catch {
        // Sandboxed iframes and hard cookie-blocking modes. Losing the cookie costs a
        // wrong server-rendered class that the pre-paint bootstrap still corrects, so this
        // degrades to the pre-D2 behaviour rather than breaking the page.
      }
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Safari private mode.
      }
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
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
