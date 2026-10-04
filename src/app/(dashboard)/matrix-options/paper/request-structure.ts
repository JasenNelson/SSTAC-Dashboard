import 'server-only';

import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { isPrivatePaperRelease, loadPaperStructureForRequest, loadPrivatePaperStructure } from '@/lib/matrix-options/paper/paper-request-loader';
import { PaperReaderDeniedError, requirePaperReader } from '@/lib/matrix-options/paper/private-release-assets';
import type { RevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { createAuthenticatedClient } from '@/lib/supabase-auth';

/*
 * How a paper PAGE gets the structure of the bound release its URL names.
 *
 * The request's own session client is created here. What the release needs is
 * decided by the request loader's rule (lib/matrix-options/paper/paper-request-loader.ts):
 * a repository release loads as it always has, with no reader check; a
 * private-storage release is read only for a signed-in, non-anonymous reader,
 * with that reader's session. For a private-storage release the two steps of
 * that rule are taken here, reader check first and load second, with the same
 * two functions the byte routes use, so that the page also learns WHOM the load
 * was authorized for (`servedTo`) from that one check, with no second one.
 *
 * The two failures of a private release become the two page outcomes:
 * - the reader is not allowed: `notFound()`. The page says nothing is here, which
 *   is all such a requester may learn;
 * - the release cannot be read or verified right now: the error is rethrown to
 *   the route segment's error boundary (error.tsx), which shows a constant
 *   message and a retry. No content of the release is in that error.
 *
 * Callers decide everything that needs no structure (feature gate, unknown
 * version, malformed id, the withheld-section redirect) BEFORE calling this, so
 * none of those depends on a session or on storage.
 */

export interface PaperStructureForPage {
  readonly structure: RevisedPaperStructure;
  readonly supabase: SupabaseClient;
  /**
   * The id of the reader this load was authorized for: set for a private-storage
   * release, null for a repository release (which checks no reader). A user id is
   * not a secret; the page hands it to the client so a kept copy of the page is
   * shown again only to that reader (PrivateReleaseSessionGate).
   */
  readonly servedTo: string | null;
}

export async function loadPaperStructureForPage(documentVersion: string): Promise<PaperStructureForPage> {
  const supabase = await createAuthenticatedClient();
  try {
    if (isPrivatePaperRelease(documentVersion)) {
      const reader = await requirePaperReader(supabase);
      const structure = await loadPrivatePaperStructure(documentVersion, reader);
      return { structure, supabase, servedTo: reader.userId };
    }
    return { structure: await loadPaperStructureForRequest(documentVersion, supabase), supabase, servedTo: null };
  } catch (error) {
    if (error instanceof PaperReaderDeniedError) notFound();
    throw error;
  }
}
