# Phase 4 -- Equation Dispatch Test Plan

**File:** `src/lib/matrix-options/__tests__/equationDispatch.test.ts`
**Design ref:** `docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md` section 3.4
**Phase:** Phase 4 Week 8 commit 1 (dispatch infrastructure; empty variants table)
**Plain ASCII only.**

---

## 1. Purpose

This test file covers the new `equationDispatch.ts` dispatch surface and its companion
`frameVariants.ts` data table. Its job is to verify:

- `getEquation(frameId, pathway)` returns a callable function for every valid
  (frameId, pathway) pair, regardless of whether a frame-specific variant is defined.
- Fallback behavior is explicit and detectable: `usedBaselineFallback: true` when no
  variant is defined, `false` when one is.
- The FRAME_VARIANTS data table is internally consistent: all entries reference valid
  type-checked identifiers, arrays are frozen, no duplicates exist.
- When variants DO exist, numeric output differs from the baseline for the same input
  (the core innovation vs. the existing "no-crash" tests).

The existing calculator component tests (`EcoDirectEqPCalculator.test.tsx`,
`EcoFoodBSAFCalculator.test.tsx`, `HHDirectContactCalculator.test.tsx`,
`HHFoodWebCalculator.test.tsx`) are regression guards and STAY unchanged. The new
tests in `equationDispatch.test.ts` ADD coverage; they do not replace any existing test.

---

## 2. Test file location and conventions

**Path:** `src/lib/matrix-options/__tests__/equationDispatch.test.ts`
**Single file.** Pure TypeScript (no React, no JSX). Vitest.

Match existing conventions from `derivations.test.ts` and `regulatoryFrames.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
// Imports from the module under test:
import { getEquation, FRAME_VARIANTS } from '../equationDispatch';
// Supporting types:
import { REGULATORY_FRAME_IDS } from '../regulatoryFrames';
import type { ProvenancePathway } from '../provenance/types';
// Baseline equation functions for numeric comparison:
import { ecoDirectEqP, ecoFoodBSAF, humanHealthDirectContact, humanHealthFoodWeb }
  from '../derivations';
```

No new setup files. Reuse the existing `src/test/setup.ts`.

---

## 3. Test groups

### Group A: getEquation dispatch surface (~12 tests)

```
describe('getEquation dispatch surface', () => {
```

**A-1. Returns a runnable function for every (frameId, pathway) pair**

```
it('returns a runnable equation function for every (frameId, pathway) pair')
```

Loops over all 6 `REGULATORY_FRAME_IDS` x the 4 dispatchable pathways
(`eco-direct-eqp`, `eco-food-bsaf`, `human-health-direct`, `human-health-food`).
For each pair: call `getEquation(frameId, pathway)` and assert that `result.run` is a
function. Note: `background-adjustment` is out of scope for dispatch routing per design
doc section 1; the test loops only the 4 main equation pathways.

**A-2. Returns usedBaselineFallback: true when no variant defined**

```
it('returns usedBaselineFallback: true when no variant defined for frame+pathway')
```

When `FRAME_VARIANTS` is empty (Phase 4 Week 8 state), every (frameId, pathway) pair
must return `usedBaselineFallback: true`. Assert on at least 3 representative pairs
(e.g., `ccme-sediment-quality` + `eco-food-bsaf`; `us-epa-usace-sediment` + `eco-direct-eqp`;
`site-specific` + `human-health-food`).

**A-3. Returns usedBaselineFallback: false when variant IS defined**

```
it('returns usedBaselineFallback: false when a variant IS defined')
```

Skipped / trivially passes when `FRAME_VARIANTS.length === 0`. Document the skip as a
placeholder with a comment explaining the intended assertion:
`expect(result.usedBaselineFallback).toBe(false)`. Re-enable in the Week 9 commit that
adds the first real variant.

**A-4. Returns a deterministic result for identical inputs**

```
it('returns a deterministic result for identical inputs')
```

Call `getEquation('bc-protocol1-v5-dra', 'eco-direct-eqp')` twice with identical
arguments. Assert both `run` references are the same function object OR that calling
both with identical `EcoDirectEqPInput` fixtures produces identical numeric output
(bitwise `===` on `result.sedS`).

**A-5. Exposes the variant id in the result for traceability**

```
it('exposes the variant id used in the result for traceability')
```

Assert that `result.variant` is a non-empty string. When `FRAME_VARIANTS` is empty,
assert that `result.variant` equals `'baseline'` for all calls.

