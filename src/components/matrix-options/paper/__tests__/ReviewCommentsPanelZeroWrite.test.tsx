import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { PREDECESSOR_PAPER_VERSION, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { readReviewLocalDraft, writeReviewLocalDraft, writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';

import { ReviewCommentsPanel } from '../ReviewCommentsPanel';

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
 * Zero-write gate (every release except v0.9.91) and the draft-only recovery flush (v0.9.91).
 * Every test counts the PUT requests the panel issues through a fetch spy.
 */

const guide = getReviewerGuideContract();
const questions = guide.questions.slice(0, 4);
const REVIEWER = 'user-a';
const MANIFEST = 'a'.repeat(64);
const OTHER_MANIFEST = 'b'.repeat(64);

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

interface PutCall { readonly questionId: string; readonly body: Record<string, unknown> }
type PutHandler = (call: PutCall, index: number) => Promise<Response> | Response;

function savedRow(version: string, call: PutCall) {
  const expected = call.body.expectedRevision as number | null;
  return { document_version: version, manifest_sha256: call.body.manifestSha256 as string, cohort_id: call.body.cohortId as string, question_id: call.questionId, draft_text: call.body.text as string, submitted_text: null, revision: (expected ?? 0) + 1, submitted_revision: null, submitted_at: null, updated_at: null };
}

/** A fetch spy: bootstrap GETs answer from `bootstraps` (the last one repeats); PUTs are recorded and answered by `onPut`. */
function installFetch(version: string, options: { readonly bootstraps?: ReadonlyArray<Record<string, unknown>>; readonly onPut?: PutHandler } = {}) {
  const bootstraps = options.bootstraps ?? [{ persistence: 'available', userKey: REVIEWER, rows: [] }];
  const puts: PutCall[] = [];
  let getCount = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method !== 'PUT') {
      const payload = bootstraps[Math.min(getCount, bootstraps.length - 1)];
      getCount += 1;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    }
    const call: PutCall = { questionId: decodeURIComponent(url.split('/').pop() ?? ''), body: JSON.parse(String(init.body)) as Record<string, unknown> };
    puts.push(call);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const index = puts.length - 1;
    const answer = options.onPut ? options.onPut(call, index) : new Response(JSON.stringify({ outcome: 'ok', row: savedRow(version, call) }), { status: 200 });
    return new Promise<Response>((resolve, reject) => {
      const onAbort = () => { inFlight -= 1; reject(new DOMException('Aborted', 'AbortError')); };
      if (init.signal?.aborted) { onAbort(); return; }
      init.signal?.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(answer).then((response) => { init.signal?.removeEventListener('abort', onAbort); inFlight -= 1; resolve(response); }, (error: unknown) => { init.signal?.removeEventListener('abort', onAbort); inFlight -= 1; reject(error); });
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, puts, maxInFlight: () => maxInFlight };
}

function panelElement(version: string, overrides: Partial<Parameters<typeof ReviewCommentsPanel>[0]> = {}) {
  return (
    <ReviewCommentsPanel
      documentVersion={version}
      manifestSha256={MANIFEST}
      cohortId="categories"
      questions={questions}
      question={questions[0]}
      responseRef={createRef<HTMLElement>()}
      onSelectQuestion={vi.fn()}
      onPreviousQuestion={vi.fn()}
      onNextQuestion={vi.fn()}
      {...overrides}
    />
  );
}

async function bootstrapped() {
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).not.toHaveAttribute('readonly'));
}
/** A release that does not collect responses: the editor stays read-only, so wait for the bootstrap GET and the honest copy instead. */
async function notCollectingReady(fetchMock: { mock: { calls: unknown[][] } }) {
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('?documentVersion='))).toBe(true));
  await waitFor(() => expect(screen.getByTestId('review-current-draft-link')).toBeInTheDocument());
  await settle();
}
const textbox = () => screen.getByRole('textbox', { name: 'Your response' });
const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); };

