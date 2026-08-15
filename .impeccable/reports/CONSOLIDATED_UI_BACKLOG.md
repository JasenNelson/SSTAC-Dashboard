# Consolidated UI Backlog - Landing Page + Matrix Options

Source reports: `critique-landing.md`, `audit-landing.md`, `critique-matrix-options.md`,
`audit-matrix-options.md`. Governing context: `PRODUCT.md` (owner decisions, 2026-08-14).

## How to read this

Four reports covered two surfaces from two angles each (an unanchored design critique and a
source-verified technical audit). This document merges them into one backlog, deduplicated by
underlying defect rather than by report. Two owner decisions shape everything below: the landing
page's entire visual world is being replaced, so landing findings do not become code tickets this
session - they become requirements the replacement must satisfy (Section B). Matrix Options is
staying as-is visually; only its high-impact, low-risk defects get fixed this session (Section A).
Big Matrix Options refactors (the 4552-line `EvidenceLibrary.tsx`, the 2216-line
`SsdWorkbench.tsx`, a shared component library) are real but explicitly out of scope now
(Section C). Nothing that could change a displayed regulatory value or touch calculation logic is
proposed anywhere in this document (Section D covers the one item that brushes against that line).
Section E is the honesty section: where the four reports disagreed, what got dropped, and what
this document judged to be a false positive.

## Scorecard

| Surface | Assessment | Score | Max | Band |
|---|---|---|---|---|
| Landing (`/`) | Critique (Nielsen heuristics, 1 n/a) | 12 | 36 | Poor (33%) - major overhaul required |
| Landing (`/`) | Audit (5 dimensions) | 8 | 20 | Poor - major overhaul |
| Matrix Options | Critique (Nielsen heuristics, Operate mode) | 20 | 40 | Acceptable, bottom of band - significant improvements needed |
| Matrix Options | Audit (5 dimensions) | 9 | 20 | Poor - major overhaul |

## Merge count

57 raw findings across the four reports (13 landing-critique + 14 landing-audit + 18
matrix-options-critique + 12 matrix-options-audit) collapsed into **38 unique items**: 14 landing
items (all routed to Section B as redesign requirements), 8 Matrix Options items fixed this
session (Section A), 15 Matrix Options items deferred (Section C), and 1 item held for owner
decision (Section D). The gap between 57 and 38 is almost entirely the same defect described once
per report from two angles (e.g. the bootstrap-stuck bug, the tab-bar ARIA gap, and the two
contrast failures each appear in both reports for their surface); a handful of true duplicates
inside a single report (e.g. touch-target findings restated across severity buckets) are also
folded in. Three findings were corrected or dropped outright rather than merged - see Section E.

---

## Section A - Fix this session (Matrix Options only)

Ordered by severity, then effort. All items are additive or localized; none touches a displayed
regulatory value or calculation logic.

