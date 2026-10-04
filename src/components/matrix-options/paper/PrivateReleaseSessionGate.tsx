'use client';

import { createContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '@/contexts/AuthContext';

/*
 * A client-side gate around what a page renders for a PRIVATE-STORAGE release.
 *
 * Why it exists. The server decides who may read such a release, on every
 * request. But a page the browser has already been given can be shown again
 * with NO request: the client router keeps rendered pages, and signing out
 * leaves by a soft navigation that does not discard them. Going Back after
 * sign-out, or the next person at the same tab, would be shown the kept page.
 * This gate makes a kept page show nothing unless the browser still holds the
 * session of the reader the page was rendered for, and leaves it by a HARD
 * navigation, which discards everything the client router kept.
 *
 * What it is not. It is not an authorization boundary: the server boundary
 * (lib/matrix-options/paper/private-release-assets.ts) is unchanged and is the
 * only thing that decides who receives the release. This only stops content the
 * browser already holds from being shown again on a shared browser.
 *
 * The page is BOUND TO ITS READER. `servedTo` is the id of the user the server
 * authorized this response for (a non-secret id, from the same check that
 * authorized the load). The session state is the application's own
 * (AuthContext), which every page of this document shares and which is already
 * known when a kept page is mounted again. So the decision is made during
 * render: a kept page mounted after sign-out, or under another reader's
 * session, never renders its children at all, not even for one frame.
 *
 * Rules:
 * - the browser's session user is not anonymous (`is_anonymous` exactly `false`)
 *   and its id equals `servedTo`: the children;
 * - a known state that is anything else (no session, an anonymous user, a user
 *   with no flag, ANOTHER user), or no `servedTo` at all: nothing, and a hard
 *   navigation to the sign-in page;
 * - a state not known yet: the children only while this component is the
 *   hydration of a server response and no state has been known since. That HTML
 *   is the server's own authorized response for `servedTo`, and a client gate
 *   cannot un-send it; the trust ends the moment any state is known, and from
 *   then on only a session of `servedTo` keeps the children. In every other
 *   mount, nothing until the state is known;
 * - a page restored from the back/forward cache shows nothing until a fresh
 *   session check has POSITIVELY confirmed a non-anonymous session of
 *   `servedTo`. A check that throws, finds no session, finds another or an
 *   anonymous user, could not verify, or does not answer within the deadline is
 *   a refusal: the page stays empty and is left.
 *
 * The gate renders no text of its own.
 */

export type PrivateReleaseReaderState = 'allowed' | 'denied' | 'unknown';

interface AuthStateForReader {
  readonly session: { readonly user?: { readonly id?: string; readonly is_anonymous?: boolean } | null } | null;
  readonly isLoading: boolean;
}

/**
 * The reader rule on the client: the rule the server applies, on the browser's
 * own session, for the one reader the page was rendered for.
 */
export function privateReleaseReaderState({ session, isLoading }: AuthStateForReader, servedTo: string | null | undefined): PrivateReleaseReaderState {
  // A page that does not say whom it was rendered for is shown to nobody.
  if (typeof servedTo !== 'string' || servedTo === '') return 'denied';
  if (session) return session.user?.is_anonymous === false && session.user.id === servedTo ? 'allowed' : 'denied';
  return isLoading ? 'unknown' : 'denied';
}

/**
 * The reader a gated page was rendered for (`servedTo`), for a component INSIDE the
 * gate that shows private bytes again on a reader's action (the full-size figure
 * viewer): it applies privateReleaseReaderState to this id itself before it asks
 * for the bytes and for as long as it shows them. Null outside a gate, where such
 * a component offers nothing.
 */
export const PrivateReleaseReaderContext = createContext<string | null>(null);

/** Where a browser with no session of the page's reader is sent. A plain path: nothing about the page it left. */
export const PRIVATE_RELEASE_SIGN_IN_PATH = '/login';

/** How long a restored page waits for its session check before the missing answer counts as a refusal. */
export const PRIVATE_RELEASE_RESTORE_DEADLINE_MS = 10_000;

/**
 * Where a page restored from the back/forward cache stands: its session check is
 * running, has answered (the answer is then read from the session state), or
 * has been refused for good. `none`: the page was not restored, or its restore
 * was confirmed.
 */
type RestoreCheck = 'none' | 'checking' | 'answered' | 'refused';

const subscribeToNothing = () => () => {};

/**
 * True on the server and while React hydrates server HTML; false for a
 * component React creates on the client (a client navigation, a kept page shown
 * again). useSyncExternalStore is what tells the two apart: it reads the server
 * snapshot only during server rendering and hydration.
 */
function useIsServerResponse(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => false, () => true);
}

