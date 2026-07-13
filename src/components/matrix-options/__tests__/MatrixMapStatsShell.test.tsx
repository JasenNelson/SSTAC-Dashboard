import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatrixMapStatsShell } from '../MatrixMapStatsShell';
import { useMatrixMapMeasurementStore } from '@/stores/matrix-map/measurementStore';
import { useMatrixMapFilterStore, DEFAULT_MATRIX_MAP_FILTER_STATE } from '@/stores/matrix-map/filterStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';

// Mock the Zustand stores
vi.mock('@/stores/matrix-map/measurementStore', () => ({
  useMatrixMapMeasurementStore: vi.fn(),
}));

vi.mock('@/stores/matrix-map/filterStore', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useMatrixMapFilterStore: vi.fn(),
  };
});

vi.mock('@/stores/matrix-map/selectionStore', () => ({
  useMatrixMapSelectionStore: vi.fn(),
}));

// Mock the child component
vi.mock('../MatrixMapSelectionStats', () => ({
  MatrixMapSelectionStats: ({ ready, isLoading, errorMessage }: any) => (
    <div data-testid="mock-stats-child">
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{String(errorMessage)}</span>
    </div>
  ),
}));

describe('MatrixMapStatsShell', () => {
  it('renders correctly with default store values', () => {
    vi.mocked(useMatrixMapMeasurementStore).mockImplementation((selector: any) => {
      const state = {
        rows: [],
        isLoading: false,
        errorMessage: null,
        selectedIdKey: 'sample-1',
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapSelectionStore).mockImplementation((selector: any) => {
      const state = {
        selectedSampleIds: ['sample-1'],
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapFilterStore).mockImplementation((selector: any) => {
      const state = {
        filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
      };
      return selector(state);
    });

    render(<MatrixMapStatsShell />);
    
    expect(screen.getByTestId('matrix-map-left-panel-stats-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mock-stats-child')).toBeInTheDocument();
    
    // It should be ready because selectedIdKey === selectedSampleIds.join('|')
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('passes ready=false when selectedIdKey does not match current selection', () => {
    vi.mocked(useMatrixMapMeasurementStore).mockImplementation((selector: any) => {
      const state = {
        rows: [],
        isLoading: false,
        errorMessage: null,
        selectedIdKey: 'sample-1', // different from selection
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapSelectionStore).mockImplementation((selector: any) => {
      const state = {
        selectedSampleIds: ['sample-2'],
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapFilterStore).mockImplementation((selector: any) => {
      const state = {
        filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
      };
      return selector(state);
    });

    render(<MatrixMapStatsShell />);
    
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
  });

  it('passes ready=false and isLoading=true when loading', () => {
    vi.mocked(useMatrixMapMeasurementStore).mockImplementation((selector: any) => {
      const state = {
        rows: [],
        isLoading: true,
        errorMessage: null,
        selectedIdKey: 'sample-1',
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapSelectionStore).mockImplementation((selector: any) => {
      const state = {
        selectedSampleIds: ['sample-1'],
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapFilterStore).mockImplementation((selector: any) => {
      const state = {
        filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
      };
      return selector(state);
    });

    render(<MatrixMapStatsShell />);
    
    expect(screen.getByTestId('ready')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('passes error state through to child', () => {
    vi.mocked(useMatrixMapMeasurementStore).mockImplementation((selector: any) => {
      const state = {
        rows: [],
        isLoading: false,
        errorMessage: 'Test error message',
        selectedIdKey: 'sample-1',
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapSelectionStore).mockImplementation((selector: any) => {
      const state = {
        selectedSampleIds: ['sample-1'],
      };
      return selector(state);
    });

    vi.mocked(useMatrixMapFilterStore).mockImplementation((selector: any) => {
      const state = {
        filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
      };
      return selector(state);
    });

    render(<MatrixMapStatsShell />);
    
    expect(screen.getByTestId('error')).toHaveTextContent('Test error message');
  });
});
