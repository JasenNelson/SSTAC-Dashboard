'use client';

// =====================================================================
// MatrixMap -- empty map skeleton for PR-MAP-2
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-2-map-ui
// Plan:   docs/design/matrix-map/PLAN_V3_4_2.md section 7 (PR-MAP-2 row)
//         + R-7 (overlay set reused from BN-RRM SiteMap OVERLAY_LAYERS)
//         + R-11 (ZERO Jermilova GeoJSON artifacts carry over).
//
// Scope in this file:
//   - React-Leaflet 5 MapContainer rendering an empty BC-province map.
//   - 4 base tile layer choices (Streets / Satellite / Topographic /
//     Terrain) selected via radio buttons in the top toolbar. Only one
//     is mounted at a time.
//   - 14 BC public WMS overlays, one checkbox per overlay in the left-
//     rail card. Default visibility = false for every overlay in v1
//     (user opts in).
//   - Single source-of-truth React state:
//       { baseLayer: BaseLayerKey; visibleOverlays: Set<string> }
//
// NOT in this file (deferred to later PRs):
//   - Sample markers / sample symbology / cluster (PR-MAP-3)
//   - Identify + identify-area tools (PR-MAP-3..4)
//   - Selection tools / Selection Stats panel (PR-MAP-4)
//   - Measurement Workbench (PR-MAP-5)
//   - Calculator bridge (PR-MAP-6)
//   - Per-DRA grant UI (PR-MAP-7)
//
// R-11 Jermilova exclusion guard:
//   Per plan section 6 ("ZERO Jermilova GeoJSON artifacts carry over"),
//   we filter the overlay catalog to skip any overlay whose key matches
//   /jermilova/i. The current BN-RRM OVERLAY_LAYERS catalog does NOT
//   include a Jermilova entry, so the filter is a no-op today, but the
//   guard is present so a future copy-paste from a Jermilova-bearing
//   catalog cannot silently leak it into the Matrix Map.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
// =====================================================================

// NOTE: `leaflet/dist/leaflet.css` is imported by the parent wrapper
// MatrixMapLoader.tsx (NOT here). Keeping the CSS side-effect import
// out of this module lets the vitest smoke spec mock react-leaflet
// without tripping over Vite's PostCSS pipeline. The CSS still loads
// in production because MatrixMapLoader is the only entry into this
// component tree (via next/dynamic).

import { useCallback, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  WMSTileLayer,
  ZoomControl,
} from 'react-leaflet';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';

// ---------------------------------------------------------------------
// Base tile layers (4 choices; matches BN-RRM SiteMap.BASE_LAYERS).
// ---------------------------------------------------------------------

type BaseLayerKey = 'streets' | 'satellite' | 'topo' | 'terrain';

interface BaseLayerDef {
  name: string;
  url: string;
  attribution: string;
  /** Max native zoom for the tile source; used as TileLayer maxNativeZoom. */
  maxNativeZoom?: number;
}

const BASE_LAYERS: Record<BaseLayerKey, BaseLayerDef> = {
  streets: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenStreetMap contributors',
    maxNativeZoom: 19,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '(c) Esri',
    maxNativeZoom: 19,
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenTopoMap',
    maxNativeZoom: 17,
  },
  terrain: {
    name: 'Terrain',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    attribution: '(c) Stamen Design',
    maxNativeZoom: 18,
  },
};

const BASE_LAYER_ORDER: BaseLayerKey[] = [
  'streets',
  'satellite',
  'topo',
  'terrain',
];

// ---------------------------------------------------------------------
// BC public WMS overlays (14 layers; mirrors BN-RRM SiteMap.OVERLAY_LAYERS
// 1:1; do NOT add or remove without updating BN-RRM in lockstep).
// ---------------------------------------------------------------------

const BC_WMS_URL = 'https://openmaps.gov.bc.ca/geo/pub/ows';
const BC_WMS_ATTRIBUTION = '(c) Province of British Columbia';

type OverlayCategory =
  | 'protected'
  | 'aquatic'
  | 'ecology'
  | 'regulatory'
  | 'waste';

interface OverlayDef {
  /** Display name shown in the left-rail checkbox label. */
  name: string;
  /** WMS layer identifier passed to TileLayer.WMS `layers` param. */
  layer: string;
  /** Hex color used for the legend swatch alongside the checkbox. */
  color: string;
  category: OverlayCategory;
}

