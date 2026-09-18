/*
 * M2 LOCAL REVIEW BUFFER (PLAN-R4 3.B / 6.A local-buffer-only scope).
 *
 * A small localStorage-backed per-question draft store for My Review. This is
 * NOT the M3 persistence layer: server save, debounce, conflict resolution,
 * and session lifecycle remain in ReviewCommentsPanel. It exists so a
 * reader's in-progress text survives a reload alongside M3's real save/submit
 * path. Every localStorage access is wrapped in try/catch: storage
 * being unavailable (private browsing, quota, disabled cookies) must degrade
 * to an empty/no-op buffer, never break the workspace. The 20000-char limit
 * (PLAN-R4 3.B.3) is enforced on READ (`readReviewLocalDraft`), the one
 * boundary every restored value passes through regardless of how it got into
 * storage.
 *
 * Key scheme: `mtwg-paper-review:<userKey>:<documentVersion>:<questionId>`.
 * PLAN-R4 6.A's M3 key is `<userId>:<version>:<questionId>`, keyed by the
 * authenticated identity returned by the server bootstrap. The anonymous
 * `local` namespace is retained only for pre-authentication crash recovery and
 * is migrated only after an authenticated write succeeds.
 */

export const REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY = 'local';
const REVIEW_LOCAL_BUFFER_PREFIX = 'mtwg-paper-review';
const knownReviewLocalBufferKeys = new Set<string>();
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
export function writeReviewLocalDraft(identity: ReviewLocalBufferIdentity, text: string): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const key = reviewLocalBufferKey(identity);
    if (text.length === 0) { window.localStorage.removeItem(key); knownReviewLocalBufferKeys.delete(key); }
    else { window.localStorage.setItem(key, text); knownReviewLocalBufferKeys.add(key); }
    return true;
  } catch {
    // Unavailable storage must not break the UI (private browsing, quota, disabled cookies).
    return false;
  }
}

/** Removes all locally buffered review drafts for one authenticated user. */
export function clearReviewLocalDrafts(userKey: string, documentVersion?: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !userKey) return;
    const prefix = `${REVIEW_LOCAL_BUFFER_PREFIX}:${userKey}:`;
    const versionPrefix = documentVersion ? `${prefix}${documentVersion}:` : prefix;
    removeReviewLocalBufferKeys((key) => key.startsWith(versionPrefix));
  } catch {
    // Sign-out cleanup must never make sign-out fail.
  }
}

/** Removes every user namespace for one release before a session handoff. */
export function clearReviewLocalDraftsForVersion(documentVersion: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !documentVersion) return;
    const suffix = `:${documentVersion}:`;
    removeReviewLocalBufferKeys((key) => key.startsWith(`${REVIEW_LOCAL_BUFFER_PREFIX}:`) && key.includes(suffix));
  } catch {
    // Sign-out cleanup must never make sign-out fail.
  }
}

function removeReviewLocalBufferKeys(predicate: (key: string) => boolean): void {
  const keys = new Set(knownReviewLocalBufferKeys);
  const storage = window.localStorage as Storage & { readonly length?: number; key?: (index: number) => string | null };
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key) keys.add(key);
    }
  }
  for (const key of keys) {
    if (predicate(key)) { storage.removeItem(key); knownReviewLocalBufferKeys.delete(key); }
  }
}

/** Moves a pre-authentication crash draft into the authenticated namespace. */
export function migrateAnonymousReviewDraft(identity: Omit<ReviewLocalBufferIdentity, 'userKey'> & { readonly userKey: string }): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !identity.userKey) return false;
    const anonymous = readReviewLocalDraft({ documentVersion: identity.documentVersion, questionId: identity.questionId });
    if (!anonymous) return true;
    const authenticated = readReviewLocalDraft(identity);
    if (!authenticated && !writeReviewLocalDraft(identity, anonymous)) return false;
    return writeReviewLocalDraft({ documentVersion: identity.documentVersion, questionId: identity.questionId }, '');
  } catch {
    // Storage failure is a normal degraded mode for the crash buffer.
    return false;
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
