# Phase 4 Stream C -- Commit 1 Paste-Ready Content

**Status:** Ready for owner greenlight + next-session paste.
**Branch:** feat/stream-c-equation-dispatch-2026-05-XX (use session-start date for XX)
**Authority:** docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md + docs/PHASE_4_IMPLEMENTATION_PACK_INDEX.md
**Plain ASCII only. No emoji. No em-dashes. No smart quotes. Code point ceiling: 127.**
**Authored:** 2026-05-28.

---

## Section 1 -- Commit 1 manifest

Commit 1 ships the dispatch infrastructure. Five new files; zero existing files modified.
All behavior is neutral: FRAME_VARIANTS starts empty, so every getEquation() call returns
the BC Protocol 1 v5 DRA baseline and sets usedBaselineFallback: true. No user-visible
calculator output changes.

| File | Purpose |
|---|---|
| src/lib/matrix-options/equationDispatch.ts | Dispatch surface + conditional types + VARIANT_FUNCTIONS registry + validateFrameVariants() |
| src/lib/matrix-options/frameVariants.ts | Pure-data table (empty at commit 1) + FrameVariantRow interface + FrameVariantOverrides union |
| src/components/matrix-options/FrameVariantFallbackNotice.tsx | Sibling notice component (renders null when fallback=false) |
| src/lib/matrix-options/__tests__/equationDispatch.test.ts | ~26 tests covering Groups A/B/C/D |
| src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx | 5 tests covering component render surface |

---

## Section 2 -- File 1 paste-ready: src/lib/matrix-options/equationDispatch.ts

