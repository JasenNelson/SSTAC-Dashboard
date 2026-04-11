/**
 * SiteMap Component
 *
 * Interactive map with:
 * - Marker clustering for overlapping sites
 * - Multiple base layers (streets, satellite, topo)
 * - Clickable site list
 * - Map export functionality
 */

'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import type { SiteLocation, SiteAssessment, SiteData } from '@/types/bn-rrm/site-data';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import {
  MAP_ARTIFACT_KEYS,
  MAP_ARTIFACT_CATEGORIES,
  type MapArtifactKey,
} from '@/lib/bn-rrm/pack-types';
import {
  loadMapArtifact,
  clearMapArtifactCacheForPack,
} from '@/hooks/bn-rrm/usePackMapArtifact';
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  DEFAULT_ON_CATEGORIES,
  HEAVY_LAYERS,
  formatFeaturePopup,
  getStyleForKey,
  packHasMapArtifacts,
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
} from '@/lib/bn-rrm/map-overlay-helpers';
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
} from 'lucide-react';

interface SiteMapProps {
  className?: string;
  onSiteSelect?: (siteId: string) => void;
  initialCenter?: [number, number];
  initialZoom?: number;
}

// Layer definitions
const BASE_LAYERS = {
  streets: {
    name: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '© OpenTopoMap',
  },
  terrain: {
    name: 'Terrain',
    url: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    attribution: '© Stamen Design',
  },
};

const BC_WMS_URL = 'https://openmaps.gov.bc.ca/geo/pub/ows';
const BC_ATTR = '© Province of British Columbia';

interface OverlayDef {
  name: string;
  layer: string;
  color: string; // Legend swatch color
  category: 'protected' | 'aquatic' | 'ecology' | 'regulatory';
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
};

const OVERLAY_CATEGORIES: { key: string; label: string }[] = [
  { key: 'protected', label: 'Protected Areas & Habitat' },
  { key: 'aquatic', label: 'Aquatic Features' },
  { key: 'ecology', label: 'Ecosystem Classification' },
  { key: 'regulatory', label: 'Regulatory' },
];

