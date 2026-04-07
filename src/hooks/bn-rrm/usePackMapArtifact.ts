/**
 * usePackMapArtifact
 *
 * Lazy-loader for pack-supplied map GeoJSON artifacts. Modeled on
 * usePackArtifact but targets the `artifacts.map[key]` block and uses an
 * in-module cache (keyed by pack base URL + artifact key) so we do not need
 * to extend packStore with a parallel artifact cache surface.
 *
 * The hook returns:
 *   - data: parsed GeoJSON FeatureCollection (or null)
 *   - loading: boolean
 *   - error: string | null
 *
 * It is designed to be invoked imperatively from SiteMap (one call per
 * MapArtifactKey, gated by category toggle state to support lazy heavy-layer
 * loading). Components may also call `loadMapArtifact` directly for ad-hoc
 * loads outside the React lifecycle.
 *
 * Plain ASCII only. No em dashes.
 */

'use client';

import { useEffect, useState } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import type { MapArtifactKey } from '@/lib/bn-rrm/pack-types';
import type { GeoJsonFeatureCollection } from '@/lib/bn-rrm/map-overlay-helpers';

interface CacheEntry {
  data: GeoJsonFeatureCollection | null;
  promise: Promise<GeoJsonFeatureCollection | null> | null;
  error: string | null;
}

// Module-level cache, keyed by `${packBaseUrl}::${key}`. WeakMap is not usable
// since the keys are strings, so a plain Map is fine. Entries are evicted on
// pack switch via clearMapArtifactCacheForPack().
const cache = new Map<string, CacheEntry>();

function cacheKey(packBaseUrl: string, key: MapArtifactKey): string {
  return `${packBaseUrl}::${key}`;
}

/**
 * Imperatively load a pack map artifact. Returns null on error or when the
 * artifact path is missing from the manifest.
 */
export async function loadMapArtifact(
  packBaseUrl: string,
  artifactRelPath: string,
  key: MapArtifactKey,
): Promise<GeoJsonFeatureCollection | null> {
  const ck = cacheKey(packBaseUrl, key);
  const existing = cache.get(ck);
  if (existing) {
    if (existing.data) return existing.data;
    if (existing.promise) return existing.promise;
  }

  const url = `${packBaseUrl}/${artifactRelPath}`;
  const promise: Promise<GeoJsonFeatureCollection | null> = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load map artifact ${key}: ${res.status}`);
      }
      const data = (await res.json()) as GeoJsonFeatureCollection;
      cache.set(ck, { data, promise: null, error: null });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      cache.set(ck, { data: null, promise: null, error: msg });
      console.error(`[usePackMapArtifact] ${msg}`);
      return null;
    }
  })();

  cache.set(ck, { data: null, promise, error: null });
  return promise;
}

/** Drop all cached map artifacts for a given pack base URL. */
export function clearMapArtifactCacheForPack(packBaseUrl: string | null): void {
  if (!packBaseUrl) {
    cache.clear();
    return;
  }
  const prefix = `${packBaseUrl}::`;
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
    }
  }
}

interface UsePackMapArtifactResult {
  data: GeoJsonFeatureCollection | null;
  loading: boolean;
  error: string | null;
}

/**
 * React hook variant. Pass `enabled = false` to skip fetching (used for heavy
 * lazy-loaded layers gated on category toggle state).
 */
export function usePackMapArtifact(
  key: MapArtifactKey,
  enabled: boolean,
): UsePackMapArtifactResult {
  const packManifest = usePackStore((s) => s.packManifest);
  const getPackBaseUrl = usePackStore((s) => s.getPackBaseUrl);
  const selectedPackId = usePackStore((s) => s.selectedPackId);

  const [data, setData] = useState<GeoJsonFeatureCollection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!packManifest || !selectedPackId) return;
    if (packManifest.pack_id !== selectedPackId) return;
    const mapBlock = packManifest.artifacts.map;
    if (!mapBlock) return;
    const relPath = mapBlock[key];
    if (!relPath) return;

    const baseUrl = getPackBaseUrl();
    if (!baseUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    loadMapArtifact(baseUrl, relPath, key).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
      if (result == null) {
        const ck = cacheKey(baseUrl, key);
        const ce = cache.get(ck);
        setError(ce?.error ?? 'Failed to load map artifact');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, key, packManifest, selectedPackId, getPackBaseUrl]);

  return { data, loading, error };
}
