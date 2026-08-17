# Rendered-browser verification -- landed main 0ef90f48

Performed against a PRODUCTION build (`next build` via the repo's monitored build script, then
`next start`) of the landed tree checked out at `origin/main` = `0ef90f48`, served on
`http://localhost:3544/`. The build id was `Ra7pIzdK9DrP7FtLFfOaj`.

This is LOCAL-BUILD-OF-MERGED-MAIN evidence. It is NOT deployment evidence. No deployment was
performed or verified by this lane.

## 1. Server-rendered theme and accessible name, with JavaScript ABSENT

Captured with plain `curl` -- no client runtime, no hydration. This is the decisive evidence for the
WCAG 4.1.2 defect that #782 alone would have shipped, because it shows the accessible name is now
correct in the served bytes.

| Request | served `<html>` | served accessible name | sun-path glyph present |
|---------|-----------------|------------------------|------------------------|
| `Cookie: theme=dark`  | `<html lang="en" class="dark"`  | `aria-label="Switch to light mode"` | yes (1) |
| `Cookie: theme=light` | `<html lang="en" class="light"` | `aria-label="Switch to dark mode"`  | no (0) |
| no cookie             | `<html lang="en" class="light"` | `aria-label="Switch to dark mode"`  | -- |

The pre-paint bootstrap is present in the served HTML, in its length-agnostic form
(`classList.remove.apply`), confirming the P3 correction shipped: grep count 1.

## 2. Real headless-Chromium render, dark cookie

    document.documentElement.className                     -> "dark"
    getComputedStyle(document.body).backgroundColor        -> "rgb(15, 23, 42)"    (slate-900)
    toggle aria-label                                      -> "Switch to light mode"
    toggle getBoundingClientRect() height                  -> 44
    toggle getBoundingClientRect() width                   -> 44

The 44x44 figure is the measured BOUNDING BOX, not a class-name assertion. That matters: this
project has a recorded defect class where a suite asserted a CSS class while the rendered element
was the wrong size or zero-height. #782's WCAG 2.5.5 target-size claim is therefore verified by
geometry.

## 3. The accepted migration-window residual -- and why a post-load query cannot see it

The known residual is: a returning browser with `localStorage.theme = 'dark'` and NO cookie yet gets
one request where the server sends `class="light"` plus `aria-label="Switch to dark mode"`, while the
pre-paint bootstrap sets `<html class="dark">`.

Attempting to observe this with post-load JavaScript returns a CORRECT result
(`aria-label="Switch to light mode"`), because by then hydration and the mount effect have run and
reconciled from localStorage, and the bootstrap has already written the cookie. That is the same
blind spot as asserting after React effects have flushed: the window closes before the query runs.

So the residual is established from the SERVED BYTES instead (section 1, row 3: no cookie -> served
`class="light"` + `"Switch to dark mode"`), combined with the code path:
`layout.tsx` calls `resolveThemeFromCookieHeader(...)` which returns `DEFAULT_THEME` (an
authoritative `'light'`) rather than `undefined` when the cookie is absent, so `seedTheme`'s
`parseTheme(initialTheme)` early-returns and the DOM-class fallback at `ThemeContext.tsx:85` is
never reached in production.

Self-healing was confirmed: on the next request the cookie is present (`document.cookie` ->
`theme=dark`), `<html class="dark">`, and the accessible name is `"Switch to light mode"`.

## 4. Print

    body scrollWidth 1280 == clientWidth 1280      (no horizontal overflow on the public route)
    PDF rendered successfully                       evidence/verification/landed-print.pdf, 636769 bytes

Print utilities confirmed present in the landed CSS bundle
(`/_next/static/css/7c6eb5c784f49b0a.css`, 240459 bytes):

    max-h-none          3 occurrences
    overflow-visible    2 occurrences
    media print         2 occurrences
    pb-72               1 occurrence     <- from the #788 round-2 correction
    max-h-40            1 occurrence     <- from the #788 round-2 correction

The print-critical surfaces (matrix-options, SSD workbench, TWG) are authenticated routes and were
verified by Playwright's REAL print-media emulation in the landed-tree e2e gate, not by curl. These
specs passed on `0ef90f48`:

    matrix-options-print.spec.ts  prints exactly one level-1 heading on "Methodology by pathway"
    matrix-options-print.spec.ts  prints exactly one level-1 heading on "The Guide"
    matrix-options-print.spec.ts  does not add a second heading on screen (x2)
    matrix-options-print.spec.ts  TWG Review keeps its own heading and gains no injected chrome
    ssd-workbench.spec.ts         no height-capped data table clips under the print medium
    ssd-workbench.spec.ts         species-aggregate table is not height-clipped when printed

## 5. What was NOT verified in a browser, stated plainly

- The TWG truncation/provenance surfaces are behind authentication and were not driven by hand in a
  browser. They are covered by the unit suite (the falsified regression tests listed in
  `evidence/corrections/`) and by the landed-tree e2e run. The three P1 fixes are therefore verified
  by test and by code reading, not by manual browser interaction.
- No deployed environment was exercised. There is no production or preview URL evidence in this
  lane.

## Cleanup

The production server and the headless browser were both stopped; port 3544 was confirmed closed.
No session-owned processes remain.
