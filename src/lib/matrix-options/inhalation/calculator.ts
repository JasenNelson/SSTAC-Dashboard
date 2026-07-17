import type { HumanHealthRiskDriver } from '../types';

// Human Health Inhalation pathway (Matrix Options row #31/T33).
// Plain ASCII only.
//
// OWNER RULING (2026-07-17, binding): VF (volatilization factor) and PEF (particulate
// emission factor) are USER-SUPPLIED inputs only. This calculator NEVER invents, looks
// up, hardcodes, or defaults a VF or PEF value -- both are chemical- and site-specific
// (EPA/540/R-96/018 Eq. 8 for VF; Eq. 5 for PEF) and a wrong transport value ships a
// wrong screening standard. See
// C:\Users\jasen\AppData\Local\Temp\claude\...\VFPEF_SOURCE_DISCOVERY_PACKET.md for the
// full source-verification trail (EPA Soil Screening Guidance User's Guide, 1996,
// primary PDF text extraction) and .tmp/data-truth-run-2026-07-11/INHALATION_SCOPE_PACKET.md
// for the prior "why this stayed a stub" record.
//
// -----------------------------------------------------------------------------------
// EQUATION DERIVATION (combined volatile + particulate inhalation medium standard)
// -----------------------------------------------------------------------------------
// Source framework: US EPA, Soil Screening Guidance: User's Guide, EPA/540/R-96/018
// (1996), Equation 5 (PEF) and Equation 8 (VF); exposure-parameter defaults (TR, THQ,
// EF, ED, AT) per the same source's Section 5.14 / Table 1 (reproduced in the
// discovery packet Section 4.1). The 1996 SSG's own combined-pathway screening-level
// equations (Eq. 3/4/6/7) were referenced but NOT reproduced in full in the discovery
// packet (primary PDF text extraction covered Eq. 5 and Eq. 8 verbatim, not 3/4/6/7).
// The combination below is therefore re-derived here from the same mass-balance / risk
// equation the EPA equations are built from, using EXACTLY the combination rule the
// owner specified ("combine volatile + particulate via 1/VF + 1/PEF"). This module
// comment shows every step so a reviewer (or codex) can check the algebra directly
// against the cited primary equations, rather than trusting an opaque formula.
//
// Step 1 -- soil-to-air transport. VF and PEF each convert a soil/sediment
// concentration Cs (mg/kg) into an air-concentration CONTRIBUTION (mg/m3):
//   Cair_volatile    = Cs / VF     (VF in m3/kg; EPA Eq. 8)
//   Cair_particulate = Cs / PEF    (PEF in m3/kg; EPA Eq. 5)
// The two transport routes are independent and additive (a molecule of contaminant
// reaches the breathing zone via one route or the other, not both at once for the
// same mass), so:
//   Cair_total = Cs * (1/VF + 1/PEF)
// When only one of VF/PEF is supplied, the missing term is simply omitted (single-route
// screening), per the owner's "and/or" framing -- not treated as a hard block.
//
// Step 2 -- time-averaged exposure concentration. Following the same EF/ED/AT
// structure as every other Matrix Options human-health pathway in this codebase
// (compare humanHealthDirectContact in ../derivations.ts):
//   EC = Cair_total * (EF_days_per_year * ED_years) / (AT_years * 365)
// Per the discovery packet Section 4.1 Table 1 footnote, AT(noncancer) = ED for the
// receptor (i.e. the non-cancer averaging time is the same duration as the exposure
// itself) -- this is EPA's stated convention, not an assumption introduced here.
// AT(cancer) is a separate, receptor-independent 70-year default input.
//
// Step 3 -- risk/hazard equations, solved for Cs (the medium standard):
//   Cancer:     TR  = EC_cancer * IUR           =>  Cs = TR * AT_cancer * 365
//                                                          / [(1/VF + 1/PEF) * EF * ED * IUR]
//   Non-cancer: THQ = EC_noncancer / RfC         =>  Cs = THQ * RfC * AT_noncancer * 365
//                                                          / [(1/VF + 1/PEF) * EF * ED]
//               with AT_noncancer = ED, so the ED terms cancel:
//                     Cs = THQ * RfC * 365 / [(1/VF + 1/PEF) * EF]
//   (IUR here is on a per-(mg/m3) basis -- iur_inhalation_per_mg_per_m3 -- consistent
//   with this module's existing field name; a catalog IUR stored per-(ug/m3), as
//   `unit_risk_inhalation_per_ug_m3` rows are in matrix_research/reference_catalog/
//   human_health_trv_values.json, must be multiplied by 1000 before being passed in
//   here. That conversion is done once, at data-wiring time, in substanceLibrary.ts --
//   see the benzene / trichloroethylene / tetrachloroethylene entries -- not inside
//   this function, so this function's contract stays "IUR is already per mg/m3.")
//
// The ED-cancellation for the non-cancer branch is a real, well-known feature of the
// EPA SSL non-cancer equations (because AT = ED by definition for that endpoint), not
// a shortcut introduced here; ED is still validated as a required, positive input
// (both because AT_noncancer is DEFINED as ED, and because the cancer branch needs it
// directly), so a missing/invalid ED still blocks both endpoints.
//
// -----------------------------------------------------------------------------------
// MEDIUM-BASIS CAVEAT (soil vs. sediment)
// -----------------------------------------------------------------------------------
// EPA/540/R-96/018's VF and PEF equations were derived for SOIL. This codebase's other
// Matrix Options pathways report a sediment standard (`sedS`, mg/kg dry) on a bulk dry-
// sediment mass basis; this calculator follows that same output convention for
// consistency with the rest of the tool, but does NOT independently derive or endorse a
// soil-to-sediment physical equivalence for the VF/PEF transport model itself -- that is
// exactly why VF/PEF are user-supplied rather than calculator-derived: selecting a
// transport factor appropriate to the medium being screened (soil vs. exposed/dried
// sediment) is left to professional judgment, per the owner ruling. See the "medium
// basis" warning surfaced whenever a result is computed.
//
// -----------------------------------------------------------------------------------
// HAND-WORKED EXAMPLE (also used verbatim in calculator.test.ts as a regression check)
// -----------------------------------------------------------------------------------
// Inputs: VF = 1.0e4 m3/kg, PEF = 1.36e9 m3/kg (EPA RSL wind-driven chronic default,
// cited here ONLY as a numeric example, never as a calculator default), RfC = 0.03
// mg/m3 (benzene, IRIS), IUR = 0.016 per mg/m3 (benzene, Health Canada TRV v4.0,
// converted from 1.6e-5 per ug/m3 -- see substanceLibrary.ts), TR = 1e-5, THQ = 1,
// EF = 350 d/yr, ED = 30 yr, AT_cancer = 70 yr.
//   1/VF + 1/PEF = 1/1.0e4 + 1/1.36e9 = 1.0000000e-4 + 7.352941e-10 ~= 1.0000007e-4 (m3/kg)^-1
//   Non-cancer: Cs = 1 * 0.03 * 365 / (1.0000007e-4 * 350) = 10.95 / 0.0350003 ~= 312.85 mg/kg
//   Cancer:     Cs = 1e-5 * 70 * 365 / (1.0000007e-4 * 350 * 30 * 0.016)
//                  = 0.2555 / 0.0168001... ~= 15.208 mg/kg
//   Driver: cancer (15.208 mg/kg is lower / more protective than 312.85 mg/kg).
//   (These exact figures are verified by node arithmetic and re-checked as a
//   regression assertion in calculator.test.ts -- "hand-worked example" test.)

