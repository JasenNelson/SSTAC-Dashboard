# Batch Fixes Round 4 (2026-08-15)

Branch: `feat/mo-design-batch-20260815`. Leg 1 adversarial review, round 4 -- the round that
runs on the post-round-3 tree and therefore also reviews round 3's own fixes for what THEY
broke. Scope: one owner decision implemented (P2-1), two real defects found and fixed, one
reported defect rejected as a false positive. No calculation, coefficient, unit, rounding
rule, or numeric default touched.

## Round-3 verification (do not re-do this work)

Round 3 was written by a background agent whose session ended before this one began. Its
task id was dead on arrival (`TaskOutput` -> "No task found"), so per L0 1.8 the agent itself
is gone -- but its WORK landed. All three round-3 fixes were re-verified independently in
source before anything was touched:

- **P3-1 (aria-hidden focus):** confirmed. `Phase2GanttChart.tsx` passes `<ScrollFadeRegion
  ariaHidden>`, the outer `aria-hidden` wrapper is gone, and `aria-hidden` + `tabIndex={-1}`
  sit on the scroll container itself.
- **P3-2 (fade permanence):** confirmed. `showRightFade`/`showLeftFade` are gated on real
  `atStart`/`atEnd` scroll state, not a bare `hasOverflow` boolean.
- **P2-1 non-ASCII sweep:** confirmed by an independent codepoint scan of every ` M` and `??`
  path. Only the six hits round 3 explicitly declared out-of-scope remain.

**One correction to `BATCH_FIXES_ROUND3.md`:** its line 31 describes `page.tsx:61` as a
"rocket (+ variation selector)". The actual character is U+1F3DB (classical building) plus
U+FE0F. The line numbers and the count were right; the character identity was not. This is
the same citation-drift class the handoff flags at section 4 item 8.

## P2-1 -- superseded rows read as two green signals (OWNER-DECIDED, implemented)

Previously the only OPEN item blocking this batch. Owner decided 2026-08-15: **amber for
`needs_review`, rose for `superseded`; keep the green provenance pill.**

Rationale for keeping the pill: `evidence_support_status=approved_source_backed` reports
where the value CAME FROM, and for these 41 rows the provenance genuinely is source-backed.
The defect was never that the pill lied -- it was that the countervailing `qa_status` was
demoted to undifferentiated 12px grey, so the row presented two reassuring signals.

**Fixed as a CLASS, not at the instance.** The finding named the row-level default-evidence
cell, but a sweep found FOUR sites folding a `qa_status` into muted text. All four now route
through one shared pair in `EvidenceLibrary.tsx`:

- `qaStatusTextTone(status)` -- amber for any `needs`-bearing status, rose for `superseded`,
  empty string otherwise (inherit the surrounding muted colour).
- `QaStatusText` -- renders the humanized label, wrapped in a toned `<span>` only when the
  status actually carries a warning, so the neutral case adds no pointless element.

Call sites updated: the row-level default-evidence cell, the HITL-added-locators list, the
evidence-item detail panel, and the expanded-row evidence list.

The tones deliberately REUSE what `statusTone()` already assigns to the PILL form of the same
statuses, so the two renderings of one status can never drift apart.

`EvidenceLibrary.test.tsx`'s round-2 "PROVISIONAL ASSERTION" note is removed: that test now
pins an AGREED contract and may be cited as evidence of intended behaviour.

## P1 -- screen-only scroll affordances printed onto paper (CONFIRMED, fixed)

`src/components/ScrollFadeRegion.tsx`. Round 2 fixed print CLIPPING by resetting `overflow`
on the scroll container (`globals.css`), so wide tables and display equations stopped being
cut off on paper. It did nothing about the container's two decorative SIBLINGS: the `w-8`
fade gradient(s) and the "Swipe to see more" caption `<p>`. Neither carried a print variant,
and no `@media print` rule targeted them.

Consequence: printing a methodology or References-and-Values document that was overflowing
at print time painted a gradient stripe over the right edge of the very table round 2 had
just stopped clipping, plus a stray "Swipe to see more" line in a regulatory document.

This is both recurring patterns at once -- a fix that created the next round's defect, and
the "correct content HIDDEN rather than corrupted" class that green gates cannot see.

