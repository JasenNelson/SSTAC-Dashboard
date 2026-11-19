'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, Maximize2, MessageSquareText, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RotateCcw, X } from 'lucide-react';

import { GUIDED_R2_FOCUS_AREAS, GUIDED_R2_PROMPTS, GUIDED_R2_SECTION_ANCHORS, type GuidedEntry, type GuidedTargetKind } from '@/lib/matrix-options/paper/guided-r2-contract';
import { guidedR2DraftSetDigest } from '@/lib/matrix-options/paper/guided-r2-digest';
import { R2_READER_LINKS } from '@/lib/matrix-options/paper/r2-reader-links';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import { previewAreaForAnchor } from '@/lib/matrix-options/paper/r2-review-preview';
import { createGuidedTransport, type GuidedFeedbackItem, type GuidedStateReply, type GuidedTransport } from '@/lib/matrix-options/paper/guided-r2-transport';
import { PaperScrollAuthority } from '@/lib/matrix-options/paper/scroll-authority';
import { maxPanelWidth, readPanelPreferences, resolvePanelWidths, writePanelPreferences, type PanelPreferences, type PanelSide } from '@/lib/matrix-options/paper/panel-layout';
import { DEFAULT_READER_WIDTH, readReaderWidth, writeReaderWidth, type ReaderWidth } from '@/lib/matrix-options/paper/reader-width';
import { PanelResizeHandle, PaperRail, PaperRailToggle, PAPER_LEFT_WIDTH_VAR, PAPER_RIGHT_WIDTH_VAR, PAPER_SHELL_CLASSES } from './PaperRail';
import { ReaderWidthControl } from './ReaderWidthControl';
import { R2_READING_FRAME_CLASSES } from './R2GuidedReview.styles';

interface OutlineEntry { readonly anchor: string; readonly label: string }
interface Draft { choiceId: string | null; rationale: string; text: string }
const emptyDraft = (): Draft => ({ choiceId: null, rationale: '', text: '' });
const targetKey = (kind: GuidedTargetKind, id: string) => `${kind}:${id}`;
let sharedPreviewTransport: GuidedTransport | null = null;
const getPreviewTransport = () => sharedPreviewTransport ??= createGuidedTransport('preview');
const inputClass = 'mt-2 w-full rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface)] px-3 py-2 text-sm text-[var(--db-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)]';
const actionClass = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[var(--db-accent)] px-4 py-2 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)] disabled:opacity-50';
const dataNotice = "Feedback is optional, linked to your account, and used for this paper review. If your account is permanently deleted, this guided review's drafts, submissions, completion, and events are removed. Soft deletion retains them until permanent deletion or a separately approved purge. This review does not authorize research export; any future export needs separate approval.";

function FeedbackUseDisclosure() {
  return <details className="group mt-2 max-w-3xl text-xs text-[var(--db-text-secondary)]">
    <summary className="w-fit cursor-pointer rounded py-1 font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)]">How your feedback is used</summary>
    <p className="mt-2 leading-relaxed">{dataNotice}</p>
  </details>;
}

function entryStatus(entry: GuidedEntry | undefined): string {
  if (!entry) return 'Optional';
  if (entry.submitted_revision !== null && entry.revision > entry.submitted_revision) return 'Changed since submit';
  if (entry.submitted_revision !== null && entry.revision === entry.submitted_revision) return 'Submitted';
  return 'Saved draft';
}

function EarlierFeedback({ areaId, feedback, error }: { readonly areaId: string; readonly feedback: readonly GuidedFeedbackItem[]; readonly error: string }) {
  const items = feedback.filter((item) => item.areaId === areaId);
  return <section className="border-t border-[var(--db-border)] pt-5"><h3 className="font-semibold">Earlier feedback</h3>
    {error ? <p role="status" className="mt-2 text-sm">{error}</p> : items.length ? items.map((item) => <details key={`${item.sourceReleaseIdentity}:${item.originalQuestionId}`} className="mt-3 rounded-md border border-[var(--db-border)] p-3 text-sm"><summary className="cursor-pointer font-semibold">{item.displayLabel}</summary><p className="mt-2 text-xs text-[var(--db-text-secondary)]">{item.sourceReleaseIdentity} - {item.responseStatus} - {item.relationType} - {item.timestamp}</p><p className="mt-2 whitespace-pre-wrap">{item.text}</p></details>) : <p className="mt-2 text-sm">No earlier feedback for this area.</p>}
  </section>;
}

