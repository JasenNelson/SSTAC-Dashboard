import { createRef, Profiler } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { readReviewLocalDraft, writeReviewLocalDraft, writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewLineage, reviewLineageView } from '@/lib/matrix-options/paper/review-lineage';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

import { lineageResponseText, REVIEW_SAVE_TIMEOUT_MS, ReviewCommentsPanel } from '../ReviewCommentsPanel';
import { syntheticResolvedR5Guide } from './r5-synthetic-guide';

// The panel's auth listeners, kept so a test can deliver the Supabase SIGNED_OUT event itself.
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

/*
 * Unit 3: lineage in the review panel.
 *
 * A response written for the predecessor draft is shown under the R5 draft only
 * as read-only reference, and only for a question whose heading and prompt are
 * identical. It is never placed in the editor, never written to this draft's
 * browser copy and never sent in a save. Q11 was reworded: it shows no earlier
 * response and says a new one is needed.
 */

const REVIEWER = 'user-a';
const R5_MANIFEST = 'b'.repeat(64);
const PREDECESSOR_MANIFEST = 'c'.repeat(64);
// The R5 draft's own guide text is in no file of the repository (the server derives it from the
// verified paper), so the panel is handed a guide with the bound ids and synthetic text.
const r5Guide = syntheticResolvedR5Guide();
const lineage = reviewLineageView(getReviewLineage(R5_PAPER_VERSION)!, PREDECESSOR_MANIFEST);
const r5Question = (number: number) => r5Guide.questions[number - 1];
const predecessorQuestionId = (number: number) => `rpq:${REVISED_PAPER_VERSION}:q${String(number).padStart(2, '0')}`;
const EARLIER = 'My answer to the earlier draft.';

function predecessorRow(number: number, overrides: Record<string, unknown> = {}) {
  return { document_version: REVISED_PAPER_VERSION, manifest_sha256: PREDECESSOR_MANIFEST, cohort_id: 'categories', question_id: predecessorQuestionId(number), draft_text: null, submitted_text: EARLIER, revision: 2, submitted_revision: 2, submitted_at: '2026-09-20T10:00:00.000Z', updated_at: '2026-09-20T10:00:00.000Z', ...overrides };
}

interface Recorded { readonly url: string; readonly init?: RequestInit; resolve?: (response: Response) => void }

/**
 * R5 bootstrap, the predecessor (lineage) read and saves, each answered separately; every
 * request is recorded. `put: 'hold'` leaves each save in flight until the test answers it
 * through the recorded request's `resolve`; `predecessor: 'hold'` does the same for the
 * predecessor read.
 */
function stubFetch(options: { readonly predecessor?: { readonly status?: number; readonly body: Record<string, unknown> } | 'hang' | 'hold'; readonly r5Rows?: readonly unknown[]; readonly r5Status?: number; readonly put?: { readonly status: number; readonly body: Record<string, unknown> } | 'hold' } = {}) {
  const requests: Recorded[] = [];
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const record: Recorded = { url, init };
    requests.push(record);
    if (url.includes(`?documentVersion=${encodeURIComponent(REVISED_PAPER_VERSION)}`)) {
      if (options.predecessor === 'hang') {
        // Settles only when its own AbortSignal fires, like a real hung request.
        return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))); });
      }
      if (options.predecessor === 'hold') return new Promise<Response>((resolve) => { record.resolve = resolve; });
      const predecessor = options.predecessor ?? { body: { persistence: 'available', userKey: REVIEWER, rows: [] } };
      return Promise.resolve(new Response(JSON.stringify(predecessor.body), { status: predecessor.status ?? 200 }));
    }
    if (url.includes('?documentVersion=')) {
      const status = options.r5Status ?? 200;
      // The real route's 503 names the verified reviewer (it is answered after the session
      // check), exactly like its 200; only a refused session has no reviewer in the body.
      const body = status === 200 ? { persistence: 'available', userKey: REVIEWER, rows: options.r5Rows ?? [] }
        : status === 503 ? { outcome: 'persistence_unavailable', persistence: 'unavailable', rows: [], userKey: REVIEWER }
          : { error: 'Unauthorized' };
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }
    if (options.put === 'hold') return new Promise<Response>((resolve) => { record.resolve = resolve; });
    if (options.put) return Promise.resolve(new Response(JSON.stringify(options.put.body), { status: options.put.status }));
    return new Promise<Response>(() => undefined);
  });
  vi.stubGlobal('fetch', fetchMock);
  return requests;
}

function panelElement(number: number, overrides: Partial<Parameters<typeof ReviewCommentsPanel>[0]> = {}) {
  return (
    <ReviewCommentsPanel
      documentVersion={R5_PAPER_VERSION}
      manifestSha256={R5_MANIFEST}
      cohortId={number === 11 ? 'methods-water-type' : 'categories'}
      questions={r5Guide.questions}
      question={r5Question(number)}
      responseRef={createRef<HTMLElement>()}
      onSelectQuestion={vi.fn()}
      onPreviousQuestion={vi.fn()}
      onNextQuestion={vi.fn()}
      lineage={lineage}
      {...overrides}
    />
  );
}

