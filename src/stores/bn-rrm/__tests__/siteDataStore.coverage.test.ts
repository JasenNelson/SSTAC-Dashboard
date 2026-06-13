/**
 * Supplemental coverage for siteDataStore.
 *
 * Only tests actions/selectors NOT already covered by:
 *   siteDataStore.test.ts       -- clearSitesByTag, validateChemistry,
 *                                  identified features, selection mutations,
 *                                  setBatchAssessmentProgress, read selectors
 *   siteDataStore.autoload.test.ts -- clearSitesByTag autoload contract
 *
 * Gaps targeted here:
 *   1. addSite / addSites (upsert + batch key derivation)
 *   2. removeSite fallback: when removed site IS selectedSiteId, the first
 *      remaining selectedSiteId entry becomes the new selectedSiteId
 *   3. selectSite with a non-null id replaces selectedSiteIds with [siteId]
 *   4. setPrimaryFeatureIndex with a negative index (guarded by i < 0 check)
 *   5. setIdentifiedFeatures re-populates after clearIdentifiedFeatures
 *   6. selectAllSites replaces a prior partial selection
 *   7. removeSite on a non-existent id is a no-op
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteDataStore } from '../siteDataStore';
import type { SiteData, SiteAssessment } from '@/types/bn-rrm/site-data';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';

// ---------------------------------------------------------------------------
// Fixture helpers (mirror the pattern from siteDataStore.test.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Reset between every test -- mirrors siteDataStore.test.ts beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
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

// ---------------------------------------------------------------------------
// 1. addSite / addSites
// ---------------------------------------------------------------------------

describe('addSite', () => {
  it('inserts a new site keyed by location.id', () => {
    useSiteDataStore.getState().addSite(makeSite('x'));
    const state = useSiteDataStore.getState();
    expect(state.sites).toHaveProperty('x');
    expect(state.sites['x'].location.name).toBe('Site x');
  });

  it('overwrites an existing site with the same id (upsert)', () => {
    useSiteDataStore.getState().addSite(makeSite('x'));
    const updated = makeSite('x');
    updated.location.name = 'Updated Name';
    useSiteDataStore.getState().addSite(updated);

    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites)).toHaveLength(1);
    expect(state.sites['x'].location.name).toBe('Updated Name');
  });

  it('does not mutate the selectedSiteId or selectedSiteIds', () => {
    useSiteDataStore.getState().addSite(makeSite('x'));
    const state = useSiteDataStore.getState();
    expect(state.selectedSiteId).toBeNull();
    expect(state.selectedSiteIds).toEqual([]);
  });
});

describe('addSites', () => {
  it('inserts all sites in the array, each keyed by location.id', () => {
    useSiteDataStore.getState().addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites).sort()).toEqual(['a', 'b', 'c']);
  });

  it('merges with existing sites rather than replacing them', () => {
    useSiteDataStore.getState().addSite(makeSite('existing'));
    useSiteDataStore.getState().addSites([makeSite('new1'), makeSite('new2')]);
    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites).sort()).toEqual(['existing', 'new1', 'new2']);
  });

  it('later entries in the array overwrite earlier ones with the same id (last-write wins)', () => {
    const first = makeSite('dup');
    first.location.name = 'First';
    const second = makeSite('dup');
    second.location.name = 'Second';
    useSiteDataStore.getState().addSites([first, second]);

    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites)).toHaveLength(1);
    expect(state.sites['dup'].location.name).toBe('Second');
  });

  it('is a no-op on state when the array is empty', () => {
    useSiteDataStore.getState().addSite(makeSite('a'));
    useSiteDataStore.getState().addSites([]);
    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites)).toEqual(['a']);
  });
});

// ---------------------------------------------------------------------------
// 2. removeSite: selectedSiteId falls back to next remaining selectedSiteIds entry
// ---------------------------------------------------------------------------

describe('removeSite -- selectedSiteId fallback', () => {
  it('promotes the next remaining id to selectedSiteId when the removed site was selected', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    store.selectMultipleSites(['a', 'b', 'c']);
    useSiteDataStore.setState({ selectedSiteId: 'a' });

    store.removeSite('a');

    const state = useSiteDataStore.getState();
    // 'a' gone; remaining selectedSiteIds = ['b', 'c']; first = 'b'
    expect(state.selectedSiteId).toBe('b');
    expect(state.selectedSiteIds).toEqual(['b', 'c']);
    expect(state.sites).not.toHaveProperty('a');
  });

  it('preserves selectedSiteId when a non-selected site is removed', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b')]);
    store.selectSite('a');

    store.removeSite('b');

    const state = useSiteDataStore.getState();
    expect(state.selectedSiteId).toBe('a');
    expect(state.selectedSiteIds).toEqual(['a']);
  });

  it('is a no-op (sites/assessments unchanged) when the id does not exist', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b')]);
    store.addAssessment(makeAssessment('a'));

    store.removeSite('ghost');

    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites).sort()).toEqual(['a', 'b']);
    expect(state.assessments).toHaveProperty('a');
    expect(state.selectedSiteId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. selectSite with a non-null id replaces selectedSiteIds with [siteId]
// ---------------------------------------------------------------------------

describe('selectSite -- non-null id', () => {
  it('replaces selectedSiteIds with [siteId] even if multiple were previously selected', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    store.selectMultipleSites(['a', 'b', 'c']);

    store.selectSite('b');

    const state = useSiteDataStore.getState();
    expect(state.selectedSiteId).toBe('b');
    expect(state.selectedSiteIds).toEqual(['b']);
  });

  it('sets both selectedSiteId and selectedSiteIds when called on an empty store', () => {
    const store = useSiteDataStore.getState();
    store.addSite(makeSite('z'));
    store.selectSite('z');

    const state = useSiteDataStore.getState();
    expect(state.selectedSiteId).toBe('z');
    expect(state.selectedSiteIds).toEqual(['z']);
  });
});

// ---------------------------------------------------------------------------
// 4. setPrimaryFeatureIndex -- negative index is ignored (i < 0 guard)
// ---------------------------------------------------------------------------

describe('setPrimaryFeatureIndex -- negative index', () => {
  it('leaves primaryFeatureIndex unchanged when a negative index is supplied', () => {
    const store = useSiteDataStore.getState();
    store.setIdentifiedFeatures([makeFeature('a', 1), makeFeature('b', 2)]);
    // primaryFeatureIndex is now 0 (set by setIdentifiedFeatures)
    store.setPrimaryFeatureIndex(-1);

    const state = useSiteDataStore.getState();
    expect(state.primaryFeatureIndex).toBe(0);
  });

  it('leaves primaryFeatureIndex unchanged when index equals the list length (equal, not less than)', () => {
    const store = useSiteDataStore.getState();
    store.setIdentifiedFeatures([makeFeature('x', 10)]);
    // list length = 1, valid range = [0, 0]; index 1 is out of range
    store.setPrimaryFeatureIndex(1);

    const state = useSiteDataStore.getState();
    expect(state.primaryFeatureIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 5. setIdentifiedFeatures re-populates after clearIdentifiedFeatures
// ---------------------------------------------------------------------------

describe('setIdentifiedFeatures lifecycle', () => {
  it('re-populates the feature list and resets index to 0 after a clear', () => {
    const store = useSiteDataStore.getState();
    store.setIdentifiedFeatures([makeFeature('a', 1)]);
    store.clearIdentifiedFeatures();
    // Confirm cleared
    expect(useSiteDataStore.getState().identifiedFeatures).toEqual([]);
    expect(useSiteDataStore.getState().primaryFeatureIndex).toBeNull();

    // Re-populate
    store.setIdentifiedFeatures([makeFeature('b', 2), makeFeature('c', 3)]);

    const state = useSiteDataStore.getState();
    expect(state.identifiedFeatures).toHaveLength(2);
    expect(state.identifiedFeatures[0].layerKey).toBe('b');
    expect(state.primaryFeatureIndex).toBe(0);
  });

  it('replaces a non-empty list with a completely new list', () => {
    const store = useSiteDataStore.getState();
    store.setIdentifiedFeatures([makeFeature('old', 1), makeFeature('old2', 2)]);
    store.setIdentifiedFeatures([makeFeature('new', 99)]);

    const state = useSiteDataStore.getState();
    expect(state.identifiedFeatures).toHaveLength(1);
    expect(state.identifiedFeatures[0].layerKey).toBe('new');
    expect(state.primaryFeatureIndex).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. selectAllSites replaces a prior partial selection
// ---------------------------------------------------------------------------

describe('selectAllSites -- replaces partial selection', () => {
  it('overwrites an existing partial selection with all site ids', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    store.selectSite('a'); // partial: only 'a'

    store.selectAllSites();

    const state = useSiteDataStore.getState();
    expect(state.selectedSiteIds.sort()).toEqual(['a', 'b', 'c']);
    // selectedSiteId is the first entry in Object.keys(sites) -- non-null
    expect(state.selectedSiteId).not.toBeNull();
  });
});
