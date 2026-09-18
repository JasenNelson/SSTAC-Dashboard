'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import { Download, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { createPortal } from 'react-dom';

import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortId, CohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import { stripStandaloneSectionAnchorLines } from '@/lib/matrix-options/paper/full-document';
import { PAPER_LANDING_TOLERANCE_PX, PaperScrollAuthority, panelRevealScrollDelta } from '@/lib/matrix-options/paper/scroll-authority';
import type { PaperRevealCause } from '@/lib/matrix-options/paper/scroll-authority';
import { owningSectionIndex } from '@/lib/matrix-options/paper/section-window';
import { paperWorkspaceHref, parsePaperUrlState, serializePaperUrlState } from '@/lib/matrix-options/paper/url-state';
import type { PaperSearchParams, PaperUrlContext, PaperUrlState } from '@/lib/matrix-options/paper/url-state';
import type { AssignmentState } from '@/lib/matrix-options/revised-paper-review';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import type { ReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { cn } from '@/utils/cn';

import { CohortReviewNav } from './CohortReviewNav';
import { PAPER_STICKY_HEADER_HEIGHT_VAR } from './PaperChunkSection';
import { isPlainPrimaryClick, PaperOutlineNav } from './PaperOutlineNav';
import type { PaperOutlineNavEntry } from './PaperOutlineNav';
import { PaperRail, PaperRailToggle, PAPER_SHELL_CLASSES } from './PaperRail';
import { PaperLoadFullDocumentControl, PaperSectionWindowView, usePaperSectionWindow } from './PaperSectionWindow';
import type { PaperSectionWindowData } from './PaperSectionWindow';
import { PaperText, portionHeadingOffset } from './PaperText';
import { isLgViewport } from './paper-viewport';
import { ReviewCommentsPanel } from './ReviewCommentsPanel';
import { DownloadFilesPanel } from './DownloadFilesPanel';
import type { VerifiedDownloadManifest } from '@/lib/matrix-options/paper/download-manifest';

export interface RevisedPaperWorkspaceProps {
  readonly documentVersion: string;
  /** Authenticated release manifest identity passed by the server route. */
  readonly reviewManifestSha256?: string;
  /** Canonical URL state parsed on the server (paper/url-state.ts). */
  readonly urlState: PaperUrlState;
  readonly assignment: AssignmentState;
  /** Working Draft only: the full outline for the Navigation rail. */
  readonly outline?: readonly PaperOutlineNavEntry[];
  /** My Review only: authenticated cohort portions from deriveCohortPortions. */
  readonly cohortPortions?: readonly CohortPortion[];
  /**
   * Working Draft only (S1): the ordered depth-1 sections, which one the server
   * rendered, and the whole-document link map. Serializable descriptors only --
   * labels and byte sizes, never paper markdown.
   */
  readonly sectionWindow?: PaperSectionWindowData;
  /** Working Draft only: the server-rendered initial section (<PaperDocument layout="chunks">). */
  readonly children?: ReactNode;
  /** Authenticated opaque-ID PDF/DOCX manifest; null remains a visible pending state. */
  readonly downloadManifest?: VerifiedDownloadManifest | null;
}

export const PAPER_NAVIGATION_RAIL_ID = 'paper-navigation-rail';
export const PAPER_REVIEW_COMMENTS_RAIL_ID = 'paper-review-comments-rail';
export const PAPER_DOWNLOAD_PANEL_ID = 'paper-download-files-panel';
export const PAPER_DOCUMENT_COLUMN_ID = 'paper-document-column';
export { PAPER_LG_MEDIA_QUERY } from './paper-viewport';

/*
 * The landing and reveal numbers and the two pure landing predicates live in
 * the scroll authority (AMENDMENT-M1-SCROLL-AUTHORITY-001), which is the only
 * module that scrolls. They are re-exported here unchanged, so every existing
 * importer and the e2e drift guard keep reading the same source of truth.
 */
export {
  landingNeedsCorrection,
  PAPER_LANDING_MAX_ATTEMPTS,
  PAPER_LANDING_TOLERANCE_PX,
  PAPER_PANEL_REVEAL_GAP_PX,
  PAPER_REVEAL_SETTLE_MAX_FRAMES,
  PAPER_REVEAL_SETTLE_STABLE_FRAMES,
  PAPER_REVEAL_SETTLE_TIMEOUT_MS,
  panelRevealScrollDelta,
} from '@/lib/matrix-options/paper/scroll-authority';

type PanelKey = 'navigation' | 'review-comments' | 'download';

export function normalizeReaderTextForDisplay(text: string): string {
  return stripStandaloneSectionAnchorLines(text);
}

function decodeHashValue(value: string | null): string | null {
  if (!value || !value.startsWith('#') || value.length < 2) return null;
  try {
    return decodeURIComponent(value.slice(1));
  } catch {
    return null;
  }
}

/**
 * The section an in-page link names (M1-04): a `#anchor`, or the canonical
 * relative Working Draft query `?mode=working-draft&section=<anchor>` that
 * outline entries and in-paper references use as their href.
 */
export function sectionFromInPageHref(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith('#')) return decodeHashValue(href);
  if (!href.startsWith('?')) return null;
  const params = new URLSearchParams(href.slice(1));
  if (params.get('mode') !== 'working-draft' || params.getAll('section').length !== 1) return null;
  return params.get('section');
}

export interface SectionReadingGeometry {
  readonly id: string;
  /** Viewport top of the section element; the section starts with its heading. */
  readonly top: number;
  /** The section's computed scroll-margin-top in px. */
  readonly scrollMarginTop: number;
}

/**
 * Active-section rule (M1-01). `candidates` are observed sections in document
 * order. The active section is the LAST one whose top has crossed the reading
 * line: top <= scrollportTop + its own scroll-margin-top (+1px tolerance). That
 * line is exactly where scrollIntoView({ block: 'start' }) lands a section, so a
 * jump activates its target, never the predecessor whose tail is still visible
 * above it. When no candidate has crossed (top of the document) the first
 * candidate is active.
 */
export function selectActiveSectionAnchor(candidates: readonly SectionReadingGeometry[], scrollportTop: number): string | null {
  let active: string | null = null;
  for (const candidate of candidates) {
    if (candidate.top <= scrollportTop + candidate.scrollMarginTop + 1) active = candidate.id;
    else break;
  }
  return active ?? candidates[0]?.id ?? null;
}

/**
 * M1R2-04: at the very end of the scrollport nothing further can cross the
 * reading line, so the active section is the last one whose top is inside the
 * scrollport. Without this the trailing short sections can never become active.
 */
export function selectEndOfDocumentSectionAnchor(candidates: readonly SectionReadingGeometry[], scrollportTop: number, scrollportBottom: number): string | null {
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (candidate.top >= scrollportTop && candidate.top < scrollportBottom) return candidate.id;
  }
  return null;
}

/** True only when the scrollport can scroll and is at its maximum scroll offset. */
export function isScrolledToEnd(root: HTMLElement, lg: boolean): boolean {
  if (lg) return root.scrollHeight > root.clientHeight && root.scrollTop + root.clientHeight >= root.scrollHeight - 1;
  if (typeof window === 'undefined') return false;
  const page = document.documentElement;
  return page.scrollHeight > window.innerHeight && window.scrollY + window.innerHeight >= page.scrollHeight - 1;
}

