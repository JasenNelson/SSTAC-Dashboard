# Matrix Options -- Combined Critique Report

Method: dual-agent (A design review, B deterministic evidence, plus an independent technical audit)

Target: `src/app/(dashboard)/matrix-options/page.tsx`, `src/components/MatrixDashboard.tsx`, `src/components/matrix-options/` (32 files, ~28,600 lines). Mode: Operate. Assessment A worked source-only (auth-gated route, browser inspection skipped per scope instruction); Assessment B confirmed the route is auth-gated (curl to `http://localhost:3100/matrix-options` 307s to `/login`) and ran the CLI detector plus a source-level substitute check; the technical audit worked source-only as well. No live DOM was available to any of the three passes -- every finding below is source-verified, not rendered-DOM-verified, and that gap is called out explicitly where it matters (the hover-state contrast finding, the accessible-name spot-check).

---

## Design Health Score (Nielsen's 10)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Zero live regions anywhere in the target set (confirmed independently by the technical audit's file-wide grep, which found the entire 4552-line EvidenceLibrary.tsx has exactly one local `error` state, used only for a Zotero image-load failure -- not a systemic live-region gap fix). Hero results and PASS/FAIL verdicts (HHDirectContactCalculator.tsx:779-799, EcoDirectEqPCalculator.tsx:496-508) recompute silently. Loading states do exist elsewhere (MatrixMapSelectionStats.tsx:115-126), which is why this is a 2, not a 0 or 1. |
| 2 | Match System / Real World | 3 | Domain vocabulary is mostly defined in place (SsdWorkbench.tsx:877-880; MatrixDashboard.tsx:117-123), but the tab bar ships the raw acronym "SSD Workbench" (MatrixDashboard.tsx:238) at the decision point, and one left rail relabels itself three ways -- "CALCULATOR GUIDE" / "PATHWAY / APPROACH" / "CONTEXT" (:701-706). |
| 3 | User Control and Freedom | 2 | Active-filter chips are inert `<span>`s (EvidenceLibrary.tsx:3677-3690); no undo on the QA-status write (:1407-1426). Counter-evidence: FilterPopover honours Escape and click-outside (:691-707), SubstanceCombobox restores the prior label on Escape (:97-102). |
| 4 | Consistency and Standards | 1 | Two incompatible numeric-field contracts on one tab -- EcoFoodBSAFCalculator.tsx:601-608 (`type="number" inputMode="decimal"`) vs. HHDirectContactCalculator.tsx:638 and 12 sibling lines (untyped text input, 172-char class string repeated verbatim). The technical audit independently quantified this as 13x/8x/9x across HHDirectContactCalculator/HHFoodWebCalculator/HHInhalationCalculator (30 total instances) and found the "approved" status tone redeclared across 5-6 files in 2-3 variants. The deterministic scan adds two more confirmed duplication-adjacent facts at the color level: the identical status-tone Tailwind string is byte-for-byte reused at EvidenceLibrary.tsx:398 and a reordered variant at :366, and CatalogStagingReview.tsx:125 uses `emerald-700/300` where the others use `emerald-800/200` -- a fourth variant, not a third. |
| 5 | Error Prevention | 2 | Real guards exist (substance validated before emit, SharedGlobalInputs.tsx:84-88; localStorage restore coerces stale values, MatrixDashboard.tsx:162-206; compile-time category exhaustiveness, CategorySelector.tsx:78-83), but every HH exposure factor is free text with no type/min/max/step -- a negative body weight or a 1e9 ingestion rate flows straight into a screening value shown to three decimal places. |
| 6 | Recognition Rather Than Recall | 2 | The frame-default line plus "Reset to frame default" (HHDirectContactCalculator.tsx:640-648) is the strongest recognition pattern on the surface. Against it: the regulatory frame silently drives which catalog row is flagged policy-default on References & Values (EvidenceLibrary.tsx:3282, `regulatoryFrameId` passed at MatrixDashboard.tsx:1240) and is never rendered on that tab. |
| 7 | Flexibility and Efficiency | 1 | Independently confirmed by both other passes: zero `metaKey`/`ctrlKey` handlers anywhere in the target set. No bulk actions, no export in a 4552-line evidence library. Saved views (EvidenceLibrary.tsx:3696-3760) persist filters only, not substance/frame/view mode. |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained and appropriate for a government-stakeholder surface -- decorative slop is confirmed absent by all three passes independently (no emoji, gradient text, or glassmorphism found). Deductions: selecting one of four categories still renders four tools (MatrixDashboard.tsx:860-941), and the gradient icon tile at :1146 is pure decoration in the most prominent chrome slot. |
| 9 | Error Recovery | 1 | EvidenceLibrary.tsx:1407-1426 -- a failed QA-review submit still runs `setShowForm(false)` and `setNote('')`, destroying the reviewer's typed rationale with no message. The technical audit independently found three more instances of the identical `if (ok) {...}` -no-`else` shape at :1637-1658 (evidence submit), :2439-2448 (triage), and :3485/:3528 (saved views) -- the same silent-write defect recurs at four call sites, not one, all inheriting from `submitReview`/`submitEvidenceItem`/`setTriageStatus` returning a swallowed `Promise<boolean>`. MatrixMapSelectionStats.tsx:101-103 (bootstrap failure) goes to console.error only and, per the technical audit's deeper trace, never terminates -- see the P1 bug below. Counter-evidence the team can do this well: SsdWorkbench.tsx:727-737 and :781-783, and (new from the technical audit) AddSourceForm.tsx and CatalogStagingReview.tsx both implement the correct dedicated-error-state pattern already, just never propagated to EvidenceLibrary.tsx. |
| 10 | Help and Documentation | 3 | A three-tier audience guide (MatrixDashboard.tsx:85-125), an equation Quick Reference with LaTeX plus plain-language gloss (:740-777), per-field provenance, and result-site screening caveats. Deduction: help is tab-local and unsearchable; "SSD Workbench" and "Methodology by pathway" get one sidebar sentence each. |
| **Total** | | **20/40** | **Acceptable (bottom of band) -- significant improvements needed** |

