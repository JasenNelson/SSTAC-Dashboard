'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import MathRenderer from '@/components/MathRenderer';
import { createClient } from '@/lib/supabase/client';
import { clearReviewLocalDrafts, clearReviewLocalDraftsForVersion, isReviewDraftDrafted, migrateAnonymousReviewDraft, readReviewLocalDraft, REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY, REVIEW_LOCAL_BUFFER_TEXT_LIMIT, writeReviewLocalDraft } from '@/lib/matrix-options/paper/review-local-buffer';
import { reviewResponseRowSchema, reviewResponseStatusLabel } from '@/lib/matrix-options/paper/review-responses';
import type { ReviewResponseRow } from '@/lib/matrix-options/paper/review-responses';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

type Question = ReviewerGuideContract['questions'][number];
export const REVIEW_COMMENTS_TEXT_LIMIT = REVIEW_LOCAL_BUFFER_TEXT_LIMIT;
export const REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD = 1000;
type PersistenceState = 'loading' | 'available' | 'unavailable' | 'unauthenticated';
type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'offline' | 'conflict' | 'error';

interface ReviewBootstrap { readonly persistence?: 'available' | 'unavailable'; readonly userKey?: string; readonly rows?: readonly ReviewResponseRow[]; }
interface ConflictState { readonly questionId: string; readonly row: ReviewResponseRow; readonly localText: string; }

export interface ReviewCommentsPanelProps {
  readonly documentVersion: string;
  readonly manifestSha256?: string;
  readonly cohortId?: string | null;
  readonly questions: readonly Question[];
  readonly question: Question | undefined;
  readonly responseRef: RefObject<HTMLElement | null>;
  readonly onSelectQuestion: (number: number) => void;
  readonly onPreviousQuestion: () => void;
  readonly onNextQuestion: () => void;
}

function rowForQuestion(rows: ReadonlyMap<string, ReviewResponseRow>, questionId: string | undefined): ReviewResponseRow | null { return questionId ? rows.get(questionId) ?? null : null; }
function rowText(row: ReviewResponseRow | null): string { return row?.draft_text ?? row?.submitted_text ?? ''; }
function statusLabelText(status: ReturnType<typeof reviewResponseStatusLabel>): string {
  if (status === 'changed-since-submit') return 'Changed since submit';
  if (status === 'not-started') return 'Not started';
  if (status === 'submitted') return 'Submitted';
  return 'Drafted';
}