export function PrivateReleaseSessionGate({ servedTo, children }: { readonly servedTo: string; readonly children: ReactNode }) {
  const { session, isLoading, authUnverified, refreshSession } = useAuth();
  const isServerResponse = useIsServerResponse();
  // Captured on the first render: later renders of a hydrated component read the client snapshot.
  const [trustsServerResponse, setTrustsServerResponse] = useState(isServerResponse);
  const [restore, setRestore] = useState<RestoreCheck>('none');

  const sessionState = privateReleaseReaderState({ session, isLoading }, servedTo);
  // A check that answered has confirmed the reader only if the session it left behind is the
  // reader's AND was verified with the server: a kept session that could not be verified is not.
  const confirmed = sessionState === 'allowed' && !authUnverified;
  const state: PrivateReleaseReaderState = restore === 'none' ? sessionState
    // While the check runs nothing is shown; a session already known to be someone else's, or gone, is refused at once.
    : restore === 'checking' ? (sessionState === 'denied' ? 'denied' : 'unknown')
      : restore === 'answered' && confirmed ? 'allowed' : 'denied';

  // The server's check stands in for the client's only until the client has known a state once.
  useEffect(() => {
    if (state !== 'unknown') setTrustsServerResponse(false);
  }, [state]);

  // An answered check settles: a confirmed restore is an ordinary page again, anything else is refused for good.
  useEffect(() => {
    if (restore === 'answered') setRestore(confirmed ? 'none' : 'refused');
  }, [restore, confirmed]);

  // Back/forward cache: the page comes back exactly as it was frozen, session state included,
  // so nothing of it is trusted until a fresh check answers.
  const latestCheck = useRef(0);
  const refresh = useRef(refreshSession);
  useEffect(() => {
    refresh.current = refreshSession;
  }, [refreshSession]);
  useEffect(() => {
    let deadline: number | undefined;
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      const check = latestCheck.current + 1;
      latestCheck.current = check;
      const settle = (next: RestoreCheck) => {
        if (latestCheck.current !== check) return;
        window.clearTimeout(deadline);
        // Once refused, a late answer changes nothing.
        setRestore((current) => (current === 'checking' ? next : current));
      };
      setTrustsServerResponse(false);
      setRestore('checking');
      window.clearTimeout(deadline);
      deadline = window.setTimeout(() => settle('refused'), PRIVATE_RELEASE_RESTORE_DEADLINE_MS);
      try {
        Promise.resolve(refresh.current()).then(() => settle('answered'), () => settle('refused'));
      } catch {
        settle('refused');
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.clearTimeout(deadline);
    };
  }, []);

  // A hard navigation, once: it discards every page the client router kept.
  const leaving = useRef(false);
  useEffect(() => {
    if (state !== 'denied' || leaving.current) return;
    leaving.current = true;
    window.location.replace(PRIVATE_RELEASE_SIGN_IN_PATH);
  }, [state]);

  const shown = state === 'allowed' || (state === 'unknown' && trustsServerResponse && restore === 'none');
  return shown ? <PrivateReleaseReaderContext.Provider value={servedTo}>{children}</PrivateReleaseReaderContext.Provider> : null;
}
