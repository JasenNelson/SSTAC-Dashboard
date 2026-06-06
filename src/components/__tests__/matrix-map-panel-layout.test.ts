// Unit tests for clampMatrixMapPanelWidth (matrix-map-panel-layout.ts).
// Pure function -- no React rendering required.
// Plain ASCII only (code point <= 127).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH,
  MATRIX_MAP_LEFT_PANEL_MIN_WIDTH,
  MATRIX_MAP_MIN_MAP_WIDTH,
  MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH,
  MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH,
  clampMatrixMapPanelWidth,
  getMatrixMapPanelMaxWidth,
} from '../matrix-map-panel-layout';

// jsdom sets window.innerWidth to 1024 by default.
const JSDOM_VIEWPORT = 1024;

describe('constants', () => {
  it('exports the expected numeric constants', () => {
    expect(MATRIX_MAP_MIN_MAP_WIDTH).toBe(48);
    expect(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH).toBe(280);
    expect(MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH).toBe(320);
    expect(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH).toBe(360);
    expect(MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH).toBe(480);
  });
});

describe('clampMatrixMapPanelWidth -- left panel', () => {
  it('returns the desired width when it is within the valid range', () => {
    // viewport 1024, otherPanel 480, sliver 48 -> max = 1024-480-48 = 496
    const result = clampMatrixMapPanelWidth('left', 320, 480);
    expect(result).toBe(320);
  });

  it('floors at left-panel min when desired is below it', () => {
    const result = clampMatrixMapPanelWidth('left', 100, 480);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('caps at viewport max when desired exceeds left + right + sliver', () => {
    // max = 1024 - 480 - 48 = 496
    const result = clampMatrixMapPanelWidth('left', 900, 480);
    expect(result).toBe(496);
  });

  it('max is at least sideMin when otherPanel leaves no room', () => {
    // otherPanel = 900 -> viewportMax would be 1024-900-48 = 76 but sideMin = 280
    const result = clampMatrixMapPanelWidth('left', 900, 900);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('returns sideMin when otherPanel = 0 (other panel hidden) and desired < min', () => {
    const result = clampMatrixMapPanelWidth('left', 100, 0);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('allows wider values when other panel is hidden (otherPanel = 0)', () => {
    // max = 1024 - 0 - 48 = 976
    const result = clampMatrixMapPanelWidth('left', 700, 0);
    expect(result).toBe(700);
  });

  it('handles narrow viewport where max < sideMin -- floor wins', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 400,
    });
    // otherPanel 480, sliver 48 -> viewportMax = 400-480-48 = negative -> max = sideMin (280)
    const result = clampMatrixMapPanelWidth('left', 320, 480);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
    // restore
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: JSDOM_VIEWPORT,
    });
  });
});

describe('clampMatrixMapPanelWidth -- right panel', () => {
  it('returns the desired width when it is within the valid range', () => {
    // viewport 1024, otherPanel 320, sliver 48 -> max = 1024-320-48 = 656
    const result = clampMatrixMapPanelWidth('right', 480, 320);
    expect(result).toBe(480);
  });

  it('floors at right-panel min when desired is below it', () => {
    const result = clampMatrixMapPanelWidth('right', 200, 320);
    expect(result).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });

  it('caps at viewport max', () => {
    // max = 1024 - 320 - 48 = 656
    const result = clampMatrixMapPanelWidth('right', 900, 320);
    expect(result).toBe(656);
  });

  it('max is at least sideMin when otherPanel leaves no room', () => {
    const result = clampMatrixMapPanelWidth('right', 900, 900);
    expect(result).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });

  it('allows wider values when other panel is hidden (otherPanel = 0)', () => {
    // max = 1024 - 0 - 48 = 976
    const result = clampMatrixMapPanelWidth('right', 700, 0);
    expect(result).toBe(700);
  });
});

describe('clampMatrixMapPanelWidth -- SSR branch', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = undefined;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('clamps to sideMin only for left when window is undefined', () => {
    const result = clampMatrixMapPanelWidth('left', 100, 480);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('passes through a within-range desired value for left (SSR)', () => {
    const result = clampMatrixMapPanelWidth('left', 400, 480);
    expect(result).toBe(400);
  });

  it('clamps to sideMin only for right when window is undefined', () => {
    const result = clampMatrixMapPanelWidth('right', 200, 320);
    expect(result).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });

  it('does not apply viewport-derived max for right (SSR)', () => {
    // Without window, a very large desired value is not capped.
    const result = clampMatrixMapPanelWidth('right', 9000, 320);
    expect(result).toBe(9000);
  });
});

describe('getMatrixMapPanelMaxWidth -- viewport-derived max', () => {
  it('returns viewport - otherPanel - sliver for left when result >= sideMin', () => {
    // viewport 1024, otherPanel 480, sliver 48 -> max = 1024-480-48 = 496
    const result = getMatrixMapPanelMaxWidth('left', 480);
    expect(result).toBe(496);
  });

  it('returns sideMin for left when otherPanel leaves no room', () => {
    // otherPanel 900 -> 1024-900-48 = 76 which is below sideMin 280 -> floor
    const result = getMatrixMapPanelMaxWidth('left', 900);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('returns viewport - otherPanel - sliver for right when result >= sideMin', () => {
    // viewport 1024, otherPanel 320, sliver 48 -> max = 1024-320-48 = 656
    const result = getMatrixMapPanelMaxWidth('right', 320);
    expect(result).toBe(656);
  });

  it('returns sideMin for right when otherPanel leaves no room', () => {
    const result = getMatrixMapPanelMaxWidth('right', 900);
    expect(result).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });

  it('returns full viewport minus sliver when otherPanel is 0 (other panel hidden)', () => {
    // max = 1024 - 0 - 48 = 976
    expect(getMatrixMapPanelMaxWidth('left', 0)).toBe(976);
    expect(getMatrixMapPanelMaxWidth('right', 0)).toBe(976);
  });
});

describe('getMatrixMapPanelMaxWidth -- SSR branch', () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).window = undefined;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it('returns sideMin for left in SSR (no window)', () => {
    const result = getMatrixMapPanelMaxWidth('left', 480);
    expect(result).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
  });

  it('returns sideMin for right in SSR (no window)', () => {
    const result = getMatrixMapPanelMaxWidth('right', 320);
    expect(result).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });

  it('SSR max equals sideMin regardless of otherPanel value', () => {
    // Even with otherPanel = 0, SSR returns sideMin (not full-viewport).
    expect(getMatrixMapPanelMaxWidth('left', 0)).toBe(MATRIX_MAP_LEFT_PANEL_MIN_WIDTH);
    expect(getMatrixMapPanelMaxWidth('right', 0)).toBe(MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH);
  });
});