export interface HumanHealthInhalationInput {
  // Non-cancer inhalation reference concentration, mg/m3. User-supplied or
  // catalog-seeded (see substanceLibrary.ts); null when unavailable for the substance.
  rfc_inhalation_mg_per_m3: number | null;
  // Cancer inhalation unit risk, per (mg/m3). NOTE the basis: this is per-mg/m3, not
  // per-ug/m3 -- see the module header's unit-conversion note.
  iur_inhalation_per_mg_per_m3: number | null;
  targetRisk: number;
  hazardQuotient: number;
  // Volatilization factor (soil/sediment-to-air), m3/kg. USER-SUPPLIED ONLY -- see
  // owner ruling above. Null when the user has not supplied one.
  volatilization_factor_m3_per_kg: number | null;
  // Particulate emission factor (wind-driven fugitive dust), m3/kg. USER-SUPPLIED
  // ONLY -- see owner ruling above. Null when the user has not supplied one.
  particulate_emission_factor_m3_per_kg: number | null;
  // Exposure frequency, days/year. Required to compute either endpoint.
  EF_days_per_year: number;
  // Exposure duration, years. Required to compute either endpoint (also serves as the
  // non-cancer averaging time, AT_noncancer = ED_years; see module header Step 2).
  ED_years: number;
  // Cancer averaging time, years. Required only for the cancer endpoint.
  AT_cancer_years: number;
}