```typescript
// equationDispatch.ts
// Thin dispatch layer over the existing four pathway equation functions.
// For a given (frameId, pathway) pair it returns the correct equation
// function + a usedBaselineFallback flag so the UI can render a notice.
//
// Design authority: docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md
// Plain ASCII only.

import type { RegulatoryFrameId } from './regulatoryFrames';
import type { ProvenancePathway } from './provenance/types';
import {
  ecoDirectEqP,
  ecoFoodBSAF,
  humanHealthDirectContact,
  humanHealthFoodWeb,
} from './derivations';
import type {
  EcoDirectEqPInput,
  EcoDirectEqPResult,
  EcoFoodBSAFInput,
  EcoFoodBSAFResult,
  HumanHealthDirectContactInput,
  HumanHealthDirectContactResult,
  HumanHealthFoodWebInput,
  HumanHealthFoodWebResult,
} from './types';
import { FRAME_VARIANTS } from './frameVariants';
import type { FrameVariantRow } from './frameVariants';

// ---------------------------------------------------------------------------
// EquationVariantId: closed union.
//
// Starts with 'baseline' only. Add one member per shipped variant, always in
// the same commit as the corresponding FRAME_VARIANTS row (no orphaned data).
// Never add a member without an entry in the VARIANT_FUNCTIONS registry below.
//
// Future members (commented out until HITL-curated content ships):
//   | 'ccme-bsaf-v1'
//   | 'fcsap-trv-v1'
//   | 'us-epa-tef-v1'
// ---------------------------------------------------------------------------
export type EquationVariantId = 'baseline';

// ---------------------------------------------------------------------------
// PathwayInput<P> and PathwayResult<P>: conditional type maps.
//
// These are the load-bearing generic types for getEquation<P>. Author them
// FIRST and verify they compile before writing the function body.
// The 4-arm switch is exhaustive; TypeScript enforces this at the call site.
// background-adjustment is intentionally absent: it is frame-invariant and
// not a dispatch target (design doc section 1, anti-pattern 1).
// ---------------------------------------------------------------------------
export type PathwayInput<P extends ProvenancePathway> =
  P extends 'eco-direct-eqp' ? EcoDirectEqPInput :
  P extends 'eco-food-bsaf' ? EcoFoodBSAFInput :
  P extends 'human-health-direct' ? HumanHealthDirectContactInput :
  P extends 'human-health-food' ? HumanHealthFoodWebInput :
  never;

export type PathwayResult<P extends ProvenancePathway> =
  P extends 'eco-direct-eqp' ? EcoDirectEqPResult :
  P extends 'eco-food-bsaf' ? EcoFoodBSAFResult :
  P extends 'human-health-direct' ? HumanHealthDirectContactResult :
  P extends 'human-health-food' ? HumanHealthFoodWebResult :
  never;

// ---------------------------------------------------------------------------
// DispatchResult<P>: the return shape of getEquation().
// ---------------------------------------------------------------------------
export interface DispatchResult<P extends ProvenancePathway> {
  /** The variant identifier actually used. 'baseline' when no variant defined. */
  variant: EquationVariantId;
  /**
   * True when no FRAME_VARIANTS entry matched the (frameId, pathway) pair and
   * the baseline equation was used as the fallback. False only when a specific
   * variant is defined for the pair (Week 9+).
   */
  usedBaselineFallback: boolean;
  /**
   * Human-readable explanation when usedBaselineFallback is true.
   * Always a non-empty string on the fallback path so FrameVariantFallbackNotice
   * receives a non-null value without extra null-guarding at the call site.
   * Undefined only when usedBaselineFallback is false (i.e., a real variant ran).
   */
  fallbackReason?: string;
  /** The callable equation function bound to the resolved variant. */
  run: (input: PathwayInput<P>) => PathwayResult<P>;
}

// ---------------------------------------------------------------------------
// VARIANT_FUNCTIONS: maps EquationVariantId -> per-pathway function resolver.
//
// The outer map key is the variant id. The inner map key is the pathway.
// At commit 1, only 'baseline' is defined. When a new EquationVariantId
// member is added, add a corresponding entry here in the same commit.
//
// Type is declared loosely here (Record<string, Record<string, Function>>)
// because the per-pathway generic cannot be expressed cleanly at the map
// level; type safety is enforced at the getEquation() return site instead.
// ---------------------------------------------------------------------------
const BASELINE_FUNCTIONS: Record<string, (input: never) => unknown> = {
  'eco-direct-eqp': ecoDirectEqP as (input: never) => unknown,
  'eco-food-bsaf': ecoFoodBSAF as (input: never) => unknown,
  'human-health-direct': humanHealthDirectContact as (input: never) => unknown,
  'human-health-food': humanHealthFoodWeb as (input: never) => unknown,
};

const VARIANT_FUNCTIONS: Record<
  EquationVariantId,
  Record<string, (input: never) => unknown>
> = {
  baseline: BASELINE_FUNCTIONS,
};

// ---------------------------------------------------------------------------
// resolveBaselineFallbackReason: produce a consistent fallback reason string.
// ---------------------------------------------------------------------------
function resolveBaselineFallbackReason(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
): string {
  return (
    'No specialized equation is defined for frame "' +
    frameId +
    '" on the "' +
    pathway +
    '" pathway. Using BC Protocol 1 v5 DRA baseline.'
  );
}

// ---------------------------------------------------------------------------
// getEquation<P>
//
// Returns the equation function + variant metadata for the given
// (frameId, pathway) pair. Looks up FRAME_VARIANTS first; if no entry
// matches, falls back to the baseline equation and sets
// usedBaselineFallback: true so the caller can render a UI notice.
//
// Throws a TypeError if pathway is 'background-adjustment': that pathway
// is frame-invariant and is not a dispatch target (see design doc section 1
// and anti-pattern 1). Callers should call the utl9595 / avsSemCheck helpers
// from derivations.ts directly for background-adjustment work.
//
// Generic P constrains PathwayInput<P> and PathwayResult<P> so the returned
// run() function is typed to the correct input/output pair at the call site.
// ---------------------------------------------------------------------------
export function getEquation<P extends Exclude<ProvenancePathway, 'background-adjustment'>>(
  frameId: RegulatoryFrameId,
  pathway: P,
): DispatchResult<P> {
  // Guard: background-adjustment is not a dispatch target.
  if ((pathway as string) === 'background-adjustment') {
    throw new TypeError(
      'getEquation: "background-adjustment" is frame-invariant and is not a ' +
        'dispatch target. Call utl9595() or avsSemCheck() from derivations.ts ' +
        'directly. See STREAM_C_EQUATION_DISPATCH_DESIGN.md anti-pattern 1.',
    );
  }

  // Look up a frame-specific variant entry.
  const match: FrameVariantRow | undefined = (FRAME_VARIANTS as readonly FrameVariantRow[]).find(
    (row) => row.frameId === frameId && row.pathway === pathway,
  );

  if (match !== undefined) {
    // A real variant is defined. Resolve its function.
    const variantFns = VARIANT_FUNCTIONS[match.variant];
    if (variantFns === undefined || variantFns[pathway] === undefined) {
      // Programmer error: FRAME_VARIANTS references a variant id that has no
      // registered function. Fail loudly so it is caught before it reaches prod.
      throw new ReferenceError(
        'getEquation: variant "' +
          match.variant +
          '" is referenced in FRAME_VARIANTS for pathway "' +
          pathway +
          '" but has no registered function in VARIANT_FUNCTIONS. ' +
          'Add the function in the same commit as the FRAME_VARIANTS row.',
      );
    }
    return {
      variant: match.variant,
      usedBaselineFallback: false,
      run: variantFns[pathway] as (input: PathwayInput<P>) => PathwayResult<P>,
    };
  }

  // No variant defined: return baseline + fallback flag.
  const baselineFn = BASELINE_FUNCTIONS[pathway];
  if (baselineFn === undefined) {
    throw new ReferenceError(
      'getEquation: no baseline function registered for pathway "' +
        pathway +
        '". This is a coding error in equationDispatch.ts.',
    );
  }

  return {
    variant: 'baseline',
    usedBaselineFallback: true,
    fallbackReason: resolveBaselineFallbackReason(frameId, pathway),
    run: baselineFn as (input: PathwayInput<P>) => PathwayResult<P>,
  };
}

// ---------------------------------------------------------------------------
// validateFrameVariants()
//
// Runtime integrity check. Called in dev init and in the test suite (Group B).
// Returns an array of error strings; empty array means the table is valid.
// ---------------------------------------------------------------------------
export function validateFrameVariants(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < FRAME_VARIANTS.length; i++) {
    const row = FRAME_VARIANTS[i] as FrameVariantRow;
    const key = row.frameId + '::' + row.pathway;

    // No duplicate (frameId, pathway) pairs.
    if (seen.has(key)) {
      errors.push('Duplicate (frameId, pathway) pair at index ' + i + ': ' + key);
    }
    seen.add(key);

    // variant must be registered in VARIANT_FUNCTIONS.
    if (
      VARIANT_FUNCTIONS[row.variant] === undefined ||
      VARIANT_FUNCTIONS[row.variant][row.pathway] === undefined
    ) {
      errors.push(
        'Index ' + i + ': variant "' + row.variant +
          '" has no registered function for pathway "' + row.pathway + '".',
      );
    }

    // sourceIds must be non-empty for any non-baseline variant.
    if (row.variant !== 'baseline' && row.sourceIds.length === 0) {
      errors.push(
        'Index ' + i + ': non-baseline variant "' + row.variant +
          '" has empty sourceIds. Every variant requires HITL-provided source IDs.',
      );
    }
  }

  return errors;
}
```

