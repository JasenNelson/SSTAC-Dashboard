import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readReviewLocalDraft, writeReviewLocalDraft, writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { buildReviewNavigation } from '@/lib/matrix-options/paper/review-navigation';

import { REVIEW_COMMENTS_TEXT_LIMIT, REVIEW_SAVE_TIMEOUT_MS, ReviewCommentsPanel } from '../ReviewCommentsPanel';

const authListeners = vi.hoisted(() => [] as Array<(event: string, session: { user?: { id?: string } } | null) => void>);
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (callback: (event: string, session: { user?: { id?: string } } | null) => void) => {
        authListeners.push(callback);
        return { data: { subscription: { unsubscribe: () => { const index = authListeners.indexOf(callback); if (index >= 0) authListeners.splice(index, 1); } } } };
      },
    },
  }),
}));

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const guide = getReviewerGuideContract();
const questions = guide.questions.slice(0, 4);

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const REVIEWER = 'user-a';
const MANIFEST = 'a'.repeat(64);
/** A verified reviewer's saved responses load (rows empty); every save stays pending unless a test says otherwise. */
function stubBootstrap(payload: Record<string, unknown> = { persistence: 'available', userKey: REVIEWER, rows: [] }, status = 200) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => url.includes('?documentVersion=')
    ? Promise.resolve(new Response(JSON.stringify(payload), { status }))
    : new Promise<Response>(() => undefined));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
