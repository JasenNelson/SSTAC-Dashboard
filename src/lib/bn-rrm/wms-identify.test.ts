/**
 * wms-identify tests
 *
 * Covers:
 *   - EPSG:3857 bbox math across multiple zoom levels and latitudes
 *   - WMS 1.1.1 param names (srs NOT crs, info_format, feature_count, etc.)
 *   - Click pixel computation (top-left origin, matches Leaflet)
 *   - Z-order resolution (topmost-first = reverse insertion order)
 *   - JSON response normalizer
 *   - HTML fallback normalizer
 *   - Parallel driver: preserves order, tolerates per-layer failures
 *
 * Plain ASCII only.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildGetFeatureInfoUrl,
  getActiveOverlaysInZOrder,
  normalizeFeatureInfoHtml,
  normalizeFeatureInfoJson,
  queryActiveOverlays,
  type IdentifyOverlay,
  type LeafletCRS,
  type LeafletLatLng,
  type LeafletMapLike,
  type LeafletPoint,
} from './wms-identify';

// ---------------------------------------------------------------------------
// Minimal Leaflet stand-ins
// ---------------------------------------------------------------------------

/**
 * Spherical Mercator projection matching L.Projection.SphericalMercator.
 * Returns (x, y) in meters with y increasing northward (standard EPSG:3857).
 */
const R = 6378137;
const MAX_LAT = 85.0511287798;

function projectSphericalMercator(latlng: LeafletLatLng): LeafletPoint {
  const d = Math.PI / 180;
  const lat = Math.max(Math.min(MAX_LAT, latlng.lat), -MAX_LAT);
  const sin = Math.sin(lat * d);
  return {
    x: R * latlng.lng * d,
    y: (R * Math.log((1 + sin) / (1 - sin))) / 2,
  };
}

const CRS_EPSG3857: LeafletCRS = {
  code: 'EPSG:3857',
  project: projectSphericalMercator,
};

function makeMap(opts: {
  sw: LeafletLatLng;
  ne: LeafletLatLng;
  size: LeafletPoint;
  crs?: LeafletCRS;
}): LeafletMapLike {
  const { sw, ne, size, crs = CRS_EPSG3857 } = opts;
  return {
    getSize: () => size,
    getBounds: () => ({
      getSouthWest: () => sw,
      getNorthEast: () => ne,
    }),
    latLngToContainerPoint: (latlng: LeafletLatLng) => {
      // Linear interpolation across the viewport for test purposes. Real
      // Leaflet uses projected coords, but we only need a deterministic mapping
      // so that center-lat/lng -> center pixel.
      const fx = (latlng.lng - sw.lng) / (ne.lng - sw.lng);
      const fy = (ne.lat - latlng.lat) / (ne.lat - sw.lat);
      return { x: fx * size.x, y: fy * size.y };
    },
    options: { crs },
  };
}

// ---------------------------------------------------------------------------
// URL builder tests
// ---------------------------------------------------------------------------

const OVERLAY: IdentifyOverlay = {
  key: 'csrSites',
  name: 'Contaminated Sites Registry',
  layer: 'pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW',
};

