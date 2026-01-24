'use client';

import { useCallback, useRef, useState } from 'react';
import { MatrixData } from '../types';

// Cache duration: 10 minutes (matches server TTL)
const CACHE_DURATION_MS = 10 * 60 * 1000;

interface CacheEntry {
  data: MatrixData[];
  timestamp: number;
}

interface PendingRequest {
  promise: Promise<MatrixData[]>;
}

// Global cache shared across all hook instances
const matrixDataCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, PendingRequest>();

export function useMatrixDataCache() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheKeyRef = useRef('matrix_all');

  /**
   * Fetch matrix data with caching and request deduplication
   * - Returns cached data immediately if fresh
   * - Deduplicates simultaneous requests for same filter
   * - Updates cache on successful fetch
   */
  const fetchMatrixData = useCallback(async (filter: 'all' | 'twg' | 'cew' = 'all') => {
    const cacheKey = `matrix_${filter}`;
    cacheKeyRef.current = cacheKey;

    try {
      // Check if data is already cached and fresh
      if (matrixDataCache.has(cacheKey)) {
        const cachedEntry = matrixDataCache.get(cacheKey)!;
        const cacheAge = Date.now() - cachedEntry.timestamp;

        if (cacheAge < CACHE_DURATION_MS) {
          console.log(`✅ useMatrixDataCache - Cache hit for ${filter}, age: ${cacheAge}ms`);
          setLoading(false);
          setError(null);
          return cachedEntry.data;
        }
      }

      // Check if there's already a pending request for this filter
      if (pendingRequests.has(cacheKey)) {
        console.log(`⏳ useMatrixDataCache - Returning pending request for ${filter}`);
        return pendingRequests.get(cacheKey)!.promise;
      }

      // Create new fetch request
      setLoading(true);
      setError(null);

      const fetchPromise = (async () => {
        try {
          const response = await fetch(`/api/graphs/prioritization-matrix?filter=${filter}`);

          if (!response.ok) {
            throw new Error(`Failed to fetch matrix data: ${response.statusText}`);
          }

          const data: MatrixData[] = await response.json();

          // Store in cache
          matrixDataCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });

          console.log(`✅ useMatrixDataCache - Data cached for ${filter}`);
          setLoading(false);
          return data;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`❌ useMatrixDataCache - Error fetching ${filter}:`, errorMessage);
          setError(errorMessage);
          setLoading(false);
          throw err;
        } finally {
          // Remove from pending requests
          pendingRequests.delete(cacheKey);
        }
      })();

      // Store pending request
      pendingRequests.set(cacheKey, { promise: fetchPromise });

      return await fetchPromise;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  /**
   * Clear cache for specific filter or all filters
   */
  const clearCache = useCallback((filter?: 'all' | 'twg' | 'cew') => {
    if (filter) {
      matrixDataCache.delete(`matrix_${filter}`);
      console.log(`✅ useMatrixDataCache - Cleared cache for ${filter}`);
    } else {
      matrixDataCache.clear();
      console.log(`✅ useMatrixDataCache - Cleared all caches`);
    }
  }, []);

  /**
   * Force refresh data, bypassing cache
   */
  const refreshData = useCallback(async (filter: 'all' | 'twg' | 'cew' = 'all') => {
    clearCache(filter);
    return fetchMatrixData(filter);
  }, [fetchMatrixData, clearCache]);

  return {
    fetchMatrixData,
    clearCache,
    refreshData,
    loading,
    error
  };
}
