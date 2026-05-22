// Unit tests for the matrix-map identify store. Locks the auto-promote
// behaviour on setIdentifiedFeatures and the reset semantics on
// clearIdentifiedFeatures so MatrixMap.tsx + MatrixMapLeftPanel.tsx can
// rely on the contract.

import { describe, it, expect, beforeEach } from 'vitest';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';
import { useMatrixMapIdentifyStore } from '../identifyStore';

function makeFeature(layerLabel: string): IdentifiedFeature {
  return {
    source: 'wms',
    layerKey: layerLabel.toLowerCase().replace(/\s+/g, '-'),
    layerLabel,
    properties: {},
    coordinates: { lat: 49, lng: -123 },
    capturedAt: 1737000000000,
  };
}

describe('useMatrixMapIdentifyStore', () => {
  beforeEach(() => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [],
      primaryFeatureIndex: null,
    });
  });

  it('initial state is empty list + null primary', () => {
    const state = useMatrixMapIdentifyStore.getState();
    expect(state.identifiedFeatures).toEqual([]);
    expect(state.primaryFeatureIndex).toBeNull();
  });

  it('setIdentifiedFeatures with one feature auto-promotes primary to 0', () => {
    useMatrixMapIdentifyStore.getState().setIdentifiedFeatures([makeFeature('A')]);
    const state = useMatrixMapIdentifyStore.getState();
    expect(state.identifiedFeatures).toHaveLength(1);
    expect(state.primaryFeatureIndex).toBe(0);
  });

  it('setIdentifiedFeatures with empty list resets primary to null', () => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [makeFeature('A')],
      primaryFeatureIndex: 0,
    });
    useMatrixMapIdentifyStore.getState().setIdentifiedFeatures([]);
    const state = useMatrixMapIdentifyStore.getState();
    expect(state.identifiedFeatures).toEqual([]);
    expect(state.primaryFeatureIndex).toBeNull();
  });

  it('setPrimaryFeatureIndex updates only the index, leaves features intact', () => {
    const features = [makeFeature('A'), makeFeature('B'), makeFeature('C')];
    useMatrixMapIdentifyStore.setState({ identifiedFeatures: features, primaryFeatureIndex: 0 });
    useMatrixMapIdentifyStore.getState().setPrimaryFeatureIndex(2);
    const state = useMatrixMapIdentifyStore.getState();
    expect(state.identifiedFeatures).toEqual(features);
    expect(state.primaryFeatureIndex).toBe(2);
  });

  it('setPrimaryFeatureIndex rejects out-of-range indices (mirrors bn-rrm bounds guard)', () => {
    const features = [makeFeature('A'), makeFeature('B')];
    useMatrixMapIdentifyStore.setState({ identifiedFeatures: features, primaryFeatureIndex: 0 });
    const setPrimary = useMatrixMapIdentifyStore.getState().setPrimaryFeatureIndex;
    setPrimary(-1);
    expect(useMatrixMapIdentifyStore.getState().primaryFeatureIndex).toBe(0);
    setPrimary(5);
    expect(useMatrixMapIdentifyStore.getState().primaryFeatureIndex).toBe(0);
    setPrimary(1);
    expect(useMatrixMapIdentifyStore.getState().primaryFeatureIndex).toBe(1);
  });

  it('clearIdentifiedFeatures resets both fields', () => {
    useMatrixMapIdentifyStore.setState({
      identifiedFeatures: [makeFeature('A'), makeFeature('B')],
      primaryFeatureIndex: 1,
    });
    useMatrixMapIdentifyStore.getState().clearIdentifiedFeatures();
    const state = useMatrixMapIdentifyStore.getState();
    expect(state.identifiedFeatures).toEqual([]);
    expect(state.primaryFeatureIndex).toBeNull();
  });
});
