import { describe, it, expect } from 'vitest';
import { AD_GAMMA_CRITICAL_VALUES } from '../ad-table';
import { KS_GAMMA_CRITICAL_VALUES } from '../ks-table';
import { interpolateGammaCritVal } from '../gof';

describe('Lookup Tables', () => {
  describe('Shape and Exports', () => {
    it('AD_GAMMA_CRITICAL_VALUES exports a 3D array of size 32 x 11 x 3', () => {
      expect(Array.isArray(AD_GAMMA_CRITICAL_VALUES)).toBe(true);
      expect(AD_GAMMA_CRITICAL_VALUES.length).toBe(32); // 32 N coordinates
      
      for (const row of AD_GAMMA_CRITICAL_VALUES) {
        expect(row.length).toBe(11); // 11 K coordinates
        for (const cell of row) {
          expect(cell.length).toBe(3); // 3 alpha levels (0.01, 0.05, 0.10)
        }
      }
    });

    it('KS_GAMMA_CRITICAL_VALUES exports a 3D array of size 32 x 11 x 3', () => {
      expect(Array.isArray(KS_GAMMA_CRITICAL_VALUES)).toBe(true);
      expect(KS_GAMMA_CRITICAL_VALUES.length).toBe(32); // 32 N coordinates
      
      for (const row of KS_GAMMA_CRITICAL_VALUES) {
        expect(row.length).toBe(11); // 11 K coordinates
        for (const cell of row) {
          expect(cell.length).toBe(3); // 3 alpha levels (0.01, 0.05, 0.10)
        }
      }
    });
  });

  describe('Known Lookups via interpolateGammaCritVal', () => {
    it('returns exact values from AD table on exact coordinates', () => {
      // N = 5 (index 0), K = 0.025 (index 0)
      // AD table values: [1.749166, 1.151052, 0.919726]
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.025, 0)).toBeCloseTo(1.749166, 6);
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.025, 1)).toBeCloseTo(1.151052, 6);
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.025, 2)).toBeCloseTo(0.919726, 6);

      // N = 10 (index 5), K = 1.0 (index 5)
      // AD table [5][5]: [1.018, 0.748, 0.632]
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 10, 1.0, 0)).toBeCloseTo(1.018, 3);
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 10, 1.0, 1)).toBeCloseTo(0.748, 3);
      expect(interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 10, 1.0, 2)).toBeCloseTo(0.632, 3);
    });

    it('returns exact values from KS table on exact coordinates', () => {
      // N = 5 (index 0), K = 0.025 (index 0)
      // KS table values: [0.495311, 0.425015, 0.382954]
      expect(interpolateGammaCritVal(KS_GAMMA_CRITICAL_VALUES, 5, 0.025, 0)).toBeCloseTo(0.495311, 6);
      expect(interpolateGammaCritVal(KS_GAMMA_CRITICAL_VALUES, 5, 0.025, 1)).toBeCloseTo(0.425015, 6);
      expect(interpolateGammaCritVal(KS_GAMMA_CRITICAL_VALUES, 5, 0.025, 2)).toBeCloseTo(0.382954, 6);
    });
  });

  describe('Out-of-range Boundary Clamping', () => {
    it('clamps N < 5 to N = 5', () => {
      // N = 2 should clamp to N = 5
      const clampedVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 2, 0.025, 0);
      const exactVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.025, 0);
      expect(clampedVal).toBe(exactVal);
    });

    it('clamps N > 1000 to N = 1000', () => {
      // N = 2000 should clamp to N = 1000
      const clampedVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 2000, 0.025, 0);
      const exactVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 1000, 0.025, 0);
      expect(clampedVal).toBe(exactVal);
    });

    it('clamps K < 0.025 to K = 0.025', () => {
      // K = 0.01 should clamp to K = 0.025
      const clampedVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.01, 0);
      const exactVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 0.025, 0);
      expect(clampedVal).toBe(exactVal);
    });

    it('clamps K > 50.0 to K = 50.0', () => {
      // K = 100 should clamp to K = 50.0
      const clampedVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 100, 0);
      const exactVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, 5, 50.0, 0);
      expect(clampedVal).toBe(exactVal);
    });
  });
});