describe('buildGetFeatureInfoUrl', () => {
  it('uses WMS 1.1.1 param names (srs NOT crs)', () => {
    const map = makeMap({
      sw: { lat: 49.0, lng: -123.5 },
      ne: { lat: 49.5, lng: -122.5 },
      size: { x: 800, y: 600 },
    });
    const url = buildGetFeatureInfoUrl(
      OVERLAY,
      map,
      { lat: 49.25, lng: -123.0 },
    );
    const params = new URL(url).searchParams;

    expect(params.get('service')).toBe('WMS');
    expect(params.get('version')).toBe('1.1.1');
    expect(params.get('request')).toBe('GetFeatureInfo');
    expect(params.get('srs')).toBe('EPSG:3857');
    expect(params.has('crs')).toBe(false);
    expect(params.get('info_format')).toBe('application/json');
    expect(params.get('feature_count')).toBe('10');
    expect(params.get('layers')).toBe(OVERLAY.layer);
    expect(params.get('query_layers')).toBe(OVERLAY.layer);
    expect(params.get('format')).toBe('image/png');
  });

  it('bbox is in EPSG:3857 meters, order minX,minY,maxX,maxY', () => {
    const map = makeMap({
      sw: { lat: 49.0, lng: -123.5 },
      ne: { lat: 49.5, lng: -122.5 },
      size: { x: 800, y: 600 },
    });
    const url = buildGetFeatureInfoUrl(
      OVERLAY,
      map,
      { lat: 49.25, lng: -123.0 },
    );
    const bbox = new URL(url).searchParams.get('bbox')!.split(',').map(Number);
    expect(bbox).toHaveLength(4);
    const [minX, minY, maxX, maxY] = bbox;
    expect(minX).toBeLessThan(maxX);
    expect(minY).toBeLessThan(maxY);
    // All four in meters of Earth radius order (|x|, |y| under ~20,037,508).
    for (const v of bbox) {
      expect(Math.abs(v)).toBeLessThan(2.1e7);
    }
    // SW longitude -123.5 projects to a negative easting
    expect(minX).toBeLessThan(0);
    // SW latitude 49.0 projects to a positive northing
    expect(minY).toBeGreaterThan(0);
  });

  it('bbox math is plausible across zoom levels (z=8, z=12, z=16 footprints)', () => {
    const cases = [
      { dLat: 2.0, dLng: 4.0 }, // roughly z=8
      { dLat: 0.125, dLng: 0.25 }, // roughly z=12
      { dLat: 0.008, dLng: 0.015 }, // roughly z=16
    ];
    for (const c of cases) {
      const map = makeMap({
        sw: { lat: 49.0, lng: -123.5 },
        ne: { lat: 49.0 + c.dLat, lng: -123.5 + c.dLng },
        size: { x: 1000, y: 800 },
      });
      const url = buildGetFeatureInfoUrl(
        OVERLAY,
        map,
        { lat: 49.0 + c.dLat / 2, lng: -123.5 + c.dLng / 2 },
      );
      const bbox = new URL(url)
        .searchParams.get('bbox')!
        .split(',')
        .map(Number);
      const [minX, minY, maxX, maxY] = bbox;
      expect(maxX - minX).toBeGreaterThan(0);
      expect(maxY - minY).toBeGreaterThan(0);
      // Larger geographic span -> larger projected extent
      expect(maxX - minX).toBeLessThan(6e6);
    }
  });

  it('bbox math is plausible at high latitude (60 N)', () => {
    const map = makeMap({
      sw: { lat: 59.5, lng: -128.0 },
      ne: { lat: 60.5, lng: -127.0 },
      size: { x: 1024, y: 768 },
    });
    const url = buildGetFeatureInfoUrl(
      OVERLAY,
      map,
      { lat: 60.0, lng: -127.5 },
    );
    const bbox = new URL(url)
      .searchParams.get('bbox')!
      .split(',')
      .map(Number);
    const [, minY, , maxY] = bbox;
    // 60 N projects to ~8.4e6 m northing in EPSG:3857
    expect(minY).toBeGreaterThan(8e6);
    expect(maxY).toBeLessThan(9e6);
  });

  it('click at map center lands near width/2, height/2', () => {
    const size = { x: 1024, y: 768 };
    const map = makeMap({
      sw: { lat: 49.0, lng: -123.5 },
      ne: { lat: 49.5, lng: -122.5 },
      size,
    });
    const url = buildGetFeatureInfoUrl(
      OVERLAY,
      map,
      { lat: 49.25, lng: -123.0 },
    );
    const params = new URL(url).searchParams;
    expect(Number(params.get('x'))).toBe(Math.round(size.x / 2));
    expect(Number(params.get('y'))).toBe(Math.round(size.y / 2));
    expect(Number(params.get('width'))).toBe(size.x);
    expect(Number(params.get('height'))).toBe(size.y);
  });

  it('clamps x/y to width-1 / height-1 on edge clicks (WMS 1.1.1 inclusive range)', () => {
    const size = { x: 800, y: 600 };
    const sw = { lat: 49.0, lng: -123.5 };
    const ne = { lat: 49.5, lng: -122.5 };
    const map = makeMap({ sw, ne, size });
    // Click at the NE corner. makeMap's latLngToContainerPoint returns
    // { x: size.x, y: 0 } for lat=ne.lat, lng=ne.lng (fy=0, fx=1), which is
    // exactly the off-by-one case we need to clamp.
    const url = buildGetFeatureInfoUrl(OVERLAY, map, {
      lat: ne.lat,
      lng: ne.lng,
    });
    const params = new URL(url).searchParams;
    const w = Number(params.get('width'));
    const h = Number(params.get('height'));
    const x = Number(params.get('x'));
    const y = Number(params.get('y'));
    expect(w).toBe(size.x);
    expect(h).toBe(size.y);
    expect(x).toBeLessThanOrEqual(w - 1);
    expect(y).toBeLessThanOrEqual(h - 1);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    // Specifically: the NE corner should end up at (w-1, 0)
    expect(x).toBe(w - 1);
    expect(y).toBe(0);
  });

  it('clamps x/y to width-1 / height-1 on SW corner clicks', () => {
    const size = { x: 1024, y: 768 };
    const sw = { lat: 49.0, lng: -123.5 };
    const ne = { lat: 49.5, lng: -122.5 };
    const map = makeMap({ sw, ne, size });
    // SW corner: fx=0, fy=1 -> { x: 0, y: size.y } before clamp.
    const url = buildGetFeatureInfoUrl(OVERLAY, map, {
      lat: sw.lat,
      lng: sw.lng,
    });
    const params = new URL(url).searchParams;
    const w = Number(params.get('width'));
    const h = Number(params.get('height'));
    const x = Number(params.get('x'));
    const y = Number(params.get('y'));
    expect(x).toBe(0);
    expect(y).toBe(h - 1);
    expect(x).toBeLessThanOrEqual(w - 1);
    expect(y).toBeLessThanOrEqual(h - 1);
  });

  it('throws clearly when map.options.crs is missing', () => {
    const badMap: LeafletMapLike = {
      getSize: () => ({ x: 100, y: 100 }),
      getBounds: () => ({
        getSouthWest: () => ({ lat: 0, lng: 0 }),
        getNorthEast: () => ({ lat: 1, lng: 1 }),
      }),
      latLngToContainerPoint: () => ({ x: 50, y: 50 }),
      options: {},
    };
    expect(() =>
      buildGetFeatureInfoUrl(OVERLAY, badMap, { lat: 0.5, lng: 0.5 }),
    ).toThrow(/crs/i);
  });
});