**A-6. The returned run function calls through to the baseline equation (empty variants)**

```
it('run() produces output identical to the baseline function when no variant defined')
```

Call `getEquation('ccme-sediment-quality', 'eco-direct-eqp').run(fixture)` and
`ecoDirectEqP(fixture)` with the same `EcoDirectEqPInput` fixture. Assert
`result.sedS` values are equal (numeric equality with `toBeCloseTo` at 10 sig figs).
Repeat for one other pathway. This locks the fallback-is-baseline invariant.

**A-7. fallbackReason is a non-empty string when usedBaselineFallback: true**

```
it('provides a non-empty fallbackReason string when falling back to baseline')
```

Assert `typeof result.fallbackReason === 'string' && result.fallbackReason.length > 10`
for any frame+pathway pair with no defined variant.

**A-8 through A-12 (reserved):** Additional edge cases to be named during commit 1
implementation. Candidates: invalid `frameId` argument, invalid `pathway` argument,
`background-adjustment` not accepted as a dispatch target.

---

### Group B: FRAME_VARIANTS table integrity (~8 tests)

```
describe('FRAME_VARIANTS table integrity', () => {
```

These tests run against the exported `FRAME_VARIANTS` array. With an empty table,
each assertion trivially passes (vacuously true). They become meaningful regression
guards as variants are added in Week 9 commits.

**B-1. All frameId values reference valid RegulatoryFrameId values**

```
it('all entries reference valid RegulatoryFrameId values')
```

For each entry in `FRAME_VARIANTS`: assert `REGULATORY_FRAME_IDS.includes(entry.frameId)`.

**B-2. All pathway values reference valid ProvenancePathway values**

```
it('all entries reference valid ProvenancePathway values')
```

Define the same `PATHWAYS` constant used in `regulatoryFrames.test.ts`:
`['eco-direct-eqp', 'eco-food-bsaf', 'background-adjustment', 'human-health-direct', 'human-health-food']`.
For each entry: assert `PATHWAYS.includes(entry.pathway)`.

**B-3. Every variant id has a corresponding equation function exported**

```
it('every variant id has a corresponding equation function exported from equationDispatch')
```

Import the variant-to-function registry (or the exported function map) from
`equationDispatch.ts`. For each entry in `FRAME_VARIANTS`: assert
`VARIANT_FUNCTIONS[entry.variant]` is a function. The exact import shape depends on
the implementation decision for the function registry; document the dependency here
and resolve at commit 1 time.

**B-4. sourceIds arrays are immutable (frozen)**

```
it('sourceIds arrays are immutable (frozen)')
```

For each entry: assert `Object.isFrozen(entry.sourceIds)`. The design doc declares
`FRAME_VARIANTS` as `as const`; `as const` freezes nested arrays in TypeScript's type
system but not at runtime. If the implementation does not call `Object.freeze()`,
this test will catch the gap.

**B-5. No duplicate (frameId, pathway) pairs**

```
it('no duplicate (frameId, pathway) pairs')
```

Build a Set of `${entry.frameId}::${entry.pathway}` strings from `FRAME_VARIANTS`.
Assert `set.size === FRAME_VARIANTS.length`.

**B-6. note field is a non-empty string on each entry**

```
it('every entry has a non-empty note string for UI surfacing')
```

For each entry: assert `entry.note.length > 10`.

**B-7. sourceIds is an array (may be empty) on each entry**

```
it('sourceIds is an array on every entry')
```

For each entry: assert `Array.isArray(entry.sourceIds)`.

**B-8. FRAME_VARIANTS is itself frozen**

```
it('FRAME_VARIANTS top-level array is frozen')
```

Assert `Object.isFrozen(FRAME_VARIANTS)`. Locks the `as const` / freeze contract.

---

### Group C: Behavior change verification (~6 tests, sparse at Week 8)

```
describe('behavior change verification (frame variant vs baseline)', () => {
```

This group is the core innovation: proving numeric output changes when a real frame
variant is defined.

**C-1 (placeholder -- activates in Week 9). Frame X variant produces different numeric output than baseline**

```
it.todo('frame X variant produces different numeric output than baseline for the same input -- activate in Week 9 when first variant ships')
```

Document the intended assertion pattern as a comment block:

