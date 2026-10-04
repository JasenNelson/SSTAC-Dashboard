import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { getPaperRelease, PAPER_WITHHELD_NOTICE_ID, R5_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { PaperScrollAuthority } from '@/lib/matrix-options/paper/scroll-authority';
import type { PaperLandingMeasurement } from '@/lib/matrix-options/paper/scroll-authority';
import type { PaperUrlState } from '@/lib/matrix-options/paper/url-state';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { getProductionAssignment } from '@/lib/matrix-options/revised-paper-review';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';

import type { PaperOutlineNavEntry } from '../PaperOutlineNav';
import { PaperWithheldNotice } from '../PaperVersionControl';
import { RevisedPaperWorkspace } from '../RevisedPaperWorkspace';
import { syntheticResolvedR5Guide } from './r5-synthetic-guide';

/*
 * Where a link to a withheld section lands.
 *
 * The draft that withholds a section shows one notice. An old link to that
 * section (`#app-l`) and the address the section route sends such a link to
 * (`#paper-withheld-notice`) are the same landing: the notice is pinned, scrolled
 * and verified THROUGH THE SCROLL AUTHORITY, and focused without scrolling, in
 * both modes, and verified again when the sticky header height is republished.
 *
 * jsdom lays nothing out, so these tests observe the authority's own API (pin,
 * scroll request, landing check and the measurement handed to it), never a raw
 * scroll. Pixels are proven in the browser.
 */

const WITHHELD_ID = getPaperRelease(R5_PAPER_VERSION)!.withheld!.stableSectionId;
const r5Guide = syntheticResolvedR5Guide();
const defaultGuide = getReviewerGuideContract();

const outline: readonly PaperOutlineNavEntry[] = [
  { id: 'n1', anchor: 'intro', label: '1 Introduction', depth: 1, level: 1, parentId: null, childIds: ['n2'] },
  { id: 'n2', anchor: 'scope', label: '1.1 Scope', depth: 2, level: 2, parentId: 'n1', childIds: [] },
  { id: 'n3', anchor: 'methods', label: '2 Methods', depth: 1, level: 1, parentId: null, childIds: [] },
];

function FakeDocument() {
  return <article>{outline.map((entry) => <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1} style={{ scrollMarginTop: '16px' }}><h2>{entry.label} body</h2></section>)}</article>;
}

function state(overrides: Partial<PaperUrlState> = {}): PaperUrlState {
  return { mode: 'working-draft', cohort: null, q: null, section: null, ...overrides };
}

type Mode = 'working-draft' | 'my-review';

function renderWorkspace(mode: Mode, documentVersion: string = R5_PAPER_VERSION, section: string | null = null, q: string | null = null) {
  const guide = documentVersion === R5_PAPER_VERSION ? r5Guide : defaultGuide;
  if (mode === 'my-review') {
    return render(<RevisedPaperWorkspace documentVersion={documentVersion} guide={guide} reviewManifestSha256={'b'.repeat(64)} urlState={state({ mode: 'my-review', cohort: 'categories' })} assignment={getProductionAssignment()} cohortPortions={[]} />);
  }
  return render(<RevisedPaperWorkspace documentVersion={documentVersion} guide={guide} urlState={state({ section, q })} assignment={getProductionAssignment()} outline={outline}><FakeDocument /></RevisedPaperWorkspace>);
}

