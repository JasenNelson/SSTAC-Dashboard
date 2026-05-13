// engine_v2 frontend Lane 2d / Phase A: keymap helpers.
//
// Pure helpers consumed by EvaluationSidePanel.tsx. Listener
// attach/detach is the caller's responsibility (an effect inside the
// panel) so unmount cleanup stays in the React component lifecycle.
//
// Bindings (ED-2d4-14):
//   - Cmd+K / Ctrl+K  -> open panel + focus omni-input
//   - Cmd+J / Ctrl+J  -> toggle open/closed
//   - Esc             -> close panel (state preserved)
//   - Arrow Left/Right inside the tab strip -> cycle SIDE_PANEL_TABS
//
// ASCII only.

import { SIDE_PANEL_TABS, type SidePanelTab } from "./useSidePanelState";

export interface PanelKeymapHandlers {
  /** Open the panel and focus the active tab's omni-input. */
  onOpenAndFocus: () => void;
  /** Toggle open/closed without changing focus. */
  onToggleOpen: () => void;
  /** Close the panel (state preserved in localStorage). */
  onClose: () => void;
}

/**
 * Returns a window-level keydown handler that implements the panel's
 * three global shortcuts. Wire it inside the panel with addEventListener
 * + removeEventListener in a single useEffect.
 */
export function createGlobalKeydownHandler(
  handlers: PanelKeymapHandlers,
): (ev: KeyboardEvent) => void {
  return (ev: KeyboardEvent): void => {
    const modifier = ev.metaKey || ev.ctrlKey;
    const key = ev.key.toLowerCase();

    if (modifier && key === "k") {
      ev.preventDefault();
      handlers.onOpenAndFocus();
      return;
    }

    if (modifier && key === "j") {
      ev.preventDefault();
      handlers.onToggleOpen();
      return;
    }

    if (key === "escape" && !modifier) {
      // Only intercept Esc if the panel logic wants to close. Caller
      // can no-op when already closed.
      handlers.onClose();
      return;
    }
  };
}

/**
 * Pure tab-strip arrow handler. Returns the next tab to activate, or
 * null if the key is not Left/Right. Caller wires it onto the tablist
 * element's onKeyDown.
 */
export function nextTabFromArrowKey(
  key: string,
  current: SidePanelTab,
): SidePanelTab | null {
  const idx = SIDE_PANEL_TABS.indexOf(current);
  if (idx === -1) return null;
  if (key === "ArrowRight") {
    return SIDE_PANEL_TABS[(idx + 1) % SIDE_PANEL_TABS.length];
  }
  if (key === "ArrowLeft") {
    return SIDE_PANEL_TABS[
      (idx - 1 + SIDE_PANEL_TABS.length) % SIDE_PANEL_TABS.length
    ];
  }
  return null;
}
