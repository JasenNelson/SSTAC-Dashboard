# Phase 4 frameVariants.ts -- Row Shape Specification

**Status:** Design spec (2026-05-28). Ready for Phase 4 commit 1.
**Authority:** `docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md` sections 3.2 and 5.

---

## 1. Purpose

`frameVariants.ts` is the data table mapping `(frameId, pathway)` pairs to
equation variant identifiers, parameter overrides, and HITL source provenance.
`equationDispatch.ts` reads this table: for any pair that appears, the dispatcher
routes to the named variant; for all other pairs it falls back to BC Protocol 1
v5 baseline and sets `usedBaselineFallback: true` for the UI notice.

The table starts empty. No entry is AI-authored. Every entry requires HITL-
provided parameter values with verified source IDs from the Evidence Library
(`catalog_sources` rows, landed by Stream D). Empty-table-by-default forces the
explicit-fallback-with-UI-notice behavior to be obvious from day 1.

---

## 2. File location

`src/lib/matrix-options/frameVariants.ts`

Single file. Pure TypeScript data module. No JSX, no React, no side effects.
Imports only from sibling modules in `src/lib/matrix-options/`. Named export:
`FRAME_VARIANTS: readonly FrameVariantRow[]`.

---

## 3. Row shape (TypeScript interface)

```typescript
import type { RegulatoryFrameId } from './regulatoryFrames';
import type { ProvenancePathway } from './provenance/types';
import type { EquationVariantId } from './equationDispatch';

/**
 * One row in the FRAME_VARIANTS lookup table.
 * Absent row = fall back to baseline. Present row = use the named variant.
 * Rows are authored only when HITL has provided parameter values and source IDs.
 * Authority: STREAM_C_EQUATION_DISPATCH_DESIGN.md sections 3.2 and 5.
 */
export interface FrameVariantRow {
  /** Frame this row serves. Closed union; typos are compile errors. */
  readonly frameId: RegulatoryFrameId;
  /** Pathway this row covers. One row per pathway; separate rows for multi. */
  readonly pathway: ProvenancePathway;
  /** Variant ID understood by equationDispatch dispatchers. Closed union. */
  readonly variant: EquationVariantId;
  /** Brief plain-ASCII note for UI surfacing in FrameVariantFallbackNotice. */
  readonly note: string;
  /** catalog_sources UUIDs. Non-empty required for every non-baseline variant. */
  readonly sourceIds: readonly string[];
  /**
   * Optional parameter overrides injected into the equation input before call.
   * Shape is pathway-specific; enforced by FrameVariantOverrides discriminated
   * union (section 5). Absent = run the variant function with user inputs only.
   */
  readonly parameterOverrides?: FrameVariantOverrides;
}
```

**Field justifications:**

- `frameId` + `pathway`: composite lookup key. Closed union types catch typos at
  compile time. No-duplicate rule (section 6) makes the pair a composite PK.
- `variant`: ties data to dispatcher function-resolution. A closed
  `EquationVariantId` union means adding a variant requires updating the type and
  the dispatcher in the same PR -- no orphaned data rows.
- `note`: design principle 2 from the design doc -- never silently swap equations.
  The note is the machine-readable string the notice component surfaces.