Fixed by adding `print:hidden` to both gradient divs and the caption, matching the
established repo idiom (33 other uses) rather than inventing a new `@media print` selector.

## P2 -- Active phase chip fails AA contrast in BOTH modes (CONFIRMED, fixed)

`src/components/dashboard/ProjectPhases.tsx`. The chip shipped `bg-sky-600` light /
`dark:bg-sky-500` with an unconditional `text-white`. Measured against white:

| Mode | Background | Ratio | AA 4.5:1 |
|---|---|---|---|
| Light | `sky-600` #0284c7 | 4.09:1 | FAIL |
| Dark | `sky-500` #0ea5e9 | 2.77:1 | FAIL |

12px bold does NOT qualify for the relaxed 3:1 "large text" threshold (that begins at
18.66px bold), so 4.5:1 is the applicable floor and both modes miss it. Because only the
background varied by mode, dark mode was materially worse -- the "tuned for one mode only"
defect.

Fixed to `sky-700` (5.93:1 against white) in BOTH modes. White-on-saturated was kept rather
than flipping to dark-text-on-light-chip, because decision #17 chose Option A explicitly
WITHOUT the colour inversion; the accessible fix must not quietly overturn that.

## REJECTED -- "deleted orientation copy" in MatrixDashboard.tsx (false positive)

A copy-deletion audit reported as P1 that this sentence was deleted with no replacement:

> Currently reviewing the {activeSideTab} methodology. Scroll to locate specific regulatory
> derivations within the document below.

The deletion is real, but it is **decision #21, Option A -- "Delete it. Remove the
`bg-sky-50 ... border-l-4 border-sky-500` banner outright."** The audit found the removal and
correctly verified nothing replaced it, but did not cross-check the decisions doc. Rejected.

**However, verifying it surfaced a real sequencing gap.** Decision #21's rationale leans on
the #16 heading-hierarchy fix to carry the orientation the banner used to provide -- and #16
is scheduled in BATCH 2. Between batch 1 and batch 2 shipping, that view has neither the
banner nor the corrected heading; the only orientation cue left is the sidebar's selected-tab
highlight. Judged acceptable (severity LOW, temporary, and re-adding copy now only to delete
it in batch 2 is churn) and recorded in `UI_DECISIONS_2026_08_15.md` under decision #21.

## Two-sided falsification (per L0 / owner standard)

Every fix in this round was broken deliberately, the specific guarding test confirmed to
fail with a readable error, then restored and confirmed green.

- **P2-1 tone, neutralisation 1 (fix removed):** `qaStatusTextTone` stubbed to always return
  `''`. Both `#6: folds a superseded row ...` and `P2-1: tones needs-review ...` failed with
  "Unable to find an element with the text: superseded" / "... needs review". The exact-text
  query is itself the discriminator -- pre-fix the status was a bare text node inside a
  parent reading "not default . superseded . extracted from source", which an exact
  `getByText` cannot match.
- **P2-1 tone, neutralisation 2 (over-correction):** helper changed to tone EVERY status,
  including settled ones. The `approved`-must-stay-untoned negative half failed, as intended.
- **P1 print:** `print:hidden` stripped from all three nodes -> the round-4 P1 test failed by
  name. The test's negative half separately asserts the scroll container, the region root,
  and the caller's children are NOT print-hidden, ruling out the obvious over-correction of
  suppressing the whole region on paper (which would re-hide the table).
- **P2 contrast:** classes reverted to `bg-sky-600` / `dark:bg-sky-500` -> the round-4 P2 test
  failed by name. It asserts the two measured-failing classes are ABSENT, not merely that
  some `bg-sky-\d{3}` is present -- the pre-existing loose shape check could not tell a
  passing sky from a failing one.

**A test caught an error in its own author.** The first draft of the P1 print test navigated
`getByTestId('scroll-fade-region').querySelector('div')`, which returns the inner `relative`
positioning wrapper, NOT the `overflow-x-auto` scroll container -- so `scrollLeft` was set on
the wrong element and the left gradient never mounted. Corrected to select `.overflow-x-auto`
explicitly. Same descendant-vs-ancestor trap the handoff warns about at section 4 item 7.

## SPEC-CONFORMANCE re-audit (added mid-round, after the owner caught #9 by eye)