function rect(top: number, height = 40): DOMRect {
  return { top, bottom: top + height, left: 0, right: 800, width: 800, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

/** A sticky layout header whose height the test controls, and the ResizeObserver that reports it. */
function mountStickyHeader(initialHeight: number) {
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
  return {
    element,
    growTo: (next: number) => { height = next; act(() => { for (const callback of callbacks) callback(); }); },
  };
}

function setLgViewport(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
}

function hashNavigate(fragment: string) {
  window.history.replaceState(null, '', `#${fragment}`);
  act(() => { window.dispatchEvent(new Event('hashchange')); });
}

/**
 * Back or Forward to a history entry, as the browser delivers it when the two
 * entries differ only in their query: the address is the entry's, `popstate`
 * fires, and NO `hashchange` does.
 */
function traverseTo(url: string) {
  window.history.replaceState(null, '', url);
  act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
}

/** The address of an entry of the given mode whose fragment is `fragment`. */
function entryUrl(mode: Mode, fragment: string, query = ''): string {
  return `/?mode=${mode}${mode === 'my-review' ? '&cohort=categories' : ''}${query}#${fragment}`;
}

const originalMatchMedia = window.matchMedia;
const originalScrollBy = window.scrollBy;
let pin: MockInstance<PaperScrollAuthority['pin']>;
let scrollTarget: MockInstance<PaperScrollAuthority['scrollTargetIntoView']>;
let landingCheck: MockInstance<PaperScrollAuthority['requestLandingCheck']>;
let rawScroll: ReturnType<typeof vi.fn>;

const notice = () => screen.getByTestId('paper-withheld-notice');
const pinnedIds = () => pin.mock.calls.map((call) => call[0]);
const landingCheckIds = () => landingCheck.mock.calls.map((call) => call[0]);
/** The measurement the workspace handed the authority with its latest landing check of `anchor`. */
function measurementOf(anchor: string): PaperLandingMeasurement | null {
  const call = [...landingCheck.mock.calls].reverse().find((candidate) => candidate[0] === anchor);
  if (!call) throw new Error(`no landing check was requested for ${anchor}`);
  return call[1](anchor);
}

beforeEach(() => {
  // Spies call through: the real authority still pins, arbitrates and schedules.
  pin = vi.spyOn(PaperScrollAuthority.prototype, 'pin');
  scrollTarget = vi.spyOn(PaperScrollAuthority.prototype, 'scrollTargetIntoView');
  landingCheck = vi.spyOn(PaperScrollAuthority.prototype, 'requestLandingCheck');
  rawScroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: rawScroll });
  window.scrollBy = vi.fn() as unknown as typeof window.scrollBy;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  document.querySelector('[data-testid="paper-layout-header"]')?.remove();
  window.matchMedia = originalMatchMedia;
  window.scrollBy = originalScrollBy;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('the withheld notice as a landing target', () => {
  it('carries the notice id and can take focus without being a tab stop, in both modes', () => {
    for (const mode of ['working-draft', 'my-review'] as const) {
      const { unmount } = renderWorkspace(mode);
      expect(notice().id).toBe(PAPER_WITHHELD_NOTICE_ID);
      expect(notice()).toHaveAttribute('tabindex', '-1');
      expect(notice()).toHaveAttribute('role', 'note');
      expect(document.querySelectorAll(`#${PAPER_WITHHELD_NOTICE_ID}`)).toHaveLength(1);
      unmount();
    }
    // The component alone: the id is the constant the section route redirects to.
    const { container } = render(<PaperWithheldNotice documentVersion={R5_PAPER_VERSION} mode="working-draft" />);
    expect(container.querySelector('p')?.id).toBe('paper-withheld-notice');
    expect(container.querySelector('p')?.tabIndex).toBe(-1);
  });

  it('is not the withheld section id itself: nothing on the page carries that id', () => {
    renderWorkspace('working-draft');
    expect(WITHHELD_ID).toBe('app-l');
    expect(document.getElementById(WITHHELD_ID)).toBeNull();
  });

  it.each([
    ['working-draft', WITHHELD_ID],
    ['working-draft', PAPER_WITHHELD_NOTICE_ID],
    ['my-review', WITHHELD_ID],
    ['my-review', PAPER_WITHHELD_NOTICE_ID],
  ] as const)('%s: a page opened at #%s lands on the notice through the authority and focuses it without scrolling', (mode, fragment) => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    window.history.replaceState(null, '', `/#${fragment}`);
    renderWorkspace(mode);
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(scrollTarget.mock.calls.map((call) => call[0])).toEqual([notice()]);
    expect(landingCheckIds()).toContain(PAPER_WITHHELD_NOTICE_ID);
    expect(notice()).toHaveFocus();
    const noticeFocus = focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === notice());
    expect(noticeFocus).toEqual([[{ preventScroll: true }]]);
  });

  it.each([
    ['working-draft', WITHHELD_ID],
    ['working-draft', PAPER_WITHHELD_NOTICE_ID],
    ['my-review', WITHHELD_ID],
    ['my-review', PAPER_WITHHELD_NOTICE_ID],
  ] as const)('%s: a later hash change to #%s lands on the notice too', (mode, fragment) => {
    renderWorkspace(mode);
    // Positive control for the assertions below: opened with no fragment, nothing lands on the notice.
    expect(pinnedIds()).not.toContain(PAPER_WITHHELD_NOTICE_ID);
    expect(landingCheckIds()).not.toContain(PAPER_WITHHELD_NOTICE_ID);
    expect(notice()).not.toHaveFocus();
    hashNavigate(fragment);
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(scrollTarget.mock.calls.map((call) => call[0])).toContain(notice());
    expect(landingCheckIds()).toContain(PAPER_WITHHELD_NOTICE_ID);
    expect(notice()).toHaveFocus();
  });

  it('two-sided: a fragment that names anything else never lands on the notice', () => {
    for (const fragment of ['app-k', 'app-l-extra', 'paper-withheld-notice-2', 'APP-L', 'methods']) {
      window.history.replaceState(null, '', `/#${fragment}`);
      const { unmount } = renderWorkspace('working-draft');
      hashNavigate(fragment);
      expect(pinnedIds(), fragment).not.toContain(PAPER_WITHHELD_NOTICE_ID);
      expect(landingCheckIds(), fragment).not.toContain(PAPER_WITHHELD_NOTICE_ID);
      expect(notice(), fragment).not.toHaveFocus();
      unmount();
      pin.mockClear();
      landingCheck.mockClear();
    }
  });

  it('two-sided: the default draft withholds nothing, so the same fragments land nowhere', () => {
    for (const mode of ['working-draft', 'my-review'] as const) {
      window.history.replaceState(null, '', `/#${WITHHELD_ID}`);
      const { unmount } = renderWorkspace(mode, REVISED_PAPER_VERSION);
      hashNavigate(PAPER_WITHHELD_NOTICE_ID);
      expect(screen.queryByTestId('paper-withheld-notice')).toBeNull();
      expect(pin).not.toHaveBeenCalled();
      expect(landingCheck).not.toHaveBeenCalled();
      unmount();
    }
  });

  it('the fragment wins over a section named in the same address: the notice keeps the pin', () => {
    window.history.replaceState(null, '', `/#${PAPER_WITHHELD_NOTICE_ID}`);
    renderWorkspace('working-draft', R5_PAPER_VERSION, 'scope');
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(notice()).toHaveFocus();
    // Control: the same address without the fragment pins the section it names.
    pin.mockClear();
    window.history.replaceState(null, '', '/');
    renderWorkspace('working-draft', R5_PAPER_VERSION, 'scope');
    expect(pinnedIds()).toEqual(['scope']);
  });

  it.each(['working-draft', 'my-review'] as const)('%s: the landing is verified again when the sticky header height is republished, until the reader takes over', (mode) => {
    const sticky = mountStickyHeader(77);
    window.history.replaceState(null, '', `/#${WITHHELD_ID}`);
    renderWorkspace(mode);
    expect(landingCheckIds()).toContain(PAPER_WITHHELD_NOTICE_ID);
    landingCheck.mockClear();
    // The header grows after the first commit (its actions slot fills): the published height changes.
    sticky.growTo(129);
    expect(landingCheckIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    // An unchanged height republishes nothing.
    landingCheck.mockClear();
    sticky.growTo(129);
    expect(landingCheck).not.toHaveBeenCalled();
    // Reader scroll intent releases the pin: a later header change no longer takes the page back.
    act(() => { window.dispatchEvent(new Event('wheel')); });
    sticky.growTo(140);
    expect(landingCheck).not.toHaveBeenCalled();
  });

  it('two-sided: with nothing pinned, a republished header height requests no landing check', () => {
    const sticky = mountStickyHeader(77);
    renderWorkspace('my-review');
    landingCheck.mockClear();
    sticky.growTo(129);
    expect(landingCheck).not.toHaveBeenCalled();
  });

  it('measures the notice against the page at every width, and a section against the document column at lg', () => {
    window.history.replaceState(null, '', `/#${PAPER_WITHHELD_NOTICE_ID}`);
    renderWorkspace('working-draft');
    const column = screen.getByTestId('paper-document-column');
    column.getBoundingClientRect = () => rect(300, 600);
    notice().style.scrollMarginTop = '85px';
    notice().getBoundingClientRect = () => rect(210);
    for (const lg of [false, true]) {
      setLgViewport(lg);
      const measured = measurementOf(PAPER_WITHHELD_NOTICE_ID);
      expect(measured?.element).toBe(notice());
      expect(measured?.actualTop).toBe(210);
      // The notice is outside the column, so the column's own top is never part of its reading line.
      expect(measured?.expectedTop).toBe(85);
    }
    // Control: a section inside the column is measured from the column's top at lg, and from the page below it.
    hashNavigate('methods');
    expect(landingCheckIds()).toContain('methods');
    const section = document.getElementById('methods') as HTMLElement;
    section.getBoundingClientRect = () => rect(316);
    setLgViewport(true);
    expect(measurementOf('methods')?.expectedTop).toBe(316);
    setLgViewport(false);
    expect(measurementOf('methods')?.expectedTop).toBe(16);
  });

  it('runs the verification through the authority to a corrective scroll of the notice, bounded and only while it is pinned', async () => {
    window.history.replaceState(null, '', `/#${WITHHELD_ID}`);
    renderWorkspace('working-draft');
    notice().style.scrollMarginTop = '137px';
    // The stale landing: the notice sits above the reading line the grown header leaves.
    notice().getBoundingClientRect = () => rect(81);
    rawScroll.mockClear();
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 250); }); });
    const corrections = rawScroll.mock.contexts.filter((context) => context === notice()).length;
    expect(corrections).toBeGreaterThan(0);
    expect(corrections).toBeLessThanOrEqual(3);
    // On its reading line nothing is corrected.
    rawScroll.mockClear();
    notice().getBoundingClientRect = () => rect(137);
    hashNavigate(WITHHELD_ID);
    rawScroll.mockClear();
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 250); }); });
    expect(rawScroll.mock.contexts.filter((context) => context === notice())).toHaveLength(0);
  });
});

