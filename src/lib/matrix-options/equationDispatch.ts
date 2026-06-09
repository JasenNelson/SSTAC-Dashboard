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
import type { FrameVariantRow, FrameVariantOverrides } from './frameVariants';

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
  /**
   * The matched variant's frame-level parameter overrides, when present
   * (undefined on the baseline-fallback path and for override-less variants).
   *
   * IMPORTANT for callers (calculator wiring): run() applies these overrides to
   * the equation input internally, but a caller that ALSO validates inputs or
   * builds "values used in this calculation" provenance rows MUST first compute
   * the effective input via
   *   applyFrameVariantOverrides(pathway, input, parameterOverrides)
   * and validate / build provenance from THAT, so the displayed values match the
   * values that actually produced sedS. (run() re-applying the same value
   * overrides is idempotent, so there is no double-application hazard.) Exposing
   * the overrides here -- rather than hiding them solely inside run() -- also
   * lets a frame supply a value the user left blank without the caller's
   * pre-override validation wrongly rejecting it.
   */
  parameterOverrides?: FrameVariantOverrides;
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
// Frame-variant parameter-override injection.
//
// applyFrameVariantOverrides merges a frame variant's parameterOverrides onto
// the equation input BEFORE the variant function runs. Only the per-pathway
// ALLOWLISTED keys are copied; site-measured / per-assessment inputs are never
// frame-overridable (shape spec section 5 "NOT overridable" column). An
// override value of `undefined` is skipped (the key was not overridden); a
// `null` is preserved -- a null rfd/sf is a MEANINGFUL "risk driver not
// applicable" override, not an absence.
// ---------------------------------------------------------------------------

type DispatchPathway = Exclude<ProvenancePathway, 'background-adjustment'>;

// The camelCase property on a FrameVariantOverrides block that holds each
// pathway's override values (frameVariants.ts discriminated union).
const OVERRIDE_BLOCK_KEY: Record<DispatchPathway, string> = {
  'eco-direct-eqp': 'ecoDirectEqp',
  'eco-food-bsaf': 'ecoFoodBsaf',
  'human-health-direct': 'humanHealthDirect',
  'human-health-food': 'humanHealthFood',
};

// The keys a frame variant MAY override, per pathway (shape spec section 5).
// Iterating this explicit allowlist (rather than the block's own keys) means a
// malformed (as-cast) override block carrying a non-overridable key cannot
// smuggle it into the equation input. Note human-health-food is a DISTINCT set
// from human-health-direct: it has no abs_dermal and no IR_sed_mg_per_day.
const OVERRIDABLE_KEYS: Record<DispatchPathway, readonly string[]> = {
  'eco-direct-eqp': ['fcv_ug_per_L', 'acknowledgeBlackCarbon'],
  'eco-food-bsaf': [
    'BSAF_loc_freshwater',
    'TRV_eco_mg_per_kg_bw_day',
    'Fsite',
    'BW_eco_kg',
    'IR_eco_kg_per_day',
  ],
  'human-health-direct': [
    'rfd_oral_mg_per_kg_bw_day',
    'sf_oral_per_mg_per_kg_bw_per_day',
    'abs_dermal',
    'ba_oral',
    'IR_sed_mg_per_day',
  ],
  'human-health-food': [
    'rfd_oral_mg_per_kg_bw_day',
    'sf_oral_per_mg_per_kg_bw_per_day',
    'IR_food_kg_per_day',
    'BSAF_loc_freshwater',
    'ba_oral',
  ],
};

/**
 * Merge a frame variant's parameterOverrides onto an equation input.
 *
 * Pure function (no side effects; does not mutate `input`). Returns a new input
 * with only the per-pathway allowlisted keys replaced by the override values.
 * Exported so it can be unit-tested directly with synthetic override blocks
 * without populating FRAME_VARIANTS.
 *
 * Throws TypeError when overrides.pathway does not match the requested pathway
 * (a programming error; the FRAME_VARIANTS validator already blocks such rows,
 * but this guard protects direct callers).
 */
