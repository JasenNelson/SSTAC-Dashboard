# Batch Fixes Round 3 (2026-08-15)

Branch: `feat/mo-design-batch-20260815`. Scope: three fixes (P2-1 blocking non-ASCII sweep,
P3-1 aria-hidden-focus regression, P3-2 fade permanence/caption overlap). No calculation,
coefficient, unit, rounding rule, or numeric default touched. Not committed.

## P2-1 -- non-ASCII sweep (entire batch surface, not just `git diff HEAD`)

Root cause named in the brief: a prior certification ran only against `git diff HEAD`
added lines, which silently excludes untracked (`??`) files -- all nine new files this
batch adds. Re-scanned every path from `git status --short` (both ` M` and `??`) for
characters above code point 127 (`perl -CSD` codepoint scan per file).

Files scanned (all 29 M/?? paths from `git status --short`); non-ASCII found in 4:
`src/app/page.tsx`, `src/components/dashboard/ProjectPhases.tsx`,
`docs/UI_BATCH_PLAN_2026_08_15.md`, `src/components/dashboard/__tests__/ProjectPhases.test.tsx`.
The other 25 files (tracked modifications and untracked new files/tests) were clean.

**Fixed** (4 occurrences, all in files this batch adds):
- `docs/UI_BATCH_PLAN_2026_08_15.md:150` -- rocket (U+1F680) in plan prose -> `[rocket U+1F680]`.
- `docs/UI_BATCH_PLAN_2026_08_15.md:246` -- rocket (U+1F680) in plan prose -> `[rocket U+1F680]`.
- `docs/UI_BATCH_PLAN_2026_08_15.md:254` -- check (U+2705) in plan prose -> `[check U+2705]`.
- `src/components/dashboard/__tests__/ProjectPhases.test.tsx:17` -- literal U+2705 check mark in a regex
  literal -> escaped to `\u{2705}`, matching the already-correct `\u{1F680}` on the same line.
  Chosen over deletion: the character is semantically load-bearing (the regex is asserting
  the check-mark emoji is ABSENT from rendered output), so it stays as a regex source, just
  ASCII-encoded.

**Pre-existing, deliberately left (out of this batch's scope)** -- confirmed via
`git diff -- <file>` that each hit sits on an unchanged context line, not an added/changed one:
- `src/app/page.tsx:61,89,104,119` -- pre-existing nav-card emoji (rocket + variation
  selector, chart, bar-chart, target) on unchanged lines. Note: this batch's diff to this
  file actually REMOVES a rocket emoji (the old hero pill) but does not touch these four.
- `src/components/dashboard/ProjectPhases.tsx:63` -- pre-existing U+25BC black down-pointing triangle, a disclosure
  triangle glyph on an unchanged line. This batch's diff to this file removes a rocket and a
  check-mark emoji elsewhere but does not touch this line.

Left as-is per the brief ("say so explicitly rather than fixing it silently, because
widening scope mid-batch is its own risk").

## P3-1 -- aria-hidden-focus regression in Phase2GanttChart

`src/components/matrix-options/Phase2GanttChart.tsx`: removed the outer
`<div aria-hidden="true">` wrapper around `<ScrollFadeRegion>` (it placed the
`overflow-x-auto` scroll container -- implicitly tabbable in Chrome 127+ with no focusable
children -- inside a hidden subtree). Added an `ariaHidden` boolean prop to
`ScrollFadeRegion` (`src/components/ScrollFadeRegion.tsx`) that applies
`aria-hidden="true"` AND `tabIndex={-1}` directly on the scroll container itself (and
`aria-hidden` on the caption), instead of relying on an ancestor wrapper. Chosen over bare
`tabIndex={-1}` on the shared component unconditionally, because that would remove
Chrome's keyboard-scroll affordance from every OTHER ScrollFadeRegion instance that is
NOT hidden from AT (EvidenceLibrary, MathRenderer) -- an opt-in prop keeps that benefit
for sighted-keyboard users elsewhere while fixing the one call site that intentionally
hides its content.

Verified: `region.getAttribute('aria-hidden')` and the region's parent are both null
(no outer wrapper reintroduced); the scroll container queried inside the region carries
`aria-hidden="true"` and `tabindex="-1"` -- a keyboard user tabbing through the page cannot
land on it, and AT still sees only the sr-only table equivalent.

## P3-2 -- fade permanence + caption overlap in ScrollFadeRegion

`src/components/ScrollFadeRegion.tsx`: replaced the boolean `hasOverflow` fade gate with
scroll-position tracking (`atStart`/`atEnd`, updated on mount, resize/mutation observers,
and a new `onScroll` handler). The trailing (right) fade now shows only while
`hasOverflow && !atEnd`; added a symmetric leading (left) fade shown only while
`hasOverflow && !atStart`. Also restructured the markup: the fade gradients now live in an
inner `relative` wrapper scoped to the scroll container's own box, with the caption `<p>`
moved outside that wrapper -- previously both were absolute-positioned against the same
outer wrapper that also contained the caption, so `top-0 bottom-0` spanned down through the
caption text and the positioned gradient painted above it, washing out the right end of
"Swipe to see more".

## Neutralisations (two-sided, per test)

- `ScrollFadeRegion.test.tsx` -- "hides the trailing fade once scrolled fully right...":
  positive half asserts the fade shows before scrolling; negative half asserts it is gone at
  `scrollLeft === scrollWidth - clientWidth`; a restoring half re-asserts it reappears when
  scrolled back, ruling out a one-way latch in either direction.
- `ScrollFadeRegion.test.tsx` -- "shows a leading (left) fade only once scrolled away from
  the start": negative half asserts no left fade at `scrollLeft === 0` despite overflow;
  positive half asserts both fades render once scrolled to a middle position.
- `ScrollFadeRegion.test.tsx` -- "constrains the fade gradients to the scroll container box,
  not the caption": positive half asserts the caption text still renders (nothing deleted);
  negative half asserts the gradient's parent element is not the caption's parent element,
  proving the gradient can no longer geometrically span into the caption's box.
- `ScrollFadeRegion.test.tsx` -- "ariaHidden prop hides the scroll container...": negative
  half (prop unset) asserts neither `aria-hidden` nor `tabindex` is present, so unrelated
  callers are provably unaffected; positive half (prop set) asserts both attributes land on
  the scroll container and the caption.
- `Phase2GanttChart.test.tsx` -- "hides the scroll container from AT without leaving a
  keyboard-focusable element inside it": negative half asserts the region root and its
  parent carry no `aria-hidden` (no outer wrapper reintroduced); positive half asserts the
  scroll container inside the region has `aria-hidden="true"` and `tabindex="-1"`.
- `ProjectPhases.test.tsx:17` -- unchanged test semantics (still asserts rocket/check-mark
  absence), only the source encoding changed from a literal glyph to `\u{2705}`; the existing
  test run (4/4 passing) is itself the neutralisation that the escape is byte-for-byte
  equivalent to the literal it replaced.

## Verification run

- `npx vitest run src/components/__tests__/ScrollFadeRegion.test.tsx
  src/components/matrix-options/__tests__/Phase2GanttChart.test.tsx
  src/components/dashboard/__tests__/ProjectPhases.test.tsx` -- 22/22 passed.
- `npx vitest run src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx
  src/components/__tests__/MathRenderer.test.tsx` (other ScrollFadeRegion consumers,
  structural-regression check) -- 71/71 passed.
- `npm run lint` -- 0 errors / 76 warnings (matches stated baseline).
- Did not run test:ci, build, or the full e2e suite (out of scope per brief).
