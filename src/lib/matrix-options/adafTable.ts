// adafTable.ts
// Age-Dependent Adjustment Factors (ADAFs) for mutagenic-mode-of-action carcinogens
// (e.g. the carcinogenic PAHs / benzo[a]pyrene). Applied per age bin to a slope-factor-anchored
// cancer estimate when the anchor SF is NOT already ADAF-adjusted.
//
// Source: US EPA (2005) "Supplemental Guidance for Assessing Susceptibility from Early-Life
// Exposure to Carcinogens" (EPA/630/R-03/003F); adopted by HC TRV v4.0 (2025) for the BaP mutagenic
// MoA. Values are the canonical, uncontested 3-bin set.
//
// DOUBLE-COUNT GUARD (see A2 verification): if the downstream cancer standard is anchored on an SF
// that ALREADY embeds ADAFs (e.g. the EPA IRIS lifetime BaP CSF 2.0 (mg/kg-day)^-1), these ADAFs MUST
// NOT be applied again. Apply ADAFs only when anchoring on an adult-only / non-ADAF SF (e.g. EPA IRIS
// 1.0 or HC 1.289). Plain ASCII only.

export type AdafQa = 'verified' | 'needs_review';

export interface AdafRow {
  ageBin: string;
  // inclusive lower bound (years) and exclusive upper bound (years); upper = null means "and older".
  lowerYears: number;
  upperYears: number | null;
  adaf: number;
}

export const ADAF_TABLE: readonly AdafRow[] = [
  { ageBin: '0-<2', lowerYears: 0, upperYears: 2, adaf: 10 },
  { ageBin: '2-<16', lowerYears: 2, upperYears: 16, adaf: 3 },
  { ageBin: '16+', lowerYears: 16, upperYears: null, adaf: 1 },
];

export const ADAF_QA: AdafQa = 'verified';
export const ADAF_SOURCE =
  'US EPA 2005 Supplemental Guidance (EPA/630/R-03/003F); HC TRV v4.0 (2025) BaP ADAF note';

export interface AdafLookup {
  adaf: number | null;
  ageBin: string | null;
  qa: AdafQa;
  warning: string | null;
}

/**
 * Resolve the ADAF for an age in years. Never throws: a non-finite / negative age yields
 * { adaf: null, ... } + a warning so the caller can fail closed rather than silently mis-weight.
 */
export function lookupAdaf(ageYears: number): AdafLookup {
  if (!Number.isFinite(ageYears) || ageYears < 0) {
    return {
      adaf: null,
      ageBin: null,
      qa: ADAF_QA,
      warning: `Invalid age ${ageYears}; ADAF undefined (must be a finite age >= 0).`,
    };
  }
  const row = ADAF_TABLE.find(
    (r) => ageYears >= r.lowerYears && (r.upperYears === null || ageYears < r.upperYears),
  );
  if (!row) {
    // Unreachable given the table spans [0, inf); defensive fail-closed.
    return {
      adaf: null,
      ageBin: null,
      qa: ADAF_QA,
      warning: `No ADAF bin matched age ${ageYears}.`,
    };
  }
  return { adaf: row.adaf, ageBin: row.ageBin, qa: ADAF_QA, warning: null };
}
