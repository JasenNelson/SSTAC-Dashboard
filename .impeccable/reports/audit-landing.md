# Landing Page Audit -- SSTAC Dashboard (`/`)

Scope: `src/app/page.tsx`, `src/components/dashboard/ProjectPhases.tsx`, `src/components/ThemeToggle.tsx`,
`src/app/layout.tsx`, `src/contexts/ThemeContext.tsx`, `src/app/globals.css`. Read-only audit; no files
modified. Every finding below was cross-checked against the raw source (line-by-line reads) and the
deterministic evidence run (detector output, rendered-HTML fetch, computed contrast math). Two raw-audit
claims were corrected against that evidence (see "Corrections to the raw audit" at the end).

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 1/4 | No `<main>` landmark; two computed contrast failures (2.45:1 and 3.07:1) |
| 2 | Performance | 2/4 | Raw `<a>` tags instead of `next/link` for all 5 primary nav/CTAs; whole page needlessly `'use client'` |
| 3 | Responsive Design | 3/4 | Layout collapses correctly at breakpoints; one sub-44px (but WCAG-2.5.8-passing) touch target |
| 4 | Theming | 1/4 | Zero usage of the app's own token system (`bg-primary`, `text-foreground`, etc.) across both target components |
| 5 | Implementation Integrity | 1/4 | Emoji-as-icon and SVG-icon patterns coexist inconsistently; unused token system; stale copyright year |
| **Total** | | **8/20** | **Poor -- major overhaul** |

## Implementation Integrity Verdict: FAIL

PRODUCT.md's Principle 4 states that anything reading as "generic, decorative, or unserious costs trust."
Verified evidence against that bar:

- `src/app/globals.css` defines a complete semantic token system (`--primary`, `--background`,
  `--foreground`, `--card`, `--muted`, `--accent`, etc. at lines 8-35, wired through `@theme inline` at
  lines 37-59). A grep for `bg-primary|text-foreground|bg-card|text-muted-foreground|bg-secondary|
  bg-accent|bg-background` across `src/app/page.tsx` and `src/components/dashboard/ProjectPhases.tsx`
  returns **zero matches** in either file (verified directly, not merely cited). All five color families
  actually used on the page (slate, sky, green, purple, amber) are raw Tailwind literals with hand-paired
  `dark:` variants.
- Two incompatible icon languages sit side by side: `src/components/ThemeToggle.tsx` uses real,
  correctly-labeled inline SVGs (lines 17-30 and 33-46, inside a button with `aria-label` at line 12).
  `src/app/page.tsx` (lines 55, 83, 98, 113) and `src/components/dashboard/ProjectPhases.tsx` (lines 13,
  42) use raw emoji glyphs as the only "icon" for every content card and phase marker, with no
  `aria-hidden` anywhere on any of the six.
- `src/app/page.tsx:153` hardcodes `&copy; 2025 ... All rights reserved.` -- already one calendar year
  stale against the current date (2026-08-14).
- `src/app/globals.css:10` and `src/app/globals.css:287` both hardcode the identical
  `Arial, Helvetica, sans-serif` stack -- once through the token path (`--font-app-sans`, wired to
  `--font-sans` via `@theme inline` at line 57), once again as a raw `body { font-family: ... }` override
  that bypasses that token path entirely.

This reads as interchangeable template boilerplate rather than the deliberate surface of a
government-partnered scientific collaboration. Verdict: **FAIL**.

## Executive Summary

- Audit Health Score: **8/20** (Poor -- major overhaul)
- Issues found: P0: 0, P1: 4, P2: 7, P3: 3 (14 total, listed below)
- Top issues: missing `<main>` landmark, two measured WCAG contrast failures, zero design-token adoption,
  emoji used as interface icons with no accessible-name hygiene, full-page-reload navigation on every
  primary link.
- Per PRODUCT.md, accessibility is treated as must-fix for this project -- the 4 accessibility-tagged P1s
  and 2 accessibility-tagged P2s below (heading structure, reduced-motion) should be prioritized as a
  group ahead of the theming/performance items, independent of severity label.
