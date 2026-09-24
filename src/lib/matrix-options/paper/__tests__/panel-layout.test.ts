import { describe, expect, it, vi } from 'vitest';

import {
  clampPanelWidth,
  keyboardPanelWidth,
  layoutClassFor,
  maxPanelWidth,
  PANEL_LIMITS,
  PANEL_PRESETS,
  PANEL_WIDTH_STORAGE_KEY,
  PAPER_MIN_CENTER_WIDTH,
  readPanelPreferences,
  resolvePanelWidths,
  writePanelPreferences,
  type PanelPreferences,
} from '../panel-layout';

describe('layoutClassFor', () => {
  it('treats 1024 and 1279 as laptop', () => {
    expect(layoutClassFor(1024)).toBe('laptop');
    expect(layoutClassFor(1279)).toBe('laptop');
  });

  it('treats 1280 and 1535 as desktop', () => {
    expect(layoutClassFor(1280)).toBe('desktop');
    expect(layoutClassFor(1535)).toBe('desktop');
  });

  it('treats 1536 and above as wide', () => {
    expect(layoutClassFor(1536)).toBe('wide');
    expect(layoutClassFor(2000)).toBe('wide');
  });
});

describe('resolvePanelWidths - presets with no preferences', () => {
  // Container widths chosen comfortably above the squeeze threshold for each
  // class (preset.left + preset.right + PAPER_MIN_CENTER_WIDTH) so the preset
  // itself is returned unmodified.
  const roomyContainerFor: Record<'laptop' | 'desktop' | 'wide', number> = {
    laptop: 1200,
    desktop: 1400,
    wide: 1800,
  };

  for (const layoutClass of ['laptop', 'desktop', 'wide'] as const) {
    it(`returns the ${layoutClass} preset verbatim and right wider than left`, () => {
      const container = roomyContainerFor[layoutClass];
      expect(layoutClassFor(container)).toBe(layoutClass);
      const preset = PANEL_PRESETS[layoutClass];
      const result = resolvePanelWidths(container, {}, { left: true, right: true });
      expect(result).toEqual({ left: preset.left, right: preset.right });
      expect(result.right).toBeGreaterThan(result.left);
    });
  }
});

describe('resolvePanelWidths - preference validation', () => {
  // Roomy wide-class container: preset sum (320+448=768) + 440 = 1208 threshold.
  const container = 1800;
  const preset = PANEL_PRESETS.wide;

  it('uses a valid preference in range for both panels', () => {
    const result = resolvePanelWidths(container, { left: 300, right: 500 }, { left: true, right: true });
    expect(result).toEqual({ left: 300, right: 500 });
  });

  it('ignores an out-of-range (too large) preference and falls back to preset', () => {
    const result = resolvePanelWidths(container, { left: 1000 }, { left: true, right: true });
    expect(result.left).toBe(preset.left);
  });

  it('ignores an out-of-range (too small) preference and falls back to preset', () => {
    const result = resolvePanelWidths(container, { right: 100 }, { left: true, right: true });
    expect(result.right).toBe(preset.right);
  });

  it('ignores a NaN preference and falls back to preset', () => {
    const result = resolvePanelWidths(container, { left: Number.NaN }, { left: true, right: true });
    expect(result.left).toBe(preset.left);
  });

  it('ignores a string preference and falls back to preset', () => {
    const preferences = { right: '400' as unknown as number } as PanelPreferences;
    const result = resolvePanelWidths(container, preferences, { left: true, right: true });
    expect(result.right).toBe(preset.right);
  });

  it('ignores a negative preference and falls back to preset', () => {
    const result = resolvePanelWidths(container, { left: -50 }, { left: true, right: true });
    expect(result.left).toBe(preset.left);
  });
});

