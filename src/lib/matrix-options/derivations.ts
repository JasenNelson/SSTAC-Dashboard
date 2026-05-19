// Pure-TS derivation functions for the matrix-options calculator (v1).
// All formulas track the .tmp_calculator_design_v1.md spec.
// Plain ASCII only. No React. Unit-testable in isolation.

import type {
  AvsSemInput,
  AvsSemResult,
  EcoDirectEqPInput,
  EcoDirectEqPResult,
  EcoFoodBSAFInput,
  EcoFoodBSAFResult,
  Utl9595Result,
} from './types';
import { lookupK9595 } from './utlTable';

// EqP validity window for f_oc (mass fraction of organic carbon).
// See design doc section 2.1 caveats.
const FOC_MIN = 0.002; // 0.2 %
const FOC_MAX = 0.10; // 10 %
const TOC_HARD_REJECT = 0.30; // 30 %, requires acknowledgeBlackCarbon flag
// Defensive upper bound on |logKow| to prevent Math.pow(10, large) from
// returning Infinity and silently passing through to verdict. The Di Toro
// regression is calibrated for organic chemicals in the ~1 to 7 range;
// values outside that window are non-physical for non-ionic organics.
// Opus adversarial review P3 2026-05-18: forward-looking insurance for any
// future HITL logKow-override path (logKow is library-locked in v1).
const LOGKOW_MAX_ABS = 10;

/**
 * Compute the one-sided 95/95 upper tolerance limit for a vector of
 * reference samples. Uses the sample mean, sample standard deviation
 * (n - 1 denominator), and the tabulated K_{95/95} factor.
 *
 * See design doc section 3 for the formula:
 *   UTL_{95/95} = mean + K * sd
 *
 * Throws if samples has fewer than 2 entries (sd is undefined).
 */
export function utl9595(samples: number[]): Utl9595Result {
  if (!Array.isArray(samples)) {
    throw new TypeError('utl9595: samples must be an array of numbers');
  }
  const cleaned = samples.filter((v) => Number.isFinite(v));
  if (cleaned.length < 2) {
    throw new RangeError(
      `utl9595: need at least 2 finite samples, got ${cleaned.length}`,
    );
  }

  const n = cleaned.length;
  const mean = cleaned.reduce((acc, v) => acc + v, 0) / n;
  const sumSqDev = cleaned.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  // Sample standard deviation (Bessel-corrected; n - 1 denominator).
  const sd = Math.sqrt(sumSqDev / (n - 1));
  const { K, warning } = lookupK9595(n);
  const utl = mean + K * sd;
  // Propagate clamp warnings (n < 5 or n > 100) so the UI can mark the
  // verdict as screening-only when the K factor was approximated rather
  // than tabulated. Codex P2 finding 2026-05-18.
  const warnings: string[] = warning ? [warning] : [];

  return { mean, sd, n, K, utl, warnings };
}

/**
 * Eco-Direct EqP sediment standard for non-ionic organics.
 * See design doc section 2.1.
 *
 * Implements the Di Toro K_oc regression + EqP partitioning:
 *   log K_oc = 0.00028 + 0.983 * log K_ow
 *   ESB_oc   = FCV * K_oc * 1e-3     (mg/kg-OC; FCV ug/L -> mg/L is 1e-3)
 *   SedS     = ESB_oc * f_oc         (mg/kg dry)
 *
 * Note: the Phase 2 Options Paper section 2.1 prose says the FCV
 * conversion factor is 1e-6, but that contradicts the doc's own Anchor
 * Case A worked example (1e-3 is the correct ug/L -> mg/L conversion);
 * implementation tracks the worked example. See the INTERPRETATION
 * NOTE inside the function body for the audit trail.
 *
 * Input validation per design doc caveats:
 *  - Rejects (does not compute) if foc < 0.002 or foc > 0.10 by surfacing
 *    a warning. The numeric SedS is still computed so the UI can show
 *    the user the consequence, but the caller MUST treat the warning as
 *    a blocker before quoting the result in a regulatory submission.
 *  - If foc > 0.30 the function additionally requires the
 *    acknowledgeBlackCarbon flag; without it the function throws.
 */
