# Component Spec: FrameVariantFallbackNotice

**Status:** Draft -- ready for owner review before Phase 4 commit 1 lands.
**Design authority:** `docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md` Section 3.3.
**Phase:** Phase 4, Week 8, Commit 1 (ships alongside `equationDispatch.ts`).
**File path:** `src/components/matrix-options/FrameVariantFallbackNotice.tsx`

---

## 1. Purpose

When a user selects a regulatory frame other than the BC Protocol 1 v5 DRA
baseline, the equation dispatch layer (`equationDispatch.ts`) may find no
frame-specific variant defined for the chosen frame+pathway combination and
silently fall back to the baseline equations. This fallback is intentional
and documented in the design (Section 2 principle 3: "No silent variant
fallback"), but it must be surfaced to the HITL so the reviewer knows whether
the result on screen is a frame-specific derivation or the BC default.

`FrameVariantFallbackNotice` has a single responsibility: render a brief,
unobtrusive notice when `usedBaselineFallback === true`. It complements
`RegulatoryFrameNotice` (which reports frame identity, pathway applicability
status, and source hierarchy) without modifying that component. The two
components are siblings in each calculator's JSX; the split matches the
design direction in Section 3.3 which explicitly states "a second small
notice component ... is the recommended approach" and that
`RegulatoryFrameNotice.tsx` props carry no `usedBaselineFallback` slot.

Reference: `docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md` Section 3.3 (the
`// Render fallback notice as a SIBLING element` comment block, lines
142-147).

---

## 2. Props

```typescript
interface FrameVariantFallbackNoticeProps {
  /**
   * True when getEquation() returned the baseline variant because no
   * frame-specific variant is defined for this frame+pathway pair.
   * When false, the component renders null.
   */
  usedBaselineFallback: boolean;

  /**
   * Optional human-readable explanation returned by getEquation() in its
   * fallbackReason field (e.g., "CCME does not specify a method for this
   * pathway"). When omitted, a generic default sentence is used.
   */
  fallbackReason?: string;

  /**
   * Optional Tailwind className override for layout adjustments.
   * Follows the same pattern as RegulatoryFrameNotice (line 14 in
   * RegulatoryFrameNotice.tsx).
   */
  className?: string;
}
```

### Prop justification

**usedBaselineFallback (required, not optional):** Making this required
forces every call site to forward the value from `getEquation()` rather
than silently omitting it. A caller that passes `false` incurs zero
rendering cost; there is no reason to make it optional and risk call sites
forgetting to wire it.

**fallbackReason (optional):** Sourced from `getEquation()`'s return shape
(see `equationDispatch.ts` Section 3.1 type signature). The variant table
starts empty, so in Week 8 commits all frames return `fallbackReason`
undefined; the component's default copy covers that case. When frame
variants ship in Week 9+, the variant table can supply a frame-specific
reason string.

**frameId is NOT a prop here:** `RegulatoryFrameNotice` (already rendered
as a sibling) shows the frame label and applicability note. Duplicating
`frameId` in this component would create a second display of the frame
identity and risk diverging if the parent's `jurisdiction` prop changes.
The fallback notice copy is intentionally frame-agnostic ("Using BC
Protocol 1 baseline equation") -- if the parent wants to include the frame
name in the `fallbackReason` string, it can construct that string before
passing it down. This keeps the component's responsibilities narrow.

---

## 3. Render behavior

### When usedBaselineFallback === false

Return `null`. No DOM node emitted. This is the common case for the default
frame (`bc-protocol1-v5-dra`): it never falls back because it IS the
baseline. Zero cost.

### When usedBaselineFallback === true

Render a compact notice block. Exact copy:

```
Using BC Protocol 1 v5 DRA baseline equation.
{fallbackReason ?? "This frame has no specialized equation for this pathway."}
```

The two sentences are rendered as a single `<p>` or as two `<span>`
elements within a single container -- either is acceptable; the spec
prefers one `<p>` for screen-reader flow.

### Tailwind classes (suggested)

```
className="mt-2 mb-5 rounded-md border border-slate-200 bg-slate-50
           px-4 py-2.5 text-xs text-slate-600
           dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400"
```

Rationale for style choices:

- `bg-slate-50 / text-slate-600` -- the muted slate palette matches the
  neutral tone of `RegulatoryFrameNotice`'s default tone branch (line 27
  in `RegulatoryFrameNotice.tsx`: `border-slate-200 bg-slate-50
  text-slate-700`). It reads as informational, not alarming.
- `text-xs` -- smaller than `text-sm` used in `RegulatoryFrameNotice` body
  copy; clearly subordinate.
- `rounded-md` vs `rounded-lg` in `RegulatoryFrameNotice` (line 44) --
  slightly tighter corner signals a smaller, supporting role.
- `mb-5` -- matches the bottom margin of `RegulatoryFrameNotice` (its
  `mb-5` class, line 44) so spacing between the two notices and the input
  block below is consistent.
- No colored left border: `RegulatoryFrameNotice` uses a top-level color
  band for pathway status (emerald / amber / sky). Adding a second colored
  band adjacent to it would compete visually. The muted slate is the right
  choice.

### Accessibility

Use `role="note"`, not `role="status"`.

Rationale: `role="status"` implies live-region behavior -- screen readers
announce the content immediately when it appears or changes. The fallback
notice is static during a calculation session (it reflects the dispatch
result for the selected frame, which does not change mid-input). `role="note"`
marks supplementary information that the user encounters in natural reading
order without triggering an interrupt announcement. This matches the `<section>`
pattern used in `RegulatoryFrameNotice` (line 41) which also carries no
live-region role.

When the user switches frames (causing a re-render with a different
`usedBaselineFallback` value), the component mounts / unmounts cleanly;
if live-region announcement of that transition is desired in a future
polish pass, it can be added at the parent level as a separate
`aria-live="polite"` region without changing this component.

---

## 4. Placement in JSX

In each calculator, insert `<FrameVariantFallbackNotice ... />` immediately
after the existing `<RegulatoryFrameNotice ... />` element. The two notices
form a visual pair before the inputs section.

The `usedBaselineFallback` and `fallbackReason` values come from destructuring
the `getEquation()` return (per Section 3.3 of the dispatch design):

```typescript
const { run: equationFn, usedBaselineFallback, fallbackReason } = useMemo(
  () => getEquation(jurisdiction, '<pathway-id>'),
  [jurisdiction],
);
```

### EcoDirectEqPCalculator.tsx

Current `<RegulatoryFrameNotice>` is at line 219-222. Insert immediately
after line 222 (the closing `/>` line):

```tsx
<RegulatoryFrameNotice
  frameId={jurisdiction}
  pathway="eco-direct-eqp"
/>
<FrameVariantFallbackNotice
  usedBaselineFallback={usedBaselineFallback}
  fallbackReason={fallbackReason}
/>
```

No layout container change needed; the two elements stack naturally in the
calculator's vertical flow (header -> notices -> inputs -> error -> result
-> details -> provenance).

