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
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).toBeNull();
  });

  it('returns valid values (placeholder) when rfc is provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: 0.5,
      iur_inhalation_per_mg_per_m3: null,
      targetRisk: 0.00001,
      hazardQuotient: 1,
    });
    
    expect(result.blocked).toBe(false);
    expect(result.driver).toBe('non-cancer');
    expect(result.nonCancerAirS).not.toBeNull();
    expect(result.cancerAirS).toBeNull();
  });

  it('returns valid values (placeholder) when iur is provided', () => {
    const result = deriveInhalationStandards({
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: 0.002,
      targetRisk: 0.00001,
      hazardQuotient: 1,
    });
    
    expect(result.blocked).toBe(false);
    expect(result.driver).toBe('cancer');
    expect(result.nonCancerAirS).toBeNull();
    expect(result.cancerAirS).not.toBeNull();
  });
});