describe('Back/Forward to an entry whose fragment names the withheld notice', () => {
  const scrolledTargets = () => scrollTarget.mock.calls.map((call) => call[0]);
  const questionRow = (number: number) => screen.getByTestId(`review-question-row-q${number}`);
  const question4 = r5Guide.questions[3];

  it.each([
    ['working-draft', WITHHELD_ID],
    ['working-draft', PAPER_WITHHELD_NOTICE_ID],
    ['my-review', WITHHELD_ID],
    ['my-review', PAPER_WITHHELD_NOTICE_ID],
  ] as const)('%s: a popstate to an entry at #%s, with no hashchange, lands on the notice through the authority and focuses it without scrolling', (mode, fragment) => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    renderWorkspace(mode);
    // Control: opened with no fragment, nothing has landed on the notice yet.
    expect(pin).not.toHaveBeenCalled();
    expect(notice()).not.toHaveFocus();
    traverseTo(entryUrl(mode, fragment));
    // The notice, and only the notice: the traversal pins no section before or after it.
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(scrolledTargets()).toEqual([notice()]);
    expect(landingCheckIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(notice()).toHaveFocus();
    const noticeFocus = focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === notice());
    expect(noticeFocus).toEqual([[{ preventScroll: true }]]);
  });

  it('Working Draft: such a popstate restores the question state of the entry and does NOT send the paper to the section the entry names', () => {
    renderWorkspace('working-draft');
    expect(questionRow(4)).toHaveAttribute('data-open', 'false');
    expect(questionRow(4)).toHaveAttribute('data-highlighted', 'false');
    traverseTo(entryUrl('working-draft', PAPER_WITHHELD_NOTICE_ID, `&q=${encodeURIComponent(question4.id)}&section=methods`));
    // The review panel agrees with the entry: its question is highlighted and open.
    expect(questionRow(4)).toHaveAttribute('data-highlighted', 'true');
    expect(questionRow(4)).toHaveAttribute('data-open', 'true');
    // The paper is restored by the notice landing alone: the entry's section is neither
    // pinned, scrolled to nor verified.
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(scrolledTargets()).toEqual([notice()]);
    expect(landingCheckIds()).not.toContain('methods');
    expect(notice()).toHaveFocus();
  });

  it('two-sided: the same entry without the notice fragment restores the same question state and DOES send the paper to its section', () => {
    renderWorkspace('working-draft');
    traverseTo(`/?mode=working-draft&q=${encodeURIComponent(question4.id)}&section=methods`);
    expect(questionRow(4)).toHaveAttribute('data-highlighted', 'true');
    expect(questionRow(4)).toHaveAttribute('data-open', 'true');
    expect(pinnedIds()).toEqual(['methods']);
    expect(scrolledTargets()).toEqual([document.getElementById('methods')]);
    expect(landingCheckIds()).toContain('methods');
    expect(notice()).not.toHaveFocus();
  });

  it('Working Draft: a popstate to a notice entry with neither q nor section restores the first question and does NOT send the paper to the first outline entry', () => {
    renderWorkspace('working-draft', R5_PAPER_VERSION, null, question4.id);
    expect(questionRow(4)).toHaveAttribute('data-open', 'true');
    expect(questionRow(1)).toHaveAttribute('data-highlighted', 'false');
    expect(pin).not.toHaveBeenCalled();
    traverseTo(entryUrl('working-draft', WITHHELD_ID));
    // The entry is the page as first opened: the first question, no open editor.
    expect(questionRow(1)).toHaveAttribute('data-highlighted', 'true');
    expect(questionRow(4)).toHaveAttribute('data-open', 'false');
    // The paper start is not navigated to; the notice is the landing.
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    expect(scrolledTargets()).toEqual([notice()]);
    expect(landingCheckIds()).not.toContain('intro');
  });

  it.each([
    ['no fragment', '/?mode=working-draft', 'intro'],
    ['another appendix id as the fragment', '/?mode=working-draft#app-k', 'intro'],
    ['a section anchor as the fragment (a popstate reads the query, never the fragment)', '/?mode=working-draft#methods', 'intro'],
    ['a section in the query and another fragment', '/?mode=working-draft&section=methods#scope', 'methods'],
    ['a fragment that only starts like the notice id', `/?mode=working-draft&section=methods#${PAPER_WITHHELD_NOTICE_ID}-2`, 'methods'],
  ])('Working Draft: a popstate to an entry with %s navigates the paper exactly as before, and nothing lands on the notice', (_name, url, anchor) => {
    renderWorkspace('working-draft');
    traverseTo(url);
    expect(pinnedIds()).toEqual([anchor]);
    expect(scrolledTargets()).toEqual([document.getElementById(anchor)]);
    expect(landingCheckIds()).toEqual([anchor]);
    expect(notice()).not.toHaveFocus();
    // Restore only: the section is not focused either (focus stays where it was).
    expect(document.getElementById(anchor)).not.toHaveFocus();
  });

  it('My Review: a popstate to an entry whose fragment names something else lands nowhere, as before', () => {
    renderWorkspace('my-review');
    for (const fragment of ['app-k', 'methods', `${WITHHELD_ID}-extra`]) traverseTo(entryUrl('my-review', fragment));
    traverseTo('/?mode=my-review&cohort=categories');
    expect(pin).not.toHaveBeenCalled();
    expect(scrollTarget).not.toHaveBeenCalled();
    expect(landingCheck).not.toHaveBeenCalled();
    expect(notice()).not.toHaveFocus();
  });

  it('the default draft withholds nothing: a popstate to the same fragments navigates its paper as before', () => {
    renderWorkspace('working-draft', REVISED_PAPER_VERSION);
    for (const fragment of [WITHHELD_ID, PAPER_WITHHELD_NOTICE_ID]) {
      pin.mockClear();
      traverseTo(entryUrl('working-draft', fragment));
      expect(pinnedIds()).toEqual(['intro']);
    }
    expect(screen.queryByTestId('paper-withheld-notice')).toBeNull();
  });

  it.each(['working-draft', 'my-review'] as const)('%s: the notice listeners are removed on unmount', (mode) => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderWorkspace(mode);
    // Positive control: while mounted, the traversal lands.
    traverseTo(entryUrl(mode, PAPER_WITHHELD_NOTICE_ID));
    expect(pinnedIds()).toEqual([PAPER_WITHHELD_NOTICE_ID]);
    unmount();
    pin.mockClear();
    scrollTarget.mockClear();
    landingCheck.mockClear();
    traverseTo(entryUrl(mode, WITHHELD_ID));
    hashNavigate(PAPER_WITHHELD_NOTICE_ID);
    expect(pin).not.toHaveBeenCalled();
    expect(scrollTarget).not.toHaveBeenCalled();
    expect(landingCheck).not.toHaveBeenCalled();
    // Every popstate and hashchange listener the workspace added was removed, by the same function.
    for (const type of ['popstate', 'hashchange']) {
      const addedListeners = added.mock.calls.filter((call) => call[0] === type).map((call) => call[1]);
      const removedListeners = removed.mock.calls.filter((call) => call[0] === type).map((call) => call[1]);
      expect(addedListeners.length, type).toBeGreaterThan(0);
      expect(addedListeners.filter((listener) => !removedListeners.includes(listener)), type).toHaveLength(0);
    }
  });
});

