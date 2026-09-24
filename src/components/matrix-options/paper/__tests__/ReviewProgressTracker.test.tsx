import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ReviewNavTopic } from '@/lib/matrix-options/paper/review-navigation';

import { REVIEW_PROGRESS_STATE_TEXT, ReviewProgressTracker, reviewProgressSummary } from '../ReviewProgressTracker';
import type { ReviewProgressState } from '../ReviewProgressTracker';

function topic(id: string, name: string, questionNumbers: readonly number[]): ReviewNavTopic {
  return {
    id,
    name,
    number: 1,
    label: name,
    questions: questionNumbers.map((number) => ({
      number,
      id: `q${number}`,
      heading: `Heading ${number}`,
      title: `Title ${number}`,
      topicId: id,
      citedSections: [],
    })),
  };
}

const topics: readonly ReviewNavTopic[] = [
  topic('topic-a', 'Topic A', [1, 2]),
  topic('topic-b', 'Topic B', [3, 4, 5]),
];

/** One question per possible state, so every state and its two-sided negation can be asserted. */
const STATE_BY_NUMBER: Readonly<Record<number, ReviewProgressState>> = {
  1: 'not-started',
  2: 'draft',
  3: 'draft-local',
  4: 'submitted',
  5: 'changed',
};
const stateFor = (number: number): ReviewProgressState => STATE_BY_NUMBER[number];