function renderPanel(number: number, overrides: Partial<Parameters<typeof ReviewCommentsPanel>[0]> = {}) {
  return render(panelElement(number, overrides));
}

interface CommitView { readonly signedOut: boolean; readonly earlier: boolean; readonly own: boolean }

/**
 * What the page holds at every commit of the panel, read from inside the commit: a Profiler
 * reports once the DOM is updated and before any passive effect has run. A response that an
 * effect removes one render later is therefore still in this log, where reading the page
 * after the event would only ever see the tidied result.
 */
function renderPanelWithCommitLog(number: number, ownText: string) {
  const commits: CommitView[] = [];
  const record = () => {
    const text = document.body.textContent ?? '';
    const typed = (document.getElementById('review-comment-draft') as HTMLTextAreaElement | null)?.value ?? '';
    commits.push({ signedOut: text.includes('Sign in again in another tab'), earlier: text.includes(EARLIER), own: text.includes(ownText) || typed.includes(ownText) });
  };
  render(<Profiler id="review-panel" onRender={record}>{panelElement(number)}</Profiler>);
  return commits;
}

const editor = () => screen.getByRole('textbox', { name: 'Your response' }) as HTMLTextAreaElement;
async function editorReady() {
  await waitFor(() => expect(editor()).not.toHaveAttribute('readonly'));
}
/** Everything written to browser storage, as one string. */
const storedValues = (setItem: { readonly mock: { readonly calls: readonly (readonly unknown[])[] } }) => setItem.mock.calls.map((call) => String(call[1])).join('\n');
const reads = (requests: readonly Recorded[]) => requests.filter((request) => request.url.includes('?documentVersion='));
const writes = (requests: readonly Recorded[]) => requests.filter((request) => !request.url.includes('?documentVersion='));

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('review lineage in the response panel', () => {
  it('shows an earlier submitted response as read-only reference for a question with identical text', async () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const requests = stubFetch({ predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1)] } } });
    renderPanel(1);
    await editorReady();
    const reference = await screen.findByTestId('review-lineage-reference');
    expect(reference.tagName).toBe('DETAILS');
    expect(reference.querySelector('summary')?.textContent).toContain('Your submitted response in the earlier draft');
    expect(screen.getByTestId('review-lineage-text')).toHaveTextContent(EARLIER);
    expect(reference).toHaveTextContent('Shown for reference only. It stays with the earlier draft and is not copied here');
    expect(screen.queryByTestId('review-lineage-changed')).toBeNull();
    // Reference only: nothing editable carries it, and this draft has no copy of it.
    expect(reference.querySelector('textarea, input, button, [contenteditable]')).toBeNull();
    expect(editor()).toHaveValue('');
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER })).toBe('');
    expect(storedValues(setItem)).not.toContain(EARLIER);
    expect(writes(requests)).toEqual([]);
    // Exactly two reads: this draft under its own identity, the predecessor under its own.
    expect(reads(requests).map((request) => request.url).sort()).toEqual([
      `/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(REVISED_PAPER_VERSION)}&manifestSha256=${PREDECESSOR_MANIFEST}`,
      `/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(R5_PAPER_VERSION)}&manifestSha256=${R5_MANIFEST}`,
    ].sort());
    expect(reads(requests).every((request) => (request.init?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('labels an earlier unsubmitted draft as a saved draft', async () => {
    stubFetch({ predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(2, { draft_text: 'half-finished thought', submitted_text: null, submitted_revision: null, submitted_at: null })] } } });
    renderPanel(2);
    await editorReady();
    const reference = await screen.findByTestId('review-lineage-reference');
    expect(reference.querySelector('summary')?.textContent).toContain('Your saved draft in the earlier draft');
    expect(screen.getByTestId('review-lineage-text')).toHaveTextContent('half-finished thought');
    expect(editor()).toHaveValue('');
  });

  it('carries nothing for Q11, which was reworded: a note, no earlier response, an empty editor', async () => {
    // The reviewer DID answer the earlier Q11 (and every other question); none of it is shown here.
    const rows = Array.from({ length: 12 }, (_, index) => predecessorRow(index + 1, { cohort_id: index + 1 === 11 ? 'methods-water-type' : 'categories' }));
    const requests = stubFetch({ predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows } } });
    renderPanel(11);
    await editorReady();
    await waitFor(() => expect(reads(requests)).toHaveLength(2));
    expect(screen.getByTestId('review-lineage-changed')).toHaveTextContent('This question was reworded for this draft. A response to the earlier wording is not carried over, so it needs a new response.');
    // Let the lineage read settle, then prove no reference appeared.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
    expect(screen.queryByText(EARLIER)).toBeNull();
    expect(editor()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled();
    expect(writes(requests)).toEqual([]);
  });

  it('shows the reference for every identical question and for no other (Q1-Q10 and Q12, never Q11)', async () => {
    const rows = Array.from({ length: 12 }, (_, index) => predecessorRow(index + 1));
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    for (const number of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      stubFetch({ predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows } } });
      const view = renderPanel(number);
      await editorReady();
      if (number === 11) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
        expect(screen.getByTestId('review-lineage-changed')).toBeInTheDocument();
      } else {
        expect(await screen.findByTestId('review-lineage-reference')).toBeInTheDocument();
        expect(screen.queryByTestId('review-lineage-changed')).toBeNull();
      }
      expect(editor()).toHaveValue('');
      expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(number).id, userKey: REVIEWER })).toBe('');
      view.unmount();
      vi.unstubAllGlobals();
    }
    // The earlier text never reached this browser's storage, under any key.
    expect(storedValues(setItem)).not.toContain(EARLIER);
  });

  it('saves only what the reviewer types, under this draft only', async () => {
    const requests = stubFetch({ predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1)] } } });
    renderPanel(1);
    await editorReady();
    await screen.findByTestId('review-lineage-reference');
    fireEvent.change(editor(), { target: { value: 'A new answer for this draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    const [save] = writes(requests);
    expect(save.url).toBe(`/api/matrix-options/paper/reviews/${encodeURIComponent(r5Question(1).id)}`);
    expect(save.init?.method).toBe('PUT');
    expect(JSON.parse(String(save.init?.body))).toEqual({ documentVersion: R5_PAPER_VERSION, manifestSha256: R5_MANIFEST, cohortId: 'categories', action: 'save-draft', text: 'A new answer for this draft.', expectedRevision: null, expectedUserId: REVIEWER });
    expect(String(save.init?.body)).not.toContain(EARLIER);
    expect(String(save.init?.body)).not.toContain(REVISED_PAPER_VERSION);
    // The browser copy is this draft's, and holds only the typed text.
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER })).toBe('A new answer for this draft.');
    expect(readReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(1), userKey: REVIEWER })).toBe('');
    // The reference is still there, unchanged.
    expect(screen.getByTestId('review-lineage-text')).toHaveTextContent(EARLIER);
  });

  it('shows this draft\'s own saved response in the editor, beside (not replaced by) the earlier one', async () => {
    const own = { document_version: R5_PAPER_VERSION, manifest_sha256: R5_MANIFEST, cohort_id: 'categories', question_id: r5Question(1).id, draft_text: 'Saved under this draft.', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null };
    stubFetch({ r5Rows: [own], predecessor: { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1)] } } });
    renderPanel(1);
    await editorReady();
    await waitFor(() => expect(editor()).toHaveValue('Saved under this draft.'));
    expect(await screen.findByTestId('review-lineage-text')).toHaveTextContent(EARLIER);
  });

  it.each([
    ['another reviewer answers the predecessor read', { body: { persistence: 'available', userKey: 'user-b', rows: [predecessorRow(1)] } }],
    ['the predecessor read is unavailable', { status: 503, body: { outcome: 'persistence_unavailable', persistence: 'unavailable', rows: [], userKey: REVIEWER } }],
    ['the predecessor read is refused', { status: 401, body: { error: 'Unauthorized' } }],
    ['the rows belong to another release identity', { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1, { manifest_sha256: 'd'.repeat(64) }), predecessorRow(1, { document_version: R5_PAPER_VERSION })] } }],
    ['the earlier row is for another question', { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(2)] } }],
    ['the earlier row has no text', { body: { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1, { submitted_text: null, submitted_revision: null, submitted_at: null })] } }],
  ])('shows no reference when %s, and the editor still works', async (_name, predecessor) => {
    const requests = stubFetch({ predecessor });
    renderPanel(1);
    await editorReady();
    await waitFor(() => expect(reads(requests)).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
    expect(screen.queryByText(EARLIER)).toBeNull();
    expect(screen.queryByTestId('review-lineage-changed')).toBeNull();
    fireEvent.change(editor(), { target: { value: 'still editable' } });
    expect(editor()).toHaveValue('still editable');
  });

  it('never reads the predecessor for a signed-out reader', async () => {
    const requests = stubFetch({ r5Status: 401 });
    renderPanel(1);
    await waitFor(() => expect(reads(requests)).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads(requests)).toHaveLength(1);
    expect(reads(requests)[0].url).toContain(encodeURIComponent(R5_PAPER_VERSION));
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
  });

  it('does nothing at all for a draft with no predecessor (the default draft)', async () => {
    const guide = getReviewerGuideContract();
    const requests = stubFetch();
    render(
      <ReviewCommentsPanel
        documentVersion={REVISED_PAPER_VERSION}
        manifestSha256={PREDECESSOR_MANIFEST}
        cohortId="methods-water-type"
        questions={guide.questions}
        question={guide.questions[10]}
        responseRef={createRef<HTMLElement>()}
        onSelectQuestion={vi.fn()}
        onPreviousQuestion={vi.fn()}
        onNextQuestion={vi.fn()}
      />,
    );
    await editorReady();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reads(requests)).toHaveLength(1);
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
    expect(screen.queryByTestId('review-lineage-changed')).toBeNull();
  });
});