describe('Back/Forward away from the withheld notice: focus follows only when it is still on the notice', () => {
  const sectionElement = (anchor: string) => document.getElementById(anchor) as HTMLElement;
  /** The arguments of every `focus` call made on `element`. */
  const focusCallsOn = (focus: MockInstance<HTMLElement['focus']>, element: HTMLElement) => focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === element);

  it.each([
    ['an entry that names a section', '/?mode=working-draft&section=methods', 'methods'],
    ['the entry the page was first opened with (the first outline entry)', '/?mode=working-draft', 'intro'],
  ])('Working Draft: with focus on the notice, a popstate to %s moves focus to the restored section, without scrolling', (_name, url, anchor) => {
    renderWorkspace('working-draft');
    traverseTo(entryUrl('working-draft', PAPER_WITHHELD_NOTICE_ID));
    expect(notice()).toHaveFocus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    pin.mockClear();
    traverseTo(url);
    // The paper is restored as for any such entry, and focus leaves the notice with it.
    expect(pinnedIds()).toEqual([anchor]);
    expect(sectionElement(anchor)).toHaveFocus();
    expect(notice()).not.toHaveFocus();
    expect(focusCallsOn(focus, sectionElement(anchor))).toEqual([[{ preventScroll: true }]]);
  });

  it.each([
    ['in the review panel', () => screen.getByTestId('review-question-toggle-q1')],
    ['on another section of the paper', () => document.getElementById('scope') as HTMLElement],
    ['on the paper navigation', () => screen.getByTestId('navigation-toggle')],
  ])('two-sided: the same popstate with focus %s restores the section and does NOT move focus', (_name, focused) => {
    renderWorkspace('working-draft');
    // The notice was landed on earlier and is still pinned; what decides is where focus is NOW.
    traverseTo(entryUrl('working-draft', PAPER_WITHHELD_NOTICE_ID));
    expect(notice()).toHaveFocus();
    const holder = focused();
    act(() => { holder.focus({ preventScroll: true }); });
    expect(holder).toHaveFocus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    pin.mockClear();
    traverseTo('/?mode=working-draft&section=methods');
    expect(pinnedIds()).toEqual(['methods']);
    expect(holder).toHaveFocus();
    expect(sectionElement('methods')).not.toHaveFocus();
    expect(focusCallsOn(focus, sectionElement('methods'))).toEqual([]);
  });

  it('two-sided: with focus nowhere (the notice never landed on), the same popstate restores the section and focuses nothing', () => {
    renderWorkspace('working-draft');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    traverseTo('/?mode=working-draft&section=methods');
    expect(pinnedIds()).toEqual(['methods']);
    expect(sectionElement('methods')).not.toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
  });

  it('My Review is unaffected: with focus on the notice, a popstate to another entry leaves focus where it is and navigates no paper section', () => {
    renderWorkspace('my-review');
    traverseTo(entryUrl('my-review', PAPER_WITHHELD_NOTICE_ID));
    expect(notice()).toHaveFocus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    pin.mockClear();
    scrollTarget.mockClear();
    for (const url of ['/?mode=my-review&cohort=categories', '/?mode=my-review&cohort=pathway-grid&section=methods']) traverseTo(url);
    expect(notice()).toHaveFocus();
    expect(focus).not.toHaveBeenCalled();
    expect(pin).not.toHaveBeenCalled();
    expect(scrollTarget).not.toHaveBeenCalled();
  });
});

