/**
 * usePackArtifact — Hook for lazy-loading review artifacts from the selected pack.
 *
 * Usage in review components:
 *   const { data, loading, error } = usePackArtifact<ModelOverviewData>('model_overview');
 *
 * Replaces static imports like:
 *   import overview from '@/data/bn-rrm/transparency/model-overview.json';
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import type { ReviewArtifactKey } from '@/lib/bn-rrm/pack-types';

interface UsePackArtifactResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function usePackArtifact<T = unknown>(
  key: ReviewArtifactKey
): UsePackArtifactResult<T> {
  const selectedPackId = usePackStore((s) => s.selectedPackId);
  const packManifest = usePackStore((s) => s.packManifest);
  const loadReviewArtifact = usePackStore((s) => s.loadReviewArtifact);
  const cachedData = usePackStore((s) => s.reviewArtifactCache[key]);
  const isLoading = usePackStore((s) => s.reviewArtifactLoading[key] ?? false);
  const artifactError = usePackStore((s) => s.reviewArtifactErrors[key] ?? null);

  const [localData, setLocalData] = useState<T | null>(null);
  const prevPackIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedPackId) return;
    const result = await loadReviewArtifact<T>(key);
    if (result !== null) {
      setLocalData(result);
    }
  }, [selectedPackId, key, loadReviewArtifact]);

  // Clear localData when pack changes to avoid showing stale data from previous pack
  useEffect(() => {
    if (selectedPackId !== prevPackIdRef.current) {
      prevPackIdRef.current = selectedPackId;
      setLocalData(null);
    }
  }, [selectedPackId]);

  // Load on mount, when pack changes, or when manifest arrives (after pack switch)
  useEffect(() => {
    if (cachedData !== undefined) {
      setLocalData(cachedData as T);
    } else {
      load();
    }
  }, [selectedPackId, packManifest, cachedData, load]);

  return {
    data: localData,
    loading: isLoading,
    error: artifactError,
    reload: load,
  };
}
