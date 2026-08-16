# UI Batch -- Round 2 Adversarial Review Fixes (2026-08-15)

Branch: `feat/mo-design-batch-20260815`. No commit made. Companion to
`docs/BATCH_FIXES_ROUND1.md` (whose own fixes are corrected here) and
`docs/UI_DECISIONS_2026_08_15.md` (the owner decision record).

Round 1's failure mode was fixing the exact location named and stopping, and
three of its fixes created new defects. This pass fixes the CLASS in each case
and states, per fix, what the fix could break.

---

## P1-1 -- systemic undeclared content deletion (FIXED)

### The class

Round 1 restored one deleted word ("Indigenous"). The real defect was that a
rewrite of user-facing copy dropped substance while claiming to only change
presentation. The fix therefore had to be: audit EVERY copy change in the batch
against `HEAD` and give each one an explicit disposition.

### Full inventory of copy changes in the batch

Method: `git diff HEAD` over all 18 modified source files, reading every changed
line that renders as user-visible text.

| # | File | Change | Disposition |
|---|------|--------|-------------|
| 1 | `ConceptualMatrix.tsx` Q1 | "Protects benthic invertebrates dwelling within the sediment matrix. Primary methodologies include Equilibrium Partitioning (EqP) and Acid Volatile Sulfide (AVS) normalization." -> "Protects tiny creatures living in the mud." + "Equilibrium Partitioning (EqP), Acid Volatile Sulfide (AVS) normalization" | **RESTORED.** Detail line now reads "Receptor: benthic invertebrates dwelling within the sediment matrix. Methods: ...". Plain lead retained (reworded to "the small animals that live in the mud itself"). |
| 2 | `ConceptualMatrix.tsx` Q2 | Lost "higher trophic-level", "bioaccumulative" | **RESTORED** in the detail line ("higher trophic-level aquatic life and wildlife exposed to bioaccumulative contaminants"). |
| 3 | `ConceptualMatrix.tsx` Q3 | Lost "acute", "chronic", "wetted", "recreational", "occupational" | **RESTORED**: "Acute and chronic exposure via dermal absorption of wetted sediments and incidental ingestion during recreational or occupational activities." |
| 4 | `ConceptualMatrix.tsx` Q4 | Lost "human populations reliant on aquatic environments for sustenance"; "Indigenous" restored in round 1 | **RESTORED** in full. |
| 5 | `page.tsx` hero | Deleted "Focused on the Matrix Sediment Standards Derivation Options and BN-RRM implementation." | **RESTORED** as a tightened muted line: "Active workstreams: Matrix Sediment Standards Derivation Options and BN-RRM implementation." (decision #10 allows tightening, not deletion). |
| 6 | `page.tsx` hero | Rocket emoji removed from status pill | **JUSTIFIED.** Decision #10 ("no emoji, no pill") plus the L0 plain-ASCII rule. No information lost. |
| 7 | `page.tsx` hero | "Phase 2 - Foundational..." -> "Phase 2 -- Foundational..."; trailing period added to the framework sentence | **JUSTIFIED.** Punctuation only. |
| 8 | `MatrixDashboard.tsx` | Deleted "Currently reviewing the {activeSideTab} methodology. Scroll to locate specific regulatory derivations within the document below." | **JUSTIFIED.** Decision #21 is "Option A -- Delete it", naming this exact `bg-sky-50 ... border-l-4 border-sky-500` banner. Explicitly authorised. |
| 9 | `SsdWorkbench.tsx` | Pill "ECOTOX mirror approx 582,125 rows" removed from the chart header | **JUSTIFIED, substance retained.** Decision #14 Option C moves the corpus size into the verification panel; it now reads "Full ECOTOX mirror (reference): approx. 582,125 rows". The number is still on screen. |
| 10 | `EvidenceLibrary.tsx` | Three StatusBadge pills replaced by a muted plain-text line (`humanizeCatalogLabel`) | **JUSTIFIED, substance retained.** Decision #6 Option A ("promote one, demote three"). All four status values still render. |
| 11 | `ProjectPhases.tsx` | Numbered circles (1, 2) replaced with dots; rocket / check emoji removed; "Active"/"Complete" chips added | **JUSTIFIED.** Decision #17 as resolved by the owner. The ordinals carried no meaning (owner's own words in the decision record: "meaningless numbered circles"); the phase state they implied is now stated explicitly by the chips. |
| 12 | `MatrixMap.tsx` | "Surveyed only" checkbox moved from the legend to the sample-count header | **JUSTIFIED.** Decision #13. Label unchanged, nothing deleted. |

No other user-facing string in the batch was removed or replaced. There are no
remaining silent deletions.

### Tests added

- `ConceptualMatrix.test.tsx` -- "keeps the receptor and exposure terminology in
  the technical detail lines": asserts all 10 terms (benthic, invertebrate,
  bioaccumulative, trophic, Acute, chronic, wetted, recreational, occupational,
  Indigenous) appear in the rendered text.
  - **Two-sided falsification, verified by neutralisation:** replacing the Q1
    detail line with "Receptor: small animals in the sediment." made the test
    fail on `expected ... to contain 'benthic'`; restoring made it pass. It reads
    `container.textContent`, so a term surviving only in a comment or class name
    cannot satisfy it.
