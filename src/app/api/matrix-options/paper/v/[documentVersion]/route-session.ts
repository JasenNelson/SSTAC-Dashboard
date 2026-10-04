import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { isPrivatePaperRelease } from '@/lib/matrix-options/paper/paper-request-loader';
import { PaperReaderDeniedError, requirePaperReader, type PaperReader } from '@/lib/matrix-options/paper/private-release-assets';
import { getAuthenticatedUser } from '@/lib/supabase-auth';

/*
 * The session rule of the two byte routes under this segment (sections and
 * figures), in one place so both apply it identically.
 *
 * - A repository release (the default): any signed-in session, the rule these
 *   routes have always applied.
 * - A private-storage release: a signed-in, NON-ANONYMOUS reader, checked by
 *   requirePaperReader on every request, whether or not the release is already
 *   in memory. The reader it issues is the only thing the private loaders accept,
 *   so one user check serves the whole request.
 *
 * A version that is not a bound release is not private: it falls under the
 * default rule here and is answered 404 by the route afterwards.
 */

export interface PaperRouteSession {
  /** The signed-in user, for the rate limiter. */
  readonly userId: string;
  /** Set for a private-storage release only: proof that the reader check ran for this request. */
  readonly reader: PaperReader | null;
}

/** The session this request may proceed with, or null when it must be answered 401. */
export async function resolvePaperRouteSession(supabase: SupabaseClient, documentVersion: string): Promise<PaperRouteSession | null> {
  if (isPrivatePaperRelease(documentVersion)) {
    try {
      const reader = await requirePaperReader(supabase);
      return { userId: reader.userId, reader };
    } catch (error) {
      if (error instanceof PaperReaderDeniedError) return null;
      throw error;
    }
  }
  const user = await getAuthenticatedUser(supabase);
  return user ? { userId: user.id, reader: null } : null;
}

/** The whole body of a 503 for a private release that cannot be read or verified right now. */
export const PRIVATE_RELEASE_UNAVAILABLE_BODY = Object.freeze({ error: 'Paper release unavailable', code: 'PRIVATE_RELEASE_UNAVAILABLE' });