export function ecoDirectEqP(input: EcoDirectEqPInput): EcoDirectEqPResult {
  const { Cs_mg_per_kg, foc, logKow, fcv_ug_per_L, acknowledgeBlackCarbon } =
    input;

  if (!Number.isFinite(foc) || foc <= 0) {
    throw new RangeError('ecoDirectEqP: foc must be a positive finite number');
  }
  if (!Number.isFinite(logKow)) {
    throw new RangeError('ecoDirectEqP: logKow must be a finite number');
  }
  if (Math.abs(logKow) > LOGKOW_MAX_ABS) {
    throw new RangeError(
      `ecoDirectEqP: |logKow| = ${Math.abs(logKow)} exceeds physical ` +
        `plausibility bound (${LOGKOW_MAX_ABS}). The Di Toro K_oc regression ` +
        'is calibrated for non-ionic organics with logKow approximately ' +
        '1 to 7; extreme values yield Infinity through Math.pow.',
    );
  }
  if (!Number.isFinite(fcv_ug_per_L) || fcv_ug_per_L <= 0) {
    throw new RangeError(
      'ecoDirectEqP: fcv_ug_per_L must be a positive finite number',
    );
  }

  if (foc > TOC_HARD_REJECT && !acknowledgeBlackCarbon) {
    throw new RangeError(
      `ecoDirectEqP: foc = ${foc} exceeds 0.30 hard-reject threshold for ` +
        'woodwaste / black-carbon sites. Pass acknowledgeBlackCarbon: true ' +
        'after confirming the lab subtracted non-humic carbon fractions ' +
        '(design doc section 8.6).',
    );
  }

  const warnings: string[] = [];
  // Per design doc section 2.1: foc outside [0.002, 0.10] is "reject (do
  // not compute)" -- the EqP partitioning assumption is invalid there.
  // We compute sedS anyway for diagnostic display but suppress the verdict
  // and set blocked = true so callers cannot quote the number as a
  // regulatory benchmark. Codex P2 finding 2026-05-18.
  let blocked = false;
  if (foc < FOC_MIN) {
    warnings.push(
      `foc = ${foc} is below EqP validity window minimum (${FOC_MIN}); ` +
        'mineral sorption dominates and EqP partitioning is invalid. ' +
        'Verdict suppressed (design doc section 2.1 caveats).',
    );
    blocked = true;
  }
  if (foc > FOC_MAX) {
    warnings.push(
      `foc = ${foc} is above EqP validity window maximum (${FOC_MAX}); ` +
        'woody / black carbon distorts equilibrium. Sieve and re-measure, ' +
        'or cap foc at 0.10. Verdict suppressed ' +
        '(design doc section 2.1 / 8.6).',
    );
    blocked = true;
  }
  if (Number.isFinite(Cs_mg_per_kg) && Cs_mg_per_kg < 0) {
    warnings.push(
      `Cs_mg_per_kg = ${Cs_mg_per_kg} is negative; site analytical ` +
        'concentrations must be non-negative. Verdict suppressed. ' +
        'Codex P2 finding 2026-05-18.',
    );
    blocked = true;
  }

  // Di Toro regression.
  const logKoc = 0.00028 + 0.983 * logKow;
  const Koc = Math.pow(10, logKoc);
  // INTERPRETATION NOTE: The design doc section 2.1 formula text says
  // "10^-6 converts FCV from ug/L to mg/L", but the correct unit
  // conversion is 1 ug/L = 1e-3 mg/L (NOT 1e-6). The design doc's own
  // Anchor Case A numeric worked example (section 7, expected SedS =
  // 0.2974 mg/kg at foc = 0.020, log K_ow = 6.13, FCV = 0.014 ug/L) is
  // internally consistent only with the 1e-3 conversion, so we follow
  // the worked example. Surfaced in the agent report to the
  // orchestrator for owner ratification.
  // FCV (ug/L) * 1e-3 -> mg/L; mg/L * K_oc (L/kg-OC) -> mg/kg-OC.
  const ESBoc = fcv_ug_per_L * Koc * 1e-3;
  const sedS = ESBoc * foc;

  let verdict: 'PASS' | 'FAIL' | null = null;
  if (!blocked && Number.isFinite(Cs_mg_per_kg) && Cs_mg_per_kg >= 0) {
    verdict = Cs_mg_per_kg <= sedS ? 'PASS' : 'FAIL';
  }

  return {
    logKoc,
    Koc_L_per_kg_OC: Koc,
    ESBoc_mg_per_kg_OC: ESBoc,
    sedS,
    verdict,
    warnings,
    blocked,
  };
}

