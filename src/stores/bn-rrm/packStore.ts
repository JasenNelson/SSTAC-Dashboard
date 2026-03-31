/**
 * Pack Store
 *
 * Zustand store managing BN-RRM model pack selection and artifact loading.
 * The selectedPackId is the single source of truth — all artifact resolution
 * flows through it. No component independently resolves a static artifact path.
 *
 * @see src/lib/bn-rrm/pack-types.ts for type definitions
 * @see bn_learning/pack_schema/PACK_GOVERNANCE_CONVENTION.md for rules
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  PackManifest,
  PackRegistry,
  PackRegistryEntry,
  ReviewArtifactKey,
} from '@/lib/bn-rrm/pack-types';
import { assertCanonicalSchema, CANONICAL_SCHEMA_VERSION } from '@/lib/bn-rrm/pack-types';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base URL for pack assets served from public/ */
const PACK_BASE_URL = '/bn-rrm';
const REGISTRY_URL = `${PACK_BASE_URL}/pack-registry.json`;

// =============================================================================
// STORE INTERFACE
// =============================================================================

interface PackState {
  // Registry
  registry: PackRegistry | null;
  registryLoaded: boolean;
  registryError: string | null;

  // Selected pack
  selectedPackId: string | null;
  packManifest: PackManifest | null;
  packLoading: boolean;
  packError: string | null;

  // Cached review artifacts (lazy-loaded per tab visit)
  reviewArtifactCache: Partial<Record<ReviewArtifactKey, unknown>>;
  reviewArtifactLoading: Partial<Record<ReviewArtifactKey, boolean>>;
  reviewArtifactErrors: Partial<Record<ReviewArtifactKey, string>>;

  // Actions
  loadRegistry: () => Promise<void>;
  selectPack: (packId: string) => Promise<void>;
  loadReviewArtifact: <T = unknown>(key: ReviewArtifactKey) => Promise<T | null>;

  // Derived helpers
  getPackEntry: (packId: string) => PackRegistryEntry | undefined;
  getDefaultPackId: () => string | null;
  getPackBaseUrl: () => string | null;
}

// =============================================================================
// STORE IMPLEMENTATION
// =============================================================================

