import { computeBaPeq } from './cumulative';
import type { BaPeqEntry, CumulativeResult } from './cumulative';
import type { RpfScheme } from './rpfTable';

/**
 * OPT-IN, single-bin ADAF-adjusted BaP-equivalent. The DEFAULT cancer-slope anchor
 * (EPA IRIS 2.0, ADAF-embedded lifetime) is UNCHANGED and unaffected by this helper.
 * Use ONLY when the scenario explicitly anchors on an ADULT-ONLY slope factor
 * (HC 1.289 or EPA IRIS 1.0), which REQUIRES applying the age-bin ADAF (10/3/1) for
 * early-life exposure. Single age bin only (one ageYears), per the computeBaPeq contract;
 * full lifetime multi-bin exposure-duration-weighting is deliberately out of scope
 * (owner-gated methodology). NEVER use with an ADAF-embedded anchor (EPA 2.0) -- that
 * double-counts early-life sensitivity. This helper is NOT registered in equationDispatch.ts
 * and does not change any default calculator output.
 */
export function computeBaPeqAgeAdjusted(
  entries: readonly BaPeqEntry[],
  scheme: RpfScheme,
  ageYears: number,
): CumulativeResult {
  return computeBaPeq(entries, scheme, { applyAdaf: true, ageYears });
}
