// PR-MAP-10 tests: live identify-tool list in the matrix-options
// left "Selection Stats" panel. Locks the placeholder-vs-live swap
// behaviour and the store wiring so future cleanup passes do not
// silently regress identify routing back to map-popup-only.
//
// REGRESSION discipline (per cross_project_never_delete_regression_tests_during_cleanup):
// do NOT remove these without explicit deletion of the corresponding feature.

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IdentifiedFeature } from '@/lib/maps/wms-identify';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { MatrixMapLeftPanel } from '../MatrixMapLeftPanel';

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

describe('MatrixMapLeftPanel -- PR-MAP-10 identify list wiring', () => {
  beforeEach(() => {
    useSiteDataStore.setState({
      identifiedFeatures: [],
      primaryFeatureIndex: null,
    });
  });

  it('REGRESSION: renders the PR-MAP-4 Selection Stats placeholder (PR-MAP-10 must not hide it)', () => {
    render(<MatrixMapLeftPanel />);
    expect(
      screen.getByTestId('matrix-map-left-panel-pr-map-4-placeholder'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Selection Stats/)).toBeInTheDocument();
  });

  it('renders the State A identify placeholder when identifiedFeatures is empty', () => {
    render(<MatrixMapLeftPanel />);
    expect(
      screen.getByTestId('matrix-map-left-panel-state-a-placeholder'),
    ).toBeInTheDocument();
    expect(screen.getByText(/State A: identify just fired/i)).toBeInTheDocument();
  });

  it('replaces the State A placeholder with IdentifiedFeaturesList when a single feature lands', () => {
    useSiteDataStore.setState({
      identifiedFeatures: [makeFeature({ layerLabel: 'Aquifers' })],
      primaryFeatureIndex: 0,
    });
    render(<MatrixMapLeftPanel />);
    expect(
      screen.queryByTestId('matrix-map-left-panel-state-a-placeholder'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Aquifers')).toBeInTheDocument();
  });

  it('renders multi-hit IdentifiedFeaturesList with the count header and a Primary badge', () => {
    useSiteDataStore.setState({
      identifiedFeatures: [
        makeFeature({ layerLabel: 'Aquifers' }),
        makeFeature({ layerLabel: 'Watershed Groups' }),
      ],
      primaryFeatureIndex: 0,
    });
    render(<MatrixMapLeftPanel />);
    expect(screen.getByText(/Identified Features \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Primary/i)).toBeInTheDocument();
  });

  it('wires the clear callback to clearIdentifiedFeatures store mutation', () => {
    useSiteDataStore.setState({
      identifiedFeatures: [makeFeature()],
      primaryFeatureIndex: 0,
    });
    render(<MatrixMapLeftPanel />);
    const clearButton = screen.getByLabelText(/clear identified/i);
    fireEvent.click(clearButton);
    expect(useSiteDataStore.getState().identifiedFeatures).toEqual([]);
    expect(useSiteDataStore.getState().primaryFeatureIndex).toBeNull();
  });
});