/**
 * M1R5-04 (browser run-003 sections 6.2 and 7; FIX_R5_BRIEF item 5). The reading
 * line is only a contract where the scrollport can still reach it. My Review's
 * Review Comments heading at 768x1024 is the last element of the stacked layout,
 * so the page is already at MAXIMUM SCROLL (3,128 of 3,128) when it is revealed
 * and the +263px correction panelRevealScrollDelta asks for has nowhere to go.
 *
 * DECISION (a): at maximum scroll the landing contract is "visible, focused and
 * below the sticky header", not "flush to the reading line". Everywhere else the
 * reading line still decides. A genuinely OCCLUDED heading -- one whose top is
 * above the sticky header's bottom edge, which is the defect this whole work
 * stream fixed -- fails in BOTH cases, so this can never certify an occlusion.
 */
export function panelRevealLandingSatisfied({ headingTop, stickyHeaderHeight, viewportHeight, atMaxScroll, tolerance = PAPER_LANDING_TOLERANCE_PX }: {
  readonly headingTop: number;
  readonly stickyHeaderHeight: number;
  readonly viewportHeight: number;
  readonly atMaxScroll: boolean;
  readonly tolerance?: number;
}): boolean {
  if (!Number.isFinite(headingTop) || !Number.isFinite(stickyHeaderHeight) || !Number.isFinite(viewportHeight)) return false;
  // Occlusion never passes, at maximum scroll or anywhere else.
  if (headingTop < stickyHeaderHeight) return false;
  // Off the bottom of the scrollport is not "visible" either.
  if (headingTop >= viewportHeight) return false;
  if (atMaxScroll) return true;
  return panelRevealScrollDelta(headingTop, stickyHeaderHeight, tolerance) === 0;
}

/** The sticky header height this workspace published, in px; falls back to measuring the header. */
function stickyHeaderHeightPx(shell: HTMLElement | null): number {
  const published = Number.parseFloat(shell?.style.getPropertyValue(PAPER_STICKY_HEADER_HEIGHT_VAR) ?? '');
  if (Number.isFinite(published) && published > 0) return published;
  if (typeof document === 'undefined') return 0;
  const header = document.querySelector<HTMLElement>('[data-testid="paper-layout-header"]');
  const measured = header ? header.getBoundingClientRect().height : 0;
  return Number.isFinite(measured) && measured > 0 ? measured : 0;
}

