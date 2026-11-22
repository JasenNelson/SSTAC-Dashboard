import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';

import { R2GuidedReview } from '../R2GuidedReview';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';

// Two tabs of the same reviewer both edit one target before either saves. Each tab has its own
// sessionStorage (passed as the test seam) and each page instance keeps its own recovery record in
// the shared localStorage, so the first save never touches the second tab's copy, the second tab's
// stale revision stays blocked until the reviewer decides, and each tab's reload recovers its own text.
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
const recoveryPrefix = ['mtwg-guided-r2-draft-v2', userKey, ids.documentVersion, ids.guidedManifestSha256, ids.reviewManifestSha256, 'section-comment', 'sec-phase2-3'].join(':');
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const entry = (id: string, revision: number, text: string) => ({
  user_id: userKey, document_version: manifest.documentVersion, guided_manifest_sha256: manifest.guidedManifestSha256, review_manifest_sha256: manifest.reviewManifestSha256,
  target_kind: 'section-comment', target_id: id, revision, draft_choice_id: null, draft_rationale: null, draft_text: text,
  submitted_choice_id: null, submitted_rationale: null, submitted_text: null, submitted_revision: null, submitted_at: null, updated_at: '2026-11-20T00:00:00Z',
});

/** One server shared by both tabs; it enforces expected revisions exactly like the save RPC. */
function sharedServer() {
  const rows = new Map<string, ReturnType<typeof entry>>();
  const puts: Array<{ expectedRevision: number; text: string; status: number }> = [];
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes('/state?')) return json({ ...ids, mode: 'writable', userKey, entries: Array.from(rows.values()), completion: null });
    if (url.includes('/feedback?')) return json({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] });
    if (!url.includes('/targets/')) throw new Error(`unexpected request ${url}`);
    const body = JSON.parse(String(init?.body));
    const id = decodeURIComponent(url.split('/targets/')[1]);
    const current = rows.get(id)?.revision ?? 0;
    if (body.expectedRevision !== current) {
      puts.push({ expectedRevision: body.expectedRevision, text: body.draft.text, status: 409 });
      return json({ outcome: 'stale_revision' }, 409);
    }
    const row = entry(id, current + 1, body.draft.text);
    rows.set(id, row);
    puts.push({ expectedRevision: body.expectedRevision, text: body.draft.text, status: 200 });
    return json({ outcome: 'ok', guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, row });
  });
  return { rows, puts };
}

/** All recovery records for the shared target, by page instance. */
const recoveryRecords = () => {
  const out: Array<{ instance: string; baseRevision: number; text: string }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const name = window.localStorage.key(index);
    if (name?.startsWith(`${recoveryPrefix}:`)) { const value = JSON.parse(window.localStorage.getItem(name)!); out.push({ instance: name.split(':').at(-1)!, baseRevision: value.baseRevision, text: value.text }); }
  }
  return out;
};
const tabSession = () => { const s = new Map<string, string>(); return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => { s.set(k, v); } }; };

beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); window.localStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });

async function openTab(session = tabSession()) {
  const rendered = render(<R2GuidedReview {...props} recoverySessionStorage={session} />);
  const { container } = rendered;
  const tab = within(container);
  await tab.findAllByRole('radio', { name: 'Sound as proposed' });
  // Two tabs in one document repeat element ids; jsdom's '#id' lookup is document-wide, so match the
  // attribute inside this tab's container instead.
  const field = () => container.querySelector<HTMLTextAreaElement>('textarea[id="desktop-sec-phase2-3"]')!;
  const fieldSection = () => within(field().closest('section')!);
  return { container, tab, field, fieldSection, session, unmount: rendered.unmount };
}
type Tab = Awaited<ReturnType<typeof openTab>>;

