# Batch Report -- Group A (Interactive Map)

Branch: feat/mo-design-batch-20260815
File touched: src/app/(dashboard)/matrix-map/MatrixMap.tsx (exclusive to this group)
Test file touched: src/app/(dashboard)/matrix-map/__tests__/MatrixMap.test.tsx

## Decision #12 -- Single stacked notice column

File: MatrixMap.tsx, ~line 1563-1596 (was 1563-1588).
Replaced three independently `absolute`-positioned banner divs
(`top-20`/`top-44`/`top-32` -- confirmed overlapping/guessed offsets per
the plan) with one `absolute top-20 left-4 right-4 z-[1000] flex flex-col
gap-2` wrapper, rendered only when at least one notice is active. Each
notice (fetchErrorMessage, siteAggregateFetchErrorMessage, refetchError)
renders conditionally inside it in that priority order. refetchError kept
its dismiss button unchanged.

Tests added (in "decision #12: consolidated notice column"):
- "renders all three notices in priority order when all are present" --
  asserts a `.absolute.top-20.left-4.right-4` wrapper exists and contains
  both prop-driven notices' text.
- "renders no notice wrapper when no notices are active" -- asserts the
  wrapper is absent when no notice prop/state is set.

Neutralisation: changed the wrapper's class from `top-20` to `top-99`
(breaking the test's selector query), ran the two tests -- the first
failed with `expected null not to be null` (selector no longer matched),
the second still passed (no notices -> no wrapper regardless of class).
Restored `top-20`; both pass again. (refetchError itself is internal
component state set only via a Leaflet-driven effect, so it is not
independently prop-drivable in this test file -- covered qualitatively,
not with its own assertion; this is a pre-existing test-surface gap, not
introduced by this change.)

## Decision #1a -- 44px touch targets + always-visible labels (map only)

File: MatrixMap.tsx.
- Zoom/layer stack buttons (Zoom in, Zoom out, Fit to samples, layer
  switcher, Export): each button class changed from `p-2.5` to
  `min-h-[44px] min-w-[44px] p-3 flex items-center justify-center`, icon
  size unchanged (44px floor via padding, not icon growth, per the hard
  constraint).
- 5-button interaction-mode toolbar (Pan / Select / Area / Identify /
  Identify Area): dropped `hidden sm:inline` from all 5 label `<span>`s so
  labels are always visible; each button raised to `min-h-[44px] px-3
  py-2`.
- Layout/reflow fix (see #13 section below for why this had to be solved
  together): the zoom stack and the mode toolbar now share ONE flow-based
  wrapper (`absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2
  max-w-[calc(100%-2rem)]`) instead of the old pair of independently
  `absolute`-positioned blocks (`top-4 right-4` for zoom, `top-4
  right-[72px]` for mode toggle). The mode toolbar sits below the zoom
  stack in normal document flow -- no pixel offset was computed or
  guessed (the plan explicitly flagged pixel-math as an antipattern; my
  first draft used a guessed `top-[188px]` and I caught and replaced it
  with this flow-based wrapper before finishing). The mode toolbar also
  gained `flex-wrap` so it can spill onto a second row if five labelled
  buttons do not fit one row width.

Tests added (in "decision #1a: interaction-mode labels always present"):
- "renders all 5 mode-toolbar labels unconditionally" -- asserts text
  "Pan"/"Select"/"Area"/"Identify"/"Identify Area" all present in markup.
- "does not gate mode-toolbar labels behind a hidden sm:inline class" --
  asserts the Pan label's className does not contain "hidden" and that no
  `.hidden.sm\:inline` element exists in the tree.

Neutralisation: reintroduced `className="hidden sm:inline"` on the Pan
label only. First test still passed (text is present in the DOM
regardless of the hidden class -- jsdom does not evaluate CSS visibility,
so that test alone would NOT have caught this regression, which is why
the second test exists specifically to catch the class). Second test
failed: `expected 'hidden sm:inline' not to match /hidden/`. Restored the
plain `<span>Pan</span>`; both pass again.

NEEDS BROWSER VERIFICATION (jsdom cannot check this): actual >=44px
bounding boxes at 375px, and that the flow-based stacking of mode toolbar
below zoom stack does not visually collide with the sample-count header,
notice column, or map controls at narrow widths. Also verify the mode
toolbar's `flex-wrap` produces a sane two-row layout rather than an
awkward line-break between icon and label at intermediate widths (e.g.
~400-600px).

## Decision #13 -- Split legend panel

File: MatrixMap.tsx, ~line 1761-1796 (original) -> now ~1798-1857.
- Moved the "Surveyed only" checkbox OUT of the legend panel into the
  "Sample count header" block (`absolute top-4 left-4`), directly under
  the sample counts it filters -- chosen over the interaction-mode
  toolbar because that toolbar controls map *interaction mode* (pan/
  select/identify), not data filters, and the sample-count header already
  displays filter-reactive text ("Site aggregates hidden by Surveyed
  only."), making it the more coherent filter-affordance home. It stays
  always visible, raised to `min-h-[44px]` with a slightly larger
  checkbox (`h-4 w-4` vs the old `h-3 w-3`).
- Wrapped everything that remained (classification legend, coordinate-
  quality legend, site-aggregate note) in a native `<details>` /
  `<summary>` element, replacing the old plain `<div>`. `<summary>` carries
  `min-h-[44px] flex items-center` for a full tap target.
- Collapse-by-default-on-mobile: this component had no pre-existing
  `isMobile` signal despite the plan's speculative citation of "line
  1814" (verified by grep -- no match). Added a `legendExpanded` state
  (default `true`, i.e. expanded, for SSR/jsdom safety) plus a
  mount-time `useEffect` that reads `window.matchMedia('(max-width:
  767px)')` once and collapses if narrow. This is a single, new,
  purpose-built breakpoint check, not a duplicate mechanism.

Tests added (in "decision #13: checkbox relocated outside the collapsible
legend"):
- "renders the surveyed_only checkbox outside the <details> legend" --
  asserts the checkbox element is NOT contained within the `<details>`
  subtree.
- "renders the classification legend inside a collapsible <details>
  element" -- asserts a `<details>` element exists, contains
  "Classification", and has a `<summary>` child.

Neutralisation: temporarily reverted `<details>`/`<summary>` back to
plain `<div>`s (two paired edits). Both new tests failed with `expected
null not to be null` (no `<details>` element in the tree). Restored the
`<details>`/`<summary>` markup; both pass again.

The pre-existing test "wires the surveyed_only checkbox to the filter
store" (unchanged, not touching DOM location) continued to pass
throughout since it locates the checkbox by role/name, not position --
confirms the relocation did not break the existing filter-wiring
contract.

NEEDS BROWSER VERIFICATION (jsdom has no layout engine and does not
evaluate the CSS media query the mount-effect drives): that the legend is
actually collapsed by default at a real 375px viewport and open by
default at >=768px; that toggling the `<summary>` visually
expands/collapses smoothly with correct dark-mode styling; that the
`<details>` element's native disclosure triangle/marker does not clash
with the manual layout (no `list-style: none` was applied -- default
browser marker will show; flagged as a possible follow-up polish item,
not a functional defect).

## Full run of MatrixMap.test.tsx

28/28 tests pass (22 pre-existing + 6 new). No pre-existing assertions
needed updating -- the existing suite locates elements by role/text/name
rather than by absolute position or now-removed classes, so it was
resilient to this batch's structural changes.

## Deviations / notes

- The plan's `top-[188px]` suggestion path (implicit in "stack them
  vertically") was resolved via a flow-based shared wrapper instead of
  any hardcoded pixel offset, per the plan's own explicit warning against
  guessed pixel offsets (the exact bug class #12 fixed). This is the
  correct reading of "stack them vertically," not a deviation from
  intent.
- The "Surveyed only" checkbox's new home (sample-count header) is an
  implementer's-call placement per the plan's own text ("inspect at
  implementation time for the existing filter-affordance location...if no
  such surface currently exists as a distinct filter row, add the
  checkbox as its own small always-visible chip"); the sample-count
  header, not the interaction-mode toolbar, was chosen for the reason
  above.
- No calculation, coefficient, unit, rounding rule, or numeric default was
  touched. No other file was touched. No commit was made (per
  instructions).
- Plain ASCII maintained throughout code and comments.
- lint: 0 errors / 76 warnings (repo baseline, unchanged) on
  `npm run lint`; 0 errors/warnings scoped to the two touched files via
  `npx eslint`.