export interface HumanHealthInhalationResult {
  // Headline medium (sediment/soil) standard, mg/kg dry -- the lower (more protective)
  // of nonCancerSedS / cancerSedS. Null when neither endpoint could be computed.
  sedS: number | null;
  driver: HumanHealthRiskDriver;
  // Non-cancer candidate medium standard, mg/kg dry. Null when RfC, VF+PEF, or a valid
  // EF/ED were not available.
  nonCancerSedS: number | null;
  // Cancer candidate medium standard, mg/kg dry. Null when IUR, VF+PEF, or valid
  // EF/ED/AT_cancer were not available.
  cancerSedS: number | null;
  // Diagnostic forward check: the breathing-zone air concentration implied by `sedS`
  // and the combined VF/PEF transport factor (Cair = sedS / vfPefCombined). Null
  // whenever sedS is null. Not itself a regulatory target -- shown so a reviewer can
  // sanity-check the transport step independent of the toxicity-value step.
  airConcentration_mg_per_m3: number | null;
  // Diagnostic: the combined soil-to-air transport factor, 1 / (1/VF + 1/PEF), m3/kg.
  // Null when neither VF nor PEF was supplied.
  vfPefCombined_m3_per_kg: number | null;
  nonCancerBlocked: boolean;
  cancerBlocked: boolean;
  warnings: string[];
  // True only when NEITHER endpoint could be computed (e.g. no VF and no PEF, or
  // transport available but neither RfC nor IUR available, or invalid EF/ED).
  blocked: boolean;
}

// Returns `value` when it is a supplied, positive, finite number; otherwise returns
// null and (when the value was supplied but invalid) records a warning. A value of
// `null` on input is treated as "not supplied" and produces no warning -- the
// fail-closed calculator distinguishes "the user has not filled this in yet" from
// "the user filled this in with something nonsensical."
function validatePositive(
  value: number | null,
  label: string,
  warnings: string[],
): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) {
    warnings.push(
      `${label} was supplied but is not a positive finite number; treated as not supplied.`,
    );
    return null;
  }
  return value;
}

/**
 * Human Health Inhalation medium (sediment/soil) standard.
 *
 * Fail-closed by construction: the transport factor (VF and/or PEF) and at least one
 * toxicity value (RfC and/or IUR) must be supplied by the caller. This function never
 * substitutes a default for either -- see the owner ruling and equation derivation in
 * this module's header comment.
 */