describe('ReviewProgressTracker', () => {
  it('is collapsed by default: one plain count and one bar, no per-question rows, legend or patterns on show', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    const toggle = screen.getByTestId('review-progress-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('review-progress-count')).toHaveTextContent('2 of 5 complete');
    const bar = screen.getByRole('progressbar', { name: 'Review progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar).toHaveAttribute('aria-valuetext', '2 of 5 complete');
    // Two-sided: the previous tracker showed the per-topic rows and the legend immediately.
    expect(screen.getByTestId('review-progress-detail')).toHaveAttribute('hidden');
    expect(screen.queryByRole('list', { name: 'Topic A' })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('review-progress-detail')).not.toHaveAttribute('hidden');
    expect(screen.getByRole('list', { name: 'Topic A' })).toBeInTheDocument();
  });

  it('groups questions by topic, one row/list per topic (expanded)', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    fireEvent.click(screen.getByTestId('review-progress-toggle'));
    const topicARow = screen.getByRole('list', { name: 'Topic A' });
    const topicBRow = screen.getByRole('list', { name: 'Topic B' });
    expect(within(topicARow).getAllByTestId(/^review-progress-q/)).toHaveLength(2);
    expect(within(topicBRow).getAllByTestId(/^review-progress-q/)).toHaveLength(3);
    expect(within(topicARow).getByTestId('review-progress-q1')).toBeInTheDocument();
    expect(within(topicBRow).getByTestId('review-progress-q4')).toBeInTheDocument();
  });

  it('gives every question segment a two-sided sr-only status naming its number, topic and state', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    expect(screen.getByTestId('review-progress-q1')).toHaveTextContent('Question 1, Topic A: Not started');
    expect(screen.getByTestId('review-progress-q4')).toHaveTextContent('Question 4, Topic B: Submitted');
    // Two-sided: a submitted question's segment must not ALSO report not-started, and vice versa.
    expect(screen.getByTestId('review-progress-q4')).not.toHaveTextContent('Not started');
    expect(screen.getByTestId('review-progress-q1')).not.toHaveTextContent('Submitted');
  });

  it('marks only the current question with aria-current="step" and names it in the sr-only text', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={4} />);
    const current = screen.getByTestId('review-progress-q4');
    expect(current).toHaveAttribute('aria-current', 'step');
    expect(current).toHaveTextContent('(current question)');
    for (const number of [1, 2, 3, 5]) {
      const segment = screen.getByTestId(`review-progress-q${number}`);
      expect(segment).not.toHaveAttribute('aria-current');
      expect(segment).not.toHaveTextContent('(current question)');
    }
  });

  it('renders data-state for each of the five states, and a submitted question never reports not-started', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    expect(screen.getByTestId('review-progress-q1')).toHaveAttribute('data-state', 'not-started');
    expect(screen.getByTestId('review-progress-q2')).toHaveAttribute('data-state', 'draft');
    expect(screen.getByTestId('review-progress-q3')).toHaveAttribute('data-state', 'draft-local');
    expect(screen.getByTestId('review-progress-q4')).toHaveAttribute('data-state', 'submitted');
    expect(screen.getByTestId('review-progress-q5')).toHaveAttribute('data-state', 'changed');
    // Falsifiable: the submitted segment's data-state must differ from the not-started one's.
    expect(screen.getByTestId('review-progress-q4').getAttribute('data-state')).not.toBe(
      screen.getByTestId('review-progress-q1').getAttribute('data-state'),
    );
  });

  it('summarizes with reviewProgressSummary: "N of TOTAL submitted[, M drafts][, K changed since submission]"', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    expect(screen.getByTestId('review-progress')).toHaveTextContent('2 of 5 submitted, 2 drafts, 1 changed since submission');
    expect(reviewProgressSummary(['not-started', 'draft', 'draft-local', 'submitted', 'changed'])).toBe(
      '2 of 5 submitted, 2 drafts, 1 changed since submission',
    );
    expect(reviewProgressSummary(['not-started', 'not-started'])).toBe('0 of 2 submitted');
    expect(reviewProgressSummary(['submitted'])).toBe('1 of 1 submitted');
    expect(reviewProgressSummary(['draft', 'draft'])).toBe('0 of 2 submitted, 2 drafts');
  });

  // Two-sided: draft-local and draft must differ by SHAPE (a dashed border),
  // not only by which colour utility class happens to be applied -- state is
  // never carried by colour alone (see the module's own header comment).
  it('gives draft-local a dashed border and draft a solid one -- shape, not only colour', () => {
    render(<ReviewProgressTracker topics={topics} stateFor={stateFor} currentQuestionNumber={undefined} />);
    const draftLocalSegment = screen.getByTestId('review-progress-q3').querySelector('[data-state="draft-local"]');
    const draftSegment = screen.getByTestId('review-progress-q2').querySelector('[data-state="draft"]');
    expect(draftLocalSegment).not.toBeNull();
    expect(draftSegment).not.toBeNull();
    expect(draftLocalSegment).toHaveClass('border-dashed');
    // Two-sided negation: an ordinary (server-saved) draft is solid-bordered,
    // never dashed, so the two states cannot collapse to the same shape.
    expect(draftSegment).not.toHaveClass('border-dashed');
  });

  it('REVIEW_PROGRESS_STATE_TEXT has distinct copy for all six states, and page-only text never claims browser storage', () => {
    const values = Object.values(REVIEW_PROGRESS_STATE_TEXT);
    expect(values).toHaveLength(6);
    expect(new Set(values).size).toBe(6);
    expect(REVIEW_PROGRESS_STATE_TEXT['draft-page']).toMatch(/lost on reload/);
    expect(REVIEW_PROGRESS_STATE_TEXT['draft-page']).not.toMatch(/browser/);
  });

  it('gives draft-page its own DOTTED shape (not colour alone), distinct from draft-local', () => {
    render(<ReviewProgressTracker topics={[{ id: 't', name: 'Topic', number: 1, label: 'Topic', questions: [{ number: 1, id: 'q1', heading: 'Q1', title: 'Q1', topicId: 't', citedSections: [] }, { number: 2, id: 'q2', heading: 'Q2', title: 'Q2', topicId: 't', citedSections: [] }] }]} stateFor={(n) => (n === 1 ? 'draft-page' : 'draft-local')} currentQuestionNumber={1} />);
    const page = screen.getByTestId('review-progress-q1').querySelector('[data-state="draft-page"]');
    const local = screen.getByTestId('review-progress-q2').querySelector('[data-state="draft-local"]');
    expect(page?.className).toMatch(/border-dotted/);
    expect(local?.className).toMatch(/border-dashed/);
  });
});
