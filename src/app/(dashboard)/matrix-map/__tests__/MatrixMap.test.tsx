/**
 * Smoke tests for the Matrix Interactive Map client component
 * (Path-B fork of SiteMap.tsx).
 *
 * Scope:
 *   - The component renders without crashing in jsdom.
 *   - The loading overlay is visible while Leaflet is still loading
 *     (Leaflet is dynamic-imported; jsdom never resolves it).
 *   - The empty fallback payload renders cleanly (no sample list).
 *
 * MatrixMap uses imperative Leaflet via `await import('leaflet')` inside
 * a useEffect. jsdom cannot run Leaflet, so the dynamic import never
 * resolves and `isLoaded` stays false. We assert on the loading state
 * rather than the post-mount map chrome -- enough for a smoke test
 * without booting Leaflet.
 *
 * Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  MatrixMap,
  createSiteAggregateMarkerHtml,
  filterSamplesCoveredBySiteAggregates,
  getFitBoundsPoints,
} from '../MatrixMap';
import { EMPTY_MATRIX_MAP_DATA } from '../types';
import { useMatrixMapFilterStore } from '@/stores/matrix-map/filterStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import type { MatrixSample, MatrixSiteAggregateData } from '../types';
import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';

// Stub leaflet's dynamic import so its `await import('leaflet')` in
// MatrixMap's init effect doesn't actually touch the (jsdom-unfriendly)
// real leaflet module. Returning a never-resolving promise keeps the
// component stuck in the loading state, which is what we assert on.
vi.mock('leaflet', () => ({ default: {} }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('leaflet.markercluster', () => ({ default: {} }));
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}));
vi.mock('leaflet.markercluster/dist/MarkerCluster.Default.css', () => ({}));

const aggregateMarker: AggregateMarker = {
  key: 'dra-1:49.28270,-123.12070',
  source_dra_id: 'dra-1',
  position: [49.2827, -123.1207],
  label: 'Old <Slope> Place',
  coordinate_quality_tier: 'medium',
  sample_count_total: 10,
  sample_count_high: 0,
  sample_count_medium: 10,
  radius: 8,
};

const siteAggregateData: MatrixSiteAggregateData = {
  site_aggregate_markers: [
    aggregateMarker,
    {
      ...aggregateMarker,
      key: 'dra-2:50.00000,-124.00000',
      source_dra_id: 'dra-2',
      position: [50, -124],
      sample_count_total: 1,
      sample_count_medium: 1,
    },
  ],
  site_count: 2,
  sample_count_total: 11,
  data_snapshot_version: 'site-aggregates-v1',
};

function matrixSample(overrides: Partial<MatrixSample> = {}): MatrixSample {
  return {
    id: 'sample-1',
    bnrrm_station_id: 1,
    station_id: 'ST-1',
    display_name: 'Sample 1',
    geometry: { type: 'Point', coordinates: [-123.1207, 49.2827] },
    coordinate_quality_tier: 'medium',
    coordinate_source: 'bc-csr-centroid',
    classification: 'unknown',
    classification_source: 'data_unknown',
    classification_rationale: null,
    classification_confidence: null,
    source_dra_id: 'dra-1',
    public: true,
    bc_region: null,
    waterbody: null,
    waterbody_type: null,
    ...overrides,
  };
}

describe('MatrixMap (Path-B fork)', () => {
  beforeEach(() => {
    useMatrixMapFilterStore.getState().resetFilters();
    useMatrixMapSelectionStore.getState().clearSampleSelection();
  });

  it('exports a MatrixMap component', () => {
    expect(typeof MatrixMap).toBe('function');
  });

  it('renders the loading state with an empty payload', () => {
    render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
    expect(screen.getByText(/Loading map/i)).toBeInTheDocument();
  });

  it('renders an error notice when fetchErrorMessage is supplied', () => {
    render(
      <MatrixMap
        initialMapData={EMPTY_MATRIX_MAP_DATA}
        fetchErrorMessage="RPC unavailable"
      />,
    );
    expect(screen.getByText(/RPC unavailable/)).toBeInTheDocument();
  });

  // bbox-lane Stage 2: the capped-overview / truncated hint renders from the
  // (reactive) mapData seeded by initialMapData -- it is not gated on Leaflet
  // having loaded, so it is assertable in jsdom.
  it('shows the truncated "zoom in" hint with N-of-M counts when truncated', () => {
    render(
      <MatrixMap
        initialMapData={{
          ...EMPTY_MATRIX_MAP_DATA,
          total_in_bbox: 9000,
          returned_sample_count: 2500,
          truncated: true,
        }}
      />,
    );
    const hint = screen.getByText(/zoom in to see all/i);
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent('Showing 2500 of 9000 samples');
  });

  it('does not show the truncated hint when the payload is not truncated', () => {
    render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
    expect(screen.queryByText(/zoom in to see all/i)).not.toBeInTheDocument();
  });

  it('wires the surveyed_only checkbox to the filter store', () => {
    render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
    const checkbox = screen.getByRole('checkbox', { name: /show surveyed locations only/i });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(useMatrixMapFilterStore.getState().filterState.surveyed_only).toBe(true);
  });

  it('renders the province provenance chip text', () => {
    render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
    expect(screen.getByText(/BC CSR site centroids/i)).toBeInTheDocument();
  });

  it('renders Option C aggregate layer chrome separately from sample rows', () => {
    render(
      <MatrixMap
        initialMapData={EMPTY_MATRIX_MAP_DATA}
        siteAggregateData={siteAggregateData}
      />,
    );

    expect(screen.getByText('Site aggregates')).toBeInTheDocument();
    expect(screen.getByText(/2 site aggregates represent 11 total samples at centroid-site locations/i)).toBeInTheDocument();
    expect(screen.queryByText(/Station/i)).not.toBeInTheDocument();
  });

  it('surveyed_only hides the aggregate marker layer text', () => {
    render(
      <MatrixMap
        initialMapData={EMPTY_MATRIX_MAP_DATA}
        siteAggregateData={siteAggregateData}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /show surveyed locations only/i }));
    expect(screen.getByText(/Site aggregates hidden by Surveyed only/i)).toBeInTheDocument();
  });

  it('renders aggregate marker HTML as a distinct escaped diamond', () => {
    const html = createSiteAggregateMarkerHtml(aggregateMarker);
    expect(html).toContain('transform:rotate(45deg)');
    expect(html).toContain('border:2px dashed #0f766e');
    expect(html).toContain('Old &lt;Slope&gt; Place');
    expect(html).not.toMatch(/sample_id|station_id|measurement/i);
  });

  it('filters aggregate-covered centroid samples out of sample UI candidates', () => {
    const coveredCentroid = matrixSample({ id: 'covered' });
    const surveyed = matrixSample({
      id: 'surveyed',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
    });
    const otherCluster = matrixSample({
      id: 'other-cluster',
      geometry: { type: 'Point', coordinates: [-123.1307, 49.2927] },
    });

    const filtered = filterSamplesCoveredBySiteAggregates(
      [coveredCentroid, surveyed, otherCluster],
      [aggregateMarker],
    );
    expect(filtered.map((sample) => sample.id)).toEqual(['surveyed', 'other-cluster']);
  });

  it('excludes aggregate-covered centroid samples from the list and All selection', () => {
    const coveredCentroid = matrixSample({
      id: 'covered',
      display_name: 'Covered centroid sample',
      station_id: 'COVERED',
    });
    const surveyed = matrixSample({
      id: 'surveyed',
      display_name: 'Surveyed sample',
      station_id: 'SURVEYED',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
    });

    render(
      <MatrixMap
        initialMapData={{
          ...EMPTY_MATRIX_MAP_DATA,
          visible_samples: [coveredCentroid, surveyed],
        }}
        siteAggregateData={{
          ...siteAggregateData,
          site_aggregate_markers: [aggregateMarker],
          site_count: 1,
        }}
      />,
    );

    expect(screen.queryByText('Covered centroid sample')).not.toBeInTheDocument();
    expect(screen.getByText('Surveyed sample')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['surveyed']);
  });

  it('fails closed by hiding medium-tier samples when aggregate fetch is unavailable', () => {
    const mediumCentroid = matrixSample({
      id: 'medium-centroid',
      display_name: 'Medium centroid sample',
      station_id: 'MEDIUM',
    });
    const surveyed = matrixSample({
      id: 'surveyed',
      display_name: 'Surveyed sample',
      station_id: 'SURVEYED',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
    });

    render(
      <MatrixMap
        initialMapData={{
          ...EMPTY_MATRIX_MAP_DATA,
          visible_samples: [mediumCentroid, surveyed],
        }}
        siteAggregateFetchErrorMessage="Site aggregates temporarily unavailable."
      />,
    );

    expect(screen.queryByText('Medium centroid sample')).not.toBeInTheDocument();
    expect(screen.getByText('Surveyed sample')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['surveyed']);
  });
  it('keeps aggregate-covered samples suppressed when active filters hide aggregate markers', () => {
    useMatrixMapFilterStore.getState().setFilterState({ classification: 'unknown' });
    const coveredCentroid = matrixSample({
      id: 'covered',
      display_name: 'Covered centroid sample',
      station_id: 'COVERED',
      classification: 'unknown',
    });
    const surveyed = matrixSample({
      id: 'surveyed',
      display_name: 'Surveyed sample',
      station_id: 'SURVEYED',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
      classification: 'unknown',
    });

    render(
      <MatrixMap
        initialMapData={{
          ...EMPTY_MATRIX_MAP_DATA,
          visible_samples: [coveredCentroid, surveyed],
        }}
        siteAggregateData={{
          ...siteAggregateData,
          site_aggregate_markers: [aggregateMarker],
          site_count: 1,
        }}
      />,
    );

    expect(screen.queryByText('Covered centroid sample')).not.toBeInTheDocument();
    expect(screen.getByText('Surveyed sample')).toBeInTheDocument();
  });
  it('includes aggregate markers in fit-bound points', () => {
    const surveyed = matrixSample({
      id: 'surveyed',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
      geometry: { type: 'Point', coordinates: [-123.5, 49.5] },
    });

    expect(getFitBoundsPoints([surveyed], [aggregateMarker])).toEqual([
      [49.5, -123.5],
      aggregateMarker.position,
    ]);
  });
});
