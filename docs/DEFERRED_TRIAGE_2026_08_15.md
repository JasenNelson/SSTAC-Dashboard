# Deferred-findings triage (2026-08-15) -- staged for the NEXT batch

Held in the scratchpad deliberately: batch 1 is frozen and gated, and writing this into the
worktree would move the tree again. Copy into `docs/` as part of batch-2 prep, AFTER batch 1
commits.

## Systemic observation (the most valuable output of this triage)

Three separate findings -- the double `katex-display` margin, the EvidenceLibrary print
clipping, and the tab-bar affordance gap -- all trace back to ONE root: `ScrollFadeRegion`
does not own print-safety or class hygiene, so every caller has to remember. Three such gaps
were found in a single day across different callers.

**Recommendation: bake print-safety into `ScrollFadeRegion` itself** (always apply
`print:overflow-visible print:max-w-none` on its scroll container) rather than patching each
call site. That closes the class for every current and future caller in one place. This is
strictly better than the per-caller fix applied in round 4.

## SAFE TO FOLD into the next batch

1. **ScrollFadeRegion caption at 1px overflow.** `ScrollFadeRegion.tsx:196-204` gates the
   caption on `hasOverflow` alone (strict `scrollWidth > clientWidth`), while the fades use a
   1px tolerance via `atEnd`. At exactly 1px overflow both fades are suppressed but the
   caption still says "Swipe to see more" with nothing to reveal.
   FIX: gate the caption on `hasOverflow && (!atStart || !atEnd)`.
   TEST: stub `scrollWidth = clientWidth + 1`, `scrollLeft = 0`, assert the caption is absent.
   Non-vacuous -- today's code renders it.

2. **MathRenderer double `katex-display` margin.** The class lands on BOTH the
   ScrollFadeRegion scroll container and the inner span, so katex.css's
   `.katex-display { margin: 1em 0 }` applies twice; `overflow-x-auto` creates a BFC so the
   margins cannot collapse. ~2em of extra vertical space per display equation.
   FIX: pass only `py-2` to ScrollFadeRegion, leave `katex-display` on the inner span.
   TEST: assert the outer scroll container's className does NOT contain `katex-display` while
   the inner span's does. DOM-structure only -- true px confirmation needs Playwright.

3. **Disclosure-marker sweep -- 6 call sites, not 2.** `ConceptualMatrix.tsx:242` uses the
   full `marker:content-none [&::-webkit-details-marker]:hidden`. Bare `list-none` only at
   `MatrixMap.tsx:1844`, `EvidenceLibrary.tsx:4574`, `SsdWorkbench.tsx:1239,1502,1815`, and
   `DraPublishControl.tsx:404`. WebKit needs the `::-webkit-details-marker` rule, so wherever
   a custom chevron is also drawn the user sees TWO disclosure affordances.
   TEST: structural only (assert every `<summary>` className matches `/marker:content-none/`).
   jsdom cannot render a WebKit marker -- log a follow-up WebKit visual check.

4. **Decision #19 test hardening.** No assertion that the lead is bold/prominent, the detail
   muted, or that lead precedes detail in DOM order. Code is correct today.
   TEST: className regex on both + `compareDocumentPosition` for order.

5. **Decision #10 pill-chrome guard.** `page.test.tsx` checks the gradient and emoji are gone
   but nothing stops `rounded-full`/`backdrop-blur` returning to the hero status line.

6. **Decision #15 `title` assertion.** `SsdWorkbench.tsx:916-919` sets
   `title={mirrorHealthTitle(...)}`; every existing assertion goes through visible/sr-only
   TEXT, so a refactor could drop the attribute silently.

## NEEDS ITS OWN SCOPING

1. **Tab-bar scroll affordance.** The finding's wording is imprecise: the `overflow-x-auto` is
   NOT on the `role="tablist"` div (`MatrixDashboard.tsx:1787`) but on its grandparent toolbar
   row (`:1779`), which also holds the logo block and the mode-switch buttons. So scrolling
   already works; the FADE CUE is what is missing. Adopting ScrollFadeRegion is not a drop-in
   -- that component owns its own scroll container, so this means restructuring the toolbar's
   flex row. Two decisions first: (a) whole toolbar vs tablist-only scroll-fade (tablist-only
   is better UX, bigger change); (b) ARIA -- an extra wrapper between `<nav>` and the tablist
   is valid, but this is a live a11y-sensitive surface with existing roving-tabindex logic
   (`handlePrimaryTabKeyDown`) that must not regress. Verify with axe/AT before shipping.

2. **EvidenceLibrary print safety.** `EvidenceLibrary.tsx:4406` forces `min-w-[640px]`; the
   two ScrollFadeRegion sites (`:4402`, `:4678`) do not carry `math-renderer-table-wrapper`,
   so the print resets at `globals.css:643-699` never match them. Decide per-caller classes vs
   the systemic ScrollFadeRegion fix above. jsdom cannot render `@media print` at all, so this
   needs Playwright `emulateMedia({ media: 'print' })` coverage.

3. ~~**ConceptualMatrix `find()` throw vs placeholder.**~~ **RESOLVED AND SHIPPED in batch 1
   (PR #781). DO NOT RE-DECIDE THIS.** The owner chose the visible placeholder;
   `find()` now returns `Pathway | null` (`ConceptualMatrix.tsx:262-266`) and
   `MissingPathwayCell` (`:286-304`) renders the missing coordinate, so a missing entry
   degrades one cell instead of white-screening the tab. Covered by a dedicated test that
   renders the placeholder directly, falsified two-sided. See
   `BATCH_FIXES_ROUND4.md` section "Render-time throw replaced with a placeholder".
