import { renderHook, waitFor as _waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMatrixDataCache } from '../useMatrixDataCache';
import type { MatrixData } from '../../types';

// Mock fetch API
global.fetch = vi.fn();

describe('useMatrixDataCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockClear();
  });

  it('should export useMatrixDataCache function', () => {
    expect(typeof useMatrixDataCache).toBe('function');
  });

  it('should return hook with required methods', () => {
    const { result } = renderHook(() => useMatrixDataCache());

    expect(result.current).toBeDefined();
    expect(typeof result.current.fetchMatrixData).toBe('function');
    expect(typeof result.current.clearCache).toBe('function');
    expect(typeof result.current.refreshData).toBe('function');
    expect(typeof result.current.loading).toBe('boolean');
    expect(result.current.error).toBeNull();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useMatrixDataCache());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle successful matrix data fetch', async () => {
    const mockData: MatrixData[] = [
      {
        title: 'Site-Specific Standards',
        avgImportance: 4.2,
        avgFeasibility: 3.5,
        responses: 15,
        individualPairs: []
      }
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useMatrixDataCache());

    const data = await result.current.fetchMatrixData('all');

    expect(data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should support different filter modes', async () => {
    const mockData = [
      {
        title: 'Test',
        avgImportance: 4.0,
        avgFeasibility: 3.0,
        responses: 10,
        individualPairs: []
      }
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useMatrixDataCache());

    // Fetch with 'twg' filter
    await result.current.fetchMatrixData('twg');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('filter=twg')
    );
  });

  it('should have clearCache function', () => {
    const { result } = renderHook(() => useMatrixDataCache());

    expect(typeof result.current.clearCache).toBe('function');
    expect(() => result.current.clearCache()).not.toThrow();
    expect(() => result.current.clearCache('all')).not.toThrow();
  });

  it('should have refreshData function to bypass cache', () => {
    const { result } = renderHook(() => useMatrixDataCache());

    expect(typeof result.current.refreshData).toBe('function');
    const refreshPromise = result.current.refreshData('all');
    expect(refreshPromise).toBeInstanceOf(Promise);
  });

  it('should call fetch API endpoint', async () => {
    const mockData: MatrixData[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });

    const { result } = renderHook(() => useMatrixDataCache());

    // Clear cache to ensure fetch will be called (not cache hit)
    result.current.clearCache('all');

    await result.current.fetchMatrixData('all');

    expect(global.fetch).toHaveBeenCalled();
  });

});