/**
 * AVS / SEM mass-balance check for divalent metals (Cd, Cu, Pb, Ni, Zn).
 * See design doc section 2.1 ("divalent metals path").
 *
 * If sum(SEM) - AVS <= 0 the sediment is predicted non-toxic to benthic
 * organisms via the AVS-binding mechanism; the Tier 1 generic standard
 * passes through unchanged.
 */
export function avsSemCheck(input: AvsSemInput): AvsSemResult {
  const { semSum_umol_per_g, avs_umol_per_g } = input;

  if (!Number.isFinite(semSum_umol_per_g) || semSum_umol_per_g < 0) {
    throw new RangeError(
      'avsSemCheck: semSum_umol_per_g must be a non-negative finite number',
    );
  }
  if (!Number.isFinite(avs_umol_per_g) || avs_umol_per_g < 0) {
    throw new RangeError(
      'avsSemCheck: avs_umol_per_g must be a non-negative finite number',
    );
  }

  const delta = semSum_umol_per_g - avs_umol_per_g;
  return {
    deltaSEMminusAVS: delta,
    nonToxic: delta <= 0,
  };
}

// ---------------------------------------------------------------------------
// Eco-Food BSAF pathway (slice 2)
// ---------------------------------------------------------------------------

// Lipid fraction screening window per design doc section 2.2 inputs table.
// Outside the window the result is screening-only (warning, not blocked).
const FLIPID_MIN = 0.01;
const FLIPID_MAX = 0.15;
// Site-use fraction screening window. Outside the window we surface a
// warning but DO NOT block; the HITL may pick a defensible value outside
// the tabulated range for unusual species / life histories.
const FSITE_MIN = 0.05;
const FSITE_MAX = 1.0;
// Default protein fraction for the MeHg path (fish muscle).
const F_PROTEIN_DEFAULT = 0.18;
// Ecosystem multipliers per design doc sections 2.2 + 8.2.
//  - freshwater: 1
//  - estuarine: 5 (midpoint between freshwater 1 and coastal-marine PAH 15)
//  - coastal-marine: 15 for PAH-class ONLY (organic-PAH); 1 otherwise. The
//    BSAF DB rationale is bivalve passive accumulation of high-MW PAHs in
//    the absence of hepatic CYP1A biotransformation; PCBs / dioxins
//    biomagnify rather than passively accumulate so their library BSAFs
//    are already trophic-corrected and must NOT be multiplied by 15.
const M_ECO_FRESHWATER = 1;
const M_ECO_ESTUARINE = 5;
const M_ECO_COASTAL_PAH = 15;

/**
 * Eco-Food BSAF sediment standard (wildlife / fish receptor).
 * See design doc section 2.2.
 *
 * General back-calculation:
 *   BSAF_effective = BSAF_loc * (fLipid / foc) * M_eco
 *   SedS = (TRV * BW) / (IR * BSAF_effective * Fsite)
 *
 * MeHg exception (design doc section 2.2 "Methylmercury exception" +
 * section 8.3): MeHg binds covalently to protein thiols rather than
 * partitioning into lipid. The library-supplied BSAF for MeHg is the
 * protein-normalized form per the design doc definition:
 *   BSAF_MeHg = (C_t / f_protein) / (C_s / f_oc), range 10-30, default 15.
 * To back-calculate SedS we still need C_t / C_s, so the operative
 * effective BSAF for the back-calculation is
 *   BSAF_effective = BSAF_MeHg * (f_protein / f_oc) * M_eco
 * (analogous to the lipid case BSAF_loc * (f_lipid / f_oc) * M_eco).
 * f_protein defaults to 0.18 (fish muscle) when not supplied.
 * Codex P1 finding 2026-05-19: an earlier interpretation dropped the
 * (f_protein / f_oc) factor and produced MeHg SedS values about 9x too
 * high at default f_protein=0.18 / f_oc=0.02 -- under-protective and
 * unacceptable on a regulatory calculator.
 *
 * Coastal-marine multiplier (M_eco = 15) only applies to the
 * organic-PAH class; all other contaminant classes use M_eco = 1 in
 * coastal-marine systems AND surface a screening warning so the HITL
 * is aware the selector did not produce the expected multiplier.
 *
 * Input validation:
 *  - TRV, BW, IR, BSAF_loc must each be positive finite numbers (throw).
 *  - foc must be positive finite (throw). Outside [0.002, 0.10] sets
 *    blocked = true + warning. Above 0.30 requires acknowledgeBlackCarbon
 *    or the function throws (mirroring the EcoDirect EqP pattern).
 *  - fLipid outside [0.01, 0.15] -> screening warning, not blocked.
 *  - Fsite outside [0.05, 1.0] -> screening warning, not blocked.
 */
