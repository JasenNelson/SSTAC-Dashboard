import { describe, it, expect } from 'vitest';
import { getServicesByStage, getServiceById, SERVICES, LIFECYCLE_STAGES } from '../schedule3';

describe('schedule3', () => {
  describe('getServicesByStage', () => {
    it('returns empty array for unknown stage', () => {
      // @ts-expect-error testing invalid stage
      const services = getServicesByStage('unknown-stage');
      expect(services).toEqual([]);
    });

    it('returns only services for known stage', () => {
      const siteDetermination = getServicesByStage('site-determination');
      expect(siteDetermination.length).toBeGreaterThan(0);
      siteDetermination.forEach(service => {
        expect(service.lifecycleStage).toBe('site-determination');
      });
    });
  });

  describe('getServiceById', () => {
    it('returns undefined for unknown id', () => {
      const service = getServiceById('unknown-id');
      expect(service).toBeUndefined();
    });

    it('returns the service for known id', () => {
      const service = getServiceById('site-determination-s44');
      expect(service).toBeDefined();
      expect(service?.id).toBe('site-determination-s44');
    });
  });

  describe('Structural integrity', () => {
    it('all SERVICES ids are unique', () => {
      const ids = SERVICES.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('each lifecycleStage is a valid value', () => {
      const validStages = new Set(LIFECYCLE_STAGES.map(s => s.id));
      SERVICES.forEach(service => {
        expect(validStages.has(service.lifecycleStage)).toBe(true);
      });
    });
  });
});
