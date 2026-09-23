import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/utils/cn';

import type { ReviewNavTopic } from '@/lib/matrix-options/paper/review-navigation';

/*
 * Compact review progress: one segment per question, grouped by review topic,
 * paired with an explicit count. State is carried by SHAPE as well as colour
 * (never colour alone): hollow = not started, lower half filled = draft,
 * solid = submitted, solid with an open centre = changed since submission.
 * The current question is underlined. The tracker is a read-only summary;
 * the Jump to topic control and the response list are the navigation.
 */

export type ReviewProgressState = 'not-started' | 'draft' | 'draft-local' | 'draft-page' | 'submitted' | 'changed';

export const REVIEW_PROGRESS_STATE_TEXT: Readonly<Record<ReviewProgressState, string>> = Object.freeze({
  'not-started': 'Not started',
  draft: 'Draft saved',
  'draft-local': 'Draft in this browser only',
  'draft-page': 'Unsaved on this page only (lost on reload)',
  submitted: 'Submitted',
  changed: 'Changed since submission',
});

/** Submitted responses (a later unsaved edit still counts as submitted). */
export function reviewCompleteCount(states: readonly ReviewProgressState[]): number {
  return states.filter((state) => state === 'submitted' || state === 'changed').length;
}

export function reviewProgressSummary(states: readonly ReviewProgressState[]): string {
  const submitted = states.filter((state) => state === 'submitted' || state === 'changed').length;
  const drafts = states.filter((state) => state === 'draft' || state === 'draft-local' || state === 'draft-page').length;
  const changed = states.filter((state) => state === 'changed').length;
  const parts = [`${submitted} of ${states.length} submitted`];
  if (drafts > 0) parts.push(`${drafts} ${drafts === 1 ? 'draft' : 'drafts'}`);
  if (changed > 0) parts.push(`${changed} changed since submission`);
  return parts.join(', ');
}

function Segment({ state, current }: { readonly state: ReviewProgressState; readonly current: boolean }) {
  return (
    <span aria-hidden="true" className="flex flex-col items-center gap-1">
      <span
        data-state={state}
        className={cn(
          'relative block h-3.5 w-4 overflow-hidden rounded-[3px] border',
          state === 'not-started' && 'border-[var(--db-text-muted)] bg-transparent',
          state === 'draft' && 'border-[var(--db-accent)] bg-transparent',
          // Kept only in this browser: a DASHED outline, so it differs by shape, not only by fill.
          state === 'draft-local' && 'border-dashed border-[var(--db-accent)] bg-transparent',
          // On this page only (not stored anywhere): a DOTTED outline in the warning hue.
          state === 'draft-page' && 'border-dotted border-[var(--db-sediment)] bg-transparent',
          state === 'submitted' && 'border-[var(--db-accent)] bg-[var(--db-accent)]',
          state === 'changed' && 'border-[var(--db-sediment)] bg-[var(--db-sediment)]',
        )}
      >
        {state === 'draft' || state === 'draft-local' || state === 'draft-page' ? <span className={cn('absolute inset-x-0 bottom-0 h-1/2', state === 'draft' ? 'bg-[var(--db-accent)]' : state === 'draft-page' ? 'bg-[var(--db-sediment)]' : 'bg-[var(--db-accent-tint-border)]')} /> : null}
        {state === 'changed' ? <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--db-surface)]" /> : null}
      </span>
      <span className={cn('block h-0.5 w-4 rounded-full', current ? 'bg-[var(--db-text-primary)]' : 'bg-transparent')} />
    </span>
  );
}

export interface ReviewProgressTrackerProps {
  readonly topics: readonly ReviewNavTopic[];
  readonly stateFor: (questionNumber: number) => ReviewProgressState;
  readonly currentQuestionNumber: number | undefined;
}

/**
 * Review progress as a disclosure, collapsed by default: the collapsed view is
 * one count ("4 of 12 complete") and one plain bar -- no legend, no patterns,
 * no competing colours. The expanded view keeps the per-question detail, where
 * each state is carried by shape and text as well as colour.
 */
export function ReviewProgressTracker({ topics, stateFor, currentQuestionNumber }: ReviewProgressTrackerProps) {
  const [open, setOpen] = useState(false);
  const states = topics.flatMap((topic) => topic.questions.map((question) => stateFor(question.number)));
  const complete = reviewCompleteCount(states);
  const total = states.length;
  const countText = `${complete} of ${total} complete`;
  return (
    <div data-testid="review-progress-tracker" data-open={open ? 'true' : 'false'} className="min-w-0 rounded-md border border-[var(--db-border)] bg-[var(--db-surface)]">
      <h3>
        <button
          type="button"
          data-testid="review-progress-toggle"
          aria-expanded={open}
          aria-controls="review-progress-detail"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"
        >
          <span className="text-sm font-semibold text-[var(--db-text-primary)]">Review progress</span>
          <span data-testid="review-progress-count" className="ml-auto text-sm tabular-nums text-[var(--db-text-secondary)]">{countText}</span>
          <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-[var(--db-text-secondary)] motion-safe:transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      </h3>
      <div className="px-3 pb-3">
        <div role="progressbar" aria-label="Review progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={complete} aria-valuetext={countText} data-testid="review-progress-bar" className="h-1.5 overflow-hidden rounded-full bg-[var(--db-depth-2)]">
          <div className="h-full rounded-full bg-[var(--db-accent)] motion-safe:transition-[width] motion-reduce:transition-none" style={{ width: `${total > 0 ? Math.round((complete / total) * 100) : 0}%` }} />
        </div>
        <div id="review-progress-detail" data-testid="review-progress-detail" hidden={!open} className="mt-3">
      <p data-testid="review-progress" className="text-sm text-[var(--db-text-secondary)]">{reviewProgressSummary(states)}</p>
      <ol aria-label="Progress by question" className="mt-2 space-y-1">
        {topics.map((topic) => (
          <li key={topic.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_3.75rem] items-center gap-3">
            <span className="truncate text-xs text-[var(--db-text-secondary)]" aria-hidden="true">{topic.label}</span>
            <ol aria-label={topic.label} className="flex gap-1">
              {topic.questions.map((question) => {
                const state = stateFor(question.number);
                const current = question.number === currentQuestionNumber;
                return (
                  <li key={question.id} aria-current={current ? 'step' : undefined} data-testid={`review-progress-q${question.number}`} data-state={state}>
                    <Segment state={state} current={current} />
                    <span className="sr-only">Question {question.number}, {topic.label}: {REVIEW_PROGRESS_STATE_TEXT[state]}{current ? ' (current question)' : ''}</span>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      <ul aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] leading-4 text-[var(--db-text-muted)]">
        {(['not-started', 'draft-page', 'draft-local', 'draft', 'submitted', 'changed'] as const).map((state) => (
          <li key={state} className="flex items-center gap-1"><Segment state={state} current={false} />{REVIEW_PROGRESS_STATE_TEXT[state]}</li>
        ))}
      </ul>
        </div>
      </div>
    </div>
  );
}