### EcoFoodBSAFCalculator.tsx

Current `<RegulatoryFrameNotice>` is at lines 330-333. Insert immediately
after line 333:

```tsx
<RegulatoryFrameNotice
  frameId={jurisdiction}
  pathway="eco-food-bsaf"
/>
<FrameVariantFallbackNotice
  usedBaselineFallback={usedBaselineFallback}
  fallbackReason={fallbackReason}
/>
```

### HHDirectContactCalculator.tsx

Current `<RegulatoryFrameNotice>` is at lines 297-300. Insert immediately
after line 300:

```tsx
<RegulatoryFrameNotice
  frameId={jurisdiction}
  pathway="human-health-direct"
/>
<FrameVariantFallbackNotice
  usedBaselineFallback={usedBaselineFallback}
  fallbackReason={fallbackReason}
/>
```

### HHFoodWebCalculator.tsx

Current `<RegulatoryFrameNotice>` is at lines 294-297. Insert immediately
after line 297:

```tsx
<RegulatoryFrameNotice
  frameId={jurisdiction}
  pathway="human-health-food"
/>
<FrameVariantFallbackNotice
  usedBaselineFallback={usedBaselineFallback}
  fallbackReason={fallbackReason}
/>
```

### Layout container note

All four calculators render the notice block outside any grid or flex
container -- it is a direct child of the top-level `<section>`. The sibling
insert inherits the same flow. No wrapper changes required.

