'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, MessageSquareText, X } from 'lucide-react';

import { PAPER_SHELL_CLASSES } from './PaperRail';
import { R2_READER_LINKS } from '@/lib/matrix-options/paper/r2-reader-links';
import {
  PREVIEW_FOCUS_AREAS,
  PREVIEW_PROMPTS,
  previewAreaForAnchor,
  previewAreaState,
  previewInitialState,
  validPreviewFeedback,
  type PreviewEarlierFeedback,
  type PreviewFeedbackContract,
  type PreviewFocusArea,
  type PreviewFocusAreaId,
  type PreviewPrompt,
  type PreviewReviewState,
} from '@/lib/matrix-options/paper/r2-review-preview';

interface PreviewOutlineEntry { readonly anchor: string; readonly label: string }

export interface R2ReviewPreviewProps {
  readonly outline: readonly PreviewOutlineEntry[];
  readonly feedback: readonly PreviewEarlierFeedback[];
  readonly feedbackContract: PreviewFeedbackContract;
  readonly paper: ReactNode;
  readonly fixtureState?: 'ready' | 'loading' | 'signed-out' | 'source-unavailable' | 'stale-lineage' | 'transient-read-error' | 'no-prompt' | 'no-earlier-feedback';
}

interface ContextProps {
  readonly prefix: string;
  readonly area: PreviewFocusArea;
  readonly sectionAnchor: string;
  readonly sectionLabel: string;
  readonly state: PreviewReviewState;
  readonly feedback: readonly PreviewEarlierFeedback[];
  readonly feedbackUnavailable: boolean;
  readonly onAnswer: (id: string, patch: { readonly choiceId?: string; readonly rationale?: string; readonly text?: string }) => void;
  readonly onSectionComment: (anchor: string, text: string) => void;
  readonly onWholePaperComment: (text: string) => void;
  readonly onReviewed: (id: PreviewFocusAreaId) => void;
  readonly onNext: () => void;
  readonly wholePaper: boolean;
}

