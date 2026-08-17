'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY, VALID_THEMES, DEFAULT_THEME, type Theme } from '@/lib/themeBootstrap';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Reads the persisted theme, accepting ONLY the values in VALID_THEMES. Anything else
 * (absent, corrupt, or written by an older/other build) falls back to DEFAULT_THEME.
 * VALID_THEMES and DEFAULT_THEME are imported from themeBootstrap.ts, not re-typed here, so
 * this validation cannot silently diverge from the pre-paint bootstrap's -- see
 * themeBootstrap.ts for why that matters.
 */
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored !== null && (VALID_THEMES as readonly string[]).includes(stored)
      ? (stored as Theme)
      : DEFAULT_THEME;
  } catch {
    // localStorage throws in Safari private mode and under some cookie-blocking settings.
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage; default to 'light' (not OS preference)
  useEffect(() => {
    // Validate rather than cast. The previous `localStorage.getItem('theme') as Theme`
    // accepted ANY truthy string: a stored value of 'chartreuse' was written to
    // document.documentElement.classList by the effect below, immediately after
    // classList.remove('light','dark') -- leaving the document with NO theme class at all,
    // and re-persisting the junk value. The synchronous bootstrap in <head>
    // (src/lib/themeBootstrap.ts) already sanitises; this makes the two agree, which is
    // what stops a second, post-hydration flip. Found by adversarial review, 2026-08-16.
    const savedTheme = readStoredTheme();

    setThemeState(savedTheme);
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

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: DEFAULT_THEME, toggleTheme: () => {}, setTheme: () => {} }}>
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