---

## 5. File path

`src/components/matrix-options/FrameVariantFallbackNotice.tsx`

Single file. No subdirectory. Follows the naming pattern of the existing
sibling `RegulatoryFrameNotice.tsx` in the same directory.

Suggested file header (plain ASCII, matches project style):

```typescript
// FrameVariantFallbackNotice.tsx
// Sibling to RegulatoryFrameNotice. Renders a muted notice when the
// equation dispatch layer fell back to the BC Protocol 1 v5 DRA baseline
// because the selected regulatory frame has no defined variant for this
// pathway. Renders null when usedBaselineFallback is false.
//
// See docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md Section 3.3.
// Plain ASCII only.
```

---

## 6. Tests

Location: `src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx`

Recommended test cases (5 tests; all should be fast unit tests with no
async or network dependencies):

**T1 -- renders nothing when false:**
Render `<FrameVariantFallbackNotice usedBaselineFallback={false} />`.
Assert the container is either null or `document.querySelector('[role="note"]')`
is null. No DOM node should be present.

**T2 -- renders default copy when true and no reason:**
Render `<FrameVariantFallbackNotice usedBaselineFallback={true} />`.
Assert the element with `role="note"` is present.
Assert the text content includes "BC Protocol 1 v5 DRA baseline equation".
Assert the text content includes "This frame has no specialized equation
for this pathway."