No heuristic scored n/a. Operate mode makes all ten applicable. The design review's scores stand unchanged: the deterministic scan and technical audit corroborate rather than contradict every score, and where they add detail (duplication counts, the four-file silent-write pattern, a fourth status-tone variant) it sharpens the same numbers rather than moving them. **Score correction from cross-referencing the two other passes:** none of the ten scores changed, but heuristic 9's evidence base grew from one call site to four, which is the strongest case in this report for treating "Error Recovery" as a systemic gap rather than a local one.

---

## Design Specificity Verdict

Authored for this product, not category-interchangeable -- but the authorship lives in the domain layer, not the interface layer, and all three passes agree on this split independently.

The domain-specific substance is real and load-bearing: substance + regulatory-frame as global state every pathway calculator inherits (SharedGlobalInputs.tsx:99-219); per-field "Frame default 70 kg (HC PQRA v4.0). Adjustable." provenance with a one-click revert (HHDirectContactCalculator.tsx:640-648); a cyanide double-counting warning named by substance (SharedGlobalInputs.tsx:136-156); a four-pathway applicability badge row (:157-187); a screening-only caveat placed at the result, not in a footer (:795-798). The technical audit's independent read agrees explicitly: "nothing here is generic decorative filler... consistent with PRODUCT.md's claim that decorative slop is largely absent," citing `needs_review` catalog states, HITL provenance, and TEF/RPF weighting as evidence a generic dashboard template could not produce.

Where it goes category-interchangeable is the component substrate, and this is the one place all three passes converge on the identical root cause with independently-derived numbers. `src/components/ui/` holds exactly two files (AdminPageLayout.tsx, UnderConstruction.tsx), neither a primitive -- confirmed by the technical audit's `grep -rl "from '@/components/ui"` returning zero matches across all 27 non-test files. The design review counted the same numeric-field split at 13 occurrences in HHDirectContactCalculator alone; the technical audit extended the count to HHFoodWebCalculator (8) and HHInhalationCalculator (9), for 30 total instances of one un-extracted class string. Independent triangulation, same defect, larger blast radius than the design review alone reported.

