/**
 * Tests for siteDataStore tag-scoped clearing assumptions used by
 * useAutoLoadPackSites. Validates that clearing 'training' and 'comparison'
 * sites preserves user-uploaded sites.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSiteDataStore } from '../siteDataStore';
import type { SiteData } from '@/types/bn-rrm/site-data';

function makeSite(id: string, sourceTag: 'user' | 'training' | 'comparison'): SiteData {
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

describe('siteDataStore.clearSitesByTag (autoload contract)', () => {
  beforeEach(() => {
    useSiteDataStore.setState({
      sites: {},
      assessments: {},
      selectedSiteId: null,
      selectedSiteIds: [],
    });
  });

  it('preserves user sites when clearing training', () => {
    const store = useSiteDataStore.getState();
    store.addSites([
      makeSite('u1', 'user'),
      makeSite('t1', 'training'),
      makeSite('t2', 'training'),
    ]);

    useSiteDataStore.getState().clearSitesByTag('training');

    const after = useSiteDataStore.getState().sites;
    expect(Object.keys(after).sort()).toEqual(['u1']);
    expect(after['u1'].location.sourceTag).toBe('user');
  });

  it('preserves user sites when clearing comparison', () => {
    const store = useSiteDataStore.getState();
    store.addSites([
      makeSite('u1', 'user'),
      makeSite('c1', 'comparison'),
    ]);

    useSiteDataStore.getState().clearSitesByTag('comparison');

    const after = useSiteDataStore.getState().sites;
    expect(Object.keys(after)).toEqual(['u1']);
  });

  it('clearing training then comparison preserves user sites and removes both reference tags', () => {
    const store = useSiteDataStore.getState();
    store.addSites([
      makeSite('u1', 'user'),
      makeSite('u2', 'user'),
      makeSite('t1', 'training'),
      makeSite('c1', 'comparison'),
    ]);

    useSiteDataStore.getState().clearSitesByTag('training');
    useSiteDataStore.getState().clearSitesByTag('comparison');

    const after = useSiteDataStore.getState().sites;
    expect(Object.keys(after).sort()).toEqual(['u1', 'u2']);
    expect(after['u1'].location.sourceTag).toBe('user');
    expect(after['u2'].location.sourceTag).toBe('user');
  });

  it('is a no-op when no sites match the tag', () => {
    const store = useSiteDataStore.getState();
    store.addSites([makeSite('u1', 'user')]);

    useSiteDataStore.getState().clearSitesByTag('training');

    expect(Object.keys(useSiteDataStore.getState().sites)).toEqual(['u1']);
  });
});