export const usePackStore = create<PackState>()(
  devtools(
    (set, get) => ({
      // Initial state
      registry: null,
      registryLoaded: false,
      registryError: null,

      selectedPackId: null,
      packManifest: null,
      packLoading: false,
      packError: null,

      reviewArtifactCache: {},
      reviewArtifactLoading: {},
      reviewArtifactErrors: {},

      // =====================================================================
      // REGISTRY
      // =====================================================================

      loadRegistry: async () => {
        try {
          const res = await fetch(REGISTRY_URL);
          if (!res.ok) {
            throw new Error(`Failed to load pack registry: ${res.status} ${res.statusText}`);
          }
          const registry: PackRegistry = await res.json();

          // Validate: exactly one default
          const defaults = registry.packs.filter(p => p.is_default);
          if (defaults.length !== 1) {
            console.warn(
              `[PackStore] Expected exactly 1 default pack, found ${defaults.length}`
            );
          }

          set({ registry, registryLoaded: true, registryError: null });

          // Auto-select default pack
          const defaultId = registry.default_pack_id;
          if (defaultId && !get().selectedPackId) {
            await get().selectPack(defaultId);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[PackStore] Registry load failed:', msg);
          set({ registryError: msg, registryLoaded: true });
        }
      },

      // =====================================================================
      // PACK SELECTION
      // =====================================================================

      selectPack: async (packId: string) => {
        const { registry } = get();
        if (!registry) {
          set({ packError: 'Cannot select pack: registry not loaded' });
          return;
        }

        const entry = registry.packs.find(p => p.pack_id === packId);
        if (!entry) {
          set({ packError: `Pack '${packId}' not found in registry` });
          return;
        }

        set({
          selectedPackId: packId,  // Set immediately so UI reacts before fetch completes
          packLoading: true,
          packError: null,
          // Keep packManifest from previous pack during fetch — clearing it causes
          // artifact hooks to return "not available" and BNRRMClient to hit the
          // legacy fallback path. The old manifest is harmless; it gets replaced
          // when the fetch completes. Artifact cache IS cleared so stale data
          // from the old pack won't be served.
          reviewArtifactCache: {},
          reviewArtifactLoading: {},
          reviewArtifactErrors: {},
        });

        try {
          const packUrl = `${PACK_BASE_URL}/${entry.path}/pack.json`;
          const res = await fetch(packUrl);
          if (!res.ok) {
            throw new Error(`Failed to load pack manifest: ${res.status} ${res.statusText}`);
          }
          const manifest: PackManifest = await res.json();

          // Validate canonical schema
          assertCanonicalSchema(manifest);

          set({
            packManifest: manifest,
            packLoading: false,
            packError: null,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[PackStore] Pack load failed:', msg);
          set({
            packLoading: false,
            packError: msg,
          });
        }
      },

      // =====================================================================
      // LAZY ARTIFACT LOADING
      // =====================================================================

      loadReviewArtifact: async <T = unknown>(key: ReviewArtifactKey): Promise<T | null> => {
        const { packManifest, reviewArtifactCache, selectedPackId, registry } = get();

        // Return cached if available
        if (reviewArtifactCache[key] !== undefined) {
          return reviewArtifactCache[key] as T;
        }

        if (!packManifest || !selectedPackId || !registry) {
          return null;
        }

        // Guard: manifest must belong to the currently selected pack.
        // During pack switching, selectedPackId updates immediately but
        // packManifest may still be the old pack's manifest until the
        // new manifest fetch completes. Don't resolve artifact paths
        // from a stale manifest.
        if (packManifest.pack_id !== selectedPackId) {
          return null;
        }

        const entry = registry.packs.find(p => p.pack_id === selectedPackId);
        if (!entry) return null;

        // Validate artifact path exists in manifest
        const artifactPath = packManifest.artifacts.review[key];
        if (!artifactPath) {
          const msg = `Artifact '${key}' not defined in pack manifest for '${selectedPackId}'`;
          console.warn(`[PackStore] ${msg}`);
          set({
            reviewArtifactErrors: { ...get().reviewArtifactErrors, [key]: msg },
          });
          return null;
        }

        // Capture the pack ID at fetch start to detect stale responses
        const fetchPackId = selectedPackId;

        // Mark loading
        set({
          reviewArtifactLoading: { ...get().reviewArtifactLoading, [key]: true },
        });

        try {
          const url = `${PACK_BASE_URL}/${entry.path}/${artifactPath}`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Failed to load ${key}: ${res.status}`);
          }
          const data = await res.json();

          // Guard against stale fetch: if pack changed during fetch, discard result
          if (get().selectedPackId !== fetchPackId) {
            return null;
          }

          set({
            reviewArtifactCache: { ...get().reviewArtifactCache, [key]: data },
            reviewArtifactLoading: { ...get().reviewArtifactLoading, [key]: false },
          });

          return data as T;
        } catch (err) {
          // Discard errors from stale fetches
          if (get().selectedPackId !== fetchPackId) {
            return null;
          }
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[PackStore] Artifact '${key}' load failed:`, msg);
          set({
            reviewArtifactLoading: { ...get().reviewArtifactLoading, [key]: false },
            reviewArtifactErrors: { ...get().reviewArtifactErrors, [key]: msg },
          });
          return null;
        }
      },

      // =====================================================================
      // HELPERS
      // =====================================================================

      getPackEntry: (packId: string) => {
        return get().registry?.packs.find(p => p.pack_id === packId);
      },

      getDefaultPackId: () => {
        return get().registry?.default_pack_id ?? null;
      },

      getPackBaseUrl: () => {
        const { selectedPackId, registry } = get();
        if (!selectedPackId || !registry) return null;
        const entry = registry.packs.find(p => p.pack_id === selectedPackId);
        if (!entry) return null;
        return `${PACK_BASE_URL}/${entry.path}`;
      },
    }),
    { name: 'bn-rrm-pack-store' }
  )
);
