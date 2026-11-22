import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react';

import { R2GuidedReview } from '../R2GuidedReview';
import { GUIDED_DRAFT_CLOSED_GRACE_MS, GUIDED_DRAFT_HEARTBEAT_MS, GUIDED_INSTANCE_PREFIX, createGuidedDraftSession } from '@/lib/matrix-options/paper/guided-r2-local-drafts';
import { getGuidedR2Manifest } from '@/lib/matrix-options/paper/guided-r2-manifest';

// Browser lifecycle of the recovery copies: a page restored from the back/forward cache re-opens its
// liveness, re-owns its unsaved drafts and refreshes the saved state before edits or saves resume;
// adoption is retried on the heartbeat so a closed tab's copy is recovered after the grace period;
// and adoption never replaces a target the page is editing.
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
const target = { userKey, ...ids, targetKind: 'section-comment' as const, targetId: 'sec-phase2-3' };
const recoveryPrefix = ['mtwg-guided-r2-draft-v2', userKey, ids.documentVersion, ids.guidedManifestSha256, ids.reviewManifestSha256, 'section-comment', 'sec-phase2-3'].join(':');
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));
let stateGate: Promise<void> | null = null;
const puts: unknown[] = [];
const stateCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/state?')).length;

beforeEach(() => {
  fetchMock.mockReset(); puts.length = 0; stateGate = null;
  vi.stubGlobal('fetch', fetchMock); window.localStorage.clear();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes('/state?')) { if (stateGate) await stateGate; return json({ ...ids, mode: 'writable', userKey, entries: [], completion: null }); }
    if (url.includes('/feedback?')) return json({ guidedManifestSha256: manifest.guidedManifestSha256, reviewManifestSha256: manifest.reviewManifestSha256, items: [] });
    if (url.includes('/targets/')) { puts.push(JSON.parse(String(init?.body))); return json({ outcome: 'stale_revision' }, 409); }
    throw new Error(`unexpected request ${url}`);
  });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });

const tabSession = () => { const s = new Map<string, string>(); return { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => { s.set(k, v); } }; };
async function openTab() {
  const rendered = render(<R2GuidedReview {...props} recoverySessionStorage={tabSession()} />);
  const tab = within(rendered.container);
  await tab.findAllByRole('radio', { name: 'Sound as proposed' });
  const field = () => rendered.container.querySelector<HTMLTextAreaElement>('textarea[id="desktop-sec-phase2-3"]')!;
  const save = () => within(field().closest('section')!).getByRole('button', { name: 'Save' });
  return { ...rendered, tab, field, save };
}
const records = () => {
  const out: Array<{ key: string; text: string }> = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)!;
    if (key.startsWith(`${recoveryPrefix}:`)) out.push({ key, text: JSON.parse(window.localStorage.getItem(key)!).text });
  }
  return out;
};
const instanceRecords = () => {
  const out: Record<string, { at: number; closed: boolean }> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)!;
    if (key.startsWith(`${GUIDED_INSTANCE_PREFIX}:`)) out[key.slice(GUIDED_INSTANCE_PREFIX.length + 1)] = JSON.parse(window.localStorage.getItem(key)!);
  }
  return out;
};
const pageshow = (persisted: boolean) => { const event = new Event('pageshow'); Object.defineProperty(event, 'persisted', { value: persisted }); window.dispatchEvent(event); };
/** A recovery copy left by another (closed) page instance, aged past the grace period on demand. */
function closedInstanceCopy(text: string, baseRevision = 0) {
  const other = createGuidedDraftSession({ local: window.localStorage, session: tabSession(), newId: () => 'ffffffffffffffff' });
  other.write(target, { choiceId: null, rationale: '', text }, baseRevision);
  other.close();
  return {
    age: () => window.localStorage.setItem(`${GUIDED_INSTANCE_PREFIX}:ffffffffffffffff`, JSON.stringify({ at: Date.now() - GUIDED_DRAFT_CLOSED_GRACE_MS - 1000, closed: true })),
    key: `${recoveryPrefix}:ffffffffffffffff`,
  };
}

