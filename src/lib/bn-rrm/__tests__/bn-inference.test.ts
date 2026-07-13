import { describe, it, expect } from 'vitest';
import {
  dagForwardInference,
  dagComputeSensitivity,
  dagProtectiveConcentration,
  classifyRawSiteData,
  CCME_THRESHOLDS
} from '../bn-inference';
import { createTrainedNetwork } from '../trained-network';
import type { SiteData } from '@/types/bn-rrm/site-data';

describe('bn-inference', () => {
  const model = createTrainedNetwork('expert');

  describe('dagForwardInference', () => {
    it('ensures belief arrays sum to ~1 and each value in [0,1]', () => {
      const result = dagForwardInference(model, {});
      Object.values(result.beliefs).forEach(dist => {
        let sum = 0;
        Object.values(dist).forEach(val => {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
          sum += val;
        });
        expect(sum).toBeCloseTo(1, 5);
      });
    });

    it('clamps evidence node to evidence state', () => {
      const result = dagForwardInference(model, { sed_cu: 'above_pel' });
      const dist = result.beliefs['sed_cu'];
      expect(dist).toBeDefined();
      expect(dist['above_pel']).toBe(1);
      expect(dist['below_isqg']).toBe(0);
      expect(dist['isqg_pel']).toBe(0);
    });
  });

  describe('dagComputeSensitivity', () => {
    it('returns entries sorted by range DESCENDING', () => {
      const sensitivities = dagComputeSensitivity(model, 'ecological_risk', 'high');
      for (let i = 0; i < sensitivities.length - 1; i++) {
        expect(sensitivities[i].range).toBeGreaterThanOrEqual(sensitivities[i + 1].range);
      }
    });
  });

  describe('dagProtectiveConcentration', () => {
    it('returns a best-effort result without throwing when target cannot be fully achieved', () => {
      // Force an impossible target
      const result = dagProtectiveConcentration(model, {
        targetNode: 'ecological_risk',
        acceptableStates: ['low'],
        targetProbability: 1.0, // 100% low risk is impossible due to other factors
        queryNode: 'sed_cu',
        fixedEvidence: { sed_zn: 'above_pel', sed_pb: 'above_pel' }
      });
      expect(result).toBeDefined();
      expect(result.protectiveState).toBeDefined();
      expect(typeof result.achievedProbability).toBe('number');
      expect(result.computationSteps.some(step => step.includes('not fully achievable'))).toBe(true);
    });
  });

  describe('classifyRawSiteData', () => {
    it('classifies chemistry against CCME thresholds', () => {
      const cuISQG = CCME_THRESHOLDS.copper.isqg;
      const cuPEL = CCME_THRESHOLDS.copper.pel;

      const siteBelow: SiteData = {
        location: { id: '1', name: 'L1', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
        sedimentChemistry: [{ siteId: '1', sampleId: 'S1', dateCollected: '', copper: cuISQG - 1 }],
      };
      const evBelow = classifyRawSiteData(siteBelow);
      expect(evBelow.sed_cu).toBe('below_isqg');

      const siteBetween: SiteData = {
        location: { id: '2', name: 'L2', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
        sedimentChemistry: [{ siteId: '2', sampleId: 'S2', dateCollected: '', copper: cuISQG + 1 }],
      };
      const evBetween = classifyRawSiteData(siteBetween);
      expect(evBetween.sed_cu).toBe('isqg_pel');

      const siteAbove: SiteData = {
        location: { id: '3', name: 'L3', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
        sedimentChemistry: [{ siteId: '3', sampleId: 'S3', dateCollected: '', copper: cuPEL + 1 }],
      };
      const evAbove = classifyRawSiteData(siteAbove);
      expect(evAbove.sed_cu).toBe('above_pel');
    });

    it('does not throw on partial/missing chemistry', () => {
      const sitePartial: SiteData = {
        location: { id: '4', name: 'L4', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
        sedimentChemistry: [{ siteId: '4', sampleId: 'S4', dateCollected: '', copper: 10 }], // missing other chemistry
      };
      expect(() => classifyRawSiteData(sitePartial)).not.toThrow();
      
      const siteEmpty: SiteData = {
        location: { id: '5', name: 'L5', latitude: 0, longitude: 0, siteType: 'exposure', dateCollected: '' },
        sedimentChemistry: [], // fully missing
      };
      expect(() => classifyRawSiteData(siteEmpty)).not.toThrow();
    });
  });
});
