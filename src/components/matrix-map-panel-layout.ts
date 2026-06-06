// Panel layout constants and shared clamp helper for the matrix-map
// Interactive Map 3-column layout (left panel | map | right panel).
//
// Extracted from MatrixDashboard.tsx so the clamp logic is unit-testable
// without rendering the full dashboard. Both resize handles (left + right)
// and keyboard nudge handlers reuse clampMatrixMapPanelWidth.
//
// Phase 0 redesign (panel-redesign-2026-06-05):
//   - Left panel added (width state + drag handle on its right edge).
//   - Shared clamp replaces the old right-only clampMatrixMapRightPanelWidth.
//   - MATRIX_MAP_RIGHT_PANEL_MAX_WIDTH (720) removed; max is now viewport-
//     derived only (left + right <= viewport - MATRIX_MAP_MIN_MAP_WIDTH).
// Plain ASCII only (code point <= 127).

export const MATRIX_MAP_MIN_MAP_WIDTH = 48;
export const MATRIX_MAP_LEFT_PANEL_MIN_WIDTH = 280;
export const MATRIX_MAP_LEFT_PANEL_DEFAULT_WIDTH = 320;
export const MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH = 360;
export const MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH = 480;

/**
 * Return the viewport-derived maximum width for a panel given the other
 * panel's current width.  The max is: viewport - otherPanelWidth - sliver,
 * floored at the side minimum so it is never less than sideMin.
 *
 * SSR branch (typeof window === 'undefined'): return the side minimum so
 * server-rendered aria-valuemax attributes are consistent and never exceed
 * the values used during client hydration.
 *
 * Used by clampMatrixMapPanelWidth (single source for the max math) and by
 * the separator buttons to populate aria-valuemax.
 */
export function getMatrixMapPanelMaxWidth(
  side: 'left' | 'right',
  otherPanelWidth: number,
): number {
  const sideMin =
    side === 'left'
      ? MATRIX_MAP_LEFT_PANEL_MIN_WIDTH
      : MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH;

  if (typeof window === 'undefined') {
    return sideMin;
  }

  return Math.max(
    sideMin,
    window.innerWidth - otherPanelWidth - MATRIX_MAP_MIN_MAP_WIDTH,
  );
}

/**
 * Clamp a desired panel width so that:
 *   - the panel stays at or above its own minimum width, and
 *   - left + right together leave at least MATRIX_MAP_MIN_MAP_WIDTH px for
 *     the map (viewport-derived max).
 *
 * SSR branch (typeof window === 'undefined'): clamp to side min only; the
 * defaults (320 / 480) are below any reasonable viewport so there is no
 * live regression from the removed fixed max.
 *
 * Only one panel drags at a time. The idle panel's width is passed as
 * otherPanelWidth so the dragging panel cannot crowd the map sliver below
 * 48 px. When the other panel is hidden, pass 0.
 */
export function clampMatrixMapPanelWidth(
  side: 'left' | 'right',
  desired: number,
  otherPanelWidth: number,
): number {
  const sideMin =
    side === 'left'
      ? MATRIX_MAP_LEFT_PANEL_MIN_WIDTH
      : MATRIX_MAP_RIGHT_PANEL_MIN_WIDTH;

  if (typeof window === 'undefined') {
    // SSR: no viewport available; floor at side minimum only.
    return Math.max(sideMin, desired);
  }

  const viewportMax = getMatrixMapPanelMaxWidth(side, otherPanelWidth);
  return Math.min(viewportMax, Math.max(sideMin, desired));
}
