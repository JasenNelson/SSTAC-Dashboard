import { create } from 'zustand';
import type { Classification, MatrixSample } from '@/app/(dashboard)/matrix-map/types';

export const MATRIX_MAP_MEDIA = ['sediment', 'water', 'tissue', 'toxicity', 'community'] as const;
export const MATRIX_MAP_QA_FILTERS = ['all', 'detected', 'censored'] as const;
export const MATRIX_MAP_CLASSIFICATION_FILTERS = ['all', 'reference', 'impacted', 'unknown'] as const;

export type MatrixMapMedium = (typeof MATRIX_MAP_MEDIA)[number];
export type MatrixMapQaFilter = (typeof MATRIX_MAP_QA_FILTERS)[number];
export type MatrixMapClassificationFilter = (typeof MATRIX_MAP_CLASSIFICATION_FILTERS)[number];

export interface MatrixMapFilterState {
  substance_ids: string[];
  mediums: MatrixMapMedium[];
  qa: MatrixMapQaFilter;
  date_from: string;
  date_to: string;
  classification: MatrixMapClassificationFilter;
}

export const DEFAULT_MATRIX_MAP_FILTER_STATE: MatrixMapFilterState = {
  substance_ids: [],
  mediums: [],
  qa: 'all',
  date_from: '',
  date_to: '',
  classification: 'all',
};

interface MatrixMapFilterStoreState {
  filterState: MatrixMapFilterState;
  matchingSampleIds: string[];
  matchingSampleIdsReady: boolean;
  showSelectedDespiteFilters: boolean;
  setFilterState: (patch: Partial<MatrixMapFilterState>) => void;
  setSelectedMedium: (medium: MatrixMapMedium) => void;
  resetFilters: () => void;
  setMatchingSampleIds: (sampleIds: string[], ready: boolean) => void;
  setShowSelectedDespiteFilters: (value: boolean) => void;
}

export const useMatrixMapFilterStore = create<MatrixMapFilterStoreState>()((set) => ({
  filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
  matchingSampleIds: [],
  matchingSampleIdsReady: false,
  showSelectedDespiteFilters: false,
  setFilterState: (patch) => {
    set((state) => ({
      filterState: {
        ...state.filterState,
        ...patch,
      },
    }));
  },
  setSelectedMedium: (medium) => {
    set((state) => ({
      filterState: {
        ...state.filterState,
        mediums: [medium],
      },
    }));
  },
  resetFilters: () => {
    set({
      filterState: DEFAULT_MATRIX_MAP_FILTER_STATE,
      matchingSampleIds: [],
      matchingSampleIdsReady: false,
      showSelectedDespiteFilters: false,
    });
  },
  setMatchingSampleIds: (sampleIds, ready) => {
    set({
      matchingSampleIds: Array.from(new Set(sampleIds)),
      matchingSampleIdsReady: ready,
    });
  },
  setShowSelectedDespiteFilters: (value) => {
    set({ showSelectedDespiteFilters: value });
  },
}));

export function hasActiveMatrixMapFilters(filterState: MatrixMapFilterState) {
  return (
    filterState.substance_ids.length > 0 ||
    filterState.mediums.length > 0 ||
    filterState.qa !== 'all' ||
    filterState.date_from !== '' ||
    filterState.date_to !== '' ||
    filterState.classification !== 'all'
  );
}

export function getMapFilteredSamples({
  samples,
  filterState,
  matchingSampleIds,
  matchingSampleIdsReady,
  selectedSampleIds,
  showSelectedDespiteFilters,
}: {
  samples: MatrixSample[];
  filterState: MatrixMapFilterState;
  matchingSampleIds: string[];
  matchingSampleIdsReady: boolean;
  selectedSampleIds: string[];
  showSelectedDespiteFilters: boolean;
}) {
  if (!hasActiveMatrixMapFilters(filterState) || !matchingSampleIdsReady) {
    return samples;
  }

  const matchingIds = new Set(matchingSampleIds);
  const selectedIds = new Set(selectedSampleIds);
  return samples.filter(
    (sample) =>
      matchingIds.has(sample.id) ||
      (showSelectedDespiteFilters && selectedIds.has(sample.id)),
  );
}

export function getHiddenSelectedSampleIds({
  filterState,
  matchingSampleIds,
  matchingSampleIdsReady,
  selectedSampleIds,
}: {
  filterState: MatrixMapFilterState;
  matchingSampleIds: string[];
  matchingSampleIdsReady: boolean;
  selectedSampleIds: string[];
}) {
  if (!hasActiveMatrixMapFilters(filterState) || !matchingSampleIdsReady) {
    return [];
  }

  const matchingIds = new Set(matchingSampleIds);
  return selectedSampleIds.filter((sampleId) => !matchingIds.has(sampleId));
}

export function isMatrixMapMedium(value: unknown): value is MatrixMapMedium {
  return typeof value === 'string' && (MATRIX_MAP_MEDIA as readonly string[]).includes(value);
}

export function isMatrixMapQaFilter(value: unknown): value is MatrixMapQaFilter {
  return typeof value === 'string' && (MATRIX_MAP_QA_FILTERS as readonly string[]).includes(value);
}

export function isMatrixMapClassificationFilter(value: unknown): value is MatrixMapClassificationFilter {
  return (
    typeof value === 'string' &&
    (MATRIX_MAP_CLASSIFICATION_FILTERS as readonly string[]).includes(value)
  );
}

export function classificationMatchesFilter(
  classification: Classification,
  filter: MatrixMapClassificationFilter,
) {
  return filter === 'all' || classification === filter;
}
