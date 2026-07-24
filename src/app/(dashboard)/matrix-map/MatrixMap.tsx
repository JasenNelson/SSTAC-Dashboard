/**
 * MatrixMap Component (Path-B fork of src/components/bn-rrm/map/SiteMap.tsx)
 *
 * Forked from SiteMap.tsx per Path-B recovery
 * (memory anchor: dashboard_matrix_map_pr_map_3_post_mortem_2026_05_20).
 * The fork is the canonical pattern; do not redesign from first principles.
 *
 * Deltas from SiteMap.tsx:
 * - Data source: server-fetched MatrixMapData (initialMapData prop) from
 *   matrix_map.fetch_samples_with_hidden_summary RPC (in page.tsx).
 * - Types: MatrixSample from ./types replaces SiteLocation/SiteAssessment.
 * - Symbology: 9-state combo per PLAN_V3_4_2 section 3.3
 *   (classification x coord_tier).
 * - Pack manifest code DELETED (matrix-map has no pack artifacts).
 * - Identified-features panel storage: local React state.
 * - Selection state: local React useState (Zustand hoist = PR-MAP-4).
 *
 * NOT in this fork (deferred):
 * - Selection Stats panel (PR-MAP-4)
 * - MeasurementWorkbench right drawer (PR-MAP-5)
 * - Calculator bridge (PR-MAP-6)
 * - Partial-visibility banner (hidden_summary available but not surfaced)
 * - Zustand SelectionStore (PR-MAP-4)
 *
 * Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
 */

'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Map as LeafletMap, TileLayer, CircleMarker, Marker, Popup, Layer, MarkerCluster, MarkerClusterGroup, LayerGroup } from 'leaflet';
// leaflet.markercluster augments the 'leaflet' module; the side-effect import
// makes the MarkerCluster / MarkerClusterGroup types available via the 'leaflet'
// namespace without requiring a separate namespace import.
import type {} from 'leaflet.markercluster';
import { cn } from '@/utils/cn';
import {
  formatIdentifyEmptyHtml,
  formatIdentifyPopupHtml,
} from '@/lib/maps/identify-format';
import {
  getActiveOverlaysInZOrder,
  queryActiveOverlays,
  queryActiveOverlaysInBounds,
  type IdentifiedFeature,
  type IdentifyOverlay,
  type LeafletMapLike,
} from '@/lib/maps/wms-identify';
import { useMatrixMapIdentifyStore } from '@/stores/matrix-map/identifyStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import {
  getMapFilteredSamples,
  hasActiveMatrixMapFilters,
  useMatrixMapFilterStore,
} from '@/stores/matrix-map/filterStore';
import {
  ZoomIn,
  ZoomOut,
  MapPin,
  Target,
  Layers,
  Download,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Hand,
  BoxSelect,
  MousePointer,
  Crosshair,
} from 'lucide-react';
import type {
  Classification,
  MatrixMapData,
  MatrixSample,
  MatrixSiteAggregateData,
} from './types';
// bbox-lane Stage 2: viewport refetch helpers. toRpcBbox is a fail-safe WGS84
// guard (invalid/degenerate -> null -> province-wide).
import { toRpcBbox, type MatrixMapBbox } from '@/lib/matrix-map/bbox';
import {
  COORD_TIER_DASH_ARRAY,
  COORD_TIER_LABEL,
  COORD_TIER_CAPTION,
} from '@/lib/matrix-map/coordinate-provenance';
import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';
import { coordinateClusterId } from '@/lib/matrix-map/siteAggregates';
import { EMPTY_MATRIX_SITE_AGGREGATE_DATA } from './types';

export interface MatrixMapProps {
  /** Server-fetched payload from matrix_map.fetch_samples_with_hidden_summary RPC. */
  initialMapData: MatrixMapData;
  /** Optional inline notice when server-side RPC failed. */
  fetchErrorMessage?: string | null;
  /** Option C aggregate markers, separate from MatrixSample rows. */
  siteAggregateData?: MatrixSiteAggregateData;
  siteAggregateFetchErrorMessage?: string | null;
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  /**
   * bbox-lane Stage 2: called with each viewport-refetch payload so an embedding
   * parent (e.g. MatrixDashboard on /matrix-options) can accumulate a cumulative
   * sample union for sibling panels -- a selection made on a viewport-only marker
   * must stay resolvable after the province-wide set is capped. The map renders
   * its own current-viewport mapData; this is purely an upward notification.
   */
  onMapDataChange?: (data: MatrixMapData) => void;
}

// Layer definitions
const BASE_LAYERS = {
  streets: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenStreetMap contributors',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '(c) Esri',
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '(c) OpenTopoMap',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    attribution: '(c) Stamen Design',
  },
};

const BC_WMS_URL = 'https://openmaps.gov.bc.ca/geo/pub/ows';
const BC_WMS_IDENTIFY_PROXY_URL = '/api/bn-rrm/wms-identify';
const BC_WFS_IDENTIFY_PROXY_URL = '/api/bn-rrm/wfs-identify';
const BC_ATTR = '(c) Province of British Columbia';

// bbox-lane Stage 2 -- viewport refetch tuning.
// Debounce settle time after moveend/zoomend before a refetch fires.
const VIEWPORT_REFETCH_DEBOUNCE_MS = 300;
// At/below this zoom the viewport is so wide a bbox fetch is ~province-wide
// anyway; fetch province-wide (null bbox) instead, deduped to once per snapshot,
// so the capped overview is stable and reads are not amplified by panning.
const VIEWPORT_MIN_BBOX_ZOOM = 7;
// Sentinel dedupe key for the province-wide (null-bbox) fetch.
const VIEWPORT_PROVINCE_KEY = 'province';

interface OverlayDef {
  name: string;
  layer: string;
  color: string; // Legend swatch color
  category: 'protected' | 'aquatic' | 'ecology' | 'regulatory' | 'waste';
}

