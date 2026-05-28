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