The owner looked at the running dev server and reported that the 2x2 "didn't actually use
the matrix and instructions I asked for". That was correct, and it exposed a review gap no
prior round had covered: every audit so far asked "does the code work / can this test fail
if the code regresses", never "does the shipped result match the DECISION TEXT".

A full re-audit of all 21 decisions against their written text was then run.

> **SUPERSEDED IN PART.** The `#9` section immediately below describes an INTERMEDIATE
> state that no longer ships. After it was written, the owner reviewed the running page and
> directed a full rebuild: `ConceptualMatrix` became the "Vision for Modernizing Schedule
> 3.4" page (decision #22 in `UI_DECISIONS_2026_08_15.md`), which has four CONTENT-BEARING
> quadrant cards, no numerals at all, and no filled-square legend. The tests described here
> (filled/keyed-by-axis assertions) were replaced accordingly. Read #9 below as the history
> of how the 2x2 was fixed and then superseded, not as a description of shipped code.
>
> Rounds 5+ fixes are recorded in section "ROUND 5" at the end of this file.

### #9 -- 2x2 legend did not match its decision (CONFIRMED, rebuilt)

Decision #9 Option C specifies "a small 2x2 legend diagram (four colored squares with axis
labels, no prose) at the top of the view, numbered 1-4".

| Requirement | Shipped | Now |
|---|---|---|
| four COLOURED SQUARES | white cards, coloured text | filled emerald-700 / sky-700 squares |
| WITH AXIS LABELS | none rendered; axis names only inside an `aria-label` | four rendered labels on both edges |
| no prose | full card title in every cell | numeral only; title moved to `sr-only` |
| numbered 1-4 | correct | unchanged |

The grid ORDER was already right (rows Ecological / Human Health, columns Direct Contact /
Food Web) -- but with no rendered axis labels nothing on screen said the axes existed, which
is the entire thing #9 was raised to fix.

Colours are the `-700` shades, not the `-500`s the old badges used: white on emerald-500 is
2.56:1 and would have reproduced the same contrast defect fixed in P2 above. emerald-700 is
5.55:1, sky-700 5.93:1.

**Why it shipped: the test asserted the implementation it received, not the decision.** The
existing test checked only that the digits 1-4 appeared. During falsification it stayed GREEN
with the axis labels stripped AND the fills turned white, while both new tests failed. Two
tests were added: one asserting the axis labels are real TEXT (an `aria-label` contributes no
text content, so this cannot be satisfied the way the broken version was), one asserting the
quadrants are filled and keyed by axis.

### #1a -- zoom/layer stack shipped without its labels (CONFIRMED, fixed)

Decision #1 requires a 44px floor on "the zoom/layer stack and the 5-button interaction-mode
toolbar, AND drop every `sm:`-gated label so every icon-only control always shows a short
word under/beside the icon". The mode toolbar got its labels. The zoom/layer stack got the
44px floor but NOT the labels -- Zoom in, Zoom out, Fit to samples, the layer switcher, and
Export carried `aria-label` + `title` only.

That is not equivalent. A `title` tooltip requires hover, so it does not exist on touch
devices -- the exact devices this decision targets. On a phone those five controls had no
label by any means.

Fixed: visible words (In / Out / Fit / Layers / Export) under each icon, inside the 44px box,
with the longer `aria-label` retained so screen readers still hear "Zoom in", not "In".

**The falsification result here is the clearest evidence of the review gap in this whole
batch.** With the labels stripped: the new visible-text test FAILS, and a test asserting the
ACCESSIBLE NAME still PASSES. An accessible-name assertion would have gone green against the
broken version. That is exactly how this shipped.

### #1b / #1c -- deviation ACCEPTED by owner, now on the record

The audit found #1b (pager + row-expand) and #1c (SSD toggle groups) shipped as "bigger",
not "collapsed into menus": only SSD's Endpoint filters became a list-opening control. The
implementer disclosed this at the time, citing a 30+ call-site rewrite.

Owner ruling 2026-08-15: ACCEPT as shipped. The severity-high part was the touch-target
floor, which is met everywhere; the menu-collapse was the mechanism, not the goal. Recorded
in `UI_DECISIONS_2026_08_15.md` under decision #1 so it is a decision, not a silent gap.