/** Seeds the VERIFIED reviewer's own browser copy of a draft. */
function seedDraft(questionId: string, text: string) {
  writeReviewLocalDraftEntry({ documentVersion: version, questionId, userKey: REVIEWER }, text, null);
}
async function editorReady() {
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).not.toHaveAttribute('readonly'));
}

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

  it('M2: the textarea has a fixed h-56 default (no auto-grow) with resize-y, and is bound to the verified reviewer\'s browser copy', async () => {
    stubBootstrap();
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    const textarea = screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
    expect(textarea.className).toMatch(/\bh-56\b/);
    expect(textarea.className).toMatch(/\bresize-y\b/);
    expect(textarea.className).not.toMatch(/min-h-64/);
    fireEvent.change(textarea, { target: { value: 'my draft text' } });
    expect(textarea).toHaveValue('my draft text');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('my draft text');
    // Never the shared anonymous slot.
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id })).toBe('');
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

  it('M2: restores the verified reviewer\'s own browser draft for the active question once their responses load', async () => {
    seedDraft(questions[0].id, 'already drafted');
    stubBootstrap();
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('already drafted'));
  });

  it('M2: switching the active question loads that question\'s own draft, not the previous one', async () => {
    seedDraft(questions[0].id, 'q1 draft');
    seedDraft(questions[1].id, 'q2 draft');
    stubBootstrap();
    const { rerender } = render(
      <ReviewCommentsPanel documentVersion={version} manifestSha256={MANIFEST} cohortId="categories" questions={questions} question={questions[0]} responseRef={createRef()} onSelectQuestion={vi.fn()} onPreviousQuestion={vi.fn()} onNextQuestion={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('q1 draft'));
    rerender(
      <ReviewCommentsPanel documentVersion={version} manifestSha256={MANIFEST} cohortId="categories" questions={questions} question={questions[1]} responseRef={createRef()} onSelectQuestion={vi.fn()} onPreviousQuestion={vi.fn()} onNextQuestion={vi.fn()} />,
    );
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('q2 draft');
  });

  it('returns the caret to where the reviewer was typing after switching questions away and back', async () => {
    seedDraft(questions[1].id, 'second question draft text');
    stubBootstrap();
    const props = { documentVersion: version, manifestSha256: MANIFEST, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    const { rerender } = render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    await editorReady();
    const textarea = () => screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
    fireEvent.change(textarea(), { target: { value: 'first question text here', selectionStart: 5, selectionEnd: 5 } });
    textarea().setSelectionRange(5, 5);
    fireEvent.select(textarea());
    rerender(<ReviewCommentsPanel {...props} question={questions[1]} />);
    expect(textarea()).toHaveValue('second question draft text');
    textarea().setSelectionRange(26, 26);
    rerender(<ReviewCommentsPanel {...props} question={questions[0]} />);
    expect(textarea()).toHaveValue('first question text here');
    // Two-sided: without the restore the controlled value update leaves the caret at the end (24).
    expect(textarea().selectionStart).toBe(5);
    expect(textarea().selectionEnd).toBe(5);
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

  it('M2: "Jump to topic" is a full-width select, positioned after the progress tracker and before Prev/Next', () => {
    renderPanel();
    const tracker = screen.getByTestId('review-progress-tracker');
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    const navButtons = screen.getByTestId('question-navigation-buttons');
    expect(tracker.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select.compareDocumentPosition(navButtons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select).toHaveClass('w-full');
  });

  it('M2: selecting from "Jump to topic" calls onSelectQuestion with the chosen question number', () => {
    const { onSelectQuestion } = renderPanel();
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    fireEvent.change(select, { target: { value: String(questions[2].number) } });
    expect(onSelectQuestion).toHaveBeenCalledWith(questions[2].number);
  });

  it('M2: the progress summary reports counts across all questions ("N of TOTAL submitted, M drafts")', async () => {
    seedDraft(questions[0].id, 'drafted');
    seedDraft(questions[2].id, 'also drafted');
    stubBootstrap();
    renderPanel({ question: questions[1], manifestSha256: MANIFEST, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByTestId('review-progress')).toHaveTextContent(`0 of ${questions.length} submitted, 2 drafts`));
  });

  it('M2: the question index has one row per question, in the given (cohort) order, with its state', async () => {
    seedDraft(questions[0].id, 'drafted');
    // Server persistence unavailable (503) but the reviewer is verified.
    stubBootstrap({ persistence: 'unavailable', userKey: REVIEWER, rows: [] }, 503);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByTestId(`review-question-toggle-q${questions[0].number}`)).toHaveTextContent('Draft in this browser only'));
    const list = screen.getByTestId('review-question-index');
    const items = within(list).getAllByTestId(/^review-question-toggle-q/);
    expect(items).toHaveLength(questions.length);
    // Server persistence is unavailable, so the browser-only draft reports
    // 'Draft in this browser only', not the server-persisted 'Draft saved'.
    expect(items[0]).toHaveTextContent('Draft in this browser only');
    expect(items[1]).toHaveTextContent('Not started');
  });

  it('M2: a question row opens that question via onSelectQuestion; the open row is expanded and carries aria-current', () => {
    const { onSelectQuestion } = renderPanel({ question: questions[0] });
    const list = screen.getByTestId('review-question-index');
    const activeRow = within(list).getByRole('button', { name: new RegExp(`Question ${questions[0].number}:`) });
    expect(activeRow).toHaveAttribute('aria-current', 'true');
    expect(activeRow).toHaveAttribute('aria-expanded', 'true');
    const targetRow = within(list).getByRole('button', { name: new RegExp(`Question ${questions[3].number}:`) });
    expect(targetRow).not.toHaveAttribute('aria-current');
    expect(targetRow).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(targetRow);
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

  it('M3: saves are serialized per question -- a newer save waits for the in-flight one and is sent with its returned revision (no self-conflict)', async () => {
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
    // Two-sided: the old abort-and-resend sent a second request at once with the
    // same stale revision, which the server rejects as stale_revision.
    expect(requests).toHaveLength(1);
    expect(requests[0].init?.signal?.aborted).toBe(false);
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'first', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const queued = JSON.parse(String(requests[1].init?.body)) as { text: string; expectedRevision: number | null };
    expect(queued.text).toBe('second');
    expect(queued.expectedRevision).toBe(1);
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'second', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Draft saved/));
    expect(textarea).toHaveValue('second');
  });

  it('M3: an identical save while one is in flight is coalesced (blur + click + question switch send the text once)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'same text' } });
    fireEvent.blur(textarea);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(requests).toHaveLength(1);
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'same text', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Draft saved/));
    expect(requests).toHaveLength(1);
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
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Draft saved/));
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
    // Nothing is unsaved after Use saved: the browser copy is cleared, so a later
    // visit can never re-save the discarded text over a newer server save.
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('');
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
    fireEvent.click(within(screen.getByTestId('review-question-index')).getByRole('button', { name: new RegExp(`Question ${questions[1].number}:`) }));
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[1]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument());
    fireEvent.click(within(screen.getByTestId('review-question-index')).getByRole('button', { name: new RegExp(`Question ${questions[0].number}:`) }));
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(screen.getByText('Saved response: q1 saved')).toBeInTheDocument();
  });

  // (a) Two-sided: if the outgoing-question autosave were reverted, `requests`
  // would still be empty after the switch (the waitFor below would time out);
  // if unsaved-local-wins on return were reverted, the textarea would show the
  // bootstrap's stale "A" instead of the typed "AB".
  it('(a) an outgoing dirty question autosaves via PUT on switch, and returning to it shows the typed text, not the stale server row', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'A', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));

    const responseRef = createRef<HTMLElement>();
    const onSelectQuestion = vi.fn();
    const onPreviousQuestion = vi.fn();
    const onNextQuestion = vi.fn();
    const { rerender } = render(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);

    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('A'));

    // Typing "AB" makes Q1 dirty; the 1500ms autosave debounce has not fired.
    fireEvent.change(textarea, { target: { value: 'AB' } });
    expect(requests).toHaveLength(0);

    // Switching to Q2 must itself save the dirty outgoing question (item 6).
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[1]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].init?.method).toBe('PUT');
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.action).toBe('save-draft');
    expect(body.text).toBe('AB');

    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'AB', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));

    // Switching back to Q1 must show "AB" (what was typed and just saved),
    // never the bootstrap's original "A".
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('AB'));
  });

  // Two-sided: if the success path cleared dirty/buffer unconditionally, T2
  // would be wiped by T1's own resolution and the second Save draft below
  // would be a no-op (dirtyQuestionIdsRef no longer has the question), so
  // `requests` would stay at length 1 and its body would never be asserted.
  it('a save that resolves after newer text was typed does not clear the dirty flag or wipe the local buffer', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });

    // T1 is sent (Save draft)...
    fireEvent.change(textarea, { target: { value: 'T1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(requests).toHaveLength(1);

    // ...the reviewer keeps typing before it resolves...
    fireEvent.change(textarea, { target: { value: 'T2' } });
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('T2');

    // ...then T1 resolves ok.
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'T1', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    // The newer text is still unsaved, so the status must not claim the draft is saved.
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Unsaved changes/));

    // The local buffer still holds T2 -- T1's own resolution must not wipe it.
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('T2');
    expect(textarea).toHaveValue('T2');

    // The dirty flag must also survive: a later Save draft still fires, and
    // sends T2 with the revision T1's own response returned.
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const body = JSON.parse(String(requests[1].init?.body));
    expect(body.text).toBe('T2');
    expect(body.expectedRevision).toBe(1);
  });

  // Two-sided: mutation (2) neuters reconcileBufferedDrafts's conflict check
  // (`if (row && base !== rowRevision) nextConflicts.set(...)`), which makes
  // this test's review-conflict assertion fail (no conflict is ever opened).
  it('unsaved local text that differs from the bootstrap row opens a conflict (Keep mine sends it at the row revision)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'A', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    // A LEGACY buffer (plain text, no base revision, via writeReviewLocalDraft)
    // for Q1 ("AB") differs from the server row bootstrap will report ("A");
    // it is seeded before mount, under the user key the bootstrap will hand
    // back, exactly as a signed-in reviewer's browser already holds it.
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'AB');

    const responseRef = createRef<HTMLElement>();
    const onSelectQuestion = vi.fn();
    const onPreviousQuestion = vi.fn();
    const onNextQuestion = vi.fn();
    // Mount on Q2 (not the seeded question), so the bootstrap settles first
    // without the question-change effect ever touching Q1.
    const { rerender } = render(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[1]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());

    // Switching to Q1: the local "AB" differs from the bootstrapped server
    // row "A" -- a legacy buffer of unknown base next to a saved row is a
    // CONFLICT to resolve, never a silent win.
    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('AB');
    expect(screen.getByTestId('review-action-reason')).toHaveTextContent('Choose Keep mine or Use saved to resolve the conflict first.');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].init?.method).toBe('PUT');
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.text).toBe('AB');
    expect(body.expectedRevision).toBe(1);
  });

  // Two-sided: if `setSaveState('saving')` were unconditional (not gated on
  // activeQuestionIdRef.current === questionId) and the Save draft disabled
  // expression still included `|| saveState === 'saving'`, Q1's queued
  // re-send (fired while Q2 is showing) would flip the *global* saveState to
  // 'saving' and disable Save draft / Submit on Q2, and review-save-status
  // would read "Saving..." for a question that has no request in flight.
  it('a queued save for the previous question never leaves Save draft / Submit disabled (or "Saving...") on the question now showing', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[1].id, userKey: 'user-a' }, 'q2 text');

    const responseRef = createRef<HTMLElement>();
    const onSelectQuestion = vi.fn();
    const onPreviousQuestion = vi.fn();
    const onNextQuestion = vi.fn();
    const { rerender } = render(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[0]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());

    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(requests).toHaveLength(1); // request 1, for "abc", now in flight

    fireEvent.change(textarea, { target: { value: 'abcd' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(requests).toHaveLength(1); // "abcd" is queued behind request 1, not sent yet

    rerender(<ReviewCommentsPanel documentVersion={version} manifestSha256={manifestSha256} cohortId="categories" questions={questions} question={questions[1]} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('q2 text'));

    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'abc', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    // Request 1's own resolution fires the queued "abcd" re-send for Q1.
    await waitFor(() => expect(requests).toHaveLength(2));

    // Q1's queued re-send is now in flight, but Q2 is the question showing.
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit response' })).not.toBeDisabled();
    expect(screen.getByTestId('review-save-status')).not.toHaveTextContent('Saving...');

    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'abcd', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).not.toHaveTextContent('Saving...'));
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit response' })).not.toBeDisabled();
  });

  // Two-sided: mutation (2) neuters reconcileBufferedDrafts's conflict check,
  // which makes the review-conflict assertion below fail (no conflict opens,
  // the buffer silently wins instead).
  it('bootstrap: a local buffer that differs from the saved server row opens a conflict (Keep mine sends it at the server revision)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'server older', submitted_text: null, revision: 3, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    // A LEGACY buffer (plain text, no base revision) seeded under the same
    // userKey the bootstrap will hand back, exactly as a signed-in reviewer's
    // browser already holds it (migrateAnonymousReviewDraft only moves the
    // anonymous buffer -- it never overwrites an already-populated
    // authenticated one, so no anonymous seed is needed here).
    writeReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'local newer');

    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });

    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(textarea).toHaveValue('local newer');
    expect(screen.getByTestId('review-action-reason')).toHaveTextContent('Choose Keep mine or Use saved to resolve the conflict first.');

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].init?.method).toBe('PUT');
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.text).toBe('local newer');
    expect(body.expectedRevision).toBe(3);
  });

  // Two-sided: mutation (2) neuters reconcileBufferedDrafts's conflict check.
  // A VERSIONED entry whose base matches the row's revision must never be
  // affected by that check (it never conflicts either way), so this test is
  // paired with the mismatched-revision test below rather than mutated itself.
  it('a versioned local buffer entry whose base matches the row revision restores as an ordinary unsaved draft (Save draft sends its base revision)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'server text', submitted_text: null, revision: 3, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'local newer', 3);

    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('local newer'));
    expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('Unsaved changes');

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.text).toBe('local newer');
    expect(body.expectedRevision).toBe(3);
  });

  // Two-sided: if mutation (2) (reconcileBufferedDrafts never adding
  // conflicts) were applied, review-conflict would never appear here.
  it('the same versioned local buffer entry against a newer row revision opens a conflict instead', async () => {
    const manifestSha256 = 'a'.repeat(64);
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'server text', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>(() => undefined);
    }));
    // Same base (3) as the matching-revision test above, but the row has
    // since moved on to revision 4.
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'local newer', 3);

    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('local newer');
  });

  // Two-sided: mutation (3) makes handleChange write only to (blocked)
  // storage instead of updating the in-memory draft, so the controlled
  // textarea snaps back on the very next render and the first assertion
  // below fails immediately.
  it('blocked localStorage cannot blank an unsaved draft across a question switch and back', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'A', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    // This repo's test setup (src/test/setup.ts) replaces window.localStorage
    // with a plain object, not a real Storage instance, so the throwing stub
    // must be installed directly on that object (spying on Storage.prototype
    // would silently no-op here, per review-local-buffer.test.ts's own note).
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });

    const props = { documentVersion: version, manifestSha256, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    const { rerender } = render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    const textarea = () => screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea()).toHaveValue('A'));

    fireEvent.change(textarea(), { target: { value: 'AB' } });
    expect(textarea()).toHaveValue('AB');

    rerender(<ReviewCommentsPanel {...props} question={questions[1]} />);
    rerender(<ReviewCommentsPanel {...props} question={questions[0]} />);
    expect(textarea()).toHaveValue('AB');
    expect(textarea()).not.toHaveValue('');
    expect(textarea()).not.toHaveValue('A');

    // The outgoing-question autosave (switching away from Q1) sent "AB", not "".
    const emptyTextSent = requests.some((request) => JSON.parse(String(request.init?.body)).text === '');
    expect(emptyTextSent).toBe(false);

    getItem.mockRestore();
    setItem.mockRestore();
  });

  // Two-sided: mutation (4) (adding `question` to the bootstrap effect's deps)
  // makes the bootstrap GET re-fire on every question-prop change, so the
  // final assertion below (still 1 call) fails.
  it('the bootstrap GET fires once on mount and is not re-issued by a question switch and back', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    const props = { documentVersion: version, manifestSha256, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    const { rerender } = render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const bootstrapCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('?documentVersion=')).length;
    expect(bootstrapCalls()).toBe(1);

    rerender(<ReviewCommentsPanel {...props} question={questions[1]} />);
    rerender(<ReviewCommentsPanel {...props} question={questions[0]} />);
    expect(bootstrapCalls()).toBe(1);
  });

  // Two-sided: mutation (5) (forcing applyBootstrap's row loop to always
  // accept the newest-arriving row, i.e. calling the equivalent of
  // mergeRow(row, true) instead of respecting revision order) makes the
  // stale revision-4 row win, and the assertions below fail.
  it('rows merge by revision: a stale entry delivered after a newer one in the same bootstrap payload never rolls it back', async () => {
    const manifestSha256 = 'a'.repeat(64);
    // Shape a slow/duplicate bootstrap read can produce for one question: a
    // row that already reflects a successful save (revision 5), followed by
    // an older snapshot (revision 4) for the same question. The exact
    // reconciliation loop under test (applyBootstrap) must keep the newer
    // one and never let the later, lower-revision entry roll it back -- per
    // this file's own STATE MODEL comment ("a row is never replaced by a
    // lower revision, so a slow bootstrap GET cannot roll back a save").
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [
            { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved at revision 5', submitted_text: null, revision: 5, submitted_revision: null, submitted_at: null, updated_at: null },
            { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'stale revision 4', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null },
          ],
        }), { status: 200 }));
      }
      return new Promise<Response>(() => undefined);
    }));
    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('saved at revision 5'));
    expect(textarea).not.toHaveValue('stale revision 4');
    expect(screen.getByTestId('review-save-status').textContent).not.toContain('stale revision 4');
  });

  // Two-sided: mutation (6) (removing the `drafts.has(item.id) ||
  // conflicts.has(item.id)` check from stateFor) makes Q1's progress segment
  // fall through to the row-derived 'draft' state instead of 'draft-local',
  // so the final assertion fails.
  it('after a failed save the status stays honest on return (never claims Draft saved) and the progress segment reads draft-local', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved text', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    const props = { documentVersion: version, manifestSha256, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    const { rerender } = render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    const textarea = () => screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea()).toHaveValue('saved text'));

    fireEvent.change(textarea(), { target: { value: 'new text' } });
    // Switching to Q2 autosaves the dirty outgoing Q1 draft; the PUT fails.
    rerender(<ReviewCommentsPanel {...props} question={questions[1]} />);
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'persistence_unavailable' }), { status: 503 }));

    rerender(<ReviewCommentsPanel {...props} question={questions[0]} />);
    await waitFor(() => expect(textarea()).toHaveValue('new text'));
    const statusText = screen.getByTestId('review-save-status').textContent ?? '';
    expect(statusText).not.toMatch(/^Draft saved/);
    expect(statusText === 'Not saved to the review record. Your text is kept in this browser only.' || statusText === 'Unsaved changes').toBe(true);
    expect(screen.getByTestId(`review-progress-q${questions[0].number}`)).toHaveAttribute('data-state', 'draft-local');
  });

  // Two-sided: mutation (restoring the pre-!row base expression in
  // reconcileBufferedDrafts, so `base` stays the buffer's own baseRevision
  // even when no server row exists) makes the retry below send
  // expectedRevision 3 instead of null.
  it('a versioned buffer entry with no server row restores as an ordinary unsaved draft (Save draft sends expectedRevision null)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    // A VERSIONED buffer entry (base revision 3) for a question the bootstrap
    // reports NO row for at all: the revision it names is gone, so it must
    // restore as a plain new draft, never a conflict.
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'orphan text', 3);

    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('orphan text'));
    expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument();
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('Unsaved changes');

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const body = JSON.parse(String(requests[0].init?.body));
    expect(body.text).toBe('orphan text');
    expect(body.expectedRevision).toBeNull();
  });

  // Two-sided: mutation (making the rowless-409 branch set outcome 'error'
  // immediately, without re-basing and retrying) makes `requests` stay at
  // length 1 after the first 409, so the waitFor below times out.
  it('a save-draft 409 stale_revision with no row re-bases to null and retries once; a second rowless 409 shows "Could not save." with no third PUT', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved text', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('saved text'));

    fireEvent.change(textarea, { target: { value: 'typed text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const firstBody = JSON.parse(String(requests[0].init?.body));
    expect(firstBody.expectedRevision).toBe(2);

    // The row the draft was based on (revision 2) no longer exists.
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: null }), { status: 409 }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const secondBody = JSON.parse(String(requests[1].init?.body));
    expect(secondBody.text).toBe('typed text');
    expect(secondBody.expectedRevision).toBeNull();

    // The retry, based on "no row", also comes back rowless: an error, never a loop.
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: null }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Could not save\./));
    expect(requests).toHaveLength(2);
  });

  // Two-sided: mutation (removing the own-text 409 branch) makes this fall
  // through to the generic conflict branch, so review-conflict appears and
  // the status reads "Conflict: choose which version to keep" instead of
  // "Draft saved...".
  it('a save-draft 409 stale_revision whose row already holds the sent text is treated as saved, not a conflict', async () => {
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
    await waitFor(() => expect(requests).toHaveLength(1));
    // Our own earlier save committed (elsewhere / response lost); the row
    // already carries exactly the text we just sent.
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'mine', submitted_text: null, revision: 6, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Draft saved/));
    expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument();
  });

  // Two-sided: mutation (forcing browserCopyOk to stay true regardless of the
  // write result) makes both assertions below fail: the status would still
  // read "kept in this browser only" even though the write threw.
  it('when localStorage.setItem throws, a failed save reports the text is kept on this page only, not in this browser', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    // This repo's test setup replaces window.localStorage with a plain
    // object, not a real Storage instance, so the throwing stub is installed
    // directly on that object (matches the existing "blocked localStorage" test).
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });

    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'typed text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'persistence_unavailable' }), { status: 503 }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Not saved to the review record\./));
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('kept on this page only');
    expect(screen.getByTestId('review-save-status')).not.toHaveTextContent('kept in this browser');

    setItem.mockRestore();
  });

  // Two-sided: mutation (removing the persistenceRef check from
  // saveDraftNow) lets a blur reach persist(), which does not itself gate on
  // persistence state -- with a known userKey it would send a PUT, and
  // `requests` would be 1 instead of 0.
  it('with persistence unavailable (but a known userKey), typing then blurring the textarea sends no PUT', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'unavailable', userKey: 'user-a', rows: [] }), { status: 200 }));
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    fireEvent.change(textarea, { target: { value: 'typed while unavailable' } });
    fireEvent.blur(textarea);
    expect(requests).toHaveLength(0);
  });

  // Two-sided: mutation (7) (making persist read the submit text from the
  // live draft instead of the text captured at click time) makes the
  // submitted body carry "third" instead of "second".
  it('while a draft save is in flight, Submit sends exactly the on-screen text at click time; later typing goes out as its own save-draft', async () => {
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
    expect(requests).toHaveLength(1); // save-draft "first" in flight

    fireEvent.change(textarea, { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    expect(requests).toHaveLength(1); // submit is queued behind the in-flight save, not yet sent

    // Keep typing after Submit was pressed.
    fireEvent.change(textarea, { target: { value: 'third' } });

    requests[0].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'first', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 200 }));

    // The queued submit fires now, carrying "second" -- the text on screen
    // when Submit was clicked -- never "third".
    await waitFor(() => expect(requests).toHaveLength(2));
    const submitBody = JSON.parse(String(requests[1].init?.body));
    expect(submitBody.action).toBe('submit');
    expect(submitBody.text).toBe('second');

    requests[1].resolve(new Response(JSON.stringify({ outcome: 'ok', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'first', submitted_text: 'second', revision: 2, submitted_revision: 2, submitted_at: null, updated_at: null } }), { status: 200 }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Submit response|Re-submit response/ })).not.toBeDisabled());

    // The later typing ("third") is still unsaved and goes out as its own
    // save-draft, never folded into the submit that already went out.
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    const draftBody = JSON.parse(String(requests[2].init?.body));
    expect(draftBody.action).toBe('save-draft');
    expect(draftBody.text).toBe('third');
  });

  it('M2: no control here is a checkbox, radio or <select>-driven reveal request -- only the existing Jump-to-topic select and plain buttons exist', () => {
    renderPanel();
    const section = screen.getByTestId('active-question-response');
    expect(within(section).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(section).queryAllByRole('radio')).toHaveLength(0);
    expect(within(section).getAllByRole('combobox')).toHaveLength(1);
  });
});

