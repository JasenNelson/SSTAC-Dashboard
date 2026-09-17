import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PAPER_SECTION_CONTRACT_FAILURE_PREFIX } from '@/lib/matrix-options/paper/section-window';
import {
  fetchPaperSection,
  PAPER_SECTION_PREFETCH_ROOT_MARGIN,
  PaperLoadFullDocumentControl,
  paperSectionRequestUrl,
  PaperSectionWindowView,
  placeholderMinHeight,
  usePaperSectionWindow,
} from '../PaperSectionWindow';
import type { PaperSectionWindowApi, PaperSectionWindowData } from '../PaperSectionWindow';

const VERSION = '1.0.11-remediated-20260913';
const SHA = 'd'.repeat(64);

const windowData: PaperSectionWindowData = {
  paperSha256: SHA,
  initialIndex: 0,
  sections: [
    { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
    { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
  ],
  linkMap: {},
};

function contract(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'matrix-paper-section-v1',
    documentVersion: VERSION,
    paperSha256: SHA,
    index: 1,
    sectionCount: 2,
    anchor: 'methods',
    startByte: 400,
    endByte: 1200,
    chunks: [{ id: 'node:methods', anchor: 'methods', depth: 1, label: '2 Methods', startByte: 400, endByte: 1200, markdown: '# 2 Methods\n\nLoaded body.' }],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('paper section requests', () => {
  it('binds the request to the version, the anchor and the authenticated paper hash', () => {
    expect(paperSectionRequestUrl(VERSION, 'methods', SHA)).toBe(`/api/matrix-options/paper/v/${VERSION}/sections/methods?paper=${SHA}`);
    expect(paperSectionRequestUrl(VERSION, 'a b/c', SHA)).toContain('/sections/a%20b%2Fc?paper=');
  });

  it('sends same-origin credentials and returns only a contract that matches the request', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => contract() } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchPaperSection(VERSION, windowData, 1, new AbortController().signal);
    expect(result.anchor).toBe('methods');
    expect(result.chunks[0].markdown).toContain('Loaded body.');
    expect(fetchMock).toHaveBeenCalledWith(paperSectionRequestUrl(VERSION, 'methods', SHA), expect.objectContaining({ credentials: 'same-origin' }));
  });

  it.each([
    ['a non-OK response', { ok: false, status: 409, json: async () => ({ error: 'Paper release mismatch' }) }, 'Paper section request failed: 409'],
    ['a contract for another section', { ok: true, json: async () => contract({ index: 0, anchor: 'intro' }) }, `${PAPER_SECTION_CONTRACT_FAILURE_PREFIX}section index`],
    ['a contract for another release', { ok: true, json: async () => contract({ paperSha256: 'e'.repeat(64) }) }, `${PAPER_SECTION_CONTRACT_FAILURE_PREFIX}paper SHA-256`],
    ['a contract of the wrong size', { ok: true, json: async () => contract({ endByte: 1300 }) }, `${PAPER_SECTION_CONTRACT_FAILURE_PREFIX}section size`],
  ])('rejects %s', async (_name, response, message) => {
    vi.stubGlobal('fetch', vi.fn(async () => response as unknown as Response));
    await expect(fetchPaperSection(VERSION, windowData, 1, new AbortController().signal)).rejects.toThrow(message);
  });

  it('reserves a placeholder height calibrated to the measured document height (M1R3-03)', () => {
    expect(placeholderMinHeight(0)).toBe(192);
    expect(placeholderMinHeight(400)).toBe(192);
    expect(placeholderMinHeight(Number.NaN)).toBe(192);
    expect(placeholderMinHeight(159988)).toBeGreaterThan(placeholderMinHeight(24704));

    // Browser run-001 measured the real release at 175,543 px for 534,101 bytes
    // at 360 wide. The reserved height for the whole document must land within
    // 1 percent of that measurement, and section index 2 (159,988 bytes) must
    // reserve the calibrated height rather than the old 0.25 px/byte estimate.
    const wholeDocument = placeholderMinHeight(534101);
    expect(wholeDocument).toBe(175719);
    expect(Math.abs(wholeDocument - 175543) / 175543).toBeLessThan(0.01);
    expect(placeholderMinHeight(159988)).toBe(52636);

    // The superseded constant could not have passed either assertion: it
    // under-reserved the document by about 24 percent (about 12,600 px on
    // section index 2 alone), so this check could genuinely have failed.
    expect(placeholderMinHeight(159988)).not.toBe(39997);
    expect(Math.abs(Math.round(534101 * 0.25) - 175543) / 175543).toBeGreaterThan(0.2);
  });

  it('prefetches about one viewport ahead and behind', () => {
    expect(PAPER_SECTION_PREFETCH_ROOT_MARGIN).toBe('100% 0px 100% 0px');
  });
});

/*
 * M1R3-02: the prefetch-on-approach trigger is the first reading interaction a
 * user meets, and it was previously asserted only as the VALUE of the rootMargin
 * constant, so the whole effect body could be deleted with every test still
 * green. These tests drive the window's own IntersectionObserver (over
 * [data-paper-section-placeholder], not the workspace observer over
 * section[data-paper-chunk]) and assert the fetch that the trigger must cause.
 */
const PREFETCH_SHA = 'f'.repeat(64);

const prefetchWindow: PaperSectionWindowData = {
  paperSha256: PREFETCH_SHA,
  initialIndex: 0,
  sections: [
    { index: 0, anchor: 'intro', label: '1 Introduction', bytes: 400 },
    { index: 1, anchor: 'methods', label: '2 Methods', bytes: 800 },
    { index: 2, anchor: 'results', label: '3 Results', bytes: 1200 },
  ],
  linkMap: {},
};

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  disconnectCount = 0;
  constructor(readonly callback: IntersectionObserverCallback, readonly options?: IntersectionObserverInit) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) { this.observed.push(element); }
  unobserve() {}
  disconnect() { this.disconnectCount += 1; }
  takeRecords() { return []; }
  fire(entries: readonly (readonly [Element, boolean])[]) {
    act(() => {
      this.callback(entries.map(([target, isIntersecting]) => ({ target, isIntersecting })) as unknown as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
    });
  }
}

