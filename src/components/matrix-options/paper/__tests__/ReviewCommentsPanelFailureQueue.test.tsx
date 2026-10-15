import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewerGuideBinding, getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';

import { REVIEW_SAVE_TIMEOUT_MS, ReviewCommentsPanel } from '../ReviewCommentsPanel';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } }),
}));

const version = V0991_PAPER_VERSION;
const guide = getReviewerGuideContract();
const ids = getReviewerGuideBinding(V0991_PAPER_VERSION).questions;
const questions = guide.questions.slice(0, 2).map((question, index) => ({ ...question, id: ids[index].id, number: ids[index].number }));
const MANIFEST = 'a'.repeat(64);

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Pending = { init?: RequestInit; resolve: (response: Response) => void; reject: (error: unknown) => void };
function stub() {
  const puts: Pending[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
    return new Promise<Response>((resolve, reject) => {
      puts.push({ init, resolve, reject });
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }));
  return puts;
}
function renderPanel() {
  render(
    <ReviewCommentsPanel
      documentVersion={version}
      questions={questions}
      question={questions[0]}
      responseRef={createRef<HTMLElement>()}
      onSelectQuestion={vi.fn()}
      onPreviousQuestion={vi.fn()}
      onNextQuestion={vi.fn()}
      manifestSha256={MANIFEST}
      cohortId="categories"
    />,
  );
}
const box = () => screen.getByRole('textbox', { name: 'Your response' });
const ready = () => waitFor(() => expect(box()).not.toHaveAttribute('readonly'));
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('ReviewCommentsPanel: a recovery flush that stops cancels the scheduled autosave', () => {
  it('flush + active-question pending debounce + 429 on an earlier question: no further PUT across 10 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[1].id, userKey: 'user-a' }, 'restored words', null);
    const puts = stub();
    renderPanel();
    await waitFor(() => expect(puts).toHaveLength(1)); // the flush save for the other question
    expect(JSON.parse(String(puts[0].init?.body)).action).toBe('save-draft');
    await ready();
    fireEvent.change(box(), { target: { value: 'active words' } }); // arms the 1.5 s autosave
    await act(async () => { puts[0].resolve(new Response(JSON.stringify({ outcome: 'rate_limited' }), { status: 429 })); });
    await advance(10000);
    expect(puts).toHaveLength(1);
    expect(box()).toHaveValue('active words');
  });
});

const FAILURES: Array<{ name: string; fail: (put: Pending) => void }> = [
  { name: 'timeout', fail: () => undefined },
  { name: '503', fail: (put) => put.resolve(new Response(JSON.stringify({ outcome: 'unavailable' }), { status: 503 })) },
  { name: '500', fail: (put) => put.resolve(new Response(JSON.stringify({ outcome: 'error' }), { status: 500 })) },
  { name: 'thrown fetch', fail: (put) => put.reject(new TypeError('Failed to fetch')) },
];

describe('ReviewCommentsPanel: a failed save never drains a queued Submit', () => {
  for (const failure of FAILURES) {
    it(`recovery flush save fails (${failure.name}) + queued Submit: no submit PUT, honest status, text intact`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'restored words', null);
      const puts = stub();
      renderPanel();
      await waitFor(() => expect(puts).toHaveLength(1));
      fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
      expect(puts).toHaveLength(1); // queued behind the flush save
      await act(async () => { failure.fail(puts[0]); });
      await advance(REVIEW_SAVE_TIMEOUT_MS + 100);
      await advance(10000);
      expect(puts.filter((put) => JSON.parse(String(put.init?.body)).action === 'submit')).toHaveLength(0);
      expect(puts).toHaveLength(1);
      expect(screen.getByText(/^(Not saved to the review record|Could not save)./)).toBeTruthy();
      expect(box()).toHaveValue('restored words');
    });

    it(`ordinary autosave fails (${failure.name}) + queued Submit: no submit PUT, text intact`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const puts = stub();
      renderPanel();
      await ready();
      fireEvent.change(box(), { target: { value: 'my words' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      expect(puts).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
      expect(puts).toHaveLength(1);
      await act(async () => { failure.fail(puts[0]); });
      await advance(REVIEW_SAVE_TIMEOUT_MS + 100);
      expect(puts.filter((put) => JSON.parse(String(put.init?.body)).action === 'submit')).toHaveLength(0);
      expect(puts).toHaveLength(1);
      expect(box()).toHaveValue('my words');
    });
  }
});
