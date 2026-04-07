/**
 * Tests for useAutoLoadPackSites.
 *
 * Verifies:
 *  - The hook calls loadReviewArtifact once per selectedPackId change
 *    (no infinite loop from a bad dependency array).
 *  - The hook clears training/comparison sites synchronously on pack switch
 *    while preserving user-uploaded sites.
 *  - When site_reports has no valid coordinates the adapter is skipped.
 *  - When site_reports has valid coordinates, addSites receives the adapted
 *    payload.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAutoLoadPackSites } from '../useAutoLoadPackSites';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import type { PackManifest } from '@/lib/bn-rrm/pack-types';
import type {
  SiteReportsJSON,
  SiteReport,
} from '@/lib/bn-rrm/transparency-adapters';
import type { SiteData } from '@/types/bn-rrm/site-data';

function makeManifest(packId: string): PackManifest {
  // Minimal stub. The hook only reads pack_id from packManifest.
  return { pack_id: packId } as unknown as PackManifest;
}

function makeUserSite(id: string): SiteData {
  return {
    location: {
      id,
      name: `User ${id}`,
      latitude: 49.0,
      longitude: -123.0,
      siteType: 'exposure',
      dateCollected: '2026-01-01',
      sourceTag: 'user',
    },
    sedimentChemistry: [{
      siteId: id,
      sampleId: `${id}-sample`,
      dateCollected: '2026-01-01',
      copper: 50,
    }],
  };
}

function makeReportWithCoords(): SiteReportsJSON {
  const site: SiteReport = {
    site_id: 999,
    name: 'Test Site',
    registry_id: 'test-registry',
    waterbody_type: 'lake',
    region: 'TEST',
    station_count: 1,
    campaign_dates: { earliest: '2020-01-01', latest: '2020-12-31' },
    chemistry_summary: [],
    station_details: [{
      station_id: 1,
      station_name: 'Stn1',
      station_type: 'exposure',
      latitude: 50.0,
      longitude: -120.0,
      date_earliest: '2020-01-01',
      date_latest: '2020-12-31',
      chemistry_records: 1,
      toxicity_records: 0,
      community_records: 0,
      spatial_class: 'STATION_GEOREFERENCED',
    }],
  };
  return { _meta: {}, sites: [site] };
}

function makeReportNoCoords(): SiteReportsJSON {
  const site: SiteReport = {
    site_id: 1,
    name: 'Jermilova-like',
    registry_id: 'jerm',
    waterbody_type: 'lake',
    region: 'NWT',
    station_count: 1,
    campaign_dates: { earliest: '2020-01-01', latest: '2020-12-31' },
    chemistry_summary: [],
    station_details: [{
      station_id: 1,
      station_name: 'Stn1',
      station_type: 'exposure',
      latitude: null,
      longitude: null,
      date_earliest: '2020-01-01',
      date_latest: '2020-12-31',
      chemistry_records: 0,
      toxicity_records: 0,
      community_records: 0,
      spatial_class: null,
    }],
  };
  return { _meta: {}, sites: [site] };
}

function resetStores() {
  useSiteDataStore.setState({
    sites: {},
    assessments: {},
    selectedSiteId: null,
    selectedSiteIds: [],
  });
  usePackStore.setState({
    selectedPackId: null,
    packManifest: null,
    reviewArtifactCache: {},
    reviewArtifactLoading: {},
    reviewArtifactErrors: {},
  });
}

type LoadReviewArtifactFn = ReturnType<typeof usePackStore.getState>['loadReviewArtifact'];

describe('useAutoLoadPackSites', () => {
  let loadReviewArtifactMock: ReturnType<typeof vi.fn>;
  let originalLoad: LoadReviewArtifactFn;
  let originalDebug: typeof console.debug;

  beforeEach(() => {
    resetStores();
    loadReviewArtifactMock = vi.fn();
    originalLoad = usePackStore.getState().loadReviewArtifact;
    usePackStore.setState({
      // Override loader. Cast through unknown for the generic signature.
      loadReviewArtifact: loadReviewArtifactMock as unknown as LoadReviewArtifactFn,
    });
    originalDebug = console.debug;
    console.debug = vi.fn();
  });

  afterEach(() => {
    usePackStore.setState({ loadReviewArtifact: originalLoad });
    console.debug = originalDebug;
  });

  it('does nothing when no pack is selected', () => {
    renderHook(() => useAutoLoadPackSites());
    expect(loadReviewArtifactMock).not.toHaveBeenCalled();
  });

  it('clears training/comparison and preserves user sites on pack switch', async () => {
    // Seed user + training + comparison sites
    useSiteDataStore.getState().addSites([
      makeUserSite('u1'),
      {
        ...makeUserSite('t1'),
        location: { ...makeUserSite('t1').location, sourceTag: 'training' },
      },
      {
        ...makeUserSite('c1'),
        location: { ...makeUserSite('c1').location, sourceTag: 'comparison' },
      },
    ]);

    loadReviewArtifactMock.mockResolvedValue(null);

    usePackStore.setState({
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
    });

    renderHook(() => useAutoLoadPackSites());

    // Synchronous clear should already have happened.
    const after = useSiteDataStore.getState().sites;
    expect(Object.keys(after)).toEqual(['u1']);
    expect(after['u1'].location.sourceTag).toBe('user');

    await waitFor(() => expect(loadReviewArtifactMock).toHaveBeenCalledTimes(1));
  });

  it('skips adapter and logs when site_reports has no valid coordinates', async () => {
    loadReviewArtifactMock.mockResolvedValue(makeReportNoCoords());

    usePackStore.setState({
      selectedPackId: 'jermilova',
      packManifest: makeManifest('jermilova'),
    });

    renderHook(() => useAutoLoadPackSites());

    await waitFor(() => expect(loadReviewArtifactMock).toHaveBeenCalledTimes(1));

    // No sites added (none seeded, none added).
    expect(Object.keys(useSiteDataStore.getState().sites)).toEqual([]);
    expect(console.debug).toHaveBeenCalledWith(
      '[useAutoLoadPackSites] no valid coordinates, skipping adapter',
    );
  });

  it('adapts and adds training sites when coordinates are valid', async () => {
    loadReviewArtifactMock.mockResolvedValue(makeReportWithCoords());

    usePackStore.setState({
      selectedPackId: 'general',
      packManifest: makeManifest('general'),
    });

    renderHook(() => useAutoLoadPackSites());

    await waitFor(() => {
      const sites = Object.values(useSiteDataStore.getState().sites);
      expect(sites.length).toBeGreaterThan(0);
    });

    const sites = Object.values(useSiteDataStore.getState().sites);
    expect(sites.every((s) => s.location.sourceTag === 'training')).toBe(true);
  });

  it('does not infinite-loop: only loads once per stable pack id', async () => {
    loadReviewArtifactMock.mockResolvedValue(null);

    usePackStore.setState({
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
    });

    const { rerender } = renderHook(() => useAutoLoadPackSites());

    await waitFor(() => expect(loadReviewArtifactMock).toHaveBeenCalledTimes(1));

    // Re-render several times with no state change. Should not re-fire.
    rerender();
    rerender();
    rerender();

    expect(loadReviewArtifactMock).toHaveBeenCalledTimes(1);
  });

  it('reloads when pack id changes', async () => {
    loadReviewArtifactMock.mockResolvedValue(null);

    usePackStore.setState({
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
    });
    const { rerender } = renderHook(() => useAutoLoadPackSites());

    await waitFor(() => expect(loadReviewArtifactMock).toHaveBeenCalledTimes(1));

    usePackStore.setState({
      selectedPackId: 'pack-b',
      packManifest: makeManifest('pack-b'),
    });
    rerender();

    await waitFor(() => expect(loadReviewArtifactMock).toHaveBeenCalledTimes(2));
  });
});