function prefetchContract(index: 1 | 2) {
  const section = prefetchWindow.sections[index];
  const startByte = index === 1 ? 400 : 1200;
  const endByte = startByte + section.bytes;
  return {
    schema: 'matrix-paper-section-v1',
    documentVersion: VERSION,
    paperSha256: PREFETCH_SHA,
    index,
    sectionCount: prefetchWindow.sections.length,
    anchor: section.anchor,
    startByte,
    endByte,
    chunks: [{ id: `node:${section.anchor}`, anchor: section.anchor, depth: 1, label: section.label, startByte, endByte, markdown: `# ${section.label}\n\nLoaded body.` }],
  };
}

function observedAnchors(observer: FakeIntersectionObserver): (string | null)[] {
  return observer.observed.map((element) => element.getAttribute('data-paper-section-placeholder'));
}

function placeholderFor(anchor: string): HTMLElement {
  const element = document.querySelector(`[data-paper-section-placeholder="${anchor}"]`);
  expect(element).not.toBeNull();
  return element as HTMLElement;
}

/** Anchors whose section request must fail; empty means every request succeeds. */
let failingAnchors = new Set<string>();

function anchorOfRequest(url: string): 'methods' | 'results' {
  return url.includes('/sections/results') ? 'results' : 'methods';
}

/**
 * The shared prefetch environment: a fake IntersectionObserver plus a fetch that
 * fails for whatever `failingAnchors` holds, so a test can drive a section into
 * the `error` status through the real loader rather than by stubbing state.
 */
function stubPrefetchEnvironment(calls: string[]) {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  failingAnchors = new Set<string>();
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const href = String(url);
    calls.push(href);
    const anchor = anchorOfRequest(href);
    if (failingAnchors.has(anchor)) return { ok: false, status: 500, json: async () => ({ error: 'section unavailable' }) } as unknown as Response;
    return { ok: true, status: 200, json: async () => prefetchContract(anchor === 'results' ? 2 : 1) } as unknown as Response;
  }));
}

/** The newest observer: a status change rebuilds it, so instances[0] goes stale. */
function liveObserver(): FakeIntersectionObserver {
  return FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
}