const inputClasses = 'mt-2 w-full rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface)] px-3 py-2 text-sm text-[var(--db-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]';
const actionClasses = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[var(--db-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--db-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]';

function PromptInput({ prefix, prompt, state, onAnswer }: {
  readonly prefix: string;
  readonly prompt: PreviewPrompt;
  readonly state: PreviewReviewState;
  readonly onAnswer: ContextProps['onAnswer'];
}) {
  const answer = state.answers[prompt.id];
  if (prompt.kind === 'choice') {
    return (
      <fieldset className="border-t border-[var(--db-border)] pt-5">
        <legend className="text-sm font-semibold leading-6 text-[var(--db-text-primary)]">{prompt.label}</legend>
        <p className="mb-3 text-xs text-[var(--db-text-secondary)]">{prompt.sourceSection} - optional preview question</p>
        <div className="space-y-2">
          {prompt.options.map((option) => (
            <label key={option.id} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-[var(--db-border)] px-3 py-2 text-sm hover:bg-[var(--db-depth-1)]">
              <input type="radio" name={`${prefix}-${prompt.id}`} value={option.id} checked={answer?.choiceId === option.id} onChange={() => onAnswer(prompt.id, { choiceId: option.id })} className="h-4 w-4 accent-[var(--db-accent)]" />
              {option.label}
            </label>
          ))}
        </div>
        <label htmlFor={`${prefix}-${prompt.id}-rationale`} className="mt-4 block text-sm font-medium">{prompt.rationaleLabel} <span className="font-normal text-[var(--db-text-secondary)]">(optional)</span></label>
        <textarea id={`${prefix}-${prompt.id}-rationale`} rows={3} maxLength={20000} value={answer?.rationale ?? ''} onChange={(event) => onAnswer(prompt.id, { rationale: event.target.value })} className={inputClasses} />
      </fieldset>
    );
  }
  return (
    <div className="border-t border-[var(--db-border)] pt-5">
      <label htmlFor={`${prefix}-${prompt.id}`} className="block text-sm font-semibold leading-6">{prompt.label}</label>
      <p className="text-xs text-[var(--db-text-secondary)]">{prompt.sourceSection} - optional preview question</p>
      <textarea id={`${prefix}-${prompt.id}`} rows={4} maxLength={20000} value={answer?.text ?? ''} onChange={(event) => onAnswer(prompt.id, { text: event.target.value })} className={inputClasses} />
    </div>
  );
}

function PreviewContext({ prefix, area, sectionAnchor, sectionLabel, state, feedback, feedbackUnavailable, onAnswer, onSectionComment, onWholePaperComment, onReviewed, onNext, wholePaper }: ContextProps) {
  if (wholePaper) {
    return (
      <div className="space-y-5">
        <div><h2 className="text-lg font-semibold">Whole-paper comments</h2><p className="mt-1 text-sm text-[var(--db-text-secondary)]">Use this for feedback that does not belong to one section. This is separate from the six focus areas.</p></div>
        <label htmlFor={`${prefix}-whole-paper-comment`} className="block text-sm font-semibold">General comments on the proposed paper</label>
        <textarea id={`${prefix}-whole-paper-comment`} rows={7} maxLength={20000} value={state.wholePaperComment} onChange={(event) => onWholePaperComment(event.target.value)} className={inputClasses} />
        <p className="text-xs text-[var(--db-text-secondary)]">Preview only - nothing is saved or sent.</p>
      </div>
    );
  }
  const prompts = PREVIEW_PROMPTS.filter((prompt) => prompt.areaId === area.id);
  const earlier = feedback.filter((item) => item.areaId === area.id);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--db-text-secondary)]">Focus area {PREVIEW_FOCUS_AREAS.indexOf(area) + 1} of 6</p>
        <h2 className="mt-1 text-lg font-semibold leading-6">{area.label}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--db-text-secondary)]">{area.orientation}</p>
      </div>
      <section aria-label="Key questions" className="space-y-5">
        <h3 className="text-base font-semibold">Key question{prompts.length === 1 ? '' : 's'}</h3>
        {prompts.length === 0 ? <p className="text-sm text-[var(--db-text-secondary)]">No key question is set for this area in the preview. You can still comment on any section.</p> : prompts.map((prompt) => <PromptInput key={prompt.id} prefix={prefix} prompt={prompt} state={state} onAnswer={onAnswer} />)}
      </section>
      <section aria-label="Comment on this section" className="border-t border-[var(--db-border)] pt-5">
        <h3 className="text-base font-semibold">Comment on this section</h3>
        <label htmlFor={`${prefix}-section-comment`} className="mt-2 block text-sm text-[var(--db-text-secondary)]">{sectionLabel}</label>
        <textarea id={`${prefix}-section-comment`} rows={4} maxLength={20000} value={state.sectionComments[sectionAnchor] ?? ''} onChange={(event) => onSectionComment(sectionAnchor, event.target.value)} className={inputClasses} />
        <p className="mt-1 text-xs text-[var(--db-text-secondary)]">A section comment is separate from answers to key questions.</p>
      </section>
      <section aria-label="Earlier feedback" className="border-t border-[var(--db-border)] pt-5">
        <h3 className="text-base font-semibold">Earlier feedback</h3>
        <p className="mt-1 text-xs text-[var(--db-text-secondary)]">Synthetic example of your own earlier feedback. Read-only context; never carried into a new answer.</p>
        {feedbackUnavailable ? <p role="status" className="mt-3 text-sm">Earlier feedback is unavailable because its preview identity is stale or incomplete.</p> : null}
        {!feedbackUnavailable && earlier.length === 0 ? <p className="mt-3 text-sm text-[var(--db-text-secondary)]">No earlier feedback is shown for this area in the preview.</p> : earlier.map((item) => (
          <details key={item.originalQuestionId} className="mt-3 rounded-md border border-[var(--db-border)] p-3 text-sm">
            <summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-[var(--db-focus-ring)]">{item.displayLabel}</summary>
            <p className="mt-2 text-xs text-[var(--db-text-secondary)]">Synthetic {item.responseStatus === 'submitted' ? 'submitted response' : 'saved draft'} - {item.timestamp} - {item.relationType === 'exact-continuation' ? 'same earlier wording' : 'related context only'}</p>
            <p className="mt-2 whitespace-pre-wrap">{item.text}</p>
            <dl className="mt-3 break-all text-xs text-[var(--db-text-secondary)]"><dt>Original release and question</dt><dd>{item.sourceReleaseIdentity} / {item.originalQuestionId}</dd><dt className="mt-1">Source manifest</dt><dd>{item.sourceManifestSha256.slice(0, 16)}...</dd></dl>
          </details>
        ))}
      </section>
      <div className="border-t border-[var(--db-border)] pt-5">
        <button type="button" onClick={() => onReviewed(area.id)} className={actionClasses}><Check aria-hidden="true" className="h-4 w-4" />Mark area reviewed in preview</button>
        <button type="button" onClick={onNext} className="mt-2 flex min-h-[44px] items-center gap-2 text-sm font-medium text-[var(--db-accent-strong)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]">Next area or My Review <ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
        <p className="mt-2 text-xs text-[var(--db-text-secondary)]">Preview only - nothing is saved or sent.</p>
      </div>
    </div>
  );
}

