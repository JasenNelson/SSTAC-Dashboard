/**
 * Regression test for the SiteReports Chemistry / Toxicity / Community /
 * Stations tab-switching bug. Pre-fix (2026-05-18): the data-tab strip's
 * useEffect dep was the selectedSite OBJECT REFERENCE, not the stable
 * site_id. Every render that produced a new selectedSite reference (which
 * happens on every render because `data` and `selectedSite` are useMemos
 * whose deps include re-derived values like baseData/fallbackData that
 * are recomputed each render) re-fired the effect and reset activeDataTab
 * to the default. The user saw clicks on the toxicity tab "flash" with
 * a brief partial render of the toxicity table, then fade back to
 * chemistry as the effect re-fired and reset.
 *
 * Fix: dep on `selectedSite?.site_id` (stable identifier) -- effect only
 * fires when the user picks a DIFFERENT site.
 *
 * This test confirms the fix by simulating the exact user flow:
 *   1. Render SiteReports with a Jermilova-like site_reports fixture.
 *   2. Click a site card -> detail container appears with default tab.
 *   3. Click the Toxicity tab -> toxicity table renders.
 *   4. Assert the toxicity table is STILL rendered after a re-render
 *      (we trigger one via a fake unrelated state change).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Hoisted mock state so we can swap fixtures per test without recreating
// the vi.mock factory.
const mockState = vi.hoisted(() => ({
  artifact: null as { data: unknown; loading: boolean; error: string | null } | null,
  packState: { packManifest: null as unknown, registry: null as unknown },
}));

vi.mock('@/hooks/bn-rrm/usePackArtifact', () => ({
  usePackArtifact: () => mockState.artifact ?? { data: null, loading: false, error: null, reload: () => {} },
}));

vi.mock('@/stores/bn-rrm/packStore', () => ({
  usePackStore: (selector: (s: unknown) => unknown) => selector(mockState.packState),
}));

vi.mock('@/components/bn-rrm/shared/InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

import { SiteReports } from '../SiteReports';

const FIXTURE_SITE_REPORTS = {
  _meta: { export_date: '2026-05-18', db_hash: 'mock' },
  sites: [
    {
      site_id: 1,
      registry_id: 'SITE_001',
      name: 'Test Site Alpha',
      waterbody_type: 'estuary',
      station_count: 3,
      campaign_dates: null,
      source_documents: [],
      chemistry_summary: [
        {
          parameter: 'Copper',
          unit: 'mg/kg',
          min: 10,
          max: 50,
          mean: 25,
          n: 5,
          isqg: 18.7,
          pel: 108,
          exceed_isqg: 2,
          exceed_pel: 0,
        },
      ],
      toxicity_summary: [
        {
          species: 'Hyalella azteca',
          endpoint: 'survival',
          unit: '%',
          min: 65,
          max: 92,
          mean: 78,
          n: 3,
        },
      ],
      community_summary: {
        metrics: [
          {
            name: 'taxa_richness',
            unit: 'count',
            min: 12,
            max: 18,
            mean: 15,
          },
        ],
        n: 3,
        notes: 'Mock community data',
      },
      station_details: [
        { station_id: 1, station_name: 'ST-01', latitude: 49.28, longitude: -123.12 },
        { station_id: 2, station_name: 'ST-02', latitude: 49.29, longitude: -123.11 },
      ],
      woe_risk_distribution: { low: 1, moderate: 1, high: 1 },
    },
  ],
  summary: {
    total_sites: 1,
    total_stations: 3,
    sites_with_chemistry: 1,
    sites_with_toxicity: 1,
    sites_with_community: 1,
  },
};

const GENERAL_MANIFEST = {
  pack_id: 'bnrrm-general-v1.0-dev-map',
  scope_type: 'general',
  parent_pack_id: null,
  site_scope: null,
  training_corpus: { dataset_status: 'OK', n_stations: 3 },
  version_history: { created: '2026-01-01', model_version: '1.0' },
};

describe('SiteReports data-tab switching (regression for 2026-05-18 bug)', () => {
  beforeEach(() => {
    mockState.artifact = {
      data: FIXTURE_SITE_REPORTS,
      loading: false,
      error: null,
    };
    mockState.packState = {
      packManifest: GENERAL_MANIFEST,
      registry: null,
    };
  });

  it('clicking the Toxicity tab persists across re-renders (does not flash back to Chemistry)', () => {
    const { rerender } = render(<SiteReports />);
    // Open the site card (toggles selectedSiteId).
    fireEvent.click(screen.getByRole('button', { name: /Test Site Alpha/i }));
    // Default tab is Chemistry; the Copper row should be visible.
    expect(screen.getByText('Copper')).toBeInTheDocument();
    // Click the Toxicity tab.
    fireEvent.click(screen.getByRole('button', { name: /^Toxicity$/i }));
    // Toxicity table now shows -- Hyalella row visible, Copper gone.
    expect(screen.getByText(/Hyalella azteca/)).toBeInTheDocument();
    expect(screen.queryByText('Copper')).toBeNull();
    // Force an unrelated re-render (simulates parent state changes that
    // would have re-fired the buggy useEffect with [selectedSite] dep).
    rerender(<SiteReports />);
    // KEY ASSERTION: the toxicity table is STILL visible. Pre-fix, the
    // useEffect would re-fire because selectedSite got a new object
    // reference (data + selectedSite useMemos re-derive on every
    // render). The effect would call setActiveDataTab(getDefaultDataTab)
    // which returns 'chemistry', resetting the user's tab choice.
    expect(screen.getByText(/Hyalella azteca/)).toBeInTheDocument();
    expect(screen.queryByText('Copper')).toBeNull();
  });

  it('clicking Community tab switches to community metrics', () => {
    render(<SiteReports />);
    fireEvent.click(screen.getByRole('button', { name: /Test Site Alpha/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Community$/i }));
    // Community metric should render.
    expect(screen.getByText(/taxa_richness/)).toBeInTheDocument();
  });

  it('clicking Stations tab switches to stations list', () => {
    render(<SiteReports />);
    fireEvent.click(screen.getByRole('button', { name: /Test Site Alpha/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Stations \(2\)$/i }));
    // Station name should render.
    expect(screen.getByText('ST-01')).toBeInTheDocument();
    expect(screen.getByText('ST-02')).toBeInTheDocument();
  });

  it('selecting a DIFFERENT site DOES reset activeDataTab to chemistry', () => {
    const fixtureTwoSites = {
      ...FIXTURE_SITE_REPORTS,
      sites: [
        FIXTURE_SITE_REPORTS.sites[0],
        {
          ...FIXTURE_SITE_REPORTS.sites[0],
          site_id: 2,
          name: 'Test Site Bravo',
          registry_id: 'SITE_002',
        },
      ],
    };
    mockState.artifact = { data: fixtureTwoSites, loading: false, error: null };
    render(<SiteReports />);
    // Open site Alpha, switch to Toxicity.
    fireEvent.click(screen.getByRole('button', { name: /Test Site Alpha/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Toxicity$/i }));
    expect(screen.getByText(/Hyalella azteca/)).toBeInTheDocument();
    // Click Bravo WHILE Alpha is still selected. The card-click handler
    // (line 508 of SiteReports.tsx) routes a click on a non-active card
    // directly to setSelectedSiteId(site.site_id) -- so site_id transitions
    // 1 -> 2 directly, no null intermediate. This covers the actual
    // different-site reset path (per codex P2 2026-05-18: the null
    // intermediate would let the reset happen on the close, not on the
    // 1->2 transition we want to assert).
    fireEvent.click(screen.getByRole('button', { name: /Test Site Bravo/i }));
    // The chemistry table is back -- the effect fired on the 1->2
    // site_id change and called setActiveDataTab(getDefaultDataTab(site2))
    // which returns 'chemistry'.
    expect(screen.getByText('Copper')).toBeInTheDocument();
    expect(screen.queryByText(/Hyalella azteca/)).toBeNull();
  });
});