### Everything else: conformant

#2, #3, #5, #6 (incl. the P2-1 follow-up), #10, #11, #12, #13, #14, #15, #17, #19, #21 were
all found to match their decision text. Residual items are test-COVERAGE gaps where the code
is correct but under-pinned (e.g. #19 does not assert the bold-lead / muted-detail split or
DOM order; #10 does not guard against pill chrome returning; #12 does not pin notice ORDER).
These are lower severity than the #9 class -- there the code was wrong and the test passed;
here the code is right and the test merely does not pin every detail. Logged, not fixed in
this batch.

Two items the audit correctly flagged as NOT literally satisfied, both judged acceptable:
- **#8** asked to "confirm KaTeX fits the narrow drawer without overflow". The equation
  typesets correctly and inherits a ScrollFadeRegion overflow fallback, but nobody has
  opened the drawer at its real width and looked. Added to the browser-verification list
  below rather than claimed as done.
- **#14** was resolved by RELABELLING ("Full ECOTOX mirror (reference)") rather than by
  gating the figure on the active data source, so the 582,125-row figure still renders in
  fixture/upload mode. Documented twice by the implementer; the relabel does resolve the
  original "claims ECOTOX data when it isn't" complaint honestly.

## Still requiring a real browser (NOT closed by any gate)

Unchanged from the group reports, plus one new item from this round:

- 44px tap targets, sticky-column behaviour, scroll-fade appearance/disappearance, and
  toolbar overlap at 375px/768px.
- **Print output specifically** -- P1 above is fixed at the CLASS contract level, but jsdom
  has no print rendering at all. The actual print preview still needs eyes on it.
- The dark-mode chip at `sky-700` should be confirmed to still read as a distinct filled chip
  against the dark page surface (it is ~2.7:1 against `slate-900`, which is intended for a
  filled shape rather than text, and it carries a `sky-500` border).
- **The rebuilt #9 2x2 diagram** -- aspect-square quadrants at `max-w-sm` with a `6rem` label
  column have not been seen at 375px; confirm the axis labels do not crush the squares.
- **The five new zoom-stack labels** -- confirm the 10px words fit inside the 44px box without
  clipping the icon, and that the widened stack still clears the mode toolbar at 375px.
- **#8's drawer equation** -- open the derivation drawer at its real ~320-360px width and
  confirm KaTeX fits, per the decision's own "confirm" instruction.
- Suspected, not code-traceable: `MatrixMap`'s legend `<details open>` defaults to expanded
  on first paint and collapses in a post-mount `matchMedia` effect, so a narrow viewport may
  show a brief flash of the expanded legend. Self-correcting within a paint cycle; needs a
  device check to judge severity.

---

# ROUND 5 -- fixes from review rounds 3 and 4

## Catalog LaTeX corruption (P1, OWNER-APPROVED catalog edit)

Decision #8 routed `equation_latex` through KaTeX display math. Three of the five catalog
entries were NOT valid LaTeX: bare multi-character subscripts. `_` binds ONE token in TeX,
so `IR_sed` typeset as "IR" subscript-s followed by a literal "ed". Confirmed by rendering
through KaTeX directly:

| source | before | after |
|---|---|---|
| `IR_sed` | `IR`(s)`ed` | `IR`(sed) |
| `AF_sed` | `AF`(s)`ed` | `AF`(sed) |
| `C_tissue` | `C`(t)`issue` | `C`(tissue) |
| `IR_food` | `IR`(f)`ood` | `IR`(food) |
| `BSAF_effective` | `BSAF`(e)`ffective` | `BSAF`(effective) |

The previous `<pre>` rendering displayed all of these correctly, so decision #8 silently
CORRUPTED regulatory variable names -- no error, no failing test. `BSAF_effective` was
missed by the review that found the others.

Fixed by bracing the five subscripts and changing bare `log` to `\log`, in BOTH
`equation_latex` and each entry's `evidence_items[].value_text` (the same string is stored
twice; letting them diverge would be its own defect). **Encoding only.** Round 4 verified
this mechanically: parsed-JSON field-by-field diff with braces and `\log` normalised away
produced ZERO differences across all 5 entries and all fields. `qa_status`, `reviewed_by`,
`input_keys` and `output_keys` untouched -- `IR_sed_mg_per_day` and `BSAF_effective` also
exist as KEY NAMES and were correctly not braced.

