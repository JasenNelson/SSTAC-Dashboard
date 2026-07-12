import { describe, expect, it } from 'vitest';
import { deriveInhalationStandards } from '../calculator';

describe('HHInhalationCalculator skeleton', () => {
  it('returns blocked=true when both rfc and iur are null', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain('Inhalation calculator is a stub; values are not valid standards.');
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked even when rfc is provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: 0.5,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain('RfC provided but non-cancer derivation is not yet implemented.');
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked even when iur is provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: 0.002,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain('IUR provided but cancer derivation is not yet implemented.');
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked when both rfc and iur are provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: 0.5,
      iur_inhalation_per_mg_per_m3: 0.002,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
    expect(result.warnings.length).toBe(3);
  });

  it('remains blocked and warns pending-model when only VF is supplied', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: 1234.5,
      particulate_emission_factor_m3_per_kg: null,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain(
      'VF/PEF provided but the transport-model decision is pending; values are not consumed.'
    );
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked and warns pending-model when only PEF is supplied', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: 6789.1,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain(
      'VF/PEF provided but the transport-model decision is pending; values are not consumed.'
    );
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked when ALL fields (RfC, IUR, VF, PEF, targetRisk, hazardQuotient) are populated', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: 0.5,
      iur_inhalation_per_mg_per_m3: 0.002,
      targetRisk: 0.00001,
      hazardQuotient: 1,
      volatilization_factor_m3_per_kg: 1234.5,
      particulate_emission_factor_m3_per_kg: 6789.1,
    });

    // Populating VF/PEF alongside RfC/IUR/targetRisk/hazardQuotient must NOT unblock the
    // calculator -- the transport-model decision (Option A/B/C) is still pending, so this
    // run ships zero speculative math.
    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
    expect(result.warnings).toContain('RfC provided but non-cancer derivation is not yet implemented.');
    expect(result.warnings).toContain('IUR provided but cancer derivation is not yet implemented.');
    expect(result.warnings).toContain(
      'VF/PEF provided but the transport-model decision is pending; values are not consumed.'
    );
    expect(result.warnings.length).toBe(4);
  });
});