const OVERLAY_LAYERS: Record<string, OverlayDef> = {
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

const OVERLAY_CATEGORIES: { key: string; label: string }[] = [
  { key: 'protected', label: 'Protected Areas & Habitat' },
  { key: 'aquatic', label: 'Aquatic Features' },
  { key: 'ecology', label: 'Ecosystem Classification' },
  { key: 'regulatory', label: 'Regulatory' },
  { key: 'waste', label: 'Waste & Remediation' },
];

// PLAN_V3_4_2 section 3.3 -- classification color
const CLASSIFICATION_COLOR: Record<Classification, string> = {
  reference: '#10b981',
  impacted: '#eab308',
  unknown: '#94a3b8',
};

function createImpactedMarkerIcon(L: typeof import('leaflet'), color: string, dashArray: string | undefined, selected: boolean) {
  const strokeDash = dashArray ?? '';
  const strokeColor = selected ? '#2563eb' : 'white';
  const strokeWidth = selected ? '3' : '2.5';
  const html =
    '<svg width="24" height="24" viewBox="0 0 24 24" ' +
    'style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">' +
    `<polygon points="12,2 22,22 2,22" fill="${color}" ` +
    `stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linejoin="round" ` +
    `stroke-dasharray="${strokeDash}" /></svg>`;

  return L.divIcon({
    html,
    className: 'matrix-impacted-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 22],
  });
}

export function MatrixMap({
  initialMapData,
  fetchErrorMessage,
  siteAggregateData = EMPTY_MATRIX_SITE_AGGREGATE_DATA,
  siteAggregateFetchErrorMessage,
  className,
  initialCenter = [54.7, -125.0],  // BC province center
  initialZoom = 5,                  // province-wide default
  onMapDataChange,
}: MatrixMapProps) {
  // Latest onMapDataChange in a ref so the (mount-once) map-init effect's
  // closure always calls the current callback without re-running the effect.
  const onMapDataChangeRef = useRef(onMapDataChange);
  onMapDataChangeRef.current = onMapDataChange;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<MarkerClusterGroup | null>(null);
  const aggregateMarkersLayerRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [leaflet, setLeaflet] = useState<typeof import('leaflet') | null>(null);
  const [activeLayer, setActiveLayer] = useState<keyof typeof BASE_LAYERS>('streets');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  const overlayLayersRef = useRef<Map<string, Layer>>(new Map());

  const [sampleListExpanded, setSampleListExpanded] = useState(true);
  const [interactionMode, setInteractionMode] = useState<
    'pan' | 'select-individual' | 'select-area' | 'identify' | 'identify-area'
  >('pan');
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  const areaSelectRectRef = useRef<Layer | null>(null);
  // Backup of marker popups while Identify mode is active. Iterable Map
  // (NOT WeakMap) is required because restoration on mode exit iterates the
  // saved entries. Keys are Leaflet markers; values carry content + options.
  const markerPopupBackupRef = useRef<Map<CircleMarker | Marker, { content: import('leaflet').Content | ((source: Layer) => import('leaflet').Content) | undefined; options: import('leaflet').PopupOptions }>>(new Map());
  // Ref mirror of the Identify writer so Leaflet handlers attached once (in
  // the GeoJSON onEachFeature closure) can reach the latest implementation.
  // Set/unset by the Identify-mode useEffect below.
  const runIdentifyRef = useRef<
    | ((latlng: { lat: number; lng: number }, geojsonHit: IdentifiedFeature | null) => void)
    | null
  >(null);
  // Transient "no features" / "N features" popup owned by the Identify tool.
  // We track it so it can be removed on mode exit.
  const identifyPopupRef = useRef<Popup | null>(null);
  // Monotonic request counter for the Identify tool. Every runIdentify call
  // captures its own id at entry; after each await we bail if the ref has
  // advanced, which means a newer click (or mode exit) superseded us. This is
  // the correctness guarantee at the call site; queryActiveOverlays has its
  // own internal timeoutMs but that does NOT discard stale successful replies.
  const identifyRequestIdRef = useRef<number>(0);

  // bbox-lane Stage 2 -- viewport refetch state + guards.
  // mapData is reactive so a refetch re-renders markers. Chain (verified):
  // setMapData -> reactive allSamples -> the `samples` useMemo recomputes
  // (allSamples is in its dep array) -> the marker-render useEffect (keyed on
  // `samples`) refires. Initial paint = the province-wide SSR payload.
  const [mapData, setMapData] = useState<MatrixMapData>(initialMapData);
  const allSamples = mapData.visible_samples;
  // Transient refetch error: surfaced WITHOUT discarding good markers (a failed
  // refetch returns empty + fetchErrorMessage; we keep the prior mapData).
  const [refetchError, setRefetchError] = useState<string | null>(null);
  // Monotonic viewport-fetch counter (mirrors identifyRequestIdRef): each fetch
  // captures its id; a newer move advances it so the stale reply is dropped.
  const viewportFetchSeqRef = useRef<number>(0);
  const viewportAbortRef = useRef<AbortController | null>(null);
  const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedupe against the last SUCCESSFULLY-LOADED viewport key (NOT an optimistic
  // pre-fetch key): the same viewport must not refire on every low-zoom pan --
  // the RPC recomputes uncapped province-wide hidden aggregates on every call.
  // Tracking only loaded keys avoids the retry wedge where an aborted/failed
  // fetch's key would otherwise mark a never-loaded viewport as "current".
  const lastLoadedKeyRef = useRef<string | null>(null);
  // The viewport key currently being fetched -- skip a duplicate concurrent
  // fetch of the exact same viewport (cleared on settle by the owning fetch).
  const inFlightKeyRef = useRef<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  // Fire-once auto-fit: fit-bounds must run only on the initial load, never on a
  // viewport refetch (which would auto-zoom and fight the user's pan).
  const hasFitBoundsRef = useRef<boolean>(false);

  // P2 (codex): mapData is seeded via useState, which captures ONLY the first
  // initialMapData. On /matrix-options the partial-visibility banner's Refresh
  // calls router.refresh(), delivering a NEW initialMapData prop WITHOUT
  // remounting this component -- without this sync, markers + the truncated hint
  // would keep showing the pre-refresh state. Re-seed the reactive state on a
  // genuine prop change (stable object identity across client re-renders means
  // this does NOT clobber viewport refetches), reset the dedupe key (the server
  // payload is province-wide), and clear any transient refetch error.
  useEffect(() => {
    // Invalidate any in-flight / pending viewport refetch first (codex P2 r2):
    // otherwise a refetch that was mid-flight when the prop refreshed could still
    // pass owns() and setMapData(stale), overwriting this fresh server payload.
    // Advance the seq + abort + clear the debounce, mirroring cleanup/new-fetch.
    viewportFetchSeqRef.current += 1;
    viewportAbortRef.current?.abort();
    viewportAbortRef.current = null;
    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
      viewportDebounceRef.current = null;
    }
    setMapData(initialMapData);
    lastLoadedKeyRef.current = VIEWPORT_PROVINCE_KEY;
    inFlightKeyRef.current = null;
    setRefetchError(null);
  }, [initialMapData]);
  // PR-MAP-10 (bugfix): identifiedFeatures lives in
  // src/stores/matrix-map/identifyStore.ts so MatrixMapLeftPanel can
  // subscribe to identify-tool / identify-area results across the
  // sibling-component boundary.
  const setIdentifiedFeatures = useMatrixMapIdentifyStore(
    (state) => state.setIdentifiedFeatures,
  );
  const clearIdentifiedFeatures = useMatrixMapIdentifyStore(
    (state) => state.clearIdentifiedFeatures,
  );

  // Lifecycle reset parity with PR-MAP-11 selection-store: the
  // identify-store is a module-level Zustand singleton, so without
  // this useEffect it would survive MatrixMap unmounts. SPA navigations
  // away from /matrix-options and back would surface stale identify
  // results in the left panel until the user fired a new identify
  // click or hit Clear. Pre-PR-MAP-10 the identifiedFeatures lived in
  // local useState that reset on each remount; this restores that
  // lifecycle. clearIdentifiedFeatures is a stable Zustand selector
  // ref so this effect runs exactly once per mount.
  useEffect(() => {
    clearIdentifiedFeatures();
  }, [clearIdentifiedFeatures]);

  // PR-MAP-11: sample selection state lives in
  // src/stores/matrix-map/selectionStore.ts. Mirrors the identifyStore
  // hoist pattern -- the inlined Sample Locations panel reads directly
  // from the store, and PR-MAP-12 Selection Stats + PR-MAP-13
  // MeasurementWorkbench will subscribe to the same surface. Action
  // contracts (single-click replace, Shift-add, Ctrl-remove, area
  // replace) are locked by
  // src/stores/matrix-map/__tests__/selectionStore.test.ts.
  const selectedSampleId = useMatrixMapSelectionStore((s) => s.selectedSampleId);
  const selectedSampleIds = useMatrixMapSelectionStore((s) => s.selectedSampleIds);
  const selectedSampleIdsRef = useRef<string[]>(selectedSampleIds);
  selectedSampleIdsRef.current = selectedSampleIds;
  const panRequestedSampleId = useMatrixMapSelectionStore((s) => s.panRequestedSampleId);
  const panRequestSeq = useMatrixMapSelectionStore((s) => s.panRequestSeq);
  const selectSample = useMatrixMapSelectionStore((s) => s.selectSample);
  const addSampleSelection = useMatrixMapSelectionStore((s) => s.addSampleSelection);
  const addMultipleSamples = useMatrixMapSelectionStore((s) => s.addMultipleSamples);
  const removeSampleSelection = useMatrixMapSelectionStore((s) => s.removeSampleSelection);
  const removeMultipleSamples = useMatrixMapSelectionStore((s) => s.removeMultipleSamples);
  const clearSampleSelection = useMatrixMapSelectionStore((s) => s.clearSampleSelection);
  const selectAllSamplesAction = useMatrixMapSelectionStore((s) => s.selectAllSamples);
  const filterState = useMatrixMapFilterStore((s) => s.filterState);
  const setFilterState = useMatrixMapFilterStore((s) => s.setFilterState);
  const matchingSampleIds = useMatrixMapFilterStore((s) => s.matchingSampleIds);
  const matchingSampleIdsReady = useMatrixMapFilterStore((s) => s.matchingSampleIdsReady);
  const showSelectedDespiteFilters = useMatrixMapFilterStore((s) => s.showSelectedDespiteFilters);
  const resetMapFilters = useMatrixMapFilterStore((s) => s.resetFilters);
  // surveyed_only is deliberately NOT part of hasActiveMatrixMapFilters (that gates the
  // measurement-matching pipeline), but it IS an active view filter for UI purposes (the
  // sample-count subtitle + clear affordances), so OR it in here.
  const sampleFiltersActive = hasActiveMatrixMapFilters(filterState);
  const activeMapFilters =
    sampleFiltersActive || Boolean(filterState.surveyed_only);
  const filteredSamples = useMemo(
    () =>
      getMapFilteredSamples({
        samples: allSamples,
        filterState,
        matchingSampleIds,
        matchingSampleIdsReady,
        selectedSampleIds,
        showSelectedDespiteFilters,
      }),
    [
      allSamples,
      filterState,
      matchingSampleIds,
      matchingSampleIdsReady,
      selectedSampleIds,
      showSelectedDespiteFilters,
    ],
  );
  const aggregateMarkers = siteAggregateData.site_aggregate_markers;
  const aggregateSuppressionMarkers = useMemo(
    () => (filterState.surveyed_only ? [] : aggregateMarkers),
    [aggregateMarkers, filterState.surveyed_only],
  );
  const visibleAggregateMarkers = useMemo(
    () => (sampleFiltersActive ? [] : aggregateSuppressionMarkers),
    [aggregateSuppressionMarkers, sampleFiltersActive],
  );
  const aggregateFetchFailed = Boolean(siteAggregateFetchErrorMessage);
  const samples = useMemo(() => {
    const aggregateFilteredSamples = filterSamplesCoveredBySiteAggregates(
      filteredSamples,
      aggregateSuppressionMarkers,
    );
    if (!aggregateFetchFailed) return aggregateFilteredSamples;
    return aggregateFilteredSamples.filter(
      (sample) => sample.coordinate_quality_tier !== 'medium',
    );
  }, [filteredSamples, aggregateSuppressionMarkers, aggregateFetchFailed]);
  const sampleCount = samples.length;
  const sampleMarkers = samples;
  const sampleMarkerCount = sampleMarkers.length;
  const fitLocationCount = sampleMarkerCount + visibleAggregateMarkers.length;
  // Wrap selectAllSamples to preserve the no-arg signature used at the
  // call sites in this file. The store action takes an explicit ID list
  // so it stays independent of the samples prop.
  const selectAllSamples = useCallback(() => {
    selectAllSamplesAction(samples.map((s) => s.id));
  }, [samples, selectAllSamplesAction]);

  // Lifecycle reset (codex P2 review on PR-MAP-11): the pre-hoist local
  // useState reset to (null, []) on every MatrixMap unmount, so SPA
  // navigations to/from /matrix-options always rendered with a fresh
  // selection state. Hoisting to a module-level Zustand singleton
  // changes that lifecycle by default; without this reset, a return
  // visit could surface stale selected IDs against a newly-fetched
  // initialMapData. clearSampleSelection is a stable Zustand selector
  // ref so this effect runs exactly once per mount.
  useEffect(() => {
    clearSampleSelection();
    resetMapFilters();
  }, [clearSampleSelection, resetMapFilters]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'escape') {
        setInteractionMode('pan');
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (key === 'p') setInteractionMode('pan');
      if (key === 's') setInteractionMode('select-individual');
      if (key === 'a') setInteractionMode('select-area');
      if (key === 'i') setInteractionMode('identify');
      if (key === 'b') setInteractionMode('identify-area');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;
    isMountedRef.current = true;
    // The initial SSR payload (initialMapData) is province-wide (null bbox), so
    // seed the last-LOADED key to province -- the first moveend at province zoom
    // must not refetch data we already have.
    lastLoadedKeyRef.current = VIEWPORT_PROVINCE_KEY;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      // CSS side-effects (leaflet + markercluster) are statically imported
      // in MatrixMapLoader.tsx (the dynamic-import wrapper) so vitest can
      // mock the dynamic JS import without Vite trying to process leaflet's
      // .css through the project's PostCSS pipeline (which is .mjs-based for
      // Next/Tailwind and not loadable from Vite directly). Pattern matches
      // the existing MatrixMapLoader leaflet.css import.
      await import('leaflet.markercluster');

      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;

      setLeaflet(L);

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
      });

      // Add initial tile layer
      const tileLayer = L.tileLayer(BASE_LAYERS.streets.url, {
        attribution: BASE_LAYERS.streets.attribution,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // Create marker cluster group
      const markers = (L as typeof L).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        iconCreateFunction: (cluster: MarkerCluster) => {
          const count = cluster.getChildCount();
          const childMarkers = cluster.getAllChildMarkers?.() ?? [];
          const selectedIds = new Set(selectedSampleIdsRef.current);
          const selectedCount = childMarkers.filter(
            (marker) => {
              const sampleId = (marker.options as { sampleId?: string }).sampleId;
              return sampleId && selectedIds.has(sampleId);
            },
          ).length;
          let size = 'small';
          if (count > 10) size = 'medium';
          if (count > 25) size = 'large';
          const selectedBadge = selectedCount > 0
            ? `<span class="cluster-selected-badge">${selectedCount} of ${count} selected</span>`
            : '';

          return L.divIcon({
            html: `<div class="cluster-marker cluster-${size}">
              <span>${count}</span>
              ${selectedBadge}
            </div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40),
          });
        },
      });

      // Shift+click on a cluster adds children; Ctrl/meta+click removes them.
      // In Identify mode this handler must short-circuit at the top so that
      // Ctrl/meta+cluster is fully inert (no selection, no zoom, no identify).
      // The existing handler does NOT consult defaultPrevented, so a separate
      // interceptor would not suppress it reliably - the gate MUST live here.
      markers.on('clusterclick', (e: {
        layer?: {
          getAllChildMarkers?: () => { options?: { sampleId?: string } }[];
          getBounds?: () => unknown;
          zoomToBounds?: (options?: { padding?: [number, number] }) => void;
        };
        originalEvent?: MouseEvent;
      }) => {
        if (
          interactionModeRef.current === 'identify' ||
          interactionModeRef.current === 'identify-area'
        ) {
          // Swallow the cluster click: in Identify mode we want cluster marker
          // behavior fully disabled. Prevent default (zoom) and any selection.
          e.originalEvent?.preventDefault?.();
          e.originalEvent?.stopPropagation?.();
          return;
        }
        const orig = e.originalEvent;
        if (orig?.shiftKey) {
          orig.preventDefault();
          orig.stopPropagation();
          const children = e.layer?.getAllChildMarkers?.() ?? [];
          const childIds = children
            .map((m: { options?: { sampleId?: string } }) => m.options?.sampleId)
            .filter((id): id is string => !!id);
          if (childIds.length > 0) {
            addMultipleSamples(childIds);
          }
        } else if (orig?.ctrlKey || orig?.metaKey) {
          orig.preventDefault();
          orig.stopPropagation();
          const children = e.layer?.getAllChildMarkers?.() ?? [];
          const childIds = children
            .map((m: { options?: { sampleId?: string } }) => m.options?.sampleId)
            .filter((id): id is string => !!id);
          if (childIds.length > 0) {
            removeMultipleSamples(childIds);
          }
        } else {
          e.layer?.zoomToBounds?.({ padding: [20, 20] });
        }
        // Without a selection modifier, preserve the expected cluster zoom.
      });

      map.addLayer(markers);
      markersLayerRef.current = markers;

      const aggregateMarkersLayer = L.layerGroup().addTo(map);
      aggregateMarkersLayerRef.current = aggregateMarkersLayer;

      // ---- bbox-lane Stage 2: debounced viewport refetch --------------------
      // Compute a stable dedupe key + the bbox for the current viewport. Below
      // VIEWPORT_MIN_BBOX_ZOOM we fetch province-wide (null bbox) -- a capped
      // overview -- rather than a near-province bbox, deduped so panning at low
      // zoom does not re-trigger the uncapped province-wide hidden-aggregate scan.
      const computeViewport = (): { key: string; bbox: MatrixMapBbox | null } => {
        if (map.getZoom() < VIEWPORT_MIN_BBOX_ZOOM) {
          return { key: VIEWPORT_PROVINCE_KEY, bbox: null };
        }
        const b = map.getBounds();
        const bbox: MatrixMapBbox = {
          minLng: b.getWest(),
          minLat: b.getSouth(),
          maxLng: b.getEast(),
          maxLat: b.getNorth(),
        };
        const r = (n: number) => n.toFixed(3);
        return {
          key: `${r(bbox.minLng)},${r(bbox.minLat)},${r(bbox.maxLng)},${r(bbox.maxLat)}`,
          bbox,
        };
      };

      const runViewportFetch = async () => {
        const { key, bbox } = computeViewport();
        // Dedupe against the last LOADED viewport + any identical in-flight fetch.
        // (codex P2): never dedupe against an optimistic key, or an aborted/failed
        // fetch would wedge a never-loaded viewport as "current" and skip its retry.
        if (key === lastLoadedKeyRef.current) return;
        if (key === inFlightKeyRef.current) return;
        const rpcBbox = toRpcBbox(bbox); // null => province-wide (capped) overview
        const qs = rpcBbox
          ? `?min_lng=${rpcBbox.min_lng}&min_lat=${rpcBbox.min_lat}` +
            `&max_lng=${rpcBbox.max_lng}&max_lat=${rpcBbox.max_lat}`
          : '';

        // Drop any in-flight request; advance the sequence so its late reply is
        // ignored. The new fetch now OWNS inFlightKeyRef; the aborted one's catch
        // returns silently without touching it.
        viewportAbortRef.current?.abort();
        const controller = new AbortController();
        viewportAbortRef.current = controller;
        const seq = ++viewportFetchSeqRef.current;
        inFlightKeyRef.current = key;

        // owns(): this fetch is still the latest AND the component is mounted.
        const owns = () => seq === viewportFetchSeqRef.current && isMountedRef.current;

        try {
          const res = await fetch(`/api/matrix-map/samples${qs}`, {
            signal: controller.signal,
            headers: { accept: 'application/json' },
          });
          if (!owns()) return; // superseded/unmounted -- a newer fetch owns state
          if (!res.ok) {
            // Keep prior markers; transient notice. Do NOT mark this viewport
            // loaded, so the next move retries it. Clear our in-flight ownership.
            inFlightKeyRef.current = null;
            setRefetchError(
              `Map data refresh failed (HTTP ${res.status}). Showing the last loaded samples.`,
            );
            return;
          }
          const body = (await res.json()) as MatrixMapData & {
            fetchErrorMessage?: string | null;
          };
          if (!owns()) return;
          if (body.fetchErrorMessage) {
            // The RPC failed server-side (200 + empty + message). Do NOT blank
            // good markers with the empty fallback; show the notice + allow retry.
            inFlightKeyRef.current = null;
            setRefetchError(body.fetchErrorMessage);
            return;
          }
          // Success: mark this viewport loaded (dedupe future identical moves)
          // and notify the embedding parent so sibling panels can accumulate the
          // cumulative sample union (codex P1).
          lastLoadedKeyRef.current = key;
          inFlightKeyRef.current = null;
          setRefetchError(null);
          setMapData(body);
          onMapDataChangeRef.current?.(body);
        } catch (err) {
          // A superseded request aborts -- silent (a newer fetch owns inFlightKey).
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (!owns()) return;
          inFlightKeyRef.current = null;
          setRefetchError('Map data refresh failed (network). Showing the last loaded samples.');
        }
      };

      const onViewportSettle = () => {
        if (viewportDebounceRef.current) clearTimeout(viewportDebounceRef.current);
        viewportDebounceRef.current = setTimeout(() => {
          void runViewportFetch();
        }, VIEWPORT_REFETCH_DEBOUNCE_MS);
      };

      map.on('moveend', onViewportSettle);
      map.on('zoomend', onViewportSettle);
      // -----------------------------------------------------------------------

      mapInstanceRef.current = map;
      setIsLoaded(true);
    };

    initMap();

    return () => {
      isMounted = false;
      // bbox-lane Stage 2: tear down the viewport refetch loop so no pending
      // timer or in-flight fetch fires setState after unmount/navigation.
      isMountedRef.current = false;
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
        viewportDebounceRef.current = null;
      }
      viewportAbortRef.current?.abort();
      viewportAbortRef.current = null;
      viewportFetchSeqRef.current += 1; // invalidate any reply mid-flight
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        aggregateMarkersLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Codex P2 (2026-05-20 panel-scaffold review): when the matrix-map is
  // embedded in /matrix-options as a 3-column layout with collapsible
  // left + right side panels (PR-MAP-4 scaffold), toggling a panel
  // changes the map container's width via a transition-all animation.
  // Leaflet does NOT auto-detect container resizes -- the visible tile
  // viewport stays at the original size until the next manual recompute.
  // ResizeObserver on the container ref calls map.invalidateSize() any
  // time the container's dimensions change; debounced via rAF so rapid
  // resize events (during the 300ms transition) coalesce into one
  // recompute after settling. Self-contained inside MatrixMap so the
  // panel toggles in MatrixDashboard don't need any explicit signal
  // wiring, AND so the bare /matrix-map standalone route also benefits
  // if some other consumer ever embeds it in a resizing container.
  useEffect(() => {
    if (!mapInstanceRef.current || !mapContainerRef.current) return;
    const container = mapContainerRef.current;
    const mapInstance = mapInstanceRef.current;
    let rafId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        try {
          mapInstance.invalidateSize();
        } catch {
          // Best-effort; ignore if map was disposed mid-resize.
        }
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isLoaded]);

  // Change base layer
  useEffect(() => {
    if (!mapInstanceRef.current || !leaflet || !tileLayerRef.current) return;

    const map = mapInstanceRef.current;
    const layerConfig = BASE_LAYERS[activeLayer];

    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = leaflet.tileLayer(layerConfig.url, {
      attribution: layerConfig.attribution,
    }).addTo(map);
  }, [activeLayer, leaflet]);

  // Manage WMS overlay layers
  useEffect(() => {
    if (!mapInstanceRef.current || !leaflet) return;
    const map = mapInstanceRef.current;
    const currentLayers = overlayLayersRef.current;

    // Remove overlays no longer active
    for (const [key, layer] of currentLayers.entries()) {
      if (!activeOverlays.has(key)) {
        map.removeLayer(layer);
        currentLayers.delete(key);
      }
    }

    // Add newly active overlays
    for (const key of activeOverlays) {
      if (!currentLayers.has(key)) {
        const def = OVERLAY_LAYERS[key];
        if (!def) continue;
        const wmsLayer = leaflet.tileLayer.wms(BC_WMS_URL, {
          layers: def.layer,
          format: 'image/png',
          transparent: true,
          opacity: 0.6,
          attribution: BC_ATTR,
        }).addTo(map);
        currentLayers.set(key, wmsLayer);
      }
    }
  }, [activeOverlays, leaflet]);

  const toggleOverlay = useCallback((key: string) => {
    setActiveOverlays(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Track individual markers by sample ID so selection updates don't destroy cluster/spiderfy state
  // Typed as LeafletMarker (the Leaflet base class) since markers in the
  // map are either Marker or CircleMarker and callers check classification
  // to determine which methods are available at each call site.
  const markerMapRef = useRef<Map<string, Marker | CircleMarker>>(new Map());

  // Create/recreate markers only when samples change.
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !leaflet || !markersLayerRef.current) return;
    const L = leaflet;
    const markersLayer = markersLayerRef.current;
    markersLayer.clearLayers();
    markerMapRef.current.clear();

    sampleMarkers.forEach((sample) => {
      const color = CLASSIFICATION_COLOR[sample.classification];
      const dashArray = COORD_TIER_DASH_ARRAY[sample.coordinate_quality_tier];
      const isUnknown = sample.classification === 'unknown';
      const isImpacted = sample.classification === 'impacted';
      const lat = sample.geometry.coordinates[1];
      const lng = sample.geometry.coordinates[0];

      let marker: CircleMarker | Marker;
      if (isImpacted) {
        // Triangle via SVG divIcon (codex P1-1: pure CSS border-triangles cannot
        // carry the coord-tier dash pattern; SVG polygon with strokeDasharray
        // does, so all 9 spec states are visually distinguishable). PLAN_V3_4_2
        // section 3.3: 3 classifications x 3 coord tiers.
        marker = L.marker([lat, lng], {
          icon: createImpactedMarkerIcon(L, color, dashArray, false),
          // sampleId is a custom option read by the cluster click handler.
          // Cast to satisfy MarkerOptions which does not declare custom fields.
          ...({ sampleId: sample.id } as import('leaflet').MarkerOptions),
        });
      } else {
        // codex P1-2: unknown samples must show a GREY hollow ring, not a
        // white-on-white invisible ring. Stroke color carries the classification
        // color for unknown; selected state (set in the style-update effect
        // below) overrides with the blue stroke #2563eb.
        const strokeColor = isUnknown ? color : 'white';
        marker = L.circleMarker([lat, lng], {
          radius: 12,
          fillColor: color,
          color: strokeColor,
          weight: 3,
          opacity: 1,
          fillOpacity: isUnknown ? 0 : 0.9, // hollow circle for unknown
          dashArray,
          // sampleId is a custom option read by the cluster click handler.
          // Cast to satisfy CircleMarkerOptions which does not declare custom fields.
          ...({ sampleId: sample.id } as import('leaflet').CircleMarkerOptions),
        });
      }

      marker.bindPopup(createPopupContent(sample), { maxWidth: 320 });
      if (
        interactionModeRef.current === 'identify' ||
        interactionModeRef.current === 'identify-area'
      ) {
        try {
          const popup = marker.getPopup?.();
          if (popup) {
            const content = popup.getContent?.();
            const options = popup.options;
            markerPopupBackupRef.current.set(marker, { content, options });
            marker.unbindPopup();
          }
        } catch (err) {
          console.warn('[MatrixMap] identify: mid-mode unbindPopup failed', err);
        }
      }
      marker.on('click', (e: { originalEvent?: MouseEvent; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
        if (
          interactionModeRef.current === 'identify' ||
          interactionModeRef.current === 'identify-area'
        ) return;
        const orig = e.originalEvent;
        const shiftHeld = orig?.shiftKey || e.shiftKey;
        const ctrlHeld = orig?.ctrlKey || orig?.metaKey || e.ctrlKey || e.metaKey;
        if (shiftHeld) {
          addSampleSelection(sample.id);
        } else if (ctrlHeld) {
          removeSampleSelection(sample.id);
        } else {
          selectSample(sample.id);
        }
      });

      markerMapRef.current.set(sample.id, marker);
      markersLayer.addLayer(marker);
    });
  }, [sampleMarkers, isLoaded, leaflet, selectSample, addSampleSelection, removeSampleSelection]);

  // Option C aggregate markers are static, fixed-site markers. They are kept
  // out of the sample cluster layer so they cannot be selected or exported as
  // sample rows, and surveyed_only hides them entirely.
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !leaflet || !aggregateMarkersLayerRef.current) return;
    const layer = aggregateMarkersLayerRef.current;
    layer.clearLayers();

    visibleAggregateMarkers.forEach((aggregate) => {
      const marker = leaflet.marker(aggregate.position, {
        icon: createSiteAggregateMarkerIcon(leaflet, aggregate),
        keyboard: true,
        title: `Site aggregate: ${aggregate.label}`,
      });
      if (interactionMode !== 'identify' && interactionMode !== 'identify-area') {
        marker.bindPopup(createSiteAggregatePopupContent(aggregate), { maxWidth: 300 });
      }
      marker.on('click', () => {
        if (
          interactionModeRef.current === 'identify' ||
          interactionModeRef.current === 'identify-area'
        ) return;
      });
      layer.addLayer(marker);
    });
  }, [visibleAggregateMarkers, isLoaded, leaflet, interactionMode]);

  // Update marker styles when selection changes -- without clearing/recreating layers.
  useEffect(() => {
    if (!isLoaded || !leaflet) return;
    markerMapRef.current.forEach((marker, sampleId) => {
      const sample = sampleMarkers.find((s) => s.id === sampleId);
      if (!sample) return;
      const isSelected =
        selectedSampleIds.includes(sampleId) || selectedSampleId === sampleId;
      if (sample.classification === 'impacted') {
        // Impacted markers are always L.Marker (triangle SVG divIcon).
        (marker as Marker).setIcon(
          createImpactedMarkerIcon(
            leaflet,
            CLASSIFICATION_COLOR.impacted,
            COORD_TIER_DASH_ARRAY[sample.coordinate_quality_tier],
            isSelected,
          ),
        );
        return;
      }
      // codex P1-2 follow-up: on deselect, restore the classification-aware
      // stroke (grey for unknown, white for reference). Selected state always
      // wins with the spec blue overlay.
      const restingStroke =
        sample.classification === 'unknown'
          ? CLASSIFICATION_COLOR.unknown
          : 'white';
      const borderColor = isSelected ? '#2563eb' : restingStroke;
      // Non-impacted markers are always L.CircleMarker.
      (marker as CircleMarker).setStyle({
        radius: isSelected ? 16 : 12,
        color: borderColor,
        weight: isSelected ? 4 : 3,
      });
    });
    markersLayerRef.current?.refreshClusters?.();
  }, [selectedSampleId, selectedSampleIds, sampleMarkers, isLoaded, leaflet]);

  // Area select (rectangle drag) mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded || !leaflet) return;

    if (interactionMode === 'select-area') {
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';

      let startLatLng: { lat: number; lng: number } | null = null;

      const onMouseDown = (e: { latlng: { lat: number; lng: number }; originalEvent: MouseEvent }) => {
        startLatLng = e.latlng;
        if (areaSelectRectRef.current) {
          map.removeLayer(areaSelectRectRef.current);
          areaSelectRectRef.current = null;
        }
      };

      const onMouseMove = (e: { latlng: { lat: number; lng: number } }) => {
        if (!startLatLng) return;
        if (areaSelectRectRef.current) {
          map.removeLayer(areaSelectRectRef.current);
        }
        areaSelectRectRef.current = leaflet.rectangle(
          leaflet.latLngBounds(startLatLng, e.latlng),
          { color: '#3b82f6', weight: 2, fillOpacity: 0.15, dashArray: '6 3' },
        ).addTo(map);
      };

      const onMouseUp = (e: { latlng: { lat: number; lng: number } }) => {
        if (!startLatLng) return;
        const bounds = leaflet.latLngBounds(startLatLng, e.latlng);

        // Find all samples within the rectangle
        const insideIds = sampleMarkers
          .filter((s) => bounds.contains(leaflet.latLng(s.geometry.coordinates[1], s.geometry.coordinates[0])))
          .map((s) => s.id);

        selectAllSamplesAction(insideIds);

        // Clean up rectangle
        if (areaSelectRectRef.current) {
          map.removeLayer(areaSelectRectRef.current);
          areaSelectRectRef.current = null;
        }
        startLatLng = null;
      };

      map.on('mousedown', onMouseDown);
      map.on('mousemove', onMouseMove);
      map.on('mouseup', onMouseUp);

      return () => {
        map.off('mousedown', onMouseDown);
        map.off('mousemove', onMouseMove);
        map.off('mouseup', onMouseUp);
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        if (areaSelectRectRef.current) {
          map.removeLayer(areaSelectRectRef.current);
          areaSelectRectRef.current = null;
        }
      };
    } else {
      map.dragging.enable();
      map.getContainer().style.cursor = '';
    }
  }, [interactionMode, isLoaded, leaflet, sampleMarkers, selectAllSamplesAction]);

  // Identify-area mode: drag a rectangle and query active WMS overlays for
  // all features in the drawn bounds. Results replace the current identified
  // feature list and the popup only summarizes the batch.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded || !leaflet) return;
    if (interactionMode !== 'identify-area') return;
    const requestIdRef = identifyRequestIdRef;

    map.dragging.disable();

    let startLatLng: { lat: number; lng: number } | null = null;

    const onMouseDown = (e: { latlng: { lat: number; lng: number } }) => {
      startLatLng = e.latlng;
      if (areaSelectRectRef.current) {
        map.removeLayer(areaSelectRectRef.current);
        areaSelectRectRef.current = null;
      }
    };

    const onMouseMove = (e: { latlng: { lat: number; lng: number } }) => {
      if (!startLatLng) return;
      if (areaSelectRectRef.current) {
        map.removeLayer(areaSelectRectRef.current);
      }
      areaSelectRectRef.current = leaflet.rectangle(
        leaflet.latLngBounds(startLatLng, e.latlng),
        { color: '#7c3aed', weight: 2, fillOpacity: 0.12, dashArray: '6 3' },
      ).addTo(map);
    };

    const onMouseUp = async (e: { latlng: { lat: number; lng: number } }) => {
      if (!startLatLng) return;
      const bounds = leaflet.latLngBounds(startLatLng, e.latlng);
      const center = bounds.getCenter();
      startLatLng = null;

      if (areaSelectRectRef.current) {
        map.removeLayer(areaSelectRectRef.current);
        areaSelectRectRef.current = null;
      }

      const myId = ++requestIdRef.current;
      const overlayDefs: Record<string, Omit<IdentifyOverlay, 'key'>> = {};
      for (const [key, def] of Object.entries(OVERLAY_LAYERS)) {
        overlayDefs[key] = {
          name: def.name,
          layer: def.layer,
          category: def.category,
        };
      }
      const ordered = getActiveOverlaysInZOrder(
        overlayLayersRef.current as Map<string, unknown>,
        overlayDefs,
      );

      let hits: IdentifiedFeature[] = [];
      try {
        hits = await queryActiveOverlaysInBounds(ordered, bounds, {
          wfsUrl: BC_WFS_IDENTIFY_PROXY_URL,
          maxFeaturesPerLayer: 250,
        });
      } catch (err) {
        console.warn('[MatrixMap] identify-area: query failed', err);
      }

      if (requestIdRef.current !== myId) return;

      if (identifyPopupRef.current) {
        try {
          map.closePopup(identifyPopupRef.current);
        } catch {
          // ignore
        }
        identifyPopupRef.current = null;
      }

      if (hits.length === 0) {
        const reason: 'no_overlays' | 'no_hits' =
          ordered.length === 0 ? 'no_overlays' : 'no_hits';
        try {
          const popup = leaflet
            .popup({ closeButton: true, autoClose: true })
            .setLatLng(center)
            .setContent(formatIdentifyEmptyHtml(reason));
          popup.openOn(map);
          identifyPopupRef.current = popup;
        } catch (err) {
          console.warn('[MatrixMap] identify-area: no-hits popup failed', err);
        }
        return;
      }

      setIdentifiedFeatures(hits);
      try {
        const popup = leaflet
          .popup({ closeButton: true, autoClose: true })
          .setLatLng(center)
          .setContent(
            `<div style="min-width:220px;font-family:system-ui,sans-serif;">` +
              `<p style="font-weight:700;color:#0f172a;margin:0 0 6px 0;">${hits.length} features identified in area</p>` +
              `<p style="font-size:12px;color:#475569;margin:0;">Review the full result set in the side panel.</p>` +
            `</div>`,
          );
        popup.openOn(map);
        identifyPopupRef.current = popup;
      } catch (err) {
        console.warn('[MatrixMap] identify-area: popup open failed', err);
      }
    };

    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup', onMouseUp);

    return () => {
      requestIdRef.current++;
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup', onMouseUp);
      map.dragging.enable();
      if (areaSelectRectRef.current) {
        map.removeLayer(areaSelectRectRef.current);
        areaSelectRectRef.current = null;
      }
    };
  }, [interactionMode, isLoaded, leaflet, setIdentifiedFeatures]);

  // Identify mode wiring.
  //
  // Entry: set crosshair cursor, close any open popup, unbind all marker
  // popups (saving content+options to markerPopupBackupRef) so Leaflet's
  // internal popup-open logic cannot fire, attach map.on('click') for
  // raster/empty clicks, install runIdentify as the single authoritative
  // writer of identifiedFeatures.
  //
  // Exit (cleanup returned from useEffect): restore cursor, rebind all
  // marker popups from the backup ref and clear it, detach map click
  // handler, close any transient identify popup, clear runIdentifyRef.
  // Cluster suppression lives inside the EXISTING clusterclick handler -
  // flipping interactionModeRef alone restores cluster zoom behavior.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isLoaded || !leaflet) return;
    const isIdentifyMode =
      interactionMode === 'identify' || interactionMode === 'identify-area';
    if (!isIdentifyMode) return;
    const requestIdRef = identifyRequestIdRef;

    const L = leaflet;
    const container = map.getContainer();
    const prevCursor = container.style.cursor;
    container.style.cursor = 'crosshair';
    container.classList.add('matrix-identify-cursor');

    // Close any currently-open popup so a prior marker popup does not linger.
    try {
      map.closePopup();
    } catch {
      // ignore
    }

    // Unbind every site marker's popup and save content+options. Leaflet's
    // internal popup-open for bound popups fires independently of our click
    // handler - unbind is the reliable suppression.
    const backup = markerPopupBackupRef.current;
    markerMapRef.current.forEach((marker) => {
      try {
        const popup = marker.getPopup?.();
        if (popup) {
          const content = popup.getContent?.();
          const options = popup.options;
          backup.set(marker, { content, options });
          marker.unbindPopup();
        }
      } catch (err) {
        console.warn('[MatrixMap] identify: unbindPopup failed', err);
      }
    });

    // The writer. Single authoritative path into identifiedFeatures.
    const runIdentify = async (
      latlng: { lat: number; lng: number },
      geojsonHit: IdentifiedFeature | null,
    ) => {
      // Capture a monotonic request id at entry. After each await we compare
      // against the ref; if it has advanced, a newer click (or mode exit)
      // superseded us and we silently discard this response.
      const myId = ++requestIdRef.current;
      // Resolve the active WMS overlays in topmost-first z-order. The
      // overlayLayersRef Map is inserted-in-add-order, so reverse iteration
      // gives topmost-first. Declaration order of OVERLAY_LAYERS is NOT used.
      const overlayDefs: Record<string, Omit<IdentifyOverlay, 'key'>> = {};
      for (const [key, def] of Object.entries(OVERLAY_LAYERS)) {
        overlayDefs[key] = { name: def.name, layer: def.layer, category: def.category };
      }
      const ordered = getActiveOverlaysInZOrder(
        overlayLayersRef.current as Map<string, unknown>,
        overlayDefs,
      );
      let wmsHits: IdentifiedFeature[] = [];
      try {
        wmsHits = await queryActiveOverlays(
          ordered,
          map as unknown as LeafletMapLike,
          latlng,
          { wmsUrl: BC_WMS_IDENTIFY_PROXY_URL },
        );
      } catch (err) {
        console.warn('[MatrixMap] identify: queryActiveOverlays failed', err);
      }
      // Stale-response guard: if a newer request has started (or mode exited),
      // abandon this response without writing to the store or opening a popup.
      if (requestIdRef.current !== myId) return;
      const merged = geojsonHit ? [geojsonHit, ...wmsHits] : wmsHits;

      // Remove any prior transient identify popup before opening a new one.
      if (identifyPopupRef.current) {
        try {
          map.closePopup(identifyPopupRef.current);
        } catch {
          // ignore
        }
        identifyPopupRef.current = null;
      }

      if (merged.length === 0) {
        // Distinguish the two empty cases so the popup copy is accurate:
        //   - no_overlays: user has not enabled any WMS overlay AND the click
        //     did not hit a GeoJSON feature. Identify has nothing to query;
        //     the popup hints at the layer menu instead of misleadingly
        //     saying "no features here".
        //   - no_hits: at least one overlay was queryable (or a GeoJSON
        //     feature was clicked) but the buffered search returned nothing.
        const reason: 'no_overlays' | 'no_hits' =
          ordered.length === 0 && !geojsonHit ? 'no_overlays' : 'no_hits';
        // Do NOT write to the store when there are no hits.
        try {
          const popup = L.popup({ closeButton: true, autoClose: true })
            .setLatLng(latlng)
            .setContent(formatIdentifyEmptyHtml(reason));
          popup.openOn(map);
          identifyPopupRef.current = popup;
        } catch (err) {
          console.warn('[MatrixMap] identify: no-hits popup failed', err);
        }
        return;
      }

      setIdentifiedFeatures(merged);
      try {
        const popup = L.popup({ closeButton: true, autoClose: true })
          .setLatLng(latlng)
          .setContent(
            formatIdentifyPopupHtml(
              merged.map((f) => ({
                layerLabel: f.layerLabel,
                properties: f.properties,
              })),
            ),
          );
        popup.openOn(map);
        identifyPopupRef.current = popup;
      } catch (err) {
        console.warn('[MatrixMap] identify: popup open failed', err);
      }
    };
    runIdentifyRef.current =
      interactionMode === 'identify' ? runIdentify : null;

    const handleIdentifyClick = (e: { latlng: { lat: number; lng: number } }) => {
      void runIdentify(e.latlng, null);
    };
    if (interactionMode === 'identify') {
      map.on('click', handleIdentifyClick);
    }

    return () => {
      // Bump the request id so any in-flight runIdentify call that resolves
      // after mode exit will see a mismatch and abandon silently.
      requestIdRef.current++;

      // Restore cursor
      container.style.cursor = prevCursor;
      container.classList.remove('matrix-identify-cursor');

      // Rebind marker popups from the backup
      backup.forEach((saved, marker) => {
        try {
          if (saved.content !== undefined) {
            marker.bindPopup(saved.content, saved.options);
          }
        } catch (err) {
          console.warn('[MatrixMap] identify: bindPopup restore failed', err);
        }
      });
      backup.clear();

      if (interactionMode === 'identify') {
        map.off('click', handleIdentifyClick);
      }

      if (identifyPopupRef.current) {
        try {
          map.closePopup(identifyPopupRef.current);
        } catch {
          // ignore
        }
        identifyPopupRef.current = null;
      }

      runIdentifyRef.current = null;
    };
  }, [interactionMode, isLoaded, leaflet, setIdentifiedFeatures]);

  // Fit to samples on first load ONLY. bbox-lane Stage 2 made allSamples
  // reactive, so without a fire-once guard this effect would re-fit (auto-zoom)
  // on every viewport refetch that changes the sample count -- fighting the
  // user's pan. hasFitBoundsRef is set TRUE only after a successful non-empty
  // fitBounds, so an initial empty-then-populated load still fits exactly once.
  useEffect(() => {
    if (hasFitBoundsRef.current) return;
    if (!mapInstanceRef.current || !isLoaded || !leaflet || allSamples.length === 0) return;
    const bounds = leaflet.latLngBounds(
      allSamples.map((s) => [s.geometry.coordinates[1], s.geometry.coordinates[0]])
    );
    mapInstanceRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
    hasFitBoundsRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSamples.length, isLoaded, leaflet]);

  // Pan to sample function.
  const panToSample = useCallback((sampleId: string) => {
    const sample = allSamples.find((s) => s.id === sampleId);
    if (!sample || !mapInstanceRef.current) return;
    selectSample(sampleId);
    mapInstanceRef.current.setView(
      [sample.geometry.coordinates[1], sample.geometry.coordinates[0]],
      14,
      { animate: true }
    );
  }, [allSamples, selectSample]);

  useEffect(() => {
    if (!panRequestedSampleId || panRequestSeq === 0) return;
    const sample = allSamples.find((s) => s.id === panRequestedSampleId);
    if (!sample || !mapInstanceRef.current) return;
    mapInstanceRef.current.setView(
      [sample.geometry.coordinates[1], sample.geometry.coordinates[0]],
      14,
      { animate: true },
    );
  }, [allSamples, panRequestedSampleId, panRequestSeq]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleFitToSamples = useCallback(() => {
    if (!mapInstanceRef.current || !leaflet) return;
    const points = getFitBoundsPoints(sampleMarkers, visibleAggregateMarkers);
    if (points.length === 0) return;
    const bounds = leaflet.latLngBounds(points);
    mapInstanceRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
  }, [leaflet, sampleMarkers, visibleAggregateMarkers]);

  // Export map as image
  const handleExportMap = useCallback(async () => {
    if (!mapContainerRef.current) return;

    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(mapContainerRef.current, {
        quality: 0.95,
        backgroundColor: '#f8fafc',
      });

      const link = document.createElement('a');
      link.download = `matrix-map-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export map:', err);
    }
  }, []);

  return (
    <div className={cn('relative w-full h-full bg-slate-100 dark:bg-slate-700', className)}>
      {/* Cluster marker styles */}
      <style jsx global>{`
        .custom-cluster-icon {
          background: transparent;
        }
        .cluster-marker {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        }
        .cluster-small {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        }
        .cluster-medium {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        }
        .cluster-large {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #ec4899, #be185d);
        }
        .cluster-selected-badge {
          position: absolute;
          left: 50%;
          bottom: -10px;
          transform: translateX(-50%);
          min-width: max-content;
          border-radius: 999px;
          border: 1px solid rgba(37,99,235,0.35);
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 10px;
          line-height: 1;
          padding: 3px 6px;
          box-shadow: 0 1px 4px rgba(15,23,42,0.2);
        }
      `}</style>

      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 z-10">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-400 border-t-blue-500 rounded-full animate-spin" />
            <span>Loading map...</span>
          </div>
        </div>
      )}

      {fetchErrorMessage && (
        <div className="absolute top-20 left-4 right-4 z-[1000] bg-amber-50 border border-amber-300 text-amber-800 text-xs px-3 py-2 rounded-lg shadow">
          {fetchErrorMessage}
        </div>
      )}

      {siteAggregateFetchErrorMessage && (
        <div className="absolute top-44 left-4 right-4 z-[1000] flex items-start justify-between gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs px-3 py-2 rounded-lg shadow">
          <span>{siteAggregateFetchErrorMessage}</span>
        </div>
      )}
      {/* bbox-lane Stage 2: transient viewport-refetch error -- shown WITHOUT
          discarding the last good markers; dismissable. */}
      {refetchError && (
        <div className="absolute top-32 left-4 right-4 z-[1000] flex items-start justify-between gap-2 bg-amber-50 border border-amber-300 text-amber-800 text-xs px-3 py-2 rounded-lg shadow">
          <span>{refetchError}</span>
          <button
            type="button"
            aria-label="Dismiss map refresh error"
            onClick={() => setRefetchError(null)}
            className="font-semibold leading-none hover:text-amber-950"
          >
            x
          </button>
        </div>
      )}

      {/* bbox-lane Stage 2: capped-overview / truncated hint. The RPC caps every
          response (incl. the province-wide null-bbox overview), so when more
          samples exist than were returned, prompt the user to zoom in. */}
      {mapData.truncated && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/85 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
          Showing {mapData.returned_sample_count ?? allSamples.length} of{' '}
          {mapData.total_in_bbox ?? mapData.returned_sample_count ?? allSamples.length} samples -- zoom in to see all
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button aria-label="Zoom in" onClick={handleZoomIn} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700" title="Zoom in">
          <ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <button aria-label="Zoom out" onClick={handleZoomOut} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700" title="Zoom out">
          <ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
        <button
          aria-label="Fit to samples"
          onClick={handleFitToSamples}
          className={cn("p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700", fitLocationCount > 0 ? "hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600" : "opacity-50 cursor-not-allowed")}
          disabled={fitLocationCount === 0}
          title="Fit to samples"
        >
          <Target className="w-5 h-5" />
        </button>

        {/* Layer switcher */}
        <div className="relative">
          <button
            aria-label="Change map layer"
            aria-expanded={showLayerMenu}
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
            title="Change map layer"
          >
            <Layers className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-full mr-2 top-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[220px] max-h-[70vh] overflow-y-auto">
              {/* Base layers */}
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Base Map</p>
              {Object.entries(BASE_LAYERS).map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => setActiveLayer(key as keyof typeof BASE_LAYERS)}
                  className={cn("w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2", activeLayer === key && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium")}
                >
                  <div className={cn("w-3 h-3 rounded-full border-2", activeLayer === key ? "border-blue-500 bg-blue-500" : "border-slate-300 dark:border-slate-600")} />
                  {layer.name}
                </button>
              ))}

              {/* Overlay layers by category */}
              {OVERLAY_CATEGORIES.map(({ key: catKey, label }) => {
                const overlaysInCat = Object.entries(OVERLAY_LAYERS).filter(([, def]) => def.category === catKey);
                if (overlaysInCat.length === 0) return null;
                return (
                  <div key={catKey}>
                    <div className="border-t border-slate-200 dark:border-slate-700 mt-1" />
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                    {overlaysInCat.map(([key, def]) => (
                      <button
                        key={key}
                        onClick={() => toggleOverlay(key)}
                        className={cn("w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2", activeOverlays.has(key) && "bg-green-50 dark:bg-green-900/20")}
                      >
                        <div className={cn(
                          "w-3 h-3 rounded-sm border-2 transition-colors",
                          activeOverlays.has(key)
                            ? "border-green-500 bg-green-500"
                            : "border-slate-300 dark:border-slate-600",
                        )} />
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: def.color, opacity: 0.7 }} />
                        <span className="truncate">{def.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
        <button
          aria-label="Export map image"
          onClick={handleExportMap}
          className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
          title="Export map image"
        >
          <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>

      {/* Interaction mode toggle */}
      <div className="absolute top-4 right-[72px] z-[1000] flex bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setInteractionMode('pan')}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors border-r border-slate-200 dark:border-slate-700',
            interactionMode === 'pan'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Pan mode -- drag to move map"
        >
          <Hand className="w-4 h-4" />
          <span className="hidden sm:inline">Pan</span>
        </button>
        <button
          onClick={() => setInteractionMode('select-individual')}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors border-r border-slate-200 dark:border-slate-700',
            interactionMode === 'select-individual'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Select mode - click replaces, Shift+click adds, Ctrl+click removes"
        >
          <MousePointer className="w-4 h-4" />
          <span className="hidden sm:inline">Select</span>
        </button>
        <button
          onClick={() => setInteractionMode('select-area')}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors border-r border-slate-200 dark:border-slate-700',
            interactionMode === 'select-area'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Area select - drag rectangle to select markers"
        >
          <BoxSelect className="w-4 h-4" />
          <span className="hidden sm:inline">Area</span>
        </button>
        <button
          onClick={() => setInteractionMode('identify')}
          aria-label="Identify mode"
          aria-pressed={interactionMode === 'identify'}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors border-r border-slate-200 dark:border-slate-700',
            interactionMode === 'identify'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Identify - searches currently-enabled WMS overlays. Enable a layer from the layer menu first."
        >
          <Crosshair className="w-4 h-4" />
          <span className="hidden sm:inline">Identify</span>
        </button>
        <button
          onClick={() => setInteractionMode('identify-area')}
          aria-label="Identify area mode"
          aria-pressed={interactionMode === 'identify-area'}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors',
            interactionMode === 'identify-area'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Identify Area - drag a box to collect features from currently-enabled WMS overlays."
        >
          <BoxSelect className="w-4 h-4" />
          <span className="hidden sm:inline">Identify Area</span>
        </button>
      </div>

      {/* Legend - 9-state symbology per PLAN_V3_4_2 section 3.3 */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 border border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Classification</p>
        <div className="space-y-2">
          <LegendSymbol shape="circle" color="#10b981" filled label="Reference" />
          <LegendSymbol shape="triangle" color="#eab308" filled label="Impacted" />
          <LegendSymbol shape="circle" color="#94a3b8" filled={false} label="Unknown" />
        </div>
        <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Coordinate quality</p>
          <div className="space-y-1.5">
            <LegendOutline dashArray={undefined} label="Surveyed (high)" />
            <LegendOutline dashArray="4 3" label="Centroid (medium)" />
            <LegendOutline dashArray="1 3" label="Manual (low)" />
          </div>
          <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
            Centroid = approximate BC CSR parcel location, not a surveyed point.
          </p>
          {siteAggregateData.site_count > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded border border-teal-100 bg-teal-50/70 px-2 py-1 text-[10px] text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-teal-200">
              <span className="h-3 w-3 rotate-45 border-2 border-dashed border-teal-700 bg-amber-100 dark:border-teal-300 dark:bg-amber-900/60" />
              <span>Site aggregates</span>
            </div>
          )}
          <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={filterState.surveyed_only}
              onChange={(e) => setFilterState({ surveyed_only: e.target.checked })}
              className="h-3 w-3 rounded border-slate-300 dark:border-slate-600"
              aria-label="Show surveyed locations only"
            />
            Surveyed only
          </label>
        </div>
      </div>

      {/* Sample count header */}
      <div className="absolute top-4 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{sampleCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeMapFilters ? `${allSamples.length} loaded` : `${sampleCount === 1 ? 'Sample' : 'Samples'} loaded`}
            </p>
          </div>
        </div>
        {/* Source: dashboard_data_truth_map_run_2026_07_11 (province-wide DRA/sample audit, 2026-07-11). */}
        {/* Static by design -- see T17 spec for why this is not computed from the loaded sample set. */}
        <p className="mt-1.5 max-w-[220px] text-[10px] leading-snug text-slate-400 dark:text-slate-500">
          Most plotted locations (~98.5%) are approximate BC CSR site centroids, not surveyed sediment
          coordinates. See marker outline / legend for per-point provenance.
        </p>
        {siteAggregateData.site_count > 0 && (
          <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-teal-700 dark:text-teal-300">
            {filterState.surveyed_only
              ? 'Site aggregates hidden by Surveyed only.'
              : sampleFiltersActive
                ? 'Site aggregates hidden by active filters.'
              : `${visibleAggregateMarkers.length} site aggregates represent ${siteAggregateData.sample_count_total} total samples at centroid-site locations.`}
          </p>
        )}
      </div>

      {/* Clickable Sample List */}
      {sampleCount > 0 && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 w-64">
          <button
            aria-label={sampleListExpanded ? "Collapse sample list" : "Expand sample list"}
            aria-expanded={sampleListExpanded}
            onClick={() => setSampleListExpanded(!sampleListExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sample Locations</span>
            {sampleListExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          </button>

          {sampleListExpanded && (
            <>
              {/* Multi-select controls */}
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedSampleIds.length > 0 ? `${selectedSampleIds.length} selected` : 'Shift+click add, Ctrl+click remove'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={selectAllSamples}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-1"
                  >
                    All
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={clearSampleSelection}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 px-1"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {samples.map((sample) => {
                  const isSelected = selectedSampleIds.includes(sample.id) || selectedSampleId === sample.id;
                  const lat = sample.geometry.coordinates[1];
                  const lng = sample.geometry.coordinates[0];
                  return (
                    <button
                      key={sample.id}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          addSampleSelection(sample.id);
                        } else if (e.ctrlKey || e.metaKey) {
                          removeSampleSelection(sample.id);
                        } else {
                          panToSample(sample.id);
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0",
                        isSelected && "bg-blue-50 dark:bg-blue-900/30"
                      )}
                    >
                      <div
                        className={cn(
                          "w-3 h-3 rounded-full flex-shrink-0 border-2",
                          isSelected ? "border-blue-500" : "border-transparent"
                        )}
                        style={{ backgroundColor: getMarkerColor(sample) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300")}>
                          {sample.display_name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          {sample.station_id} -- {lat.toFixed(4)}, {lng.toFixed(4)}
                        </p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LegendSymbol({ shape, color, filled, label }: {
  shape: 'circle' | 'triangle';
  color: string;
  filled: boolean;
  label: string;
}) {
  if (shape === 'triangle') {
    return (
      <div className="flex items-center gap-2">
        <div style={{
          width: 0, height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderBottom: `12px solid ${color}`,
        }} />
        <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded-full border-2 border-white shadow"
        style={{
          backgroundColor: filled ? color : 'transparent',
          borderColor: filled ? 'white' : color,
        }}
      />
      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

function LegendOutline({ dashArray, label }: { dashArray: string | undefined; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="14" aria-hidden="true">
        <circle cx="10" cy="7" r="5" fill="none" stroke="#475569" strokeWidth="2"
          strokeDasharray={dashArray} />
      </svg>
      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

export function filterSamplesCoveredBySiteAggregates(
  samples: readonly MatrixSample[],
  aggregateMarkers: readonly AggregateMarker[],
): MatrixSample[] {
  if (aggregateMarkers.length === 0) return [...samples];
  const coveredKeys = new Set(
    aggregateMarkers.map((marker) =>
      `${marker.source_dra_id}:${coordinateClusterId(marker.position[0], marker.position[1])}`,
    ),
  );
  return samples.filter((sample) => {
    if (sample.coordinate_quality_tier !== 'medium' || sample.source_dra_id === null) return true;
    const [longitude, latitude] = sample.geometry.coordinates;
    const key = `${sample.source_dra_id}:${coordinateClusterId(latitude, longitude)}`;
    return !coveredKeys.has(key);
  });
}

export function getFitBoundsPoints(
  samples: readonly MatrixSample[],
  aggregateMarkers: readonly AggregateMarker[],
): [number, number][] {
  return [
    ...samples.map((sample) => [
      sample.geometry.coordinates[1],
      sample.geometry.coordinates[0],
    ] as [number, number]),
    ...aggregateMarkers.map((aggregate) => aggregate.position),
  ];
}

function createSiteAggregateMarkerIcon(L: typeof import('leaflet'), aggregate: AggregateMarker) {
  const size = Math.max(18, Math.min(34, aggregate.radius * 2 + 8));
  return L.divIcon({
    className: 'site-aggregate-div-icon',
    html: createSiteAggregateMarkerHtml(aggregate, size),
    iconSize: L.point(size, size),
    iconAnchor: L.point(size / 2, size / 2),
    popupAnchor: L.point(0, -size / 2),
  });
}

export function createSiteAggregateMarkerHtml(aggregate: AggregateMarker, size = 26): string {
  const countLabel = aggregate.sample_count_total > 99 ? '99+' : String(aggregate.sample_count_total);
  return (
    `<div aria-label="Site aggregate marker for ${escapeHtml(aggregate.label)}" ` +
    `style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;` +
    `transform:rotate(45deg);border:2px dashed #0f766e;background:#fef3c7;` +
    `box-shadow:0 1px 4px rgba(15,23,42,0.35);">` +
    `<span style="transform:rotate(-45deg);font:700 9px system-ui,sans-serif;color:#0f172a;">${countLabel}</span>` +
    `</div>`
  );
}

function createSiteAggregatePopupContent(aggregate: AggregateMarker): string {
  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif;">
      <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:700;color:#0f172a;">
        ${escapeHtml(aggregate.label)}
      </h3>
      <p style="margin:0 0 6px 0;font-size:12px;color:#475569;">
        Site aggregate marker -- not a sample position.
      </p>
      <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 8px;font-size:12px;color:#334155;">
        <dt>Total samples</dt><dd style="margin:0;font-weight:700;">${aggregate.sample_count_total}</dd>
        <dt>Surveyed tier</dt><dd style="margin:0;">${aggregate.sample_count_high}</dd>
        <dt>Centroid tier</dt><dd style="margin:0;">${aggregate.sample_count_medium}</dd>
      </dl>
      <p style="margin:8px 0 0 0;font-size:11px;color:#64748b;">
        ${escapeHtml(COORD_TIER_CAPTION[aggregate.coordinate_quality_tier])}
      </p>
    </div>
  `;
}

function getMarkerColor(sample: MatrixSample): string {
  return CLASSIFICATION_COLOR[sample.classification];
}

// codex P2-2: Leaflet bindPopup renders content as HTML. Sample fields
// come from the ETL/RPC payload (matrix_map.fetch_samples_with_hidden_summary)
// and may carry user-entered station names, waterbody descriptions, or notes
// from upstream sources. Escape every interpolated string field before
// concatenation so a stray "<" or "&" never reaches the DOM as live markup.
function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createPopupContent(sample: MatrixSample): string {
  const classificationColor = CLASSIFICATION_COLOR[sample.classification];
  const tierLabel = COORD_TIER_LABEL[sample.coordinate_quality_tier];
  const tierCaption = COORD_TIER_CAPTION[sample.coordinate_quality_tier];
  const lat = sample.geometry.coordinates[1];
  const lng = sample.geometry.coordinates[0];

  const displayName = escapeHtml(sample.display_name);
  const stationId = escapeHtml(sample.station_id);
  const classification = escapeHtml(sample.classification);
  const classificationSource = escapeHtml(sample.classification_source);
  const waterbody = escapeHtml(sample.waterbody);
  const waterbodyType = escapeHtml(sample.waterbody_type);
  const bcRegion = escapeHtml(sample.bc_region);
  const confidenceLabel = sample.classification_confidence
    ? ', ' + escapeHtml(sample.classification_confidence) + ' confidence'
    : '';

  const waterbodyLine = sample.waterbody
    ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">${waterbody}${sample.waterbody_type ? ' (' + waterbodyType + ')' : ''}</p>`
    : '';
  const regionLine = sample.bc_region
    ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">${bcRegion}</p>`
    : '';

  return `
    <div style="min-width: 240px; font-family: system-ui, sans-serif;">
      <p style="font-weight: 800; color: #0f172a; margin-bottom: 6px; font-size: 16px;">${displayName}</p>
      <p style="font-size: 12px; color: #475569; margin: 0;">Station: ${stationId}</p>
      <p style="font-size: 12px; color: #475569; margin: 4px 0 0 0;">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
      ${waterbodyLine}
      ${regionLine}
      <div style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #e2e8f0;">
        <p style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">CLASSIFICATION</p>
        <div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
          <div style="width: 16px; height: 16px; border-radius: 50%; background: ${classificationColor};"></div>
          <div>
            <p style="font-weight: 700; color: #1e293b; text-transform: capitalize; margin: 0; font-size: 14px;">${classification}</p>
            <p style="font-size: 11px; color: #64748b; margin: 0;">Source: ${classificationSource}${confidenceLabel}</p>
          </div>
        </div>
      </div>
      <div style="margin-top: 8px;">
        <p style="font-size: 11px; color: #64748b;">Coordinate quality: <strong>${tierLabel}</strong></p>
        <p style="font-size: 10px; color: #94a3b8; margin: 2px 0 0; font-style: italic;">${tierCaption}</p>
      </div>
    </div>
  `;
}

export default MatrixMap;
