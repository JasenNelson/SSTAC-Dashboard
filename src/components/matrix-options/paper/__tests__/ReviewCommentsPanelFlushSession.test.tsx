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
const OTHER_MANIFEST = 'b'.repeat(64);

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Pending = { init?: RequestInit; resolve: (response: Response) => void; reject: (error: unknown) => void };
const serverRow = (revision: number, text: string) => ({ document_version: version, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: questions[0].id, draft_text: text, submitted_text: null, revision, submitted_revision: null, submitted_at: null, updated_at: null });

/** Bootstrap GETs answer from `bootstraps` (the last repeats); PUTs hang until the test settles them. */
function stub(bootstraps: ReadonlyArray<Record<string, unknown>>) {
  const puts: Pending[] = [];
  let gets = 0;
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('?documentVersion=')) {
      const payload = bootstraps[Math.min(gets, bootstraps.length - 1)];
      gets += 1;
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    }
    return new Promise<Response>((resolve, reject) => {
      puts.push({ init, resolve, reject });
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  }));
  return puts;
}
const AVAILABLE = (rows: unknown[] = []) => ({ persistence: 'available', userKey: 'user-a', rows });
function panel(manifestSha256 = MANIFEST) {
  return (
    <ReviewCommentsPanel
      documentVersion={version}
      questions={questions}
      question={questions[0]}
      responseRef={createRef<HTMLElement>()}
      onSelectQuestion={vi.fn()}
      onPreviousQuestion={vi.fn()}
      onNextQuestion={vi.fn()}
      manifestSha256={manifestSha256}
      cohortId="categories"
    />
  );
}
const box = () => screen.getByRole('textbox', { name: 'Your response' });
const ready = () => waitFor(() => expect(box()).not.toHaveAttribute('readonly'));
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const seedRestoredDraft = () => writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'restored words', 2);

/** Every outcome that is not a success. After any of them no further PUT may be sent. */
const FAILURES: Array<{ name: string; fail: (put: Pending) => void | Promise<void> }> = [
  { name: 'timeout', fail: () => advance(REVIEW_SAVE_TIMEOUT_MS + 100) },
  { name: 'network error', fail: (put) => put.reject(new TypeError('network lost')) },
  { name: '500', fail: (put) => put.resolve(json(500, { outcome: 'error' })) },
  { name: '503', fail: (put) => put.resolve(json(503, { outcome: 'unavailable' })) },
  { name: '429', fail: (put) => put.resolve(json(429, { outcome: 'rate_limited' })) },
  { name: '401', fail: (put) => put.resolve(json(401, { outcome: 'unauthenticated' })) },
  { name: 'unknown_identity', fail: (put) => put.resolve(json(403, { outcome: 'unknown_identity' })) },
  { name: 'stale_manifest', fail: (put) => put.resolve(json(409, { outcome: 'stale_manifest' })) },
  { name: 'identity_changed', fail: (put) => put.resolve(json(409, { outcome: 'identity_changed' })) },
  { name: 'conflict (409 with a different row)', fail: (put) => put.resolve(json(409, { outcome: 'stale_revision', row: serverRow(9, 'someone else') })) },
];
const failNow = async (failure: (typeof FAILURES)[number], put: Pending) => { await act(async () => { await failure.fail(put); }); };
const quiet = async (puts: Pending[], count: number) => {
  await advance(REVIEW_SAVE_TIMEOUT_MS + 100);
  await advance(10000);
  expect(puts).toHaveLength(count);
};

describe('ReviewCommentsPanel: one panel-level flush session stops every later PUT', () => {
  it('codex r4: a flush save queued behind an in-flight save times out / 503 with a later edit armed -> no further PUT', async () => {
    for (const failure of FAILURES.filter((candidate) => ['timeout', '503'].includes(candidate.name))) {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedRestoredDraft();
      const puts = stub([AVAILABLE(), { persistence: 'unavailable', userKey: 'user-a', rows: [] }, AVAILABLE()]);
      const view = render(panel());
      await ready();
      await advance(100);
      // Ordinary autosave goes in flight; a newer edit keeps the draft different from it.
      fireEvent.change(box(), { target: { value: 'ordinary words' } });
      await advance(2000);
      expect(puts.length).toBeGreaterThanOrEqual(1);
      const base = puts.length;
      fireEvent.change(box(), { target: { value: 'ordinary words, newer' } });
      // Availability is lost and comes back: the recovery flush queues behind the in-flight save.
      view.rerender(panel(OTHER_MANIFEST));
      await waitFor(() => expect(screen.getByTestId('review-persistence-retry')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('review-persistence-retry'));
      await advance(100);
      fireEvent.change(box(), { target: { value: 'ordinary words, newest' } }); // arms the debounce
      await act(async () => { puts[base - 1].resolve(json(200, { outcome: 'ok', row: serverRow(3, 'ordinary words') })); });
      await advance(100);
      const afterOrdinary = puts.length;
      if (afterOrdinary > base) {
        await failNow(failure, puts[afterOrdinary - 1]); // the queued flush save fails
        await quiet(puts, afterOrdinary);
      }
      view.unmount();
      vi.useRealTimers();
      window.localStorage.clear();
      vi.unstubAllGlobals();
    }
  });

  for (const failure of FAILURES) {
    it(`flush save in flight fails (${failure.name}) with a later edit armed: no PUT after the stop`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedRestoredDraft();
      const puts = stub([AVAILABLE([serverRow(2, 'server words')])]);
      render(panel());
      await waitFor(() => expect(puts).toHaveLength(1)); // the recovery flush save
      await ready();
      fireEvent.change(box(), { target: { value: 'edited during flush' } }); // queues behind it and arms the debounce
      expect(puts).toHaveLength(1);
      await failNow(failure, puts[0]);
      await quiet(puts, 1);
    });

    it(`flush save queued behind an ordinary save: the ordinary save fails (${failure.name}) -> no PUT after the stop`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedRestoredDraft();
      const puts = stub([AVAILABLE([serverRow(2, 'server words')])]);
      render(panel());
      await waitFor(() => expect(puts).toHaveLength(1));
      await ready();
      // The flush save (puts[0]) is the save ahead of everything else: it succeeds, so the
      // ordinary autosave of a later edit is what is in flight while the session still lives.
      fireEvent.change(box(), { target: { value: 'edited during flush' } });
      await act(async () => { puts[0].resolve(json(200, { outcome: 'ok', row: serverRow(3, 'restored words') })); });
      await waitFor(() => expect(puts).toHaveLength(2)); // the queued save of the newer text
      fireEvent.change(box(), { target: { value: 'edited again' } }); // arms the debounce
      await failNow(failure, puts[1]);
      await quiet(puts, 2);
    });

    it(`retry of a flush save fails (${failure.name}) with a queued edit: no PUT after the stop`, async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      seedRestoredDraft();
      const puts = stub([AVAILABLE([serverRow(2, 'server words')])]);
      render(panel());
      await waitFor(() => expect(puts).toHaveLength(1));
      await act(async () => { puts[0].resolve(json(409, { outcome: 'stale_revision', row: null })); });
      await waitFor(() => expect(puts).toHaveLength(2)); // the re-base retry
      await ready();
      fireEvent.change(box(), { target: { value: 'edited during retry' } });
      await failNow(failure, puts[1]);
      await quiet(puts, 2);
    });
  }
});
