'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';

import MathRenderer from '@/components/MathRenderer';
import {
  countReviewLocalDrafted,
  isReviewDraftDrafted,
  readReviewLocalDraft,
  REVIEW_LOCAL_BUFFER_TEXT_LIMIT,
  writeReviewLocalDraft,
} from '@/lib/matrix-options/paper/review-local-buffer';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

type Question = ReviewerGuideContract['questions'][number];

/**
 * PLAN-R4 3.B.3: the draft textarea's enforced character limit. FIX CYCLE 1 /
 * F2: re-exported from review-local-buffer.ts, the single source of truth
 * (also enforced there on READ, so a restored buffered value can never exceed
 * it either), rather than a second, independently-defined literal here.
 */
export const REVIEW_COMMENTS_TEXT_LIMIT = REVIEW_LOCAL_BUFFER_TEXT_LIMIT;

/**
 * FIX CYCLE 1 / F5. The character count is a SINGLE accessible text node
 * always; it is announced live (`aria-live="polite"`) only once few enough
 * characters remain to matter (<= this many), so a 20000-char textarea does
 * not re-announce the count on every keystroke from the very first one.
 * Outside the threshold the paragraph carries no `aria-live` attribute at
 * all (not "off" -- simply absent), so it is not a live region at all.
 */
export const REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD = 1000;

/*
 * M2 right rail Review Comments (PLAN-R4 3.B.3). Extracted from M1's inline
 * ActiveQuestionResponse, which rendered the prompt and a read-only
 * placeholder only. This adds:
 *  - a growing textarea bound to the M2 local-buffer library (no network
 *    calls; every localStorage access there is already try/catch-wrapped);
 *  - a live character count enforcing REVIEW_COMMENTS_TEXT_LIMIT;
 *  - a "Question N of 12 - X drafted - Y submitted - Z changed since submit"
 *    progress line, where X is computed from the local buffer and Y/Z are
 *    computed via computeSubmittedCount/computeChangedSinceSubmitCount --
 *    both fixed at 0 in M2 (no submit mechanism exists yet), but as CALLS
 *    rather than inlined literals, so M3 can fill their real logic in without
 *    changing this progress-string call site;
 *  - a saved-questions list with a status chip per question (all 12, in
 *    cohort order) that resumes any question directly.
 *
 * `questions` is the FULL 12-question set in cohort order (not just the
 * active cohort's), so Prev/Next, the progress count and the saved-questions
 * list all read the same one canonical sequence (PLAN-R4 3.B.3 "order is all
 * 12 questions in cohort order").
 *
 * Honesty bar (PLAN-R4 section D): M2 is local-buffer-only. Nothing here may
 * imply a real server save. There is deliberately no "Save" or "Submit"
 * affordance; "submitted"/"changed since submit" are always 0 until M3 wires
 * real persistence, and the panel says plainly that a draft lives only in
 * this browser.
 *
 * Every interactive control here is a plain <button>, <textarea> or <select>
 * that never itself requests a scroll-authority panel reveal (it only calls
 * the handlers passed in, exactly like the M1 Prev/Next buttons and the
 * existing "Jump to topic" select already did) -- so it cannot trigger the
 * unresolved gesture-grouping risk recorded against scroll-authority.ts
 * (M2_GAP_INVENTORY.md section E; a checkbox/radio/label-caused reveal was
 * explicitly out of scope for M2 per the writer brief).
 */
export interface ReviewCommentsPanelProps {
  readonly documentVersion: string;
  /** All 12 questions, in cohort order (the one canonical M2 sequence). */
  readonly questions: readonly Question[];
  readonly question: Question | undefined;
  readonly responseRef: RefObject<HTMLElement | null>;
  readonly onSelectQuestion: (number: number) => void;
  readonly onPreviousQuestion: () => void;
  readonly onNextQuestion: () => void;
  /**
   * An authenticated user id, ONLY if one already reaches the workspace
   * through its existing props. None does today (verified: no user-identity
   * field exists in RevisedPaperWorkspaceProps or AssignmentState), so this is
   * always undefined in the current tree; see the M2 writer closeout.
   */
  readonly userKey?: string | null;
}

/** M3 will replace this with a real count from the persisted submit state. */
function computeSubmittedCount(): number {
  return 0;
}

/** M3 will replace this with a real count from the persisted submit state. */
function computeChangedSinceSubmitCount(): number {
  return 0;
}