const OVERLAY_LAYERS_RAW: Record<string, OverlayDef> = {
  parks: {
    name: 'Parks & Protected Areas',
    layer: 'pub:WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW',
    color: '#22c55e',
    category: 'protected',
  },
  conservancy: {
    name: 'Conservancy Areas',
    layer: 'pub:WHSE_TANTALIS.TA_CONSERVANCY_AREAS_SVW',
    color: '#16a34a',
    category: 'protected',
  },
  nationalParks: {
    name: 'National Parks (BC)',
    layer: 'pub:WHSE_ADMIN_BOUNDARIES.CLAB_NATIONAL_PARKS',
    color: '#15803d',
    category: 'protected',
  },
  criticalHabitat: {
    name: 'Critical Habitat (SARA)',
    layer: 'pub:WHSE_WILDLIFE_MANAGEMENT.WCP_CRITICAL_HABITAT_SP',
    color: '#dc2626',
    category: 'protected',
  },
  wildlifeHabitat: {
    name: 'Wildlife Habitat Areas',
    layer: 'pub:WHSE_WILDLIFE_MANAGEMENT.WCP_WILDLIFE_HABITAT_AREA_POLY',
    color: '#ea580c',
    category: 'protected',
  },
  oldGrowth: {
    name: 'Old Growth Forests',
    layer: 'pub:WHSE_FOREST_VEGETATION.OGSR_TAP_OG_FORESTS_SP',
    color: '#166534',
    category: 'ecology',
  },
  watersheds: {
    name: 'Watersheds',
    layer: 'pub:WHSE_BASEMAPPING.FWA_ASSESSMENT_WATERSHEDS_POLY',
    color: '#3b82f6',
    category: 'aquatic',
  },
  wetlands: {
    name: 'Wetlands',
    layer: 'pub:WHSE_BASEMAPPING.FWA_WETLANDS_POLY',
    color: '#0ea5e9',
    category: 'aquatic',
  },
  ecoregions: {
    name: 'Freshwater Ecoregions',
    layer: 'pub:WHSE_LAND_AND_NATURAL_RESOURCE.EAUBC_ECOREGIONS_SP',
    color: '#8b5cf6',
    category: 'ecology',
  },
  bec: {
    name: 'Biogeoclimatic Zones',
    layer: 'pub:WHSE_FOREST_VEGETATION.BEC_BIOGEOCLIMATIC_POLY',
    color: '#a855f7',
    category: 'ecology',
  },
  csrWildlands: {
    name: 'CSR Natural Wildlands',
    layer: 'pub:WHSE_ENVIRONMENT_ASSESSMENT.CSR_NATURAL_WILDLANDS_SP',
    color: '#f59e0b',
    category: 'regulatory',
  },
  csrSites: {
    name: 'Contaminated Sites Registry',
    layer: 'pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW',
    color: '#b91c1c',
    category: 'waste',
  },
  bkgdGroundwater: {
    name: 'Background Groundwater Concentration Regions',
    layer: 'pub:WHSE_WASTE.CSR_BKGD_GRNDWTR_CONC_AREAS_SP',
    color: '#7c2d12',
    category: 'waste',
  },
  emsMonitoring: {
    name: 'Environmental Monitoring Locations',
    layer: 'pub:WHSE_ENVIRONMENTAL_MONITORING.EMS_MONITORING_LOCN_TYPES_SVW',
    color: '#991b1b',
    category: 'waste',
  },
};

// R-11 Jermilova exclusion guard. The BN-RRM catalog has no Jermilova
// entry today, so this filter is a no-op. Kept in place so a future
// catalog refresh cannot silently leak Jermilova GeoJSON / WMS data
// into the Matrix Map (plan v3.4.2 section 6: "ZERO Jermilova GeoJSON
// artifacts carry over"). Per codex PR-MAP-2 R1 P3-2: checks key + name
// + the WMS layer field so a neutrally-named future layer that targets
// a Jermilova WMS endpoint cannot pass through.
const OVERLAY_LAYERS: Record<string, OverlayDef> = Object.fromEntries(
  Object.entries(OVERLAY_LAYERS_RAW).filter(
    ([key, def]) =>
      !/jermilova/i.test(key) &&
      !/jermilova/i.test(def.name) &&
      !/jermilova/i.test(def.layer),
  ),
);

const OVERLAY_KEY_ORDER: string[] = Object.keys(OVERLAY_LAYERS);

const OVERLAY_CATEGORY_ORDER: { key: OverlayCategory; label: string }[] = [
  { key: 'protected', label: 'Protected Areas & Habitat' },
  { key: 'aquatic', label: 'Aquatic Features' },
  { key: 'ecology', label: 'Ecosystem Classification' },
  { key: 'regulatory', label: 'Regulatory' },
  { key: 'waste', label: 'Waste & Remediation' },
];

// ---------------------------------------------------------------------
// Map defaults (BC centroid + province-wide zoom).
// ---------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [53.7, -127.6];
const DEFAULT_ZOOM = 5;
const MIN_ZOOM = 4;
const MAX_ZOOM = 18;

// ---------------------------------------------------------------------
// State model -- single source of truth
// ---------------------------------------------------------------------

interface MapState {
  baseLayer: BaseLayerKey;
  visibleOverlays: Set<string>;
}