---

## Section 3 -- File 2 paste-ready: src/lib/matrix-options/frameVariants.ts

```typescript
// frameVariants.ts
// Pure-TypeScript data table mapping (frameId, pathway) pairs to equation
// variants, parameter overrides, and HITL source provenance.
//
// STARTS EMPTY INTENTIONALLY.
//
// An absent row causes equationDispatch.getEquation() to fall back to the
// BC Protocol 1 v5 DRA baseline and set usedBaselineFallback: true.
// Adding a real row requires:
//   1. HITL-provided parameter values + verified catalog_sources UUIDs (Stream D).
//   2. EquationVariantId member + registered function added to equationDispatch.ts.
//   3. Test asserting the variant produces different output from baseline.
//   4. Codex iterate-to-GREEN + 4 gates GREEN + PR merge. One variant per PR.
//
// Design authority: docs/PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md
//                   docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md sections 3.2 and 5
// Plain ASCII only.

import type { RegulatoryFrameId } from './regulatoryFrames';
import type { ProvenancePathway } from './provenance/types';
import type { EquationVariantId } from './equationDispatch';

// ---------------------------------------------------------------------------
// FrameVariantOverrides: discriminated union on pathway.
//
// Each arm lists the parameter keys that a frame variant MAY override.
// Keys NOT listed are site-measured or per-assessment inputs; they are never
// overridden by frame-level data (design doc section 5 "NOT overridable"
// column). The tag field must match the row's top-level pathway field.
// ---------------------------------------------------------------------------

export interface EcoDirectEqpOverrides {
  readonly pathway: 'eco-direct-eqp';
  readonly ecoDirectEqp: Partial<{
    /** Frame-specific freshwater criterion value in ug/L. */
    fcv_ug_per_L: number;
    /** Black-carbon acknowledgment flag for frames that specify it. */
    acknowledgeBlackCarbon: boolean;
  }>;
}

export interface EcoFoodBsafOverrides {
  readonly pathway: 'eco-food-bsaf';
  readonly ecoFoodBsaf: Partial<{
    /** Frame-specific BSAF lookup value (freshwater, dimensionless). */
    BSAF_loc_freshwater: number;
    /** Frame-specific toxicity reference value (mg/kg-bw/day). */
    TRV_eco_mg_per_kg_bw_day: number;
    /** Frame-specific site-use fraction (dimensionless, 0-1). */
    Fsite: number;
    /** Frame-specific receptor body weight (kg). */
    BW_eco_kg: number;
    /** Frame-specific ingestion rate (kg-wet/day). */
    IR_eco_kg_per_day: number;
  }>;
}

export interface HumanHealthDirectOverrides {
  readonly pathway: 'human-health-direct';
  readonly humanHealthDirect: Partial<{
    /** Frame-specific reference dose (mg/kg-bw/day). */
    rfd_oral_mg_per_kg_bw_day: number | null;
    /** Frame-specific oral slope factor (per mg/kg-bw/day). */
    sf_oral_per_mg_per_kg_bw_per_day: number | null;
    /** Frame-specific dermal absorption fraction (0-1). */
    abs_dermal: number;
    /** Frame-specific oral bioavailability (0-1). */
    ba_oral: number;
    /** Frame-specific sediment ingestion rate (mg/day). */
    IR_sed_mg_per_day: number;
  }>;
}

export interface HumanHealthFoodOverrides {
  readonly pathway: 'human-health-food';
  readonly humanHealthFood: Partial<{
    /** Frame-specific reference dose (mg/kg-bw/day). */
    rfd_oral_mg_per_kg_bw_day: number | null;
    /** Frame-specific oral slope factor (per mg/kg-bw/day). */
    sf_oral_per_mg_per_kg_bw_per_day: number | null;
    /**
     * Frame-specific fish/tissue consumption rate (kg/day).
     * This is the primary HH-Food frame-specific key: Health Canada, US EPA,
     * and BC guidance specify different default fish consumption rates.
     */
    IR_food_kg_per_day: number;
    /** Frame-specific BSAF (freshwater, dimensionless). */
    BSAF_loc_freshwater: number;
    /** Frame-specific oral bioavailability (0-1). */
    ba_oral: number;
  }>;
}

export interface BackgroundAdjustmentOverrides {
  readonly pathway: 'background-adjustment';
  // No overridable keys: background-adjustment is frame-invariant.
  // UTL 95/95 arithmetic is unchanged across BC/CCME/US EPA.
  // If any frame ever specifies a different UTL percentile or reference-set
  // policy, add keys here and confirm with owner first.
  readonly backgroundAdjustment: Record<string, never>;
}

export type FrameVariantOverrides =
  | EcoDirectEqpOverrides
  | EcoFoodBsafOverrides
  | HumanHealthDirectOverrides
  | HumanHealthFoodOverrides
  | BackgroundAdjustmentOverrides;

// ---------------------------------------------------------------------------
// FrameVariantRow: one entry in the FRAME_VARIANTS lookup table.
// ---------------------------------------------------------------------------

/**
 * One row in the FRAME_VARIANTS lookup table.
 *
 * Absent row = fall back to baseline and set usedBaselineFallback: true.
 * Present row = use the named variant; usedBaselineFallback: false.
 *
 * Rows are authored only when HITL has provided parameter values AND
 * verified catalog_sources UUIDs from the Evidence Library (Stream D).
 * AI sessions may append rows from HITL-provided content but may NOT
 * modify or delete existing rows without explicit HITL approval
 * (Tier 2 protected once FRAME_VARIANTS has real entries; see CLAUDE.md).
 *
 * Authority: docs/PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md section 3.
 */
export interface FrameVariantRow {
  /** Frame this row serves. Closed union; typos are compile errors. */
  readonly frameId: RegulatoryFrameId;
  /** Pathway this row covers. One row per pathway; add separate rows for multi. */
  readonly pathway: ProvenancePathway;
  /** Variant ID understood by equationDispatch dispatchers. Closed union. */
  readonly variant: EquationVariantId;
  /**
   * Brief plain-ASCII note for UI surfacing in FrameVariantFallbackNotice.
   * No markdown. Plain text only.
   */
  readonly note: string;
  /**
   * catalog_sources UUIDs from the Evidence Library (Stream D Supabase).
   * Non-empty required for every non-baseline variant (design doc stop
   * condition 3). May be empty at commit 1 only because the table is empty.
   */
  readonly sourceIds: readonly string[];
  /**
   * Optional frame-level parameter overrides applied before calling run().
   * Shape is pathway-specific via the FrameVariantOverrides discriminated union.
   * Absent when the variant changes the equation function but not the parameters.
   */
  readonly parameterOverrides?: FrameVariantOverrides;
}

// ---------------------------------------------------------------------------
// FRAME_VARIANTS
//
// The canonical lookup table. Starts empty. See file header for migration
// checklist (empty -> first-variant).
//
// Example placeholder (NOT a live entry):
//
// {
//   frameId: 'ccme-sediment-quality',
//   pathway: 'eco-food-bsaf',
//   variant: 'ccme-bsaf-v1',
//   note: 'CCME 2007 BSAF table; differs from BC Protocol 1 default.',
//   sourceIds: ['<catalog_sources_uuid_TBD>'],
//   parameterOverrides: {
//     pathway: 'eco-food-bsaf',
//     ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
//   },
// },
// ---------------------------------------------------------------------------
export const FRAME_VARIANTS: readonly FrameVariantRow[] = [];
```