describe('ReviewCommentsPanel: persistence-unavailable reason and retry', () => {
  it('M3: Save draft and Submit are disabled with a visible, aria-describedby reason, and Try again re-issues the bootstrap GET', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')));
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256, cohortId: 'categories' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
    const submit = screen.getByRole('button', { name: 'Submit response' });
    expect(submit).toBeDisabled();

    const reason = screen.getByTestId('review-action-reason');
    expect(reason).toBeVisible();
    const saveButton = screen.getByRole('button', { name: 'Save draft' });
    expect(saveButton).toHaveAttribute('aria-describedby', 'review-action-reason');
    expect(submit).toHaveAttribute('aria-describedby', 'review-action-reason');
    // No reviewer was verified (network down), so nothing is stored in the browser: the copy must not claim it is.
    expect(document.getElementById('review-action-reason')).toBe(within(reason).getByText('Saving to the review record is not available yet. What you type is on this page only and is lost if you reload or leave.'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('M3: Submit is disabled with "Write a response before submitting." while text is blank, and enables once typed', async () => {
    const manifestSha256 = 'a'.repeat(64);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }))));
    renderPanel({ manifestSha256, cohortId: 'categories' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    const submit = screen.getByRole('button', { name: 'Submit response' });
    expect(submit).toBeDisabled();
    expect(screen.getByTestId('review-action-reason')).toHaveTextContent('Write a response before submitting.');

    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'hello' } });
    expect(submit).not.toBeDisabled();
    expect(screen.queryByTestId('review-action-reason')).not.toBeInTheDocument();
  });
});