| ID | Severity | Title | Surface | Evidence | Why it matters | Fix | Effort |
|---|---|---|---|---|---|---|---|
| A1 | P0 | Methodology side-tabs are mouse-only | Matrix Options - Jurisdictional Frameworks | `MatrixDashboard.tsx:620-634` (`<li onClick>`, no `role`/`tabIndex`/`onKeyDown`) | A keyboard-only or screen-reader user is permanently locked to one of three methodology documents and cannot reach the other two at all - a hard content lockout, not polish. | Replace each `<li>` with a `<button>` inside `role="tablist"`; add `role="tab"` + `aria-selected` + `aria-controls`; reuse the roving-tabindex handler already implemented correctly in `CategorySelector.tsx`. No state/layout change. | M |
| A2 | P0/P1 | Primary 8-tab navigation has no ARIA tab semantics | Matrix Options - top-level nav | `MatrixDashboard.tsx:1149-1158` (`TABS.map`, plain `<button>` in `<nav>`, zero `role="tab"`/`role="tablist"`/`aria-selected` file-wide) | This is the top-level nav for all 8 sections of the surface. A screen reader hears a flat "button, button, button" with no role, position, or selected-state. Both reports flag this independently; critique treats it as P0-adjacent, audit rates it P1 - this document uses the lower rating (P1) per the tie-break rule, noted in Section E. | `role="tablist"` on the `<nav>`, `role="tab"` + `aria-selected` + `aria-controls` per button, `role="tabpanel"` on the content region, arrow-key roving-tabindex (same CategorySelector pattern as A1). | M |
| A3 | P1 | Bootstrap UCL calculation gets stuck on "Calculating..." forever after a worker rejection | Matrix Options - Interactive Map stats panel | `MatrixMapSelectionStats.tsx:94-111` (`.catch` never writes `bootstrapCache`; `.finally` clears `calculatingKeys` without a terminal state) `:300-301` (display fallthrough) | The queue predicate re-fires the same failing calculation indefinitely; the UI lies about being busy forever with no error and no retry path, confirmed independently by both reports tracing the same lines. | Add a `failedKeys` set written in `.catch`; include `!failedKeys[cacheKey]` in the queue predicate; render "Could not compute - retry" instead of "Calculating...". | S |
| A4 | P1 | Failed writes are silently swallowed at 4 call sites, including a QA-review submission | Matrix Options - Evidence Library | `EvidenceLibrary.tsx:1407-1427` (`submitReview`), `:1637-1658` (`submitEvidenceItem`), `:2439-2448` (`setTriageStatus`), `:3485`/`:3528` (saved views) - all branch `if (ok) {...}` with no `else` on a swallowed `Promise<boolean>` | A failed QA-review submit closes the form as if it succeeded; the reviewer's typed rationale is gone with no signal the write didn't happen. This is the HITL judgment-write path on the product's stated point of credibility. The correct pattern already exists twice in-repo (`AddSourceForm.tsx`, `CatalogStagingReview.tsx`) - this is propagation, not invention. | Branch on `ok` at all 4 sites; on failure keep the form open, preserve input, render an inline `role="alert"` naming the failure. | M |
| A5 | P1 | Zero live-region coverage - results, verdicts, and errors are never announced | Matrix Options - 6 calculators + Evidence Library | No `aria-live`/`role="status"`/`role="alert"` in `EvidenceLibrary.tsx` (4552 lines) or any calculator result block; e.g. `HHDirectContactCalculator.tsx:770-799`, `EcoDirectEqPCalculator.tsx:496-508` | Changing an input silently changes a regulatory-adjacent number; a screen-reader user gets no signal the value or PASS/FAIL verdict changed. Flagged explicitly by the critique report; the audit's top-3 list did not separately name it - noted in Section E. | `role="status"` on each calculator's hero result/verdict pill; `role="alert"` on each error box; one `aria-live="polite"` region in Evidence Library for save/QA/filter outcomes. Purely additive. | M |
| A6 | P2 | Icon-only "remove promoted candidate" button's only accessible name is a fragile `title` | Matrix Options - Evidence Library | `EvidenceLibrary.tsx:2816-2824` | `title` is mouse-hover-only, inconsistently read by screen readers, and can be stripped under forced-colors modes. Both reports independently confirm this is the one genuinely icon-only button in the file (see Section E for the 3 buttons incorrectly flagged alongside it in one report's minor-observations list). | Add `aria-label="Remove promoted candidate"` alongside the existing `title`. | S |
| A7 | P2 | Touch targets under 44px on the tab bar and panel toggles | Matrix Options - top-level nav chrome | `MatrixDashboard.tsx:1151-1157` (~32px tabs), `:1164`/`:1167` (~36px toggles, already correctly `aria-label`'d) | These are the highest-frequency controls on the surface. Both already clear WCAG 2.5.8's 24px AA floor, so this is against the project's own 44px working bar, not an AA failure - flagged P2, not higher. | Increase padding (not icon/text size) so hit area reaches 44px. | S |
| A8 | P3 | Heading hierarchy jumps from `<h1>` straight to `<h3>` | Matrix Options - tool shell | `MatrixDashboard.tsx:1147` (`<h1>`) to `:1192` (`<h3>`), no `<h2>` between | Screen-reader users navigating by heading level see a level skip; does not block task completion but is a one-line, zero-risk fix. | Change the sidebar heading to `<h2>`, or insert an intermediate `<h2>`. | S |

---

## Section B - Landing page redesign scope

The landing page's visual world (color, typography, spacing, icons, gradients) is being replaced
outright, so those findings are not itemized as fix tickets - they collapse into one line: **the
replacement must not repeat the current five-hue ad hoc accent palette (`sky`/`green`/`purple`/
`amber`/`slate`), the two competing hero gradients (`page.tsx:8`,`:20`), or bare emoji-as-icon
(`page.tsx:55,83,98,113`; `ProjectPhases.tsx:13,42`, none `aria-hidden`), and must route through
the design-token system already defined in `globals.css:8-59` and currently used zero times on
this route.** Everything below is a requirement that survives the visual replacement and must be
carried into it, because it is structural, accessibility, content-truth, or routing/IA - not a
color choice.

1. **Do not let a public visitor click into a login wall unlabeled.** `/dashboard`, `/survey-results`,
   and `/cew-2025` (`page.tsx:78,93,108`) are all gated (`route-access.ts:16-25`); the landing page
   itself is confirmed public (HTTP 200, no redirect). Card copy currently promises content
   ("Access project overview, documents, and key metrics", `page.tsx:88`) with no "sign in
   required" text anywhere. The replacement must visually and textually separate public-reachable
   destinations from member-only ones, with a text affordance, not color or icon alone.
2. **Ship a `<main>` landmark and a skip link.** `layout.tsx:23-37` wraps children directly in
   `<body>`; `page.tsx:7` opens with a plain `<div>`. No landmark, no skip link, in the entire
   render path.
3. **Give every visual section its own heading level.** The nav-card grid (`page.tsx:76-121`) and
   "Get Involved" (`page.tsx:126`) both render `<h3>` titles with no owning `<h2>` - they read as
   sub-items of "About" rather than their own sections.
4. **Meet 4.5:1 text contrast in both themes, verified, not assumed.** Two measured failures on
   the current build: `ProjectPhases.tsx:82` (`text-slate-400`/`bg-slate-50`, 2.45:1 light / 3.07:1
   dark) and `ProjectPhases.tsx:46` (`text-amber-600`/`bg-amber-50`, 3.07:1 light; the dark pairing
   passes at ~6.45:1, so light mode was tuned less carefully than dark). The replacement's palette
   must be checked at both ends, not just the one that happens to pass today.
5. **Give the returning member a persistent, primary-styled sign-in, not a bottom-of-scroll
   secondary button.** Header (`page.tsx:10-17`) is wordmark + theme toggle only; "Log In"
   currently renders as the visually secondary/outlined action (`page.tsx:141`) after three
   dead-end cards and the entire marketing narrative.
6. **Expand acronyms on first use.** "SSTAC & TWG" (`page.tsx:13`), "BN-RRM" (`page.tsx:35`,
   `ProjectPhases.tsx:31`), and "CSR standards" (`page.tsx:60`) are never expanded anywhere on the
   page, for an audience `PRODUCT.md:11-14` confirms is unfamiliar with the project.
7. **Fix the stale, wrong-register footer.** `page.tsx:153` hardcodes "(c) 2025 ... All rights
   reserved" - already a year stale against the hero's own 2026-2027 phase copy, and "all rights
   reserved" is the wrong register for a public-sector scientific collaboration. Replace with
   partnership attribution, a contact route, and an accessibility statement, or compute the year
   dynamically if a copyright line is kept.
8. **State the delivery phase once.** Phase 2 is currently stated three times in one scroll
   (`page.tsx:31,35`; `ProjectPhases.tsx:16,18`) with the rocket emoji repeated twice.
9. **Route real navigation through `next/link`, not raw `<a>`.** All 5 primary CTAs
   (`page.tsx:77,92,107,133,139`) currently trigger a full document reload.
10. **Keep the page a Server Component; do not force whole-route hydration.** `page.tsx:1` marks
    the entire route `'use client'` although only its two child components need interactivity.
11. **Avoid a light-mode flash for dark-mode users.** `ThemeContext.tsx:16,20-26` defaults to
    light and only reads `localStorage` after first client render, so a returning dark-mode visitor
    sees an unrequested light flash on every load; no inline bootstrap script exists in
    `layout.tsx`'s `<head>`.
12. **Respect `prefers-reduced-motion`.** No `prefers-reduced-motion` handling exists anywhere in
    `globals.css`, while card hovers (`page.tsx:79,82,94,97,109,112`) animate `transform`
    unconditionally.
13. **Keep the disclosure and theme-toggle interaction contracts intact.** `ProjectPhases.tsx:57-61,71`
    (white-paper disclosure: real `button`, `aria-expanded`/`aria-controls`, matching `id`) and
    `ThemeToggle.tsx:11-13` (computed `aria-label`, real focus ring) are both confirmed correct at
    the source and rendered-DOM level by independent passes - carry these forward verbatim; they
    are the reference pattern for everything else on the page.
14. **Meet the 44px touch-target bar on repeated controls.** `ThemeToggle.tsx:11` is 40x40px
    (clears WCAG 2.5.8's 24px AA floor but not the project's 44px working bar) - a small, cheap
    target for the replacement to hit by default.

---

## Section C - Deferred backlog (Matrix Options)

Real defects, out of scope for this session. Grouped by theme with a one-line reason each.

**Structural refactors** (owner-designated backlog; not this session)
- God components: `EvidenceLibrary.tsx` (4552 lines), `SsdWorkbench.tsx` (2216 lines),
  `MatrixDashboard.tsx` (1269 lines), plus several files reported over 600 lines whose exact counts
  were not independently re-verified by the audit. Reason: explicitly named by the owner as a big
  refactor, not a this-session fix.
- Extract a shared `NumericField` primitive and replace the ~14 confirmed (plus up to ~17
  unconfirmed, see Section E) duplicated numeric-input class-string instances across the HH
  calculators. Reason: requires the shared-primitives work the owner deferred.
- Extract a `getStatusToneClasses()` utility for the emerald/amber status-tone string duplicated
  across `CalculatorProvenancePanel.tsx`, `CalculatorValueSearchPanel.tsx`, `EvidenceLibrary.tsx`,
  `CatalogStagingReview.tsx`. Reason: same shared-primitives dependency.

**Design system**
- Zero `src/components/ui/` imports across all 29 Matrix Options files (`src/components/ui/`
  itself holds only 2 non-primitive files). Reason: the root cause behind both duplication items
  above; owner deferred building shared UI primitives.
- 3 raw hex colors in `SsdWorkbench.tsx` chart lines (`:1938,1950,1962`) duplicate Tailwind values
  used two lines below for the legend. Reason: low risk but tangled with the SsdWorkbench refactor.
- One left rail uses 3 different heading vocabularies for itself (`MatrixDashboard.tsx:701-706`).
  Reason: minor, best fixed alongside the shared-nav work in A1/A2.
- Decorative gradient icon tile in the most prominent chrome slot (`MatrixDashboard.tsx:1146`).
  Reason: cosmetic; Matrix Options was not declared for wholesale visual replacement, so this is
  ordinary polish backlog, not a redesign requirement.
- Side-tab accent rail: `border-l-4 border-sky-500` on the methodology notice callout
  (`MatrixDashboard.tsx:901`). Surfaced by the Impeccable design hook during the A1/A2 edit, but it
  is PRE-EXISTING code, not introduced by that work. Reason: same as above - cosmetic, on a surface
  scoped this session to non-visual fixes only. Deliberately NOT suppressed via `hook-admin
  ignore-value`, so it will resurface when this surface is polished.

**Deeper accessibility**
- Active-filter chips are inert `<span>`s, not dismissible (`EvidenceLibrary.tsx:3677-3690`).
  Reason: real but not flagged at P0/P1 by either report.
- `FilterPopover` lacks `aria-haspopup`/`aria-controls` and does not return focus to its trigger on
  Escape (`EvidenceLibrary.tsx:711-730`). Reason: same, below this session's severity cut.
- No `prefers-reduced-motion` handling in the 11 files using `transition-`/`animate-` utilities.
  Reason: both reports rate this low severity (simple color/width/opacity transitions, not the
  disorienting class of motion).
- `SubstanceCombobox` highlights the active option by background color only, no border marker for
  low-vision mouse users. Reason: minor, below this session's cut.
- The 8-tab bar's `overflow-x-auto` container has no scroll affordance, and panel-toggle buttons
  scroll off-screen with it. Reason: minor, best revisited once A1/A2's tab semantics land.

**Product / IA enhancement**
- No persistent "working-set" bar showing the active substance, regulatory frame, and pathway
  outside the Calculator tab, even though those three facts determine what every number on screen
  means. Reason: a genuine structural opportunity, but it is a new piece of chrome across all 8
  tabs, not a fix to an existing defect - needs design and product buy-in before it is scoped.
- The regulatory frame silently determines which catalog row is flagged policy-default on
  References & Values, but that fact is never rendered on that tab
  (`EvidenceLibrary.tsx:3282`, `MatrixDashboard.tsx:1240`). Reason: real gap, but medium-effort and
  below this session's priority cut.

---

## Section D - Out of scope / needs owner decision

- **HH exposure-factor inputs are unconstrained free text (no `type="number"`, no `min`/`max`/
  `step`).** Evidence: every exposure factor field in `HHDirectContactCalculator.tsx` (13 sibling
  occurrences from `:638`) and its siblings in `HHFoodWebCalculator.tsx`/`HHInhalationCalculator.tsx`.
  A negative body weight or a 1e9 ingestion rate currently flows straight into a screening value.
  This is flagged here rather than in Section A or C because setting real `min`/`max`/`step` bounds
  requires domain-specific range decisions (what is a valid body weight, ingestion rate, etc. for
  this calculator) that this UI pass must not make unilaterally - it borders on constraining what
  values can be entered into a live regulatory calculator. Recommend: owner or a domain-qualified
  reviewer supplies the acceptable ranges per field; then the fix itself (adding the HTML
  attributes) is low-risk UI work suitable for a future session.

No other finding in any of the four reports touches a displayed regulatory value, a calculation
formula, or catalog data.

---

## Section E - Contradictions and false positives

Read this section before trusting the rest of the document at face value.

1. **False positive, corrected by the audit's own re-verification, not by this document:** the
   Matrix Options critique's minor-observations list still states "Four icon-only buttons in
   `EvidenceLibrary.tsx` have zero accessible name at all" (`:616-621,766-771,1804-1809,2111-2116`),
   attributing this to the technical audit. But `audit-matrix-options.md`'s own "Corrections Made to
   the Starting Draft" section explicitly retracts this: three of the four buttons ("Clear
   filters", "Clear all", "Close" x2) carry visible text labels alongside their icon, which gives
   them a valid accessible name from content - only `EvidenceLibrary.tsx:2816-2824` ("remove
   promoted candidate") is genuinely icon-only, and it already has a `title` (kept as A6, on the
   fragility of `title` alone, not on missing naming). This document follows the audit's corrected
   reading and treats the other three as a false positive - not included anywhere in Sections A-D.
2. **Confirmed-count discrepancy on the numeric-input duplication.** The critique states "the
   technical audit independently quantified this as 13x/8x/9x... (30 total instances)" as settled
   fact. But `audit-matrix-options.md` itself says the opposite about its own numbers: the 14x count
   in `HHDirectContactCalculator.tsx` is grep-confirmed, while the 8x (`HHFoodWebCalculator.tsx`)
   and 9x (`HHInhalationCalculator.tsx`) counts were "not independently re-verified for this report
   and should be treated as unconfirmed until re-checked." This document treats the duplication as
   real but the total as ~14 confirmed plus up to ~17 unverified, not a settled 30 - reflected in
   Section C's phrasing.
3. **Severity disagreement on the 8-tab nav ARIA gap (A2).** The critique frames it as
   "P0-adjacent" ("the single highest-leverage accessibility fix on the surface"); the audit rates
   it a straight P1. Per the stated rule (use the lower severity on disagreement), this document
   lists it as P1/P0-adjacent and preserves both framings in A2's evidence column rather than
   picking one silently.
4. **Live-region coverage (A5) appears in only one report's top-severity list.** The critique names
   "zero live-region coverage" as its own P1 Priority Issue with detailed evidence. The audit's
   Executive Summary names only 3 P1s total (bootstrap-stuck, nav ARIA, silent write) and does not
   list live-region coverage as a separate top-tier item, though nothing in the audit contradicts
   the underlying evidence. This document keeps it as A5 because the evidence (zero `aria-live` /
   `role="status"` / `role="alert"` across the entire result-rendering surface) is independently
   verifiable and consistent with PRODUCT.md's must-fix accessibility ranking; the omission from one
   report's summary list is noted rather than treated as a rebuttal.
5. **Self-corrected within a single report, not a true cross-report conflict, but worth surfacing:**
   the landing critique's design pass originally cited "three competing gradients"; its own
   technical-audit cross-reference grep-verified only two `bg-gradient-*` utilities actually render
   on `/` (the third, an indigo/purple/pink family in `globals.css:159-176`, is dead code for other
   routes). Folded into Section B's single gradient line at "two" gradients, not three.
6. **Detector noise, already triaged inside the source reports.** Both Matrix Options reports agree
   9 of the deterministic detector's 14 `gray-on-color` findings are false positives caused by the
   detector flattening mutually-exclusive Tailwind conditional branches (light-mode-only text paired
   with dark-mode-only background from the same ternary, or vice versa) into a cross-product that
   never actually renders together. Only one of the 14 is a confirmed real, hover-scoped contrast
   issue (`EvidenceLibrary.tsx:2819`, ~2.3:1), and it could not be verified as the true rendered
   hover state without a live DOM (route is auth-gated). This document does not list it separately
   in Section A/C because it is unverified-as-rendered and hover-scoped; flagged here for
   completeness rather than silently dropped.
7. **Nothing was dropped for lack of evidence.** Every finding surfaced in the four source reports
   carried a file:line citation traceable back to source; none needed to be discarded on that
   ground. The only exclusions from this document are the false positive in item 1 above and the
   routine "P0-adjacent vs P1" severity tie-break in item 3.
