'use client';

/**
 * Option C -- read-only Leaflet map of site-level centroid aggregates.
 *
 * Design: docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md
 *
 * CONTAINMENT: this client component receives ONLY `AggregateMarker[]` -- a projection that
 * carries no per-sample identifier, station id, or measurement (see siteAggregateMarkers.ts).
 * It renders one circle marker per SITE, never per sample, so 476 stacked samples appear as a
 * single marker labelled "476 samples" rather than 476 coincident pins. That is the whole point
 * of Option C: the misleading signal is marker geometry, and one-marker-per-site removes it by
 * construction.
 *
 * NO WRITES, NO PUBLICATION. This is a visualization of already-loaded aggregates. It performs
 * no I/O of its own.
 *
 * Leaflet is loaded imperatively via `await import('leaflet')` inside an effect, mirroring
 * MatrixMap.tsx, so it never runs during SSR or in jsdom. Markers use the centroid dash pattern
 * from the shared coordinate-provenance vocabulary.
 */
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { COORD_TIER_DASH_ARRAY, COORD_TIER_LABEL, COORD_TIER_CAPTION } from '@/lib/matrix-map/coordinate-provenance';
import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';
import { boundsForMarkers } from '@/lib/matrix-map/siteAggregateMarkers';

// BC-province default view, matching MatrixMap.tsx.
const INITIAL_CENTER: [number, number] = [54.7, -125.0];
const INITIAL_ZOOM = 5;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function popupHtml(m: AggregateMarker): string {
  const name = escapeHtml(m.label);
  const tier = escapeHtml(COORD_TIER_LABEL[m.coordinate_quality_tier]);
  const caption = escapeHtml(COORD_TIER_CAPTION[m.coordinate_quality_tier]);
  return [
    `<div style="min-width:200px">`,
    `<p style="margin:0;font-weight:600">${name}</p>`,
    `<p style="margin:4px 0 0;font-size:11px;color:#64748b">Tier: <strong>${tier}</strong></p>`,
    `<p style="margin:2px 0 0;font-size:11px;color:#64748b">${m.sample_count_total} samples at this site` +
      ` (${m.sample_count_high} surveyed, ${m.sample_count_medium} centroid)</p>`,
    `<p style="margin:6px 0 0;font-size:10px;font-style:italic;color:#94a3b8">${caption}</p>`,
    `</div>`,
  ].join('');
}

export interface SiteAggregateMapProps {
  markers: AggregateMarker[];
}

export function SiteAggregateMap({ markers }: SiteAggregateMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (typeof window === 'undefined' || !containerRef.current || mapRef.current) return;

    const init = async () => {
      try {
        const L = (await import('leaflet')).default;
        if (!isMounted || !containerRef.current || mapRef.current) return;

        const map = L.map(containerRef.current, {
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
        });
        mapRef.current = map;
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);

        for (const m of markers) {
          L.circleMarker(m.position, {
            radius: m.radius,
            fillColor: '#6366f1',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.85,
            // Centroid dash pattern from the shared vocabulary, so this layer speaks the same
            // visual language as the main map's coordinate-quality encoding.
            dashArray: COORD_TIER_DASH_ARRAY[m.coordinate_quality_tier],
          })
            .bindPopup(popupHtml(m), { maxWidth: 320 })
            .addTo(map);
        }

        const b = boundsForMarkers(markers);
        if (b) {
          map.fitBounds(
            [
              [b.south, b.west],
              [b.north, b.east],
            ],
            { padding: [40, 40], maxZoom: 12 }
          );
        }

        if (isMounted) setIsLoaded(true);
      } catch (err) {
        if (isMounted) setLoadError(err instanceof Error ? err.message : 'Failed to load map');
      }
    };

    void init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Markers are a stable server-derived snapshot for this page load; re-running on identity
    // change is unnecessary and would leak map instances. Intentionally run-once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div ref={containerRef} className="absolute inset-0 z-0" data-testid="site-aggregate-map-container" />

      {!isLoaded && !loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <span className="text-sm text-slate-500 dark:text-slate-400">Loading map...</span>
        </div>
      ) : null}

      {loadError ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-4 text-center dark:bg-slate-900">
          <span className="text-sm text-rose-700 dark:text-rose-300">Map failed to load: {loadError}</span>
        </div>
      ) : null}

      {/* Legend: one entry for this aggregate layer, in the same idiom as the main map legend. */}
      <div className="absolute bottom-4 left-4 z-[1000] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">Site aggregates</p>
        <div className="flex items-center gap-2">
          <svg width="20" height="14" aria-hidden="true">
            <circle
              cx="10"
              cy="7"
              r="5"
              fill="#6366f1"
              fillOpacity="0.85"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray={COORD_TIER_DASH_ARRAY.medium}
            />
          </svg>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {COORD_TIER_LABEL.medium} site (one marker per site; larger = more samples)
          </span>
        </div>
        <p className="mt-2 max-w-[220px] text-[10px] text-slate-500 dark:text-slate-400">
          Each marker is one approximate site location, not a sample position. Marker size is a
          rough weight, not an area.
        </p>
      </div>
    </div>
  );
}

export default SiteAggregateMap;
