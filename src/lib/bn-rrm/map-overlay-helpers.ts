/**
 * map-overlay-helpers
 *
 * Shared helpers for pack-supplied GeoJSON map overlays rendered by SiteMap.
 *
 * Provides:
 *   - Category color palette (per-category fill, stroke, point styling)
 *   - Per-MapArtifactKey popup HTML formatters
 *   - Lightweight GeoJSON Feature typings (we do not pull in @types/geojson)
 *   - Heavy-layer classification used by lazy-loading logic
 *
 * Plain ASCII only. No em dashes. No emoji.
 */

import type { MapArtifactKey } from './pack-types';
import { MAP_ARTIFACT_CATEGORIES } from './pack-types';

// ---------------------------------------------------------------------------
// Minimal GeoJSON typings (avoid pulling @types/geojson just for this)
// ---------------------------------------------------------------------------

export interface GeoJsonGeometry {
  type: string;
  // Coordinates can be deeply nested arrays of numbers; runtime code reads them
  // via Leaflet, not directly. Use unknown to avoid an `any` leak.
  coordinates: unknown;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry | null;
  properties: Record<string, unknown> | null;
  bbox?: number[];
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
  bbox?: number[];
}

// ---------------------------------------------------------------------------
// Category palette
// ---------------------------------------------------------------------------

export interface CategoryStyle {
  /** Hex color used for fills and circle markers */
  color: string;
  /** Polygon fill opacity */
  fillOpacity: number;
  /** Polygon stroke weight in pixels */
  strokeWeight: number;
  /** Polygon stroke opacity */
  strokeOpacity: number;
  /** Point radius for circleMarker (px) */
  pointRadius: number;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  basins: {
    color: '#3b82f6',
    fillOpacity: 0.15,
    strokeWeight: 2,
    strokeOpacity: 0.8,
    pointRadius: 6,
  },
  advisories: {
    color: '#dc2626',
    fillOpacity: 0.2,
    strokeWeight: 2,
    strokeOpacity: 0.9,
    pointRadius: 6,
  },
  fisheries: {
    color: '#0ea5e9',
    fillOpacity: 0.2,
    strokeWeight: 2,
    strokeOpacity: 0.9,
    pointRadius: 5,
  },
  mining: {
    color: '#f59e0b',
    fillOpacity: 0.2,
    strokeWeight: 1.5,
    strokeOpacity: 0.85,
    pointRadius: 6,
  },
  energy: {
    color: '#ea580c',
    fillOpacity: 0.2,
    strokeWeight: 1.5,
    strokeOpacity: 0.85,
    pointRadius: 6,
  },
  communities: {
    color: '#8b5cf6',
    fillOpacity: 0.25,
    strokeWeight: 2,
    strokeOpacity: 0.9,
    pointRadius: 6,
  },
  climate: {
    color: '#14b8a6',
    fillOpacity: 0.2,
    strokeWeight: 1.5,
    strokeOpacity: 0.85,
    pointRadius: 5,
  },
  permafrost: {
    color: '#06b6d4',
    fillOpacity: 0.25,
    strokeWeight: 1,
    strokeOpacity: 0.7,
    pointRadius: 5,
  },
};

/** Category labels used in the layer menu UI */
export const CATEGORY_LABELS: Record<string, string> = {
  basins: 'Sub-basins',
  advisories: 'Fish Consumption Advisories',
  fisheries: 'Commercial Fisheries',
  mining: 'Mining (historic + active + claims)',
  energy: 'Energy (oil/gas + hydro)',
  communities: 'Communities',
  climate: 'Climate Stations',
  permafrost: 'Thaw Slumps',
};

/** Ordered list of all 8 categories used by Jermilova overlays */
export const ALL_CATEGORIES: string[] = [
  'basins',
  'advisories',
  'fisheries',
  'mining',
  'energy',
  'communities',
  'climate',
  'permafrost',
];

/**
 * Default-on categories on first pack load.
 * Only basins is on by default to keep first paint cheap.
 */
export const DEFAULT_ON_CATEGORIES: ReadonlySet<string> = new Set(['basins']);

/**
 * Heavy layers - do not fetch until their category toggle is flipped on.
 * These are large polygon datasets (>1000 features each).
 */
export const HEAVY_LAYERS: ReadonlySet<MapArtifactKey> = new Set<MapArtifactKey>([
  'mineral_claims',
  'oil_gas_claims',
  'thaw_slumps',
]);

export function getStyleForKey(key: MapArtifactKey): CategoryStyle {
  const cat = MAP_ARTIFACT_CATEGORIES[key];
  return CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.basins;
}

// ---------------------------------------------------------------------------
// Property accessors (safe pulls from untyped properties bag)
// ---------------------------------------------------------------------------

