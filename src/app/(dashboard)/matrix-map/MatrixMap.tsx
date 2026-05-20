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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  useMapEvents,
  WMSTileLayer,
  ZoomControl,
} from 'react-leaflet';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type * as LeafletNS from 'leaflet';

import {
  getActiveOverlaysInZOrder,
  queryActiveOverlays,
  type IdentifiedFeature,
  type IdentifyOverlay,
  type LeafletMapLike,
} from '@/lib/maps/wms-identify';
import { createClient } from '@/lib/supabase/client';

import { IdentifyPanel } from './IdentifyPanel';
import { PartialVisibilityBanner } from './PartialVisibilityBanner';
import { SampleLegend } from './SampleLegend';
import { SampleMarkersLayer } from './SampleMarkersLayer';
import {
  findSampleNearLatLng,
  type DraDetail,
  type IdentifyState,
} from './identify-state';
import {
  EMPTY_MATRIX_MAP_DATA,
  type MatrixMapData,
  type MatrixSample,
} from './types';

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

// PR-MAP-3b Q-7: sample-hit-test radius in container pixels around the
// click. Matches BN-RRM identify-buffer (8px) plus a small safety
// margin because the sample divIcon visual extends past its centroid.
const SAMPLE_HIT_RADIUS_PX = 10;

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

export interface MatrixMapProps {
  /**
   * Initial RPC payload fetched server-side in page.tsx via
   * `matrix_map.fetch_samples_with_hidden_summary({})`. Omitted only by
   * legacy callers (smoke tests that predate PR-MAP-3a); the runtime
   * default is the empty payload so renders never crash.
   */
  initialMapData?: MatrixMapData;
  /**
   * Optional banner string surfaced when the server-side RPC fetch
   * fails (e.g. before the RPC migration deploys). page.tsx populates
   * this when the catch branch fires; MatrixMap renders it as a small
   * inline warning at the top of the map area.
   */
  fetchErrorMessage?: string | null;
}

