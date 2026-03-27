/**
 * Tests for siteDataStore selection hygiene and new actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteDataStore } from '../siteDataStore';
import type { SiteData, SiteAssessment } from '@/types/bn-rrm/site-data';

function makeSite(id: string, sourceTag?: 'user' | 'training' | 'comparison'): SiteData {
  return {
    location: {
      id,
      name: `Site ${id}`,
      latitude: 49.0,
      longitude: -123.0,
      siteType: 'exposure',
      dateCollected: '2026-01-01',
      sourceTag,
    },
    sedimentChemistry: [{
      siteId: id,
      sampleId: `${id}-sample`,
      dateCollected: '2026-01-01',
      copper: 50,
    }],
  };
}

function makeAssessment(siteId: string): SiteAssessment {
  return {
    siteId,
    siteName: `Site ${siteId}`,
    assessmentDate: '2026-01-01',
    chemistryDataPoints: 1,
    toxicityTests: 0,
    benthicSamples: 0,
    impactProbabilities: { none: 0.5, minor: 0.2, moderate: 0.2, severe: 0.1 },
    mostLikelyImpact: 'none',
    confidence: 0.75,
    keyContaminants: ['Copper'],
    keyModifiers: [],
  };
}

describe('siteDataStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useSiteDataStore.setState({
      sites: {},
      assessments: {},
      selectedSiteId: null,
      selectedSiteIds: [],
      batchAssessmentProgress: null,
    });
  });

  describe('removeSite selection hygiene', () => {
    it('removes site from selectedSiteIds', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
      store.selectMultipleSites(['a', 'b', 'c']);

      store.removeSite('b');

      const state = useSiteDataStore.getState();
      expect(state.selectedSiteIds).toEqual(['a', 'c']);
      expect(state.sites).not.toHaveProperty('b');
    });

    it('clears selectedSiteId when the selected site is removed', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b')]);
      store.selectSite('a');

      store.removeSite('a');

      const state = useSiteDataStore.getState();
      expect(state.selectedSiteId).not.toBe('a');
      expect(state.selectedSiteIds).not.toContain('a');
    });

    it('removes assessment when site is removed', () => {
      const store = useSiteDataStore.getState();
      store.addSite(makeSite('a'));
      store.addAssessment(makeAssessment('a'));

      store.removeSite('a');

      const state = useSiteDataStore.getState();
      expect(state.assessments).not.toHaveProperty('a');
    });
  });

  describe('clearAllSites selection hygiene', () => {
    it('resets selectedSiteIds to empty array', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b')]);
      store.selectMultipleSites(['a', 'b']);

      store.clearAllSites();

      const state = useSiteDataStore.getState();
      expect(state.selectedSiteIds).toEqual([]);
      expect(state.selectedSiteId).toBeNull();
      expect(Object.keys(state.sites)).toHaveLength(0);
    });
  });

  describe('clearSitesByTag', () => {
    it('removes only sites matching the given tag', () => {
      const store = useSiteDataStore.getState();
      store.addSites([
        makeSite('user-1', 'user'),
        makeSite('training-1', 'training'),
        makeSite('training-2', 'training'),
        makeSite('comparison-1', 'comparison'),
      ]);

      store.clearSitesByTag('training');

      const state = useSiteDataStore.getState();
      expect(Object.keys(state.sites)).toEqual(
        expect.arrayContaining(['user-1', 'comparison-1']),
      );
      expect(Object.keys(state.sites)).toHaveLength(2);
      expect(state.sites).not.toHaveProperty('training-1');
      expect(state.sites).not.toHaveProperty('training-2');
    });

    it('removes assessments for tagged sites', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('t1', 'training'), makeSite('u1', 'user')]);
      store.addAssessment(makeAssessment('t1'));
      store.addAssessment(makeAssessment('u1'));

      store.clearSitesByTag('training');

      const state = useSiteDataStore.getState();
      expect(state.assessments).not.toHaveProperty('t1');
      expect(state.assessments).toHaveProperty('u1');
    });

    it('reconciles selectedSiteIds when tagged sites are removed', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('t1', 'training'), makeSite('u1', 'user')]);
      store.selectMultipleSites(['t1', 'u1']);

      store.clearSitesByTag('training');

      const state = useSiteDataStore.getState();
      expect(state.selectedSiteIds).toEqual(['u1']);
    });

    it('is a no-op when no sites match the tag', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('u1', 'user'), makeSite('u2', 'user')]);
      store.selectMultipleSites(['u1', 'u2']);

      store.clearSitesByTag('training');

      const state = useSiteDataStore.getState();
      expect(Object.keys(state.sites)).toHaveLength(2);
      expect(state.selectedSiteIds).toEqual(['u1', 'u2']);
    });
  });

  describe('setBatchAssessmentProgress', () => {
    it('sets progress state', () => {
      const store = useSiteDataStore.getState();
      store.setBatchAssessmentProgress({ current: 2, total: 5, currentSiteName: 'Test Site' });

      const state = useSiteDataStore.getState();
      expect(state.batchAssessmentProgress).toEqual({
        current: 2,
        total: 5,
        currentSiteName: 'Test Site',
      });
    });

    it('clears progress state with null', () => {
      const store = useSiteDataStore.getState();
      store.setBatchAssessmentProgress({ current: 1, total: 3, currentSiteName: 'X' });
      store.setBatchAssessmentProgress(null);

      const state = useSiteDataStore.getState();
      expect(state.batchAssessmentProgress).toBeNull();
    });
  });
});