- `page.test.tsx` -- "names both active Phase 2 workstreams ... in the hero":
  scoped via a new `data-testid="landing-hero-workstreams"`.
  - **Neutralisation verified:** replacing the sentence with "the two active
    workstreams." fails; restoring passes.
  - Scoping matters: `ProjectPhases` further down the same page ALSO names both
    workstreams, so an unscoped `getByText` both threw on multiple matches and
    would not have guarded the hero specifically. See "What the reviewer got
    wrong" below.

**What this could break:** the terminology test pins wording. A future
owner-approved rewording of a detail line must update the term list in the same
PR rather than deleting the assertion.

---

## P2-1 -- print fix ineffective and regressive (FIXED)

`src/app/globals.css` print block.

Verified directly in `node_modules/katex/dist/katex.css`:
- line 1210-1213: `.katex-display { display: block; margin: 1em 0; text-align: center }`
- line 1215-1219: `.katex-display > .katex { display: block; text-align: center; white-space: nowrap }`
- line 176-183: `.katex .base { position: relative; display: inline-block; white-space: nowrap; width: min-content }`

Fix now targets those elements explicitly:

```css
.katex-display,
.katex-display > .katex,
.katex-display > .katex > .katex-html {
  overflow: visible !important;
  max-width: none !important;
  white-space: normal !important;
  text-align: left !important;
}
.katex-display .base {
  white-space: normal !important;
  width: auto !important;
}
```

Both halves of the finding are addressed: the nowrap declarations that actually
exist are neutralised on the elements that carry them (plus `width: min-content`
on `.base`, which would otherwise collapse a now-wrappable box to its narrowest
possible width), and the centring is neutralised so residual overflow runs in one
direction only -- the printed page keeps the START of the derivation.

**Correction to the finding's diagnosis:** this was an element-targeting miss,
not a specificity miss. `white-space` set directly on a child always beats a
value inherited from `.katex-display`, regardless of selector weight, and
`!important` already outranks katex's plain declarations at any specificity. The
prescribed remedy ("sufficient specificity") happens to work because naming the
descendants is what was actually needed.

**What this could break:** print only (inside `@media print`), so no screen
regression is possible. KaTeX display math is not designed to line-break, so on
a genuinely unbreakable equation the result is left-anchored clipping rather than
true wrapping -- strictly better than the previous both-ends clipping, but not a
guarantee of full legibility for extreme cases. Not verifiable in jsdom; needs a
real print preview.

---

## P2-2 -- fadeFrom covered 3 of 5 call sites (FIXED, all 12 sites)

`MathRenderer` now takes and forwards a `fadeFrom` prop to BOTH of its
`ScrollFadeRegion` usages (the table wrapper and the `katex-display` wrapper).
Every consumer was enumerated with grep and given its real surface:

| Call site | Surface | fadeFrom |
|---|---|---|
| `MatrixDashboard.tsx` equation drawer | `bg-white dark:bg-slate-950` | `from-white dark:from-slate-950` |
| `MatrixDashboard.tsx` jurisdictional panel | `bg-white dark:bg-slate-950` | `from-white dark:from-slate-950` |
| `MatrixDashboard.tsx` Guide cards (x3) | `bg-white dark:bg-slate-800` | `from-white dark:from-slate-800` |
| `TWGReviewPortal.tsx` | `bg-white dark:bg-slate-950` | `from-white dark:from-slate-950` |
| `JermilovaReviewPortal.tsx` | `bg-white dark:bg-slate-950` | `from-white dark:from-slate-950` |
| `BackgroundAdjustment.tsx` | `bg-white dark:bg-slate-900` | `from-white dark:from-slate-900` |
| `EcoDirectEqPCalculator`, `EcoFoodBSAFCalculator`, `HHDirectContactCalculator`, `HHFoodWebCalculator`, `HHInhalationCalculator` | `bg-slate-50 dark:bg-slate-800/50` | `from-slate-50 dark:from-slate-800/50` |

`Phase2GanttChart`'s own `ScrollFadeRegion` sits on `bg-white dark:bg-slate-900`,
which is the component default; left explicit-free deliberately.

**What this could break:** nothing functional -- the prop is optional and the
default is unchanged. The residual risk is drift: a NEW MathRenderer call site
on a non-default surface will silently inherit the wrong fade. The prop's
docblock says so explicitly.