**Deterministic scan.** The detector run (`detect.mjs --json` against the three target paths) returned 14 findings across 2 rules, both `warning` severity: 12 `gray-on-color` hits in EvidenceLibrary.tsx and 6 in MatrixDashboard.tsx (some lines carry more than one), plus 1 `side-tab` hit at MatrixDashboard.tsx:792. Assessment B then hand-verified contrast using the actual Tailwind hex values and the WCAG relative-luminance formula rather than trusting the heuristic at face value, and the result matters for how this report reads the design review's aesthetic score:

- **9 of the 14 flagged pairs are confirmed false positives**, and the reasoning is specific, not hand-waved: `text-slate-200 on bg-sky-50` at EvidenceLibrary.tsx:3070/4040/4232 pairs a `dark:`-only text color with a light-mode-only background from the same `cn()` string -- the two classes can never be visually co-active. The six `MatrixDashboard.tsx:1164`/`:1167` pairs are the same failure mode one level up: a ternary where `bg-sky-50` only exists in the `showLeftPanel === true` branch (paired with `text-sky-600`, not slate) and `text-slate-400`/`hover:text-slate-600` only exist in the `false` branch (paired with `hover:bg-slate-100`, not sky-50). The detector flattened both ternary branches into a cross-product that never renders. This is a real limitation of static class-pair detection worth naming precisely, not a knock on the tool: it cannot see conditional branch exclusivity, only string co-occurrence.
- **1 of the 14 is confirmed real and below AA**: `text-slate-400 (#94a3b8) on bg-red-50 (#fef2f2)` at EvidenceLibrary.tsx:2819 computes to ~2.3:1 against a 4.5:1 requirement, verified by direct hex-to-luminance calculation, not by re-trusting the heuristic label. It is scoped to a `hover:bg-red-50` state on a remove-candidate button, and per Assessment B's own admission, whether `hover:text-red-600` on the same element actually overrides the base `text-slate-400` before the low-contrast moment renders is unverifiable without the live DOM -- so this finding is real-as-written but unverified-as-rendered. Cross-referencing forward: this is the same button the technical audit separately flagged (P2, EvidenceLibrary.tsx:2816-2824) for having `title` as its *only* accessible-name mechanism instead of `aria-label` -- two independent passes landed on the identical few lines from two different angles (contrast vs. accessible name), which is a stronger signal than either finding alone.
- The `side-tab` finding at MatrixDashboard.tsx:792 (`border-l-4` on a `bg-sky-50` callout card) was confirmed real via direct source read but is a single, low-consequence styling occurrence, not a duplicate-pattern signal.