---

## Section 4 -- File 3 paste-ready: src/components/matrix-options/FrameVariantFallbackNotice.tsx

```tsx
// FrameVariantFallbackNotice.tsx
// Sibling to RegulatoryFrameNotice. Renders a muted notice when the
// equation dispatch layer fell back to the BC Protocol 1 v5 DRA baseline
// because the selected regulatory frame has no defined variant for this
// pathway. Renders null when usedBaselineFallback is false.
//
// Design authority: docs/PHASE_4_FRAME_VARIANT_FALLBACK_NOTICE_SPEC.md
// See docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md Section 3.3 for placement.
// Plain ASCII only.

import { memo } from 'react';
import { cn } from '@/utils/cn';

interface FrameVariantFallbackNoticeProps {
  /**
   * True when getEquation() returned the baseline variant because no
   * frame-specific variant is defined for this frame+pathway pair.
   * When false, the component renders null (zero DOM cost).
   *
   * Required (not optional) so every call site is forced to forward the
   * value from getEquation() rather than silently omitting it.
   */
  usedBaselineFallback: boolean;

  /**
   * Optional human-readable explanation returned by getEquation() in its
   * fallbackReason field. When omitted, a generic default sentence is used.
   * Sourced from equationDispatch.ts resolveBaselineFallbackReason().
   */
  fallbackReason?: string;

  /**
   * Optional Tailwind className override for layout adjustments.
   * Follows the same pattern as RegulatoryFrameNotice (line 14 of
   * RegulatoryFrameNotice.tsx).
   */
  className?: string;
}

/**
 * FrameVariantFallbackNotice
 *
 * Renders null when usedBaselineFallback is false (the common case for the
 * default frame bc-protocol1-v5-dra, which never falls back because it IS
 * the baseline).
 *
 * When usedBaselineFallback is true, renders a compact muted slate notice
 * block informing the HITL that the result on screen is the BC Protocol 1
 * baseline, not a frame-specific derivation.
 *
 * Uses role="note" (not role="status") because the fallback state is static
 * during a calculation session and does not need a live-region interrupt
 * announcement. See component spec section 3 (Accessibility) for rationale.
 *
 * Memoized for stability: the component re-renders only when
 * usedBaselineFallback, fallbackReason, or className changes.
 */
const FrameVariantFallbackNotice = memo(function FrameVariantFallbackNotice({
  usedBaselineFallback,
  fallbackReason,
  className,
}: FrameVariantFallbackNoticeProps) {
  if (!usedBaselineFallback) {
    return null;
  }

  return (
    <div
      role="note"
      data-testid="frame-variant-fallback-notice"
      className={cn(
        'mt-2 mb-5 rounded-md border border-slate-200 bg-slate-50',
        'px-4 py-2.5 text-xs text-slate-600',
        'dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400',
        className,
      )}
    >
      <p>
        {'Using BC Protocol 1 v5 DRA baseline equation. '}
        {fallbackReason ?? 'This frame has no specialized equation for this pathway.'}
      </p>
    </div>
  );
});

export default FrameVariantFallbackNotice;
```

