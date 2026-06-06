'use client';

// Phase 1: Stats engine shell -- gathers measurement store + filter store
// state and renders MatrixMapSelectionStats.
//
// Phase 0 note: Phase 0 placed a placeholder paragraph inside this component.
// Phase 1 replaces those internals with the real stats UI.  The testid
// 'matrix-map-left-panel-stats-shell' is preserved for existing tests.
//
// Plain ASCII only (code point <= 127).

import { useMatrixMapMeasurementStore } from '@/stores/matrix-map/measurementStore';
import { useMatrixMapFilterStore } from '@/stores/matrix-map/filterStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import { MatrixMapSelectionStats } from './MatrixMapSelectionStats';

export function MatrixMapStatsShell() {
  const rows = useMatrixMapMeasurementStore((s) => s.rows);
  const isLoading = useMatrixMapMeasurementStore((s) => s.isLoading);
  const errorMessage = useMatrixMapMeasurementStore((s) => s.errorMessage);
  const selectedIdKey = useMatrixMapMeasurementStore((s) => s.selectedIdKey);
  const selectedSampleIds = useMatrixMapSelectionStore((s) => s.selectedSampleIds);
  const filterState = useMatrixMapFilterStore((s) => s.filterState);

  // The store is "ready" only when a fetch has completed for the CURRENT
  // selection. Comparing the measurement store's key against the live
  // selection key closes the one-paint window where a NEW selection renders
  // the PREVIOUS selection's rows before the right panel's fetch effect
  // flips isLoading (same staleness class the Phase 0 chip fix closed; this
  // mirrors the selectionMeasurementsReady idiom the old left panel used).
  const currentSelectionKey = selectedSampleIds.join('|');
  const ready =
    selectedIdKey !== '' && selectedIdKey === currentSelectionKey && !isLoading;

  return (
    <div
      data-testid="matrix-map-left-panel-stats-shell"
      className="space-y-1"
    >
      <MatrixMapSelectionStats
        rows={rows}
        filterState={filterState}
        isLoading={isLoading}
        errorMessage={errorMessage}
        ready={ready}
      />
    </div>
  );
}
