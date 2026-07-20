/**
 * Option C -- site-level aggregate computation (PURE, read-only).
 *
 * Design: docs/design/matrix-map/OPTION_C_SITE_AGGREGATE_DESIGN_2026-07-20.md
 *
 * WHY THIS EXISTS
 * The Matrix Map cannot publish one coordinate tier without the other: visibility is
 * DRA-granularity (RLS `samples_authenticated_select` gates on `d.public` /
 * `has_private_grant`), so a `flip_dra_public` exposes every sample beneath a DRA.
 * Rendering centroid samples as per-sample pins would place many coincident markers on a
 * single real coordinate, overstating both spatial precision AND sampling density. Option C
 * collapses each site to ONE aggregate marker instead.
 *
 * CONTAINMENT IS ENFORCED BY THE TYPE SIGNATURE, NOT BY CONVENTION.
 * `AggregateInputSample` deliberately has NO `id`, NO `station_id`, NO `bnrrm_station_id`,
 * and NO measurement fields. This helper therefore *cannot* leak a per-sample identifier,
 * because it never receives one. Callers must project only the columns below. Widening this
 * input type is a security change and must be reviewed as one.
 *
 * ORACLE CONSTRAINT (design s6.3, and standing lesson
 * `feedback_bbox_scoped_private_aggregate_is_a_spatial_oracle`, codex P1 2026-06-23).
 * An aggregate over rows the caller cannot see is an information channel. This helper
 * groups over a FIXED, CALLER-INDEPENDENT unit -- the full site. It accepts no bbox, no
 * radius, and no filter predicate, so counts can never be narrowed by a caller to localise
 * hidden rows. Do not add such a parameter here or in any route that calls it.
 *
 * This module performs NO I/O and NO writes.
 */

/** Coordinate quality tiers as stored in `matrix_map.samples.coordinate_quality_tier`. */
export type CoordinateTier = 'high' | 'medium' | 'low';

/**
 * The ONLY sample fields this helper is permitted to see.
 * See the containment note above before adding a field.
 */
export interface AggregateInputSample {
  source_dra_id: string | null;
  coordinate_quality_tier: CoordinateTier;
  coordinate_source: string | null;
  latitude: number | null;
  longitude: number | null;
}

/** Minimal DRA metadata used for labelling. No visibility decisions are made from this. */
export interface AggregateInputDra {
  id: string;
  title: string | null;
  public: boolean;
}

/** One aggregate marker: a site, not a sample. */
export interface SiteAggregate {
  /** Stable key: `${source_dra_id}:${coordinate_cluster_id}`. */
  aggregate_id: string;
  source_dra_id: string;
  /** Deterministic function of the rounded representative coordinate. */
  coordinate_cluster_id: string;
  display_name: string;
  dra_public: boolean;
  representative_latitude: number;
  representative_longitude: number;
  /** Always the dominant tier of the cluster; for the centroid layer this is 'medium'. */
  coordinate_quality_tier: CoordinateTier;
  coordinate_source: string | null;
  sample_count_total: number;
  sample_count_high: number;
  sample_count_medium: number;
  sample_count_low: number;
  /** Distinct rounded coordinates collapsed into this cluster. 1 under current data. */
  distinct_point_count: number;
}

/**
 * Coordinate rounding precision for cluster identity, in decimal places.
 * 5 dp is ~1 m at BC latitudes. Design s5.1 flags the exact value as a decision to confirm;
 * it is fixed here so cluster ids are reproducible, and is NOT caller-supplied.
 */
export const COORDINATE_CLUSTER_PRECISION = 5;

/** Deterministic cluster id from a coordinate. Not caller-controllable. */
export function coordinateClusterId(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(COORDINATE_CLUSTER_PRECISION);
  const lon = longitude.toFixed(COORDINATE_CLUSTER_PRECISION);
  return `${lat},${lon}`;
}

function hasUsableCoordinate(
  s: AggregateInputSample
): s is AggregateInputSample & { latitude: number; longitude: number } {
  return (
    typeof s.latitude === 'number' &&
    Number.isFinite(s.latitude) &&
    typeof s.longitude === 'number' &&
    Number.isFinite(s.longitude)
  );
}

/** Options. Deliberately NOT a filter surface -- see the oracle note above. */
export interface ComputeSiteAggregatesOptions {
  /**
   * Restrict to a single tier (the centroid preview passes 'medium').
   * This is a FIXED server-side choice, never a caller-supplied predicate, and it does not
   * scope counts to a caller-chosen region.
   */
  tier?: CoordinateTier;
}

/**
 * Collapse samples into one aggregate per (source_dra_id, coordinate_cluster_id).
 *
 * Exclusions, all deliberate:
 * - orphans (`source_dra_id === null`) -- there is no DRA to attribute or ever publish them
 *   under, so they appear in no aggregate (design s7 criterion 4);
 * - samples whose DRA is absent from `dras`;
 * - samples without a usable finite coordinate, which cannot be placed on a map.
 *
 * Tier counts are computed over ALL samples in the unit. That is the one place this design
 * discloses anything about non-visible rows: an aggregate count, never row content.
 *
 * Deterministic: input order does not affect output. Results are sorted by
 * sample_count_total desc, then aggregate_id asc, so repeated runs are byte-identical.
 */
