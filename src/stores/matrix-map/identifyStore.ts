/**
 * Matrix-map Identify Store
 *
 * Cross-component pub/sub for identify-tool + identify-area results in the
 * matrix-options Interactive Map. MatrixMap.tsx (Path-B fork) is the
 * authoritative WRITER; MatrixMapLeftPanel.tsx is the READER.
 *
 * Why a separate store from src/stores/bn-rrm/siteDataStore:
 *   MatrixMap.tsx is a Path-B fork that explicitly removed the bn-rrm
 *   Zustand dependency (memory anchor:
 *   dashboard_matrix_map_pr_map_3_post_mortem_2026_05_20). The bn-rrm
 *   store carries SiteData / assessment / upload-pack state irrelevant
 *   to matrix-options. A small dedicated store keeps the coupling
 *   surface minimal and previews the PR-MAP-11 SelectionStore pattern.
 *
 * Identify state is intentionally NOT persisted (no persist middleware):
 *   Stale identified features would have no map context on reload, and
 *   the popup at click coords is the user's working surface within a
 *   single session.
 *
 * Contract:
 *   - Caller of setIdentifiedFeatures is responsible for topmost-first
 *     ordering. The store does NOT re-sort.
 *   - setIdentifiedFeatures auto-promotes primaryFeatureIndex to 0
 *     when features is non-empty, NULL when empty.
 *   - clearIdentifiedFeatures resets both fields to empty / null.
 *
 * Plain ASCII only. No em-dashes, no Unicode arrows.
 */

import { create } from 'zustand';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';

export interface IdentifyState {
  identifiedFeatures: IdentifiedFeature[];
  primaryFeatureIndex: number | null;
  setIdentifiedFeatures: (features: IdentifiedFeature[]) => void;
  setPrimaryFeatureIndex: (i: number) => void;
  clearIdentifiedFeatures: () => void;
}

export const useMatrixMapIdentifyStore = create<IdentifyState>()((set) => ({
  identifiedFeatures: [],
  primaryFeatureIndex: null,

  setIdentifiedFeatures: (features) => {
    set({
      identifiedFeatures: features,
      primaryFeatureIndex: features.length > 0 ? 0 : null,
    });
  },

  setPrimaryFeatureIndex: (i) => {
    set((state) => {
      // Mirror the bn-rrm slice bounds guard: reject out-of-range
      // indices so the index never points outside identifiedFeatures.
      // Without this, IdentifiedFeaturesList would silently render
      // without a valid primary row when callers (or tests) pass a
      // stale index after the list shrinks.
      if (i < 0 || i >= state.identifiedFeatures.length) return state;
      return { primaryFeatureIndex: i };
    });
  },

  clearIdentifiedFeatures: () => {
    set({ identifiedFeatures: [], primaryFeatureIndex: null });
  },
}));
