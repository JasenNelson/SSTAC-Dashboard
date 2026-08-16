# Batch Fixes Round 1 -- adversarial review response

Branch: feat/mo-design-batch-20260815 (uncommitted working-tree fixes; not committed per instructions).

## P1-2 -- ConceptualMatrix.tsx Indigenous identification removed (RESTORED)

`src/components/ConceptualMatrix.tsx:59` changed from
`'High-volume traditional food consumption rate modifiers'` back to
`'Modifiers for high-volume Indigenous traditional food consumption rates'` -- restores the
word "Indigenous" while keeping #19's shorter plain-language phrasing (not the full original
sentence-form text, but the identification is present).

Test: `src/components/__tests__/ConceptualMatrix.test.tsx` -- added
"identifies quadrant 4 as Indigenous traditional food consumption rates". Falsification: fails
if the word "Indigenous" is dropped again (reverts to the removed generic text). Also hardened
the pre-existing border-accent test (`Array.from(...).find(...)` could yield `undefined` and
still pass with size 2) to `expect(match).toBeDefined()` per card, so a card that loses its
accent border now fails instead of silently entering the Set as `undefined`.

## P1-1 -- EvidenceLibrary.tsx sticky column no-op (FIXED)

`table-fixed w-full` alone can never exceed its container, so the region never scrolled and the
sticky column/fade were permanently inert. Added `min-w-[640px]` to the values table
(`EvidenceLibrary.tsx:4369`) -- preserves desktop appearance (100% still wins when the
container exceeds 640px) while forcing genuine overflow on phone widths.

Tests rewritten (jsdom cannot measure scrollWidth/clientWidth, so assert the structural
precondition instead):
- `#5` (:802) now also asserts `table.className` matches `min-w-[`.
- `#2` (:850) now asserts the table *inside* the region carries the min-width, not just that
  the wrapper testid exists.
Both fail if the min-width regresses out (the exact defect the review found).

## P2-2 -- MathRenderer print clipping (FIXED)

Added a print-media reset in `src/app/globals.css` alongside the existing
`.math-renderer-table-wrapper` rule:
```
.katex-display { overflow: visible !important; max-width: none !important; white-space: normal !important; }
```
Matches both the ScrollFadeRegion wrapper div and the inner KaTeX span (both carry
`katex-display`), mirroring the table-wrapper pattern so long equations no longer clip on print.

## P2-3 -- collapsed disclosure affordance (FIXED, both sites)

`display:flex` on `<summary>` removes the native `::marker` triangle. Applied the existing
`SsdWorkbench.tsx` pattern (`list-none` + explicit `<ChevronDown>`) to:
- `MatrixMap.tsx:1802` legend summary (ChevronDown already imported).
- `EvidenceLibrary.tsx:4498` row-expand "Details" summary (ChevronDown already imported).

## P2-4 -- ScrollFadeRegion hardcoded dark background (FIXED)

Added a `fadeFrom` prop (default `'from-white dark:from-slate-900'`, unchanged behavior for
existing callers that don't override). Set `fadeFrom="from-white dark:from-slate-950"` at
BOTH EvidenceLibrary ScrollFadeRegion call sites (values table :4369 AND the references/sources
table :4599 -- confirmed both sit inside the same `dark:bg-slate-950` main content pane at
:4218, not just the one the review flagged). Phase2GanttChart's own surface (`bg-white
dark:bg-slate-900`, confirmed) and MathRenderer's two internal call sites keep the default,
since MathRenderer is embedded across ~7 different callers with varying surfaces -- fully
auditing all of them was out of scope for this round; the prop makes that a future one-line
fix per caller instead of a structural change.

Test added in `ScrollFadeRegion.test.tsx`: asserts the override lands (positive) AND the old
hardcoded `dark:from-slate-900` is absent (negative) when overridden.

## P3s

- `MathRenderer.tsx:66` dead `.math-display` utility deleted (rehype-katex 7.0.1 emits
  `katex-display`, never `math-display`); `globals.css` `.math-display` selector removed from
  the print rule, `.katex`/`.math-inline` kept.
- `SsdWorkbench.tsx` "Mirror corpus size" -- restored "approx." qualifier. Did NOT gate on
  `sourceMode === 'ecotox_mirror'` as literally suggested: that would have broken the existing
  default-render test (`582,125 rows` is asserted visible in fixture mode at initial render).
  Used the review's own stated alternative instead: relabeled to "Full ECOTOX mirror
  (reference)" so it reads as background context regardless of which mode produced the current
  run, rather than implying the figure describes the run itself.
- `ScrollFadeRegion.tsx` effect dep changed from `[children]` (a new object every render) to
  `[]` -- the ResizeObserver already re-checks on size changes, including from children
  changing.
- `MatrixMap.tsx:308` added a `matchMedia` `change` listener so rotating a phone
  re-evaluates `legendExpanded` (was read-once-on-mount only). Test setup already stubs
  `addEventListener`/`removeEventListener` on the global `matchMedia` mock, so no test changes
  needed.
- Line endings normalized back to each file's original convention (verified against
  `git show HEAD`): `EvidenceLibrary.tsx` LF (was flipped to CRLF), `ProjectPhases.tsx` CRLF
  (was flipped to LF). Diffs are now review-sized (58 and 44 lines) instead of thousands.

## Tests that didn't discriminate (fixed)

- `ConceptualMatrix.test.tsx` border-accent test: see P1-2 above.
- `EvidenceLibrary.test.tsx` #5/#2: see P1-1 above.
- `EvidenceLibrary.test.tsx` #6: added a second fixture row
  (`pv-hc-zinc-hh-food-sf-superseded` in `evidenceLibraryFixture.ts`) with
  `qa_status: 'superseded'` + `evidence_support_status: 'approved_source_backed'` -- the
  combination the review named (P2-1) that no existing fixture row exercised. New test asserts
  "superseded" folds into the plain-text line as expected AND is never rendered as a second
  pill.
- `ProjectPhases.test.tsx`: rewrote the Active/Complete color test. The old assertion
  (`not.toMatch(/bg-blue-/)`) passed trivially because the real chip is `bg-sky-600`, not
  literally "blue" -- it could not fail in either direction. New test positively asserts Active
  is solid/saturated (`bg-sky-\d{3}`, not `bg-transparent`) and Complete is the muted outline
  (`bg-transparent` + `border`), with no green/emerald/blue anywhere.
- `Phase2GanttChart.test.tsx`: old assertion queried for a table *inside* a region that never
  contains any table, so it passed even if the sr-only table were deleted. New version asserts
  the table exists in the document (positive) and is specifically not a descendant of the
  scroll region (negative).

## Left alone (owner decision, not touched)

P2-1 (superseded + approved_source_backed dual-indicator styling) -- per instructions, no
color-scheme change made. Only used it to build the P2-1-adjacent test fixture for #6 above.

## Verification

- Scoped vitest (all touched test files): 6 files / 43 tests, then EvidenceLibrary 66 tests,
  then MatrixMap + MatrixDashboard 105 tests -- all green, no full test:ci/build/e2e run per
  instructions.
- `npm run lint`: 0 errors / 76 warnings -- matches stated baseline exactly (a transient 77th
  warning from an unnecessary `eslint-disable` comment was caught and removed before final).
- No calculation/coefficient/unit/rounding/default was touched anywhere in this pass.