export function ReviewCommentsPanel({ documentVersion, manifestSha256 = '', cohortId, questions, question, responseRef, onSelectQuestion, onPreviousQuestion, onNextQuestion }: ReviewCommentsPanelProps) {
  const [persistence, setPersistence] = useState<PersistenceState>(manifestSha256 ? 'loading' : 'unavailable');
  const [userKey, setUserKey] = useState<string | null>(null);
  const [rows, setRows] = useState<ReadonlyMap<string, ReviewResponseRow>>(() => new Map());
  const rowsRef = useRef(rows);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [conflicts, setConflicts] = useState<ReadonlyMap<string, ConflictState>>(() => new Map());
  const [draftText, setDraftText] = useState<string>(() => question ? readReviewLocalDraft({ documentVersion, questionId: question.id }) : '');
  const loadedQuestionIdRef = useRef<string | undefined>(question?.id);
  const dirtyQuestionIdsRef = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAtRef = useRef<string | null>(null);
  const draftTextRef = useRef(draftText);
  const sessionGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const userKeyRef = useRef<string | null>(null);
  const knownUserKeysRef = useRef(new Set<string>());
  const bootstrapAbortRef = useRef<AbortController | null>(null);
  const mutationAbortRef = useRef(new Map<string, AbortController>());
  const mutationTokenRef = useRef(new Map<string, number>());
  const [pendingMutationQuestionIds, setPendingMutationQuestionIds] = useState<ReadonlySet<string>>(() => new Set());
  const pendingMutationQuestionIdsRef = useRef<ReadonlySet<string>>(new Set());
  const conflictsRef = useRef(conflicts);
  const activeQuestionIdRef = useRef<string | undefined>(question?.id);

  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { draftTextRef.current = draftText; }, [draftText]);
  useEffect(() => { userKeyRef.current = userKey; }, [userKey]);
  useEffect(() => { conflictsRef.current = conflicts; }, [conflicts]);

  const updateConflict = useCallback((questionId: string, conflict: ConflictState | null) => {
    const next = new Map(conflictsRef.current);
    if (conflict) next.set(questionId, conflict);
    else next.delete(questionId);
    conflictsRef.current = next;
    setConflicts(next);
  }, []);

  const markMutationPending = useCallback((questionId: string, pending: boolean) => {
    const next = new Set(pendingMutationQuestionIdsRef.current);
    if (pending) next.add(questionId);
    else next.delete(questionId);
    pendingMutationQuestionIdsRef.current = next;
    if (mountedRef.current) setPendingMutationQuestionIds(next);
  }, []);

  const applyBootstrap = useCallback((payload: ReviewBootstrap) => {
    const nextRows = new Map<string, ReviewResponseRow>();
    for (const row of payload.rows ?? []) {
      if (row.document_version !== documentVersion || row.manifest_sha256 !== manifestSha256 || !questions.some((item) => item.id === row.question_id)) continue;
      nextRows.set(row.question_id, row);
    }
    rowsRef.current = nextRows;
    setRows(nextRows);
    setPersistence(payload.persistence === 'available' ? 'available' : 'unavailable');
    setUserKey(payload.userKey ?? null);
    if (payload.userKey) { userKeyRef.current = payload.userKey; knownUserKeysRef.current.add(payload.userKey); }
    if (payload.userKey) for (const item of questions) migrateAnonymousReviewDraft({ documentVersion, questionId: item.id, userKey: payload.userKey });
    const active = rowForQuestion(nextRows, question?.id);
    const localText = question ? readReviewLocalDraft({ documentVersion, questionId: question.id, userKey: payload.userKey }) : '';
    const localWins = Boolean(question && (dirtyQuestionIdsRef.current.has(question.id) || isReviewDraftDrafted(localText)));
    setDraftText(localWins ? draftTextRef.current || localText : active ? rowText(active) : localText);
  }, [documentVersion, manifestSha256, question, questions]);

  useEffect(() => {
    if (!manifestSha256 || !/^[a-f0-9]{64}$/.test(manifestSha256) || typeof fetch !== 'function') return undefined;
    bootstrapAbortRef.current?.abort();
    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    const generation = sessionGenerationRef.current;
    let cancelled = false;
    const url = `/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(documentVersion)}&manifestSha256=${encodeURIComponent(manifestSha256)}`;
    void fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const payload = await response.json().catch(() => ({})) as ReviewBootstrap;
      if (!cancelled && !controller.signal.aborted && mountedRef.current && generation === sessionGenerationRef.current) { if (response.status === 401) setPersistence('unauthenticated'); else applyBootstrap(payload); }
    }).catch(() => { if (!cancelled && !controller.signal.aborted && mountedRef.current && generation === sessionGenerationRef.current) setPersistence('unavailable'); });
    return () => { cancelled = true; controller.abort(); if (bootstrapAbortRef.current === controller) bootstrapAbortRef.current = null; };
  }, [applyBootstrap, documentVersion, manifestSha256]);

  useEffect(() => {
    mountedRef.current = true;
    const mutationControllers = mutationAbortRef.current;
    return () => {
      mountedRef.current = false;
      sessionGenerationRef.current += 1;
      bootstrapAbortRef.current?.abort();
      mutationControllers.forEach((controller) => controller.abort());
      mutationControllers.clear();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const onSignedOut = () => {
      sessionGenerationRef.current += 1;
      bootstrapAbortRef.current?.abort();
      mutationAbortRef.current.forEach((controller) => controller.abort());
      mutationAbortRef.current.clear();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const previousUserKey = userKeyRef.current;
      if (previousUserKey) knownUserKeysRef.current.add(previousUserKey);
      knownUserKeysRef.current.forEach((knownUserKey) => clearReviewLocalDrafts(knownUserKey, documentVersion));
      clearReviewLocalDrafts(REVIEW_LOCAL_BUFFER_ANONYMOUS_USER_KEY, documentVersion);
      clearReviewLocalDraftsForVersion(documentVersion);
      knownUserKeysRef.current.clear();
      userKeyRef.current = null;
      pendingMutationQuestionIdsRef.current = new Set(); setPendingMutationQuestionIds(new Set());
      setUserKey(null); setRows(new Map()); rowsRef.current = new Map(); dirtyQuestionIdsRef.current.clear(); conflictsRef.current = new Map(); setConflicts(new Map()); setPersistence('unauthenticated'); setDraftText(''); draftTextRef.current = '';
    };
    window.addEventListener('matrix-options-auth-signed-out', onSignedOut);
    if (!manifestSha256) return () => window.removeEventListener('matrix-options-auth-signed-out', onSignedOut);
    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const client = createClient();
      subscription = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') onSignedOut(); }).data.subscription;
    } catch {
      // The server bootstrap remains authoritative if a browser client cannot initialize.
    }
    return () => { window.removeEventListener('matrix-options-auth-signed-out', onSignedOut); subscription?.unsubscribe(); };
  }, [documentVersion, manifestSha256]);

  useEffect(() => {
    if (question?.id !== loadedQuestionIdRef.current) {
      loadedQuestionIdRef.current = question?.id;
      activeQuestionIdRef.current = question?.id;
      const saved = rowForQuestion(rowsRef.current, question?.id);
      const nextText = saved ? rowText(saved) : (question ? readReviewLocalDraft({ documentVersion, questionId: question.id, userKey }) : '');
      draftTextRef.current = nextText;
      setDraftText(nextText);
      setSaveState('idle');
    }
  }, [question, documentVersion, userKey]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`;
  }, [draftText]);

  const cancelScheduledAutosave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const persist = useCallback(async (action: 'save-draft' | 'submit', text: string, questionId: string, expectedRevision: number | null) => {
    if (!userKey || !manifestSha256 || !cohortId) { if (mountedRef.current) setSaveState('offline'); return; }
    const generation = sessionGenerationRef.current;
    const previousController = mutationAbortRef.current.get(questionId);
    previousController?.abort();
    const controller = new AbortController();
    mutationAbortRef.current.set(questionId, controller);
    markMutationPending(questionId, true);
    const token = (mutationTokenRef.current.get(questionId) ?? 0) + 1;
    mutationTokenRef.current.set(questionId, token);
    setSaveState('saving');
    try {
      const response = await fetch(`/api/matrix-options/paper/reviews/${encodeURIComponent(questionId)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentVersion, manifestSha256, cohortId, action, text, expectedRevision }), signal: controller.signal });
      const payload = await response.json().catch(() => ({})) as { outcome?: string; row?: ReviewResponseRow | null };
      if (!mountedRef.current || controller.signal.aborted || generation !== sessionGenerationRef.current || mutationTokenRef.current.get(questionId) !== token) return;
      const parsedRow = payload.row === null || payload.row === undefined ? null : reviewResponseRowSchema.safeParse(payload.row);
      const savedRow = parsedRow?.success ? parsedRow.data : null;
      if (response.status === 409 && payload.outcome === 'stale_revision' && savedRow) {
        updateConflict(questionId, { questionId, row: savedRow, localText: text });
        if (activeQuestionIdRef.current === questionId) setSaveState('conflict');
        return;
      }
      if ((payload.outcome === 'ok' || payload.outcome === 'noop_already_submitted') && !savedRow) { if (activeQuestionIdRef.current === questionId) setSaveState('error'); return; }
      if (!response.ok || (payload.outcome !== 'ok' && payload.outcome !== 'noop_already_submitted')) { if (activeQuestionIdRef.current === questionId) setSaveState(response.status === 503 ? 'offline' : 'error'); return; }
      if (!savedRow) { if (activeQuestionIdRef.current === questionId) setSaveState('error'); return; }
      const nextRows = new Map(rowsRef.current); nextRows.set(questionId, savedRow); rowsRef.current = nextRows; setRows(nextRows);
      dirtyQuestionIdsRef.current.delete(questionId); writeReviewLocalDraft({ documentVersion, questionId, userKey }, ''); updateConflict(questionId, null);
      if (activeQuestionIdRef.current === questionId) { lastSavedAtRef.current = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); setSaveState('saved'); }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (mountedRef.current && generation === sessionGenerationRef.current && mutationTokenRef.current.get(questionId) === token && activeQuestionIdRef.current === questionId) setSaveState('offline');
    } finally {
      if (mutationAbortRef.current.get(questionId) === controller) {
        mutationAbortRef.current.delete(questionId);
        markMutationPending(questionId, false);
      }
    }
  }, [cohortId, documentVersion, manifestSha256, markMutationPending, updateConflict, userKey]);

  useEffect(() => {
    if (!question || !dirtyQuestionIdsRef.current.has(question.id) || persistence !== 'available') return undefined;
    cancelScheduledAutosave();
    const questionId = question.id; const text = draftText; const expectedRevision = rowForQuestion(rowsRef.current, questionId)?.revision ?? null;
    debounceRef.current = setTimeout(() => { void persist('save-draft', text, questionId, expectedRevision); }, 1500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cancelScheduledAutosave, draftText, persistence, persist, question]);

  const saveDraftNow = useCallback(() => {
    if (!question || !dirtyQuestionIdsRef.current.has(question.id)) return;
    cancelScheduledAutosave();
    void persist('save-draft', draftTextRef.current, question.id, rowForQuestion(rowsRef.current, question.id)?.revision ?? null);
  }, [cancelScheduledAutosave, persist, question]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!question) return;
    const next = event.target.value.slice(0, REVIEW_COMMENTS_TEXT_LIMIT);
    writeReviewLocalDraft({ documentVersion, questionId: question.id, userKey }, next); dirtyQuestionIdsRef.current.add(question.id); draftTextRef.current = next; setDraftText(next); setSaveState('unsaved'); updateConflict(question.id, null);
  };
  const submitResponse = () => {
    if (!question) return;
    cancelScheduledAutosave();
    void persist('submit', draftTextRef.current, question.id, rowForQuestion(rowsRef.current, question.id)?.revision ?? null);
  };
  const selectQuestionWithSave = (number: number) => { saveDraftNow(); onSelectQuestion(number); };
  const currentIndex = questions.findIndex((candidate) => candidate.number === question?.number);
  const total = questions.length;
  const draftedCount = questions.filter((item) => isReviewDraftDrafted(rowText(rowForQuestion(rows, item.id)) || readReviewLocalDraft({ documentVersion, questionId: item.id, userKey }))).length;
  const submittedCount = questions.filter((item) => reviewResponseStatusLabel(rowForQuestion(rows, item.id)) === 'submitted').length;
  const changedSinceSubmitCount = questions.filter((item) => reviewResponseStatusLabel(rowForQuestion(rows, item.id)) === 'changed-since-submit').length;
  const progressText = `Question ${currentIndex >= 0 ? currentIndex + 1 : 0} of ${total} - ${draftedCount} drafted - ${submittedCount} submitted - ${changedSinceSubmitCount} changed since submit`;
  const activeRow = rowForQuestion(rows, question?.id);
  const conflict = question ? conflicts.get(question.id) ?? null : null;
  const submitLabel = activeRow?.submitted_revision !== null && activeRow?.submitted_revision !== undefined ? 'Re-submit response' : 'Submit response';
  const statusText = saveState === 'saved' && lastSavedAtRef.current ? `Saved ${lastSavedAtRef.current}` : saveState === 'saving' ? 'Saving...' : saveState === 'unsaved' ? 'Unsaved changes' : saveState === 'offline' ? 'Saved locally; server persistence is unavailable' : saveState === 'conflict' ? 'Conflict: choose which version to keep' : saveState === 'error' ? 'Unable to save; your local draft is retained' : persistence === 'loading' ? 'Loading saved responses...' : persistence === 'unauthenticated' ? 'Sign in to save responses' : 'Ready';
  const keepMine = () => {
    if (!question || !conflict || conflict.questionId !== question.id || !questions.some((item) => item.id === conflict.questionId)) { if (question) setSaveState('error'); return; }
    if (mutationAbortRef.current.has(conflict.questionId)) return;
    cancelScheduledAutosave();
    void persist('save-draft', conflict.localText, conflict.questionId, conflict.row.revision);
  };
  const useSaved = () => {
    const saved = conflict?.row;
    if (!question || !conflict || !saved || conflict.questionId !== question.id || !questions.some((item) => item.id === conflict.questionId)) { if (question) setSaveState('error'); return; }
    if (mutationAbortRef.current.has(conflict.questionId)) return;
    cancelScheduledAutosave();
    const nextRows = new Map(rowsRef.current); nextRows.set(conflict.questionId, saved); rowsRef.current = nextRows; setRows(nextRows);
    dirtyQuestionIdsRef.current.delete(conflict.questionId);
    writeReviewLocalDraft({ documentVersion, questionId: conflict.questionId, userKey }, rowText(saved));
    updateConflict(conflict.questionId, null);
    draftTextRef.current = rowText(saved); setDraftText(rowText(saved)); setSaveState('saved');
  };

  return (
    <section ref={responseRef} tabIndex={-1} data-testid="active-question-response" aria-labelledby="active-question-heading" className="rounded-xl border border-slate-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-700 dark:bg-slate-900 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Review Comments</p><h3 id="active-question-heading" className="mt-1 text-lg font-bold">{question ? `Question ${question.number}: ${question.heading}` : 'Active review question'}</h3></div></div>
      {question ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"><MathRenderer content={question.prompt} /></div> : <p className="mt-4 text-sm">No authenticated question is selected.</p>}
      <div className="mt-4"><label htmlFor="review-comment-draft" className="block text-sm font-semibold">Your response</label><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Your draft is protected per signed-in user. It saves automatically and can be submitted when ready.</p><textarea id="review-comment-draft" ref={textareaRef} data-testid="review-comment-draft" value={draftText} onChange={handleChange} onBlur={saveDraftNow} disabled={!question} maxLength={REVIEW_COMMENTS_TEXT_LIMIT} className="mt-2 min-h-64 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-600 dark:bg-slate-950" /><div className="flex items-center justify-between gap-3"><p aria-live={REVIEW_COMMENTS_TEXT_LIMIT - draftText.length <= REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD ? 'polite' : undefined} data-testid="review-comment-char-count" className="mt-1 text-xs text-slate-500 dark:text-slate-400">{draftText.length} / {REVIEW_COMMENTS_TEXT_LIMIT}</p><p data-testid="review-save-status" role="status" className="mt-1 text-right text-xs font-semibold text-slate-600 dark:text-slate-300">{statusText}</p></div></div>
      {conflict ? <div data-testid="review-conflict" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><p className="font-semibold">This response changed in another tab.</p><p className="mt-2 whitespace-pre-wrap">Saved response: {rowText(conflict.row) || '(empty)'}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={keepMine} disabled={pendingMutationQuestionIds.has(conflict.questionId)} className="min-h-[44px] rounded-md border border-amber-700 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Keep mine</button><button type="button" onClick={useSaved} disabled={pendingMutationQuestionIds.has(conflict.questionId)} className="min-h-[44px] rounded-md bg-amber-800 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Use saved</button></div></div> : null}
      <div className="mt-5 grid min-w-0 grid-cols-2 gap-3" data-testid="question-navigation-buttons"><button type="button" disabled={!question || currentIndex <= 0} onClick={() => { saveDraftNow(); onPreviousQuestion(); }} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Previous question</button><button type="button" disabled={!question || currentIndex < 0 || currentIndex >= total - 1} onClick={() => { saveDraftNow(); onNextQuestion(); }} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Next question</button></div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!question || persistence !== 'available' || saveState === 'saving'} onClick={saveDraftNow} className="min-h-[44px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Save draft</button><button type="button" disabled={!question || persistence !== 'available' || saveState === 'saving'} onClick={submitResponse} className="min-h-[44px] flex-1 rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitLabel}</button></div>
      <hr className="my-5 border-slate-200 dark:border-slate-700" /><label className="block min-w-0 text-sm font-semibold" htmlFor="review-jump-to-topic">Jump to topic</label><select id="review-jump-to-topic" data-testid="question-navigation" value={question?.number ?? ''} onChange={(event) => selectQuestionWithSave(Number(event.target.value))} className="mt-1 block min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950">{questions.map((item) => <option key={item.id} value={item.number}>Question {item.number}: {item.heading}</option>)}</select>
      <p data-testid="review-progress" className="mt-4 text-sm font-semibold">{progressText}</p><div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saved questions</p><ul data-testid="review-saved-questions" className="mt-2 space-y-1">{questions.map((item) => { const row = rowForQuestion(rows, item.id); const local = readReviewLocalDraft({ documentVersion, questionId: item.id, userKey }); const label = reviewResponseStatusLabel(row) === 'not-started' && isReviewDraftDrafted(local) ? 'Drafted' : statusLabelText(reviewResponseStatusLabel(row)); const active = item.number === question?.number; return <li key={item.id}><button type="button" aria-current={active ? 'true' : undefined} onClick={() => selectQuestionWithSave(item.number)} className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${active ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><span className="min-w-0 break-words">Question {item.number}: {item.heading}</span><span className="shrink-0 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">{label}</span></button></li>; })}</ul></div>
    </section>
  );
}
