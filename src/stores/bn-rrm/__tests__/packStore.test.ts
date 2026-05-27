/**
 * Tests for packStore.ts (usePackStore).
 *
 * Strategy: real Zustand store with setState resets; global fetch is stubbed per test.
 * Does not exercise actual HTTP -- all network calls go through stubbed fetch.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PackRegistry, PackManifest } from '@/lib/bn-rrm/pack-types';
import { usePackStore } from '../packStore';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeRegistry(defaultId = 'pack-a'): PackRegistry {
  return {
    schema_version: '1.0',
    default_pack_id: defaultId,
    packs: [
      { pack_id: 'pack-a', display_name: 'Pack A', scope_type: 'general', release_stage: 'published', is_default: true, path: 'packs/pack-a' },
      { pack_id: 'pack-b', display_name: 'Pack B', scope_type: 'general', release_stage: 'internal', is_default: false, path: 'packs/pack-b' },
    ],
  };
}

function makeManifest(packId = 'pack-a'): PackManifest {
  return {
    pack_id: packId,
    display_name: 'Pack A',
    model_family: 'general',
    scope_type: 'general',
    site_scope: null,
    site_inventory: [],
    runtime_schema_version: 'canonical-20node-v1',
    dag_node_count: 20,
    dag_edge_count: 24,
    training_corpus: {
      n_stations: 10,
      n_co_located: 5,
      n_sites: 3,
      cohort_rule: 'all',
      dataset_status: 'final',
    },
    evaluation_profile: {
      decision_rule: 'MAP',
      primary_metric: 'accuracy',
      loo_accuracy: 0.8,
    },
    release_stage: 'published',
    is_default: true,
    parent_pack_id: null,
    applicability_boundaries: [],
    version_history: {
      created: '2026-01-01',
      model_version: '1.0.0',
      architecture_version: '1.0',
    },
    artifacts: {
      runtime_model: 'model.json',
      review: {
        model_overview: 'overview.json',
        validation: 'validation.json',
        comparison: 'comparison.json',
        decisions: 'decisions.json',
        cpt_transparency: 'cpt.json',
        provenance: 'provenance.json',
        site_reports: 'site_reports.json',
        risk_comparison: 'risk.json',
        explainer: 'explainer.json',
        sensitivity: 'sensitivity.json',
        published_reference: 'ref.json',
        comparison_results: 'comp_results.json',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Reset store before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  usePackStore.setState({
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
  });
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ===========================================================================
// Initial state
// ===========================================================================

describe('initial state', () => {
  it('has null registry and no selected pack', () => {
    const state = usePackStore.getState();
    expect(state.registry).toBeNull();
    expect(state.registryLoaded).toBe(false);
    expect(state.selectedPackId).toBeNull();
  });
});

// ===========================================================================
// getPackEntry / getDefaultPackId / getPackBaseUrl helpers
// ===========================================================================

describe('getPackEntry', () => {
  it('returns undefined when registry is null', () => {
    expect(usePackStore.getState().getPackEntry('pack-a')).toBeUndefined();
  });

  it('returns the matching entry when registry is loaded', () => {
    usePackStore.setState({ registry: makeRegistry() });
    const entry = usePackStore.getState().getPackEntry('pack-b');
    expect(entry?.pack_id).toBe('pack-b');
  });

  it('returns undefined for unknown pack_id', () => {
    usePackStore.setState({ registry: makeRegistry() });
    expect(usePackStore.getState().getPackEntry('unknown')).toBeUndefined();
  });
});

describe('getDefaultPackId', () => {
  it('returns null when registry is null', () => {
    expect(usePackStore.getState().getDefaultPackId()).toBeNull();
  });

  it('returns default_pack_id from registry', () => {
    usePackStore.setState({ registry: makeRegistry('pack-b') });
    expect(usePackStore.getState().getDefaultPackId()).toBe('pack-b');
  });
});

describe('getPackBaseUrl', () => {
  it('returns null when selectedPackId is null', () => {
    usePackStore.setState({ registry: makeRegistry() });
    expect(usePackStore.getState().getPackBaseUrl()).toBeNull();
  });

  it('returns null when registry is null', () => {
    usePackStore.setState({ selectedPackId: 'pack-a' });
    expect(usePackStore.getState().getPackBaseUrl()).toBeNull();
  });

  it('returns the correct base URL for the selected pack', () => {
    usePackStore.setState({ registry: makeRegistry(), selectedPackId: 'pack-a' });
    const url = usePackStore.getState().getPackBaseUrl();
    expect(url).toBe('/bn-rrm/packs/pack-a');
  });
});

// ===========================================================================
// selectPack
// ===========================================================================

describe('selectPack', () => {
  it('sets packError when registry is not loaded', async () => {
    await usePackStore.getState().selectPack('pack-a');
    expect(usePackStore.getState().packError).toMatch(/registry not loaded/i);
  });

  it('sets packError when pack_id not found in registry', async () => {
    usePackStore.setState({ registry: makeRegistry() });
    await usePackStore.getState().selectPack('nonexistent');
    expect(usePackStore.getState().packError).toMatch(/not found/i);
  });

  it('sets selectedPackId immediately and clears artifact cache', async () => {
    const manifest = makeManifest('pack-a');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => manifest,
    }));
    usePackStore.setState({
      registry: makeRegistry(),
      reviewArtifactCache: { model_overview: { data: 'old' } },
    });

    await usePackStore.getState().selectPack('pack-a');

    const state = usePackStore.getState();
    expect(state.selectedPackId).toBe('pack-a');
    expect(state.reviewArtifactCache).toEqual({});
    expect(state.packLoading).toBe(false);
  });

  it('loads and sets packManifest on successful fetch', async () => {
    const manifest = makeManifest('pack-a');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => manifest,
    }));
    usePackStore.setState({ registry: makeRegistry() });

    await usePackStore.getState().selectPack('pack-a');

    const state = usePackStore.getState();
    expect(state.packManifest?.pack_id).toBe('pack-a');
    expect(state.packError).toBeNull();
  });

  it('sets packError on HTTP failure and leaves packLoading=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' }));
    usePackStore.setState({ registry: makeRegistry() });

    await usePackStore.getState().selectPack('pack-a');

    const state = usePackStore.getState();
    expect(state.packError).toMatch(/503/);
    expect(state.packLoading).toBe(false);
  });

  it('sets packError when manifest fails assertCanonicalSchema', async () => {
    const badManifest = { ...makeManifest('pack-a'), dag_node_count: 99 }; // wrong node count
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => badManifest,
    }));
    usePackStore.setState({ registry: makeRegistry() });

    await usePackStore.getState().selectPack('pack-a');

    const state = usePackStore.getState();
    expect(state.packError).toMatch(/99 nodes/);
  });
});

// ===========================================================================
// loadRegistry
// ===========================================================================

describe('loadRegistry', () => {
  it('sets registryLoaded=true and registry on success', async () => {
    const registry = makeRegistry();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => registry,
    }));
    // Also stub the selectPack fetch so auto-select does not fail
    // by providing a valid manifest on second fetch call
    const manifest = makeManifest('pack-a');
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => registry })
      .mockResolvedValue({ ok: true, json: async () => manifest })
    );

    await usePackStore.getState().loadRegistry();

    const state = usePackStore.getState();
    expect(state.registryLoaded).toBe(true);
    expect(state.registry).toEqual(registry);
  });

  it('sets registryError on HTTP failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' }));

    await usePackStore.getState().loadRegistry();

    const state = usePackStore.getState();
    expect(state.registryLoaded).toBe(true);
    expect(state.registryError).toMatch(/500/);
    expect(state.registry).toBeNull();
  });

  it('sets registryError on network exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    await usePackStore.getState().loadRegistry();

    const state = usePackStore.getState();
    expect(state.registryError).toMatch(/Network failure/);
  });
});

// ===========================================================================
// loadReviewArtifact
// ===========================================================================

describe('loadReviewArtifact', () => {
  it('returns null when packManifest is not loaded', async () => {
    const result = await usePackStore.getState().loadReviewArtifact('model_overview');
    expect(result).toBeNull();
  });

  it('returns null when artifact key is not in manifest', async () => {
    const manifest = makeManifest('pack-a');
    // Remove the artifact path to simulate missing key
    (manifest.artifacts.review as unknown as Record<string, unknown>)['model_overview'] = undefined;
    usePackStore.setState({
      registry: makeRegistry(),
      selectedPackId: 'pack-a',
      packManifest: manifest,
    });

    const result = await usePackStore.getState().loadReviewArtifact('model_overview');
    expect(result).toBeNull();
    expect(usePackStore.getState().reviewArtifactErrors['model_overview']).toBeDefined();
  });

  it('returns cached value without fetching again', async () => {
    const cachedData = { title: 'Cached' };
    usePackStore.setState({
      registry: makeRegistry(),
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
      reviewArtifactCache: { model_overview: cachedData },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await usePackStore.getState().loadReviewArtifact('model_overview');
    expect(result).toBe(cachedData);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches artifact and caches it on success', async () => {
    const data = { overview: 'Model A overview' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    }));

    usePackStore.setState({
      registry: makeRegistry(),
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
    });

    const result = await usePackStore.getState().loadReviewArtifact('model_overview');
    expect(result).toEqual(data);
    expect(usePackStore.getState().reviewArtifactCache['model_overview']).toEqual(data);
    expect(usePackStore.getState().reviewArtifactLoading['model_overview']).toBe(false);
  });

  it('sets error and returns null on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    usePackStore.setState({
      registry: makeRegistry(),
      selectedPackId: 'pack-a',
      packManifest: makeManifest('pack-a'),
    });

    const result = await usePackStore.getState().loadReviewArtifact('validation');
    expect(result).toBeNull();
    expect(usePackStore.getState().reviewArtifactErrors['validation']).toMatch(/404/);
  });

  it('returns null when packManifest id does not match selectedPackId (stale manifest guard)', async () => {
    const manifest = makeManifest('pack-b'); // different id
    usePackStore.setState({
      registry: makeRegistry(),
      selectedPackId: 'pack-a',
      packManifest: manifest,
    });

    const result = await usePackStore.getState().loadReviewArtifact('model_overview');
    expect(result).toBeNull();
  });
});