describe('sign-out with responses on screen', () => {
  // Sign-out must leave no review response on the page in ANY render, the first one
  // included: the person at the screen after a sign-out need not be the reviewer.
  const OWN = 'Saved under this draft.';
  const ownRow = { document_version: R5_PAPER_VERSION, manifest_sha256: R5_MANIFEST, cohort_id: 'categories', question_id: r5Question(1).id, draft_text: OWN, submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null };
  const earlierBody = { persistence: 'available', userKey: REVIEWER, rows: [predecessorRow(1)] };
  const isPredecessorRead = (request: Recorded) => request.url.includes(`?documentVersion=${encodeURIComponent(REVISED_PAPER_VERSION)}`);
  const shown: CommitView = { signedOut: false, earlier: true, own: true };
  const cleared: CommitView = { signedOut: true, earlier: false, own: false };

  const signOutByWindowEvent = () => { window.dispatchEvent(new Event('matrix-options-auth-signed-out')); };
  // The source a real sign-out arrives by (this tab or another one).
  const signOutBySupabase = () => { authListeners.forEach((listener) => listener('SIGNED_OUT', null)); };

  it.each([
    ['the window event', signOutByWindowEvent],
    ['the Supabase SIGNED_OUT callback', signOutBySupabase],
  ])('removes this draft\'s response and the earlier-draft reference in the render that signs the reviewer out, not one render later (%s)', async (_source, signOut) => {
    stubFetch({ r5Rows: [ownRow], predecessor: { body: earlierBody } });
    const commits = renderPanelWithCommitLog(1, OWN);
    await editorReady();
    await waitFor(() => expect(editor()).toHaveValue(OWN));
    await screen.findByTestId('review-lineage-reference');
    // Both responses are on the page while signed in and the log sees them, so their
    // absence below is a finding and not a probe that cannot see.
    expect(commits.at(-1)).toEqual(shown);
    expect(authListeners).toHaveLength(1);
    const before = commits.length;
    act(() => { signOut(); });
    const after = commits.slice(before);
    expect(after.length).toBeGreaterThan(0);
    // Every render from the sign-out on, the first one included.
    expect(after).toEqual(after.map(() => cleared));
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
    expect(editor()).toHaveValue('');
  });

  it('drops an earlier-draft read that answers after sign-out, so a late answer never reaches the signed-out page', async () => {
    const requests = stubFetch({ r5Rows: [ownRow], predecessor: 'hold' });
    const commits = renderPanelWithCommitLog(1, OWN);
    await editorReady();
    await waitFor(() => expect(editor()).toHaveValue(OWN));
    await waitFor(() => expect(reads(requests)).toHaveLength(2));
    const lineageRead = reads(requests).find(isPredecessorRead)!;
    expect(lineageRead.init?.signal?.aborted).toBe(false);
    const before = commits.length;
    await act(async () => {
      signOutByWindowEvent();
      // The handler itself abandons the read: nothing has rendered and no effect has run yet
      // (inside this scope React renders only when the scope ends). No timing is involved.
      expect(commits).toHaveLength(before);
      expect(lineageRead.init?.signal?.aborted).toBe(true);
      // Answered once the sign-out handler has run, while React has neither rendered the
      // signed-out page nor run the effect that abandons the read.
      lineageRead.resolve!(new Response(JSON.stringify(earlierBody), { status: 200 }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const after = commits.slice(before);
    expect(after.length).toBeGreaterThan(0);
    expect(after).toEqual(after.map(() => cleared));
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
  });

  it('control: the same held read, answered while the reviewer is still signed in, is shown', async () => {
    const requests = stubFetch({ r5Rows: [ownRow], predecessor: 'hold' });
    const commits = renderPanelWithCommitLog(1, OWN);
    await editorReady();
    await waitFor(() => expect(editor()).toHaveValue(OWN));
    await waitFor(() => expect(reads(requests)).toHaveLength(2));
    expect(commits.at(-1)).toEqual({ signedOut: false, earlier: false, own: true });
    await act(async () => {
      reads(requests).find(isPredecessorRead)!.resolve!(new Response(JSON.stringify(earlierBody), { status: 200 }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(commits.at(-1)).toEqual(shown);
    expect(screen.getByTestId('review-lineage-text')).toHaveTextContent(EARLIER);
  });

  const TYPED = 'Typed here and not saved yet.';
  // Longer than the panel's autosave delay (1.5 s after the draft last changed).
  const PAST_AUTOSAVE_MS = 1600;
  const typedBrowserCopy = () => readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER });

  it('removes text typed and not yet saved in the render that signs the reviewer out, and neither sends nor keeps it afterwards', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const requests = stubFetch({ predecessor: { body: earlierBody } });
      const commits = renderPanelWithCommitLog(1, TYPED);
      await editorReady();
      await screen.findByTestId('review-lineage-reference');
      fireEvent.change(editor(), { target: { value: TYPED } });
      expect(editor()).toHaveValue(TYPED);
      expect(commits.at(-1)).toEqual(shown);
      // What the end of this test finds gone is really there now: the browser copy holds the
      // text, and its autosave is pending (the control below shows that save being sent).
      expect(typedBrowserCopy()).toBe(TYPED);
      expect(writes(requests)).toEqual([]);
      const before = commits.length;
      act(() => { signOutBySupabase(); });
      const after = commits.slice(before);
      expect(after.length).toBeGreaterThan(0);
      expect(after).toEqual(after.map(() => cleared));
      expect(editor()).toHaveValue('');
      // Past the autosave delay, so "not sent" means cancelled and not merely not yet due.
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_AUTOSAVE_MS); });
      expect(writes(requests)).toEqual([]);
      expect(typedBrowserCopy()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('control: the same typed text, with no sign-out, stays in the browser copy and is sent once the autosave delay passes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const requests = stubFetch({ predecessor: { body: earlierBody } });
      renderPanel(1);
      await editorReady();
      await screen.findByTestId('review-lineage-reference');
      fireEvent.change(editor(), { target: { value: TYPED } });
      expect(writes(requests)).toEqual([]);
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_AUTOSAVE_MS); });
      await waitFor(() => expect(writes(requests)).toHaveLength(1));
      expect(JSON.parse(String(writes(requests)[0].init?.body))).toMatchObject({ action: 'save-draft', text: TYPED });
      expect(typedBrowserCopy()).toBe(TYPED);
    } finally {
      vi.useRealTimers();
    }
  });

  it('removes an open conflict box, and the saved response it shows, in the render that signs the reviewer out', async () => {
    const MINE = 'Typed in this tab.';
    const SAVED_ELSEWHERE = 'Saved from another tab.';
    interface ConflictView { readonly signedOut: boolean; readonly box: boolean; readonly saved: boolean; readonly mine: boolean }
    const commits: ConflictView[] = [];
    const record = () => {
      const text = document.body.textContent ?? '';
      const typed = (document.getElementById('review-comment-draft') as HTMLTextAreaElement | null)?.value ?? '';
      commits.push({ signedOut: text.includes('Sign in again in another tab'), box: document.querySelector('[data-testid="review-conflict"]') !== null, saved: text.includes(SAVED_ELSEWHERE), mine: typed.includes(MINE) });
    };
    const requests = stubFetch({ put: 'hold' });
    render(<Profiler id="review-panel-conflict" onRender={record}>{panelElement(1)}</Profiler>);
    await editorReady();
    fireEvent.change(editor(), { target: { value: MINE } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    // Another tab saved first: the record answers with its newer row and the box opens.
    await act(async () => { writes(requests)[0].resolve?.(new Response(JSON.stringify({ outcome: 'stale_revision', row: { ...ownRow, draft_text: SAVED_ELSEWHERE, revision: 4 } }), { status: 409 })); });
    expect(await screen.findByTestId('review-conflict')).toHaveTextContent(`Saved response: ${SAVED_ELSEWHERE}`);
    // The box, the other tab's response and this tab's text are all on the page and the log
    // sees them, so their absence below is a finding and not a probe that cannot see.
    expect(commits.at(-1)).toEqual({ signedOut: false, box: true, saved: true, mine: true });
    const before = commits.length;
    act(() => { signOutBySupabase(); });
    const after = commits.slice(before);
    expect(after.length).toBeGreaterThan(0);
    // Every render from the sign-out on, the first one included.
    expect(after).toEqual(after.map(() => ({ signedOut: true, box: false, saved: false, mine: false })));
    expect(screen.queryByTestId('review-conflict')).toBeNull();
  });

  it('reads the earlier draft again once the reviewer has signed back in and selected Try again', async () => {
    const requests = stubFetch({ r5Rows: [ownRow], predecessor: { body: earlierBody } });
    renderPanel(1);
    await editorReady();
    await screen.findByTestId('review-lineage-reference');
    expect(reads(requests).filter(isPredecessorRead)).toHaveLength(1);
    act(() => { signOutBySupabase(); });
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    // Abandoning the read at sign-out must not stop it being issued for the next session.
    expect(await screen.findByTestId('review-lineage-text')).toHaveTextContent(EARLIER);
    const predecessorReads = reads(requests).filter(isPredecessorRead);
    expect(predecessorReads).toHaveLength(2);
    expect(predecessorReads[1].init?.signal?.aborted).toBe(false);
  });
});

describe('a draft the review record does not know (not provisioned)', () => {
  // Both refusals mean the same thing to the reader: the record does not hold this draft's
  // questions under this draft's identity. Neither is fixed by a reload (a page whose own
  // digest is out of date is refused by the route before the record is asked), so both get
  // the one true sentence and nothing promises that reloading helps.
  const NOT_PROVISIONED = 'Responses to this draft cannot be saved to the review record yet. What you type is kept in this browser only, and is cleared when you sign out.';
  const REFUSALS = [['unknown_identity', 404], ['stale_manifest', 409]] as const;
  // Longer than the panel's autosave delay (1.5 s after the draft last changed).
  const PAST_AUTOSAVE_MS = 1600;

  it.each(REFUSALS)('says so plainly on a refused save (%s), stops saving and keeps the text', async (outcome, status) => {
    const requests = stubFetch({ put: { status, body: { outcome } } });
    renderPanel(1);
    await editorReady();
    fireEvent.change(editor(), { target: { value: 'An answer to this draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled());
    const panel = screen.getByTestId('active-question-response');
    expect(panel).toHaveTextContent(NOT_PROVISIONED);
    // No claim that the page is out of date or that reloading restores saving.
    expect(panel).not.toHaveTextContent(/out of date/i);
    expect(panel).not.toHaveTextContent(/reload the page/i);
    // The save status line also says where the text is and that signing out clears it.
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('Not saved to the review record. Your text is kept in this browser only, and is cleared when you sign out.');
    // Not the retryable copy, and no retry control: sending the same save again can never succeed.
    expect(panel).not.toHaveTextContent('Try again');
    expect(panel).not.toHaveTextContent('Could not save');
    expect(screen.queryByTestId('review-persistence-retry')).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled();
    // The text is still on screen and in this draft's browser copy, and the editor still accepts typing.
    expect(editor()).toHaveValue('An answer to this draft.');
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER })).toBe('An answer to this draft.');
    expect(editor()).not.toHaveAttribute('readonly');
    expect(writes(requests)).toHaveLength(1);
  });

  it.each(REFUSALS)('never autosaves again after a refused save (%s): typing on past the autosave delay sends nothing', async (outcome, status) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const requests = stubFetch({ put: { status, body: { outcome } } });
      renderPanel(1);
      await editorReady();
      fireEvent.change(editor(), { target: { value: 'An answer to this draft.' } });
      // Two-sided: nothing is clicked. The one save is sent by the autosave timer itself, so
      // this test really crosses the autosave delay before it shows that the timer stops.
      expect(writes(requests)).toHaveLength(0);
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_AUTOSAVE_MS); });
      await waitFor(() => expect(writes(requests)).toHaveLength(1));
      await waitFor(() => expect(screen.getByTestId('active-question-response')).toHaveTextContent(NOT_PROVISIONED));
      // The reviewer keeps typing, twice, each time followed by more than the autosave delay.
      fireEvent.change(editor(), { target: { value: 'An answer to this draft, extended.' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_AUTOSAVE_MS); });
      fireEvent.change(editor(), { target: { value: 'An answer to this draft, extended twice.' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(PAST_AUTOSAVE_MS * 3); });
      // Exactly the one refused PUT, ever; the newest text is on screen and in the browser copy.
      expect(writes(requests)).toHaveLength(1);
      expect(editor()).toHaveValue('An answer to this draft, extended twice.');
      expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER })).toBe('An answer to this draft, extended twice.');
    } finally {
      vi.useRealTimers();
    }
  });

  const QUEUED_ACTIONS = REFUSALS.flatMap(([outcome, status]) => (['Save draft', 'Submit response'] as const).map((button) => [button, outcome, status] as const));

  it.each(QUEUED_ACTIONS)('drops a "%s" queued behind the refused save (%s): it is never sent', async (button, outcome, status) => {
    const requests = stubFetch({ put: 'hold' });
    renderPanel(1);
    await editorReady();
    fireEvent.change(editor(), { target: { value: 'An answer to this draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    // While that save is still in flight the reviewer types on and asks again: this second
    // action waits in the queue behind the first.
    fireEvent.change(editor(), { target: { value: 'An answer to this draft, extended.' } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(writes(requests)).toHaveLength(1);
    // The first save is refused. The queued action must be dropped, not sent.
    await act(async () => { writes(requests)[0].resolve?.(new Response(JSON.stringify({ outcome }), { status })); });
    await waitFor(() => expect(screen.getByTestId('active-question-response')).toHaveTextContent(NOT_PROVISIONED));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(writes(requests)).toHaveLength(1);
    expect(editor()).toHaveValue('An answer to this draft, extended.');
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(1).id, userKey: REVIEWER })).toBe('An answer to this draft, extended.');
  });

  it.each(['Save draft', 'Submit response'] as const)('two-sided: the same queued "%s" IS sent when the first save is accepted', async (button) => {
    const requests = stubFetch({ put: 'hold' });
    renderPanel(1);
    await editorReady();
    fireEvent.change(editor(), { target: { value: 'An answer to this draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    fireEvent.change(editor(), { target: { value: 'An answer to this draft, extended.' } });
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(writes(requests)).toHaveLength(1);
    const saved = { document_version: R5_PAPER_VERSION, manifest_sha256: R5_MANIFEST, cohort_id: 'categories', question_id: r5Question(1).id, draft_text: 'An answer to this draft.', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null };
    await act(async () => { writes(requests)[0].resolve?.(new Response(JSON.stringify({ outcome: 'ok', row: saved }), { status: 200 })); });
    // The queue was real: the second action goes out once the first has answered.
    await waitFor(() => expect(writes(requests)).toHaveLength(2));
    expect(JSON.parse(String(writes(requests)[1].init?.body))).toMatchObject({ action: button === 'Save draft' ? 'save-draft' : 'submit', text: 'An answer to this draft, extended.' });
  });

  it('two-sided: a save the record accepts shows no such message and keeps saving available', async () => {
    const saved = { document_version: R5_PAPER_VERSION, manifest_sha256: R5_MANIFEST, cohort_id: 'categories', question_id: r5Question(1).id, draft_text: 'An answer to this draft.', submitted_text: null, revision: 1, submitted_revision: null, submitted_at: null, updated_at: null };
    stubFetch({ put: { status: 200, body: { outcome: 'ok', row: saved } } });
    renderPanel(1);
    await editorReady();
    fireEvent.change(editor(), { target: { value: 'An answer to this draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent(/Draft saved/));
    expect(screen.getByTestId('active-question-response')).not.toHaveTextContent('cannot be saved to the review record yet');
    expect(screen.getByRole('button', { name: 'Submit response' })).not.toBeDisabled();
  });

  it.each(['unknown_identity', 'stale_manifest'])('leaves the DEFAULT draft as it was on the same refusal (%s): a retryable error, saving still offered', async (outcome) => {
    const guide = getReviewerGuideContract();
    const requests = stubFetch({ put: { status: outcome === 'unknown_identity' ? 404 : 409, body: { outcome } } });
    render(
      <ReviewCommentsPanel
        documentVersion={REVISED_PAPER_VERSION}
        manifestSha256={PREDECESSOR_MANIFEST}
        cohortId="categories"
        questions={guide.questions}
        question={guide.questions[0]}
        responseRef={createRef<HTMLElement>()}
        onSelectQuestion={vi.fn()}
        onPreviousQuestion={vi.fn()}
        onNextQuestion={vi.fn()}
      />,
    );
    await editorReady();
    fireEvent.change(editor(), { target: { value: 'An answer to the current draft.' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(writes(requests)).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('review-save-status')).toHaveTextContent('Could not save.'));
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('Try again.');
    const panel = screen.getByTestId('active-question-response');
    expect(panel).not.toHaveTextContent('cannot be saved to the review record yet');
    expect(panel).not.toHaveTextContent('This page is out of date');
    // Saving is still offered, as before a second draft existed.
    expect(screen.getByRole('button', { name: 'Save draft' })).not.toBeDisabled();
    expect(editor()).toHaveValue('An answer to the current draft.');
  });
});

describe('sign-out with two bound drafts', () => {
  it('clears the unsaved browser copies of BOTH drafts, not only the draft on screen', async () => {
    stubFetch();
    // The reviewer has unsaved text under each draft, and an anonymous leftover under each.
    writeReviewLocalDraftEntry({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(2).id, userKey: REVIEWER }, 'unsaved under the v0.9.88 draft', null);
    writeReviewLocalDraftEntry({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(3), userKey: REVIEWER }, 'unsaved under the current draft', null);
    writeReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(4) }, 'anonymous leftover under the current draft');
    renderPanel(1);
    await editorReady();
    // Anti-vacuity: both copies exist before sign-out.
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(2).id, userKey: REVIEWER })).toBe('unsaved under the v0.9.88 draft');
    expect(readReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(3), userKey: REVIEWER })).toBe('unsaved under the current draft');
    fireEvent(window, new Event('matrix-options-auth-signed-out'));
    await waitFor(() => expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(2).id, userKey: REVIEWER })).toBe(''));
    // The draft that was NOT on screen is cleared as well.
    expect(readReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(3), userKey: REVIEWER })).toBe('');
    expect(readReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(4) })).toBe('');
  });

  it('does the same when signing out from the default draft', async () => {
    const guide = getReviewerGuideContract();
    stubFetch();
    writeReviewLocalDraftEntry({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(2).id, userKey: REVIEWER }, 'unsaved under the v0.9.88 draft', null);
    writeReviewLocalDraftEntry({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(3), userKey: REVIEWER }, 'unsaved under the current draft', null);
    render(
      <ReviewCommentsPanel
        documentVersion={REVISED_PAPER_VERSION}
        manifestSha256={PREDECESSOR_MANIFEST}
        cohortId="categories"
        questions={guide.questions}
        question={guide.questions[0]}
        responseRef={createRef<HTMLElement>()}
        onSelectQuestion={vi.fn()}
        onPreviousQuestion={vi.fn()}
        onNextQuestion={vi.fn()}
      />,
    );
    await editorReady();
    fireEvent(window, new Event('matrix-options-auth-signed-out'));
    await waitFor(() => expect(readReviewLocalDraft({ documentVersion: REVISED_PAPER_VERSION, questionId: predecessorQuestionId(3), userKey: REVIEWER })).toBe(''));
    expect(readReviewLocalDraft({ documentVersion: R5_PAPER_VERSION, questionId: r5Question(2).id, userKey: REVIEWER })).toBe('');
  });
});

