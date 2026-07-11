import { beforeEach, describe, expect, it } from 'vitest';
import type { MatrixSample } from '@/app/(dashboard)/matrix-map/types';
import {
  DEFAULT_MATRIX_MAP_FILTER_STATE,
  getHiddenSelectedSampleIds,
  getMapFilteredSamples,
  hasActiveMatrixMapFilters,
  useMatrixMapFilterStore,
} from '../filterStore';

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

describe('useMatrixMapFilterStore', () => {
  beforeEach(() => {
    useMatrixMapFilterStore.getState().resetFilters();
  });

  it('tracks active filter intent separately from matching sample ids', () => {
    expect(hasActiveMatrixMapFilters(useMatrixMapFilterStore.getState().filterState)).toBe(false);
    useMatrixMapFilterStore.getState().setFilterState({
      substance_ids: ['11111111-1111-4111-8111-111111111111'],
      mediums: ['sediment'],
    });
    useMatrixMapFilterStore.getState().setMatchingSampleIds(['sample-a', 'sample-a'], true);

    const state = useMatrixMapFilterStore.getState();
    expect(hasActiveMatrixMapFilters(state.filterState)).toBe(true);
    expect(state.matchingSampleIds).toEqual(['sample-a']);
    expect(state.matchingSampleIdsReady).toBe(true);
  });

  it('does not filter map samples until matching ids are ready', () => {
    const samples = [makeSample({ id: 'sample-a' }), makeSample({ id: 'sample-b' })];
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      substance_ids: ['11111111-1111-4111-8111-111111111111'],
    };

    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: [],
        matchingSampleIdsReady: false,
        selectedSampleIds: [],
        showSelectedDespiteFilters: false,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a', 'sample-b']);
  });

  it('filters map samples by full matching ids and can preserve selected hidden samples', () => {
    const samples = [makeSample({ id: 'sample-a' }), makeSample({ id: 'sample-b' })];
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      mediums: ['sediment' as const],
    };

    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: ['sample-a'],
        matchingSampleIdsReady: true,
        selectedSampleIds: ['sample-b'],
        showSelectedDespiteFilters: false,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a']);

    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: ['sample-a'],
        matchingSampleIdsReady: true,
        selectedSampleIds: ['sample-b'],
        showSelectedDespiteFilters: true,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a', 'sample-b']);
  });

  it('reports selected samples hidden by active filters', () => {
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      qa: 'censored' as const,
    };

    expect(
      getHiddenSelectedSampleIds({
        filterState,
        matchingSampleIds: ['sample-a'],
        matchingSampleIdsReady: true,
        selectedSampleIds: ['sample-a', 'sample-b'],
      }),
    ).toEqual(['sample-b']);
  });

  it('filters to high-tier samples when surveyed_only is set, even with matchingSampleIdsReady:false and no active matching filters', () => {
    const samples = [
      makeSample({ id: 'sample-a', coordinate_quality_tier: 'high' }),
      makeSample({ id: 'sample-b', coordinate_quality_tier: 'medium' }),
    ];
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      surveyed_only: true,
    };

    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: [],
        matchingSampleIdsReady: false,
        selectedSampleIds: [],
        showSelectedDespiteFilters: false,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a']);
  });

  it('combines surveyed_only with an active matching filter (AND semantics)', () => {
    const samples = [
      makeSample({ id: 'sample-a', coordinate_quality_tier: 'high' }),
      makeSample({ id: 'sample-b', coordinate_quality_tier: 'medium' }),
    ];
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      mediums: ['sediment' as const],
      surveyed_only: true,
    };

    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: ['sample-a', 'sample-b'],
        matchingSampleIdsReady: true,
        selectedSampleIds: [],
        showSelectedDespiteFilters: false,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a']);
  });

  it('surveyed_only always keeps an explicitly-selected non-surveyed sample visible (never an untracked hidden selection)', () => {
    const samples = [
      makeSample({ id: 'sample-a', coordinate_quality_tier: 'high' }),
      makeSample({ id: 'sample-b', coordinate_quality_tier: 'medium' }),
    ];
    const filterState = {
      ...DEFAULT_MATRIX_MAP_FILTER_STATE,
      surveyed_only: true,
    };

    // sample-b is medium-tier (would be hidden by surveyed_only) but is SELECTED: it stays visible
    // regardless of showSelectedDespiteFilters, so surveyed_only can never hide a selected sample.
    for (const showSelectedDespiteFilters of [true, false]) {
      expect(
        getMapFilteredSamples({
          samples,
          filterState,
          matchingSampleIds: [],
          matchingSampleIdsReady: false,
          selectedSampleIds: ['sample-b'],
          showSelectedDespiteFilters,
        }).map((sample) => sample.id),
      ).toEqual(['sample-a', 'sample-b']);
    }

    // With nothing selected, surveyed_only hides the medium-tier sample as expected.
    expect(
      getMapFilteredSamples({
        samples,
        filterState,
        matchingSampleIds: [],
        matchingSampleIdsReady: false,
        selectedSampleIds: [],
        showSelectedDespiteFilters: false,
      }).map((sample) => sample.id),
    ).toEqual(['sample-a']);
  });
});