export function R2ReviewPreview({ outline, feedback, feedbackContract, paper, fixtureState = 'ready' }: R2ReviewPreviewProps) {
  const [state, setState] = useState<PreviewReviewState>(previewInitialState);
  const [activeAreaId, setActiveAreaId] = useState<PreviewFocusAreaId>(fixtureState === 'no-prompt' ? 'substances-evidence' : 'approach-structure');
  const [activeSectionAnchor, setActiveSectionAnchor] = useState(fixtureState === 'no-prompt' ? 'sec-phase2-4' : 'sec-phase2-3');
  const [wholePaper, setWholePaper] = useState(false);
  const [myReview, setMyReview] = useState(false);
  const [mobileReviewOpen, setMobileReviewOpen] = useState(false);
  const paperScrollRef = useRef<HTMLDivElement>(null);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);
  const mobileActionRef = useRef<HTMLButtonElement>(null);
  const area = PREVIEW_FOCUS_AREAS.find((candidate) => candidate.id === activeAreaId) ?? PREVIEW_FOCUS_AREAS[0];
  const sectionLabel = outline.find((entry) => entry.anchor === activeSectionAnchor)?.label ?? area.label;
  const reviewedCount = PREVIEW_FOCUS_AREAS.filter((item) => previewAreaState(state, item) === 'reviewed').length;
  const validFeedback = feedback.filter((item) => validPreviewFeedback(item, feedbackContract));
  const feedbackUnavailable = fixtureState === 'stale-lineage' || feedback.some((item) => !validPreviewFeedback(item, feedbackContract));

  const visitArea = useCallback((id: PreviewFocusAreaId) => {
    setState((current) => current.visitedAreaIds.includes(id) ? current : { ...current, visitedAreaIds: [...current.visitedAreaIds, id] });
  }, []);

  const selectArea = (id: PreviewFocusAreaId) => {
    const selected = PREVIEW_FOCUS_AREAS.find((item) => item.id === id);
    if (!selected) return;
    setMyReview(false);
    setWholePaper(false);
    setActiveAreaId(id);
    setActiveSectionAnchor(selected.anchor);
    visitArea(id);
    setMobileReviewOpen(false);
    requestAnimationFrame(() => document.getElementById(selected.anchor)?.scrollIntoView({ block: 'start' }));
  };

  const selectWholePaper = () => { setMyReview(false); setWholePaper(true); setMobileReviewOpen(false); };
  const selectMyReview = () => {
    setMyReview(true);
    setMobileReviewOpen(false);
    if (paperScrollRef.current) paperScrollRef.current.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  };
  const onAnswer: ContextProps['onAnswer'] = (id, patch) => setState((current) => ({ ...current, completed: false, answers: { ...current.answers, [id]: { ...current.answers[id], ...patch } } }));
  const onSectionComment = (anchor: string, text: string) => setState((current) => ({ ...current, completed: false, sectionComments: { ...current.sectionComments, [anchor]: text } }));
  const onWholePaperComment = (text: string) => setState((current) => ({ ...current, completed: false, wholePaperComment: text }));
  const onReviewed = (id: PreviewFocusAreaId) => setState((current) => current.reviewedAreaIds.includes(id) ? current : { ...current, completed: false, reviewedAreaIds: [...current.reviewedAreaIds, id] });
  const onNext = () => {
    const index = PREVIEW_FOCUS_AREAS.findIndex((item) => item.id === activeAreaId);
    if (index < PREVIEW_FOCUS_AREAS.length - 1) selectArea(PREVIEW_FOCUS_AREAS[index + 1].id);
    else selectMyReview();
  };

  useEffect(() => {
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    if (mobileReviewOpen && !dialog.open) dialog.showModal();
    if (!mobileReviewOpen && dialog.open) dialog.close();
  }, [mobileReviewOpen]);

  useEffect(() => {
    if (myReview || fixtureState === 'no-prompt') return;
    const root = paperScrollRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = Array.from(root.querySelectorAll<HTMLElement>('section[id^="sec-phase2-"]'));
        const top = window.innerWidth >= 1024 ? root.getBoundingClientRect().top + 100 : 170;
        const current = sections.filter((section) => section.getBoundingClientRect().top <= top).at(-1) ?? sections[0];
        if (!current) return;
        setActiveSectionAnchor(current.id);
        const id = previewAreaForAnchor(current.id);
        if (id) { setActiveAreaId(id); visitArea(id); }
      });
    };
    root.addEventListener('scroll', update, { passive: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => { cancelAnimationFrame(frame); root.removeEventListener('scroll', update); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [myReview, visitArea, fixtureState]);

  if (fixtureState === 'loading' || fixtureState === 'signed-out' || fixtureState === 'source-unavailable' || fixtureState === 'transient-read-error') {
    const messages = {
      loading: ['Loading the revised paper', 'The local preview is waiting for authenticated source content.'],
      'signed-out': ['Sign-in required', 'The review session is unavailable. Sign in before reading or responding.'],
      'source-unavailable': ['Paper unavailable', 'The exact authenticated paper could not be loaded. No substitute content is shown.'],
      'transient-read-error': ['Could not load the paper', 'A temporary read error interrupted the preview. Try again after the source is available.'],
    } as const;
    const [title, detail] = messages[fixtureState];
    return <main data-testid="r2-review-fixture-state" className="mx-auto max-w-2xl p-6"><p className="text-xs font-semibold uppercase">R2 preview fixture - {fixtureState}</p><h1 className="mt-3 text-2xl font-semibold">{title}</h1><p role="status" className="mt-3 text-sm">{detail}</p><p className="mt-4 text-xs">No review input is saved or sent in this fixture.</p></main>;
  }
  const contextProps = { area, sectionAnchor: activeSectionAnchor, sectionLabel, state, feedback: fixtureState === 'stale-lineage' || fixtureState === 'no-earlier-feedback' ? [] : validFeedback, feedbackUnavailable, onAnswer, onSectionComment, onWholePaperComment, onReviewed, onNext, wholePaper };
  const areaButtons = PREVIEW_FOCUS_AREAS.map((item, index) => {
    const status = previewAreaState(state, item);
    return <li key={item.id}><button type="button" onClick={() => selectArea(item.id)} aria-current={!myReview && !wholePaper && activeAreaId === item.id ? 'step' : undefined} className={`flex min-h-[48px] w-full items-start gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--db-depth-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] ${!myReview && !wholePaper && activeAreaId === item.id ? 'bg-[var(--db-accent-tint)] font-semibold' : ''}`}><span className="w-5 shrink-0 tabular-nums text-[var(--db-text-secondary)]">{index + 1}.</span><span className="min-w-0 flex-1">{item.label}<span className="mt-1 block text-xs font-normal text-[var(--db-text-secondary)]">{status === 'not-visited' ? 'Not visited' : status === 'visited' ? 'Visited' : status === 'has-input' ? 'Has preview input' : 'Reviewed in preview'}</span></span>{status === 'reviewed' ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--db-accent-strong)]" /> : null}</button></li>;
  });

  return (
    <div data-testid="r2-review-preview" className="min-h-screen bg-[var(--db-depth-0)] text-[var(--db-text-primary)]">
      <header className="border-b border-[var(--db-border)] bg-[var(--db-surface)] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-xl font-semibold">Matrix Options Paper - guided review preview</h1><p className="mt-1 text-sm text-[var(--db-text-secondary)]">Revised Phase 2 paper (R2) - local working preview</p></div>
          <p role="status" className="rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] px-3 py-2 text-sm font-medium">Preview only - nothing is saved or sent</p>
        </div>
        <div className="mx-auto mt-4 flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--db-text-secondary)]">
          <span className="inline-flex items-center gap-1"><BookOpen aria-hidden="true" className="h-4 w-4" />Exact R2 paper</span>
          {R2_READER_LINKS.files.map((file) => <a key={file.label} href={file.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--db-text-primary)]">{file.label}</a>)}
          <a href="/matrix-options/paper/v/v0.9.91" className="font-medium underline underline-offset-2 hover:text-[var(--db-text-primary)]">Scientific deep dive (v0.9.91)</a>
        </div>
      </header>
      <section aria-label="How to review" className="border-b border-[var(--db-border)] bg-[var(--db-depth-1)] px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1600px]"><h2 className="text-base font-semibold">How to review</h2><p className="mt-1 max-w-4xl text-sm leading-6">Read the proposed approach. Answer key questions where you have a view, and comment on any section. You can move freely between six focus areas and return to My Review before finishing.</p><p className="mt-1 text-xs text-[var(--db-text-secondary)]">Questions, choices, and earlier feedback in this preview are illustrative. Your input disappears when you reload.</p></div>
      </section>
      <div className="border-b border-[var(--db-border)] bg-[var(--db-surface)] px-4 py-3 lg:hidden">
        <label htmlFor="preview-area-picker" className="block text-xs font-semibold uppercase tracking-wide text-[var(--db-text-secondary)]">Go to a focus area</label>
        <select id="preview-area-picker" value={myReview ? 'my-review' : wholePaper ? 'whole-paper' : activeAreaId} onChange={(event) => event.target.value === 'my-review' ? selectMyReview() : event.target.value === 'whole-paper' ? selectWholePaper() : selectArea(event.target.value as PreviewFocusAreaId)} className={inputClasses}>
          {PREVIEW_FOCUS_AREAS.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.label}</option>)}
          <option value="whole-paper">Whole-paper comments</option><option value="my-review">My Review</option>
        </select>
        <p className="mt-2 text-xs text-[var(--db-text-secondary)]">{reviewedCount} of 6 areas marked reviewed. Comments and questions are optional.</p>
      </div>
      <div className={`${PAPER_SHELL_CLASSES} mx-auto max-w-[1600px] lg:h-[calc(100dvh-12rem)]`}>
        <aside aria-label="Review navigation" className="hidden w-72 shrink-0 overflow-y-auto border-r border-[var(--db-border)] bg-[var(--db-depth-1)] p-4 lg:block">
          <h2 className="text-sm font-semibold">Focus areas</h2><p className="mt-1 text-xs text-[var(--db-text-secondary)]">{reviewedCount} of 6 marked reviewed</p>
          <div role="progressbar" aria-label="Focus areas reviewed in preview" aria-valuenow={reviewedCount} aria-valuemin={0} aria-valuemax={6} className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--db-depth-2)]"><div className="h-full bg-[var(--db-accent)]" style={{ width: `${reviewedCount / 6 * 100}%` }} /></div>
          <ol className="mt-4 space-y-1">{areaButtons}</ol>
          <div className="mt-4 space-y-1 border-t border-[var(--db-border)] pt-3">
            <button type="button" onClick={selectWholePaper} className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-[var(--db-depth-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"><MessageSquareText aria-hidden="true" className="h-4 w-4" />Whole-paper comments</button>
            <button type="button" onClick={selectMyReview} className="flex min-h-[44px] w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium hover:bg-[var(--db-depth-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"><Check aria-hidden="true" className="h-4 w-4" />My Review <ChevronRight aria-hidden="true" className="ml-auto h-4 w-4" /></button>
          </div>
        </aside>
        <main ref={paperScrollRef} data-testid="preview-paper-column" className="min-w-0 flex-1 bg-[var(--db-surface)] lg:overflow-y-auto">
          <div className={myReview ? 'hidden' : 'paper-reading-frame mx-auto max-w-4xl space-y-5 px-4 py-6 pb-28 sm:px-8 lg:pb-8'}>
            <div className="border-b border-[var(--db-border)] pb-3"><p className="text-xs font-medium text-[var(--db-text-secondary)]">Revised Phase 2 paper - R2</p><p className="mt-1 text-sm">Read in any order. Use the right panel or the phone action to respond in this preview.</p></div>
            {paper}
          </div>
          {myReview ? <div data-testid="preview-my-review" className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 sm:px-8 lg:pb-8"><h2 className="text-2xl font-semibold">My Review</h2><p className="text-sm leading-6">Check what you entered before you finish this local preview. Nothing here is saved or submitted.</p><p className="text-sm font-medium">{reviewedCount} of 6 focus areas marked reviewed. Optional questions may remain unanswered.</p><ol className="space-y-4">{PREVIEW_FOCUS_AREAS.map((item, index) => <li key={item.id} className="border-t border-[var(--db-border)] pt-4"><h3 className="font-semibold">{index + 1}. {item.label}</h3><p className="mt-1 text-xs text-[var(--db-text-secondary)]">{previewAreaState(state, item).replace('-', ' ')}</p>{item.promptIds.map((id) => { const prompt = PREVIEW_PROMPTS.find((candidate) => candidate.id === id); const answer = state.answers[id]; return <p key={id} className="mt-2 text-sm"><span className="font-medium">{prompt?.label}</span><br />{answer?.choiceId ? prompt?.kind === 'choice' ? prompt.options.find((option) => option.id === answer.choiceId)?.label : answer.choiceId : answer?.text?.trim() || 'No answer'}{answer?.rationale?.trim() ? ` - ${answer.rationale.trim()}` : ''}</p>; })}<p className="mt-2 text-xs text-[var(--db-text-secondary)]">Section comments: {Object.entries(state.sectionComments).filter(([anchor, text]) => previewAreaForAnchor(anchor) === item.id && text.trim()).length}</p><button type="button" onClick={() => selectArea(item.id)} className="mt-2 min-h-[44px] text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">Return to area</button></li>)}</ol><section className="border-t border-[var(--db-border)] pt-4"><h3 className="font-semibold">Section comments</h3>{Object.entries(state.sectionComments).filter(([, text]) => text.trim()).length === 0 ? <p className="mt-2 text-sm">No section comments</p> : <ul className="mt-2 space-y-3">{Object.entries(state.sectionComments).filter(([, text]) => text.trim()).map(([anchor, text]) => <li key={anchor}><p className="text-xs font-semibold text-[var(--db-text-secondary)]">{outline.find((entry) => entry.anchor === anchor)?.label ?? anchor}</p><p className="mt-1 whitespace-pre-wrap text-sm">{text.trim()}</p></li>)}</ul>}</section><section className="border-t border-[var(--db-border)] pt-4"><h3 className="font-semibold">Whole-paper comments</h3><p className="mt-2 whitespace-pre-wrap text-sm">{state.wholePaperComment.trim() || 'No whole-paper comment'}</p><button type="button" onClick={selectWholePaper} className="mt-2 min-h-[44px] text-sm font-medium text-[var(--db-accent-strong)] underline underline-offset-2">Edit whole-paper comment</button></section><button type="button" onClick={() => setState((current) => ({ ...current, completed: true }))} className={actionClasses}>Finish this preview</button><p role="status" className="text-sm font-medium">{state.completed ? 'Preview complete on this page. Nothing was saved or sent.' : 'Review your entries, then finish the local preview when ready.'}</p></div> : null}
        </main>
        {!myReview ? <aside aria-label="Review this section" className="hidden w-80 shrink-0 overflow-y-auto border-l border-[var(--db-border)] bg-[var(--db-surface)] p-5 lg:block"><PreviewContext prefix="desktop" {...contextProps} /></aside> : null}
      </div>
      {!myReview ? <button ref={mobileActionRef} type="button" onClick={() => setMobileReviewOpen(true)} className={`${actionClasses} fixed inset-x-4 bottom-4 z-20 shadow-lg lg:hidden`}>{wholePaper ? 'Review whole paper' : 'Review this section'}</button> : null}
      <dialog ref={mobileDialogRef} onClose={() => { setMobileReviewOpen(false); mobileActionRef.current?.focus(); }} aria-label={wholePaper ? 'Whole-paper comments' : 'Review this section'} className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-xl border border-[var(--db-border)] bg-[var(--db-surface)] p-5 text-[var(--db-text-primary)] shadow-xl backdrop:bg-black/50 lg:hidden"><div className="mb-4 flex items-center justify-between border-b border-[var(--db-border)] pb-3"><p className="text-sm font-semibold">{wholePaper ? 'Whole-paper comments' : 'Review this section'}</p><button type="button" onClick={() => setMobileReviewOpen(false)} aria-label="Close review panel" className="flex h-11 w-11 items-center justify-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"><X aria-hidden="true" className="h-5 w-5" /></button></div><PreviewContext prefix="mobile" {...contextProps} /></dialog>
    </div>
  );
}
