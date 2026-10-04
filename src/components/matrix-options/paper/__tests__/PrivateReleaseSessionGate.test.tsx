import fs from 'node:fs';
import path from 'node:path';

import { act, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

interface AuthValue {
  session: { user?: { id?: string; is_anonymous?: boolean } | null } | null;
  isLoading: boolean;
  authUnverified: boolean;
  refreshSession: () => Promise<void>;
}

// The application's own auth state, as AuthContext hands it to every component. The gate
// reads it on every render, so a test changes it and re-renders.
const auth = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.current }));

import { PRIVATE_RELEASE_RESTORE_DEADLINE_MS, PRIVATE_RELEASE_SIGN_IN_PATH, PrivateReleaseSessionGate, privateReleaseReaderState } from '../PrivateReleaseSessionGate';

/*
 * The client session gate of a private-storage release: what a kept page shows
 * when it is mounted again, and what happens when the session goes away or
 * becomes someone else's. The page is bound to the reader it was rendered for
 * (`servedTo`).
 *
 * "Not painted even for one frame" is proven by the child itself: it counts its
 * renders, so a test can say the child function was never called, which is
 * stronger than looking at the DOM after the fact.
 */

const READER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const READER = { user: { id: READER_ID, is_anonymous: false } };
const OTHER_READER = { user: { id: OTHER_ID, is_anonymous: false } };
const signedIn = (overrides: Partial<AuthValue> = {}): AuthValue => ({ session: READER, isLoading: false, authUnverified: false, refreshSession: vi.fn(async () => undefined), ...overrides });
const signedOut = (overrides: Partial<AuthValue> = {}): AuthValue => signedIn({ session: null, ...overrides });
const unknown = (overrides: Partial<AuthValue> = {}): AuthValue => signedIn({ session: null, isLoading: true, ...overrides });

let childRenders = 0;
let childMounts = 0;
let childUnmounts = 0;

function PrivateChild() {
  childRenders += 1;
  useEffect(() => {
    childMounts += 1;
    return () => { childUnmounts += 1; };
  }, []);
  return <p data-testid="private-child">private content stand-in</p>;
}

/** The gate given exactly this `servedTo`, whatever it is (a caller that passes none passes `undefined`). */
const treeServedTo = (servedTo: unknown) => <PrivateReleaseSessionGate servedTo={servedTo as string}><PrivateChild /></PrivateReleaseSessionGate>;
const tree = (servedTo: string = READER_ID) => treeServedTo(servedTo);
const child = () => screen.queryByTestId('private-child');

let replace: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;
let consoleError: MockInstance<typeof console.error>;

/** A `pageshow` as the browser sends it; `persisted` says the page came out of the back/forward cache. */
function pageShow(persisted: boolean) {
  const event = new Event('pageshow');
  Object.defineProperty(event, 'persisted', { value: persisted });
  act(() => { window.dispatchEvent(event); });
}