export function applyFrameVariantOverrides<P extends DispatchPathway>(
  pathway: P,
  input: PathwayInput<P>,
  overrides: FrameVariantOverrides,
): PathwayInput<P> {
  if (overrides.pathway !== pathway) {
    throw new TypeError(
      'applyFrameVariantOverrides: overrides.pathway "' +
        overrides.pathway +
        '" does not match the requested pathway "' +
        pathway +
        '". A pathway-mismatched override block must not be applied.',
    );
  }

  const blockKey = OVERRIDE_BLOCK_KEY[pathway];
  const block = (overrides as unknown as Record<string, unknown>)[blockKey] as
    | Record<string, unknown>
    | undefined;
  if (block === undefined) {
    // No override block present: run with the user inputs unchanged.
    return input;
  }

  const merged: Record<string, unknown> = {
    ...(input as unknown as Record<string, unknown>),
  };
  for (const key of OVERRIDABLE_KEYS[pathway]) {
    const value = block[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as unknown as PathwayInput<P>;
}

// ---------------------------------------------------------------------------
// resolveBaselineFallbackReason: produce a consistent fallback reason string.
// ---------------------------------------------------------------------------
function resolveBaselineFallbackReason(
  frameId: RegulatoryFrameId,
  pathway: ProvenancePathway,
): string {
  // NOTE: do not repeat the "Using BC Protocol 1 v5 DRA baseline" lead sentence
  // here -- FrameVariantFallbackNotice already prepends it. This string only
  // explains WHY the fallback happened, to avoid a duplicated baseline phrase
  // in the rendered notice.
  return (
    'No specialized equation is defined for frame "' +
    frameId +
    '" on the "' +
    pathway +
    '" pathway.'
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
  rows: readonly FrameVariantRow[] = FRAME_VARIANTS,
): DispatchResult<P> {
  // Guard: background-adjustment is not a dispatch target.
  if ((pathway as string) === 'background-adjustment') {
    throw new TypeError(
      'getEquation: "background-adjustment" is frame-invariant and is not a ' +
        'dispatch target. Call utl9595() or avsSemCheck() from derivations.ts ' +
        'directly. See STREAM_C_EQUATION_DISPATCH_DESIGN.md anti-pattern 1.',
    );
  }

  // Look up a frame-specific variant entry. `rows` defaults to the module-level
  // FRAME_VARIANTS (empty at commit 1); the parameter is a test seam so the
  // injection path can be exercised with synthetic rows while FRAME_VARIANTS
  // stays empty in production.
  const match: FrameVariantRow | undefined = rows.find(
    (row) => row.frameId === frameId && row.pathway === pathway,
  );

  if (match !== undefined) {
    // A real variant is defined. Resolve its function.
    // match.parameterOverrides (when present) ARE injected into the equation
    // input below, via applyFrameVariantOverrides, before the variant function
    // runs (shape spec PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md section 3).
    const variantFns = VARIANT_FUNCTIONS[match.variant];
    if (variantFns === undefined || variantFns[pathway] === undefined) {
      // Programmer error: a row references a variant id that has no registered
      // function. Fail loudly so it is caught before it reaches prod.
      throw new ReferenceError(
        'getEquation: variant "' +
          match.variant +
          '" is referenced in FRAME_VARIANTS for pathway "' +
          pathway +
          '" but has no registered function in VARIANT_FUNCTIONS. ' +
          'Add the function in the same commit as the FRAME_VARIANTS row.',
      );
    }
    const variantFn = variantFns[pathway] as (
      input: PathwayInput<P>,
    ) => PathwayResult<P>;
    const overrides: FrameVariantOverrides | undefined = match.parameterOverrides;
    return {
      variant: match.variant,
      usedBaselineFallback: false,
      run:
        overrides === undefined
          ? variantFn
          : (input: PathwayInput<P>) =>
              variantFn(applyFrameVariantOverrides(pathway, input, overrides)),
      // Surface the overrides so callers can build the effective input for
      // validation + provenance (see DispatchResult.parameterOverrides).
      parameterOverrides: overrides,
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
export function validateFrameVariants(
  rows: readonly FrameVariantRow[] = FRAME_VARIANTS,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as FrameVariantRow;
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

    // parameterOverrides tag must match the row's pathway (shape spec section 4
    // rule 4). FrameVariantRow does not type-correlate these two fields, so a
    // mismatched override block would otherwise pass the integrity gate and be
    // applied to the wrong equation input shape once injection is implemented.
    if (
      row.parameterOverrides !== undefined &&
      row.parameterOverrides.pathway !== row.pathway
    ) {
      errors.push(
        'Index ' + i + ': parameterOverrides.pathway "' +
          row.parameterOverrides.pathway +
          '" does not match row.pathway "' + row.pathway + '".',
      );
    }

    // Provenance guard: a row carrying parameterOverrides is real frame-level
    // parameter data and therefore requires HITL-verified catalog_sources IDs
    // (shape spec stop-condition 3), REGARDLESS of variant id. The
    // variant !== 'baseline' sourceIds check above does not cover an
    // overrides-bearing baseline row, so enforce non-empty sourceIds explicitly
    // here now that getEquation injects overrides.
    if (row.parameterOverrides !== undefined && row.sourceIds.length === 0) {
      errors.push(
        'Index ' + i + ': row carries parameterOverrides but has empty ' +
          'sourceIds. Every parameter-override row requires HITL-verified ' +
          'catalog_sources IDs.',
      );
    }

    // A parameterOverrides row MUST declare a non-baseline variant id. A
    // baseline-variant row carrying overrides would make getEquation return
    // usedBaselineFallback: false (suppressing FrameVariantFallbackNotice, which
    // keys only off that flag) while still running the baseline equation with
    // injected values -- a frame-specific parameter change shipping invisibly
    // with no real variant id. Real override rows add an EquationVariantId member
    // + registered function in the same commit (shape spec section 8 migration
    // checklist), so a baseline+overrides row is always a contract error.
    if (row.parameterOverrides !== undefined && row.variant === 'baseline') {
      errors.push(
        'Index ' + i + ': row carries parameterOverrides but uses variant ' +
          '"baseline". An override row must declare a non-baseline variant id ' +
          '(add the EquationVariantId member + registered function in the same ' +
          'commit, per the migration checklist).',
      );
    }
  }

  return errors;
}