describe('zero-write gate: every release except v0.9.91 never PUTs', () => {
  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s: typing, autosave, blur, navigation, submit, retry and a bootstrap that says available make zero PUT calls', async (_name, version) => {
    const { puts, fetchMock } = installFetch(version, { bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [] }] });
    // A browser copy of another question must be left exactly as it is.
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[1].id, userKey: REVIEWER }, 'kept in the browser', null);
    const view = render(panelElement(version));
    await notCollectingReady(fetchMock);
    // The bootstrap GET (read-only) did run, and the panel did not enter a writable state.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('?documentVersion='))).toBe(true);
    expect(screen.getByTestId('review-save-draft')).toBeDisabled();
    expect(screen.getByTestId('review-submit')).toBeDisabled();
    expect(screen.queryByTestId('review-persistence-retry')).toBeNull();

    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'typed against a draft that does not collect' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    fireEvent.blur(textbox());
    fireEvent.click(screen.getByTestId('review-submit'));
    fireEvent.click(screen.getByTestId('review-save-draft'));
    // Question navigation: the outgoing question's text would be saved on a switch.
    view.rerender(panelElement(version, { question: questions[1] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    view.rerender(panelElement(version, { question: questions[0] }));
    // An availability transition: a new bootstrap that again says 'available'.
    view.rerender(panelElement(version, { manifestSha256: OTHER_MANIFEST }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    vi.useRealTimers();
    await settle();

    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')).toHaveLength(0);
    expect(puts).toHaveLength(0);
    // The local draft stays where it was (the gate never clears the browser copy).
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[1].id, userKey: REVIEWER })).toBe('kept in the browser');
  });

  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s: says plainly that it does not collect responses and links to the current draft', async (_name, version) => {
    const { fetchMock } = installFetch(version);
    render(panelElement(version));
    await notCollectingReady(fetchMock);
    expect(screen.getByTestId('review-action-reason')).toHaveTextContent('This earlier draft does not collect responses.');
    expect(screen.getByTestId('review-action-reason').textContent).not.toMatch(/cannot be saved/);
    const link = screen.getByTestId('review-current-draft-link');
    expect(link).toHaveTextContent('Go to the current review draft');
    expect(link.getAttribute('href')).toContain(encodeURIComponent(V0991_PAPER_VERSION));
  });

  // Plan R4: only v0.9.91 collects responses.
  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s: the editor is read-only but still shows the existing browser copy untouched', async (_name, version) => {
    const { fetchMock } = installFetch(version);
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER }, 'earlier browser copy', null);
    render(panelElement(version));
    await notCollectingReady(fetchMock);
    expect(textbox()).toHaveAttribute('readonly');
    await waitFor(() => expect(textbox()).toHaveValue('earlier browser copy'));
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('earlier browser copy');
  });

  it('v0.9.91 positive control: the editor is NOT read-only once responses load', async () => {
    installFetch(V0991_PAPER_VERSION);
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    expect(textbox()).not.toHaveAttribute('readonly');
  });

  it('v0.9.91 positive control: the same flow still PUTs a draft', async () => {
    const { puts } = installFetch(V0991_PAPER_VERSION);
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    expect(screen.queryByTestId('review-current-draft-link')).toBeNull();
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'a real response' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    vi.useRealTimers();
    await waitFor(() => expect(puts.length).toBeGreaterThanOrEqual(1));
    expect(puts[0].body).toMatchObject({ documentVersion: V0991_PAPER_VERSION, action: 'save-draft', text: 'a real response', expectedUserId: REVIEWER });
  });
});