```typescript
// When FRAME_VARIANTS has an entry for (frameId, pathway):
// const variantResult = getEquation(frameId, pathway).run(fixture);
// const baselineResult = getEquation('bc-protocol1-v5-dra', pathway).run(fixture);
// expect(variantResult.sedS).not.toBeCloseTo(baselineResult.sedS, 6);
// This assertion only passes when the variant defines DIFFERENT parameter values
// than the baseline. Do not add a real (non-todo) test for a variant until the
// frameVariants.ts entry for that variant has HITL-curated parameter values.
```

**C-2 (loop over defined variants). All defined variants produce non-baseline output**

```
it('all defined variants in FRAME_VARIANTS produce non-baseline output for the same fixture input')
```

If `FRAME_VARIANTS.length === 0`, assert trivially (`expect(FRAME_VARIANTS.length).toBe(0)`)
with a comment explaining the intent. When variants are added, this test loops
`FRAME_VARIANTS` and asserts non-baseline output for each entry using the
corresponding pathway fixture from Section 4 below.

**C-3 through C-6 (reserved):** One test per specific variant as variants ship in
Week 9 commits. Each covers one (frameId, pathway) pair and one substance fixture.
These are stub `it.todo` entries at Week 8 commit 1.

---

### Group D: Fallback notice integration (~4 tests)

```
describe('fallback notice integration (component boundary)', () => {
```

NOTE: The primary location for fallback-notice rendering assertions is the calculator
component test files, not this file. This group documents the split boundary and
provides one lightweight smoke test.

**D-1. getEquation fallback shape contains the fields the component needs**

```
it('fallback shape exposes usedBaselineFallback and fallbackReason for FrameVariantFallbackNotice')
```

Assert that a fallback-path `getEquation` result has both `usedBaselineFallback: true`
and a non-null `fallbackReason` string. This is a pure-TS assertion (no component
rendering) that the props contract for `FrameVariantFallbackNotice` is satisfied.

**D-2 (note only -- lives in calculator tests). FrameVariantFallbackNotice renders in each calculator**

```
// NOTE: Tests for the rendered <FrameVariantFallbackNotice /> component live in:
//   src/components/matrix-options/__tests__/EcoDirectEqPCalculator.test.tsx
//   src/components/matrix-options/__tests__/EcoFoodBSAFCalculator.test.tsx
//   src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx
//   src/components/matrix-options/__tests__/HHFoodWebCalculator.test.tsx
// New assertion to add there (Week 8 commit 2-5):
//   expect(screen.getByTestId('frame-variant-fallback-notice')).toBeInTheDocument()
//   for frames with usedBaselineFallback: true.
// Do NOT add component rendering to equationDispatch.test.ts (pure-TS module).
```

**D-3. Fallback notice does NOT render when variant IS defined**

```
it.todo('when a variant is defined, FrameVariantFallbackNotice does not render -- activate in Week 9 in calculator component tests')
```

**D-4 (reserved).**

---

## 4. Test fixtures

Reuse the same numeric fixtures as `derivations.test.ts`. Define them once at the
top of the test file in a `FIXTURES` const block:

```typescript
// EcoDirectEqP -- mirrors derivations.test.ts Anchor Case A.
const ECO_DIRECT_EQP_FIXTURE = {
  Cs_mg_per_kg: 0.15,
  foc: 0.020,
  logKow: 6.13,
  fcv_ug_per_L: 0.014,
};

// EcoFoodBSAF -- mirrors Anchor Case B (freshwater PAH).
const ECO_FOOD_BSAF_FIXTURE = {
  TRV_eco_mg_per_kg_bw_day: 0.0025,
  BW_eco_kg: 0.85,
  IR_eco_kg_per_day: 0.18,
  BSAF_loc_freshwater: 0.5,
  fLipid: 0.05,
  foc: 0.02,
  Fsite: 1.0,
  ecosystem: 'freshwater' as const,
  contaminantClass: 'organic-PAH' as const,
};

// HumanHealthDirectContact -- mirrors derivations.test.ts HH-Direct anchor.
const HH_DIRECT_FIXTURE = {
  rfd_oral_mg_per_kg_bw_day: 3.0e-4,
  sf_oral_per_mg_per_kg_bw_per_day: 1.5,
  targetRisk: 1.0e-5,
  hazardQuotient: 1,
  BW_kg: 15,
  ED_years: 6,
  EF_days_per_year: 40,
  AT_cancer_years: 70,
  IR_sed_mg_per_day: 200,
  SA_cm2: 2800,
  AF_sed_mg_per_cm2: 0.2,
  abs_dermal: 0.03,
  ba_oral: 0.6,
};

// HumanHealthFoodWeb -- mirrors derivations.test.ts HH-Food anchor.
const HH_FOOD_FIXTURE = {
  rfd_oral_mg_per_kg_bw_day: 2.0e-5,
  sf_oral_per_mg_per_kg_bw_per_day: 2.0,
  targetRisk: 1.0e-5,
  hazardQuotient: 1,
  BW_kg: 70,
  IR_food_kg_per_day: 0.142,
  ba_oral: 1,
  BSAF_loc_freshwater: 2,
  fLipid: 0.05,
  foc: 0.02,
  ecosystem: 'freshwater' as const,
  contaminantClass: 'organic-halogenated' as const,
};
```

