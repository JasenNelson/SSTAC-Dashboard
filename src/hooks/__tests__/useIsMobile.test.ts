// Unit tests for useIsMobile (PR-MAP-17a). Mocks window.matchMedia
// to drive both desktop and mobile branches plus the resize-listener
// subscription/unsubscribe lifecycle.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type MQListener = (e: MediaQueryListEvent) => void;

function createMockMql(initialMatches: boolean) {
  const listeners = new Set<MQListener>();
  const mql = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MQListener) => listeners.add(cb)),
    removeEventListener: vi.fn((_: string, cb: MQListener) => listeners.delete(cb)),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList & {
    triggerChange: (next: boolean) => void;
  };
  // Test-only hook that lets the test simulate viewport change events.
  (mql as unknown as { triggerChange: (next: boolean) => void }).triggerChange = (
    next: boolean,
  ) => {
    (mql as MediaQueryList & { matches: boolean }).matches = next;
    listeners.forEach((cb) =>
      cb({ matches: next } as MediaQueryListEvent),
    );
  };
  return mql;
}

let currentMql: ReturnType<typeof createMockMql> | null = null;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((_query: string) => {
      currentMql = createMockMql(false);
      return currentMql;
    }),
  });
});

afterEach(() => {
  // Restore so other tests in the suite are not affected. Tests that
  // care about matchMedia define their own mock; tests that don't get
  // the default jsdom behavior (undefined).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional cleanup
  delete (window as any).matchMedia;
  currentMql = null;
});

describe('useIsMobile', () => {
  it('returns false on initial mount when matchMedia reports no match (desktop default)', async () => {
    const { useIsMobile } = await import('../useIsMobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when matchMedia reports a match (viewport narrower than 768px)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => {
        currentMql = createMockMql(true);
        return currentMql;
      }),
    });
    const { useIsMobile } = await import('../useIsMobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates on viewport change event (desktop -> mobile)', async () => {
    const { useIsMobile } = await import('../useIsMobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    expect(currentMql).not.toBeNull();
    act(() => {
      currentMql!.triggerChange(true);
    });
    expect(result.current).toBe(true);
  });

  it('updates on viewport change event (mobile -> desktop)', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn(() => {
        currentMql = createMockMql(true);
        return currentMql;
      }),
    });
    const { useIsMobile } = await import('../useIsMobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    act(() => {
      currentMql!.triggerChange(false);
    });
    expect(result.current).toBe(false);
  });

  it('unsubscribes from matchMedia on unmount', async () => {
    const { useIsMobile } = await import('../useIsMobile');
    const { unmount } = renderHook(() => useIsMobile());
    const mql = currentMql!;
    expect(mql.addEventListener).toHaveBeenCalledTimes(1);
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('returns false when matchMedia is not available (jsdom-like environment)', async () => {
    // Force the no-matchMedia branch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional setup
    delete (window as any).matchMedia;
    const { useIsMobile } = await import('../useIsMobile');
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