describe('recovery flush (v0.9.91): draft-only, one request at a time', () => {
  const seed = (questionId: string, text: string) => writeReviewLocalDraftEntry({ documentVersion: V0991_PAPER_VERSION, questionId, userKey: REVIEWER }, text, null);
  const q = (index: number) => questions[index].id;

  it('saves every buffered question in sequence as a draft, never a submit', async () => {
    seed(q(0), 'first'); seed(q(1), 'second'); seed(q(2), 'third');
    const tracker = installFetch(V0991_PAPER_VERSION);
    render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(3));
    expect(tracker.puts.map((call) => call.questionId)).toEqual([q(0), q(1), q(2)]);
    expect(tracker.puts.map((call) => call.body.text)).toEqual(['first', 'second', 'third']);
    expect(tracker.puts.every((call) => call.body.action === 'save-draft')).toBe(true);
    expect(tracker.puts.every((call) => call.body.expectedUserId === REVIEWER && call.body.expectedRevision === null)).toBe(true);
    expect(tracker.maxInFlight()).toBe(1);
    // Saved text leaves the browser copy.
    await waitFor(() => expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: q(2), userKey: REVIEWER })).toBe(''));
  });

  it('text edited during the flush stays a draft and is saved once more', async () => {
    seed(q(0), 'first');
    let release: (response: Response) => void = () => undefined;
    const tracker = installFetch(V0991_PAPER_VERSION, {
      onPut: (call, index) => index === 0 ? new Promise<Response>((resolve) => { release = resolve; }) : new Response(JSON.stringify({ outcome: 'ok', row: savedRow(V0991_PAPER_VERSION, call) }), { status: 200 }),
    });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[0] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    fireEvent.change(textbox(), { target: { value: 'first, then edited' } });
    await act(async () => { release(new Response(JSON.stringify({ outcome: 'ok', row: savedRow(V0991_PAPER_VERSION, tracker.puts[0]) }), { status: 200 })); });
    await waitFor(() => expect(tracker.puts.filter((call) => call.body.text === 'first, then edited')).toHaveLength(1));
    const second = tracker.puts.find((call) => call.body.text === 'first, then edited');
    expect(second?.body.expectedRevision).toBe(1);
    expect(tracker.maxInFlight()).toBe(1);
  });

  it('a lost response keeps the buffer, and the next transition to available retries it', async () => {
    seed(q(0), 'lost once'); seed(q(1), 'saved');
    const tracker = installFetch(V0991_PAPER_VERSION, {
      bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [] }, { persistence: 'unavailable', userKey: REVIEWER, rows: [] }, { persistence: 'available', userKey: REVIEWER, rows: [] }],
      onPut: (call, index) => { if (index === 0) throw new TypeError('network lost'); return new Response(JSON.stringify({ outcome: 'ok', row: savedRow(V0991_PAPER_VERSION, call) }), { status: 200 }); },
    });
    const view = render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(2));
    expect(tracker.puts.map((call) => call.questionId)).toEqual([q(0), q(1)]);
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: q(0), userKey: REVIEWER })).toBe('lost once');
    // Availability goes away, then comes back: the lost question is tried again.
    view.rerender(panelElement(V0991_PAPER_VERSION, { question: questions[3], manifestSha256: OTHER_MANIFEST }));
    await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(tracker.puts.filter((call) => call.questionId === q(0))).toHaveLength(2));
    expect(tracker.puts.filter((call) => call.questionId === q(1))).toHaveLength(1);
  });

  it('a 429 stops the pass and keeps the rest of the buffer', async () => {
    seed(q(0), 'throttled'); seed(q(1), 'never sent');
    const tracker = installFetch(V0991_PAPER_VERSION, { onPut: () => new Response(JSON.stringify({ outcome: 'rate_limited' }), { status: 429 }) });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    await settle();
    expect(tracker.puts).toHaveLength(1);
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: q(1), userKey: REVIEWER })).toBe('never sent');
  });

  it('an identity change aborts the remaining flush', async () => {
    seed(q(0), 'first'); seed(q(1), 'second');
    let release: (response: Response) => void = () => undefined;
    const tracker = installFetch(V0991_PAPER_VERSION, { onPut: () => new Promise<Response>((resolve) => { release = resolve; }) });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    act(() => { authListeners.forEach((listener) => listener('SIGNED_IN', { user: { id: 'user-b' } })); });
    await act(async () => { release(new Response(JSON.stringify({ outcome: 'ok', row: savedRow(V0991_PAPER_VERSION, tracker.puts[0]) }), { status: 200 })); });
    await settle();
    expect(tracker.puts).toHaveLength(1);
    expect(tracker.puts.every((call) => call.body.action === 'save-draft')).toBe(true);
  });

  it('a sign-out aborts the remaining flush', async () => {
    seed(q(0), 'first'); seed(q(1), 'second');
    const tracker = installFetch(V0991_PAPER_VERSION, { onPut: () => new Promise<Response>(() => undefined) });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    act(() => { window.dispatchEvent(new Event('matrix-options-auth-signed-out')); });
    await settle();
    expect(tracker.puts).toHaveLength(1);
  });

  it('a buffer of unknown base next to a saved row stays a conflict and is not flushed', async () => {
    // Legacy text: no base revision recorded, and the server already holds a row for this question.
    writeReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: q(0), userKey: REVIEWER }, 'legacy text');
    seed(q(1), 'normal buffer');
    const row = { document_version: V0991_PAPER_VERSION, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: q(0), draft_text: 'on the server', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null };
    const tracker = installFetch(V0991_PAPER_VERSION, { bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [row] }] });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[0] }));
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    await waitFor(() => expect(tracker.puts.some((call) => call.questionId === q(1))).toBe(true));
    await settle();
    expect(tracker.puts.some((call) => call.questionId === q(0))).toBe(false);
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: q(0), userKey: REVIEWER })).toBe('legacy text');
  });
});

