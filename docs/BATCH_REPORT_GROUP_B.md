# UI Batch Group B -- Implementation Report (2026-08-15)

Scope: decisions #2, #5, #6, #1b, #8, #21 from `docs/UI_DECISIONS_2026_08_15.md`,
partitioned per `docs/UI_BATCH_PLAN_2026_08_15.md` Group B.

Files touched:
- `src/components/ScrollFadeRegion.tsx` (new)
- `src/components/MathRenderer.tsx`
- `src/components/matrix-options/Phase2GanttChart.tsx`
- `src/components/matrix-options/EvidenceLibrary.tsx`
- `src/components/MatrixDashboard.tsx` (only #8 and #21, as scoped)
- `vitest.config.ts` (one alias entry -- see "Deviation: vitest.config.ts" below)
- Tests: `src/components/__tests__/ScrollFadeRegion.test.tsx` (new),
  `src/components/__tests__/MathRenderer.test.tsx` (new),
  `src/components/matrix-options/__tests__/Phase2GanttChart.test.tsx` (extended),
  `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx` (extended),
  `src/components/__tests__/MatrixDashboard.test.tsx` (extended)

No calculation, coefficient, unit, rounding rule, or numeric default was touched.
No file under `src/lib/matrix-options/**`, `provenance/**`, or `supabase/**` was touched.

---

## #2 -- Shared scroll-fade affordance (Option A)

New component `src/components/ScrollFadeRegion.tsx`: a client component that
wraps children in an `overflow-x-auto` div, runtime-checks
`scrollWidth > clientWidth` on mount + `ResizeObserver` + a `resize` listener,
and renders a trailing gradient mask + "Swipe to see more" caption only when
overflowing. Both disappear again once content fits.

**Deviation from the plan's suggested path**: the task brief explicitly named
the file as `src/components/ScrollFadeRegion.tsx` (top level), while the plan
doc suggested `src/components/ui/ScrollFadeRegion.tsx`. Followed the task
brief since it is the more specific, direct instruction.

Applied at:
- `src/components/MathRenderer.tsx:73-77` -- GFM table wrapper (`table`
  component override), replacing the bare `overflow-x-auto` div.
- `src/components/MathRenderer.tsx:78-92` -- **plan citation was wrong here,
  documented rather than silently followed**: the plan's file:line pointed at
  a `[&_.math-display]:overflow-x-auto` Tailwind selector (line 65-66 in the
  original file) as the fix site for KaTeX display-math overflow. That
  selector targets a CSS class (`math-display`) that `rehype-katex` (see
  `node_modules/rehype-katex/lib/index.js:44-140`) **splices out and replaces
  entirely** during rendering -- the class never survives to the final DOM.
  The selector was already dead/no-op CSS (confirmed: it only appears
  elsewhere in `globals.css:674` as an unrelated print-style rule). The real
  overflow-prone wrapper KaTeX emits for block/display equations carries the
  class `katex-display` instead. Implemented the fix against the real
  class: added a `span` component override in `ReactMarkdown`'s `components`
  prop that detects `className` containing `katex-display` and wraps that
  span in `ScrollFadeRegion`; inline `katex` spans (no `-display`) are left
  untouched since they don't overflow. Left the pre-existing dead
  `[&_.math-display]` Tailwind selector in place (out of scope to remove;
  noted here for visibility, not silently deleted).
- `src/components/matrix-options/Phase2GanttChart.tsx:97-179` -- wrapped only
  the visual (`aria-hidden`) Gantt grid `div` in `ScrollFadeRegion`; the
  `sr-only` accessible table stays outside the scroll region (it's visually
  hidden and doesn't need to scroll). Moved `overflow-x-auto` off the
  `<figure>` onto `ScrollFadeRegion`.
- `src/components/matrix-options/EvidenceLibrary.tsx` -- both
  `overflow-x-auto` table wrappers: the Parameter Values table (was line
  4367, `<div className="overflow-x-auto ...">`) and the Sources table (was
  line 4585).

## #5 -- Sticky first column (Option C)

`src/components/matrix-options/EvidenceLibrary.tsx`: the Parameter `<th>`
and each row's Parameter `<td>` get `sticky left-0 z-10` plus a right-edge
shadow divider (`shadow-[2px_0_4px_rgba(0,0,0,0.08)]`). CSS-only, applied
unconditionally (sticky is a no-op with no horizontal overflow, matching the
plan's "simplest correct implementation" note).

Background-matching detail beyond the plan's literal text: the sticky `<td>`
needed a background that tracks the row's hover/selected state, not a flat
`bg-white`, or the sticky cell would visually desync from the rest of the
row while scrolled. Added `group` to the `<tr>` className and
`group-hover:bg-sky-50/60 dark:group-hover:bg-sky-950/30` plus the existing
`isSelectedRow` override to the sticky `<td>`.

## #6 -- Promote evidence_support_status, demote the other three (Option A)

`src/components/matrix-options/EvidenceLibrary.tsx`, the "Default / evidence"
cell: renders `<StatusBadge value={evidence_support_status} />` alone, then
`{humanizeCatalogLabel(default_status)} . {humanizeCatalogLabel(qa_status)} . {humanizeCatalogLabel(extraction_status)}`
in a muted `text-xs text-slate-500 dark:text-slate-400` line. Used a plain
`.` separator (period), not a middle-dot character -- the initial draft used
U+00B7 which is a plain-ASCII violation (code point 183); caught and fixed
before finalizing.

`statusTone()`/color-mapping logic (lines 387-408) was not touched -- only
which field is promoted to a pill changed.

## #1b -- Pager + row-expand, 44px floor (Option C, with a stated deviation)

`ValuesPagination` Prev/Next buttons: `px-2 py-1` -> `min-h-[44px] px-4 py-3`.
Row-expand `<summary>`: added `flex min-h-[44px] items-center` for a
full-width, vertically-centered 44px tap target.

**Deviation, per the plan's own flag, restated here for visibility**: the
decision text says the replacement control should "open a labeled list,
matching the native `<select>` pattern." Neither the 2-button pager nor the
binary open/close `<details>` disclosure has a set of discrete options to
put in a `<select>` -- there is nothing to select between. Implemented the
plan's recommended fallback instead: raise both existing controls to a
44px-tall floor without forcing a `<select>` wrapper. This is a deliberate,
documented departure from the literal decision wording, not a silent
reinterpretation.

Also exported `ValuesPagination` (was previously an unexported local
function) so it could be unit-tested directly with an artificial multi-page
prop set -- the fixture catalog used elsewhere in the test file only has 10
rows against a 50-row page size, so the paginator never renders through the
full component tree.

## #8 -- Render the drawer equation through MathRenderer (Option A)

`src/components/MatrixDashboard.tsx`, `renderToolReference()`: replaced
`<pre className="overflow-x-auto ...">{eq.equation_latex}</pre>` with
`<MathRenderer content={`$$\n${eq.equation_latex}\n$$`} />`.

**Correctness finding, not in the plan**: `remark-math` only classifies
`$$...$$` as block/display math (KaTeX `displayMode: true`, giving the
`katex-display` overflow-safe wrapper) when the delimiters sit on their own
line. A same-line `` `$$${eq.equation_latex}$$` `` -- the form the plan's
own text literally suggested -- parses as **inline** math instead, so the
equation would have rendered small and un-centered rather than "the same
typeset equation" the decision asks for. Verified this directly (rendered
both forms and inspected `container.innerHTML` for the `katex-display`
class) before shipping the newline form. Documented inline in
`MatrixDashboard.tsx` at the call site so a future edit doesn't collapse it
back onto one line.

No separate `ScrollFadeRegion` wrap was needed at this call site: `#2`'s fix
inside `MathRenderer.tsx` already wraps any `katex-display` span it produces,
so the drawer equation gets the same overflow protection automatically.

## #21 -- Delete the restated-tab banner (Option A)

`src/components/MatrixDashboard.tsx`: deleted the
`bg-sky-50 ... border-l-4 border-sky-500` banner div. The outer
`id={JURISDICTIONAL_SIDE_TABPANEL_ID}` / `aria-labelledby` wrapper div was
left intact, confirmed still present and still carrying both attributes via
a test assertion.

---

## Deviation: vitest.config.ts

Strictly outside the "YOUR FILES" list, but required to make MathRenderer
testable at all, so flagging clearly rather than silently adding it.

`MathRenderer.tsx` has a static `import 'katex/dist/katex.min.css'`. Under
Vitest this CSS-only import goes through Vite's `vite:css` plugin, which
fails in this repo (`postcss.config.mjs` -> "Invalid PostCSS Plugin found at:
plugins[0]") -- the same class of problem the repo already works around for
Leaflet's CSS imports (`vitest.config.ts` alias block, existing lines
80-87). This is almost certainly why no `MathRenderer.test.tsx` existed
before this batch (the plan's own test-plan section noted this gap without
diagnosing the cause). Tried a local `vi.mock('katex/dist/katex.min.css', ...)`
inside the test file first to avoid touching the shared config -- that did
NOT work (the failure happens during Vite's transform of the physical file,
before Vitest's module-mock layer intercepts it). Added one alias line to
the existing `resolve.alias` block in `vitest.config.ts`, following the
exact precedent already there for Leaflet. This is additive only (one new
key in an existing object) and does not touch anything Group A or Group C
own.

---

## Tests added and neutralizations

Two-sided falsification was run for every new test: broke the guarded
behavior, ran the specific test with `-t`, confirmed a failure with a
readable diff, then restored and re-ran to confirm green again. All
restores were verified by a full re-run of the touched test file(s).

### `src/components/__tests__/ScrollFadeRegion.test.tsx` (new, 4 tests)
- "does not render the fade/caption when content fits" -- neutralized by
  forcing `setHasOverflow(false)` unconditionally in the component; the
  overflow test (below) fails as expected, confirming the assertion is live.
- "renders the fade + caption when content overflows" -- same neutralization
  (forced `setHasOverflow(false)`); failed with "Unable to find element
  scroll-fade-caption", confirming.
- "renders a custom caption when provided" -- same neutralization; failed.
- "always renders children regardless of overflow state" -- not separately
  neutralized (it is a basic regression guard, not new conditional logic);
  documented here rather than silently omitted.

Uses `Object.defineProperty` on `HTMLDivElement.prototype` to stub
`scrollWidth`/`clientWidth` since jsdom always reports 0 for both. Real
horizontal-scroll behavior (does the gradient visually track scroll
position, does the caption read well) needs a real browser -- not
verifiable in jsdom.

### `src/components/__tests__/MathRenderer.test.tsx` (new, 4 tests)
- "wraps GFM tables in a ScrollFadeRegion" -- neutralized by reverting the
  `table` component override to a bare `<table {...props} />`; failed
  (`scroll-fade-region` not found). Restored, re-ran, green.
- "wraps display-mode KaTeX output in a ScrollFadeRegion and renders typeset
  math, not raw LaTeX source" -- neutralized twice: (a) changed the class
  match from `'katex-display'` to a nonexistent `'katex-display-BROKEN'`,
  failed (no `scroll-fade-region`); (b) confirmed the newline-delimiter
  requirement itself by first writing the test with a same-line `$$x$$`
  content string, which rendered inline (no `katex-display` class at all)
  -- this is what surfaced the #8 correctness finding above, not a
  contrived break.
- "does not wrap inline math in a ScrollFadeRegion" -- neutralized by
  loosening the class match from `'katex-display'` to `'katex'` (matches
  both inline and display spans); failed (a `scroll-fade-region` appeared
  for the inline-math case where none should).
- "renders plain markdown content unaffected" -- not separately neutralized
  (basic regression guard, not new logic).

### `src/components/matrix-options/__tests__/Phase2GanttChart.test.tsx` (extended, +1 test)
- "wraps the visual (aria-hidden) Gantt grid in a ScrollFadeRegion, leaving
  the sr-only table outside it" -- neutralized by removing the
  `<ScrollFadeRegion>`/`</ScrollFadeRegion>` wrapper tags around the visual
  grid; failed (`scroll-fade-region` not found). Restored, re-ran full file
  (7/7 green).

### `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx` (extended, +6 tests)
- "#5: sticky-lefts the Parameter column header and cells" -- neutralized
  by stripping `sticky left-0 z-10 ...` from the `<th>`; failed. Restored.
- "#6: promotes evidence_support_status ..." -- neutralized by reverting to
  the original 4-pill `<div className="flex flex-wrap gap-1">` rendering;
  failed (wrong text content: all 4 statuses concatenated with no
  separators, since the muted-text-line assertion no longer matched).
  Restored.
- "#1b: gives the row-expand Details summary a 44px-tall tap target" --
  neutralized by removing `min-h-[44px]` from the `<summary>`; failed.
  Restored.
- "#2: wraps the Parameter Values table in the ScrollFadeRegion affordance"
  -- neutralized by reverting the wrapper to a plain `overflow-x-auto` div
  (both open and close tags); failed. Restored.
- "ValuesPagination: raises Prev/Next to a 44px-tall floor" -- neutralized
  by reverting the button className to the original `px-2 py-1` (no
  `min-h-[44px]`); failed. Restored.
- "ValuesPagination: still wires Prev/Next click handlers correctly" -- not
  separately neutralized (pure wiring regression guard, unchanged by this
  batch's edits).

Full re-run after every restore: 65/65 green in `EvidenceLibrary.test.tsx`.

### `src/components/__tests__/MatrixDashboard.test.tsx` (extended, +2 tests)
- "#8: renders the derivation equation through MathRenderer, not a raw
  `<pre>`" -- neutralized by reverting to the original raw
  `<pre>{eq.equation_latex}</pre>`; failed (`math-renderer-mock` not found
  -- `MathRenderer` is mocked to a `data-testid="math-renderer-mock"` div in
  this test file, which made the assertion direct). Restored.
- "#21: does not render the restated-tab banner, but keeps tabpanel wiring"
  -- neutralized by re-adding the deleted banner div; failed ("Currently
  reviewing the" text found). Restored.

Full re-run after every restore: 77/77 green in `MatrixDashboard.test.tsx`.

### Combined run
`EvidenceLibrary.test.tsx` + `EvidenceLibrary.pagination.test.tsx` +
`Phase2GanttChart.test.tsx` + `MatrixDashboard.test.tsx` +
`MathRenderer.test.tsx` + `ScrollFadeRegion.test.tsx` together: **160/160
passed**.

---

## What needs real-browser verification (jsdom cannot check these)

- The gradient/caption actually appearing/disappearing on real horizontal
  overflow, at a 375px viewport, for all four `ScrollFadeRegion` call
  sites (GFM tables, KaTeX display equations, the Gantt chart, both
  EvidenceLibrary tables).
- The sticky Parameter column visually staying pinned while the rest of the
  row scrolls horizontally underneath it, and that the shadow divider reads
  correctly in both themes.
- The KaTeX-rendered equation in the drawer (#8) not overflowing the
  drawer's real ~320-360px rendered width -- if it does, it should still be
  protected by the `ScrollFadeRegion` wrap inherited from `MathRenderer`,
  but that inheritance itself is only structurally verified here, not
  visually.
- 44px tap-target sizing on real touch hardware / a real viewport
  (`min-h-[44px]` classes are asserted structurally via `className` regex,
  not measured as rendered pixel heights, since jsdom has no layout engine).
- Light/dark theme rendering for every new/changed class (all carry `dark:`
  variants following the existing Tailwind-utility pattern per the batch
  plan's Risk section, but no visual/screenshot check was run in this
  environment).

---

## Lint / typecheck status

- `npm run lint`: 0 errors, 76 warnings (matches the stated baseline; no new
  warnings introduced by any file in this group's scope).
- `npx tsc --noEmit`: no errors in any touched file.
- `npm run test:ci`, the production build, and the full e2e suite were not
  run per the task's hard constraints (they exceed the tool timeout).
