/**
 * SiteMap smoke-render and basic interaction tests.
 *
 * Strategy: SiteMap dynamically imports leaflet inside a useEffect. In jsdom
 * that effect runs but the DOM has no real layout engine, so the map never
 * becomes "isLoaded". That is fine -- we exercise the DOM surface that is
 * visible BEFORE the map loads (loading spinner, site-count header, interaction
 * mode toolbar) AND, after the stores are seeded, the site-list panel that
 * appears when siteCount > 0.
 *
 * We mock:
 *   - leaflet and leaflet.markercluster (dynamic imports)
 *   - leaflet/dist/leaflet.css and leaflet.markercluster CSS (vitest.config.ts alias)
 *   - useSiteDataStore and usePackStore (Zustand; injected per-test)
 *   - @/hooks/bn-rrm/usePackMapArtifact (not under test)
 *   - @/lib/maps/wms-identify (not under test)
 *   - html-to-image (export handler, not under test)
 *
 * Plain ASCII only. No em dashes. No emoji.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted before imports by vi.mock factory)
// ---------------------------------------------------------------------------

// Leaflet and markercluster dynamic imports
vi.mock('leaflet', () => {
  const mockMap = {
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    setView: vi.fn(),
    fitBounds: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    closePopup: vi.fn(),
    getContainer: vi.fn(() => ({
      style: { cursor: '' },
      classList: { add: vi.fn(), remove: vi.fn() },
    })),
    getBounds: vi.fn(() => ({
      toBBoxString: vi.fn(() => '0,0,1,1'),
      getNorthEast: vi.fn(() => ({ lat: 1, lng: 1 })),
      getSouthWest: vi.fn(() => ({ lat: 0, lng: 0 })),
    })),
  };

  const mockTileLayer: any = { addTo: vi.fn(() => mockTileLayer), remove: vi.fn() };
  const mockWmsLayer: any = { addTo: vi.fn(() => mockWmsLayer), remove: vi.fn() };
  const mockClusterGroup = {
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    clearLayers: vi.fn(),
    on: vi.fn(),
  };
  const mockGeoJsonLayer: any = {
    addTo: vi.fn(() => mockGeoJsonLayer),
    remove: vi.fn(),
    on: vi.fn(),
  };
  const mockPopup: any = {
    setLatLng: vi.fn(() => mockPopup),
    setContent: vi.fn(() => mockPopup),
    openOn: vi.fn(),
  };

  const L = {
    map: vi.fn(() => mockMap),
    tileLayer: Object.assign(vi.fn(() => mockTileLayer), {
      wms: vi.fn(() => mockWmsLayer),
    }),
    markerClusterGroup: vi.fn(() => mockClusterGroup),
    circleMarker: vi.fn(() => ({
      addTo: vi.fn(),
      on: vi.fn(),
      bindPopup: vi.fn(),
      getPopup: vi.fn(() => null),
    })),
    geoJSON: vi.fn(() => mockGeoJsonLayer),
    latLngBounds: vi.fn(() => ({
      pad: vi.fn(() => ({})),
    })),
    popup: vi.fn(() => mockPopup),
    divIcon: vi.fn(() => ({})),
    point: vi.fn((x: number, y: number) => ({ x, y })),
    rectangle: vi.fn(() => ({
      addTo: vi.fn(),
      remove: vi.fn(),
      setBounds: vi.fn(),
      getBounds: vi.fn(() => ({})),
    })),
  };

  return { default: L, ...L };
});

vi.mock('leaflet.markercluster', () => ({}));

// html-to-image (export handler; not under test)
vi.mock('html-to-image', () => ({
  toPng: vi.fn(() => Promise.resolve('data:image/png;base64,test')),
}));

// Pack artifact hook
vi.mock('@/hooks/bn-rrm/usePackMapArtifact', () => ({
  loadMapArtifact: vi.fn(() => Promise.resolve(null)),
  clearMapArtifactCacheForPack: vi.fn(),
}));

// WMS identify helpers
vi.mock('@/lib/maps/wms-identify', () => ({
  getActiveOverlaysInZOrder: vi.fn(() => []),
  queryActiveOverlays: vi.fn(() => Promise.resolve([])),
  queryActiveOverlaysInBounds: vi.fn(() => Promise.resolve([])),
}));

// Identify popup formatters
vi.mock('@/lib/maps/identify-format', () => ({
  formatIdentifyEmptyHtml: vi.fn(() => '<p>No features</p>'),
  formatIdentifyPopupHtml: vi.fn(() => '<p>Features</p>'),
}));

// Zustand stores -- auto-mocked; implementations are supplied per-test
vi.mock('@/stores/bn-rrm/siteDataStore');
vi.mock('@/stores/bn-rrm/packStore');

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { SiteMap } from '../SiteMap';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { usePackStore } from '@/stores/bn-rrm/packStore';

// ---------------------------------------------------------------------------
// Shared mock state builders
// ---------------------------------------------------------------------------

/** Returns a minimal pack store state object (no pack selected). */
function makePackState() {
  return {
    packManifest: null,
    selectedPackId: null,
    getPackBaseUrl: vi.fn(() => null),
  };
}

