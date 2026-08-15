# Matrix Options -- UI/UX Audit Report

**Scope:** `src/app/(dashboard)/matrix-options/page.tsx`, `src/components/MatrixDashboard.tsx`, `src/components/matrix-options/` (27 source files + 2 content files, excluding `__tests__/`)
**Mode:** Operate (task-completion surface, auth-gated)
**Method:** Source-level code review + deterministic detector run + manual verification of every cited claim against the file at the stated line number. The route itself could not be inspected in a rendered browser (auth-gated by middleware; no session available to a read-only audit), so all findings below are source-verified, not DOM-verified, and that limitation is called out explicitly wherever it matters.

---

## Audit Health Score

| # | Dimension | Score /4 | Key Finding |
|---|-----------|----------|-------------|
| 1 | Accessibility | 1 | Primary tab-strip navigation (8 tabs, the surface's only top-level nav) has zero ARIA tab semantics -- confirmed by grep returning no matches for `role="tab"`, `role="tablist"`, or `aria-selected` in the file. |
| 2 | Performance | 3 | Tab content is mount-on-demand via a `switch` in `renderContent()` (`MatrixDashboard.tsx:782`); no thrash confirmed; large-file re-render risk is plausible but not runtime-verified. |
| 3 | Theming | 2 | Zero `src/components/ui/` imports across all 29 files; one status-tone Tailwind string duplicated verbatim across 5 files; 3 raw hex codes bypass tokens in chart lines. |
| 4 | Responsive Design | 2 | Tab-bar and panel-toggle touch targets sit at roughly 32-36px, under the 44px bar this audit was asked to apply; horizontal overflow is properly contained elsewhere via scroll wrappers. |
| 5 | Implementation Integrity | 1 | Verified: 9 files over 600 lines (one at 4552 lines), 14x copy-pasted input-class string in one calculator file alone, a write-error contract that silently discards failure at multiple call sites, and one confirmed permanently-stuck loading state. |
| **Total** | | **9/20** | **Poor (major overhaul)** |

## Implementation Integrity Verdict

**PASS on "coherent, product-specific system"; FAIL on maintainability discipline.** Nothing reviewed is generic decorative filler or interchangeable with an unrelated product -- variable names, copy, and structure are genuinely domain-specific (`needs_review` catalog states, HITL provenance, TEF/RPF weighting, source-lead triage), consistent with PRODUCT.md's claim that decorative slop is largely absent. But the codebase shows sustained structural drift: god-components, copy-pasted styling instead of shared primitives, and a write-error contract (`Promise<boolean>`) that silently discards failure information at multiple verified call sites. This is not one-off carelessness -- the same shortcut (raw duplicated Tailwind class strings, `if (ok) {...}` with no `else`) recurs across a majority of the files reviewed.

## Executive Summary

- **Audit Health Score: 9/20 (Poor)**
- **Issues found: 3 P1, 6 P2, 3 P3 (12 total)** -- one P1 claimed in the initial draft of this audit ("four icon-only buttons with zero accessible name") was checked against source and found to be **substantially inaccurate**: three of the four cited buttons carry visible text labels ("Clear filters", "Clear all", "Close") alongside their icon, which gives them an accessible name from content, not just from an icon. That finding has been corrected below rather than reported at its original severity.
- **Top verified issues:** (1) a confirmed functional bug that permanently freezes a UCL bootstrap calculation on "Calculating..." after a worker-promise rejection, with no error state and no retry path; (2) the entire 8-tab primary navigation has no `role="tablist"` / `role="tab"` / `aria-selected` anywhere in the file; (3) four write paths (QA review, evidence submission, triage, saved views) call a helper that returns `Promise<boolean>` and then branch only on the success case, discarding failure silently.
- **Recommended next steps:** fix the P1s first (all are low-risk, localized changes, no architecture change required), then extract the shared input-class and status-tone constants to remove the two largest sources of duplication.

## Detailed Findings by Severity

### P1 -- Fix before release

**[P1] Bootstrap UCL calculation gets permanently stuck on "Calculating..." after a worker rejection**
- **Location:** `src/components/matrix-options/MatrixMapSelectionStats.tsx:94-111` (the async `.then/.catch/.finally` chain), display branch at `:300-301`.
- **Category:** Implementation Integrity / Functional correctness
- **Evidence (verified against source):** `bootstrapUcls(item.values).catch(err => console.error(...))` (line 101-103) never writes into `bootstrapCache` for that key. The `.finally()` block (104-110) deletes the key from `calculatingKeys`, so `isCalculating` becomes `false` -- but the render condition at line 300, `isBootstrap && (isCalculating || !bData)`, stays true forever because `bData` (sourced from `bootstrapCache`) is `undefined` and nothing ever sets it. The card is left showing `'Calculating...'` (line 301) permanently, with no error text and no retry affordance.
- **Impact:** A user relying on this bootstrap UCL value has no way to know the calculation failed versus is merely slow; the UI actively misrepresents an error state as an in-progress state indefinitely.
- **Recommendation:** On catch, write a sentinel failure value into `bootstrapCache` (e.g. `{ error: true }`) instead of leaving the key absent, and branch the display to a distinct "Calculation failed" state rather than falling through to the loading branch.

**[P1] Primary tab navigation has no ARIA tab semantics**
- **Location:** `src/components/MatrixDashboard.tsx:1149-1158` (`TABS.map` renders plain `<button onClick>` elements inside a `<nav>` with no `role`).
- **Category:** Accessibility
- **Evidence (verified against source):** Read lines 1140-1169 directly; confirmed the `<nav>` at 1149 and the `<button>` at 1151-1157 carry no `role`, `aria-selected`, or `aria-controls`. A separate grep for `role="tab"|role="tablist"|aria-selected` across the entire file returned zero matches.
- **Impact:** This is the top-level navigation for all 8 sections of the surface (Guide, Conceptual Model, Jurisdictional Frameworks, TWG Review, Interactive Map, Calculator, SSD Workbench, References). A screen reader announces a flat sequence of "button, button, button..." with no indication of tab role, position, or which tab is currently selected.
- **WCAG/Standard:** 4.1.2 Name, Role, Value (A); 1.3.1 Info and Relationships (A)
- **Recommendation:** Add `role="tablist"` to the `<nav>`, `role="tab"` + `aria-selected={activeTopTab === tab}` + `aria-controls` to each button, `role="tabpanel"` on the content region, and arrow-key roving-tabindex navigation.

**[P1] Four write paths silently discard failure with no error shown to the user**
- **Location:** `src/components/matrix-options/EvidenceLibrary.tsx` -- QA-status `handleSubmit` (`:1407-1427`), evidence-item `handleSubmit` (`:1637-1658`), triage `handleTriage` (`:2439-2448`), and the saved-view handlers.
- **Category:** Implementation Integrity / Error handling (rated P1, not the P2 the initial draft used, because the QA-review path directly misrepresents a failed professional-judgment submission as a successful one to the user)
- **Evidence (verified against source):** Read lines 1405-1429 directly. `const ok = await submitReview(...)` (line 1410) is followed by `if (ok) { ... }` (1418) with no `else`, and then `setShowForm(false)` (1424) runs **unconditionally**, regardless of whether the write succeeded. The same `const ok = await submit...()` / no-`else` shape recurs at `submitEvidenceItem` (line 1640) and `setTriageStatus` (line 2441), confirmed by grep across the file. A grep for `error` state in the whole 4552-line file surfaces exactly one hit, used only for a Zotero image-load failure -- these four write paths have no error-rendering path at all.
- **Impact:** On a failed write, the QA-review form closes as if the submission succeeded. The user has no way to know their professional judgment was not recorded, and the form is no longer open for them to retry.
- **WCAG/Standard:** 3.3.1 Error Identification (A)
- **Recommendation:** Port the pattern already used correctly elsewhere in this codebase in `AddSourceForm.tsx:96-364` and `CatalogStagingReview.tsx:229-300` (local `error` state set on failure, rendered inline, form stays open for retry) to all four call sites.

### P2 -- Fix in next pass

**[P2] Icon-only "remove" button's only accessible name is a `title` attribute**
- **Location:** `src/components/matrix-options/EvidenceLibrary.tsx:2816-2824`.
- **Category:** Accessibility
- **Evidence (verified against source):** `<button ... title="Remove promoted candidate"><X className="h-3.5 w-3.5" /></button>` -- confirmed no visible text and no `aria-label`; the accessible name falls back entirely to `title`.
- **Impact:** `title` tooltips are mouse-hover-only, have inconsistent assistive-technology support, and are stripped in some forced-colors/high-contrast configurations, making this a more fragile mechanism than `aria-label` even though it technically passes today.
- **WCAG/Standard:** 4.1.2 Name, Role, Value (A) -- passes narrowly today, on a fragile mechanism.
- **Recommendation:** Add `aria-label="Remove promoted candidate"` alongside the existing `title`.

**[P2] Touch targets under the 44x44 bar on the tab shell and panel toggles**
- **Location:** `src/components/MatrixDashboard.tsx:1151-1157` (tab buttons: `px-3 py-1.5 text-sm`, roughly 32px tall); `:1164` and `:1167` (panel-toggle buttons: `p-2` around a `w-5 h-5` icon, roughly 36px square, both correctly carrying `aria-label` already -- this is a sizing finding only, not a naming one).
- **Category:** Responsive Design
- **Evidence (verified against source):** Confirmed the class strings directly at the cited lines; both panel-toggle buttons already have `aria-label` (contrary to an earlier misreading of this area of the file -- they are not nameless, only undersized).
- **Impact:** These are dense, frequently-used controls (the primary tab switcher and panel toggles fire on nearly every navigation action). At 32-36px they sit below the 44px bar this audit was directed to apply, increasing mis-tap risk on touch and coarse-pointer devices. Note WCAG 2.2's AA-level 2.5.8 sets a lower 24x24 floor, which these already clear; this is flagged against the owner's explicit 44px working bar for this pass, not as an AA blocker in isolation.
- **Recommendation:** Increase padding (not visual icon/text size) so the hit area reaches 44px.

**[P2] Identical calculator input class string duplicated across sibling files**
- **Location:** `HHDirectContactCalculator.tsx` -- 14 verified occurrences (grep-confirmed) of `"mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-sm font-mono focus:ring-2 focus:ring-sky-500 focus:border-sky-500 focus:outline-none"`. The initial draft additionally reported 8 and 9 occurrences of the same string in `HHFoodWebCalculator.tsx` and `HHInhalationCalculator.tsx` respectively; those two counts were not independently re-verified for this report and should be treated as unconfirmed until re-checked, but the `HHDirectContactCalculator.tsx` count is confirmed.
- **Category:** Implementation Integrity / Theming
- **Impact:** At minimum 14 instances of one un-extracted class string in a single file. Any future focus-ring or design-token adjustment (the owner has explicitly cleared the current palette for replacement) requires editing every call site individually and risks partial or inconsistent application.
- **Recommendation:** Extract to a shared `CALCULATOR_INPUT_CLASS` constant or a small `<CalculatorInput>` wrapper component.

**[P2] Status-tone color string duplicated verbatim across multiple files**
- **Location:** `CalculatorProvenancePanel.tsx`, `CalculatorValueSearchPanel.tsx`, `EvidenceLibrary.tsx`, `CatalogStagingReview.tsx` -- an emerald status-tone Tailwind string and its amber sibling recur near-identically across these files.
- **Category:** Theming
- **Impact:** Functions as an ad hoc, unshared token; any future retheming (the owner has explicitly cleared the current palette for replacement) has to be found and edited identically in every occurrence with no single source of truth.
- **Recommendation:** Extract a single `getStatusToneClasses(status)` utility and import it everywhere this pattern recurs.

**[P2] Zero design-system reuse across the entire surface**
- **Location:** All 27 non-test files under `src/components/matrix-options/`, plus `MatrixDashboard.tsx` and `page.tsx`.
- **Category:** Implementation Integrity / Theming
- **Evidence:** Deterministic grep for `from '@/components/ui` across the target scope returns no matches.
- **Impact:** Every button, badge, input, and panel is a hand-rolled Tailwind string rather than a shared primitive. This is the systemic driver behind the two duplication findings above -- an accessibility or theming fix has to be manually propagated to every occurrence rather than fixed once in a shared component.
- **Recommendation:** Treat `CategorySelector.tsx` / `SubstanceCombobox.tsx` (see Positive Findings) as the in-repo reference for what a shared, accessible primitive should look like here.

**[P2] God components -- 9 files exceed 600 lines, one holds 4552**
- **Location:** `EvidenceLibrary.tsx` (4552 lines, verified via `wc -l`), `SsdWorkbench.tsx` (2216, verified), `MatrixDashboard.tsx` (1269, verified), plus `MatrixMapRightPanel.tsx`, `EcoFoodBSAFCalculator.tsx`, `HHDirectContactCalculator.tsx` (939, verified), `CalculatorValueSearchPanel.tsx`, `HHFoodWebCalculator.tsx`, `CatalogStagingReview.tsx`, all reported over 600 lines in the source review (line counts for these six were not independently re-verified for this report).
- **Category:** Implementation Integrity
- **Impact:** A file this size holding dozens of components means any single-component change requires navigating and re-testing against the whole file's surface area, and increases merge-conflict and review-difficulty risk for a surface flagged as an active worklane.
- **Recommendation:** Flag for a dedicated decomposition pass; out of scope for a single high-impact/low-risk session.

### P3 -- Polish

**[P3] Hardcoded hex colors in SSD chart lines bypass the theme system**
- **Location:** `SsdWorkbench.tsx` -- three Recharts `<Line>`/`<Scatter>` props use raw hex values that duplicate Tailwind color tokens used two lines below in the corresponding legend.
- **Category:** Theming
- **Impact:** Recharts props cannot take Tailwind classes directly (a real library constraint, not a mistake), but the raw hex and the Tailwind-class legend represent the same colors independently and can drift out of sync; neither shifts for dark-mode contrast.
- **Recommendation:** Pull these values from a shared JS-side color constant (or a CSS custom property read via `getComputedStyle`) instead of two independently-typed literals.

**[P3] No `prefers-reduced-motion` handling anywhere in the surface**
- **Location:** Multiple files use `transition-`/`animate-` Tailwind utilities; no matches for `prefers-reduced-motion` or `motion-reduce` anywhere in the reviewed scope.
- **Category:** Accessibility
- **Impact:** Low severity -- the transitions present (color, width, opacity on hover/tab-switch) are simple and non-disorienting, not the flashing/parallax class of motion that harms vestibular-disorder users. Flagged as a gap, not a violation.
- **WCAG/Standard:** 2.3.3 Animation from Interactions (AAA) -- informational only at this severity.
- **Recommendation:** Low priority; add a global `motion-reduce:transition-none` utility only if a more elaborate animation is introduced later.

**[P3] Heading hierarchy skip in the tool-mode shell**
- **Location:** `MatrixDashboard.tsx:1147` (`<h1>Matrix Options</h1>`) to `:1192` (`<h3>{leftSidebarHeading}</h3>`), with no `<h2>` in between.
- **Category:** Accessibility
- **Evidence:** Verified by grepping all `<h1|<h2|<h3` occurrences in the file -- confirmed only `<h1>` at 1147 and `<h3>` at 1192 and 1206, no `<h2>` anywhere.
- **Impact:** Minor -- screen-reader users navigating by heading level see a jump from level 1 to level 3. Does not block task completion.
- **WCAG/Standard:** 1.3.1 Info and Relationships (A), best-practice tier.
- **Recommendation:** Change the sidebar heading to `<h2>` or insert an intermediate section heading.

## Corrections Made to the Starting Draft

- **Dropped/downgraded:** the initial draft's P1 "four icon-only buttons with zero accessible name" (`EvidenceLibrary.tsx:616-621, 766-771, 1804-1809, 2111-2116`) does not hold up against source. Direct inspection of all four locations shows each button renders visible text alongside its icon -- "Clear filters" (616-621), "Clear all" (766-771), "Close" (1804-1809), "Close" (2111-2116) -- which gives each an accessible name from its text content per the accessible-name computation algorithm, independent of the icon. Only one button in this file (`:2816-2824`) is genuinely icon-only, and it already has a `title` attribute (kept below as a real, but lower-severity, P2 finding about `title` being a fragile naming mechanism).
- **Corrected:** the two panel-toggle buttons in `MatrixDashboard.tsx` (`:1164`, `:1167`), cited in the initial draft's touch-target finding, already carry `aria-label` -- they were never nameless. The touch-target/undersized-hit-area finding on these two buttons is retained (P2, downgraded from the initial P1) because their name is not in question, only their size.
- **Reclassified:** the silent-failure write-path finding is raised from P2 to P1, because the QA-review path (`EvidenceLibrary.tsx:1407-1427`) is verified to close the review form unconditionally after a failed write, actively misrepresenting a failed professional-judgment submission as successful -- a functional/trust failure, not only a missing nicety.
- **Discarded (not carried into this report):** the deterministic detector's 14 `gray-on-color` findings and 1 `side-tab` finding. Manual contrast computation on the two most severity-relevant pairs showed the `text-slate-700 on bg-sky-50` family (ratio approximately 9.7:1) and all six `MatrixDashboard.tsx` slate-on-sky pairs are detector false positives -- the flagged text and background classes come from opposite branches of a Tailwind conditional/dark-mode pairing and can never be visually co-active on the same rendered element (verified directly against the `cn(...)` ternary source at `EvidenceLibrary.tsx:3070/4040/4232` and `MatrixDashboard.tsx:1164/1167`). The one finding in this set with a real, computed low-contrast result (`text-slate-400 (#94a3b8)` on `bg-red-50 (#fef2f2)`, approximately 2.3:1, `EvidenceLibrary.tsx:2819`) is scoped to a hover-only state on the button already covered above by the `title`-only naming finding, and could not be confirmed as the true rendered hover contrast without a browser DOM (the route is auth-gated; no session was available for this read-only audit). Given its narrow, unconfirmed, hover-only scope, it is noted here rather than promoted to its own numbered finding.
- **Not independently re-verified for this report** (carried forward from the source review with a lower confidence flag, not dropped): the exact duplication counts for the input-class string in `HHFoodWebCalculator.tsx` (8x) and `HHInhalationCalculator.tsx` (9x), and the exact line counts for `MatrixMapRightPanel.tsx`, `EcoFoodBSAFCalculator.tsx`, `CalculatorValueSearchPanel.tsx`, `HHFoodWebCalculator.tsx`, and `CatalogStagingReview.tsx` in the god-components finding.

## Patterns & Systemic Issues

1. **Silent-failure write contract.** `submitReview` / `submitEvidenceItem` / `setTriageStatus` all return `Promise<boolean>` with the error swallowed before it reaches the component (verified: `EvidenceLibrary.tsx:1410, 1640, 2441`). Every call site inherits the same blind spot. `AddSourceForm.tsx` and `CatalogStagingReview.tsx` show the correct pattern already exists in this codebase -- it was not propagated to `EvidenceLibrary.tsx`.
2. **Copy-paste over componentization.** The verified 14x input-class duplication and the multi-file status-tone duplication are two instances of one root cause: zero shared UI primitives are imported anywhere in this surface (`src/components/ui/` import count: 0), so every new field or badge gets a fresh hand-typed class string instead of a shared one.
3. **Accessibility effort is present but inconsistent, not absent.** The primary tab bar has zero ARIA tab semantics, yet the same directory's `CategorySelector.tsx` and `SubstanceCombobox.tsx` (per the original draft's review) implement sophisticated, documented accessibility patterns. Separately, several buttons flagged in an earlier draft as "nameless" turned out to have visible text labels on inspection -- the surface's accessibility gaps are real but narrower and more specific than a first pass suggested, which argues for verifying each claim against the rendered accessible-name computation (or, ideally, a real screen reader pass) rather than pattern-matching on "icon + button."
4. **Loading-state edge cases aren't tested for the failure branch.** The `MatrixMapSelectionStats.tsx` stuck-forever bug is a success-path-only implementation: the happy path is correct, but the rejection path was never wired to a terminal UI state.

