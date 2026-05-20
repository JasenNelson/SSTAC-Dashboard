/**
 * Smoke tests for the Matrix Interactive Map client component (PR-MAP-2).
 *
 * Scope:
 *   - The component renders without crashing in jsdom (react-leaflet
 *     normally needs a real browser; we stub it).
 *   - The 4 base-layer radio inputs are present.
 *   - All 14 BC WMS overlay checkboxes are present (after the R-11
 *     Jermilova exclusion filter).
 *   - Clicking an overlay checkbox toggles its checked state.
 *   - Clicking a base-layer radio switches the active selection.
 *
 * react-leaflet and leaflet both touch `window` at module load and
 * expect a real DOM, so we mock them out. The mocks render simple
 * `<div>`s that mirror the props as data attributes -- enough for the
 * smoke assertions without booting Leaflet.
 *
 * Plain ASCII only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// NOTE: MatrixMap.tsx intentionally does NOT import leaflet's CSS;
// the CSS is loaded by MatrixMapLoader.tsx in production. That keeps
// the vitest transform free of Vite's PostCSS host (which can't load
// the project's .mjs PostCSS config), so no leaflet.css stub is needed
// in this spec.

// Stub react-leaflet. We never want a real Leaflet map booting in
// jsdom; the smoke test only cares about the surrounding chrome +
// state wiring.
vi.mock('react-leaflet', () => {
  // Only forward DOM-safe props (className, style, data-*) into the
  // stub divs so React doesn't warn about react-leaflet-specific
  // props like minZoom / scrollWheelZoom landing on real DOM nodes.
  const pickDomProps = (
    props: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (
        k === 'className' ||
        k === 'style' ||
        k === 'id' ||
        k === 'role' ||
        k.startsWith('data-') ||
        k.startsWith('aria-')
      ) {
        out[k] = v;
      }
    }
    return out;
  };
  return {
    MapContainer: ({
      children,
      ...rest
    }: {
      children?: React.ReactNode;
      [k: string]: unknown;
    }) =>
      React.createElement(
        'div',
        { 'data-stub': 'MapContainer', ...pickDomProps(rest) },
        children,
      ),
    TileLayer: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-stub': 'TileLayer',
        'data-url': props.url as string,
      }),
    WMSTileLayer: (props: Record<string, unknown>) =>
      React.createElement('div', {
        'data-stub': 'WMSTileLayer',
        'data-layers': props.layers as string,
      }),
    ZoomControl: () =>
      React.createElement('div', { 'data-stub': 'ZoomControl' }),
    // useMap() is called by SampleMarkersLayer; return a minimal stub
    // map so SampleMarkersLayer's useEffect can run without throwing.
    // The stub's addLayer/removeLayer are no-ops because the marker
    // cluster plugin is also mocked below; assertions instead inspect
    // the SampleMarkersLayer stub div.
    useMap: () => ({
      addLayer: () => undefined,
      removeLayer: () => undefined,
    }),
  };
});

// Stub the SampleMarkersLayer module so the test does not need to
// dynamically import leaflet + leaflet.markercluster (both of which
// require a real browser environment). The stub renders a single div
// that mirrors the passed samples count + each sample's id so the
// spec can assert on the marker contract without booting Leaflet.
vi.mock('../SampleMarkersLayer', () => ({
  SampleMarkersLayer: ({
    samples,
  }: {
    samples: Array<{
      id: string;
      classification: string;
      coordinate_quality_tier: string;
    }>;
  }) =>
    React.createElement(
      'div',
      {
        'data-stub': 'SampleMarkersLayer',
        'data-testid': 'matrix-map-sample-layer-stub',
        'data-sample-count': String(samples.length),
      },
      samples.map((s) =>
        React.createElement('span', {
          key: s.id,
          'data-testid': `matrix-map-sample-marker-${s.id}`,
          'data-sample-id': s.id,
          'data-classification': s.classification,
          'data-tier': s.coordinate_quality_tier,
        }),
      ),
    ),
}));

// Import AFTER the mocks so the component picks up the stubs.
import { MatrixMap, __TESTING__ } from '../MatrixMap';
import type { MatrixMapData, MatrixSample } from '../types';

// ----------------------------------------------------------------------
// Test fixtures (3a sample-rendering specs).
// ----------------------------------------------------------------------

const SAMPLE_REFERENCE_HIGH: MatrixSample = {
  id: 'sample-001',
  bnrrm_station_id: 1,
  station_id: 'EMS-001',
  display_name: 'Station Alpha',
  geometry: { type: 'Point', coordinates: [-123.0, 49.0] },
  coordinate_quality_tier: 'high',
  coordinate_source: 'surveyed',
  classification: 'reference',
  classification_source: 'station_type',
  classification_rationale: 'station_type=reference from DRA citation',
  classification_confidence: 'high',
  source_dra_id: 'dra-aaa',
  public: true,
  bc_region: 'Lower Mainland',
  waterbody: 'Fraser River',
  waterbody_type: 'river',
};

const SAMPLE_IMPACTED_MEDIUM: MatrixSample = {
  id: 'sample-002',
  bnrrm_station_id: 2,
  station_id: 'EMS-002',
  display_name: 'Station Beta',
  geometry: { type: 'Point', coordinates: [-123.1, 49.1] },
  coordinate_quality_tier: 'medium',
  coordinate_source: 'bc_csr_centroid',
  classification: 'impacted',
  classification_source: 'station_type',
  classification_rationale: 'station_type=exposure from DRA citation',
  classification_confidence: 'medium',
  source_dra_id: 'dra-bbb',
  public: true,
  bc_region: 'Lower Mainland',
  waterbody: 'Burrard Inlet',
  waterbody_type: 'marine',
};

const SAMPLE_UNKNOWN_LOW: MatrixSample = {
  id: 'sample-003',
  bnrrm_station_id: 3,
  station_id: 'EMS-003',
  display_name: 'Station Gamma',
  geometry: { type: 'Point', coordinates: [-123.2, 49.2] },
  coordinate_quality_tier: 'low',
  coordinate_source: 'manual_steward',
  classification: 'unknown',
  classification_source: 'data_unknown',
  classification_rationale: null,
  classification_confidence: null,
  source_dra_id: 'dra-ccc',
  public: false,
  bc_region: 'Vancouver Island',
  waterbody: 'Cowichan Bay',
  waterbody_type: 'marine',
};

const THREE_SAMPLES: MatrixSample[] = [
  SAMPLE_REFERENCE_HIGH,
  SAMPLE_IMPACTED_MEDIUM,
  SAMPLE_UNKNOWN_LOW,
];

const EMPTY_DATA: MatrixMapData = {
  visible_samples: [],
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'test-empty',
};

const DATA_THREE_VISIBLE_NO_HIDDEN: MatrixMapData = {
  visible_samples: THREE_SAMPLES,
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'test-3v0h',
};

const DATA_THREE_VISIBLE_WITH_HIDDEN: MatrixMapData = {
  visible_samples: THREE_SAMPLES,
  hidden_sample_count: 5,
  hidden_dra_count: 2,
  hidden_dra_ids: ['dra-hidden-1', 'dra-hidden-2'],
  data_snapshot_version: 'test-3v5h',
};

describe('MatrixMap (PR-MAP-2 smoke)', () => {
  beforeEach(() => {
    // Defensive: reset DOM between tests is done by setup.ts cleanup.
  });

  it('renders without crashing', () => {
    render(<MatrixMap />);
    expect(screen.getByTestId('matrix-map-root')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-map-container')).toBeInTheDocument();
  });

  it('renders 4 base-layer radio inputs', () => {
    render(<MatrixMap />);
    for (const key of __TESTING__.BASE_LAYER_ORDER) {
      const el = screen.getByTestId(`matrix-map-base-${key}`);
      expect(el).toBeInTheDocument();
      expect((el as HTMLInputElement).type).toBe('radio');
    }
    expect(__TESTING__.BASE_LAYER_ORDER).toHaveLength(4);
  });

  it('renders 14 BC WMS overlay checkboxes (R-11 Jermilova filter applied)', () => {
    render(<MatrixMap />);
    const keys = __TESTING__.OVERLAY_KEY_ORDER;
    expect(keys.length).toBe(14);
    // No Jermilova entries survive the R-11 guard.
    for (const k of keys) {
      expect(/jermilova/i.test(k)).toBe(false);
    }
    for (const key of keys) {
      const el = screen.getByTestId(`matrix-map-overlay-${key}`);
      expect(el).toBeInTheDocument();
      expect((el as HTMLInputElement).type).toBe('checkbox');
      // Default visibility = false for every overlay in v1.
      expect((el as HTMLInputElement).checked).toBe(false);
    }
  });

  it('toggles overlay visibility when its checkbox is clicked', () => {
    render(<MatrixMap />);
    const cb = screen.getByTestId(
      'matrix-map-overlay-csrSites',
    ) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    expect(cb.checked).toBe(true);
    fireEvent.click(cb);
    expect(cb.checked).toBe(false);
  });

  // Per codex PR-MAP-2 R1 P3-1: assert the checkbox toggle actually
  // mounts and unmounts a WMSTileLayer for csrSites with the expected
  // layers value (not just flips the checkbox-state UI).
  it('mounts and unmounts the csrSites WMSTileLayer when its checkbox toggles', () => {
    const expectedLayer = __TESTING__.OVERLAY_LAYERS.csrSites.layer;
    expect(expectedLayer).toBeTruthy();
    render(<MatrixMap />);
    const findCsrSitesWms = () =>
      document.querySelector(
        `[data-stub="WMSTileLayer"][data-layers="${expectedLayer}"]`,
      );
    // Initially csrSites overlay is hidden; no matching WMSTileLayer mount.
    expect(findCsrSitesWms()).toBeNull();
    const cb = screen.getByTestId(
      'matrix-map-overlay-csrSites',
    ) as HTMLInputElement;
    fireEvent.click(cb);
    expect(findCsrSitesWms()).not.toBeNull();
    fireEvent.click(cb);
    expect(findCsrSitesWms()).toBeNull();
  });

  it('switches the active base layer when a different radio is clicked', () => {
    render(<MatrixMap />);
    const streets = screen.getByTestId(
      'matrix-map-base-streets',
    ) as HTMLInputElement;
    const satellite = screen.getByTestId(
      'matrix-map-base-satellite',
    ) as HTMLInputElement;
    expect(streets.checked).toBe(true);
    expect(satellite.checked).toBe(false);
    fireEvent.click(satellite);
    expect(streets.checked).toBe(false);
    expect(satellite.checked).toBe(true);
  });

  it('collapses and expands the overlay panel via the toggle button', () => {
    render(<MatrixMap />);
    const toggle = screen.getByTestId('matrix-map-overlay-toggle');
    // List is visible by default.
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).not.toBeNull();
    fireEvent.click(toggle);
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).toBeNull();
    fireEvent.click(toggle);
    expect(
      document.getElementById('matrix-map-overlay-list'),
    ).not.toBeNull();
  });
});

// =====================================================================
// PR-MAP-3a sample-rendering specs
// =====================================================================

describe('MatrixMap (PR-MAP-3a samples + symbology)', () => {
  it('mounts the SampleMarkersLayer (cluster group surrogate)', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_NO_HIDDEN} />,
    );
    expect(
      screen.getByTestId('matrix-map-sample-layer-stub'),
    ).toBeInTheDocument();
  });

  it('renders one marker stub per visible sample fixture', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_NO_HIDDEN} />,
    );
    const layer = screen.getByTestId('matrix-map-sample-layer-stub');
    expect(layer.getAttribute('data-sample-count')).toBe('3');
    for (const sample of THREE_SAMPLES) {
      const marker = screen.getByTestId(
        `matrix-map-sample-marker-${sample.id}`,
      );
      expect(marker).toBeInTheDocument();
      expect(marker.getAttribute('data-classification')).toBe(
        sample.classification,
      );
      expect(marker.getAttribute('data-tier')).toBe(
        sample.coordinate_quality_tier,
      );
    }
  });

  it('renders the empty-state overlay when visible_samples is empty', () => {
    render(<MatrixMap initialMapData={EMPTY_DATA} />);
    const empty = screen.getByTestId('matrix-map-empty-state');
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toContain('No samples yet');
  });

  it('hides the empty-state overlay when at least one sample is visible', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_NO_HIDDEN} />,
    );
    expect(
      screen.queryByTestId('matrix-map-empty-state'),
    ).toBeNull();
  });

  it('renders the partial-visibility banner when hidden_sample_count > 0 (with mailto link + hidden counts)', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_WITH_HIDDEN} />,
    );
    const banner = screen.getByTestId(
      'matrix-map-partial-visibility-banner',
    );
    expect(banner).toBeInTheDocument();
    // Hidden sample + DRA counts surfaced in banner text.
    expect(banner.textContent).toContain('5');
    expect(banner.textContent).toContain('2');
    expect(banner.textContent).toContain('do not have access');
    // Visible-sample composition surfaced.
    expect(banner.textContent).toContain('Visible: 3');
    // Mailto link present + populated with hidden dra ids.
    const mailto = screen.getByTestId(
      'matrix-map-banner-mailto',
    ) as HTMLAnchorElement;
    expect(mailto).toBeInTheDocument();
    expect(mailto.href.startsWith('mailto:')).toBe(true);
    // URLSearchParams encodes spaces as '+'; decodeURIComponent does
    // NOT convert '+' back to a space. Normalize both forms.
    const decoded = decodeURIComponent(
      mailto.href.replace(/\+/g, ' '),
    );
    expect(decoded).toContain('dra-hidden-1');
    expect(decoded).toContain('dra-hidden-2');
    expect(decoded).toContain('Matrix Map access request');
  });

  it('suppresses the partial-visibility banner when hidden_sample_count == 0 (Q-8)', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_NO_HIDDEN} />,
    );
    expect(
      screen.queryByTestId('matrix-map-partial-visibility-banner'),
    ).toBeNull();
  });

  it('hides the partial-visibility banner when the dismiss X is clicked (session-only)', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_WITH_HIDDEN} />,
    );
    expect(
      screen.getByTestId('matrix-map-partial-visibility-banner'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('matrix-map-banner-dismiss'));
    expect(
      screen.queryByTestId('matrix-map-partial-visibility-banner'),
    ).toBeNull();
  });

  it('renders the sample legend card collapsed by default and expands on toggle click', () => {
    render(
      <MatrixMap initialMapData={DATA_THREE_VISIBLE_NO_HIDDEN} />,
    );
    expect(
      screen.getByTestId('matrix-map-legend'),
    ).toBeInTheDocument();
    // Body absent in collapsed state.
    expect(
      screen.queryByTestId('matrix-map-legend-body'),
    ).toBeNull();
    fireEvent.click(screen.getByTestId('matrix-map-legend-toggle'));
    expect(
      screen.getByTestId('matrix-map-legend-body'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('matrix-map-legend-toggle'));
    expect(
      screen.queryByTestId('matrix-map-legend-body'),
    ).toBeNull();
  });

  it('surfaces the server-side fetch-error notice instead of the empty-state overlay', () => {
    render(
      <MatrixMap
        initialMapData={EMPTY_DATA}
        fetchErrorMessage="Samples data temporarily unavailable -- check /admin/matrix-map/health"
      />,
    );
    expect(
      screen.getByTestId('matrix-map-fetch-error'),
    ).toBeInTheDocument();
    // When the fetch errored, suppress the empty-state overlay so the
    // reviewer sees the actionable error notice rather than the "ETL
    // pending" message which would be misleading.
    expect(
      screen.queryByTestId('matrix-map-empty-state'),
    ).toBeNull();
  });
});
