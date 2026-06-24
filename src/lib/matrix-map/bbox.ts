export interface MatrixMapBbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface RpcBbox {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
}

export function toRpcBbox(bbox: MatrixMapBbox | null | undefined): RpcBbox | null {
  if (!bbox) return null;
  const { minLng, minLat, maxLng, maxLat } = bbox;

  if (
    !Number.isFinite(minLng) ||
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLng) ||
    !Number.isFinite(maxLat)
  ) {
    return null;
  }

  if (minLng < -180 || minLng > 180 || maxLng < -180 || maxLng > 180) {
    return null;
  }

  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return null;
  }

  if (minLng >= maxLng || minLat >= maxLat) {
    return null;
  }

  // Rationale: mirrors the RPC's own EXCEPTION -> province-wide fail-safe (so a degenerate or
  // antimeridian-crossing viewport quietly falls back to province-wide rather than erroring).
  return {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
  };
}

/**
 * Shape the 4 bbox query params (?min_lng&min_lat&max_lng&max_lat) into a
 * MatrixMapBbox, or null (province-wide). STRICT + fail-safe: any missing /
 * blank / whitespace-only / non-finite edge => null (Number(" ") === 0 would
 * otherwise forge a 0 coordinate). Range / degenerate checks live in toRpcBbox.
 *
 * Lives here (not in the route module) because Next.js route files may only
 * export route handlers + config -- exporting a helper from route.ts breaks the
 * typed-routes build.
 */
export function parseBboxParams(sp: URLSearchParams): MatrixMapBbox | null {
  const raw = ['min_lng', 'min_lat', 'max_lng', 'max_lat'].map((k) => sp.get(k)?.trim());
  if (raw.some((v) => !v)) return null;
  const nums = (raw as string[]).map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = nums;
  return { minLng, minLat, maxLng, maxLat };
}
