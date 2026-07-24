// =====================================================================
// Matrix Interactive Map -- shared TS types (PR-MAP-3a)
// =====================================================================
//
// Lane:   Matrix Interactive Map
// Branch: feat/matrix-map-pr-map-3a-samples-symbology
// Plan:   docs/design/matrix-map/PR_MAP_3_PLAN.md sections 2 + 5 + 6
//
// Contract source: the SECURITY DEFINER RPC
//   matrix_map.fetch_samples_with_hidden_summary({})
// returns the MatrixMapData JSON payload below. The RPC migration is
// authored in parallel under the same PR-MAP-3a sub-PR by a separate
// subagent; this file is the canonical client-side mirror of that
// contract per PR_MAP_3_PLAN section 2.2 + 5.2.
//
// Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
// Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
// =====================================================================

import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';

/**
 * Geometry-tier coordinate quality. Drives the marker outline style:
 *   high   -> solid stroke (surveyed)
 *   medium -> dashed stroke (BC CSR centroid)
 *   low    -> dotted stroke (manual steward fill)
 *
 * See PR_MAP_3_PLAN section 3.2.
 */
export type CoordinateQualityTier = 'high' | 'medium' | 'low';

/**
 * Sample classification tier. Drives the marker shape + fill color:
 *   reference -> filled green circle (#10b981)
 *   impacted  -> filled yellow triangle (#eab308)
 *   unknown   -> hollow grey circle (#94a3b8)
 *
 * See PR_MAP_3_PLAN section 3.2.
 */
export type Classification = 'reference' | 'impacted' | 'unknown';

/**
 * Origin of the classification. Surfaced in the sample-identify panel
 * (PR-MAP-3b); not used for symbology in 3a. Open-ended enum to mirror
 * the DB column; current canonical values per
 * supabase/migrations/20260519000001_matrix_map_schema.sql:
 *   'station_type' | 'steward' | 'data_unknown' | 'bkgd_groundwater'
 */
export type ClassificationSource =
  | 'station_type'
  | 'steward'
  | 'data_unknown'
  | 'bkgd_groundwater';

/**
 * Confidence label attached to a classification. Nullable in the DB; the
 * UI renders 'not set' when null. Used in 3b identify panel, NOT in 3a
 * symbology.
 */
export type ClassificationConfidence = 'high' | 'medium' | 'low';

/**
 * GeoJSON point geometry. The RPC body uses
 *   ST_AsGeoJSON(geometry::geometry)::jsonb
 * so the wire shape is the standard GeoJSON Point object.
 */
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

/**
 * Single visible sample row. Mirrors the RPC contract's visible_samples
 * array element shape from PR_MAP_3_PLAN section 2.4 + the RPC contract
 * declared in this PR's task brief.
 *
 * Optional / nullable fields are typed explicitly via `| null` to match
 * the DB nullability + the JSON-from-Postgres `null` literal. Strict
 * TypeScript catches missing-fallback bugs at compile time.
 */
export interface MatrixSample {
  id: string;
  // Per codex PR-MAP-3a R1 P2 contract-drift fix: aligned with the
  // matrix_map.samples DDL (PR-MAP-1 schema migration). Fields below
  // marked NOT NULL in the DB are non-nullable in TS; only the truly
  // nullable columns retain `| null`.
  bnrrm_station_id: number;          // integer NOT NULL UNIQUE
  station_id: string;                // text NOT NULL
  display_name: string;              // text NOT NULL
  geometry: GeoJsonPoint;            // geography(Point, 4326) NOT NULL
  coordinate_quality_tier: CoordinateQualityTier;  // text NOT NULL + CHECK
  coordinate_source: string;         // text NOT NULL
  classification: Classification;    // text NOT NULL + CHECK
  classification_source: ClassificationSource;     // text NOT NULL + CHECK
  classification_rationale: string | null;         // text (nullable)
  classification_confidence: ClassificationConfidence | null;  // text (nullable)
  source_dra_id: string | null;      // uuid (nullable; samples without DRA provenance)
  public: boolean;                   // boolean NOT NULL DEFAULT false
  bc_region: string | null;          // text (nullable)
  waterbody: string | null;          // text (nullable)
  waterbody_type: string | null;     // text (nullable)
}

/**
 * Full RPC return payload. The RPC body computes BOTH the visible rows
 * (under the same RLS predicate the front-end would see) AND the
 * hidden-sample aggregate counts (which RLS would otherwise hide) inside
 * a single SECURITY DEFINER body. Counts are province-wide for v1 per
 * PR_MAP_3_PLAN section 2.3 (bbox is a future v1.x param).
 *
 * Per PR_MAP_3_PLAN section 5.2 + grants v2.3 D-1: hidden_dra_ids
 * contains opaque UUIDs ONLY. No titles / citations / agencies for
 * hidden DRAs are EVER projected -- that would leak metadata about
 * content the user has no grant for.
 */
export interface MatrixMapData {
  visible_samples: MatrixSample[];
  hidden_sample_count: number;
  hidden_dra_count: number;
  hidden_dra_ids: string[];
  data_snapshot_version: string;
  // bbox-lane Stage 1 (migration 20260623000001): additive + OPTIONAL so the
  // pre-migration RPC (which omits them) + the empty fallback stay valid.
  // total_in_bbox = visible-eligible samples in the current scope BEFORE the
  // server-side cap; returned_sample_count = min(total_in_bbox, cap);
  // truncated = total_in_bbox > cap (client should prompt "zoom in"); bbox_applied
  // = whether a valid viewport bbox was used (false => province-wide).
  total_in_bbox?: number;
  returned_sample_count?: number;
  truncated?: boolean;
  bbox_applied?: boolean;
}

/**
 * Empty fallback used when the RPC fetch fails (e.g. before the RPC
 * migration deploys, or transient supabase outage). Pinned as a const
 * so consumers don't accidentally mutate it.
 */
export const EMPTY_MATRIX_MAP_DATA: MatrixMapData = {
  visible_samples: [],
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'unavailable',
};

/**
 * Option C member-map aggregate payload. This is deliberately separate from
 * MatrixSample so aggregate markers cannot be mistaken for selectable sample
 * rows and cannot flow into sample export paths.
 */
export interface MatrixSiteAggregateData {
  site_aggregate_markers: AggregateMarker[];
  site_count: number;
  sample_count_total: number;
  data_snapshot_version: string;
}

export const EMPTY_MATRIX_SITE_AGGREGATE_DATA: MatrixSiteAggregateData = {
  site_aggregate_markers: [],
  site_count: 0,
  sample_count_total: 0,
  data_snapshot_version: 'unavailable',
};