DELIBERATELY NOT CHANGED: `Dose`, `SedS`, `FCV`, `mean`, `targetDose` render as italic
letter-products. Typographically imperfect, but no information is lost, and converting them
to `\text{}` needs explicit spacing decisions (`\text{CF}\text{EF}` runs together as
"CFEFED") that are typesetting judgment on regulatory content, not defect repair. Owner
confirmed this scope: "corruption and defect repair".

Guarded by `src/components/matrix-options/__tests__/equationCatalogLatex.test.ts`: no bare
multi-char subscripts, `\log` usage, brace balance, `equation_latex == value_text`, and
fixture/catalog drift.

## Test fixture divergence (P2, introduced BY this batch)

`evidenceLibraryFixture.ts` states it holds "trimmed verbatim copies of real catalog rows".
After the catalog was corrected it still held the OLD corrupted strings in six places, and
nothing compared the two -- the catalog test reads only the catalog, the fixture tests read
only the fixture. Two copies of one fact with no mechanism holding them together, which is
the same class this batch invoked when rejecting a per-instance fix elsewhere.

Six strings synced; a drift guard added asserting every fixture equation exists in the
catalog (subset, not equality -- the fixture is a trimmed subset by design).

## Decision #3's axis colours never rendered (P2)

`AXIS_STYLES` used all-sides `border-emerald-600`, which lost to `CARD`'s
`border-slate-200` because `PathwayCell` composes with a plain template literal rather than
`cn`/twMerge, so raw stylesheet order decided. All four quadrants painted identical slate --
the page's central design claim was dead.

Browser-verified before AND after, in both modes:
- before: both axes `oklch(0.929 0.013 255.508)` (slate-200), identical
- after light: emerald `oklch(0.596 0.145 163.225)` vs sky `oklch(0.588 0.158 241.966)`
- after dark: emerald `oklch(0.765 0.177 163.223)` vs sky `oklch(0.746 0.160 232.661)`

Fixed with directional `border-t-*`. Round 4 confirmed the cascade positions in the COMPILED
CSS: `.border-slate-200` @53332 precedes `.border-t-emerald-600` @55767, and the dark rules
use `&:where(.dark,.dark *)` which adds zero specificity, so source order is decisive.

**The test for this decision certified the defect.** It asserted `/border-emerald-600/` --
the class string -- and passed while the colour never rendered. Rewritten to require the
directional form and to assert the all-sides form is ABSENT.

## Render-time throw replaced with a placeholder (owner-decided)

`find()` threw if a receptor-pathway was missing. With no error boundary above the
component, that would white-screen the whole Vision tab over one absent entry. Replaced with
`MissingPathwayCell`, which names the missing coordinate and degrades one cell only.

Round 4 caught that the accompanying assertion was UNREACHABLE: `queryAllByTestId(
'pathway-missing')).toHaveLength(0)` sits after four `getByTestId` calls, and RTL's `getBy*`
throws first -- so it could never observe a placeholder, and `MissingPathwayCell` had zero
coverage repo-wide. A dedicated test now renders it directly and asserts the coordinate text
plus the directional rose border, falsified two-sided.

## Also fixed this round

- Sticky Parameter column: three of four states were translucent, letting scrolled columns
  show through the parameter name. All four now opaque.
- `MathRenderer`: the `components` object was an inline literal, so the `span` override --
  which matches EVERY inline node -- got a new identity each render and remounted the whole
  markdown subtree. Memoised on `fadeFrom`.
- MatrixMap notice test named "in priority order" asserted no order. Now asserts DOM order.

## Known and deliberately deferred

`C_tissue` is no longer findable by substring search in References & Values (the equation now
stores `C_{tissue}`). The other four renamed tokens survive via their bare key names;
`C_tissue` has none. Discoverability, not correctness.

Plus: ScrollFadeRegion caption at exactly 1px overflow; duplicated `katex-display` margin;
EvidenceLibrary print reset; disclosure-marker inconsistency across 6 call sites; grayscale
desaturating an amber callout; notice column vs a taller header card.