it('BFCache restore: liveness reopens, the unsaved draft is re-owned and the state refreshed before edits or saves resume', async () => {
  const page = await openTab();
  fireEvent.change(page.field(), { target: { value: 'Unsaved before leaving' } });
  const [own] = records();
  const instance = own.key.split(':').at(-1)!;
  act(() => { window.dispatchEvent(new Event('pagehide')); });
  expect(instanceRecords()[instance].closed).toBe(true);
  // While the page sat in the cache, another tab adopted (moved) this instance's copy.
  window.localStorage.removeItem(own.key);
  let release!: () => void;
  stateGate = new Promise<void>((resolve) => { release = resolve; });
  const before = stateCalls();
  act(() => { pageshow(true); });
  expect(instanceRecords()[instance].closed).toBe(false);
  expect(records()).toEqual([{ key: own.key, text: 'Unsaved before leaving' }]);
  await waitFor(() => expect(stateCalls()).toBe(before + 1));
  // Until the refresh completes, saves and edits are held.
  expect(page.save()).toBeDisabled();
  expect(page.tab.getByText(/Reconnecting this restored page/)).toBeInTheDocument();
  fireEvent.change(page.field(), { target: { value: 'Typed during reconnect' } });
  expect(page.field().value).toBe('Unsaved before leaving');
  expect(puts).toEqual([]);
  await act(async () => { release(); });
  await waitFor(() => expect(page.save()).not.toBeDisabled());
  expect(page.field().value).toBe('Unsaved before leaving');
  fireEvent.change(page.field(), { target: { value: 'Edited after reconnect' } });
  expect(page.field().value).toBe('Edited after reconnect');
  page.unmount();
});

it('two-sided: a pageshow that is not a cache restore changes nothing', async () => {
  const page = await openTab();
  fireEvent.change(page.field(), { target: { value: 'Draft' } });
  const before = stateCalls();
  act(() => { pageshow(false); });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(stateCalls()).toBe(before);
  expect(page.save()).not.toBeDisabled();
  page.unmount();
});

// The 15-second grace period is measured on a controlled clock (Date is faked with the heartbeat
// timers): "within the grace period at mount" holds however long the render takes, and the grace
// period passes only when the test ages the copy and advances one heartbeat.
const CONTROLLED_CLOCK = { toFake: ['setInterval', 'clearInterval', 'Date'] as Array<'setInterval' | 'clearInterval' | 'Date'>, now: new Date('2026-11-21T00:00:00.000Z') };

it('adoption retry: a closed tab\'s copy is recovered on a later heartbeat once its grace period passed', async () => {
  vi.useFakeTimers(CONTROLLED_CLOCK);
  const copy = closedInstanceCopy('From the closed tab');
  const page = await openTab();
  // Within the grace period the copy is not taken at mount.
  expect(page.field().value).toBe('');
  expect(window.localStorage.getItem(copy.key)).not.toBeNull();
  copy.age();
  await act(async () => { vi.advanceTimersByTime(GUIDED_DRAFT_HEARTBEAT_MS); });
  await waitFor(() => expect(page.field().value).toBe('From the closed tab'));
  expect(page.tab.getByText('Unsaved local changes recovered. Save each item before finishing.')).toBeInTheDocument();
  expect(window.localStorage.getItem(copy.key)).toBeNull();
  page.unmount();
});

it('dirty-state refusal: a retry never replaces the target this page is editing, and keeps the other copy', async () => {
  vi.useFakeTimers(CONTROLLED_CLOCK);
  const copy = closedInstanceCopy('From the closed tab');
  const page = await openTab();
  // This page's own recovery write fails: the in-memory edit has no record of its own.
  const storage = window.localStorage;
  const setItem = storage.setItem.bind(storage);
  const spy = vi.spyOn(storage, 'setItem').mockImplementation((key: string, value: string) => {
    if (key.startsWith(`${recoveryPrefix}:`) && !key.endsWith('ffffffffffffffff')) throw new Error('QuotaExceededError');
    return setItem(key, value);
  });
  fireEvent.change(page.field(), { target: { value: 'Typed in this page' } });
  spy.mockRestore();
  copy.age();
  await act(async () => { vi.advanceTimersByTime(GUIDED_DRAFT_HEARTBEAT_MS); });
  expect(page.field().value).toBe('Typed in this page');
  expect(window.localStorage.getItem(copy.key)).toContain('From the closed tab');
  expect(records().map((record) => record.text)).toEqual(['From the closed tab']);
  page.unmount();
});
