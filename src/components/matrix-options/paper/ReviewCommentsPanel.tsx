'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

import MathRenderer from '@/components/MathRenderer';
import { createClient } from '@/lib/supabase/client';
import { clampReviewText, clearReviewLocalDrafts, clearReviewLocalDraftsForVersion, hasReviewLocalDraftEntry, isReviewDraftDrafted, readReviewLocalDraftEntry, REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY, REVIEW_LOCAL_BUFFER_TEXT_LIMIT, writeReviewLocalDraftEntry } from '@/lib/matrix-options/paper/review-local-buffer';
import { reviewResponseRowSchema, reviewResponseStatusLabel } from '@/lib/matrix-options/paper/review-responses';
import type { ReviewResponseRow } from '@/lib/matrix-options/paper/review-responses';
import { questionPromptSummary } from '@/lib/matrix-options/paper/review-navigation';
import type { ReviewNavTopic } from '@/lib/matrix-options/paper/review-navigation';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { cn } from '@/utils/cn';

import { REVIEW_PROGRESS_STATE_TEXT, ReviewProgressTracker } from './ReviewProgressTracker';
import type { ReviewProgressState } from './ReviewProgressTracker';

type Question = ReviewerGuideContract['questions'][number];
export const REVIEW_COMMENTS_TEXT_LIMIT = REVIEW_LOCAL_BUFFER_TEXT_LIMIT;
export const REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD = 1000;
/** A save request that has not answered after this long is treated as offline. */
export const REVIEW_SAVE_TIMEOUT_MS = 30000;
type PersistenceState = 'loading' | 'available' | 'unavailable' | 'unauthenticated' | 'identity-changed';
/** Result of the last save attempt for one question (in-flight state is tracked separately). */
type SaveOutcome = 'saved' | 'offline' | 'error' | 'throttled';
/** Unsaved text for one question and the server revision it was typed against (null: no row existed). */
interface DraftEntry { readonly text: string; readonly base: number | null; readonly source: 'typed' | 'buffer' }
type QueuedAction = { readonly action: 'save-draft'; readonly duringConflict?: boolean } | { readonly action: 'submit'; readonly text: string };

interface ReviewBootstrap { readonly persistence?: 'available' | 'unavailable'; readonly userKey?: string; readonly rows?: readonly ReviewResponseRow[]; }
interface ConflictState { readonly questionId: string; readonly row: ReviewResponseRow; readonly localText: string; }

export interface ReviewCommentsPanelProps {
  readonly documentVersion: string;
  readonly manifestSha256?: string;
  readonly cohortId?: string | null;
  readonly questions: readonly Question[];
  /**
   * The OPEN question: its prompt and editor are expanded in the question
   * index. Undefined when every question is collapsed.
   */
  readonly question: Question | undefined;
  /** The question related to what the paper shows (highlighted, never opened by this panel). */
  readonly highlightQuestionNumber?: number;
  /** Collapses the open question. */
  readonly onCloseQuestion?: () => void;
  /** Brings an element of this panel into view (the workspace owns scrolling). */
  readonly revealElement?: (element: HTMLElement, cause?: ReviewRevealCause) => void;
  /** Bumped when the question was opened from OUTSIDE this panel (the navigation): reveal and focus its row. */
  readonly openRequest?: number;
  readonly responseRef: RefObject<HTMLElement | null>;
  readonly onSelectQuestion: (number: number) => void;
  readonly onPreviousQuestion: () => void;
  readonly onNextQuestion: () => void;
  /** Review topics (shared navigation model); the tracker and Jump to topic group by these. */
  readonly topics?: readonly ReviewNavTopic[];
  /** A quiet note when the paper selection has no review question of its own. */
  readonly sectionNote?: string | null;
  /** The review topic (cohort) of any question, so a save for a question other than the active one carries its own cohort. */
  readonly cohortForQuestion?: (questionId: string) => string | null;
}

function rowForQuestion(rows: ReadonlyMap<string, ReviewResponseRow>, questionId: string | undefined): ReviewResponseRow | null { return questionId ? rows.get(questionId) ?? null : null; }
function rowText(row: ReviewResponseRow | null): string { return row?.draft_text ?? row?.submitted_text ?? ''; }
function progressState(row: ReviewResponseRow | null, localText: string): ReviewProgressState {
  const status = reviewResponseStatusLabel(row);
  if (status === 'changed-since-submit') return 'changed';
  if (status === 'submitted') return 'submitted';
  if (status === 'drafted') return 'draft';
  return isReviewDraftDrafted(localText) ? 'draft-local' : 'not-started';
}
function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function preview(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 110 ? `${flat.slice(0, 110)}...` : flat;
}
/** Groups the flat question list when no topics are supplied (keeps older callers working). */
function fallbackTopics(questions: readonly Question[]): readonly ReviewNavTopic[] {
  return [{ id: 'all', name: 'Questions', number: 1, label: 'Questions', questions: questions.map((question) => ({ number: question.number, id: question.id, heading: question.heading, title: question.heading, topicId: 'all', citedSections: [] })) }];
}
/** The section citation from a Reviewer's Guide heading ("Section 7.8"), for context under the question. */
function headingCitation(heading: string): string | null {
  const match = /\((Sections?\s[^)]*)\)\s*$/.exec(heading);
  return match ? match[1] : null;
}

/** Why a review row is revealed: an explicit selection, or the q deep link at mount. */
export type ReviewRevealCause = 'selection' | 'url';

