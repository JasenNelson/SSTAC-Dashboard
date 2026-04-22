/**
 * wms-identify
 *
 * WMS GetFeatureInfo helpers for the BN-RRM map Identify tool.
 *
 * Hard-coded to WMS 1.1.1. 1.1.1 expects:
 *   - srs (NOT crs; crs is 1.3.0 and axis order differs)
 *   - bbox as minX,minY,maxX,maxY in SRS units
 *   - X,Y click pixel with top-left origin (matches Leaflet latLngToContainerPoint)
 * If this helper is ever migrated to 1.3.0, revisit param names AND axis order
 * (1.3.0 returns lat,lng axis order for EPSG:4326 and certain projections).
 *
 * CRS contract: Leaflet renders WMS tiles in map.options.crs, default
 * L.CRS.EPSG3857. All bbox/width/height/x/y math MUST be computed in that CRS.
 * That is why we project the map bounds through crs.project() to get meters
 * for EPSG:3857, NOT pass raw lat/lng.
 *
 * Plain ASCII only. No em dashes. No emoji.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IdentifyOverlay {
  /** Key used as the overlayLayersRef Map key (e.g., 'parks', 'csrSites'). */
  key: string;
  /** UI label shown in the panel and popup. */
  name: string;
  /** WMS layer path, e.g. 'pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW'. */
  layer: string;
  /** Optional category grouping; not used by this module directly. */
  category?: string;
  /** Optional swatch color; not used by this module directly. */
  color?: string;
  /**
   * If explicitly false, this layer is skipped by queryActiveOverlays (still
   * renders as a WMS tile but returns no identify hits). Undefined/true = query.
   */
  queryable?: boolean;
}

export interface IdentifiedFeature {
  source: 'wms' | 'geojson';
  layerKey: string;
  layerLabel: string;
  properties: Record<string, unknown>;
  coordinates: { lat: number; lng: number };
  capturedAt: number;
}

// ---------------------------------------------------------------------------
// Minimal structural Leaflet types so this module does not import leaflet
// (keeps test mocking simple and the module SSR-safe).
// ---------------------------------------------------------------------------

export interface LeafletPoint {
  x: number;
  y: number;
}

export interface LeafletLatLng {
  lat: number;
  lng: number;
}

export interface LeafletBounds {
  getSouthWest: () => LeafletLatLng;
  getNorthEast: () => LeafletLatLng;
}

export interface LeafletCRS {
  code?: string;
  project: (latlng: LeafletLatLng) => LeafletPoint;
}

export interface LeafletMapLike {
  getSize: () => LeafletPoint;
  getBounds: () => LeafletBounds;
  latLngToContainerPoint: (latlng: LeafletLatLng) => LeafletPoint;
  options: { crs?: LeafletCRS };
}

// ---------------------------------------------------------------------------
// Default WMS endpoint (BC OpenMaps public)
// ---------------------------------------------------------------------------

export const DEFAULT_WMS_URL = 'https://openmaps.gov.bc.ca/geo/pub/ows';

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

