'use client';

// JermilovaReviewPortal -- collaborative-review portal for the Jermilova
// BN-RRM construction methodology paper.
//
// Forked from src/components/TWGReviewPortal.tsx with two material UX
// differences:
//   1. Save-edit-resubmit semantics: after SUBMITTED, the user stays on
//      the same editing screen with a "Submitted" indicator + can keep
//      editing freely. Submit just flips the status flag so the admin
//      pool gets notified; it does NOT lock the row.
//   2. Initial DB load + cross-device resume: on mount, fetch the user's
//      existing row from document_reviews and pre-populate. localStorage
//      stays as a draft layer for unsynced in-flight edits, but the DB is
//      the source of truth across sessions and devices.
//
// Writes to public.document_reviews with document_id='jermilova_bnrrm'.
// RLS policies (see supabase/migrations/20260517_document_reviews.sql)
// enforce that users can only touch their own row; column-level GRANTs
// limit INSERT to user_id+document_id+status+comments_data and UPDATE to
// status+comments_data (id, created_at, updated_at are auto-managed and
// effectively immutable from the client).
//
// Same prototype-pollution-safe shape as TWGReviewPortal: all comment
// maps use Object.create(null), reserved keys are filtered everywhere a
// user-controlled string could end up as a key.
//
// !! LOAD-BEARING UI FEATURES (do NOT remove during cleanup) !!
//
// Panel-collapse toggle controls (2026-05-17 layout fix; restored via
// PR #138 on 2026-05-20 after silent regression):
//   - The portal owns LIVE toggle state for the TOC + Comments side
//     panels. Props `initialShowLeftPanel` / `initialShowRightPanel`
//     seed the FIRST render only; subsequent prop changes are
//     intentionally ignored so a parent re-render does not overwrite
//     a user's manual collapse.
//   - In-header collapse buttons (`twg-toc-collapse` + `twg-comments-collapse`)
//     and floating reopen handles (`twg-toc-reopen` + `twg-comments-reopen`).
//   - aria-expanded + aria-controls wired to stable element ids
//     (`TOC_PANEL_ID` + `COMMENTS_PANEL_ID`); aria-hidden + inert on the
//     collapsed panel so screen readers + keyboard focus do not enter it.
//   - Focus handoff: on collapse, focus moves from the in-header button
//     to the floating reopen handle (WCAG 2.4.3 visible-focus).
//
// 7 regression tests at JermilovaReviewPortal.test.tsx prefix with
// `REGRESSION:` to lock these behaviors. Standing rule
// `cross_project_never_delete_regression_tests_during_cleanup` (HIGH
// AUTHORITY) forbids deleting those tests during lint / test / codex
// cleanup; fix the test (update prop name / import / selector) instead.
//
// Registry: docs/regression-watch.md

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import MathRenderer from '../MathRenderer';
import { cn } from '@/utils/cn';
import { createClient } from '@/lib/supabase/client';

interface JermilovaReviewPortalProps {
  methodologyContent: string;
  // Initial-state defaults for the side panels. Renamed from
  // showLeftPanel/showRightPanel in 2026-05-17 layout fix: the portal now
  // owns the LIVE toggle state internally so users can collapse / reopen the
  // TOC and the Comments panel via the on-portal chevron controls. The props
  // are honored once at mount; subsequent prop changes are intentionally
  // ignored (React useState semantics) so a parent re-render does not
  // overwrite a user's manual collapse.
  initialShowLeftPanel?: boolean;
  initialShowRightPanel?: boolean;
}

// Stable element ids for aria-controls wiring on the toggle buttons.
const TOC_PANEL_ID = 'twg-toc-panel';
const COMMENTS_PANEL_ID = 'twg-comments-panel';

const DOCUMENT_ID = 'jermilova_bnrrm';
const DRAFT_STORAGE_KEY = `document-review-draft-${DOCUMENT_ID}-v1`;
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

type ReviewStatus = 'IN_PROGRESS' | 'SUBMITTED';