export function ReviewCommentsPanel({ documentVersion, manifestSha256 = '', cohortId, questions, question, highlightQuestionNumber, onCloseQuestion, revealElement, openRequest = 0, responseRef, onSelectQuestion, onPreviousQuestion, onNextQuestion, topics, sectionNote = null, cohortForQuestion }: ReviewCommentsPanelProps) {
  /*
   * STATE MODEL -- one source of truth per question.
   *
   * - rows: the server rows, MERGED by revision (a row is never replaced by a
   *   lower revision, so a slow bootstrap GET cannot roll back a save).
   * - drafts: the UNSAVED text of each question, with the server revision it was
   *   typed against. A question with a draft is dirty; the textarea shows the
   *   draft, otherwise the saved row. Drafts live in memory; the browser buffer
   *   only MIRRORS them (text + base revision) under the VERIFIED reviewer's own
   *   key so a reload can restore them. It is read only at bootstrap, for that
   *   reviewer, never as the live source -- so blocked storage can never blank
   *   what the reviewer typed. Before a reviewer is verified, text is on the
   *   page only (never in the browser's shared slot) and the page says so.
   * - saves: SERIALIZED per question (one in flight; later actions queue and
   *   read the latest draft when they are sent). Every save sends the draft's
   *   OWN base revision, so text typed against an older revision earns a real
   *   conflict instead of silently overwriting a newer save.
   * - conflicts: a 409, or a restored buffer whose base revision is not the
   *   row's. While one is open only Keep mine / Use saved write; typing keeps
   *   the conflict and updates the text Keep mine will save.
   */
  const [persistence, setPersistence] = useState<PersistenceState>(manifestSha256 ? 'loading' : 'unavailable');
  const [userKey, setUserKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ReadonlyMap<string, ReviewResponseRow>>(() => new Map());
  const rowsRef = useRef(rows);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, DraftEntry>>(() => new Map());
  const draftsRef = useRef(drafts);
  const [conflicts, setConflicts] = useState<ReadonlyMap<string, ConflictState>>(() => new Map());
  const conflictsRef = useRef(conflicts);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, SaveOutcome>>(() => new Map());
  const [pendingMutationQuestionIds, setPendingMutationQuestionIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingMutationQuestionIdsRef = useRef<ReadonlySet<string>>(new Set());
  const inFlightRef = useRef(new Map<string, { readonly controller: AbortController; readonly text: string }>());
  const queueRef = useRef(new Map<string, QueuedAction[]>());
  const lastSavedAtRef = useRef(new Map<string, string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const userKeyRef = useRef<string | null>(null);
  const knownUserKeysRef = useRef(new Set<string>());
  const bootstrapAbortRef = useRef<AbortController | null>(null);
  const activeQuestionIdRef = useRef<string | undefined>(question?.id);
  const loadedQuestionIdRef = useRef<string | undefined>(question?.id);
  const persistenceRef = useRef<PersistenceState>(persistence);
  /** Re-runs the bootstrap GET (Try again) without remounting. */
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /** Caret per question, so ordinary navigation returns the reader to where they were typing. */
  const caretRef = useRef(new Map<string, number>());
  /** The question whose caret the textarea currently reflects. */
  const caretQuestionRef = useRef<string | undefined>(question?.id);

  useEffect(() => { persistenceRef.current = persistence; }, [persistence]);
  useEffect(() => { userKeyRef.current = userKey; }, [userKey]);

  const commitRows = useCallback((next: ReadonlyMap<string, ReviewResponseRow>) => { rowsRef.current = next; setRows(next); }, []);
  /** Merge one server row, never replacing it with a lower revision. */
  const mergeRow = useCallback((row: ReviewResponseRow, force = false) => {
    const previous = rowsRef.current.get(row.question_id);
    if (!force && previous && previous.revision > row.revision) return;
    const next = new Map(rowsRef.current); next.set(row.question_id, row); commitRows(next);
  }, [commitRows]);
  const commitDrafts = useCallback((next: ReadonlyMap<string, DraftEntry>) => { draftsRef.current = next; if (mountedRef.current) setDrafts(next); }, []);
  /**
   * Questions whose unsaved draft is on this PAGE ONLY: no verified reviewer,
   * or the browser-copy write failed. Per question, because one failed write
   * (e.g. a full store) must not be hidden by a later successful one.
   */
  const [pageOnly, setPageOnly] = useState<ReadonlySet<string>>(() => new Set());
  const markPageOnly = useCallback((questionId: string, onPageOnly: boolean) => {
    if (!mountedRef.current) return;
    setPageOnly((previous) => {
      if (previous.has(questionId) === onPageOnly) return previous;
      const next = new Set(previous);
      if (onPageOnly) next.add(questionId); else next.delete(questionId);
      return next;
    });
  }, []);
  const setDraft = useCallback((questionId: string, entry: DraftEntry | null, uKey: string | null) => {
    const next = new Map(draftsRef.current);
    if (entry) next.set(questionId, entry); else next.delete(questionId);
    commitDrafts(next);
    // The browser copy mirrors the in-memory draft (text + base revision).
    // Only a VERIFIED reviewer's text is copied to the browser. Before the
    // reviewer is known the text stays on this page (and the status says so):
    // on a shared browser the next person to sign in need not be the typist,
    // so unattributed text is never stored where it could be adopted.
    const written = uKey ? writeReviewLocalDraftEntry({ documentVersion, questionId, userKey: uKey }, entry ? entry.text : null, entry ? entry.base : null) : false;
    markPageOnly(questionId, Boolean(entry) && !written);
  }, [commitDrafts, documentVersion, markPageOnly]);
  const updateConflict = useCallback((questionId: string, conflict: ConflictState | null) => {
    const next = new Map(conflictsRef.current);
    if (conflict) next.set(questionId, conflict); else next.delete(questionId);
    conflictsRef.current = next;
    if (mountedRef.current) setConflicts(next);
  }, []);
  const setOutcome = useCallback((questionId: string, outcome: SaveOutcome | null) => {
    if (!mountedRef.current) return;
    setOutcomes((previous) => {
      const next = new Map(previous);
      if (outcome) next.set(questionId, outcome); else next.delete(questionId);
      return next;
    });
  }, []);
  const markMutationPending = useCallback((questionId: string, pending: boolean) => {
    const next = new Set(pendingMutationQuestionIdsRef.current);
    if (pending) next.add(questionId); else next.delete(questionId);
    pendingMutationQuestionIdsRef.current = next;
    if (mountedRef.current) setPendingMutationQuestionIds(next);
  }, []);

  /** Restores buffered drafts for one user namespace against the rows now known. Typed drafts always win. */
  const reconcileBufferedDrafts = useCallback((uKey: string | null, knownRows: ReadonlyMap<string, ReviewResponseRow>) => {
    // Without a verified reviewer there is no namespace to restore from, and
    // the shared anonymous slot is never read (see setDraft).
    if (!uKey) return;
    const next = new Map(draftsRef.current);
    const nextConflicts = new Map(conflictsRef.current);
    for (const item of questions) {
      const existing = next.get(item.id);
      if (existing?.source === 'typed') continue;
      const identity = { documentVersion, questionId: item.id, userKey: uKey };
      const present = hasReviewLocalDraftEntry(identity);
      const entry = readReviewLocalDraftEntry(identity);
      const row = knownRows.get(item.id) ?? null;
      if (!present || entry.text === rowText(row)) {
        next.delete(item.id);
        if (present) writeReviewLocalDraftEntry(identity, null, null);
        continue;
      }
      const rowRevision = row ? row.revision : null;
      // No row for this release: whatever revision the buffer names is gone
      // (deleted, or typed under another manifest), so the text is a new draft.
      const base = !row ? null : entry.baseRevision === undefined ? -1 : entry.baseRevision;
      next.set(item.id, { text: entry.text, base: base === -1 ? rowRevision : base, source: 'buffer' });
      // Restored FROM the browser copy, so it is in the browser.
      markPageOnly(item.id, false);
      // Typed against another revision (or legacy text of unknown base next to
      // a saved row): the reviewer chooses, nothing is overwritten silently.
      if (row && base !== rowRevision) nextConflicts.set(item.id, { questionId: item.id, row, localText: entry.text });
    }
    commitDrafts(next);
    conflictsRef.current = nextConflicts;
    setConflicts(nextConflicts);
  }, [commitDrafts, documentVersion, markPageOnly, questions]);

  const applyBootstrapRef = useRef<(payload: ReviewBootstrap) => void>(() => {});
  applyBootstrapRef.current = (payload: ReviewBootstrap) => {
    // A bootstrap for a DIFFERENT reviewer than the one this page is pinned to
    // (e.g. Try again after someone else signed in on this browser) never
    // re-pins the page: that would claim this reviewer's text for the other.
    if (userKeyRef.current && payload.userKey && payload.userKey !== userKeyRef.current) {
      markIdentityChangedRef.current();
      return;
    }
    // A response that names no reviewer never clears an established pin (that
    // would disable both identity guards): saving is just unavailable for now.
    if (userKeyRef.current && !payload.userKey) {
      setPersistence('unavailable');
      return;
    }
    const next = new Map(rowsRef.current);
    for (const row of payload.rows ?? []) {
      if (row.document_version !== documentVersion || row.manifest_sha256 !== manifestSha256 || !questions.some((item) => item.id === row.question_id)) continue;
      const previous = next.get(row.question_id);
      if (!previous || previous.revision <= row.revision) next.set(row.question_id, row);
    }
    commitRows(next);
    setPersistence(payload.persistence === 'available' ? 'available' : 'unavailable');
    setUserKey(payload.userKey ?? null);
    if (payload.userKey) {
      userKeyRef.current = payload.userKey;
      knownUserKeysRef.current.add(payload.userKey);
    }
    reconcileBufferedDrafts(payload.userKey ?? null, next);
    // Drafts typed in THIS tab before the reviewer was verified lived on the
    // page only; copy them under the now-verified reviewer so a reload keeps them.
    // The text is attributed to the reviewer this bootstrap verified. Accepted
    // residual (documented in the PR): if no reviewer was ever verified on this
    // page and a different reviewer signed in on this browser before Try again,
    // text typed here is claimed by that reviewer; it is on screen throughout.
    if (payload.userKey) {
      for (const [questionId, draft] of draftsRef.current) {
        if (draft.source !== 'typed') continue;
        // The status (and the leave-page prompt) follows where the text now is.
        markPageOnly(questionId, !writeReviewLocalDraftEntry({ documentVersion, questionId, userKey: payload.userKey }, draft.text, draft.base));
      }
    }
  };

  // The saved responses load on mount and on Try again only -- never on a
  // question switch, where a slow GET could race a save.
  useEffect(() => {
    if (!manifestSha256 || !/^[a-f0-9]{64}$/.test(manifestSha256) || typeof fetch !== 'function') return undefined;
    bootstrapAbortRef.current?.abort();
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    const generation = sessionGenerationRef.current;
    let cancelled = false;
    const url = `/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(documentVersion)}&manifestSha256=${encodeURIComponent(manifestSha256)}`;
    // The editor is read-only while this loads, so a hung request must end:
    // after the timeout, saving is reported unavailable (Try again reloads).
    const timer = setTimeout(() => {
      if (cancelled || generation !== sessionGenerationRef.current || !mountedRef.current) return;
      cancelled = true;
      controller.abort();
      setPersistence('unavailable');
    }, REVIEW_SAVE_TIMEOUT_MS);
    void fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json().catch(() => ({})) as ReviewBootstrap;
      clearTimeout(timer);
      if (!cancelled && !controller.signal.aborted && mountedRef.current && generation === sessionGenerationRef.current) { /* Only the route's own answers (200/503, which always name the reviewer) are applied; anything else (429, 500, ...) is "unavailable". Defence in depth beside applyBootstrap's never-un-pin rule. */ if (response.status === 401) setPersistence('unauthenticated'); else if (response.ok || response.status === 503) applyBootstrapRef.current(payload); else setPersistence('unavailable'); }
    }).catch(() => { clearTimeout(timer); if (!cancelled && !controller.signal.aborted && mountedRef.current && generation === sessionGenerationRef.current) setPersistence('unavailable'); });
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); if (bootstrapAbortRef.current === controller) bootstrapAbortRef.current = null; };
  }, [documentVersion, manifestSha256, bootstrapAttempt]);

  useEffect(() => {
    mountedRef.current = true;
    const inFlight = inFlightRef.current;
    return () => {
      mountedRef.current = false;
      sessionGenerationRef.current += 1;
      bootstrapAbortRef.current?.abort();
      inFlight.forEach(({ controller }) => controller.abort());
      inFlight.clear();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      sessionGenerationRef.current += 1;
      bootstrapAbortRef.current?.abort();
      inFlightRef.current.forEach(({ controller }) => controller.abort());
      inFlightRef.current.clear();
      queueRef.current.clear();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const previousUserKey = userKeyRef.current;
      if (previousUserKey) knownUserKeysRef.current.add(previousUserKey);
      knownUserKeysRef.current.forEach((knownUserKey) => clearReviewLocalDrafts(knownUserKey, documentVersion));
      clearReviewLocalDrafts(REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY, documentVersion);
      clearReviewLocalDraftsForVersion(documentVersion);
      knownUserKeysRef.current.clear();
      userKeyRef.current = null;
      pendingMutationQuestionIdsRef.current = new Set(); setPendingMutationQuestionIds(new Set());
      setPageOnly(new Set());
      setUserKey(null); commitRows(new Map()); commitDrafts(new Map()); conflictsRef.current = new Map(); setConflicts(new Map()); setOutcomes(new Map()); setPersistence('unauthenticated');
    };
    window.addEventListener('matrix-options-auth-signed-out', onSignedOut);
    if (!manifestSha256) return () => window.removeEventListener('matrix-options-auth-signed-out', onSignedOut);
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const client = createClient();
      subscription = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') { onSignedOut(); return; }
        const sessionUserId = session?.user?.id;
        if (sessionUserId && userKeyRef.current && sessionUserId !== userKeyRef.current) markIdentityChangedRef.current();
      }).data.subscription;
    } catch {
      // The server bootstrap remains authoritative if a browser client cannot initialize.
    }
    return () => { window.removeEventListener('matrix-options-auth-signed-out', onSignedOut); subscription?.unsubscribe(); };
  }, [commitDrafts, commitRows, documentVersion, manifestSha256]);

  /**
   * Another reviewer is now signed in on this browser (an auth event, or the
   * server's identity pin). Stop every save for the page's reviewer: nothing is
   * written under the new identity, and the text stays in memory and in the
   * page reviewer's own browser namespace.
   */
  const markIdentityChangedRef = useRef<() => void>(() => {});
  markIdentityChangedRef.current = () => {
    sessionGenerationRef.current += 1;
    inFlightRef.current.forEach(({ controller }) => controller.abort());
    inFlightRef.current.clear();
    queueRef.current.clear();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    pendingMutationQuestionIdsRef.current = new Set();
    if (mountedRef.current) { setPendingMutationQuestionIds(new Set()); setPersistence('identity-changed'); }
  };

  // Unsaved text that exists ONLY on this page (no verified reviewer, or the
  // browser copy failed) would be lost by leaving: ask the browser to confirm.
  const hasPageOnlyDrafts = [...drafts.keys()].some((questionId) => pageOnly.has(questionId));
  useEffect(() => {
    if (!hasPageOnlyDrafts) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasPageOnlyDrafts]);

  const cancelScheduledAutosave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const persistRef = useRef<(questionId: string, action: 'save-draft' | 'submit', submitText?: string, options?: { readonly duringConflict?: boolean }) => void>(() => {});
  const persist = useCallback((questionId: string, action: 'save-draft' | 'submit', submitText?: string, options?: { readonly duringConflict?: boolean }) => {
    const questionCohortId = cohortForQuestion ? cohortForQuestion(questionId) : cohortId;
    if (!userKey || !manifestSha256 || !questionCohortId) { setOutcome(questionId, 'offline'); return; }
    if (conflictsRef.current.has(questionId) && !options?.duringConflict) return;
    const inFlight = inFlightRef.current.get(questionId);
    if (inFlight) {
      const queue = queueRef.current.get(questionId) ?? [];
      if (action === 'submit') queue.push({ action: 'submit', text: submitText ?? '' });
      // A queued draft save reads the newest draft when it is sent; one is enough.
      else if (queue.at(-1)?.action !== 'save-draft' && !(queue.length === 0 && draftsRef.current.get(questionId)?.text === inFlight.text)) queue.push({ action: 'save-draft' });
      queueRef.current.set(questionId, queue);
      return;
    }
    const draft = draftsRef.current.get(questionId);
    const text = action === 'submit' ? submitText : draft?.text;
    if (text === undefined) return;
    const row = rowsRef.current.get(questionId) ?? null;
    // Typed back to exactly the saved text: nothing to save (and a submitted
    // response must not be marked "changed" for unchanged text).
    if (action === 'save-draft' && draft && row && draft.base === row.revision && draft.text === rowText(row)) {
      setDraft(questionId, null, userKeyRef.current);
      return;
    }
    const expectedRevision = draft ? draft.base : row ? row.revision : null;
    const generation = sessionGenerationRef.current;
    const controller = new AbortController();
    inFlightRef.current.set(questionId, { controller, text });
    markMutationPending(questionId, true);
    setOutcome(questionId, null);
    const settle = () => {
      if (inFlightRef.current.get(questionId)?.controller !== controller) return;
      inFlightRef.current.delete(questionId);
      markMutationPending(questionId, false);
      const queue = queueRef.current.get(questionId) ?? [];
      const nextAction = queue.shift();
      if (queue.length === 0) queueRef.current.delete(questionId);
      const allowed = nextAction && (!conflictsRef.current.has(questionId) || (nextAction.action === 'save-draft' && nextAction.duringConflict === true));
      if (nextAction && allowed && mountedRef.current && generation === sessionGenerationRef.current) {
        persistRef.current(questionId, nextAction.action, nextAction.action === 'submit' ? nextAction.text : undefined, nextAction.action === 'save-draft' && nextAction.duringConflict ? { duringConflict: true } : undefined);
      }
    };
    // A hung request must not leave the question 'Saving...' forever (a timer,
    // so it works in every browser; its abort is told apart from a session abort).
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REVIEW_SAVE_TIMEOUT_MS);
    void (async () => {
      try {
        const response = await fetch(`/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentVersion, manifestSha256, cohortId: questionCohortId, action, text, expectedRevision, expectedUserId: userKey }), signal: controller.signal });
        const payload = await response.json().catch(() => ({})) as { outcome?: string; row?: ReviewResponseRow | null };
        if (timedOut) throw new DOMException('Review save timed out', 'TimeoutError');
        if (!mountedRef.current || controller.signal.aborted || generation !== sessionGenerationRef.current) return;
        const parsedRow = payload.row === null || payload.row === undefined ? null : reviewResponseRowSchema.safeParse(payload.row);
        const savedRow = parsedRow?.success ? parsedRow.data : null;
        if (response.status === 409 && payload.outcome === 'stale_revision' && !savedRow) {
          // The row the draft was based on no longer exists: re-base to "no row"
          // and try once more (a second rowless 409 is an error, never a loop).
          const current = draftsRef.current.get(questionId);
          if (expectedRevision !== null) {
            setDraft(questionId, { text: current?.text ?? text, base: null, source: 'typed' }, userKeyRef.current);
            const retry: QueuedAction = action === 'submit' ? { action: 'submit', text } : { action: 'save-draft', duringConflict: options?.duringConflict === true };
            queueRef.current.set(questionId, [retry, ...(queueRef.current.get(questionId) ?? [])]);
          } else {
            setOutcome(questionId, 'error');
          }
          return;
        }
        if (response.status === 409 && payload.outcome === 'stale_revision' && savedRow && action === 'save-draft' && rowText(savedRow) === text) {
          // Our own earlier save committed but its response was lost: not a conflict.
          mergeRow(savedRow);
          const current = draftsRef.current.get(questionId);
          if (!current || current.text === text) setDraft(questionId, null, userKeyRef.current);
          else setDraft(questionId, { ...current, base: savedRow.revision }, userKeyRef.current);
          updateConflict(questionId, null);
          setOutcome(questionId, 'saved');
          return;
        }
        if (response.status === 409 && payload.outcome === 'stale_revision' && savedRow) {
          // Keep the reviewer's text on screen (a submit with no draft had it only
          // in the old row); the conflict offers theirs and the other version.
          const current = draftsRef.current.get(questionId);
          if (!current) setDraft(questionId, { text, base: expectedRevision, source: 'typed' }, userKeyRef.current);
          mergeRow(savedRow);
          queueRef.current.delete(questionId);
          updateConflict(questionId, { questionId, row: savedRow, localText: current?.text ?? text });
          return;
        }
        if (response.status === 409 && payload.outcome === 'identity_changed') {
          // Another reviewer signed in on this browser: nothing was written.
          markIdentityChangedRef.current();
          return;
        }
        if (response.status === 401) {
          // The session expired: the text stays; saving asks the reviewer to sign in again.
          setPersistence('unauthenticated');
          return;
        }
        if (!response.ok || (payload.outcome !== 'ok' && payload.outcome !== 'noop_already_submitted') || !savedRow) {
          setOutcome(questionId, response.status === 503 ? 'offline' : response.status === 429 ? 'throttled' : 'error');
          return;
        }
        mergeRow(savedRow);
        const current = draftsRef.current.get(questionId);
        const uKey = userKeyRef.current;
        // Sent text still current: nothing is unsaved. Newer typing stays a
        // draft, now based on the revision this save produced.
        if (!current || current.text === text) setDraft(questionId, null, uKey);
        else setDraft(questionId, { ...current, base: savedRow.revision }, uKey);
        updateConflict(questionId, null);
        lastSavedAtRef.current.set(questionId, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setOutcome(questionId, 'saved');
      } catch {
        // A user/session abort is silent; a timeout is an offline save.
        if (!timedOut && controller.signal.aborted) return;
        if (mountedRef.current && generation === sessionGenerationRef.current) setOutcome(questionId, 'offline');
      } finally {
        clearTimeout(timer);
        settle();
      }
    })();
  }, [cohortForQuestion, cohortId, documentVersion, manifestSha256, markMutationPending, mergeRow, setDraft, setOutcome, updateConflict, userKey]);
  useEffect(() => { persistRef.current = persist; }, [persist]);

  // Question switch: save the outgoing question's unsaved text now (Back /
  // Forward and paper sync switch without a blur, and the switch cancels its
  // pending autosave), then show the incoming question from memory.
  useEffect(() => {
    if (question?.id === loadedQuestionIdRef.current) return;
    const outgoing = loadedQuestionIdRef.current;
    if (outgoing && draftsRef.current.has(outgoing) && persistenceRef.current === 'available') persistRef.current(outgoing, 'save-draft');
    loadedQuestionIdRef.current = question?.id;
    activeQuestionIdRef.current = question?.id;
  }, [question]);

  const activeRow = rowForQuestion(rows, question?.id);
  const activeDraft = question ? drafts.get(question.id) : undefined;
  const draftText = question ? activeDraft?.text ?? rowText(activeRow) : '';

  // Restore the caret when a different question is shown. The text is derived
  // in the same render, so the textarea already holds it here, and no later
  // controlled-value update can move the caret afterwards.
  useLayoutEffect(() => {
    const element = textareaRef.current;
    // Collapsing unmounts the editor: reopening must restore the caret again.
    if (!question) { caretQuestionRef.current = undefined; return; }
    if (!element || caretQuestionRef.current === question.id) return;
    caretQuestionRef.current = question.id;
    const caret = caretRef.current.get(question.id);
    if (caret === undefined) return;
    const position = Math.min(caret, element.value.length);
    try { element.setSelectionRange(position, position); } catch { /* not selectable */ }
  }, [question]);

  // Autosave the question showing, 1.5s after its draft last changed.
  useEffect(() => {
    if (!question || !activeDraft || persistence !== 'available' || conflicts.has(question.id)) return undefined;
    cancelScheduledAutosave();
    const questionId = question.id;
    debounceRef.current = setTimeout(() => { persistRef.current(questionId, 'save-draft'); }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeDraft, cancelScheduledAutosave, conflicts, persistence, question]);

  const saveDraftNow = useCallback(() => {
    // During a conflict only Keep mine / Use saved write.
    if (!question || !draftsRef.current.has(question.id) || conflictsRef.current.has(question.id) || persistenceRef.current !== 'available') return;
    cancelScheduledAutosave();
    persistRef.current(question.id, 'save-draft');
  }, [cancelScheduledAutosave, question]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    // Once another reviewer is signed in, nothing typed here belongs to the
    // page's reviewer (the editor is read-only too; this guards the handler).
    if (!question || persistenceRef.current === 'identity-changed') return;
    const next = clampReviewText(event.target.value, REVIEW_COMMENTS_TEXT_LIMIT);
    caretRef.current.set(question.id, event.target.selectionStart ?? next.length);
    const existing = draftsRef.current.get(question.id);
    const row = rowsRef.current.get(question.id) ?? null;
    setDraft(question.id, { text: next, base: existing ? existing.base : row ? row.revision : null, source: 'typed' }, userKeyRef.current);
    setOutcome(question.id, null);
    // Typing keeps an open conflict (its choices stay) and updates what Keep mine saves.
    const conflict = conflictsRef.current.get(question.id);
    if (conflict) updateConflict(question.id, { ...conflict, localText: next });
  };
  const submitResponse = () => {
    if (!question || conflictsRef.current.has(question.id)) return;
    cancelScheduledAutosave();
    // Submit exactly the text on screen when pressed; later typing is a new draft.
    persistRef.current(question.id, 'submit', draftText);
  };
  const retryPersistence = () => {
    if (!manifestSha256) return;
    setPersistence('loading');
    setBootstrapAttempt((attempt) => attempt + 1);
  };
  /*
   * When a question opens from Previous/Next, Jump to topic or the URL, its row
   * may be off screen and the control that opened it has unmounted with the old
   * editor: bring the new row into view (the workspace owns scrolling) and keep
   * keyboard focus on the equivalent control. A row the reader clicked is
   * already in view and keeps its own focus.
   */
  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const pendingRevealRef = useRef<'previous' | 'next' | 'jump' | 'url' | null>(question ? 'url' : null);
  useLayoutEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending || !question) return;
    pendingRevealRef.current = null;
    const row = rowRefs.current.get(question.number);
    if (!row) return;
    revealElement?.(row, pending === 'url' ? 'url' : 'selection');
    if (pending === 'previous' || pending === 'next') {
      // At either end the same control is disabled: keep focus in the row
      // (the other navigation control, else the row's own toggle), never <body>.
      const target = row.querySelector<HTMLElement>(`[data-question-nav="${pending}"]:not(:disabled)`)
        ?? row.querySelector<HTMLElement>('[data-question-nav]:not(:disabled)')
        ?? row.querySelector<HTMLElement>(`[data-testid="review-question-toggle-q${question.number}"]`);
      target?.focus({ preventScroll: true });
    }
  }, [question, revealElement]);
  const handledOpenRequestRef = useRef(openRequest);
  useLayoutEffect(() => {
    if (openRequest === handledOpenRequestRef.current) return;
    handledOpenRequestRef.current = openRequest;
    if (!question) return;
    const row = rowRefs.current.get(question.number);
    if (!row || row.closest('[inert]')) return;
    revealElement?.(row, 'selection');
    row.querySelector<HTMLElement>(`[data-testid="review-question-toggle-q${question.number}"]`)?.focus({ preventScroll: true });
  }, [openRequest, question, revealElement]);
  const selectQuestionWithSave = (number: number, reveal: 'jump' | null = null) => {
    saveDraftNow();
    pendingRevealRef.current = reveal;
    onSelectQuestion(number);
  };
  const closeQuestionWithSave = () => {
    saveDraftNow();
    pendingRevealRef.current = null;
    onCloseQuestion?.();
  };
  const currentIndex = questions.findIndex((candidate) => candidate.number === question?.number);
  const total = questions.length;
  const textFor = (item: Question) => drafts.get(item.id)?.text ?? rowText(rowForQuestion(rows, item.id));
  const stateFor = (number: number): ReviewProgressState => {
    const item = questions.find((candidate) => candidate.number === number);
    if (!item) return 'not-started';
    const saved = progressState(rowForQuestion(rows, item.id), '');
    // Unsaved text (or an open conflict) is never shown as a saved draft. A
    // submitted response with newer unsaved edits reads "changed since
    // submission" -- still counted as submitted, and still not claimed saved.
    // A draft that is not stored anywhere says so ("lost on reload"), never "in this browser".
    if (drafts.has(item.id) || conflicts.has(item.id)) return saved === 'submitted' || saved === 'changed' ? 'changed' : pageOnly.has(item.id) ? 'draft-page' : 'draft-local';
    return saved;
  };
  const groupedTopics = topics && topics.length > 0 ? topics : fallbackTopics(questions);
  const navQuestion = groupedTopics.flatMap((topic) => topic.questions).find((item) => item.number === question?.number);
  const questionTopic = groupedTopics.find((topic) => topic.questions.some((item) => item.number === question?.number));
  const citation = question ? headingCitation(question.heading) : null;
  const highlightNumber = highlightQuestionNumber ?? question?.number;
  const conflict = question ? conflicts.get(question.id) ?? null : null;
  const hasSubmission = activeRow?.submitted_revision !== null && activeRow?.submitted_revision !== undefined;
  const submitLabel = hasSubmission ? 'Re-submit response' : 'Submit response';
  const activeState: ReviewProgressState = question ? stateFor(question.number) : 'not-started';
  const updatedAt = formatTimestamp(activeRow?.updated_at);
  const submittedAt = formatTimestamp(activeRow?.submitted_at);
  const activeOutcome = question ? outcomes.get(question.id) : undefined;
  const activePending = question ? pendingMutationQuestionIds.has(question.id) : false;
  const lastSavedAt = question ? lastSavedAtRef.current.get(question.id) : undefined;
  // Where the active question's text is: in this browser only for a verified
  // reviewer whose copy was written (predictive before the first keystroke).
  const storedInBrowser = Boolean(userKey) && !(question && pageOnly.has(question.id));
  const keptWhere = storedInBrowser ? 'Your text is kept in this browser only.' : 'Your text is kept on this page only -- this browser is not storing it, so do not reload.';
  const rowStatusText = activeState === 'submitted'
    ? `Submitted${submittedAt ? ` ${submittedAt}` : ''}. Editing creates a new draft; re-submit to replace it.`
    : activeState === 'changed'
      ? `Changed since submission${submittedAt ? ` (submitted ${submittedAt})` : ''}. Re-submit to update your submitted response.`
      : activeState === 'draft'
        ? `Draft saved${activeOutcome === 'saved' && lastSavedAt ? ` ${lastSavedAt}` : updatedAt ? ` ${updatedAt}` : ''}. Not submitted yet.`
        : 'Not started';
  const statusText = conflict ? 'Conflict: choose which version to keep'
    : activePending ? 'Saving...'
      : activeOutcome === 'offline' ? `Not saved to the review record. ${keptWhere}`
        : activeOutcome === 'error' ? `Could not save. ${keptWhere} Try again.`
          : activeOutcome === 'throttled' ? `Too many saves in the last minute. ${keptWhere} Wait a moment, then save again.`
          : activeDraft ? (persistence === 'available' ? 'Unsaved changes' : `Draft not saved to the review record yet. ${keptWhere}`)
            : persistence === 'loading' ? 'Loading your saved responses...'
              : rowStatusText;
  const persistenceReason = persistence === 'available' ? null
    : persistence === 'loading' ? 'Saving becomes available once your saved responses have loaded.'
      : persistence === 'unauthenticated' ? (storedInBrowser ? 'Sign in again in another tab, then select Try again here. Until then, what you type is kept in this browser only.' : 'Sign in again in another tab, then select Try again here. What you type is on this page only and is lost if you reload or leave.')
        : persistence === 'identity-changed' ? (userKey && !hasPageOnlyDrafts ? 'A different reviewer is now signed in on this browser, so saving here is stopped. Reload the page to continue. Unsaved text stays in this browser for the reviewer who typed it.' : 'A different reviewer is now signed in on this browser, so saving here is stopped. This browser is not storing your unsaved text -- copy it before you reload.')
        : storedInBrowser ? 'Saving to the review record is not available yet. What you type is kept in this browser only.' : 'Saving to the review record is not available yet. What you type is on this page only and is lost if you reload or leave.';
  const blankText = draftText.trim().length === 0;
  const actionReason = persistenceReason ?? (conflict ? 'Choose Keep mine or Use saved to resolve the conflict first.' : blankText ? 'Write a response before submitting.' : null);
  const buttonBase = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] disabled:cursor-not-allowed disabled:opacity-55';
  const secondaryButton = cn(buttonBase, 'border border-[var(--db-border-strong)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]');
  const primaryButton = cn(buttonBase, 'bg-[var(--db-accent)] text-[var(--db-text-on-accent)] hover:bg-[var(--db-accent-strong)]');
  const keepMine = () => {
    if (!question || !conflict || conflict.questionId !== question.id || !questions.some((item) => item.id === conflict.questionId)) return;
    if (inFlightRef.current.has(conflict.questionId)) return;
    cancelScheduledAutosave();
    // Keep the reviewer's version (typing during the conflict updates it), now
    // knowingly based on the conflicting revision.
    setDraft(conflict.questionId, { text: conflict.localText, base: conflict.row.revision, source: 'typed' }, userKeyRef.current);
    persistRef.current(conflict.questionId, 'save-draft', undefined, { duringConflict: true });
  };
  const useSaved = () => {
    const saved = conflict?.row;
    if (!question || !conflict || !saved || conflict.questionId !== question.id || !questions.some((item) => item.id === conflict.questionId)) return;
    if (inFlightRef.current.has(conflict.questionId)) return;
    cancelScheduledAutosave();
    // Never roll back: if a newer row has arrived since the conflict, that is the saved version.
    mergeRow(saved);
    setDraft(conflict.questionId, null, userKeyRef.current);
    updateConflict(conflict.questionId, null);
    setOutcome(conflict.questionId, null);
  };

  return (
    <section ref={responseRef} tabIndex={-1} data-testid="active-question-response" aria-labelledby="review-questions-heading" className="min-w-0 space-y-4 focus:outline-none focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-dashed focus-visible:outline-[var(--db-border-strong)] print:hidden">
      <ReviewProgressTracker topics={groupedTopics} stateFor={stateFor} currentQuestionNumber={highlightNumber} />

      <div className="min-w-0">
        <label className="block text-sm font-semibold text-[var(--db-text-primary)]" htmlFor="review-jump-to-topic">Jump to topic</label>
        <select id="review-jump-to-topic" data-testid="question-navigation" value={question?.number ?? ''} onChange={(event) => { if (event.target.value) selectQuestionWithSave(Number(event.target.value), 'jump'); }} className="mt-1 block min-h-[44px] w-full min-w-0 rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface)] px-3 py-2 text-sm text-[var(--db-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]">
          {/* Nothing open: a neutral first option, so choosing ANY question (even the highlighted one) is a change. */}
          {question ? null : <option value="">Choose a question</option>}
          {groupedTopics.map((topic) => (
            <optgroup key={topic.id} label={topic.label}>
              {topic.questions.map((item) => <option key={item.id} value={item.number}>Question {item.number}: {questionPromptSummary(questions.find((candidate) => candidate.number === item.number)?.prompt ?? item.title)}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {sectionNote ? <p data-testid="review-section-note" role="status" className="text-xs text-[var(--db-text-secondary)]">{sectionNote}</p> : null}

      <div className="min-w-0">
        <h3 id="review-questions-heading" className="text-sm font-semibold text-[var(--db-text-primary)]">Questions</h3>
        <ol data-testid="review-question-index" className="mt-2 space-y-4">
          {groupedTopics.map((topic) => (
            <li key={topic.id} className="min-w-0">
              <h4 className="text-xs font-semibold text-[var(--db-text-secondary)]">{topic.label}</h4>
              <ul className="mt-1 space-y-1">
                {topic.questions.map((item) => {
                  const guideQuestion = questions.find((candidate) => candidate.number === item.number);
                  if (!guideQuestion) return null;
                  const state = stateFor(item.number);
                  const text = textFor(guideQuestion);
                  const open = item.number === question?.number;
                  const highlighted = item.number === highlightNumber;
                  return (
                    <li
                      key={item.id}
                      ref={(element) => { if (element) rowRefs.current.set(item.number, element); else rowRefs.current.delete(item.number); }}
                      data-testid={`review-question-row-q${item.number}`}
                      data-open={open ? 'true' : 'false'}
                      data-highlighted={highlighted ? 'true' : 'false'}
                      // Below lg the page scrolls under the sticky header: a revealed row lands
                      // below it, so its focused toggle is never covered (lg: the rail scrolls itself).
                      className={cn('min-w-0 scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] rounded-md lg:scroll-mt-0', open && 'border border-[var(--db-border-strong)] bg-[var(--db-surface)]')}
                    >
                      <button
                        type="button"
                        data-testid={`review-question-toggle-q${item.number}`}
                        aria-expanded={open}
                        aria-controls={open ? `review-question-panel-${item.number}` : undefined}
                        aria-current={highlighted ? 'true' : undefined}
                        onClick={() => (open ? closeQuestionWithSave() : selectQuestionWithSave(item.number))}
                        className={cn('flex min-h-[44px] w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]', highlighted && !open ? 'bg-[var(--db-accent-tint)]' : 'hover:bg-[var(--db-depth-1)]')}
                      >
                        <span aria-hidden="true" className="mt-0.5 w-6 shrink-0 text-xs font-semibold tabular-nums text-[var(--db-text-secondary)]">Q{item.number}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="line-clamp-2 min-w-0 font-medium text-[var(--db-text-primary)]"><span className="sr-only">Question {item.number}: </span>{questionPromptSummary(guideQuestion.prompt)}</span>
                          <span className="text-xs text-[var(--db-text-secondary)]">{REVIEW_PROGRESS_STATE_TEXT[state]}</span>
                          {!open && text ? <span className="min-w-0 break-words text-xs text-[var(--db-text-muted)]">{preview(text)}</span> : null}
                        </span>
                        <ChevronDown aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0 text-[var(--db-text-secondary)] motion-safe:transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                      </button>
                      {open ? (
                        <div id={`review-question-panel-${item.number}`} role="region" aria-labelledby="active-question-heading" className="min-w-0 space-y-5 border-t border-[var(--db-border)] px-3 pb-3 pt-3">
                    <div className="min-w-0">
                      <p data-testid="review-question-context" className="text-xs text-[var(--db-text-secondary)]">{[questionTopic?.label, citation].filter(Boolean).join(' - ') || 'Review question'}</p>
                      <h5 id="active-question-heading" className="mt-0.5 text-base font-semibold leading-snug text-[var(--db-text-primary)]">{question ? `Question ${question.number}: ${navQuestion?.title ?? question.heading}` : 'Active review question'}</h5>
                      {question ? <div className="mt-3 text-sm leading-relaxed text-[var(--db-text-primary)]"><MathRenderer content={question.prompt} /></div> : <p className="mt-3 text-sm">No review question is selected.</p>}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <label htmlFor="review-comment-draft" className="text-sm font-semibold text-[var(--db-text-primary)]">Your response</label>
                        <button type="button" data-testid="review-editor-expand" aria-pressed={expanded} aria-controls="review-comment-draft" onClick={() => setExpanded((value) => !value)} className={cn(secondaryButton, 'border-transparent px-2 text-xs')}>
                          {expanded ? <Minimize2 aria-hidden="true" className="h-3.5 w-3.5" /> : <Maximize2 aria-hidden="true" className="h-3.5 w-3.5" />}
                          {expanded ? 'Collapse editor' : 'Expand editor'}
                        </button>
                      </div>
                      <textarea
                        id="review-comment-draft"
                        ref={textareaRef}
                        data-testid="review-comment-draft"
                        data-expanded={expanded ? 'true' : undefined}
                        value={draftText}
                        onChange={handleChange}
                        onSelect={(event) => { if (question) caretRef.current.set(question.id, event.currentTarget.selectionStart ?? 0); }}
                        onBlur={saveDraftNow}
                        disabled={!question}
                        readOnly={persistence === 'loading' || persistence === 'identity-changed'}
                        aria-busy={persistence === 'loading' || undefined}
                        maxLength={REVIEW_COMMENTS_TEXT_LIMIT}
                        aria-describedby="review-save-status"
                        className={cn('mt-1.5 block w-full resize-y rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface)] p-3 text-sm leading-relaxed text-[var(--db-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]', expanded ? 'h-[min(70vh,44rem)] min-h-80' : 'h-56 min-h-32')}
                      />
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <p data-testid="review-save-status" id="review-save-status" role="status" className="min-w-0 text-xs text-[var(--db-text-secondary)]">{statusText}</p>
                        <p aria-live={REVIEW_COMMENTS_TEXT_LIMIT - draftText.length <= REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD ? 'polite' : undefined} data-testid="review-comment-char-count" className="shrink-0 text-xs tabular-nums text-[var(--db-text-muted)]">{draftText.length} / {REVIEW_COMMENTS_TEXT_LIMIT}</p>
                      </div>
                    </div>

                    {conflict ? <div data-testid="review-conflict" className="rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] p-3 text-sm text-[var(--db-text-primary)]"><p className="font-semibold">This response changed in another tab.</p><p className="mt-2 whitespace-pre-wrap">Saved response: {rowText(conflict.row) || '(empty)'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={keepMine} disabled={persistence !== 'available' || pendingMutationQuestionIds.has(conflict.questionId)} className={secondaryButton}>Keep mine</button><button type="button" onClick={useSaved} disabled={persistence !== 'available' || pendingMutationQuestionIds.has(conflict.questionId)} className={primaryButton}>Use saved</button></div></div> : null}

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" data-testid="review-save-draft" disabled={!question || persistence !== 'available' || Boolean(conflict)} aria-describedby={persistenceReason || conflict ? 'review-action-reason' : undefined} onClick={saveDraftNow} className={cn(secondaryButton, 'flex-1')}>Save draft</button>
                        <button type="button" data-testid="review-submit" disabled={!question || persistence !== 'available' || Boolean(conflict) || blankText} aria-describedby={actionReason ? 'review-action-reason' : undefined} onClick={submitResponse} className={cn(primaryButton, 'flex-1')}>{submitLabel}</button>
                      </div>
                      {actionReason ? (
                        <div data-testid="review-action-reason" className="flex flex-wrap items-center gap-2">
                          <p id="review-action-reason" className="min-w-0 flex-1 text-xs text-[var(--db-text-secondary)]">{actionReason}</p>
                          {(persistence === 'unavailable' || persistence === 'unauthenticated') && manifestSha256 ? <button type="button" data-testid="review-persistence-retry" onClick={retryPersistence} className={cn(secondaryButton, 'text-xs')}>Try again</button> : null}
                        </div>
                      ) : null}
                      {hasSubmission && activeRow?.submitted_text && activeState === 'changed' ? (
                        <details data-testid="review-submitted-version" className="rounded-md border border-[var(--db-border)] p-3 text-sm">
                          <summary className="cursor-pointer font-semibold text-[var(--db-text-primary)]">Your submitted response{submittedAt ? ` (${submittedAt})` : ''}</summary>
                          <p className="mt-2 whitespace-pre-wrap text-[var(--db-text-primary)]">{activeRow.submitted_text}</p>
                        </details>
                      ) : null}
                    </div>

                    <div className="grid min-w-0 grid-cols-2 gap-2" data-testid="question-navigation-buttons">
                      <button type="button" data-question-nav="previous" disabled={!question || currentIndex <= 0} onClick={() => { saveDraftNow(); pendingRevealRef.current = 'previous'; onPreviousQuestion(); }} className={secondaryButton}><ChevronLeft aria-hidden="true" className="h-4 w-4" />Previous question</button>
                      <button type="button" data-question-nav="next" disabled={!question || currentIndex < 0 || currentIndex >= total - 1} onClick={() => { saveDraftNow(); pendingRevealRef.current = 'next'; onNextQuestion(); }} className={secondaryButton}>Next question<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
                    </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