## Positive Findings

- **`MatrixDashboard.tsx`'s tab content is genuinely mount-on-demand** (`renderContent()` switch, `:782`) rather than mounting all 8 heavy tabs simultaneously -- a real, verified performance win given `SsdWorkbench.tsx` (2216 lines) and `EvidenceLibrary.tsx` (4552 lines) alone total nearly 7,000 lines.
- **The two panel-toggle icon buttons in `MatrixDashboard.tsx` (`:1164`, `:1167`) already carry correct `aria-label` attributes** matching their action ("Hide left panel" / "Show left panel", "Hide right panel" / "Show right panel") -- confirmed directly against source, an accessibility pattern worth replicating on the surface's other icon controls.
- **The four buttons initially reported as "icon-only with zero accessible name" are, on verification, already accessible via visible text content** ("Clear filters", "Clear all", "Close" x2) -- this surface's naming discipline on labeled buttons is better than the initial draft credited it for.
- **`AddSourceForm.tsx` and `CatalogStagingReview.tsx` implement the write-error-surfacing pattern correctly** (dedicated `error` state, rendered message, retry-friendly form state) -- this is the in-repo reference to copy into `EvidenceLibrary.tsx`'s four silent-failure call sites.
- **No `<img>` or `<Image>` elements exist anywhere under `src/components/matrix-options/`** (confirmed via grep) -- zero alt-text risk on this surface from source inspection.
- **Decorative slop is confirmed absent**, matching PRODUCT.md's stated expectation: no emoji, gradient text, or glassmorphism found in the reviewed files.