describe('success path (v0.9.91): a draft is dropped only when the server row holds exactly the text sent', () => {
  // Plan R4: only v0.9.91 collects responses.
  it('a 200 ok whose row text differs from the text sent keeps the draft and its browser buffer', async () => {
    const { puts } = installFetch(V0991_PAPER_VERSION, {
      onPut: (call) => new Response(JSON.stringify({ outcome: 'ok', row: { ...savedRow(V0991_PAPER_VERSION, call), draft_text: 'something else entirely' } }), { status: 200 }),
    });
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'what I typed' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    vi.useRealTimers();
    await waitFor(() => expect(puts.length).toBeGreaterThanOrEqual(1));
    await settle();
    expect(puts[0].body.text).toBe('what I typed');
    // Never taken as saved: the editor keeps the typed text (not the server's) and the browser copy is not cleared.
    expect(textbox()).toHaveValue('what I typed');
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: questions[0].id, userKey: REVIEWER })).toBe('what I typed');
    expect(screen.getByTestId('review-save-status')).not.toHaveTextContent('Draft saved');
  });

  it('control: a 200 ok whose row holds exactly the text sent clears the browser buffer', async () => {
    const { puts } = installFetch(V0991_PAPER_VERSION);
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'what I typed' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    vi.useRealTimers();
    await waitFor(() => expect(puts.length).toBeGreaterThanOrEqual(1));
    await waitFor(() => expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: questions[0].id, userKey: REVIEWER })).toBe(''));
    expect(textbox()).toHaveValue('what I typed');
  });
});

describe('earlier drafts: status line, change guard', () => {
  const rowFor = (version: string, overrides: Record<string, unknown> = {}) => ({ document_version: version, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: questions[0].id, draft_text: null, submitted_text: 'my submitted answer', revision: 2, submitted_revision: 2, submitted_at: '2026-09-20T10:00:00.000Z', updated_at: '2026-09-20T10:00:00.000Z', ...overrides });
  const status = () => screen.getByTestId('review-save-status');

  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s with no saved row: says only that it does not collect responses (no false "Not saved.")', async (_name, version) => {
    const { fetchMock } = installFetch(version);
    render(panelElement(version));
    await notCollectingReady(fetchMock);
    expect(status().textContent).toBe('This earlier draft does not collect responses.');
    expect(status()).not.toHaveTextContent('Not saved');
  });

  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s with a submitted row: shows the read-only submitted status, never "Not saved."', async (_name, version) => {
    const { fetchMock } = installFetch(version, { bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [rowFor(version)] }] });
    render(panelElement(version));
    await notCollectingReady(fetchMock);
    await waitFor(() => expect(textbox()).toHaveValue('my submitted answer'));
    expect(status()).toHaveTextContent(/^Submitted .*\. This earlier draft does not collect responses\.$/);
    expect(status()).not.toHaveTextContent('Not saved');
    expect(status()).not.toHaveTextContent('Editing creates a new draft');
    expect(status()).not.toHaveTextContent('kept in this browser only');
  });

  it('an earlier draft with a saved draft row shows "Draft saved <date>."', async () => {
    const { fetchMock } = installFetch(R5_PAPER_VERSION, { bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [rowFor(R5_PAPER_VERSION, { draft_text: 'my draft', submitted_text: null, submitted_revision: null, submitted_at: null })] }] });
    render(panelElement(R5_PAPER_VERSION));
    await notCollectingReady(fetchMock);
    await waitFor(() => expect(status()).toHaveTextContent(/^Draft saved/));
    expect(status()).not.toHaveTextContent('Not saved');
  });

  it('only unsaved local text is called "kept in this browser only"', async () => {
    const { fetchMock } = installFetch(R5_PAPER_VERSION);
    writeReviewLocalDraftEntry({ documentVersion: R5_PAPER_VERSION, questionId: questions[0].id, userKey: REVIEWER }, 'local only', null);
    render(panelElement(R5_PAPER_VERSION));
    await notCollectingReady(fetchMock);
    await waitFor(() => expect(textbox()).toHaveValue('local only'));
    expect(status()).toHaveTextContent('This earlier draft does not collect responses. Your text is kept in this browser only, and is cleared when you sign out.');
  });

  it('control: on v0.9.91 the same submitted row shows the writable status and no "does not collect" copy', async () => {
    installFetch(V0991_PAPER_VERSION, { bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [rowFor(V0991_PAPER_VERSION)] }] });
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    await waitFor(() => expect(status()).toHaveTextContent('Editing creates a new draft'));
    expect(status()).not.toHaveTextContent('does not collect');
  });

  it.each([['the predecessor', PREDECESSOR_PAPER_VERSION], ['R5', R5_PAPER_VERSION]])('%s: a change event reaching the handler writes no browser copy and changes nothing', async (_name, version) => {
    const { fetchMock, puts } = installFetch(version);
    render(panelElement(version));
    await notCollectingReady(fetchMock);
    fireEvent.change(textbox(), { target: { value: 'forced past readOnly' } });
    expect(textbox()).toHaveValue('');
    expect(readReviewLocalDraft({ documentVersion: version, questionId: questions[0].id, userKey: REVIEWER })).toBe('');
    expect(puts).toHaveLength(0);
  });

  it('control: on v0.9.91 the same change event is taken as typing', async () => {
    installFetch(V0991_PAPER_VERSION);
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    fireEvent.change(textbox(), { target: { value: 'typed' } });
    expect(textbox()).toHaveValue('typed');
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: questions[0].id, userKey: REVIEWER })).toBe('typed');
  });
});

