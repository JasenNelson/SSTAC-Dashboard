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
      panRequestedSampleId: null,
      panRequestSeq: 0,
    });
  });

  it('initial state is null + empty array', () => {
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBeNull();
    expect(state.selectedSampleIds).toEqual([]);
    expect(state.panRequestedSampleId).toBeNull();
    expect(state.panRequestSeq).toBe(0);
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

  it('requestPanToSample highlights and pans without replacing the selection set', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: null,
      selectedSampleIds: ['a', 'b'],
    });

    useMatrixMapSelectionStore.getState().requestPanToSample('a');
    const first = useMatrixMapSelectionStore.getState();
    expect(first.selectedSampleId).toBe('a');
    expect(first.selectedSampleIds).toEqual(['a', 'b']);
    expect(first.panRequestedSampleId).toBe('a');
    expect(first.panRequestSeq).toBe(1);

    useMatrixMapSelectionStore.getState().requestPanToSample('a');
    expect(useMatrixMapSelectionStore.getState().panRequestSeq).toBe(2);
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

  it('addSampleSelection adds via Set dedup and clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a'],
    });
    useMatrixMapSelectionStore.getState().addSampleSelection('a');
    useMatrixMapSelectionStore.getState().addSampleSelection('b');
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'b']);
    expect(state.selectedSampleId).toBeNull();
  });

  it('removeSampleSelection removes an id and clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b', 'c'],
    });
    useMatrixMapSelectionStore.getState().removeSampleSelection('b');
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'c']);
    expect(state.selectedSampleId).toBeNull();
  });

  it('selectMultipleSamples merges via Set dedup, never duplicates, and clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b'],
    });
    useMatrixMapSelectionStore.getState().selectMultipleSamples(['b', 'c', 'd', 'c']);
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'b', 'c', 'd']);
    expect(state.selectedSampleId).toBeNull();
  });

  it('removeMultipleSamples removes all passed ids and clears selectedSampleId', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b', 'c', 'd'],
    });
    useMatrixMapSelectionStore.getState().removeMultipleSamples(['b', 'd']);
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleIds).toEqual(['a', 'c']);
    expect(state.selectedSampleId).toBeNull();
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

  it('clearSampleSelection resets selection fields and clears pending pan target', () => {
    useMatrixMapSelectionStore.setState({
      selectedSampleId: 'sole',
      selectedSampleIds: ['a', 'b', 'c'],
      panRequestedSampleId: 'sole',
      panRequestSeq: 3,
    });
    useMatrixMapSelectionStore.getState().clearSampleSelection();
    const state = useMatrixMapSelectionStore.getState();
    expect(state.selectedSampleId).toBeNull();
    expect(state.selectedSampleIds).toEqual([]);
    expect(state.panRequestedSampleId).toBeNull();
    expect(state.panRequestSeq).toBe(3);
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
