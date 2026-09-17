import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readReviewLocalDraft, writeReviewLocalDraft } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

import { REVIEW_COMMENTS_TEXT_LIMIT, ReviewCommentsPanel } from '../ReviewCommentsPanel';

const version = '1.0.11-remediated-20260913';
const guide = getReviewerGuideContract();
const questions = guide.questions.slice(0, 4);

afterEach(() => {
  window.localStorage.clear();
});

function renderPanel(overrides: Partial<Parameters<typeof ReviewCommentsPanel>[0]> = {}) {
  const responseRef = createRef<HTMLElement>();
  const onSelectQuestion = vi.fn();
  const onPreviousQuestion = vi.fn();
  const onNextQuestion = vi.fn();
  render(
    <ReviewCommentsPanel
      documentVersion={version}
      questions={questions}
      question={questions[0]}
      responseRef={responseRef}
      onSelectQuestion={onSelectQuestion}
      onPreviousQuestion={onPreviousQuestion}
      onNextQuestion={onNextQuestion}
      {...overrides}
    />,
  );
  return { onSelectQuestion, onPreviousQuestion, onNextQuestion };
}

describe('ReviewCommentsPanel', () => {
  it('M2: renders the active question prompt as clean text (no raw markdown markers, no stray $)', () => {
    // Question 4's prompt is the one known to contain a balanced $...$ math span.
    const mathQuestion = guide.questions.find((question) => question.number === 4);
    expect(mathQuestion).toBeTruthy();
    renderPanel({ questions: [mathQuestion!], question: mathQuestion });
    const response = screen.getByTestId('active-question-response');
    const math = response.querySelector('.katex-html');
    expect(math).not.toBeNull();
    expect(math?.textContent).not.toContain('$');
    expect(response.textContent).not.toMatch(/\*\*/);
  });

  it('M2: the textarea has a 16rem minimum, grows, and is bound to the local buffer', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
    expect(textarea.className).toMatch(/min-h-64/);
    fireEvent.change(textarea, { target: { value: 'my draft text' } });
    expect(textarea).toHaveValue('my draft text');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id })).toBe('my draft text');
  });

  it('M2: the character count is visible and reflects the current length', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'abcde' } });
    expect(screen.getByTestId('review-comment-char-count')).toHaveTextContent(`5 / ${REVIEW_COMMENTS_TEXT_LIMIT}`);
  });

  it('M2: FIX CYCLE 1 / F5 -- the character count is not a live region while well under the limit', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'abcde' } });
    expect(screen.getByTestId('review-comment-char-count')).not.toHaveAttribute('aria-live');
  });

  it('M2: FIX CYCLE 1 / F5 -- the character count becomes aria-live="polite" once <=1000 characters remain', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'x'.repeat(REVIEW_COMMENTS_TEXT_LIMIT - 1000) } });
    expect(screen.getByTestId('review-comment-char-count')).toHaveAttribute('aria-live', 'polite');
  });

  it('M2: the 20000-character limit is enforced -- typed text beyond it is truncated', () => {
    renderPanel();
    const textarea = screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
    const tooLong = 'x'.repeat(REVIEW_COMMENTS_TEXT_LIMIT + 500);
    fireEvent.change(textarea, { target: { value: tooLong } });
    expect(textarea.value).toHaveLength(REVIEW_COMMENTS_TEXT_LIMIT);
    expect(screen.getByTestId('review-comment-char-count')).toHaveTextContent(`${REVIEW_COMMENTS_TEXT_LIMIT} / ${REVIEW_COMMENTS_TEXT_LIMIT}`);
  });

  it('M2: loads an existing local draft for the active question on mount', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id }, 'already drafted');
    renderPanel();
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('already drafted');
  });

  it('M2: switching the active question loads that question\'s own draft, not the previous one', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id }, 'q1 draft');
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[1].id }, 'q2 draft');
    const { rerender } = render(
      <ReviewCommentsPanel documentVersion={version} questions={questions} question={questions[0]} responseRef={createRef()} onSelectQuestion={vi.fn()} onPreviousQuestion={vi.fn()} onNextQuestion={vi.fn()} />,
    );
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('q1 draft');
    rerender(
      <ReviewCommentsPanel documentVersion={version} questions={questions} question={questions[1]} responseRef={createRef()} onSelectQuestion={vi.fn()} onPreviousQuestion={vi.fn()} onNextQuestion={vi.fn()} />,
    );
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('q2 draft');
  });

  it('M2: Previous and Next are adjacent and equal width (grid grid-cols-2)', () => {
    renderPanel();
    const group = screen.getByTestId('question-navigation-buttons');
    expect(group).toHaveClass('grid', 'grid-cols-2');
    const [previous, next] = within(group).getAllByRole('button');
    expect(previous).toHaveTextContent('Previous question');
    expect(next).toHaveTextContent('Next question');
  });

  it('M2: Previous is disabled at the first question and Next at the last, across the whole question set', () => {
    renderPanel({ question: questions[0] });
    expect(screen.getByRole('button', { name: 'Previous question' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next question' })).not.toBeDisabled();
    renderPanel({ question: questions[questions.length - 1] });
    const nextButtons = screen.getAllByRole('button', { name: 'Next question' });
    expect(nextButtons.at(-1)).toBeDisabled();
  });

  it('M2: "Jump to topic" is a full-width select rendered below a divider, after Prev/Next', () => {
    renderPanel();
    const hr = document.querySelector('hr');
    expect(hr).not.toBeNull();
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    expect(select.compareDocumentPosition(hr as Element) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(select).toHaveClass('w-full');
  });

  it('M2: selecting from "Jump to topic" calls onSelectQuestion with the chosen question number', () => {
    const { onSelectQuestion } = renderPanel();
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    fireEvent.change(select, { target: { value: String(questions[2].number) } });
    expect(onSelectQuestion).toHaveBeenCalledWith(questions[2].number);
  });

  it('M2: the progress line reports "Question N of TOTAL - X drafted - Y submitted - Z changed since submit"', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id }, 'drafted');
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[2].id }, 'also drafted');
    renderPanel({ question: questions[1] });
    expect(screen.getByTestId('review-progress')).toHaveTextContent(`Question 2 of ${questions.length} - 2 drafted - 0 submitted - 0 changed since submit`);
  });

  it('M2: the saved-questions list has one chip per question, in the given (cohort) order, with a status chip', () => {
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id }, 'drafted');
    renderPanel();
    const list = screen.getByTestId('review-saved-questions');
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(questions.length);
    expect(items[0]).toHaveTextContent('Drafted');
    expect(items[1]).toHaveTextContent('Not started');
  });

  it('M2: a saved-questions chip resumes that question directly via onSelectQuestion, and the active one carries aria-current', () => {
    const { onSelectQuestion } = renderPanel({ question: questions[0] });
    const list = screen.getByTestId('review-saved-questions');
    const activeChip = within(list).getByRole('button', { name: new RegExp(`Question ${questions[0].number}:`) });
    expect(activeChip).toHaveAttribute('aria-current', 'true');
    const targetChip = within(list).getByRole('button', { name: new RegExp(`Question ${questions[3].number}:`) });
    expect(targetChip).not.toHaveAttribute('aria-current');
    fireEvent.click(targetChip);
    expect(onSelectQuestion).toHaveBeenCalledWith(questions[3].number);
  });

  it('M2: never renders a Save/Submit-labelled affordance (local-buffer-only honesty bar)', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: /Save|Submit/i })).toBeNull();
  });

  it('M2: no control here is a checkbox, radio or <select>-driven reveal request -- only the existing Jump-to-topic select and plain buttons exist', () => {
    renderPanel();
    const section = screen.getByTestId('active-question-response');
    expect(within(section).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(section).queryAllByRole('radio')).toHaveLength(0);
    expect(within(section).getAllByRole('combobox')).toHaveLength(1);
  });
});
