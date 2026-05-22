import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { MatrixMapData, MatrixSample } from '@/app/(dashboard)/matrix-map/types';
import { useMatrixMapFilterStore } from '@/stores/matrix-map/filterStore';
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

const COPPER_ID = '11111111-1111-4111-8111-111111111111';
const LEAD_ID = '22222222-2222-4222-8222-222222222222';

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
  visible_samples: [
    makeSample({ id: 'sample-a', station_id: 'STA-1' }),
    makeSample({ id: 'sample-b', station_id: 'STA-2', classification: 'unknown' }),
  ],
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'test',
};

function measurementRows() {
  return [
    {
      sample_id: 'sample-a',
      sample_station_id: 'STA-1',
      sample_event_id: 'event-a',
      event_date: '2026-01-02',
      measurement_id: 'measurement-a',
      medium: 'sediment',
      substance_id: COPPER_ID,
      substance_key: 'copper',
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
    {
      sample_id: 'sample-b',
      sample_station_id: 'STA-2',
      sample_event_id: 'event-b',
      event_date: '2026-01-03',
      measurement_id: 'measurement-b',
      medium: 'water',
      substance_id: LEAD_ID,
      substance_key: 'lead',
      substance_display_name: 'Lead',
      value: 4,
      unit: 'ug/L',
      detection_limit: null,
      qualifier: null,
      censored: false,
      coordinate_quality_tier: 'medium',
      classification: 'unknown',
      source_dra_id: 'dra-1',
      source_dra_title: 'Source DRA',
    },
  ];
}

function renderPanel(over: Partial<React.ComponentProps<typeof MatrixMapRightPanel>> = {}) {
  return render(
    <MatrixMapRightPanel
      initialMapData={MAP_DATA}
      substanceKey="copper"
      isFocused={false}
      onToggleFocus={vi.fn()}
      {...over}
    />,
  );
}

describe('MatrixMapRightPanel', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    useMatrixMapSelectionStore.setState({
      selectedSampleId: null,
      selectedSampleIds: [],
      panRequestedSampleId: null,
      panRequestSeq: 0,
    });
    useMatrixMapFilterStore.getState().resetFilters();
  });

  it('renders the empty state without calling the RPC when no samples are selected', () => {
    renderPanel();
    expect(screen.getByTestId('matrix-map-right-panel-empty')).toBeInTheDocument();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('fetches measurements for selected samples and does not auto-filter to Calculator substance', async () => {
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: 'sample-a',
    });

    renderPanel({ substanceKey: 'copper' });

    await waitFor(() => {
      expect(screen.getByText('Copper')).toBeInTheDocument();
      expect(screen.getByText('Lead')).toBeInTheDocument();
    });
    expect(rpcMock).toHaveBeenCalledWith('fetch_measurements_for_samples', {
      p_sample_ids: ['sample-a', 'sample-b'],
    });
  });

  it('searches, selects, chips, and clears substance filters', async () => {
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: null,
    });

    renderPanel();

    await screen.findByText('Copper');
    fireEvent.click(screen.getByRole('button', { name: /All substances/i }));
    fireEvent.change(screen.getByLabelText(/Search substances/i), {
      target: { value: 'lead' },
    });
    fireEvent.click(screen.getByLabelText('Lead'));

    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(within(screen.getByTestId('matrix-map-measurement-table-scroll')).queryByText('Copper')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('matrix-map-measurement-table-scroll')).getByText('Lead')).toBeInTheDocument();
    expect(useMatrixMapFilterStore.getState().filterState.substance_ids).toEqual([LEAD_ID]);

    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    const table = screen.getByTestId('matrix-map-measurement-table-scroll');
    await waitFor(() => {
      expect(within(table).getByText('Copper')).toBeInTheDocument();
      expect(within(table).getByText('Lead')).toBeInTheDocument();
    });
  });

  it('filters to the Calculator substance only when the shortcut is clicked', async () => {
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: null,
    });

    renderPanel({ substanceKey: 'copper' });

    await screen.findByText('Lead');
    fireEvent.click(screen.getByRole('button', { name: /All substances/i }));
    fireEvent.click(screen.getByRole('button', { name: /Filter to Calculator substance/i }));

    const table = screen.getByTestId('matrix-map-measurement-table-scroll');
    expect(within(table).getByText('Copper')).toBeInTheDocument();
    expect(within(table).queryByText('Lead')).not.toBeInTheDocument();
    expect(useMatrixMapFilterStore.getState().filterState.substance_ids).toEqual([COPPER_ID]);
  });

  it('uses a dedicated scroll container with sticky table headers', async () => {
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: null,
    });

    renderPanel();

    await screen.findByText('Copper');
    const scrollRegion = screen.getByTestId('matrix-map-measurement-table-scroll');
    expect(scrollRegion.className).toContain('overflow-auto');
    expect(screen.getByRole('columnheader', { name: 'Sample' }).className).toContain('sticky');
  });

  it('focus toggle preserves filter state, active row, and multi-sample selection across rerender', async () => {
    const onToggleFocus = vi.fn();
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: null,
    });

    const { rerender } = renderPanel({ isFocused: false, onToggleFocus });

    await screen.findByText('Copper');
    fireEvent.click(screen.getByRole('button', { name: /All substances/i }));
    fireEvent.click(screen.getByLabelText('Copper'));
    await act(async () => {
      fireEvent.click(screen.getByText('STA-1'));
    });
    fireEvent.click(screen.getByRole('button', { name: /Focus measurement workbench/i }));

    expect(onToggleFocus).toHaveBeenCalledTimes(1);
    rerender(
      <MatrixMapRightPanel
        initialMapData={MAP_DATA}
        substanceKey="copper"
        isFocused
        onToggleFocus={onToggleFocus}
      />,
    );

    expect(within(screen.getByTestId('matrix-map-measurement-table-scroll')).getByText('Copper')).toBeInTheDocument();
    expect(useMatrixMapFilterStore.getState().filterState.substance_ids).toEqual([COPPER_ID]);
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['sample-a', 'sample-b']);
    expect(screen.getByText('STA-1').closest('tr')?.className).toContain('bg-blue');
  });

  it('warns without dropping selected samples hidden by filters', async () => {
    rpcMock.mockResolvedValue({ data: measurementRows(), error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a', 'sample-b'],
      selectedSampleId: null,
    });

    renderPanel();

    await screen.findByText('Copper');
    fireEvent.click(screen.getByRole('button', { name: /All substances/i }));
    fireEvent.click(screen.getByLabelText('Copper'));

    expect(screen.getByText(/1 selected sample is outside the active filters/)).toBeInTheDocument();
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['sample-a', 'sample-b']);
  });

  it('renders an error instead of staying loading when the RPC throws', async () => {
    rpcMock.mockRejectedValue(new Error('network down'));
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a'],
      selectedSampleId: 'sample-a',
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(/Unable to load measurements for this selection/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Loading measurements/)).not.toBeInTheDocument();
  });

  it('row click requests map pan through the selection store', async () => {
    rpcMock.mockResolvedValue({ data: [measurementRows()[0]], error: null });
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['sample-a'],
      selectedSampleId: null,
    });

    renderPanel();
    await screen.findByText('Copper');

    await act(async () => {
      fireEvent.click(screen.getByText('STA-1'));
    });
    expect(useMatrixMapSelectionStore.getState().panRequestedSampleId).toBe('sample-a');
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['sample-a']);
  });
});
