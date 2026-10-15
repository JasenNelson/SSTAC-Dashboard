import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

type Pending = { init?: RequestInit; resolve: (response: Response) => void };
function stub() {
  const puts: Pending[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('?documentVersion=')) return Promise.resolve(new Response(JSON.stringify({ persistence: 'available', userKey: 'user-a', rows: [] }), { status: 200 }));
    return new Promise<Response>((resolve) => { puts.push({ init, resolve }); });
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

const STOPS: Array<{ name: string; status: number; body: Record<string, unknown> }> = [
  { name: '401', status: 401, body: { outcome: 'unauthenticated' } },
  { name: '429', status: 429, body: { outcome: 'rate_limited' } },
  { name: 'identity_changed', status: 409, body: { outcome: 'identity_changed' } },
  { name: 'unknown_identity', status: 409, body: { outcome: 'unknown_identity' } },
  { name: 'stale_manifest', status: 409, body: { outcome: 'stale_manifest' } },
];
const noMorePuts = async (puts: Pending[]) => {
  // Let every pending microtask / state flush run, then prove the queue was not drained.
  await new Promise((resolve) => setTimeout(resolve, 60));
  expect(puts).toHaveLength(1);
};

describe('ReviewCommentsPanel: a stop response drops the queued writes', () => {
  for (const stop of STOPS) {
    it(`ordinary autosave in flight + queued Submit + ${stop.name}: no further PUT, text intact`, async () => {
      const puts = stub();
      renderPanel();
      await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your response' })).not.toHaveAttribute('readonly'));
      const textarea = screen.getByRole('textbox', { name: 'Your response' });
      fireEvent.change(textarea, { target: { value: 'my words' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
      expect(puts).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
      expect(puts).toHaveLength(1); // queued
      await act(async () => { puts[0].resolve(new Response(JSON.stringify(stop.body), { status: stop.status })); });
      await noMorePuts(puts);
      expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('my words');
    });

    it(`recovery flush save in flight + queued Submit + ${stop.name}: no further PUT, text intact`, async () => {
      writeReviewLocalDraftEntry({ documentVersion: version, questionId: questions[0].id, userKey: 'user-a' }, 'restored words', null);
      const puts = stub();
      renderPanel();
      await waitFor(() => expect(puts).toHaveLength(1)); // the flush's save
      expect(JSON.parse(String(puts[0].init?.body)).action).toBe('save-draft');
      fireEvent.click(screen.getByRole('button', { name: 'Submit response' }));
      expect(puts).toHaveLength(1); // queued behind the flush save
      await act(async () => { puts[0].resolve(new Response(JSON.stringify(stop.body), { status: stop.status })); });
      await noMorePuts(puts);
      expect(screen.getByRole('textbox', { name: 'Your response' })).toHaveValue('restored words');
    });
  }
});
