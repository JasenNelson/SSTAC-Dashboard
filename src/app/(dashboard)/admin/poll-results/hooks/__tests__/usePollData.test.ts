import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { usePollData } from '../usePollData';

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }))
  }))
}));

describe('usePollData', () => {
  it('should export usePollData function', () => {
    expect(typeof usePollData).toBe('function');
  });

  it('should return hook with required properties', () => {
    const { result } = renderHook(() => usePollData());

    expect(result.current).toBeDefined();
    expect(result.current.pollResults).toBeDefined();
    expect(result.current.loading).toBeDefined();
    expect(result.current.error).toBeDefined();
    expect(result.current.matrixData).toBeDefined();
    expect(result.current.fetchPollResults).toBeDefined();
    expect(result.current.setMatrixData).toBeDefined();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => usePollData());

    expect(Array.isArray(result.current.pollResults)).toBe(true);
    expect(typeof result.current.loading).toBe('boolean');
    expect(result.current.error).toBeNull();
    expect(Array.isArray(result.current.matrixData)).toBe(true);
  });

  it('should have fetchPollResults as a callable function', () => {
    const { result } = renderHook(() => usePollData());

    expect(typeof result.current.fetchPollResults).toBe('function');
  });

  it('should have setMatrixData as a callable function', () => {
    const { result } = renderHook(() => usePollData());

    expect(typeof result.current.setMatrixData).toBe('function');
  });

  it('should handle hook lifecycle correctly', () => {
    const { result, rerender } = renderHook(() => usePollData());

    expect(result.current.pollResults).toBeDefined();
    expect(result.current.loading).toBe(true);

    // Re-render should not cause errors
    rerender();
    expect(result.current.pollResults).toBeDefined();
  });
});
