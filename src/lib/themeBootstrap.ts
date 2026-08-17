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
 *  - Same storage key (THEME_STORAGE_KEY) and same accepted values (VALID_THEMES) -- these are
 *    exported below and imported by ThemeContext.tsx, not re-typed there, so the two cannot
 *    drift apart silently.
 *  - Same default (DEFAULT_THEME = 'light', NOT the OS `prefers-color-scheme`) -- imported by
 *    ThemeContext.tsx rather than restated, deliberately matching the documented product
 *    decision, so the script can never disagree with the provider and cause a second,
 *    post-hydration flip.
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

/**
 * The only valid theme values, and the default used when nothing (or something invalid) is
 * stored. THIS is the single source of truth for both halves of the contract -- ThemeContext
 * (src/contexts/ThemeContext.tsx) imports these rather than re-typing its own literals, and
 * the bootstrap script below is generated from them rather than hand-written against a
 * duplicate list. Before this fix, the default and the valid-value set were asserted in prose
 * only ("cannot disagree") while actually being two separate hardcoded literals in two files;
 * nothing would have caught the two drifting apart. Found by adversarial review, 2026-08-16.
 */
export const VALID_THEMES = ['light', 'dark'] as const;
export type Theme = (typeof VALID_THEMES)[number];
export const DEFAULT_THEME: Theme = 'light';

// Built from the exported constants above (not re-typed literals) so the inlined <head>
// script cannot drift from what ThemeContext imports. JSON.stringify is used purely to embed
// these values as JS source text inside the template literal below; it has no bearing on the
// storage format (which remains the plain string 'light' / 'dark').
const STORAGE_KEY_JS = JSON.stringify(THEME_STORAGE_KEY);
const VALID_THEMES_JS = JSON.stringify(VALID_THEMES);
const DEFAULT_THEME_JS = JSON.stringify(DEFAULT_THEME);

export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var v=${VALID_THEMES_JS};var t=window.localStorage.getItem(${STORAGE_KEY_JS});if(v.indexOf(t)===-1){t=${DEFAULT_THEME_JS};}var e=document.documentElement;e.classList.remove.apply(e.classList,v);e.classList.add(t);}catch(_){}})();`;
