import { renderToString } from 'react-dom/server';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { StrictMode, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import type { PaperUrlState } from '@/lib/matrix-options/paper/url-state';
import { getProductionAssignment } from '@/lib/matrix-options/revised-paper-review';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import type { PaperOutlineNavEntry } from '../PaperOutlineNav';
import {
  normalizeReaderTextForDisplay,
  PAPER_LANDING_TOLERANCE_PX,
  PAPER_PANEL_REVEAL_GAP_PX,
  PAPER_REVEAL_SETTLE_TIMEOUT_MS,
  panelRevealLandingSatisfied,
  panelRevealScrollDelta,
  pendingRevealForOpenRequest,
  RevisedPaperWorkspace,
  sectionFromInPageHref,
  selectActiveSectionAnchor,
} from '../RevisedPaperWorkspace';
import { PaperScrollAuthority } from '@/lib/matrix-options/paper/scroll-authority';

const version = '1.0.11-remediated-7-8-successor-20260918-D';
const base = `/matrix-options/paper/publication/v/${version}`;
const originalMatchMedia = window.matchMedia;
const originalScrollBy = window.scrollBy;
let scrollIntoView: ReturnType<typeof vi.fn>;
let scrollBy: ReturnType<typeof vi.fn>;

const outline: readonly PaperOutlineNavEntry[] = [
  { id: 'n1', anchor: 'intro', label: '1 Introduction', depth: 1, parentId: null, childIds: ['n2'] },
  { id: 'n2', anchor: 'scope', label: '1.1 Scope', depth: 2, parentId: 'n1', childIds: ['n3'] },
  { id: 'n3', anchor: 'detail', label: '1.1.1 Detail', depth: 3, parentId: 'n2', childIds: [] },
  { id: 'n4', anchor: 'methods', label: '2 Methods', depth: 1, parentId: null, childIds: [] },
];

function FakeDocument() {
  return <article data-testid="fake-document">{outline.map((entry) => <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1} style={{ scrollMarginTop: '16px' }}><h2>{entry.label} body</h2><p><a href="?mode=working-draft&section=methods">Go to methods</a> <a href="#scope">Hash to scope</a> <a href="#not-a-section">Unknown reference</a></p></section>)}</article>;
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  constructor(readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) { this.observed.push(element); }
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
  fire(entries: readonly (readonly [string, boolean])[]) {
    act(() => {
      this.callback(entries.map(([id, isIntersecting]) => ({ target: document.getElementById(id), isIntersecting })) as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
    });
  }
}

function rect(top: number, height = 300): DOMRect {
  return { top, bottom: top + height, left: 0, right: 800, width: 800, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** Stubs live section geometry (viewport tops) for the reading-line rule. */
function placeSections(tops: Readonly<Record<string, number>>) {
  for (const [id, top] of Object.entries(tops)) (document.getElementById(id) as HTMLElement).getBoundingClientRect = () => rect(top);
}

function activeOutlineLabels(): string[] {
  return Array.from(screen.getByTestId('paper-outline-desktop').querySelectorAll('[aria-current="location"]')).map((link) => link.textContent ?? '');
}

function state(overrides: Partial<PaperUrlState> = {}): PaperUrlState {
  return { mode: 'working-draft', cohort: null, q: null, section: null, ...overrides };
}

function renderWorkingDraft(section: string | null = null, children: ReactNode = <FakeDocument />) {
  return render(<RevisedPaperWorkspace documentVersion={version} urlState={state({ section })} assignment={getProductionAssignment()} outline={outline}>{children}</RevisedPaperWorkspace>);
}

function realPortions(): CohortPortion[] {
  return getCohortManifest().cohorts.map((cohort) => ({
    id: `${cohort.id}:paper-portion`,
    cohortId: cohort.id,
    name: cohort.name,
    status: 'available' as const,
    sectionNumber: '4.1',
    sourceLocator: 'Section 4.1',
    sourceNodeId: `node:${cohort.id}`,
    sectionLabel: cohort.name,
    startByte: 0,
    endByte: 42,
    text: `# ${cohort.name} source context\n\nAuthenticated bounded excerpt.`,
    sectionAnchor: `anchor-${cohort.id}`,
  }));
}

function renderMyReview(overrides: Partial<PaperUrlState> = {}, portions: readonly CohortPortion[] | 'none' = realPortions()) {
  const cohortPortions = portions === 'none' ? undefined : portions;
  return render(<RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'my-review', ...overrides })} assignment={getProductionAssignment()} cohortPortions={cohortPortions} />);
}

function setLgViewport(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
}

function headerHost() {
  return screen.getByTestId('paper-header-actions');
}

function scrolledElements(): unknown[] {
  return scrollIntoView.mock.contexts;
}