export function buildGetFeatureInfoUrl(
  layer: IdentifyOverlay,
  map: LeafletMapLike,
  latlng: LeafletLatLng,
  wmsUrl: string = DEFAULT_WMS_URL,
): string {
  const crs = map.options.crs;
  if (!crs || typeof crs.project !== 'function') {
    throw new Error(
      'buildGetFeatureInfoUrl: map.options.crs is missing or invalid',
    );
  }
  const size = map.getSize();
  const bounds = map.getBounds();
  const sw = crs.project(bounds.getSouthWest());
  const ne = crs.project(bounds.getNorthEast());
  const click = map.latLngToContainerPoint(latlng);

  // WMS 1.1.1 expects X,Y in the inclusive pixel range 0..width-1 / 0..height-1.
  // latLngToContainerPoint can return click.x === size.x or click.y === size.y
  // on right/bottom edge clicks; clamp both lower AND upper bounds.
  const w = Math.max(1, Math.round(size.x));
  const h = Math.max(1, Math.round(size.y));
  const x = Math.min(Math.max(0, Math.round(click.x)), w - 1);
  const y = Math.min(Math.max(0, Math.round(click.y)), h - 1);

  const params = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: layer.layer,
    query_layers: layer.layer,
    styles: '',
    format: 'image/png',
    transparent: 'true',
    info_format: 'application/json',
    feature_count: '10',
    srs: crs.code ?? 'EPSG:3857',
    bbox: `${sw.x},${sw.y},${ne.x},${ne.y}`,
    width: String(w),
    height: String(h),
    x: String(x),
    y: String(y),
  });

  return `${wmsUrl}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Response normalizer
// ---------------------------------------------------------------------------

interface GetFeatureInfoJson {
  type?: string;
  features?: Array<{
    type?: string;
    properties?: Record<string, unknown> | null;
  }>;
}

export function normalizeFeatureInfoJson(
  json: GetFeatureInfoJson | null | undefined,
  layer: IdentifyOverlay,
  latlng: LeafletLatLng,
  now: number = Date.now(),
): IdentifiedFeature[] {
  if (!json || !Array.isArray(json.features)) return [];
  const out: IdentifiedFeature[] = [];
  for (const f of json.features) {
    const props = (f?.properties ?? {}) as Record<string, unknown>;
    out.push({
      source: 'wms',
      layerKey: layer.key,
      layerLabel: layer.name,
      properties: props,
      coordinates: { lat: latlng.lat, lng: latlng.lng },
      capturedAt: now,
    });
  }
  return out;
}

/**
 * Last-resort HTML fallback: pull key/value rows from a <table>-formatted
 * GetFeatureInfo response. Only used when info_format=application/json fails
 * for a layer. Intentionally minimal - we do NOT parse GML.
 */
export function normalizeFeatureInfoHtml(
  html: string,
  layer: IdentifyOverlay,
  latlng: LeafletLatLng,
  now: number = Date.now(),
): IdentifiedFeature[] {
  if (!html || typeof html !== 'string') return [];
  const props: Record<string, unknown> = {};
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1].replace(/<[^>]+>/g, '').trim();
      cells.push(text);
    }
    if (cells.length >= 2) {
      const key = cells[0];
      const value = cells.slice(1).join(' ');
      if (key) props[key] = value;
    }
  }
  if (Object.keys(props).length === 0) return [];
  return [
    {
      source: 'wms',
      layerKey: layer.key,
      layerLabel: layer.name,
      properties: props,
      coordinates: { lat: latlng.lat, lng: latlng.lng },
      capturedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// Z-order resolver
// ---------------------------------------------------------------------------

/**
 * Return the active WMS overlays in TOPMOST-FIRST z-order.
 *
 * Source of truth for z-order is overlayLayersRef (Map<string, L.Layer>) in
 * SiteMap.tsx, because entries are inserted in the actual order Leaflet layers
 * are added to the map (reflects user toggle order). Leaflet draws later-added
 * layers ABOVE earlier-added ones, so topmost-first = reverse insertion order.
 *
 * Declaration order of OVERLAY_LAYERS is NOT authoritative.
 */
export function getActiveOverlaysInZOrder(
  overlayLayersRef: Map<string, unknown>,
  overlayDefs: Record<string, Omit<IdentifyOverlay, 'key'>>,
): IdentifyOverlay[] {
  const keysInInsertionOrder = Array.from(overlayLayersRef.keys());
  const out: IdentifyOverlay[] = [];
  for (let i = keysInInsertionOrder.length - 1; i >= 0; i--) {
    const key = keysInInsertionOrder[i];
    const def = overlayDefs[key];
    if (!def) continue;
    out.push({ key, ...def });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parallel query driver
// ---------------------------------------------------------------------------

export interface QueryActiveOverlaysOptions {
  /** Override the fetch implementation; used by tests. */
  fetchImpl?: typeof fetch;
  /** Override the WMS endpoint (rarely needed). */
  wmsUrl?: string;
  /** Clock for capturedAt timestamps; used by tests. */
  now?: () => number;
  /** Per-request timeout in ms; default 8000. */
  timeoutMs?: number;
}

async function fetchOne(
  layer: IdentifyOverlay,
  map: LeafletMapLike,
  latlng: LeafletLatLng,
  opts: QueryActiveOverlaysOptions,
): Promise<IdentifiedFeature[]> {
  if (layer.queryable === false) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const wmsUrl = opts.wmsUrl ?? DEFAULT_WMS_URL;
  const now = opts.now ?? Date.now;
  const timeoutMs = opts.timeoutMs ?? 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = buildGetFeatureInfoUrl(layer, map, latlng, wmsUrl);
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok || res.status === 204) {
      // Try HTML fallback once before giving up
      const htmlUrl = url.replace(
        'info_format=application%2Fjson',
        'info_format=text%2Fhtml',
      );
      const htmlRes = await fetchImpl(htmlUrl, {
        signal: controller.signal,
      }).catch(() => null);
      if (!htmlRes || !htmlRes.ok) return [];
      const html = await htmlRes.text().catch(() => '');
      return normalizeFeatureInfoHtml(html, layer, latlng, now());
    }
    const ct = (res.headers?.get?.('content-type') ?? '').toLowerCase();
    if (ct.includes('json')) {
      const json = (await res.json().catch(() => null)) as
        | GetFeatureInfoJson
        | null;
      return normalizeFeatureInfoJson(json, layer, latlng, now());
    }
    // Server ignored info_format; fall back to HTML parse on the same body
    const text = await res.text().catch(() => '');
    return normalizeFeatureInfoHtml(text, layer, latlng, now());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire one GetFeatureInfo request per queryable overlay in PARALLEL, preserve
 * input ordering in the returned array, and preserve server feature order
 * within each layer. Non-fatal errors (timeout, non-2xx, parse failure) drop
 * that layer's contribution silently.
 */
export async function queryActiveOverlays(
  orderedLayers: IdentifyOverlay[],
  map: LeafletMapLike,
  latlng: LeafletLatLng,
  opts: QueryActiveOverlaysOptions = {},
): Promise<IdentifiedFeature[]> {
  if (!orderedLayers || orderedLayers.length === 0) return [];
  const settled = await Promise.allSettled(
    orderedLayers.map((layer) => fetchOne(layer, map, latlng, opts)),
  );
  const out: IdentifiedFeature[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      for (const f of s.value) out.push(f);
    }
  }
  return out;
}
