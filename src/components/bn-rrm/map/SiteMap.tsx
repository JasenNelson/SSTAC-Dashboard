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
  const [siteListExpanded, setSiteListExpanded] = useState(true);

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

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !isLoaded || !leaflet || !markersLayerRef.current) return;

    const L = leaflet;
    const markersLayer = markersLayerRef.current;

    markersLayer.clearLayers();

    siteLocations.forEach(({ location, assessment }) => {
      const color = getMarkerColor(assessment);
      const isSelected = selectedSiteIds.includes(location.id) || selectedSiteId === location.id;

      const isCentroid = location.spatialClass === 'SITE_CENTROID';
      const borderColor = isSelected
        ? '#3b82f6'
        : location.sourceTag === 'training'
          ? '#a855f7'
          : location.sourceTag === 'comparison'
            ? '#14b8a6'
            : 'white';

      const marker = L.circleMarker([location.latitude, location.longitude], {
        radius: isSelected ? 16 : isCentroid ? 14 : 12,
        fillColor: color,
        color: borderColor,
        weight: isSelected ? 4 : 3,
        opacity: 1,
        fillOpacity: 0.9,
        dashArray: isCentroid ? '4 3' : undefined,
      });

      marker.bindPopup(createPopupContent(location, assessment), { maxWidth: 280 });
      marker.on('click', (e: { originalEvent?: { ctrlKey?: boolean; metaKey?: boolean } }) => {
        const isMultiSelect = e.originalEvent?.ctrlKey || e.originalEvent?.metaKey;
        if (isMultiSelect) {
          toggleSiteSelection(location.id);
        } else {
          selectSite(location.id);
          onSiteSelect?.(location.id);
        }
      });

      markersLayer.addLayer(marker);
    });
  }, [siteLocations, selectedSiteId, selectedSiteIds, isLoaded, leaflet, onSiteSelect, selectSite, toggleSiteSelection]);

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
        <button onClick={handleZoomIn} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700" title="Zoom in">
          <ZoomIn className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <button onClick={handleZoomOut} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700" title="Zoom out">
          <ZoomOut className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
        <button
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
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
            title="Change map layer"
          >
            <Layers className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>

          {showLayerMenu && (
            <div className="absolute right-full mr-2 top-0 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[140px]">
              {Object.entries(BASE_LAYERS).map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => { setActiveLayer(key as keyof typeof BASE_LAYERS); setShowLayerMenu(false); }}
                  className={cn("w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700", activeLayer === key && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium")}
                >
                  {layer.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200 dark:bg-slate-600 my-1" />
        <button
          onClick={handleExportMap}
          className="p-2.5 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
          title="Export map image"
        >
          <Download className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
