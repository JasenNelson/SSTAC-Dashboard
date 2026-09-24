'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react';
import { ChevronDown, Download, Info, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, RotateCcw } from 'lucide-react';

import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortId, CohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import { stripStandaloneSectionAnchorLines } from '@/lib/matrix-options/paper/full-document';
import { maxPanelWidth, readPanelPreferences, resolvePanelWidths, writePanelPreferences } from '@/lib/matrix-options/paper/panel-layout';
import { DEFAULT_READER_WIDTH, readReaderWidth, writeReaderWidth } from '@/lib/matrix-options/paper/reader-width';
import type { ReaderWidth } from '@/lib/matrix-options/paper/reader-width';
import { reviewTopicLabel } from '@/lib/matrix-options/paper/topic-labels';
import type { PanelPreferences, PanelSide } from '@/lib/matrix-options/paper/panel-layout';
import { buildReviewNavigation, portionMatchesQuestion } from '@/lib/matrix-options/paper/review-navigation';
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
import { PanelResizeHandle, PaperRail, PaperRailToggle, PAPER_LEFT_WIDTH_VAR, PAPER_RIGHT_WIDTH_VAR, PAPER_SHELL_CLASSES } from './PaperRail';
import { PaperPopover } from './PaperPopover';
import { PaperDocumentToolbar, PaperSectionWindowView, usePaperSectionWindow } from './PaperSectionWindow';
import type { PaperSectionWindowData } from './PaperSectionWindow';
import { PaperText, portionHeadingOffset } from './PaperText';
import { isLgViewport } from './paper-viewport';
import { ReaderWidthControl } from './ReaderWidthControl';
import { ReviewCommentsPanel, type ReviewRevealCause } from './ReviewCommentsPanel';
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
  /** Authenticated opaque-ID PDF/DOCX manifests by cohortId; null remains a visible pending state. */
  readonly downloadManifests?: Readonly<Record<string, VerifiedDownloadManifest>> | null;
}

export const PAPER_NAVIGATION_RAIL_ID = 'paper-navigation-rail';
export const PAPER_REVIEW_COMMENTS_RAIL_ID = 'paper-review-comments-rail';
export const PAPER_DOWNLOAD_PANEL_ID = 'paper-download-files-panel';
export const PAPER_ABOUT_PANEL_ID = 'paper-about-draft-panel';
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

type PanelKey = 'navigation' | 'review-comments';

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

function CohortPaperPortion({ cohort, portion, headingRef, headingId = 'cohort-paper-heading', documentVersion, questionId = null }: { readonly cohort: CohortManifest['cohorts'][number] | undefined; readonly portion: CohortPortion | undefined; readonly headingRef: Ref<HTMLHeadingElement>; readonly headingId?: string; readonly documentVersion: string; readonly questionId?: string | null }) {
  if (!cohort || !portion) return <section data-testid="cohort-paper" aria-labelledby={headingId} className="rounded-md border border-[var(--db-border)] p-5"><h2 ref={headingRef} tabIndex={-1} id={headingId} className="text-lg font-semibold">{(cohort ? reviewTopicLabel(cohort.id, cohort.name) : null) ?? 'Review topic'}</h2><p className="mt-2 text-sm text-[var(--db-text-secondary)]">No paper section is linked to this topic yet.</p></section>;
  if (portion.status === 'unavailable') return <section data-testid="cohort-paper" aria-labelledby={headingId} className="min-w-0 rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] p-5 print:hidden"><h2 ref={headingRef} tabIndex={-1} id={headingId} className="text-lg font-semibold">{portion.sectionLabel ?? `Section ${portion.sectionNumber}`}</h2><p className="mt-2 text-sm">Section {portion.sectionNumber} is referenced by this review topic but is not part of this draft.</p></section>;
  const topicName = reviewTopicLabel(cohort.id, cohort.name);
  const title = portion.sectionLabel ?? topicName;
  const displayPortionText = portion.text ? stripLeadingHeading(normalizeReaderTextForDisplay(portion.text), title) : '';
  return <section data-testid="cohort-paper" aria-labelledby={headingId} className="min-w-0 print:hidden">
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[var(--db-border)] pb-3">
      <div className="min-w-0">
        <p className="text-xs text-[var(--db-text-secondary)]">{topicName}</p>
        <h2 ref={headingRef} tabIndex={-1} id={headingId} className="mt-0.5 scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] text-xl font-semibold leading-snug focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]">{title}</h2>
      </div>
      {portion.sectionAnchor ? <OpenInWorkingDraftLink documentVersion={documentVersion} sectionAnchor={portion.sectionAnchor} title={title} questionId={questionId} /> : null}
    </header>
    <PaperText markdown={displayPortionText} className="mt-4" headingOffset={portionHeadingOffset(displayPortionText)} headingVariant="portion" />
  </section>;
}

/**
 * The portion header already shows the section title, so a first markdown
 * heading with exactly that text is dropped from the body instead of being
 * shown twice. Display only: the paper bytes are untouched.
 */
export function stripLeadingHeading(markdown: string, title: string): string {
  const match = /^\s*#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*(?:\r?\n|$)/.exec(markdown);
  if (!match || match[1].trim() !== title.trim()) return markdown;
  return markdown.slice(match[0].length);
}

/** PLAN-R4 3.B.2: per-portion canonical return link, built by the existing url-state serializer; it names what it opens. */
function OpenInWorkingDraftLink({ documentVersion, sectionAnchor, title, questionId }: { readonly documentVersion: string; readonly sectionAnchor: string; readonly title: string; readonly questionId: string | null }) {
  // Carries the active question, so the review panel beside the Working Draft keeps it.
  const href = paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: questionId, section: sectionAnchor });
  return <a href={href} data-testid="open-in-working-draft" className="inline-flex min-h-[44px] max-w-full shrink-0 items-center rounded-md px-2 text-sm font-medium text-[var(--db-accent-strong)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] print:hidden">Open &quot;{title}&quot; in Working Draft</a>;
}

