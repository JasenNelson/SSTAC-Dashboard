// Unit tests for the matrix-map selection store. Locks the contract
// extracted from MatrixMap.tsx:285-320 useCallback declarations so the
// inlined Sample Locations panel + future PR-MAP-12 / -13 / -14 readers
// can rely on consistent semantics.

import { describe, it, expect, beforeEach } from 'vitest';
import { useMatrixMapSelectionStore } from '../selectionStore';

describe('useMatrixMapSelectionStore', () => {
  beforeEach(() => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: null,
      selectedSampleIds: [],
    });
  });

  it('initial state is null + empty array', () => {
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBeNull();
    expect(state.selectedSampleIds).toEqual([]);
  });

  it('selectSample sets both single and array (single-replaces-multi BN-RRM semantic)', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleIds: ['a', 'b', 'c'],
      selectedSampleId: null,
    });
    useMatrixMapSelectionStore.getState().selectSample('x');
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBe('x');
    expect(state.selectedSampleIds).toEqual(['x']);
  });

  it('toggleSampleSelection adds to array on first call, removes on second; always clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({ selectedSampleId: 'sole', selectedSampleIds: [] });
    const { toggleSampleSelection } = useMatrixMapSelectionStore.getState();

    toggleSampleSelection('a');
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['a']);
    expect(useMatrixMapSelectionStore.getState().selectedSampleId).toBeNull();

    toggleSampleSelection('b');
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['a', 'b']);

    toggleSampleSelection('a');
    expect(useMatrixMapSelectionStore.getState().selectedSampleIds).toEqual(['b']);
  });

  it('selectMultipleSamples merges via Set dedup, never duplicates, leaves selectedSampleId alone', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b'],
    });
    useMatrixMapSelectionStore.getState().selectMultipleSamples(['b', 'c', 'd', 'c']);
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'b', 'c', 'd']);
    expect(state.selectedSampleId).toBe('sole');
  });

  it('selectAllSamples replaces selectedSampleIds with the passed list and clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'old',
      selectedSampleIds: ['z'],
    });
    useMatrixMapSelectionStore.getState().selectAllSamples(['a', 'b', 'c']);
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'b', 'c']);
    expect(state.selectedSampleId).toBeNull();
  });

  it('clearSampleSelection resets both fields', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b', 'c'],
    });
    useMatrixMapSelectionStore.getState().clearSampleSelection();
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBeNull();
    expect(state.selectedSampleIds).toEqual([]);
  });

  it('REGRESSION: selectSample then toggleSampleSelection of a different id does not retain the prior single', () => {
    // Codex PR-MAP-1 P2-1 lineage: prevents the "1 selected + N
    // multi-selected" stale-highlight state from re-emerging if the
    // toggle path is ever rewritten.
    const { selectSample, toggleSampleSelection } = useMatrixMapSelectionStore.getState();
    selectSample('a');
    expect(useMatrixMapSelectionStore.getState().selectedSampleId).toBe('a');
    toggleSampleSelection('b');
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBeNull();
    expect(state.selectedSampleIds).toEqual(['a', 'b']);
  });
});