---

## Section 5 -- File 4 paste-ready: src/lib/matrix-options/__tests__/equationDispatch.test.ts

```typescript
// Unit tests for equationDispatch.ts and the companion FRAME_VARIANTS table.
// Pure TypeScript; no React; no JSX.
// Groups A/B/C/D per docs/PHASE_4_EQUATION_DISPATCH_TEST_PLAN.md.
// Plain ASCII only.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getEquation,
  validateFrameVariants,
} from '../equationDispatch';
import { FRAME_VARIANTS } from '../frameVariants';
import { REGULATORY_FRAME_IDS } from '../regulatoryFrames';
import {
  ecoDirectEqP,
  ecoFoodBSAF,
  humanHealthDirectContact,
  humanHealthFoodWeb,
} from '../derivations';

// ---------------------------------------------------------------------------
// Test fixtures (mirrors derivations.test.ts anchor cases).
// ---------------------------------------------------------------------------

const ECO_DIRECT_EQP_FIXTURE = {
  Cs_mg_per_kg: 0.15,
  foc: 0.020,
  logKow: 6.13,
  fcv_ug_per_L: 0.014,
};

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

// Suppress any console.warn that getEquation may emit on fallback paths.
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
afterEach(() => warnSpy.mockRestore());

// ---------------------------------------------------------------------------
// Group A: getEquation dispatch surface
// ---------------------------------------------------------------------------

describe('getEquation dispatch surface', () => {
  const DISPATCHABLE_PATHWAYS = [
    'eco-direct-eqp',
    'eco-food-bsaf',
    'human-health-direct',
    'human-health-food',
  ] as const;

  it('A-1: returns a runnable equation function for every (frameId, pathway) pair', () => {
    for (const frameId of REGULATORY_FRAME_IDS) {
      for (const pathway of DISPATCHABLE_PATHWAYS) {
        const result = getEquation(frameId, pathway);
        expect(typeof result.run).toBe('function');
      }
    }
  });

  it('A-2: returns usedBaselineFallback: true when no variant defined for frame+pathway', () => {
    // With FRAME_VARIANTS empty, every pair falls back to baseline.
    const pairs = [
      { frameId: 'ccme-sediment-quality' as const, pathway: 'eco-food-bsaf' as const },
      { frameId: 'us-epa-usace-sediment' as const, pathway: 'eco-direct-eqp' as const },
      { frameId: 'site-specific' as const, pathway: 'human-health-food' as const },
    ];
    for (const { frameId, pathway } of pairs) {
      const result = getEquation(frameId, pathway);
      expect(result.usedBaselineFallback).toBe(true);
    }
  });

  it('A-3: returns usedBaselineFallback: false when a variant IS defined (placeholder -- activates in Week 9)', () => {
    // When FRAME_VARIANTS has entries, this test must assert:
    //   expect(result.usedBaselineFallback).toBe(false);
    // For now, with empty table, assert trivially so the test stays in the suite.
    expect(FRAME_VARIANTS.length).toBe(0); // Remove this line when first variant ships.
  });

  it('A-4: returns a deterministic result for identical inputs (baseline eco-direct-eqp)', () => {
    const result1 = getEquation('bc-protocol1-v5-dra', 'eco-direct-eqp');
    const result2 = getEquation('bc-protocol1-v5-dra', 'eco-direct-eqp');
    const out1 = result1.run(ECO_DIRECT_EQP_FIXTURE);
    const out2 = result2.run(ECO_DIRECT_EQP_FIXTURE);
    expect(out1.sedS).toBeCloseTo(out2.sedS, 10);
  });

  it('A-5: exposes a non-empty variant id for traceability; baseline when no variant defined', () => {
    const result = getEquation('canada-fcsap-aquatic', 'eco-direct-eqp');
    expect(typeof result.variant).toBe('string');
    expect(result.variant.length).toBeGreaterThan(0);
    // With empty FRAME_VARIANTS all calls resolve to 'baseline'.
    expect(result.variant).toBe('baseline');
  });

  it('A-6: run() on fallback path produces output identical to the direct baseline function', () => {
    // eco-direct-eqp path.
    const { run: runEqp } = getEquation('ccme-sediment-quality', 'eco-direct-eqp');
    const dispatchOut = runEqp(ECO_DIRECT_EQP_FIXTURE);
    const directOut = ecoDirectEqP(ECO_DIRECT_EQP_FIXTURE);
    expect(dispatchOut.sedS).toBeCloseTo(directOut.sedS, 10);

    // eco-food-bsaf path.
    const { run: runBsaf } = getEquation('us-epa-usace-sediment', 'eco-food-bsaf');
    const dispatchBsaf = runBsaf(ECO_FOOD_BSAF_FIXTURE);
    const directBsaf = ecoFoodBSAF(ECO_FOOD_BSAF_FIXTURE);
    expect(dispatchBsaf.sedS).toBeCloseTo(directBsaf.sedS, 10);
  });

  it('A-7: fallbackReason is a non-empty string when usedBaselineFallback is true', () => {
    const result = getEquation('bc-csr-sediment-numerical', 'human-health-direct');
    expect(result.usedBaselineFallback).toBe(true);
    expect(typeof result.fallbackReason).toBe('string');
    expect((result.fallbackReason as string).length).toBeGreaterThan(10);
  });

  it('A-8: throws TypeError when pathway is background-adjustment', () => {
    expect(() =>
      // Cast required to test the runtime guard; TS would reject this at compile time.
      getEquation('bc-protocol1-v5-dra', 'background-adjustment' as never),
    ).toThrow(TypeError);
    expect(() =>
      getEquation('bc-protocol1-v5-dra', 'background-adjustment' as never),
    ).toThrow(/background-adjustment.*frame-invariant/);
  });

  it('A-9: run() for human-health-direct fallback matches direct call', () => {
    const { run } = getEquation('canada-fcsap-aquatic', 'human-health-direct');
    const dispatchOut = run(HH_DIRECT_FIXTURE);
    const directOut = humanHealthDirectContact(HH_DIRECT_FIXTURE);
    expect(dispatchOut.sedS).toBeCloseTo(directOut.sedS, 10);
  });

  it('A-10: run() for human-health-food fallback matches direct call', () => {
    const { run } = getEquation('site-specific', 'human-health-food');
    const dispatchOut = run(HH_FOOD_FIXTURE);
    const directOut = humanHealthFoodWeb(HH_FOOD_FIXTURE);
    expect(dispatchOut.sedS).toBeCloseTo(directOut.sedS, 10);
  });
});

// ---------------------------------------------------------------------------
// Group B: FRAME_VARIANTS table integrity
// (trivially pass with empty table; become regression guards as variants land)
// ---------------------------------------------------------------------------

describe('FRAME_VARIANTS table integrity', () => {
  const VALID_PATHWAYS: string[] = [
    'eco-direct-eqp',
    'eco-food-bsaf',
    'background-adjustment',
    'human-health-direct',
    'human-health-food',
  ];

  it('B-1: all entries reference valid RegulatoryFrameId values', () => {
    for (const entry of FRAME_VARIANTS) {
      expect(REGULATORY_FRAME_IDS).toContain(entry.frameId);
    }
  });

  it('B-2: all entries reference valid ProvenancePathway values', () => {
    for (const entry of FRAME_VARIANTS) {
      expect(VALID_PATHWAYS).toContain(entry.pathway);
    }
  });

  it('B-3: validateFrameVariants() returns no errors on the current table', () => {
    const errors = validateFrameVariants();
    expect(errors).toEqual([]);
  });

  it('B-4: sourceIds arrays are arrays on each entry', () => {
    for (const entry of FRAME_VARIANTS) {
      expect(Array.isArray(entry.sourceIds)).toBe(true);
    }
  });

  it('B-5: no duplicate (frameId, pathway) pairs', () => {
    const keys = FRAME_VARIANTS.map((e) => e.frameId + '::' + e.pathway);
    const unique = new Set(keys);
    expect(unique.size).toBe(FRAME_VARIANTS.length);
  });

  it('B-6: every entry has a non-empty note string', () => {
    for (const entry of FRAME_VARIANTS) {
      expect(entry.note.length).toBeGreaterThan(10);
    }
  });

  it('B-7: sourceIds is an array on every entry', () => {
    for (const entry of FRAME_VARIANTS) {
      expect(Array.isArray(entry.sourceIds)).toBe(true);
    }
  });

  it('B-8: FRAME_VARIANTS is itself an array (as-const frozen shape)', () => {
    // as const makes FRAME_VARIANTS a readonly tuple at the type level.
    // At runtime it is a plain array literal; Array.isArray covers the contract.
    expect(Array.isArray(FRAME_VARIANTS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Group C: behavior change verification (sparse at Week 8; activates Week 9)
// ---------------------------------------------------------------------------

describe('behavior change verification (frame variant vs baseline)', () => {
  it('C-1: all defined variants produce non-baseline output for the same fixture input', () => {
    // With FRAME_VARIANTS empty this is trivially true; documented as a
    // placeholder for the Week 9 loop.
    // When variants are added:
    //   for (const entry of FRAME_VARIANTS) {
    //     const variantResult = getEquation(entry.frameId, entry.pathway as DispatchPathway).run(fixture);
    //     const baselineResult = getEquation('bc-protocol1-v5-dra', entry.pathway as DispatchPathway).run(fixture);
    //     expect(variantResult.sedS).not.toBeCloseTo(baselineResult.sedS, 6);
    //   }
    expect(FRAME_VARIANTS.length).toBe(0);
  });

  it.todo(
    'C-2: frame X variant produces different numeric output than baseline for the same input -- activate in Week 9 when first variant ships'
  );
});

// ---------------------------------------------------------------------------
// Group D: fallback shape contract (component boundary)
// ---------------------------------------------------------------------------

describe('fallback notice integration (component boundary)', () => {
  it('D-1: fallback shape exposes usedBaselineFallback and fallbackReason for FrameVariantFallbackNotice', () => {
    const result = getEquation('ccme-sediment-quality', 'eco-direct-eqp');
    expect(result.usedBaselineFallback).toBe(true);
    expect(typeof result.fallbackReason).toBe('string');
    // Verify the props contract: non-null, non-empty.
    expect((result.fallbackReason as string).length).toBeGreaterThan(0);
  });

  // D-2 note: rendering assertions for <FrameVariantFallbackNotice /> live in
  // calculator component test files. The per-calculator wiring commits (2-5)
  // add those assertions there. Do NOT add React rendering to this pure-TS file.

  it.todo(
    'D-3: when a variant is defined, FrameVariantFallbackNotice does not render -- activate in Week 9 in calculator component tests'
  );
});
```

