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
 * Since D2 (cookie-based theme resolution) the SERVER also resolves the theme, from the
 * `theme` cookie, and emits the class on <html> itself. This script is no longer the only
 * thing standing between a dark-mode user and a white first paint -- but it is still the
 * cookie-less fallback AND the migration path, so it stays. It has three jobs now:
 *
 *  1. Cookie first. If a `theme` cookie is PRESENT, use it -- resolving a junk value to
 *     'light' exactly as the server did, and NOT falling through to localStorage. Falling
 *     through would make this script disagree with the HTML that was already served, which
 *     is a post-hydration flip: the precise thing this file exists to prevent.
 *  2. Otherwise fall back to localStorage AND write the cookie. That is the whole migration:
 *     an existing user with localStorage and no cookie gets one wrong server-rendered class,
 *     corrected before first paint, once per browser -- and every request after that is
 *     server-correct with no script involvement at all.
 *  3. Otherwise 'light'.
 *
 * Contract with ThemeContext and src/lib/theme.ts:
 *  - Same storage key ('theme'), same cookie name ('theme'), same accepted values.
 *  - Same precedence: cookie beats localStorage. src/lib/theme.ts documents why.
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
 * CSP: this script is permitted everywhere it runs, but for two DIFFERENT reasons, and the
 * distinction matters to anyone tightening the policy later.
 *  - On the routes middleware covers (`config.matcher` in src/middleware.ts: /dashboard,
 *    /twg, /survey-results, /cew-2025, /regulatory-review, /bn-rrm, /demo-matrix-graph,
 *    /matrix-options), `script-src` carries 'unsafe-inline', so the unhashed inline script
 *    is explicitly allowed.
 *  - On every OTHER route -- including `/`, `/login`, `/signup` and `/cew-polls/*`, which is
 *    where a first-time visitor with no cookie actually meets this script -- the matcher does
 *    not run, so NO Content-Security-Policy header is emitted at all and nothing constrains
 *    it. Do not read the middleware policy as the governing policy on the landing page;
 *    there is none.
 * If a CSP is ever tightened to a nonce/hash policy, or extended to cover the public routes,
 * this script must be given the nonce or it will be blocked and the flash returns silently.
 */
import { THEME_COOKIE_MAX_AGE_SECONDS, THEME_COOKIE_NAME } from '@/lib/theme';

export const THEME_STORAGE_KEY = 'theme';

/*
 * Written as one line because it is inlined into <head> verbatim. The cookie read and the
 * localStorage read get SEPARATE try/catch blocks, and the classList work sits outside both:
 * a throw in either store must not stop the class from being applied, which is what the
 * original single outer try/catch would have done.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var d=document,t=null;try{var cs=(d.cookie||'').split(';');for(var i=0;i<cs.length;i++){var q=cs[i].indexOf('=');if(q<0){continue;}if(cs[i].slice(0,q).trim()!=='${THEME_COOKIE_NAME}'){continue;}var v=cs[i].slice(q+1).trim();t=(v==='dark'||v==='light')?v:'light';break;}}catch(_){}if(t===null){try{var s=window.localStorage.getItem('${THEME_STORAGE_KEY}');if(s==='dark'||s==='light'){t=s;d.cookie='${THEME_COOKIE_NAME}='+s+'; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax'+(location.protocol==='https:'?'; secure':'');}}catch(_){}}if(t===null){t='light';}var e=d.documentElement;e.classList.remove('light','dark');e.classList.add(t);})();`;
