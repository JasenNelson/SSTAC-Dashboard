// Unit tests for equationDispatch.ts and the companion FRAME_VARIANTS table.
// Pure TypeScript; no React; no JSX.
// Groups A/B/C/D per docs/PHASE_4_EQUATION_DISPATCH_TEST_PLAN.md.
// Plain ASCII only.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getEquation,
  validateFrameVariants,
  applyFrameVariantOverrides,
} from '../equationDispatch';
import { FRAME_VARIANTS } from '../frameVariants';
import type { FrameVariantRow, FrameVariantOverrides } from '../frameVariants';
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

  // B-9..B-11 exercise validateFrameVariants() via its optional rows parameter
  // with synthetic rows, since FRAME_VARIANTS itself is empty at commit 1.
  // These guard the integrity-gate contract per shape spec section 4.

  it('B-9: flags a parameterOverrides tag that does not match the row pathway', () => {
    const badRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-direct-eqp',
      variant: 'baseline',
      note: 'synthetic test row for validator coverage',
      sourceIds: [],
      parameterOverrides: { pathway: 'eco-food-bsaf', ecoFoodBsaf: {} },
    } as FrameVariantRow;
    const errors = validateFrameVariants([badRow]);
    expect(errors.some((e) => e.includes('does not match row.pathway'))).toBe(true);
  });

  it('B-10: rejects a baseline-variant row carrying parameterOverrides (must declare a non-baseline variant)', () => {
    // The temporary "not yet applied" tripwire is gone (injection is implemented),
    // but an override row must declare a NON-baseline variant id: a baseline row
    // with overrides would suppress the fallback notice while running the baseline
    // equation with injected values. With no non-baseline variant registered yet
    // (FRAME_VARIANTS empty, real variants owner-gated), every synthetic override
    // row uses variant 'baseline' and is therefore correctly rejected here.
    const overrideRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-food-bsaf',
      variant: 'baseline',
      note: 'synthetic test row for validator coverage',
      sourceIds: ['test-source-uuid'],
      parameterOverrides: {
        pathway: 'eco-food-bsaf',
        ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
      },
    } as FrameVariantRow;
    const errors = validateFrameVariants([overrideRow]);
    expect(errors.some((e) => e.includes('must declare a non-baseline variant'))).toBe(true);
  });

  it('B-12: flags an override row with empty sourceIds (provenance guard)', () => {
    // A parameterOverrides row is real frame-level parameter data; it requires
    // HITL-verified catalog_sources IDs regardless of variant id.
    const overrideRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-food-bsaf',
      variant: 'baseline',
      note: 'synthetic test row for validator coverage',
      sourceIds: [],
      parameterOverrides: {
        pathway: 'eco-food-bsaf',
        ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
      },
    } as FrameVariantRow;
    const errors = validateFrameVariants([overrideRow]);
    expect(errors.some((e) => e.includes('parameterOverrides but has empty'))).toBe(true);
  });

  it('B-11: returns no errors for a clean baseline row without overrides', () => {
    const cleanRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-food-bsaf',
      variant: 'baseline',
      note: 'synthetic test row for validator coverage',
      sourceIds: [],
    } as FrameVariantRow;
    expect(validateFrameVariants([cleanRow])).toEqual([]);
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

// ---------------------------------------------------------------------------
// Group E: parameter-override injection
// (applyFrameVariantOverrides pure-merge contract + getEquation integration via
// the rows test seam; FRAME_VARIANTS itself stays empty in production)
// ---------------------------------------------------------------------------

describe('frame-variant override injection', () => {
  it('E-1: injects an allowlisted eco-food-bsaf key (BSAF_loc_freshwater)', () => {
    const out = applyFrameVariantOverrides('eco-food-bsaf', ECO_FOOD_BSAF_FIXTURE, {
      pathway: 'eco-food-bsaf',
      ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
    });
    expect(out.BSAF_loc_freshwater).toBe(1.2);
    // Untouched keys carry through.
    expect(out.TRV_eco_mg_per_kg_bw_day).toBe(ECO_FOOD_BSAF_FIXTURE.TRV_eco_mg_per_kg_bw_day);
  });

  it('E-2: ignores a NON-overridable key smuggled into the override block', () => {
    // foc is site-measured, not frame-overridable. An as-cast block carrying it
    // must not reach the equation input (explicit allowlist, not blind spread).
    const overrides = {
      pathway: 'eco-food-bsaf',
      ecoFoodBsaf: { foc: 0.99, BSAF_loc_freshwater: 1.2 },
    } as unknown as FrameVariantOverrides;
    const out = applyFrameVariantOverrides('eco-food-bsaf', ECO_FOOD_BSAF_FIXTURE, overrides);
    expect(out.foc).toBe(ECO_FOOD_BSAF_FIXTURE.foc);
    expect(out.BSAF_loc_freshwater).toBe(1.2);
  });

  it('E-3: skips an override value of undefined (input value retained)', () => {
    const overrides = {
      pathway: 'eco-food-bsaf',
      ecoFoodBsaf: { BSAF_loc_freshwater: undefined },
    } as unknown as FrameVariantOverrides;
    const out = applyFrameVariantOverrides('eco-food-bsaf', ECO_FOOD_BSAF_FIXTURE, overrides);
    expect(out.BSAF_loc_freshwater).toBe(ECO_FOOD_BSAF_FIXTURE.BSAF_loc_freshwater);
  });

  it('E-4: preserves an override value of null (meaningful "risk driver N/A")', () => {
    const out = applyFrameVariantOverrides('human-health-direct', HH_DIRECT_FIXTURE, {
      pathway: 'human-health-direct',
      humanHealthDirect: { rfd_oral_mg_per_kg_bw_day: null },
    });
    expect(out.rfd_oral_mg_per_kg_bw_day).toBeNull();
  });

  it('E-5: does not mutate the original input object', () => {
    const before = ECO_FOOD_BSAF_FIXTURE.BSAF_loc_freshwater;
    applyFrameVariantOverrides('eco-food-bsaf', ECO_FOOD_BSAF_FIXTURE, {
      pathway: 'eco-food-bsaf',
      ecoFoodBsaf: { BSAF_loc_freshwater: 9.9 },
    });
    expect(ECO_FOOD_BSAF_FIXTURE.BSAF_loc_freshwater).toBe(before);
  });

  it('E-6: throws TypeError when overrides.pathway does not match the requested pathway', () => {
    expect(() =>
      applyFrameVariantOverrides('eco-direct-eqp', ECO_DIRECT_EQP_FIXTURE, {
        pathway: 'eco-food-bsaf',
        ecoFoodBsaf: { BSAF_loc_freshwater: 1.2 },
      }),
    ).toThrow(TypeError);
  });

  it('E-7: human-health-food allowlist excludes hh-direct-only keys', () => {
    // abs_dermal and IR_sed_mg_per_day are hh-direct keys; an as-cast hh-food
    // block carrying them must not inject (hh-food has neither field).
    const overrides = {
      pathway: 'human-health-food',
      humanHealthFood: { abs_dermal: 0.5, IR_food_kg_per_day: 0.3 },
    } as unknown as FrameVariantOverrides;
    const out = applyFrameVariantOverrides(
      'human-health-food',
      HH_FOOD_FIXTURE,
      overrides,
    ) as unknown as Record<string, unknown>;
    expect(out.abs_dermal).toBeUndefined();
    expect(out.IR_food_kg_per_day).toBe(0.3);
  });

  it('E-8: getEquation injects overrides via the rows seam and changes output vs baseline', () => {
    // getEquation is the runtime dispatcher; it does NOT call validateFrameVariants
    // (that integrity gate runs at dev-init / in the B-group tests). This test
    // exercises getEquation's injection mechanics in isolation using a baseline
    // row -- the only registered variant function -- which the validator would
    // reject in production (B-10); here it isolates the runtime injection path.
    const overrideRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-direct-eqp',
      variant: 'baseline',
      note: 'synthetic injection test row',
      sourceIds: ['test-source-uuid'],
      parameterOverrides: {
        pathway: 'eco-direct-eqp',
        ecoDirectEqp: { fcv_ug_per_L: 0.14 },
      },
    } as FrameVariantRow;

    const injected = getEquation('ccme-sediment-quality', 'eco-direct-eqp', [overrideRow]);
    expect(injected.usedBaselineFallback).toBe(false);

    const injectedOut = injected.run(ECO_DIRECT_EQP_FIXTURE);
    const baselineOut = getEquation('ccme-sediment-quality', 'eco-direct-eqp').run(
      ECO_DIRECT_EQP_FIXTURE,
    );
    // fcv_ug_per_L 0.014 -> 0.14 scales the sediment standard ~10x.
    expect(injectedOut.sedS).not.toBeCloseTo(baselineOut.sedS, 6);
  });

  it('E-9: getEquation with default rows (empty FRAME_VARIANTS) is unchanged (baseline fallback)', () => {
    const result = getEquation('ccme-sediment-quality', 'eco-direct-eqp');
    expect(result.usedBaselineFallback).toBe(true);
    expect(result.variant).toBe('baseline');
    // Fallback path exposes no overrides.
    expect(result.parameterOverrides).toBeUndefined();
  });

  it('E-10: getEquation exposes matched parameterOverrides so callers can build the effective input', () => {
    // The override data is surfaced on the result, NOT hidden only inside run().
    // A caller validates inputs and builds provenance from the EFFECTIVE input,
    // which must equal what run() computes with -- so the override must be
    // visible before the caller calls run().
    const overrideRow = {
      frameId: 'ccme-sediment-quality',
      pathway: 'eco-direct-eqp',
      variant: 'baseline',
      note: 'synthetic injection test row',
      sourceIds: ['test-source-uuid'],
      parameterOverrides: {
        pathway: 'eco-direct-eqp',
        ecoDirectEqp: { fcv_ug_per_L: 0.14 },
      },
    } as FrameVariantRow;

    const dispatched = getEquation('ccme-sediment-quality', 'eco-direct-eqp', [overrideRow]);
    expect(dispatched.parameterOverrides).toEqual({
      pathway: 'eco-direct-eqp',
      ecoDirectEqp: { fcv_ug_per_L: 0.14 },
    });

    // The caller builds the effective input from the exposed overrides and would
    // validate / build provenance from it; it matches what run() computes with.
    const effective = applyFrameVariantOverrides(
      'eco-direct-eqp',
      ECO_DIRECT_EQP_FIXTURE,
      dispatched.parameterOverrides as FrameVariantOverrides,
    );
    expect(effective.fcv_ug_per_L).toBe(0.14);
    expect(dispatched.run(ECO_DIRECT_EQP_FIXTURE).sedS).toBeCloseTo(
      dispatched.run(effective).sedS,
      10,
    );
  });
});