describe('ReviewCommentsPanel: editor expand toggle', () => {
  it('M2: Expand editor toggles aria-pressed on the button and data-expanded on the textarea', () => {
    renderPanel();
    const toggle = screen.getByTestId('review-editor-expand');
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(textarea).not.toHaveAttribute('data-expanded');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(textarea).toHaveAttribute('data-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(textarea).not.toHaveAttribute('data-expanded');
  });
});

describe('ReviewCommentsPanel: layout order', () => {
  it('M2: DOM order is progress, Jump to topic, the question index, then inside the open row its heading, textarea, Save draft, Previous question', () => {
    renderPanel();
    const tracker = screen.getByTestId('review-progress-tracker');
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    const index = screen.getByTestId('review-question-index');
    const heading = screen.getByRole('heading', { name: /^Question 1:/ });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    const saveButton = screen.getByRole('button', { name: 'Save draft' });
    const previousButton = screen.getByRole('button', { name: 'Previous question' });
    expect(within(screen.getByTestId(`review-question-row-q${questions[0].number}`)).getByRole('textbox', { name: 'Your response' })).toBe(textarea);
    const sequence = [tracker, select, index, heading, textarea, saveButton, previousButton];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      expect(sequence[index].compareDocumentPosition(sequence[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('ReviewCommentsPanel: changed-since-submission detail', () => {
  it('M3: a submitted row with revision > submitted_revision shows the submitted text under review-submitted-version', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const row = {
      document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id,
      draft_text: 'new draft text', submitted_text: 'old submitted text', revision: 3, submitted_revision: 1, submitted_at: null, updated_at: null,
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [row] }), { status: 200 }))));
    renderPanel({ manifestSha256, cohortId: 'categories' });

    const details = await screen.findByTestId('review-submitted-version');
    expect(details).toHaveTextContent('old submitted text');
  });
});

describe('ReviewCommentsPanel: r6 conflict/timeout regressions', () => {
  // Two-sided: mutation (removing the `if (!current) setDraft(...)` line from
  // the 409-with-row branch, and having keepMine send the live `draftText`
  // instead of `conflict.localText`) makes the textarea show the merged row
  // "B" instead of "A" the moment the conflict opens (setDraft is what keeps
  // the reviewer's text on screen when no draft already existed), so the
  // first assertion below fails.
  it('1: Submit without a draft keeps the reviewer\'s text through a stale_revision conflict; Keep mine saves it at the conflicting revision', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'A', submitted_text: null, revision: 3, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('A'));

    // No typing: Submit sends exactly the bootstrapped text, at the row's own revision.
    fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const submitBody = JSON.parse(String(requests[0].init?.body));
    expect(submitBody.action).toBe('submit');
    expect(submitBody.text).toBe('A');
    expect(submitBody.expectedRevision).toBe(3);

    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'B', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(textarea).toHaveValue('A');

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const keepBody = JSON.parse(String(requests[1].init?.body));
    expect(keepBody.action).toBe('save-draft');
    expect(keepBody.text).toBe('A');
    expect(keepBody.expectedRevision).toBe(4);
  });

  // Two-sided: mutation (removing `updateConflict(questionId, null);` from
  // the own-text 409 branch) leaves the earlier conflict open, so
  // review-conflict never disappears and the final waitFor times out.
  it('2: an own-text 409 (our save committed but the response was lost) closes an already-open conflict', async () => {
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
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved elsewhere', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    // The Keep mine retry actually committed server-side and its response was
    // lost: the server answers with the SAME text we sent, as a 409.
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'mine', submitted_text: null, revision: 5, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));

    await waitFor(() => expect(screen.queryByTestId('review-conflict')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();
    expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Draft saved/);
  });

  // Two-sided: mutation (removing `setDraft(conflict.questionId, null,
  // userKeyRef.current);` from useSaved) leaves the old dirty draft ("mine")
  // in place, so the textarea keeps showing "mine" instead of the saved row
  // "B" and the first assertion below fails.
  //
  // NOT independently distinguishable: whether useSaved calls mergeRow(saved)
  // or mergeRow(saved, true) (the `force` argument) cannot be told apart
  // through any reachable UI path here. `force` only matters when the row
  // already held is a HIGHER revision than the conflict's row -- but nothing
  // in this component can advance a question's row past a conflict's row
  // while that conflict is still open (persist() itself refuses to queue or
  // send while `conflictsRef.current.has(questionId)` and no
  // `duringConflict` option is set), so `previous.revision > row.revision`
  // is never true at the point Use saved runs. This test instead pins the
  // OBSERVABLE Use saved contract (shows the saved row, clears the draft,
  // and a later edit is based on that row's own revision).
  it('3: Use saved shows the saved conflict row and clears the draft; a later edit saves at the merged row\'s own revision', async () => {
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
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'B', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Use saved' }));
    expect(textarea).toHaveValue('B');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' })).toBe('');

    fireEvent.change(textarea, { target: { value: 'B and more' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const body = JSON.parse(String(requests[1].init?.body));
    expect(body.expectedRevision).toBe(4);
  });

  // Two-sided: mutation (dropping the duringConflict allowance in settle, so
  // it always skips the queued action while a conflict is open) makes the
  // automatic retry never fire, so the final waitFor(requests.length === 3)
  // times out.
  it('4: a rowless 409 to a Keep mine retry (during an open conflict) is not dropped -- the queued re-send still fires', async () => {
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
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'saved elsewhere', submitted_text: null, revision: 4, submitted_revision: null, submitted_at: null, updated_at: null } }), { status: 409 }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const keepBody = JSON.parse(String(requests[1].init?.body));
    expect(keepBody.expectedRevision).toBe(4);

    // The row the conflict retry was based on is gone entirely (rowless 409).
    requests[1].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: null }), { status: 409 }));
    await waitFor(() => expect(requests).toHaveLength(3));
    const retryBody = JSON.parse(String(requests[2].init?.body));
    expect(retryBody.action).toBe('save-draft');
    expect(retryBody.expectedRevision).toBeNull();
    expect(retryBody.text).toBe('mine');
  });

  // Two-sided: mutation (restricting the rowless-409 re-base/retry to
  // `action === 'save-draft'`) makes the submit's rowless 409 fall through to
  // the plain error branch instead of retrying, so the final
  // waitFor(requests.length === 2) times out.
  it('5: a rowless 409 on Submit re-bases to null and retries the SAME submit (not converted to save-draft)', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const requests: Array<{ init?: RequestInit; resolve: (response: Response) => void }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(new Response(JSON.stringify({
          persistence: 'available',
          userKey: 'user-a',
          rows: [{ document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'orig', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null }],
        }), { status: 200 }));
      }
      return new Promise<Response>((resolve) => { requests.push({ init, resolve }); });
    }));
    renderPanel({ manifestSha256, cohortId: 'categories', question: questions[0] });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    await waitFor(() => expect(textarea).toHaveValue('orig'));

    fireEvent.change(textarea, { target: { value: 'typed sub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    const firstBody = JSON.parse(String(requests[0].init?.body));
    expect(firstBody.action).toBe('submit');
    expect(firstBody.expectedRevision).toBe(2);

    requests[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: null }), { status: 409 }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const retryBody = JSON.parse(String(requests[1].init?.body));
    expect(retryBody.action).toBe('submit');
    expect(retryBody.text).toBe('typed sub');
    expect(retryBody.expectedRevision).toBeNull();
  });

  // Two-sided: mutation (dropping the `!timedOut &&` guard so the catch
  // treats every abort as silent) makes the timeout branch return before
  // calling setOutcome, so the "Not saved to the review record." assertion
  // below fails (the status stays "Unsaved changes" instead).
  it('6: a hung save times out after REVIEW_SAVE_TIMEOUT_MS ("Not saved to the review record."); a non-timeout abort (sign-out) stays silent', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const manifestSha256 = 'a'.repeat(64);
    const signals: AbortSignal[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      const signal = init?.signal;
      // A PUT that never resolves on its own -- it only settles when its own
      // AbortSignal fires, whether from the REVIEW_SAVE_TIMEOUT_MS timer or
      // from an unrelated abort (sign-out), exactly like a real hung fetch.
      return new Promise<Response>((_resolve, reject) => {
        if (signal) { signals.push(signal); signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); }
      });
    }));

    const props = { documentVersion: version, manifestSha256, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    // The bootstrap GET resolves on the microtask queue; fake timers only
    // mock setTimeout/setInterval, not Promise microtasks, but the resulting
    // state update is still a React update outside an event handler, so it
    // must be flushed inside act().
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'typed text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(signals).toHaveLength(1);
    expect(signals[0].aborted).toBe(false);

    await act(async () => { await vi.advanceTimersByTimeAsync(REVIEW_SAVE_TIMEOUT_MS); });
    expect(signals[0].aborted).toBe(true);
    expect(screen.getByTestId('review-save-status')).toHaveTextContent(/^Not saved to the review record\./);
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();

    // A second save, aborted by sign-out (not a timeout): must stay silent,
    // never reporting the timeout's "Not saved to the review record." status.
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'typed again' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);

    fireEvent(window, new Event('matrix-options-auth-signed-out'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(signals[1].aborted).toBe(true);
    expect(screen.getByTestId('review-save-status')).not.toHaveTextContent(/^Not saved to the review record\./);

    vi.useRealTimers();
  });
});