export function ReviewCommentsPanel({ documentVersion, questions, question, responseRef, onSelectQuestion, onPreviousQuestion, onNextQuestion, userKey }: ReviewCommentsPanelProps) {
  const [draftText, setDraftText] = useState<string>(() => (question ? readReviewLocalDraft({ documentVersion, questionId: question.id, userKey }) : ''));
  const loadedQuestionIdRef = useRef<string | undefined>(question?.id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (question?.id !== loadedQuestionIdRef.current) {
      loadedQuestionIdRef.current = question?.id;
      setDraftText(question ? readReviewLocalDraft({ documentVersion, questionId: question.id, userKey }) : '');
    }
  }, [question, documentVersion, userKey]);

  // Grows with content, never below its 16rem minimum (min-h-64 class).
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [draftText]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!question) return;
    const next = event.target.value.slice(0, REVIEW_COMMENTS_TEXT_LIMIT);
    writeReviewLocalDraft({ documentVersion, questionId: question.id, userKey }, next);
    setDraftText(next);
  };

  const currentIndex = questions.findIndex((candidate) => candidate.number === question?.number);
  const total = questions.length;
  const draftedCount = countReviewLocalDrafted(documentVersion, questions.map((candidate) => candidate.id), userKey);
  const submittedCount = computeSubmittedCount();
  const changedSinceSubmitCount = computeChangedSinceSubmitCount();
  const progressText = `Question ${currentIndex >= 0 ? currentIndex + 1 : 0} of ${total} - ${draftedCount} drafted - ${submittedCount} submitted - ${changedSinceSubmitCount} changed since submit`;

  return (
    <section ref={responseRef} tabIndex={-1} data-testid="active-question-response" aria-labelledby="active-question-heading" className="rounded-xl border border-slate-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-700 dark:bg-slate-900 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Review Comments</p>
          <h3 id="active-question-heading" className="mt-1 text-lg font-bold">{question ? `Question ${question.number}: ${question.heading}` : 'Active review question'}</h3>
        </div>
      </div>
      {question ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"><MathRenderer content={question.prompt} /></div> : <p className="mt-4 text-sm">No authenticated question is selected.</p>}

      <div className="mt-4">
        <label htmlFor="review-comment-draft" className="block text-sm font-semibold">Your response</label>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Kept only in this browser until saving is available. It is not sent anywhere yet.</p>
        <textarea
          id="review-comment-draft"
          ref={textareaRef}
          data-testid="review-comment-draft"
          value={draftText}
          onChange={handleChange}
          disabled={!question}
          maxLength={REVIEW_COMMENTS_TEXT_LIMIT}
          className="mt-2 min-h-64 w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-600 dark:bg-slate-950"
        />
        <p aria-live={REVIEW_COMMENTS_TEXT_LIMIT - draftText.length <= REVIEW_COMMENTS_CHAR_COUNT_LIVE_THRESHOLD ? 'polite' : undefined} data-testid="review-comment-char-count" className="mt-1 text-right text-xs text-slate-500 dark:text-slate-400">{draftText.length} / {REVIEW_COMMENTS_TEXT_LIMIT}</p>
      </div>

      <div data-testid="question-navigation-buttons" className="mt-5 grid min-w-0 grid-cols-2 gap-3">
        <button type="button" disabled={!question || currentIndex <= 0} onClick={onPreviousQuestion} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Previous question</button>
        <button type="button" disabled={!question || currentIndex < 0 || currentIndex >= total - 1} onClick={onNextQuestion} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Next question</button>
      </div>

      <hr className="my-5 border-slate-200 dark:border-slate-700" />

      <label className="block min-w-0 text-sm font-semibold" htmlFor="review-jump-to-topic">Jump to topic</label>
      <select id="review-jump-to-topic" data-testid="question-navigation" value={question?.number ?? ''} onChange={(event) => onSelectQuestion(Number(event.target.value))} className="mt-1 block min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950">
        {questions.map((item) => <option key={item.id} value={item.number}>Question {item.number}: {item.heading}</option>)}
      </select>

      <p data-testid="review-progress" className="mt-4 text-sm font-semibold">{progressText}</p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Saved questions</p>
        <ul data-testid="review-saved-questions" className="mt-2 space-y-1">
          {questions.map((item) => {
            const drafted = isReviewDraftDrafted(readReviewLocalDraft({ documentVersion, questionId: item.id, userKey }));
            const active = item.number === question?.number;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => onSelectQuestion(item.number)}
                  className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${active ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <span className="min-w-0 break-words">Question {item.number}: {item.heading}</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${drafted ? 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-100' : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'}`}>{drafted ? 'Drafted' : 'Not started'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
