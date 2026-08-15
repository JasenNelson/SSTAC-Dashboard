'use client';

// CalculatorSummaryBar -- compact, sticky summary at the top of the
// Calculator centre column (DESIGN.md "Layout: stages inside rails" +
// "The calculator produces an adjusted standard, not a verdict"). Carries
// the three numbers that matter -- preliminary standard, background UTL
// 95/95, and the adjusted standard -- and fills in as each stage resolves.
//
// Purely presentational: callers own the derivation and pass in the
// current value/state for each slot. This component never computes a
// number itself.
//
// Plain ASCII only.

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';
import {
  ANNOUNCEMENT_DEBOUNCE_MS,
  STAGE_STATE_LABELS,
  StageStateChip,
  type StageState,
} from './CalculatorStage';
import { formatMagnitude } from '@/lib/matrix-options/formatMagnitude';

export interface SummaryBarSlot {
  label: string;
  value: number | null;
  unit: string;
  state: StageState;
  /** Short note shown under the value, e.g. which stage produced it or why it is pending. */
  note?: string;
  /**
   * Custom formatter for the numeric value. Defaults to formatMagnitude
   * (magnitude-aware significant figures) -- see
   * src/lib/matrix-options/formatMagnitude.ts. Prefer the default unless a
   * slot genuinely needs different precision or notation; do not reach for
   * toFixed/toPrecision ad hoc here, that inconsistency is exactly what
   * P1-1 fixed.
   */
  formatValue?: (value: number) => string;
}

export interface CalculatorSummaryBarProps {
  /** e.g. "Human Health Direct Contact" -- shown in the bar's header. */
  pathwayLabel: string;
  preliminary: SummaryBarSlot;
  utl: SummaryBarSlot;
  adjusted: SummaryBarSlot;
  /** e.g. "background UTL 95/95 (5.7331 mg/kg)" -- which term is governing, when known. */
  governingLabel?: string;
  governingNote?: string;
  testId?: string;
}

export default function CalculatorSummaryBar({
  pathwayLabel,
  preliminary,
  utl,
  adjusted,
  governingLabel,
  governingNote,
  testId = 'calculator-summary-bar',
}: CalculatorSummaryBarProps) {
  const slots: Array<SummaryBarSlot & { key: string }> = [
    { key: 'preliminary', ...preliminary },
    { key: 'utl', ...utl },
    { key: 'adjusted', ...adjusted },
  ];
  const computedCount = slots.filter((slot) => slot.state === 'computed').length;

  // The three numbers fill in as stages resolve; a value that changes
  // silently is a defect (DESIGN.md non-negotiable), so announce the
  // combined state through one live region whenever any slot changes.
  //
  // Same two refinements as CalculatorStage (P2-6): skip the announcement
  // that would otherwise fire on mount (only real changes are announced),
  // and debounce so a burst of rapid slot changes -- e.g. every keystroke
  // in an upstream input flowing through to this bar's preliminary/UTL/
  // adjusted values -- collapses into one announcement of the settled
  // state instead of one per keystroke, reusing the same
  // ANNOUNCEMENT_DEBOUNCE_MS as CalculatorStage so the two live regions
  // feel like part of one coherent announcement rhythm.
  const previousMessageRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const message = slots
      .map((slot) => {
        const valueText =
          slot.value != null
            ? `${slot.formatValue ? slot.formatValue(slot.value) : formatMagnitude(slot.value)} ${slot.unit}`
            : 'no value yet';
        return `${slot.label}: ${STAGE_STATE_LABELS[slot.state]}, ${valueText}`;
      })
      .join('. ');
    if (previousMessageRef.current === message) {
      return;
    }
    previousMessageRef.current = message;

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const timer = setTimeout(() => {
      setAnnouncement(message);
    }, ANNOUNCEMENT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // slots is rebuilt every render from the three slot props; depend on
    // the primitive fields that actually determine the announcement text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    preliminary.label,
    preliminary.state,
    preliminary.value,
    preliminary.unit,
    utl.label,
    utl.state,
    utl.value,
    utl.unit,
    adjusted.label,
    adjusted.state,
    adjusted.value,
    adjusted.unit,
  ]);

  return (
    <div
      data-testid={testId}
      role="group"
      aria-label={`Derivation summary for ${pathwayLabel}, fills in as stages resolve`}
      className="sticky top-0 z-10 mb-6 rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface-raised)] p-4 shadow-[var(--db-shadow-2)]"
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--db-text-muted)]">
          Working values - {pathwayLabel}
        </span>
        <span
          className="font-mono text-[11px] text-[var(--db-text-muted)]"
          data-testid={`${testId}-progress`}
        >
          {computedCount} of {slots.length} numbers computed
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {slots.map((slot) => (
          <div
            key={slot.key}
            data-testid={`${testId}-${slot.key}`}
            className={cn(
              'min-w-0 rounded border p-2.5',
              slot.state === 'computed' &&
                'border-[var(--db-pass-tint-border)] bg-[var(--db-pass-tint)]',
              slot.state === 'blocked' &&
                'border-[var(--db-fail-tint-border)] bg-[var(--db-fail-tint)]',
              slot.state === 'waiting' &&
                'border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)]',
              slot.state === 'pending' &&
                'border-[var(--db-border)] bg-[var(--db-depth-0)]',
            )}
          >
            <p className="m-0 mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[var(--db-text-muted)]">
              {slot.label}
            </p>
            <div className="flex flex-wrap items-baseline gap-1">
              <span
                className={cn(
                  'font-mono text-[17px] font-bold',
                  slot.value != null
                    ? 'text-[var(--db-text-primary)]'
                    : 'text-[var(--db-text-muted)]',
                )}
                data-testid={`${testId}-${slot.key}-value`}
              >
                {slot.value != null
                  ? slot.formatValue
                    ? slot.formatValue(slot.value)
                    : formatMagnitude(slot.value)
                  : '--'}
              </span>
              {slot.value != null && (
                <span className="text-[11px] text-[var(--db-text-secondary)]">
                  {slot.unit}
                </span>
              )}
            </div>
            <div className="mt-1.5">
              <StageStateChip state={slot.state} testId={`${testId}-${slot.key}-chip`} />
            </div>
            {slot.note && (
              <p className="mt-1 text-[11px] leading-snug text-[var(--db-text-secondary)]">
                {slot.note}
              </p>
            )}
          </div>
        ))}
      </div>
      {governingLabel && (
        <div
          className="mt-3 border-t border-[var(--db-border)] pt-2.5 text-xs text-[var(--db-text-secondary)]"
          data-testid={`${testId}-governing`}
        >
          Governing value: <strong className="text-[var(--db-text-primary)]">{governingLabel}</strong>
          {governingNote ? ` - ${governingNote}` : ''}
        </div>
      )}
      {/*
        aria-atomic="true" is kept deliberately (P2-6): the announcement
        text built above is always ONE already-combined sentence covering
        all three slots, not three independently-updating child nodes, so
        atomic does not cause the "re-read everything for a one-slot
        change" verbosity the audit flagged -- there is nothing partial to
        diff against. That flooding came from firing this full sentence on
        every keystroke; the debounce above fixes the actual cause. Keeping
        atomic here means a screen-reader user always gets the complete,
        coherent three-slot state rather than a fragment that would not
        make sense standing alone.
      */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid={`${testId}-live-region`}
      >
        {announcement}
      </div>
    </div>
  );
}
