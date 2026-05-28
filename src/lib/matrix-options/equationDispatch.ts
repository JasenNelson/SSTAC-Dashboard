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
    // NOTE: match.parameterOverrides is NOT yet injected into the input here.
    // The shape spec (PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md section 3) calls for
    // overrides to be merged into the equation input before call; that injection
    // is deferred to the variant-wiring commit. validateFrameVariants() blocks
    // any row carrying parameterOverrides until that injection lands, so an
    // overrides-bearing row cannot reach this branch and silently compute with
    // un-overridden inputs.
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

    // TEMPORARY TRIPWIRE (remove in the commit that implements override
    // injection): getEquation does not yet inject parameterOverrides into the
    // equation input (shape spec: "injected into the equation input before
    // call"). Until that injection lands, a row carrying parameterOverrides
    // would silently compute with un-overridden inputs. Fail loudly so no such
    // row ships before the dispatcher applies overrides.
    if (row.parameterOverrides !== undefined) {
      errors.push(
        'Index ' + i + ': parameterOverrides are not yet applied by getEquation ' +
          '(input injection unimplemented). Do not ship a row with ' +
          'parameterOverrides until the dispatcher injects them. See the ' +
          'variant-resolution branch in equationDispatch.ts.',
      );
    }
  }

  return errors;
}
