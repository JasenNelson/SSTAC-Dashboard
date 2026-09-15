'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Download, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { createPortal } from 'react-dom';

import MathRenderer from '@/components/MathRenderer';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortId, CohortManifest } from '@/lib/matrix-options/cohort-contract';
import type {
  AtlasRow,
  WorkspaceMode,
  WorkspaceModel,
} from '@/lib/matrix-options/revised-paper-review';
import {
  placementDomainLabel,
  REVIEW_LENSES,
} from '@/lib/matrix-options/revised-paper-review';
import type { PublicationLens } from '@/lib/matrix-options/revised-paper-structure';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

export interface RevisedPaperWorkspaceProps {
  readonly model: WorkspaceModel;
  readonly readerText?: string;
  readonly cohortPortions?: readonly CohortPortion[];
}

export interface CohortPortion {
  readonly id: string;
  readonly cohortId: CohortId;
  readonly name: string;
  readonly status: 'available' | 'unavailable';
  readonly sectionNumber: string;
  readonly sourceLocator: string;
  readonly sourceNodeId?: string;
  readonly sectionLabel?: string;
  readonly startByte?: number;
  readonly endByte?: number;
  readonly text?: string;
}

type WorkspaceDrawer = 'review-package' | 'publication-sections' | 'reading-materials' | 'release-notes';
type OpenWorkspaceDrawer = WorkspaceDrawer | null;

const STANDALONE_SECTION_ANCHOR_LINE = /^[ \t]*<div[ \t]+id="[^"\r\n]+"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*(?:\r?\n|$)/gm;

export function normalizeReaderTextForDisplay(text: string): string {
  return text.replace(STANDALONE_SECTION_ANCHOR_LINE, '');
}

