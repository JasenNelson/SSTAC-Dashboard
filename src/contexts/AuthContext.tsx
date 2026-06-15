'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/components/supabase-client';

// Error statuses that indicate a transient network or server blip.
// On these errors we must NOT null-out the session -- the user is likely
// still logged in but the network request failed.
function isRetryableAuthError(error: { name?: string; status?: number } | null | undefined): boolean {
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  // status 0 = network-level failure (offline, CORS abort, timeout)
  if (error.status === 0) return true;
  // Gateway / upstream errors
  if (error.status === 502 || error.status === 503 || error.status === 504) return true;
  return false;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Non-null when the most recent getUser() attempt failed AND was non-retryable,
   *  or when a retryable error occurred but no prior session was available to keep.
   *  Consumers can use this to distinguish "definitely logged out" from "could not verify". */
  authError: Error | null;
  /** True when a retryable error happened but we preserved the prior session.
   *  The UI can optionally show a soft "reconnecting..." badge. */
  authUnverified: boolean;
  supabase: ReturnType<typeof createClient>;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);
  const [authUnverified, setAuthUnverified] = useState(false);

  // Keep a ref to the current session so syncSession can read it without
  // being listed as a dependency (avoids re-registering listeners on every
  // session change).
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const syncSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        if (isRetryableAuthError(error)) {
          // Transient failure: preserve whatever session we already have.
          // If we have no prior session we cannot show a valid logged-in UI
          // anyway, so session stays null (or whatever it was).
          setAuthUnverified(true);
          setAuthError(null);
          // Do NOT call setSession -- preserve the prior value.
          return;
        }
        // Terminal auth error (e.g. invalid JWT, refresh token revoked).
        setSession(null);
        setAuthError(new Error(error.message ?? 'Auth error'));
        setAuthUnverified(false);
        return;
      }

      if (!user) {
        // Clean "no user" response with no error = definitively logged out.
        setSession(null);
        setAuthError(null);
        setAuthUnverified(false);
        return;
      }

      // User confirmed. Fetch the full session object.
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      setSession(freshSession);
      setAuthError(null);
      setAuthUnverified(false);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      setSession(updatedSession);
      setAuthError(null);
      setAuthUnverified(false);
      setIsLoading(false);
    });

    // Re-validate when the user comes back online.
    const handleOnline = () => { void syncSession(); };

    // Re-validate when the tab becomes visible again (catches mobile
    // background -> foreground transitions and laptop lid-open events).
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncSession();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [supabase, syncSession]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAuthError(null);
    setAuthUnverified(false);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      authError,
      authUnverified,
      supabase,
      refreshSession: syncSession,
      signOut,
    }),
    [session, isLoading, authError, authUnverified, supabase, syncSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
