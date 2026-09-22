'use client';

import type { KeyboardEvent, ReactNode, Ref } from 'react';

import { cn } from '@/utils/cn';

/*
 * Rail and toggle class contract for the paper workspace.
 *
 * Every constant below is copied verbatim from src/components/MatrixDashboard.tsx
 * (the Catalogue/Calculator rail model):
 * - header toggles: the left/right panel toggle buttons (~1615-1658);
 * - shell: the flex row wrapper (~1741);
 * - left rail: the left sidebar wrapper (~1745-1824), Catalogue width lg:w-80;
 * - right rail: the right drawer wrapper (~1906-1946), Calculator width lg:w-96.
 * MatrixDashboard.tsx is not modified. Parity is pinned by
 * src/components/matrix-options/paper/__tests__/PaperRailDrift.test.ts, which
 * reads the MatrixDashboard source and fails if any of these strings drift.
 */
export const PAPER_TOGGLE_BASE_CLASSES = 'flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
export const PAPER_TOGGLE_ACTIVE_CLASSES = 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60';
export const PAPER_TOGGLE_INACTIVE_CLASSES = 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-xs';

export const PAPER_SHELL_CLASSES = 'flex flex-col lg:flex-row flex-1 overflow-y-auto lg:overflow-hidden print:block print:overflow-visible print:h-auto';

export const PAPER_LEFT_RAIL_BASE_CLASSES = 'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 motion-reduce:transition-none';
export const PAPER_LEFT_RAIL_BORDER_CLASSES = 'border-b lg:border-b-0 lg:border-r';
export const PAPER_LEFT_RAIL_SURFACE_CLASSES = 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800';
export const PAPER_LEFT_RAIL_OPEN_CLASSES = 'w-full p-6';
export const PAPER_LEFT_RAIL_OPEN_WIDTH = 'lg:w-80';
export const PAPER_LEFT_RAIL_CLOSED_CLASSES = 'max-h-0 w-full border-b-0 p-0 lg:max-h-none lg:w-0';
export const PAPER_LEFT_RAIL_INNER_CLASSES = 'w-full min-w-0 lg:min-w-[270px]';

export const PAPER_RIGHT_RAIL_BASE_CLASSES = 'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 shadow-2xl motion-reduce:transition-none';
export const PAPER_RIGHT_RAIL_BORDER_CLASSES = 'border-t lg:border-t-0 lg:border-l';
export const PAPER_RIGHT_RAIL_SURFACE_CLASSES = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
export const PAPER_RIGHT_RAIL_OPEN_CLASSES = 'w-full';
export const PAPER_RIGHT_RAIL_OPEN_WIDTH = 'lg:w-96';
export const PAPER_RIGHT_RAIL_CLOSED_CLASSES = 'max-h-0 w-full border-t-0 lg:max-h-none lg:w-0';
export const PAPER_RIGHT_RAIL_INNER_WIDTH = 'w-full lg:w-[384px]';

/** The complete class string a rail wrapper carries for a side and open state. */
export function paperRailClassName(side: 'left' | 'right', open: boolean): string {
  if (side === 'left') {
    return cn(
      PAPER_LEFT_RAIL_BASE_CLASSES,
      PAPER_LEFT_RAIL_BORDER_CLASSES,
      PAPER_LEFT_RAIL_SURFACE_CLASSES,
      open ? cn(PAPER_LEFT_RAIL_OPEN_CLASSES, PAPER_LEFT_RAIL_OPEN_WIDTH) : PAPER_LEFT_RAIL_CLOSED_CLASSES,
      'print:hidden',
    );
  }
  return cn(
    PAPER_RIGHT_RAIL_BASE_CLASSES,
    PAPER_RIGHT_RAIL_BORDER_CLASSES,
    PAPER_RIGHT_RAIL_SURFACE_CLASSES,
    open ? cn(PAPER_RIGHT_RAIL_OPEN_CLASSES, PAPER_RIGHT_RAIL_OPEN_WIDTH) : PAPER_RIGHT_RAIL_CLOSED_CLASSES,
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
      className={cn(PAPER_TOGGLE_BASE_CLASSES, open ? PAPER_TOGGLE_ACTIVE_CLASSES : PAPER_TOGGLE_INACTIVE_CLASSES)}
    >
      {icon}
      <span>{label}</span>
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
 * inert so clipped content leaves the focus order and accessibility tree.
 */
export function PaperRail({ id, side, open, heading, headingId, headingRef, onEscape, testId, children }: PaperRailProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!open || !onEscape || !isPanelEscapeKey(event)) return;
    event.preventDefault();
    onEscape();
  };
  const innerClassName = side === 'left'
    ? cn(PAPER_LEFT_RAIL_INNER_CLASSES, 'lg:h-full lg:overflow-y-auto')
    : cn(PAPER_RIGHT_RAIL_INNER_WIDTH, 'p-5 lg:h-full lg:overflow-y-auto');
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
      <div className={innerClassName}>
        <h2
          ref={headingRef}
          id={headingId}
          tabIndex={-1}
          className="mb-4 scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] text-xs font-bold uppercase tracking-wider text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-slate-300"
        >
          {heading}
        </h2>
        {children}
      </div>
    </aside>
  );
}