export function MatrixMap({
  initialMapData,
  fetchErrorMessage,
}: MatrixMapProps = {}) {
  const [state, setState] = useState<MapState>(INITIAL_STATE);
  const [panelExpanded, setPanelExpanded] = useState<boolean>(true);
  // Sample data is stored in client state so future identify/refresh
  // surfaces (PR-MAP-3b, PR-MAP-3c [Refresh] button) can mutate it. In
  // 3a the setter is unused; that's intentional. The leading `_` opt-
  // out keeps the unused-var lint clean until 3b wires the refresh path.
  const [mapData] = useState<MatrixMapData>(
    initialMapData ?? EMPTY_MATRIX_MAP_DATA,
  );

  // PR-MAP-3b identify state. null = nothing identified; the panel is
  // hidden. Setting to a sample/overlay variant opens the panel + (for
  // sample variant) opens an L.popup at the sample's coordinates.
  const [identifyState, setIdentifyState] = useState<IdentifyState | null>(
    null,
  );

  // Imperative refs used by the identify wiring:
  //   - identifyPopupRef: tracks the L.Popup so it can be closed on
  //     panel-close or before opening a new one.
  //   - identifyRequestIdRef: monotonic counter for stale-response guard
  //     against overlay-identify network races. Mirrors BN-RRM
  //     SiteMap's requestIdRef pattern.
  const identifyPopupRef = useRef<LeafletNS.Popup | null>(null);
  const identifyRequestIdRef = useRef<number>(0);

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

  // ---------------------------------------------------------------
  // PR-MAP-3b identify wiring
  // ---------------------------------------------------------------

  // Build the IdentifyOverlay defs once -- queryActiveOverlays needs
  // {key, name, layer} per overlay. Derived from the static
  // OVERLAY_LAYERS catalog so it is referentially stable.
  const overlayDefsForIdentify = useMemo<
    Record<string, Omit<IdentifyOverlay, 'key'>>
  >(() => {
    const out: Record<string, Omit<IdentifyOverlay, 'key'>> = {};
    for (const [key, def] of Object.entries(OVERLAY_LAYERS)) {
      out[key] = { name: def.name, layer: def.layer, category: def.category };
    }
    return out;
  }, []);

  // Sample-marker click handler. Opens the panel in sample-mode +
  // queues the DRA fetch via the useEffect below (which watches the
  // sample state via a draLoading=true sentinel). Closes any prior
  // identify popup; the actual L.popup for the sample mode is opened
  // by the PopupController child below (it owns the L.Map handle).
  const handleSampleClick = useCallback(
    (sample: MatrixSample, _latlng: { lat: number; lng: number }) => {
      // Bump the request id so any in-flight overlay-identify resolves
      // into a stale-response abandon. Sample-identify takes priority.
      identifyRequestIdRef.current += 1;
      setIdentifyState({
        kind: 'sample',
        sample,
        dra: null,
        // Skip the fetch (and therefore the loading state) when the
        // sample has no DRA provenance. The panel renders
        // "Source DRA: not recorded" in this branch.
        draLoading: sample.source_dra_id !== null,
        draError: null,
      });
    },
    [],
  );

  // Overlay-click handler -- invoked by MapClickListener when the
  // click was NOT near any sample marker. Fires queryActiveOverlays
  // against the currently-visible overlays in topmost-first z-order
  // and writes the result into identifyState. Stale-response guard
  // via identifyRequestIdRef.
  const handleOverlayClick = useCallback(
    async (latlng: { lat: number; lng: number }, map: LeafletMapLike) => {
      const myId = ++identifyRequestIdRef.current;

      // Build an insertion-ordered Map of visible-overlay keys so the
      // z-order resolver can reverse-iterate to topmost-first. We use
      // the toggle order recorded in state.visibleOverlays (a Set with
      // insertion semantics) as the source of truth.
      const visibleMap = new Map<string, unknown>();
      for (const key of state.visibleOverlays) {
        visibleMap.set(key, null);
      }
      const ordered = getActiveOverlaysInZOrder(
        visibleMap,
        overlayDefsForIdentify,
      );

      let features: IdentifiedFeature[] = [];
      try {
        features = await queryActiveOverlays(ordered, map, latlng);
      } catch {
        // Non-fatal -- drop into the empty-features branch below.
      }

      // Stale-response guard: if a newer click (sample or overlay)
      // superseded this request, abandon silently.
      if (identifyRequestIdRef.current !== myId) return;

      // Only open the overlay panel when we have something to show.
      // Empty overlay-click results are intentionally a no-op (no panel
      // open, no popup). The reviewer's expectation is that clicking
      // empty space outside of any sample + outside of any overlay
      // feature should leave the UI quiet.
      if (features.length === 0) {
        // Clear any existing identify state on an empty overlay click
        // so the panel does not stay open on a now-misleading row.
        setIdentifyState((prev) =>
          prev !== null && prev.kind === 'sample' ? prev : null,
        );
        return;
      }
      setIdentifyState({ kind: 'overlay', latlng, features });
    },
    [overlayDefsForIdentify, state.visibleOverlays],
  );

  // On-demand DRA fetch (Q-2). Fires whenever the identify state
  // transitions into a sample-with-draLoading=true shape. The fetch
  // is keyed off the sample.id so concurrent sample-clicks (rare;
  // would require rapid double-click) are handled by capturing the
  // expected id at fetch-time and discarding the resolved row if the
  // identifyState has since moved off this sample.
  useEffect(() => {
    if (identifyState === null || identifyState.kind !== 'sample') return;
    if (!identifyState.draLoading) return;
    if (identifyState.sample.source_dra_id === null) return;

    const expectedSampleId = identifyState.sample.id;
    const expectedDraId = identifyState.sample.source_dra_id;
    let cancelled = false;

    const run = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .schema('matrix_map')
          .from('dras')
          .select(
            'id, title, agency, year, site_id, citation, document_url, public, confidentiality_notes',
          )
          .eq('id', expectedDraId)
          .maybeSingle();
        if (cancelled) return;
        // Stale-response guard: discard if the user has clicked a
        // different sample (or cleared the panel) since we started.
        setIdentifyState((prev) => {
          if (
            prev === null ||
            prev.kind !== 'sample' ||
            prev.sample.id !== expectedSampleId
          ) {
            return prev;
          }
          if (error) {
            return {
              ...prev,
              dra: null,
              draLoading: false,
              draError: error.message ?? 'unknown error',
            };
          }
          return {
            ...prev,
            dra: (data as DraDetail | null) ?? null,
            draLoading: false,
            draError: null,
          };
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'unexpected fetch failure';
        setIdentifyState((prev) => {
          if (
            prev === null ||
            prev.kind !== 'sample' ||
            prev.sample.id !== expectedSampleId
          ) {
            return prev;
          }
          return {
            ...prev,
            dra: null,
            draLoading: false,
            draError: message,
          };
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [identifyState]);

  // Panel close handler -- clears identify state. The popup-cleanup
  // effect inside PopupController picks up the state change and
  // closes any open L.Popup.
  const handleIdentifyClose = useCallback(() => {
    identifyRequestIdRef.current += 1;
    setIdentifyState(null);
  }, []);

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
        <SampleMarkersLayer
          samples={mapData.visible_samples}
          onSampleClick={handleSampleClick}
        />
        <MapClickListener
          samples={mapData.visible_samples}
          onSampleHit={handleSampleClick}
          onEmptyMapClick={handleOverlayClick}
        />
        <PopupController
          identifyState={identifyState}
          identifyPopupRef={identifyPopupRef}
        />
        <ZoomControl position="bottomright" />
      </MapContainer>

      {/* PR-MAP-3b identify panel -- rendered as a sibling of the
          MapContainer so it can layer above the Leaflet canvas at the
          same z-tier as the legend + banner. Hidden when identifyState
          is null. */}
      <IdentifyPanel state={identifyState} onClose={handleIdentifyClose} />

      {/* Partial-visibility banner -- Q-8: only when hidden_sample_count > 0 */}
      {mapData.hidden_sample_count > 0 ? (
        <PartialVisibilityBanner
          visibleCount={mapData.visible_samples.length}
          hiddenSampleCount={mapData.hidden_sample_count}
          hiddenDraCount={mapData.hidden_dra_count}
          hiddenDraIds={mapData.hidden_dra_ids}
        />
      ) : null}

      {/* Server-side fetch error inline notice. Surfaces ONLY when
          page.tsx caught an RPC error (e.g. RPC migration not yet
          deployed). Distinct from the empty-state overlay below, which
          fires when the RPC returned successfully but with zero rows. */}
      {fetchErrorMessage ? (
        <div
          className="absolute right-4 top-20 z-[1000] max-w-sm rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow-md"
          role="status"
          data-testid="matrix-map-fetch-error"
        >
          {fetchErrorMessage}
        </div>
      ) : null}

      {/* Empty-state overlay -- pinned top-right card; fires when the
          RPC succeeded but returned zero visible samples (ETL pending
          OR all rows hidden by RLS). */}
      {mapData.visible_samples.length === 0 && !fetchErrorMessage ? (
        <div
          className="absolute right-4 top-20 z-[1000] max-w-sm rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-md backdrop-blur"
          role="status"
          data-testid="matrix-map-empty-state"
        >
          <p className="font-semibold">No samples yet</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            ETL pending or all rows hidden by RLS. Check{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
              /admin/matrix-map/health
            </code>{' '}
            for status.
          </p>
        </div>
      ) : null}

      {/* Sample symbology legend -- pinned bottom-left; collapsed by default */}
      <SampleLegend />
    </div>
  );
}

// ---------------------------------------------------------------------
// MapClickListener -- child component using useMapEvents
// ---------------------------------------------------------------------
//
// Lives inside MapContainer so it can hook the Leaflet `click` event
// + receive the live `L.Map` instance. Decides between sample-hit
// (short-circuit; calls onSampleHit) and empty-space (calls
// onEmptyMapClick) per the Q-7 10px proximity rule.
//
// React-leaflet's useMapEvents returns the L.Map; we pass that map
// instance to the overlay-identify driver so it can build the WMS
// GetFeatureInfo URL.

interface MapClickListenerProps {
  samples: MatrixSample[];
  onSampleHit: (
    sample: MatrixSample,
    latlng: { lat: number; lng: number },
  ) => void;
  onEmptyMapClick: (
    latlng: { lat: number; lng: number },
    map: LeafletMapLike,
  ) => void;
}

function MapClickListener({
  samples,
  onSampleHit,
  onEmptyMapClick,
}: MapClickListenerProps) {
  // useMapEvents returns the map instance + binds the click handler
  // declaratively. Stable across re-renders -- the handler always
  // sees the current samples + callbacks via closure-over-prop.
  const map = useMapEvents({
    click: (evt) => {
      const latlng = { lat: evt.latlng.lat, lng: evt.latlng.lng };
      // Step 1 (Q-7): sample-hit test in container-pixel space.
      const hit = findSampleNearLatLng(
        samples,
        latlng.lat,
        latlng.lng,
        SAMPLE_HIT_RADIUS_PX,
        map as unknown as {
          latLngToContainerPoint: (ll: { lat: number; lng: number }) => {
            x: number;
            y: number;
          };
        },
      );
      if (hit) {
        onSampleHit(hit, latlng);
        return;
      }
      // Step 2: empty-map click -- route to overlay-identify.
      onEmptyMapClick(latlng, map as unknown as LeafletMapLike);
    },
  });
  return null;
}

// ---------------------------------------------------------------------
// PopupController -- child component owning the L.Popup
// ---------------------------------------------------------------------
//
// Opens an L.Popup at the sample's coordinates when identifyState
// transitions into sample-mode (Q-4 popup half). Closes the popup
// when the state clears or moves to overlay mode. Side-panel render
// is handled by IdentifyPanel; the popup here is the on-map summary.

interface PopupControllerProps {
  identifyState: IdentifyState | null;
  identifyPopupRef: React.MutableRefObject<LeafletNS.Popup | null>;
}

function PopupController({
  identifyState,
  identifyPopupRef,
}: PopupControllerProps) {
  const map = useMapEvents({});
  useEffect(() => {
    let cancelled = false;
    const closePrior = () => {
      const prior = identifyPopupRef.current;
      if (prior) {
        try {
          map.closePopup(prior);
        } catch {
          // best-effort cleanup
        }
        identifyPopupRef.current = null;
      }
    };

    if (identifyState === null || identifyState.kind !== 'sample') {
      closePrior();
      return;
    }

    const coords = identifyState.sample.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      closePrior();
      return;
    }
    const [lng, lat] = coords;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      closePrior();
      return;
    }

    // Dynamic import of leaflet so the popup factory is available
    // without statically importing the package at module load (keeps
    // vitest stubs simple + SSR-safe).
    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      closePrior();
      try {
        const html =
          '<div style="font-family:system-ui,sans-serif;font-size:12px;color:#1e293b;min-width:180px;">' +
          '<p style="font-weight:700;font-size:13px;color:#0f172a;margin:0 0 4px 0;">' +
          escapeHtmlForPopup(identifyState.sample.display_name) +
          '</p>' +
          '<p style="margin:2px 0;color:#475569;">' +
          '<span style="font-weight:600;color:#334155;">Classification:</span> ' +
          escapeHtmlForPopup(identifyState.sample.classification) +
          '</p>' +
          '<p style="margin:4px 0 0 0;font-style:italic;color:#64748b;font-size:11px;">' +
          'See panel for full detail.' +
          '</p>' +
          '</div>';
        const popup = L.popup({ closeButton: true, autoClose: true })
          .setLatLng({ lat, lng })
          .setContent(html);
        popup.openOn(map);
        identifyPopupRef.current = popup;
      } catch {
        // best-effort; if popup creation fails the side panel is still
        // visible and the reviewer can continue.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [identifyState, identifyPopupRef, map]);
  return null;
}

/**
 * Lightweight HTML escaper for the popup-at-latlng content. Mirrors
 * the contract used in `@/lib/maps/identify-format` so the inline popup
 * cannot inject user-controlled HTML from the sample row.
 */
function escapeHtmlForPopup(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
