'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode, Ref } from 'react';

import { keyboardPanelWidth, PANEL_LIMITS } from '@/lib/matrix-options/paper/panel-layout';
import type { PanelSide } from '@/lib/matrix-options/paper/panel-layout';
import { cn } from '@/utils/cn';

/*
 * Rail, toggle and resize-handle contract for the paper workspace.
 *
 * DECOUPLED 2026-09-22 (owner brief: "Do not couple the paper workspace to
 * unrelated fixed-width rail parity tests"). These classes used to be copied
 * verbatim from MatrixDashboard.tsx, pinning the rails to fixed lg:w-80 /
 * lg:w-96 widths. The paper workspace now has reader-adjustable panels
 * (panel-layout.ts): at lg and up each open rail takes its width from a CSS
 * custom property the workspace sets on the layout element
 * (--paper-left-width / --paper-right-width), and the paper column takes the
 * rest. Below lg the rails stay in-flow stacked panels that collapse by
 * height, exactly as before, and closed rails are inert.
 * PaperRailDrift.test.ts now pins THIS contract instead of MatrixDashboard's.
 */
export const PAPER_LEFT_WIDTH_VAR = '--paper-left-width';
export const PAPER_RIGHT_WIDTH_VAR = '--paper-right-width';

export const PAPER_TOGGLE_BASE_CLASSES = 'flex min-h-[44px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] motion-reduce:transition-none';
export const PAPER_TOGGLE_ACTIVE_CLASSES = 'bg-[var(--db-accent-tint)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-2)]';
export const PAPER_TOGGLE_INACTIVE_CLASSES = 'text-[var(--db-text-secondary)] hover:bg-[var(--db-depth-1)] hover:text-[var(--db-text-primary)]';

export const PAPER_SHELL_CLASSES = 'flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden print:block print:overflow-visible print:h-auto';

const RAIL_BASE_CLASSES = 'flex-shrink-0 overflow-hidden transition-[width,max-height] duration-200 ease-out motion-reduce:transition-none group-data-[resizing=true]/layout:transition-none';
export const PAPER_LEFT_RAIL_BORDER_CLASSES = 'border-b lg:border-b-0 lg:border-r';
export const PAPER_RIGHT_RAIL_BORDER_CLASSES = 'border-t lg:border-t-0 lg:border-l';
export const PAPER_LEFT_RAIL_SURFACE_CLASSES = 'bg-[var(--db-depth-1)] border-[var(--db-border)]';
export const PAPER_RIGHT_RAIL_SURFACE_CLASSES = 'bg-[var(--db-surface)] border-[var(--db-border)]';
export const PAPER_LEFT_RAIL_OPEN_WIDTH = 'lg:w-[var(--paper-left-width)]';
export const PAPER_RIGHT_RAIL_OPEN_WIDTH = 'lg:w-[var(--paper-right-width)]';
export const PAPER_RAIL_OPEN_CLASSES = 'w-full';
export const PAPER_RAIL_CLOSED_CLASSES = 'max-h-0 w-full border-0 lg:max-h-none lg:w-0';

/** The complete class string a rail wrapper carries for a side and open state. */
export function paperRailClassName(side: 'left' | 'right', open: boolean): string {
  return cn(
    RAIL_BASE_CLASSES,
    side === 'left' ? PAPER_LEFT_RAIL_BORDER_CLASSES : PAPER_RIGHT_RAIL_BORDER_CLASSES,
    side === 'left' ? PAPER_LEFT_RAIL_SURFACE_CLASSES : PAPER_RIGHT_RAIL_SURFACE_CLASSES,
    open ? cn(PAPER_RAIL_OPEN_CLASSES, side === 'left' ? PAPER_LEFT_RAIL_OPEN_WIDTH : PAPER_RIGHT_RAIL_OPEN_WIDTH) : PAPER_RAIL_CLOSED_CLASSES,
    'print:hidden',
  );
}

/**
 * Escape closes an open panel only when the key event is not already handled
 * and does not come from a native select (which uses Escape to dismiss its
 * own list). Callers attach this to the panel element, never to document.
 */
export function isPanelEscapeKey(event: KeyboardEvent<HTMLElement>): boolean {
  if (event.key !== 'Escape' || event.defaultPrevented) return false;
  const target = event.target as Element | null;
  return !(target && typeof target.closest === 'function' && target.closest('select'));
}

export interface PaperRailToggleProps {
  readonly label: string;
  readonly open: boolean;
  readonly controls: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
  readonly testId?: string;
}

export function PaperRailToggle({ label, open, controls, icon, onClick, buttonRef, testId }: PaperRailToggleProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      data-testid={testId}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
      title={label}
      className={cn(PAPER_TOGGLE_BASE_CLASSES, 'min-w-[44px] justify-center', open ? PAPER_TOGGLE_ACTIVE_CLASSES : PAPER_TOGGLE_INACTIVE_CLASSES)}
    >
      {icon}
      {/* Icon-only between lg and xl so the header stays one line on laptops; the name stays for assistive technology. */}
      <span className="lg:sr-only xl:not-sr-only">{label}</span>
    </button>
  );
}

