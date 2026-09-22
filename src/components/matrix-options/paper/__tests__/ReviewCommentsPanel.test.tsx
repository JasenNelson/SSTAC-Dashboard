import { createRef } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readReviewLocalDraft, writeReviewLocalDraft } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

import { REVIEW_COMMENTS_TEXT_LIMIT, ReviewCommentsPanel } from '../ReviewCommentsPanel';

vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('client unavailable in unit test'); } }));

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const guide = getReviewerGuideContract();
const questions = guide.questions.slice(0, 4);

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it('M3: renders save and submit affordances but keeps them disabled when persistence is unavailable', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled();
  });

  it('M3: bootstrap does not overwrite text entered while the session request is loading', async () => {
    const manifestSha256 = 'a'.repeat(64);
    let resolveBootstrap!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveBootstrap = resolve; })));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'typed while loading' } });
    resolveBootstrap(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'server text', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null }] }), { status: 200 }));
    await waitFor(() => expect(textarea).toHaveValue('typed while loading'));
  });

  it('M3: sign-out aborts pending mutations and clears authenticated and anonymous release buffers', async () => {
    const manifestSha256 = 'a'.repeat(64);
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      signal = init?.signal;
      return new Promise<Response>(() => undefined);
    }));
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'private draft');
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[1].id }, 'anonymous draft');
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'pending mutation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent(window, new Event('matrix-options-auth-signed-out'));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue(''));
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[1].id })).toBe('');
  });

  it('M3: a stale mutation completion cannot overwrite the newer per-question mutation', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'first' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.change(textarea, { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(requests).toHaveLength(2);
    expect(requests[0].init?.signal?.aborted).toBe(true);
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'second', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'first', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent('Saved'));
    expect(textarea).toHaveValue('second');
  });

  it('M3: conflict actions update the local/server row and retry Keep mine at the latest revision', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved elsewhere', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(requests).toHaveLength(2);
    const retryBody = JSON.parse(String(requests[1].init?.body));
    expect(retryBody.expectedRevision).toBe(4);
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'mine', submitted_text: null, revision: 5, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent('Saved'));
    expect(textarea).toHaveValue('mine');
    expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument();
  });

  it('M3: Use saved clears the dirty buffer and requires a valid conflict row', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved', submitted_text: null, revision: 3, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Use saved' }));
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('saved');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('saved');
  });

  it('M3: conflict actions are serialized while Keep mine is in flight', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved elsewhere', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(requests).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use saved' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use saved' }));
    expect(requests).toHaveLength(2);
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'mine', submitted_text: null, revision: 5, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument());
  });

  it('M3: a failed Keep mine retry preserves the actionable conflict', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved elsewhere', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'persistence_unavailable' }), { status: 503 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(screen.getByText('Saved response: saved elsewhere')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep mine' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use saved' })).not.toBeDisabled();
  });

  it('M3: conflicts remain bound to their question across navigation and never render for another question', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ resolve }); });
    }));
    const responseRef = createRef<HTMLElement>();
    const onSelectQuestion = vi.fn();
    const onPreviousQuestion = vi.fn();
    const onNextQuestion = vi.fn();
    const { rerender } = render(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'q1 mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'q1 saved', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId('review-saved-questions')).getByRole('button', { name: new RegExp(`Question ${questions[1].number}:`) }));
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[1]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId('review-saved-questions')).getByRole('button', { name: new RegExp(`Question ${questions[0].number}:`) }));
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(screen.getByText('Saved response: q1 saved')).toBeInTheDocument();
  });

  it('M2: no control here is a checkbox, radio or <select>-driven reveal request -- only the existing Jump-to-topic select and plain buttons exist', () => {
    renderPanel();
    const section = screen.getByTestId('active-question-response');
    expect(within(section).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(section).queryAllByRole('radio')).toHaveLength(0);
    expect(within(section).getAllByRole('combobox')).toHaveLength(1);
  });
});