// Build a plain object whose prototype chain is null, so user-controlled keys
// cannot mutate Object.prototype and lookups never walk up to it.
function makeBareRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export default function JermilovaReviewPortal({
  methodologyContent,
  initialShowLeftPanel = true,
  initialShowRightPanel = true,
}: JermilovaReviewPortalProps) {
  // Live toggle state owned by the portal. The Initial* props seed only the
  // first render; subsequent prop changes are intentionally NOT synced so a
  // parent re-render does not override a user's manual collapse choice.
  const [showLeftPanel, setShowLeftPanel] = useState(initialShowLeftPanel);
  const [showRightPanel, setShowRightPanel] = useState(initialShowRightPanel);
  // Refs for the four toggle controls + a "pending focus target" flag that
  // a useEffect drains after the panel-collapse state update commits. Without
  // this, a keyboard user pressing Enter on a collapse button has the focused
  // button become `inert` (the panel it lives in collapses), which strips
  // focus to <body> -- a WCAG 2.4.3 Focus Order regression. The pending-flag
  // pattern moves focus to the reopen handle (or back to the collapse button
  // on reopen) after the commit phase, so keyboard navigation flows
  // continuously between paired controls.
  const tocCollapseRef = useRef<HTMLButtonElement | null>(null);
  const tocReopenRef = useRef<HTMLButtonElement | null>(null);
  const commentsCollapseRef = useRef<HTMLButtonElement | null>(null);
  const commentsReopenRef = useRef<HTMLButtonElement | null>(null);
  type PendingFocusTarget =
    | 'tocCollapse'
    | 'tocReopen'
    | 'commentsCollapse'
    | 'commentsReopen'
    | null;
  const pendingFocusRef = useRef<PendingFocusTarget>(null);
  const [comments, setComments] = useState<Record<string, string>>(() => makeBareRecord<string>());
  const [status, setStatus] = useState<ReviewStatus>('IN_PROGRESS');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasExistingRow, setHasExistingRow] = useState(false);
  // Dirty-key tracking for the per-key merge on save (codex R1 P1 fix).
  // Each entry is a storageKey (h::N or GENERAL_KEY) that the user has
  // touched in THIS tab since the last successful save. On save we re-fetch
  // the latest DB row and overlay only these keys onto the remote payload,
  // preventing two-tab whole-row last-writer-wins data loss.
  const dirtyKeysRef = useRef<Set<string>>(new Set());
  // Live mirror of `comments` state. React state in callbacks is captured
  // at render time, so a callback that fires while a save is awaiting can
  // read a stale `comments`. Routing through a ref gives the save-cleanup
  // step the latest value (codex R4 P1).
  const commentsLiveRef = useRef<Record<string, string>>(makeBareRecord<string>());
  // True when initial load failed (SELECT errored). Blocks DB writes until
  // a successful re-fetch -- otherwise Save/Submit could overwrite an
  // existing remote row with locally-empty state (codex R1 P2 fix).
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // ----- Heading extraction (TOC + per-section keys) ---------------------
  const headings = useMemo<HeadingEntry[]>(() => {
    if (!methodologyContent) return [];
    const regex = /^##\s+(.*)$/gm;
    const texts: string[] = [];
    let match;
    while ((match = regex.exec(methodologyContent)) !== null) {
      texts.push(match[1].trim());
    }
    const counts = makeBareRecord<number>();
    for (const t of texts) counts[t] = (counts[t] ?? 0) + 1;
    const seen = makeBareRecord<number>();
    return texts.map((text, idx) => {
      const n = (seen[text] = (seen[text] ?? 0) + 1);
      const displayLabel = counts[text] > 1 ? `${text} (#${n})` : text;
      return { idx, text, storageKey: `h::${idx}`, displayLabel };
    });
  }, [methodologyContent]);

  // ----- Initial load: fetch user's existing row from document_reviews ---
  // Pre-populate comments + status + lastSavedAt from the DB row.
  // localStorage is consulted ONLY when the DB has no row OR the DB row's
  // updated_at predates the local draft (cross-device merge case).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user }, error: getUserErr } = await supabase.auth.getUser();
        if (cancelled) return;
        if (getUserErr || !user) {
          setAuthError('You must be signed in to view or write a review.');
          setIsLoading(false);
          return;
        }
        const { data: row, error: selectErr } = await supabase
          .from('document_reviews')
          .select('id, status, comments_data, updated_at')
          .eq('user_id', user.id)
          .eq('document_id', DOCUMENT_ID)
          .maybeSingle();
        if (cancelled) return;
        if (selectErr) {
          // Load failed -- preserve any prior localStorage draft so
          // subsequent dirty-only setItem writes don't destroy it (codex
          // R7+R8 P2). Helper is shared with the catch path below.
          seedDraftIntoStateOnLoadFailure();
          setLoadError(selectErr.message);
          setInitialLoadFailed(true);
          setIsLoading(false);
          return;
        }
        setInitialLoadFailed(false);

        // Read localStorage draft (sanitized; same shape as TWG portal).
        let localDraft: Record<string, string> | null = null;
        try {
          const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const sanitized = makeBareRecord<string>();
              for (const [k, v] of Object.entries(parsed)) {
                if (RESERVED_KEYS.has(k)) continue;
                if (typeof v !== 'string') continue;
                sanitized[k] = v.slice(0, MAX_CHARS);
              }
              localDraft = sanitized;
            }
          }
        } catch {
          /* corrupt draft - ignore */
        }

        if (row) {
          setHasExistingRow(true);
          // DB is source of truth for fresh sessions / cross-device. Map
          // payload (human-readable section labels) back into storage-key
          // shape so the comment textareas render correctly.
          const dbComments = makeBareRecord<string>();
          const payload =
            (row.comments_data ?? {}) as Record<string, unknown>;
          // General key
          const gen = payload['General'];
          if (typeof gen === 'string') dbComments[GENERAL_KEY] = gen;
          // Per-heading: payload uses displayLabel as key; map back via headings list.
          for (const h of headings) {
            const v = payload[h.displayLabel];
            if (typeof v === 'string') dbComments[h.storageKey] = v;
          }
          // If a local draft exists, overlay onto DB so unsynced edits
          // aren't lost. CRITICAL (codex R2 P1-2): values from the local
          // draft must be marked as dirty so the next Save actually
          // persists them; without this, the UI would display the draft
          // but Save would no-op against the remote row + then clear
          // localStorage, silently losing the draft.
          // Restore draft keys onto the DB-loaded comments. Distinguish
          // two cases per key (codex R4 P2 -- prevent a stale empty-string
          // draft from blindly deleting a remote value updated on another
          // device):
          //   (a) draft value is non-empty: always overlay (latest device
          //       wins for any key it has typed content for).
          //   (b) draft value is empty: only overlay if the DB ALSO has
          //       no value for that key. Otherwise the empty draft would
          //       overwrite a remote update the user can't yet see on
          //       this device.
          // In both cases the overlay key is marked dirty so the next
          // Save persists it.
          const draftHasKeys =
            localDraft !== null && Object.keys(localDraft).length > 0;
          if (draftHasKeys) {
            for (const [k, v] of Object.entries(localDraft as Record<string, string>)) {
              if (RESERVED_KEYS.has(k)) continue;
              const remoteHasValue = typeof dbComments[k] === 'string' && dbComments[k].length > 0;
              if (v.length === 0 && remoteHasValue) {
                // Stale empty-deletion draft + non-empty remote -- skip
                // overlay; trust the remote. The user can re-clear the
                // field if they still want that deletion.
                continue;
              }
              dbComments[k] = v;
              dirtyKeysRef.current.add(k);
            }
          }
          setComments(dbComments);
          commentsLiveRef.current = dbComments;
          setStatus((row.status ?? 'IN_PROGRESS') as ReviewStatus);
          setLastSavedAt(row.updated_at ?? null);
        } else if (localDraft) {
          // No DB row but a local draft exists -- start from draft. All
          // restored draft keys are dirty (need to be persisted on Save).
          setComments(localDraft);
          commentsLiveRef.current = localDraft;
          for (const k of Object.keys(localDraft)) {
            if (!RESERVED_KEYS.has(k)) dirtyKeysRef.current.add(k);
          }
        }
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        // Codex R2 P2-2: a throw on the load path must also block writes,
        // not just the handled selectErr branch. Otherwise Save/Submit
        // would still be enabled after an auth/network throw and could
        // overwrite the remote row with locally-empty state.
        // Codex R8 P2: also preserve the prior draft via the shared seeder
        // so dirty-only setItem on subsequent edits doesn't drop it.
        seedDraftIntoStateOnLoadFailure();
        setLoadError(err instanceof Error ? err.message : String(err));
        setInitialLoadFailed(true);
        setIsLoading(false);
      }
    })();

    // Shared helper for the two load-failure branches above. Reads
    // localStorage, sanitizes, populates state + dirtyKeysRef.
    function seedDraftIntoStateOnLoadFailure() {
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
          dirtyKeysRef.current.add(k);
        }
        if (Object.keys(sanitized).length > 0) {
          setComments(sanitized);
          commentsLiveRef.current = sanitized;
        }
      } catch {
        /* corrupt draft - ignore, banner already explains state */
      }
    }
    return () => {
      cancelled = true;
    };
    // headings is intentionally included so changes to the source MD
    // (different displayLabel set) re-map DB comments correctly.
  }, [headings]);

  // Drain the pending-focus flag after panel-collapse state commits. Runs
  // exactly when showLeftPanel or showRightPanel changes; the target ref
  // resolves to the freshly-rendered button (collapse or reopen handle
  // depending on the new state).
  useEffect(() => {
    const target = pendingFocusRef.current;
    if (target === null) return;
    pendingFocusRef.current = null;
    switch (target) {
      case 'tocReopen':
        tocReopenRef.current?.focus();
        break;
      case 'tocCollapse':
        tocCollapseRef.current?.focus();
        break;
      case 'commentsReopen':
        commentsReopenRef.current?.focus();
        break;
      case 'commentsCollapse':
        commentsCollapseRef.current?.focus();
        break;
    }
  }, [showLeftPanel, showRightPanel]);

  // Paired toggle handlers. Set the pending-focus flag BEFORE the state
  // update so the post-commit useEffect can move focus to the next visible
  // control without flashing focus through <body>.
  const collapseLeftPanel = () => {
    pendingFocusRef.current = 'tocReopen';
    setShowLeftPanel(false);
  };
  const reopenLeftPanel = () => {
    pendingFocusRef.current = 'tocCollapse';
    setShowLeftPanel(true);
  };
  const collapseRightPanel = () => {
    pendingFocusRef.current = 'commentsReopen';
    setShowRightPanel(false);
  };
  const reopenRightPanel = () => {
    pendingFocusRef.current = 'commentsCollapse';
    setShowRightPanel(true);
  };

  const scrollToHeading = (idx: number) => {
    const root = contentRef.current;
    if (!root) return;
    const target = root.querySelectorAll('h2')[idx];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCommentChange = (key: string, value: string) => {
    if (RESERVED_KEYS.has(key)) return;
    const clipped = value.length > MAX_CHARS ? value.slice(0, MAX_CHARS) : value;
    setComments((prev) => {
      const next = makeBareRecord<string>();
      for (const [k, v] of Object.entries(prev)) {
        if (!RESERVED_KEYS.has(k)) next[k] = v;
      }
      next[key] = clipped;
      // Mirror to commentsLiveRef so async callbacks see the latest value
      // even when their closure captured an earlier render's state
      // (codex R4 P1).
      commentsLiveRef.current = next;
      return next;
    });
    // Track which keys this tab has touched so save can merge per-key
    // against the latest DB row instead of replacing the whole comments_data
    // (codex R1 P1 fix).
    dirtyKeysRef.current.add(key);
    // Persist ONLY dirty keys to localStorage (codex R5 P2). Persisting
    // DB-loaded-but-untouched values would let them appear as a "draft"
    // on a future reload + clobber another device's edits via the
    // restore path. The draft layer must reflect only this tab's actual
    // edits.
    try {
      const draftToStore: Record<string, string> = {};
      for (const dirty of dirtyKeysRef.current) {
        if (RESERVED_KEYS.has(dirty)) continue;
        draftToStore[dirty] = commentsLiveRef.current[dirty] ?? '';
      }
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftToStore));
    } catch {
      /* non-fatal */
    }
  };

  // Map a storageKey (h::N or GENERAL_KEY) back to the human-readable
  // payload key that the admin pool renders. Returns null for unknown keys
  // (defensive -- the dirty-key set should only contain known keys).
  const storageKeyToPayloadKey = useCallback(
    (key: string): string | null => {
      if (key === GENERAL_KEY) return 'General';
      for (const h of headings) {
        if (h.storageKey === key) return h.displayLabel;
      }
      return null;
    },
    [headings],
  );

  // ----- Save / submit (DB write with per-key merge) --------------------
  // persistToDb re-fetches the LATEST row from the DB and merges only the
  // keys this tab has touched (dirtyKeysRef) into the remote comments_data
  // before writing back. This makes saves per-key last-writer-wins instead
  // of whole-row last-writer-wins, so two tabs / two devices editing
  // different sections do NOT clobber each other (codex R1 P1 fix).
  //
  // For a fresh INSERT (no existing row) the dirty-key concept doesn't
  // apply; we send the full local payload as the initial row.
  // persistToDb takes snapshots of dirty keys + comments at call time so
  // edits made WHILE the async save is in flight do not leak into this
  // write (codex R2 P1-1). The handler clears only the snapshotted dirty
  // keys on success, preserving any newly-dirtied keys for the next save.
  // statusIntent encodes the user's INTENT: 'submit' flips status to
  // SUBMITTED unconditionally; 'save' preserves the remote status so a
  // stale Save in tab A cannot downgrade a SUBMITTED row that tab B
  // already flipped (codex R2 P2-1).
  const persistToDb = useCallback(
    async (
      statusIntent: 'save' | 'submit',
      dirtyKeysSnapshot: ReadonlySet<string>,
      commentsSnapshot: Record<string, string>,
    ): Promise<{ ok: boolean; error?: string; writtenStatus?: ReviewStatus }> => {
      const supabase = createClient();
      const { data: { user }, error: getUserErr } = await supabase.auth.getUser();
      if (getUserErr || !user) {
        return { ok: false, error: 'You must be signed in.' };
      }
      // Re-fetch the current row (id + remote status + remote comments_data)
      // for merge. Avoids the upsert-with-onConflict UPDATE-SET-immutable-
      // column trap (column-level GRANTs reject SET user_id=...).
      const { data: existing, error: selectErr } = await supabase
        .from('document_reviews')
        .select('id, status, comments_data')
        .eq('user_id', user.id)
        .eq('document_id', DOCUMENT_ID)
        .maybeSingle();
      if (selectErr) {
        return { ok: false, error: selectErr.message };
      }
      if (existing) {
        // Status resolution:
        //  - Submit always wins (sets to SUBMITTED). It is a deliberate
        //    user action and dominates whatever the remote state was.
        //  - Save preserves the remote status; if the remote is already
        //    SUBMITTED (set by another tab/device after this tab loaded
        //    as IN_PROGRESS), Save must NOT downgrade it back to
        //    IN_PROGRESS.
        const remoteStatus =
          (existing.status === 'SUBMITTED' || existing.status === 'IN_PROGRESS')
            ? existing.status
            : 'IN_PROGRESS';
        const writeStatus: ReviewStatus =
          statusIntent === 'submit' ? 'SUBMITTED' : remoteStatus;
        // Merge per-key: start from remote payload, overlay snapshotted
        // dirty keys with snapshotted comment values. Empty-string dirty
        // keys mean the user cleared the field -- delete from payload.
        const remotePayload =
          (existing.comments_data ?? {}) as Record<string, unknown>;
        const merged: Record<string, string> = {};
        for (const [k, v] of Object.entries(remotePayload)) {
          if (RESERVED_KEYS.has(k)) continue;
          if (typeof v === 'string') merged[k] = v;
        }
        for (const dirtyKey of dirtyKeysSnapshot) {
          const payloadKey = storageKeyToPayloadKey(dirtyKey);
          if (!payloadKey || RESERVED_KEYS.has(payloadKey)) continue;
          const localValue = commentsSnapshot[dirtyKey] ?? '';
          if (localValue.length === 0) {
            delete merged[payloadKey];
          } else {
            merged[payloadKey] = localValue;
          }
        }
        const { error: updateErr } = await supabase
          .from('document_reviews')
          .update({ status: writeStatus, comments_data: merged })
          .eq('id', existing.id);
        if (updateErr) return { ok: false, error: updateErr.message };
        return { ok: true, writtenStatus: writeStatus };
      } else {
        // No row yet -- INSERT the snapshotted local payload. For initial
        // INSERT, dirty-key concept doesn't apply (no remote payload to
        // merge against); send everything in commentsSnapshot.
        const payload: Record<string, string> = {};
        const general = commentsSnapshot[GENERAL_KEY];
        if (typeof general === 'string' && general.length > 0) {
          payload['General'] = general;
        }
        for (const h of headings) {
          const v = commentsSnapshot[h.storageKey];
          if (typeof v === 'string' && v.length > 0 && !RESERVED_KEYS.has(h.displayLabel)) {
            payload[h.displayLabel] = v;
          }
        }
        const writeStatus: ReviewStatus =
          statusIntent === 'submit' ? 'SUBMITTED' : 'IN_PROGRESS';
        const { error: insertErr } = await supabase
          .from('document_reviews')
          .insert({
            user_id: user.id,
            document_id: DOCUMENT_ID,
            status: writeStatus,
            comments_data: payload,
          });
        if (insertErr) return { ok: false, error: insertErr.message };
        return { ok: true, writtenStatus: writeStatus };
      }
    },
    [headings, storageKeyToPayloadKey],
  );

  // Both handlers snapshot dirtyKeys + values at call entry. On success
  // we clear a dirty key ONLY IF the current value still matches what was
  // saved (codex R3 P1). If the user retyped the same key during the
  // await, the current value diverges + the key stays dirty for the next
  // Save -- preserving the in-flight edit instead of silently dropping it.
  const handleSave = async () => {
    if (isSaving || isSubmitting) return;
    if (initialLoadFailed) {
      alert(
        'Cannot save: initial load failed. Reload the page after the connection recovers so your edits merge against the latest remote state. Your edits stay in local storage.',
      );
      return;
    }
    const dirtyKeysSnapshot = new Set(dirtyKeysRef.current);
    const commentsSnapshot: Record<string, string> = {};
    for (const [k, v] of Object.entries(comments)) {
      if (!RESERVED_KEYS.has(k)) commentsSnapshot[k] = v;
    }
    setIsSaving(true);
    try {
      const result = await persistToDb('save', dirtyKeysSnapshot, commentsSnapshot);
      if (!result.ok) {
        alert(`Save failed: ${result.error}`);
        return;
      }
      setLastSavedAt(new Date().toISOString());
      setHasExistingRow(true);
      // Mirror the WRITTEN status (from the re-SELECTed remote) into
      // local state. If another tab flipped to SUBMITTED while this tab
      // was IN_PROGRESS, persistToDb('save') correctly preserves
      // SUBMITTED on the row, and this line propagates that to the UI
      // (Submitted badge + Re-submit button label). Codex holistic
      // 2026-05-17 P3 fix.
      if (result.writtenStatus) setStatus(result.writtenStatus);
      clearReconciledDirtyKeys(dirtyKeysSnapshot, commentsSnapshot);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || isSaving) return;
    if (initialLoadFailed) {
      alert(
        'Cannot submit: initial load failed. Reload the page after the connection recovers so your edits merge against the latest remote state. Your edits stay in local storage.',
      );
      return;
    }
    const dirtyKeysSnapshot = new Set(dirtyKeysRef.current);
    const commentsSnapshot: Record<string, string> = {};
    for (const [k, v] of Object.entries(comments)) {
      if (!RESERVED_KEYS.has(k)) commentsSnapshot[k] = v;
    }
    setIsSubmitting(true);
    try {
      const result = await persistToDb('submit', dirtyKeysSnapshot, commentsSnapshot);
      if (!result.ok) {
        alert(`Submit failed: ${result.error}`);
        return;
      }
      setStatus('SUBMITTED');
      setLastSavedAt(new Date().toISOString());
      setHasExistingRow(true);
      clearReconciledDirtyKeys(dirtyKeysSnapshot, commentsSnapshot);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clear only the dirty keys whose CURRENT value still matches the
  // snapshotted value at save time. If the user retyped during the await,
  // the current comments[k] diverges from commentsSnapshot[k] and we leave
  // the key dirty so the next Save persists the new edit. Also flush
  // localStorage only when no dirty keys remain (codex R3 P1).
  function clearReconciledDirtyKeys(
    snapshot: ReadonlySet<string>,
    valuesAtSave: Record<string, string>,
  ) {
    // Read live state via ref (NOT `comments` closure) so a re-edit that
    // happened during the save's await is observed correctly. Codex R4 P1.
    const liveComments = commentsLiveRef.current;
    for (const k of snapshot) {
      const currentValue = liveComments[k] ?? '';
      const savedValue = valuesAtSave[k] ?? '';
      if (currentValue === savedValue) {
        dirtyKeysRef.current.delete(k);
      }
      // else: user retyped during await; key stays dirty for next Save.
    }
    // Always rewrite localStorage to reflect remaining dirty keys ONLY
    // (codex R6 P2). If we cleared all reconciled keys and the set is now
    // empty, drop the storage entry entirely. Otherwise, rewrite it with
    // ONLY the still-dirty keys -- never leave previously-persisted clean
    // keys in storage where a future reload would re-mark them dirty.
    try {
      if (dirtyKeysRef.current.size === 0) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } else {
        const draftToStore: Record<string, string> = {};
        for (const dirty of dirtyKeysRef.current) {
          if (RESERVED_KEYS.has(dirty)) continue;
          draftToStore[dirty] = commentsLiveRef.current[dirty] ?? '';
        }
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftToStore));
      }
    } catch {
      /* non-fatal */
    }
  }

  // ----- Render ---------------------------------------------------------
  if (authError) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Sign in required
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{authError}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 dark:border-slate-600 border-t-sky-500 rounded-full animate-spin" />
          <span className="text-sm">Loading your review...</span>
        </div>
      </div>
    );
  }

  return (
    // Codex P1-2 fix: print:overflow-visible + print:block on the outer
    // flex chain so window.print() captures the entire 7365-line
    // methodology body, not just the visible viewport slice. Without
    // these overrides, the print output gets clipped by the
    // overflow-hidden / overflow-y-auto wrappers above the markdown.
    <div className="flex flex-1 overflow-hidden relative print:block print:overflow-visible print:h-auto">
      {/* Left Sidebar (TOC). aria-hidden + inert when collapsed so screen
          readers + keyboard focus do not enter a visually hidden panel. */}
      <div
        id={TOC_PANEL_ID}
        aria-hidden={!showLeftPanel}
        inert={!showLeftPanel}
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col print:hidden',
          showLeftPanel ? 'w-72 md:w-80' : 'w-0',
        )}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Table of Contents
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {headings.length} section{headings.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            ref={tocCollapseRef}
            type="button"
            onClick={collapseLeftPanel}
            aria-expanded={true}
            aria-controls={TOC_PANEL_ID}
            aria-label="Hide table of contents"
            title="Hide table of contents"
            data-testid="twg-toc-collapse"
            className="-mr-1 p-2 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/60 hover:text-sky-900 dark:hover:text-sky-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <ul className="space-y-3">
            {headings.map((h) => (
              <li key={h.storageKey}>
                {/*
                  Codex holistic 2026-05-17 P3 fix: render TOC entries as
                  buttons (not <li onClick>) so keyboard-only + screen-
                  reader users can navigate. <button type="button"> is
                  focusable by default, fires onClick on Enter/Space, and
                  exposes role=button to AT.
                */}
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

      {/* Center Content (Document). Codex P1-2: print-mode overrides so
          window.print() emits the full document, not just the visible
          slice in the overflow-y-auto scroll pane. */}
      <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 px-8 py-10 sm:px-12 print:overflow-visible print:h-auto print:px-0 print:py-0 print:bg-white">
        <div className="max-w-4xl mx-auto space-y-8 print:max-w-none">
          {/* Header: title + submitted-status badge + Download (PDF) button.
              Matches matrix-options TWGReviewPortal pattern (PDF button on
              the right). The PDF flow uses window.print(), which routes
              through the browser's native "Save as PDF" / printer dialog
              -- no extra dependency required, and the rendered styling
              (post-MathRenderer typography fix) prints cleanly. */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Jermilova BN-RRM Methodology Paper
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Read the construction record and leave section-by-section feedback.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {status === 'SUBMITTED' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Submitted
                  </span>
                )}
                {lastSavedAt && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Last saved {new Date(lastSavedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              data-testid="jermilova-review-download-pdf"
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 shrink-0"
              aria-label="Download methodology paper as PDF (opens browser print dialog)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download (PDF)
            </button>
          </div>

          {loadError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg space-y-1 print:hidden">
              <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Could not load your existing review.
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                {loadError}
              </p>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Saves and submits are DISABLED until the connection recovers
                -- otherwise we could overwrite remote edits you can&apos;t
                see right now. Your edits stay in local storage; reload the
                page once the connection is back.
              </p>
            </div>
          )}

          <div ref={contentRef}>
            <MathRenderer content={methodologyContent || ''} />
          </div>
        </div>
      </div>

      {/* Right Drawer (Comments). aria-hidden + inert when collapsed for the
          same reason as the TOC panel above. */}
      <div
        id={COMMENTS_PANEL_ID}
        aria-hidden={!showRightPanel}
        inert={!showRightPanel}
        className={cn(
          'transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col relative print:hidden',
          showRightPanel ? 'w-72 md:w-96' : 'w-0',
        )}
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2 mb-3">
            <span className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Section Comments</span>
            </span>
            <button
              ref={commentsCollapseRef}
              type="button"
              onClick={collapseRightPanel}
              aria-expanded={true}
              aria-controls={COMMENTS_PANEL_ID}
              aria-label="Hide section comments"
              title="Hide section comments"
              data-testid="twg-comments-collapse"
              className="p-2 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800 hover:bg-sky-200 dark:hover:bg-sky-800/60 hover:text-sky-900 dark:hover:text-sky-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <PanelRightClose className="w-5 h-5" />
            </button>
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
            Reviews can be saved and updated at any time, even after submission.
            Submit just flags the admin pool that you have a complete pass ready.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 pb-32">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
              General Comments
            </label>
            <textarea
              value={comments[GENERAL_KEY] || ''}
              onChange={(e) => handleCommentChange(GENERAL_KEY, e.target.value)}
              maxLength={MAX_CHARS}
              placeholder="Overall thoughts on the methodology..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
              rows={4}
            />
            <div
              className={cn(
                'text-right text-xs mt-1 transition-colors',
                (comments[GENERAL_KEY]?.length || 0) >= MAX_CHARS
                  ? 'text-rose-500 font-bold'
                  : 'text-slate-500',
              )}
            >
              {comments[GENERAL_KEY]?.length || 0} / {MAX_CHARS}
            </div>
          </div>

          {headings.map((h) => (
            <div key={h.storageKey} className="space-y-2">
              <label className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Comments on {h.displayLabel}
              </label>
              <textarea
                value={comments[h.storageKey] || ''}
                onChange={(e) => handleCommentChange(h.storageKey, e.target.value)}
                maxLength={MAX_CHARS}
                placeholder={`Specific feedback for ${h.displayLabel}...`}
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                rows={3}
              />
              <div
                className={cn(
                  'text-right text-xs mt-1 transition-colors',
                  (comments[h.storageKey]?.length || 0) >= MAX_CHARS
                    ? 'text-rose-500 font-bold'
                    : 'text-slate-500',
                )}
              >
                {comments[h.storageKey]?.length || 0} / {MAX_CHARS}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <button
            onClick={handleSave}
            disabled={isSaving || isSubmitting || initialLoadFailed}
            title={initialLoadFailed ? 'Disabled: initial load failed. Reload after the connection recovers.' : undefined}
            className="flex-1 py-2 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="jermilova-review-save"
          >
            {isSaving ? 'Saving...' : hasExistingRow ? 'Save Edits' : 'Save Draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || isSaving || initialLoadFailed}
            title={initialLoadFailed ? 'Disabled: initial load failed. Reload after the connection recovers.' : undefined}
            className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-md transition-colors"
            data-testid="jermilova-review-submit"
          >
            {isSubmitting
              ? 'Submitting...'
              : status === 'SUBMITTED'
                ? 'Re-submit'
                : 'Submit Review'}
          </button>
        </div>
      </div>

      {/* Floating reopen handle for the TOC. Renders only when the TOC is
          collapsed; positioned at the left edge of the portal so the user
          always has a way back. */}
      {!showLeftPanel && (
        <button
          ref={tocReopenRef}
          type="button"
          onClick={reopenLeftPanel}
          aria-expanded={false}
          aria-controls={TOC_PANEL_ID}
          aria-label="Show table of contents"
          title="Show table of contents"
          data-testid="twg-toc-reopen"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 pr-3 pl-2 py-3 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-600 border border-l-0 border-sky-700 dark:border-sky-600 rounded-r-lg shadow-lg text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 print:hidden"
        >
          <PanelLeftOpen className="w-5 h-5" />
          <span className="text-xs font-semibold whitespace-nowrap">Show TOC</span>
        </button>
      )}

      {/* Floating reopen handle for the Comments panel. Same pattern, right
          edge. */}
      {!showRightPanel && (
        <button
          ref={commentsReopenRef}
          type="button"
          onClick={reopenRightPanel}
          aria-expanded={false}
          aria-controls={COMMENTS_PANEL_ID}
          aria-label="Show section comments"
          title="Show section comments"
          data-testid="twg-comments-reopen"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1.5 pl-3 pr-2 py-3 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-600 border border-r-0 border-sky-700 dark:border-sky-600 rounded-l-lg shadow-lg text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 print:hidden"
        >
          <span className="text-xs font-semibold whitespace-nowrap">Comments</span>
          <PanelRightOpen className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
