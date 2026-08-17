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

// v6 bumped storage key because the underlying document was completely replaced again (Section 7 and Appendices).
//
// v5 bumped storage key because the underlying document was completely replaced again.
//
// v4 bumped storage key because the underlying document structure was
// completely replaced with the revised Conceptual Rough Draft content,
// changing from 14 sections down to 15 new ones.
//
// v3 bumped storage key because the rendered Phase 2 Options Paper expanded
// from 7 H2 sections (1.0-7.0) to 11 (adds Appendices A-D) and Section 7.0
// was rewritten with the Smart Stagger phasing -- any stale v2 draft for
// Section 7 would critique content that no longer exists. v2 drafts are
// intentionally discarded on first mount, matching the v1->v2 pattern.
//
// v2 bumped storage key because internal state keys changed from heading-text
// to idx-stable form (v1 drafts are intentionally discarded on first mount).
const DRAFT_STORAGE_KEY = 'twg-matrix-review-draft-v6';
// Truncation provenance lives under its OWN key rather than being folded into the draft payload.
// Reason: the draft key's value shape is a flat {sectionKey: string} map that older builds wrote
// and still read. Changing that shape would mean bumping to v7 and discarding every draft written
// by the current build -- destroying user text in order to record that user text was destroyed.
// A separate key is additive: a v6 draft with no companion record simply reports no known loss.
//
// The key is DERIVED from DRAFT_STORAGE_KEY, not given its own independent version number, so the
// two are invalidated together. The truncation record is keyed by positional `h::<idx>` section
// keys, which only mean anything relative to one specific document version -- if the draft key
// bumps (the document was replaced) but this key did not move in lockstep, a leftover truncation
// record could survive under the old literal and later be read back against a DIFFERENT section
// of the NEW document that happens to share the same positional index. Deriving from the draft key
// means any future draft-key bump automatically retires the matching truncation record too.
const TRUNCATION_STORAGE_KEY = DRAFT_STORAGE_KEY + '-truncation';
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
  // How many characters the last edit to each field had to drop. 0 / absent means none.
  // This exists so truncation is ANNOUNCED rather than silent -- see handleCommentChange.
  const [truncatedBy, setTruncatedBy] = useState<Record<string, number>>(() => makeBareRecord<number>());
  // Fields restored from a draft saved by a PRE-PROVENANCE build: the value is exactly MAX_CHARS
  // long (consistent with having been silently clipped) and the truncation key is absent
  // entirely (that build never wrote one), so whether anything was lost -- and how much -- is
  // genuinely unknown. Kept separate from truncatedBy rather than encoded as a fake count,
  // because the amount is not known and must never be presented as if it were. See the restore
  // effect below and handleSubmit's confirmation gate.
  const [unknownProvenanceKeys, setUnknownProvenanceKeys] = useState<Record<string, true>>(() => makeBareRecord<true>());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set when the reviewer DECLINES the truncation confirmation, so Submit does not appear to
  // silently do nothing (window.confirm also returns false when a browser suppresses dialogs).
  // Cleared once a later submit attempt is confirmed.
  const [submitCancelledNote, setSubmitCancelledNote] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const sanitized = makeBareRecord<string>();
      // Truncation on the RESTORE path is announced too, not just on the live edit path.
      // This reads a value written to localStorage on a prior save, so an over-length value here
      // is legacy data from before this limit, or storage edited outside this component. Either
      // way the user is about to work on -- and submit -- a draft that is shorter than the one
      // they saved. Clipping it silently here would reproduce the exact defect this component's
      // change is meant to remove, one path over: `handleSave` writes the clipped value back and
      // the submission goes out short with no notice. So the restore path records what it dropped
      // and lets the same role="alert" report it.
      const restoredTruncation = makeBareRecord<number>();
      // Keys whose restored value is EXACTLY MAX_CHARS long, with no overflow of its own (a
      // shorter value cannot have been clipped, and a longer one already lands in
      // restoredTruncation above). This is the candidate set for the legacy-draft,
      // no-provenance case handled below via the TRUNCATION_STORAGE_KEY presence check.
      const atLimitKeys: string[] = [];
      for (const [k, v] of Object.entries(parsed)) {
        if (RESERVED_KEYS.has(k)) continue;
        if (typeof v !== 'string') continue;
        const overBy = Math.max(0, v.length - MAX_CHARS);
        sanitized[k] = overBy > 0 ? v.slice(0, MAX_CHARS) : v;
        if (overBy > 0) {
          restoredTruncation[k] = overBy;
        } else if (v.length === MAX_CHARS) {
          atLimitKeys.push(k);
        }
      }
      setComments(sanitized);

      // rawT === null means the truncation key is ABSENT ENTIRELY: this draft was saved by a
      // build that never wrote a companion truncation record at all (the pre-provenance build
      // that shipped before this defence existed). That is NOT the same as a present-but-empty
      // record: an empty {} written by the CURRENT build is a positive statement that nothing
      // was lost, and must keep meaning exactly that. Only in the absent case are the at-limit
      // keys above flagged as unknown-provenance -- a value sitting exactly on the cap with no
      // record either way could be an untouched full-length comment, or it could be the residue
      // of the pre-provenance clip this component exists to catch. There is no way to tell
      // which, so it is reported as unknown, never folded into a count and never reported as
      // zero.
      const rawT = window.localStorage.getItem(TRUNCATION_STORAGE_KEY);
      if (rawT === null) {
        if (atLimitKeys.length > 0) {
          const unknown = makeBareRecord<true>();
          for (const k of atLimitKeys) unknown[k] = true;
          setUnknownProvenanceKeys(unknown);
        }
        if (Object.keys(restoredTruncation).length > 0) setTruncatedBy(restoredTruncation);
        return;
      }

      // Merge two sources of truncation knowledge:
      //  (1) loss recorded when this draft was SAVED, read back from its own key. Without this a
      //      reviewer who saves, closes the tab and resumes cannot tell a genuinely-truncated
      //      comment from an intentional 5000-character one -- the stored string is exactly
      //      MAX_CHARS in both cases, so the value alone carries no evidence either way.
      //  (2) loss detected right now, if the stored string is somehow OVER the limit (a legacy
      //      draft, or storage edited outside this component).
      // Take the larger per key: a stored count is authoritative about what was already lost,
      // and a fresh overflow is authoritative about this restore.
      const merged = makeBareRecord<number>();
      try {
        const parsedT = JSON.parse(rawT);
        if (parsedT && typeof parsedT === 'object' && !Array.isArray(parsedT)) {
          for (const [k, v] of Object.entries(parsedT)) {
            if (RESERVED_KEYS.has(k)) continue;
            // Require a positive safe integer. Number.isFinite alone admits 0.5 (a
            // fractional character count) and 1e308 (a value that would blow up the
            // confirmation-dialog text) -- Number.isSafeInteger rejects both, plus
            // NaN and Infinity, in one check.
            if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) continue;
            merged[k] = v;
          }
        }
      } catch {
        /* corrupt truncation record - ignore, the draft itself is still usable */
      }
      for (const [k, v] of Object.entries(restoredTruncation)) {
        merged[k] = Math.max(merged[k] ?? 0, v);
      }
      if (Object.keys(merged).length > 0) setTruncatedBy(merged);
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
    const overBy = Math.max(0, value.length - MAX_CHARS);
    const clipped = overBy > 0 ? value.slice(0, MAX_CHARS) : value;
    // Record the loss so the UI can announce it. This branch is reachable only because the
    // textareas no longer carry maxLength: in a real browser maxLength truncates a paste
    // before onChange fires, so with it set this branch would not run for a paste, and a
    // warning built on it would be dead code that looks like a safeguard.
    //
    // SCOPE OF THAT CLAIM: it describes real browser behaviour, which the unit tests here do
    // NOT demonstrate -- jsdom does not enforce maxLength on programmatic input, so a unit
    // test reaches this branch under either design and cannot tell the two apart. What the
    // unit tests DO prove is the clipping arithmetic and that the alert reports the right
    // count. The browser premise is taken from the HTML spec, not verified in this repo.
    //
    // TRUNCATION IS A FACT ABOUT THE DRAFTING SESSION, NOT A GUESS FROM STRING SHAPE. Text was
    // lost from this field; editing the field afterwards does not make that untrue. Three
    // successive review rounds each found a new defect in a "same lineage vs replacement"
    // string-prefix heuristic that used to live here (a single backspace discarded the record;
    // an ordinary middle-of-the-text edit -- fixing a typo -- made neither string a prefix of
    // the other and discarded it the same way; and clearing the field to '' IS a prefix of the
    // old value, so the warning was wrongly RETAINED for a now-empty field). Refining the
    // heuristic again just changes which edit shape breaks it next. So there is no inference
    // from string shape at all:
    //   1. The accumulated count PERSISTS across edits, with NO exceptions -- carry the prior
    //      count forward and add this edit's own overBy on top when it drops MORE.
    //   2. This includes clearing the field to empty. An earlier version of this code cleared
    //      the record when the new value was empty, reasoning that an empty field has no text
    //      left for the warning to be about. That is exploitable: (a) paste an over-limit value
    //      -- it is clipped and the loss is recorded; (b) select-all and delete -- the record
    //      was wrongly cleared here; (c) press Undo, or otherwise retype the exact clipped
    //      text -- that edit has no overflow of its own, so nothing recreates the record. The
    //      submit gate then sees no loss and silently writes the clipped comment. Clearing a
    //      field does not mean the earlier loss stopped happening, so it must not clear the
    //      record.
    //   3. Any other case -- continuation, backspace, a middle-of-the-text edit, or a
    //      wholesale replacement with unrelated text that still fits under the limit -- keeps
    //      the accumulated count. The component cannot tell "different text" from "the same
    //      text, edited" by shape alone, and guessing wrong in either direction either loses a
    //      real warning or keeps reporting a stale one.
    // INVARIANT: truncation provenance for a field persists until the reviewer dismisses it
    // (the Dismiss button next to each alert, see handleDismissTruncation below) or a
    // submission successfully completes (see handleSubmit, which resets it). There is no
    // other automatic clearing path. Do not reintroduce an empty-field exception: it looks
    // like an obvious simplification but recreates the clear-and-restore exploit above.
    setTruncatedBy(prev => {
      const next = makeBareRecord<number>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k) && k !== key) next[k] = v;
      }
      const carried = prev[key] ?? 0;
      const updated = overBy > 0 ? carried + overBy : carried;
      if (updated > 0) next[key] = updated;
      return next;
    });
    setComments(prev => {
      const next = makeBareRecord<string>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k)) next[k] = v;
      }
      next[key] = clipped;
      return next;
    });
  };

  // Explicit reviewer dismissal: the component no longer infers "this record no longer
  // applies" from string shape (see handleCommentChange), so it needs a positive action from
  // the reviewer instead. Clears only the named field's entry.
  const handleDismissTruncation = (key: string) => {
    setTruncatedBy(prev => {
      const next = makeBareRecord<number>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k) && k !== key) next[k] = v;
      }
      return next;
    });
  };

  // Same explicit-dismissal invariant as handleDismissTruncation, for the unknown-provenance
  // notice (see unknownProvenanceKeys above). Kept as its own handler/state rather than reusing
  // handleDismissTruncation because the two can be true for the same field at once (a legacy
  // at-limit draft that the reviewer then edits into fresh overflow), and dismissing one must
  // not silently dismiss the other.
  const handleDismissUnknownProvenance = (key: string) => {
    setUnknownProvenanceKeys(prev => {
      const next = makeBareRecord<true>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k) && k !== key) next[k] = v;
      }
      return next;
    });
  };

  const handleSave = () => {
    if (typeof window === 'undefined') return;
    // Two INDEPENDENT writes, not one shared try. A single try around both meant a failure on
    // the second write (truncation provenance) reported "Unable to save draft locally" even
    // though the draft itself had already been written -- misinforming the reviewer about
    // whether their text is safe, AND leaving a persisted draft with stale/absent provenance,
    // silently reintroducing the exact silent-loss defect this component exists to prevent.
    // ORDER MATTERS, and it is the opposite of the obvious one. Provenance is written FIRST.
    //
    // An earlier revision wrote the draft first and the provenance second, on the reasoning that
    // the draft is the important artifact. That created a silent-loss path: if the draft write
    // succeeded and the provenance write then hit quota, the clipped draft was left RESUMABLE
    // with no record of what it had lost. On reload the stored value is exactly MAX_CHARS, which
    // produces no restored overflow and has no provenance to merge, so the submit gate sees zero
    // loss and writes the truncated comment with no confirmation -- exactly the defect this
    // component exists to prevent, reached through the save path.
    //
    // Writing provenance first inverts the failure: if provenance cannot be stored, NO resumable
    // draft is created, so there is no draft that could later be submitted unwarned. The reverse
    // orphan -- provenance stored with no draft -- is inert, because the restore effect reads the
    // draft first and returns early when there is none.
    try {
      window.localStorage.setItem(TRUNCATION_STORAGE_KEY, JSON.stringify(truncatedBy));
    } catch {
      alert(
        'Unable to save the truncation record (storage quota or access denied), so the draft was ' +
          'NOT saved either. Saving it without that record could let you resume and submit ' +
          'shortened text without being warned.'
      );
      return;
    }
    try {
      // JSON.stringify on a null-prototype object still serializes own keys.
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(comments));
    } catch {
      alert('Unable to save draft locally (storage quota or access denied).');
      return;
    }
    alert('Progress saved to local storage.');
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

    // Submit-time truncation confirmation. The inline role="alert" fires when the clip happens,
    // which may be many minutes and one page-resume before the reviewer presses Submit -- and a
    // notice they have scrolled past is not consent. Submitting is the irreversible moment (the
    // payload goes to matrix_reviews), so the loss is restated here and the reviewer chooses.
    // Reported independently by two reviewers as the gap that made the announcement ineffective.
    // Only count keys that correspond to a CURRENTLY RENDERED field. A heading can be removed
    // (document replaced, section renamed) while its stale h::<idx> entry lingers in
    // truncatedBy -- that key renders no inline alert and is absent from
    // buildCommentsPayload, so counting it here would have the dialog cite loss the reviewer
    // cannot find or act on.
    const headingKeys = new Set(headings.map(h => h.storageKey));
    const relevantEntries = Object.entries(truncatedBy).filter(
      ([k]) => k === GENERAL_KEY || headingKeys.has(k)
    );
    const droppedTotal = relevantEntries.reduce((sum, [, n]) => sum + n, 0);
    const knownFields = relevantEntries.length;

    // Same currently-rendered-field scoping as relevantEntries above, applied to the
    // unknown-provenance set (see unknownProvenanceKeys).
    const relevantUnknownKeys = Object.keys(unknownProvenanceKeys).filter(
      k => k === GENERAL_KEY || headingKeys.has(k)
    );
    const unknownFields = relevantUnknownKeys.length;

    if (droppedTotal > 0 || unknownFields > 0) {
      // Known-count loss and unknown-provenance loss are DIFFERENT KINDS OF FACT -- one is a
      // measured number, the other is a genuine unknown -- so they get separate sentences
      // rather than being merged into one count that would either fabricate a total or hide the
      // unknown case's uncertainty.
      const messageParts: string[] = [];
      if (droppedTotal > 0) {
        messageParts.push(
          `${droppedTotal.toLocaleString()} character${droppedTotal === 1 ? '' : 's'} ` +
            `${droppedTotal === 1 ? 'was' : 'were'} removed from ${knownFields} comment ` +
            `${knownFields === 1 ? 'field' : 'fields'} because the ${MAX_CHARS.toLocaleString()}-` +
            `character limit was exceeded. That text is not recoverable and will NOT be included ` +
            `in your submission.`
        );
      }
      if (unknownFields > 0) {
        messageParts.push(
          `${unknownFields} comment ${unknownFields === 1 ? 'field was' : 'fields were'} saved at ` +
            `the ${MAX_CHARS.toLocaleString()}-character limit by an earlier version of this form, ` +
            `which did not keep a record of how much text was cut. An UNKNOWN amount of text may ` +
            `be missing from ${unknownFields === 1 ? 'that field' : 'those fields'} and it cannot ` +
            `be recovered.`
        );
      }
      const proceed = window.confirm(messageParts.join('\n\n') + '\n\nSubmit anyway?');
      if (!proceed) {
        // window.confirm also returns false when a browser suppresses dialogs, and a
        // deliberate decline gives no other feedback -- without this, Submit appears to do
        // nothing. Name the loss and tell the reviewer what to do next.
        const noteParts: string[] = [];
        if (droppedTotal > 0) {
          noteParts.push(
            `${droppedTotal.toLocaleString()} character` +
              `${droppedTotal === 1 ? '' : 's'} ${droppedTotal === 1 ? 'is' : 'are'} still missing ` +
              `from ${knownFields} comment ${knownFields === 1 ? 'field' : 'fields'}`
          );
        }
        if (unknownFields > 0) {
          noteParts.push(
            `${unknownFields} comment ${unknownFields === 1 ? 'field has' : 'fields have'} an ` +
              `unknown amount of text missing from an earlier version of this form`
          );
        }
        setSubmitCancelledNote(
          `Submission was not sent: ${noteParts.join('; and ')}. Editing a field will NOT remove ` +
            `these warnings -- they carry forward across edits. If you still have the missing ` +
            `text, paste it back in (a shorter draft may fit under the limit). Otherwise, use the ` +
            `Dismiss control next to each notice to acknowledge the loss, then press Submit again ` +
            `to proceed.`
        );
        return;
      }
    }
    // A new attempt is proceeding past the confirmation gate (or none was needed) -- clear any
    // note left by an earlier decline.
    setSubmitCancelledNote(null);

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
        window.localStorage.removeItem(TRUNCATION_STORAGE_KEY);
      } catch {
        /* non-fatal */
      }
      setTruncatedBy(makeBareRecord<number>());
      setUnknownProvenanceKeys(makeBareRecord<true>());
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
          className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
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
                  className="w-full text-left text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 rounded"
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
        <div className="max-w-4xl mx-auto space-y-8 print:max-w-none">
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
            {/* Round-2 P2-2: document column is bg-white dark:bg-slate-950. */}
            <MathRenderer content={finalDraftContent || ''} fadeFrom="from-white dark:from-slate-950" />
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
              // Deliberately NO maxLength: the browser applies it by silently discarding the
              // tail of a paste before onChange fires, so a reviewer pasting a long comment
              // loses it with no scrollbar, no message and no way to tell. The limit is
              // enforced in handleCommentChange instead, which can report what it dropped.
              //
              // disabled while isSubmitting: an edit that lands during the in-flight submit's
              // awaits would be clipped and recorded by handleCommentChange, but the submission
              // was already built from the pre-edit render and unconditionally clears ALL
              // truncation provenance on success -- orphaning the new loss with no record and no
              // confirmation. Disabling the field for the duration removes that race entirely.
              disabled={isSubmitting}
              aria-describedby={`${GENERAL_KEY}-charcount`}
              placeholder="Overall thoughts on the methodology..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
              rows={4}
            />
            <div id={`${GENERAL_KEY}-charcount`} className={cn("text-right text-xs mt-1 transition-colors", (comments[GENERAL_KEY]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
              {comments[GENERAL_KEY]?.length || 0} / {MAX_CHARS}
            </div>
            {(truncatedBy[GENERAL_KEY] ?? 0) > 0 && (
              <p
                role="alert"
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start justify-between gap-2"
              >
                <span>
                  Your text was longer than the {MAX_CHARS.toLocaleString()} character limit, so{' '}
                  {(truncatedBy[GENERAL_KEY] ?? 0).toLocaleString()}{' '}
                  {(truncatedBy[GENERAL_KEY] ?? 0) === 1 ? 'character was' : 'characters were'} removed
                  from the end. Nothing past the limit has been kept.
                </span>
                <button
                  type="button"
                  onClick={() => handleDismissTruncation(GENERAL_KEY)}
                  // disabled while isSubmitting -- see the textarea's disabled comment above:
                  // dismissing during an in-flight submit would clear provenance the submission
                  // never carried, the same race the disabled textarea prevents for edits.
                  disabled={isSubmitting}
                  aria-label="Dismiss truncation notice for General Comments"
                  className="shrink-0 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                >
                  Dismiss
                </button>
              </p>
            )}
            {unknownProvenanceKeys[GENERAL_KEY] && (
              <p
                role="alert"
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start justify-between gap-2"
              >
                <span>
                  This comment was saved at the {MAX_CHARS.toLocaleString()} character limit by an
                  earlier version of this form, which did not record whether anything was cut. An
                  unknown amount of text may be missing, and it cannot be recovered.
                </span>
                <button
                  type="button"
                  onClick={() => handleDismissUnknownProvenance(GENERAL_KEY)}
                  disabled={isSubmitting}
                  aria-label="Dismiss unknown-provenance notice for General Comments"
                  className="shrink-0 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                >
                  Dismiss
                </button>
              </p>
            )}
          </div>

          {headings.map((h) => (
            <div key={h.storageKey} className="space-y-2">
              <label className="text-sm font-bold text-slate-900 dark:text-slate-100">Comments on {h.displayLabel}</label>
              <textarea
                value={comments[h.storageKey] || ''}
                onChange={(e) => handleCommentChange(h.storageKey, e.target.value)}
                // No maxLength -- see the General Comments textarea above for why.
                // disabled while isSubmitting -- see the General Comments textarea above: an
                // in-flight submit's payload is fixed at submit-start, so an edit landing during
                // its awaits would be clipped/recorded but never carried, orphaning provenance.
                disabled={isSubmitting}
                aria-describedby={`${h.storageKey}-charcount`}
                placeholder={`Specific feedback for ${h.displayLabel}...`}
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                rows={3}
              />
              <div id={`${h.storageKey}-charcount`} className={cn("text-right text-xs mt-1 transition-colors", (comments[h.storageKey]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
                {comments[h.storageKey]?.length || 0} / {MAX_CHARS}
              </div>
              {(truncatedBy[h.storageKey] ?? 0) > 0 && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start justify-between gap-2"
                >
                  <span>
                    Your text was longer than the {MAX_CHARS.toLocaleString()} character limit, so{' '}
                    {(truncatedBy[h.storageKey] ?? 0).toLocaleString()}{' '}
                    {(truncatedBy[h.storageKey] ?? 0) === 1 ? 'character was' : 'characters were'} removed
                    from the end. Nothing past the limit has been kept.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDismissTruncation(h.storageKey)}
                    // disabled while isSubmitting -- see the General Comments Dismiss button above.
                    disabled={isSubmitting}
                    aria-label={`Dismiss truncation notice for ${h.displayLabel}`}
                    className="shrink-0 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    Dismiss
                  </button>
                </p>
              )}
              {unknownProvenanceKeys[h.storageKey] && (
                <p
                  role="alert"
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-start justify-between gap-2"
                >
                  <span>
                    This comment was saved at the {MAX_CHARS.toLocaleString()} character limit by
                    an earlier version of this form, which did not record whether anything was
                    cut. An unknown amount of text may be missing, and it cannot be recovered.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDismissUnknownProvenance(h.storageKey)}
                    disabled={isSubmitting}
                    aria-label={`Dismiss unknown-provenance notice for ${h.displayLabel}`}
                    className="shrink-0 underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded disabled:opacity-60 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    Dismiss
                  </button>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          {submitCancelledNote && (
            <p
              role="status"
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-3"
            >
              {submitCancelledNote}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              // disabled while isSubmitting: Save Draft writes the CURRENT `comments` state to
              // localStorage. If it ran mid-submit it could persist a state the in-flight
              // submission never saw, or race the submit's own success-path localStorage
              // clears (see handleSubmit) -- see the textarea comments above for the underlying
              // in-flight-submit race this guards against.
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