beforeEach(() => {
  const host = document.createElement('div');
  host.id = 'matrix-options-paper-header-actions';
  host.setAttribute('data-testid', 'paper-header-actions');
  document.body.appendChild(host);
  scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: scrollIntoView });
  // jsdom implements no scrolling. The M1R4-02 reveal correction calls
  // window.scrollBy, so it is stubbed for every test in this file and restored
  // afterwards, rather than left to log "Not implemented" into the run.
  scrollBy = vi.fn();
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  document.getElementById('matrix-options-paper-header-actions')?.remove();
  window.matchMedia = originalMatchMedia;
  window.scrollBy = originalScrollBy;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('RevisedPaperWorkspace Working Draft', () => {
  it('removes only standalone generated section anchors for presentation', () => {
    const source = ['  <div id="sec-first" class="section-anchor"></div>  ', '<div id="sec-second" class="section-anchor"> </div>', '<div id="sec-near" class="section-anchor">Keep this content</div>', '<div id="sec-other" class="other-anchor"></div>'].join('\r\n');
    expect(normalizeReaderTextForDisplay(source)).toBe(['<div id="sec-near" class="section-anchor">Keep this content</div>', '<div id="sec-other" class="other-anchor"></div>'].join('\r\n'));
  });

  it('labels Working Draft, links both canonical modes, opens Navigation by default, and has no Atlas', () => {
    const { container } = renderWorkingDraft();
    const workingDraft = screen.getByRole('link', { name: 'Working Draft' });
    expect(workingDraft).toHaveAttribute('aria-current', 'page');
    expect(workingDraft).toHaveAttribute('href', `${base}?mode=working-draft`);
    expect(screen.getByRole('link', { name: 'My Review' })).toHaveAttribute('href', `${base}?mode=my-review`);
    expect(screen.getByRole('link', { name: 'My Review' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('link', { name: 'Publication' })).toBeNull();
    expect(container.textContent).not.toMatch(/Publication Atlas|Publication cockpit|Canonical reader/);
    expect(screen.queryByRole('heading', { name: 'Publication Atlas' })).toBeNull();

    const navigation = within(headerHost()).getByRole('button', { name: 'Navigation' });
    expect(navigation).toHaveAttribute('aria-expanded', 'true');
    expect(navigation).toHaveAttribute('aria-controls', 'paper-navigation-rail');
    expect(navigation).toHaveClass('min-h-[44px]', 'bg-sky-50', 'text-sky-700');
    expect(navigation).not.toHaveAttribute('aria-pressed');
    expect(within(headerHost()).queryByRole('button', { name: 'Review Comments' })).toBeNull();
    const rail = screen.getByTestId('navigation-rail');
    expect(rail).toHaveAttribute('id', 'paper-navigation-rail');
    expect(rail).toHaveAttribute('data-state', 'open');
    expect(rail).not.toHaveAttribute('inert');
    expect(rail).toHaveClass('w-full', 'p-6', 'lg:w-80', 'print:hidden');
    expect(rail.className).not.toMatch(/max-h-/);
    expect(within(rail).getByTestId('paper-outline')).toBeInTheDocument();

    const download = within(screen.getByTestId('workspace-header-controls')).getByRole('button', { name: 'Download Files' });
    expect(download).toHaveAttribute('aria-expanded', 'false');
    expect(download).toHaveClass('min-h-[44px]');
    expect(screen.getByTestId('download-files-panel')).toHaveAttribute('hidden');

    const column = screen.getByTestId('paper-document-column');
    expect(within(column).getByTestId('fake-document')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-layout')).toHaveClass('flex', 'flex-col', 'lg:flex-row', 'overflow-y-auto', 'lg:overflow-hidden');
    expect(rail.compareDocumentPosition(column) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('.fixed')).toBeNull();
    expect(container.querySelector('.absolute')).toBeNull();
  });

  it('collapses Navigation to an inert closed rail and returns focus to its toggle at every width', () => {
    renderWorkingDraft();
    const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
    const rail = screen.getByTestId('navigation-rail');
    fireEvent.click(toggle);
    expect(rail).toHaveAttribute('data-state', 'closed');
    expect(rail).toHaveAttribute('inert');
    expect(rail).toHaveClass('max-h-0', 'w-full', 'border-b-0', 'p-0', 'lg:max-h-none', 'lg:w-0');
    expect(rail).not.toHaveClass('p-6', 'lg:w-80');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('border', 'bg-white', 'text-slate-700');
    expect(toggle).toHaveFocus();

    // Closing from inside the rail with Escape also rescues focus.
    fireEvent.click(toggle);
    const link = within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' });
    link.focus();
    expect(fireEvent.keyDown(link, { key: 'Escape' })).toBe(false);
    expect(rail).toHaveAttribute('data-state', 'closed');
    expect(toggle).toHaveFocus();

    setLgViewport(true);
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveFocus();
  });

  it('reveals and focuses the opened Navigation heading below lg but not at lg', () => {
    renderWorkingDraft();
    const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
    const heading = within(screen.getByTestId('navigation-rail')).getByRole('heading', { name: 'Navigation', level: 2 });
    expect(heading).toHaveAttribute('tabindex', '-1');

    setLgViewport(false);
    fireEvent.click(toggle);
    scrollIntoView.mockClear();
    fireEvent.click(toggle);
    expect(heading).toHaveFocus();
    expect(scrolledElements()).toContain(heading);

    setLgViewport(true);
    fireEvent.click(toggle);
    scrollIntoView.mockClear();
    fireEvent.click(toggle);
    expect(heading).not.toHaveFocus();
    expect(scrolledElements()).not.toContain(heading);
  });

  it('keeps Download Files in the document column, reveals it below lg, and closes it with focus rescue', () => {
    renderWorkingDraft();
    const toggle = within(screen.getByTestId('workspace-header-controls')).getByRole('button', { name: 'Download Files' });
    const panel = screen.getByTestId('download-files-panel');
    expect(toggle).toHaveAttribute('aria-controls', panel.id);
    fireEvent.click(toggle);
    expect(panel).not.toHaveAttribute('hidden');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('paper-document-column')).toContainElement(panel);
    expect(panel.compareDocumentPosition(screen.getByTestId('fake-document')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const heading = within(panel).getByRole('heading', { name: 'Download Files', level: 2 });
    expect(heading).toHaveFocus();
    expect(scrolledElements()).toContain(heading);
    // The revealed panel heading clears the measured sticky header, not a fixed 6rem.
    expect(heading).toHaveClass('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
    expect(heading.className).not.toMatch(/scroll-mt-24/);
    const content = screen.getByTestId('reading-materials-content');
    expect(content).toHaveTextContent('will be downloaded when ready');
    expect(content).toHaveTextContent('review package files are pending server validation');
    expect(within(panel).queryByRole('link')).toBeNull();

    fireEvent.click(within(panel).getByRole('button', { name: 'Hide Download Files' }));
    expect(panel).toHaveAttribute('hidden');
    expect(toggle).toHaveFocus();

    fireEvent.click(toggle);
    expect(fireEvent.keyDown(heading, { key: 'Escape' })).toBe(false);
    expect(panel).toHaveAttribute('hidden');
    expect(toggle).toHaveFocus();
  });

  it('scopes Escape to open panels and never swallows unrelated Escape presses', () => {
    renderMyReview();
    expect(fireEvent.keyDown(document.body, { key: 'Escape' })).toBe(true);
    expect(screen.getByTestId('navigation-rail')).toHaveAttribute('data-state', 'open');
    expect(screen.getByTestId('review-comments-rail')).toHaveAttribute('data-state', 'open');
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    expect(fireEvent.keyDown(select, { key: 'Escape' })).toBe(true);
    expect(screen.getByTestId('review-comments-rail')).toHaveAttribute('data-state', 'open');
    expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(true);
  });

  it('navigates from the outline and in-paper links by scrolling, focusing the section, and replacing section in the URL (M1-04 canonical hrefs)', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderWorkingDraft();
    const desktop = screen.getByTestId('paper-outline-desktop');
    const link = within(desktop).getByRole('link', { name: '2 Methods' });
    expect(link).toHaveAttribute('href', '?mode=working-draft&section=methods');
    expect(fireEvent.click(link)).toBe(false);
    const section = document.getElementById('methods');
    expect(section).toHaveFocus();
    expect(scrolledElements()).toContain(section);
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/?mode=working-draft&section=methods');
    expect(link).toHaveAttribute('aria-current', 'location');

    replaceState.mockClear();
    const intro = document.getElementById('intro') as HTMLElement;
    expect(fireEvent.click(within(intro).getByRole('link', { name: 'Go to methods' }))).toBe(false);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?mode=working-draft&section=methods');

    replaceState.mockClear();
    expect(fireEvent.click(within(intro).getByRole('link', { name: 'Hash to scope' }))).toBe(false);
    expect(document.getElementById('scope')).toHaveFocus();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?mode=working-draft&section=scope');

    replaceState.mockClear();
    expect(fireEvent.click(within(intro).getByRole('link', { name: 'Unknown reference' }))).toBe(true);
    expect(fireEvent.click(within(intro).getByRole('link', { name: 'Go to methods' }), { ctrlKey: true })).toBe(true);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('M1-04: a known #anchor that conflicts with a stale section wins and replaces section; a matching hash does not rewrite', () => {
    window.history.replaceState(null, '', '/?mode=working-draft&section=intro#methods');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { unmount } = renderWorkingDraft('intro');
    expect(document.getElementById('methods')).toHaveFocus();
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/?mode=working-draft&section=methods');
    unmount();

    window.history.replaceState(null, '', '/?mode=working-draft&section=methods#methods');
    replaceState.mockClear();
    renderWorkingDraft('methods');
    expect(document.getElementById('methods')).toHaveFocus();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('focuses the URL section on load, expands its ancestors, and does not rewrite a canonical URL', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderWorkingDraft('detail');
    expect(document.getElementById('detail')).toHaveFocus();
    expect(scrolledElements()).toContain(document.getElementById('detail'));
    const desktop = screen.getByTestId('paper-outline-desktop');
    expect(within(desktop).getByRole('button', { name: 'Subsections of 1.1 Scope' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(desktop).getByRole('link', { name: '1.1.1 Detail' })).toBeInTheDocument();
    expect(within(screen.getByTestId('paper-outline-stacked')).getByRole('button', { name: 'Subsections of 1 Introduction' })).toHaveAttribute('aria-expanded', 'true');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('mirrors a known #anchor alias into section and ignores an unknown hash', () => {
    window.history.replaceState(null, '', '/#methods');
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { unmount } = renderWorkingDraft();
    expect(document.getElementById('methods')).toHaveFocus();
    expect(replaceState).toHaveBeenCalledWith(null, '','/?mode=working-draft&section=methods');
    unmount();

    window.history.replaceState(null, '', '/#unknown-anchor');
    replaceState.mockClear();
    renderWorkingDraft();
    expect(replaceState).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it('M1-01: selection and in-page href helpers use the reading line and one canonical section identity', () => {
    expect(selectActiveSectionAnchor([{ id: 'a', top: -500, scrollMarginTop: 16 }, { id: 'b', top: 16, scrollMarginTop: 16 }, { id: 'c', top: 18, scrollMarginTop: 16 }], 0)).toBe('b');
    expect(selectActiveSectionAnchor([{ id: 'a', top: -500, scrollMarginTop: 96 }, { id: 'b', top: 96, scrollMarginTop: 96 }], 0)).toBe('b');
    expect(selectActiveSectionAnchor([{ id: 'a', top: 140, scrollMarginTop: 16 }, { id: 'b', top: 600, scrollMarginTop: 16 }], 120)).toBe('a');
    expect(selectActiveSectionAnchor([{ id: 'a', top: 40, scrollMarginTop: 16 }], 0)).toBe('a');
    expect(selectActiveSectionAnchor([], 0)).toBeNull();
    expect(sectionFromInPageHref('?mode=working-draft&section=x')).toBe('x');
    expect(sectionFromInPageHref('#x')).toBe('x');
    expect(sectionFromInPageHref('?mode=my-review&section=x')).toBeNull();
    expect(sectionFromInPageHref('?mode=working-draft&section=x&section=y')).toBeNull();
    expect(sectionFromInPageHref('/other?mode=working-draft&section=x')).toBeNull();
    expect(sectionFromInPageHref(null)).toBeNull();
  });

  describe('active section (M1-01)', () => {
    beforeEach(() => {
      FakeIntersectionObserver.instances = [];
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    });

    function renderTracked(lg: boolean) {
      setLgViewport(lg);
      renderWorkingDraft();
      expect(FakeIntersectionObserver.instances).toHaveLength(1);
      const observer = FakeIntersectionObserver.instances[0];
      expect(observer.observed.map((element) => element.id)).toEqual(['intro', 'scope', 'detail', 'methods']);
      screen.getByTestId('paper-document-column').getBoundingClientRect = () => rect(120, 700);
      return observer;
    }

    it('after a jump marks the target on the reading line, not the predecessor whose tail is still visible', () => {
      const observer = renderTracked(true);
      // scrollIntoView({ block: 'start' }) with a 16px scroll margin lands methods at 120 + 16;
      // detail's last 8px (the section gap) are still inside the column above it.
      placeSections({ detail: -172, methods: 136 });
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
    });

    it('keeps the previous section active until the next heading crosses the reading line', () => {
      const observer = renderTracked(true);
      placeSections({ detail: -150, methods: 186 });
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['1.1.1 Detail']);
      expect(within(screen.getByTestId('paper-outline-desktop')).getByRole('button', { name: 'Subsections of 1.1 Scope' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('recomputes on scroll without a new observer callback', async () => {
      const observer = renderTracked(true);
      placeSections({ detail: -150, methods: 186 });
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['1.1.1 Detail']);
      placeSections({ detail: -300, methods: 130 });
      await act(async () => {
        screen.getByTestId('paper-document-column').dispatchEvent(new Event('scroll'));
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
    });

    it('below lg measures the reading line from the viewport top, not the document column', () => {
      const observer = renderTracked(false);
      placeSections({ detail: -200, methods: 60 });
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['1.1.1 Detail']);
      placeSections({ detail: -200, methods: 16 });
      observer.fire([['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
    });

    it('keeps a navigated section active until the next user scroll intent', () => {
      const observer = renderTracked(true);
      fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
      // The last section cannot reach the reading line, so geometry alone would select detail.
      placeSections({ detail: -100, methods: 400 });
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
      fireEvent.wheel(window);
      observer.fire([['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['1.1.1 Detail']);
    });
  });

  it('renders a truthful unavailable state when the server did not provide the paper document', () => {
    renderWorkingDraft(null, null);
    expect(screen.getByTestId('paper-document-unavailable')).toHaveTextContent('Paper text unavailable');
  });

  it('keeps rails and chrome out of print while the document column prints', () => {
    renderMyReview();
    expect(screen.getByTestId('navigation-rail')).toHaveClass('print:hidden');
    expect(screen.getByTestId('review-comments-rail')).toHaveClass('print:hidden');
    expect(screen.getByRole('banner')).toHaveClass('print:hidden');
    expect(screen.getByTestId('paper-document-column')).not.toHaveClass('print:hidden');
  });
});

describe('RevisedPaperWorkspace Working Draft section window (S1)', () => {
  const SHA = 'd'.repeat(64);
  const sectionWindow = {
    paperSha256: SHA,
    initialIndex: 0,
    sections: [
      { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
      { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
    ],
    linkMap: {},
  };

  /** The server-rendered initial section: the depth-1 run intro..detail, no methods. */
  function InitialSection() {
    return <>{outline.filter((entry) => entry.anchor !== 'methods').map((entry) => (
      <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1} style={{ scrollMarginTop: '16px' }}>
        <h2>{entry.label} body</h2>
      </section>
    ))}</>;
  }

  function methodsContract(overrides: Record<string, unknown> = {}) {
    return {
      schema: 'matrix-paper-section-v1',
      documentVersion: version,
      paperSha256: SHA,
      index: 1,
      sectionCount: 2,
      anchor: 'methods',
      startByte: 400,
      endByte: 1200,
      chunks: [{ id: 'node:methods', anchor: 'methods', depth: 1, label: '2 Methods', startByte: 400, endByte: 1200, markdown: '# 2 Methods\n\nLoaded methods body.' }],
      ...overrides,
    };
  }

  function stubFetch(result: { ok: boolean; body?: unknown; status?: number } = { ok: true }) {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: result.ok, status: result.status ?? (result.ok ? 200 : 500), json: async () => result.body ?? methodsContract() } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return calls;
  }

  function renderWindow(section: string | null = null) {
    return render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ section })} assignment={getProductionAssignment()} outline={outline} sectionWindow={sectionWindow}>
        <InitialSection />
      </RevisedPaperWorkspace>,
    );
  }

  it('server-renders the initial section and an ordered placeholder for every other section', () => {
    stubFetch();
    renderWindow();
    const article = screen.getByTestId('paper-document');
    expect(Array.from(article.querySelectorAll('section[data-paper-chunk]')).map((section) => section.id)).toEqual(['intro', 'scope', 'detail']);
    const placeholder = article.querySelector('[data-paper-section-placeholder="methods"]') as HTMLElement;
    expect(placeholder).not.toBeNull();
    expect(within(placeholder).getByRole('heading', { name: '2 Methods', level: 2 })).toBeInTheDocument();
    expect(within(placeholder).getByRole('button', { name: 'Load section' })).toBeInTheDocument();
    // A placeholder is never mistaken for a chunk: no chunk id, no chunk marker.
    expect(placeholder.hasAttribute('data-paper-chunk')).toBe(false);
    expect(placeholder.id).toBe('');
    expect(document.getElementById('methods')).toBeNull();
    // Cosmetic reserved height derived from the section size, calibrated to the
    // 0.329 px/byte measured by browser run-001 (M1R3-03): 800 bytes -> 263px.
    expect(placeholder.style.minHeight).toBe('263px');
    // M1R3-03: the placeholder stays an explicit scroll-anchor candidate, so
    // loading it above the reading position cannot move the reader, and it still
    // clears the measured sticky header when it is a navigation target.
    expect(placeholder).toHaveClass('[overflow-anchor:auto]');
    expect(placeholder).toHaveClass('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
    expect(screen.getByTestId('paper-load-progress')).toHaveTextContent('Loaded 1 of 2 sections');
  });

  it('loads the owning section from an outline click, then focuses the target once it has mounted', async () => {
    const calls = stubFetch();
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderWindow();
    fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/api/matrix-options/paper/v/${version}/sections/methods?paper=${SHA}`);
    expect(calls[0].init?.credentials).toBe('same-origin');
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    await waitFor(() => expect(document.getElementById('methods')).toHaveFocus());
    expect(scrolledElements()).toContain(document.getElementById('methods'));
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/?mode=working-draft&section=methods');
    expect(activeOutlineLabels()).toEqual(['2 Methods']);
  });

  it('follows a hash deep link into a section that is not loaded yet', async () => {
    window.history.replaceState(null, '', '/#methods');
    stubFetch();
    renderWindow();
    await waitFor(() => expect(document.getElementById('methods')).toHaveFocus());
  });

  it('gates print and find guidance on a complete document and reports progress', async () => {
    stubFetch();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    renderWindow();
    const printButton = screen.getByTestId('paper-print-button');
    expect(printButton).toBeDisabled();
    expect(screen.getByTestId('paper-print-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('paper-find-guidance')).toBeNull();
    expect(screen.getByTestId('paper-partial-print-notice')).toBeInTheDocument();
    expect(screen.getByTestId('paper-load-progress-bar')).toHaveAttribute('value', '1');

    fireEvent.click(screen.getByTestId('paper-load-full-document-button'));
    await waitFor(() => expect(screen.getByTestId('paper-load-full-document-button')).toHaveTextContent('Full document loaded'));
    expect(screen.getByTestId('paper-load-progress')).toHaveTextContent('Loaded 2 of 2 sections');
    expect(screen.getByTestId('paper-find-guidance')).toHaveTextContent('Ctrl+F');
    expect(screen.queryByTestId('paper-partial-print-notice')).toBeNull();
    expect(screen.getByTestId('paper-print-button')).toBeEnabled();
    fireEvent.click(screen.getByTestId('paper-print-button'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed section and recovers on retry', async () => {
    stubFetch({ ok: false, status: 500 });
    renderWindow();
    fireEvent.click(within(screen.getByTestId('paper-document')).getByRole('button', { name: 'Load section' }));
    const retry = await screen.findByRole('button', { name: 'Retry section' });
    const placeholder = screen.getByTestId('paper-document').querySelector('[data-paper-section-placeholder="methods"]') as HTMLElement;
    expect(within(placeholder).getByRole('alert')).toHaveTextContent('Paper section request failed: 500');
    expect(within(screen.getByTestId('paper-load-full-document')).getByRole('alert')).toHaveTextContent('1 section(s) did not load');
    stubFetch({ ok: true });
    fireEvent.click(retry);
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    expect(screen.getByTestId('paper-load-progress')).toHaveTextContent('Loaded 2 of 2 sections');
  });

  /*
   * SCROLL AUTHORITY MIGRATION, section 4.2 item 2: a navigation still waiting
   * for its section is a DEFERRED pin. A later navigation, reader scroll intent
   * and a failed load each clear it, so a late section can never take the pin,
   * focus, URL and scroll back from where the reader has since gone.
   */
  /** A methods response held at the network boundary until `release()`; `ok: false` fails it. */
  function holdMethods(result: { ok: boolean } = { ok: true }) {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate;
      return { ok: result.ok, status: result.ok ? 200 : 500, json: async () => methodsContract() } as unknown as Response;
    }));
    return () => { act(() => { release(); }); };
  }

  function outlineLink(name: string) {
    return within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name });
  }

  /** Lets the post-commit effects of a resolved section run. */
  async function settleEffects() {
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 0); }); });
  }

  it('MIG-4.2.2: a later navigation wins over one still waiting for its section, and without the later one the waiting navigation lands', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    // CONTROL: the waiting navigation alone lands when its section arrives.
    let release = holdMethods();
    const first = renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    release();
    await waitFor(() => expect(document.getElementById('methods')).toHaveFocus());
    first.unmount();

    // MAIN: navigate to the unloaded section, then to a loaded one, then let the first arrive.
    release = holdMethods();
    renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    fireEvent.click(outlineLink('1 Introduction'));
    expect(document.getElementById('intro')).toHaveFocus();
    replaceState.mockClear();
    scrollIntoView.mockClear();
    release();
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    await settleEffects();
    const methods = document.getElementById('methods');
    expect(document.getElementById('intro')).toHaveFocus();
    expect(scrolledElements()).not.toContain(methods);
    expect(replaceState).not.toHaveBeenCalledWith(null, '', '/?mode=working-draft&section=methods');
  });

  // HOLISTIC_R2 F4: the title says WHEEL, because that is what the code does.
  // mousedown, keydown and touchstart do NOT cancel a pending navigation - each
  // is also how a reader activates a control, and browser run-007
  // `s1-collision.identity-still-applied` proved a waiting navigation must
  // survive a panel activation. Recorded as an explicit L2 decision (receipt D4).
  it('MIG-4.2.2: a wheel cancels a navigation still waiting for its section', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    // CONTROL: without the wheel, the identical waiting navigation lands.
    let release = holdMethods();
    const first = renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    release();
    await waitFor(() => expect(document.getElementById('methods')).toHaveFocus());
    first.unmount();

    // MAIN: the reader wheels away before the section arrives.
    release = holdMethods();
    renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    fireEvent.wheel(window);
    replaceState.mockClear();
    scrollIntoView.mockClear();
    release();
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    await settleEffects();
    const methods = document.getElementById('methods');
    expect(methods).not.toHaveFocus();
    expect(scrolledElements()).not.toContain(methods);
    expect(replaceState).not.toHaveBeenCalledWith(null, '', '/?mode=working-draft&section=methods');
  });

  it('MIG-4.2.2: a failed load clears the waiting navigation, so a later successful retry does not navigate', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    // CONTROL: the identical navigation whose load succeeds lands.
    let release = holdMethods();
    const first = renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    release();
    await waitFor(() => expect(document.getElementById('methods')).toHaveFocus());
    first.unmount();

    // MAIN: the load fails, the reader retries, and the retry succeeds.
    release = holdMethods({ ok: false });
    renderWindow();
    fireEvent.click(outlineLink('2 Methods'));
    release();
    const retry = await screen.findByRole('button', { name: 'Retry section' });
    await settleEffects();
    release = holdMethods();
    fireEvent.click(retry);
    replaceState.mockClear();
    scrollIntoView.mockClear();
    release();
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    await settleEffects();
    const methods = document.getElementById('methods');
    expect(methods).not.toHaveFocus();
    expect(scrolledElements()).not.toContain(methods);
    expect(replaceState).not.toHaveBeenCalledWith(null, '', '/?mode=working-draft&section=methods');
  });

  describe('active section tracking with loaded sections', () => {
    beforeEach(() => {
      FakeIntersectionObserver.instances = [];
      vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    });

    function trackerFor(ids: readonly string[]) {
      return FakeIntersectionObserver.instances.filter((observer) => ids.every((id) => observer.observed.some((element) => element.id === id)));
    }

    it('re-observes a section once it has loaded', async () => {
      stubFetch();
      setLgViewport(true);
      renderWindow();
      expect(trackerFor(['intro', 'scope', 'detail'])).toHaveLength(1);
      expect(trackerFor(['methods'])).toHaveLength(0);
      fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
      await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
      await waitFor(() => expect(trackerFor(['intro', 'methods']).length).toBeGreaterThan(0));
    });

    it('M1R2-04: marks the last section active once the scrollport is at maximum scroll', async () => {
      stubFetch();
      setLgViewport(true);
      renderWindow();
      fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
      await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
      fireEvent.wheel(window);
      const column = screen.getByTestId('paper-document-column');
      column.getBoundingClientRect = () => rect(120, 700);
      Object.defineProperty(column, 'scrollHeight', { value: 2000, configurable: true });
      Object.defineProperty(column, 'clientHeight', { value: 700, configurable: true });
      Object.defineProperty(column, 'scrollTop', { value: 1300, configurable: true, writable: true });
      // Nothing can cross the reading line any more: methods never reaches 136.
      placeSections({ intro: -2000, scope: -1500, detail: -300, methods: 500 });
      const observer = trackerFor(['intro', 'methods'])[0];
      observer.fire([['intro', true], ['scope', true], ['detail', true], ['methods', true]]);
      expect(activeOutlineLabels()).toEqual(['2 Methods']);
    });

    it('M1R3-06: below lg the end-of-document rule reads the window scroll, and short of the end the reading line still decides', async () => {
      stubFetch();
      setLgViewport(false);
      renderWindow();
      fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
      await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
      fireEvent.wheel(window);

      const page = document.documentElement;
      const originalInnerHeight = window.innerHeight;
      const originalScrollY = window.scrollY;
      const setScrollY = (value: number) => Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true });
      try {
        // Below lg the PAGE scrolls, so the branch under test reads
        // document.documentElement.scrollHeight, window.innerHeight and
        // window.scrollY -- never the document column's scrollTop.
        Object.defineProperty(page, 'scrollHeight', { value: 3000, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true, writable: true });
        // The reading line below lg is the viewport top, so methods at 500 can
        // never cross it and only the end-of-document rule can select it.
        placeSections({ intro: -2200, scope: -1800, detail: -300, methods: 500 });
        const observer = trackerFor(['intro', 'methods'])[0];

        // Short of maximum scroll: the ordinary reading-line rule still applies.
        setScrollY(1000);
        observer.fire([['intro', true], ['scope', true], ['detail', true], ['methods', true]]);
        expect(activeOutlineLabels()).toEqual(['1.1.1 Detail']);

        // At maximum window scroll: the last section whose top is inside the
        // viewport becomes active (the 360 and 768 widths run-001 failed at).
        setScrollY(2300);
        observer.fire([['intro', true], ['scope', true], ['detail', true], ['methods', true]]);
        expect(activeOutlineLabels()).toEqual(['2 Methods']);
      } finally {
        Reflect.deleteProperty(page, 'scrollHeight');
        Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, configurable: true, writable: true });
        setScrollY(originalScrollY);
      }
    });
  });

  it('publishes the measured sticky header height for scroll margins', () => {
    stubFetch();
    const header = document.createElement('header');
    header.setAttribute('data-testid', 'paper-layout-header');
    header.getBoundingClientRect = () => rect(0, 129);
    document.body.appendChild(header);
    const observed: Element[] = [];
    class FakeResizeObserver {
      constructor(readonly callback: () => void) {}
      observe(element: Element) { observed.push(element); }
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      renderWindow();
      expect(screen.getByTestId('workspace-shell').style.getPropertyValue('--paper-sticky-header-height')).toBe('129px');
      expect(observed).toContain(header);
    } finally {
      header.remove();
    }
  });
});

describe('RevisedPaperWorkspace My Review', () => {
  it('R2-03: renders a truthful unavailable state without cohort portions and the portion with them', () => {
    const { rerender } = renderMyReview({}, 'none');
    const unavailable = screen.getByTestId('cohort-portions-unavailable');
    expect(within(unavailable).getByRole('heading', { name: 'Cohort paper portions unavailable' })).toBeInTheDocument();
    expect(within(unavailable).getByRole('status')).toHaveTextContent('My Review shows no paper text');
    expect(within(unavailable).getByRole('link', { name: 'Open the Working Draft' })).toHaveAttribute('href', `${base}?mode=working-draft`);
    expect(screen.queryByTestId('cohort-paper')).toBeNull();
    // FIX CYCLE 1 / F3: restored (was silently dropped from this branch in
    // the original M2 pass; harmless since no pager ever renders in M2 at
    // all, but the closeout's changed-assertion list should not miss any).
    expect(screen.queryByTestId('paper-portion-navigation')).toBeNull();

    rerender(<RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'my-review' })} assignment={getProductionAssignment()} cohortPortions={realPortions()} />);
    expect(screen.queryByTestId('cohort-portions-unavailable')).toBeNull();
    // M2: the selected cohort's portions render STACKED (PLAN-R4 3.B.2), not
    // paginated -- one authenticated portion here, so exactly one cohort-paper
    // section, each followed by its own "Open in Working Draft" canonical link
    // (built from the existing url-state serializer).
    expect(screen.getAllByTestId('cohort-paper')).toHaveLength(1);
    expect(screen.getByTestId('cohort-paper')).toHaveTextContent('Authenticated bounded excerpt.');
    expect(screen.getByRole('link', { name: 'Open in Working Draft' })).toHaveAttribute('href', `${base}?mode=working-draft&section=anchor-categories`);
  });

  it('restores cohort and question from URL state with Review Comments open in the right rail', () => {
    const guide = getReviewerGuideContract();
    const question = guide.questions.find((candidate) => candidate.number === 4);
    const cohort = getCohortManifest().cohorts.find((candidate) => candidate.questionNumbers.includes(4));
    expect(question && cohort).toBeTruthy();
    if (!question || !cohort) return;
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const pushState = vi.spyOn(window.history, 'pushState');
    renderMyReview({ cohort: cohort.id, q: question.id });

    expect(screen.getByRole('link', { name: 'My Review' })).toHaveAttribute('aria-current', 'page');
    const reviewToggle = within(headerHost()).getByRole('button', { name: 'Review Comments' });
    expect(reviewToggle).toHaveAttribute('aria-expanded', 'true');
    expect(reviewToggle).toHaveAttribute('aria-controls', 'paper-review-comments-rail');
    const rail = screen.getByTestId('review-comments-rail');
    expect(rail).toHaveAttribute('data-state', 'open');
    expect(rail).toHaveClass('w-full', 'lg:w-96', 'border-t', 'lg:border-l');
    expect(within(rail).getByRole('heading', { name: 'Review Comments', level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId('paper-document-column').compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const cohortButton = screen.getByRole('button', { name: `${cohort.name}, ${cohort.questionNumbers.length} questions` });
    expect(cohortButton).toHaveAttribute('aria-expanded', 'true');
    expect(cohortButton).not.toHaveAttribute('aria-pressed');
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    expect(select).toHaveValue('4');
    const response = screen.getByTestId('active-question-response');
    expect(response).toHaveTextContent('4\u00d74=16');
    const visibleMath = response.querySelector('.katex-html');
    expect(visibleMath).not.toBeNull();
    expect(visibleMath?.textContent).not.toContain('\\');
    expect(visibleMath?.textContent).not.toContain('$');
    // M2: a real local-buffer-backed textarea now exists (PLAN-R4 3.B.3); the
    // M1 scaffold's "no textbox yet" placeholder is exactly what this unit was
    // commissioned to replace. The honesty bar (no implied server save) is
    // still enforced: no Save/Submit/Resume-labelled control exists anywhere.
    const textarea = screen.getByRole('textbox', { name: 'Your response' });
    expect(textarea).toHaveValue('');
    expect(screen.getByTestId('review-comment-char-count')).toHaveTextContent('0 / 20000');
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Submit response' })).toBeDisabled();
    const otherNumber = cohort.questionNumbers.find((number) => number !== 4) ?? 4;
    const other = guide.questions.find((candidate) => candidate.number === otherNumber);
    fireEvent.change(select, { target: { value: String(otherNumber) } });
    expect(screen.getByTestId('active-question-response')).toHaveFocus();
    // PLAN-R4 6.C: a question change pushes a new history entry (so Back
    // steps between questions) instead of replacing (old M1 behavior: every
    // My Review URL change, including a question change, used replaceState).
    expect(pushState).toHaveBeenLastCalledWith(null, '',`/?mode=my-review&cohort=${cohort.id}&q=${encodeURIComponent(other?.id ?? '')}`);
    expect(replaceState).not.toHaveBeenCalledWith(null, '',`/?mode=my-review&cohort=${cohort.id}&q=${encodeURIComponent(other?.id ?? '')}`);
  });

  it('M2: Next question walks all 12 questions in cohort order, crossing from one cohort to the next', () => {
    renderMyReview();
    const guide = getReviewerGuideContract();
    const manifest = getCohortManifest();
    // categories = [1, 2, 3]; the next cohort in manifest order is pathway-grid = [4, 5].
    expect(manifest.cohorts[0]?.questionNumbers).toEqual([1, 2, 3]);
    const next = within(screen.getByTestId('review-comments-rail')).getByRole('button', { name: 'Next question' });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    const question4 = guide.questions.find((candidate) => candidate.number === 4);
    expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');
    expect(screen.getByTestId('active-question-response')).toHaveTextContent(`Question 4: ${question4?.heading}`);
    // Crossing cohorts also switches the left rail's selected/expanded cohort.
    expect(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' })).toHaveAttribute('aria-expanded', 'true');
  });

  /*
   * FIX CYCLE 1 / F1 (PLAN-R4 6.C "pushState on question change so Back
   * works"). A real Back navigation: the browser restores the prior URL and
   * fires `popstate` with no DOM mutation of its own -- so the test mirrors
   * that exactly (`history.replaceState` to the prior URL, then a real
   * `PopStateEvent`), rather than calling any workspace handler directly.
   */
    it('derives cohort from a section-only popstate', () => {
      const portions = realPortions().map((portion) => ({ ...portion, sectionAnchor: `anchor-${portion.cohortId}` }));
      renderMyReview({ cohort: null, q: null, section: null }, portions);

      act(() => {
        window.history.replaceState(null, '', '/?mode=my-review&section=anchor-pathway-grid');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      expect(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('derives cohort from a section-only initial URL', () => {
      const portions = realPortions().map((portion) => ({ ...portion, sectionAnchor: `anchor-${portion.cohortId}` }));
      renderMyReview({ cohort: null, q: null, section: 'anchor-pathway-grid' }, portions);
      expect(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' })).toHaveAttribute('aria-expanded', 'true');
    });
  describe('M2-POPSTATE: Back restores My Review state via a real popstate event', () => {
    function popTo(url: string) {
      act(() => {
        window.history.replaceState(null, '', url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
    }

    it('M2-POPSTATE: restores the visible question, cohort disclosure, and progress line', () => {
      renderMyReview();
      const guide = getReviewerGuideContract();
      const next = within(screen.getByTestId('review-comments-rail')).getByRole('button', { name: 'Next question' });
      fireEvent.click(next); // -> q2 (pushState)
      const urlAfterQ2 = window.location.pathname + window.location.search;
      fireEvent.click(next); // -> q3 (pushState)
      expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('3');

      popTo(urlAfterQ2);

      expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('2');
      const question2 = guide.questions.find((candidate) => candidate.number === 2);
      expect(screen.getByTestId('active-question-response')).toHaveTextContent(`Question 2: ${question2?.heading}`);
      expect(screen.getByTestId('review-progress')).toHaveTextContent('Question 2 of 12');
      expect(screen.getByRole('button', { name: 'Categories, 3 questions' })).toHaveAttribute('aria-expanded', 'true');
    });

    it('M2-POPSTATE: restores state crossing a cohort boundary, without requesting any reveal or scroll', () => {
      renderMyReview();
      const next = within(screen.getByTestId('review-comments-rail')).getByRole('button', { name: 'Next question' });
      fireEvent.click(next);
      fireEvent.click(next);
      const urlAfterQ3 = window.location.pathname + window.location.search;
      fireEvent.click(next); // -> q4, crosses into pathway-grid
      expect(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' })).toHaveAttribute('aria-expanded', 'true');

      scrollIntoView.mockClear();
      scrollBy.mockClear();
      popTo(urlAfterQ3);

      expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('3');
      expect(screen.getByRole('button', { name: 'Categories, 3 questions' })).toHaveAttribute('aria-expanded', 'true');
      // No reveal/scroll is requested by a Back navigation (popstate is not a
      // scroll-authority activation kind; scroll-authority.ts is unmodified).
      expect(scrollIntoView).not.toHaveBeenCalled();
      expect(scrollBy).not.toHaveBeenCalled();
    });

    it('M2-POPSTATE: moves focus to the response section on Back only when focus was inside Review Comments', () => {
      renderMyReview();
      const next = within(screen.getByTestId('review-comments-rail')).getByRole('button', { name: 'Next question' });
      fireEvent.click(next); // -> q2 (pushState; this is the URL Back returns to below)
      const urlAtQ2 = window.location.pathname + window.location.search;
      fireEvent.click(next); // -> q3
      const select = screen.getByRole('combobox', { name: 'Jump to topic' });
      select.focus();
      expect(select).toHaveFocus();

      popTo(urlAtQ2);
      expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('2');
      expect(screen.getByTestId('active-question-response')).toHaveFocus();
    });

    it('M2-POPSTATE: leaves focus alone on Back when it was outside Review Comments beforehand', () => {
      renderMyReview();
      const next = within(screen.getByTestId('review-comments-rail')).getByRole('button', { name: 'Next question' });
      fireEvent.click(next); // -> q2 (pushState; this is the URL Back returns to below)
      const urlAtQ2 = window.location.pathname + window.location.search;
      fireEvent.click(next); // -> q3
      const cohortButton = screen.getByRole('button', { name: 'Categories, 3 questions' });
      cohortButton.focus();
      expect(cohortButton).toHaveFocus();

      popTo(urlAtQ2);
      expect(screen.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('2');
      expect(cohortButton).toHaveFocus();
      expect(screen.getByTestId('active-question-response')).not.toHaveFocus();
    });

    it('M2-POPSTATE: removes its popstate listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderMyReview();
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    });
  });

  it('closes Review Comments with focus rescue and reveals its heading below lg', () => {
    renderMyReview();
    const toggle = within(headerHost()).getByRole('button', { name: 'Review Comments' });
    const rail = screen.getByTestId('review-comments-rail');
    fireEvent.click(toggle);
    expect(rail).toHaveAttribute('inert');
    expect(rail).toHaveClass('max-h-0', 'border-t-0', 'lg:w-0');
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    const heading = within(rail).getByRole('heading', { name: 'Review Comments', level: 2 });
    expect(heading).toHaveFocus();
    expect(scrolledElements()).toContain(heading);
  });

  it('selects cohorts and portions with heading focus, collapses the selected cohort, and leaves no stale focus', () => {
    const basePortions = realPortions();
    const target = basePortions.find((portion) => portion.cohortId === 'pathway-grid');
    expect(target).toBeTruthy();
    if (!target) return;
    const second = { ...target, id: 'pathway-grid:second', sectionLabel: 'Pathway second portion', text: '# Pathway second portion\n\nSecond authenticated bounded excerpt.' };
    renderMyReview({}, [...basePortions, second]);
    const nav = screen.getByRole('navigation', { name: 'Review cohorts' });
    expect(within(nav).getAllByRole('button', { name: /questions$/ })).toHaveLength(5);

    const categories = within(nav).getByRole('button', { name: 'Categories, 3 questions' });
    expect(categories).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(categories);
    expect(categories).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('cohort-categories-portions')).toHaveAttribute('hidden');
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(within(nav).getByRole('button', { name: 'Pathway and grid, 2 questions' }));
    // M2: pathway-grid now resolves TWO portions (the fixture's base one plus
    // "second"), stacked together (PLAN-R4 3.B.2) -- so cohort selection
    // focuses the FIRST stacked heading, not a single paginated one.
    const stack = screen.getByTestId('cohort-paper-stack');
    expect(within(stack).getAllByTestId('cohort-paper')).toHaveLength(2);
    const firstHeading = within(stack).getAllByRole('heading', { level: 2 })[0];
    expect(firstHeading).toHaveTextContent('Pathway and grid');
    expect(firstHeading).toHaveFocus();
    expect(scrolledElements()).toContain(firstHeading);

    fireEvent.click(within(nav).getByRole('button', { name: 'Pathway second portion' }));
    const secondHeading = within(stack).getByRole('heading', { name: 'Pathway second portion', level: 2 });
    expect(secondHeading).toHaveFocus();
    expect(within(stack).getByText('Second authenticated bounded excerpt.')).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Pathway second portion' })).toHaveAttribute('aria-pressed', 'true');

    // Old (M1 scaffold): a "Paper portion N of M" pager with Previous/Next
    // portion buttons paginated a single visible portion. New (M2): every
    // portion is stacked and visible at once (PLAN-R4 3.B.2 "stacked"), so
    // there is nothing left to page through -- the pager is gone, not hidden.
    expect(screen.queryByRole('button', { name: 'Previous portion' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next portion' })).toBeNull();
    expect(screen.queryByTestId('paper-portion-navigation')).toBeNull();
  });

  it('M1-09: never moves focus into the closed, inert Review Comments rail', () => {
    renderMyReview();
    const toggle = within(headerHost()).getByRole('button', { name: 'Review Comments' });
    fireEvent.click(toggle);
    expect(screen.getByTestId('review-comments-rail')).toHaveAttribute('inert');
    expect(toggle).toHaveFocus();
    const pushState = vi.spyOn(window.history, 'pushState');
    scrollIntoView.mockClear();
    const select = screen.getByRole('combobox', { name: 'Jump to topic' });
    const response = screen.getByTestId('active-question-response');
    fireEvent.change(select, { target: { value: '2' } });
    expect(response).not.toHaveFocus();
    expect(toggle).toHaveFocus();
    expect(scrolledElements()).not.toContain(response);
    // PLAN-R4 6.C: a question change pushes a history entry (old M1 scaffold
    // used replaceState for every My Review URL change; see the "restores
    // cohort and question..." test above for the paired positive assertion).
    expect(pushState).toHaveBeenCalled();

    fireEvent.click(toggle);
    expect(screen.getByTestId('review-comments-rail')).not.toHaveAttribute('inert');
    fireEvent.change(select, { target: { value: '3' } });
    expect(response).toHaveFocus();
  });

  it('M1-09: renders one h1 and demotes portion headings below the portion heading', () => {
    renderMyReview();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('h1')).toHaveTextContent('Review workspace');
    const paper = screen.getByTestId('cohort-paper');
    expect(within(paper).getByRole('heading', { level: 3, name: 'Categories source context' })).toBeInTheDocument();
    expect(within(paper).getAllByRole('heading', { level: 2 })).toHaveLength(1);
  });

  it('M1-07: selects the cohort portion named by a section identity and leaves any other section identity in the URL', () => {
    const portions = realPortions().map((portion) => ({ ...portion, sectionAnchor: `anchor-${portion.cohortId}` }));
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const { unmount } = renderMyReview({ section: 'anchor-pathway-grid' }, portions);
    expect(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByTestId('cohort-paper')).getByRole('heading', { level: 2 })).toHaveTextContent('Pathway and grid');
    expect(replaceState).not.toHaveBeenCalled();
    unmount();

    renderMyReview({ section: 'not-a-portion-anchor' }, portions);
    expect(screen.getByRole('button', { name: 'Categories, 3 questions' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByTestId('cohort-paper')).getByRole('heading', { level: 2 })).toHaveTextContent('Categories');
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('renders an unavailable referenced section without paper bytes', () => {
    const unavailable: CohortPortion = { id: 'categories:section-7.8', cohortId: 'categories', name: 'Categories', status: 'unavailable', sectionNumber: '7.8', sourceLocator: 'Section 7.8', sectionLabel: 'Section 7.8' };
    renderMyReview({}, [unavailable]);
    expect(screen.getByText('Section 7.8 is referenced by this review cohort but is not present as a section in this release.')).toBeInTheDocument();
    expect(screen.getByTestId('cohort-paper')).toHaveTextContent('No paper bytes are attached.');
    // M2: unavailable portions never get an "Open in Working Draft" link (no
    // resolved section anchor to link to) -- truthful, per PLAN-R4 3.B.2.
    expect(screen.queryByRole('link', { name: 'Open in Working Draft' })).toBeNull();
    // FIX CYCLE 1 / F3 + E13: the C1 scaffold rendered this exact case (a
    // single portion, unavailable or not) inside a "Paper portion 1 of 1"
    // pager (data-testid=paper-portion-navigation); M2 stacks portions with
    // no pager at all (PLAN-R4 3.B.2). This assertion is the real C1/M2
    // discriminator for this test (the two previous ones above are true on
    // both C1 and M2 and do not discriminate).
    expect(screen.queryByTestId('paper-portion-navigation')).toBeNull();
  });

  it('keeps trust, local notes, ledgers, and assignment claims truthful', () => {
    renderMyReview();
    expect(within(screen.getByTestId('review-comments-rail')).getByTestId('active-question-response')).toBeInTheDocument();
    expect(screen.queryByTestId('trust-strip')).toBeNull();
    expect(screen.queryByText('Device-local note')).toBeNull();
    expect(screen.queryByText('Review ledger')).toBeNull();
    expect(screen.getByText('Assignment unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Assignments are not connected for this release\./)).toBeInTheDocument();
  });

  it('supplies distinguishable download manifests and switches cohorts, updating the download links dynamically', () => {
    const downloadManifests = {
      'categories': {
        schemaVersion: 'matrix-paper-download-manifest-v1' as const,
        validationState: 'SERVER_VALIDATED' as const,
        status: 'REVIEW_READY_NOT_GREEN' as const,
        releaseIdentity: 'test-release',
        documentVersion: version,
        manifestSha256: 'a'.repeat(64),
        packages: [
          { packageId: 'cat-pdf', kind: 'PDF' as const, label: 'Categories PDF', fileName: 'cat.pdf', path: 'opaque/cat-pdf', href: '/api/matrix-options/paper/downloads/cat-pdf', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 0 },
          { packageId: 'cat-docx', kind: 'DOCX' as const, label: 'Categories DOCX', fileName: 'cat.docx', path: 'opaque/cat-docx', href: '/api/matrix-options/paper/downloads/cat-docx', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 1 }
        ]
      },
      'pathway-grid': {
        schemaVersion: 'matrix-paper-download-manifest-v1' as const,
        validationState: 'SERVER_VALIDATED' as const,
        status: 'REVIEW_READY_NOT_GREEN' as const,
        releaseIdentity: 'test-release',
        documentVersion: version,
        manifestSha256: 'a'.repeat(64),
        packages: [
          { packageId: 'pg-pdf', kind: 'PDF' as const, label: 'Pathway Grid PDF', fileName: 'pg.pdf', path: 'opaque/pg-pdf', href: '/api/matrix-options/paper/downloads/pg-pdf', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 0 },
          { packageId: 'pg-docx', kind: 'DOCX' as const, label: 'Pathway Grid DOCX', fileName: 'pg.docx', path: 'opaque/pg-docx', href: '/api/matrix-options/paper/downloads/pg-docx', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 1 }
        ]
      }
    };
    render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'my-review' })} assignment={getProductionAssignment()} cohortPortions={realPortions()} downloadManifests={downloadManifests} />
    );

    // Initial cohort is Categories. Open download panel.
    const downloadBtn = screen.getByRole('button', { name: 'Download Files' });
    fireEvent.click(downloadBtn);

    // My Review shows EXACTLY the selected cohort's pair - one group, two
    // packages. Controls are buttons now, not anchors: the panel fetches and
    // verifies before writing anything to disk.
    expect(screen.getByTestId('download-button-cat-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('download-button-cat-docx')).toBeInTheDocument();
    expect(screen.getByText('Categories PDF')).toBeInTheDocument();
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ })).toHaveLength(2);

    // Switch to Pathway and grid cohort.
    fireEvent.click(screen.getByRole('button', { name: /Pathway and grid/ }));

    // ONLY the pair shown changes; it is still exactly one cohort's two packages.
    expect(screen.getByTestId('download-button-pg-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('download-button-pg-docx')).toBeInTheDocument();
    expect(screen.getByText('Pathway Grid PDF')).toBeInTheDocument();
    expect(screen.queryByTestId('download-button-cat-pdf')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ })).toHaveLength(2);
  });

  it('P1-A: Working Draft exposes every cohort package pair, not just the first', () => {
    // The pre-fix defect: Working Draft drops the cohort from the URL by rule
    // and has no cohort setter, so the panel always resolved to cohorts[0] and
    // every other cohort's packages were unreachable in the default mode.
    const mk = (cohortId: string, tag: string) => ({
      schemaVersion: 'matrix-paper-download-manifest-v1' as const,
      validationState: 'SERVER_VALIDATED' as const,
      status: 'REVIEW_READY_NOT_GREEN' as const,
      releaseIdentity: 'test-release',
      documentVersion: version,
      manifestSha256: 'a'.repeat(64),
      packages: [
        { packageId: `${tag}-pdf`, kind: 'PDF' as const, label: `${cohortId} PDF`, fileName: `${tag}.pdf`, path: `opaque/${tag}-pdf`, href: `/api/matrix-options/paper/downloads/${tag}-pdf`, sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 0 },
        { packageId: `${tag}-docx`, kind: 'DOCX' as const, label: `${cohortId} DOCX`, fileName: `${tag}.docx`, path: `opaque/${tag}-docx`, href: `/api/matrix-options/paper/downloads/${tag}-docx`, sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 1 },
      ],
    });
    const cohortIds = getCohortManifest().cohorts.map((cohort) => cohort.id);
    const downloadManifests = Object.fromEntries(cohortIds.map((id, index) => [id, mk(id, `c${index}`)]));

    render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'working-draft' })} assignment={getProductionAssignment()} outline={[]} downloadManifests={downloadManifests} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download Files' }));

    // Every cohort is present exactly once, and all ten packages are reachable.
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(cohortIds.length);
    for (const id of cohortIds) expect(screen.getByTestId(`download-cohort-${id}`)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ })).toHaveLength(cohortIds.length * 2);
    cohortIds.forEach((_id, index) => {
      expect(screen.getByTestId(`download-button-c${index}-pdf`)).toBeInTheDocument();
      expect(screen.getByTestId(`download-button-c${index}-docx`)).toBeInTheDocument();
    });
  });

  it('P1-A: Working Draft omits a cohort with no verified manifest rather than faking one', () => {
    const cohortIds = getCohortManifest().cohorts.map((cohort) => cohort.id);
    const only = cohortIds[0];
    const downloadManifests = {
      [only]: {
        schemaVersion: 'matrix-paper-download-manifest-v1' as const,
        validationState: 'SERVER_VALIDATED' as const,
        status: 'REVIEW_READY_NOT_GREEN' as const,
        releaseIdentity: 'test-release',
        documentVersion: version,
        manifestSha256: 'a'.repeat(64),
        packages: [
          { packageId: 'only-pdf', kind: 'PDF' as const, label: 'Only PDF', fileName: 'only.pdf', path: 'opaque/only-pdf', href: '/api/matrix-options/paper/downloads/only-pdf', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 0 },
          { packageId: 'only-docx', kind: 'DOCX' as const, label: 'Only DOCX', fileName: 'only.docx', path: 'opaque/only-docx', href: '/api/matrix-options/paper/downloads/only-docx', sha256: 'b'.repeat(64), byteLength: 100, documentVersion: version, manifestSha256: 'a'.repeat(64), order: 1 },
        ],
      },
    };
    render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'working-draft' })} assignment={getProductionAssignment()} outline={[]} downloadManifests={downloadManifests} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download Files' }));
    expect(screen.getAllByTestId(/^download-cohort-/)).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^Download (PDF|DOCX)$/ })).toHaveLength(2);
  });

  it('P1-A: an entirely absent manifest map still fails closed to pending', () => {
    render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ mode: 'working-draft' })} assignment={getProductionAssignment()} outline={[]} downloadManifests={null} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Download Files' }));
    expect(screen.getByTestId('download-files-pending')).toHaveTextContent('pending server validation');
    expect(screen.queryByRole('button', { name: /^Download (PDF|DOCX)$/ })).not.toBeInTheDocument();
  });
});

/*
 * Sticky-header landing corrections (browser run-002; PLAN-R4 3.A item 4).
 *
 * jsdom has NO layout engine, so nothing here is geometric proof. Every test
 * below stubs the exact rectangles browser run-002 measured and asserts the
 * DECISION the component makes from them. Whether the corrected scroll actually
 * puts the heading below the sticky header in a real engine is browser run-003's
 * measurement, not this file's.
 */
describe('sticky-header reveal and landing corrections (M1R4-02, M1R4-03)', () => {
  /** Makes afterLayoutFrame's two requestAnimationFrame hops run synchronously. */
  function runFramesSynchronously() {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
  }

  /** Publishes a measured sticky header of `height` px, exactly as the layout does. */
  function mountStickyHeader(height: number) {
    const header = document.createElement('header');
    header.setAttribute('data-testid', 'paper-layout-header');
    header.getBoundingClientRect = () => rect(0, height);
    document.body.appendChild(header);
    class FakeResizeObserver {
      constructor(readonly callback: () => void) {}
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    return header;
  }

  function navigationHeading() {
    return within(screen.getByTestId('navigation-rail')).getByRole('heading', { name: 'Navigation', level: 2 });
  }

  it('M1R4-02: the reveal delta is measured from the published sticky header, and is 0 once the heading is on the reading line', () => {
    // Browser run-002 at 360: the rail heading landed at 24 (its p-6 padding)
    // under a 129px header, so the page must scroll UP by 113 to put it on the
    // 137px reading line. The right rail landed at 20 (its p-5 padding).
    expect(panelRevealScrollDelta(24, 129)).toBe(24 - (129 + PAPER_PANEL_REVEAL_GAP_PX));
    expect(panelRevealScrollDelta(24, 129)).toBe(-113);
    expect(panelRevealScrollDelta(20, 129)).toBe(-117);
    // 768: a 77px header puts the reading line at 85.
    expect(panelRevealScrollDelta(24, 77)).toBe(-61);

    // Negative side. Download Files already lands on exactly the reading line at
    // both widths (137 at 360, 85 at 768), so its correction must be a no-op.
    expect(panelRevealScrollDelta(137, 129)).toBe(0);
    expect(panelRevealScrollDelta(85, 77)).toBe(0);
    // The app's own landing tolerance decides, on both sides of the boundary.
    expect(panelRevealScrollDelta(137 + PAPER_LANDING_TOLERANCE_PX, 129)).toBe(0);
    expect(panelRevealScrollDelta(137 + PAPER_LANDING_TOLERANCE_PX + 1, 129)).toBe(PAPER_LANDING_TOLERANCE_PX + 1);
    // A heading below the fold is pulled up to the same line.
    expect(panelRevealScrollDelta(600, 129)).toBe(463);
    // The measured header height must genuinely be read: without it 24 could
    // never produce -113, so this assertion could have failed.
    expect(panelRevealScrollDelta(24, 0)).toBe(16);
    expect(panelRevealScrollDelta(Number.NaN, 129)).toBe(0);
  });

  it('M1R4-02: an opened rail panel heading that the browser left under the sticky header is corrected onto the reading line below lg', () => {
    const header = mountStickyHeader(129);
    try {
      runFramesSynchronously();
      setLgViewport(false);
      renderWorkingDraft();
      expect(screen.getByTestId('workspace-shell').style.getPropertyValue('--paper-sticky-header-height')).toBe('129px');
      const heading = navigationHeading();
      // Browser run-002: the rail's own overflow:hidden clips the scroll-margin
      // box, so scrollIntoView leaves the heading at the rail's padding.
      heading.getBoundingClientRect = () => rect(24, 40);
      const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
      fireEvent.click(toggle);
      scrollBy.mockClear();
      fireEvent.click(toggle);
      expect(heading).toHaveFocus();
      // The existing reveal is kept: the correction is additive, not a rewrite.
      expect(scrolledElements()).toContain(heading);
      expect(scrollBy).toHaveBeenCalledWith(0, -113);
    } finally {
      header.remove();
    }
  });

  it('M1R4-02: a heading the browser already placed on the reading line is not scrolled again', () => {
    const header = mountStickyHeader(129);
    try {
      runFramesSynchronously();
      setLgViewport(false);
      renderWorkingDraft();
      const heading = navigationHeading();
      heading.getBoundingClientRect = () => rect(137, 40);
      const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
      fireEvent.click(toggle);
      scrollBy.mockClear();
      fireEvent.click(toggle);
      expect(heading).toHaveFocus();
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      header.remove();
    }
  });

  /**
   * Replays a MEASURED sequence of heading tops. Every call to
   * getBoundingClientRect consumes the next one and the last one repeats, so a
   * test can drive a heading that is still being carried by a transition.
   */
  function replayHeadingTops(heading: HTMLElement, tops: readonly number[]) {
    let index = 0;
    heading.getBoundingClientRect = () => {
      const top = tops[Math.min(index, tops.length - 1)];
      index += 1;
      return rect(top, 40);
    };
    return { consumed: () => index };
  }

  it('M1R6-01: a rail heading that the 300ms expansion keeps moving is re-corrected once it has come to REST', () => {
    const header = mountStickyHeader(129);
    try {
      runFramesSynchronously();
      setLgViewport(false);
      renderWorkingDraft();
      const heading = navigationHeading();
      /*
       * Browser run-004 section 7.1, the frame-by-frame trace at 360x800 light
       * (identical in shape at 768 and in dark). t=53 scrollIntoView leaves the
       * heading at 0; the correction fires at t=86 and is CORRECT; and then the
       * rail's own transition-all duration-300 carries the heading from 137.78
       * to 161 with the scroll position never changing again, coming to rest at
       * +24 at t=353 -- which is 53 + 300, the exact end of the transition.
       */
      const tops = [0, 137.78, 144.36, 157.08, 161, 161, 161, 161];
      replayHeadingTops(heading, tops);
      const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
      fireEvent.click(toggle);
      scrollBy.mockClear();
      fireEvent.click(toggle);
      expect(heading).toHaveFocus();

      // The round-4 correction is unchanged: it still fires two frames in, off
      // the measured t=53 geometry, and it is still right at that instant.
      expect(scrollBy).toHaveBeenNthCalledWith(1, 0, 0 - (129 + PAPER_PANEL_REVEAL_GAP_PX));
      expect(scrollBy).toHaveBeenNthCalledWith(1, 0, -137);
      // M1R6-01, the fix: the landing is measured AGAIN once the heading has
      // stopped moving, and the 24px the expansion added is taken back. Without
      // the settle loop the reveal ends on the first call and this is the last
      // call, which is exactly how round 5 shipped the defect.
      expect(scrollBy).toHaveBeenCalledTimes(2);
      expect(scrollBy).toHaveBeenLastCalledWith(0, 161 - (129 + PAPER_PANEL_REVEAL_GAP_PX));
      expect(scrollBy).toHaveBeenLastCalledWith(0, 24);
    } finally {
      header.remove();
    }
  });

  it('M1R6-01: a panel with no expansion at all -- Download Files -- settles on its second sample and is never scrolled', () => {
    const header = mountStickyHeader(129);
    try {
      runFramesSynchronously();
      setLgViewport(false);
      renderWorkingDraft();
      // The panel is `hidden` until it is opened, so it is out of the
      // accessibility tree and has to be reached by its own id to be stubbed.
      const heading = document.getElementById('paper-download-files-heading') as HTMLElement;
      expect(heading).not.toBeNull();
      // run-004 section 7.1: Download Files is a `hidden` section with no 300ms
      // expansion, and it landed and STAYED at delta 0 in every trace. A
      // motion-reduce rail behaves the same way -- it never moves either.
      replayHeadingTops(heading, [137]);
      const toggle = within(screen.getByTestId('workspace-header-controls')).getByRole('button', { name: 'Download Files' });
      scrollBy.mockClear();
      fireEvent.click(toggle);
      expect(heading).toHaveFocus();
      // Both the immediate correction and the settled one measure 0, so the
      // settle loop cannot regress a panel that was already correct.
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      header.remove();
    }
  });

  it('M1R6-02: the geometry browser run-004 measured, judged by the repository e2e reading-line rule', () => {
    /*
     * The BEFORE/AFTER arithmetic of the e2e sequence change, pinned in code so
     * it cannot be asserted in a receipt and quietly drift. The repo e2e asserts
     * Math.abs(top - (stickyBottom + PAPER_PANEL_REVEAL_GAP_PX)) <= 2.
     *
     * run-004 section 7.2's discriminator, same build, same session:
     * - sequence A, close and IMMEDIATELY re-open (what the repo e2e did): the
     *   rail is still nearly expanded, the landing rests at 137 and the
     *   assertion computes 0. The assertion CANNOT fail on this sequence.
     * - sequence B, close, let the collapse finish, then open (what a reader
     *   does): the landing rests at 161 and the assertion computes 24.
     */
    const stickyBottom = 129;
    const readingLine = stickyBottom + PAPER_PANEL_REVEAL_GAP_PX;
    expect(readingLine).toBe(137);
    expect(Math.abs(137 - readingLine)).toBe(0);
    expect(Math.abs(161 - readingLine)).toBe(24);
    expect(Math.abs(161 - readingLine)).toBeGreaterThan(PAPER_LANDING_TOLERANCE_PX);
    // Which is the same judgement the component's own predicate makes.
    expect(panelRevealScrollDelta(137, stickyBottom)).toBe(0);
    expect(panelRevealScrollDelta(161, stickyBottom)).toBe(24);
    expect(panelRevealLandingSatisfied({ headingTop: 161, stickyHeaderHeight: stickyBottom, viewportHeight: 800, atMaxScroll: false })).toBe(false);
    expect(panelRevealLandingSatisfied({ headingTop: 137, stickyHeaderHeight: stickyBottom, viewportHeight: 800, atMaxScroll: false })).toBe(true);
  });

  it('M1R4-02: at lg the panel is never revealed and the page is never scrolled', () => {
    const header = mountStickyHeader(129);
    try {
      runFramesSynchronously();
      setLgViewport(true);
      renderWorkingDraft();
      const heading = navigationHeading();
      heading.getBoundingClientRect = () => rect(24, 40);
      const toggle = within(headerHost()).getByRole('button', { name: 'Navigation' });
      fireEvent.click(toggle);
      scrollBy.mockClear();
      fireEvent.click(toggle);
      expect(heading).not.toHaveFocus();
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      header.remove();
    }
  });

  /*
   * M1R4-03. Browser run-002: a deep link into an unloaded section landed 56px
   * (360) and 4px (768) above its reading line and stayed there for the whole
   * 2.5s sample, while an outline click into an unloaded section landed on
   * exactly the same reading line with delta 0. The correction mechanism is
   * sound; it is spent within about three frames of the mount while the prefetch
   * observer keeps loading the sections ABOVE the target for seconds afterwards.
   * A third section exists here purely so a LATER load can be driven.
   */
  const threeSectionOutline: readonly PaperOutlineNavEntry[] = [
    { id: 'n1', anchor: 'intro', label: '1 Introduction', depth: 1, parentId: null, childIds: [] },
    { id: 'n2', anchor: 'methods', label: '2 Methods', depth: 1, parentId: null, childIds: [] },
    { id: 'n3', anchor: 'results', label: '3 Results', depth: 1, parentId: null, childIds: [] },
  ];
  const THREE_SHA = 'c'.repeat(64);
  const threeSectionWindow = {
    paperSha256: THREE_SHA,
    initialIndex: 0,
    sections: [
      { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
      { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
      { index: 2, anchor: 'results', label: '3 Results', bytes: 1200 },
    ],
    linkMap: {},
  };

  function threeSectionContract(index: 1 | 2) {
    const section = threeSectionWindow.sections[index];
    const startByte = index === 1 ? 400 : 1200;
    const endByte = startByte + section.bytes;
    return {
      schema: 'matrix-paper-section-v1',
      documentVersion: version,
      paperSha256: THREE_SHA,
      index,
      sectionCount: 3,
      anchor: section.anchor,
      startByte,
      endByte,
      chunks: [{ id: `node:${section.anchor}`, anchor: section.anchor, depth: 1, label: section.label, startByte, endByte, markdown: `# ${section.label}\n\nBody.` }],
    };
  }

  function renderThreeSectionWindow() {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => threeSectionContract(String(url).includes('/sections/results') ? 2 : 1),
    } as unknown as Response)));
    return render(
      <RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} outline={threeSectionOutline} sectionWindow={threeSectionWindow}>
        <section id="intro" data-paper-chunk="intro" tabIndex={-1} style={{ scrollMarginTop: '137px' }}><h2>1 Introduction body</h2></section>
      </RevisedPaperWorkspace>,
    );
  }

  /** Navigates into the unloaded `methods` section and leaves it pinned and short of its line. */
  async function landMethodsShortOfItsLine() {
    setLgViewport(false);
    runFramesSynchronously();
    renderThreeSectionWindow();
    fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    const target = document.getElementById('methods') as HTMLElement;
    // The state run-002 measured and never recovered from: the target sits above
    // its reading line (137px of scroll margin, rendered top 0).
    target.style.scrollMarginTop = '137px';
    target.getBoundingClientRect = () => rect(0, 100);
    scrollIntoView.mockClear();
    return target;
  }

  it('M1R4-03: re-lands a still-pinned target after a later section load', async () => {
    const target = await landMethodsShortOfItsLine();
    // A LATER section load is exactly what the prefetch observer keeps doing
    // after a deep link, and it changes the height above the pinned target.
    fireEvent.click(within(screen.getByTestId('paper-document')).getByRole('button', { name: 'Load section' }));
    await waitFor(() => expect(document.getElementById('results')).not.toBeNull());
    expect(scrolledElements()).toContain(target);
  });

  it('M1R4-03: stops re-landing once the reader has scrolled, because the pin is released', async () => {
    const target = await landMethodsShortOfItsLine();
    // Any user scroll intent drops the pin (USER_SCROLL_INTENT_EVENTS), after
    // which the reader's own scroll position must never be taken back.
    fireEvent.wheel(window);
    scrollIntoView.mockClear();
    fireEvent.click(within(screen.getByTestId('paper-document')).getByRole('button', { name: 'Load section' }));
    await waitFor(() => expect(document.getElementById('results')).not.toBeNull());
    expect(scrolledElements()).not.toContain(target);
  });
});

/*
 * Fix round 5. Browser run-003 DISPROVED round 4's deep-link fix: the landing
 * measured -56 at 360 and -4 at 768, identical to run-002, with `converged:
 * never` and `settle changes: 0` across 12 seconds, while the SAME loader path
 * reached by an outline click landed delta 0. `diagnostic-landing.json` proved
 * the targets were mid-document and that a manual scroll placed each one on
 * exactly its reading line, so the correction was reachable and simply never
 * applied to the mount journey.
 *
 * Round 4's own unit test drove the CLICK journey (landMethodsShortOfItsLine
 * clicks an outline link), so it certified the fix on the journey that was never
 * broken. These tests drive the MOUNT journey instead.
 *
 * jsdom has no layout engine: these prove the WIRING (which event triggers a
 * re-landing, which target is scrolled, who owns the scrollport), never the
 * pixels. Only browser run-004 can confirm the landing itself.
 */
describe('mount-journey landing, scroll arbitration and the clamp contract (M1R5-01, M1R5-02, M1R5-04)', () => {
  /** A rAF queue the test drives by hand, so a reveal can be caught mid-flight. */
  function controllableFrames() {
    const queue: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      queue.push(callback);
      return queue.length;
    });
    return {
      queued: () => queue.length,
      /** Runs exactly ONE queued frame, so a settle loop can be caught mid-flight. */
      next: () => {
        const callback = queue.shift();
        if (callback === undefined) return false;
        act(() => { callback(0); });
        return true;
      },
      flush: () => {
        let guard = 0;
        while (queue.length > 0 && guard < 50) {
          const callback = queue.shift() as FrameRequestCallback;
          act(() => { callback(0); });
          guard += 1;
        }
      },
    };
  }

  /**
   * A sticky header that can GROW, exactly as the real one does when the
   * panel-controls portal fills `#matrix-options-paper-header-actions` on the
   * second commit (`empty:hidden` in the layout, and below sm the slot takes a
   * full-width line of its own).
   */
  function mountGrowingStickyHeader(initialHeight: number) {
    let height = initialHeight;
    const element = document.createElement('header');
    element.setAttribute('data-testid', 'paper-layout-header');
    element.getBoundingClientRect = () => rect(0, height);
    document.body.appendChild(element);
    const callbacks: (() => void)[] = [];
    class CapturingResizeObserver {
      constructor(callback: () => void) { callbacks.push(callback); }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', CapturingResizeObserver);
    const fire = () => { act(() => { for (const callback of callbacks) callback(); }); };
    return {
      element,
      /** The header grows and the ResizeObserver reports it. */
      growTo: (next: number) => { height = next; fire(); },
      /** The observer fires but the height is unchanged. */
      refireUnchanged: fire,
    };
  }

  const mountOutline: readonly PaperOutlineNavEntry[] = [
    { id: 'm1', anchor: 'intro', label: '1 Introduction', depth: 1, parentId: null, childIds: [] },
    { id: 'm2', anchor: 'methods', label: '2 Methods', depth: 1, parentId: null, childIds: [] },
    { id: 'm3', anchor: 'results', label: '3 Results', depth: 1, parentId: null, childIds: [] },
  ];
  const MOUNT_SHA = 'e'.repeat(64);
  /*
   * The PRODUCTION shape of a `?section=` deep link. page.tsx computes
   * initialIndex = owningSectionIndex(groups, state.section), so the server
   * renders the deep-linked section itself and the client finds it already in
   * the DOM at mount. That is why the mount journey takes navigateToAnchor's
   * SYNCHRONOUS branch while an outline click into an unloaded section takes
   * the asynchronous one.
   */
  const mountSectionWindow = {
    paperSha256: MOUNT_SHA,
    initialIndex: 1,
    sections: [
      { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
      { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
      { index: 2, anchor: 'results', label: '3 Results', bytes: 1200 },
    ],
    linkMap: {},
  };

  /** Re-renders the current mount journey with a new URL `section`; set by renderMountJourney. */
  let rerenderJourney: ((section: string | null) => void) | null = null;

  /** Mounts the workspace at `?section=methods` and returns the deep-link target. */
  function renderMountJourney(scrollMarginTop: string) {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    // Nothing in these tests should fetch a section; a pending promise keeps an
    // accidental request from resolving into unrelated state.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    setLgViewport(false);
    // ONE children element for every render, so a re-render never reconciles the
    // section (and never resets a scroll margin a test has set on it).
    const children = <section id="methods" data-paper-chunk="methods" tabIndex={-1} style={{ scrollMarginTop }}><h2>2 Methods body</h2></section>;
    const tree = (section: string | null) => (
      <RevisedPaperWorkspace documentVersion={version} urlState={state({ section })} assignment={getProductionAssignment()} outline={mountOutline} sectionWindow={mountSectionWindow}>
        {children}
      </RevisedPaperWorkspace>
    );
    const { rerender } = render(tree('methods'));
    rerenderJourney = (section) => rerender(tree(section));
    return document.getElementById('methods') as HTMLElement;
  }

  function timesScrolled(element: HTMLElement): number {
    return scrolledElements().filter((context) => context === element).length;
  }

  function navigationToggle() {
    return within(headerHost()).getByRole('button', { name: 'Navigation' });
  }

  function navigationRailHeading() {
    return within(screen.getByTestId('navigation-rail')).getByRole('heading', { name: 'Navigation', level: 2 });
  }

  function downloadToggle() {
    return within(screen.getByTestId('workspace-header-controls')).getByRole('button', { name: 'Download Files' });
  }

  function downloadHeading() {
    return document.getElementById('paper-download-files-heading') as HTMLElement;
  }

  /*
   * M1R9-02. Re-establishes the section pin with an ordinary outline click on the
   * mount journey's own target -- a real reader flow, and a READER ACTIVATION.
   * Under the scroll authority every activation abandons every reveal an earlier
   * activation started (rule 4), so this is only used where no reveal is meant to
   * stay live. Where a live reveal must survive, use redeliverDeepLink.
   */
  function repinMountTarget() {
    fireEvent.click(within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' }));
  }

  /*
   * SCROLL AUTHORITY MIGRATION -- the ownership instrument.
   *
   * Rounds 5 to 9 observed ownership through `landingCheckAccepted`, which read
   * the fake rAF queue length, and re-pinned with an outline CLICK that the
   * microtask arming boundary happened not to count. Both rested on internals
   * the authority removes: there is no arming boundary any more, so that click
   * now abandons the reveal it was meant to leave alone.
   *
   * This re-delivers the mount journey's deep link as a PROPS change -- a
   * navigation that no reader activation caused, which is exactly the class the
   * reveal must still win against (an S1 response, a data-driven navigation).
   * It reaches navigateToAnchor's synchronous branch, which pins the target,
   * asks the authority to scroll it and requests a landing check. Whether that
   * scroll happened is a public, synchronous observable: no frame has to run,
   * and no queue has to be read.
   */
  function redeliverDeepLink() {
    const rerender = rerenderJourney;
    if (rerender === null) throw new Error('renderMountJourney has not run');
    rerender(null);
    rerender('methods');
  }

  /** Whether a navigation no activation caused may scroll `target` right now; false while a reveal is entitled. */
  function nonActivationNavigationScrolls(target: HTMLElement): boolean {
    scrollIntoView.mockClear();
    redeliverDeepLink();
    return scrolledElements().includes(target);
  }

  /**
   * HOLISTIC_R2 F6. Records the deadline timer each reveal claim starts, so a
   * test can ASSERT that a particular sequence has released: `finish` is the one
   * path that clears a sequence's timer, and a claim starts exactly one.
   */
  function recordRevealTimers() {
    // jsdom returns Node Timeout OBJECTS here, not numbers, so handles are held by identity.
    const created: unknown[] = [];
    const cleared = new Set<unknown>();
    const realSetTimeout = window.setTimeout;
    const realClearTimeout = window.clearTimeout;
    let recording = false;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const handle = realSetTimeout(handler, timeout, ...args) as unknown;
      if (recording && timeout === PAPER_REVEAL_SETTLE_TIMEOUT_MS) created.push(handle);
      return handle;
    }) as unknown as typeof window.setTimeout;
    window.clearTimeout = ((handle?: unknown) => {
      if (handle !== undefined) cleared.add(handle);
      realClearTimeout(handle as number);
    }) as unknown as typeof window.clearTimeout;
    return {
      /** Runs `open` and returns the single reveal timer it started. */
      during: (open: () => void): unknown => {
        const before = created.length;
        recording = true;
        try {
          open();
        } finally {
          recording = false;
        }
        const started = created.slice(before);
        expect(started).toHaveLength(1);
        return started[0];
      },
      cleared: (handle: unknown) => cleared.has(handle),
      stop: () => {
        window.setTimeout = realSetTimeout;
        window.clearTimeout = realClearTimeout;
      },
    };
  }

  /** Runs queued frames ONE at a time until `reached()` holds, so a test positions itself by what it observed rather than by counting hops. */
  function runFramesUntil(frames: ReturnType<typeof controllableFrames>, reached: () => boolean): boolean {
    let guard = 0;
    while (!reached() && guard < 80 && frames.next()) guard += 1;
    return reached();
  }

  it('M1R5-01: re-lands a still-pinned deep link when the sticky header grows under it', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      // Under the COLLAPSED header the landing is right: 73 + the 0.5rem the
      // scroll-margin utility adds. There is nothing to correct yet, which is
      // exactly why the mount scroll looks successful and then goes stale.
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      expect(target).toHaveFocus();
      scrollIntoView.mockClear();

      // The portal fills the actions slot, the header grows, and every scroll
      // margin moves with it while the reader does not.
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();

      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R5-01: does not re-land when the sticky header reports the SAME height', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();

      // A resize callback that does not change the published height must not
      // move the reader: the trigger is a CHANGE, not any observer callback.
      target.style.scrollMarginTop = '137px';
      sticky.refireUnchanged();
      frames.flush();

      expect(scrolledElements()).not.toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R5-01: stops re-landing on a header resize once the reader has scrolled', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      // Any user scroll intent drops the pin, after which the reader's own
      // position must never be taken back, however the header behaves.
      fireEvent.wheel(window);
      scrollIntoView.mockClear();

      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();

      expect(scrolledElements()).not.toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /*
   * These two mount WITHOUT a sticky header on purpose. With no
   * `paper-layout-header` in the DOM the published height stays 0 and the
   * header-resize re-landing can never fire, so the ONLY thing that can verify
   * the landing is navigateToAnchor's synchronous branch. A first draft of this
   * pair did mount a header, and the mutant that strips the synchronous check
   * SURVIVED: the resize effect was correcting the landing anyway and the
   * assertion could not see its own bug.
   */
  it('M1R5-01: a deep link whose section the server already rendered verifies its own landing', () => {
    const frames = controllableFrames();
    // jsdom reports a zero rect, so the target is 137px short of its line.
    const target = renderMountJourney('137px');
    frames.flush();
    expect(document.querySelector('[data-testid="paper-layout-header"]')).toBeNull();
    expect(screen.getByTestId('workspace-shell').style.getPropertyValue('--paper-sticky-header-height')).toBe('');
    // focusSection scrolled once; the landing check found it short and scrolled
    // again. The synchronous branch never checked before this round.
    expect(timesScrolled(target)).toBeGreaterThan(1);
  });

  it('M1R5-01: and does not scroll that landing again once it is on the reading line', () => {
    const frames = controllableFrames();
    const target = renderMountJourney('137px');
    target.getBoundingClientRect = () => rect(137, 100);
    frames.flush();
    expect(timesScrolled(target)).toBe(1);
  });

  it('M1R5-02: a reveal in flight owns the scrollport, so a pinned re-landing does not fight it', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      // Open Navigation. The reveal claims the scrollport now and holds it
      // until its measured correction runs; its frames are NOT flushed yet.
      const toggle = navigationToggle();
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      navigationRailHeading().getBoundingClientRect = () => rect(24, 40);
      // The toggle dropped the pin (M1R9-02). Put it back with a navigation no
      // activation caused, so nothing abandons the reveal under test.
      redeliverDeepLink();
      expect(scrolledElements()).not.toContain(target);

      // A header resize now asks for the pinned deep link to be re-landed.
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();

      // The reveal won: its heading was corrected onto the reading line and the
      // pinned target was left exactly where it was.
      expect(scrollBy).toHaveBeenCalledWith(0, -113);
      expect(scrolledElements()).not.toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R5-02: a completed reveal releases the scrollport, so a later re-landing runs', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();

      const toggle = navigationToggle();
      fireEvent.click(toggle);
      fireEvent.click(toggle);
      navigationRailHeading().getBoundingClientRect = () => rect(24, 40);
      redeliverDeepLink();
      // This time the reveal is allowed to finish before anything else asks.
      frames.flush();
      expect(scrollBy).toHaveBeenCalledWith(0, -57);
      scrollIntoView.mockClear();

      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();

      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /** Opens the Navigation rail from its default-open state (close, then open). */
  function reopenNavigation() {
    const toggle = navigationToggle();
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    return navigationRailHeading();
  }

  it('M1R6-03: a landing check dropped by a reveal is not re-queued when the reveal releases, and the next genuine trigger still repairs it', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();

      // A reveal claims the scrollport, and a header resize asks for the pinned
      // deep link to be re-landed while it is held. That request is DROPPED.
      reopenNavigation().getBoundingClientRect = () => rect(24, 40);
      redeliverDeepLink();
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      /*
       * The reveal releases on its DEADLINE before a single frame runs, so if the
       * request had been queued rather than dropped at request time, its frames
       * would now find the scrollport free and scroll. This isolates the
       * request-time drop from the per-attempt guard, which would otherwise
       * stand the same check down while the reveal was still settling.
       */
      await waitPastDeadline();
      frames.flush();

      /*
       * M1R6-03, the DECISION (codex r5-luna-1 R5-02-A). The reveal has now
       * finished and released the scrollport, and the dropped check is NOT
       * re-queued: the reader stays on the panel they opened rather than being
       * scrolled away from it the instant it finishes opening. run-004 section
       * 8.2 measured what re-landing does here -- the panel heading goes from
       * 137 to -214,124.
       */
      expect(scrolledElements()).not.toContain(target);

      // The other half of the decision, which is what makes the drop safe: the
      // pin survives, so the NEXT genuine trigger still repairs the landing.
      // Without this the drop would be a permanent loss rather than a deferral.
      sticky.growTo(145);
      frames.flush();
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /** A heading whose geometry throws on the `throwOnCall`-th measurement. */
  function throwOnNthMeasurement(heading: HTMLElement, throwOnCall: number) {
    let calls = 0;
    heading.getBoundingClientRect = () => {
      calls += 1;
      if (calls === throwOnCall) throw new Error(`measurement ${throwOnCall} failed`);
      return rect(24 + calls, 40);
    };
  }

  it('M1R6-04: a throw inside the guarded reveal sequence still releases the scrollport, so later landing checks run', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();

      // The deferred measurement is one of the four operations codex named as
      // unguarded. Make the FIRST one throw, which is the entry into the
      // corrective sequence, before any settle frame has been scheduled.
      const heading = reopenNavigation();
      redeliverDeepLink();
      throwOnNthMeasurement(heading, 1);
      expect(() => frames.flush()).toThrow('measurement 1 failed');

      // Before M1R6-04 the owner stayed 'reveal' for the life of the component
      // and every later landing check returned at its first guard, forever.
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R6-04: a throw while the SETTLE LOOP is running also releases the scrollport', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();

      // Measurement 1 is the immediate correction, 2 is the first settle
      // sample, 3 throws mid-loop.
      const heading = reopenNavigation();
      redeliverDeepLink();
      throwOnNthMeasurement(heading, 3);
      expect(() => frames.flush()).toThrow('measurement 3 failed');

      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      frames.flush();
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /*
   * M1R6-04, what is NOT asserted here and why. The reveal's SYNCHRONOUS half
   * (the heading scroll and focus) is guarded by its own `finally` in the
   * authority, but that guard is not observable from a component test: a throw
   * in a React 19 passive effect tears the tree down. It is covered directly in
   * scroll-authority.test.ts, where no React tree is involved.
   */
  it('M1R6-01: a reader who scrolls during the settle abandons it, and the reveal never takes their scroll back', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      scrollBy.mockClear();

      const heading = reopenNavigation();
      let top = 0;
      heading.getBoundingClientRect = () => rect(top, 40);
      // Run until the immediate correction has been applied -- observed, not counted in frames.
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenCalledWith(0, -137);

      // The expansion is still carrying the heading, and the reader scrolls.
      top = 161;
      fireEvent.wheel(window);
      frames.flush();

      // The settled correction is abandoned: holding the scrollport for the
      // whole transition must not mean overriding a reader who used it.
      expect(scrollBy).toHaveBeenCalledTimes(1);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R6-01: a heading that never stops moving is still corrected and still gives the scrollport back', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      // A transition that never ends (or a heading that jitters forever): the
      // settle loop must be bounded, not merely usually bounded.
      const heading = reopenNavigation();
      redeliverDeepLink();
      let top = 24;
      heading.getBoundingClientRect = () => {
        top += 1;
        return rect(top, 40);
      };
      // The loop runs to PAPER_REVEAL_SETTLE_MAX_FRAMES, which is more frames
      // than one flush drains, so this drains until the queue is genuinely empty.
      drainFrames(frames);
      expect(frames.queued()).toBe(0);
      expect(scrollBy.mock.calls.length).toBeGreaterThanOrEqual(2);

      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /** Runs queued frames until the queue is genuinely empty, not merely once-flushed. */
  function drainFrames(frames: ReturnType<typeof controllableFrames>) {
    let rounds = 0;
    while (frames.queued() > 0 && rounds < 10) {
      frames.flush();
      rounds += 1;
    }
  }

  it('M1R7-01: a reveal whose animation frames never arrive still gives the scrollport back on its deadline', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      /*
       * The reveal claims the scrollport and then NO frame is ever run again.
       * That is what a background tab does: rAF is suspended entirely, so round
       * 6's `nowMs() >= deadline` -- evaluated only INSIDE a frame callback --
       * was unreachable and the advertised 600ms bound never arrived.
       */
      reopenNavigation().getBoundingClientRect = () => rect(24, 40);
      target.style.scrollMarginTop = '137px';
      // Owned, and observed without running a frame.
      expect(nonActivationNavigationScrolls(target)).toBe(false);

      // The deadline is a real timer on the real clock, so this waits for it
      // rather than mocking the mechanism under test into existence.
      await new Promise((resolve) => { window.setTimeout(resolve, PAPER_REVEAL_SETTLE_TIMEOUT_MS + 150); });

      // Ownership came back with not one frame having run. Before M1R7-01 it
      // stayed blocked indefinitely.
      expect(nonActivationNavigationScrolls(target)).toBe(true);
      // And the reveal, resumed after its deadline, corrects nothing: the
      // scrollport is no longer its to move.
      drainFrames(frames);
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R7-02: a reader who scrolls during the two-frame delay is not corrected when the delay ends', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      // The reveal owns the scrollport, but its two-frame layout wait has not
      // run yet. Round 6 was deaf to the reader during those two frames.
      reopenNavigation().getBoundingClientRect = () => rect(24, 40);
      expect(nonActivationNavigationScrolls(target)).toBe(false);
      fireEvent.wheel(window);
      drainFrames(frames);

      // Neither correction happened: not the immediate one the settle entry
      // applies, and not a settled one.
      expect(scrollBy).not.toHaveBeenCalled();

      // And the scrollport was handed back rather than held to the deadline.
      expect(nonActivationNavigationScrolls(target)).toBe(true);

      // Positive control, in this same test: the identical reveal WITHOUT the
      // reader's scroll still corrects. Without this the assertion above would
      // pass just as readily against a reveal that had stopped working.
      drainFrames(frames);
      scrollBy.mockClear();
      reopenNavigation().getBoundingClientRect = () => rect(24, 40);
      drainFrames(frames);
      expect(scrollBy).toHaveBeenCalledWith(0, 24 - (73 + PAPER_PANEL_REVEAL_GAP_PX));
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R7-03 (AMENDED, scroll authority rule 4): a later activation abandons the earlier reveal, and the earlier reveal releasing does not free the later one still correcting', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      /*
       * HOLISTIC_R2 F6. "A has released" used to be INFERRED from the order the
       * fake frame queue happens to run in, in a comment. It is now MEASURED:
       * each reveal claim starts exactly one deadline timer, so the handles
       * recorded while each panel opens identify that sequence's timer, and
       * `finish` -- the only release path -- is the only thing that clears it.
       */
      const timers = recordRevealTimers();
      try {
        // Sequence A: Download Files. A heading at 0 is corrected by -137, which
        // no other sequence here can produce.
        const aTimer = timers.during(() => { fireEvent.click(downloadToggle()); });
        downloadHeading().getBoundingClientRect = () => rect(0, 40);
        const aDelta = expectedDelta(0, 129);

        // Sequence B: Navigation, opened by LATER distinct activations, with a
        // heading that never stops moving, so it is still correcting long after A.
        let navigationHeading: HTMLElement | null = null;
        const bTimer = timers.during(() => { navigationHeading = reopenNavigation(); });
        let top = 400;
        (navigationHeading as unknown as HTMLElement).getBoundingClientRect = () => {
          top += 1;
          return rect(top, 40);
        };

        // Run until B has applied its first correction.
        expect(runFramesUntil(frames, () => scrollBy.mock.calls.some(([, delta]) => delta !== aDelta))).toBe(true);
        expect(frames.queued()).toBeGreaterThan(0);

        // CONTRACT CHANGE (declared in the migration receipt). Round 7-9 required
        // BOTH reveals to correct. Under rule 4 B's activation abandoned A, so A
        // corrects nothing.
        expect(scrollBy.mock.calls.filter(([, delta]) => delta === aDelta)).toHaveLength(0);

        // THE PRECONDITION, asserted rather than inferred: A HAS released, and B
        // has NOT. Without this pair the assertion below could pass with A still
        // live, testing nothing about a release.
        expect({ aReleased: timers.cleared(aTimer), bReleased: timers.cleared(bTimer) }).toEqual({ aReleased: true, bReleased: false });

        // THE PRESERVED PROPERTY: A's release did not release B, so the scrollport
        // is still owned.
        expect(nonActivationNavigationScrolls(target)).toBe(false);
      } finally {
        timers.stop();
      }

      // B finishes and the scrollport is genuinely free, which is what makes the
      // assertion above a measurement rather than a tautology.
      drainFrames(frames);
      expect(nonActivationNavigationScrolls(target)).toBe(true);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R7-04: unmounting mid-settle stops the frame chain, so nothing scrolls the route that replaced it', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      scrollBy.mockClear();

      // Run until the immediate correction, leaving the settle loop with frames queued.
      const heading = reopenNavigation();
      heading.getBoundingClientRect = () => rect(24, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenCalledWith(0, -113);
      expect(frames.queued()).toBeGreaterThan(0);

      // The reader leaves for another route or mode. The settle loop still has
      // up to 600ms of frames left and a heading about to look settled.
      scrollBy.mockClear();
      cleanup();
      drainFrames(frames);

      // Before M1R7-04 the settled correction ran here and called
      // window.scrollBy in whatever route had replaced this one.
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      sticky.element.remove();
    }
  });

  /*
   * FIX ROUND 8 (the informed Opus holistic pass). Every mutant is SINGLE-TERM,
   * and every test below carries its positive control inside the same test,
   * because an assertion that has never been seen to fail is not a guard.
   */

  /** The delta panelRevealScrollDelta asks for, restated as the test's own arithmetic. */
  function expectedDelta(headingTop: number, stickyHeaderHeight: number): number {
    return headingTop - (stickyHeaderHeight + PAPER_PANEL_REVEAL_GAP_PX);
  }

  /** Waits past the sequence's own ownership deadline on the REAL clock. */
  async function waitPastDeadline(): Promise<void> {
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, PAPER_REVEAL_SETTLE_TIMEOUT_MS + 150); }); });
  }

  /** Fires the hashchange handler, which reaches focusSection through navigateRef. */
  function hashNavigate(anchor: string) {
    // replaceState rather than assigning location.hash: jsdom implements no
    // navigation, and updateUrl rewrites the URL without the fragment anyway.
    window.history.replaceState(null, '', `#${anchor}`);
    act(() => { window.dispatchEvent(new Event('hashchange')); });
  }

  it('M1R8-01: a navigation no reader activation caused does not scroll during a live reveal but still applies its identity, and the same navigation outside one scrolls', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();

      // A reveal claims the scrollport and its settle loop is left mid-flight.
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      expect(frames.queued()).toBeGreaterThan(0);
      expect(target).not.toHaveFocus();

      /*
       * The navigation resolves with no reader activation between the panel
       * opening and it -- the class an S1 response belongs to (MIG-S1 below
       * drives that path itself). Round 7 scrolled the page mid-settle.
       */
      expect(nonActivationNavigationScrolls(target)).toBe(false);
      // The navigation still took effect as IDENTITY: it pinned, focused and
      // selected the section. Only the scroll was yielded.
      expect(target).toHaveFocus();
      expect(activeOutlineLabels()).toContain('2 Methods');

      // POSITIVE CONTROL, in this same test: the identical navigation once the
      // reveal has released DOES scroll.
      drainFrames(frames);
      expect(nonActivationNavigationScrolls(target)).toBe(true);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R8-02: the deadline applies the settled correction for a heading that never rests, and applies none once abandoned', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      scrollBy.mockClear();

      /*
       * The production exit for a heading that never settles is
       * timer -> onDeadline -> correct(). This runs a LIVE settle loop on a
       * moving heading, positioned by the measurements it has observed, and
       * then lets the sequence's own timer fire on the real clock.
       */
      const heading = reopenNavigation();
      let top = 400;
      let measured = 0;
      heading.getBoundingClientRect = () => {
        measured += 1;
        return rect(top, 40);
      };
      expect(runFramesUntil(frames, () => measured >= 1)).toBe(true);
      top = 420;
      expect(runFramesUntil(frames, () => measured >= 2)).toBe(true);
      top = 440;
      expect(runFramesUntil(frames, () => measured >= 3)).toBe(true);
      // The loop is alive and unsettled, and no frame will run again.
      const queuedBeforeDeadline = frames.queued();
      expect(queuedBeforeDeadline).toBeGreaterThan(0);

      top = 500;
      scrollBy.mockClear();
      await waitPastDeadline();

      // Not one frame ran, so the timer is the only thing that can have scrolled.
      expect(frames.queued()).toBe(queuedBeforeDeadline);
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenCalledWith(0, expectedDelta(500, 129));

      /*
       * POSITIVE CONTROL, in this same test: the identical deadline on a
       * sequence the reader has abandoned applies NO correction.
       */
      drainFrames(frames);
      const controlHeading = reopenNavigation();
      let controlTop = 300;
      let controlMeasured = 0;
      controlHeading.getBoundingClientRect = () => {
        controlMeasured += 1;
        return rect(controlTop, 40);
      };
      expect(runFramesUntil(frames, () => controlMeasured >= 1)).toBe(true);
      fireEvent.wheel(window);
      controlTop = 700;
      scrollBy.mockClear();
      await waitPastDeadline();
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R8-03: a deadline reached in a hidden tab releases ownership without scrolling, and the same deadline in a visible tab corrects', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    const setVisibility = (value: string) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
    };
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollBy.mockClear();

      setVisibility('hidden');
      const hidden = reopenNavigation();
      let hiddenTop = 400;
      hidden.getBoundingClientRect = () => rect(hiddenTop, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      hiddenTop = 500;
      scrollBy.mockClear();
      await waitPastDeadline();

      expect(scrollBy).not.toHaveBeenCalled();
      // Ownership is released EITHER WAY: skipping the correction must not also
      // strand the scrollport, which would block every later scroll.
      expect(nonActivationNavigationScrolls(target)).toBe(true);
      drainFrames(frames);

      /*
       * POSITIVE CONTROL, in this same test: the identical sequence with the tab
       * VISIBLE does correct, by the measured delta.
       */
      setVisibility('visible');
      const visible = reopenNavigation();
      let visibleTop = 400;
      visible.getBoundingClientRect = () => rect(visibleTop, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      visibleTop = 500;
      scrollBy.mockClear();
      await waitPastDeadline();
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenCalledWith(0, expectedDelta(500, 129));
    } finally {
      Reflect.deleteProperty(document, 'visibilityState');
      sticky.element.remove();
    }
  });

  it('M1R8-04: an assistive-technology click abandons a live reveal, a sequence never abandons itself, and the pointer path still corrects', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      scrollBy.mockClear();

      /*
       * PHASE 1, the self-abandon question: the bare clicks that open this panel
       * must not abandon the sequence they start. There is no arming boundary to
       * wait for any more -- the observer is installed on mount and the causing
       * activation's own id never supersedes itself (rule 4, j > k).
       */
      const navigation = reopenNavigation();
      navigation.getBoundingClientRect = () => rect(400, 40);
      frames.flush();
      const navigationDelta = expectedDelta(400, 129);
      expect(scrollBy.mock.calls.filter(([, delta]) => delta === navigationDelta).length).toBeGreaterThanOrEqual(2);

      /*
       * PHASE 2. A live reveal, and then an AT-style activation of a DIFFERENT
       * panel: HTMLElement.click() dispatches a click and no pointer event.
       */
      scrollBy.mockClear();
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      expect(scrollBy).toHaveBeenCalledWith(0, navigationDelta);

      downloadHeading().getBoundingClientRect = () => rect(200, 40);
      scrollBy.mockClear();
      act(() => { downloadToggle().click(); });
      drainFrames(frames);

      // The first reveal abandoned: no further correction of ITS heading.
      expect(scrollBy).not.toHaveBeenCalledWith(0, navigationDelta);
      // Positive control, in this same test: the second panel's own reveal DID
      // correct during that same drain, so scrollBy was live and the frames ran.
      expect(scrollBy).toHaveBeenCalledWith(0, expectedDelta(200, 129));

      /*
       * PHASE 2b (added in the HOLISTIC_R2 correction round). A bare click that
       * opens NOTHING must abandon a live reveal too. Phase 2's click opens a
       * panel, and a panel open supersedes an earlier reveal through its own
       * request identity even if `click` were not observed at all, so without
       * this arm the click-observation property had only one observer
       * (M1R9-01). "Load section" is a bare click that starts no reveal and
       * keeps the pin.
       */
      drainFrames(frames);
      scrollBy.mockClear();
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      expect(scrollBy).toHaveBeenCalledWith(0, navigationDelta);
      scrollBy.mockClear();
      act(() => { screen.getAllByRole('button', { name: 'Load section' })[0].click(); });
      drainFrames(frames);
      expect(scrollBy).not.toHaveBeenCalledWith(0, navigationDelta);

      /*
       * PHASE 3. The ordinary pointer path is untouched and still corrects by
       * the exact measured delta.
       */
      drainFrames(frames);
      scrollBy.mockClear();
      const toggle = navigationToggle();
      fireEvent.mouseDown(toggle);
      fireEvent.click(toggle);
      fireEvent.mouseDown(toggle);
      fireEvent.click(toggle);
      navigationRailHeading().getBoundingClientRect = () => rect(300, 40);
      drainFrames(frames);
      expect(scrollBy).toHaveBeenCalledWith(0, expectedDelta(300, 129));
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R8-05 (AMENDED, scroll authority rule 4): of two reveals opened in one task the later activation wins, and once it finishes nothing still owns the scrollport', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();
      scrollBy.mockClear();

      /*
       * Sequence A, OLDER: Navigation, a heading that never stops moving.
       * Sequence B, NEWER: Download Files, stable on its second sample. Its
       * correction is -137, which A cannot produce. Both opened inside ONE task.
       *
       * CONTRACT CHANGE (declared in the migration receipt). Rounds 8-9 required
       * A to keep correcting, and so to keep owning the scrollport, after B
       * finished. Under rule 4 B's activation abandoned A the moment it was
       * dispatched. Browser run-006 measured that no real activation can produce
       * two live reveals from one task; the preserved ownership property -- a
       * newer sequence finishing never releases an OLDER one that is still
       * entitled -- is exercised directly in scroll-authority.test.ts, where two
       * sequences can share one cause.
       */
      const navigationHeading = reopenNavigation();
      let top = 400;
      navigationHeading.getBoundingClientRect = () => {
        top += 1;
        return rect(top, 40);
      };
      fireEvent.click(downloadToggle());
      downloadHeading().getBoundingClientRect = () => rect(0, 40);
      const bDelta = expectedDelta(0, 129);
      const bCorrections = () => scrollBy.mock.calls.filter(([, delta]) => delta === bDelta).length;

      // B is live and correcting: the scrollport is owned (two-sided with the end).
      expect(runFramesUntil(frames, () => bCorrections() >= 1)).toBe(true);
      expect(nonActivationNavigationScrolls(target)).toBe(false);

      expect(runFramesUntil(frames, () => bCorrections() >= 2)).toBe(true);
      // A, abandoned by B's activation, never corrected.
      expect(scrollBy.mock.calls.filter(([, delta]) => delta !== bDelta)).toHaveLength(0);
      // B has finished and released, and A is not entitled: nothing owns it.
      expect(nonActivationNavigationScrolls(target)).toBe(true);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R8-05: a landing check already in flight stands down when a reveal claims the scrollport before it measures', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(0, 100);
      frames.flush();
      scrollIntoView.mockClear();

      /*
       * POSITIVE CONTROL FIRST, from the identical state: an in-flight landing
       * check with nothing claiming the scrollport DOES scroll the target. So a
       * request made in this state is accepted and does need correcting.
       */
      target.style.scrollMarginTop = '137px';
      sticky.growTo(137);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);

      // The identical request from the identical state; NOW a reveal claims the
      // scrollport before the check has measured anything.
      scrollIntoView.mockClear();
      sticky.growTo(145);
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      // The toggle dropped the pin. Restore it without an activation, so what
      // stops the in-flight check is OWNERSHIP at the per-attempt guard and not
      // the pin guard.
      redeliverDeepLink();
      expect(scrolledElements()).not.toContain(target);
      drainFrames(frames);
      expect(scrolledElements()).not.toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /** The outline entry for the mount journey's own deep-link target. */
  function mountOutlineLink() {
    return within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '2 Methods' });
  }

  it('M1R9-01: an abandoned reveal stops owning the scrollport, so the same click that abandoned it lands', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(0, 100);
      frames.flush();

      /*
       * POSITIVE CONTROL, in this same test: during the same live reveal, a
       * navigation no activation caused is still SUPPRESSED (M1R8-01).
       */
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      expect(nonActivationNavigationScrolls(target)).toBe(false);

      /*
       * M1R9-01. The IDENTICAL navigation as a bare click: the click abandons
       * the reveal in its capture phase and then, in the same dispatch, reaches
       * focusSection, which is entitled to scroll because abandonment revoked the
       * reveal's entitlement immediately.
       */
      scrollIntoView.mockClear();
      fireEvent.click(mountOutlineLink());
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R9-02: a bare rail-toggle click drops the section pin, and a bare Load section click does not', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();
      scrollIntoView.mockClear();

      /*
       * CONTROL: a "Load section" press is also a bare click, and it must NOT
       * drop the pin. M1R4-03 (re-lands a still-pinned target after a later
       * section load) is exactly this behaviour.
       */
      act(() => { screen.getAllByRole('button', { name: 'Load section' })[0].click(); });
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);

      /*
       * M1R9-02. A bare rail-toggle click drops the pin. The reveal it starts is
       * drained first, so what stops the landing check below is the missing PIN
       * and not ownership still being held.
       */
      act(() => { navigationToggle().click(); });
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '213px';
      sticky.growTo(161);
      drainFrames(frames);
      expect(scrolledElements()).not.toContain(target);

      /*
       * SECOND CONTROL, in this same test: re-pin and drive the identical
       * trigger. It scrolls again.
       */
      repinMountTarget();
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '289px';
      sticky.growTo(193);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  /*
   * ==========================================================================
   * SCROLL AUTHORITY MIGRATION (AMENDMENT-M1-SCROLL-AUTHORITY-001).
   * Rule 3.2 -- causal activation identity -- and the section 4.2 fixes. Every
   * test is two-sided with its control inside the same test.
   * ==========================================================================
   */

  /*
   * HOLISTIC_R2 F2 - what this test's recorded order IS and IS NOT.
   *
   * It measures the jsdom + `act()` ordering: `act` flushes the discrete update
   * (and so the claim) when the act scope ends, BEFORE the queued microtask
   * runs. In production React 19.1 the discrete update is flushed from a
   * microtask that is queued AFTER the hook's, so the real browser order is
   * hook-queued, queued-click-ran, claim: the queued click is observed BEFORE
   * the claim, and the reveal is resolved by the pending-reveal overwrite (the
   * queued click's own `openPanel` replaces the request) or, if it is not a
   * panel open, by the claim-time evaluation of rule 4.
   *
   * That production ordering is driven by 'MIG-3.2.4 claim time' and
   * 'MIG-3.2.1 observer on mount', which dispatch the later activation before
   * the claim and assert the measured order. This test drives the THIRD path -
   * abandonment when the activation is observed while the sequence is already
   * live - and shows that the queued click is delivered before the point at
   * which round 9 would first have had a click listener. In every one of the
   * three orderings exactly one sequence is entitled.
   */
  it('MIG-3.2 r9-sol-1 (jsdom/act ordering; see the comment above for the production order): a bare click an extension capture hook queues during the opening activation abandons the reveal that activation starts, and it ran before round 9 could have armed its listener', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    let hookArmed = false;
    const order: string[] = [];
    const hook = () => {
      if (!hookArmed) return;
      hookArmed = false;
      order.push('hook-queued');
      // An extension capture hook: a microtask that clicks a DIFFERENT toggle,
      // queued ahead of everything the opening activation's effects queue.
      window.queueMicrotask(() => {
        order.push('queued-click-ran');
        downloadToggle().click();
      });
    };
    window.addEventListener('click', hook, { capture: true });
    try {
      renderMountJourney('137px');
      frames.flush();
      const navigation = navigationRailHeading();
      fireEvent.click(navigationToggle());
      drainFrames(frames);
      navigation.getBoundingClientRect = () => rect(400, 40);
      const navigationDelta = expectedDelta(400, 129);
      downloadHeading().getBoundingClientRect = () => rect(200, 40);
      const downloadDelta = expectedDelta(200, 129);

      /*
       * The instrument that makes the ORDER a measurement. The reveal scrolls its
       * heading immediately after it claims; the round-9 code queued its click
       * arming microtask in that same synchronous run, just before. A microtask
       * queued from here therefore runs no earlier than the old arming did.
       */
      scrollIntoView.mockImplementation(function recordClaim(this: unknown) {
        if (this !== navigation) return;
        order.push('claim');
        window.queueMicrotask(() => { order.push('old-arming-point'); });
      });

      scrollBy.mockClear();
      hookArmed = true;
      act(() => { navigationToggle().click(); });
      await act(async () => { await Promise.resolve(); });

      /*
       * In THIS harness the queued click was queued BEFORE the claim, ran AFTER
       * the claim (so a sequence existed to abandon), and ran BEFORE the point
       * where round 9 would first have had a click listener. M1R9-03 could not
       * construct that at all. Production reorders the first two - see the
       * comment on this test - and the rule holds either way.
       */
      expect(order).toEqual(['hook-queued', 'claim', 'queued-click-ran', 'old-arming-point']);
      drainFrames(frames);
      expect(scrollBy).not.toHaveBeenCalledWith(0, navigationDelta);
      // The queued click's own reveal is the later activation's, and corrects.
      expect(scrollBy).toHaveBeenCalledWith(0, downloadDelta);

      /*
       * CONTROL, in this same test: the identical opening with NO queued click
       * settles and corrects.
       */
      fireEvent.click(navigationToggle());
      drainFrames(frames);
      scrollBy.mockClear();
      order.length = 0;
      act(() => { navigationToggle().click(); });
      await act(async () => { await Promise.resolve(); });
      expect(order).toEqual(['claim', 'old-arming-point']);
      drainFrames(frames);
      expect(scrollBy.mock.calls.filter(([, delta]) => delta === navigationDelta).length).toBeGreaterThanOrEqual(2);
    } finally {
      window.removeEventListener('click', hook, { capture: true });
      sticky.element.remove();
    }
  });

  it('MIG-3.2.4: the activation that opens a panel never abandons the reveal it causes -- pointer, keyboard or bare click -- while a later distinct activation does', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      const heading = navigationRailHeading();
      heading.getBoundingClientRect = () => rect(400, 40);
      const delta = expectedDelta(400, 129);
      const opens: readonly (readonly [string, (toggle: HTMLElement) => void])[] = [
        ['pointer', (toggle) => { fireEvent.mouseDown(toggle); fireEvent.click(toggle); }],
        ['keyboard', (toggle) => { fireEvent.keyDown(toggle, { key: 'Enter' }); fireEvent.click(toggle); }],
        ['bare click', (toggle) => { act(() => { toggle.click(); }); }],
      ];
      for (const [, open] of opens) {
        fireEvent.click(navigationToggle());
        drainFrames(frames);
        scrollBy.mockClear();
        open(navigationToggle());
        drainFrames(frames);
        expect(scrollBy.mock.calls.filter(([, value]) => value === delta).length).toBeGreaterThanOrEqual(2);
      }

      // CONTROL: the identical bare-click open followed by a LATER distinct
      // activation, before any frame, corrects nothing.
      fireEvent.click(navigationToggle());
      drainFrames(frames);
      scrollBy.mockClear();
      act(() => { navigationToggle().click(); });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      drainFrames(frames);
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      sticky.element.remove();
    }
  });

  /** Closes Navigation, drains, and prepares its heading and the claim-order recorder. */
  function claimOrderProbe(frames: ReturnType<typeof controllableFrames>) {
    fireEvent.click(navigationToggle());
    drainFrames(frames);
    const heading = navigationRailHeading();
    heading.getBoundingClientRect = () => rect(400, 40);
    const order: string[] = [];
    const onFocus = () => { order.push('claim'); };
    const onWheel = () => { order.push('later-activation'); };
    heading.addEventListener('focus', onFocus);
    window.addEventListener('wheel', onWheel, { capture: true });
    return {
      heading,
      order,
      stop: () => {
        heading.removeEventListener('focus', onFocus);
        window.removeEventListener('wheel', onWheel, { capture: true });
      },
    };
  }

  it('MIG-3.2.4 claim time: an activation observed after a reveal is requested but before it is claimed leaves the reveal born abandoned', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      // A first reveal, so the observer has already seen a claim: this test is
      // about the CLAIM-TIME evaluation, not about when the observer arrived.
      reopenNavigation();
      drainFrames(frames);

      const probe = claimOrderProbe(frames);
      const delta = expectedDelta(400, 129);
      try {
        scrollIntoView.mockClear();
        scrollBy.mockClear();
        // Both inside ONE act: the reveal effect runs when the act ends, after the wheel.
        act(() => {
          navigationToggle().click();
          window.dispatchEvent(new Event('wheel'));
        });
        // The later activation was observed BEFORE the claim -- measured, not assumed.
        expect(probe.order).toEqual(['later-activation', 'claim']);
        // Born abandoned: not even its own heading scroll is entitled. Focus is identity and still lands.
        expect(scrolledElements()).not.toContain(probe.heading);
        expect(probe.heading).toHaveFocus();
        drainFrames(frames);
        expect(scrollBy).not.toHaveBeenCalled();

        // CONTROL, in this same test: the identical open with no later activation.
        fireEvent.click(navigationToggle());
        drainFrames(frames);
        probe.order.length = 0;
        scrollIntoView.mockClear();
        scrollBy.mockClear();
        act(() => { navigationToggle().click(); });
        expect(probe.order).toEqual(['claim']);
        expect(scrolledElements()).toContain(probe.heading);
        drainFrames(frames);
        expect(scrollBy).toHaveBeenCalledWith(0, delta);
      } finally {
        probe.stop();
      }
    } finally {
      sticky.element.remove();
    }
  });

  it('MIG-3.2.1 observer on mount: the FIRST reveal a component ever claims already sees an activation that preceded its claim', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      renderMountJourney('137px');
      frames.flush();
      // No reveal has been claimed on this instance: only the mount-time observer can have seen anything.
      const probe = claimOrderProbe(frames);
      const delta = expectedDelta(400, 129);
      try {
        scrollBy.mockClear();
        scrollIntoView.mockClear();
        act(() => {
          navigationToggle().click();
          window.dispatchEvent(new Event('wheel'));
        });
        expect(probe.order).toEqual(['later-activation', 'claim']);
        expect(scrolledElements()).not.toContain(probe.heading);
        drainFrames(frames);
        expect(scrollBy).not.toHaveBeenCalled();

        // CONTROL, in this same test: the identical open with no later activation corrects.
        fireEvent.click(navigationToggle());
        drainFrames(frames);
        probe.order.length = 0;
        scrollBy.mockClear();
        act(() => { navigationToggle().click(); });
        drainFrames(frames);
        expect(scrollBy).toHaveBeenCalledWith(0, delta);
      } finally {
        probe.stop();
      }
    } finally {
      sticky.element.remove();
    }
  });

  it('MIG-4.2.3: a hash navigation during a live reveal abandons it and lands, while a navigation no activation caused during the same reveal is suppressed', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const target = renderMountJourney('137px');
      target.getBoundingClientRect = () => rect(0, 100);
      frames.flush();

      const heading = reopenNavigation();
      heading.getBoundingClientRect = () => rect(400, 40);
      const delta = expectedDelta(400, 129);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);

      // CONTROL: the reveal owns the scrollport at this point.
      expect(nonActivationNavigationScrolls(target)).toBe(false);

      // The hash navigation is a reader activation: it abandons the reveal and lands.
      scrollBy.mockClear();
      scrollIntoView.mockClear();
      hashNavigate('methods');
      expect(scrolledElements()).toContain(target);
      drainFrames(frames);
      // No settled correction drags the reader back to the panel.
      expect(scrollBy).not.toHaveBeenCalledWith(0, delta);

      // SECOND CONTROL: the identical reveal left alone does apply its settled correction.
      window.history.replaceState(null, '', '/');
      reopenNavigation().getBoundingClientRect = () => rect(400, 40);
      scrollBy.mockClear();
      drainFrames(frames);
      expect(scrollBy.mock.calls.filter(([, value]) => value === delta).length).toBeGreaterThanOrEqual(2);
    } finally {
      sticky.element.remove();
    }
  });

  it('MIG-4.2.3 F5: a hash navigation to an anchor the workspace does not manage releases the section pin, while a managed fragment re-establishes it', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();

      /*
       * CONTROL, first: a MANAGED fragment. The hash navigation releases the pin
       * and `focusSection` immediately re-establishes it, so a later landing
       * trigger still lands the reader where they navigated.
       */
      hashNavigate('methods');
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);

      /*
       * HOLISTIC_R2 F5: an UNMANAGED fragment never reaches `focusSection`, so
       * nothing downstream would clear the stale pin - the hash navigation
       * itself must. Otherwise the next section load or header resize re-lands
       * the reader away from the fragment they navigated to.
       */
      hashNavigate('not-a-managed-anchor');
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '213px';
      sticky.growTo(161);
      drainFrames(frames);
      expect(scrolledElements()).not.toContain(target);

      // SECOND CONTROL: re-pin without an activation and the identical trigger
      // lands again, so the arm above is about the pin and not a dead trigger.
      redeliverDeepLink();
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '289px';
      sticky.growTo(193);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('MIG-4.2.4: a bare click on "Hide Download Files" drops the section pin, exactly as a rail toggle does, while a bare Load section click does not', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(73);
    try {
      const target = renderMountJourney('81px');
      target.getBoundingClientRect = () => rect(81, 100);
      frames.flush();

      // Open Download Files, let its reveal finish, and re-pin without an activation.
      act(() => { downloadToggle().click(); });
      drainFrames(frames);
      redeliverDeepLink();
      drainFrames(frames);

      // CONTROL: a bare "Load section" click keeps the pin.
      act(() => { screen.getAllByRole('button', { name: 'Load section' })[0].click(); });
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '137px';
      sticky.growTo(129);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);

      // The fix: "Hide Download Files" goes through the one pin policy.
      act(() => { within(screen.getByTestId('download-files-panel')).getByRole('button', { name: 'Hide Download Files' }).click(); });
      expect(screen.getByTestId('download-files-panel')).toHaveAttribute('hidden');
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '213px';
      sticky.growTo(161);
      drainFrames(frames);
      expect(scrolledElements()).not.toContain(target);

      // SECOND CONTROL: re-pinned, the identical trigger scrolls again.
      redeliverDeepLink();
      drainFrames(frames);
      scrollIntoView.mockClear();
      target.style.scrollMarginTop = '289px';
      sticky.growTo(193);
      drainFrames(frames);
      expect(scrolledElements()).toContain(target);
    } finally {
      sticky.element.remove();
    }
  });

  it('MIG-4.2.1: a question change during a live Review Comments reveal abandons it, and the response it selects lands', () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      setLgViewport(false);
      renderMyReview();
      frames.flush();
      const toggle = within(headerHost()).getByRole('button', { name: 'Review Comments' });
      const heading = within(screen.getByTestId('review-comments-rail')).getByRole('heading', { name: 'Review Comments', level: 2 });
      heading.getBoundingClientRect = () => rect(400, 40);
      const delta = expectedDelta(400, 129);
      const response = screen.getByTestId('active-question-response');
      const select = screen.getByRole('combobox', { name: 'Jump to topic' });

      // CONTROL: the identical reveal with no question change corrects twice.
      fireEvent.click(toggle);
      drainFrames(frames);
      scrollBy.mockClear();
      fireEvent.click(toggle);
      drainFrames(frames);
      expect(scrollBy.mock.calls.filter(([, value]) => value === delta).length).toBeGreaterThanOrEqual(2);

      // MAIN: open again, and change the question before any frame runs.
      fireEvent.click(toggle);
      drainFrames(frames);
      fireEvent.click(toggle);
      scrollBy.mockClear();
      scrollIntoView.mockClear();
      fireEvent.change(select, { target: { value: '2' } });
      expect(response).toHaveFocus();
      expect(scrolledElements()).toContain(response);
      drainFrames(frames);
      expect(scrollBy).not.toHaveBeenCalled();
    } finally {
      sticky.element.remove();
    }
  });

  /** A deferred fetch of one mount-journey section contract; `release()` lets it resolve. */
  function deferMountSection(anchor: 'results', ok = true) {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const contract = { schema: 'matrix-paper-section-v1', documentVersion: version, paperSha256: MOUNT_SHA, index: 2, sectionCount: 3, anchor, startByte: 1200, endByte: 2400, chunks: [{ id: `node:${anchor}`, anchor, depth: 1, label: '3 Results', startByte: 1200, endByte: 2400, markdown: '# 3 Results\n\nBody.' }] };
    vi.stubGlobal('fetch', vi.fn(async () => {
      await gate;
      return { ok, status: ok ? 200 : 500, json: async () => contract } as unknown as Response;
    }));
    return () => { act(() => { release(); }); };
  }

  function resultsOutlineLink() {
    return within(screen.getByTestId('paper-outline-desktop')).getByRole('link', { name: '3 Results' });
  }

  it('MIG-S1 (M1R8-01 real path): a waiting navigation survives a panel activation, and when its section arrives during the reveal it applies identity without scrolling', async () => {
    const frames = controllableFrames();
    const sticky = mountGrowingStickyHeader(129);
    try {
      const replaceState = vi.spyOn(window.history, 'replaceState');
      renderMountJourney('137px');
      frames.flush();

      // CONTROL: the waiting navigation with no reveal lands when its section arrives.
      let release = deferMountSection('results');
      fireEvent.click(resultsOutlineLink());
      scrollIntoView.mockClear();
      release();
      await waitFor(() => expect(document.getElementById('results')).toHaveFocus());
      expect(scrolledElements()).toContain(document.getElementById('results'));
      cleanup();
      drainFrames(frames);

      // MAIN: the reader opens a panel -- pointer close, then a script open --
      // while the section is still loading, exactly as browser run-007 spec 18 did.
      renderMountJourney('137px');
      frames.flush();
      release = deferMountSection('results');
      fireEvent.click(resultsOutlineLink());
      const toggle = navigationToggle();
      fireEvent.mouseDown(toggle);
      fireEvent.click(toggle);
      act(() => { toggle.click(); });
      navigationRailHeading().getBoundingClientRect = () => rect(400, 40);
      expect(runFramesUntil(frames, () => scrollBy.mock.calls.length > 0)).toBe(true);
      scrollIntoView.mockClear();
      replaceState.mockClear();
      release();
      await waitFor(() => expect(document.getElementById('results')).toHaveFocus());
      const results = document.getElementById('results');
      expect(replaceState).toHaveBeenLastCalledWith(null, '', '/?mode=working-draft&section=results');
      expect(scrolledElements()).not.toContain(results);
    } finally {
      sticky.element.remove();
    }
  });

  it('M1R8-07: pins the reveal numbers that the paper e2e restates', () => {
    /*
     * e2e/matrix-options-paper.spec.ts cannot import from the component module
     * (a `use client` React component whose graph would have to load into
     * Playwright's own process for two integers) and there is no shared
     * constants module to hold them, so it restates both as named constants.
     * This is the drift guard that makes that duplication safe, in the pattern
     * of PaperRailDrift.test.ts: read the spec's bytes, compare to the exported
     * source of truth.
     */
    const readConstant = (source: string, name: string): number | null => {
      const match = new RegExp(`const ${name} = ([0-9]+);`).exec(source);
      return match === null ? null : Number(match[1]);
    };
    // POSITIVE CONTROL first: the reader must be able to report a number that is
    // NOT the imported one, and to report its absence, or it could not detect
    // drift at all -- it would simply agree with whatever it was compared to.
    expect(readConstant('const PAPER_PANEL_REVEAL_GAP_PX = 99;', 'PAPER_PANEL_REVEAL_GAP_PX')).toBe(99);
    expect(readConstant('no declaration here', 'PAPER_PANEL_REVEAL_GAP_PX')).toBeNull();

    const spec = fs.readFileSync(path.join(process.cwd(), 'e2e', 'matrix-options-paper.spec.ts'), 'utf8');
    expect(readConstant(spec, 'PAPER_PANEL_REVEAL_GAP_PX')).toBe(PAPER_PANEL_REVEAL_GAP_PX);
    expect(readConstant(spec, 'PAPER_REVEAL_SETTLE_TIMEOUT_MS')).toBe(PAPER_REVEAL_SETTLE_TIMEOUT_MS);
    // And the bare literal the named constant replaced must not creep back.
    expect(spec).not.toMatch(/landing\.stickyBottom \+ [0-9]/);
  });

  it('M1R8-08: a request to open an already-open panel leaves no pending reveal', () => {
    // The ordinary case, and the control for the two below: opening a CLOSED
    // panel below lg still requests its reveal. Without this, the assertions
    // that follow would pass against a helper that returned null for anything.
    expect(pendingRevealForOpenRequest('download', false, false)).toBe('download');
    expect(pendingRevealForOpenRequest('navigation', false, false)).toBe('navigation');
    /*
     * The defect: openPanel set the pending reveal unconditionally and then
     * called setPanelOpen(panel, true). For a panel that is ALREADY open React
     * bails out of that update, the reveal effect never re-runs, and the pending
     * reveal stays set -- so the next time any OTHER panel's open state changes,
     * the effect reads the stale value, finds that panel open and reveals it. A
     * reader who opens Download Files is scrolled to the Navigation heading.
     */
    expect(pendingRevealForOpenRequest('download', true, false)).toBeNull();
    expect(pendingRevealForOpenRequest('navigation', true, false)).toBeNull();
    // At lg there is no reveal at all, already-open or not.
    expect(pendingRevealForOpenRequest('download', false, true)).toBeNull();
    expect(pendingRevealForOpenRequest('download', true, true)).toBeNull();
  });

  it('M1R5-04: at maximum scroll the contract is visible-and-below-the-header, everywhere else the reading line', () => {
    // run-003 section 6.2/7: My Review Review Comments at 768x1024 landed at 348
    // needing 85, with the page at maximum scroll (3,128 of 3,128) and a 77px
    // sticky header. Decision (a): that is an acceptable landing.
    const clamped = { headingTop: 348, stickyHeaderHeight: 77, viewportHeight: 1024 };
    expect(panelRevealLandingSatisfied({ ...clamped, atMaxScroll: true })).toBe(true);
    // The SAME geometry short of maximum scroll is still a failure, which is
    // what proves the clamp flag is genuinely read rather than ignored.
    expect(panelRevealLandingSatisfied({ ...clamped, atMaxScroll: false })).toBe(false);

    // Occlusion -- the defect this work stream fixed -- can never pass, and at
    // maximum scroll least of all, where nothing can rescue it.
    expect(panelRevealLandingSatisfied({ headingTop: 24, stickyHeaderHeight: 129, viewportHeight: 800, atMaxScroll: true })).toBe(false);
    expect(panelRevealLandingSatisfied({ headingTop: 24, stickyHeaderHeight: 129, viewportHeight: 800, atMaxScroll: false })).toBe(false);
    // Exactly one pixel under the header still fails at maximum scroll.
    expect(panelRevealLandingSatisfied({ headingTop: 76, stickyHeaderHeight: 77, viewportHeight: 1024, atMaxScroll: true })).toBe(false);
    expect(panelRevealLandingSatisfied({ headingTop: 77, stickyHeaderHeight: 77, viewportHeight: 1024, atMaxScroll: true })).toBe(true);

    // Scrolled off the bottom of the scrollport is not "visible" either.
    expect(panelRevealLandingSatisfied({ headingTop: 1024, stickyHeaderHeight: 77, viewportHeight: 1024, atMaxScroll: true })).toBe(false);

    // Short of maximum scroll the reading line decides, on both sides.
    expect(panelRevealLandingSatisfied({ headingTop: 137, stickyHeaderHeight: 129, viewportHeight: 800, atMaxScroll: false })).toBe(true);
    expect(panelRevealLandingSatisfied({ headingTop: 137 + PAPER_LANDING_TOLERANCE_PX, stickyHeaderHeight: 129, viewportHeight: 800, atMaxScroll: false })).toBe(true);
    expect(panelRevealLandingSatisfied({ headingTop: 137 + PAPER_LANDING_TOLERANCE_PX + 1, stickyHeaderHeight: 129, viewportHeight: 800, atMaxScroll: false })).toBe(false);

    expect(panelRevealLandingSatisfied({ headingTop: Number.NaN, stickyHeaderHeight: 77, viewportHeight: 1024, atMaxScroll: true })).toBe(false);
  });

  describe('R11 fixes for mount gap and ordinal requests', () => {
    const drainFrames = (frames: ReturnType<typeof controllableFrames>) => frames.flush();
    const expectedDelta = (headingTop: number, stickyHeaderHeight: number) => panelRevealScrollDelta(headingTop, stickyHeaderHeight);
  it('R11-FG1: activation in the gap before passive effects is observed (useLayoutEffect)', async () => {
    let passiveEffectsFlushed = false;
    let gapAsserted = false;

    function Flag() {
      useEffect(() => { passiveEffectsFlushed = true; }, []);
      return null;
    }

    function Probe({ onCommit }: { onCommit: () => void }) {
      useLayoutEffect(() => {
        onCommit();
      }, [onCommit]);
      return null;
    }

    /*
     * THE DISCRIMINATOR. requestRevealCause() derives its activation id from
     * PaperScrollAuthority.currentActivationId(), which reads the dispatch
     * stack that authority.observe(window)'s own click listener maintains
     * (scroll-authority.ts:362-391). That listener is attached by
     * authority.observe(window), installed via useLayoutEffect at
     * RevisedPaperWorkspace.tsx:337-339. If observe() ran in a passive effect
     * instead, it would not yet be attached when a click dispatches in the gap
     * before commit 1's passive effects, and currentActivationId() would fall
     * back to latestActivationId, still its initial 0 -- the cause would be
     * born activation: 0, indistinguishable from an activation nobody ever
     * saw. Installed via useLayoutEffect (the current product), the gap click
     * is captured while it is still dispatching and the cause carries a real,
     * nonzero activation id. Downstream "was the reveal abandoned" behaviour
     * (scrollBy/scrollIntoView) does NOT discriminate this defect -- see the
     * recipe -- so the spy reads the cause's own activation id directly.
     */
    const requestRevealCauseSpy = vi.spyOn(PaperScrollAuthority.prototype, 'requestRevealCause');

    try {
      setLgViewport(false);

      render(
        <>
          <RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} />
          <Flag />
          <Probe onCommit={() => {
            if (gapAsserted) return;
            gapAsserted = true;
            // Still before commit 1's passive effects -- the gap this test exists for.
            expect(passiveEffectsFlushed).toBe(false);
            act(() => { downloadToggle().click(); });
          }} />
        </>
      );

      await act(async () => { await Promise.resolve(); });

      expect(gapAsserted).toBe(true);
      expect(passiveEffectsFlushed).toBe(true);
      expect(requestRevealCauseSpy).toHaveBeenCalledTimes(1);
      expect(requestRevealCauseSpy.mock.results[0]!.value.activation).toBe(1);

      /*
       * CONTROL, in this same test: the identical click, made after the
       * component (and every one of its own effects) has fully settled, is
       * captured by the very same listener and gets a real activation id too.
       * This isolates WHEN the click happens relative to observe()'s
       * installation as the thing being measured -- not an artifact of the
       * spy or of PaperScrollAuthority's own defaults. (It does not, by
       * itself, discriminate correct from precorrection bytes: by the time of
       * a post-settle click, observe() has already run in both. Only the GAP
       * assertion above does that -- see the recipe section 2.)
       */
      requestRevealCauseSpy.mockClear();
      cleanup();
      setLgViewport(false);

      render(<RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} />);
      await act(async () => { await Promise.resolve(); });
      act(() => { downloadToggle().click(); });

      expect(requestRevealCauseSpy).toHaveBeenCalledTimes(1);
      expect(requestRevealCauseSpy.mock.results[0]!.value.activation).toBe(1);
    } finally {
      requestRevealCauseSpy.mockRestore();
    }
  });

  it('R11-FG1: Strict Mode observe-after-dispose leaves exactly one listener', () => {
    let listeners = 0;
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'click' || type === 'mousedown' || type === 'keydown' || type === 'wheel') listeners++;
      add.call(window, type, listener, options);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'click' || type === 'mousedown' || type === 'keydown' || type === 'wheel') listeners--;
      remove.call(window, type, listener, options);
    });

    const { unmount } = render(
      <StrictMode>
        <RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} />
      </StrictMode>
    );

    expect(listeners).toBe(4);

    unmount();
    expect(listeners).toBe(0);
  });

  it('R11-FG1: server-render smoke test', () => {
    const html = renderToString(<RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} />);
    expect(html).toContain('Navigation');
  });

  it('R11-FG2: two reveal requests from one user activation leave only the latter entitled', () => {
    // The component's single pending slot (pendingRevealRef at RevisedPaperWorkspace.tsx:310)
    // makes a two-claim race impossible through the component itself.
    // So we use the real PaperScrollAuthority directly in an integration test.
    const authority = new PaperScrollAuthority({ stickyHeaderHeight: () => 129 });
    authority.observe(window);

    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const frames = controllableFrames();

    const navigation = document.createElement('h2');
    navigation.getBoundingClientRect = () => rect(400, 40);
    const download = document.createElement('h2');
    download.getBoundingClientRect = () => rect(200, 40);

    let cause1: ReturnType<typeof authority.requestRevealCause> | null = null;
    let cause2: ReturnType<typeof authority.requestRevealCause> | null = null;

    child.addEventListener('click', () => {
      cause1 = authority.requestRevealCause();
    });

    parent.addEventListener('click', () => {
      cause2 = authority.requestRevealCause();
    });

    scrollBy.mockClear();

    try {
      fireEvent.click(child);

      if (cause1 === null || cause2 === null) throw new Error('no cause minted');
      authority.revealPanelHeading(cause1, navigation);
      authority.revealPanelHeading(cause2, download);

      drainFrames(frames);

      const navigationDelta = expectedDelta(400, 129);
      const downloadDelta = expectedDelta(200, 129);

      expect(scrollBy).not.toHaveBeenCalledWith(0, navigationDelta);
      expect(scrollBy).toHaveBeenCalledWith(0, downloadDelta);
    } finally {
      authority.dispose();
      parent.remove();
    }
  });

  it('ADV-3: observe is never called from a passive effect', () => {
    const order: string[] = [];
    const observe = vi.spyOn(PaperScrollAuthority.prototype, 'observe').mockImplementation(() => {
      order.push('observe');
    });

    function Flag() {
      useLayoutEffect(() => { order.push('layout-effect'); }, []);
      return null;
    }

    render(
      <>
        <RevisedPaperWorkspace documentVersion={version} urlState={state()} assignment={getProductionAssignment()} />
        <Flag />
      </>
    );

    // observe must happen before passive-effect
    expect(order).toEqual(['observe', 'layout-effect']);
    observe.mockRestore();
  });
});
});