// ---------------------------------------------------------------------------
// getActiveOverlaysInZOrder
// ---------------------------------------------------------------------------

describe('getActiveOverlaysInZOrder', () => {
  it('returns topmost-first = reverse insertion order', () => {
    const defs: Record<string, Omit<IdentifyOverlay, 'key'>> = {
      a: { name: 'A', layer: 'pub:A' },
      b: { name: 'B', layer: 'pub:B' },
      c: { name: 'C', layer: 'pub:C' },
    };
    const ref = new Map<string, unknown>();
    ref.set('a', {});
    ref.set('b', {});
    ref.set('c', {}); // c added last -> topmost
    const ordered = getActiveOverlaysInZOrder(ref, defs);
    expect(ordered.map((o) => o.key)).toEqual(['c', 'b', 'a']);
    expect(ordered[0].name).toBe('C');
  });

  it('silently skips ref entries with no matching def', () => {
    const defs: Record<string, Omit<IdentifyOverlay, 'key'>> = {
      a: { name: 'A', layer: 'pub:A' },
    };
    const ref = new Map<string, unknown>();
    ref.set('a', {});
    ref.set('ghost', {}); // no entry in defs
    const ordered = getActiveOverlaysInZOrder(ref, defs);
    expect(ordered).toHaveLength(1);
    expect(ordered[0].key).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

describe('normalizeFeatureInfoJson', () => {
  it('returns one IdentifiedFeature per GeoJSON feature, server order preserved', () => {
    const json = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { SITE_ID: 101, STATUS: 'Active' } },
        { type: 'Feature', properties: { SITE_ID: 202 } },
      ],
    };
    const features = normalizeFeatureInfoJson(
      json,
      OVERLAY,
      { lat: 49.0, lng: -123.0 },
      1_700_000_000_000,
    );
    expect(features).toHaveLength(2);
    expect(features[0].source).toBe('wms');
    expect(features[0].layerKey).toBe('csrSites');
    expect(features[0].layerLabel).toBe('Contaminated Sites Registry');
    expect(features[0].properties.SITE_ID).toBe(101);
    expect(features[1].properties.SITE_ID).toBe(202);
    expect(features[0].coordinates).toEqual({ lat: 49.0, lng: -123.0 });
    expect(features[0].capturedAt).toBe(1_700_000_000_000);
  });

  it('returns [] for null/undefined/empty responses', () => {
    expect(
      normalizeFeatureInfoJson(null, OVERLAY, { lat: 0, lng: 0 }),
    ).toEqual([]);
    expect(
      normalizeFeatureInfoJson(undefined, OVERLAY, { lat: 0, lng: 0 }),
    ).toEqual([]);
    expect(
      normalizeFeatureInfoJson(
        { type: 'FeatureCollection', features: [] },
        OVERLAY,
        { lat: 0, lng: 0 },
      ),
    ).toEqual([]);
  });

  it('tolerates features with null properties', () => {
    const features = normalizeFeatureInfoJson(
      { features: [{ type: 'Feature', properties: null }] },
      OVERLAY,
      { lat: 0, lng: 0 },
    );
    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({});
  });
});

describe('normalizeFeatureInfoHtml', () => {
  it('extracts key/value rows from a <table>', () => {
    const html = `
      <html><body>
        <table>
          <tr><th>SITE_ID</th><td>101</td></tr>
          <tr><th>STATUS</th><td>Active</td></tr>
        </table>
      </body></html>`;
    const features = normalizeFeatureInfoHtml(
      html,
      OVERLAY,
      { lat: 49.0, lng: -123.0 },
      1000,
    );
    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({
      SITE_ID: '101',
      STATUS: 'Active',
    });
    expect(features[0].source).toBe('wms');
    expect(features[0].capturedAt).toBe(1000);
  });

  it('returns [] when no parseable rows', () => {
    expect(normalizeFeatureInfoHtml('', OVERLAY, { lat: 0, lng: 0 })).toEqual(
      [],
    );
    expect(
      normalizeFeatureInfoHtml(
        '<html><body>no table</body></html>',
        OVERLAY,
        { lat: 0, lng: 0 },
      ),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// queryActiveOverlays
// ---------------------------------------------------------------------------

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'content-type' ? 'application/json' : null,
    } as unknown as Headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function makeEmptyHtmlResponse(status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'content-type' ? 'text/html' : null,
    } as unknown as Headers,
    json: async () => ({}),
    text: async () => '<html><body>nope</body></html>',
  } as unknown as Response;
}

const MAP_FIXTURE = makeMap({
  sw: { lat: 49.0, lng: -123.5 },
  ne: { lat: 49.5, lng: -122.5 },
  size: { x: 800, y: 600 },
});

describe('queryActiveOverlays', () => {
  it('fires one request per layer in parallel, preserves input order', async () => {
    const layerA: IdentifyOverlay = { key: 'a', name: 'A', layer: 'pub:A' };
    const layerB: IdentifyOverlay = { key: 'b', name: 'B', layer: 'pub:B' };
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('pub%3AA') || u.includes('pub:A')) {
        return makeJsonResponse({
          features: [{ type: 'Feature', properties: { id: 'A1' } }],
        });
      }
      return makeJsonResponse({
        features: [{ type: 'Feature', properties: { id: 'B1' } }],
      });
    });

    const features = await queryActiveOverlays(
      [layerA, layerB],
      MAP_FIXTURE,
      { lat: 49.25, lng: -123.0 },
      { fetchImpl: fetchImpl as unknown as typeof fetch, now: () => 42 },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(features).toHaveLength(2);
    expect(features[0].layerKey).toBe('a');
    expect(features[1].layerKey).toBe('b');
    expect(features[0].capturedAt).toBe(42);
  });

  it('skips layers where queryable === false without fetching', async () => {
    const layerA: IdentifyOverlay = {
      key: 'a',
      name: 'A',
      layer: 'pub:A',
      queryable: false,
    };
    const layerB: IdentifyOverlay = { key: 'b', name: 'B', layer: 'pub:B' };
    const fetchImpl = vi.fn(async () =>
      makeJsonResponse({
        features: [{ type: 'Feature', properties: { id: 'B1' } }],
      }),
    );
    const features = await queryActiveOverlays(
      [layerA, layerB],
      MAP_FIXTURE,
      { lat: 49.25, lng: -123.0 },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(features).toHaveLength(1);
    expect(features[0].layerKey).toBe('b');
  });

  it('tolerates per-layer rejection and non-2xx without corrupting neighbors', async () => {
    const layerA: IdentifyOverlay = { key: 'a', name: 'A', layer: 'pub:A' };
    const layerB: IdentifyOverlay = { key: 'b', name: 'B', layer: 'pub:B' };
    const layerC: IdentifyOverlay = { key: 'c', name: 'C', layer: 'pub:C' };
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes('pub:A') || u.includes('pub%3AA')) {
        throw new Error('network fail');
      }
      if (u.includes('pub:B') || u.includes('pub%3AB')) {
        // returns 500 on JSON then 500 on HTML fallback too
        return makeEmptyHtmlResponse(500);
      }
      return makeJsonResponse({
        features: [{ type: 'Feature', properties: { id: 'C1' } }],
      });
    });
    const features = await queryActiveOverlays(
      [layerA, layerB, layerC],
      MAP_FIXTURE,
      { lat: 49.25, lng: -123.0 },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(features).toHaveLength(1);
    expect(features[0].layerKey).toBe('c');
  });

  it('returns [] for empty input', async () => {
    const features = await queryActiveOverlays(
      [],
      MAP_FIXTURE,
      { lat: 0, lng: 0 },
    );
    expect(features).toEqual([]);
  });
});
