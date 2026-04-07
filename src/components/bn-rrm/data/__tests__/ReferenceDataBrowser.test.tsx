/**
 * Tests for ReferenceDataBrowser component
 *
 * Verifies that the reference data browser:
 * - Shows empty state when no benchmark packs exist
 * - Lists benchmark packs from registry
 * - Fetches manifests for benchmark packs
 * - Handles manifest fetch errors
 * - Navigates to training data table on pack select
 * - Shows loading state while fetching training data
 * - Shows error state on training data fetch failure
 * - Back button returns to pack list
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferenceDataBrowser } from '../ReferenceDataBrowser';

// ---------------------------------------------------------------------------
// Mock packStore
// ---------------------------------------------------------------------------

const mockRegistry = vi.fn();

vi.mock('@/stores/bn-rrm/packStore', () => ({
  usePackStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      registry: mockRegistry(),
    }),
}));

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_REGISTRY = {
  packs: [
    {
      pack_id: 'bench-1',
      display_name: 'Mercury Benchmark',
      scope_type: 'benchmark',
      path: 'packs/bench-1',
      is_default: false,
    },
    {
      pack_id: 'general-v1',
      display_name: 'General Model',
      scope_type: 'general',
      path: 'packs/general-v1',
      is_default: true,
    },
  ],
};

const FIXTURE_MANIFEST = {
  pack_id: 'bench-1',
  scope_type: 'benchmark',
  release_stage: 'published',
  training_corpus: {
    cohort_rule: 'Mercury fish tissue and water samples',
    n_sites: 5,
    n_stations: 100,
    n_co_located: 80,
    n_fish_cases: 60,
    n_water_cases: 40,
  },
  artifacts: {
    runtime_model: 'runtime/learned-model.json',
    training_data: 'training_data.json',
    review: {},
  },
};

const FIXTURE_TRAINING_DATA = {
  source: 'Jermilova et al. 2025',
  doi: '10.20383/103.0945',
  models: {
    GSL: {
      display_name: 'Great Slave Lake',
      fish_count: 2,
      water_count: 1,
      fish_columns: ['species', 'tissue_hg'],
      water_columns: ['thg'],
      fish_cases: [
        { species: 'walleye', tissue_hg: 'low' },
        { species: 'pike', tissue_hg: 'high' },
      ],
      water_cases: [{ thg: 'moderate' }],
    },
  },
  totals: { fish: 2, water: 1, total: 3 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupFetchSequence(responses: { data: unknown; ok: boolean }[]) {
  let callIdx = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    const resp = responses[callIdx] ?? responses[responses.length - 1];
    callIdx++;
    return Promise.resolve({
      ok: resp.ok,
      status: resp.ok ? 200 : 404,
      json: () => Promise.resolve(resp.data),
    });
  }) as Mock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReferenceDataBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no benchmark packs in registry', () => {
    mockRegistry.mockReturnValue({ packs: [{ pack_id: 'gen', scope_type: 'general', display_name: 'General' }] });

    render(<ReferenceDataBrowser />);
    expect(screen.getByText('No Reference Datasets Available')).toBeTruthy();
  });

  it('shows empty state when registry is null', () => {
    mockRegistry.mockReturnValue(null);

    render(<ReferenceDataBrowser />);
    expect(screen.getByText('No Reference Datasets Available')).toBeTruthy();
  });

  it('lists benchmark packs from registry', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([{ data: FIXTURE_MANIFEST, ok: true }]);

    render(<ReferenceDataBrowser />);

    expect(screen.getByText('Mercury Benchmark')).toBeTruthy();
    // General model should NOT appear (not a benchmark)
    expect(screen.queryByText('General Model')).toBeNull();
  });

  it('shows manifest metadata after fetch', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([{ data: FIXTURE_MANIFEST, ok: true }]);

    render(<ReferenceDataBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Mercury fish tissue and water samples')).toBeTruthy();
      expect(screen.getByText('100 total observations')).toBeTruthy();
    });
  });

  it('handles manifest fetch error gracefully', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([{ data: null, ok: false }]);

    render(<ReferenceDataBrowser />);

    await waitFor(() => {
      expect(screen.getByText(/HTTP 404/)).toBeTruthy();
    });
  });

  it('navigates to training data table on pack select', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    // First fetch: manifest. Second fetch: training data.
    setupFetchSequence([
      { data: FIXTURE_MANIFEST, ok: true },
      { data: FIXTURE_TRAINING_DATA, ok: true },
    ]);

    render(<ReferenceDataBrowser />);

    // Wait for manifest to load
    await waitFor(() => {
      expect(screen.getByText('Mercury Benchmark')).toBeTruthy();
    });

    // Click the benchmark pack
    fireEvent.click(screen.getByText('Mercury Benchmark'));

    // Should show training data table
    await waitFor(() => {
      expect(screen.getByText('Great Slave Lake')).toBeTruthy();
      expect(screen.getByText(/Jermilova et al\. 2025/)).toBeTruthy();
    });
  });

  it('shows error when training data fetch fails', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([
      { data: FIXTURE_MANIFEST, ok: true },
      { data: null, ok: false },
    ]);

    render(<ReferenceDataBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Mercury Benchmark')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Mercury Benchmark'));

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Training Data')).toBeTruthy();
    });
  });

  it('back button returns to pack list from error state', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([
      { data: FIXTURE_MANIFEST, ok: true },
      { data: null, ok: false },
    ]);

    render(<ReferenceDataBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Mercury Benchmark')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Mercury Benchmark'));

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Training Data')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Back to reference datasets'));

    await waitFor(() => {
      expect(screen.getByText('Reference Datasets')).toBeTruthy();
    });
  });

  it('back button returns to pack list from data view', async () => {
    mockRegistry.mockReturnValue(FIXTURE_REGISTRY);
    setupFetchSequence([
      { data: FIXTURE_MANIFEST, ok: true },
      { data: FIXTURE_TRAINING_DATA, ok: true },
    ]);

    render(<ReferenceDataBrowser />);

    await waitFor(() => {
      expect(screen.getByText('Mercury Benchmark')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Mercury Benchmark'));

    await waitFor(() => {
      expect(screen.getByText('All reference data')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('All reference data'));

    await waitFor(() => {
      expect(screen.getByText('Reference Datasets')).toBeTruthy();
    });
  });
});