function CohortPortionsUnavailable({ workingDraftHref }: { readonly workingDraftHref: string }) {
  return <section data-testid="cohort-portions-unavailable" aria-labelledby="cohort-portions-unavailable-heading" className="rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] p-5">
    <h2 id="cohort-portions-unavailable-heading" className="text-lg font-semibold">Review sections unavailable</h2>
    <p role="status" className="mt-2 text-sm">The paper sections for each review topic could not be loaded, so My Review shows no paper text. The full paper is available in the Working Draft.</p>
    <a href={workingDraftHref} className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-[var(--db-border-strong)] px-3 text-sm font-medium underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]">Open the Working Draft</a>
  </section>;
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

export function RevisedPaperWorkspace({ documentVersion, reviewManifestSha256, urlState, assignment, outline, cohortPortions, sectionWindow, children, downloadManifests = null }: RevisedPaperWorkspaceProps) {
  const isMyReview = urlState.mode === 'my-review';
  const cohortManifest = useMemo(() => getCohortManifest(), []);
  const reviewerGuide = useMemo(() => getReviewerGuideContract(), []);
  const portions = useMemo(() => cohortPortions ?? [], [cohortPortions]);
  const portionsProvided = cohortPortions !== undefined && cohortPortions.length > 0;
  const workingDraftHref = paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null });

  /*
   * The ONE navigation model (review-navigation.ts): topics = cohorts, each
   * question's cited paper sections, and the most-specific section <-> question
   * mapping both panels read. Nothing below special-cases a question.
   */
  const navigation = useMemo(() => buildReviewNavigation(cohortManifest, reviewerGuide, outline ?? []), [cohortManifest, reviewerGuide, outline]);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [reviewCommentsOpen, setReviewCommentsOpen] = useState(true);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const reviewCommentsToggleRef = useRef<HTMLButtonElement>(null);
  const downloadToggleRef = useRef<HTMLButtonElement>(null);
  const aboutToggleRef = useRef<HTMLButtonElement>(null);
  /*
   * Adjustable panels (panel-layout.ts). Preferences are per device
   * (localStorage), read after mount so server and first client render agree;
   * `draftPreferences` carries a drag in progress so it is only persisted when
   * the pointer is released.
   */
  const layoutRef = useRef<HTMLDivElement>(null);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [panelPreferences, setPanelPreferences] = useState<PanelPreferences>({});
  const [draftPreferences, setDraftPreferences] = useState<PanelPreferences | null>(null);
  const [resizing, setResizing] = useState(false);
  const [sectionNote, setSectionNote] = useState<string | null>(null);
  /** Set after mount: the server-rendered header controls do nothing until hydration, so tests (and tooling) can wait for this. */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  /** Download results, announced outside the popover so they are heard even after it closes. */
  const [downloadAnnouncement, setDownloadAnnouncement] = useState('');
  // Clear first, so the same message (a second download of the same file) is announced again.
  const announceTimerRef = useRef<number | null>(null);
  const announceDownload = useCallback((message: string) => {
    if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
    setDownloadAnnouncement('');
    announceTimerRef.current = window.setTimeout(() => {
      announceTimerRef.current = null;
      setDownloadAnnouncement(message);
    }, 60);
  }, []);
  useEffect(() => () => {
    if (announceTimerRef.current !== null) window.clearTimeout(announceTimerRef.current);
  }, []);
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
  // The question the URL names (either mode), else -- in the Working Draft --
  // the primary question of the section it names.
  const initialQuestion = useMemo(() => {
    const fromQ = navigation.questions.find((question) => question.id === urlState.q);
    if (fromQ) return fromQ;
    return !isMyReview && urlState.section ? navigation.questionForAnchor(urlState.section) : undefined;
    // Initial value only; later selections are client state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialCohortId = useMemo<CohortId>(() => {
    const fromUrl = cohortManifest.cohorts.find((cohort) => cohort.id === urlState.cohort)?.id;
    if (fromUrl) return fromUrl;
    const fromSection = isMyReview && urlState.section ? portions.find((portion) => portion.sectionAnchor === urlState.section)?.cohortId : undefined;
    const fromQuestion = initialQuestion ? cohortManifest.cohorts.find((cohort) => cohort.id === initialQuestion.topicId)?.id : undefined;
    return fromSection ?? fromQuestion ?? cohortManifest.cohorts[0]?.id ?? 'categories';
    // Initial value only; later selections are client state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedCohortId, setSelectedCohortId] = useState<CohortId>(initialCohortId);
  const [expandedCohortId, setExpandedCohortId] = useState<CohortId | null>(initialCohortId);
  const selectedCohort = cohortManifest.cohorts.find((cohort) => cohort.id === selectedCohortId) ?? cohortManifest.cohorts[0];

  /**
   * Download Files lists every review topic's verified PDF and DOCX, in topic
   * order and labelled by topic ("Sediment Uses - PDF"), in both modes. (It used
   * to show one cohort in My Review; with plain topic labels a reader can pick
   * any topic's files directly.) A topic with no verified manifest is OMITTED
   * rather than rendered empty or fabricated; if none survive, the popover
   * shows its pending state. Topic is not an authorization boundary: every file
   * still goes through the same authenticated, integrity-checked route.
   */
  const downloadGroups = useMemo(() => {
    if (!downloadManifests) return null;
    const groups = cohortManifest.cohorts.flatMap((cohort) => {
      const manifest = downloadManifests[cohort.id];
      // Presentation label only; the cohort id and manifest identity are unchanged.
      return manifest ? [{ cohortId: cohort.id, cohortName: reviewTopicLabel(cohort.id, cohort.name), manifest }] : [];
    });
    return groups.length > 0 ? groups : null;
  }, [downloadManifests, cohortManifest]);

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
  /*
   * The OPEN question (its prompt and editor expanded in Review Comments) is
   * separate from the ACTIVE one (highlighted, kept in sync with the paper).
   * Only an explicit choice opens a question -- a question row, Jump to topic,
   * Previous/Next, a question in the navigation -- or a URL that names one
   * (`q`). Paper navigation moves the highlight and never opens an editor.
   */
  const [openQuestionNumber, setOpenQuestionNumber] = useState<number | null>(() => navigation.questions.find((question) => question.id === urlState.q)?.number ?? null);
  const [activeQuestionNumber, setActiveQuestionNumber] = useState<number>(() => {
    if (initialQuestion && selectedCohort?.questionNumbers.includes(initialQuestion.number)) return initialQuestion.number;
    return firstQuestionOf(reviewerGuide, selectedCohort)?.number ?? 1;
  });
  const [selectedPortionId, setSelectedPortionId] = useState<string | undefined>(() => {
    const fromSection = urlState.section ? portions.find((portion) => portion.cohortId === initialCohortId && portion.sectionAnchor === urlState.section) : undefined;
    return fromSection?.id;
  });
  const [paperFocusRequest, setPaperFocusRequest] = useState(0);
  /** Scroll (never focus) the selected portion into view: a question chosen in the review panel. */
  const [paperRevealRequest, setPaperRevealRequest] = useState(0);
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
    currentUrlStateRef.current = urlState;
  }, [urlState]);

  // Reading width preference for this device: the reading frame's maximum (fluid below it).
  const [readerWidth, setReaderWidth] = useState<ReaderWidth>(DEFAULT_READER_WIDTH);
  useEffect(() => { setReaderWidth(readReaderWidth()); }, []);
  const changeReaderWidth = (value: ReaderWidth) => {
    setReaderWidth(value);
    writeReaderWidth(value);
  };

  // Panel width preferences for this device, and the layout width they fit into.
  useEffect(() => {
    try {
      setPanelPreferences(readPanelPreferences(window.localStorage));
    } catch {
      // Storage blocked: presets only.
    }
  }, []);
  useEffect(() => {
    const element = layoutRef.current;
    if (!element) return undefined;
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
    else setReviewCommentsOpen(open);
  };
  const toggleRefFor = (panel: PanelKey) => (panel === 'navigation' ? navigationToggleRef : reviewCommentsToggleRef);
  const closePanel = (panel: PanelKey) => {
    if (pendingRevealRef.current?.panel === panel) pendingRevealRef.current = null;
    setPanelOpen(panel, false);
    toggleRefFor(panel).current?.focus({ preventScroll: true });
  };
  const openPanel = (panel: PanelKey) => {
    // M1R8-08: a request to open an ALREADY-open panel must not leave a pending
    // reveal behind; React bails out of the state update, so nothing would ever
    // consume it and the next unrelated panel change would reveal the wrong one.
    const alreadyOpen = panel === 'navigation' ? navigationOpen : reviewCommentsOpen;
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
    const open = pending.panel === 'navigation' ? navigationOpen : reviewCommentsOpen;
    if (!open) return;
    pendingRevealRef.current = null;
    const heading = pending.panel === 'navigation' ? navigationHeadingRef.current : reviewCommentsHeadingRef.current;
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
  }, [authority, navigationOpen, reviewCommentsOpen]);



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
  /*
   * Why the pending Working Draft navigation is happening, keyed by its anchor
   * and consumed by focusSection (synchronously, or when a deferred section
   * load lands). A reader navigation (outline, in-paper link) pushes a history
   * entry, focuses the section and brings the related question into the review
   * panel. A question-driven navigation scrolls the paper to the question's
   * section but leaves focus in the review panel and the question unchanged.
   * Deep links and Back/Forward carry no intent: they restore, never push.
   */
  const navIntentRef = useRef<{ readonly anchor: string; readonly push: boolean; readonly focus: boolean; readonly syncQuestion: boolean; readonly scroll: boolean } | null>(null);

  /** Brings the section's primary question into the review panel; null when it has none. */
  const syncQuestionToAnchor = useCallback((anchor: string): string | null => {
    const question = navigation.questionForAnchor(anchor);
    if (question) {
      setActiveQuestionNumber(question.number);
      setSelectedCohortId(question.topicId as CohortId);
      setSectionNote(null);
      return question.id;
    }
    const label = outline?.find((entry) => entry.anchor === anchor)?.label;
    setSectionNote(`${label ? `"${label}"` : 'This section'} has no review question of its own, so your current question stays open.`);
    return null;
  }, [navigation, outline]);

  const focusSection = useCallback((anchor: string, writeUrl: boolean): boolean => {
    if (!anchors.has(anchor)) return false;
    const element = document.getElementById(anchor);
    if (!element) return false;
    const intent = navIntentRef.current?.anchor === anchor ? navIntentRef.current : null;
    if (intent) navIntentRef.current = null;
    // Below lg a question-driven navigation updates identity only: the paper and
    // the review rail are stacked, so scrolling would carry the reader away from
    // the editor they are working in. It must not PIN either -- a pin is what the
    // landing checks (and every later section load / header resize) re-land, so
    // an identity-only navigation releases any earlier pin instead (the reader's
    // attention is on the review panel, exactly the panelActivated policy).
    if (intent?.scroll === false) {
      authority.panelActivated();
    } else {
      authority.pin(anchor);
      authority.scrollTargetIntoView(element);
    }
    if (intent?.focus !== false) element.focus({ preventScroll: true });
    setActiveAnchor(anchor);
    setTargetAnchor(anchor);
    // The synced question is only HIGHLIGHTED; `q` in the URL names an
    // explicitly opened question and is left as it is (the highlight is
    // derived from `section` on reload).
    if (intent?.syncQuestion) syncQuestionToAnchor(anchor);
    if (writeUrl) updateUrl({ section: anchor }, { push: intent?.push === true });
    return true;
  }, [anchors, authority, syncQuestionToAnchor, updateUrl]);

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
      if (navIntentRef.current && navIntentRef.current.anchor !== anchor) navIntentRef.current = null;
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
      if (authority.pinnedAnchor() === anchor) scheduleLandingCheck(anchor);
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

  /** A reader's own navigation to a section (outline, in-paper link, hash). */
  const navigateFromReader = useCallback((anchor: string, push = true): boolean => {
    navIntentRef.current = { anchor, push, focus: true, syncQuestion: true, scroll: true };
    const started = navigateRef.current(anchor, true);
    if (!started && navIntentRef.current?.anchor === anchor) navIntentRef.current = null;
    return started;
  }, []);

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
        if (navIntentRef.current?.anchor === pending.anchor) navIntentRef.current = null;
        return;
      }
      if (document.getElementById(pending.anchor) === null) return;
      authority.cancelPendingNavigation();
      if (focusSection(pending.anchor, pending.writeUrl) && authority.pinnedAnchor() === pending.anchor) scheduleLandingCheck(pending.anchor);
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
      // The fragment never reaches the server, so the initial question could
      // not be derived from it: sync Review Comments to the section here
      // (unless an explicit q already chose the question).
      navIntentRef.current = { anchor: hashAnchor, push: false, focus: true, syncQuestion: !urlState.q, scroll: true };
      if (!navigateRef.current(hashAnchor, true) && navIntentRef.current?.anchor === hashAnchor) navIntentRef.current = null;
      return;
    }
    if (urlState.section) {
      navigateRef.current(urlState.section, false);
      return;
    }
    const linkedQuestion = navigation.questions.find((question) => question.id === urlState.q);
    const questionAnchor = linkedQuestion ? navigation.anchorForQuestion(linkedQuestion.number) : undefined;
    if (questionAnchor) {
      navIntentRef.current = { anchor: questionAnchor, push: false, focus: false, syncQuestion: false, scroll: true };
      if (!navigateRef.current(questionAnchor, false) && navIntentRef.current?.anchor === questionAnchor) navIntentRef.current = null;
    }
    // Deep-link identity only; later selections are client state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyReview, urlState.section, anchors]);

  useEffect(() => {
    if (isMyReview) return undefined;
    const onHashChange = () => {
      const hashAnchor = decodeHashValue(window.location.hash);
      // The hash change already made its own history entry: replace, never push.
      if (hashAnchor) navigateFromReader(hashAnchor, false);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isMyReview, navigateFromReader]);

  /*
   * Working Draft Back/Forward. Outline and question navigation push history
   * entries, so Back and Forward must restore BOTH panels from the URL: the
   * question from `q` (else the section's primary question) and the paper from
   * `section`. Restoring never writes history (no loop).
   */
  useEffect(() => {
    if (isMyReview) return undefined;
    const onPopState = () => {
      const questionCohort = new Map(navigation.questions.map((question) => [question.id, question.topicId]));
      const ctx: PaperUrlContext = { anchors, questionCohort, cohortIds: new Set(cohortManifest.cohorts.map((cohort) => cohort.id)) };
      const { state: restored } = parsePaperUrlState(searchParamsRecord(window.location.search), ctx);
      if (restored.mode !== 'working-draft') return;
      currentUrlStateRef.current = restored;
      // An entry with neither q nor section is the page as first opened: the
      // first question, paper at its start.
      const firstEntry = restored.q === null && restored.section === null;
      const question = navigation.questions.find((candidate) => candidate.id === restored.q)
        ?? (restored.section ? navigation.questionForAnchor(restored.section) : undefined)
        // No q in the entry: the question it was opened with was the default (first) one.
        ?? (restored.q === null ? navigation.questions[0] : undefined);
      if (question) {
        setActiveQuestionNumber(question.number);
        setSelectedCohortId(question.topicId as CohortId);
      }
      // The open editor agrees with the entry: its q is the explicitly opened
      // question (reopened after a close), and an entry without q is closed.
      setOpenQuestionNumber(navigation.questions.find((candidate) => candidate.id === restored.q)?.number ?? null);
      setSectionNote(null);
      const target = restored.section
        ?? (firstEntry ? outline?.[0]?.anchor ?? null : null)
        ?? (question ? navigation.anchorForQuestion(question.number) ?? null : null);
      if (target) {
        // Restore only: never push, never pull focus out of the review panel.
        navIntentRef.current = { anchor: target, push: false, focus: false, syncQuestion: false, scroll: true };
        if (!navigateRef.current(target, false) && navIntentRef.current?.anchor === target) navIntentRef.current = null;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [anchors, cohortManifest, isMyReview, navigation, outline]);

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

      const cohortFromUrl = cohortManifest.cohorts.find((c) => c.id === restored.cohort)?.id;
      const cohortFromSection = restored.section ? portions.find((p) => p.sectionAnchor === restored.section)?.cohortId : undefined;
      const cohortId: CohortId = cohortFromUrl ?? cohortFromSection ?? cohortManifest.cohorts[0]?.id ?? 'categories';
      const cohort = cohortManifest.cohorts.find((candidate) => candidate.id === cohortId);
      const questionFromUrl = reviewerGuide.questions.find((question) => question.id === restored.q && cohort?.questionNumbers.includes(question.number));
      const questionNumber = questionFromUrl?.number ?? firstQuestionOf(reviewerGuide, cohort)?.number ?? 1;
      const portion = restored.section ? portions.find((candidate) => candidate.cohortId === cohortId && candidate.sectionAnchor === restored.section) : undefined;

      currentUrlStateRef.current = restored;
      setSelectedCohortId(cohortId);
      setExpandedCohortId(cohortId);
      setActiveQuestionNumber(questionNumber);
      // The open editor agrees with the entry: its q (a question of the entry's
      // topic) is open, reopened after a close; an entry without q is closed.
      setOpenQuestionNumber(questionFromUrl?.number ?? null);
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
      navigateFromReader(anchor);
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

  useEffect(() => {
    if (paperRevealRequest === 0) return;
    const targetId = focusPortionIdRef.current;
    const heading = targetId ? portionHeadingRefs.current.get(targetId) ?? null : null;
    if (heading && !heading.closest('[inert]')) authority.scrollTargetIntoView(heading);
  }, [authority, paperRevealRequest]);

  const activeQuestion = allQuestionsInCohortOrder.find((question) => question.number === activeQuestionNumber) ?? allQuestionsInCohortOrder[0];
  const openQuestion = openQuestionNumber === null ? undefined : allQuestionsInCohortOrder.find((question) => question.number === openQuestionNumber);
  const cohortForQuestion = useCallback((questionId: string) => navigation.questions.find((question) => question.id === questionId)?.topicId ?? null, [navigation]);
  const activeQuestionCohortId = cohortManifest.cohorts.find((cohort) => cohort.questionNumbers.includes(activeQuestion?.number ?? -1))?.id ?? selectedCohort?.id ?? null;

  const [navOpenRequest, setNavOpenRequest] = useState(0);
  const selectQuestion = (number: number, origin: 'panel' | 'nav' = 'panel') => {
    // M2: Prev/Next, the "Jump to topic" select and the saved-questions list
    // all walk allQuestionsInCohortOrder, so a question outside the currently
    // selected cohort switches the cohort (and the document column's stacked
    // portions with it) instead of being unreachable.
    const question = reviewerGuide.questions.find((candidate) => candidate.number === number);
    if (!question) return;
    const cohort = cohortManifest.cohorts.find((candidate) => candidate.questionNumbers.includes(number));
    const cohortChanged = cohort !== undefined && cohort.id !== selectedCohortId;
    setActiveQuestionNumber(number);
    // An explicit choice opens the question (one editor at a time).
    setOpenQuestionNumber(number);
    setSectionNote(null);
    if (cohortChanged) {
      setSelectedCohortId(cohort.id);
      setExpandedCohortId(cohort.id);
      focusPortionIdRef.current = null;
    }
    if (!isMyReview) {
      // Working Draft: the paper follows the question (shared navigation
      // model). The outline expands to the section and the paper scrolls to it;
      // focus stays in the review panel, and the step is one history entry.
      currentUrlStateRef.current = { ...currentUrlStateRef.current, q: question.id };
      const anchor = navigation.anchorForQuestion(number);
      if (anchor) {
        navIntentRef.current = { anchor, push: true, focus: false, syncQuestion: false, scroll: isLgViewport() };
        if (navigateToAnchor(anchor, true)) return;
        navIntentRef.current = null;
      }
      updateUrl({ q: question.id }, { push: true });
      return;
    }
    // My Review: the question's own paper portion becomes the selected one and,
    // where the paper and the panel sit side by side (lg), it is scrolled into
    // view without taking focus from the response.
    const cohortId = cohort?.id ?? selectedCohortId;
    const navQuestion = navigation.questions.find((candidate) => candidate.number === number);
    const portion = navQuestion ? portions
      .filter((candidate) => candidate.cohortId === cohortId && candidate.status === 'available' && portionMatchesQuestion(candidate.sectionNumber, navQuestion))
      .sort((a, b) => b.sectionNumber.split('.').length - a.sectionNumber.split('.').length)[0] : undefined;
    if (portion) {
      setSelectedPortionId(portion.id);
      focusPortionIdRef.current = portion.id;
      if (isLgViewport()) setPaperRevealRequest((count) => count + 1);
    }
    const section = portion?.sectionAnchor ?? (cohortChanged ? (portions.find((candidate) => candidate.cohortId === cohortId)?.sectionAnchor ?? null) : currentUrlStateRef.current.section);
    // PLAN-R4 6.C: a question change pushes a new history entry (so Back
    // steps between questions); every other My Review URL change replaces.
    updateUrl({ cohort: cohortId, q: question.id, section }, { push: true });
    // The editor now opens INLINE in its row. A question opened from Review
    // Comments keeps the reader's own focus and view (the panel reveals rows it
    // opens from Previous/Next/Jump); one chosen in the left navigation asks the
    // panel to reveal and focus its row (never while the rail is closed/inert).
    if (origin === 'nav') setNavOpenRequest((count) => count + 1);
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
    // My Review URLs pair a topic with a question OF that topic: a topic that
    // does not hold the open question closes it (its text is saved on close).
    const keepsOpen = openQuestionNumber !== null && Boolean(cohort?.questionNumbers.includes(openQuestionNumber));
    if (!keepsOpen) setOpenQuestionNumber(null);
    updateUrl({ cohort: cohortId, q: keepsOpen ? currentUrlStateRef.current.q : null, section: portions.find((portion) => portion.cohortId === cohortId)?.sectionAnchor ?? null });
  };
  const selectPortion = (portionId: string) => {
    const portion = portions.find((candidate) => candidate.id === portionId);
    if (!portion) return;
    const cohortChanged = portion.cohortId !== selectedCohortId;
    // The portion's own question (shared navigation model) comes into the
    // review panel; a portion no question in its topic cites keeps the current
    // question, or the topic's first when the topic changed.
    // Same ranking as the Working Draft (most specific citation first), limited to this topic.
    const portionQuestion = navigation.questionsForSection(portion.sectionNumber).find((question) => question.topicId === portion.cohortId)
      ?? navigation.questions.find((question) => question.topicId === portion.cohortId && portionMatchesQuestion(portion.sectionNumber, question));
    if (cohortChanged) setSelectedCohortId(portion.cohortId);
    if (portionQuestion) setActiveQuestionNumber(portionQuestion.number);
    else if (cohortChanged) setActiveQuestionNumber(firstQuestionOf(reviewerGuide, cohortManifest.cohorts.find((cohort) => cohort.id === portion.cohortId))?.number ?? 1);
    setSectionNote(null);
    setExpandedCohortId(portion.cohortId);
    setSelectedPortionId(portionId);
    focusPortionIdRef.current = portionId;
    setPaperFocusRequest((count) => count + 1);
    // The portion's question is highlighted, not opened. The open question
    // stays open only while it belongs to the portion's topic (a canonical
    // My Review URL pairs a topic with its own question).
    const portionCohort = cohortManifest.cohorts.find((cohort) => cohort.id === portion.cohortId);
    const keepsOpen = openQuestionNumber !== null && Boolean(portionCohort?.questionNumbers.includes(openQuestionNumber));
    if (!keepsOpen) setOpenQuestionNumber(null);
    updateUrl({ cohort: portion.cohortId, q: keepsOpen ? currentUrlStateRef.current.q : null, section: portion.sectionAnchor ?? null });
  };
  // Review Comments reveals rows through the scroll authority. A question the
  // reviewer explicitly selected (navigation, Jump, Previous, Next) is revealed
  // at every width: below lg the page scrolls to the rail, which sits below the
  // paper. The mount-time reveal of a q deep link stays lg-only, so below lg it
  // never competes with the paper's own landing. Inert (closed) rails never scroll.
  const revealReviewElement = useCallback((element: HTMLElement, cause: ReviewRevealCause = 'selection') => {
    if (element.closest('[inert]')) return;
    if (cause === 'url' && !isLgViewport()) return;
    authority.scrollTargetIntoView(element);
  }, [authority]);
  /** Collapses the open question; the URL no longer names one (a reload opens nothing). */
  const closeQuestion = () => {
    setOpenQuestionNumber(null);
    updateUrl({ q: null });
  };
  const moveQuestion = (offset: number) => {
    // Previous/Next step from the open question (they live in its editor).
    const from = openQuestion ?? activeQuestion;
    const currentIndex = allQuestionsInCohortOrder.findIndex((question) => question.number === from?.number);
    const next = allQuestionsInCohortOrder[currentIndex + offset];
    if (next) selectQuestion(next.number);
  };

  /*
   * Adjustable panels (lg and up). The paper column takes whatever the open
   * panels leave; resolvePanelWidths keeps it at or above its minimum.
   */
  const effectivePreferences = draftPreferences ?? panelPreferences;
  const panelWidths = resolvePanelWidths(layoutWidth, effectivePreferences, { left: navigationOpen, right: reviewCommentsOpen });
  const panelMax = (side: PanelSide) => maxPanelWidth(side, layoutWidth || 1440, side === 'left' ? panelWidths.right : panelWidths.left, side === 'left' ? reviewCommentsOpen : navigationOpen);
  const persistPanelPreferences = (next: PanelPreferences) => {
    setPanelPreferences(next);
    setDraftPreferences(null);
    try {
      writePanelPreferences(window.localStorage, next);
    } catch {
      // Storage blocked: the widths still apply for this visit.
    }
  };
  const resizePanel = (side: PanelSide, width: number) => setDraftPreferences({ ...panelPreferences, [side]: width });
  const commitPanel = (side: PanelSide, width: number) => persistPanelPreferences({ ...panelPreferences, [side]: width });
  const resetPanel = (side: PanelSide) => persistPanelPreferences(side === 'left' ? { right: panelPreferences.right } : { left: panelPreferences.left });
  const customWidths = panelPreferences.left !== undefined || panelPreferences.right !== undefined;
  const layoutStyle = { [PAPER_LEFT_WIDTH_VAR]: `${panelWidths.left}px`, [PAPER_RIGHT_WIDTH_VAR]: `${panelWidths.right}px` } as CSSProperties;

  const headerButton = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]';
  const modeLink = (active: boolean) => cn('flex min-h-[44px] items-center rounded-md px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]', active ? 'bg-[var(--db-surface)] text-[var(--db-text-primary)] shadow-[var(--db-shadow-1)]' : 'text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)]');

  return (
    <div ref={shellRef} data-testid="workspace-shell" data-hydrated={hydrated ? 'true' : 'false'} className="flex min-h-0 flex-col overflow-x-clip bg-[var(--db-depth-0)] text-[var(--db-text-primary)] lg:h-[calc(100dvh-8rem)] print:block print:h-auto print:bg-white">
      <header data-testid="workspace-header" className="shrink-0 border-b border-[var(--db-border)] bg-[var(--db-surface)] print:hidden">
        <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 md:grid-cols-[auto_auto] md:justify-between lg:grid-cols-[auto_minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <h1 className="min-w-0 text-center text-base font-semibold md:col-span-2 md:text-left lg:col-span-1 lg:whitespace-nowrap">Matrix Options Paper - Review Workspace</h1>
          <div data-testid="workspace-header-controls" className="flex min-w-0 flex-wrap items-center justify-center gap-2 md:justify-start lg:justify-center">
            <nav aria-label="Workspace mode" className="flex items-center gap-0.5 rounded-lg bg-[var(--db-depth-1)] p-0.5">
              {/* Switching modes keeps the question the reviewer is on. */}
              <a href={paperWorkspaceHref(documentVersion, { mode: 'working-draft', cohort: null, q: openQuestion?.id ?? null, section: null })} aria-current={isMyReview ? undefined : 'page'} className={modeLink(!isMyReview)}>Working Draft</a>
              <a href={paperWorkspaceHref(documentVersion, { mode: 'my-review', cohort: activeQuestionCohortId, q: openQuestion?.id ?? null, section: null })} aria-current={isMyReview ? 'page' : undefined} className={modeLink(isMyReview)}>My Review</a>
            </nav>
            <button
              ref={downloadToggleRef}
              type="button"
              data-testid="download-files-toggle"
              aria-haspopup="dialog"
              aria-expanded={downloadOpen}
              aria-controls={PAPER_DOWNLOAD_PANEL_ID}
              onClick={() => { setAboutOpen(false); setDownloadOpen((open) => !open); }}
              className={cn(headerButton, 'border border-[var(--db-border-strong)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]', downloadOpen && 'bg-[var(--db-depth-1)]')}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              <span>Download Files</span>
              <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5 transition-transform motion-reduce:transition-none', downloadOpen && 'rotate-180')} />
            </button>
          </div>
          <div data-testid="workspace-panel-controls" className="flex min-w-0 flex-wrap items-center justify-center gap-1 md:justify-end">
            <button
              ref={aboutToggleRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={aboutOpen}
              aria-controls={PAPER_ABOUT_PANEL_ID}
              onClick={() => { setDownloadOpen(false); setAboutOpen((open) => !open); }}
              className={cn(headerButton, 'text-[var(--db-text-secondary)] hover:bg-[var(--db-depth-1)] hover:text-[var(--db-text-primary)]')}
            >
              <Info aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">About this draft</span>
            </button>
            {customWidths ? (
              <button type="button" data-testid="paper-reset-panel-widths" onClick={() => persistPanelPreferences({})} className={cn(headerButton, 'hidden text-[var(--db-text-secondary)] hover:bg-[var(--db-depth-1)] hover:text-[var(--db-text-primary)] lg:inline-flex')}>
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                <span className="sr-only xl:not-sr-only">Reset panel widths</span>
              </button>
            ) : null}
            <PaperRailToggle label="Navigation" testId="navigation-toggle" open={navigationOpen} controls={PAPER_NAVIGATION_RAIL_ID} buttonRef={navigationToggleRef} onClick={() => togglePanel('navigation', navigationOpen)} icon={navigationOpen ? <PanelLeftClose aria-hidden="true" className="h-4 w-4" /> : <PanelLeftOpen aria-hidden="true" className="h-4 w-4" />} />
            <PaperRailToggle label="Review Comments" testId="review-comments-toggle" open={reviewCommentsOpen} controls={PAPER_REVIEW_COMMENTS_RAIL_ID} buttonRef={reviewCommentsToggleRef} onClick={() => togglePanel('review-comments', reviewCommentsOpen)} icon={reviewCommentsOpen ? <PanelRightClose aria-hidden="true" className="h-4 w-4" /> : <PanelRightOpen aria-hidden="true" className="h-4 w-4" />} />
          </div>
        </div>
      </header>

      {/* keepMounted: a download still in flight keeps its status (and its error) when the popover is closed. */}
      <PaperPopover id={PAPER_DOWNLOAD_PANEL_ID} testId="download-files-popover" open={downloadOpen} keepMounted triggerRef={downloadToggleRef} label="Download files" width={340} onClose={() => setDownloadOpen(false)}>
        <DownloadFilesPanel groups={downloadGroups} onAnnounce={announceDownload} />
      </PaperPopover>
      <p data-testid="download-announcement" role="status" aria-live="polite" className="sr-only">{downloadAnnouncement}</p>
      <PaperPopover id={PAPER_ABOUT_PANEL_ID} testId="about-draft-popover" open={aboutOpen} triggerRef={aboutToggleRef} label="About this draft" width={340} onClose={() => setAboutOpen(false)}>
        <div className="space-y-2 p-2 text-sm">
          <h2 className="font-semibold">About this draft</h2>
          <p className="text-[var(--db-text-secondary)]">A review copy of the Matrix Options Paper working draft. It is not the published version of the paper.</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt className="text-[var(--db-text-secondary)]">Draft version</dt>
            <dd data-testid="about-draft-version" className="break-all font-[family-name:var(--db-font-mono)]">{documentVersion}</dd>
            <dt className="text-[var(--db-text-secondary)]">Review topics</dt>
            <dd>Proposed; pending approval</dd>
            <dt className="text-[var(--db-text-secondary)]">Assignments</dt>
            <dd>{assignmentSourceLabel(assignment)}</dd>
          </dl>
          <button type="button" onClick={() => { setAboutOpen(false); aboutToggleRef.current?.focus({ preventScroll: true }); }} className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-medium text-[var(--db-accent-strong)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]">Close</button>
        </div>
      </PaperPopover>

      <div ref={layoutRef} data-testid="workspace-layout" data-resizing={resizing ? 'true' : undefined} style={layoutStyle} className={cn(PAPER_SHELL_CLASSES, 'group/layout min-h-0', resizing && 'cursor-col-resize select-none')}>
        <PaperRail id={PAPER_NAVIGATION_RAIL_ID} testId="navigation-rail" side="left" open={navigationOpen} heading="Paper Navigation" headingId="paper-navigation-rail-heading" headingRef={navigationHeadingRef} onEscape={() => closePanel('navigation')}>
          {isMyReview
            ? <CohortReviewNav cohortManifest={cohortManifest} cohortPortions={portions} reviewerGuide={reviewerGuide} selectedCohortId={selectedCohortId} expandedCohortId={expandedCohortId} selectedPortionId={selectedPortionId} activeQuestionNumber={activeQuestionNumber} onSelectCohort={selectCohort} onSelectPortion={selectPortion} onSelectQuestion={(_cohortId, number) => selectQuestion(number, 'nav')} />
            : outline && outline.length > 0
              ? <PaperOutlineNav outline={outline} activeAnchor={activeAnchor} targetAnchor={targetAnchor} documentTargetId={PAPER_DOCUMENT_COLUMN_ID} onNavigate={(anchor) => { navigateFromReader(anchor); }} onSkipToDocument={skipToDocument} />
              : <p className="text-sm text-[var(--db-text-secondary)]">The paper outline is unavailable.</p>}
        </PaperRail>
        {navigationOpen ? <PanelResizeHandle side="left" label="Resize navigation panel" controls={PAPER_NAVIGATION_RAIL_ID} width={panelWidths.left} max={panelMax('left')} onResize={(width) => resizePanel('left', width)} onCommit={(width) => commitPanel('left', width)} onReset={() => resetPanel('left')} onDragChange={setResizing} /> : null}

        <div ref={documentColumnRef} id={PAPER_DOCUMENT_COLUMN_ID} data-testid="paper-document-column" tabIndex={-1} onClick={onDocumentClick} className="relative min-w-0 flex-1 bg-[var(--db-surface)] focus:outline-none lg:overflow-y-auto print:overflow-visible print:bg-white">
          {/* The reading frame: body text and wide blocks share its full width; Comfortable/Wide set its maximum (globals.css). */}
          <div data-testid="paper-reading-frame" data-reader-width={readerWidth} className="paper-reading-frame mx-auto min-w-0 space-y-5 px-4 py-5 sm:px-8 print:max-w-none print:p-0">
            <div data-testid={isMyReview ? 'my-review-toolbar' : 'working-draft-toolbar'} className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--db-border)] pb-3 print:hidden">
              <ReaderWidthControl value={readerWidth} onChange={changeReaderWidth} />
              {!isMyReview && sectionWindow ? <PaperDocumentToolbar api={sectionApi} /> : null}
            </div>

            {isMyReview
              ? portionsProvided
                ? (selectedPortions.length > 0
                  ? <div data-testid="cohort-paper-stack" className="space-y-8">
                      {/* PLAN-R4 3.B.2: every authenticated portion for the selected cohort is rendered in full -- stacked, not paginated. */}
                      {selectedPortions.map((portion) => (
                        <div key={portion.id}>
                          <CohortPaperPortion cohort={selectedCohort} portion={portion} headingId={`cohort-paper-heading-${portion.id}`} headingRef={portionHeadingRef(portion.id)} documentVersion={documentVersion} questionId={openQuestion?.id ?? null} />
                        </div>
                      ))}
                    </div>
                  : <CohortPaperPortion cohort={selectedCohort} portion={undefined} headingRef={(element) => { noPortionHeadingRef.current = element; }} documentVersion={documentVersion} />)
                : <CohortPortionsUnavailable workingDraftHref={workingDraftHref} />
              : sectionWindow && children
                ? <PaperSectionWindowView sectionWindow={sectionWindow} api={sectionApi} scrollRootRef={documentColumnRef}>{children}</PaperSectionWindowView>
                : children ?? <section data-testid="paper-document-unavailable" className="rounded-md border border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] p-5 text-sm"><h2 className="text-lg font-semibold">Paper text unavailable</h2><p role="status" className="mt-2">The paper text could not be loaded for this view. Try reloading the page.</p></section>}
          </div>
        </div>

        {reviewCommentsOpen ? <PanelResizeHandle side="right" label="Resize review comments panel" controls={PAPER_REVIEW_COMMENTS_RAIL_ID} width={panelWidths.right} max={panelMax('right')} onResize={(width) => resizePanel('right', width)} onCommit={(width) => commitPanel('right', width)} onReset={() => resetPanel('right')} onDragChange={setResizing} /> : null}
        <PaperRail id={PAPER_REVIEW_COMMENTS_RAIL_ID} testId="review-comments-rail" side="right" open={reviewCommentsOpen} heading="Review Comments" headingId="paper-review-comments-rail-heading" headingRef={reviewCommentsHeadingRef} onEscape={() => closePanel('review-comments')}>
          <ReviewCommentsPanel documentVersion={documentVersion} manifestSha256={reviewManifestSha256 ?? ''} cohortId={activeQuestionCohortId} questions={allQuestionsInCohortOrder} question={openQuestion} highlightQuestionNumber={activeQuestion?.number} onCloseQuestion={closeQuestion} revealElement={revealReviewElement} openRequest={navOpenRequest} responseRef={responseRef} onSelectQuestion={selectQuestion} onPreviousQuestion={() => moveQuestion(-1)} onNextQuestion={() => moveQuestion(1)} topics={navigation.topics} sectionNote={sectionNote} cohortForQuestion={cohortForQuestion} />
        </PaperRail>
      </div>
    </div>
  );
}
