/**
 * Tests for siteDataStore.validateChemistry and the read-side selectors
 * left uncovered by siteDataStore.test.ts.
 *
 * validateChemistry compares a SedimentChemistry sample against the eight
 * CCME guidelines hard-coded in the store (copper, zinc, lead, cadmium,
 * mercury, arsenic, chromium, totalPAHs). For each present parameter it
 * emits a ValidationResult with status valid / warning (> ISQG) / error
 * (> PEL) and an exceedance ratio. Parameters that are absent or that are
 * not in the guideline table produce no result.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteDataStore } from '../siteDataStore';
import type {
  SiteData,
  SiteAssessment,
  SedimentChemistry,
  ValidationResult,
} from '@/types/bn-rrm/site-data';

function makeChemistry(overrides: Partial<SedimentChemistry> = {}): SedimentChemistry {
  return {
    siteId: 'site-1',
    sampleId: 'sample-1',
    dateCollected: '2026-01-01',
    ...overrides,
  };
}

function makeSite(id: string, region?: string): SiteData {
  return {
    location: {
      id,
      name: `Site ${id}`,
      latitude: 49.0,
      longitude: -123.0,
      siteType: 'exposure',
      dateCollected: '2026-01-01',
      region,
    },
    sedimentChemistry: [makeChemistry({ siteId: id })],
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
    keyContaminants: [],
    keyModifiers: [],
  };
}

function byField(results: ValidationResult[], field: string): ValidationResult | undefined {
  return results.find((r) => r.field === field);
}

describe('siteDataStore.validateChemistry', () => {
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

  it('returns an empty array when no guideline parameters are present', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // siteId / sampleId / dateCollected are not guideline parameters.
    const results = validateChemistry(makeChemistry());
    expect(results).toEqual([]);
  });

  it('ignores parameters that are present but not in the guideline table', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    const results = validateChemistry(
      makeChemistry({ nickel: 9999, toc: 5, percentFines: 20 }),
    );
    // nickel/toc/percentFines have no CCME guideline -> no results.
    expect(results).toEqual([]);
  });

  it('flags a value at/below the ISQG as valid with no message or guideline', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // copper ISQG = 35.7; 35.7 is not > ISQG, so it stays valid.
    const results = validateChemistry(makeChemistry({ copper: 35.7 }));
    const copper = byField(results, 'copper');
    expect(copper).toBeDefined();
    expect(copper!.status).toBe('valid');
    expect(copper!.value).toBe(35.7);
    expect(copper!.message).toBeUndefined();
    expect(copper!.guideline).toBeUndefined();
  });

  it('treats a value of 0 as a real reading (defined, valid)', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // 0 !== undefined, so it must still produce a (valid) result.
    const results = validateChemistry(makeChemistry({ lead: 0 }));
    const lead = byField(results, 'lead');
    expect(lead).toBeDefined();
    expect(lead!.status).toBe('valid');
    expect(lead!.value).toBe(0);
  });

  it('flags a value above ISQG but at/below PEL as a warning with ISQG guideline', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // copper ISQG = 35.7, PEL = 197; 100 is in the warning band.
    const results = validateChemistry(makeChemistry({ copper: 100 }));
    const copper = byField(results, 'copper');
    expect(copper!.status).toBe('warning');
    expect(copper!.message).toBe('Exceeds ISQG (35.7 mg/kg)');
    expect(copper!.guideline).toEqual({
      name: 'ISQG',
      value: 35.7,
      exceedance: 100 / 35.7,
    });
  });

  it('flags a value above the PEL as an error with PEL guideline and exceedance ratio', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // copper PEL = 197; 394 is exactly 2x the PEL.
    const results = validateChemistry(makeChemistry({ copper: 394 }));
    const copper = byField(results, 'copper');
    expect(copper!.status).toBe('error');
    expect(copper!.message).toBe('Exceeds PEL (197 mg/kg)');
    expect(copper!.guideline).toEqual({
      name: 'PEL',
      value: 197,
      exceedance: 2,
    });
  });

  it('uses the ug/kg unit label for totalPAHs', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // totalPAHs ISQG = 1684 (ug/kg); 2000 is a warning.
    const results = validateChemistry(makeChemistry({ totalPAHs: 2000 }));
    const pahs = byField(results, 'totalPAHs');
    expect(pahs!.status).toBe('warning');
    expect(pahs!.message).toBe('Exceeds ISQG (1684 ug/kg)');
  });

  it('evaluates every guideline parameter independently in one sample', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    const results = validateChemistry(
      makeChemistry({
        copper: 10, // valid (< 35.7)
        zinc: 200, // warning (123 < 200 <= 315)
        lead: 500, // error (> 91.3)
        cadmium: 0.5, // valid (< 0.6)
        mercury: 1, // error (> 0.486)
        arsenic: 10, // warning (5.9 < 10 <= 17)
        chromium: 37.3, // valid (== ISQG)
        totalPAHs: 20000, // error (> 16770)
      }),
    );

    expect(results).toHaveLength(8);
    expect(byField(results, 'copper')!.status).toBe('valid');
    expect(byField(results, 'zinc')!.status).toBe('warning');
    expect(byField(results, 'lead')!.status).toBe('error');
    expect(byField(results, 'cadmium')!.status).toBe('valid');
    expect(byField(results, 'mercury')!.status).toBe('error');
    expect(byField(results, 'arsenic')!.status).toBe('warning');
    expect(byField(results, 'chromium')!.status).toBe('valid');
    expect(byField(results, 'totalPAHs')!.status).toBe('error');
  });

  it('preserves guideline insertion order for the emitted results', () => {
    const { validateChemistry } = useSiteDataStore.getState();
    // Supply parameters in a different order than the guideline table; the
    // store iterates the guideline table, so output order follows the table.
    const results = validateChemistry(
      makeChemistry({ totalPAHs: 1, copper: 1, zinc: 1 }),
    );
    expect(results.map((r) => r.field)).toEqual(['copper', 'zinc', 'totalPAHs']);
  });
});

describe('siteDataStore read-side selectors', () => {
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

  it('getSiteLocations returns one location per stored site', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b')]);
    const locations = useSiteDataStore.getState().getSiteLocations();
    expect(locations.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('getSitesByRegion filters sites by location.region', () => {
    const store = useSiteDataStore.getState();
    store.addSites([
      makeSite('north-1', 'North'),
      makeSite('north-2', 'North'),
      makeSite('south-1', 'South'),
    ]);
    const north = useSiteDataStore.getState().getSitesByRegion('North');
    expect(north.map((s) => s.location.id).sort()).toEqual(['north-1', 'north-2']);
    expect(useSiteDataStore.getState().getSitesByRegion('West')).toEqual([]);
  });

  it('getSiteCount reflects the number of stored sites', () => {
    const store = useSiteDataStore.getState();
    expect(useSiteDataStore.getState().getSiteCount()).toBe(0);
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    expect(useSiteDataStore.getState().getSiteCount()).toBe(3);
  });

  it('getAssessment returns the stored assessment or undefined', () => {
    const store = useSiteDataStore.getState();
    store.addSite(makeSite('a'));
    store.addAssessment(makeAssessment('a'));
    expect(useSiteDataStore.getState().getAssessment('a')?.siteId).toBe('a');
    expect(useSiteDataStore.getState().getAssessment('missing')).toBeUndefined();
  });

  it('getSelectedSite returns the selected site, or undefined when nothing selected', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b')]);
    expect(useSiteDataStore.getState().getSelectedSite()).toBeUndefined();
    store.selectSite('b');
    expect(useSiteDataStore.getState().getSelectedSite()?.location.id).toBe('b');
  });

  it('getSelectedSites returns only sites that still exist, skipping stale ids', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b')]);
    store.selectMultipleSites(['a', 'ghost', 'b']);
    const selected = useSiteDataStore.getState().getSelectedSites();
    expect(selected.map((s) => s.location.id)).toEqual(['a', 'b']);
  });

  it('selectAllSites selects every site and sets selectedSiteId to the first', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    store.selectAllSites();
    const state = useSiteDataStore.getState();
    expect(state.selectedSiteIds.sort()).toEqual(['a', 'b', 'c']);
    expect(state.selectedSiteId).not.toBeNull();
  });

  it('selectAllSites on an empty store leaves selectedSiteId null', () => {
    const store = useSiteDataStore.getState();
    store.selectAllSites();
    const state = useSiteDataStore.getState();
    expect(state.selectedSiteIds).toEqual([]);
    expect(state.selectedSiteId).toBeNull();
  });

  it('removeSelectedSites deletes selected sites + their assessments and clears selection', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('a'), makeSite('b'), makeSite('c')]);
    store.addAssessment(makeAssessment('a'));
    store.addAssessment(makeAssessment('b'));
    store.selectMultipleSites(['a', 'b']);

    store.removeSelectedSites();

    const state = useSiteDataStore.getState();
    expect(Object.keys(state.sites)).toEqual(['c']);
    expect(state.assessments).not.toHaveProperty('a');
    expect(state.assessments).not.toHaveProperty('b');
    expect(state.selectedSiteIds).toEqual([]);
    expect(state.selectedSiteId).toBeNull();
  });
});
