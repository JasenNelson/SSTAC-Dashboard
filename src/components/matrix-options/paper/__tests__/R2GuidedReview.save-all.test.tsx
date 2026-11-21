import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { R2GuidedReview } from '../R2GuidedReview';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';

vi.mock('server-only', () => ({}));
const manifest = getGuidedR2Manifest();
const props = {
  documentVersion: manifest.documentVersion,
  guidedManifestSha256: manifest.guidedManifestSha256,
  reviewManifestSha256: manifest.reviewManifestSha256,
  outline: [{ anchor: 'sec-phase2-3', label: '3. Proposed framework' }],
  paper: <article><section id="sec-phase2-3"><h2>Proposed framework</h2></section></article>,
};
const userKey = '11111111-1111-4111-8111-111111111111';
const ids = { documentVersion: manifest.documentVersion, guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256 };
const fetchMock = vi.fn();
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Promise.resolve(new Response(JSON.stringify(body), { status, headers }));
const entry = (kind: string, id: string, revision: number, draft: Record<string, unknown>) => ({
  user_id: userKey, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
  target_kind: kind, target_id: id, revision, draft_choice_id: null, draft_rationale: null, draft_text: null,
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null, submitted_revision: null, submitted_at: null, updated_at: '2026-11-20T00:00:00Z', ...draft,
});

/** A small server double: per-target revisions, an optional queue of forced replies for target writes. */
function server(options: { forced?: Array<{ status: number; body: unknown; headers?: Record<string, string> }>; stateEntries?: () => unknown[]; stateMode?: () => 'writable' | 'read-only'; completeOutcome?: 'ok' | 'noop_already_completed' } = {}) {
  const forced = [...(options.forced ?? [])];
  const rows = new Map<string, ReturnType<typeof entry>>();
  const successfulSaves: string[] = [];
  const completes: Array<Record<string, unknown>> = [];
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/state?')) return json({ ...ids, mode: options.stateMode ? options.stateMode() : 'writable', userKey, entries: options.stateEntries ? options.stateEntries() : Array.from(rows.values()), completion: null });
    if (url.includes('/feedback?')) return json({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] });
    const body = JSON.parse(String(init?.body));
    if (url.includes('/targets/')) {
      const next = forced.shift();
      if (next) return json(next.body, next.status, next.headers);
      const id = decodeURIComponent(url.split('/targets/')[1]);
      const key = `${body.targetKind}:${id}`;
      const row = entry(body.targetKind, id, body.expectedRevision + 1, { draft_choice_id: body.draft.choiceId ?? null, draft_rationale: body.draft.rationale ?? null, draft_text: body.draft.text ?? null });
      rows.set(key, row);
      successfulSaves.push(key);
      return json({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, row });
    }
    completes.push(body);
    return json({ outcome: options.completeOutcome ?? 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, entries: Array.from(rows.values()),
      completion: { user_id: userKey, ...{ document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256 }, revision: body.expectedCompletionRevision + 1, submitted_set_digest: body.draftSetDigest, submitted_at: '2026-11-20T00:00:00Z' } });
  });
  return { successfulSaves, completes };
}

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

async function editTwoTargets() {
  await screen.findAllByRole('radio', { name: 'Sound as proposed' });
  fireEvent.click(screen.getAllByRole('radio', { name: 'Sound as proposed' })[0]);
  fireEvent.change(document.getElementById('desktop-sec-phase2-3')!, { target: { value: 'Section note' } });
}