describe('an earlier response that could not be loaded', () => {
  it('says so when this draft\'s record is reachable but the earlier read fails', async () => {
    stubFetch({ predecessor: { status: 503, body: { outcome: 'persistence_unavailable', persistence: 'unavailable', rows: [], userKey: REVIEWER } } });
    renderPanel(1);
    await editorReady();
    expect(await screen.findByTestId('review-lineage-unavailable')).toHaveTextContent('could not be loaded. Reload the page to try again.');
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
  });

  it('says nothing extra when this draft\'s own record is unavailable too (the standing message already covers it)', async () => {
    // The live state today: both reads answer 503 and both name the reviewer. The earlier
    // read IS issued and fails, so only the guard on this draft's own state keeps the note out.
    const requests = stubFetch({ r5Status: 503, predecessor: { status: 503, body: { outcome: 'persistence_unavailable', persistence: 'unavailable', rows: [], userKey: REVIEWER } } });
    renderPanel(1);
    await editorReady();
    await waitFor(() => expect(reads(requests)).toHaveLength(2));
    expect(reads(requests).some((request) => request.url.includes(encodeURIComponent(REVISED_PAPER_VERSION)))).toBe(true);
    await waitFor(() => expect(screen.getByTestId('active-question-response')).toHaveTextContent('Saving to the review record is not available yet. What you type is kept in this browser only, and is cleared when you sign out.'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId('review-lineage-unavailable')).toBeNull();
    expect(screen.queryByTestId('review-lineage-reference')).toBeNull();
  });

  it('never says it for the reworded Q11, which has no earlier response to load', async () => {
    stubFetch({ predecessor: { status: 503, body: { outcome: 'persistence_unavailable', persistence: 'unavailable', rows: [], userKey: REVIEWER } } });
    renderPanel(11);
    await editorReady();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId('review-lineage-unavailable')).toBeNull();
    expect(screen.getByTestId('review-lineage-changed')).toBeInTheDocument();
  });

  it('gives up on a hung earlier read after the save timeout instead of waiting forever', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const requests = stubFetch({ predecessor: 'hang' });
      renderPanel(1);
      await editorReady();
      await waitFor(() => expect(reads(requests)).toHaveLength(2));
      expect(screen.queryByTestId('review-lineage-unavailable')).toBeNull();
      const hung = reads(requests).find((request) => request.url.includes(encodeURIComponent(REVISED_PAPER_VERSION)))!;
      await act(async () => { await vi.advanceTimersByTimeAsync(REVIEW_SAVE_TIMEOUT_MS + 10); });
      expect((hung.init?.signal as AbortSignal).aborted).toBe(true);
      expect(screen.getByTestId('review-lineage-unavailable')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('lineageResponseText', () => {
  const base = { document_version: REVISED_PAPER_VERSION, manifest_sha256: PREDECESSOR_MANIFEST, cohort_id: 'categories', question_id: predecessorQuestionId(1), revision: 1, updated_at: null };

  it('prefers the submitted text, falls back to the saved draft, and is null when there is no text', () => {
    expect(lineageResponseText({ ...base, draft_text: 'later edit', submitted_text: 'submitted', submitted_revision: 1, submitted_at: null })).toEqual({ text: 'submitted', submitted: true });
    expect(lineageResponseText({ ...base, draft_text: 'draft only', submitted_text: null, submitted_revision: null, submitted_at: null })).toEqual({ text: 'draft only', submitted: false });
    expect(lineageResponseText({ ...base, draft_text: null, submitted_text: null, submitted_revision: null, submitted_at: null })).toBeNull();
    expect(lineageResponseText({ ...base, draft_text: '', submitted_text: '', submitted_revision: null, submitted_at: null })).toBeNull();
    expect(lineageResponseText(null)).toBeNull();
    expect(lineageResponseText(undefined)).toBeNull();
  });
});