describe('resolvePanelWidths - paper minimum enforcement', () => {
  it('shrinks right first, then left, never below PANEL_LIMITS mins, keeping the paper minimum when possible', () => {
    // container 1024 (laptop class), both panels open, both preferences at
    // their maximum (left 480, right 600).
    // used = 480 + 600 = 1080; excess = 1080 + 440 - 1024 = 496.
    // right gives min(496, 600-304=296) -> right = 304 (its min), excess left = 200.
    // left gives min(200, 480-224=256) -> left = 280.
    const result = resolvePanelWidths(1024, { left: 480, right: 600 }, { left: true, right: true });
    expect(result).toEqual({ left: 280, right: 304 });
    expect(result.right).toBe(PANEL_LIMITS.right.min);
    expect(result.left).toBeGreaterThanOrEqual(PANEL_LIMITS.left.min);
    expect(result.right).toBeGreaterThanOrEqual(PANEL_LIMITS.right.min);
    expect(result.left + result.right + PAPER_MIN_CENTER_WIDTH).toBeLessThanOrEqual(1024);
  });

  it('never drops a panel below its PANEL_LIMITS min even when the paper minimum still cannot be met', () => {
    // container 500 is too small to reach the paper minimum even with both
    // panels fully shrunk to their floors.
    const result = resolvePanelWidths(500, { left: 480, right: 600 }, { left: true, right: true });
    expect(result).toEqual({ left: PANEL_LIMITS.left.min, right: PANEL_LIMITS.right.min });
    expect(result.left + result.right + PAPER_MIN_CENTER_WIDTH).toBeGreaterThan(500);
  });

  it('lets a closed panel contribute 0, so the other panel keeps its preference', () => {
    // Left closed; right open at its preference (500). used() only counts the
    // open right panel, so there is no excess at container 1024.
    const result = resolvePanelWidths(1024, { right: 500 }, { left: false, right: true });
    expect(result.right).toBe(500);
  });

  it('mirrors that for the right panel closed', () => {
    const result = resolvePanelWidths(1024, { left: 300 }, { left: true, right: false });
    expect(result.left).toBe(300);
  });
});

describe('maxPanelWidth', () => {
  it('respects the other open panel width (larger other -> smaller room)', () => {
    const withSmallerOther = maxPanelWidth('right', 1200, 250, true); // room = 1200-440-250=510
    const withLargerOther = maxPanelWidth('right', 1200, 350, true); // room = 1200-440-350=410
    expect(withSmallerOther).toBe(510);
    expect(withLargerOther).toBe(410);
    expect(withLargerOther).toBeLessThan(withSmallerOther);
  });

  it('ignores the other panel width when it is closed', () => {
    const result = maxPanelWidth('right', 1200, 999999, false); // room = 1200-440-0=760, clamped to max 600
    expect(result).toBe(PANEL_LIMITS.right.max);
  });

  it('respects the paper minimum, clamping room up to the side min', () => {
    // room = 1024 - 440 - 400 = 184, below left min (224).
    const result = maxPanelWidth('left', 1024, 400, true);
    expect(result).toBe(PANEL_LIMITS.left.min);
  });

  it('never returns below the side minimum', () => {
    const result = maxPanelWidth('left', 0, 0, false); // room = -440
    expect(result).toBe(PANEL_LIMITS.left.min);
  });

  it('never returns above the side maximum', () => {
    const result = maxPanelWidth('right', 10000, 0, false); // room = 9560
    expect(result).toBe(PANEL_LIMITS.right.max);
  });
});

describe('readPanelPreferences', () => {
  it('returns {} for null storage', () => {
    expect(readPanelPreferences(null)).toEqual({});
  });

  it('returns {} for undefined storage', () => {
    expect(readPanelPreferences(undefined)).toEqual({});
  });

  it('returns {} when the key is missing (getItem returns null)', () => {
    const storage = { getItem: () => null };
    expect(readPanelPreferences(storage)).toEqual({});
  });

  it('returns {} for corrupt JSON', () => {
    const storage = { getItem: () => '{not json' };
    expect(readPanelPreferences(storage)).toEqual({});
  });

  it('returns {} for a top-level array', () => {
    const storage = { getItem: () => JSON.stringify([1, 2, 3]) };
    expect(readPanelPreferences(storage)).toEqual({});
  });

  it('returns {} when getItem throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage blocked');
      },
    };
    expect(readPanelPreferences(storage)).toEqual({});
  });

  it('returns the parsed values for a valid object', () => {
    const storage = { getItem: () => JSON.stringify({ left: 300, right: 400 }) };
    expect(readPanelPreferences(storage)).toEqual({ left: 300, right: 400 });
  });

  it('keeps only the valid key when one of left/right is invalid', () => {
    const storage = { getItem: () => JSON.stringify({ left: 300, right: 9999 }) };
    expect(readPanelPreferences(storage)).toEqual({ left: 300 });
  });
});