export function ecoFoodBSAF(input: EcoFoodBSAFInput): EcoFoodBSAFResult {
  const {
    TRV_eco_mg_per_kg_bw_day,
    BW_eco_kg,
    IR_eco_kg_per_day,
    BSAF_loc_freshwater,
    fLipid,
    foc,
    Fsite,
    ecosystem,
    contaminantClass,
    fProtein,
    acknowledgeBlackCarbon,
  } = input;

  if (
    !Number.isFinite(TRV_eco_mg_per_kg_bw_day) ||
    TRV_eco_mg_per_kg_bw_day <= 0
  ) {
    throw new RangeError(
      'ecoFoodBSAF: TRV_eco_mg_per_kg_bw_day must be a positive finite number',
    );
  }
  if (!Number.isFinite(BW_eco_kg) || BW_eco_kg <= 0) {
    throw new RangeError(
      'ecoFoodBSAF: BW_eco_kg must be a positive finite number',
    );
  }
  if (!Number.isFinite(IR_eco_kg_per_day) || IR_eco_kg_per_day <= 0) {
    throw new RangeError(
      'ecoFoodBSAF: IR_eco_kg_per_day must be a positive finite number',
    );
  }
  if (
    !Number.isFinite(BSAF_loc_freshwater) ||
    BSAF_loc_freshwater <= 0
  ) {
    throw new RangeError(
      'ecoFoodBSAF: BSAF_loc_freshwater must be a positive finite number',
    );
  }
  if (!Number.isFinite(foc) || foc <= 0) {
    throw new RangeError(
      'ecoFoodBSAF: foc must be a positive finite number',
    );
  }
  if (!Number.isFinite(fLipid) || fLipid <= 0) {
    throw new RangeError(
      'ecoFoodBSAF: fLipid must be a positive finite number',
    );
  }
  if (!Number.isFinite(Fsite) || Fsite <= 0) {
    throw new RangeError(
      'ecoFoodBSAF: Fsite must be a positive finite number',
    );
  }
  if (fProtein !== undefined) {
    if (!Number.isFinite(fProtein) || fProtein <= 0) {
      throw new RangeError(
        'ecoFoodBSAF: fProtein, when supplied, must be a positive finite number',
      );
    }
  }

  if (foc > TOC_HARD_REJECT && !acknowledgeBlackCarbon) {
    throw new RangeError(
      `ecoFoodBSAF: foc = ${foc} exceeds 0.30 hard-reject threshold for ` +
        'woodwaste / black-carbon sites. Pass acknowledgeBlackCarbon: true ' +
        'after confirming the lab subtracted non-humic carbon fractions ' +
        '(design doc section 8.6).',
    );
  }

  const warnings: string[] = [];
  let blocked = false;

  // foc validity window (same as EcoDirect EqP).
  if (foc < FOC_MIN) {
    warnings.push(
      `foc = ${foc} is below EqP validity window minimum (${FOC_MIN}); ` +
        'mineral sorption dominates and the lipid/OC normalization is ' +
        'invalid. Verdict suppressed (design doc section 2.1 caveats).',
    );
    blocked = true;
  }
  if (foc > FOC_MAX) {
    warnings.push(
      `foc = ${foc} is above EqP validity window maximum (${FOC_MAX}); ` +
        'woody / black carbon distorts the OC-normalized BSAF. Sieve and ' +
        're-measure, or cap foc at 0.10. Verdict suppressed ' +
        '(design doc section 2.1 / 8.6).',
    );
    blocked = true;
  }

  // fLipid screening window: warn but do not block.
  if (fLipid < FLIPID_MIN || fLipid > FLIPID_MAX) {
    warnings.push(
      `fLipid = ${fLipid} is outside the typical screening range ` +
        `[${FLIPID_MIN}, ${FLIPID_MAX}]; result is screening-only. ` +
        'Confirm tissue lipid content with site-specific data ' +
        '(design doc section 2.2 inputs table).',
    );
  }

  // Fsite screening window: warn but do not block.
  if (Fsite < FSITE_MIN || Fsite > FSITE_MAX) {
    warnings.push(
      `Fsite = ${Fsite} is outside the typical range ` +
        `[${FSITE_MIN}, ${FSITE_MAX}]; result is screening-only. ` +
        'HITL should document species life-history rationale for the ' +
        'value (design doc section 8.4).',
    );
  }

  // Ecosystem multiplier resolution. Design doc section 8.2: the
  // M_eco > 1 multiplier (15 coastal-marine / 5 estuarine) applies to
  // PAH-class substances ONLY because PAHs accumulate passively in
  // bivalve filter-feeders that lack hepatic CYP1A biotransformation.
  // PCBs / dioxins / MeHg / metals biomagnify or follow different
  // kinetics; their library BSAFs are already trophic-corrected.
  // Codex P2 2026-05-19 round 2: the estuarine branch previously
  // applied M_eco = 5 to ALL substances (including non-PAH), making
  // estuarine non-PAH SedS 5x too low (over-protective).
  let M_eco: number;
  if (ecosystem === 'freshwater') {
    M_eco = M_ECO_FRESHWATER;
  } else if (contaminantClass === 'organic-PAH') {
    M_eco = ecosystem === 'coastal-marine' ? M_ECO_COASTAL_PAH : M_ECO_ESTUARINE;
  } else {
    // Non-PAH in estuarine or coastal-marine: M_eco stays at 1 and we
    // surface a warning so the user understands the selector did not
    // produce the headline multiplier.
    M_eco = M_ECO_FRESHWATER;
    const expectedMultiplier =
      ecosystem === 'coastal-marine' ? M_ECO_COASTAL_PAH : M_ECO_ESTUARINE;
    warnings.push(
      `${ecosystem} M_eco = ${expectedMultiplier} multiplier applies to ` +
        'organic-PAH class only; this substance is ' +
        `${contaminantClass} (e.g., PCBs / dioxins biomagnify rather ` +
        'than passively accumulate; library BSAF is already ' +
        'trophic-corrected). Using M_eco = 1 instead ' +
        '(design doc section 8.2).',
    );
  }

  // BSAF_effective branch: MeHg uses protein-normalized BSAF * (fProtein/foc);
  // all other classes use lipid-normalized BSAF * (fLipid/foc).
  // Both forms back-calculate C_t / C_s from the definitional form
  // BSAF = (C_t / f_norm) / (C_s / f_oc), so the formula needs (f_norm / f_oc)
  // to recover the operative tissue/sediment ratio. Codex P1 2026-05-19.
  let BSAF_effective: number;
  if (contaminantClass === 'methyl-Hg') {
    const fProteinEffective = fProtein ?? F_PROTEIN_DEFAULT;
    BSAF_effective = BSAF_loc_freshwater * (fProteinEffective / foc) * M_eco;
  } else {
    BSAF_effective = BSAF_loc_freshwater * (fLipid / foc) * M_eco;
  }

  // Final back-calculation:
  //   SedS = (TRV * BW) / (IR * BSAF_effective * Fsite)
  // Units: (mg/kg-bw/day) * kg / ((kg-wet/day) * dimensionless * dimensionless)
  //   -> mg / (kg-wet) -> mg/kg dry under the BSAF normalization convention.
  const sedS =
    (TRV_eco_mg_per_kg_bw_day * BW_eco_kg) /
    (IR_eco_kg_per_day * BSAF_effective * Fsite);

  return {
    M_eco,
    BSAF_effective,
    sedS,
    warnings,
    blocked,
  };
}