it('Save all and finish saves each dirty target once, then finishes with the saved set', async () => {
  const fake = server();
  render(<R2GuidedReview {...props} />);
  await editTwoTargets();
  expect(screen.getAllByRole('button', { name: 'Save all unsaved changes (2)' }).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Go to a focus area'), { target: { value: 'my-review' } });
  expect(screen.getByRole('button', { name: 'Finish review' })).toBeDisabled();
  fireEvent.click(within(screen.getByTestId('r2-save-all-review')).getByRole('button', { name: 'Save all and finish' }));
  await waitFor(() => expect(screen.getByText('Saved 2 of 2. Review finished.')).toBeInTheDocument());
  expect(fake.successfulSaves).toEqual(['choice-prompt:structure-approach', 'section-comment:sec-phase2-3']);
  expect(fake.completes).toHaveLength(1);
  expect(fake.completes[0]).toMatchObject({ expectedUserId: userKey, expectedCompletionRevision: 0 });
  expect(screen.getByText(/^Last finished /)).toBeInTheDocument();
});

it('waits for Retry-After on a 429, shows the wait, then resumes without resending saved targets', async () => {
  const fake = server({ forced: [{ status: 429, body: { outcome: 'rate_limited' }, headers: { 'Retry-After': '1' } }] });
  render(<R2GuidedReview {...props} />);
  await editTwoTargets();
  fireEvent.click(within(screen.getAllByTestId('r2-save-all-rail')[0]).getByRole('button', { name: 'Save all unsaved changes (2)' }));
  expect((await screen.findAllByText(/Save limit reached - continuing in \ds with 2 remaining\./)).length).toBeGreaterThan(0);
  await waitFor(() => expect(screen.getByText('Saved 2 of 2. All changes are saved.')).toBeInTheDocument(), { timeout: 5000 });
  expect(fake.successfulSaves).toEqual(['choice-prompt:structure-approach', 'section-comment:sec-phase2-3']);
  expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/targets/'))).toHaveLength(3);
});

it('stops Save all at a conflict, keeps the text, and shows the saved choice by its label', async () => {
  let afterConflict = false;
  server({
    forced: [{ status: 409, body: { outcome: 'stale_revision' } }],
    stateEntries: () => afterConflict ? [entry('choice-prompt', 'structure-approach', 1, { draft_choice_id: 'refine', draft_rationale: 'Saved elsewhere' })] : [],
  });
  render(<R2GuidedReview {...props} />);
  await editTwoTargets();
  afterConflict = true;
  fireEvent.click(within(screen.getAllByTestId('r2-save-all-rail')[0]).getByRole('button', { name: 'Save all unsaved changes (2)' }));
  await waitFor(() => expect(screen.getByText(/^Saved 0 of 2\. Stopped: an item changed elsewhere\./)).toBeInTheDocument());
  await waitFor(() => expect(screen.getAllByText('Saved response: Needs refinement - Saved elsewhere').length).toBeGreaterThan(0));
  expect(screen.queryByText(/Saved response: refine/)).not.toBeInTheDocument();
  expect(document.getElementById('desktop-sec-phase2-3')).toHaveProperty('value', 'Section note');
});

it('shows the retry time when a single-field save is rate limited', async () => {
  server({ forced: [{ status: 429, body: { outcome: 'rate_limited' }, headers: { 'Retry-After': '60' } }] });
  render(<R2GuidedReview {...props} />);
  await editTwoTargets();
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  expect(await screen.findByText('Save limit reached. Wait about 61 seconds, then try again. Your text remains here.')).toBeInTheDocument();
});

it('offers no Save all controls while responses are not open', async () => {
  fetchMock.mockImplementation((url: string) => url.includes('/state?') ? json({ ...ids, mode: 'read-only', userKey, entries: [], completion: null })
    : json({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] }));
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  expect(await screen.findByText('Review responses are not open right now. The paper remains readable.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Save all/ })).not.toBeInTheDocument();
});

it('reports items that still need a conflict decision instead of claiming everything is saved', async () => {
  // A recovered local draft (left by a crashed page instance) whose base revision is behind the server is a conflict.
  const key = ['mtwg-guided-r2-draft-v2', userKey, ids.documentVersion, ids.guidedManifestSha256, ids.reviewManifestSha256, 'choice-prompt', 'structure-approach', '00000000000000aa'].join(':');
  window.localStorage.setItem(key, JSON.stringify({ baseRevision: 0, choiceId: 'sound', rationale: '', text: '', at: Date.now() - 11 * 60_000 }));
  server({ stateEntries: () => [entry('choice-prompt', 'structure-approach', 1, { draft_choice_id: 'refine' })] });
  render(<R2GuidedReview {...props} />);
  await screen.findAllByRole('radio', { name: 'Sound as proposed' });
  fireEvent.change(document.getElementById('desktop-sec-phase2-3')!, { target: { value: 'Section note' } });
  fireEvent.click(within(screen.getAllByTestId('r2-save-all-rail')[0]).getByRole('button', { name: 'Save all unsaved changes (2)' }));
  await waitFor(() => expect(screen.getByText('Saved 1 of 1. 1 item needs a conflict decision before it can be saved.')).toBeInTheDocument());
});

it('keeps the closed-release notice and turns read-only when a save is refused with 403', async () => {
  let closed = false;
  server({ forced: [{ status: 403, body: { outcome: 'release_read_only' } }], stateMode: () => (closed ? 'read-only' : 'writable') });
  render(<R2GuidedReview {...props} />);
  await editTwoTargets();
  closed = true;
  fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);
  await waitFor(() => expect(screen.getByText('Saving is currently closed. Your text remains here.')).toBeInTheDocument());
  expect(await screen.findByText('Review responses are not open right now. The paper remains readable.')).toBeInTheDocument();
  expect(screen.getByText('Saving is currently closed. Your text remains here.')).toBeInTheDocument();
  expect(document.getElementById('desktop-sec-phase2-3')).toHaveProperty('value', 'Section note');
});

it('says an unchanged review was already finished when Save all and finish has nothing to save', async () => {
  server({ completeOutcome: 'noop_already_completed' });
  render(<R2GuidedReview {...props} initialMode="my-review" />);
  fireEvent.click(await within(await screen.findByTestId('r2-save-all-review')).findByRole('button', { name: 'Save all and finish' }));
  await waitFor(() => expect(screen.getByText('This review was already finished with the same saved entries.')).toBeInTheDocument());
});
