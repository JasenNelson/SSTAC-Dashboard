'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import MathRenderer from './MathRenderer';
import { cn } from '@/utils/cn';
import { createClient } from '@/lib/supabase/client';

interface TWGReviewPortalProps {
  finalDraftContent: string;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
}

// v3 bumped storage key because the rendered Phase 2 Options Paper expanded
// from 7 H2 sections (1.0-7.0) to 11 (adds Appendices A-D) and Section 7.0
// was rewritten with the Smart Stagger phasing -- any stale v2 draft for
// Section 7 would critique content that no longer exists. v2 drafts are
// intentionally discarded on first mount, matching the v1->v2 pattern.
//
// v2 bumped storage key because internal state keys changed from heading-text
// to idx-stable form (v1 drafts are intentionally discarded on first mount).
const DRAFT_STORAGE_KEY = 'twg-matrix-review-draft-v3';
const MAX_CHARS = 5000;
const GENERAL_KEY = 'general';

// Reserved JS prototype-pollution keys. Never accepted as user-controlled map
// keys, even though all maps are created with Object.create(null) below.
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

type HeadingEntry = {
  idx: number;
  text: string;
  storageKey: string;   // stable internal key, safe to use as object index
  displayLabel: string; // user-visible label, disambiguated on duplicates
};

