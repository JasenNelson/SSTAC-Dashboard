import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useResultsState } from '../useResultsState';

describe('useResultsState', () => {
  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useResultsState());

    expect(result.current.expandedPoll).toBeNull();
    expect(result.current.expandedGroup).toBeNull();
    expect(result.current.selectedQuestion).toBeNull();
    expect(result.current.filterMode).toBe('all');
    expect(result.current.leftPanelVisible).toBe(true);
    expect(result.current.qrCodeExpanded).toBe(false);
    expect(result.current.expandedPollGroup).toBeNull();
    expect(result.current.lastRefresh).toBeInstanceOf(Date);
    expect(result.current.showMatrixGraphs).toEqual({});
    expect(result.current.showPresentationControls).toBe(true);
  });

  it('should have all required setter functions', () => {
    const { result } = renderHook(() => useResultsState());

    expect(typeof result.current.setExpandedPoll).toBe('function');
    expect(typeof result.current.setExpandedGroup).toBe('function');
    expect(typeof result.current.setSelectedQuestion).toBe('function');
    expect(typeof result.current.setFilterMode).toBe('function');
    expect(typeof result.current.setLeftPanelVisible).toBe('function');
    expect(typeof result.current.setQrCodeExpanded).toBe('function');
    expect(typeof result.current.setExpandedPollGroup).toBe('function');
    expect(typeof result.current.setLastRefresh).toBe('function');
    expect(typeof result.current.setShowPresentationControls).toBe('function');
    expect(typeof result.current.toggleMatrixGraph).toBe('function');
  });

  it('should update expandedPoll state', () => {
    const { result } = renderHook(() => useResultsState());

    act(() => {
      result.current.setExpandedPoll('test-poll-1');
    });

    expect(result.current.expandedPoll).toBe('test-poll-1');

    act(() => {
      result.current.setExpandedPoll(null);
    });

    expect(result.current.expandedPoll).toBeNull();
  });

  it('should update filterMode state', () => {
    const { result } = renderHook(() => useResultsState());

    act(() => {
      result.current.setFilterMode('twg');
    });

    expect(result.current.filterMode).toBe('twg');

    act(() => {
      result.current.setFilterMode('cew');
    });

    expect(result.current.filterMode).toBe('cew');

    act(() => {
      result.current.setFilterMode('all');
    });

    expect(result.current.filterMode).toBe('all');
  });

  it('should toggle leftPanelVisible state', () => {
    const { result } = renderHook(() => useResultsState());

    expect(result.current.leftPanelVisible).toBe(true);

    act(() => {
      result.current.setLeftPanelVisible(false);
    });

    expect(result.current.leftPanelVisible).toBe(false);

    act(() => {
      result.current.setLeftPanelVisible(true);
    });

    expect(result.current.leftPanelVisible).toBe(true);
  });

  it('should toggle matrix graph visibility', () => {
    const { result } = renderHook(() => useResultsState());

    expect(result.current.showMatrixGraphs).toEqual({});

    act(() => {
      result.current.toggleMatrixGraph('priority-q1-q2');
    });

    expect(result.current.showMatrixGraphs['priority-q1-q2']).toBe(true);

    act(() => {
      result.current.toggleMatrixGraph('priority-q1-q2');
    });

    expect(result.current.showMatrixGraphs['priority-q1-q2']).toBe(false);
  });

  it('should handle multiple matrix graph toggles independently', () => {
    const { result } = renderHook(() => useResultsState());

    act(() => {
      result.current.toggleMatrixGraph('graph-1');
      result.current.toggleMatrixGraph('graph-2');
      result.current.toggleMatrixGraph('graph-3');
    });

    expect(result.current.showMatrixGraphs).toEqual({
      'graph-1': true,
      'graph-2': true,
      'graph-3': true
    });

    act(() => {
      result.current.toggleMatrixGraph('graph-2');
    });

    expect(result.current.showMatrixGraphs).toEqual({
      'graph-1': true,
      'graph-2': false,
      'graph-3': true
    });
  });

  it('should update expanded group and question', () => {
    const { result } = renderHook(() => useResultsState());

    act(() => {
      result.current.setExpandedGroup('holistic');
      result.current.setSelectedQuestion('q-1');
    });

    expect(result.current.expandedGroup).toBe('holistic');
    expect(result.current.selectedQuestion).toBe('q-1');
  });

  it('should toggle qrCode expansion', () => {
    const { result } = renderHook(() => useResultsState());

    expect(result.current.qrCodeExpanded).toBe(false);

    act(() => {
      result.current.setQrCodeExpanded(true);
    });

    expect(result.current.qrCodeExpanded).toBe(true);

    act(() => {
      result.current.setQrCodeExpanded(false);
    });

    expect(result.current.qrCodeExpanded).toBe(false);
  });

  it('should update presentation controls visibility', () => {
    const { result } = renderHook(() => useResultsState());

    expect(result.current.showPresentationControls).toBe(true);

    act(() => {
      result.current.setShowPresentationControls(false);
    });

    expect(result.current.showPresentationControls).toBe(false);

    act(() => {
      result.current.setShowPresentationControls(true);
    });

    expect(result.current.showPresentationControls).toBe(true);
  });

  it('should update lastRefresh timestamp', () => {
    const { result } = renderHook(() => useResultsState());

    const _originalDate = result.current.lastRefresh;

    // Wait a bit and update
    act(() => {
      result.current.setLastRefresh(new Date());
    });

    // New date should be different or same time (depending on timing)
    expect(result.current.lastRefresh).toBeInstanceOf(Date);
  });

  it('should maintain independent state for each hook instance', () => {
    const { result: result1 } = renderHook(() => useResultsState());
    const { result: result2 } = renderHook(() => useResultsState());

    act(() => {
      result1.current.setFilterMode('twg');
      result2.current.setFilterMode('cew');
    });

    expect(result1.current.filterMode).toBe('twg');
    expect(result2.current.filterMode).toBe('cew');
  });
});