/** Both tabs edit the same target before either saves; tab A saves first; tab B then saves and gets 409. */
async function bothEditThenSecondConflicts() {
  const fake = sharedServer();
  const a = await openTab();
  const b = await openTab();
  fireEvent.change(a.field(), { target: { value: 'Text from tab A' } });
  fireEvent.change(b.field(), { target: { value: 'Text from tab B' } });
  expect(recoveryRecords().map((record) => record.text).sort()).toEqual(['Text from tab A', 'Text from tab B']);
  fireEvent.click(a.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(a.tab.getByText('Saved.')).toBeInTheDocument());
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 1, draft_text: 'Text from tab A' });
  // Tab A's save removed only its own record; tab B's copy (base 0) is intact.
  expect(recoveryRecords()).toEqual([expect.objectContaining({ baseRevision: 0, text: 'Text from tab B' })]);
  fireEvent.click(b.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(b.tab.getByText('This item changed elsewhere. Your text remains here; review it before retrying.')).toBeInTheDocument());
  await waitFor(() => expect(b.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument());
  expect(b.fieldSection().getByText('Saved response: Text from tab A')).toBeInTheDocument();
  expect(b.field().value).toBe('Text from tab B');
  return { fake, a, b };
}

async function saveAllStaysBlocked(fake: ReturnType<typeof sharedServer>, b: Tab) {
  const putsBefore = fake.puts.length;
  fireEvent.click(within(b.container.querySelector('[data-testid="r2-save-all-rail"]')!).getByRole('button', { name: 'Save all unsaved changes (1)' }));
  await waitFor(() => expect(b.tab.getByText('1 item needs a conflict decision before it can be saved.')).toBeInTheDocument());
  expect(fake.puts).toHaveLength(putsBefore);
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 1, draft_text: 'Text from tab A' });
  expect(b.fieldSection().getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(b.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument();
}

it('keeps the second tab conflicted through Save all, then overwrites only after Keep my local response', async () => {
  const { fake, b } = await bothEditThenSecondConflicts();
  await saveAllStaysBlocked(fake, b);
  fireEvent.click(b.fieldSection().getByRole('button', { name: 'Keep my local response' }));
  await waitFor(() => expect(b.fieldSection().queryByText('Conflict - compare with saved response before saving')).not.toBeInTheDocument());
  fireEvent.click(b.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(b.tab.getByText('Saved.')).toBeInTheDocument());
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 2, draft_text: 'Text from tab B' });
  expect(fake.puts.map((put) => [put.expectedRevision, put.status])).toEqual([[0, 200], [0, 409], [1, 200]]);
  expect(recoveryRecords()).toEqual([]);
});

it('takes the saved response on Use saved response, with no write and no overwrite', async () => {
  const { fake, b } = await bothEditThenSecondConflicts();
  await saveAllStaysBlocked(fake, b);
  fireEvent.click(b.fieldSection().getByRole('button', { name: 'Use saved response' }));
  await waitFor(() => expect(b.field().value).toBe('Text from tab A'));
  expect(b.fieldSection().queryByText('Conflict - compare with saved response before saving')).not.toBeInTheDocument();
  expect(b.fieldSection().getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(fake.puts.map((put) => [put.expectedRevision, put.status])).toEqual([[0, 200], [0, 409]]);
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 1, draft_text: 'Text from tab A' });
  expect(recoveryRecords()).toEqual([]);
});