Mock `console.warn` only if `getEquation` is expected to emit fallback warnings:

```typescript
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => warnSpy.mockRestore());
```

---

## 5. Vitest configuration

- Use `--pool=forks --maxWorkers=1` (per `cross_project_codex_cli_windows_pytest_temp_stall`
  and Windows IPC stability pattern used throughout this project).
- No new `vitest.config.ts` entries required; `equationDispatch.test.ts` is a standard
  `src/lib/**/__tests__/*.test.ts` path that the existing config already picks up.
- No new setup files. Reuse `src/test/setup.ts`.

---

## 6. Regression preservation

**DO NOT delete any existing test.**

The "uses the selected regulatory frame without crashing" tests in each calculator
component test file are load-bearing regression guards per
`cross_project_never_delete_regression_tests_during_cleanup.md`. They loop over all 6
`REGULATORY_FRAME_IDS` and verify no render crash. They must continue to pass on every
commit in Phase 4.

The new tests in `equationDispatch.test.ts` ADD numeric-behavior coverage. They do not
replace, merge with, or supersede any calculator component test.

When Week 8 commits 2-5 wire the calculators through dispatch, the existing calculator
tests verify the wiring did not break any current behavior. If a commit causes a
previously-passing calculator test to fail, the commit is RED and must not be pushed.

---

## 7. Expected test count

| Group | Phase 4 Week 8 commit 1 | After first real variant (Week 9) |
|---|---|---|
| A: getEquation dispatch surface | ~12 | ~12 (no changes) |
| B: FRAME_VARIANTS table integrity | ~8 (all trivially pass) | ~8 (now non-trivial) |
| C: Behavior change verification | ~2 (1 loop + 1 todo) | ~4 (1 real + stubs) |
| D: Fallback notice integration | ~4 (1 real + todos) | ~4 (todos activate) |
| **Total new in this file** | **~26** | **~28** |

The total of ~26 new tests at Week 8 commit 1 is within the 30-50 estimate from the
design doc. Groups B and C expand as variants are added; the file should stay under 60
tests total at Phase 4 close.

---

## 8. Open questions for owner

1. **Dispatch via component vs dispatch function in isolation:** The design doc proposes
   testing dispatch behavior at the pure-function level (`equationDispatch.test.ts`) AND
   at the component level (calculator `__tests__` files). This plan follows that split.
   Confirm: is integration-level testing (render calculator, switch frame, assert
   different on-screen value) in scope for Week 8 commits, or deferred to Week 9 when
   real variants exist?

2. **FRAME_VARIANTS table in its own test file:** `frameVariants.ts` is a pure-data
   module. The integrity tests in Group B above live in `equationDispatch.test.ts`
   because the variants table is consumed by `getEquation`. However, if the variants
   table grows large (10+ entries across Week 9+), splitting integrity tests to
   `frameVariants.test.ts` may improve readability and test run time. Recommendation:
   keep in `equationDispatch.test.ts` for now; revisit at Phase 4 close. Owner
   direction welcome.

3. **`background-adjustment` pathway dispatch scope:** The design doc explicitly excludes
   `background-adjustment` from dispatch routing (section 1). Confirm this exclusion
   holds -- i.e., `getEquation(frameId, 'background-adjustment')` should throw or
   return an explicit error, not silently return the baseline. If so, Group A needs a
   negative test for this input.

4. **`site-specific` frame treatment:** The design doc lists it as "always-baseline."
   Should Group B include a specific test asserting `FRAME_VARIANTS` will never contain
   a `site-specific` entry (enforcing the always-baseline contract), or is that too
   prescriptive for Phase 4?

---

*Authored 2026-05-28. Read-only on all source files. Do not commit this file without
owner review.*
