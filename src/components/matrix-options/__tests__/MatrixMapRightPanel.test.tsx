import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { MatrixMapData, MatrixSample } from '@/app/(dashboard)/matrix-map/types';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import { MatrixMapRightPanel } from '../MatrixMapRightPanel';

const rpcMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    schema: () => ({
      rpc: rpcMock,
    }),
  }),
}));

vi.mock('@/lib/admin-utils', () => ({
  checkCurrentUserAdminStatus: vi.fn(() => new Promise<boolean>(() => {})),
}));

function makeSample(over: Partial<MatrixSample> = {}): MatrixSample {
  return {
    id: 'sample-a',
    bnrrm_station_id: 1,
    station_id: 'STA-1',
    display_name: 'Station 1',
    geometry: { type: 'Point', coordinates: [-123, 49] },
    coordinate_quality_tier: 'high',
    coordinate_source: 'surveyed',
    classification: 'reference',
    classification_source: 'station_type',
    classification_rationale: null,
    classification_confidence: 'high',
    source_dra_id: 'dra-1',
    public: false,
    bc_region: 'Region',
    waterbody: 'Waterbody',
    waterbody_type: null,
    ...over,
  };
}

const MAP_DATA: MatrixMapData = {
  visible_samples: [makeSample()],
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'test',
};

describe('MatrixMapRightPanel', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    useMatrixMapSelectionStore.setState({
      selectedSampleId: null,
      selectedSampleIds: [],
      panRequestedSampleId: null,
      panRequestSeq: 0,
    });
  });

  it('renders the empty state without calling the RPC when no samples are selected', () => {
    render(<MatrixMapRightPanel initialMapData={MAP_DATA} />);
    expect(screen.getByTestId('matrix-map-right-panel-empty')).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('fetches measurements for selected samples and renders the table', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sample_id: 'sample-a',
          sample_station_id: 'STA-1',
          event_date: '2026-01-02',
          medium: 'sediment',
          substance_display_name: 'Copper',
          value: 12.5,
          unit: 'mg/kg',
          detection_limit: null,
          qualifier: null,
          censored: false,
          coordinate_quality_tier: 'high',
          classification: 'reference',
          source_dra_id: 'dra-1',
          source_dra_title: 'Source DRA',
        },
      ],
      error: null,
    });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a'],
      selectedSampleId: 'sample-a',
    });

    render(<MatrixMapRightPanel initialMapData={MAP_DATA} />);

    await waitFor(() => {
      expect(screen.getByText('Copper')).toBeInTheDocument();
    });
    expect(rpcMock).toHaveBeenCalledWith('fetch_measurements_for_samples', {
      p_sample_ids: ['sample-a'],
    });
  });

  it('renders an error instead of staying loading when the RPC throws', async () => {
    rpcMock.mockRejectedValue(new Error('network down'));
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a'],
      selectedSampleId: 'sample-a',
    });

    render(<MatrixMapRightPanel initialMapData={MAP_DATA} />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load measurements for this selection/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading measurements/)).not.toBeInTheDocument();
  });

  it('row click requests map pan through the selection store', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          sample_id: 'sample-a',
          sample_station_id: 'STA-1',
          event_date: '2026-01-02',
          medium: 'sediment',
          substance_display_name: 'Copper',
          value: 12.5,
          unit: 'mg/kg',
          censored: false,
          coordinate_quality_tier: 'high',
          classification: 'reference',
        },
      ],
      error: null,
    });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a'],
      selectedSampleId: null,
    });

    render(<MatrixMapRightPanel initialMapData={MAP_DATA} />);
    await waitFor(() => {
      expect(screen.getByText('Copper')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('STA-1'));
    });
    expect(useMatrixMapSelectionStore.getState().panRequestedSampleId).toBe('sample-a');
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['sample-a']);
  });
});