it('each tab reloading recovers its own text and base revision, and a stale base stays a conflict', async () => {
  const fake = sharedServer();
  const a = await openTab();
  const b = await openTab();
  fireEvent.change(a.field(), { target: { value: 'Unsaved in tab A' } });
  fireEvent.change(b.field(), { target: { value: 'Unsaved in tab B' } });
  // Another device saves the target, then both tabs reload.
  fake.rows.set('sec-phase2-3', entry('sec-phase2-3', 1, 'Saved on another device'));
  act(() => { a.unmount(); b.unmount(); });
  const reloadedB = await openTab(b.session);
  const reloadedA = await openTab(a.session);
  await waitFor(() => expect(reloadedA.field().value).toBe('Unsaved in tab A'));
  await waitFor(() => expect(reloadedB.field().value).toBe('Unsaved in tab B'));
  // Both drafts were based on revision 0; the server is at 1: both are blocked until a decision.
  for (const tab of [reloadedA, reloadedB]) {
    await waitFor(() => expect(tab.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument());
    expect(tab.fieldSection().getByRole('button', { name: 'Save' })).toBeDisabled();
  }
  expect(recoveryRecords().map((record) => [record.text, record.baseRevision]).sort()).toEqual([['Unsaved in tab A', 0], ['Unsaved in tab B', 0]]);
  expect(fake.puts).toHaveLength(0);
});

it('keeps the conflict in memory when localStorage writes fail and records are removed', async () => {
  // src/test/setup.ts installs a plain-object localStorage, so the write is failed on that object.
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  const fake = sharedServer();
  const a = await openTab();
  const b = await openTab();
  fireEvent.change(a.field(), { target: { value: 'Text from tab A' } });
  fireEvent.change(b.field(), { target: { value: 'Text from tab B' } });
  expect(b.tab.getByText('Unsaved changes. This browser cannot keep a recovery copy; save before leaving.')).toBeInTheDocument();
  expect(recoveryRecords()).toEqual([]);
  fireEvent.click(a.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(a.tab.getByText('Saved.')).toBeInTheDocument());
  // The 409 refresh finds no recovery record at all; the in-memory base still marks the conflict.
  fireEvent.click(b.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(b.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument());
  window.localStorage.clear();
  await saveAllStaysBlocked(fake, b);
  expect(b.field().value).toBe('Text from tab B');
});

it('an unrelated refresh never clears an unresolved conflict', async () => {
  const { fake, b } = await bothEditThenSecondConflicts();
  // Another device saves a different target; tab B edits it too and its save gets a 409, which
  // refreshes the whole state. The first conflict must still be blocked afterwards.
  fake.rows.set('structure-approach', { ...entry('structure-approach', 1, ''), target_kind: 'choice-prompt', draft_text: null, draft_choice_id: 'refine' } as unknown as ReturnType<typeof entry>);
  fireEvent.click(b.tab.getAllByRole('radio', { name: 'Sound as proposed' })[0]);
  const structure = b.tab.getAllByRole('radio', { name: 'Sound as proposed' })[0].closest('section')!;
  fireEvent.click(within(structure as HTMLElement).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(within(structure as HTMLElement).getByText('Conflict - compare with saved response before saving')).toBeInTheDocument());
  expect(b.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument();
  expect(b.fieldSection().getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 1, draft_text: 'Text from tab A' });
});

it('a refresh after another tab saved never moves a dirty draft onto the newer revision', async () => {
  const fake = sharedServer();
  const a = await openTab();
  const b = await openTab();
  fireEvent.change(b.field(), { target: { value: 'Text from tab B' } });
  fireEvent.change(a.field(), { target: { value: 'Text from tab A' } });
  fireEvent.click(a.fieldSection().getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(a.tab.getByText('Saved.')).toBeInTheDocument());
  fireEvent.change(b.field(), { target: { value: 'Text from tab B, continued' } });
  fireEvent.click(within(b.container.querySelector('[data-testid="r2-save-all-rail"]')!).getByRole('button', { name: 'Save all unsaved changes (1)' }));
  await waitFor(() => expect(b.tab.getByText(/Stopped: an item changed elsewhere\./)).toBeInTheDocument());
  await waitFor(() => expect(b.fieldSection().getByText('Conflict - compare with saved response before saving')).toBeInTheDocument());
  expect(fake.puts.map((put) => [put.expectedRevision, put.status])).toEqual([[0, 200], [0, 409]]);
  expect(fake.rows.get('sec-phase2-3')).toMatchObject({ revision: 1, draft_text: 'Text from tab A' });
  expect(recoveryRecords()).toEqual([expect.objectContaining({ baseRevision: 0, text: 'Text from tab B, continued' })]);
});