function scrollMarginTopOf(element: Element): number {
  try {
    const value = Number.parseFloat(window.getComputedStyle(element).scrollMarginTop);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * M1R8-08 (informed Opus holistic pass, P3-9). The pending reveal that a request
 * to open `panel` should leave behind.
 *
 * `openPanel` used to set the pending reveal unconditionally below lg and then
 * call `setPanelOpen(panel, true)`. If the panel is ALREADY open React bails out
 * of that state update, the reveal effect never re-runs, and the pending reveal
 * stays set -- so the NEXT time any panel's open state changes, the effect reads
 * the stale value, finds that panel open and reveals it. A reader who opens
 * Download Files is then scrolled to the Navigation heading. No current call
 * site can reach it (all three pass the panel's own current state), but M2 and
 * M3 add programmatic opens, so the request is made unable to leave a pending
 * reveal that nothing will consume.
 */
export function pendingRevealForOpenRequest(panel: PanelKey, alreadyOpen: boolean, lgViewport: boolean): PanelKey | null {
  if (lgViewport || alreadyOpen) return null;
  return panel;
}

function replaceUrlState(state: PaperUrlState): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${serializePaperUrlState(state)}`);
}

/**
 * PLAN-R4 6.C: "pushState on question change so Back works." Every other
 * client state change (cohort, portion, section, Working Draft navigation)
 * uses replaceState (unchanged M1 behavior); only a question change pushes a
 * new history entry, so the Back button steps between previously visited
 * questions instead of leaving My Review outright.
 */
function pushUrlState(state: PaperUrlState): void {
  if (typeof window === 'undefined') return;
  window.history.pushState(window.history.state, '', `${window.location.pathname}${serializePaperUrlState(state)}`);
}

function CohortPaperPortion({ cohort, portion, headingRef, headingId = 'cohort-paper-heading' }: { readonly cohort: CohortManifest['cohorts'][number] | undefined; readonly portion: CohortPortion | undefined; readonly headingRef: Ref<HTMLHeadingElement>; readonly headingId?: string }) {
  if (!cohort || !portion) return <section data-testid="cohort-paper" aria-labelledby={headingId} className="rounded-xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900 dark:bg-sky-950"><h2 ref={headingRef} tabIndex={-1} id={headingId} className="text-lg font-bold">Selected cohort paper</h2><p className="mt-2 text-sm">No authenticated paper portion is available for this cohort.</p></section>;
  if (portion.status === 'unavailable') return <section data-testid="cohort-paper" aria-labelledby={headingId} className="min-w-0 border-y border-amber-300 py-5 dark:border-amber-800 print:hidden"><p className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Paper section unavailable</p><h2 ref={headingRef} tabIndex={-1} id={headingId} className="mt-1 text-xl font-bold">{portion.sectionLabel ?? `Section ${portion.sectionNumber}`}</h2><p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Section {portion.sectionNumber} is referenced by this review cohort but is not present as a section in this release.</p><p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">Source locator: {portion.sourceLocator}. No paper bytes are attached.</p></section>;
  const displayPortionText = portion.text ? normalizeReaderTextForDisplay(portion.text) : '';
  return <section data-testid="cohort-paper" aria-labelledby={headingId} className="min-w-0 border-y border-sky-200 py-5 dark:border-sky-900 print:hidden">
    <p className="text-xs font-bold uppercase tracking-wide text-sky-800 dark:text-sky-200">Authenticated paper portion</p>
    <h2 ref={headingRef} tabIndex={-1} id={headingId} className="mt-1 text-xl font-bold">{portion.sectionLabel ?? cohort.name}</h2>
    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{cohort.purpose}</p>
    <p className="mt-2 break-words text-xs text-slate-600 dark:text-slate-300">Authenticated source: {portion.sourceNodeId ?? 'section unavailable'}; bytes {portion.startByte ?? 'unavailable'}-{portion.endByte ?? 'unavailable'}. Five cohorts remain proposed pending owner QP approval.</p>
    <PaperText markdown={displayPortionText} className="mt-4" headingOffset={portionHeadingOffset(displayPortionText)} headingVariant="portion" />
  </section>;
}

/** PLAN-R4 3.B.2: per-portion canonical return link, built by the existing url-state serializer. */
function OpenInWorkingDraftLink({ documentVersion, sectionAnchor }: { readonly documentVersion: string; readonly sectionAnchor: string }) {
  const href = paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section: sectionAnchor });
  return <a href={href} className="mt-2 inline-flex min-h-[44px] items-center rounded-md border border-sky-300 px-3 text-sm font-semibold text-sky-800 underline dark:border-sky-700 dark:text-sky-200 print:hidden">Open in Working Draft</a>;
}

function CohortPortionsUnavailable({ workingDraftHref }: { readonly workingDraftHref: string }) {
  return <section data-testid="cohort-portions-unavailable" aria-labelledby="cohort-portions-unavailable-heading" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
    <h2 id="cohort-portions-unavailable-heading" className="text-lg font-bold">Cohort paper portions unavailable</h2>
    <p role="status" className="mt-2 text-sm">Authenticated cohort paper portions were not provided for this release, so My Review shows no paper text. The full paper remains available in the Working Draft.</p>
    <a href={workingDraftHref} className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-amber-400 px-3 text-sm font-semibold underline dark:border-amber-700">Open the Working Draft</a>
  </section>;
}

function assignmentStateLabel(assignment: AssignmentState): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignment unavailable';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No assignment';
  return 'Assigned';
}

function assignmentSourceLabel(assignment: AssignmentState): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignments are not connected for this release.';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No authoritative assignment exists for this release.';
  return assignment.title;
}

function firstQuestionOf(reviewerGuide: ReviewerGuideContract, cohort: CohortManifest['cohorts'][number] | undefined) {
  return reviewerGuide.questions.find((question) => cohort?.questionNumbers.includes(question.number));
}

/**
 * FIX CYCLE 1 / F1 (PLAN-R4 6.C "so Back works"). The PaperUrlContext a Back
 * navigation needs to re-run the EXISTING `parsePaperUrlState` client-side,
 * built the same way `buildPaperUrlContext` (PaperDocument.tsx, server-only)
 * builds it, from data this component already has: the cohort manifest, the
 * reviewer guide, and the authenticated portions' own section anchors (the
 * only anchors a restored My Review `section` could ever validly name).
 */
function myReviewUrlContext(cohortManifest: CohortManifest, reviewerGuide: ReviewerGuideContract, portions: readonly CohortPortion[]): PaperUrlContext {
  const questionCohort = new Map<string, string>();
  for (const cohort of cohortManifest.cohorts) {
    for (const number of cohort.questionNumbers) {
      const question = reviewerGuide.questions.find((candidate) => candidate.number === number);
      if (question) questionCohort.set(question.id, cohort.id);
    }
  }
  const anchors = new Set(portions.map((portion) => portion.sectionAnchor).filter((anchor): anchor is string => Boolean(anchor)));
  return { anchors, questionCohort, cohortIds: new Set(cohortManifest.cohorts.map((cohort) => cohort.id)) };
}

/** Mechanical URLSearchParams -> PaperSearchParams conversion; no URL semantics live here. */
function searchParamsRecord(search: string): PaperSearchParams {
  const params = new URLSearchParams(search);
  const record: Record<string, string[]> = {};
  for (const [key, value] of params.entries()) (record[key] ??= []).push(value);
  return record;
}

export function RevisedPaperWorkspace({ documentVersion, reviewManifestSha256, urlState, assignment, outline, cohortPortions, sectionWindow, children, downloadManifest = null }: RevisedPaperWorkspaceProps) {
  const isMyReview = urlState.mode === 'my-review';
  const cohortManifest = useMemo(() => getCohortManifest(), []);
  const reviewerGuide = useMemo(() => getReviewerGuideContract(), []);
  const portions = useMemo(() => cohortPortions ?? [], [cohortPortions]);
  const portionsProvided = cohortPortions !== undefined && cohortPortions.length > 0;
  const workingDraftHref = paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null });
  const myReviewHref = paperWorkspaceHref(documentVersion, { mode: 'my-review', cohort: null, q: null, section: null });

  const [headerActionsHost, setHeaderActionsHost] = useState<HTMLElement | null>(null);
  const [headerActionsReady, setHeaderActionsReady] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [reviewCommentsOpen, setReviewCommentsOpen] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const reviewCommentsToggleRef = useRef<HTMLButtonElement>(null);
  const downloadToggleRef = useRef<HTMLButtonElement>(null);
  const navigationHeadingRef = useRef<HTMLHeadingElement>(null);
  const reviewCommentsHeadingRef = useRef<HTMLHeadingElement>(null);
  /*
   * A requested reveal and the id of the activation that requested it, captured
   * synchronously in the requesting handler (scroll authority rule 3) and
   * carried to the claim in the reveal effect below.
   */
  const pendingRevealRef = useRef<{ readonly panel: PanelKey; readonly cause: PaperRevealCause } | null>(null);
  /*
   * M1R5-01. The measured sticky header height, as STATE rather than only as a
   * CSS variable, so that a change in it can trigger the re-landing below. See
   * the landing effect for why a resize is the event that matters.
   */
  const [publishedStickyHeaderHeight, setPublishedStickyHeaderHeight] = useState(0);
  const currentUrlStateRef = useRef<PaperUrlState>(urlState);
  const documentColumnRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  /*
   * AMENDMENT-M1-SCROLL-AUTHORITY-001. The ONE scroll authority for this
   * workspace instance: scrollport ownership, activation identity, the reveal
   * lifecycle, the section pin and pending navigation, and the arbitration
   * predicate every scroll consults. Created once (lazy state initialiser); it
   * reads the sticky header only when it corrects.
   */
  const [authority] = useState(() => new PaperScrollAuthority({ stickyHeaderHeight: () => stickyHeaderHeightPx(shellRef.current) }));
  /*
   * Rule 1: the activation observer is installed on MOUNT, before any reveal
   * can be claimed, and stays for the whole mounted lifetime. This is the FIRST
   * effect of the component, so it runs before every other effect, including
   * the reveal effect. Installed via useLayoutEffect so that the observation
   * guarantee starts BEFORE any input event or scheduler task can run in the gap.
   * Its cleanup is unmount-only (M1R7-04): disposing finishes every live reveal
   * and stops every landing-check chain still in flight.
   */
  useLayoutEffect(() => {
    authority.observe(window);
    return () => authority.dispose();
  }, [authority]);
  // S1 section window: loading state for every depth-1 section except the one
  // the server rendered. Inert (total 0) in My Review and without a window.
  const sectionApi = usePaperSectionWindow(documentVersion, sectionWindow);

  // My Review selection state, initialised from the server-parsed URL state.
  // M1-07 (by design): node and question child routes redirect My Review with
  // their `section` identity. That section selects a cohort and portion only
  // when it equals an authenticated portion's sectionAnchor; otherwise the
  // identity stays in the URL unchanged (it is never rewritten or dropped) and
  // the first cohort is shown, because My Review renders portions, not the
  // full paper.
  const initialCohortId = useMemo<CohortId>(() => {
    const fromUrl = cohortManifest.cohorts.find((cohort) => cohort.id === urlState.cohort)?.id;
    if (fromUrl) return fromUrl;
    const fromSection = urlState.section ? portions.find((portion) => portion.sectionAnchor === urlState.section)?.cohortId : undefined;
    return fromSection ?? cohortManifest.cohorts[0]?.id ?? 'categories';
    // Initial value only; later selections are client state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedCohortId, setSelectedCohortId] = useState<CohortId>(initialCohortId);
  const [expandedCohortId, setExpandedCohortId] = useState<CohortId | null>(initialCohortId);
  const selectedCohort = cohortManifest.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? cohortManifest.cohorts[0];
  // PLAN-R4 3.B.3 "order is all 12 questions in cohort order": the ONE
  // canonical sequence Prev/Next, the progress count, the "Jump to topic"
  // select and the saved-questions list all read, independent of which
  // cohort is currently selected in the left rail or document column.
  const allQuestionsInCohortOrder = useMemo(
    () => cohortManifest.cohorts.flatMap((cohort) => cohort.questionNumbers
      .map((number) => reviewerGuide.questions.find((question) => question.number === number))
      .filter((question): question is ReviewerGuideContract['questions'][number] => question !== undefined)),
    [cohortManifest, reviewerGuide],
  );
  const selectedPortions = useMemo(() => portions.filter((portion) => portion.cohortId === selectedCohort?.id), [portions, selectedCohort]);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(() => {
    const fromUrl = reviewerGuide.questions.find((question) => question.id === urlState.q && selectedCohort?.questionNumbers.includes(question.number));
    return fromUrl?.number ?? firstQuestionOf(reviewerGuide, selectedCohort)?.number ?? 1;
  });
  const [selectedPortionId, setSelectedPortionId] = useState<string | undefined>(() => {
    const fromSection = urlState.section ? portions.find((portion) => portion.cohortId === initialCohortId && portion.sectionAnchor === urlState.section) : undefined;
    return fromSection?.id;
  });
  const [paperFocusRequest, setPaperFocusRequest] = useState(0);
  const responseRef = useRef<HTMLElement>(null);
  // M2: portions are STACKED (PLAN-R4 3.B.2), so every rendered portion (and
  // the single "no portion for this cohort" fallback) registers its own
  // heading here; the paper-focus effect below looks up exactly which one to
  // reveal via focusPortionIdRef, instead of a single fixed ref.
  const portionHeadingRefs = useRef(new Map<string, HTMLHeadingElement>());
  const noPortionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const focusPortionIdRef = useRef<string | null>(null);
  const portionHeadingRef = useCallback((portionId: string) => (element: HTMLHeadingElement | null) => {
    if (element) portionHeadingRefs.current.set(portionId, element);
    else portionHeadingRefs.current.delete(portionId);
  }, []);

  // Working Draft section state.
  const anchors = useMemo(() => new Set((outline ?? []).map((entry) => entry.anchor)), [outline]);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(urlState.section);
  const [targetAnchor, setTargetAnchor] = useState<string | null>(urlState.section);

  useEffect(() => {
    setHeaderActionsHost(document.getElementById('matrix-options-paper-header-actions'));
    setHeaderActionsReady(true);
  }, []);

  useEffect(() => {
    currentUrlStateRef.current = urlState;
  }, [urlState]);

  // The layout header is sticky and its height depends on width and content
  // (129px at 360, 77px at 768 in browser run-001), so scroll targets were
  // landing underneath it. Publish the measured height as a CSS variable on the
  // workspace shell; chunk sections, placeholders and panel headings derive
  // their scroll margin from it, and scrollMarginTopOf reads the same value back.
  useEffect(() => {
    const shell = shellRef.current;
    const header = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('[data-testid="paper-layout-header"]');
    if (!shell || !header) return undefined;
    const apply = () => {
      const height = Math.round(header.getBoundingClientRect().height);
      if (height <= 0) return;
      shell.style.setProperty(PAPER_STICKY_HEADER_HEIGHT_VAR, `${height}px`);
      setPublishedStickyHeaderHeight((current) => (current === height ? current : height));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', apply);
      return () => window.removeEventListener('resize', apply);
    }
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  const updateUrl = useCallback((patch: Partial<PaperUrlState>, options?: { readonly push?: boolean }) => {
    const next: PaperUrlState = { ...currentUrlStateRef.current, ...patch };
    currentUrlStateRef.current = next;
    if (options?.push) pushUrlState(next);
    else replaceUrlState(next);
  }, []);

  // Panels: open by default (Navigation, Review Comments); Download Files closed.
  const setPanelOpen = (panel: PanelKey, open: boolean) => {
    /*
     * M1R9-02 (codex r8-sol-1, P2), and section 4.2 item 4 of the migration.
     * Opening or closing a panel moves the reader's attention to it, so the
     * section pin is stale from that moment. A POINTER reader always had this
     * (their mousedown drops the pin); a bare click -- VoiceOver AXPress, Dragon
     * "click <label>", element.click() -- did not, and the next section load or
     * header resize scrolled them back off the panel. The policy lives in the
     * authority and is applied HERE, in the one state setter every open and
     * close goes through, so no control -- a rail toggle, "Hide Download Files",
     * Escape -- can bypass it. A "Load section" click does not come through
     * here and keeps the pin (M1R4-03).
     */
    authority.panelActivated();
    if (panel === 'navigation') setNavigationOpen(open);
    else if (panel === 'review-comments') setReviewCommentsOpen(open);
    else setDownloadOpen(open);
  };
  const toggleRefFor = (panel: PanelKey) => (panel === 'navigation' ? navigationToggleRef : panel === 'review-comments' ? reviewCommentsToggleRef : downloadToggleRef);
  const closePanel = (panel: PanelKey) => {
    if (pendingRevealRef.current?.panel === panel) pendingRevealRef.current = null;
    setPanelOpen(panel, false);
    toggleRefFor(panel).current?.focus({ preventScroll: true });
  };
  const openPanel = (panel: PanelKey) => {
    // M1R8-08: a request to open an ALREADY-open panel must not leave a pending
    // reveal behind; React bails out of the state update, so nothing would ever
    // consume it and the next unrelated panel change would reveal the wrong one.
    const alreadyOpen = panel === 'navigation' ? navigationOpen : panel === 'review-comments' ? reviewCommentsOpen : downloadOpen;
    const requested = pendingRevealForOpenRequest(panel, alreadyOpen, isLgViewport());
    // Rule 3: the cause is minted by the authority NOW, while the requesting
    // activation dispatches. A request made outside one (M2/M3 programmatic
    // opens) gets its own ordinal instead, so two of them can never both own
    // the scrollport (HOLISTIC_R2 F1).
    pendingRevealRef.current = requested === null ? null : { panel: requested, cause: authority.requestRevealCause() };
    setPanelOpen(panel, true);
  };
  const togglePanel = (panel: PanelKey, open: boolean) => (open ? closePanel(panel) : openPanel(panel));

  useEffect(() => {
    const pending = pendingRevealRef.current;
    if (!pending) return;
    const open = pending.panel === 'navigation' ? navigationOpen : pending.panel === 'review-comments' ? reviewCommentsOpen : downloadOpen;
    if (!open) return;
    pendingRevealRef.current = null;
    const heading = pending.panel === 'navigation' ? navigationHeadingRef.current : pending.panel === 'review-comments' ? reviewCommentsHeadingRef.current : document.getElementById('paper-download-files-heading');
    if (!heading) return;
    /*
     * Opening a panel is an explicit reader act, so its reveal claims the
     * scrollport (M1R5-02) with the id of the activation that requested it, and
     * the authority runs the whole lifecycle: claim, the heading's own scroll,
     * focus, the measured correction and the settle loop, each exit releasing
     * exactly once (M1R4-02, M1R6-01, M1R6-04, M1R7-01..04). This effect only
     * runs below lg -- openPanel leaves no pending reveal at lg. Asserting the
     * observer here as well guarantees a sequence can never exist unobserved; on
     * a mounted component it is already installed and this does nothing.
     */
    authority.revealPanelHeading(pending.cause, heading);
  }, [authority, navigationOpen, reviewCommentsOpen, downloadOpen]);



  /*
   * M1R8-01 (informed Opus holistic pass, P2-1). focusSection used to pin AND
   * scroll with no ownership test at all. The collision needs two ordinary
   * clicks and no synthetic event: an outline click into a section outside the
   * S1 window takes navigateToAnchor's asynchronous branch and defers the
   * navigation; the reader then opens a rail panel, which claims the scrollport;
   * the fetch resolves and the post-commit effect calls focusSection. No reader
   * activation happened between the panel opening and that call, so the reveal
   * is still entitled.
   *
   * DECISION, carried into the authority unchanged: SUPPRESS THE SCROLL, do not
   * defer. The navigation still takes full effect as IDENTITY -- it pins,
   * focuses without scrolling, sets the active and target anchors and writes the
   * URL -- and only yields the scrollport (PaperScrollAuthority.scrollTargetIntoView
   * records why deferring was rejected). A navigation that IS a reader
   * activation (an outline click, a hash change) has already abandoned every
   * earlier reveal by the time it gets here, so it lands.
   */
  const focusSection = useCallback((anchor: string, writeUrl: boolean): boolean => {
    if (!anchors.has(anchor)) return false;
    const element = document.getElementById(anchor);
    if (!element) return false;
    authority.pin(anchor);
    authority.scrollTargetIntoView(element);
    element.focus({ preventScroll: true });
    setActiveAnchor(anchor);
    setTargetAnchor(anchor);
    if (writeUrl) updateUrl({ section: anchor });
    return true;
  }, [anchors, authority, updateUrl]);

  /*
   * After a section loads or the sticky header resizes, the layout above the
   * pinned target may have moved, so its landing is verified and corrected a
   * bounded number of times. The request-time and per-attempt arbitration, the
   * pin guard and the M1R6-03 drop-not-requeue decision are the authority's
   * (PaperScrollAuthority.requestLandingCheck); this only says what to measure.
   */
  const scheduleLandingCheck = useCallback((anchor: string) => {
    authority.requestLandingCheck(anchor, (target) => {
      const element = document.getElementById(target);
      const root = documentColumnRef.current;
      if (!element || !root) return null;
      const expectedTop = (isLgViewport() ? root.getBoundingClientRect().top : 0) + scrollMarginTopOf(element);
      return { element, actualTop: element.getBoundingClientRect().top, expectedTop };
    });
  }, [authority]);

  /**
   * S1 navigation to any known anchor. An anchor already in the DOM keeps the
   * existing synchronous path (no added latency); otherwise the owning depth-1
   * section is loaded first and focus is issued from the post-commit effect
   * below, once its chunks have actually mounted.
   */
  const navigateToAnchor = useCallback((anchor: string, writeUrl: boolean): boolean => {
    if (!anchors.has(anchor)) return false;
    if (typeof document !== 'undefined' && document.getElementById(anchor)) {
      /*
       * Section 4.2 item 2: a later navigation WINS. A navigation still waiting
       * for an earlier, unloaded section must not take the pin, focus, URL and
       * scroll back when that section finally arrives.
       */
      authority.cancelPendingNavigation();
      /*
       * M1R5-01 (root cause, half 1). This SYNCHRONOUS branch used to return
       * focusSection's result directly and never scheduled a landing check,
       * while the asynchronous branch below always got one from the post-commit
       * effect. That asymmetry is not theoretical: for a `?section=` deep link
       * the SERVER already rendered the owning section (page.tsx computes
       * initialIndex = owningSectionIndex(groups, state.section)), so a deep
       * link at mount takes THIS branch, whereas an outline click into a
       * section that is not loaded yet takes the other one. The two journeys
       * that browser run-003 measured as opposite outcomes are these two
       * branches. Both now verify their landing.
       */
      if (!focusSection(anchor, writeUrl)) return false;
      scheduleLandingCheck(anchor);
      return true;
    }
    const index = outline ? owningSectionIndex(outline, anchor) : null;
    if (index === null || !sectionApi.ensureLoaded(index)) return false;
    authority.deferNavigation({ anchor, writeUrl, sectionIndex: index });
    setTargetAnchor(anchor);
    return true;
  }, [anchors, authority, focusSection, outline, scheduleLandingCheck, sectionApi]);

  const navigateRef = useRef(navigateToAnchor);
  useEffect(() => {
    navigateRef.current = navigateToAnchor;
  }, [navigateToAnchor]);

  useEffect(() => {
    if (isMyReview) return;
    const pending = authority.pendingNavigation();
    if (pending) {
      /*
       * Section 4.2 item 2: a FAILED load clears the pending navigation, so a
       * later retry or prefetch that finally loads the section does not yank the
       * reader to it, and pinned re-landing is no longer skipped behind it.
       * `loadedKey` is the per-section status list, in section order.
       */
      if (sectionApi.loadedKey.split(',')[pending.sectionIndex] === 'error') {
        authority.cancelPendingNavigation();
        return;
      }
      if (document.getElementById(pending.anchor) === null) return;
      authority.cancelPendingNavigation();
      if (focusSection(pending.anchor, pending.writeUrl)) scheduleLandingCheck(pending.anchor);
      return;
    }
    /*
     * M1R4-03 (browser run-002 sections 7b and 7c). A deep link into an unloaded
     * section landed 56px (360) and 4px (768) above its reading line and stayed
     * there for the whole 2.5s the run sampled, while an outline click into an
     * unloaded section landed on exactly the same reading line with delta 0. The
     * correction mechanism is therefore sound; it is simply spent within about
     * three frames of the mount, whereas the prefetch observer keeps loading the
     * sections ABOVE the target for seconds afterwards and every one of those
     * loads changes the height above a pinned target. The landing is re-verified
     * after each section load for as long as the target stays pinned. On a
     * settled page the check measures a delta of 0 and does nothing, and any
     * reader scroll intent drops the pin (PAPER_PIN_RELEASING_ACTIVATIONS).
     */
    const pinned = authority.pinnedAnchor();
    if (pinned) scheduleLandingCheck(pinned);
  }, [authority, isMyReview, focusSection, scheduleLandingCheck, sectionApi.loadedKey]);

  /*
   * M1R5-01 (root cause, half 2 -- the load-bearing half).
   *
   * Round 4 keyed the re-landing above on `sectionApi.loadedKey`, i.e. on a
   * SECTION LOAD. Browser run-003 measured that this changed the deep-link
   * landing by not one pixel: -56 at 360 and -4 at 768, identical to run-002,
   * `converged: never`, `settle changes: 0` across a full 12 seconds, while
   * `diagnostic-landing.json` proved the very same targets were mid-document
   * (160,238 of 257,833 at 360) and that a manual scroll placed each one on
   * exactly its reading line. The correction was reachable and simply never
   * applied, so a longer window or more attempts was never the answer.
   *
   * The reason is that a section load is the WRONG SIGNAL for this journey. The
   * mount journey is not broken by content loading above the target; it is
   * broken by the STICKY HEADER GROWING UNDER IT. `#matrix-options-paper-header-actions`
   * is `empty:hidden` in the layout, and this workspace only discovers that host
   * in an effect (setHeaderActionsHost), so the panel-controls portal cannot
   * render until the SECOND commit. On the FIRST commit the header is therefore
   * still one row, the effect above publishes that collapsed height, and the
   * deep link scrolls its target to `collapsedHeight + 0.5rem`. On the next
   * commit the portal fills the actions slot -- below `sm` it takes a full-width
   * line of its own -- the header grows, the ResizeObserver republishes the
   * height, and every scroll margin moves to `finalHeight + 0.5rem`, while the
   * reader stays exactly where the stale scroll put them. That predicts a
   * viewport-INDEPENDENT landing and an error equal to the header's growth,
   * which is precisely what run-003 measured: top 81 at BOTH 360 and 768, with
   * expected 137 (129px header) and 85 (77px header). An outline click cannot
   * hit this, because by then the header has long since reached its final
   * height -- which is why the same loader path passes with delta 0.
   *
   * So the re-landing is triggered by the event that actually invalidates the
   * landing. On a settled page the height never changes and this never fires;
   * when it does fire the check measures the delta and does nothing if the
   * target is already on its line; and any user scroll intent has already
   * dropped the pin, so the reader's own position is never taken back.
   *
   * jsdom has no layout engine, so the unit tests below drive the mechanism,
   * not the pixels. Only browser run-004 can confirm the landing itself.
   */
  useEffect(() => {
    if (isMyReview || publishedStickyHeaderHeight === 0) return;
    const pinned = authority.pinnedAnchor();
    if (pinned) scheduleLandingCheck(pinned);
  }, [authority, isMyReview, publishedStickyHeaderHeight, scheduleLandingCheck]);

  // Deep links. A known `#anchor` that differs from `section` is the identity that
  // was actually followed, so it wins and is mirrored into `section` (M1-04: a
  // stale `section=` never overrides it). Otherwise `section` from the URL is focused.
  // Either identity may name a section that is not loaded yet (S1).
  useEffect(() => {
    if (isMyReview) return;
    const hashAnchor = typeof window === 'undefined' ? null : decodeHashValue(window.location.hash);
    if (hashAnchor && anchors.has(hashAnchor) && hashAnchor !== urlState.section) {
      navigateRef.current(hashAnchor, true);
      return;
    }
    if (urlState.section) navigateRef.current(urlState.section, false);
  }, [isMyReview, urlState.section, anchors]);

  useEffect(() => {
    if (isMyReview) return undefined;
    const onHashChange = () => {
      const hashAnchor = decodeHashValue(window.location.hash);
      if (hashAnchor) navigateRef.current(hashAnchor, true);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isMyReview]);

  /*
   * FIX CYCLE 1 / F1 (PLAN-R4 6.C "pushState on question change so Back
   * works"). A question change pushes a history entry; this listener is what
   * makes Back (and Forward) actually restore the prior cohort/question/
   * portion UI from it. It re-derives state from `window.location.search`
   * using the EXISTING `parsePaperUrlState` (no new URL-parsing logic) and
   * writes the raw selection state directly -- never through
   * `selectCohort`/`selectPortion`/`selectQuestion`/`updateUrl`, so it can
   * never re-push/replace history itself (no loop) and never bumps
   * `paperFocusRequest` or calls `authority.scrollTargetIntoView` (no reveal,
   * no scroll -- popstate is deliberately not a scroll-authority activation
   * kind; scroll-authority.ts is not touched). The only focus movement is a
   * plain `.focus({ preventScroll: true })` on the response section, and only
   * when focus was already inside Review Comments before the navigation.
   */
  useEffect(() => {
    if (!isMyReview) return undefined;
    const onPopState = () => {
      const activeElementBefore = document.activeElement;
      const reviewCommentsRail = document.getElementById(PAPER_REVIEW_COMMENTS_RAIL_ID);
      const wasFocusInReviewComments = Boolean(activeElementBefore && reviewCommentsRail?.contains(activeElementBefore));

      const ctx = myReviewUrlContext(cohortManifest, reviewerGuide, portions);
      const { state: restored } = parsePaperUrlState(searchParamsRecord(window.location.search), ctx);
      if (restored.mode !== 'my-review') return;

      const cohortId: CohortId = (restored.cohort as CohortId | null) ?? cohortManifest.cohorts[0]?.id ?? 'categories';
      const cohort = cohortManifest.cohorts.find((candidate) => candidate.id === cohortId);
      const questionFromUrl = reviewerGuide.questions.find((question) => question.id === restored.q && cohort?.questionNumbers.includes(question.number));
      const questionNumber = questionFromUrl?.number ?? firstQuestionOf(reviewerGuide, cohort)?.number ?? 1;
      const portion = restored.section ? portions.find((candidate) => candidate.cohortId === cohortId && candidate.sectionAnchor === restored.section) : undefined;

      currentUrlStateRef.current = restored;
      setSelectedCohortId(cohortId);
      setExpandedCohortId(cohortId);
      setActiveQuestionNumber(questionNumber);
      setSelectedPortionId(portion?.id);
      focusPortionIdRef.current = portion?.id ?? null;

      if (wasFocusInReviewComments && responseRef.current && !responseRef.current.closest('[inert]')) {
        responseRef.current.focus({ preventScroll: true });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isMyReview, cohortManifest, reviewerGuide, portions]);

  // Active section (M1-01). IntersectionObserver keeps the set of sections in the
  // top half of the viewport. On every observer callback and every (frame
  // throttled) scroll, the active section is the last observed section whose
  // heading has crossed the reading line below the sticky header
  // (selectActiveSectionAnchor, which honours each section's scroll-margin). At
  // lg the document column is the scrollport; below lg the page scrolls. A
  // section reached by focusSection stays active until the next user scroll
  // intent, which the scroll authority's observer turns into a pin release for
  // the whole mounted lifetime (no longer only where this effect is installed).
  useEffect(() => {
    const root = documentColumnRef.current;
    if (isMyReview || !root || typeof IntersectionObserver === 'undefined') return undefined;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('section[data-paper-chunk]'));
    const order = new Map(sections.map((section, index) => [section, index]));
    const visible = new Set<HTMLElement>();
    const geometryOf = (section: HTMLElement) => ({ id: section.id, top: section.getBoundingClientRect().top, scrollMarginTop: scrollMarginTopOf(section) });
    const recompute = () => {
      if (authority.pinnedAnchor() !== null) return;
      const lg = isLgViewport();
      const rect = root.getBoundingClientRect();
      const scrollportTop = lg ? rect.top : 0;
      if (isScrolledToEnd(root, lg)) {
        // M1R2-04: nothing can cross the reading line any more at maximum scroll.
        const last = selectEndOfDocumentSectionAnchor(sections.map(geometryOf), scrollportTop, lg ? rect.bottom : window.innerHeight);
        if (last !== null) {
          setActiveAnchor(last);
          return;
        }
      }
      const candidates = [...visible]
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
        .map(geometryOf);
      const next = selectActiveSectionAnchor(candidates, scrollportTop);
      if (next !== null) setActiveAnchor(next);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) visible.add(section);
        else visible.delete(section);
      }
      recompute();
    }, { rootMargin: '0px 0px -50% 0px', threshold: 0 });
    let frame = 0;
    const onScroll = () => {
      if (typeof window.requestAnimationFrame !== 'function') {
        recompute();
        return;
      }
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', onScroll, { capture: true });
      if (frame !== 0 && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frame);
    };
    // sectionApi.loadedKey changes whenever a section loads, so the observer is
    // rebuilt over the sections that are now in the DOM (S1).
  }, [authority, isMyReview, children, sectionApi.loadedKey]);

  const onDocumentClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isMyReview || event.defaultPrevented || !isPlainPrimaryClick(event)) return;
    const target = event.target as Element | null;
    const link = target && typeof target.closest === 'function' ? target.closest('a[href^="#"], a[href^="?"]') : null;
    const anchor = link ? sectionFromInPageHref(link.getAttribute('href')) : null;
    if (anchor && anchors.has(anchor)) {
      event.preventDefault();
      navigateToAnchor(anchor, true);
    }
  };

  // Holistic P3-6: the skip link's scroll is arbitrated like every other one.
  // Its own activation has already abandoned any earlier reveal, so it lands.
  const skipToDocument = () => {
    const column = documentColumnRef.current;
    if (!column) return;
    authority.scrollTargetIntoView(column);
    column.focus({ preventScroll: true });
  };

  /*
   * Focuses and reveals an element unless it sits in an inert, closed rail
   * (M1-09). Holistic P3-6 and section 4.2 item 1: the reveal is arbitrated.
   * Focus no longer scrolls natively (preventScroll); the authority's single
   * start-aligned scroll decides the landing, exactly as the second of the two
   * scrolls this used to issue always did.
   */
  const focusUnlessInert = useCallback((element: HTMLElement | null): boolean => {
    if (!element || element.closest('[inert]')) return false;
    element.focus({ preventScroll: true });
    authority.scrollTargetIntoView(element);
    return true;
  }, [authority]);

  useEffect(() => {
    if (paperFocusRequest === 0) return;
    const targetId = focusPortionIdRef.current;
    const heading = targetId ? portionHeadingRefs.current.get(targetId) ?? null : (selectedPortions[0] ? portionHeadingRefs.current.get(selectedPortions[0].id) ?? null : noPortionHeadingRef.current);
    focusUnlessInert(heading);
    // selectedPortions is read for its current value only when no specific
    // portion id was requested; it is not itself the trigger for this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUnlessInert, paperFocusRequest]);

  const activeQuestion = allQuestionsInCohortOrder.find((question) => question.number === activeQuestionNumber) ?? allQuestionsInCohortOrder[0];
  const activeQuestionCohortId = cohortManifest.cohorts.find((cohort) => cohort.questionNumbers.includes(activeQuestion?.number ?? -1))?.id ?? selectedCohort?.id ?? null;

  const selectQuestion = (number: number) => {
    // M2: Prev/Next, the "Jump to topic" select and the saved-questions list
    // all walk allQuestionsInCohortOrder, so a question outside the currently
    // selected cohort switches the cohort (and the document column's stacked
    // portions with it) instead of being unreachable.
    const question = reviewerGuide.questions.find((candidate) => candidate.number === number);
    if (!question) return;
    const cohort = cohortManifest.cohorts.find((candidate) => candidate.questionNumbers.includes(number));
    const cohortChanged = cohort !== undefined && cohort.id !== selectedCohortId;
    setActiveQuestionNumber(number);
    if (cohortChanged) {
      setSelectedCohortId(cohort.id);
      setExpandedCohortId(cohort.id);
      focusPortionIdRef.current = null;
    }
    const section = cohortChanged ? (portions.find((portion) => portion.cohortId === cohort.id)?.sectionAnchor ?? null) : currentUrlStateRef.current.section;
    // PLAN-R4 6.C: a question change pushes a new history entry (so Back
    // steps between questions); every other My Review URL change replaces.
    updateUrl({ cohort: cohort?.id ?? selectedCohortId, q: question.id, section }, { push: true });
    // Never move focus into the Review Comments rail while it is closed (inert).
    focusUnlessInert(responseRef.current);
  };
  const selectCohort = (cohortId: CohortId) => {
    if (cohortId === selectedCohortId) {
      setExpandedCohortId((current) => (current === cohortId ? null : cohortId));
      return;
    }
    const cohort = cohortManifest.cohorts.find((candidate) => candidate.id === cohortId);
    setSelectedCohortId(cohortId);
    setExpandedCohortId(cohortId);
    setSelectedPortionId(undefined);
    setActiveQuestionNumber(firstQuestionOf(reviewerGuide, cohort)?.number ?? 1);
    focusPortionIdRef.current = null;
    setPaperFocusRequest((count) => count + 1);
    updateUrl({ cohort: cohortId, q: null, section: portions.find((portion) => portion.cohortId === cohortId)?.sectionAnchor ?? null });
  };
  const selectPortion = (portionId: string) => {
    const portion = portions.find((candidate) => candidate.id === portionId);
    if (!portion) return;
    const cohortChanged = portion.cohortId !== selectedCohortId;
    if (cohortChanged) {
      setSelectedCohortId(portion.cohortId);
      setActiveQuestionNumber(firstQuestionOf(reviewerGuide, cohortManifest.cohorts.find((cohort) => cohort.id === portion.cohortId))?.number ?? 1);
    }
    setExpandedCohortId(portion.cohortId);
    setSelectedPortionId(portionId);
    focusPortionIdRef.current = portionId;
    setPaperFocusRequest((count) => count + 1);
    updateUrl({ cohort: portion.cohortId, q: cohortChanged ? null : currentUrlStateRef.current.q, section: portion.sectionAnchor ?? null });
  };
  const moveQuestion = (offset: number) => {
    const currentIndex = allQuestionsInCohortOrder.findIndex((question) => question.number === activeQuestion?.number);
    const next = allQuestionsInCohortOrder[currentIndex + offset];
    if (next) selectQuestion(next.number);
  };

  const panelControls = <div data-testid="workspace-panel-controls" className="flex flex-wrap items-center gap-2">
    <PaperRailToggle label="Navigation" open={navigationOpen} controls={PAPER_NAVIGATION_RAIL_ID} buttonRef={navigationToggleRef} onClick={() => togglePanel('navigation', navigationOpen)} icon={navigationOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />} />
    {isMyReview && <PaperRailToggle label="Review Comments" open={reviewCommentsOpen} controls={PAPER_REVIEW_COMMENTS_RAIL_ID} buttonRef={reviewCommentsToggleRef} onClick={() => togglePanel('review-comments', reviewCommentsOpen)} icon={reviewCommentsOpen ? <PanelRightClose aria-hidden="true" className="h-4 w-4" /> : <PanelRightOpen aria-hidden="true" className="h-4 w-4" />} />}
  </div>;

  return (
    <>
    {headerActionsHost ? createPortal(panelControls, headerActionsHost) : null}
    <div ref={shellRef} data-testid="workspace-shell" className="flex min-h-0 flex-col overflow-x-clip bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100 lg:h-[calc(100dvh-8rem)] print:block print:h-auto">
      <header className="shrink-0 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Matrix Options Paper</p>
            <h1 className="text-xl font-bold">Review workspace</h1>
            <p className="break-words font-mono text-xs text-slate-500 dark:text-slate-400">{documentVersion}</p>
            <p role="status" data-testid="noncanonical-preview-banner" className="mt-1 inline-flex rounded border border-amber-500 bg-amber-100 px-2 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100">NON-CANONICAL PREVIEW - integration only</p>
          </div>
          <div data-testid="workspace-header-controls" className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <nav aria-label="Workspace mode" className="flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <a href={workingDraftHref} aria-current={isMyReview ? undefined : 'page'} className={`flex min-h-[36px] items-center rounded-md px-3 py-2 text-sm font-semibold ${isMyReview ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : 'bg-sky-700 text-white'}`}>Working Draft</a>
              <a href={myReviewHref} aria-current={isMyReview ? 'page' : undefined} className={`flex min-h-[36px] items-center rounded-md px-3 py-2 text-sm font-semibold ${isMyReview ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>My Review</a>
            </nav>
            <PaperRailToggle label="Download Files" open={downloadOpen} controls={PAPER_DOWNLOAD_PANEL_ID} buttonRef={downloadToggleRef} onClick={() => togglePanel('download', downloadOpen)} icon={<Download aria-hidden="true" className="h-4 w-4" />} />
            {headerActionsReady && !headerActionsHost && <div className="border-l border-slate-200 pl-2 dark:border-slate-700 sm:ml-1">{panelControls}</div>}
          </div>
        </div>
      </header>

      <div data-testid="workspace-layout" className={cn(PAPER_SHELL_CLASSES, 'min-h-0')}>
        <PaperRail id={PAPER_NAVIGATION_RAIL_ID} testId="navigation-rail" side="left" open={navigationOpen} heading="Navigation" headingId="paper-navigation-rail-heading" headingRef={navigationHeadingRef} onEscape={() => closePanel('navigation')}>
          {isMyReview
            ? <><p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Choose a release-bound cohort and its authenticated paper portions.</p><CohortReviewNav cohortManifest={cohortManifest} cohortPortions={portions} reviewerGuide={reviewerGuide} selectedCohortId={selectedCohortId} expandedCohortId={expandedCohortId} selectedPortionId={selectedPortionId} activeQuestionNumber={activeQuestionNumber} onSelectCohort={selectCohort} onSelectPortion={selectPortion} onSelectQuestion={(_cohortId, number) => selectQuestion(number)} /></>
            : outline && outline.length > 0
              ? <PaperOutlineNav outline={outline} activeAnchor={activeAnchor} targetAnchor={targetAnchor} documentTargetId={PAPER_DOCUMENT_COLUMN_ID} onNavigate={(anchor) => { navigateToAnchor(anchor, true); }} onSkipToDocument={skipToDocument} />
              : <p className="text-sm text-slate-600 dark:text-slate-300">The paper outline is unavailable.</p>}
        </PaperRail>

        <div ref={documentColumnRef} id={PAPER_DOCUMENT_COLUMN_ID} data-testid="paper-document-column" tabIndex={-1} onClick={onDocumentClick} className="min-w-0 flex-1 focus:outline-none lg:overflow-y-auto print:overflow-visible">
          <div className="mx-auto min-w-0 max-w-[72rem] space-y-5 px-4 py-5 sm:px-6 print:max-w-none print:p-0">
            <DownloadFilesPanel open={downloadOpen} manifest={downloadManifest} onClose={() => closePanel('download')} closeFocusRef={downloadToggleRef} panelId={PAPER_DOWNLOAD_PANEL_ID} />

            <section aria-label={isMyReview ? 'My Review status' : 'Working Draft status'} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-slate-200 py-3 dark:border-slate-700 print:hidden">
              <h2 className="text-lg font-bold">{isMyReview ? 'My Review' : 'Working Draft'}</h2>
              <span className="max-w-full break-words rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 [overflow-wrap:anywhere]">{assignmentStateLabel(assignment)}</span>
              <p className="min-w-0 break-words text-sm [overflow-wrap:anywhere]">Assignment source: {assignmentSourceLabel(assignment)}</p>
              {!isMyReview && sectionWindow ? <PaperLoadFullDocumentControl api={sectionApi} /> : null}
            </section>

            {isMyReview
              ? portionsProvided
                ? (selectedPortions.length > 0
                  ? <div data-testid="cohort-paper-stack" className="space-y-5">
                      {/* PLAN-R4 3.B.2: every authenticated portion for the selected cohort is rendered in full -- stacked, not paginated. */}
                      {selectedPortions.map((portion) => (
                        <div key={portion.id}>
                          <CohortPaperPortion cohort={selectedCohort} portion={portion} headingId={`cohort-paper-heading-${portion.id}`} headingRef={portionHeadingRef(portion.id)} />
                          {portion.status === 'available' && portion.sectionAnchor ? <OpenInWorkingDraftLink documentVersion={documentVersion} sectionAnchor={portion.sectionAnchor} /> : null}
                        </div>
                      ))}
                    </div>
                  : <CohortPaperPortion cohort={selectedCohort} portion={undefined} headingRef={(element) => { noPortionHeadingRef.current = element; }} />)
                : <CohortPortionsUnavailable workingDraftHref={workingDraftHref} />
              : sectionWindow && children
                ? <PaperSectionWindowView sectionWindow={sectionWindow} api={sectionApi} scrollRootRef={documentColumnRef}>{children}</PaperSectionWindowView>
                : children ?? <section data-testid="paper-document-unavailable" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"><h2 className="text-lg font-bold">Paper text unavailable</h2><p role="status" className="mt-2">The authenticated paper text was not provided to this view.</p></section>}
          </div>
        </div>

        {isMyReview && <PaperRail id={PAPER_REVIEW_COMMENTS_RAIL_ID} testId="review-comments-rail" side="right" open={reviewCommentsOpen} heading="Review Comments" headingId="paper-review-comments-rail-heading" headingRef={reviewCommentsHeadingRef} onEscape={() => closePanel('review-comments')}>
          <ReviewCommentsPanel documentVersion={documentVersion} manifestSha256={reviewManifestSha256 ?? ''} cohortId={activeQuestionCohortId} questions={allQuestionsInCohortOrder} question={activeQuestion} responseRef={responseRef} onSelectQuestion={selectQuestion} onPreviousQuestion={() => moveQuestion(-1)} onNextQuestion={() => moveQuestion(1)} />
        </PaperRail>}
      </div>
    </div>
    </>
  );
}
