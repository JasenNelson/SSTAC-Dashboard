import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_MATRIX_MAP_FILTER_STATE,
  classificationMatchesFilter,
  hasActiveMatrixMapFilters,
  isMatrixMapClassificationFilter,
  isMatrixMapMedium,
  isMatrixMapQaFilter,
  useMatrixMapFilterStore,
} from '../filterStore';

describe('matrix-map filter type guards', () => {
  it('isMatrixMapMedium accepts only the known media strings', () => {
    for (const m of ['sediment', 'water', 'tissue', 'toxicity', 'community']) {
      expect(isMatrixMapMedium(m), m).toBe(true);
    }
    expect(isMatrixMapMedium('air')).toBe(false);
    expect(isMatrixMapMedium('')).toBe(false);
    expect(isMatrixMapMedium(undefined)).toBe(false);
    expect(isMatrixMapMedium(null)).toBe(false);
    expect(isMatrixMapMedium(1)).toBe(false);
    expect(isMatrixMapMedium({})).toBe(false);
  });

  it('isMatrixMapQaFilter accepts only all/detected/censored', () => {
    for (const q of ['all', 'detected', 'censored']) {
      expect(isMatrixMapQaFilter(q), q).toBe(true);
    }
    expect(isMatrixMapQaFilter('none')).toBe(false);
    expect(isMatrixMapQaFilter(null)).toBe(false);
    expect(isMatrixMapQaFilter(0)).toBe(false);
  });

  it('isMatrixMapClassificationFilter accepts only all/reference/impacted/unknown', () => {
    for (const c of ['all', 'reference', 'impacted', 'unknown']) {
      expect(isMatrixMapClassificationFilter(c), c).toBe(true);
    }
    expect(isMatrixMapClassificationFilter('other')).toBe(false);
    expect(isMatrixMapClassificationFilter(undefined)).toBe(false);
  });
});

describe('classificationMatchesFilter', () => {
  it("'all' matches every classification", () => {
    expect(classificationMatchesFilter('reference', 'all')).toBe(true);
    expect(classificationMatchesFilter('impacted', 'all')).toBe(true);
    expect(classificationMatchesFilter('unknown', 'all')).toBe(true);
  });

  it('a specific filter matches only the same classification', () => {
    expect(classificationMatchesFilter('reference', 'reference')).toBe(true);
    expect(classificationMatchesFilter('impacted', 'reference')).toBe(false);
    expect(classificationMatchesFilter('unknown', 'impacted')).toBe(false);
  });
});

describe('hasActiveMatrixMapFilters per field', () => {
  const base = DEFAULT_MATRIX_MAP_FILTER_STATE;
  it('is false for the default state', () => {
    expect(hasActiveMatrixMapFilters(base)).toBe(false);
  });
  it('is true when any single field is non-default', () => {
    expect(hasActiveMatrixMapFilters({ ...base, substance_ids: ['x'] })).toBe(true);
    expect(hasActiveMatrixMapFilters({ ...base, mediums: ['sediment'] })).toBe(true);
    expect(hasActiveMatrixMapFilters({ ...base, qa: 'detected' })).toBe(true);
    expect(hasActiveMatrixMapFilters({ ...base, date_from: '2026-01-01' })).toBe(true);
    expect(hasActiveMatrixMapFilters({ ...base, date_to: '2026-12-31' })).toBe(true);
    expect(hasActiveMatrixMapFilters({ ...base, classification: 'impacted' })).toBe(true);
  });
});

describe('useMatrixMapFilterStore actions', () => {
  beforeEach(() => {
    useMatrixMapFilterStore.getState().resetFilters();
  });

  it('setShowSelectedDespiteFilters toggles the flag', () => {
    expect(useMatrixMapFilterStore.getState().showSelectedDespiteFilters).toBe(false);
    useMatrixMapFilterStore.getState().setShowSelectedDespiteFilters(true);
    expect(useMatrixMapFilterStore.getState().showSelectedDespiteFilters).toBe(true);
  });

  it('setFilterState merges a partial patch without dropping other fields', () => {
    useMatrixMapFilterStore.getState().setFilterState({ qa: 'censored' });
    useMatrixMapFilterStore.getState().setFilterState({ classification: 'reference' });
    const { filterState } = useMatrixMapFilterStore.getState();
    expect(filterState.qa).toBe('censored');
    expect(filterState.classification).toBe('reference');
  });

  it('resetFilters restores defaults and clears matching ids + flag', () => {
    const s = useMatrixMapFilterStore.getState();
    s.setFilterState({ mediums: ['water'] });
    s.setMatchingSampleIds(['a', 'b'], true);
    s.setShowSelectedDespiteFilters(true);
    s.resetFilters();
    const after = useMatrixMapFilterStore.getState();
    expect(after.filterState).toEqual(DEFAULT_MATRIX_MAP_FILTER_STATE);
    expect(after.matchingSampleIds).toEqual([]);
    expect(after.matchingSampleIdsReady).toBe(false);
    expect(after.showSelectedDespiteFilters).toBe(false);
  });

  it('setMatchingSampleIds de-duplicates while preserving readiness', () => {
    useMatrixMapFilterStore.getState().setMatchingSampleIds(['a', 'a', 'b', 'b', 'c'], false);
    const s = useMatrixMapFilterStore.getState();
    expect(s.matchingSampleIds).toEqual(['a', 'b', 'c']);
    expect(s.matchingSampleIdsReady).toBe(false);
  });
});
