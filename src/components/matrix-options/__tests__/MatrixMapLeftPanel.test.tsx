// PR-MAP-10 tests: live identify-tool list in the matrix-options
// left "Selection Stats" panel. Locks the empty-state-vs-live swap
// behavior and the store wiring so future cleanup passes do not
// silently regress identify routing back to map-popup-only.
//
// REGRESSION discipline (per cross_project_never_delete_regression_tests_during_cleanup):
// do NOT remove these without explicit deletion of the corresponding feature.
//
// Phase 0 redesign (panel-redesign-2026-06-05):
//   - Substance card and medium radio card REMOVED from the left panel (both
//     features moved to the right panel). The tests that asserted on
//     matrix-map-left-panel-substance and the sediment/water/toxicity radio
//     buttons are removed here because the FEATURES themselves are deleted --
//     this is the permitted exception under the regression discipline.
//   - substanceKey prop dropped from renderPanel() helper.
//   - MatrixMapStatsShell placeholder assertions added.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';
import type { MatrixMapData, MatrixSample } from '@/app/(dashboard)/matrix-map/types';
import { useMatrixMapIdentifyStore } from '@/stores/matrix-map/identifyStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import { useMatrixMapMeasurementStore } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import { MatrixMapLeftPanel } from '../MatrixMapLeftPanel';

vi.mock('@/lib/admin-utils', () => ({
  checkCurrentUserAdminStatus: vi.fn(() => new Promise<boolean>(() => {})),
}));

function makeFeature(over: Partial<IdentifiedFeature> = {}): IdentifiedFeature {
  return {
    source: 'wms',
    layerKey: 'test-layer',
    layerLabel: 'Test Layer',
    properties: { name: 'Sample A', value: 42 },
    coordinates: { lat: 49.0, lng: -123.0 },
    capturedAt: 1737000000000,
    ...over,
  };
}

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
    makeSample({ id: 'ref-1', classification: 'reference' }),
    makeSample({ id: 'imp-1', classification: 'impacted', station_id: 'STA-2' }),
    makeSample({ id: 'unk-1', classification: 'unknown', station_id: 'STA-3' }),
  ],
  hidden_sample_count: 0,
  hidden_dra_count: 0,
  hidden_dra_ids: [],
  data_snapshot_version: 'test',
};

// Phase 0: substanceKey prop removed from the left panel; renderPanel
// no longer accepts or passes it.
function renderPanel() {
  return render(
    <MatrixMapLeftPanel
      initialMapData={MAP_DATA}
    />,
  );
}

describe('MatrixMapLeftPanel -- PR-MAP-10 identify list wiring', () => {
  beforeEach(() => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [],
      primaryFeatureIndex: null,
    });
    useMatrixMapSelectionStore.setState({
      selectedSampleId: null,
      selectedSampleIds: [],
      panRequestedSampleId: null,
      panRequestSeq: 0,
    });
    useMatrixMapMeasurementStore.getState().clear();
  });

  it('renders the Selection Stats heading when no samples are selected', () => {
    renderPanel();
    expect(screen.getByText(/Selection Stats/)).toBeInTheDocument();
  });

  it('renders the no-selection empty state when identifiedFeatures is empty', () => {
    renderPanel();
    expect(
      screen.getByTestId('matrix-map-left-panel-empty-state'),
    ).toBeInTheDocument();
    expect(screen.getByText(/No sample selected/i)).toBeInTheDocument();
  });

  it('replaces the empty state with IdentifiedFeaturesList when a single feature lands', () => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [makeFeature({ layerLabel: 'Aquifers' })],
      primaryFeatureIndex: 0,
    });
    renderPanel();
    expect(
      screen.queryByTestId('matrix-map-left-panel-empty-state'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Aquifers')).toBeInTheDocument();
  });

  it('renders multi-hit IdentifiedFeaturesList with the count header and a Primary badge', () => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [
        makeFeature({ layerLabel: 'Aquifers' }),
        makeFeature({ layerLabel: 'Watershed Groups' }),
      ],
      primaryFeatureIndex: 0,
    });
    renderPanel();
    expect(screen.getByText(/Identified Features \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Primary/i)).toBeInTheDocument();
  });

  it('wires the clear callback to clearIdentifiedFeatures store mutation', () => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [makeFeature()],
      primaryFeatureIndex: 0,
    });
    renderPanel();
    const clearButton = screen.getByLabelText(/clear identified/i);
    fireEvent.click(clearButton);
    expect(useMatrixMapIdentifyStore.getState().identifiedFeatures).toEqual([]);
    expect(useMatrixMapIdentifyStore.getState().primaryFeatureIndex).toBeNull();
  });

  // SPLIT from the original mixed test at ~144-159:
  //   - KEPT: composition-summary assertion (~153-155)
  //   - DROPPED: sediment-radio assertion (~156-158) -- the medium radio card
  //     was removed from the left panel in Phase 0 (moved to right panel chips).
  it('renders selected-sample composition counts', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['ref-1', 'imp-1', 'unk-1'],
      selectedSampleId: null,
    });
    useMatrixMapMeasurementStore.getState().setRows('ref-1|imp-1|unk-1', [
      makeMeasurementRow({ sample_id: 'ref-1', medium: 'sediment' }),
    ]);
    renderPanel();
    expect(screen.getByTestId('matrix-map-left-panel-selection-stats')).toBeInTheDocument();
    expect(screen.getByText('3 selected (1 reference, 1 impacted, 1 unknown)')).toBeInTheDocument();
    expect(screen.getByText(/1 selected station has unclassified status/)).toBeInTheDocument();
  });

  // Phase 1: the stats-shell mounts MatrixMapSelectionStats.
  // When the measurement store has not fetched yet (selectedIdKey=''),
  // ready=false so the shell shows the loading state.
  it('renders the stats-shell when a selection is active (Phase 1: shows stats UI)', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['ref-1'],
      selectedSampleId: 'ref-1',
    });
    renderPanel();
    expect(
      screen.getByTestId('matrix-map-left-panel-stats-shell'),
    ).toBeInTheDocument();
    // Phase 1: placeholder copy is gone; the shell renders MatrixMapSelectionStats.
    // With no fetch yet (selectedIdKey=''), ready=false -> loading state shown.
    expect(
      screen.queryByText('Detailed selection statistics will appear here.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('matrix-map-stats-loading'),
    ).toBeInTheDocument();
  });

  it('does not render the stats-shell when the empty state is shown', () => {
    renderPanel();
    expect(
      screen.queryByTestId('matrix-map-left-panel-stats-shell'),
    ).not.toBeInTheDocument();
  });
});

function makeMeasurementRow(over: Partial<MatrixMapMeasurementRow> = {}): MatrixMapMeasurementRow {
  return {
    sample_id: 'sample-a',
    sample_display_name: 'Station 1',
    sample_station_id: 'STA-1',
    sample_event_id: 'event-a',
    event_date: '2026-01-02',
    measurement_id: 'measurement-a',
    medium: 'sediment',
    substance_id: '11111111-1111-4111-8111-111111111111',
    substance_key: 'copper',
    substance_display_name: 'Copper',
    value: 12.5,
    unit: 'mg/kg',
    detection_limit: null,
    qualifier: null,
    censored: false,
    coordinate_quality_tier: 'high' as const,
    classification: 'reference' as const,
    source_dra_id: 'dra-1',
    source_dra_title: 'Source DRA',
    source_dra_citation: null,
    ...over,
  };
}