---

## P2-3 -- effect-dependency fix introduced a staleness bug (FIXED)

`ScrollFadeRegion.tsx`. Round 1's `[]` deps plus a container-only
`ResizeObserver` never re-checked on content change, because a width-constrained
container's own border box does not change when its content grows -- only
`scrollWidth` does.

**Approach chosen:** observe the CONTENT as well as the container.
1. `ResizeObserver` observes the container AND its first element child (the
   table / grid / equation that actually resizes).
2. A `MutationObserver` on the container (`childList`, `subtree`,
   `characterData`) re-points the child observation when React swaps the child
   out, and re-checks overflow for content changes that do not resize the
   observed child's own box.

**Why this and not the alternatives:** `[children]` (round 1's original) rebuilt
both observers on every parent render -- per-render churn, the thing round 1 was
trying to remove. A `requestAnimationFrame` poll is unbounded work for a passive
affordance. The chosen pair is event-driven and bounded.

**No feedback loop:** the `MutationObserver` is scoped to the scroll container;
the gradient and caption it can toggle render as siblings OUTSIDE that container.

**Test added** -- `ScrollFadeRegion.test.tsx`, "re-checks overflow when the
CONTENT changes":
- Negative half: asserts no caption while content fits.
- Positive half: after a content-only rerender (no container resize; jsdom fires
  no ResizeObserver at all) the fade and caption must appear.
- **Neutralisation verified:** stripping the `MutationObserver` block back to
  container-only observation makes the test fail; restoring makes it pass.

**What this could break:** `MutationObserver` fires for every DOM change under
the region, and `checkOverflow` reads `scrollWidth` -- a forced layout read. On a
very large table with high-frequency subtree churn this is more layout work than
before. It is one read per mutation batch and `setHasOverflow` is a no-op when
the boolean is unchanged, so React does not re-render; acceptable, but worth
knowing if a future profile shows layout thrash on the Values table.

---

## P2-4 -- matchMedia listener fights the user (FIXED)

`MatrixMap.tsx`. Added `legendUserOverrideRef`; the breakpoint handler returns
early once it is set.

The latch is set from the summary's `onClick`, NOT from `<details onToggle>`:
`toggle` also fires when React updates the `open` attribute programmatically, so
latching there would mark the initial matchMedia-driven collapse as a "user
choice" and disable the breakpoint default immediately.

**Tests added** -- two, deliberately paired:
- Control/negative: with no user toggle, a breakpoint crossing still drives the
  disclosure. **Neutralisation verified:** deleting the `addEventListener` line
  makes this test fail.
- Positive: after a manual toggle, two further breakpoint crossings leave the
  disclosure unchanged. **Neutralisation verified:** deleting the
  `if (legendUserOverrideRef.current) return;` guard makes this test fail.
  Asserted as "unchanged across the crossing" rather than a fixed value, so it
  does not depend on whether jsdom's summary-activation behaviour flipped the
  disclosure on click.

**What this could break:** the latch is per-mount and never resets, so a user
who toggles once on desktop and then genuinely wants the mobile default back
must toggle again. That is the intended trade (user intent outranks a heuristic),
but it is a behaviour change worth naming.

---

## P2-5 -- value column overlaps its neighbour (FIXED)

`EvidenceLibrary.tsx`. Both halves changed:
- Column width `w-[9%]` -> `w-[16%]`. Compensated within the same colgroup
  (Review status 20 -> 16, Applicability 15 -> 13, Sources 15 -> 14); the widths
  still total exactly 100%.
- Cell `whitespace-nowrap` -> `whitespace-normal break-words`, plus a `title`
  carrying the unbroken value. `break-words` only breaks a token that genuinely
  cannot fit, so ordinary values stay on one line and an unusually long unit
  costs a second line instead of an overlap.

**Other columns checked for the same arithmetic:** the value cell was the ONLY
cell in either table setting `whitespace-nowrap` (verified by grep; the other
hit is a filter chip, not a table cell). Every other column already wraps, so
none can overflow its box under `table-layout: fixed`.

**Test added** with a `data-testid="evidence-current-value-cell"` hook.
**Two-sided falsification, both halves verified independently:** restoring
`whitespace-nowrap` fails the test; separately, restoring `w-[9%]` (leaving the
wrapping intact) also fails it.

**What this could break:** the Review status and Applicability columns each lost
2-4 percentage points, so their text wraps onto more lines at narrow widths.
jsdom has no layout engine, so the actual pixel result of both the fix and this
side effect needs a browser check.

---

## P3s

1. **Chevrons never rotate (FIXED, all 3 sites).** `MatrixMap.tsx` legend,
   `SsdWorkbench.tsx` endpoint filters, `EvidenceLibrary.tsx` row Details. Each
   `<details>` got the `group` class and each `ChevronDown` got
   `transition-transform duration-200 group-open:rotate-180`. These are the only
   three summary chevrons the batch added.
   **Could break:** nothing behavioural; `group-open:` requires the `group` class
   on the `<details>`, which was added in the same edit in all three cases.

2. **`SsdWorkbench.test.tsx` weakened assertions (FIXED).** Added a
   `getVisibleTexts(matcher)` helper that filters out any node inside `.sr-only`,
   and routed all 8 weakened `getAllByText(...)[0]` assertions through it, so
   they once again distinguish "the visible status is present" from "only the
   sr-only copy is present".
   **Neutralisation verified:** blanking the VISIBLE mirror-health label (leaving
   the sr-only copy intact) fails 3 tests. Under round 1's `getAllByText(...)[0]`
   they would all still have passed.

3. **Fabricated regulatory value REMOVED.** `evidenceLibraryFixture.ts`: the
   "Zinc oral slope factor - Health Canada" row, value 1.0, attributed to the
   real source id `src-health-canada-trv-v4-2025`, is replaced by
   `fixture_substance_alpha` ("Fixture Substance Alpha oral slope factor
   (synthetic, superseded)") attributed to a new synthetic source record
   `src-fixture-synthetic-authority-0000` (publisher "Synthetic Fixture Authority
   (does not exist)", no URL). The `applicability` text now opens with "SYNTHETIC
   TEST FIXTURE - not a regulatory value". No real authority is attributed an
   invented value anywhere in the fixture.
   **Could break:** the one test that referenced the old display name was updated
   in the same pass; no other test referenced the row.

4. **`EvidenceLibrary.test.tsx` superseded-pill assertion marked PROVISIONAL.**
   Comment added stating that whether a `qa_status=superseded` row should still
   show the "Approved source-backed" pill is an OPEN OWNER DECISION, that the
   test pins current rendering only, and that it must not be cited as evidence
   the behaviour is agreed.

5. **`page.test.tsx` navigation assertion NARROWED.** The whole-page
   `queryByRole('navigation')` absence assertion would have failed the
   landing-page header nav recorded as intended future work -- it blocked a
   change it does not care about. Replaced with: each of the three nav CARDS has
   no `<nav>` ancestor. Adding a header `<nav>` later is now free.

6. **Gantt scroll caption hidden from AT (FIXED).** `Phase2GanttChart.tsx`:
   `aria-hidden="true"` moved off the inner grid and onto a wrapper around the
   whole `ScrollFadeRegion`, so the caption and gradient are hidden together with
   the content they describe. The `sr-only` table remains the AT path.
   Chosen over adding a `captionAriaHidden` prop because it needs no new API on
   the shared component.
   **Could break:** nothing -- the existing Gantt render test (which queries the
   region and the hidden table) still passes.

---

## Constraints

- **Plain ASCII:** every added line verified at code point <= 127 (0 violations
  across the whole `git diff HEAD` added-line set). Two pre-existing non-ASCII
  characters remain in files this batch touched -- nav-card emoji in `page.tsx`
  and a black-down-triangle glyph (U+25BC) in `ProjectPhases.tsx` -- both
  present at `HEAD`, neither
  introduced nor in scope for round 2.
- **No calculation, coefficient, unit, rounding rule, or numeric default was
  changed.** The only numbers touched are Tailwind column-width percentages.
- **Both themes:** all changes use `.light`/`.dark` class variants and existing
  Tailwind tokens; no hex colours added. The print-block CSS is inside
  `@media print` and does not affect screen theming.

## Gates

- Scoped vitest across all touched suites: **41 files, 666 tests, all passing.**
- `npm run lint`: **0 errors, 76 warnings** -- exactly baseline.
- `test:ci`, monitored build, and full e2e deliberately NOT run, per the task
  constraints.

## What the reviewer got wrong

- **P2-1 diagnosis.** Framed as a specificity failure ("0,1,0 defeated by
  0,2,0"). The declarations sit on DIFFERENT elements; a value set on a child
  always beats one inherited from the parent, and `!important` already outranks
  katex's plain declarations at any specificity. The prescribed remedy is right;
  the mechanism named is not. Also unmentioned but load-bearing:
  `.katex .base { width: min-content }` would have collapsed a newly wrappable
  box to its narrowest width, so `width: auto` was needed too.
- **P1-1 "only public statement".** The deleted hero sentence was not the only
  place the two workstreams appear on the landing page -- `ProjectPhases`, also
  rendered by `page.tsx`, says "Currently active phase focusing on the Matrix
  Sediment Standards Derivation Options and BN-RRM implementation." The deletion
  was still an undeclared loss of the hero statement and is restored, but the
  information was not fully absent from the page in the interim.
