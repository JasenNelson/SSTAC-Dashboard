'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/themeBootstrap';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Accepts ONLY the two valid values. Anything else (absent, corrupt, or written by an
 * older/other build) is rejected. Returns null for "no usable value" so callers can tell
 * "absent" apart from "explicitly light" -- that distinction is what lets the seed below
 * keep an already-correct value instead of stamping 'light' over it.
 */
function parseStoredTheme(raw: string | null | undefined): Theme | null {
  return raw === 'dark' || raw === 'light' ? raw : null;
}

function readStoredTheme(): Theme | null {
  try {
    return parseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
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
  const fromServer = parseStoredTheme(initialTheme);
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
    const savedTheme = readStoredTheme();
    if (savedTheme !== null) {
      setThemeState(savedTheme);
    }
    setMounted(true);
  }, []);

  // Update document class and localStorage when theme changes
  useEffect(() => {
    if (mounted) {
      // Apply theme class to both html and body elements
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(theme);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // The read in readStoredTheme() above was already guarded; this write was not.
        // localStorage.setItem throws outright (not just returns null) in Safari private
        // browsing, in a sandboxed iframe without allow-same-origin, and when cookies/
        // site-data are blocked. Left unguarded, that throw happens inside a React effect
        // and propagates to the App Router error boundary -- an affected user got the
        // global error page instead of the dashboard, rather than just a lost preference.
        // Fail silently, matching the guarded read's degradation: the theme simply does
        // not persist. Found by adversarial review, 2026-08-16.
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