function PrefetchHarness() {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const api = usePaperSectionWindow(VERSION, prefetchWindow);
  return (
    <div ref={scrollRootRef} data-testid="scroll-root">
      <PaperSectionWindowView sectionWindow={prefetchWindow} api={api} scrollRootRef={scrollRootRef}>
        <section id="intro" data-paper-chunk="intro" tabIndex={-1}><h2>1 Introduction body</h2></section>
      </PaperSectionWindowView>
    </div>
  );
}

describe('prefetch on approach (M1R3-02)', () => {
  const originalMatchMedia = window.matchMedia;
  let fetchCalls: string[];

  function setLgViewport(matches: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    fetchCalls = [];
    stubPrefetchEnvironment(fetchCalls);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.unstubAllGlobals();
  });

  it('fetches a placeholder that comes within the prefetch margin and never one that stays outside it', async () => {
    setLgViewport(false);
    render(<PrefetchHarness />);
    const observer = FakeIntersectionObserver.instances[0];
    expect(observer).toBeDefined();

    observer.fire([[placeholderFor('methods'), true], [placeholderFor('results'), false]]);

    // Positive side: the approaching placeholder is actually fetched and rendered.
    await waitFor(() => expect(fetchCalls).toHaveLength(1));
    expect(fetchCalls[0]).toBe(`/api/matrix-options/paper/v/${VERSION}/sections/methods?paper=${PREFETCH_SHA}`);
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    // Negative side: the placeholder that never intersected is still a placeholder.
    expect(fetchCalls.some((url) => url.includes('/sections/results'))).toBe(false);
    expect(document.getElementById('results')).toBeNull();
    expect(placeholderFor('results')).toBeInTheDocument();
  });

  it('observes every placeholder with the prefetch margin, re-observes after a load, and disconnects on cleanup', async () => {
    setLgViewport(true);
    const { unmount } = render(<PrefetchHarness />);
    const first = FakeIntersectionObserver.instances[0];
    expect(first).toBeDefined();
    expect(first.options?.rootMargin).toBe(PAPER_SECTION_PREFETCH_ROOT_MARGIN);
    expect(first.options?.threshold).toBe(0);
    // At lg the document column is the scrollport, so the observer is rooted on it.
    expect(first.options?.root).toBe(screen.getByTestId('scroll-root'));
    expect(observedAnchors(first)).toEqual(['methods', 'results']);

    first.fire([[placeholderFor('methods'), true]]);
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());

    // The loaded section leaves the placeholder set, so the observer is rebuilt
    // over what is still unloaded and the superseded one is disconnected.
    const latest = FakeIntersectionObserver.instances[FakeIntersectionObserver.instances.length - 1];
    expect(latest).not.toBe(first);
    expect(observedAnchors(latest)).toEqual(['results']);
    expect(first.disconnectCount).toBeGreaterThan(0);

    unmount();
    expect(latest.disconnectCount).toBeGreaterThan(0);
  });

  it('is rooted on the viewport below lg', () => {
    setLgViewport(false);
    render(<PrefetchHarness />);
    const observer = FakeIntersectionObserver.instances[0];
    expect(observer.options?.root ?? null).toBeNull();
    expect(observedAnchors(observer)).toEqual(['methods', 'results']);
  });
});

/*
 * M1R4-01 (codex r3-luna-1, blocks-commit). The automatic prefetch path used to
 * re-request a section whose status was `error`: `enqueue` cleared errors[index]
 * and re-queued it, the status change rebuilt the observer, and `observe()`
 * re-fired for a still-intersecting target. For a persistently failing section
 * that is an unbounded client retry loop whose visible error never survives.
 * Only the AUTOMATIC path may change, so each of the three EXPLICIT retry routes
 * that must keep working -- the Retry button, Load full document, and navigation
 * through ensureLoaded -- has its own test below.
 */