describe('ReviewCommentsPanel: r7 loading and progress', () => {
  it('the editor is read-only (and busy) until saved responses have loaded, then editable', async () => {
    const manifestSha256 = 'a'.repeat(64);
    let resolveBootstrap: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return new Promise<Response>((resolve) => { resolveBootstrap = resolve; });
      return new Promise<Response>(() => undefined);
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    // Typing now could overwrite the reviewer's earlier browser-only text, which
    // is not known until the load returns.
    expect(textarea).toHaveAttribute('readonly');
    expect(textarea).toHaveAttribute('aria-busy', 'true');
    await act(async () => { resolveBootstrap(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 })); });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).not.toHaveAttribute('readonly'));
  });

  it('a submitted question with newer unsaved edits reads "changed since submission" and stays counted as submitted', async () => {
    const manifestSha256 = 'a'.repeat(64);
    const submittedRow = { document_version: version, manifest_sha256: manifestSha256, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'final', submitted_text: 'final', revision: 2, submitted_revision: 2, submitted_at: null, updated_at: null };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [submittedRow] }), { status: 200 }));
      return new Promise<Response>(() => undefined);
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('final'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'final, revised' } });
    // Two-sided: the previous rule showed "draft-local" and dropped it from the submitted count.
    expect(screen.getByTestId(`review-progress-q${questions[0].number}`)).toHaveAttribute('data-state', 'changed');
    expect(screen.getByTestId('review-progress')).toHaveTextContent(/^1 of \d+ submitted/);
  });
});

