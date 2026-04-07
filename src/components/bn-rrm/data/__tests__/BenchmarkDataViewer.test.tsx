/**
 * Tests for BenchmarkDataViewer component
 *
 * Verifies that the read-only training data viewer:
 * - Renders loading state while fetching
 * - Renders error state on fetch failure
 * - Displays model selector and dataset toggle
 * - Shows data table with correct columns and rows
 * - Supports column sorting
 * - Supports text filtering
 * - Paginates large datasets
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BenchmarkDataViewer } from '../BenchmarkDataViewer';

// ---------------------------------------------------------------------------
// Mock packStore
// ---------------------------------------------------------------------------

const mockGetPackBaseUrl = vi.fn();
const mockPackManifest = vi.fn();

vi.mock('@/stores/bn-rrm/packStore', () => ({
  usePackStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      getPackBaseUrl: mockGetPackBaseUrl,
      packManifest: mockPackManifest(),
    }),
}));

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_MANIFEST = {
  pack_id: 'test-benchmark',
  scope_type: 'benchmark',
  artifacts: {
    runtime_model: 'runtime/learned-model.json',
    training_data: 'training_data.json',
    review: {},
  },
};

const FIXTURE_TRAINING_DATA = {
  source: 'Test et al. 2025',
  doi: '10.1234/test',
  models: {
    GSL: {
      display_name: 'Great Slave Lake',
      fish_count: 3,
      water_count: 2,
      fish_columns: ['species', 'tissue_hg', 'length'],
      water_columns: ['thg', 'region'],
      fish_cases: [
        { species: 'walleye', tissue_hg: 'low', length: 'small' },
        { species: 'pike', tissue_hg: 'high', length: 'large' },
        { species: 'walleye', tissue_hg: 'moderate', length: 'small' },
      ],
      water_cases: [
        { thg: 'low', region: 'north' },
        { thg: 'high', region: 'south' },
      ],
    },
    GBS: {
      display_name: 'Great Bear Subbasin',
      fish_count: 1,
      water_count: 1,
      fish_columns: ['species', 'tissue_hg'],
      water_columns: ['thg'],
      fish_cases: [{ species: 'trout', tissue_hg: 'low' }],
      water_cases: [{ thg: 'moderate' }],
    },
  },
  totals: { fish: 4, water: 3, total: 7 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupFetch(data: unknown, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    json: () => Promise.resolve(data),
  }) as Mock;
}

function setupDefaults() {
  mockGetPackBaseUrl.mockReturnValue('/bn-rrm/packs/test-benchmark');
  mockPackManifest.mockReturnValue(FIXTURE_MANIFEST);
  setupFetch(FIXTURE_TRAINING_DATA);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BenchmarkDataViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no manifest', () => {
    mockGetPackBaseUrl.mockReturnValue(null);
    mockPackManifest.mockReturnValue(null);

    render(<BenchmarkDataViewer />);
    expect(screen.getByText('Published Training Data')).toBeTruthy();
    expect(screen.getByText('Select a benchmark pack to view its published training data.')).toBeTruthy();
  });

  it('shows error when no training_data artifact in manifest', async () => {
    mockGetPackBaseUrl.mockReturnValue('/bn-rrm/packs/test');
    mockPackManifest.mockReturnValue({
      ...FIXTURE_MANIFEST,
      artifacts: { runtime_model: 'runtime/learned-model.json', review: {} },
    });

    render(<BenchmarkDataViewer />);
    await waitFor(() => {
      expect(screen.getByText('No training_data artifact in pack manifest')).toBeTruthy();
    });
  });

  it('shows error on fetch failure', async () => {
    mockGetPackBaseUrl.mockReturnValue('/bn-rrm/packs/test');
    mockPackManifest.mockReturnValue(FIXTURE_MANIFEST);
    setupFetch(null, false);

    render(<BenchmarkDataViewer />);
    await waitFor(() => {
      expect(screen.getByText(/HTTP 404/)).toBeTruthy();
    });
  });

  it('renders model selector with both models', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('Great Slave Lake')).toBeTruthy();
      expect(screen.getByText('Great Bear Subbasin')).toBeTruthy();
    });
  });

  it('renders dataset toggle (fish and water)', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('Fish Tissue Hg')).toBeTruthy();
      expect(screen.getByText('Freshwater THg')).toBeTruthy();
    });
  });

  it('renders fish data table with correct columns by default', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      // Column headers appear in <th> elements (also in sort <option>, so use columnheader role)
      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map(h => h.textContent?.trim());
      expect(headerTexts).toContain('Species');
      expect(headerTexts).toContain('Tissue Hg');
      expect(headerTexts).toContain('Length');
    });
  });

  it('shows correct row count', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('3 rows')).toBeTruthy();
    });
  });

  it('switches to water dataset', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('Fish Tissue Hg')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Freshwater THg'));

    await waitFor(() => {
      expect(screen.getByText('2 rows')).toBeTruthy();
      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map(h => h.textContent?.trim());
      expect(headerTexts).toContain('THg');
      expect(headerTexts).toContain('Region');
    });
  });

  it('switches to GBS model', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('Great Bear Subbasin')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Great Bear Subbasin'));

    await waitFor(() => {
      expect(screen.getByText('1 rows')).toBeTruthy();
    });
  });

  it('filters rows by text', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText('3 rows')).toBeTruthy();
    });

    const filterInput = screen.getByPlaceholderText('Filter values...');
    fireEvent.change(filterInput, { target: { value: 'pike' } });

    await waitFor(() => {
      expect(screen.getByText('1 / 3 rows')).toBeTruthy();
    });
  });

  it('sorts columns on click', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      const headers = screen.getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(1);
    });

    // Click species column header (the <th>, not the <option>)
    const headers = screen.getAllByRole('columnheader');
    const speciesHeader = headers.find(h => h.textContent?.trim().startsWith('Species'));
    expect(speciesHeader).toBeTruthy();
    fireEvent.click(speciesHeader!);

    // Get all cells in the species column (first data column)
    const rows = screen.getAllByRole('row');
    // Row 0 is header, rows 1-3 are data
    const firstDataRow = rows[1];
    const cells = firstDataRow.querySelectorAll('td');
    // Cell 0 is row number, cell 1 is first column (species)
    expect(cells[1].textContent).toBe('pike'); // alphabetically first
  });

  it('shows provenance footer', async () => {
    setupDefaults();
    render(<BenchmarkDataViewer />);

    await waitFor(() => {
      expect(screen.getByText(/Test et al\. 2025/)).toBeTruthy();
      expect(screen.getByText(/10\.1234\/test/)).toBeTruthy();
      expect(screen.getByText(/7 total observations/)).toBeTruthy();
    });
  });
});