Net effect on the design review's score: **no change to heuristic 4 or 8.** The false positives don't reduce the duplication finding (which independently strengthened via the technical audit's 30-instance count); the one real contrast issue is minor and hover-scoped, not a base-render failure, so it does not move heuristic 8 off 3. What it does confirm is that this codebase's dark-mode/light-mode class pairing is disciplined enough that a naive static scanner mostly generates noise here -- itself a mild positive signal the design review's unanchored read did not have visibility into.

**Browser evidence.** Unavailable to all three passes -- the route requires an authenticated session and no credentials/cookie import was performed (out of scope for a read-only audit). Assessment B's partial substitute (`grep` for `<img>`/`<Image>` across the target directory) found zero image elements, so there is no alt-text risk surface to report on this specific tab set from source alone.

Biggest missed opportunity for product character, unchanged from the design review: the surface never states what working set you are in. Substance, regulatory frame, and pathway are the three facts that make every number on screen mean something, and they are visible only on the Calculator tab. A persistent working-set bar across all eight tabs would be the most product-specific piece of chrome this dashboard could have, and it is absent.

---

## Overall Impression

The domain modeling is genuinely good and all three independent passes agree on that without prompting each other -- this is not a case of one enthusiastic reviewer inflating the "authored for this product" verdict. What drags the score down is entirely on the implementation-discipline side: zero shared primitives, one silent-write bug pattern repeated across four call sites in the same file, a top-level 8-tab navigation with no ARIA tab semantics at all, and one confirmed functional bug (an infinite silent retry loop, caught independently and in more depth by the technical audit) that leaves a UI panel permanently claiming "Calculating..." Nothing here requires new design thinking; it requires extracting what the codebase has already proven it knows how to build correctly (CategorySelector.tsx, SubstanceCombobox.tsx, SsdWorkbench.tsx's error handling, AddSourceForm.tsx's write-error pattern) and applying it to the other 25 files that don't yet have it. The biggest single opportunity is closing the gap between the two files that do accessibility right and the eight-tab shell that does it not at all.

---

## What's Working

1. **CategorySelector.tsx is a reference-quality ARIA radiogroup and should be the in-repo model for every other interactive control on this surface.** Full roving tabindex, arrow cycling that skips disabled options, Home/End (:140-173), explicit Enter/Space handling with a documented reason (:126-138), a defensive fallback (:110-120) that keeps exactly one tab stop even when handed a disabled active category, and a compile-time exhaustiveness guard (:78-83) so a fifth category breaks the build instead of silently dropping a button. The technical audit independently names this same file as "genuinely exemplary" and recommends it as the pattern to copy into the tab-bar fix -- convergent, not duplicated, praise.

2. **The frame-default provenance pattern is the most product-specific interaction on the surface.** HHDirectContactCalculator.tsx:640-648 (repeated for seven exposure factors) names the value, names the source, states it is adjustable, and offers a one-click revert that appears only once the field has diverged. It makes "real provenance over illustrative content" tangible at field level, and both other passes leave it untouched -- no contradicting evidence, no false-positive risk.

3. **Where error handling is done right, it is done very right, and now there are three confirmed examples instead of one.** The design review found SsdWorkbench.tsx:727-737 and :781-783. The technical audit independently added AddSourceForm.tsx:96-364 and CatalogStagingReview.tsx:229-300 as a second and third instance of the same correct shape (dedicated `error` state, rendered message, retry-preserving `catch`). Three files out of thirty-two do this correctly, which reframes the fix for the P1 below from "teach the codebase a new pattern" to "propagate an existing, proven one."

---

## Priority Issues

**[P0] Methodology side-tabs are mouse-only -- a keyboard user cannot switch methodology documents**
- Evidence: MatrixDashboard.tsx:620-634. The three `JURISDICTIONAL_SIDE_TABS` render as `<li onClick={...}>` with no `role`, no `tabIndex`, no `onKeyDown`.
- Why it matters: on "Methodology by pathway," a keyboard-only or screen-reader user is permanently locked to "Ecological: EqP & AVS" and cannot reach the BSAF or Human Health methodology documents at all. PRODUCT.md ranks accessibility as must-fix; this is a functional lockout, not a polish gap, and it sits two files away from CategorySelector.tsx doing the identical interaction correctly.
- Fix: replace each `<li>` with `<button type="button">` inside a `role="tablist"` container, add `role="tab"` + `aria-selected` + `aria-controls`, give the content pane `role="tabpanel"`, and reuse CategorySelector's roving-tabindex handler verbatim. No state, layout, or styling change required.
- Suggested command: `/impeccable harden`

**[P0/P1] The entire 8-tab primary navigation has no ARIA tab semantics -- both the design review and the technical audit flagged this independently, at different severities**
- Evidence: MatrixDashboard.tsx:1149-1158, `TABS.map` renders plain `<button onClick>` inside a `<nav>`. Zero `role="tab"`, `role="tablist"`, or `aria-selected` anywhere in the file (confirmed by grep in the technical audit).
- Why it matters: this is the top-level navigation for all eight sections of the whole surface -- Guide, Conceptual Model, Jurisdictional Frameworks, TWG Review, Interactive Map, Calculator, SSD Workbench, References. A screen-reader user hears a flat "button, button, button" with no role, no position ("tab 3 of 8"), and no selected-state announcement. The technical audit rates this P1; the design review's persona walkthrough for Sam treats it as a hard block equivalent to a P0. Synthesis judgment: **treat as P0-adjacent** -- it is not a total lockout the way the side-tabs are (content is still reachable via focus order), but it is the single highest-leverage accessibility fix on the surface because it governs every other tab's discoverability.
- Fix: `role="tablist"` on the `<nav>`, `role="tab"` + `aria-selected={activeTopTab === tab}` + `aria-controls` per button, `role="tabpanel"` on the content region, left/right arrow-key roving-tabindex -- again, CategorySelector.tsx is the in-repo template.
- Suggested command: `/impeccable harden`

**[P1] A failed QA-review submit silently destroys the reviewer's written rationale -- and this is one of four identical silent-write call sites, not one**
- Evidence: EvidenceLibrary.tsx:1407-1426 (`submitReview`), independently found by the technical audit to recur at :1637-1658 (`submitEvidenceItem`), :2439-2448 (`setTriageStatus`), and :3485/:3528 (saved views). All four inherit from helpers returning a swallowed `Promise<boolean>`; every call site branches only on the success path.
- Why it matters: this is the human-in-the-loop write path on a catalog whose trustworthiness is the product's stated currency. On an RLS denial, network drop, or outage, the reviewer watches the form close as if it worked, their typed justification is gone, and no signal indicates the status did not change. That the identical shape recurs four times in one file means this isn't a one-off oversight -- it's an unenforced contract (`Promise<boolean>` with the error discarded before it reaches the component), and grepping the whole 4552-line file finds exactly one local `error` state, used only for a Zotero image-load failure. The pattern to copy already exists twice in-repo (AddSourceForm.tsx, CatalogStagingReview.tsx) and just never propagated here.
- Fix: branch on `ok` at all four call sites. On failure, keep the form/state open, preserve the user's input, and render an inline `role="alert"` naming the failure and the retry path. Port the AddSourceForm.tsx pattern rather than inventing a new one.
- Suggested command: `/impeccable harden`

**[P1] Zero live-region coverage -- results, verdicts, and failures are never announced**
- Evidence: no `aria-live`, `role="status"`, or `role="alert"` in EvidenceLibrary.tsx (4552 lines) or any of the six calculators' result blocks. Specific silent surfaces: HHDirectContactCalculator.tsx:770-777 (error box) and :779-799 (hero result); EcoDirectEqPCalculator.tsx:496-508 (PASS/FAIL verdict pill); EvidenceLibrary.tsx:3520-3527 (saved-view limit rollback). Across all 32 files, 14 live-region attributes total, 8 of them concentrated in CatalogStagingReview.tsx alone.
- Why it matters: the entire purpose of these calculators is that changing an input changes a number. A screen-reader user changes body weight and gets nothing back -- no new value, no PASS-to-FAIL flip, no error. Colour is not the failure mode here (PASS/FAIL is already textual, correctly); silence is.
- Fix: `role="status"` on the hero result container and verdict pill in all six calculators; `role="alert"` on each calculator's error box; a single `aria-live="polite"` region in EvidenceLibrary for save/QA/filter outcomes. Purely additive, no layout risk.
- Suggested command: `/impeccable harden`

**[P1] A failed bootstrap calculation gets permanently stuck on "Calculating..." and silently retries forever -- confirmed by two independent passes tracing the same code to the same root cause**
- Evidence: MatrixMapSelectionStats.tsx:71-112 (queue predicate + effect) and :101-103 (`.catch`), :300-301 (display fallthrough). `bootstrapUcls(item.values).catch(err => console.error(...))` never writes `bootstrapCache` for the failed key; `.finally()` deletes the `calculatingKeys` flag without writing a terminal state, so the queue predicate (`!bootstrapCache[cacheKey] && !calculatingKeys[cacheKey]`) is true again on the next render and the effect re-dispatches the same failing calculation indefinitely. The render condition `isBootstrap && (isCalculating || !bData)` stays true forever, so the card is permanently "Calculating..." with no error, no retry affordance, and no visible signal that the value will never arrive. **Both the design review and the technical audit independently traced this to the exact same file and line range** (the design review's original starting evidence had misattributed the symptom to SsdWorkbench.tsx; both later passes correct that attribution and confirm SsdWorkbench actually handles its failures well -- :727-737 and :781-783 are cited by both as the good counter-example). This double-correction is itself useful signal: the bug is real and precisely located, not a guess propagated from a stale starting brief.
- Why it matters: the panel lies about being busy forever while burning a worker in an unbounded retry loop, and the only diagnosis path is the browser console.
- Fix: add a `failedKeys` set written in the `.catch`, include `!failedKeys[cacheKey]` in the queue predicate, and render "Could not compute -- retry" with a retry button instead of "Calculating...".
- Suggested command: `/impeccable harden`

**[P2] Two incompatible numeric-field contracts render on the same tab, 30 instances deep**
- Evidence: EcoFoodBSAFCalculator.tsx:601-608 (`type="number" inputMode="decimal" step="0.01"`, proper `htmlFor`/`id`) vs. the untyped-text-in-wrapping-label pattern at HHDirectContactCalculator.tsx:638 and 12 sibling lines (13 total), HHFoodWebCalculator.tsx (8), HHInhalationCalculator.tsx (9) -- 30 total instances of one 172-character class string, confirmed by the technical audit's independent count extending the design review's single-file tally.
- Why it matters: on a phone, the Eco calculator raises a numeric keypad and the HH calculator raises a full alphabetic keyboard for the same class of quantity, stacked on one scroll. It also strips browser-level numeric validation from exactly the fields that feed a regulator-facing screening value.
- Fix: extract a `NumericField` primitive (label, id, unit suffix, value, onChange, optional frame-default line and reset button) into `src/components/ui/`, standardise on `type="number" inputMode="decimal"` plus `step`/`min`, and replace all 30 call sites. Same pass should extract the status-tone map (now confirmed as 4 variants across 6 files, not 3).
- Suggested command: `/impeccable document` (inventory the call sites first, given the count), then `/impeccable polish`

---

## Persona Red Flags

Personas per the reference selection table: Dashboard/admin and Data-heavy/analytics both map to Alex + Sam; the Calculator tab is Form-heavy, which adds Jordan.

**ALEX (Impatient Power User)** -- a consultant deriving five substances before a meeting
- No keyboard shortcuts exist anywhere -- confirmed independently by the technical audit's grep (zero `metaKey`/`ctrlKey` handlers across the target set).
- Switching substance is a 3-interaction combobox round trip (SubstanceCombobox.tsx:157-164 clears the input on click, so the current selection vanishes and must be retyped), repeated per substance. No recent-substances list, no multi-substance compare.
- No export and no bulk action anywhere in a 4552-line evidence library.
- Saved views (EvidenceLibrary.tsx:3696-3760) persist filters only -- not substance, frame, or view mode -- so restoring a "view" does not restore his working set.
- On every substance change he re-scrolls past two calculators he is not using (MatrixDashboard.tsx:904, :926) to reach the one he is.
- Verdict: he completes the core derivation at roughly triple the interaction count he expects, and keeps his own spreadsheet as the real workspace.

**SAM (Accessibility-Dependent, screen reader + keyboard only)**
- Hard block: cannot switch methodology documents at all (MatrixDashboard.tsx:620-634) -- one third of the surface's content is unreachable.
- The eight-tab top nav is plain buttons in a `<nav>` with no tab semantics (confirmed independently by the technical audit as P1) -- current tab is announced only through visual styling.
- Nothing is announced: a new body weight produces no live-region update on the result, error, or verdict pill.
- Five form controls are `sr-only`-clipped inside styled labels (BackgroundAdjustment.tsx:214, :231; EcoDirectEqPCalculator.tsx:382; EcoFoodBSAFCalculator.tsx:759; SsdWorkbench.tsx:987) with not a single `focus-within` rule in the directory -- a low-vision keyboard user cannot see where focus lands on those controls.
- Focus styling is inconsistent: only 3 of 32 files use `focus-visible`, while 7 strip the UA outline with `focus:outline-none` 43 times.
- Verdict: fails on the primary flow. Given PRODUCT.md's must-fix accessibility ruling, the side-tab block and the silence are release-blocking, not polish -- and the technical audit's independent P1 on the same tab bar, arrived at without seeing this persona writeup, corroborates the severity rather than just the existence of the gap.

**JORDAN (Confused First-Timer -- a TWG member opening the Calculator for the first time)**
- Lands on "The Guide" with an eight-tab bar including "SSD Workbench" (MatrixDashboard.tsx:238); "SSD" is not expanded until he has already committed to the tab.
- Picks one of four categories and gets four calculators, with no explanation that the extra two are deliberately independent of his choice -- the code comment explaining why (MatrixDashboard.tsx:898-918) is not user-facing.
- Thirteen unlabelled-by-unit-context free-text boxes in a row, none validating, no example, no range.
- If he clears a field, the aggregate error box (:770-777) tells him something is wrong but not which field.
- Genuine mitigations: the three-tier audience guide defaults to "General" and is well written; frame-default lines show provenance; screening-only caveats set honest expectations.
- Verdict: he gets a number, but not confidence in it, and the two unrequested calculators will make him think he mis-set something.

---

## Minor Observations

- Active-filter chips (EvidenceLibrary.tsx:3677-3690) are non-interactive `<span>`s; making each dismissible is a small, high-payoff change.
- FilterPopover (EvidenceLibrary.tsx:711-730) lacks `aria-haspopup`/`aria-controls` and does not return focus to the trigger on Escape.
- The gradient icon tile (MatrixDashboard.tsx:1146) is the only purely decorative element left on the surface, in the most prominent chrome slot.
- One left rail carries three different heading vocabularies (MatrixDashboard.tsx:701-706).
- Four icon-only buttons in EvidenceLibrary.tsx have zero accessible name at all (:616-621 clear filter, :766-771 clear-all, :1804-1809 close, :2111-2116 close) -- flagged only by the technical audit, not by the design review or the detector; a real gap the deterministic scan's ruleset does not cover.
- A fifth icon-only button (EvidenceLibrary.tsx:2816-2824, "remove promoted candidate") has an accessible name, but only via `title`, which is mouse-hover-only and fragile under forced-colors/high-contrast modes -- and per the contrast section above, the same button's hover state computes to ~2.3:1, so this one control carries two independent, corroborating findings from two different passes.
- Touch targets across the tab bar and several icon buttons (MatrixDashboard.tsx:1153-1157, :1164, :1167; EvidenceLibrary.tsx:619, :1807, :2114) sit at 32-36px, under the 44px bar the technical audit was asked to check against (informational relative to WCAG's own 24px AA floor, which most already clear).
- No `prefers-reduced-motion` handling anywhere in the 11 files using `transition-`/`animate-` utilities -- low severity, since the transitions found are simple color/width/opacity, not the disorienting class of motion.
- Heading hierarchy skips from `<h1>` (MatrixDashboard.tsx:1147) to `<h3>` (:1192) with no `<h2>` between.
- Three raw hex colors in SsdWorkbench.tsx's chart lines (:1938, :1950, :1962) duplicate Tailwind values used two lines below for the corresponding legend entries -- a drift risk on any future retheme, not a current defect.
- SubstanceCombobox highlights the active option with background colour only; add a left-border marker for low-vision mouse users who don't get the `aria-activedescendant` benefit.
- The 8-tab bar sits in an `overflow-x-auto` container with no scroll affordance, and the panel-toggle buttons scroll off-screen with it.

---

## Questions to Consider

- Given that heuristic 9 (Error Recovery) now has four confirmed silent-write call sites in one file rather than one, is the fix better scoped as "patch four call sites" or as "fix the shared `Promise<boolean>` contract those four helpers all return from" -- the latter prevents a fifth call site from repeating the same mistake next quarter.
- The tab-bar ARIA gap and the side-tab keyboard gap are both fixable with the same CategorySelector.tsx pattern reused three times in one file. Is it worth extracting that pattern into a shared `Tabs` primitive in `src/components/ui/` as part of this fix, given the design review's broader finding that the near-empty `src/components/ui/` is the root cause of the duplication problems elsewhere on this surface?
- The bootstrap-stuck-forever bug (MatrixMapSelectionStats.tsx) was independently found and correctly re-attributed by two separate passes after a stale starting brief pointed at the wrong file. Is a similar re-verification pass worth running against any other "confirmed" starting-evidence claims still circulating for this surface, given how easily the original misattribution could have gone unchallenged?