function asString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Escape HTML special characters to prevent injection from feature properties. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeStr(v: unknown, fallback = 'N/A'): string {
  const s = asString(v);
  if (s == null || s === '') return fallback;
  return escapeHtml(s);
}

function safeNum(v: unknown, digits = 0, fallback = 'N/A'): string {
  const n = asNumber(v);
  if (n == null) return fallback;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ---------------------------------------------------------------------------
// Popup formatters keyed by MapArtifactKey
// ---------------------------------------------------------------------------

const POPUP_BASE_STYLE =
  'min-width:220px;max-width:320px;font-family:system-ui,sans-serif;font-size:12px;color:#1e293b;';

const POPUP_TITLE_STYLE =
  'font-weight:700;font-size:14px;color:#0f172a;margin:0 0 6px 0;';

const POPUP_ROW_STYLE = 'margin:2px 0;color:#475569;';

const POPUP_LABEL_STYLE = 'font-weight:600;color:#334155;';

function wrap(title: string, rowsHtml: string): string {
  return (
    `<div style="${POPUP_BASE_STYLE}">` +
    `<p style="${POPUP_TITLE_STYLE}">${title}</p>` +
    rowsHtml +
    '</div>'
  );
}

function row(label: string, value: string): string {
  return (
    `<p style="${POPUP_ROW_STYLE}">` +
    `<span style="${POPUP_LABEL_STYLE}">${escapeHtml(label)}:</span> ${value}` +
    '</p>'
  );
}

// Individual formatters -----------------------------------------------------

function formatBasinsGsl(p: Record<string, unknown>): string {
  const region = safeStr(p.region, 'GSL Region');
  const area = safeNum(p.area_km2, 0);
  return wrap(
    `GSL Region: ${region}`,
    row('Area', area === 'N/A' ? 'N/A' : `${area} km^2`),
  );
}

function formatBasinsGbs(p: Record<string, unknown>): string {
  const region = safeStr(p.region, 'GBS Sub-basin');
  return wrap(
    `GBS Region: ${region}`,
    row('Sub-basin', safeStr(p.subbasin)) + row('WSC name', safeStr(p.wsc_name)),
  );
}

function formatAdvisoryLakes(p: Record<string, unknown>): string {
  const location = safeStr(p.location, 'Lake');
  const species = safeStr(p.species);
  const adult = safeStr(p.advisory_adult);
  const pregnant = safeStr(p.advisory_pregnant_servings_per_wk);
  const child511 = safeStr(p.advisory_child_5_11);
  const child14 = safeStr(p.advisory_child_1_4);
  const fishSize = safeNum(p.fish_size_cm, 1);
  const serving = safeNum(p.serving_size_g, 0);
  return wrap(
    location,
    row('Species', species) +
      row('Adults', `${adult} servings/wk`) +
      row('Pregnant women', `${pregnant} servings/wk`) +
      row('Children 5-11', `${child511} servings/wk`) +
      row('Children 1-4', `${child14} servings/wk`) +
      row('Fish size', fishSize === 'N/A' ? 'N/A' : `${fishSize} cm`) +
      row('Serving size', serving === 'N/A' ? 'N/A' : `${serving} g`),
  );
}

function formatCommercialFisheries(p: Record<string, unknown>): string {
  const name = safeStr(p.name, 'Fishery');
  const speciesArr = Array.isArray(p.species)
    ? p.species
        .map((s) => asString(s))
        .filter((s): s is string => s != null && s !== '')
    : [];
  const speciesHtml =
    speciesArr.length > 0 ? escapeHtml(speciesArr.join(', ')) : 'N/A';
  const quota = safeNum(p.quota_kg, 0);
  return wrap(
    name,
    row('Location', safeStr(p.location)) +
      row('Species', speciesHtml) +
      row('Quota', quota === 'N/A' ? 'N/A' : `${quota} kg`) +
      row('Quota category', safeStr(p.quota_category)) +
      row('Sub-basin', safeStr(p.subbasin)),
  );
}

function formatHistoricMines(p: Record<string, unknown>): string {
  const name = safeStr(p.name, 'Historic mine');
  return wrap(
    name,
    row('Primary commodity', safeStr(p.primary_commodity)) +
      row('Stage', safeStr(p.stage)) +
      row('Years of production', safeStr(p.years_production)) +
      row('Development', safeStr(p.development)),
  );
}

function formatLargeMines(p: Record<string, unknown>): string {
  const name = safeStr(p.name, 'Large mine');
  return wrap(name, row('Metal', safeStr(p.metal)));
}

function formatMineralClaims(p: Record<string, unknown>): string {
  const claimName = safeStr(p.claim_name, 'Mineral claim');
  const area = safeNum(p.area_ha, 1);
  return wrap(
    claimName,
    row('Claim number', safeStr(p.claim_num)) +
      row('Status', safeStr(p.claim_status)) +
      row('Owners', safeStr(p.owners)) +
      row('Area', area === 'N/A' ? 'N/A' : `${area} ha`) +
      row('Anniversary', safeStr(p.anniversary_date)) +
      row('Land claim', safeStr(p.land_claim)),
  );
}

function formatOilGasClaims(p: Record<string, unknown>): string {
  const company = safeStr(p.company, 'Oil/Gas claim');
  const hect = safeNum(p.current_hectares, 1);
  return wrap(
    company,
    row('Land ID', safeStr(p.land_id)) +
      row('Description', safeStr(p.description)) +
      row('Agreement type', safeStr(p.agreement_type)) +
      row('Status', safeStr(p.status)) +
      row('Issued', safeStr(p.issue_date)) +
      row('Expires', safeStr(p.expiry_date)) +
      row('Region', safeStr(p.region)) +
      row('Current area', hect === 'N/A' ? 'N/A' : `${hect} ha`),
  );
}

function formatHydroFacilities(p: Record<string, unknown>): string {
  const name = safeStr(p.name, 'Hydro facility');
  const capacity = safeNum(p.capacity_mw, 1);
  const pop = safeNum(p.community_population, 0);
  return wrap(
    name,
    row('Location', safeStr(p.location)) +
      row('Capacity', capacity === 'N/A' ? 'N/A' : `${capacity} MW`) +
      row('Community population', pop),
  );
}

function formatCommunities(p: Record<string, unknown>): string {
  const name = safeStr(p.community, 'Community');
  const total = safeNum(p.population_total, 0);
  const dene = safeNum(p.pop_dene, 0);
  const metis = safeNum(p.pop_metis, 0);
  const inuit = safeNum(p.pop_inuit, 0);
  const nonInd = safeNum(p.pop_non_indigenous, 0);
  const ratio = safeNum(p.ratio_indigenous_to_non, 2);
  return wrap(
    name,
    row('Total population', total) +
      row('Dene', dene) +
      row('Metis', metis) +
      row('Inuit', inuit) +
      row('Non-Indigenous', nonInd) +
      row('Indigenous : non-Indigenous', ratio),
  );
}

function formatClimateStations(p: Record<string, unknown>): string {
  const name = safeStr(p.name, 'Climate station');
  const elev = safeNum(p.elevation_m, 0);
  const precip = safeNum(p.precipitation_mm, 0);
  const rIdx = safeNum(p.r_index, 2);
  return wrap(
    name,
    row('Elevation', elev === 'N/A' ? 'N/A' : `${elev} m`) +
      row('Annual precipitation', precip === 'N/A' ? 'N/A' : `${precip} mm`) +
      row('R index', rIdx) +
      row('Year', safeStr(p.year)),
  );
}

function formatThawSlumps(p: Record<string, unknown>): string {
  const id = safeStr(p.id, 'Thaw slump');
  const buf = safeNum(p.buffer_distance_m, 0);
  return wrap(
    `Thaw slump ${id}`,
    row('Work unit', safeStr(p.work_unit)) +
      row('Reference', safeStr(p.reference)) +
      row('Buffer', buf === 'N/A' ? 'N/A' : `${buf} m`),
  );
}

export type PopupFormatter = (props: Record<string, unknown>) => string;

export const POPUP_FORMATTERS: Record<MapArtifactKey, PopupFormatter> = {
  basins_gsl: formatBasinsGsl,
  basins_gbs: formatBasinsGbs,
  advisory_lakes: formatAdvisoryLakes,
  commercial_fisheries: formatCommercialFisheries,
  historic_mines: formatHistoricMines,
  large_mines: formatLargeMines,
  mineral_claims: formatMineralClaims,
  oil_gas_claims: formatOilGasClaims,
  hydro_facilities: formatHydroFacilities,
  communities: formatCommunities,
  climate_stations: formatClimateStations,
  thaw_slumps: formatThawSlumps,
};

/** Format a single GeoJSON feature into popup HTML for the given layer key. */
export function formatFeaturePopup(
  key: MapArtifactKey,
  feature: GeoJsonFeature,
): string {
  const formatter = POPUP_FORMATTERS[key];
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  return formatter(props);
}

// ---------------------------------------------------------------------------
// Pack-presence helper
// ---------------------------------------------------------------------------

/**
 * Returns true if the given pack manifest's `artifacts.map` block defines at
 * least one map artifact path. Used to gate the Jermilova overlay UI block.
 *
 * Pure helper extracted so it can be unit-tested without rendering SiteMap.
 */
export function packHasMapArtifacts(
  artifacts: { map?: Partial<Record<MapArtifactKey, string>> } | null | undefined,
): boolean {
  if (!artifacts || !artifacts.map) return false;
  for (const k of Object.keys(artifacts.map)) {
    const v = artifacts.map[k as MapArtifactKey];
    if (typeof v === 'string' && v.length > 0) return true;
  }
  return false;
}
