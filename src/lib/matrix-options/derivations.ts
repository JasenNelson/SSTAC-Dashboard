// Pure-TS derivation functions for the matrix-options calculator (v1).
// All formulas track the .tmp_calculator_design_v1.md spec.
// Plain ASCII only. No React. Unit-testable in isolation.

import type {
  AvsSemInput,
  AvsSemResult,
  EcoDirectEqPInput,
  EcoDirectEqPResult,
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
