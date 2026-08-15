'use client';

// CalculatorStage -- reusable numbered stage shell for the Matrix Options
// Calculator redesign (DESIGN.md "Layout: stages inside rails" + "Four
// states, not two"). Purely presentational: it renders structure AROUND
// whatever a calculator passes as children. It never computes, validates,
// or mutates a calculation -- callers decide the state and pass it in.
//
// Consumes only --db-* tokens (DESIGN.md "Tokens" -- never hardcode a
// colour). Both themes resolve automatically because the tokens do.
//
// Plain ASCII only.

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/cn';

// The four states a derivation stage (or a summary-bar slot, which reuses
// StageStateChip) can be in. DESIGN.md "Four states, not two":
//   COMPUTED - a real value
//   PENDING  - not entered yet, no error
//   WAITING  - blocked by something upstream, not by this stage
//   BLOCKED  - the error is here
export type StageState = 'computed' | 'pending' | 'waiting' | 'blocked';

export const STAGE_STATE_LABELS: Record<StageState, string> = {
  computed: 'COMPUTED',
  pending: 'PENDING',
  waiting: 'WAITING',
  blocked: 'BLOCKED',
};

const STAGE_STATE_CLASSES: Record<StageState, string> = {
  computed:
    'border-[var(--db-pass-tint-border)] bg-[var(--db-pass-tint)] text-[var(--db-pass)]',
  pending:
    'border-[var(--db-border-strong)] bg-[var(--db-depth-2)] text-[var(--db-text-secondary)]',
  waiting:
    'border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] text-[var(--db-review)]',
  blocked:
    'border-[var(--db-fail-tint-border)] bg-[var(--db-fail-tint)] text-[var(--db-fail)]',
};

export interface StageStateChipProps {
  state: StageState;
  className?: string;
  testId?: string;
}

// Status is never colour alone (DESIGN.md non-negotiable): every chip
// carries the text label from STAGE_STATE_LABELS plus a coloured dot.
export function StageStateChip({ state, className, testId }: StageStateChipProps) {
  return (
    <span
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide',
        STAGE_STATE_CLASSES[state],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {STAGE_STATE_LABELS[state]}
    </span>
  );
}

// Heading levels a stage title may render as. A calculator titles itself
// with h3 (DESIGN.md), so a stage rendered inside it must be h4 or deeper
// to stay a genuine child in the document heading outline -- otherwise a
// screen-reader user navigating by heading gets a flat list of ~14
// same-level h3s with no signal which stage belongs to which calculator
// (P2-5, adversarial UI QA audit 2026-08-14).
export type StageHeadingLevel = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

// How long to wait, after the last announcement-relevant prop change,
// before actually replacing the live-region text (P2-6, same audit).
// Typing a value is a burst of rapid changes (each keystroke can flip
// state/stateDetail); without debouncing, every keystroke queues its own
// screen-reader announcement. 400ms sits comfortably above typical
// keystroke cadence (~100-300ms between characters) so a still-typing
// user does not trigger intermediate announcements, while staying short
// enough that the announcement still reads as an immediate reaction once
// the user pauses. useEffect's cleanup (clearing the previous timer
// whenever the deps change again before it fires) is what makes a rapid
// sequence collapse to only the FINAL settled state being announced.
export const ANNOUNCEMENT_DEBOUNCE_MS = 400;

export interface CalculatorStageProps {
  /** 1-based position of this stage in the derivation. */
  number: number;
  /** Total stage count for the "Stage N of M" label. */
  totalStages: number;
  title: string;
  /**
   * Heading tag for the stage title. Defaults to "h4" because the
   * calculator that contains a stage titles itself with h3 -- a stage
   * heading must sit one level below that to be a real child in the
   * outline, not a sibling.
   */
  headingLevel?: StageHeadingLevel;
  state: StageState;
  /**
   * Short, specific explanation of why the stage is in its current state
   * (DESIGN.md "Fail loudly and specifically" -- name what is wrong, where,
   * and why). Also feeds the live-region announcement.
   */
  stateDetail?: string;
  /**
   * What this stage receives from an earlier stage, e.g.
   * "Stage 1 exposure factors". Rendered as a small provenance line and
   * shown to a WAITING stage so the blocking dependency is explicit.
   */
  receivedFrom?: string;
  /** Visually marks the stage the user is actively working, per the mockup. */
  current?: boolean;
  testId?: string;
  children: React.ReactNode;
}

export default function CalculatorStage({
  number,
  totalStages,
  title,
  headingLevel = 'h4',
  state,
  stateDetail,
  receivedFrom,
  current = false,
  testId,
  children,
}: CalculatorStageProps) {
  const headingId = testId ? `${testId}-title` : `calc-stage-${number}-title`;
  const locked = state === 'waiting' || state === 'blocked';
  const Heading = headingLevel as React.ElementType;

  // Stage state changes must be announced (DESIGN.md non-negotiable): a
  // visually-hidden live region whose TEXT is replaced (not merely present)
  // whenever state/stateDetail changes, so a screen-reader user gets the
  // same "what changed and why" signal a sighted user gets from the chip.
  //
  // Two refinements over a naive "announce on every change" effect
  // (P2-6): (1) the mount-guard below skips the very first message so
  // page load does not announce every stage's initial state at once --
  // only real transitions are announced; (2) the change is debounced by
  // ANNOUNCEMENT_DEBOUNCE_MS so a burst of rapid changes (e.g. one per
  // keystroke in an upstream field) collapses into a single announcement
  // of the settled state, not one queued announcement per keystroke.
  const previousMessageRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const message = `${title}: ${STAGE_STATE_LABELS[state]}${stateDetail ? `. ${stateDetail}` : ''}`;
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
  }, [title, state, stateDetail]);

  return (
    <section
      data-testid={testId}
      data-stage-state={state}
      data-stage-current={current || undefined}
      aria-labelledby={headingId}
      className="border-b border-[var(--db-border)] pb-6 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'flex h-8 w-8 flex-none items-center justify-center rounded-full border font-mono text-sm font-bold',
            current
              ? 'border-[var(--db-accent)] bg-[var(--db-accent)] text-[var(--db-text-on-accent)]'
              : locked
                ? 'border-[var(--db-border-strong)] bg-[var(--db-depth-2)] text-[var(--db-text-muted)]'
                : 'border-[var(--db-border-strong)] bg-[var(--db-surface)] text-[var(--db-text-secondary)]',
          )}
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-[var(--db-text-muted)]">
            Stage {number} of {totalStages}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <Heading
              id={headingId}
              className="m-0 text-lg font-semibold text-[var(--db-text-primary)]"
            >
              {title}
            </Heading>
            <StageStateChip
              state={state}
              testId={testId ? `${testId}-chip` : undefined}
            />
          </div>
          {receivedFrom && (
            <p
              className="mt-1 text-xs text-[var(--db-text-muted)]"
              data-testid={testId ? `${testId}-received-from` : undefined}
            >
              Uses: {receivedFrom}
            </p>
          )}
          {stateDetail && (
            <p
              className="mt-1 text-xs text-[var(--db-text-secondary)]"
              data-testid={testId ? `${testId}-state-detail` : undefined}
            >
              {stateDetail}
            </p>
          )}
        </div>
      </div>
      <div
        className="mt-4 ml-11"
        data-testid={testId ? `${testId}-body` : undefined}
      >
        {children}
      </div>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid={testId ? `${testId}-live-region` : undefined}
      >
        {announcement}
      </div>
    </section>
  );
}
