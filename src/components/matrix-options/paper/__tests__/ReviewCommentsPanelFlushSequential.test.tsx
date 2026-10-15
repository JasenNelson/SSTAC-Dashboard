import { createRef } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';
import { getReviewerGuideBinding, getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';

import { ReviewCommentsPanel } from '../ReviewCommentsPanel';

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) } }),
}));

const version = V0991_PAPER_VERSION;
const guide = getReviewerGuideContract();
const ids = getReviewerGuideBinding(V0991_PAPER_VERSION).questions;
const questions = guide.questions.slice(0, 2).map((question, index) => ({ ...question, id: ids[index].id, number: ids[index].number }));
const MANIFEST = 'a'.repeat(64);

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Put = { questionId: string; resolve: (response: Response) => void; reject: (error: unknown) => void; settled: boolean };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const serverRow = (revision: number, text: string) => ({ document_version: version, manifest_sha256: MANIFEST, cohort_id: 'categories', question_id: questions[0].id, draft_text: text, submitted_text: null, revision, submitted_revision: null, submitted_at: null, updated_at: null });

/** PUTs hang until the test settles them; records order and the highest number open at once. */
function stub() {
  const puts: Put[] = [];
  const stats = { open: 0, maxOpen: 0 };
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('?documentVersion=')) {
      return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [serverRow(2, 'server words')] }), { status: 200 }));
    }
    return new Promise<Response>((resolve, reject) => {
      const put: Put = { questionId: decodeURIComponent(url.split('/').pop() ?? ''), settled: false, resolve: () => undefined, reject: () => undefined };
      const done = () => { if (!put.settled) { put.settled = true; stats.open -= 1; } };
      put.resolve = (response) => { done(); resolve(response); };
      put.reject = (error) => { done(); reject(error); };
      stats.open += 1;
      stats.maxOpen = Math.max(stats.maxOpen, stats.open);
      puts.push(put);
      init?.signal?.addEventListener('abort', () => put.reject(new DOMException('aborted', 'AbortError')));
    });
  }));
  return { puts, stats };
}

const panel = () => (
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
  />
);
const seedTwoDrafts = () => {
  writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'first words', 2);
  writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[1].id, userKey: 'user-a' }, 'second words', 1);
};
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 60)); }); };
const rowless = () => json(409, { outcome: 'stale_revision', row: null });
const forQuestion = (puts: Put[], id: string) => puts.filter((put) => put.questionId === id);

/** Starts the flush, answers Q1's first PUT with a rowless 409 and returns once the retry is open. */
async function reachRetry() {
  seedTwoDrafts();
  const harness = stub();
  const view = render(panel());
  await waitFor(() => expect(harness.puts).toHaveLength(1));
  expect(harness.puts[0].questionId).toBe(questions[0].id);
  await act(async () => { harness.puts[0].resolve(rowless()); });
  await waitFor(() => expect(harness.puts).toHaveLength(2)); // the re-base retry of Q1
  expect(harness.puts[1].questionId).toBe(questions[0].id);
  return { ...harness, view };
}

describe('ReviewCommentsPanel: the recovery flush advances only when a question is fully idle', () => {
  it('(a) retry 503: Q2 is never sent', async () => {
    const { puts } = await reachRetry();
    await settle();
    expect(forQuestion(puts, questions[1].id)).toHaveLength(0); // not while the retry is still open
    await act(async () => { puts[1].resolve(json(503, { outcome: 'unavailable' })); });
    await settle();
    expect(forQuestion(puts, questions[1].id)).toHaveLength(0);
    expect(puts).toHaveLength(2);
  });

  it('(b) retry 429: Q2 is never sent', async () => {
    const { puts } = await reachRetry();
    await act(async () => { puts[1].resolve(json(429, { outcome: 'rate_limited' })); });
    await settle();
    expect(forQuestion(puts, questions[1].id)).toHaveLength(0);
    expect(puts).toHaveLength(2);
  });

  it('(c) retry ok: Q2 is sent only after the retry settled, one request at a time', async () => {
    const { puts, stats } = await reachRetry();
    await settle();
    expect(puts).toHaveLength(2); // Q2 waits while the retry is open
    await act(async () => { puts[1].resolve(json(200, { outcome: 'ok', row: serverRow(3, 'first words') })); });
    await waitFor(() => expect(puts).toHaveLength(3));
    expect(puts[2].questionId).toBe(questions[1].id);
    expect(puts[1].settled).toBe(true);
    expect(stats.maxOpen).toBe(1);
    await act(async () => { puts[2].resolve(json(503, { outcome: 'unavailable' })); });
    await settle();
  });

  it('(d) unmount during the retry: nothing hangs and no further PUT is sent', async () => {
    const { puts, view } = await reachRetry();
    view.unmount();
    await settle();
    expect(puts).toHaveLength(2);
    expect(forQuestion(puts, questions[1].id)).toHaveLength(0);
  });
});