- Recommended next step: PRODUCT.md already records the owner's decision to replace this visual system.
  This audit is confirmed, evidenced groundwork for that replacement -- fix the accessibility set first
  (it is orthogonal to visual design and should survive any redesign), then route the redesign through
  the existing token system rather than repeating the current ad hoc color pattern.

## Detailed Findings by Severity

### P1 -- Accessibility

**[P1] Missing `<main>` landmark**
- Location: `src/app/page.tsx` lines 7-158 (entire body between `<header>` at line 10 and `<footer>` at
  line 150)
- Category: Accessibility
- Impact: Screen-reader users navigating by landmark (skip-to-content, landmark rotor) have no main region
  to jump to; the hero, About section, nav cards, and Get Involved section are all unlabeled generic
  `<div>`s.
- WCAG: 1.3.1 Info and Relationships / 2.4.1 Bypass Blocks
- Recommendation: Wrap the hero and content sections (everything between the header and footer) in a
  single `<main>` element.

**[P1] Contrast failure -- 2.45:1 (light) / 3.07:1 (dark), expandable sub-bullet text**
- Location: `src/components/dashboard/ProjectPhases.tsx:82` (`text-slate-400 dark:text-slate-500`),
  rendered inside the `bg-slate-50 dark:bg-slate-800/50` container opened at line 71/51