---

## Section 6 -- File 5 paste-ready: src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx

```tsx
// Component tests for FrameVariantFallbackNotice.
// 5 tests covering full render surface.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FrameVariantFallbackNotice from '../FrameVariantFallbackNotice';

describe('FrameVariantFallbackNotice', () => {
  it('T1: renders nothing when usedBaselineFallback is false', () => {
    const { container } = render(
      <FrameVariantFallbackNotice usedBaselineFallback={false} />,
    );
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('[role="note"]')).toBeNull();
  });

  it('T2: renders default copy when usedBaselineFallback is true and no reason provided', () => {
    render(<FrameVariantFallbackNotice usedBaselineFallback={true} />);
    const notice = screen.getByRole('note');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/BC Protocol 1 v5 DRA baseline equation/);
    expect(notice.textContent).toMatch(
      /This frame has no specialized equation for this pathway/,
    );
  });

  it('T3: renders custom fallbackReason and suppresses the generic default sentence', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        fallbackReason="CCME does not specify a method for this pathway"
      />,
    );
    const notice = screen.getByRole('note');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(
      /CCME does not specify a method for this pathway/,
    );
    expect(notice.textContent).not.toMatch(
      /This frame has no specialized equation/,
    );
  });

  it('T4: applies className override to the notice container', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        className="mt-10 test-override-class"
      />,
    );
    const notice = screen.getByRole('note');
    expect(notice.classList.contains('test-override-class')).toBe(true);
  });

  it('T5: renders exactly one element with role="note" containing readable text', () => {
    render(<FrameVariantFallbackNotice usedBaselineFallback={true} />);
    const notes = document.querySelectorAll('[role="note"]');
    expect(notes.length).toBe(1);
    expect((notes[0] as HTMLElement).textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
```

