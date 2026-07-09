import { describe, expect, it } from 'vitest';
import { deriveInhalationStandards } from '../calculator';

describe('HHInhalationCalculator skeleton', () => {
  it('returns blocked=true when both rfc and iur are null', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
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
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.warnings).toContain('IUR provided but cancer derivation is not yet implemented.');
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
  });

  it('remains blocked when both are provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: 0.5,
      iur_inhalation_per_mg_per_m3: 0.002,
      targetRisk: 0.00001,
      hazardQuotient: 1,
    });

    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
    expect(result.warnings.length).toBe(3);
  });
});