describe('ReviewCommentsPanel: database write throttle', () => {
  it('a 429 rate_limited save keeps the text and says why, distinct from a generic failure', async () => {
    const manifestSha256 = 'a'.repeat(64);
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ outcome: 'rate_limited' }), { status: 429 }));
    }));
    renderPanel({ manifestSha256, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).not.toHaveAttribute('readonly'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'kept text' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText(/Too many saves in the last minute/)).toBeInTheDocument());
    expect(screen.queryByText(/^Could not save/)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('kept text');
  });
});

describe('ReviewCommentsPanel: text is never attributed to the wrong reviewer (shared browser)', () => {
  it('an anonymous-slot entry (e.g. typed after another reviewer\'s session expired) is never shown to, or saved as, the reviewer who signs in', async () => {
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id }, 'someone else typed this', null);
    const fetchMock = stubBootstrap({ persistence: 'available', userKey: 'user-b', rows: [] });
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('');
    // Two-sided: the previous rule adopted it into user-b's namespace and autosaved it.
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-b' })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id })).toBe('someone else typed this');
    // Past the 1.5 s autosave debounce: still nothing sent.
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
  });

  it('without a verified reviewer, typed text stays on the page only (nothing written to the shared browser slot) and says so', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('network down'))));
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'typed before anyone was verified' } });
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('typed before anyone was verified');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id })).toBe('');
    expect(Object.keys(window.localStorage).some((key) => key.includes(':local:'))).toBe(false);
    expect(screen.getByText(/kept on this page only/)).toBeInTheDocument();
    expect(screen.queryByText(/kept in this browser/)).toBeNull();
    // The tracker says the same (never "Draft in this browser only").
    expect(screen.getByTestId(`review-progress-q${questions[0].number}`)).toHaveAttribute('data-state', 'draft-page');
    // Leaving would lose it: the browser is asked to confirm.
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
  });

  it('after a signed-out load (401), the reviewer can sign in and select Try again: typed text is then saved as that reviewer', async () => {
    let signedIn = false;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        return Promise.resolve(signedIn
          ? new Response(JSON.stringify({ persistence: 'available', userKey: REVIEWER, rows: [] }), { status: 200 })
          : new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await waitFor(() => expect(screen.getByText(/Sign in again in another tab, then select Try again here/)).toBeInTheDocument());
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'written while signed out' } });
    // Page-only text: leaving is guarded BEFORE the retry...
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    signedIn = true;
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).not.toBeDisabled());
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('written while signed out');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('written while signed out');
    // With a verified reviewer and a browser copy, leaving no longer needs confirming.
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(false);
  });

  it('Try again that returns a DIFFERENT reviewer never re-pins the page or claims its text', async () => {
    let second = false;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        const userKey = second ? 'user-b' : REVIEWER;
        return Promise.resolve(new Response(JSON.stringify({ persistence: 'unavailable', userKey, rows: [] }), { status: 503 }));
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'reviewer a text' } });
    second = true;
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument());
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-b' })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('reviewer a text');
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('reviewer a text');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('a failed Try again (500) never un-pins the page, so a later bootstrap as another reviewer is still refused', async () => {
    let step = 0;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        step += 1;
        if (step === 1) return Promise.resolve(new Response(JSON.stringify({ persistence: 'unavailable', userKey: REVIEWER, rows: [] }), { status: 503 }));
        if (step === 2) return Promise.resolve(new Response('Internal error', { status: 500 }));
        return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-b', rows: [] }), { status: 200 }));
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'reviewer a text' } });
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
    // Still pinned to reviewer A: the copy keeps the browser wording for A.
    expect(screen.getByText(/What you type is kept in this browser only/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument());
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-b' })).toBe('');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    // The page reviewer's text is kept, and the editor no longer accepts typing for anyone.
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('reviewer a text');
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveAttribute('readonly');
  });

  it('a bootstrap answer that names no reviewer (503 without userKey) never un-pins the page either', async () => {
    let step = 0;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('?documentVersion=')) {
        step += 1;
        if (step === 1) return Promise.resolve(new Response(JSON.stringify({ persistence: 'unavailable', userKey: REVIEWER, rows: [] }), { status: 503 }));
        if (step === 2) return Promise.resolve(new Response(JSON.stringify({ persistence: 'unavailable', rows: [] }), { status: 503 }));
        return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-b', rows: [] }), { status: 200 }));
      }
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'reviewer a text' } });
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument());
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: 'user-b' })).toBe('');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('when a verified reviewer\'s browser copy fails, no line claims the text is in this browser, and leaving is guarded', async () => {
    stubBootstrap({ persistence: 'unavailable', userKey: REVIEWER, rows: [] }, 503);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'not stored anywhere' } });
    // Two-sided: before, the reason line still said "kept in this browser only".
    expect(screen.queryByText(/kept in this browser/)).toBeNull();
    expect(screen.getByText(/kept on this page only/)).toBeInTheDocument();
    expect(screen.getByText(/What you type is on this page only and is lost if you reload or leave/)).toBeInTheDocument();
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
  });

  it('a browser sign-in event for a different reviewer stops saving for this page', async () => {
    const fetchMock = stubBootstrap();
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    expect(authListeners.length).toBeGreaterThan(0);
    // Two-sided: the same reviewer refreshing their token changes nothing.
    act(() => { authListeners.forEach((listener) => listener('TOKEN_REFRESHED', { user: { id: REVIEWER } })); });
    expect(screen.queryByText(/A different reviewer is now signed in/)).toBeNull();
    act(() => { authListeners.forEach((listener) => listener('SIGNED_IN', { user: { id: 'user-b' } })); });
    expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument();
    // Nothing typed now is accepted for the page's reviewer.
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveAttribute('readonly');
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'typed by whoever is at the keyboard now' } });
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('');
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toBe(false);
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
  });

  it('after a reviewer change, the copy never calls a reload safe while ANY unsaved text failed to reach the browser (not just the active question)', async () => {
    let refuse = false;
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => url.includes('?documentVersion=')
      ? Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: REVIEWER, rows: [] }), { status: 200 }))
      : refuse ? Promise.resolve(new Response(JSON.stringify({ outcome: 'identity_changed' }), { status: 409 })) : new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', fetchMock);
    const props = { documentVersion: version, manifestSha256: MANIFEST, cohortId: 'categories', questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn() };
    const { rerender } = render(<ReviewCommentsPanel {...props} question={questions[0]} />);
    await editorReady();
    // Q1: the browser refuses the write (e.g. full). Q2: stored normally.
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'q1 only on this page' } });
    setItem.mockRestore();
    rerender(<ReviewCommentsPanel {...props} question={questions[1]} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'q2 stored' } });
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[1].id, userKey: REVIEWER })).toBe('q2 stored');
    // Per question: leaving is still guarded although the ACTIVE question is stored.
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    refuse = true;
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument());
    expect(screen.getByText(/This browser is not storing your unsaved text -- copy it before you reload/)).toBeInTheDocument();
    expect(screen.queryByText(/Unsaved text stays in this browser/)).toBeNull();
  });

  it('a save refused because a different reviewer is now signed in stops saving and keeps the text with its reviewer', async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => url.includes('?documentVersion=')
      ? Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: REVIEWER, rows: [] }), { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify({ outcome: 'identity_changed' }), { status: 409 })));
    vi.stubGlobal('fetch', fetchMock);
    renderPanel({ manifestSha256: MANIFEST, cohortId: 'categories' });
    await editorReady();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your response' }), { target: { value: 'reviewer a text' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(screen.getByText(/A different reviewer is now signed in on this browser/)).toBeInTheDocument());
    // The PUT carried the page reviewer's identity pin.
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(JSON.parse(String((put?.[1] as RequestInit).body)).expectedUserId).toBe(REVIEWER);
    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('reviewer a text');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('reviewer a text');
  });
});

