'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';

/*
 * Anchored, non-modal popover for header actions (Download Files, About this
 * draft). It overlays the workspace instead of inserting a block into the
 * paper, so opening it never moves the reading position.
 *
 * - Positioned `fixed` against its trigger and portalled to <body>, so no
 *   overflow container can clip it. Desktop: below the trigger, flipped above
 *   when there is more room there, clamped to an 8px viewport margin. Narrow
 *   viewports (< 640px): a full-width sheet under the trigger.
 * - Escape closes and returns focus to the trigger. A pointer press outside
 *   (trigger excluded) closes without stealing focus from what was pressed.
 *   Focus leaving the popover for anything but the trigger closes it.
 * - On open, focus moves to the first focusable element inside (preventScroll,
 *   per the scroll authority's no-raw-scroll rule).
 * - role="dialog" with an accessible name; the trigger carries aria-expanded,
 *   aria-controls and aria-haspopup="dialog".
 */

export const PAPER_POPOVER_MARGIN_PX = 8;
export const PAPER_POPOVER_GAP_PX = 8;
export const PAPER_POPOVER_SHEET_MAX_WIDTH_PX = 640;

export interface PopoverPlacement {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly side: 'below' | 'above';
  readonly sheet: boolean;
}

/** Pure placement: trigger rect + popover size + viewport -> fixed position. */
export function computePopoverPlacement(
  trigger: { readonly top: number; readonly bottom: number; readonly left: number; readonly width: number },
  popover: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): PopoverPlacement {
  const margin = PAPER_POPOVER_MARGIN_PX;
  const gap = PAPER_POPOVER_GAP_PX;
  const spaceBelow = viewport.height - trigger.bottom - gap - margin;
  const spaceAbove = trigger.top - gap - margin;
  if (viewport.width < PAPER_POPOVER_SHEET_MAX_WIDTH_PX) {
    const top = trigger.bottom + gap;
    return { top, left: margin, width: viewport.width - margin * 2, maxHeight: Math.max(160, viewport.height - top - margin), side: 'below', sheet: true };
  }
  const width = Math.min(popover.width, viewport.width - margin * 2);
  const centred = trigger.left + trigger.width / 2 - width / 2;
  const left = Math.min(Math.max(centred, margin), viewport.width - width - margin);
  const below = popover.height <= spaceBelow || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, below ? spaceBelow : spaceAbove);
  const height = Math.min(popover.height, maxHeight);
  const top = below ? trigger.bottom + gap : trigger.top - gap - height;
  return { top, left, width, maxHeight, side: below ? 'below' : 'above', sheet: false };
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface PaperPopoverProps {
  readonly id: string;
  readonly open: boolean;
  readonly triggerRef: RefObject<HTMLElement | null>;
  readonly label: string;
  readonly onClose: (reason: 'escape' | 'outside' | 'blur' | 'action') => void;
  readonly testId?: string;
  /** Preferred desktop width in px. */
  readonly width?: number;
  /** Keep the content mounted (hidden, inert) while closed, so in-flight work keeps its state. */
  readonly keepMounted?: boolean;
  readonly children: ReactNode;
}

export function PaperPopover({ id, open, triggerRef, label, onClose, testId, width = 360, keepMounted = false, children }: PaperPopoverProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel || typeof window === 'undefined') return;
    const rect = trigger.getBoundingClientRect();
    setPlacement(computePopoverPlacement(rect, { width, height: panel.scrollHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [triggerRef, width]);

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return undefined;
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // `mounted`: the panel first exists after the post-mount render (portal is client-only).
  }, [open, place, mounted]);

  // Focus moves in once the popover is positioned (it is hidden until then, and
  // a hidden element cannot take focus), exactly once per opening.
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      focusedRef.current = false;
      return;
    }
    if (!placement || focusedRef.current) return;
    focusedRef.current = true;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
    first?.focus({ preventScroll: true });
  }, [open, placement]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      onCloseRef.current('escape');
      triggerRef.current?.focus({ preventScroll: true });
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target || panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onCloseRef.current('outside');
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, triggerRef]);

  if (typeof document === 'undefined' || !mounted || (!open && !keepMounted)) return null;
  if (!open) {
    return createPortal(<div id={id} data-testid={testId} hidden inert aria-hidden="true">{children}</div>, document.body);
  }
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="dialog"
      aria-label={label}
      data-testid={testId}
      data-placement={placement?.side ?? 'below'}
      data-sheet={placement?.sheet ? 'true' : undefined}
      tabIndex={-1}
      onBlur={(event) => {
        // A null relatedTarget (focus went nowhere, e.g. Safari does not focus a
        // clicked button) is left to the pointerdown-outside handler.
        const next = event.relatedTarget as Node | null;
        if (!next || panelRef.current?.contains(next) || triggerRef.current?.contains(next)) return;
        onCloseRef.current('blur');
      }}
      style={placement ? { top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight } : { top: 0, left: 0, width, visibility: 'hidden' }}
      className="fixed z-50 overflow-y-auto rounded-lg border border-[var(--db-border-strong)] bg-[var(--db-surface-raised)] p-2 text-[var(--db-text-primary)] shadow-[var(--db-shadow-2)] focus:outline-none print:hidden"
    >
      {children}
    </div>,
    document.body,
  );
}