/** Returns a minimal site data store state with no sites. */
function makeSiteState(overrides: Record<string, unknown> = {}) {
  return {
    sites: {},
    assessments: {},
    selectedSiteId: null,
    selectedSiteIds: [] as string[],
    selectSite: vi.fn(),
    toggleSiteSelection: vi.fn(),
    selectAllSites: vi.fn(),
    clearSiteSelection: vi.fn(),
    setIdentifiedFeatures: vi.fn(),
    clearIdentifiedFeatures: vi.fn(),
    ...overrides,
  };
}

/** Wire up mocked Zustand store implementations for a test. */
function setupStores(
  siteOverrides: Record<string, unknown> = {},
): ReturnType<typeof makeSiteState> {
  const siteState = makeSiteState(siteOverrides);
  const packState = makePackState();

  // Cast through any to avoid the strict generic selector mismatch that arises
  // because the Zustand hook type is generic over U (the return type) and
  // TypeScript cannot narrow the selector callback type at the callsite here.
  (useSiteDataStore as any).mockImplementation((sel: any) => sel(siteState));
  (usePackStore as any).mockImplementation((sel: any) => sel(packState));

  return siteState;
}

/** Two-site fixture used by several tests. */
const TWO_SITES = {
  'site-1': {
    location: {
      id: 'site-1',
      name: 'Test Site Alpha',
      latitude: 49.28,
      longitude: -123.12,
      region: 'Metro Vancouver',
      sourceTag: 'reference',
    },
    chemistry: null,
  },
  'site-2': {
    location: {
      id: 'site-2',
      name: 'Test Site Beta',
      latitude: 49.29,
      longitude: -123.11,
      region: 'Metro Vancouver',
      sourceTag: 'reference',
    },
    chemistry: null,
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SiteMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Smoke render -- no crash with minimal props
  it('renders without crashing with no props', () => {
    setupStores();
    const { container } = render(<SiteMap />);
    expect(container).toBeTruthy();
  });

  // 2. Loading state -- spinner shown before Leaflet initializes
  it('shows loading spinner before map is initialized', () => {
    setupStores();
    render(<SiteMap />);
    expect(screen.getByText('Loading map...')).toBeInTheDocument();
  });

  // 3. Site count header -- 0 sites shows "0" and "Sites loaded"
  it('renders site count header with zero sites', () => {
    setupStores();
    render(<SiteMap />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Sites loaded')).toBeInTheDocument();
  });

  // 4. Site count header -- singular label for 1 site
  it('shows singular "Site loaded" label when exactly one site is present', () => {
    setupStores({
      sites: {
        'site-1': {
          location: {
            id: 'site-1',
            name: 'Only Site',
            latitude: 49.0,
            longitude: -123.0,
            region: null,
            sourceTag: 'reference',
          },
          chemistry: null,
        },
      },
    });
    render(<SiteMap />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Site loaded')).toBeInTheDocument();
  });

  // 5. Interaction mode toolbar -- all 5 mode buttons render
  it('renders all five interaction mode buttons', () => {
    setupStores();
    render(<SiteMap />);
    expect(screen.getByTitle(/pan mode/i)).toBeInTheDocument();
    expect(screen.getByTitle(/select mode/i)).toBeInTheDocument();
    expect(screen.getByTitle(/area select/i)).toBeInTheDocument();
    // Two buttons contain "Identify" so use the aria-label for the point one
    expect(screen.getByRole('button', { name: /identify mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /identify area mode/i })).toBeInTheDocument();
  });

  // 6. Interaction mode switching -- clicking Identify sets aria-pressed=true
  it('marks Identify button as aria-pressed when clicked', () => {
    setupStores();
    render(<SiteMap />);
    const identifyBtn = screen.getByRole('button', { name: /identify mode/i });
    expect(identifyBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(identifyBtn);
    expect(identifyBtn).toHaveAttribute('aria-pressed', 'true');
  });

  // 7. Interaction mode switching -- clicking Identify Area sets aria-pressed=true
  it('marks Identify Area button as aria-pressed when clicked', () => {
    setupStores();
    render(<SiteMap />);
    const btn = screen.getByRole('button', { name: /identify area mode/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  // 8. Interaction mode mutual exclusion -- Identify Area deactivates Identify
  it('deactivates Identify when Identify Area is activated', () => {
    setupStores();
    render(<SiteMap />);
    const identifyBtn = screen.getByRole('button', { name: /identify mode/i });
    const identifyAreaBtn = screen.getByRole('button', { name: /identify area mode/i });

    fireEvent.click(identifyBtn);
    expect(identifyBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(identifyAreaBtn);
    expect(identifyAreaBtn).toHaveAttribute('aria-pressed', 'true');
    expect(identifyBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // 9. Layer menu toggle -- layer menu hidden initially
  it('hides the layer menu initially', () => {
    setupStores();
    render(<SiteMap />);
    expect(screen.queryByText('Base Map')).not.toBeInTheDocument();
  });

  // 10. Layer menu toggle -- clicking the layer button opens the menu
  it('opens layer menu when change-layer button is clicked', () => {
    setupStores();
    render(<SiteMap />);
    const layerBtn = screen.getByRole('button', { name: /change map layer/i });
    fireEvent.click(layerBtn);
    expect(screen.getByText('Base Map')).toBeInTheDocument();
  });

  // 11. Layer menu -- aria-expanded reflects open/closed state correctly
  it('toggles aria-expanded on the layer button', () => {
    setupStores();
    render(<SiteMap />);
    const layerBtn = screen.getByRole('button', { name: /change map layer/i });
    expect(layerBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(layerBtn);
    expect(layerBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(layerBtn);
    expect(layerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  // 12. Site list panel -- not rendered when no sites are loaded
  it('does not render the site list panel when no sites are loaded', () => {
    setupStores();
    render(<SiteMap />);
    expect(screen.queryByText('Site Locations')).not.toBeInTheDocument();
  });

  // 13. Site list panel -- renders when sites are loaded
  it('renders the site list panel when sites are loaded', () => {
    setupStores({ sites: TWO_SITES });
    render(<SiteMap />);
    expect(screen.getByText('Site Locations')).toBeInTheDocument();
  });

  // 14. Site list panel -- individual site names appear in the list
  it('renders individual site names in the site list', () => {
    setupStores({ sites: TWO_SITES });
    render(<SiteMap />);
    expect(screen.getByText('Test Site Alpha')).toBeInTheDocument();
    expect(screen.getByText('Test Site Beta')).toBeInTheDocument();
  });

  // 15. Site list panel -- collapse toggle hides site entries
  it('collapses the site list when the header button is clicked', () => {
    setupStores({ sites: TWO_SITES });
    render(<SiteMap />);
    // Site entries are visible by default (expanded)
    expect(screen.getByText('Test Site Alpha')).toBeInTheDocument();

    const collapseBtn = screen.getByRole('button', { name: /collapse site list/i });
    fireEvent.click(collapseBtn);

    expect(screen.queryByText('Test Site Alpha')).not.toBeInTheDocument();
  });
});