export function deriveInhalationStandards(
  input: HumanHealthInhalationInput,
): HumanHealthInhalationResult {
  const {
    rfc_inhalation_mg_per_m3,
    iur_inhalation_per_mg_per_m3,
    targetRisk,
    hazardQuotient,
    volatilization_factor_m3_per_kg,
    particulate_emission_factor_m3_per_kg,
    EF_days_per_year,
    ED_years,
    AT_cancer_years,
  } = input;

  const warnings: string[] = [];

  // ---- Step 1: transport factor (user-supplied VF and/or PEF only). ----
  const vf = validatePositive(
    volatilization_factor_m3_per_kg,
    'Volatilization factor (VF)',
    warnings,
  );
  const pef = validatePositive(
    particulate_emission_factor_m3_per_kg,
    'Particulate emission factor (PEF)',
    warnings,
  );

  const transportAvailable = vf !== null || pef !== null;
  let combinedInverseVFPEF = 0;
  if (vf !== null) combinedInverseVFPEF += 1 / vf;
  if (pef !== null) combinedInverseVFPEF += 1 / pef;

  if (!transportAvailable) {
    warnings.push(
      'VF and/or PEF must be supplied by the user; the calculator never invents or ' +
        'defaults a transport value (owner ruling 2026-07-17). Provide at least one to ' +
        'unblock this pathway.',
    );
  }

  // ---- Step 2: exposure factors (EF, ED always required; AT_cancer for cancer only). ----
  const ef = validatePositive(EF_days_per_year, 'Exposure frequency (EF)', warnings);
  const ed = validatePositive(ED_years, 'Exposure duration (ED)', warnings);
  const atCancer = validatePositive(
    AT_cancer_years,
    'Cancer averaging time (AT)',
    warnings,
  );
  const exposureFactorsValid = ef !== null && ed !== null;
  if (!exposureFactorsValid) {
    warnings.push(
      'Exposure frequency (EF) and exposure duration (ED) must both be positive ' +
        'finite numbers to compute either endpoint.',
    );
  }

  const rfc = validatePositive(rfc_inhalation_mg_per_m3, 'RfC', warnings);
  const iur = validatePositive(iur_inhalation_per_mg_per_m3, 'IUR', warnings);
  const tr = validatePositive(targetRisk, 'Target risk', warnings);
  const thq = validatePositive(hazardQuotient, 'Hazard quotient', warnings);

  let nonCancerSedS: number | null = null;
  let cancerSedS: number | null = null;

  if (transportAvailable && exposureFactorsValid) {
    // Non-cancer: Cs = THQ * RfC * 365 / [(1/VF + 1/PEF) * EF]  (ED cancels; see header).
    if (rfc !== null && thq !== null) {
      nonCancerSedS = (thq * rfc * 365) / (combinedInverseVFPEF * (ef as number));
    } else {
      warnings.push(
        'RfC (non-cancer) not supplied; non-cancer inhalation endpoint not computed.',
      );
    }

    // Cancer: Cs = TR * AT_cancer * 365 / [(1/VF + 1/PEF) * EF * ED * IUR].
    if (iur !== null && tr !== null && atCancer !== null) {
      cancerSedS =
        (tr * atCancer * 365) /
        (combinedInverseVFPEF * (ef as number) * (ed as number) * iur);
    } else {
      warnings.push(
        'IUR (cancer) not supplied; cancer inhalation endpoint not computed.',
      );
    }
  }

  const nonCancerBlocked = nonCancerSedS === null;
  const cancerBlocked = cancerSedS === null;
  const blocked = nonCancerSedS === null && cancerSedS === null;

  let sedS: number | null = null;
  let driver: HumanHealthRiskDriver = 'non-cancer';
  if (nonCancerSedS !== null && cancerSedS !== null) {
    if (nonCancerSedS <= cancerSedS) {
      sedS = nonCancerSedS;
      driver = 'non-cancer';
    } else {
      sedS = cancerSedS;
      driver = 'cancer';
    }
  } else if (nonCancerSedS !== null) {
    sedS = nonCancerSedS;
    driver = 'non-cancer';
  } else if (cancerSedS !== null) {
    sedS = cancerSedS;
    driver = 'cancer';
  }

  const vfPefCombined = transportAvailable ? 1 / combinedInverseVFPEF : null;
  const airConcentration_mg_per_m3 =
    sedS !== null && vfPefCombined !== null ? sedS / vfPefCombined : null;

  if (!blocked) {
    warnings.push(
      'Medium-basis caveat: VF/PEF are user-supplied soil-to-air transport factors ' +
        '(EPA/540/R-96/018 Eq. 5/8 framework); this calculator applies them on the same ' +
        'sediment dry-mass basis used by every other Matrix Options pathway, but does ' +
        'not independently verify soil-to-sediment equivalence for the transport model. ' +
        'Confirm the supplied VF/PEF are appropriate for the medium being screened.',
    );
  }

  return {
    sedS,
    driver,
    nonCancerSedS,
    cancerSedS,
    airConcentration_mg_per_m3,
    vfPefCombined_m3_per_kg: vfPefCombined,
    nonCancerBlocked,
    cancerBlocked,
    warnings,
    blocked,
  };
}
