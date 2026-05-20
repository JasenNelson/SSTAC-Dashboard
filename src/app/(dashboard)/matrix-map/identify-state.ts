// =====================================================================
// Matrix Interactive Map -- identify state model + pure helpers (PR-MAP-3b)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3b-identify
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md section 4 + 6
//
// This module is a "no React, no Leaflet imports" data + helper file.
// Components import the IdentifyState types from here so the discriminator
// shape is single-sourced. The only Leaflet coupling is the
// findSampleNearLatLng helper which takes a structural `L.Map`-shaped
// argument (we type it as `LeafletMapForHitTest` with just the one
// method we need so vitest stubs stay trivial).
//
// Per PR_MAP_3_PLAN section 4.1: identify routes through a single
// authoritative state shape with a `kind` discriminator:
//   - kind='sample' -- a sample marker was hit within 10px (Q-7).
//                      DRA detail is fetched on-demand (Q-2) and may be
//                      loading / loaded / errored.
//   - kind='overlay' -- click was on empty map; queryActiveOverlays
//                       returned >= 1 hit from the active WMS overlays.
//
// Closing the panel sets state to `null`. The transition is
// session-only (no persistence) per the broader matrix-map UX rule.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Per L0 CLAUDE.md section 1.1.
// =====================================================================

import type { IdentifiedFeature } from '@/lib/maps/wms-identify';

import type { MatrixSample } from './types';

// ---------------------------------------------------------------------
// On-demand DRA detail shape (Q-2)
// ---------------------------------------------------------------------

/**
 * Subset of `matrix_map.dras` projected by the on-demand identify
 * fetch. document_url + confidentiality_notes are the on-demand
 * additions over the bulk RPC payload (which does NOT project them
 * per PR_MAP_3_PLAN section 2.4). The other fields are mirrored so the
 * identify panel can render a self-contained DRA card without joining
 * back into the sample row at render time.
 */
export interface DraDetail {
  id: string;
  title: string | null;
  agency: string | null;
  year: number | null;
  site_id: string | null;
  citation: string | null;
  document_url: string | null;
  public: boolean;
  confidentiality_notes: string | null;
}

// ---------------------------------------------------------------------
// IdentifyState discriminator
// ---------------------------------------------------------------------

/**
 * Sample-identify state. Holds the hit row immediately + a loading
 * fence around the on-demand DRA fetch. The DRA fields evolve over
 * the lifetime of one identify click:
 *
 *   click -> { sample, dra: null, draLoading: true, draError: null }
 *   resolved -> { sample, dra: <DraDetail>, draLoading: false, draError: null }
 *   errored -> { sample, dra: null, draLoading: false, draError: <msg> }
 *
 * If sample.source_dra_id is null the fetch is skipped and the panel
 * shows "Source DRA: not recorded" (per PR_MAP_3_PLAN section 4.2).
 * In that case the state lands directly in the resolved-but-empty form
 * with draLoading=false + dra=null + draError=null.
 */
export interface IdentifySampleState {
  kind: 'sample';
  sample: MatrixSample;
  dra: DraDetail | null;
  draLoading: boolean;
  draError: string | null;
}

/**
 * Overlay-identify state. Holds the click latlng (so the panel header
 * can show the click coordinates) + the merged feature list from
 * queryActiveOverlays (already in topmost-first z-order per the
 * wms-identify contract).
 */
export interface IdentifyOverlayState {
  kind: 'overlay';
  latlng: { lat: number; lng: number };
  features: IdentifiedFeature[];
}

export type IdentifyState = IdentifySampleState | IdentifyOverlayState;

// ---------------------------------------------------------------------
// Sample-hit-test (Q-7 10px proximity)
// ---------------------------------------------------------------------

/**
 * Minimal structural Leaflet `L.Map` shape we need for the hit-test.
 * Mirrors the spirit of `LeafletMapLike` in wms-identify.ts but with a
 * narrower contract -- only latLngToContainerPoint is needed here.
 */
export interface LeafletMapForHitTest {
  latLngToContainerPoint: (latlng: { lat: number; lng: number }) => {
    x: number;
    y: number;
  };
}

/**
 * Return the closest sample to a click within `pxRadius` container
 * pixels, or null if no sample is within the radius. Distance is
 * Euclidean in container-pixel space, which matches the user's visual
 * notion of "near the click" regardless of zoom / projection.
 *
 * Pure function except for the Leaflet projection call (which is
 * referentially transparent for a given map state). Samples without a
 * valid geometry.coordinates pair are skipped.
 *
 * Q-7 default: pxRadius=10. BN-RRM uses an 8-pixel WMS buffer; we add
 * a small safety margin for sample markers because the divIcon visual
 * footprint extends a few pixels past the geometric centroid.
 */
export function findSampleNearLatLng(
  samples: MatrixSample[],
  lat: number,
  lng: number,
  pxRadius: number,
  map: LeafletMapForHitTest,
): MatrixSample | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(pxRadius) || pxRadius <= 0) return null;

  const clickPoint = map.latLngToContainerPoint({ lat, lng });
  const cx = clickPoint.x;
  const cy = clickPoint.y;
  const r2 = pxRadius * pxRadius;

  let bestSample: MatrixSample | null = null;
  let bestDistance2 = Number.POSITIVE_INFINITY;

  for (const sample of samples) {
    const coords = sample.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const sLng = coords[0];
    const sLat = coords[1];
    if (typeof sLat !== 'number' || typeof sLng !== 'number') continue;
    if (!Number.isFinite(sLat) || !Number.isFinite(sLng)) continue;

    const p = map.latLngToContainerPoint({ lat: sLat, lng: sLng });
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && d2 < bestDistance2) {
      bestDistance2 = d2;
      bestSample = sample;
    }
  }

  return bestSample;
}