function CohortNav({ cohortManifest, cohortPortions, selectedCohortId, selectedPortionId, onSelect, onSelectPortion }: { readonly cohortManifest: CohortManifest; readonly cohortPortions: readonly CohortPortion[]; readonly selectedCohortId: CohortId; readonly selectedPortionId?: string; readonly onSelect: (cohortId: CohortId) => void; readonly onSelectPortion: (portionId: string) => void }) {
  return <nav aria-label="Review cohorts"><ul className="space-y-2">{cohortManifest.cohorts.map((cohort) => {
    const selected = selectedCohortId === cohort.id;
    const portions = cohortPortions.filter((portion) => portion.cohortId === cohort.id);
    const portionsId = `cohort-${cohort.id}-portions`;
    return <li key={cohort.id} className="rounded-lg border border-slate-200 dark:border-slate-700">
      <button type="button" aria-label={`${cohort.name}, ${cohort.questionNumbers.length} questions`} aria-expanded={selected} aria-controls={portionsId} aria-pressed={selected} onClick={() => onSelect(cohort.id)} className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${selected ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><span className="min-w-0 break-words">{cohort.name}</span><span className="shrink-0 text-xs font-normal">{cohort.questionNumbers.length} questions</span></button>
      <div id={portionsId} hidden={!selected} aria-hidden={!selected} className="border-t border-slate-200 p-2 dark:border-slate-700">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Authenticated paper portions</p>
        {portions.length > 0 ? <ul className="space-y-1">{portions.map((portion) => <li key={portion.id}><button type="button" aria-label={`${portion.sectionLabel ?? `Section ${portion.sectionNumber}`}${portion.status === 'unavailable' ? ', unavailable' : ''}`} aria-pressed={selectedPortionId === portion.id} onClick={() => onSelectPortion(portion.id)} className={`min-h-[44px] w-full rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${selectedPortionId === portion.id ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><span className="block break-words">{portion.sectionLabel ?? `Section ${portion.sectionNumber}`}</span><span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{portion.status === 'unavailable' ? 'Unavailable in this release' : portion.sourceLocator}</span></button></li>)}</ul> : <p className="px-2 pb-2 text-sm text-slate-600 dark:text-slate-300">No authenticated paper portion is available for this cohort.</p>}
      </div>
    </li>;
  })}</ul></nav>;
}

function CohortPaperPortion({ cohort, portion, headingRef }: { readonly cohort: CohortManifest['cohorts'][number] | undefined; readonly portion: CohortPortion | undefined; readonly headingRef: RefObject<HTMLHeadingElement | null> }) {
  if (!cohort || !portion) return <section data-testid="cohort-paper" aria-labelledby="cohort-paper-heading" className="rounded-xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950"><h2 id="cohort-paper-heading" className="text-lg font-bold">Selected cohort paper</h2><p className="mt-2 text-sm">This authenticated bounded portion is unavailable.</p></section>;
  if (portion.status === 'unavailable') return <section data-testid="cohort-paper" aria-labelledby="cohort-paper-heading" className="min-w-0 border-y border-amber-300 py-5 dark:border-amber-800 print:hidden"><p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Paper section unavailable</p><h2 ref={headingRef} tabIndex={-1} id="cohort-paper-heading" className="mt-1 text-xl font-bold">{portion.sectionLabel ?? `Section ${portion.sectionNumber}`}</h2><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Section {portion.sectionNumber} is referenced by this review cohort but is not present as a section in this release.</p><p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">Source locator: {portion.sourceLocator}. No paper bytes are attached.</p></section>;
  const displayPortionText = portion.text ? normalizeReaderTextForDisplay(portion.text) : '';
  return <section data-testid="cohort-paper" aria-labelledby="cohort-paper-heading" className="min-w-0 border-y border-sky-200 py-5 dark:border-sky-900 print:hidden">
    <p className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200">Authenticated paper portion</p>
    <h2 ref={headingRef} tabIndex={-1} id="cohort-paper-heading" className="mt-1 text-xl font-bold">{portion.sectionLabel ?? cohort.name}</h2>
    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{cohort.purpose}</p>
    <p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">Authenticated source: {portion.sourceNodeId ?? 'section unavailable'}; bytes {portion.startByte ?? 'unavailable'}-{portion.endByte ?? 'unavailable'}. Five cohorts remain proposed pending owner QP approval.</p>
    <div className="reader-prose mt-4 min-w-0 max-w-none [&_blockquote]:max-w-[84ch] [&_li]:max-w-[84ch] [&_p]:max-w-[84ch]"><MathRenderer content={displayPortionText} /></div>
  </section>;
}

function ActiveQuestionResponse({ questions, question, responseRef, onSelectQuestion, onPreviousQuestion, onNextQuestion }: { readonly questions: readonly ReviewerGuideContract['questions'][number][]; readonly question: ReviewerGuideContract['questions'][number] | undefined; readonly responseRef: RefObject<HTMLElement | null>; readonly onSelectQuestion: (number: number) => void; readonly onPreviousQuestion: () => void; readonly onNextQuestion: () => void }) {
  return <section ref={responseRef} tabIndex={-1} data-testid="active-question-response" aria-labelledby="active-question-heading" className="rounded-xl border border-slate-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-700 dark:bg-slate-900 print:hidden">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Response preview</p><h2 id="active-question-heading" className="mt-1 text-lg font-bold">{question ? `Question ${question.number}: ${question.heading}` : 'Active review question'}</h2></div><span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Responses not connected</span></div>
    {question ? <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"><MathRenderer content={question.prompt} /></div> : <p className="mt-4 text-sm">No authenticated question is selected.</p>}
    <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Authenticated responses, saving, submitting, and resuming are not connected until U4-U6. No response editor or progress claim is available.</p>
    <div aria-disabled="true" className="mt-4 min-h-48 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400">Response space is reserved for the approved response workflow. It is read-only until U4-U6.</div>
    <div data-testid="question-navigation" className="mt-5 min-w-0 space-y-4"><label className="block min-w-0 text-sm font-semibold">Jump to question<select value={question?.number ?? ''} onChange={(event) => onSelectQuestion(Number(event.target.value))} className="mt-1 block min-h-[44px] w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950">{questions.map((item) => <option key={item.id} value={item.number}>Question {item.number}: {item.heading}</option>)}</select></label><div data-testid="question-navigation-buttons" className="grid min-w-0 grid-cols-2 gap-3"><button type="button" disabled={!question || questions.findIndex((item) => item.number === question.number) <= 0} onClick={onPreviousQuestion} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Previous question</button><button type="button" disabled={!question || questions.findIndex((item) => item.number === question.number) >= questions.length - 1} onClick={onNextQuestion} className="min-h-[44px] min-w-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Next question</button></div></div>
  </section>;
}

function assignmentStateLabel(assignment: WorkspaceModel['assignment']): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignment unavailable';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No assignment';
  return 'Assigned';
}

function assignmentSourceLabel(assignment: WorkspaceModel['assignment']): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignments are not connected for this release.';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No authoritative assignment exists for this release.';
  return assignment.title;
}

const lensLabel: Record<PublicationLens, string> = {
  all: 'All',
  core: 'Core',
  appendices: 'Appendices',
  evidence: 'Evidence',
  objects: 'Objects',
  questions: 'Questions',
};

function queryHref(model: WorkspaceModel, mode: WorkspaceMode, lens = model.atlas.query.lens, page = 1): string {
  const query = new URLSearchParams({ mode, lens, page: String(page) });
  if (model.atlas.query.q) query.set('q', model.atlas.query.q);
  return `?${query.toString()}`;
}

function publicationRootHref(model: WorkspaceModel, mode: WorkspaceMode): string {
  return `/matrix-options/paper/publication/v/${encodeURIComponent(model.documentVersion)}${queryHref(model, mode)}`;
}

function destinationHref(model: WorkspaceModel, destination: string): string {
  return `${destination}${queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page)}`;
}

function AtlasRowView({ model, row }: { readonly model: WorkspaceModel; readonly row: AtlasRow }) {
  return (
    <li className="border-t border-slate-200 py-3 first:border-t-0 dark:border-slate-700">
      <a href={destinationHref(model, row.href)} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>{placementDomainLabel(row.domain)}</span>
          <span aria-hidden="true">|</span>
          <span>Source-linked placement</span>
        </span>
        <span className="mt-1 block min-w-0 break-words text-base font-semibold text-slate-950 group-hover:underline dark:text-white [overflow-wrap:anywhere]">{row.label}</span>
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Authenticated source placement</span>
      </a>
    </li>
  );
}

function drawerTitle(drawer: WorkspaceDrawer): string {
  if (drawer === 'review-package' || drawer === 'publication-sections') return 'Navigation';
  if (drawer === 'reading-materials') return 'Download files';
  return 'Review Comments';
}

function ReadingMaterialsPanel({ selectedCohort }: { readonly selectedCohort: CohortManifest['cohorts'][number] | undefined }) {
  return <section aria-labelledby="reading-materials-heading" data-testid="reading-materials-content" className="space-y-4">
    <p id="reading-materials-instructions" className="text-sm text-slate-600 dark:text-slate-300">Download files is where verified cohort PDF and DOCX reading packages will be downloaded when ready. They are not available yet.</p>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <h3 id="reading-materials-heading" className="font-bold">Download files: {selectedCohort?.name ?? 'Selected cohort'}</h3>
      <p className="mt-2">The selected cohort PDF and DOCX are being prepared pending integrity verification. No download is available in this preview.</p>
    </div>
  </section>;
}

function WorkspacePanel({ drawer, model, cohortManifest, cohortPortions, selectedCohortId, selectedPortionId, selectedQuestions, activeQuestion, responseRef, onSelectCohort, onSelectPortion, onSelectQuestion, onPreviousQuestion, onNextQuestion, onClose, closeRef }: {
  readonly drawer: WorkspaceDrawer;
  readonly model: WorkspaceModel;
  readonly cohortManifest: CohortManifest;
  readonly cohortPortions: readonly CohortPortion[];
  readonly selectedCohortId: CohortId;
  readonly selectedPortionId?: string;
  readonly selectedQuestions: readonly ReviewerGuideContract['questions'][number][];
  readonly activeQuestion: ReviewerGuideContract['questions'][number] | undefined;
  readonly responseRef: RefObject<HTMLElement | null>;
  readonly onSelectCohort: (cohortId: CohortId) => void;
  readonly onSelectPortion: (portionId: string) => void;
  readonly onSelectQuestion: (number: number) => void;
  readonly onPreviousQuestion: () => void;
  readonly onNextQuestion: () => void;
  readonly onClose: () => void;
  readonly closeRef: RefObject<HTMLButtonElement | null>;
}) {
  const selectedCohort = cohortManifest.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? cohortManifest.cohorts[0];
  const id = `${drawer}-panel`;
  return <section id={id} data-testid={`${drawer}-panel`} aria-labelledby={`${id}-heading`} aria-describedby={`${id}-instructions`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:w-full">
    <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700"><div className="min-w-0"><h2 id={`${id}-heading`} className="text-base font-bold">{drawerTitle(drawer)}</h2><p id={`${id}-instructions`} className="mt-1 text-xs text-slate-600 dark:text-slate-300">This panel stays in the page flow. Use Hide to return to the document.</p></div><button ref={closeRef} type="button" aria-label={`Hide ${drawerTitle(drawer)}`} aria-controls={id} title={`Hide ${drawerTitle(drawer)}`} onClick={onClose} className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">{drawer === 'release-notes' ? <PanelRightClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}<span>Hide</span></button></div>
    <div className="mt-4 min-w-0">
      {drawer === 'review-package' && <><p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Choose a release-bound cohort and its authenticated paper portions.</p><CohortNav cohortManifest={cohortManifest} cohortPortions={cohortPortions} selectedCohortId={selectedCohortId} selectedPortionId={selectedPortionId} onSelect={onSelectCohort} onSelectPortion={onSelectPortion} /></>}
      {drawer === 'publication-sections' && <><p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Choose a publication lens; the Atlas stays in the document column.</p><LensNav model={model} /></>}
      {drawer === 'reading-materials' && <ReadingMaterialsPanel selectedCohort={selectedCohort} />}
      {drawer === 'release-notes' && <ActiveQuestionResponse questions={selectedQuestions} question={activeQuestion} responseRef={responseRef} onSelectQuestion={onSelectQuestion} onPreviousQuestion={onPreviousQuestion} onNextQuestion={onNextQuestion} />}
    </div>
  </section>;
}

export function RevisedPaperWorkspace({ model, readerText, cohortPortions }: RevisedPaperWorkspaceProps) {
  const displayReaderText = readerText ? normalizeReaderTextForDisplay(readerText) : '';
  const selectedRow = model.atlas.rows[0];
  const requestedDetail = model.requestedDetail;
  const cohortManifest = useMemo(() => getCohortManifest(), []);
  const reviewerGuide = useMemo(() => getReviewerGuideContract(), []);
  const [selectedCohortId, setSelectedCohortId] = useState<CohortId>(cohortManifest.cohorts[0]?.id ?? 'categories');
  const selectedCohort = cohortManifest.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? cohortManifest.cohorts[0];
  const selectedQuestions = useMemo(() => reviewerGuide.questions.filter((question) => selectedCohort?.questionNumbers.includes(question.number)), [reviewerGuide, selectedCohort]);
  const selectedPortions = useMemo(() => (cohortPortions ?? []).filter((portion) => portion.cohortId === selectedCohort?.id), [cohortPortions, selectedCohort]);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(selectedQuestions[0]?.number ?? 1);
  const [portionIndex, setPortionIndex] = useState(0);
  const [openDrawer, setOpenDrawer] = useState<OpenWorkspaceDrawer>(null);
  const [headerActionsHost, setHeaderActionsHost] = useState<HTMLElement | null>(null);
  const [headerActionsReady, setHeaderActionsReady] = useState(false);
  const drawerOpenerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const responseRef = useRef<HTMLElement>(null);
  const paperHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingPaperSelectionRef = useRef<{ readonly cohortId: CohortId; readonly portionId?: string } | null>(null);

  useEffect(() => {
    setHeaderActionsHost(document.getElementById('matrix-options-paper-header-actions'));
    setHeaderActionsReady(true);
  }, []);

  useEffect(() => {
    setActiveQuestionNumber(selectedQuestions[0]?.number ?? 1);
    const pending = pendingPaperSelectionRef.current;
    if (pending?.cohortId === selectedCohortId && pending.portionId) {
      const pendingIndex = selectedPortions.findIndex((portion) => portion.id === pending.portionId);
      setPortionIndex(pendingIndex >= 0 ? pendingIndex : 0);
    } else {
      setPortionIndex(0);
    }
  }, [selectedCohortId, selectedQuestions, selectedPortions]);

  const activeQuestion = selectedQuestions.find((question) => question.number === activeQuestionNumber) ?? selectedQuestions[0];
  const selectedPortion = selectedPortions[portionIndex];
  const portionCount = Math.max(1, selectedPortions.length);

  useEffect(() => {
    const pending = pendingPaperSelectionRef.current;
    if (!pending || pending.cohortId !== selectedCohortId || (pending.portionId && pending.portionId !== selectedPortion?.id)) return;
    pendingPaperSelectionRef.current = null;
    paperHeadingRef.current?.focus();
    paperHeadingRef.current?.scrollIntoView?.({ block: 'start' });
  }, [selectedCohortId, selectedPortion?.id]);

  useEffect(() => {
    if (!openDrawer) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpenDrawer(null);
        drawerOpenerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    drawerCloseRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openDrawer]);

  const closeDrawer = () => {
    setOpenDrawer(null);
    drawerOpenerRef.current?.focus();
  };
  const toggleDrawer = (drawer: WorkspaceDrawer, trigger: HTMLElement) => {
    drawerOpenerRef.current = trigger;
    setOpenDrawer((current) => current === drawer ? null : drawer);
  };
  const selectQuestion = (number: number) => {
    setActiveQuestionNumber(number);
    responseRef.current?.focus();
    responseRef.current?.scrollIntoView?.({ block: 'start' });
  };
  const selectCohort = (cohortId: CohortId) => {
    const firstPortion = (cohortPortions ?? []).find((portion) => portion.cohortId === cohortId);
    pendingPaperSelectionRef.current = { cohortId, portionId: firstPortion?.id };
    setSelectedCohortId(cohortId);
    const firstQuestion = reviewerGuide.questions.find((question) => cohortManifest.cohorts.find((cohort) => cohort.id === cohortId)?.questionNumbers.includes(question.number));
    setActiveQuestionNumber(firstQuestion?.number ?? 1);
    setPortionIndex(0);
  };
  const selectPortion = (portionId: string) => {
    const portion = (cohortPortions ?? []).find((candidate) => candidate.id === portionId);
    if (!portion) return;
    pendingPaperSelectionRef.current = { cohortId: portion.cohortId, portionId };
    setSelectedCohortId(portion.cohortId);
    const nextPortions = (cohortPortions ?? []).filter((candidate) => candidate.cohortId === portion.cohortId);
    setPortionIndex(Math.max(0, nextPortions.findIndex((candidate) => candidate.id === portionId)));
    const firstQuestion = reviewerGuide.questions.find((question) => cohortManifest.cohorts.find((cohort) => cohort.id === portion.cohortId)?.questionNumbers.includes(question.number));
    setActiveQuestionNumber(firstQuestion?.number ?? 1);
  };
  const moveQuestion = (offset: number) => {
    const currentIndex = selectedQuestions.findIndex((question) => question.number === activeQuestion?.number);
    const next = selectedQuestions[currentIndex + offset];
    if (next) selectQuestion(next.number);
  };
  const leftRailOpen = openDrawer === 'review-package' || openDrawer === 'publication-sections';
  const rightRailOpen = openDrawer === 'release-notes';
  const leftDrawer = model.mode === 'my-review' ? 'review-package' : 'publication-sections';
  const leftLabel = 'Navigation';
  const panelButtons = <>
    <button type="button" aria-label={`${leftRailOpen ? 'Hide' : 'Show'} ${leftLabel}`} aria-expanded={leftRailOpen} aria-controls={`${leftDrawer}-panel`} onClick={(event) => toggleDrawer(leftDrawer, event.currentTarget)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${leftRailOpen ? 'border border-slate-400 bg-slate-200 text-slate-900 shadow-sm hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>{leftRailOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />}<span>{leftLabel}</span></button>
    {model.mode === 'my-review' && <button type="button" aria-label={`${rightRailOpen ? 'Hide' : 'Show'} Review Comments`} aria-expanded={rightRailOpen} aria-controls="release-notes-panel" onClick={(event) => toggleDrawer('release-notes', event.currentTarget)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${rightRailOpen ? 'border border-slate-400 bg-slate-200 text-slate-900 shadow-sm hover:bg-slate-300 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}>{rightRailOpen ? <PanelRightClose aria-hidden="true" className="h-4 w-4" /> : <PanelRightOpen aria-hidden="true" className="h-4 w-4" />}<span>Review Comments</span></button>}
  </>;
  const panelControls = <div data-testid="workspace-panel-controls" className="flex flex-wrap items-center gap-2">{panelButtons}</div>;
  return (
    <>
    {headerActionsHost ? createPortal(panelControls, headerActionsHost) : null}
    <div data-testid="workspace-shell" className="min-h-screen overflow-x-clip bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="mx-auto flex max-w-[120rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Matrix Options Paper</p>
            <h1 className="text-xl font-bold">Review workspace</h1>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{model.documentVersion}</p>
          </div>
          <div data-testid="workspace-header-controls" className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <nav aria-label="Workspace mode" className="flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <a href={publicationRootHref(model, 'my-review')} aria-current={model.mode === 'my-review' ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${model.mode === 'my-review' ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>My Review</a>
              <a href={model.mode === 'publication' ? queryHref(model, 'publication') : publicationRootHref(model, 'publication')} aria-current={model.mode === 'publication' ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${model.mode === 'publication' ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Publication</a>
            </nav>
            <button type="button" aria-label={`${openDrawer === 'reading-materials' ? 'Hide' : 'Show'} Download files`} aria-expanded={openDrawer === 'reading-materials'} aria-controls="reading-materials-panel" onClick={(event) => toggleDrawer('reading-materials', event.currentTarget)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${openDrawer === 'reading-materials' ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'}`}><Download aria-hidden="true" className="h-4 w-4" /><span>Download files</span></button>
            {headerActionsReady && !headerActionsHost && <div className="border-l border-slate-200 pl-2 dark:border-slate-700 sm:ml-1">{panelControls}</div>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[90rem] px-4 py-5 sm:px-6 print:max-w-none print:px-0 print:py-0">
        {openDrawer === 'reading-materials' && <WorkspacePanel drawer="reading-materials" model={model} cohortManifest={cohortManifest} cohortPortions={cohortPortions ?? []} selectedCohortId={selectedCohortId} selectedPortionId={selectedPortion?.id} selectedQuestions={selectedQuestions} activeQuestion={activeQuestion} responseRef={responseRef} onSelectCohort={selectCohort} onSelectPortion={selectPortion} onSelectQuestion={selectQuestion} onPreviousQuestion={() => moveQuestion(-1)} onNextQuestion={() => moveQuestion(1)} onClose={closeDrawer} closeRef={drawerCloseRef} />}
        <div data-testid="workspace-layout" className={`block min-w-0 items-start gap-4 lg:grid motion-safe:transition-[grid-template-columns] motion-safe:duration-200 motion-reduce:transition-none ${rightRailOpen ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : leftRailOpen ? 'lg:grid-cols-[20rem_minmax(0,1fr)]' : 'lg:block'} print:block`}>
          {leftRailOpen && <aside aria-label={leftLabel} className="min-w-0 print:hidden"><WorkspacePanel drawer={leftDrawer} model={model} cohortManifest={cohortManifest} cohortPortions={cohortPortions ?? []} selectedCohortId={selectedCohortId} selectedPortionId={selectedPortion?.id} selectedQuestions={selectedQuestions} activeQuestion={activeQuestion} responseRef={responseRef} onSelectCohort={selectCohort} onSelectPortion={selectPortion} onSelectQuestion={selectQuestion} onPreviousQuestion={() => moveQuestion(-1)} onNextQuestion={() => moveQuestion(1)} onClose={closeDrawer} closeRef={drawerCloseRef} /></aside>}
        <section className="min-w-0 space-y-5" aria-label="Publication workspace">
          <section className={model.mode === 'my-review' ? 'flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-200 py-3 dark:border-slate-700 print:hidden' : 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:hidden'}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">{model.mode === 'my-review' ? 'My Review' : 'Publication cockpit'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">One authenticated paper release, one bounded server window.</p></div>
              <span className="max-w-full break-words rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 [overflow-wrap:anywhere]">{assignmentStateLabel(model.assignment)}</span>
            </div>
            <p className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">Assignment source: {assignmentSourceLabel(model.assignment)}</p>
          </section>

          {model.mode === 'publication' && <section aria-labelledby="atlas-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:hidden">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="atlas-heading" className="text-lg font-bold">Publication Atlas</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{model.atlas.totalMatches} matching placements; page {model.atlas.query.page} of {model.atlas.totalPages}.</p></div></div>
            <form method="get" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
              <input type="hidden" name="mode" value={model.mode} /><input type="hidden" name="lens" value={model.atlas.query.lens} />
              <label className="flex-1 text-sm font-semibold">Search labels<input name="q" defaultValue={model.atlas.query.q} maxLength={160} className="mt-1 block min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" /></label>
              <button type="submit" className="min-h-[44px] rounded-md bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Search</button>
            </form>
            <ol className="mt-4" aria-label="Current atlas page">{model.atlas.rows.map((row) => <AtlasRowView key={`${row.id}-${row.startByte}`} model={model} row={row} />)}</ol>
            <nav aria-label="Atlas pages" className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              {model.atlas.hasPrevious && <a href={queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page - 1)} className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600">Previous</a>}
              {model.atlas.hasNext && <a href={queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page + 1)} className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600">Next</a>}
            </nav>
          </section>}

        {model.mode === 'my-review' && <><CohortPaperPortion cohort={selectedCohort} portion={selectedPortion} headingRef={paperHeadingRef} /><nav aria-label="Paper portion navigation" data-testid="paper-portion-navigation" className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 print:hidden"><span className="text-sm font-semibold">Paper portion {portionIndex + 1} of {portionCount}</span><button type="button" disabled={portionIndex === 0} onClick={() => setPortionIndex((index) => Math.max(0, index - 1))} className="min-h-[44px] min-w-40 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Previous portion</button><button type="button" disabled={portionIndex >= portionCount - 1} onClick={() => setPortionIndex((index) => Math.min(portionCount - 1, index + 1))} className="min-h-[44px] min-w-40 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600">Next portion</button></nav></>}

        {model.mode === 'publication' && <section aria-labelledby="reader-heading" data-reader-detail-id={requestedDetail?.id ?? undefined} className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:col-span-full print:w-full print:max-w-none print:border-0 print:bg-transparent print:p-0">
            <h2 id="reader-heading" className="text-lg font-bold">{requestedDetail?.label ?? 'Canonical reader'}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reader content is sourced from the authenticated release and selected range.</p>
            {!requestedDetail && selectedRow && <h3 className="mt-4 text-base font-semibold">{selectedRow.label}</h3>}
            {model.readerContext.selectedId && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Selected canonical section is linked to {model.readerContext.ancestors.length} authenticated ancestors and {model.readerContext.neighborhood.length} nearby headings.</p>}
            {model.mode === 'publication' && readerText && <div className="mt-3 min-w-0 rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><MathRenderer content={displayReaderText} internalLinkMap={model.internalLinkMap} /></div>}
            {model.mode === 'publication' && <section aria-labelledby="question-packet-heading" className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700 print:hidden"><h3 id="question-packet-heading" className="font-semibold">Unassigned publication questions</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This packet is structural only; no assignment, inventory, progress, or disposition is created.</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{model.questionPacket.map((question) => <li key={question.id}><a className="underline" href={destinationHref(model, `/matrix-options/paper/publication/v/${encodeURIComponent(model.documentVersion)}/questions/${encodeURIComponent(question.id)}`)}>{question.label}</a></li>)}</ol></section>}
          </section>}

          
        </section>
          {rightRailOpen && model.mode === 'my-review' && <aside aria-label="Review Comments" className="min-w-0 print:hidden"><WorkspacePanel drawer="release-notes" model={model} cohortManifest={cohortManifest} cohortPortions={cohortPortions ?? []} selectedCohortId={selectedCohortId} selectedPortionId={selectedPortion?.id} selectedQuestions={selectedQuestions} activeQuestion={activeQuestion} responseRef={responseRef} onSelectCohort={selectCohort} onSelectPortion={selectPortion} onSelectQuestion={selectQuestion} onPreviousQuestion={() => moveQuestion(-1)} onNextQuestion={() => moveQuestion(1)} onClose={closeDrawer} closeRef={drawerCloseRef} /></aside>}

        </div>
      </div>
    </div>
    </>
  );
}

function LensNav({ model }: { readonly model: WorkspaceModel }) {
  return <nav aria-label="Publication lenses"><ul className="space-y-1">{REVIEW_LENSES.map((lens) => <li key={lens}><a href={queryHref(model, model.mode, lens)} aria-current={model.atlas.query.lens === lens ? 'page' : undefined} className="flex min-h-[44px] items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><span>{lensLabel[lens]}</span><span className="font-mono text-xs">{lens === model.atlas.query.lens ? model.atlas.totalMatches : '-'}</span></a></li>)}</ul></nav>;
}