export function computeSiteAggregates(
  samples: readonly AggregateInputSample[],
  dras: readonly AggregateInputDra[],
  options: ComputeSiteAggregatesOptions = {}
): SiteAggregate[] {
  const draById = new Map(dras.map((d) => [d.id, d]));

  interface Acc {
    source_dra_id: string;
    cluster: string;
    lat: number;
    lon: number;
    total: number;
    high: number;
    medium: number;
    low: number;
    sources: Set<string>;
    tiers: Map<CoordinateTier, number>;
    points: Set<string>;
  }

  const acc = new Map<string, Acc>();

  for (const s of samples) {
    if (s.source_dra_id === null) continue;
    const dra = draById.get(s.source_dra_id);
    if (!dra) continue;
    if (options.tier !== undefined && s.coordinate_quality_tier !== options.tier) continue;
    if (!hasUsableCoordinate(s)) continue;

    const cluster = coordinateClusterId(s.latitude, s.longitude);
    const key = `${s.source_dra_id}:${cluster}`;

    let a = acc.get(key);
    if (!a) {
      a = {
        source_dra_id: s.source_dra_id,
        cluster,
        lat: Number(s.latitude.toFixed(COORDINATE_CLUSTER_PRECISION)),
        lon: Number(s.longitude.toFixed(COORDINATE_CLUSTER_PRECISION)),
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        sources: new Set<string>(),
        tiers: new Map<CoordinateTier, number>(),
        points: new Set<string>(),
      };
      acc.set(key, a);
    }

    a.total += 1;
    if (s.coordinate_quality_tier === 'high') a.high += 1;
    else if (s.coordinate_quality_tier === 'medium') a.medium += 1;
    else a.low += 1;

    a.tiers.set(s.coordinate_quality_tier, (a.tiers.get(s.coordinate_quality_tier) ?? 0) + 1);
    a.points.add(cluster);
    if (s.coordinate_source) a.sources.add(s.coordinate_source);
  }

  const out: SiteAggregate[] = [];
  for (const [key, a] of acc) {
    // Dominant tier, ties broken deterministically by severity order so the marker never
    // flips between runs on equal counts.
    let dominant: CoordinateTier = 'medium';
    let best = -1;
    for (const t of ['high', 'medium', 'low'] as const) {
      const n = a.tiers.get(t) ?? 0;
      if (n > best) {
        best = n;
        dominant = t;
      }
    }

    const dra = draById.get(a.source_dra_id);
    const sources = [...a.sources].sort();

    out.push({
      aggregate_id: key,
      source_dra_id: a.source_dra_id,
      coordinate_cluster_id: a.cluster,
      display_name: dra?.title ?? a.source_dra_id,
      dra_public: dra?.public ?? false,
      representative_latitude: a.lat,
      representative_longitude: a.lon,
      coordinate_quality_tier: dominant,
      // Multiple distinct sources within one site are reported explicitly rather than
      // silently picking one, so provenance is never misrepresented.
      coordinate_source: sources.length === 0 ? null : sources.length === 1 ? sources[0] : sources.join('; '),
      sample_count_total: a.total,
      sample_count_high: a.high,
      sample_count_medium: a.medium,
      sample_count_low: a.low,
      distinct_point_count: a.points.size,
    });
  }

  out.sort((x, y) =>
    y.sample_count_total !== x.sample_count_total
      ? y.sample_count_total - x.sample_count_total
      : x.aggregate_id.localeCompare(y.aggregate_id)
  );

  return out;
}

/** Roll-up shown in the preview summary panel. Derived only from aggregates. */
export interface SiteAggregateSummary {
  site_count: number;
  sample_count_total: number;
  sample_count_high: number;
  sample_count_medium: number;
  sample_count_low: number;
  distinct_point_count: number;
  max_samples_at_one_site: number;
  median_samples_per_site: number;
  /** Sites whose stacking would be most misleading if rendered as per-sample pins. */
  sites_with_100_plus: number;
  sites_with_single_sample: number;
}

export function summariseSiteAggregates(aggregates: readonly SiteAggregate[]): SiteAggregateSummary {
  const counts = aggregates.map((a) => a.sample_count_total).sort((a, b) => a - b);
  const n = counts.length;

  let median = 0;
  if (n > 0) {
    const mid = Math.floor(n / 2);
    median = n % 2 === 1 ? counts[mid] : (counts[mid - 1] + counts[mid]) / 2;
  }

  return {
    site_count: n,
    sample_count_total: aggregates.reduce((t, a) => t + a.sample_count_total, 0),
    sample_count_high: aggregates.reduce((t, a) => t + a.sample_count_high, 0),
    sample_count_medium: aggregates.reduce((t, a) => t + a.sample_count_medium, 0),
    sample_count_low: aggregates.reduce((t, a) => t + a.sample_count_low, 0),
    distinct_point_count: new Set(aggregates.map((a) => a.coordinate_cluster_id)).size,
    max_samples_at_one_site: n === 0 ? 0 : counts[n - 1],
    median_samples_per_site: median,
    sites_with_100_plus: aggregates.filter((a) => a.sample_count_total >= 100).length,
    sites_with_single_sample: aggregates.filter((a) => a.sample_count_total === 1).length,
  };
}