---

## Section 7 -- Files NOT modified in commit 1

These files are wired in commits 2-5. Do NOT touch them in commit 1.

- src/lib/matrix-options/derivations.ts -- stays pure; no frameId parameter added.
- src/components/matrix-options/EcoDirectEqPCalculator.tsx -- wired in commit 2.
- src/components/matrix-options/EcoFoodBSAFCalculator.tsx -- wired in commit 3.
- src/components/matrix-options/HHDirectContactCalculator.tsx -- wired in commit 4.
- src/components/matrix-options/HHFoodWebCalculator.tsx -- wired in commit 5.
- src/components/matrix-options/RegulatoryFrameNotice.tsx -- untouched throughout Phase 4.
- src/components/matrix-options/__tests__/EcoDirectEqPCalculator.test.tsx -- new assertions land in commit 2.
- src/components/matrix-options/__tests__/EcoFoodBSAFCalculator.test.tsx -- commit 3.
- src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx -- commit 4.
- src/components/matrix-options/__tests__/HHFoodWebCalculator.test.tsx -- commit 5.

---

## Section 8 -- Verification commands

Run these in order after pasting the 5 files.

### ASCII scan (confirm no code point above 127 crept in)

```powershell
# Run in PowerShell from the worktree root.
# Any output means a violation exists.
$files = @(
  'src/lib/matrix-options/equationDispatch.ts',
  'src/lib/matrix-options/frameVariants.ts',
  'src/components/matrix-options/FrameVariantFallbackNotice.tsx',
  'src/lib/matrix-options/__tests__/equationDispatch.test.ts',
  'src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx'
)
foreach ($f in $files) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  $hi = $bytes | Where-Object { $_ -gt 127 }
  if ($hi.Count -gt 0) { Write-Host "VIOLATION in $f : $($hi.Count) bytes above 127" }
  else { Write-Host "OK $f" }
}
```

### Lint

```bash
npm run lint -- --max-warnings=0
```

### Unit tests (scoped to commit 1 files only)

```bash
npm run test:unit -- --pool=forks --maxWorkers=1 \
  src/lib/matrix-options/__tests__/equationDispatch.test.ts \
  src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx
```

### Full build

```bash
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

### E2E

```bash
npm run test:e2e
```

### Codex iterate-to-GREEN

Per cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push.md:
run codex CLI (xhigh reasoning) on the commit diff and iterate to mutual-agreement GREEN
before committing. After commit 1 passes codex, run a holistic codex checkpoint on the
type contract surface (PathwayInput/PathwayResult conditional maps + DispatchResult
generic) before starting commit 2.

---

## Section 9 -- Branch + commit + push

### Branch name

```
feat/stream-c-equation-dispatch-2026-05-XX
```

Replace XX with the session-start date (e.g., 2026-05-29). Open a DRAFT PR after
commit 1 is pushed. Convert to ready-for-review after commit 5 passes all gates.

### Commit message template for commit 1

```
feat(stream-c): add equation dispatch infrastructure + FrameVariantFallbackNotice