beforeEach(() => {
  childRenders = 0;
  childMounts = 0;
  childUnmounts = 0;
  auth.current = signedIn();
  replace = vi.fn();
  assign = vi.fn();
  // jsdom cannot navigate. The location the gate leaves through is replaced by one whose hard
  // navigation is recorded; the soft-looking alternative is recorded too, to show it is unused.
  vi.stubGlobal('location', { href: 'http://localhost/matrix-options/paper', pathname: '/matrix-options/paper', search: '', hash: '', replace, assign });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('privateReleaseReaderState: the reader rule on the browser session, for the one reader the page was rendered for', () => {
  const rows: readonly (readonly [string, string, Parameters<typeof privateReleaseReaderState>[0], string | null | undefined])[] = [
    ['the reader the page was rendered for, not anonymous', 'allowed', { session: READER, isLoading: false }, READER_ID],
    ['the same reader while the session is being re-checked', 'allowed', { session: READER, isLoading: true }, READER_ID],
    ['another signed-in, non-anonymous user', 'denied', { session: OTHER_READER, isLoading: false }, READER_ID],
    ['another user while loading (the session is already known)', 'denied', { session: OTHER_READER, isLoading: true }, READER_ID],
    ['the same id but anonymous', 'denied', { session: { user: { id: READER_ID, is_anonymous: true } }, isLoading: false }, READER_ID],
    ['the same id with no is_anonymous flag', 'denied', { session: { user: { id: READER_ID } }, isLoading: false }, READER_ID],
    ['a non-anonymous user with no id', 'denied', { session: { user: { is_anonymous: false } }, isLoading: false }, READER_ID],
    ['a session with no user', 'denied', { session: { user: null }, isLoading: false }, READER_ID],
    ['no session, state known', 'denied', { session: null, isLoading: false }, READER_ID],
    ['no session, state not known yet', 'unknown', { session: null, isLoading: true }, READER_ID],
    ['an empty servedTo with the reader signed in', 'denied', { session: READER, isLoading: false }, ''],
    ['a missing servedTo with the reader signed in', 'denied', { session: READER, isLoading: false }, undefined],
    ['a null servedTo with the reader signed in', 'denied', { session: READER, isLoading: false }, null],
    ['an empty servedTo and a user with no id', 'denied', { session: { user: { is_anonymous: false } }, isLoading: false }, ''],
    ['an empty servedTo while the state is not known (fail closed, not "unknown")', 'denied', { session: null, isLoading: true }, ''],
  ];

  it.each(rows)('%s -> %s', (_name, expected, state, servedTo) => {
    expect(privateReleaseReaderState(state, servedTo)).toBe(expected);
  });
});

describe('PrivateReleaseSessionGate', () => {
  it('renders its children, and nothing of its own, for the signed-in reader the page was rendered for', () => {
    const { container } = render(tree());
    expect(child()).toBeInTheDocument();
    // Only the child: the gate adds no element and no text.
    expect(container.innerHTML).toBe('<p data-testid="private-child">private content stand-in</p>');
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['no session', signedOut(), READER_ID],
    ['an anonymous session', signedIn({ session: { user: { id: READER_ID, is_anonymous: true } } }), READER_ID],
    ['a session whose user has no is_anonymous flag', signedIn({ session: { user: { id: READER_ID } } }), READER_ID],
    ['another signed-in, non-anonymous user', signedIn({ session: OTHER_READER }), READER_ID],
    ['a page that does not say whom it was rendered for (empty servedTo)', signedIn(), ''],
    ['a page whose servedTo is missing', signedIn(), undefined],
    ['a page whose servedTo is null', signedIn(), null],
  ])('%s: the children are never rendered, not even once, and the page is left by one hard navigation', (_name, value, servedTo) => {
    auth.current = value;
    const { container, rerender } = render(treeServedTo(servedTo));
    expect(child()).toBeNull();
    expect(container.innerHTML).toBe('');
    // Never rendered at all: this is the mount of a kept page under a session that is not its reader's.
    expect(childRenders).toBe(0);
    expect(childMounts).toBe(0);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
    expect(PRIVATE_RELEASE_SIGN_IN_PATH).toBe('/login');
    // Further renders in the same state do not navigate again, and still render nothing.
    rerender(treeServedTo(servedTo));
    rerender(treeServedTo(servedTo));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(childRenders).toBe(0);
    // A hard navigation only: nothing else was used to leave.
    expect(assign).not.toHaveBeenCalled();
  });

  it('two-sided: the other user\'s own page (rendered for that user) is shown to that user', () => {
    auth.current = signedIn({ session: OTHER_READER });
    render(tree(OTHER_ID));
    expect(child()).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['the session goes away', signedOut()],
    ['the session turns anonymous', signedIn({ session: { user: { id: READER_ID, is_anonymous: true } } })],
    ['another non-anonymous user signs in', signedIn({ session: OTHER_READER })],
  ])('removes the children and leaves by a hard navigation when %s while mounted', (_name, next) => {
    const { container, rerender } = render(tree());
    expect(child()).toBeInTheDocument();
    expect(childMounts).toBe(1);
    auth.current = next;
    rerender(tree());
    // Unmounted, not hidden.
    expect(child()).toBeNull();
    expect(container.innerHTML).toBe('');
    expect(childUnmounts).toBe(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('a client-side mount with the state not known yet renders nothing until it is known, then the children for the reader', () => {
    auth.current = unknown();
    const { container, rerender } = render(tree());
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(0);
    // Not known is not denied: no navigation yet.
    expect(replace).not.toHaveBeenCalled();
    auth.current = signedIn();
    rerender(tree());
    expect(child()).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['signed out', signedOut()],
    ['another user', signedIn({ session: OTHER_READER })],
  ])('a client-side mount with the state not known yet, then known to be %s: the children are never rendered', (_name, next) => {
    auth.current = unknown();
    const { rerender } = render(tree());
    auth.current = next;
    rerender(tree());
    expect(childRenders).toBe(0);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('keeps the children through a re-check of a session it already has (loading with a session is not "unknown")', () => {
    const { rerender } = render(tree());
    auth.current = signedIn({ isLoading: true });
    rerender(tree());
    expect(child()).toBeInTheDocument();
    expect(childMounts).toBe(1);
    expect(childUnmounts).toBe(0);
  });

  it('keeps the children through an ordinary network blip on a page that was not restored (an unverified session of the reader)', () => {
    const { rerender } = render(tree());
    auth.current = signedIn({ authUnverified: true });
    rerender(tree());
    expect(child()).toBeInTheDocument();
    expect(childUnmounts).toBe(0);
  });
});

describe('PrivateReleaseSessionGate: the hydration of a server response', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  /** Server-renders with the state the server has (not known), then hydrates that HTML. */
  async function hydrateServerResponse(servedTo: string = READER_ID) {
    auth.current = unknown();
    const html = renderToString(tree(servedTo));
    container.innerHTML = html;
    childRenders = 0;
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => { root = hydrateRoot(container, tree(servedTo)); });
    return { html, root };
  }

  it('the server response carries the children (the server authorized it for servedTo), and hydration keeps them with no mismatch', async () => {
    const { html, root } = await hydrateServerResponse();
    expect(html).toBe('<p data-testid="private-child">private content stand-in</p>');
    expect(container.innerHTML).toBe(html);
    expect(childMounts).toBe(1);
    expect(replace).not.toHaveBeenCalled();
    // No hydration warning, no recoverable error: the client rendered what the server sent.
    expect(consoleError).not.toHaveBeenCalled();
    // The state becomes known and is that reader: the same child stays mounted (no remount).
    auth.current = signedIn();
    await act(async () => { root.render(tree()); });
    expect(container.innerHTML).toBe(html);
    expect(childMounts).toBe(1);
    expect(childUnmounts).toBe(0);
    expect(consoleError).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });

  it.each([
    ['signed out', signedOut()],
    ['another signed-in, non-anonymous user (the browser session changed before it settled)', signedIn({ session: OTHER_READER })],
    ['an anonymous user', signedIn({ session: { user: { id: READER_ID, is_anonymous: true } } })],
  ])('the trust ends the moment the state is known: known to be %s, the hydrated children are removed and the page is left', async (_name, next) => {
    const { root } = await hydrateServerResponse();
    auth.current = next;
    await act(async () => { root.render(tree()); });
    expect(container.innerHTML).toBe('');
    expect(childUnmounts).toBe(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
    await act(async () => { root.unmount(); });
  });

  it('a later "not known" shows nothing: the server check stood in only until a state had been known', async () => {
    const { root } = await hydrateServerResponse();
    auth.current = signedIn();
    await act(async () => { root.render(tree()); });
    expect(container.innerHTML).not.toBe('');
    auth.current = unknown();
    await act(async () => { root.render(tree()); });
    expect(container.innerHTML).toBe('');
    expect(replace).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });

  it('a server response with no servedTo carries nothing at all, on the server and after hydration', async () => {
    const { html, root } = await hydrateServerResponse('');
    expect(html).toBe('');
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(0);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    await act(async () => { root.unmount(); });
  });

  it('two-sided: the same unknown state in a client-side mount renders nothing (only hydration is trusted)', () => {
    auth.current = unknown();
    const mounted = render(tree());
    expect(mounted.container.innerHTML).toBe('');
    expect(childRenders).toBe(0);
  });
});

describe('PrivateReleaseSessionGate: a page restored from the back/forward cache', () => {
  /** A session check the test ends itself: `confirm` resolves it, `fail` rejects it. */
  function deferredRefresh() {
    let resolve: () => void = () => {};
    let reject: (error: Error) => void = () => {};
    const refreshSession = vi.fn(() => new Promise<void>((onResolve, onReject) => { resolve = onResolve; reject = onReject; }));
    return {
      refreshSession,
      answer: async () => { await act(async () => { resolve(); }); },
      fail: async () => { await act(async () => { reject(new Error('offline')); }); },
    };
  }

  /** Mounts the reader's page, then restores it: the children are gone and one check is running. */
  function restoredPage(check: { readonly refreshSession: () => Promise<void> }) {
    auth.current = signedIn({ refreshSession: check.refreshSession });
    const mounted = render(tree());
    expect(child()).toBeInTheDocument();
    pageShow(true);
    // The frozen page still says "signed in": that is exactly what cannot be trusted.
    expect(mounted.container.innerHTML).toBe('');
    expect(childUnmounts).toBe(1);
    expect(check.refreshSession).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    return mounted;
  }

  it('shows nothing while the session is checked again, and the children once the check confirms the same reader', async () => {
    const check = deferredRefresh();
    const { rerender } = restoredPage(check);
    await check.answer();
    rerender(tree());
    expect(child()).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    // A confirmed restore is an ordinary page again: a later network blip does not empty it.
    auth.current = signedIn({ refreshSession: check.refreshSession, authUnverified: true });
    rerender(tree());
    expect(child()).toBeInTheDocument();
  });

  it.each([
    ['finds no session', (refreshSession: () => Promise<void>) => signedOut({ refreshSession })],
    ['finds another signed-in, non-anonymous user', (refreshSession: () => Promise<void>) => signedIn({ refreshSession, session: OTHER_READER })],
    ['finds an anonymous user', (refreshSession: () => Promise<void>) => signedIn({ refreshSession, session: { user: { id: READER_ID, is_anonymous: true } } })],
    ['could not verify the kept session', (refreshSession: () => Promise<void>) => signedIn({ refreshSession, authUnverified: true })],
    ['leaves the state not known', (refreshSession: () => Promise<void>) => unknown({ refreshSession })],
  ])('a check that answers but %s is a refusal: the children stay unmounted and the page is left by a hard navigation', async (_name, after) => {
    const check = deferredRefresh();
    const { container, rerender } = restoredPage(check);
    const rendersBefore = childRenders;
    auth.current = after(check.refreshSession);
    await check.answer();
    rerender(tree());
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(rendersBefore);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
    // Refused for good: the reader's session coming back does not bring the kept page back.
    auth.current = signedIn({ refreshSession: check.refreshSession });
    rerender(tree());
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(rendersBefore);
  });

  it('a check that throws is a refusal even though the kept session still looks like the reader\'s', async () => {
    const check = deferredRefresh();
    const { container, rerender } = restoredPage(check);
    const rendersBefore = childRenders;
    // The context is unchanged: it still holds the reader's session, verified flag and all.
    await check.fail();
    rerender(tree());
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(rendersBefore);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('a check that throws synchronously is a refusal too', () => {
    const refreshSession = vi.fn(() => { throw new Error('no client'); });
    auth.current = signedIn({ refreshSession: refreshSession as unknown as () => Promise<void> });
    const { container } = render(tree());
    pageShow(true);
    expect(container.innerHTML).toBe('');
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('a check that never answers is a refusal at the deadline, not before', () => {
    vi.useFakeTimers();
    const refreshSession = vi.fn(() => new Promise<void>(() => undefined));
    auth.current = signedIn({ refreshSession });
    const { container } = render(tree());
    pageShow(true);
    expect(container.innerHTML).toBe('');
    expect(PRIVATE_RELEASE_RESTORE_DEADLINE_MS).toBe(10_000);
    act(() => { vi.advanceTimersByTime(PRIVATE_RELEASE_RESTORE_DEADLINE_MS - 1); });
    // Still waiting: empty, and not yet left.
    expect(container.innerHTML).toBe('');
    expect(replace).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(container.innerHTML).toBe('');
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('an answer that arrives after the deadline changes nothing', async () => {
    vi.useFakeTimers();
    const check = deferredRefresh();
    auth.current = signedIn({ refreshSession: check.refreshSession });
    const { container, rerender } = render(tree());
    pageShow(true);
    const rendersBefore = childRenders;
    act(() => { vi.advanceTimersByTime(PRIVATE_RELEASE_RESTORE_DEADLINE_MS); });
    expect(replace).toHaveBeenCalledTimes(1);
    await check.answer();
    rerender(tree());
    expect(container.innerHTML).toBe('');
    expect(childRenders).toBe(rendersBefore);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('two-sided: a confirmed check before the deadline keeps the page, and the deadline then does nothing', async () => {
    vi.useFakeTimers();
    const check = deferredRefresh();
    const { rerender } = restoredPage(check);
    await check.answer();
    rerender(tree());
    expect(child()).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(PRIVATE_RELEASE_RESTORE_DEADLINE_MS * 2); });
    expect(child()).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('a session already known to be someone else\'s is refused at once, without waiting for the check', () => {
    const check = deferredRefresh();
    const { container, rerender } = restoredPage(check);
    auth.current = signedIn({ refreshSession: check.refreshSession, session: OTHER_READER });
    rerender(tree());
    expect(container.innerHTML).toBe('');
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('two-sided: a pageshow that is not a restore changes nothing and checks nothing', () => {
    const refreshSession = vi.fn(async () => undefined);
    auth.current = signedIn({ refreshSession });
    render(tree());
    pageShow(false);
    expect(child()).toBeInTheDocument();
    expect(childUnmounts).toBe(0);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('removes its pageshow listener on unmount', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const refreshSession = vi.fn(async () => undefined);
    auth.current = signedIn({ refreshSession });
    const { unmount } = render(tree());
    unmount();
    pageShow(true);
    expect(refreshSession).not.toHaveBeenCalled();
    const addedListeners = added.mock.calls.filter((call) => call[0] === 'pageshow').map((call) => call[1]);
    const removedListeners = removed.mock.calls.filter((call) => call[0] === 'pageshow').map((call) => call[1]);
    expect(addedListeners.length).toBeGreaterThan(0);
    expect(addedListeners.filter((listener) => !removedListeners.includes(listener))).toHaveLength(0);
  });
});

describe('PrivateReleaseSessionGate: the module', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/components/matrix-options/paper/PrivateReleaseSessionGate.tsx'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('is a client component that leaves only by a hard navigation: no client router, no history write', () => {
    expect(source.startsWith("'use client';")).toBe(true);
    expect(code).not.toMatch(/next\/navigation|next\/router|useRouter|router\.push|history\.(?:pushState|replaceState)|location\.(?:assign|href)/);
    expect(code.match(/window\.location\.replace\(/g)).toHaveLength(1);
  });

  it('hides by not rendering, never by styling', () => {
    expect(code).not.toMatch(/className|style=|hidden|display|visibility|opacity/);
  });
});
