'use client';

// =====================================================================
// Matrix Interactive Map -- sample markers + cluster layer (PR-MAP-3a)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3a-samples-symbology
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md section 3.1 + 3.2
//
// Why this is a child component using `useMap()`:
//   - react-leaflet 5 has no first-class MarkerClusterGroup primitive,
//     so the plugin must run imperatively against the Leaflet map.
//   - `useMap()` gives us the live `L.Map` instance inside the
//     MapContainer subtree without ref-juggling or imperative-handle
//     gymnastics in the parent MatrixMap component.
//   - The component renders nothing in React's DOM tree; it only
//     wires up Leaflet layers via useEffect.
//
// Mirrors the BN-RRM SiteMap markerClusterGroup pattern
// (src/components/bn-rrm/map/SiteMap.tsx:343-365) for consistency.
//
// 3a scope:
//   - Render samples as divIcon markers (3 classifications x 3 tiers).
//   - Cluster via leaflet.markercluster (maxClusterRadius: 50).
//   - Tooltip on hover: "display_name (bnrrm_station_id)".
//   - Click handler is a no-op placeholder for PR-MAP-3b identify.
//
// NOT in 3a scope:
//   - identify-single popups (3b)
//   - selection state / blue-stroke selected style (PR-MAP-4)
//   - cluster-pie composition badge (deferred)
//
// Plain ASCII only. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import type * as LeafletNS from 'leaflet';

import type { MatrixSample } from './types';
import { buildSampleDivIcon } from './sample-icons';

interface SampleMarkersLayerProps {
  samples: MatrixSample[];
  /**
   * PR-MAP-3b: invoked when a sample marker is clicked. The parent
   * MatrixMap owns the identify state + popup-at-latlng (Q-4) so the
   * markers layer is free of identify-mode coupling.
   *
   * Optional so the 3a smoke test that mounts this layer without an
   * identify wiring continues to work (the no-op-handler shape was
   * the contract before 3b).
   */
  onSampleClick?: (
    sample: MatrixSample,
    latlng: { lat: number; lng: number },
  ) => void;
}

// Marker cluster group type. Cast through `unknown` because
// leaflet.markercluster augments the global `L` runtime but the
// `@types/leaflet.markercluster` declarations live on a side module
// that we intentionally do not statically import (it would pull leaflet
// at module load and break the vitest react-leaflet stub).
interface MarkerClusterGroup extends LeafletNS.FeatureGroup {
  clearLayers(): this;
  addLayer(layer: LeafletNS.Layer): this;
}

interface LeafletWithMarkerCluster {
  markerClusterGroup(options: Record<string, unknown>): MarkerClusterGroup;
}

export function SampleMarkersLayer({
  samples,
  onSampleClick,
}: SampleMarkersLayerProps) {
  const map = useMap();
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const leafletRef = useRef<typeof LeafletNS | null>(null);
  // Mirror onSampleClick into a ref so the populate effect does NOT
  // re-run (and clear/repopulate the cluster) every time the parent
  // re-renders with a fresh handler. Mirrors the runIdentifyRef pattern
  // in BN-RRM SiteMap -- the click handler closes over the ref, not the
  // direct prop value, so handler identity changes do not invalidate
  // marker layers.
  const onSampleClickRef = useRef(onSampleClick);
  useEffect(() => {
    onSampleClickRef.current = onSampleClick;
  }, [onSampleClick]);
  // Per codex PR-MAP-3a R1 P1.1: a `clusterReady` version state forces
  // the population effect below to rerun AFTER the async init effect
  // finishes assigning leafletRef + clusterRef. Without this, the
  // population effect runs once on mount with samples already set,
  // hits the early-return on null refs, and never rerenders -- so the
  // initial RPC payload's samples never populate the cluster.
  const [clusterReady, setClusterReady] = useState(0);

  // One-shot: dynamically import leaflet + leaflet.markercluster, then
  // mount the empty cluster group on the map. The `samples` effect
  // below repopulates the cluster on every change.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      // CSS side-effect imports for the cluster default styles. The
      // matching leaflet.css is loaded in MatrixMapLoader.tsx already.
      // @ts-expect-error -- CSS module typed by webpack at build time
      await import('leaflet.markercluster/dist/MarkerCluster.css');
      // @ts-expect-error -- CSS module typed by webpack at build time
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css');

      if (cancelled) return;

      leafletRef.current = L;
      const ext = L as unknown as LeafletWithMarkerCluster;
      const cluster = ext.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
      });

      clusterRef.current = cluster;
      map.addLayer(cluster);
      // Bump the version so the populate effect reruns with refs ready.
      setClusterReady((v) => v + 1);
    };

    init();

    return () => {
      cancelled = true;
      const cluster = clusterRef.current;
      if (cluster) {
        map.removeLayer(cluster);
        clusterRef.current = null;
      }
    };
  }, [map]);

  // Repopulate cluster contents whenever `samples` changes OR when the
  // async init finishes (clusterReady bump). The cluster group itself
  // is reused; only its children are swapped.
  useEffect(() => {
    const cluster = clusterRef.current;
    const L = leafletRef.current;
    if (!cluster || !L) return;

    cluster.clearLayers();

    for (const sample of samples) {
      const coords = sample.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const [lng, lat] = coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const icon = buildSampleDivIcon(
        L,
        sample.classification,
        sample.coordinate_quality_tier,
      );

      const marker = L.marker([lat, lng], { icon });

      const stationLabel = sample.bnrrm_station_id
        ? `${sample.display_name} (${sample.bnrrm_station_id})`
        : sample.display_name;
      marker.bindTooltip(stationLabel, { direction: 'top' });

      // PR-MAP-3b: bubble marker clicks up to the parent MatrixMap so
      // it can own identify state + the popup-at-latlng (Q-4). The
      // handler is read from a ref so click responsiveness survives
      // prop-identity churn in the parent.
      marker.on('click', (evt: LeafletNS.LeafletMouseEvent) => {
        const handler = onSampleClickRef.current;
        if (!handler) return;
        const latlng = evt?.latlng ?? { lat: lat, lng: lng };
        handler(sample, { lat: latlng.lat, lng: latlng.lng });
      });

      // Attach the sample id to the marker options so 3b can resolve a
      // click back to the underlying row.
      (marker.options as Record<string, unknown>).sampleId = sample.id;

      cluster.addLayer(marker);
    }
  }, [samples, clusterReady]);

  return null;
}