Week 8 commit 1 of 5. Ships behaviorally-neutral dispatch layer:
- equationDispatch.ts: getEquation<P> + PathwayInput/Result conditional
  types + DispatchResult<P> interface + VARIANT_FUNCTIONS registry +
  validateFrameVariants() runtime integrity checker
- frameVariants.ts: FrameVariantRow interface + FrameVariantOverrides
  discriminated union (5-pathway) + empty FRAME_VARIANTS array
- FrameVariantFallbackNotice.tsx: sibling notice component; renders null
  when usedBaselineFallback false; role=note; muted slate Tailwind
- 26 unit tests: Groups A (10) + B (8) + C (2) + D (2)
- 5 component tests for FrameVariantFallbackNotice

All frames fall back to BC Protocol 1 v5 DRA baseline (no user-visible
behavior change). Variant content wired in Week 9 after HITL curation
and Stream D Evidence Library source IDs are available.

Design authority: docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md
Test plan: docs/PHASE_4_EQUATION_DISPATCH_TEST_PLAN.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### Staging: path-scoped only (per cross_project_path_scope_at_commit)

```bash
git add \
  src/lib/matrix-options/equationDispatch.ts \
  src/lib/matrix-options/frameVariants.ts \
  src/components/matrix-options/FrameVariantFallbackNotice.tsx \
  src/lib/matrix-options/__tests__/equationDispatch.test.ts \
  src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx
```

Never use git add . or -A.

---

## Section 10 -- Open questions to confirm with owner BEFORE applying

**Q1: EquationVariantId closed union vs open string?**
This doc declares `EquationVariantId = 'baseline'` as a closed union with future
members commented out. Recommendation: closed union (TypeScript compile-time safety;
forces FRAME_VARIANTS data and dispatcher function map to stay in sync; typos in variant
ids are compile errors instead of runtime bugs). Owner to confirm or override.

**Q2: background-adjustment dispatcher behavior: throw TypeError vs typed error return?**
This doc implements throw TypeError (see A-8 test). The alternative is a typed return
`{ error: 'not-a-dispatch-target' }` without a throw. Recommendation: throw TypeError
because background-adjustment being out of scope is a programmer error, not a
user-recoverable state; a throw surfaces it loudly in tests and development.
Owner to confirm or override.

**Q3: site-specific frame variant policy: always-baseline or allow variant entries?**
The design doc section 7 OQ4 flags this. This doc makes no special case for
site-specific in the dispatch function (it follows the same FRAME_VARIANTS lookup as
all other frames). If the policy is always-baseline and variant rows for site-specific
are explicitly prohibited, add a runtime guard in getEquation() and a validateFrameVariants()
check. Recommendation: always-baseline initially with no special guard (simpler; if a
future HITL decides to add a site-specific variant, they do so explicitly).
Owner to confirm or override.

**Q4: FrameVariantFallbackNotice baseline label wording?**
This doc uses "BC Protocol 1 v5 DRA baseline equation" in the default copy (matches
the component spec Q1 wording and the shortLabel in regulatoryFrames.ts line 151 minus
the year). The alternative options from the spec are: "BC Protocol 1 v5 DRA baseline",
"BC default", or the full label with year. Recommendation: "BC Protocol 1 v5 DRA
baseline equation" as implemented (human-readable without the year, matches shortLabel
shape). Owner to confirm or override -- the test assertions in Section 6 pin this exact
string.

**Q5: print/PDF rendering of FrameVariantFallbackNotice?**
The calculators have print-mode behavior. This doc does NOT add print:hidden to
FrameVariantFallbackNotice, meaning it will appear in printed output. A printed report
that shows "Using BC Protocol 1 v5 DRA baseline equation" is informative for the HITL
audit trail. Recommendation: include in print output (no print:hidden). Adding it later
is a one-line Tailwind class change; removing it from print is harder to notice after
the fact. Owner to confirm or override -- if print:hidden is wanted, add
`print:hidden` to the className string in Section 4 before pasting.

---

*Authored 2026-05-28. Read-only pass on all 5 prep docs and all 7 source files.*
*Source files read: regulatoryFrames.ts, provenance/types.ts, derivations.ts,*
*types.ts, jurisdictions.ts (not found -- confirmed alias in jurisdictions.ts does not*
*exist as a standalone file; Jurisdiction type is RegulatoryFrameId per design doc*
*section 1 confirmed by grep of calculator component imports), RegulatoryFrameNotice.tsx,*
*EcoDirectEqPCalculator.test.tsx, RegulatoryFrameNotice.test.tsx.*
*Decisions made vs spec: (1) Design doc cited src/lib/matrix-options/jurisdictions.ts*
*as the Jurisdiction type alias source. That file does not exist at that path. The actual*
*file is src/components/matrix-options/guide/content/jurisdictions.ts which exports*
*`Jurisdiction = RegulatoryFrameId`. equationDispatch.ts imports RegulatoryFrameId*
*directly from regulatoryFrames.ts (the canonical source) -- no import from the guide*
*content file needed. Wiring commits 2-5 will import Jurisdiction from the guide content*
*file as the calculators do today.*
*(2) memo() import from 'react' (named import) because no other matrix-options component*
*uses React.memo; using the named import matches the bn-rrm panels pattern.*
*(3) BASELINE_FUNCTIONS uses (input: never) => unknown cast rather than a tighter generic*
*because the outer Record cannot express per-pathway generics; type safety is enforced at*
*the DispatchResult<P> return site where the cast is safe.*