**T3 -- renders custom reason when provided:**
Render with `usedBaselineFallback={true}` and
`fallbackReason="CCME does not specify a method for this pathway"`.
Assert the element with `role="note"` is present.
Assert text content includes "CCME does not specify a method for this
pathway".
Assert the default fallback sentence ("This frame has no specialized
equation") is NOT present (the provided reason replaces it).

**T4 -- className override is applied:**
Render with `usedBaselineFallback={true}` and `className="mt-10 test-class"`.
Assert the rendered element includes the class `test-class`.

**T5 -- accessibility: role attribute present on the notice:**
Render with `usedBaselineFallback={true}`.
Assert exactly one element has `role="note"`.
Assert that element contains readable text (non-empty `textContent`).

### Existing calculator tests: no changes expected

The existing calculator test files (`EcoDirectEqPCalculator.test.tsx`,
`EcoFoodBSAFCalculator.test.tsx`, `HHDirectContactCalculator.test.tsx`,
`HHFoodWebCalculator.test.tsx`) do NOT use `toMatchSnapshot` or
`toMatchInlineSnapshot` (confirmed by grep across
`src/components/matrix-options/__tests__/`). Therefore, adding the sibling
`<FrameVariantFallbackNotice>` element to each calculator will NOT break
existing tests.

The Phase 4 commit that wires each calculator through `getEquation()` will
need to add NEW test assertions to each calculator test file per the dispatch
design Section 3.4 ("NEW tests: when a frame has no variant for a pathway,
assert the UI renders the `usedBaselineFallback` notice"). Those additions
are out of scope for this commit-1 spec; they belong in the per-calculator
wiring commits (commits 2-5 per the Week 8 rollout plan).

---

## 7. Risk assessment

**Visual regression risk on existing 4 calculators:** Low. The component is
additive only. When `usedBaselineFallback === false` (which is the state on
day 1 of commit 1, when the default frame is selected), it emits no DOM
node. No visual change is visible to users under the default frame. Non-
default frames will show the muted slate notice, which is new content, but
those frames do not yet affect calculation output, so HITL impact is
informational only.

**Test coverage gain:** One new test file with 5 tests covering the complete
render surface. Existing calculator tests are unaffected (no snapshots).

**Codex review checklist:**
- Plain ASCII compliance: no Unicode above code point 127 in the `.tsx`
  file or this spec doc.
- Props shape: `usedBaselineFallback` required boolean; `fallbackReason`
  optional string; `className` optional string. No `frameId` prop (see
  Section 2 justification).
- Render path: returns `null` for false path; no empty `<div>` or hidden
  element. The false path must not add to layout flow.
- Accessibility: `role="note"` not `role="status"` (see Section 3
  justification). No `aria-live` attribute on this component.
- Import surface: only imports `cn` utility (for className merging) and
  React. No dependency on `regulatoryFrames.ts`, `derivations.ts`, or
  any async data layer.

---

## 8. Open questions for owner

**Q1 -- Exact baseline label wording:**
This spec uses "BC Protocol 1 v5 DRA baseline equation". The frame's
`label` in `regulatoryFrames.ts` (line 151) is "BC Protocol 1 v5 DRA (2027)"
and `shortLabel` (line 152) is "BC Protocol 1 v5 DRA". Should the notice
say "BC Protocol 1 v5 DRA baseline", "BC default", "BC Protocol 1 baseline",
or the full label with year? The choice affects what the HITL sees and
what goes into exported reports.

**Q2 -- Link to Evidence Library:**
Should the notice include a link or button that opens the Evidence Library
filtered to the selected frame, so the HITL can check whether a variant
might be available for sourcing? This would require an
`onOpenEvidenceLibrary` callback prop (same pattern as
`CalculatorProvenancePanel`). This spec omits the link to keep the
component minimal, but the hook point is easy to add.

**Q3 -- Dismissible / onboarding pattern:**
Should the notice be dismissible (similar to the `showOnboarding` pattern
used in TWGReviewPortal)? The spec recommends non-dismissible for now
because the fallback state is not a one-time onboarding message -- it
reflects the live dispatch result and should stay visible whenever it is
true. Override if a specific UX preference exists.

**Q4 -- Print / PDF rendering:**
The calculators have print-mode behavior (per recent commits). Should
`FrameVariantFallbackNotice` be hidden in print output (e.g., via
`print:hidden` Tailwind class) or included? A printed report may benefit
from knowing whether baseline equations were used, which argues for
including it. Confirm preference before commit 1 lands.

**Q5 -- Pathway name in the default fallback copy:**
The current default sentence is frame-agnostic and pathway-agnostic. A more
specific message ("This frame has no specialized equation for the Eco-Direct
EqP pathway") would require a `pathway` prop. If that level of specificity
is wanted, add `pathway: ProvenancePathway` as a prop and compute a display
label from it. The spec omits this to keep the prop surface minimal.

---

*Authored 2026-05-28. Read-only pass on source materials; no .tsx files
were created. References: `RegulatoryFrameNotice.tsx` lines 11-14 (props),
line 27 (default tone classes), lines 40-44 (section + mb-5 + rounded-lg);
`EcoDirectEqPCalculator.tsx` lines 219-222 (RegulatoryFrameNotice insertion
point); `EcoFoodBSAFCalculator.tsx` lines 330-333; `HHDirectContactCalculator.tsx`
lines 297-300; `HHFoodWebCalculator.tsx` lines 294-297;
`regulatoryFrames.ts` lines 3-12 (frame IDs), lines 151-152 (baseline label);
`STREAM_C_EQUATION_DISPATCH_DESIGN.md` Section 2 principle 3, Section 3.3.*