export function R2GuidedReview({ documentVersion, guidedManifestSha256, reviewManifestSha256, initialMode = 'working-draft', outline, paper, transportMode = 'production' }: {
  readonly documentVersion: string; readonly guidedManifestSha256: string; readonly reviewManifestSha256: string;
  readonly initialMode?: 'working-draft' | 'my-review'; readonly outline: readonly OutlineEntry[]; readonly paper: ReactNode;
  readonly transportMode?: 'production' | 'preview';
}) {
  const [state, setState] = useState<GuidedStateReply | null>(null);
  const [readError, setReadError] = useState('');
  const [feedback, setFeedback] = useState<GuidedFeedbackItem[]>([]);
  const [feedbackError, setFeedbackError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [activeAreaId, setActiveAreaId] = useState<string>(GUIDED_R2_FOCUS_AREAS[0].id);
  const [visitedAreaIds, setVisitedAreaIds] = useState<readonly string[]>([GUIDED_R2_FOCUS_AREAS[0].id]);
  const [reviewedAreaIds, setReviewedAreaIds] = useState<readonly string[]>([]);
  const [activeAnchor, setActiveAnchor] = useState<string>(GUIDED_R2_FOCUS_AREAS[0].anchor);
  const [view, setView] = useState<'paper' | 'whole-paper' | 'my-review'>(initialMode === 'my-review' ? 'my-review' : 'paper');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(true);
  const [panelPreferences, setPanelPreferences] = useState<PanelPreferences>({});
  const [draftPreferences, setDraftPreferences] = useState<PanelPreferences | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [resizing, setResizing] = useState(false);
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>(DEFAULT_READER_WIDTH);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const reviewToggleRef = useRef<HTMLButtonElement>(null);
  const [authority] = useState(() => new PaperScrollAuthority());
  const identity = useMemo(() => ({ documentVersion, guidedManifestSha256, reviewManifestSha256 }), [documentVersion, guidedManifestSha256, reviewManifestSha256]);
  // Strict Mode remounts effects in development. One preview bootstrap keeps
  // those duplicate state reads from creating two cookie-bound users.
  const transport = useMemo(() => transportMode === 'preview' ? getPreviewTransport() : createGuidedTransport('production'), [transportMode]);
  useEffect(() => {
    try { setPanelPreferences(readPanelPreferences(window.localStorage)); }
    catch { setPanelPreferences({}); }
    setReaderWidth(readReaderWidth());
  }, []);
  useEffect(() => {
    const element = layoutRef.current;
    if (!element) return;
    const measure = () => setLayoutWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const viewHref = (mode: 'working-draft' | 'my-review', section: string | null = null) => {
    if (transportMode === 'preview') {
      const query = new URLSearchParams({ mode });
      if (section) query.set('section', section);
      return `/r2-guided-fixture?${query}`;
    }
    return paperWorkspaceHref(documentVersion, { mode, cohort: null, q: null, section });
  };

  const loadState = useCallback(async (preserveEdits = true) => {
    try {
      const response = await transport.state(identity);
      if (!response.ok) { setReadError(response.status === 403 ? 'Guided responses are available only to invited reviewers. The paper remains readable.' : response.status === 409 ? 'This review version changed. Reload this page before saving.' : 'Your review state is temporarily unavailable. The paper remains readable.'); setState(response.status === 403 ? null : (current) => current ? { ...current, mode: 'read-only' } : current); if (response.status === 403) { setDrafts({}); setFeedback([]); } return; }
      const next = response.value;
      if (next.userKey && Array.isArray(next.entries) && (next.mode === 'read-only' || next.mode === 'writable')) {
        setState(next); setReadError('');
        setDrafts((current) => {
          const result = { ...current };
          for (const entry of next.entries) {
            const key = targetKey(entry.target_kind, entry.target_id);
            if (!preserveEdits || !dirtyRef.current[key]) result[key] = { choiceId: entry.draft_choice_id, rationale: entry.draft_rationale ?? '', text: entry.draft_text ?? '' };
          }
          return result;
        });
      } else setReadError('Your review state is temporarily unavailable.');
    } catch { setReadError('Your review state is temporarily unavailable. The paper remains readable.'); setState((current) => current ? { ...current, mode: 'read-only' } : current); }
  }, [identity, transport]);

  useEffect(() => { void loadState(false); }, [loadState]);
  useLayoutEffect(() => {
    authority.observe(window);
    return () => authority.dispose();
  }, [authority]);
  useEffect(() => {
    if (view !== 'my-review') return;
    const target = document.getElementById('r2-guided-my-review');
    if (target) authority.scrollTargetIntoView(target);
  }, [authority, view]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await transport.feedback(identity);
        if (!response.ok) throw new Error('feedback');
        const data = response.value;
        if (!cancelled) { setFeedback(Array.isArray(data.items) ? data.items : []); setFeedbackError(''); }
      } catch { if (!cancelled) { setFeedback([]); setFeedbackError('Earlier feedback is temporarily unavailable.'); } }
    })();
    return () => { cancelled = true; };
  }, [identity, transport]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (mobileOpen && !dialog.open) dialog.showModal();
    if (!mobileOpen && dialog.open) dialog.close();
  }, [mobileOpen]);
  useEffect(() => {
    const root = paperRef.current;
    if (!root || view !== 'paper') return;
    const update = () => {
      const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id^="sec-phase2-"]'));
      const top = window.innerWidth >= 1024 ? root.getBoundingClientRect().top + 100 : 170;
      const current = sections.filter((section) => section.getBoundingClientRect().top <= top).at(-1) ?? sections[0];
      if (!current) return;
      setActiveAnchor(current.id);
      const area = previewAreaForAnchor(current.id);
      if (area) { setActiveAreaId(area); setVisitedAreaIds((current) => current.includes(area) ? current : [...current, area]); }
    };
    root.addEventListener('scroll', update, { passive: true }); window.addEventListener('scroll', update, { passive: true });
    update();
    return () => { root.removeEventListener('scroll', update); window.removeEventListener('scroll', update); };
  }, [view]);

  useEffect(() => {
    const onHistory = () => setView(new URLSearchParams(window.location.search).get('mode') === 'my-review' ? 'my-review' : 'paper');
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);

  const selectMyReview = () => {
    setView('my-review'); setMobileOpen(false);
    window.history.pushState(null, '', viewHref('my-review'));
  };
  const selectWholePaper = () => {
    setView('whole-paper'); setMobileOpen(false);
    window.history.pushState(null, '', viewHref('working-draft'));
  };

  const scrollPaperToSection = (anchor: string) => {
    // Desktop paper has its own scrollport. Never move the outer page.
    // On mobile the paper is in document flow, so selection changes state only.
    if (window.innerWidth < 1024) return;
    const root = paperRef.current;
    const target = document.getElementById(anchor);
    if (!root || !target) return;
    authority.scrollTargetWithin(root, target);
  };

  const selectArea = (id: string) => {
    const area = GUIDED_R2_FOCUS_AREAS.find((item) => item.id === id);
    if (!area) return;
    setView('paper'); setActiveAreaId(id); setActiveAnchor(area.anchor); setMobileOpen(false);
    setVisitedAreaIds((current) => current.includes(id) ? current : [...current, id]);
    window.history.pushState(null, '', viewHref('working-draft', area.anchor));
    requestAnimationFrame(() => scrollPaperToSection(area.anchor));
  };
  const selectSection = (anchor: string) => {
    const owner = previewAreaForAnchor(anchor);
    if (owner) { setActiveAreaId(owner); setVisitedAreaIds((current) => current.includes(owner) ? current : [...current, owner]); }
    setView('paper'); setActiveAnchor(anchor); setMobileOpen(false);
    window.history.pushState(null, '', viewHref('working-draft', anchor));
    requestAnimationFrame(() => scrollPaperToSection(anchor));
  };
  const updateDraft = (kind: GuidedTargetKind, id: string, patch: Partial<Draft>) => {
    const key = targetKey(kind, id);
    setDrafts((current) => ({ ...current, [key]: { ...(current[key] ?? emptyDraft()), ...patch } }));
    setDirty((current) => ({ ...current, [key]: true }));
    setNotice('Unsaved changes.');
  };
  const save = async (kind: GuidedTargetKind, id: string) => {
    if (!state || state.mode !== 'writable' || busy) return;
    setBusy(true); setNotice('Saving...');
    const key = targetKey(kind, id);
    const existing = state.entries.find((entry) => entry.target_kind === kind && entry.target_id === id);
    try {
      const draft = drafts[key] ?? emptyDraft();
      const payload = kind === 'choice-prompt' ? { choiceId: draft.choiceId, rationale: draft.rationale } : { text: draft.text };
      const response = await transport.save(id, { ...identity, targetKind: kind, expectedRevision: existing?.revision ?? 0, expectedUserId: state.userKey, draft: payload });
      if (!response.ok) {
        setNotice(response.status === 409 ? 'This item changed elsewhere. Your text remains here; review it before retrying.' : response.status === 403 ? 'Saving is currently closed. Your text remains here.' : 'Save failed. Your text remains here.');
        if (response.status === 409) void loadState(true);
      } else {
        setState((current) => current ? { ...current, entries: [...current.entries.filter((entry) => !(entry.target_kind === kind && entry.target_id === id)), response.value.row] } : current);
        const changedDuringSave = JSON.stringify(draftsRef.current[key] ?? emptyDraft()) !== JSON.stringify(draft);
        if (!changedDuringSave) setDirty((current) => ({ ...current, [key]: false }));
        setNotice(changedDuringSave ? 'An earlier edit was saved. Save your newer changes before finishing.' : 'Saved.');
      }
    } catch { setNotice('Save failed. Your text remains here.'); }
    finally { setBusy(false); }
  };
  const complete = async () => {
    if (!state || state.mode !== 'writable' || busy) return;
    if (Object.values(dirty).some(Boolean)) { setNotice('Save your changes before finishing.'); return; }
    setBusy(true); setNotice('Finishing review...');
    try {
      const digest = await guidedR2DraftSetDigest(state.entries);
      const response = await transport.complete({ ...identity, expectedUserId: state.userKey, expectedCompletionRevision: state.completion?.revision ?? 0, draftSetDigest: digest });
      if (!response.ok) {
        setNotice(response.status === 409 ? 'Your review changed elsewhere. Refresh the saved state before finishing.' : 'Could not finish the review. Your saved entries remain available.');
        if (response.status === 409) void loadState(true);
      } else { setState((current) => current ? { ...current, entries: response.value.entries, completion: response.value.completion } : current); setNotice(response.value.outcome === 'ok' ? 'Review finished.' : 'This review was already finished with the same saved entries.'); }
    } catch { setNotice('Could not finish the review. Your saved entries remain available.'); }
    finally { setBusy(false); }
  };

  const area = GUIDED_R2_FOCUS_AREAS.find((item) => item.id === activeAreaId) ?? GUIDED_R2_FOCUS_AREAS[0];
  const reviewedCount = reviewedAreaIds.length;
  const nextArea = GUIDED_R2_FOCUS_AREAS[GUIDED_R2_FOCUS_AREAS.indexOf(area) + 1];
  const nextAreaOrReview = () => nextArea ? selectArea(nextArea.id) : selectMyReview();
  const savedEntry = (kind: GuidedTargetKind, id: string) => state?.entries.find((entry) => entry.target_kind === kind && entry.target_id === id);
  const draftValue = (kind: GuidedTargetKind, id: string) => {
    const key = targetKey(kind, id);
    const entry = savedEntry(kind, id);
    return dirty[key] ? drafts[key] ?? emptyDraft() : entry ? { choiceId: entry.draft_choice_id, rationale: entry.draft_rationale ?? '', text: entry.draft_text ?? '' } : emptyDraft();
  };
  const commentHasText = (id: string) => Boolean(draftValue('section-comment', id).text.trim());
  const sectionLabel = outline.find((item) => item.anchor === activeAnchor)?.label ?? activeAnchor;
  const effectivePreferences = draftPreferences ?? panelPreferences;
  const panelWidths = resolvePanelWidths(layoutWidth, effectivePreferences, { left: navigationOpen, right: reviewOpen && view !== 'my-review' });
  const panelMax = (side: PanelSide) => maxPanelWidth(side, layoutWidth || 1440, side === 'left' ? panelWidths.right : panelWidths.left, side === 'left' ? reviewOpen && view !== 'my-review' : navigationOpen);
  const persistPanelPreferences = (next: PanelPreferences) => {
    setPanelPreferences(next);
    setDraftPreferences(null);
    try { writePanelPreferences(window.localStorage, next); } catch { /* Widths still apply for this visit. */ }
  };
  const resizePanel = (side: PanelSide, width: number) => setDraftPreferences({ ...panelPreferences, [side]: width });
  const commitPanel = (side: PanelSide, width: number) => persistPanelPreferences({ ...panelPreferences, [side]: width });
  const resetPanel = (side: PanelSide) => persistPanelPreferences(side === 'left' ? { right: panelPreferences.right } : { left: panelPreferences.left });
  const closePanel = (side: PanelSide) => {
    authority.panelActivated();
    if (side === 'left') { setNavigationOpen(false); navigationToggleRef.current?.focus({ preventScroll: true }); }
    else { setReviewOpen(false); reviewToggleRef.current?.focus({ preventScroll: true }); }
  };
  const togglePanel = (side: PanelSide, open: boolean) => {
    if (open) { closePanel(side); return; }
    authority.panelActivated();
    if (side === 'left') setNavigationOpen(true);
    else setReviewOpen(true);
  };
  const layoutStyle = { [PAPER_LEFT_WIDTH_VAR]: `${panelWidths.left}px`, [PAPER_RIGHT_WIDTH_VAR]: `${panelWidths.right}px` } as CSSProperties;
  const editor = (prefix: string) => {
    if (!state) return readError ? null : <p role="status">Loading your review state...</p>;
    const writable = state.mode === 'writable';
    const field = (kind: GuidedTargetKind, id: string, label: string, rows = 4, choiceOptions?: readonly { id: string; label: string }[], rationaleLabel?: string) => {
      const key = targetKey(kind, id);
      const value = drafts[key] ?? emptyDraft();
      const entry = state.entries.find((item) => item.target_kind === kind && item.target_id === id);
      const textareaId = `${prefix}-${id}${choiceOptions ? '-rationale' : ''}`;
      const countId = `${textareaId}-count`;
      const text = choiceOptions ? value.rationale : value.text;
      const expanded = Boolean(expandedFields[key]);
      return <section key={key} className="border-t border-[var(--db-border)] pt-5">
        <h3 className="text-sm font-semibold">{label}</h3>
        {choiceOptions ? <fieldset className="mt-3 space-y-2"><legend className="sr-only">{label}</legend>{choiceOptions.map((option) => <label key={option.id} className="flex min-h-[44px] items-center gap-3 rounded-md border border-[var(--db-border)] px-3 py-2 text-sm"><input type="radio" name={`${prefix}-${id}`} checked={value.choiceId === option.id} onChange={() => updateDraft(kind, id, { choiceId: option.id })} disabled={!writable || busy} />{option.label}</label>)}<button type="button" disabled={!writable || busy || value.choiceId === null} onClick={() => updateDraft(kind, id, { choiceId: null })} className="min-h-[44px] text-xs underline">Clear selection</button></fieldset> : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <label htmlFor={textareaId} className={choiceOptions ? 'text-sm' : 'sr-only'}>{choiceOptions ? `${rationaleLabel} (optional)` : label}</label>
          <button type="button" aria-pressed={expanded} aria-controls={textareaId} onClick={() => setExpandedFields((current) => ({ ...current, [key]: !current[key] }))} className="inline-flex min-h-[44px] items-center gap-1 rounded px-2 text-xs focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)]">
            {expanded ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}{expanded ? 'Collapse editor' : 'Expand editor'}
          </button>
        </div>
        <textarea id={textareaId} rows={rows} maxLength={20000} value={text} onChange={(event) => updateDraft(kind, id, choiceOptions ? { rationale: event.target.value } : { text: event.target.value })} disabled={!writable || busy} aria-describedby={countId} data-expanded={expanded ? 'true' : undefined} className={`${inputClass} resize-y ${expanded ? 'h-[min(70vh,44rem)] min-h-80' : 'h-56 min-h-32'}`} />
        <p id={countId} aria-live={20000 - text.length <= 1000 ? 'polite' : undefined} className="mt-1 text-right text-xs tabular-nums text-[var(--db-text-muted)]">{text.length} / 20000</p>
        <div className="mt-2 flex items-center gap-3"><button type="button" className={actionClass} disabled={!writable || busy || !dirty[key]} onClick={() => void save(kind, id)}>Save</button><span className="text-xs text-[var(--db-text-secondary)]">{dirty[key] ? 'Unsaved - save before finishing' : entryStatus(entry)}</span></div>
      </section>;
    };
    if (view === 'whole-paper') return <div className="space-y-5"><h2 className="text-lg font-semibold">Whole-paper comments</h2><p className="text-sm">For feedback that does not belong to one section.</p>{field('whole-paper-comment', 'whole-paper', 'General comments on the proposed paper', 7)}<EarlierFeedback areaId="whole-paper" feedback={feedback} error={feedbackError} /></div>;
    return <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-wide">Focus area {GUIDED_R2_FOCUS_AREAS.indexOf(area) + 1} of 6</p><h2 className="mt-1 text-lg font-semibold">{area.label}</h2><p className="mt-2 text-sm text-[var(--db-text-secondary)]">{area.orientation}</p></div><section aria-label="Key questions" className="space-y-5"><h3 className="text-base font-semibold">Key questions</h3>{GUIDED_R2_PROMPTS.filter((prompt) => prompt.areaId === area.id).map((prompt) => prompt.kind === 'choice' ? field('choice-prompt', prompt.id, prompt.label, 3, prompt.options, prompt.rationaleLabel) : field('text-prompt', prompt.id, prompt.label))}</section>{GUIDED_R2_SECTION_ANCHORS.includes(activeAnchor as typeof GUIDED_R2_SECTION_ANCHORS[number]) ? field('section-comment', activeAnchor, `Comment on this section: ${sectionLabel}`) : null}<EarlierFeedback areaId={area.id} feedback={feedback} error={feedbackError} /><div className="border-t border-[var(--db-border)] pt-5"><button type="button" className={actionClass} onClick={() => setReviewedAreaIds((current) => current.includes(area.id) ? current : [...current, area.id])} disabled={reviewedAreaIds.includes(area.id)}>Mark area reviewed on this page</button><p className="mt-2 text-xs text-[var(--db-text-secondary)]">Marking an area reviewed does not save a response.</p><button type="button" onClick={nextAreaOrReview} className="mt-3 flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">{nextArea ? 'Next focus area' : 'Go to My Review'}<ArrowRight aria-hidden="true" className="h-4 w-4" /></button></div></div>;
  };

  const myReview = <div id="r2-guided-my-review" className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 sm:px-8 lg:pb-8">
    <h2 className="text-2xl font-semibold">My Review</h2>
    <p className="text-sm">Check your saved responses and any unsaved edits before finishing. Questions and comments are optional; an empty review can also be finished explicitly.</p>
    <FeedbackUseDisclosure />
    <p className="text-sm font-medium">{reviewedCount} of 6 focus areas marked reviewed on this page. Saved entries and final completion remain separate.</p>
    <ol aria-label="Focus area checklist" className="space-y-5">{GUIDED_R2_FOCUS_AREAS.map((item, index) => {
      const comments = item.sectionAnchors.filter(commentHasText);
      const hasInput = item.promptIds.some((id) => {
        const prompt = GUIDED_R2_PROMPTS.find((candidate) => candidate.id === id);
        if (!prompt) return false;
        const value = draftValue(prompt.kind === 'choice' ? 'choice-prompt' : 'text-prompt', id);
        return Boolean(value.choiceId || value.rationale.trim() || value.text.trim());
      }) || comments.length > 0;
      const areaStatus = reviewedAreaIds.includes(item.id) ? 'Reviewed on this page' : hasInput ? 'Has input' : visitedAreaIds.includes(item.id) ? 'Visited' : 'Not visited';
      return <li key={item.id} className="border-t border-[var(--db-border)] pt-4">
        <h3 className="font-semibold">{index + 1}. {item.label}</h3><p className="mt-1 text-xs text-[var(--db-text-secondary)]">{areaStatus}</p>
        {item.promptIds.length ? <div className="mt-3 space-y-3">{item.promptIds.map((id) => {
          const prompt = GUIDED_R2_PROMPTS.find((candidate) => candidate.id === id);
          if (!prompt) return null;
          const kind = prompt.kind === 'choice' ? 'choice-prompt' : 'text-prompt';
          const value = draftValue(kind, id);
          const entry = savedEntry(kind, id);
          const answer = prompt.kind === 'choice' && value.choiceId ? prompt.options.find((option) => option.id === value.choiceId)?.label : value.text.trim();
          return <div key={id} className="text-sm"><p className="font-medium">{prompt.label}</p><p className="mt-1 whitespace-pre-wrap">{answer || 'No answer'}</p>{value.rationale.trim() ? <p className="mt-1 whitespace-pre-wrap">Reason: {value.rationale.trim()}</p> : null}<p className="mt-1 text-xs text-[var(--db-text-secondary)]">{dirty[targetKey(kind, id)] ? 'Unsaved - return to this area to save' : entryStatus(entry)}</p></div>;
        })}</div> : <p className="mt-2 text-sm">No key question in this area; section comments are optional.</p>}
        <p className="mt-3 text-xs text-[var(--db-text-secondary)]">Section comments: {comments.length}</p>
        <button type="button" onClick={() => selectArea(item.id)} className="mt-2 min-h-[44px] text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">Return to area</button>
      </li>;
    })}</ol>
    <section className="border-t border-[var(--db-border)] pt-4"><h3 className="font-semibold">Section comments</h3>
      {GUIDED_R2_SECTION_ANCHORS.filter(commentHasText).length ? <ul className="mt-2 space-y-3">{GUIDED_R2_SECTION_ANCHORS.filter(commentHasText).map((anchor) => <li key={anchor}><p className="text-xs font-semibold text-[var(--db-text-secondary)]">{outline.find((entry) => entry.anchor === anchor)?.label ?? anchor}{dirty[targetKey('section-comment', anchor)] ? ' - Unsaved' : ''}</p><p className="mt-1 whitespace-pre-wrap text-sm">{draftValue('section-comment', anchor).text.trim()}</p><button type="button" onClick={() => selectSection(anchor)} className="mt-1 min-h-[44px] text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">Return to section</button></li>)}</ul> : <p className="mt-2 text-sm">No section comments</p>}
    </section>
    <section className="border-t border-[var(--db-border)] pt-4"><h3 className="font-semibold">Whole-paper comments</h3><p className="mt-2 whitespace-pre-wrap text-sm">{draftValue('whole-paper-comment', 'whole-paper').text.trim() || 'No whole-paper comment'}</p>{dirty[targetKey('whole-paper-comment', 'whole-paper')] ? <p className="mt-1 text-xs">Unsaved - return to whole-paper comments to save</p> : null}<button type="button" onClick={selectWholePaper} className="mt-2 min-h-[44px] text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">Edit whole-paper comment</button></section>
    {Object.values(dirty).some(Boolean) ? <p role="alert" className="text-sm">Save your changes before finishing. Return to the relevant area or comment to save.</p> : null}
    <button type="button" className={actionClass} disabled={state?.mode !== 'writable' || busy || Object.values(dirty).some(Boolean)} onClick={() => void complete()}>Finish review</button>
    {state?.completion ? <p className="text-sm">Last finished {state.completion.submitted_at}.</p> : null}
  </div>;

  return <div className="min-h-screen bg-[var(--db-surface)] text-[var(--db-text-primary)]">
    <header className="border-b border-[var(--db-border)] px-4 py-5 sm:px-6"><div className="mx-auto max-w-[1600px]"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--db-text-secondary)]">Matrix Options Paper</p><h1 className="mt-1 text-2xl font-semibold">Phase 2 review draft</h1><p className="mt-1 text-sm">Review the proposed approach and share feedback where you have a view. All questions are optional.</p><FeedbackUseDisclosure /><div className="mt-3 flex flex-wrap items-center gap-4 text-xs"><span className="inline-flex items-center gap-1"><BookOpen className="h-4 w-4" aria-hidden="true" />Exact R2 paper</span>{R2_READER_LINKS.files.map((file) => <a key={file.label} href={file.href} target="_blank" rel="noopener noreferrer" className="underline">{file.label}</a>)}<a href="/matrix-options/paper/v/v0.9.91" className="underline">Scientific deep dive (v0.9.91)</a></div></div></header>
    <div className="mx-auto hidden max-w-[1600px] items-center justify-end gap-2 border-b border-[var(--db-border)] px-4 py-1 lg:flex">
      {panelPreferences.left !== undefined || panelPreferences.right !== undefined ? <button type="button" onClick={() => persistPanelPreferences({})} aria-label="Reset panel widths" className="inline-flex min-h-[44px] items-center gap-1 rounded px-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)]"><RotateCcw aria-hidden="true" className="h-4 w-4" />Reset panel widths</button> : null}
      <PaperRailToggle label="Navigation" testId="r2-navigation-toggle" open={navigationOpen} controls="r2-navigation-rail" buttonRef={navigationToggleRef} onClick={() => togglePanel('left', navigationOpen)} icon={navigationOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />} />
      {view !== 'my-review' ? <PaperRailToggle label="Review this section" testId="r2-review-toggle" open={reviewOpen} controls="r2-review-rail" buttonRef={reviewToggleRef} onClick={() => togglePanel('right', reviewOpen)} icon={reviewOpen ? <PanelRightClose aria-hidden="true" className="h-4 w-4" /> : <PanelRightOpen aria-hidden="true" className="h-4 w-4" />} /> : null}
    </div>
    {state?.mode === 'read-only' ? <p role="status" className="border-b border-[var(--db-border)] bg-[var(--db-depth-1)] px-4 py-3 text-sm">Review responses are currently read-only. The paper remains available.</p> : null}
    {readError ? <p role="alert" className="border-b border-[var(--db-border)] px-4 py-3 text-sm">{readError}</p> : null}
    <p role="status" className="border-b border-[var(--db-border)] px-4 py-2 text-sm" aria-live="polite">{notice}</p>
    <div className="border-b border-[var(--db-border)] px-4 py-3 lg:hidden"><label htmlFor="r2-guided-picker" className="text-xs font-semibold">Go to a focus area</label><select id="r2-guided-picker" className={inputClass} value={view === 'my-review' ? 'my-review' : view === 'whole-paper' ? 'whole-paper' : activeAreaId} onChange={(event) => event.target.value === 'my-review' ? selectMyReview() : event.target.value === 'whole-paper' ? selectWholePaper() : selectArea(event.target.value)}>{GUIDED_R2_FOCUS_AREAS.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.label}</option>)}<option value="whole-paper">Whole-paper comments</option><option value="my-review">My Review</option></select><p className="mt-2 text-xs text-[var(--db-text-secondary)]">{view === 'paper' ? `Current area: ${area.label}. ` : ''}{reviewedCount} of 6 areas marked reviewed on this page.</p><div role="progressbar" aria-label="Focus areas reviewed on this page" aria-valuenow={reviewedCount} aria-valuemin={0} aria-valuemax={6} className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--db-depth-2)]"><div className="h-full bg-[var(--db-accent)]" style={{ width: `${reviewedCount / 6 * 100}%` }} /></div></div>
    <div ref={layoutRef} style={layoutStyle} data-testid="r2-workspace-layout" data-resizing={resizing ? 'true' : undefined} className={`${PAPER_SHELL_CLASSES} group/layout mx-auto max-w-[1600px] lg:h-[calc(100dvh-15rem)] ${resizing ? 'cursor-col-resize select-none' : ''}`}>
      <div className="hidden lg:contents"><PaperRail id="r2-navigation-rail" side="left" open={navigationOpen} heading="Review navigation" headingId="r2-navigation-rail-heading" onEscape={() => closePanel('left')}><h2 className="text-sm font-semibold">Focus areas</h2><p className="mt-1 text-xs text-[var(--db-text-secondary)]">{reviewedCount} of 6 marked reviewed on this page</p><div role="progressbar" aria-label="Focus areas reviewed on this page" aria-valuenow={reviewedCount} aria-valuemin={0} aria-valuemax={6} className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--db-depth-2)]"><div className="h-full bg-[var(--db-accent)]" style={{ width: `${reviewedCount / 6 * 100}%` }} /></div><ol className="mt-4 space-y-1">{GUIDED_R2_FOCUS_AREAS.map((item, index) => <li key={item.id}><button type="button" onClick={() => selectArea(item.id)} aria-current={view === 'paper' && activeAreaId === item.id ? 'step' : undefined} className={`min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--db-depth-2)] focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)] ${view === 'paper' && activeAreaId === item.id ? 'bg-[var(--db-accent-tint)] font-semibold' : ''}`}>{index + 1}. {item.label}<span className="mt-1 block text-xs font-normal text-[var(--db-text-secondary)]">{reviewedAreaIds.includes(item.id) ? 'Reviewed on this page' : visitedAreaIds.includes(item.id) ? 'Visited' : 'Not visited'}</span></button></li>)}</ol><div className="mt-4 border-t border-[var(--db-border)] pt-3"><button type="button" onClick={selectWholePaper} className="flex min-h-[44px] items-center gap-2 text-sm"><MessageSquareText className="h-4 w-4" aria-hidden="true" />Whole-paper comments</button><button type="button" onClick={selectMyReview} className="mt-2 flex min-h-[44px] items-center gap-2 text-sm"><Check className="h-4 w-4" aria-hidden="true" />My Review</button></div></PaperRail></div>
      {navigationOpen ? <PanelResizeHandle side="left" label="Resize navigation panel" controls="r2-navigation-rail" width={panelWidths.left} max={panelMax('left')} onResize={(width) => resizePanel('left', width)} onCommit={(width) => commitPanel('left', width)} onReset={() => resetPanel('left')} onDragChange={setResizing} /> : null}
      <main ref={paperRef} data-testid="r2-paper-scrollport" className="min-w-0 flex-1 bg-[var(--db-surface)] lg:overflow-y-auto">{view === 'my-review' ? myReview : <div data-testid="r2-reading-frame" data-reader-width={readerWidth} className={`paper-reading-frame ${R2_READING_FRAME_CLASSES} mx-auto space-y-5 px-4 py-6 pb-28 sm:px-8 lg:pb-8`}><ReaderWidthControl value={readerWidth} onChange={(value) => { setReaderWidth(value); writeReaderWidth(value); }} />{paper}</div>}</main>
      {view !== 'my-review' && reviewOpen ? <PanelResizeHandle side="right" label="Resize review panel" controls="r2-review-rail" width={panelWidths.right} max={panelMax('right')} onResize={(width) => resizePanel('right', width)} onCommit={(width) => commitPanel('right', width)} onReset={() => resetPanel('right')} onDragChange={setResizing} /> : null}
      {view !== 'my-review' ? <div className="hidden lg:contents"><PaperRail id="r2-review-rail" side="right" open={reviewOpen} heading="Review this section" headingId="r2-review-rail-heading" onEscape={() => closePanel('right')}>{editor('desktop')}</PaperRail></div> : null}
    </div>
    {view !== 'my-review' ? <button ref={actionRef} type="button" data-testid="r2-mobile-review-action" onClick={() => setMobileOpen(true)} className={`${actionClass} fixed inset-x-4 bottom-4 z-20 shadow-lg lg:hidden`}>Review this section</button> : null}
    <dialog ref={dialogRef} data-testid="r2-mobile-review-dialog" onClose={() => { setMobileOpen(false); actionRef.current?.focus({ preventScroll: true }); }} aria-label="Review this section" className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-xl border border-[var(--db-border)] bg-[var(--db-surface)] p-5 text-[var(--db-text-primary)] shadow-xl backdrop:bg-black/50 lg:hidden"><div className="mb-4 flex items-center justify-between border-b border-[var(--db-border)] pb-3"><p className="text-sm font-semibold">Review this section</p><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close review panel" className="flex h-11 w-11 items-center justify-center"><X className="h-5 w-5" aria-hidden="true" /></button></div>{editor('mobile')}</dialog>
  </div>;
}