describe('ReviewCommentsPanel: question index (owner-approved correction)', () => {
  const props = () => ({ documentVersion: version, questions, responseRef: createRef<HTMLElement>(), onSelectQuestion: vi.fn(), onPreviousQuestion: vi.fn(), onNextQuestion: vi.fn(), onCloseQuestion: vi.fn() });

  it('keeps every question row visible with all prompts and editors collapsed when no question is open', () => {
    render(<ReviewCommentsPanel {...props()} question={undefined} />);
    const toggles = within(screen.getByTestId('review-question-index')).getAllByTestId(/^review-question-toggle-q/);
    expect(toggles).toHaveLength(questions.length);
    for (const toggle of toggles) expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('textbox', { name: 'Your response' })).toBeNull();
    expect(document.getElementById('active-question-heading')).toBeNull();
    // Each row names its number, a concise title from its own prompt, and its state.
    expect(screen.getByTestId(`review-question-toggle-q${questions[0].number}`)).toHaveTextContent(`Q${questions[0].number}`);
    expect(screen.getByTestId(`review-question-toggle-q${questions[0].number}`)).toHaveTextContent('Not started');
    // Two-sided: rows are distinguishable although the guide heading repeats per topic.
    const titles = toggles.map((toggle) => toggle.querySelector('.line-clamp-2')?.textContent);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('opens exactly one question inline: its prompt and editor sit inside its own row', () => {
    const { rerender } = render(<ReviewCommentsPanel {...props()} question={questions[2]} />);
    const open = screen.getByTestId(`review-question-row-q${questions[2].number}`);
    expect(open).toHaveAttribute('data-open', 'true');
    expect(within(open).getByRole('textbox', { name: 'Your response' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Your response' })).toHaveLength(1);
    rerender(<ReviewCommentsPanel {...props()} question={questions[1]} />);
    expect(screen.getByTestId(`review-question-row-q${questions[2].number}`)).toHaveAttribute('data-open', 'false');
    expect(within(screen.getByTestId(`review-question-row-q${questions[1].number}`)).getByRole('textbox', { name: 'Your response' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox', { name: 'Your response' })).toHaveLength(1);
  });

  it('highlights the paper-related question without opening it', () => {
    render(<ReviewCommentsPanel {...props()} question={undefined} highlightQuestionNumber={questions[3].number} />);
    const row = screen.getByTestId(`review-question-row-q${questions[3].number}`);
    expect(row).toHaveAttribute('data-highlighted', 'true');
    expect(row).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId(`review-question-toggle-q${questions[3].number}`)).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('textbox', { name: 'Your response' })).toBeNull();
  });

  it('clicking the open row collapses it; clicking another row asks to open that one', () => {
    const handlers = props();
    render(<ReviewCommentsPanel {...handlers} question={questions[0]} />);
    fireEvent.click(screen.getByTestId(`review-question-toggle-q${questions[0].number}`));
    expect(handlers.onCloseQuestion).toHaveBeenCalledTimes(1);
    expect(handlers.onSelectQuestion).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId(`review-question-toggle-q${questions[1].number}`));
    expect(handlers.onSelectQuestion).toHaveBeenCalledWith(questions[1].number);
  });

  it('returns the caret after the question is collapsed and reopened', () => {
    const shared = props();
    const { rerender } = render(<ReviewCommentsPanel {...shared} question={questions[0]} />);
    const textarea = () => screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
    fireEvent.change(textarea(), { target: { value: 'first question text here', selectionStart: 5, selectionEnd: 5 } });
    textarea().setSelectionRange(5, 5);
    fireEvent.select(textarea());
    rerender(<ReviewCommentsPanel {...shared} question={undefined} />);
    expect(screen.queryByRole('textbox', { name: 'Your response' })).toBeNull();
    rerender(<ReviewCommentsPanel {...shared} question={questions[0]} />);
    expect(textarea()).toHaveValue('first question text here');
    // Two-sided: the remounted textarea would otherwise put the caret at the end (24).
    expect(textarea().selectionStart).toBe(5);
  });

  it('Next reveals the newly opened row and keeps keyboard focus on its Next control', () => {
    const shared = props();
    const revealElement = vi.fn();
    const { rerender } = render(<ReviewCommentsPanel {...shared} revealElement={revealElement} question={questions[0]} />);
    fireEvent.click(screen.getByRole('button', { name: /Next question/ }));
    expect(shared.onNextQuestion).toHaveBeenCalledTimes(1);
    rerender(<ReviewCommentsPanel {...shared} revealElement={revealElement} question={questions[1]} />);
    const row = screen.getByTestId(`review-question-row-q${questions[1].number}`);
    // An explicit selection: the workspace reveals it at every width.
    expect(revealElement).toHaveBeenLastCalledWith(row, 'selection');
    expect(within(row).getByRole('button', { name: /Next question/ })).toHaveFocus();
  });

  it('every question row clears the sticky header when revealed below lg (and keeps the rail landing at lg)', () => {
    render(<ReviewCommentsPanel {...props()} question={questions[0]} />);
    for (const question of questions) {
      const row = screen.getByTestId(`review-question-row-q${question.number}`);
      // Two-sided: rows had no scroll margin, so below lg a revealed row landed
      // at the top of the viewport with its focused toggle under the header.
      expect(row.className).toContain('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
      expect(row.className).toContain('lg:scroll-mt-0');
    }
  });

  it('the question open at mount (a q deep link) is revealed as a url reveal, not as a selection', () => {
    const revealElement = vi.fn();
    render(<ReviewCommentsPanel {...props()} revealElement={revealElement} question={questions[1]} />);
    expect(revealElement).toHaveBeenCalledTimes(1);
    expect(revealElement).toHaveBeenLastCalledWith(screen.getByTestId(`review-question-row-q${questions[1].number}`), 'url');
  });

  it('a row the reader clicks is not revealed again (it is already in view)', () => {
    const shared = props();
    const revealElement = vi.fn();
    const { rerender } = render(<ReviewCommentsPanel {...shared} revealElement={revealElement} question={undefined} />);
    fireEvent.click(screen.getByTestId(`review-question-toggle-q${questions[1].number}`));
    rerender(<ReviewCommentsPanel {...shared} revealElement={revealElement} question={questions[1]} />);
    expect(revealElement).not.toHaveBeenCalled();
  });

  it('labels topics with their numbered presentation names', () => {
    const topics = buildReviewNavigation(getCohortManifest(), guide).topics;
    render(<ReviewCommentsPanel {...props()} topics={topics} question={undefined} />);
    const index = screen.getByTestId('review-question-index');
    expect(within(index).getByRole('heading', { name: '1. Sediment Uses' })).toBeInTheDocument();
    expect(within(index).getByRole('heading', { name: '2. Receptors and Pathways' })).toBeInTheDocument();
    // Two-sided: the manifest name is not shown.
    expect(within(index).queryByRole('heading', { name: 'Categories' })).toBeNull();
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    expect(Array.from(select.querySelectorAll('optgroup')).map((group) => group.getAttribute('label'))).toEqual(topics.map((topic) => topic.label));
  });

  it('Previous at the first question keeps focus inside the newly opened row, never on <body>', () => {
    const shared = props();
    const { rerender } = render(<ReviewCommentsPanel {...shared} revealElement={vi.fn()} question={questions[1]} />);
    fireEvent.click(screen.getByRole('button', { name: /Previous question/ }));
    rerender(<ReviewCommentsPanel {...shared} revealElement={vi.fn()} question={questions[0]} />);
    const row = screen.getByTestId(`review-question-row-q${questions[0].number}`);
    // Its own Previous is disabled at the start: focus falls back to Next.
    expect(within(row).getByRole('button', { name: /Previous question/ })).toBeDisabled();
    expect(within(row).getByRole('button', { name: /Next question/ })).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('with nothing open, Jump to topic offers a neutral first choice, so the highlighted question can still be opened from it', () => {
    const handlers = props();
    render(<ReviewCommentsPanel {...handlers} question={undefined} highlightQuestionNumber={questions[0].number} />);
    const select = screen.getByRole('combobox', { name: 'Jump to topic' }) as HTMLSelectElement;
    expect(select.value).toBe('');
    fireEvent.change(select, { target: { value: String(questions[0].number) } });
    expect(handlers.onSelectQuestion).toHaveBeenCalledWith(questions[0].number);
  });
});
