'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '@/lib/themeBootstrap';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Reads the persisted theme, accepting ONLY the two valid values. Anything else (absent,
 * corrupt, or written by an older/other build) falls back to 'light' -- the same default and
 * the same validation the pre-paint bootstrap applies, so the two can never disagree.
 */
function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : 'light';
  } catch {
    // localStorage throws in Safari private mode and under some cookie-blocking settings.
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
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
      localStorage.setItem(THEME_STORAGE_KEY, theme);
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
      <ThemeContext.Provider value={{ theme: 'light', toggleTheme: () => {}, setTheme: () => {} }}>
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
      return { theme: 'light', toggleTheme: () => {}, setTheme: () => {} };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