- Category: Accessibility
- Impact: Computed WCAG relative-luminance ratio for `text-slate-400` (#94A3B8) on `bg-slate-50`
  (#F8FAFC) is **2.45:1**, and the dark-mode pairing computes to **3.07:1** -- both well below the 4.5:1
  AA floor for normal-size text (this is `text-xs`, 12px). Both light and dark modes fail; only light
  mode was flagged in the source audit. The six SABCS White Paper sub-items ("Preliminary Scientific
  Review" etc., lines 73-78) are effectively unreadable for low-vision users in both themes. This content
  is only reachable after expanding the disclosure at line 57, so it will not surface in a default-state
  automated scan.
- WCAG: 1.4.3 Contrast (Minimum)
- Recommendation: Move to a darker pairing (e.g. `text-slate-600` light / `text-slate-400` dark) or bind
  to the existing `--muted-foreground` token (#64748B, `src/app/globals.css:25`), which clears 4.5:1
  against both `#F8FAFC` and `#0F172A`-family surfaces.

**[P1] Contrast failure -- 3.07:1, Phase 1 status pill (light mode)**
- Location: `src/components/dashboard/ProjectPhases.tsx:46` (`text-amber-600` on the pill's own
  `bg-amber-50`)
- Category: Accessibility
- Impact: Computed ratio for `text-amber-600` (#D97706) on `bg-amber-50` (#FFFBEB) is **~3.07:1**,
  below the 4.5:1 AA floor, on the sentence stating the deliverable "is complete and undergoing final
  review pending ENV feedback" -- a substantively important status line for a credibility-sensitive
  public audience.
- WCAG: 1.4.3 Contrast (Minimum)
- Dark-mode note: the paired dark variant (`dark:text-amber-500` on `dark:bg-amber-900/20`, composited
  over the `bg-slate-800` card) computes to approximately 6.45:1 and passes. This is a light-mode-only
  defect -- an asymmetry between the two themes' contrast, not a deliberate design applied consistently.
- Recommendation: Darken to `text-amber-700` or `text-amber-800` in light mode, or route through a token
  pair verified at both ends.

**[P1] Emoji used as interface icons with no accessible-name hygiene**
- Location: `src/app/page.tsx` lines 55, 83, 98, 113 (four `<span className="text-2xl">` emoji: building,
  bar chart, chart-increasing, target/dartboard); `src/components/dashboard/ProjectPhases.tsx` lines 13
  and 42 (rocket, check mark)
- Category: Accessibility / Implementation Integrity
- Impact: All six emoji sit inside a link, heading region, or status marker with no `aria-hidden="true"`
  anywhere in either file (verified: no `aria-hidden` string appears in `page.tsx` or
  `ProjectPhases.tsx`). Several screen readers announce a Unicode short name for emoji, so an accessible
  name can pick up redundant noise (e.g. a spoken glyph name ahead of "Dashboard: Access project overview,
  documents, and key metrics"). The hero's "Current Focus" pill (`page.tsx:31`) visually equates a
  decorative rocket glyph with the actual status text it precedes.
- WCAG: 1.1.1 Non-text Content
- Recommendation: Add `aria-hidden="true"` to every purely decorative emoji span, or replace them with a
  real icon set for consistency -- `ThemeToggle.tsx` already demonstrates the correct pattern (real SVG,
  parent control carries the accessible name).

### P2

**[P2] Two content sections render at `<h3>` with no owning `<h2>`**
- Location: `src/app/page.tsx` lines 85, 100, 115 (Dashboard / Survey Results / CEW 2025 nav-card
  headings) and line 126 (`<h3>Get Involved</h3>`)
- Category: Accessibility
- Impact: The rendered DOM heading order is `h1 (23) -> h2 (46) -> h3 (58, 85, 100, 115, 126)` --
  levels are never skipped (no jump from h2 straight to h4, etc.), so this is not a hard heading-level
  violation. But the "About the Sediment Standards Project" `<h2>` at line 46 is the only `<h2>` on the
  page; the Navigation Cards grid (lines 76-121) and the "Get Involved" block (lines 125-146) are
  separate visual sections that both render their titles at `<h3>` with no sectioning `<h2>` of their
  own, borrowing the outline position of the preceding About section. Screen-reader users navigating by
  heading level may not discover these as document-level sections in their own right.
- WCAG: 1.3.1 Info and Relationships / 2.4.6 Headings and Labels
- Recommendation: Add a (visually-hidden, if desired) `<h2>` above the nav-card grid and above
  "Get Involved", or restructure so the card/section titles sit at a level consistent with their own
  `<h2>` parent.

**[P2] Zero adoption of the app's own token system**
- Location: `src/app/page.tsx` (all color classes) and `src/components/dashboard/ProjectPhases.tsx`
  (all color classes) -- verified by direct grep: 0 matches for
  `bg-primary|text-foreground|bg-card|text-muted-foreground|bg-secondary|bg-accent|bg-background` in
  either file, against a complete token set defined at `src/app/globals.css` lines 8-59
- Category: Theming
- Impact: Every color decision on the page is a hardcoded Tailwind literal with a hand-maintained
  `dark:` twin. Any future rebrand (already approved per PRODUCT.md) requires editing dozens of scattered
  class strings instead of a handful of CSS variables.
- Recommendation: Route landing-page colors through the existing `--primary` / `--card` / `--muted` /
  `--border` tokens, and extend the token set with named roles for the sky hero band and the
  green/purple/amber accent chips, before the planned redesign begins.

**[P2] Full-page reloads on every primary link**
- Location: `src/app/page.tsx` lines 77, 92, 107 (three nav cards: `/dashboard`, `/survey-results`,
  `/cew-2025`) and lines 133, 139 (`/signup`, `/login`)
- Category: Performance
- Impact: All five primary calls to action use raw `<a href="...">`, not `next/link`'s `<Link>`.
  Confirmed by the absence of any `Link` import in the file (`page.tsx` imports only `ThemeToggle` and
  `ProjectPhases`). Every click triggers a full document reload -- no client-side transition, no route
  prefetch -- on the exact links this landing page exists to funnel visitors through.
- Recommendation: Replace all five with `next/link` `<Link>` components.

**[P2] Unnecessary `'use client'` on the whole route**
- Location: `src/app/page.tsx:1`
- Category: Performance
- Impact: `Home()` itself has no hooks, state, or event handlers -- only its two children (`ThemeToggle`,
  `ProjectPhases`, both independently marked `'use client'` in their own files) need client runtime.
  Marking the page itself client forces the entire static marketing shell to hydrate as client JS instead
  of rendering as a Server Component with two small client islands.
- Recommendation: Drop `'use client'` from `page.tsx`; the imported components already carry their own
  directive.

**[P2] Theme flash on load (FOUC)**
- Location: `src/contexts/ThemeContext.tsx` line 16 (state initializes to `'light'`) and lines 20-26
  (localStorage read deferred into a `useEffect`, so it only runs after first client render);
  `src/app/layout.tsx` lines 22-25 (`<html lang="en" suppressHydrationWarning>` / `<body
  className="antialiased">` carry no theme class and no inline bootstrap script in `<head>`)
- Category: Theming / Performance (perceived)
- Impact: A returning visitor with dark mode saved sees the light theme render first on every full page
  load, then snap to dark once `ThemeProvider`'s effect reads `localStorage`. `suppressHydrationWarning`
  (layout.tsx:22) only silences the React hydration-mismatch warning; it does not prevent the visible
  flash.
- Recommendation: Add a small inline blocking script in `layout.tsx`'s `<head>` that reads `localStorage`
  and sets the theme class before first paint.

**[P2] No `prefers-reduced-motion` handling anywhere**
- Location: `src/app/globals.css` -- confirmed 0 matches for `prefers-reduced-motion` in the file;
  animated hover effects at `src/app/page.tsx` lines 79, 94, 109 (`hover:-translate-y-2`) and lines 82,
  97, 112 (`group-hover:scale-110`), each paired with `transition-all duration-300`
- Category: Accessibility
- Impact: Users who have set the OS-level reduced-motion preference (relevant to vestibular disorders)
  receive the identical translate/scale animation as everyone else on all three nav cards, with no
  alternative feedback state.
- WCAG: 2.3.3 Animation from Interactions (AAA-level criterion; flagged here as a real, easily-fixed gap
  rather than an AA failure)
- Recommendation: Add a `@media (prefers-reduced-motion: reduce)` block that suppresses the transform and
  keeps only the shadow/color feedback.

**[P2] Ad hoc, ungoverned accent-color palette**
- Location: `src/app/page.tsx` lines 54, 82 (sky-100/900), 97 (green-100/900), 112 (purple-100/900);
  `src/components/dashboard/ProjectPhases.tsx:46` (amber-50/900)
- Category: Theming / Implementation Integrity
- Impact: Four unrelated hues (sky, green, purple, amber) are used as card/status accents with no
  relationship to the token palette's `--primary` / `--secondary` / `--accent` / `--destructive` roles --
  each appears to have been picked per-card rather than assigned a semantic meaning.
- Recommendation: Define a small semantic accent scale (e.g. "phase-active", "phase-complete",
  "status-warning") and route these usages through it.

### P3

**[P3] Sub-44px touch target on the theme toggle**
- Location: `src/components/ThemeToggle.tsx:11` (`h-10 w-10` = 40x40px button)
- Category: Responsive Design
- Impact: Below the common 44x44px mobile-tap guidance for a control present on every page. Note this
  clears the actual WCAG 2.5.8 (AA) 24px target-size floor, so it is a usability recommendation, not a
  WCAG conformance failure -- downgraded from the raw audit's implicit accessibility framing to reflect
  that.
- Recommendation: Increase to `h-11 w-11` (44px) or add invisible hit-area padding.

**[P3] Stale hardcoded copyright year**
- Location: `src/app/page.tsx:153` (`&copy; 2025 SSTAC & TWG Dashboard. All rights reserved.`)
- Category: Implementation Integrity
- Impact: The literal `2025` is stale against the current date. The "All rights reserved" boilerplate
  also adds nothing meaningful for a public-partnered scientific collaboration site.
- Recommendation: Either drop the line or compute the year dynamically (`{new Date().getFullYear()}`),
  and reconsider whether a rights-reserved footer belongs on this kind of site at all.

**[P3] Duplicated hardcoded font stack**
- Location: `src/app/globals.css:10` (`--font-app-sans: Arial, Helvetica, sans-serif`, wired through
  `@theme inline` at line 57) and `src/app/globals.css:287` (`body { font-family: Arial, Helvetica,
  sans-serif; }`)
- Category: Implementation Integrity
- Impact: The identical font stack is declared twice through two different mechanisms -- the token path
  and a raw `body` override that bypasses it. Functionally harmless today (both resolve to the same
  value) but is exactly the kind of redundant, ungoverned declaration that drifts silently once a real
  typeface is chosen for the planned redesign.
- Recommendation: Delete the line-287 override; let `body` inherit `font-sans` from the token system
  alone.

## Patterns & Systemic Issues

- **A complete design-token system exists and is entirely unused on the landing page.**
  `src/app/globals.css` defines a correctly-structured light/dark token set (`--primary`, `--background`,
  `--card`, `--muted`, etc., wired through Tailwind's `@theme inline`), but neither `page.tsx` nor
  `ProjectPhases.tsx` reference it -- confirmed by grep returning zero hits in both files. This is the
  single highest-leverage fix ahead of the planned rebrand: every hardcoded `slate-*` / `sky-*` /
  `green-*` / `purple-*` / `amber-*` class is a place a future visual-system change will otherwise have to
  be hand-edited one string at a time.
- **Two incompatible icon systems coexist.** `ThemeToggle.tsx` implements icons correctly (real SVG plus
  a computed `aria-label`); `page.tsx` and `ProjectPhases.tsx` implement icons as bare, unhidden emoji.
  This recurs at 6 separate locations across the two files, not a one-off.
- **Interactive elements bypass Next.js navigation primitives consistently.** All five primary links on
  the page use raw `<a>`; none uses `next/link`.
- **Accessibility gaps cluster around content that is not visible on first paint or default scan.** The
  worst contrast failure (2.45:1) is inside a collapsed disclosure that only renders after a click; the
  heading-structure gap only shows up when reading DOM order against visual section boundaries. Both are
  real defects an automated crawl of the default page state would likely miss.

## Positive Findings

- `ProjectPhases.tsx` lines 57-60: the SABCS White Paper disclosure toggle is a real `<button>` with
  correct `aria-expanded` (line 59) and `aria-controls` (line 60), wired to a matching
  `id="white-paper-details"` (line 71) -- a properly implemented disclosure pattern.
- `ThemeToggle.tsx` line 12: the accessible name is computed dynamically from live state
  (`` `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` ``), not a static or misleading label, and
  pairs a real `aria-label` with a `title` (line 13) rather than relying on `title` alone.
- `ThemeToggle.tsx` line 11: visible focus styling (`focus:ring-2 focus:ring-sky-500
  focus:ring-offset-2`) with a dark-mode-aware offset color; no `outline-none` was found anywhere in the
  five audited files, so default/enhanced focus indication survives for keyboard users.
- Responsive grid classes (`lg:grid-cols-2` at `page.tsx:50`, `md:grid-cols-2 lg:grid-cols-3` at
  `page.tsx:76`) correctly collapse to single-column on narrow viewports; no hardcoded pixel widths were
  found in any of the audited files.
- `layout.tsx:22` sets `lang="en"` on `<html>` correctly, and scopes `suppressHydrationWarning` narrowly
  to the theme-class mismatch rather than suppressing hydration warnings globally.
- The page is genuinely public (`curl` against the dev server returns HTTP 200 with no redirect to
  `/login`), matching PRODUCT.md's mixed public-plus-member audience framing rather than gating content
  behind auth.

## Corrections to the raw audit

- **Heading hierarchy** was reframed from a P1 "skip" to a P2 "sections lack their own `<h2>`." The
  rendered DOM heading order is `h1 -> h2 -> h3` throughout with no level ever skipped; the real issue is
  narrower -- two visual sections (nav cards, Get Involved) render their titles at `<h3>` without a
  sectioning `<h2>` of their own, which is a real but less severe structural gap than a literal
  heading-level skip.
- **The slate-400/500 sub-bullet contrast finding** was expanded to include the dark-mode pairing
  (`dark:text-slate-500` on `dark:bg-slate-800/50`, computed at ~3.07:1), which also fails AA and was not
  called out as failing in the raw audit's finding text (only the light-mode 2.45:1 was flagged there,
  even though the evidence packet's own table shows the dark pairing failing too).
- **The sub-44px touch-target finding** was downgraded from an implicit accessibility framing to a P3
  usability recommendation, since it clears the actual WCAG 2.5.8 (AA) 24px target-size floor -- the raw
  audit itself noted this in passing but categorized the finding at P2 without stating the WCAG criterion
  it does and does not violate.
- **The `bg-gradient-to-*` count** (2 occurrences on the landing page, at `page.tsx:8` and `page.tsx:20`)
  was independently re-verified by grep and confirmed accurate; no change needed.
- Detector tool (`detect.mjs --json`, static-file mode) returned zero findings across all four target
  files; URL-mode (puppeteer-based) scanning was unavailable in this worktree. All findings above come
  from manual source review and computed contrast math cross-checked against the deterministic evidence
  packet, not from the automated detector.