export function SiteMap({
  className,
  onSiteSelect,
  initialCenter = [49.2827, -123.1207],
  initialZoom = 11,
}: SiteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tileLayerRef = useRef<any>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaflet, setLeaflet] = useState<any>(null);
  const [activeLayer, setActiveLayer] = useState<keyof typeof BASE_LAYERS>('streets');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlayLayersRef = useRef<Map<string, any>>(new Map());

  // Pack-supplied GeoJSON overlay state. SEPARATE from WMS overlayLayersRef so
  // the two systems never collide on layer keys.
  const [activeGeoCategories, setActiveGeoCategories] = useState<Set<string>>(
    () => new Set(DEFAULT_ON_CATEGORIES),
  );
  const [loadingGeoKeys, setLoadingGeoKeys] = useState<Set<MapArtifactKey>>(
    () => new Set(),
  );
  // Map of MapArtifactKey -> Leaflet layer (untyped Leaflet API)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geojsonOverlayLayersRef = useRef<Map<MapArtifactKey, any>>(new Map());
  // Track basins fitBounds so we only auto-fit once per pack switch
  const basinsFittedForPackRef = useRef<string | null>(null);

  const packManifest = usePackStore((s) => s.packManifest);
  const selectedPackId = usePackStore((s) => s.selectedPackId);
  const getPackBaseUrl = usePackStore((s) => s.getPackBaseUrl);
  const hasMapArtifacts = useMemo(
    () => packHasMapArtifacts(packManifest?.artifacts ?? null),
    [packManifest],
  );
  const [siteListExpanded, setSiteListExpanded] = useState(true);
  const [interactionMode, setInteractionMode] = useState<'pan' | 'select-individual' | 'select-area'>('pan');
  const interactionModeRef = useRef(interactionMode);
  interactionModeRef.current = interactionMode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areaSelectRectRef = useRef<any>(null);

  const sites = useSiteDataStore((state) => state.sites);
  const assessments = useSiteDataStore((state) => state.assessments);
  const selectedSiteId = useSiteDataStore((state) => state.selectedSiteId);
  const selectedSiteIds = useSiteDataStore((state) => state.selectedSiteIds);
  const selectSite = useSiteDataStore((state) => state.selectSite);
  const toggleSiteSelection = useSiteDataStore((state) => state.toggleSiteSelection);
  const selectAllSites = useSiteDataStore((state) => state.selectAllSites);
  const clearSiteSelection = useSiteDataStore((state) => state.clearSiteSelection);

  const siteLocations = useMemo(() => {
    return Object.values(sites)
      .filter((site): site is SiteData => {
        return site != null &&
               site.location != null &&
               typeof site.location.id === 'string' &&
               typeof site.location.latitude === 'number' &&
               typeof site.location.longitude === 'number' &&
               !isNaN(site.location.latitude) &&
               !isNaN(site.location.longitude);
      })
      .map((site) => ({
        location: site.location,
        assessment: assessments[site.location.id],
      }));
  }, [sites, assessments]);

  const siteCount = siteLocations.length;

  // Initialize map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      const L = (await import('leaflet')).default;
      // @ts-expect-error CSS imports handled by webpack
      await import('leaflet/dist/leaflet.css');

      // Import marker cluster
      await import('leaflet.markercluster');
      // @ts-expect-error CSS imports handled by webpack
      await import('leaflet.markercluster/dist/MarkerCluster.css');
      // @ts-expect-error CSS imports handled by webpack
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css');

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markers = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let size = 'small';
          if (count > 10) size = 'medium';
          if (count > 25) size = 'large';

          return L.divIcon({
            html: `<div class="cluster-marker cluster-${size}">
              <span>${count}</span>
            </div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(40, 40),
          });
        },
      });

      // Ctrl+click on a cluster selects all its child markers
      markers.on('clusterclick', (e: { layer?: { getAllChildMarkers?: () => { options?: { locationId?: string } }[] }; originalEvent?: MouseEvent }) => {
        const orig = e.originalEvent;
        if (orig?.ctrlKey || orig?.metaKey) {
          orig.preventDefault();
          orig.stopPropagation();
          const children = e.layer?.getAllChildMarkers?.() ?? [];
          const childIds = children
            .map((m: { options?: { locationId?: string } }) => m.options?.locationId)
            .filter((id): id is string => !!id);
          if (childIds.length > 0) {
            // Add all cluster children to the current selection
            const current = useSiteDataStore.getState().selectedSiteIds;
            const merged = [...new Set([...current, ...childIds])];
            useSiteDataStore.getState().selectMultipleSites(merged);
          }
        }
        // Without Ctrl, default zoom behavior applies
      });

      map.addLayer(markers);
      markersLayerRef.current = markers;

      mapInstanceRef.current = map;
      setIsLoaded(true);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        tileLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toggleGeoCategory = useCallback((category: string) => {
    setActiveGeoCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Pack switch cleanup: drop all GeoJSON layers from the map and clear the
  // ref Map so we never leak Leaflet layers across pack switches. Also clear
  // the module-level fetch cache for the prior pack base URL.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = geojsonOverlayLayersRef.current;
    if (map) {
      for (const [, layer] of layers.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.removeLayer(layer as any);
      }
    }
    layers.clear();
    basinsFittedForPackRef.current = null;
    // Drop module cache for the OLD pack so a re-select forces a fresh fetch.
    // We do not know the old base URL here without tracking it; clearing all
    // is acceptable since this only fires on pack change.
    clearMapArtifactCacheForPack(null);
    // Reset toggles to default-on for the new pack
    setActiveGeoCategories(new Set(DEFAULT_ON_CATEGORIES));
    setLoadingGeoKeys(new Set());
  }, [selectedPackId]);

  // Manage pack-supplied GeoJSON overlays. Mirrors the WMS effect but uses a
  // SEPARATE ref store and lazy-fetches per category toggle. Heavy layers are
  // gated behind their category being active.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !leaflet || !packManifest || !selectedPackId) return;
    if (packManifest.pack_id !== selectedPackId) return;
    const mapBlock = packManifest.artifacts.map;
    if (!mapBlock) return;
    const baseUrl = getPackBaseUrl();
    if (!baseUrl) return;

    const L = leaflet;
    const layers = geojsonOverlayLayersRef.current;
    let cancelled = false;

    // Determine which keys should currently be present
    const desiredKeys = new Set<MapArtifactKey>();
    for (const key of MAP_ARTIFACT_KEYS) {
      const relPath = mapBlock[key];
      if (!relPath) continue;
      const cat = MAP_ARTIFACT_CATEGORIES[key];
      if (!activeGeoCategories.has(cat)) continue;
      // Heavy layers only load once their category is active (already implied
      // by the activeGeoCategories check above). The HEAVY_LAYERS set is kept
      // for documentation and possible future deferral within an active cat.
      desiredKeys.add(key);
    }

    // Remove layers no longer desired
    for (const [key, layer] of Array.from(layers.entries())) {
      if (!desiredKeys.has(key)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.removeLayer(layer as any);
        layers.delete(key);
      }
    }

    // Add newly desired layers
    for (const key of desiredKeys) {
      if (layers.has(key)) continue;
      const relPath = mapBlock[key];
      if (!relPath) continue;
      const isHeavy = HEAVY_LAYERS.has(key);
      // Mark loading so the toggle can show a spinner
      setLoadingGeoKeys((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });

      loadMapArtifact(baseUrl, relPath, key)
        .then((data: GeoJsonFeatureCollection | null) => {
          if (cancelled) return;
          // Pack may have switched while we were fetching
          const currentManifest = usePackStore.getState().packManifest;
          if (
            !currentManifest ||
            currentManifest.pack_id !== selectedPackId ||
            usePackStore.getState().selectedPackId !== selectedPackId
          ) {
            return;
          }
          if (!data || !Array.isArray(data.features)) {
            // Graceful skip on 404 or malformed payload
            console.warn(
              `[SiteMap] Skipping map layer ${key}: artifact not loadable`,
            );
            return;
          }
          const style = getStyleForKey(key);
          // Leaflet's GeoJSON API is largely untyped at our import path.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const geoLayer = L.geoJSON(data as any, {
            style: () => ({
              color: style.color,
              weight: style.strokeWeight,
              opacity: style.strokeOpacity,
              fillColor: style.color,
              fillOpacity: style.fillOpacity,
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            pointToLayer: (_feature: GeoJsonFeature, latlng: any) => {
              return L.circleMarker(latlng, {
                radius: style.pointRadius,
                fillColor: style.color,
                color: 'white',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9,
              });
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onEachFeature: (feature: GeoJsonFeature, layer: any) => {
              try {
                const html = formatFeaturePopup(key, feature);
                layer.bindPopup(html, { maxWidth: 320 });
              } catch (err) {
                console.warn(`[SiteMap] popup formatter failed for ${key}`, err);
              }
            },
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (geoLayer as any).addTo(map);
          layers.set(key, geoLayer);

          // Auto-fit to basins_gsl bounds once per pack
          if (
            key === 'basins_gsl' &&
            basinsFittedForPackRef.current !== selectedPackId
          ) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const bounds = (geoLayer as any).getBounds?.();
              if (bounds && bounds.isValid && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [40, 40] });
                basinsFittedForPackRef.current = selectedPackId;
              }
            } catch (err) {
              console.warn('[SiteMap] basins fitBounds failed', err);
            }
          }

          // Heavy layer log for observability (avoid lint warning on isHeavy)
          if (isHeavy) {
            console.debug(`[SiteMap] heavy layer ${key} loaded`);
          }
        })
        .finally(() => {
          if (cancelled) return;
          setLoadingGeoKeys((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeGeoCategories,
    leaflet,
    packManifest,
    selectedPackId,
    getPackBaseUrl,
  ]);

  // Track individual markers by location ID so selection updates don't destroy cluster/spiderfy state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerMapRef = useRef<Map<string, any>>(new Map());

  // Create/recreate markers only when the site list or assessments change
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !leaflet || !markersLayerRef.current) return;

    const L = leaflet;
    const markersLayer = markersLayerRef.current;

    markersLayer.clearLayers();
    markerMapRef.current.clear();

    siteLocations.forEach(({ location, assessment }) => {
      const color = getMarkerColor(assessment);
      const isCentroid = location.spatialClass === 'SITE_CENTROID';

      const marker = L.circleMarker([location.latitude, location.longitude], {
        radius: isCentroid ? 14 : 12,
        fillColor: color,
        color: 'white',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        dashArray: isCentroid ? '4 3' : undefined,
        locationId: location.id, // Custom option — read by cluster click handler
      });

      marker.bindPopup(createPopupContent(location, assessment), { maxWidth: 280 });
      marker.on('click', (e: { originalEvent?: MouseEvent; sourceTarget?: unknown; ctrlKey?: boolean; metaKey?: boolean }) => {
        const orig = e.originalEvent;
        const ctrlHeld = orig?.ctrlKey || orig?.metaKey || e.ctrlKey || e.metaKey;
        // In select-individual mode, every click toggles selection (no Ctrl needed)
        if (ctrlHeld || interactionModeRef.current === 'select-individual') {
          toggleSiteSelection(location.id);
        } else {
          selectSite(location.id);
          onSiteSelect?.(location.id);
        }
      });

      markerMapRef.current.set(location.id, marker);
      markersLayer.addLayer(marker);
    });
  }, [siteLocations, isLoaded, leaflet, onSiteSelect, selectSite, toggleSiteSelection]);

  // Update marker styles when selection changes — without clearing/recreating layers
  useEffect(() => {
    if (!isLoaded || !leaflet) return;

    markerMapRef.current.forEach((marker, locationId) => {
      const site = siteLocations.find(s => s.location.id === locationId);
      if (!site) return;
      const { location } = site;
      const isSelected = selectedSiteIds.includes(locationId) || selectedSiteId === locationId;
      const isCentroid = location.spatialClass === 'SITE_CENTROID';

      const borderColor = isSelected
        ? '#3b82f6'
        : location.sourceTag === 'training'
          ? '#a855f7'
          : location.sourceTag === 'comparison'
            ? '#14b8a6'
            : 'white';

      marker.setStyle({
        radius: isSelected ? 16 : isCentroid ? 14 : 12,
        color: borderColor,
        weight: isSelected ? 4 : 3,
      });
    });
  }, [selectedSiteId, selectedSiteIds, siteLocations, isLoaded, leaflet]);

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
          [startLatLng, e.latlng],
          { color: '#3b82f6', weight: 2, fillOpacity: 0.15, dashArray: '6 3' },
        ).addTo(map);
      };

      const onMouseUp = (e: { latlng: { lat: number; lng: number } }) => {
        if (!startLatLng) return;
        const bounds = leaflet.latLngBounds(startLatLng, e.latlng);

        // Find all sites within the rectangle
        const insideIds = siteLocations
          .filter(({ location }) => bounds.contains(leaflet.latLng(location.latitude, location.longitude)))
          .map(({ location }) => location.id);

        if (insideIds.length > 0) {
          const current = useSiteDataStore.getState().selectedSiteIds;
          const merged = [...new Set([...current, ...insideIds])];
          useSiteDataStore.getState().selectMultipleSites(merged);
        }

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
  }, [interactionMode, isLoaded, leaflet, siteLocations]);

  // Fit to sites on first load
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !leaflet || siteCount === 0) return;

    const bounds = leaflet.latLngBounds(
      siteLocations.map(({ location }) => [location.latitude, location.longitude])
    );
    mapInstanceRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCount, isLoaded, leaflet]);

  // Pan to site function
  const panToSite = useCallback((siteId: string) => {
    const site = siteLocations.find(s => s.location.id === siteId);
    if (!site || !mapInstanceRef.current) return;

    selectSite(siteId);
    mapInstanceRef.current.setView(
      [site.location.latitude, site.location.longitude],
      14,
      { animate: true }
    );
  }, [siteLocations, selectSite]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  const handleFitToSites = useCallback(() => {
    if (!mapInstanceRef.current || !leaflet || siteLocations.length === 0) return;
    const bounds = leaflet.latLngBounds(
      siteLocations.map(({ location }) => [location.latitude, location.longitude])
    );
    mapInstanceRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 13 });
  }, [leaflet, siteLocations]);

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
      link.download = `openpra-map-${new Date().toISOString().split('T')[0]}.png`;
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
          aria-label="Fit to sites"
          onClick={handleFitToSites}
          className={cn("p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700", siteCount > 0 ? "hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600" : "opacity-50 cursor-not-allowed")}
          disabled={siteCount === 0}
          title="Fit to sites"
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

              {/* Pack-supplied Jermilova study area overlays */}
              {hasMapArtifacts && (
                <div>
                  <div className="border-t border-slate-200 dark:border-slate-700 mt-1" />
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Jermilova Study Area</p>
                  {ALL_CATEGORIES.map((cat) => {
                    // Skip categories with no defined keys in this pack
                    const mapBlock = packManifest?.artifacts?.map;
                    if (!mapBlock) return null;
                    const keysInCat = MAP_ARTIFACT_KEYS.filter(
                      (k) => MAP_ARTIFACT_CATEGORIES[k] === cat && !!mapBlock[k],
                    );
                    if (keysInCat.length === 0) return null;
                    const isActive = activeGeoCategories.has(cat);
                    const anyLoading = keysInCat.some((k) => loadingGeoKeys.has(k));
                    const swatch = CATEGORY_STYLES[cat]?.color ?? '#64748b';
                    return (
                      <button
                        key={`geo-${cat}`}
                        onClick={() => toggleGeoCategory(cat)}
                        className={cn(
                          'w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2',
                          isActive && 'bg-blue-50 dark:bg-blue-900/20',
                        )}
                        aria-pressed={isActive}
                        aria-label={`Toggle ${CATEGORY_LABELS[cat] ?? cat}`}
                      >
                        <div className={cn(
                          'w-3 h-3 rounded-sm border-2 transition-colors',
                          isActive
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-slate-300 dark:border-slate-600',
                        )} />
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: swatch, opacity: 0.8 }} />
                        <span className="truncate flex-1">{CATEGORY_LABELS[cat] ?? cat}</span>
                        {anyLoading && (
                          <div
                            className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin flex-shrink-0"
                            aria-label="Loading"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

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
          title="Pan mode — drag to move map"
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
          title="Select mode — click markers, Ctrl+click clusters"
        >
          <MousePointer className="w-4 h-4" />
          <span className="hidden sm:inline">Select</span>
        </button>
        <button
          onClick={() => setInteractionMode('select-area')}
          className={cn(
            'p-2 flex items-center gap-1.5 text-xs font-medium transition-colors',
            interactionMode === 'select-area'
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700',
          )}
          title="Area select — drag rectangle to select markers"
        >
          <BoxSelect className="w-4 h-4" />
          <span className="hidden sm:inline">Area</span>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg p-3 border border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Impact Level</p>
        <div className="space-y-2">
          <LegendItem color="#22c55e" label="None / Not assessed" />
          <LegendItem color="#eab308" label="Minor" />
          <LegendItem color="#f97316" label="Moderate" />
          <LegendItem color="#ef4444" label="Severe" />
        </div>
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
          <LegendItem color="#a855f7" label="Training site" />
          <LegendItem color="#14b8a6" label="Comparison site" />
        </div>
      </div>

      {/* Site count header */}
      <div className="absolute top-4 left-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-3 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{siteCount}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{siteCount === 1 ? 'Site' : 'Sites'} loaded</p>
          </div>
        </div>
      </div>

      {/* Clickable Site List */}
      {siteCount > 0 && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 w-64">
          <button
            aria-label={siteListExpanded ? "Collapse site list" : "Expand site list"}
            aria-expanded={siteListExpanded}
            onClick={() => setSiteListExpanded(!siteListExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Site Locations</span>
            {siteListExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
          </button>

          {siteListExpanded && (
            <>
              {/* Multi-select controls */}
              <div className="px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedSiteIds.length > 0 ? `${selectedSiteIds.length} selected` : 'Ctrl+click for multi-select'}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={selectAllSites}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 px-1"
                  >
                    All
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    onClick={clearSiteSelection}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 px-1"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {siteLocations.map(({ location, assessment }) => {
                  const isSelected = selectedSiteIds.includes(location.id) || selectedSiteId === location.id;
                  return (
                    <button
                      key={location.id}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          toggleSiteSelection(location.id);
                        } else {
                          panToSite(location.id);
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
                        style={{ backgroundColor: getMarkerColor(assessment) }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium truncate", isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300")}>
                          {location.sourceTag === 'training' && <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mr-1">[T]</span>}
                          {location.sourceTag === 'comparison' && <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 mr-1">[C]</span>}
                          {location.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                          {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
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

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 rounded-full border-2 border-white shadow" style={{ backgroundColor: color }} />
      <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
    </div>
  );
}

function getMarkerColor(assessment?: SiteAssessment): string {
  if (!assessment) return '#22c55e';
  switch (assessment.mostLikelyImpact) {
    case 'none': return '#22c55e';
    case 'minor': return '#eab308';
    case 'moderate': return '#f97316';
    case 'severe': return '#ef4444';
    default: return '#94a3b8';
  }
}

function createPopupContent(location: SiteLocation, assessment?: SiteAssessment): string {
  const impactHtml = assessment
    ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 2px solid #e2e8f0;">
        <p style="font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 600;">RISK ASSESSMENT</p>
        <div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
          <div style="width: 16px; height: 16px; border-radius: 50%; background: ${getMarkerColor(assessment)};"></div>
          <div>
            <p style="font-weight: 700; color: #1e293b; text-transform: capitalize; margin: 0; font-size: 14px;">${assessment.mostLikelyImpact}</p>
            <p style="font-size: 11px; color: #64748b; margin: 0;">${(assessment.impactProbabilities[assessment.mostLikelyImpact] * 100).toFixed(0)}% probability</p>
          </div>
        </div>
      </div>`
    : `<div style="margin-top: 12px; padding: 10px; background: #fef3c7; border-radius: 8px;">
        <p style="font-size: 12px; color: #92400e; margin: 0; font-weight: 500;">Not yet assessed</p>
      </div>`;

  return `
    <div style="min-width: 200px; font-family: system-ui, sans-serif;">
      <p style="font-weight: 800; color: #0f172a; margin-bottom: 8px; font-size: 16px;">${location.name}</p>
      <p style="font-size: 12px; color: #475569; margin: 0;">${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</p>
      ${location.region ? `<p style="font-size: 12px; color: #64748b; margin: 4px 0 0 0;">${location.region}</p>` : ''}
      ${impactHtml}
    </div>
  `;
}

export default SiteMap;