describe('automatic prefetch never retries a failed section (M1R4-01)', () => {
  let fetchCalls: string[];
  let api: PaperSectionWindowApi | null;

  function RetryHarness() {
    const scrollRootRef = useRef<HTMLDivElement>(null);
    const windowApi = usePaperSectionWindow(VERSION, prefetchWindow);
    api = windowApi;
    return (
      <div ref={scrollRootRef} data-testid="scroll-root">
        <PaperLoadFullDocumentControl api={windowApi} />
        <PaperSectionWindowView sectionWindow={prefetchWindow} api={windowApi} scrollRootRef={scrollRootRef}>
          <section id="intro" data-paper-chunk="intro" tabIndex={-1}><h2>1 Introduction body</h2></section>
        </PaperSectionWindowView>
      </div>
    );
  }

  /** Renders and drives `methods` into the error status through the real loader. */
  async function renderWithFailedMethods() {
    failingAnchors.add('methods');
    render(<RetryHarness />);
    liveObserver().fire([[placeholderFor('methods'), true]]);
    await waitFor(() => expect(within(placeholderFor('methods')).getByRole('alert')).toHaveTextContent('Paper section request failed: 500'));
    expect(placeholderFor('methods').getAttribute('data-paper-section-status')).toBe('error');
    expect(fetchCalls).toHaveLength(1);
    fetchCalls.length = 0;
  }

  const methodsRequests = () => fetchCalls.filter((url) => url.includes('/sections/methods'));

  beforeEach(() => {
    fetchCalls = [];
    api = null;
    stubPrefetchEnvironment(fetchCalls);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('skips an intersecting placeholder that is in error, and still prefetches an intersecting idle one', async () => {
    await renderWithFailedMethods();

    // Both placeholders are intersecting. Only the idle one may be fetched.
    liveObserver().fire([[placeholderFor('methods'), true], [placeholderFor('results'), true]]);
    await waitFor(() => expect(document.getElementById('results')).not.toBeNull());

    // Positive side: the idle placeholder is still prefetched, exactly once.
    expect(fetchCalls.filter((url) => url.includes('/sections/results'))).toHaveLength(1);
    // Negative side: the failed one is never re-requested automatically, and it
    // stays a placeholder rather than being wiped back to a loading state.
    expect(methodsRequests()).toHaveLength(0);
    expect(document.getElementById('methods')).toBeNull();
    expect(placeholderFor('methods').getAttribute('data-paper-section-status')).toBe('error');
  });

  it('keeps the error text and the Retry button through the observer rebuild that a later load causes', async () => {
    await renderWithFailedMethods();
    const before = liveObserver();
    before.fire([[placeholderFor('results'), true]]);
    await waitFor(() => expect(document.getElementById('results')).not.toBeNull());

    // The load changed loadedKey, so the observer was rebuilt over what is left.
    const rebuilt = liveObserver();
    expect(rebuilt).not.toBe(before);
    expect(observedAnchors(rebuilt)).toEqual(['methods']);

    // A rebuilt observer re-fires for a still-intersecting target: that is the
    // exact path that used to wipe the error and re-queue the section.
    rebuilt.fire([[placeholderFor('methods'), true]]);
    await act(async () => { await Promise.resolve(); });
    const placeholder = placeholderFor('methods');
    expect(placeholder.getAttribute('data-paper-section-status')).toBe('error');
    expect(within(placeholder).getByRole('alert')).toHaveTextContent('Paper section request failed: 500');
    expect(within(placeholder).getByRole('button', { name: 'Retry section' })).toBeInTheDocument();
    expect(methodsRequests()).toHaveLength(0);
  });

  it('still retries a failed section from the Retry button', async () => {
    await renderWithFailedMethods();
    failingAnchors.delete('methods');
    fireEvent.click(within(placeholderFor('methods')).getByRole('button', { name: 'Retry section' }));
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    expect(methodsRequests()).toHaveLength(1);
  });

  it('still retries a failed section from Load full document', async () => {
    await renderWithFailedMethods();
    failingAnchors.delete('methods');
    fireEvent.click(screen.getByTestId('paper-load-full-document-button'));
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    expect(methodsRequests()).toHaveLength(1);
  });

  it('still retries a failed section when navigation asks for it', async () => {
    await renderWithFailedMethods();
    failingAnchors.delete('methods');
    // Exactly what RevisedPaperWorkspace.navigateToAnchor does for a target that
    // is not in the DOM: ensureLoaded with priority.
    act(() => { expect(api?.ensureLoaded(1, true)).toBe(true); });
    await waitFor(() => expect(document.getElementById('methods')).not.toBeNull());
    expect(methodsRequests()).toHaveLength(1);
  });
});