// Build a plain object whose prototype chain is null, so user-controlled keys
// cannot mutate Object.prototype and lookups never walk up to it.
function makeBareRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export default function TWGReviewPortal({ finalDraftContent, showLeftPanel = true, showRightPanel = true }: TWGReviewPortalProps) {
  const [comments, setComments] = useState<Record<string, string>>(() => makeBareRecord<string>());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const sanitized = makeBareRecord<string>();
      for (const [k, v] of Object.entries(parsed)) {
        if (RESERVED_KEYS.has(k)) continue;
        if (typeof v !== 'string') continue;
        sanitized[k] = v.slice(0, MAX_CHARS);
      }
      setComments(sanitized);
    } catch {
      /* corrupt draft - ignore */
    }
  }, []);

  const headings = useMemo<HeadingEntry[]>(() => {
    if (!finalDraftContent) return [];
    const regex = /^##\s+(.*)$/gm;
    const texts: string[] = [];
    let match;
    while ((match = regex.exec(finalDraftContent)) !== null) {
      texts.push(match[1].trim());
    }
    // Disambiguate duplicate heading text. Use Object.create(null) so a heading
    // literally named "__proto__" cannot poison the counts map.
    const counts = makeBareRecord<number>();
    for (const t of texts) counts[t] = (counts[t] ?? 0) + 1;
    const seen = makeBareRecord<number>();
    return texts.map((text, idx) => {
      const n = (seen[text] = (seen[text] ?? 0) + 1);
      const displayLabel = counts[text] > 1 ? `${text} (#${n})` : text;
      return { idx, text, storageKey: `h::${idx}`, displayLabel };
    });
  }, [finalDraftContent]);

  const scrollToHeading = (idx: number) => {
    // Scope to the rendered draft container so unrelated H2s in the page
    // chrome (e.g., "Final Master Draft") don't shift indices.
    const root = contentRef.current;
    if (!root) return;
    const target = root.querySelectorAll('h2')[idx];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCommentChange = (key: string, value: string) => {
    if (RESERVED_KEYS.has(key)) return;
    const clipped = value.length > MAX_CHARS ? value.slice(0, MAX_CHARS) : value;
    setComments(prev => {
      const next = makeBareRecord<string>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k)) next[k] = v;
      }
      next[key] = clipped;
      return next;
    });
  };

  const handleSave = () => {
    if (typeof window === 'undefined') return;
    try {
      // JSON.stringify on a null-prototype object still serializes own keys.
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(comments));
      alert('Progress saved to local storage.');
    } catch {
      alert('Unable to save draft locally (storage quota or access denied).');
    }
  };

  // Map internal storage keys to user-readable labels for the DB payload.
  // The admin view renders payload keys as section headers, so we keep them
  // human-readable and disambiguate duplicate H2s with "(#n)" suffixes.
  // Returns a normal {}-prototype object (not null-prototype) so the JSONB
  // serializer and downstream consumers see a vanilla shape.
  const buildCommentsPayload = (): Record<string, string> => {
    const out: Record<string, string> = {};
    const general = comments[GENERAL_KEY];
    if (typeof general === 'string' && general.length > 0) {
      out['General'] = general;
    }
    for (const h of headings) {
      const v = comments[h.storageKey];
      if (typeof v === 'string' && v.length > 0 && !RESERVED_KEYS.has(h.displayLabel)) {
        out[h.displayLabel] = v;
      }
    }
    return out;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const supabase = createClient();

      // Verified user check: getUser() round-trips to the auth server,
      // unlike getSession() which trusts local cookie state.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert('You must be logged in to submit a review.');
        return;
      }

      // matrix_reviews has no UNIQUE(user_id) constraint, so onConflict can't be
      // used. The RLS INSERT WITH CHECK (auth.uid() = user_id) and UPDATE USING
      // (auth.uid() = user_id) policies are the authoritative gates. Look up the
      // user's existing row and UPDATE in place, otherwise INSERT a new one, so
      // re-submits don't accumulate duplicate rows. The isSubmitting guard above
      // prevents the same client from racing itself between SELECT and INSERT.
      const { data: existing, error: lookupError } = await supabase
        .from('matrix_reviews')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        console.error('Error looking up existing review:', lookupError);
        alert('There was an error submitting your review.');
        return;
      }

      const payload = buildCommentsPayload();
      const writeResult = existing
        ? await supabase
            .from('matrix_reviews')
            .update({ status: 'SUBMITTED', poll_data: {}, comments_data: payload })
            .eq('id', existing.id)
        : await supabase
            .from('matrix_reviews')
            .insert({ user_id: user.id, status: 'SUBMITTED', poll_data: {}, comments_data: payload });

      if (writeResult.error) {
        console.error('Error submitting review:', writeResult.error);
        alert('There was an error submitting your review.');
        return;
      }

      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        /* non-fatal */
      }
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl animate-in fade-in zoom-in duration-300 w-full h-full">
        <svg className="w-16 h-16 text-emerald-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mb-2">Review Submitted</h2>
        <p className="text-emerald-700 dark:text-emerald-400 text-center max-w-lg mb-6">
          Your comprehensive review has been logged and flagged for author consideration. Thank you!
        </p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          Return to Draft
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Left Sidebar (TOC). Hidden in print so window.print() produces a
          chrome-free PDF of just the paper body. */}
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col print:hidden', showLeftPanel ? 'w-80' : 'w-0')}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">TABLE OF CONTENTS</h3>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <ul className="space-y-3">
            {headings.map((h) => (
              <li key={h.storageKey}>
                <button
                  type="button"
                  onClick={() => scrollToHeading(h.idx)}
                  className="w-full text-left text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:rounded"
                >
                  {h.displayLabel}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Center Content (Document). In print, override the scroll
          container so the full paper expands instead of clipping to the
          visible scrollport. */}
      <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 px-8 py-10 sm:px-12 print:flex-none print:overflow-visible print:h-auto print:p-0">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header card with title + Download (PDF) action. The whole card
              is hidden in print so the PDF starts at the paper body. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Final Master Draft</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Review the concatenated policy options below.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
              aria-label="Download Final Master Draft as PDF (opens browser print dialog)"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Draft (PDF)
            </button>
          </div>
          <div ref={contentRef}>
            <MathRenderer content={finalDraftContent || ''} />
          </div>
        </div>
      </div>

      {/* Right Drawer (Comments). Hidden in print -- reviewer drafts are
          working notes, not part of the published PDF. */}
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col relative print:hidden', showRightPanel ? 'w-96' : 'w-0')}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-3">
            <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Section Comments</span>
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
            Reviews can be saved and updated at any time. Submitting simply flags your review as ready for author consideration.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 pb-32">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-100">General Comments</label>
            <textarea
              value={comments[GENERAL_KEY] || ''}
              onChange={(e) => handleCommentChange(GENERAL_KEY, e.target.value)}
              maxLength={MAX_CHARS}
              placeholder="Overall thoughts on the methodology..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
              rows={4}
            />
            <div className={cn("text-right text-xs mt-1 transition-colors", (comments[GENERAL_KEY]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
              {comments[GENERAL_KEY]?.length || 0} / {MAX_CHARS}
            </div>
          </div>

          {headings.map((h) => (
            <div key={h.storageKey} className="space-y-2">
              <label className="text-sm font-bold text-slate-900 dark:text-slate-100">Comments on {h.displayLabel}</label>
              <textarea
                value={comments[h.storageKey] || ''}
                onChange={(e) => handleCommentChange(h.storageKey, e.target.value)}
                maxLength={MAX_CHARS}
                placeholder={`Specific feedback for ${h.displayLabel}...`}
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                rows={3}
              />
              <div className={cn("text-right text-xs mt-1 transition-colors", (comments[h.storageKey]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
                {comments[h.storageKey]?.length || 0} / {MAX_CHARS}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <button 
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Save Draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </>
  );
}