describe('Back/Forward away from the withheld notice to a section that is not loaded yet', () => {
  const SHA = 'd'.repeat(64);
  // The section window as the server sends it: `intro` (with `scope`) is rendered, `methods` is a placeholder.
  const sectionWindow = {
    paperSha256: SHA,
    initialIndex: 0,
    sections: [
      { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
      { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
    ],
    linkMap: {},
  };
  const methodsContract = {
    schema: 'matrix-paper-section-v1',
    documentVersion: R5_PAPER_VERSION,
    paperSha256: SHA,
    index: 1,
    sectionCount: 2,
    anchor: 'methods',
    startByte: 400,
    endByte: 1200,
    chunks: [{ id: 'node:methods', anchor: 'methods', depth: 1, label: '2 Methods', startByte: 400, endByte: 1200, markdown: '# 2 Methods\n\nLoaded methods body.' }],
  };

  function InitialSection() {
    return <>{outline.filter((entry) => entry.anchor !== 'methods').map((entry) => <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1} style={{ scrollMarginTop: '16px' }}><h2>{entry.label} body</h2></section>)}</>;
  }

  /** The section request stays in flight until `release()`. */
  function deferSectionLoad() {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(async () => {
      await gate;
      return { ok: true, status: 200, json: async () => methodsContract } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return { fetchMock, release: () => { act(() => { release(); }); } };
  }

  /** Lands on the notice, then goes Back to an entry whose section is still a placeholder. */
  function leaveNoticeForUnloadedSection() {
    const load = deferSectionLoad();
    render(<RevisedPaperWorkspace documentVersion={R5_PAPER_VERSION} guide={r5Guide} urlState={state()} assignment={getProductionAssignment()} outline={outline} sectionWindow={sectionWindow}><InitialSection /></RevisedPaperWorkspace>);
    traverseTo(entryUrl('working-draft', PAPER_WITHHELD_NOTICE_ID));
    expect(notice()).toHaveFocus();
    expect(document.getElementById('methods')).toBeNull();
    pin.mockClear();
    scrollTarget.mockClear();
    traverseTo('/?mode=working-draft&section=methods');
    // The navigation waits for its section: nothing of it is applied yet, and focus has not moved.
    expect(load.fetchMock).toHaveBeenCalledTimes(1);
    expect(document.getElementById('methods')).toBeNull();
    expect(pin).not.toHaveBeenCalled();
    expect(notice()).toHaveFocus();
    return load;
  }

  const focusCallsOn = (focus: MockInstance<HTMLElement['focus']>, element: HTMLElement) => focus.mock.calls.filter((_call, index) => focus.mock.contexts[index] === element);

  it('a reader who moved into the review panel while the section was loading keeps focus there: the section is pinned and scrolled as before, and not focused', async () => {
    const load = leaveNoticeForUnloadedSection();
    const toggle = screen.getByTestId('review-question-toggle-q1');
    act(() => { toggle.focus({ preventScroll: true }); });
    expect(toggle).toHaveFocus();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    load.release();
    await waitFor(() => expect(pinnedIds()).toEqual(['methods']));
    const section = document.getElementById('methods') as HTMLElement;
    expect(scrollTarget.mock.calls.map((call) => call[0])).toEqual([section]);
    expect(landingCheckIds()).toContain('methods');
    // Focus stays where the reader put it.
    expect(toggle).toHaveFocus();
    expect(section).not.toHaveFocus();
    expect(focusCallsOn(focus, section)).toEqual([]);
  });

  it('two-sided: with focus left on the notice, focus moves to the section when its load completes, without scrolling', async () => {
    const load = leaveNoticeForUnloadedSection();
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    load.release();
    await waitFor(() => expect(pinnedIds()).toEqual(['methods']));
    const section = document.getElementById('methods') as HTMLElement;
    expect(scrollTarget.mock.calls.map((call) => call[0])).toEqual([section]);
    expect(section).toHaveFocus();
    expect(notice()).not.toHaveFocus();
    expect(focusCallsOn(focus, section)).toEqual([[{ preventScroll: true }]]);
  });
});