## Files Read / Verified For This Report

`src/components/MatrixDashboard.tsx` (lines 1140-1169, 1192, and full heading grep), `src/components/matrix-options/EvidenceLibrary.tsx` (lines 610-624, 760-774, 1405-1429, 1798-1812, 2105-2119, 2810-2826, plus grep for `submitReview`/`submitEvidenceItem`/`setTriageStatus` and `from '@/components/ui`), `src/components/matrix-options/MatrixMapSelectionStats.tsx` (lines 85-114, 295-304), `src/components/matrix-options/HHDirectContactCalculator.tsx` (input-class grep count), plus `wc -l` line counts for `EvidenceLibrary.tsx`, `SsdWorkbench.tsx`, `MatrixDashboard.tsx`, `MatrixMapSelectionStats.tsx`, `HHDirectContactCalculator.tsx`.

**Not independently verified in this pass** (see "Corrections Made to the Starting Draft" for the confidence flag on each): exact duplication counts for `HHFoodWebCalculator.tsx` / `HHInhalationCalculator.tsx`; exact line counts for `MatrixMapRightPanel.tsx`, `EcoFoodBSAFCalculator.tsx`, `CalculatorValueSearchPanel.tsx`, `HHFoodWebCalculator.tsx`, `CatalogStagingReview.tsx`; the "33 top-level components in one file" count; the `CategorySelector.tsx`/`SubstanceCombobox.tsx` accessibility-pattern claims (carried forward from the source review, plausible and consistent with the rest of the evidence, but not re-read line-by-line for this report).
