/**
 * Synchronous theme bootstrap (audit item B11 -- theme flash).
 *
 * `ThemeProvider` (src/contexts/ThemeContext.tsx) defaults to 'light' and only reads
 * localStorage in a post-mount effect, so a user whose stored preference is 'dark' gets a
 * full white first paint before React hydrates. `suppressHydrationWarning` on <html>
 * silences the warning; it does NOT prevent the flash.
 *
 * This script is injected into <head> and runs synchronously, before the browser paints
 * any body content, so the `dark` class is already on <html> for the very first paint.
 *
 * Contract with ThemeContext:
 *  - Same storage key ('theme') and same accepted values ('light' | 'dark').
 *  - Same default ('light', NOT the OS `prefers-color-scheme`) -- deliberately matching the
 *    documented product decision in ThemeContext, so the script can never disagree with the
 *    provider and cause a second, post-hydration flip.
 *  - Only <html> is touched. Tailwind's dark variant here is
 *    `@custom-variant dark (&:where(.dark, .dark *))` (globals.css:4), an ancestor selector,
 *    so the class on <html> covers the whole tree. <body> does not exist yet when a <head>
 *    script runs; ThemeProvider's effect still adds the body class after mount.
 *  - Wrapped in try/catch: localStorage throws in Safari private mode and under some
 *    cookie-blocking settings. A throw there would abort the script tag and could leave the
 *    document unstyled, which is worse than the flash it is fixing.
 *
 * CSP: `script-src` includes 'unsafe-inline' (src/middleware.ts:11), so this unhashed
 * inline script is permitted. If that ever tightens to a nonce/hash policy, this script
 * must be given the nonce or it will be blocked and the flash returns silently.
 */
export const THEME_STORAGE_KEY = 'theme';

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var t=window.localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t='light';}var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(t);}catch(_){}})();`;
