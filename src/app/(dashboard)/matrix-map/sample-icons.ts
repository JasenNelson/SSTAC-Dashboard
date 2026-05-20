// =====================================================================
// Matrix Interactive Map -- sample icon builders (PR-MAP-3a)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3a-samples-symbology
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md section 3.2
//
// 9 visual states = 3 classifications x 3 coordinate-quality tiers.
//
// Why divIcon (not circleMarker / Marker with default icon):
//   - The 'impacted' classification renders as a triangle, which is NOT
//     a built-in Leaflet marker shape.
//   - Coordinate-tier outline rendering uses SVG `stroke-dasharray`,
//     which L.circleMarker does not expose via its public API.
//   - Keeping all 3 classifications on divIcon (rather than mixing
//     circleMarker + divIcon) keeps marker-creation logic uniform.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import type * as LeafletNS from 'leaflet';
import type {
  Classification,
  CoordinateQualityTier,
} from './types';

// ---------------------------------------------------------------------
// Color + stroke style constants (PR_MAP_3_PLAN section 3.2 table).
// ---------------------------------------------------------------------

export const CLASSIFICATION_COLOR: Record<Classification, string> = {
  reference: '#10b981', // emerald-500
  impacted: '#eab308', // yellow-500
  unknown: '#94a3b8', // slate-400
};

/**
 * SVG stroke-dasharray value per coordinate-quality tier. An empty
 * string maps to a solid stroke; tier `high` (surveyed) uses solid.
 */
export const TIER_DASHARRAY: Record<CoordinateQualityTier, string> = {
  high: '',
  medium: '5,3',
  low: '1,2',
};

/**
 * Human-readable label for the coordinate-quality tier outline. Used in
 * tooltips + legend (PR_MAP_3_PLAN section 3.2 R-11 tooltip text).
 */
export const TIER_LABEL: Record<CoordinateQualityTier, string> = {
  high: 'Coordinate from surveyed station (high precision).',
  medium:
    'Coordinate from BC Site Registry centroid (not surveyed).',
  low:
    'Coordinate is manually steward-filled (low precision).',
};

const ICON_SIZE = 20; // px square
const STROKE_WIDTH = 2;
const SVG_RADIUS = 7; // px; leaves 1.5px border on each side

// ---------------------------------------------------------------------
// SVG builder
// ---------------------------------------------------------------------

/**
 * Build the inner SVG markup for a sample marker. Pure function -- no
 * Leaflet dependency so it can be unit-tested independently in jsdom.
 *
 * - reference: filled circle, color = green, outline per tier.
 * - impacted: filled triangle (equilateral-ish), color = yellow,
 *   outline per tier.
 * - unknown: hollow circle (stroke-only), color = grey, outline per
 *   tier. fillOpacity=0.
 *
 * Outline stroke-dasharray is driven by TIER_DASHARRAY.
 */
export function buildSampleIconHtml(
  classification: Classification,
  tier: CoordinateQualityTier,
): string {
  const color = CLASSIFICATION_COLOR[classification];
  const dasharray = TIER_DASHARRAY[tier];
  const w = ICON_SIZE;
  const h = ICON_SIZE;
  const cx = w / 2;
  const cy = h / 2;
  const r = SVG_RADIUS;

  // Shared stroke attrs. Note: stroke-dasharray="" renders as no dash
  // array (solid stroke); browsers + SVG spec accept the empty string.
  const strokeAttrs =
    `stroke="${color}" stroke-width="${STROKE_WIDTH}" ` +
    `stroke-dasharray="${dasharray}" stroke-linejoin="round"`;

  let shape: string;
  if (classification === 'impacted') {
    // Equilateral-ish triangle pointing up, centered on (cx, cy).
    const top = `${cx},${cy - r}`;
    const bottomLeft = `${cx - r * 0.866},${cy + r / 2}`;
    const bottomRight = `${cx + r * 0.866},${cy + r / 2}`;
    shape =
      `<polygon points="${top} ${bottomLeft} ${bottomRight}" ` +
      `fill="${color}" fill-opacity="0.9" ${strokeAttrs} />`;
  } else if (classification === 'unknown') {
    // Hollow circle: stroke-only, no fill.
    shape =
      `<circle cx="${cx}" cy="${cy}" r="${r}" ` +
      `fill="${color}" fill-opacity="0" ${strokeAttrs} />`;
  } else {
    // reference: filled circle.
    shape =
      `<circle cx="${cx}" cy="${cy}" r="${r}" ` +
      `fill="${color}" fill-opacity="0.9" ${strokeAttrs} />`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" ` +
    `viewBox="0 0 ${w} ${h}" class="matrix-map-sample-svg" ` +
    `data-classification="${classification}" data-tier="${tier}">` +
    `${shape}` +
    `</svg>`
  );
}

/**
 * Build an L.divIcon for a sample marker with the right shape + outline
 * for the given (classification, coordinate-tier) pair. Requires a
 * leaflet module to be available (caller passes it in to avoid a static
 * import of leaflet, which touches `window` at module load).
 */
export function buildSampleDivIcon(
  L: typeof LeafletNS,
  classification: Classification,
  tier: CoordinateQualityTier,
): LeafletNS.DivIcon {
  const html = buildSampleIconHtml(classification, tier);
  return L.divIcon({
    html,
    className: 'matrix-map-sample-marker',
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
  });
}
