/**
 * Tests for siteDataStore selection hygiene and new actions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteDataStore } from '../siteDataStore';
import type { SiteData, SiteAssessment, SedimentChemistry } from '@/types/bn-rrm/site-data';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';

function makeFeature(layerKey: string, propId: number): IdentifiedFeature {
  return {
    source: 'wms',
    layerKey,
    layerLabel: `Layer ${layerKey}`,
    properties: { id: propId },
    coordinates: { lat: 49.0, lng: -123.0 },
    capturedAt: 1_700_000_000_000,
  };
}

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
      identifiedFeatures: [],
      primaryFeatureIndex: null,
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

  describe('identified features mutations', () => {
    it('setIdentifiedFeatures replaces list and sets primary to 0', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([makeFeature('a', 1), makeFeature('b', 2)]);

      const state = useSiteDataStore.getState();
      expect(state.identifiedFeatures).toHaveLength(2);
      expect(state.identifiedFeatures[0].layerKey).toBe('a');
      expect(state.primaryFeatureIndex).toBe(0);
    });

    it('setIdentifiedFeatures with empty list sets primary to null', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([makeFeature('a', 1)]);
      store.setIdentifiedFeatures([]);

      const state = useSiteDataStore.getState();
      expect(state.identifiedFeatures).toEqual([]);
      expect(state.primaryFeatureIndex).toBeNull();
    });

    it('setPrimaryFeatureIndex promotes a non-primary hit', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([
        makeFeature('a', 1),
        makeFeature('b', 2),
        makeFeature('c', 3),
      ]);
      store.setPrimaryFeatureIndex(2);

      const state = useSiteDataStore.getState();
      expect(state.primaryFeatureIndex).toBe(2);
      expect(state.identifiedFeatures[2].layerKey).toBe('c');
    });

    it('setPrimaryFeatureIndex ignores out-of-range values', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([makeFeature('a', 1)]);
      store.setPrimaryFeatureIndex(5);

      const state = useSiteDataStore.getState();
      expect(state.primaryFeatureIndex).toBe(0);
    });

    it('clearIdentifiedFeatures empties list and resets index', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([makeFeature('a', 1), makeFeature('b', 2)]);
      store.clearIdentifiedFeatures();

      const state = useSiteDataStore.getState();
      expect(state.identifiedFeatures).toEqual([]);
      expect(state.primaryFeatureIndex).toBeNull();
    });

    it('selecting a site does not clear identified features (independent)', () => {
      const store = useSiteDataStore.getState();
      store.addSite(makeSite('a'));
      store.setIdentifiedFeatures([makeFeature('layerA', 1)]);
      store.selectSite('a');

      const state = useSiteDataStore.getState();
      expect(state.selectedSiteId).toBe('a');
      expect(state.identifiedFeatures).toHaveLength(1);
    });
  });

  describe('persist round-trip', () => {
    it('identifiedFeatures and primaryFeatureIndex are NOT written to storage', () => {
      const store = useSiteDataStore.getState();
      store.setIdentifiedFeatures([makeFeature('a', 1), makeFeature('b', 2)]);
      store.addSite(makeSite('siteA'));

      const raw = typeof window !== 'undefined'
        ? window.localStorage.getItem('sstac-bn-rrm-site-data')
        : null;
      expect(raw).not.toBeNull();

      const parsed = JSON.parse(raw!);
      const persistedState = parsed.state ?? parsed;
      expect(persistedState).toHaveProperty('sites');
      expect(persistedState.sites).toHaveProperty('siteA');
      expect(persistedState).not.toHaveProperty('identifiedFeatures');
      expect(persistedState).not.toHaveProperty('primaryFeatureIndex');
    });
  });

  describe('validateChemistry (CCME ISQG/PEL guidelines)', () => {
    function makeChem(overrides: Partial<SedimentChemistry>): SedimentChemistry {
      return {
        siteId: 's',
        sampleId: 's-sample',
        dateCollected: '2026-01-01',
        ...overrides,
      };
    }

    it('reports valid (no message/guideline) when a value is at or below the ISQG', () => {
      const store = useSiteDataStore.getState();
      // 30 < copper ISQG 35.7.
      const below = store.validateChemistry(makeChem({ copper: 30 }));
      expect(below).toHaveLength(1);
      expect(below[0]).toMatchObject({ field: 'copper', value: 30, status: 'valid' });
      expect(below[0].message).toBeUndefined();
      expect(below[0].guideline).toBeUndefined();

      // Exactly at the ISQG is NOT an exceedance (strict greater-than).
      const atIsqg = store.validateChemistry(makeChem({ copper: 35.7 }));
      expect(atIsqg[0].status).toBe('valid');
    });

    it('flags a warning between the ISQG and PEL with the ISQG exceedance ratio', () => {
      const store = useSiteDataStore.getState();
      // 35.7 < 50 < 197.
      const [result] = store.validateChemistry(makeChem({ copper: 50 }));
      expect(result.status).toBe('warning');
      expect(result.message).toBe('Exceeds ISQG (35.7 mg/kg)');
      expect(result.guideline).toMatchObject({ name: 'ISQG', value: 35.7 });
      expect(result.guideline?.exceedance).toBeCloseTo(50 / 35.7, 6);

      // Exactly at the PEL stays a warning (not > PEL, but > ISQG).
      const atPel = store.validateChemistry(makeChem({ copper: 197 }));
      expect(atPel[0].status).toBe('warning');
    });

    it('flags an error above the PEL with the PEL exceedance ratio', () => {
      const store = useSiteDataStore.getState();
      const [result] = store.validateChemistry(makeChem({ copper: 200 }));
      expect(result.status).toBe('error');
      expect(result.message).toBe('Exceeds PEL (197 mg/kg)');
      expect(result.guideline).toMatchObject({ name: 'PEL', value: 197 });
      expect(result.guideline?.exceedance).toBeCloseTo(200 / 197, 6);
    });

    it('omits undefined parameters and evaluates each provided parameter independently', () => {
      const store = useSiteDataStore.getState();
      const results = store.validateChemistry(
        makeChem({ copper: 200 /* error */, zinc: 200 /* warning */, lead: 10 /* valid */ }),
      );
      expect(results).toHaveLength(3);
      const byField = Object.fromEntries(results.map((r) => [r.field, r.status]));
      expect(byField).toEqual({ copper: 'error', zinc: 'warning', lead: 'valid' });
      // Parameters not present in the chemistry payload are not reported at all.
      expect(results.some((r) => r.field === 'mercury')).toBe(false);
    });

    it('uses the ug/kg unit for totalPAHs', () => {
      const store = useSiteDataStore.getState();
      const [result] = store.validateChemistry(makeChem({ totalPAHs: 2000 }));
      expect(result.status).toBe('warning');
      expect(result.message).toBe('Exceeds ISQG (1684 ug/kg)');
    });

    it('returns no results for a chemistry payload with no guideline parameters', () => {
      const store = useSiteDataStore.getState();
      expect(store.validateChemistry(makeChem({}))).toEqual([]);
    });
  });

  describe('read selectors', () => {
    it('getSiteCount reflects the number of loaded sites', () => {
      const store = useSiteDataStore.getState();
      expect(store.getSiteCount()).toBe(0);
      store.addSites([makeSite('a'), makeSite('b')]);
      expect(useSiteDataStore.getState().getSiteCount()).toBe(2);
    });

    it('getSelectedSites maps selected ids to sites and drops missing ones', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
      store.selectMultipleSites(['a', 'c']);
      const selected = useSiteDataStore.getState().getSelectedSites();
      expect(selected.map((s) => s.location.id)).toEqual(['a', 'c']);

      // A selected id whose site was removed is filtered out (no undefined entries).
      useSiteDataStore.setState({ selectedSiteIds: ['a', 'gone', 'c'] });
      const afterRemoval = useSiteDataStore.getState().getSelectedSites();
      expect(afterRemoval.map((s) => s.location.id)).toEqual(['a', 'c']);
    });

    it('getSelectedSite returns the single selected site or undefined', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b')]);
      expect(useSiteDataStore.getState().getSelectedSite()).toBeUndefined();
      store.selectSite('b');
      expect(useSiteDataStore.getState().getSelectedSite()?.location.id).toBe('b');
    });

    it('getSiteLocations returns the location of every loaded site', () => {
      const store = useSiteDataStore.getState();
      store.addSites([makeSite('a'), makeSite('b')]);
      const ids = useSiteDataStore
        .getState()
        .getSiteLocations()
        .map((loc) => loc.id)
        .sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('getSitesByRegion filters sites by their location region', () => {
      const store = useSiteDataStore.getState();
      const north = makeSite('n1');
      north.location.region = 'North';
      const south = makeSite('s1');
      south.location.region = 'South';
      store.addSites([north, south, makeSite('no-region')]);

      const inNorth = useSiteDataStore.getState().getSitesByRegion('North');
      expect(inNorth.map((s) => s.location.id)).toEqual(['n1']);
      expect(useSiteDataStore.getState().getSitesByRegion('East')).toEqual([]);
    });
  });
});
