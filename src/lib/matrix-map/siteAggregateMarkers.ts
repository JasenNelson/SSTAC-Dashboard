/**
 * Option C map layer -- pure derivation of Leaflet marker payloads from site aggregates.
 *
 * Design: docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md
 *
 * This module is the ONLY thing the client map component receives. It takes already-aggregated
 * `SiteAggregate` rows (which by construction carry no per-sample identifier -- see
 * siteAggregates.ts) and shapes them for rendering. It performs NO I/O.
 *
 * CONTAINMENT: `AggregateMarker` is an even narrower projection than `SiteAggregate`. It exposes
 * only what a map marker needs -- a position, a label, tier, counts, and the source DRA id for a
 * stable React key. It deliberately carries no field that `SiteAggregate` did not already have,
 * and the aggregate itself already excludes sample ids, station ids, and measurements. So no
 * per-sample data can reach the map, because none reaches this helper.
 *
 * LEAFLET COORDINATE ORDER: Leaflet uses [lat, lng]. `position` is emitted in that order so the
 * client can spread it directly into a marker without re-ordering (a classic lat/lng swap bug).
 */
import type { SiteAggregate, CoordinateTier } from './siteAggregates';

export interface AggregateMarker {
  /** Stable React key. Same value as the aggregate's `aggregate_id`. */
  key: string;
  source_dra_id: string;
  /** Leaflet order: [latitude, longitude]. */
  position: [number, number];
  label: string;
  coordinate_quality_tier: CoordinateTier;
  sample_count_total: number;
  sample_count_high: number;
  sample_count_medium: number;
  /**
   * Marker radius in px. Scales gently with sample count but is CLAMPED so it stays legible at
   * N=1 and does not read as spatial extent at N=476. This is a visual weight, not an area.
   */
  radius: number;
}

const MARKER_MIN_RADIUS = 5;
const MARKER_MAX_RADIUS = 14;

/**
 * Sqrt scaling clamped to [MIN, MAX]. Sqrt (not linear) so a 476-sample site is not ~476x the
 * visual weight of a 1-sample site -- that would imply an enormous contaminated area. The clamp
 * guarantees both extremes render legibly.
 */
export function markerRadiusForCount(count: number): number {
  if (!Number.isFinite(count) || count <= 1) return MARKER_MIN_RADIUS;
  const scaled = MARKER_MIN_RADIUS + Math.sqrt(count - 1) * 0.9;
  return Math.min(MARKER_MAX_RADIUS, Math.round(scaled * 10) / 10);
}

/**
 * Derive map markers from site aggregates. Aggregates without a finite representative coordinate
 * are skipped (they cannot be placed). Order is preserved from the input, which is already sorted
 * deterministically by `computeSiteAggregates`.
 */
export function toAggregateMarkers(aggregates: readonly SiteAggregate[]): AggregateMarker[] {
  const out: AggregateMarker[] = [];
  for (const a of aggregates) {
    if (
      typeof a.representative_latitude !== 'number' ||
      !Number.isFinite(a.representative_latitude) ||
      typeof a.representative_longitude !== 'number' ||
      !Number.isFinite(a.representative_longitude)
    ) {
      continue;
    }
    out.push({
      key: a.aggregate_id,
      source_dra_id: a.source_dra_id,
      position: [a.representative_latitude, a.representative_longitude],
      label: a.display_name,
      coordinate_quality_tier: a.coordinate_quality_tier,
      sample_count_total: a.sample_count_total,
      sample_count_high: a.sample_count_high,
      sample_count_medium: a.sample_count_medium,
      radius: markerRadiusForCount(a.sample_count_total),
    });
  }
  return out;
}

/** Latitude/longitude bounds covering all markers, for `fitBounds`. Null if none placeable. */
export interface MarkerBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function boundsForMarkers(markers: readonly AggregateMarker[]): MarkerBounds | null {
  if (markers.length === 0) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const m of markers) {
    const [lat, lng] = m.position;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return { south, west, north, east };
}
