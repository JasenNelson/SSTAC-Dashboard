import type { HumanHealthRiskDriver } from '../types';

export interface HumanHealthInhalationInput {
  rfc_inhalation_mg_per_m3: number | null;
  iur_inhalation_per_mg_per_m3: number | null;
  targetRisk: number;
  hazardQuotient: number;
  // RESERVED: volatilization factor (soil-to-air) and particulate emission factor inputs
  // for the pending VF/PEF transport-model decision (Option A dynamic / B user-supplied /
  // C hardcoded -- owner-gated, not yet resolved). These fields are NOT consumed by
  // deriveInhalationStandards below; the function stays fail-closed (blocked=true)
  // regardless of whether they are populated. Do not wire these into any computation
  // until the model decision is made.
  volatilization_factor_m3_per_kg: number | null;
  particulate_emission_factor_m3_per_kg: number | null;
  // Placeholder parameters; exact exposure factors (e.g. inhalation rate)
  // and transport models (e.g. VF/PEF) will be defined in subsequent phases.
}

export interface HumanHealthInhalationResult {
  // Nullable + null while blocked so a fail-closed stub can never expose a numeric placeholder
  // (e.g. 0) that a downstream consumer might render as a valid air concentration.
  airConcentration_mg_per_m3: number | null;
  driver: HumanHealthRiskDriver;
  nonCancerAirS: number | null;
  cancerAirS: number | null;
  nonCancerBlocked: boolean;
  cancerBlocked: boolean;
  warnings: string[];
  blocked: boolean;
}

/**
 * Skeleton derivation function for human health inhalation.
 * Enforces the fail-closed behavior mandated by the design packet.
 */
export function deriveInhalationStandards(input: HumanHealthInhalationInput): HumanHealthInhalationResult {
  const nonCancerAirS: number | null = null;
  const cancerAirS: number | null = null;
  const driver: HumanHealthRiskDriver = 'non-cancer'; // Default fallback
  const blocked = true;
  const nonCancerBlocked = true;
  const cancerBlocked = true;

  const warnings = ['Inhalation calculator is a stub; values are not valid standards.'];

  if (input.rfc_inhalation_mg_per_m3 !== null) {
    warnings.push('RfC provided but non-cancer derivation is not yet implemented.');
  }

  if (input.iur_inhalation_per_mg_per_m3 !== null) {
    warnings.push('IUR provided but cancer derivation is not yet implemented.');
  }

  if (input.volatilization_factor_m3_per_kg !== null || input.particulate_emission_factor_m3_per_kg !== null) {
    warnings.push('VF/PEF provided but the transport-model decision is pending; values are not consumed.');
  }

  return {
    airConcentration_mg_per_m3: null,
    driver,
    nonCancerAirS,
    cancerAirS,
    nonCancerBlocked,
    cancerBlocked,
    warnings,
    blocked,
  };
}