export interface PaperRailProps {
  readonly id: string;
  readonly side: 'left' | 'right';
  readonly open: boolean;
  readonly heading: string;
  readonly headingId: string;
  readonly headingRef?: Ref<HTMLHeadingElement>;
  readonly onEscape?: () => void;
  readonly testId?: string;
  readonly children: ReactNode;
}

/**
 * In-flow rail (never a modal or overlay). Open rails have no max-height cap;
 * closed rails collapse by height below lg and by width at lg and up, and are
 * inert so clipped content leaves the focus order and accessibility tree. The
 * inner column keeps the panel's own width while the outer one animates, so
 * content never reflows mid-transition.
 */
export function PaperRail({ id, side, open, heading, headingId, headingRef, onEscape, testId, children }: PaperRailProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || !onEscape || !isPanelEscapeKey(event)) return;
    event.preventDefault();
    onEscape();
  };
  return (
    <aside
      id={id}
      data-testid={testId}
      data-state={open ? 'open' : 'closed'}
      aria-labelledby={headingId}
      inert={open ? undefined : true}
      onKeyDown={onKeyDown}
      className={paperRailClassName(side, open)}
    >
      <div className={cn('w-full min-w-0 p-4 sm:p-5 lg:h-full lg:overflow-y-auto', side === 'left' ? 'lg:w-[var(--paper-left-width)]' : 'lg:w-[var(--paper-right-width)]')}>
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mb-3 scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] text-xs font-semibold uppercase tracking-wide text-[var(--db-text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"
        >
          {heading}
        </h2>
        {children}
      </div>
    </aside>
  );
}

export interface PanelResizeHandleProps {
  readonly side: PanelSide;
  readonly label: string;
  readonly controls: string;
  readonly width: number;
  /** Largest width allowed now (panel-layout maxPanelWidth). */
  readonly max: number;
  readonly onResize: (width: number) => void;
  /** Resize finished (pointer up or keyboard step): persist. */
  readonly onCommit: (width: number) => void;
  readonly onReset: () => void;
  readonly onDragChange?: (dragging: boolean) => void;
}

/**
 * Vertical separator between a side panel and the paper (lg and up only).
 * Pointer: drag. Keyboard: arrows (Shift for larger steps), Home/End for the
 * minimum and maximum. Double-click or Enter resets that panel to its preset.
 * The visible rule is 1px and restrained, drawn on the panel boundary; the
 * pointer hit area is 24px wide (WCAG 2.5.8) and the full height of the
 * workspace. It extends only to the RIGHT of the boundary (4px of layout plus
 * 20px over the right-hand neighbour's padding): the column on the LEFT of each
 * handle scrolls, and its scrollbar sits on its right edge, so a symmetric hit
 * area would turn a scrollbar grab into a resize. Keyboard resizing and
 * "Reset panel widths" are the equivalent controls.
 */
export function PanelResizeHandle({ side, label, controls, width, max, onResize, onCommit, onReset, onDragChange }: PanelResizeHandleProps) {
  const drag = useRef<{ readonly startX: number; readonly startWidth: number; last: number } | null>(null);
  const min = PANEL_LIMITS[side].min;
  // A handle removed mid-drag (its panel closed) must not leave the layout resizing.
  const onDragChangeRef = useRef(onDragChange);
  onDragChangeRef.current = onDragChange;
  useEffect(() => () => {
    if (drag.current) {
      drag.current = null;
      onDragChangeRef.current?.(false);
    }
  }, []);
  const widthFor = (clientX: number) => {
    const current = drag.current;
    if (!current) return width;
    const delta = side === 'left' ? clientX - current.startX : current.startX - clientX;
    return Math.round(Math.min(max, Math.max(min, current.startWidth + delta)));
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: width, last: width };
    onDragChange?.(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const next = widthFor(event.clientX);
    drag.current.last = next;
    onResize(next);
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { last: final, startWidth } = drag.current;
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    onDragChange?.(false);
    // A press without movement is not a preference: only a real drag is saved.
    if (final !== startWidth) onCommit(final);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onReset();
      return;
    }
    const next = keyboardPanelWidth(side, width, event.key, event.shiftKey, max);
    if (next === null) return;
    event.preventDefault();
    onResize(next);
    onCommit(next);
  };
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuetext={`${width} pixels wide`}
      data-testid={`paper-resize-${side}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      title="Drag to resize. Double-click to reset."
      className="group/handle relative z-10 -mr-5 hidden w-6 shrink-0 cursor-col-resize touch-none select-none focus:outline-none lg:block print:hidden"
    >
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-transparent transition-colors group-hover/handle:bg-[var(--db-accent)] group-focus-visible/handle:w-0.5 group-focus-visible/handle:bg-[var(--db-focus-ring)] motion-reduce:transition-none" />
      <span aria-hidden="true" className="absolute left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-[var(--db-border-strong)] opacity-0 transition-opacity group-hover/handle:opacity-100 group-focus-visible/handle:opacity-100 motion-reduce:transition-none" />
    </div>
  );
}
