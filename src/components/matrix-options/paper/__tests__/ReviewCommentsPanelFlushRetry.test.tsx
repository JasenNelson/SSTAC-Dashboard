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
function stub(rows: unknown[] = []) {
  const puts: Pending[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows }), { status: 200 }));
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

describe('ReviewCommentsPanel: a 429 on an ordinary save cancels a debounce armed by a later edit', () => {
  it('autosave in flight + edit arms debounce + 429: no further PUT across 10 s, then a new edit re-arms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const puts = stub();
    renderPanel();
    await ready();
    await advance(100); // bootstrap settled: persistence is available before any edit, so no recovery flush
    fireEvent.change(box(), { target: { value: 'first words' } });
    await advance(2000);
    expect(puts).toHaveLength(1);
    fireEvent.change(box(), { target: { value: 'second words' } }); // arms the 1.5 s autosave
    await act(async () => { puts[0].resolve(new Response(JSON.stringify({ outcome: 'rate_limited' }), { status: 429 })); });
    await advance(10000);
    expect(puts).toHaveLength(1);
    expect(box()).toHaveValue('second words');
    fireEvent.change(box(), { target: { value: 'third words' } });
    await advance(2000);
    expect(puts).toHaveLength(2);
    expect(JSON.parse(String(puts[1].init?.body)).text).toBe('third words');
  });
});

const RETRY_FAILURES: Array<{ name: string; fail: (put: Pending) => void }> = [
  { name: 'timeout', fail: () => undefined },
  { name: '503', fail: (put) => put.resolve(new Response(JSON.stringify({ outcome: 'unavailable' }), { status: 503 })) },
  { name: '429', fail: (put) => put.resolve(new Response(JSON.stringify({ outcome: 'rate_limited' }), { status: 429 })) },
];

describe('ReviewCommentsPanel: the rowless-409 re-base retry of a flush save stays a flush save', () => {
  for (const failure of RETRY_FAILURES) {
    it(`flush save rowless 409 -> retry fails (${failure.name}) with a queued edit: no further PUT`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'restored words', 2);
      const row = { document_version: version, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: questions[0].id, draft_text: 'server words', submitted_text: null, revision: 2, submitted_revision: null, submitted_at: null, updated_at: null };
      const puts = stub([row]);
      renderPanel();
      await waitFor(() => expect(puts).toHaveLength(1));
      await act(async () => { puts[0].resolve(new Response(JSON.stringify({ outcome: 'stale_revision', row: null }), { status: 409 })); });
      await waitFor(() => expect(puts).toHaveLength(2)); // the re-base retry
      expect(JSON.parse(String(puts[1].init?.body)).expectedRevision).toBeNull();
      await ready();
      fireEvent.change(box(), { target: { value: 'edited during retry' } }); // queues behind the retry, arms the debounce
      expect(puts).toHaveLength(2);
      await act(async () => { failure.fail(puts[1]); });
      await advance(REVIEW_SAVE_TIMEOUT_MS + 100);
      await advance(10000);
      expect(puts).toHaveLength(2);
      expect(box()).toHaveValue('edited during retry');
    });
  }
});