const INITIAL_STATE: MapState = {
  baseLayer: 'streets',
  visibleOverlays: new Set<string>(),
};

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export function MatrixMap() {
  const [state, setState] = useState<MapState>(INITIAL_STATE);
  const [panelExpanded, setPanelExpanded] = useState<boolean>(true);

  const setBaseLayer = useCallback((key: BaseLayerKey) => {
    setState((prev) => ({ ...prev, baseLayer: key }));
  }, []);

  const toggleOverlay = useCallback((key: string) => {
    setState((prev) => {
      const next = new Set(prev.visibleOverlays);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, visibleOverlays: next };
    });
  }, []);

  const overlaysByCategory = useMemo(() => {
    const out: Record<OverlayCategory, string[]> = {
      protected: [],
      aquatic: [],
      ecology: [],
      regulatory: [],
      waste: [],
    };
    for (const key of OVERLAY_KEY_ORDER) {
      const def = OVERLAY_LAYERS[key];
      if (!def) continue;
      out[def.category].push(key);
    }
    return out;
  }, []);

  const activeBase = BASE_LAYERS[state.baseLayer];

  return (
    <div
      className="relative h-full w-full bg-slate-100"
      data-testid="matrix-map-root"
    >
      {/* Top toolbar: base-layer radio group */}
      <div
        className="absolute left-4 right-4 top-4 z-[1000] flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur"
        data-testid="matrix-map-base-toolbar"
      >
        <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Base map
        </span>
        <div
          role="radiogroup"
          aria-label="Base map tile layer"
          className="flex flex-wrap gap-1"
        >
          {BASE_LAYER_ORDER.map((key) => {
            const def = BASE_LAYERS[key];
            const isActive = state.baseLayer === key;
            return (
              <label
                key={key}
                className={
                  'cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                  (isActive
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')
                }
              >
                <input
                  type="radio"
                  name="matrix-map-base"
                  value={key}
                  checked={isActive}
                  onChange={() => setBaseLayer(key)}
                  className="sr-only"
                  data-testid={`matrix-map-base-${key}`}
                />
                {def.name}
              </label>
            );
          })}
        </div>
      </div>

      {/* Left-rail panel: overlay toggles */}
      <aside
        className="absolute bottom-4 left-4 top-20 z-[1000] flex w-72 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-slate-200 bg-white/95 shadow-md backdrop-blur"
        data-testid="matrix-map-overlay-panel"
      >
        <button
          type="button"
          onClick={() => setPanelExpanded((p) => !p)}
          className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-left"
          aria-expanded={panelExpanded}
          aria-controls="matrix-map-overlay-list"
          data-testid="matrix-map-overlay-toggle"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Layers className="h-4 w-4" />
            BC public overlays
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-mono text-slate-600">
              {state.visibleOverlays.size}/{OVERLAY_KEY_ORDER.length}
            </span>
          </span>
          {panelExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>
        {panelExpanded ? (
          <div
            id="matrix-map-overlay-list"
            className="flex-1 overflow-y-auto px-2 py-2"
          >
            {OVERLAY_CATEGORY_ORDER.map(({ key: catKey, label }) => {
              const keys = overlaysByCategory[catKey];
              if (keys.length === 0) return null;
              return (
                <div key={catKey} className="mb-3 last:mb-0">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <ul className="space-y-0.5">
                    {keys.map((key) => {
                      const def = OVERLAY_LAYERS[key];
                      const checked = state.visibleOverlays.has(key);
                      return (
                        <li key={key}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOverlay(key)}
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              data-testid={`matrix-map-overlay-${key}`}
                            />
                            <span
                              aria-hidden
                              className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                              style={{ backgroundColor: def.color }}
                            />
                            <span className="flex-1 leading-tight">
                              {def.name}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <p className="mt-3 border-t border-slate-100 px-1 pt-2 text-[10px] leading-tight text-slate-400">
              PR-MAP-2: empty map. Sample rendering arrives in PR-MAP-3;
              identify + selection in PR-MAP-3..4.
            </p>
          </div>
        ) : null}
      </aside>

      {/* Leaflet map. Re-mount the base TileLayer per `baseLayer` key so
          react-leaflet swaps tile sources cleanly (a `key` change forces
          unmount-then-mount, which is the safe pattern in react-leaflet
          5 for switching tile providers without leaking layers). */}
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        scrollWheelZoom
        zoomControl={false}
        className="absolute inset-0 z-0 h-full w-full"
        data-testid="matrix-map-container"
      >
        <TileLayer
          key={state.baseLayer}
          attribution={activeBase.attribution}
          url={activeBase.url}
          maxNativeZoom={activeBase.maxNativeZoom}
          maxZoom={MAX_ZOOM}
        />
        {OVERLAY_KEY_ORDER.filter((k) => state.visibleOverlays.has(k)).map(
          (key) => {
            const def = OVERLAY_LAYERS[key];
            return (
              <WMSTileLayer
                key={key}
                url={BC_WMS_URL}
                layers={def.layer}
                format="image/png"
                transparent
                opacity={0.6}
                attribution={BC_WMS_ATTRIBUTION}
              />
            );
          },
        )}
        <ZoomControl position="bottomright" />
      </MapContainer>
    </div>
  );
}

// Exports for tests (so spec files can assert on the canonical catalogs
// without re-declaring them). NOT part of the public component API.
export const __TESTING__ = {
  BASE_LAYERS,
  BASE_LAYER_ORDER,
  OVERLAY_LAYERS,
  OVERLAY_KEY_ORDER,
  OVERLAY_CATEGORY_ORDER,
};
