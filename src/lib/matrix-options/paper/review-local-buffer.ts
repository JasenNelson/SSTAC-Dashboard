/*
 * M2 LOCAL REVIEW BUFFER (PLAN-R4 3.B / 6.A local-buffer-only scope).
 *
 * A small localStorage-backed per-question draft store for My Review. This is
 * NOT the M3 persistence layer: there is no debounce, no server save, no
 * conflict resolution, and no clear-on-signout here. It exists only so a
 * reader's in-progress text survives a reload while M3's real save/submit
 * path is built. Every localStorage access is wrapped in try/catch: storage
 * being unavailable (private browsing, quota, disabled cookies) must degrade
 * to an empty/no-op buffer, never break the workspace. The 20000-char limit
 * (PLAN-R4 3.B.3) is enforced on READ (`readReviewLocalDraft`), the one
 * boundary every restored value passes through regardless of how it got into
 * storage.
 *
 * Key scheme: `mtwg-paper-review:<userKey>:<documentVersion>:<questionId>`.
 * PLAN-R4 6.A's eventual M3 key is `<userId>:<version>:<questionId>`, keyed by
 * an authenticated user id. M2 has no network calls of its own and no
 * authenticated user id reaches RevisedPaperWorkspace through its existing
 * props (verified against AssignmentState and RevisedPaperWorkspaceProps: no
 * user identity field exists anywhere in the paper tree's props today), so
 * `userKey` here is the literal string 'local' unless a caller is later wired
 * with a real one. This is a recorded M2 limitation (see M2 writer closeout),
 * not a silent guess: a future M3 change that starts threading an
 * authenticated user id through these props should also migrate this key.
 */

export const REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY = 'local';
const REVIEW_LOCAL_BUFFER_PREFIX = 'mtwg-paper-review';
/**
 * FIX CYCLE 1 / F2. The 20000-char draft limit (PLAN-R4 3.B.3), enforced at
 * ONE boundary: here, on READ. `writeReviewLocalDraft` never needs its own
 * clamp -- every current writer (ReviewCommentsPanel's onChange) already
 * slices to this same limit before calling it -- but a value written by a
 * future caller, or already sitting in a reader's browser from before a
 * limit change, must not be able to restore longer than this. `ReviewCommentsPanel`
 * imports this constant rather than defining its own, so there is exactly one
 * number to keep in sync.
 */
export const REVIEW_LOCAL_BUFFER_TEXT_LIMIT = 20000;

export interface ReviewLocalBufferIdentity {
  readonly documentVersion: string;
  readonly questionId: string;
  /** Omit (or pass null/undefined) when no authenticated user id reaches the caller. */
  readonly userKey?: string | null;
}

/** The exact storage key for one question's local draft buffer. */
export function reviewLocalBufferKey({ documentVersion, questionId, userKey }: ReviewLocalBufferIdentity): string {
  const resolvedUserKey = userKey && userKey.length > 0 ? userKey : REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY;
  return `${REVIEW_LOCAL_BUFFER_PREFIX}:${resolvedUserKey}:${documentVersion}:${questionId}`;
}

/** Reads one question's buffered draft text. Unavailable storage reads as ''. */
export function readReviewLocalDraft(identity: ReviewLocalBufferIdentity): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    const value = window.localStorage.getItem(reviewLocalBufferKey(identity));
    return typeof value === 'string' ? value.slice(0, REVIEW_LOCAL_BUFFER_TEXT_LIMIT) : '';
  } catch {
    return '';
  }
}

/**
 * Writes one question's buffered draft text. An empty string removes the key
 * (an empty buffer is not "drafted", so nothing is retained for it). Never
 * throws: an unavailable or full store silently drops the write.
 */
export function writeReviewLocalDraft(identity: ReviewLocalBufferIdentity, text: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = reviewLocalBufferKey(identity);
    if (text.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, text);
  } catch {
    // Unavailable storage must not break the UI (private browsing, quota, disabled cookies).
  }
}

/** "drafted" (PLAN-R4 3.B.3) = non-empty buffered text, per the brief's exact definition. */
export function isReviewDraftDrafted(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * Counts how many of `questionIds` currently have a non-empty local draft.
 * Used for the "X drafted" progress count. Never throws.
 */
export function countReviewLocalDrafted(documentVersion: string, questionIds: readonly string[], userKey?: string | null): number {
  let count = 0;
  for (const questionId of questionIds) {
    if (isReviewDraftDrafted(readReviewLocalDraft({ documentVersion, questionId, userKey }))) count += 1;
  }
  return count;
}
