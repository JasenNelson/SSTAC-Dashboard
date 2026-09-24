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
 * `local` namespace is legacy: ReviewCommentsPanel no longer writes, reads or
 * migrates it (text of an unverified reviewer stays on the page), and only
 * sign-out cleanup removes what older versions left there.
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

/**
 * Clamps text to `limit` UTF-16 code units without leaving half of a surrogate
 * pair at the end (an unpaired high surrogate renders as a replacement
 * character and is not valid text to store or send).
 */
export function clampReviewText(text: string, limit: number = REVIEW_LOCAL_BUFFER_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  const clipped = text.slice(0, limit);
  const last = clipped.charCodeAt(clipped.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? clipped.slice(0, -1) : clipped;
}

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

/**
 * A buffered draft plus the server revision it was typed against. The base
 * revision is what makes a restored buffer safe: text based on revision 5 is
 * resumed only while the server row is still at 5; once another save moved the
 * row on, the buffer is a CONFLICT to resolve, never an automatic overwrite.
 * `baseRevision` is null when no server row existed, and undefined for a
 * legacy buffer (plain text, written before base revisions were recorded).
 */
export interface ReviewLocalDraftEntry {
  readonly text: string;
  readonly baseRevision: number | null | undefined;
  /** Epoch ms of the write (versioned entries only); undefined for legacy text. */
  readonly writtenAt?: number;
}

/** Versioned entries are stored as this prefix + JSON; anything else is legacy plain text. */
const REVIEW_LOCAL_ENTRY_PREFIX = 'mtwg-draft-v1:';

function decodeEntry(raw: string): ReviewLocalDraftEntry {
  if (raw.startsWith(REVIEW_LOCAL_ENTRY_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(raw.slice(REVIEW_LOCAL_ENTRY_PREFIX.length));
      if (parsed && typeof parsed === 'object' && typeof (parsed as { t?: unknown }).t === 'string') {
        const base = (parsed as { b?: unknown }).b;
        const written = (parsed as { u?: unknown }).u;
        return { text: clampReviewText((parsed as { t: string }).t), baseRevision: typeof base === 'number' && Number.isInteger(base) && base >= 0 ? base : null, writtenAt: typeof written === 'number' && Number.isFinite(written) ? written : undefined };
      }
    } catch {
      // A corrupt entry reads as legacy text rather than being lost.
    }
  }
  return { text: clampReviewText(raw), baseRevision: undefined };
}

/** Reads one question's buffered draft (text and base revision). Unavailable storage reads as empty. */
export function readReviewLocalDraftEntry(identity: ReviewLocalBufferIdentity): ReviewLocalDraftEntry {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return { text: '', baseRevision: undefined };
    const value = window.localStorage.getItem(reviewLocalBufferKey(identity));
    return typeof value === 'string' ? decodeEntry(value) : { text: '', baseRevision: undefined };
  } catch {
    return { text: '', baseRevision: undefined };
  }
}

/**
 * True when a buffered entry exists for this question -- including an explicit
 * EMPTY draft (the reviewer cleared a saved response), which reads as '' but is
 * not the same as "nothing buffered". Unavailable storage reads as false.
 */
export function hasReviewLocalDraftEntry(identity: ReviewLocalBufferIdentity): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(reviewLocalBufferKey(identity)) !== null;
  } catch {
    return false;
  }
}

/** Reads one question's buffered draft text. Unavailable storage reads as ''. */
export function readReviewLocalDraft(identity: ReviewLocalBufferIdentity): string {
  return readReviewLocalDraftEntry(identity).text;
}

/**
 * Writes one question's draft with the revision it is based on. `null` removes
 * the key (no draft); '' is kept as an explicit empty draft, so clearing a saved
 * response survives a reload. Never throws.
 */
export function writeReviewLocalDraftEntry(identity: ReviewLocalBufferIdentity, text: string | null, baseRevision: number | null): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const key = reviewLocalBufferKey(identity);
    if (text === null) { window.localStorage.removeItem(key); knownReviewLocalBufferKeys.delete(key); }
    else { window.localStorage.setItem(key, `${REVIEW_LOCAL_ENTRY_PREFIX}${JSON.stringify({ b: baseRevision, t: text, u: Date.now() })}`); knownReviewLocalBufferKeys.add(key); }
    return true;
  } catch {
    return false;
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

/**
 * Moves a pre-authentication crash draft into the authenticated namespace.
 * NOT called by ReviewCommentsPanel (2026-09-22): the panel never writes text
 * of an unverified reviewer to the shared anonymous slot and never adopts it
 * automatically, because on a shared browser the next signer need not be the
 * typist. Kept for callers that can prove the typist's identity.
 */
export function migrateAnonymousReviewDraft(identity: Omit<ReviewLocalBufferIdentity, 'userKey'> & { readonly userKey: string }): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !identity.userKey) return false;
    const anonymous = readReviewLocalDraftEntry({ documentVersion: identity.documentVersion, questionId: identity.questionId });
    if (!anonymous.text) return true;
    const authenticatedEntry = readReviewLocalDraftEntry(identity);
    const authenticated = authenticatedEntry.text;
    // Both exist: the newer write wins (text typed while the user was unknown
    // is newer than an older signed-in copy); an undated (legacy) copy is older.
    const anonymousIsNewer = Boolean(authenticated) && (anonymous.writtenAt ?? -1) > (authenticatedEntry.writtenAt ?? -1);
    if (!authenticated || anonymousIsNewer) {
      // The base revision travels with the text (a legacy entry stays legacy).
      const written = anonymous.baseRevision === undefined ? writeReviewLocalDraft(identity, anonymous.text) : writeReviewLocalDraftEntry(identity, anonymous.text, anonymous.baseRevision);
      if (!written) return false;
    }
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
