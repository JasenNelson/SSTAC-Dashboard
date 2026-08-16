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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
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

  describe('marker HTML injection regression (sample_count_label sink)', () => {
    // The bucket label is server-supplied. The DB emits a closed vocabulary
    // ('1','2-9','10-99','100+') but the client type is a plain `string`, so
    // nothing guarantees at runtime that only those four values arrive. This
    // value was previously interpolated RAW into Leaflet's divIcon HTML while
    // the adjacent aggregate.label was escaped.

    it('escapes angle brackets in sample_count_label', () => {
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        sample_count_label: '<b>2-9</b>',
      });
      expect(html).toContain('&lt;b&gt;2-9&lt;/b&gt;');
      expect(html).not.toContain('<b>');
    });

    it('escapes ampersands in sample_count_label', () => {
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        sample_count_label: 'A & B',
      });
      expect(html).toContain('&amp;');
      expect(html).not.toMatch(/A & B/);
    });

    it('escapes double and single quotes in sample_count_label', () => {
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        sample_count_label: `"quoted" 'single'`,
      });
      expect(html).not.toContain('"quoted"');
      expect(html).not.toContain("'single'");
      expect(html).toMatch(/&quot;|&#34;|&#039;|&#39;|&apos;/);
    });

    it('neutralises an attempted HTML tag with an event handler', () => {
      const payload = '<img src=x onerror="alert(1)">';
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        sample_count_label: payload,
      });
      // The literal tag must not survive as markup.
      expect(html).not.toContain('<img');
      expect(html).not.toContain('onerror="alert(1)"');
      expect(html).toContain('&lt;img');
      // And it must not have been silently dropped either -- it should appear,
      // escaped, so the operator can see the malformed value.
      expect(html).toContain('&lt;');
    });

    it('escapes the numeric fallback path as well', () => {
      // When sample_count_label is absent the label is derived from a number,
      // which is inherently safe -- assert it still renders and no raw tag
      // characters leak from the surrounding template.
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        sample_count_label: undefined,
        sample_count_total: 7,
      });
      expect(html).toContain('>7<');
    });

    it('keeps the escaping contract on the aria-label as well', () => {
      const html = createSiteAggregateMarkerHtml({
        ...aggregateMarker,
        label: '<script>x</script>',
        sample_count_label: '2-9',
      });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  // NOTE: the member-payload allow-list contract is deliberately NOT asserted
  // here. A version of it living in this file could only inspect a hand-built
  // AggregateMarker fixture, which is vacuous against the production boundary:
  // if normalizePublishedAggregate began copying coordinate_source or another
  // private field, the fixture would not change and every assertion would still
  // pass. The authoritative version asserts the allow-list and forbidden-field
  // absence on a marker produced by the REAL RPC path, and lives in
  // src/lib/matrix-map/__tests__/fetch-site-aggregates-server.test.ts under
  // "member payload boundary contract".

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
  it('filters centroid samples using a non-display suppression key from published aggregates', () => {
    const coveredCentroid = matrixSample({ id: 'covered' });
    const surveyed = matrixSample({
      id: 'surveyed',
      coordinate_quality_tier: 'high',
      coordinate_source: 'surveyed',
    });
    const publishedMarker: AggregateMarker = {
      ...aggregateMarker,
      key: 'published-aggregate-1',
      source_dra_id: 'published-aggregate:published-aggregate-1',
      sample_suppression_key: 'dra-1:49.28270,-123.12070',
      sample_count_label: '2-9',
    };

    const filtered = filterSamplesCoveredBySiteAggregates(
      [coveredCentroid, surveyed],
      [publishedMarker],
    );
    expect(filtered.map((sample) => sample.id)).toEqual(['surveyed']);
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
  // Decision #12: one stacked notice column, priority order fetch -> aggregate
  // -> refetch, instead of three independently-absolute-positioned banners.
  describe('decision #12: consolidated notice column', () => {
    it('stacks the prop-driven notices in one column, fetch error before aggregate error', () => {
      // RENAMED AND STRENGTHENED (round-4 Leg 1a P2-3). The previous name claimed
      // "all three notices in priority order" and asserted NEITHER: it rendered two
      // notices (refetchError is internal state, not prop-drivable here) and only
      // checked that the column's textContent CONTAINED each string. Swapping the two
      // blocks in MatrixMap.tsx left every assertion passing while inverting the
      // documented decision-#12 ordering.
      //
      // Two-sided falsification:
      //  - Positive: both notices share ONE positioned wrapper (the decision's actual
      //    structural claim -- no more independently-absolute banners).
      //  - Negative: fetch error must precede aggregate error in DOM order. Reordering
      //    the source blocks now fails this test by name rather than silently passing.
      const { container } = render(
        <MatrixMap
          initialMapData={{ ...EMPTY_MATRIX_MAP_DATA, truncated: false }}
          fetchErrorMessage="fetch failed"
          siteAggregateFetchErrorMessage="aggregate failed"
        />,
      );

      const column = container.querySelector('.absolute.top-20.left-4.right-4');
      expect(column).not.toBeNull();

      const fetchNode = screen.getByText('fetch failed');
      const aggregateNode = screen.getByText('aggregate failed');

      // Both notices live inside the same wrapper (one stacked column).
      expect(column?.contains(fetchNode)).toBe(true);
      expect(column?.contains(aggregateNode)).toBe(true);

      // Priority order: fetch error is emitted BEFORE aggregate error.
      const fetchPrecedes = Boolean(
        fetchNode.compareDocumentPosition(aggregateNode) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(fetchPrecedes).toBe(true);
    });

    it('renders no notice wrapper when no notices are active', () => {
      const { container } = render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      expect(container.querySelector('.absolute.top-20.left-4.right-4')).toBeNull();
    });
  });

  // Decision #1a: labels must always render (the `hidden sm:inline` gating
  // is removed), regardless of viewport -- jsdom cannot verify visibility,
  // but it can verify the text nodes are unconditionally present in markup.
  describe('decision #1a: interaction-mode labels always present', () => {
    it('renders all 5 mode-toolbar labels unconditionally', () => {
      render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      for (const label of ['Pan', 'Select', 'Area', 'Identify', 'Identify Area']) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    });

    it('does not gate mode-toolbar labels behind a hidden sm:inline class', () => {
      const { container } = render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      const panLabel = screen.getByText('Pan');
      expect(panLabel.className).not.toMatch(/hidden/);
      expect(container.querySelectorAll('.hidden.sm\\:inline').length).toBe(0);
    });

    it('renders a VISIBLE word on every zoom/layer-stack control, not just a tooltip', () => {
      // Round-4 spec audit: #1a requires the 44px floor AND a visible short word on
      // EVERY icon-only control -- it names "the zoom/layer stack" explicitly. The
      // mode toolbar above got its labels; this stack shipped with `aria-label` +
      // `title` only. That is not equivalent: a `title` tooltip needs hover, so it
      // does not exist on touch devices, which are the devices #1a targets.
      //
      // Two-sided falsification:
      //  - Positive: each control exposes its short word as real TEXT.
      //  - Negative: `getByText` is the discriminating choice. It reads text content
      //    only, so it CANNOT be satisfied by `aria-label` or `title` -- reverting to
      //    the icon-only buttons fails every line here. Using `getByRole(..., {name})`
      //    instead would have passed against the broken version, because the
      //    accessible name was already correct; that is exactly how this shipped.
      render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);

      for (const word of ['In', 'Out', 'Fit', 'Layers', 'Export']) {
        expect(screen.getByText(word)).toBeInTheDocument();
      }
    });

    it('keeps the descriptive accessible name on zoom controls despite the short visible word', () => {
      // The visible word is deliberately terser than the accessible name ("In" vs
      // "Zoom in"). Screen-reader users must still get the full description, so the
      // fix must not have replaced aria-label with the short word.
      render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);

      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Zoom out' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Fit to samples' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Change map layer' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export map image' })).toBeInTheDocument();
    });
  });

  // Decision #13: the "Surveyed only" checkbox must stay always-visible
  // (moved to the sample-count header) and NOT live inside the collapsible
  // <details> legend element.
  describe('decision #13: checkbox relocated outside the collapsible legend', () => {
    it('renders the surveyed_only checkbox outside the <details> legend', () => {
      const { container } = render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      const checkbox = screen.getByRole('checkbox', { name: /show surveyed locations only/i });
      const details = container.querySelector('details');
      expect(details).not.toBeNull();
      expect(details?.contains(checkbox)).toBe(false);
    });

    it('renders the classification legend inside a collapsible <details> element', () => {
      const { container } = render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      const details = container.querySelector('details');
      expect(details).not.toBeNull();
      expect(details?.textContent).toContain('Classification');
      expect(details?.querySelector('summary')).not.toBeNull();
    });
  });

  // Round-2 P2-4: the breakpoint handler and the user's own toggle both write
  // `legendExpanded`. Round 1 left them unarbitrated, so every 767px crossing forced the
  // state and a desktop user who collapsed the legend had it silently re-expanded over the
  // map on the next window resize. User intent must win once the user has toggled.
  describe('round-2 P2-4: legend breakpoint default vs user intent', () => {
    const realMatchMedia = window.matchMedia;
    let listeners: Array<(event: { matches: boolean }) => void> = [];

    function installMatchMedia(initialMatches: boolean) {
      listeners = [];
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: initialMatches,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: (_type: string, cb: (event: { matches: boolean }) => void) => {
            listeners.push(cb);
          },
          removeEventListener: (_type: string, cb: (event: { matches: boolean }) => void) => {
            listeners = listeners.filter((l) => l !== cb);
          },
          dispatchEvent: vi.fn(),
        })),
      });
    }

    function fireBreakpointChange(matches: boolean) {
      act(() => {
        listeners.forEach((cb) => cb({ matches }));
      });
    }

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: realMatchMedia,
      });
    });

    // Control / negative half: with NO user toggle the breakpoint listener must still drive
    // the disclosure. Without this, the "user intent wins" test below could pass simply
    // because the listener was deleted outright.
    it('still applies the breakpoint default while the user has not toggled', () => {
      installMatchMedia(false); // desktop on mount -> open
      render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      const details = screen
        .getByTestId('matrix-map-legend-summary')
        .closest('details') as HTMLDetailsElement;
      expect(details.hasAttribute('open')).toBe(true);

      fireBreakpointChange(true); // crossed to mobile
      expect(details.hasAttribute('open')).toBe(false);
    });

    // Positive half: after a manual toggle the breakpoint must stop writing. Asserted as
    // "the state is UNCHANGED across the breakpoint crossing" rather than a fixed value,
    // so the test does not depend on whether jsdom's summary-activation behaviour flipped
    // the disclosure on click.
    it('stops applying the breakpoint default once the user has toggled the legend', () => {
      installMatchMedia(false); // desktop on mount -> open
      render(<MatrixMap initialMapData={EMPTY_MATRIX_MAP_DATA} />);
      const summary = screen.getByTestId('matrix-map-legend-summary');
      const details = summary.closest('details') as HTMLDetailsElement;

      fireEvent.click(summary);
      const openAfterUserToggle = details.hasAttribute('open');

      fireBreakpointChange(true); // crossed to mobile: must be ignored now
      expect(details.hasAttribute('open')).toBe(openAfterUserToggle);

      fireBreakpointChange(false); // and back to desktop: still ignored
      expect(details.hasAttribute('open')).toBe(openAfterUserToggle);
    });
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