describe('a 200 ok with different row text does not loop (v0.9.91)', () => {
  const mismatchHandler = (call: PutCall) => new Response(JSON.stringify({ outcome: 'ok', row: { ...savedRow(V0991_PAPER_VERSION, call), draft_text: 'something else entirely' } }), { status: 200 });

  it('sends at most one PUT in 10 s, marks the outcome an error, and sends again only after the reviewer edits', async () => {
    const { puts } = installFetch(V0991_PAPER_VERSION, { onPut: mismatchHandler });
    render(panelElement(V0991_PAPER_VERSION));
    await bootstrapped();
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'what I typed' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(puts).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(puts).toHaveLength(1);
    expect(screen.getByTestId('review-save-status')).toHaveTextContent('Could not save.');
    expect(textbox()).toHaveValue('what I typed');
    // Two-sided: a further edit is sent again.
    fireEvent.change(textbox(), { target: { value: 'what I typed, edited' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(puts).toHaveLength(2);
    expect(puts[1].body.text).toBe('what I typed, edited');
    vi.useRealTimers();
  });
});

describe('the recovery flush stops at once on a stop-saving outcome', () => {
  const seed = (questionId: string, text: string) => writeReviewLocalDraftEntry({ documentVersion: V0991_PAPER_VERSION, questionId, userKey: REVIEWER }, text, null);
  it.each([
    ['a 401', 401, { error: 'Unauthorized' }],
    ['identity_changed', 409, { outcome: 'identity_changed' }],
    ['unknown_identity', 404, { outcome: 'unknown_identity' }],
    ['stale_manifest', 409, { outcome: 'stale_manifest' }],
    ['a 429', 429, { outcome: 'rate_limited' }],
  ])('%s: exactly the one refused PUT, the other buffer is kept and never sent', async (_name, status, body) => {
    seed(questions[0].id, 'first'); seed(questions[1].id, 'second');
    const tracker = installFetch(V0991_PAPER_VERSION, { onPut: () => new Response(JSON.stringify(body), { status }) });
    render(panelElement(V0991_PAPER_VERSION, { question: questions[3] }));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    await settle();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(tracker.puts).toHaveLength(1);
    expect(readReviewLocalDraft({ documentVersion: V0991_PAPER_VERSION, questionId: questions[1].id, userKey: REVIEWER })).toBe('second');
  });
});

describe('recovery flush: text typed on this page during an outage (v0.9.91)', () => {
  const q = (index: number) => questions[index].id;
  const okBody = (call: PutCall) => new Response(JSON.stringify({ outcome: 'ok', row: savedRow(V0991_PAPER_VERSION, call) }), { status: 200 });
  const unauthorised = () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  it('a mid-session 401, text typed on Q1 and Q2, then Try again: both are saved in sequence as drafts', async () => {
    const tracker = installFetch(V0991_PAPER_VERSION, { onPut: (call, index) => index === 0 ? unauthorised() : okBody(call) });
    const view = render(panelElement(V0991_PAPER_VERSION, { question: questions[0] }));
    await bootstrapped();
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'typed on Q1' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(tracker.puts).toHaveLength(1);
    expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument();
    view.rerender(panelElement(V0991_PAPER_VERSION, { question: questions[1] }));
    fireEvent.change(textbox(), { target: { value: 'typed on Q2' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    // Still signed out: nothing more was sent.
    expect(tracker.puts).toHaveLength(1);
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    const after = tracker.puts.slice(1);
    expect(after.map((call) => call.questionId)).toEqual([q(0), q(1)]);
    expect(after.map((call) => call.body.text)).toEqual(['typed on Q1', 'typed on Q2']);
    expect(after.every((call) => call.body.action === 'save-draft' && call.body.expectedUserId === REVIEWER)).toBe(true);
    expect(tracker.maxInFlight()).toBe(1);
    vi.useRealTimers();
  });

  it('the active question typed during the outage is sent exactly once across the flush and its debounce window', async () => {
    let release: (response: Response) => void = () => undefined;
    const tracker = installFetch(V0991_PAPER_VERSION, {
      bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [] }, { persistence: 'unavailable', userKey: REVIEWER, rows: [] }, { persistence: 'available', userKey: REVIEWER, rows: [] }],
      onPut: (call) => new Promise<Response>((resolve) => { release = () => resolve(okBody(call)); }),
    });
    const view = render(panelElement(V0991_PAPER_VERSION, { question: questions[0] }));
    await bootstrapped();
    // Outage: another manifest makes the bootstrap answer 'unavailable'.
    view.rerender(panelElement(V0991_PAPER_VERSION, { question: questions[0], manifestSha256: OTHER_MANIFEST }));
    await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
    vi.useFakeTimers();
    fireEvent.change(textbox(), { target: { value: 'typed during the outage' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(tracker.puts).toHaveLength(0);
    vi.useRealTimers();
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(tracker.puts).toHaveLength(1));
    // The flush's PUT is still in flight while the debounce window (1.5 s) passes.
    vi.useFakeTimers();
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(tracker.puts).toHaveLength(1);
    await act(async () => { release(new Response('{}')); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(tracker.puts).toHaveLength(1);
    expect(tracker.maxInFlight()).toBe(1);
    vi.useRealTimers();
  });

  it('a typed draft for a conflicted question is not flushed (a typed draft for another question still is)', async () => {
    const row = { document_version: V0991_PAPER_VERSION, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: q(0), draft_text: 'on the server', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null };
    const tracker = installFetch(V0991_PAPER_VERSION, {
      bootstraps: [{ persistence: 'available', userKey: REVIEWER, rows: [] }, { persistence: 'unavailable', userKey: REVIEWER, rows: [] }, { persistence: 'available', userKey: REVIEWER, rows: [row] }],
      onPut: (call, index) => index === 0 ? new Response(JSON.stringify({ outcome: 'stale_revision', row }), { status: 409 }) : okBody(call),
    });
    const view = render(panelElement(V0991_PAPER_VERSION, { question: questions[0] }));
    await bootstrapped();
    fireEvent.change(textbox(), { target: { value: 'typed on Q1' } });
    fireEvent.blur(textbox());
    await waitFor(() => expect(screen.getByTestId('review-conflict')).toBeInTheDocument());
    expect(tracker.puts).toHaveLength(1);
    // Outage, then text typed on Q2, then Try again.
    view.rerender(panelElement(V0991_PAPER_VERSION, { question: questions[0], manifestSha256: OTHER_MANIFEST }));
    await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
    view.rerender(panelElement(V0991_PAPER_VERSION, { question: questions[1], manifestSha256: OTHER_MANIFEST }));
    fireEvent.change(textbox(), { target: { value: 'typed on Q2' } });
    fireEvent.click(screen.getByTestId('review-persistence-retry'));
    await waitFor(() => expect(tracker.puts).toHaveLength(2));
    await settle();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(tracker.puts.map((call) => call.questionId)).toEqual([q(0), q(1)]);
    expect(tracker.puts[1].body.text).toBe('typed on Q2');
  });
});