describe('writePanelPreferences', () => {
  it('writes JSON for non-empty preferences', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const preferences = { left: 300, right: 400 };
    writePanelPreferences({ setItem, removeItem }, preferences);
    expect(setItem).toHaveBeenCalledWith(PANEL_WIDTH_STORAGE_KEY, JSON.stringify(preferences));
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('removes the key for empty preferences', () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    writePanelPreferences({ setItem, removeItem }, {});
    expect(removeItem).toHaveBeenCalledWith(PANEL_WIDTH_STORAGE_KEY);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not throw when setItem throws', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    const removeItem = vi.fn();
    expect(() => writePanelPreferences({ setItem, removeItem }, { left: 300 })).not.toThrow();
  });

  it('does not throw for null storage', () => {
    expect(() => writePanelPreferences(null, { left: 300 })).not.toThrow();
  });
});

describe('keyboardPanelWidth', () => {
  it('left side: ArrowRight grows by the step', () => {
    expect(keyboardPanelWidth('left', 300, 'ArrowRight', false, 480)).toBe(316);
  });

  it('left side: shift+ArrowRight grows by the large step', () => {
    expect(keyboardPanelWidth('left', 300, 'ArrowRight', true, 480)).toBe(364);
  });

  it('left side: ArrowRight is capped at the passed max', () => {
    expect(keyboardPanelWidth('left', 470, 'ArrowRight', false, 480)).toBe(480);
  });

  it('left side: ArrowLeft shrinks by the step', () => {
    expect(keyboardPanelWidth('left', 300, 'ArrowLeft', false, 480)).toBe(284);
  });

  it('left side: ArrowLeft is floored at the side min', () => {
    expect(keyboardPanelWidth('left', 230, 'ArrowLeft', false, 480)).toBe(PANEL_LIMITS.left.min);
  });

  it('right side is mirrored: ArrowLeft grows', () => {
    expect(keyboardPanelWidth('right', 400, 'ArrowLeft', false, 600)).toBe(416);
  });

  it('right side is mirrored: ArrowRight shrinks and floors at the side min', () => {
    expect(keyboardPanelWidth('right', 310, 'ArrowRight', false, 600)).toBe(PANEL_LIMITS.right.min);
  });

  it('Home returns the side minimum', () => {
    expect(keyboardPanelWidth('left', 300, 'Home', false, 480)).toBe(PANEL_LIMITS.left.min);
    expect(keyboardPanelWidth('right', 400, 'Home', false, 600)).toBe(PANEL_LIMITS.right.min);
  });

  it('End returns the passed-in max parameter, not the PANEL_LIMITS max', () => {
    expect(keyboardPanelWidth('left', 300, 'End', false, 450)).toBe(450);
  });

  it('returns null for keys it does not handle', () => {
    expect(keyboardPanelWidth('left', 300, 'Tab', false, 480)).toBeNull();
    expect(keyboardPanelWidth('left', 300, 'ArrowUp', false, 480)).toBeNull();
    expect(keyboardPanelWidth('right', 300, 'ArrowDown', false, 600)).toBeNull();
  });
});

describe('clampPanelWidth', () => {
  it('rounds a fractional value within range', () => {
    expect(clampPanelWidth('left', 300.4)).toBe(300);
    expect(clampPanelWidth('left', 300.5)).toBe(301);
  });

  it('clamps below the min up to the min', () => {
    expect(clampPanelWidth('left', 10)).toBe(PANEL_LIMITS.left.min);
  });

  it('clamps above the max down to the max', () => {
    expect(clampPanelWidth('left', 10000)).toBe(PANEL_LIMITS.left.max);
  });

  it('clamps for the right side independently', () => {
    expect(clampPanelWidth('right', 200)).toBe(PANEL_LIMITS.right.min);
    expect(clampPanelWidth('right', 10000)).toBe(PANEL_LIMITS.right.max);
  });
});