- `sourceIds`: non-empty required per stop condition 3 of the design doc ("Any
  variant ships without HITL-provided source IDs" is a stop condition).
- `parameterOverrides`: optional because some variants change only the equation
  function (different formula, same parameter keys); no overrides needed then.

---

## 4. Initial table content

```typescript
// FRAME_VARIANTS starts empty intentionally.
//
// An absent entry signals equationDispatch.ts to fall back to BC Protocol 1
// v5 baseline and set usedBaselineFallback: true. Adding a real entry requires:
//   1. HITL-provided parameter values + verified catalog_sources IDs (Stream D).
//   2. EquationVariantId added to equationDispatch.ts union + registry.
//   3. Test asserting the variant produces different output from baseline.
//   4. Codex iterate-to-GREEN + 4 gates GREEN + PR merge.
// See section 8 for the full migration checklist.
export const FRAME_VARIANTS: readonly FrameVariantRow[] = [];
```

**Example placeholder (NOT a live entry):**

```typescript
// {
//   frameId: 'ccme-sediment-quality',
//   pathway: 'eco-food-bsaf',
//   variant: 'ccme-bsaf-v1',
//   note: 'CCME 2007 BSAF table; differs from BC Protocol 1 default in
//          4 of 7 substance classes.',
//   sourceIds: ['<catalog_sources_uuid_TBD>'],
//   parameterOverrides: {
//     pathway: 'eco-food-bsaf',
//     ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
//   },
// },
```

---

## 5. Parameter override shape per pathway

`FrameVariantOverrides` is a tagged discriminated union on `pathway`. The tag in
the overrides block must match the row's top-level `pathway`; TypeScript enforces
this via `satisfies FrameVariantRow`. Compiler rejects unknown keys.

| pathway | Overridable keys | NOT overridable (site-measured or per-assessment) |
|---|---|---|
| `eco-direct-eqp` | `fcv_ug_per_L`, `acknowledgeBlackCarbon` | `logKow`, `foc`, `Cs_mg_per_kg`; Di Toro coefficients (new regression = new variant fn) |
| `eco-food-bsaf` | `BSAF_loc_freshwater`, `TRV_eco_mg_per_kg_bw_day`, `Fsite`, `BW_eco_kg`, `IR_eco_kg_per_day` | `foc`, `fLipid`, `ecosystem`, `contaminantClass`; `fProtein` MeHg path (new variant fn) |
| `human-health-direct` | `rfd_oral_mg_per_kg_bw_day`, `sf_oral_per_mg_per_kg_bw_per_day`, `abs_dermal`, `ba_oral`, `IR_sed_mg_per_day` | `ED_years`, `EF_days_per_year`, `AT_cancer_years`, `BW_kg`, `SA_cm2`, `AF_sed_mg_per_cm2` |
| `human-health-food` | `rfd_oral_mg_per_kg_bw_day`, `sf_oral_per_mg_per_kg_bw_per_day`, `IR_food_kg_per_day` (primary), `BSAF_loc_freshwater`, `ba_oral` | `foc`, `fLipid`, `ecosystem`, `contaminantClass`, `BW_kg` |
| `background-adjustment` | none (frame-invariant; see Q5 in section 9) | UTL 95/95 arithmetic unchanged across BC/CCME/US EPA |

`IR_food_kg_per_day` is the primary Human Health Food frame-specific key: Health
Canada, US EPA, and BC guidance specify different default fish consumption rates.

Each interface uses the tagged pattern below (eco-food-bsaf shown as example):

```typescript
export interface EcoFoodBsafOverrides {
  readonly pathway: 'eco-food-bsaf';
  readonly ecoFoodBsaf: Partial<{
    BSAF_loc_freshwater: number;
    TRV_eco_mg_per_kg_bw_day: number;
    Fsite: number;
    BW_eco_kg: number;
    IR_eco_kg_per_day: number;
  }>;
}
```

The full `FrameVariantOverrides` union is:
`EcoDirectEqpOverrides | EcoFoodBsafOverrides | HumanHealthDirectOverrides |
HumanHealthFoodOverrides | BackgroundAdjustmentOverrides`.

---

## 6. Validation rules

Compile-time (discriminated union recommended over runtime validator -- authoring-
time errors beat test-time errors for a slowly-changing HITL-curated file):

1. `frameId` is a valid `RegulatoryFrameId` (6-member union).
2. `pathway` is a valid `ProvenancePathway` (5-member union).
3. `variant` is a valid `EquationVariantId` (closed union; see Q1).
4. `parameterOverrides` `pathway` tag matches the row's `pathway` field.
5. Override keys drawn from the per-pathway `Partial<{...}>` shape.

Runtime (`validateFrameVariants()` in `equationDispatch.ts`; called in dev init
and test suite; tested by importing `FRAME_VARIANTS` directly):

- No duplicate `(frameId, pathway)` pairs.
- `sourceIds` non-empty for every non-baseline variant.
- `variant` registered in the dispatcher's variant-function map.

---

## 7. Tier 2 protection note

Once `FRAME_VARIANTS` has real entries it is a HITL-curated artifact (Tier 2
protected paths per `CLAUDE.md`). AI MAY add rows from HITL-provided content
(codex GREEN + 4 gates); MAY NOT modify or delete existing entries without
explicit HITL approval. While empty: standard code-review flow applies.

---

## 8. Migration: empty to first-variant (checklist)

1. Owner provides `(frameId, pathway)` pair + parameter values + verified
   `catalog_sources` UUIDs (Stream D landed in production Supabase).
2. Add `EquationVariantId` member + variant function to `equationDispatch.ts`
   in the same commit as the new `FrameVariantRow` (no orphaned data rows).
3. Append row to `FRAME_VARIANTS` with non-empty `sourceIds`.
4. Test: variant returns `usedBaselineFallback: false`; `sedS` differs from
   baseline for the same substance and site inputs.
5. Codex iterate-to-GREEN + 4 gates GREEN + PR merge. One variant per PR.

---

## 9. Open questions for owner

1. **EquationVariantId: closed union or open string?** Closed union recommended
   (compile-time safety, forces dispatcher + data table sync). Owner to confirm
   before commit 1 so the dispatcher type is declared correctly.

2. **Deprecated / superseded_by field?** If a variant is replaced by an updated
   table (e.g., CCME BSAF update), should the old row stay with
   `supersededBy: 'ccme-bsaf-v2'` instead of being deleted? Alternative: move
   to a `FRAME_VARIANTS_ARCHIVE` constant in the same file. Owner preference?

3. **first_added_date field?** ISO-8601 string per row for lightweight audit trail
   vs relying on git blame. Low overhead; owner to confirm if desired.

4. **Markdown in note field?** The `FrameVariantFallbackNotice` component renders
   the `note` string. Does it support markdown (bold, links)? If yes, `note` can
   reference source sections. If no, plain text only. Owner to confirm.

5. **background-adjustment frame-invariance?** Section 5.5 assumes invariant.
   If any frame (CCME, US EPA, FCSAP) prescribes a different UTL percentile or
   reference-set selection policy, `BackgroundAdjustmentOverrides` needs real
   keys. Owner to confirm before commit 1.

---

*Authored 2026-05-28. Plain ASCII only. No emoji. No em-dashes. No smart quotes.*
*Sources read: derivations.ts, regulatoryFrames.ts, provenance/types.ts,*
*STREAM_C_EQUATION_DISPATCH_DESIGN.md, types.ts.*
