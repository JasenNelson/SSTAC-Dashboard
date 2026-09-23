/*
 * Adjustable side panels for the paper workspace (desktop, lg and up).
 *
 * The paper column always takes the remaining width; the two side panels have
 * a preset width per layout class (laptop, standard desktop, wide desktop), a
 * reader-chosen width that overrides the preset on this device, and hard
 * minimum and maximum widths. Whatever the preference, the paper column never
 * drops below PAPER_MIN_CENTER_WIDTH: the panels give way, right panel first,
 * down to their minimums.
 *
 * Preferences live in localStorage (per device, per browser), are wrapped in
 * try/catch everywhere, and a corrupt or out-of-range value is ignored rather
 * than trusted. Nothing here is a server preference.
 */

export type PanelSide = 'left' | 'right';
export type LayoutClass = 'laptop' | 'desktop' | 'wide';

export interface PanelWidths {
  readonly left: number;
  readonly right: number;
}

export interface PanelPreferences {
  readonly left?: number;
  readonly right?: number;
}

export const PANEL_WIDTH_STORAGE_KEY = 'mtwg-paper-panel-widths-v1';
export const PAPER_MIN_CENTER_WIDTH = 440;
export const PANEL_KEYBOARD_STEP = 16;
export const PANEL_KEYBOARD_LARGE_STEP = 64;

export const PANEL_LIMITS: Readonly<Record<PanelSide, { readonly min: number; readonly max: number }>> = Object.freeze({
  left: Object.freeze({ min: 224, max: 480 }),
  right: Object.freeze({ min: 304, max: 600 }),
});

/** Presets. The right panel holds the response editor, so it is the wider one. */
export const PANEL_PRESETS: Readonly<Record<LayoutClass, PanelWidths>> = Object.freeze({
  laptop: Object.freeze({ left: 256, right: 352 }),
  desktop: Object.freeze({ left: 288, right: 400 }),
  wide: Object.freeze({ left: 320, right: 448 }),
});

export function layoutClassFor(containerWidth: number): LayoutClass {
  if (containerWidth >= 1536) return 'wide';
  if (containerWidth >= 1280) return 'desktop';
  return 'laptop';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampPanelWidth(side: PanelSide, width: number): number {
  const { min, max } = PANEL_LIMITS[side];
  return Math.round(clamp(width, min, max));
}

function validWidth(side: PanelSide, value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const { min, max } = PANEL_LIMITS[side];
  return value >= min && value <= max ? Math.round(value) : undefined;
}

/**
 * The widths to render. `open` panels only take space when open, so a closed
 * left panel leaves its width to the paper and the right panel alike.
 */
export function resolvePanelWidths(containerWidth: number, preferences: PanelPreferences, open: { readonly left: boolean; readonly right: boolean }): PanelWidths {
  const preset = PANEL_PRESETS[layoutClassFor(containerWidth)];
  let left = validWidth('left', preferences.left) ?? preset.left;
  let right = validWidth('right', preferences.right) ?? preset.right;
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return { left, right };
  const used = () => (open.left ? left : 0) + (open.right ? right : 0);
  let excess = used() + PAPER_MIN_CENTER_WIDTH - containerWidth;
  if (excess > 0 && open.right) {
    const give = Math.min(excess, right - PANEL_LIMITS.right.min);
    right -= give;
    excess -= give;
  }
  if (excess > 0 && open.left) {
    const give = Math.min(excess, left - PANEL_LIMITS.left.min);
    left -= give;
  }
  return { left: Math.round(left), right: Math.round(right) };
}

/** The largest width a panel may take right now without squeezing the paper below its minimum. */
export function maxPanelWidth(side: PanelSide, containerWidth: number, other: number, otherOpen: boolean): number {
  const room = containerWidth - PAPER_MIN_CENTER_WIDTH - (otherOpen ? other : 0);
  return Math.max(PANEL_LIMITS[side].min, Math.min(PANEL_LIMITS[side].max, Math.floor(room)));
}

export function readPanelPreferences(storage: Pick<Storage, 'getItem'> | null | undefined): PanelPreferences {
  try {
    const raw = storage?.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const left = validWidth('left', record.left);
    const right = validWidth('right', record.right);
    return { ...(left !== undefined ? { left } : {}), ...(right !== undefined ? { right } : {}) };
  } catch {
    return {};
  }
}

export function writePanelPreferences(storage: Pick<Storage, 'setItem' | 'removeItem'> | null | undefined, preferences: PanelPreferences): void {
  try {
    if (preferences.left === undefined && preferences.right === undefined) storage?.removeItem(PANEL_WIDTH_STORAGE_KEY);
    else storage?.setItem(PANEL_WIDTH_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage unavailable (private mode, quota, blocked): the layout still works for this visit.
  }
}

/** Keyboard resizing for a vertical separator. Returns null for keys it does not handle. */
export function keyboardPanelWidth(side: PanelSide, current: number, key: string, shiftKey: boolean, max: number): number | null {
  const step = shiftKey ? PANEL_KEYBOARD_LARGE_STEP : PANEL_KEYBOARD_STEP;
  // The left panel grows to the right; the right panel grows to the left.
  const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft';
  const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
  const { min } = PANEL_LIMITS[side];
  if (key === grow) return Math.min(max, current + step);
  if (key === shrink) return Math.max(min, current - step);
  if (key === 'Home') return min;
  if (key === 'End') return max;
  return null;
}
