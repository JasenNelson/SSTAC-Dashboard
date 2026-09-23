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

export function ReviewProgressTracker({ topics, stateFor, currentQuestionNumber }: ReviewProgressTrackerProps) {
  const states = topics.flatMap((topic) => topic.questions.map((question) => stateFor(question.number)));
  return (
    <div data-testid="review-progress-tracker" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--db-text-primary)]">Review progress</h3>
        <p data-testid="review-progress" className="text-sm text-[var(--db-text-secondary)]">{reviewProgressSummary(states)}</p>
      </div>
      <ol aria-label="Progress by question" className="mt-2 space-y-1">
        {topics.map((topic) => (
          <li key={topic.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_3.75rem] items-center gap-3">
            <span className="truncate text-xs text-[var(--db-text-secondary)]" aria-hidden="true">{topic.name}</span>
            <ol aria-label={topic.name} className="flex gap-1">
              {topic.questions.map((question) => {
                const state = stateFor(question.number);
                const current = question.number === currentQuestionNumber;
                return (
                  <li key={question.id} aria-current={current ? 'step' : undefined} data-testid={`review-progress-q${question.number}`} data-state={state}>
                    <Segment state={state} current={current} />
                    <span className="sr-only">Question {question.number}, {topic.name}: {REVIEW_PROGRESS_STATE_TEXT[state]}{current ? ' (current question)' : ''}</span>
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
  );
}
