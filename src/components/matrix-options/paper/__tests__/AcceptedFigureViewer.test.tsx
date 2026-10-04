import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

interface AuthValue {
  session: { user?: { id?: string; is_anonymous?: boolean } | null } | null;
  isLoading: boolean;
  authUnverified: boolean;
  refreshSession: () => Promise<void>;
}

// The application's own auth state, as AuthContext hands it to every component. A test changes
// it and re-renders. `useAuthCalls` shows whether a component asked for it at all.
const auth = vi.hoisted(() => ({ current: null as unknown, calls: 0 }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => {
    auth.calls += 1;
    if (auth.current === null) throw new Error('useAuth must be used within an AuthProvider');
    return auth.current;
  },
}));

import { acceptedFigureAssetHref, getAcceptedFiguresContract, type AcceptedFigureBinding } from '@/lib/matrix-options/paper/accepted-figures';
import * as releases from '@/lib/matrix-options/paper/releases';

import { ACCEPTED_FIGURE_VIEWER_REQUEST, AcceptedFigureViewer } from '../AcceptedFigureViewer';
import { AcceptedPaperFigure, acceptedFigureOpensInOwnTab, acceptedFigureViewsInPage } from '../AcceptedPaperFigure';
import { PrivateReleaseReaderContext, PrivateReleaseSessionGate } from '../PrivateReleaseSessionGate';

/*
 * The full-size viewer of a private-storage figure. It lives inside the page's
 * session gate, asks the authenticated route for the bytes again on every open,
 * draws them on a canvas (the image is given no address at all), and is cleared and closed
 * the moment the session is no longer the reader's. Synthetic text around the
 * contract's real ids: the contract holds no text.
 */

vi.mock('@/lib/matrix-options/paper/releases', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/matrix-options/paper/releases')>();
  return { ...original, getPaperRelease: vi.fn(original.getPaperRelease) };
});

const { R5_PAPER_VERSION, DEFAULT_PAPER_VERSION } = releases;
const realGetPaperRelease = (await vi.importActual<typeof import('@/lib/matrix-options/paper/releases')>('@/lib/matrix-options/paper/releases')).getPaperRelease;

const READER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const READER = { user: { id: READER_ID, is_anonymous: false } };
const signedIn = (overrides: Partial<AuthValue> = {}): AuthValue => ({ session: READER, isLoading: false, authUnverified: false, refreshSession: vi.fn(async () => undefined), ...overrides });
const signedOut = (): AuthValue => signedIn({ session: null });

const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;
const placement = contract.placements[0];
const asset = contract.assets.find((candidate) => candidate.id === placement.assetId)!;
const FIGURE_NAME = `Figure ${placement.figureId}`;
const HREF = acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset });

function binding(releaseIdentity: string = R5_PAPER_VERSION): AcceptedFigureBinding {
  return { releaseIdentity, placement, asset, caption: `${FIGURE_NAME}. A synthetic caption.`, status: 'SYNTHETIC_STATUS', alt: 'A synthetic description.' };
}

/** The figure inside the real gate, as the publication page renders it. */
const gated = (servedTo: string = READER_ID): ReactElement => <PrivateReleaseSessionGate servedTo={servedTo}><AcceptedPaperFigure figure={binding()} /></PrivateReleaseSessionGate>;
/** The viewer alone under a reader, with no gate to remove it: what the viewer does by itself. */
const viewerAlone = (servedTo: string | null = READER_ID): ReactElement => (
  <PrivateReleaseReaderContext.Provider value={servedTo}>
    <AcceptedFigureViewer src={HREF} alt="A synthetic description." width={asset.width} height={asset.height} figureName={FIGURE_NAME} />
  </PrivateReleaseReaderContext.Provider>
);

interface Answer { readonly ok: boolean; readonly status: number; readonly headers: { get: (name: string) => string | null }; readonly blob: () => Promise<Blob> }
const png = (): Answer => ({ ok: true, status: 200, headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'image/png' : null) }, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) });
const refusal = (status: number): Answer => ({ ok: false, status, headers: { get: () => 'application/json' }, blob: async () => new Blob(['{}']) });

let fetchMock: ReturnType<typeof vi.fn>;
let decode: ReturnType<typeof vi.fn>;
let released: Mock<(image: unknown) => void>;
let drawImage: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;
let decodedSize: { width: number; height: number };
let replace: ReturnType<typeof vi.fn>;
let showModal: ReturnType<typeof vi.fn>;

const trigger = () => screen.getByRole('button', { name: `View full-size image of ${FIGURE_NAME}` });
const queryTrigger = () => screen.queryByTestId('accepted-figure-view-full-size');
const dialog = () => screen.queryByTestId('accepted-figure-viewer');
const shownImage = () => dialog()?.querySelector('canvas') ?? null;

/** Opens the viewer and lets the answer arrive. */
async function open(): Promise<void> {
  await act(async () => { fireEvent.click(trigger()); });
}

beforeEach(() => {
  auth.current = signedIn();
  auth.calls = 0;
  fetchMock = vi.fn(async () => png());
  vi.stubGlobal('fetch', fetchMock);
  // jsdom decodes no image and draws on no canvas: both calls are recorded. Each decoded image is its own
  // object, with the bound pixel size unless a test says otherwise, and records its release.
  decodedSize = { width: asset.width, height: asset.height };
  released = vi.fn<(image: unknown) => void>();
  decode = vi.fn(async () => { const image = { ...decodedSize, close: () => released(image) }; return image; });
  vi.stubGlobal('createImageBitmap', decode);
  drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({ drawImage })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
  // No address is ever made for the image: any call would be a defect.
  createObjectURL = vi.fn(() => 'blob:never');
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  // jsdom has no modal dialog: the call is recorded and the element is marked open, as a browser marks it.
  showModal = vi.fn(function mark(this: HTMLDialogElement) { this.setAttribute('open', ''); });
  (HTMLDialogElement.prototype as unknown as { showModal: unknown }).showModal = showModal;
  replace = vi.fn();
  vi.stubGlobal('location', { href: 'http://localhost/matrix-options/paper', pathname: '/matrix-options/paper', search: '', hash: '', replace, assign: vi.fn() });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.mocked(releases.getPaperRelease).mockImplementation(realGetPaperRelease);
  delete (HTMLDialogElement.prototype as unknown as { showModal?: unknown }).showModal;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('which figure has the viewer', () => {
  it('follows the delivery of the release: the viewer for private storage, the link for the repository, neither for an unknown release', () => {
    expect(acceptedFigureViewsInPage(R5_PAPER_VERSION)).toBe(true);
    expect(acceptedFigureOpensInOwnTab(R5_PAPER_VERSION)).toBe(false);
    expect(acceptedFigureViewsInPage(DEFAULT_PAPER_VERSION)).toBe(false);
    expect(acceptedFigureOpensInOwnTab(DEFAULT_PAPER_VERSION)).toBe(true);
    for (const unknown of ['no-such-release', '']) {
      expect(acceptedFigureViewsInPage(unknown)).toBe(false);
      expect(acceptedFigureOpensInOwnTab(unknown)).toBe(false);
    }
  });

  it('a private-storage figure inside the gate has the button and still nothing that opens the image by itself', () => {
    const { container } = render(gated());
    const figure = container.querySelector('figure[data-accepted-figure]') as HTMLElement;
    expect(trigger()).toBeEnabled();
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('type', 'button');
    expect(within(figure).queryAllByRole('link')).toEqual([]);
    expect(Array.from(figure.querySelectorAll('a, [target], [href], .paper-figure__actions'))).toEqual([]);
    expect(figure.innerHTML).not.toContain('_blank');
    // Nothing is asked for and nothing is open until the reader asks.
    expect(dialog()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a repository release keeps its link and has no viewer', () => {
    vi.mocked(releases.getPaperRelease).mockImplementation((version) => {
      const release = realGetPaperRelease(version);
      return release ? { ...release, delivery: 'repository' } : null;
    });
    render(gated());
    expect(screen.getByRole('link', { name: `Open full-size image of ${FIGURE_NAME} in a new tab` })).toHaveAttribute('href', HREF);
    expect(queryTrigger()).toBeNull();
  });

  it('outside a session gate the viewer offers nothing, and does not even ask for the session', () => {
    auth.current = null;
    render(<AcceptedPaperFigure figure={binding()} />);
    expect(queryTrigger()).toBeNull();
    expect(auth.calls).toBe(0);
    // An empty reader id is no reader either.
    render(viewerAlone(''));
    render(viewerAlone(null));
    expect(queryTrigger()).toBeNull();
    expect(auth.calls).toBe(0);
  });
});

describe('opening the viewer', () => {
  it('asks the authenticated route again, with no cached answer, and draws only what it then sends, with no address of any kind', async () => {
    render(gated());
    await open();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HREF);
    expect(init).toMatchObject({ cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect({ ...ACCEPTED_FIGURE_VIEWER_REQUEST }).toEqual({ cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    const viewer = dialog()!;
    expect(viewer).toHaveAttribute('data-view', 'shown');
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(viewer).toHaveAccessibleName(`${FIGURE_NAME}, full size`);
    const image = shownImage()!;
    // The bytes the server sent were decoded once and drawn, whole, on a canvas of the bound pixel size.
    expect(decode).toHaveBeenCalledTimes(1);
    expect(decode.mock.calls[0][0]).toBeInstanceOf(Blob);
    expect(image.tagName).toBe('CANVAS');
    expect(image).toHaveAttribute('width', String(asset.width));
    expect(image).toHaveAttribute('height', String(asset.height));
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledWith(await decode.mock.results[0].value, 0, 0);
    // It is an image to assistive technology, named by the accepted description.
    expect(within(viewer).getByRole('img', { name: 'A synthetic description.' })).toBe(image);
    // The image has no address of any kind: no element that loads from one, no link, nothing made for it.
    expect(viewer.querySelectorAll('img, a, [src], [href], [target]')).toHaveLength(0);
    expect(viewer.innerHTML).not.toMatch(/https?:|blob:|data:|\/storage\/|\/api\/|token=|sha256=/);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(released).not.toHaveBeenCalled();
  });

  it('says it is checking until the answer arrives, with focus already in the dialog', async () => {
    let answer!: (value: Answer) => void;
    fetchMock.mockImplementation(() => new Promise<Answer>((resolve) => { answer = resolve; }));
    render(gated());
    await open();
    expect(dialog()).toHaveAttribute('data-view', 'checking');
    expect(within(dialog()!).getByRole('status')).toHaveTextContent(`Checking your session and loading ${FIGURE_NAME}.`);
    expect(shownImage()).toBeNull();
    expect(screen.getByTestId('accepted-figure-viewer-close')).toHaveFocus();
    await act(async () => { answer(png()); });
    expect(dialog()).toHaveAttribute('data-view', 'shown');
  });

  it('asks again on every open: nothing is kept from the last time', async () => {
    render(gated());
    await open();
    fireEvent.click(screen.getByTestId('accepted-figure-viewer-close'));
    await open();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The first image was released when the dialog closed; the second is a new decode of a new answer.
    expect(decode).toHaveBeenCalledTimes(2);
    expect(released).toHaveBeenCalledTimes(1);
    expect(released).toHaveBeenCalledWith(await decode.mock.results[0].value);
    expect(shownImage()).not.toBeNull();
  });

  it.each([
    ['401 (signed out on the server)', async () => refusal(401)],
    ['503 (the release cannot be read)', async () => refusal(503)],
    ['an answer that is not the PNG', async () => ({ ...png(), headers: { get: () => 'text/html' } })],
    ['a refusal that still names the PNG type', async () => ({ ...png(), ok: false, status: 403 })],
    ['a failed request', async () => { throw new TypeError('network'); }],
  ] as const)('a refusal is said in words and nothing is shown: %s', async (_name, answer) => {
    fetchMock.mockImplementation(answer);
    render(gated());
    await open();
    expect(dialog()).toHaveAttribute('data-view', 'refused');
    expect(screen.getByTestId('accepted-figure-viewer-refused')).toHaveAttribute('role', 'alert');
    expect(shownImage()).toBeNull();
    expect(decode).not.toHaveBeenCalled();
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('bytes that do not decode to the bound pixel size are released and not shown', async () => {
    decodedSize = { width: asset.width + 1, height: asset.height };
    render(gated());
    await open();
    expect(dialog()).toHaveAttribute('data-view', 'refused');
    expect(shownImage()).toBeNull();
    expect(drawImage).not.toHaveBeenCalled();
    expect(released).toHaveBeenCalledTimes(1);
  });

  it('bytes that do not decode at all are a refusal', async () => {
    decode.mockImplementation(async () => { throw new DOMException('not an image', 'InvalidStateError'); });
    render(gated());
    await open();
    expect(dialog()).toHaveAttribute('data-view', 'refused');
    expect(shownImage()).toBeNull();
  });
});

describe('closing the viewer', () => {
  it('"Close" closes it, releases the image and returns focus to the button', async () => {
    render(gated());
    await open();
    fireEvent.click(screen.getByTestId('accepted-figure-viewer-close'));
    expect(dialog()).toBeNull();
    expect(released).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveFocus();
  });

  it('Escape (the dialog closing itself) does the same', async () => {
    render(gated());
    await open();
    fireEvent(dialog()!, new Event('close'));
    expect(dialog()).toBeNull();
    expect(released).toHaveBeenCalledTimes(1);
    expect(trigger()).toHaveFocus();
  });

  it('a press on the backdrop closes it; a press inside does not', async () => {
    render(gated());
    await open();
    fireEvent.click(shownImage()!);
    expect(dialog()).not.toBeNull();
    fireEvent.click(dialog()!);
    expect(dialog()).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('fits the image to the window first and shows it at its own size on request', async () => {
    render(gated());
    await open();
    const fit = within(dialog()!).getByRole('button', { name: 'Fit to window' });
    expect(fit).toHaveAttribute('aria-pressed', 'true');
    expect(shownImage()!.className.split(/\s+/)).toContain('paper-figure-viewer__image--fit');
    fireEvent.click(fit);
    expect(fit).toHaveAttribute('aria-pressed', 'false');
    expect(shownImage()!.className.split(/\s+/)).not.toContain('paper-figure-viewer__image--fit');
    // The stage can take focus, so the keyboard can scroll the image.
    expect(within(dialog()!).getByRole('group', { name: `${FIGURE_NAME}, full-size image` })).toHaveAttribute('tabindex', '0');
  });
});

describe('the session is no longer the reader\'s', () => {
  const lost: readonly (readonly [string, AuthValue])[] = [
    ['signed out', signedOut()],
    ['another reader signed in', signedIn({ session: { user: { id: OTHER_ID, is_anonymous: false } } })],
    ['the same id, anonymous', signedIn({ session: { user: { id: READER_ID, is_anonymous: true } } })],
    ['a session that could not be verified', signedIn({ authUnverified: true })],
  ];

  it.each(lost)('the viewer itself clears and closes at once: %s', async (_name, state) => {
    const view = render(viewerAlone());
    await open();
    expect(shownImage()).not.toBeNull();
    auth.current = state;
    view.rerender(viewerAlone());
    expect(dialog()).toBeNull();
    expect(released).toHaveBeenCalledTimes(1);
    expect(queryTrigger()).toBeDisabled();
    // Focus is not sent back to a button the reader may no longer use.
    expect(queryTrigger()).not.toHaveFocus();
    // The other side: the reader's own session leaves the open dialog alone.
  });

  it('the reader\'s own session keeps the dialog open across a re-render', async () => {
    const view = render(viewerAlone());
    await open();
    auth.current = signedIn();
    view.rerender(viewerAlone());
    expect(shownImage()).not.toBeNull();
    expect(released).not.toHaveBeenCalled();
  });

  it.each(lost.slice(0, 2))('inside the gate the whole page goes, the open dialog with it: %s', async (_name, state) => {
    const view = render(gated());
    await open();
    auth.current = state;
    view.rerender(gated());
    expect(dialog()).toBeNull();
    expect(queryTrigger()).toBeNull();
    expect(released).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it.each(lost)('an answer that arrives afterwards is dropped unseen: %s', async (_name, state) => {
    let answer!: (value: Answer) => void;
    fetchMock.mockImplementation(() => new Promise<Answer>((resolve) => { answer = resolve; }));
    const view = render(viewerAlone());
    await open();
    const signal = (fetchMock.mock.calls[0] as [string, RequestInit])[1].signal!;
    expect(signal.aborted).toBe(false);
    auth.current = state;
    view.rerender(viewerAlone());
    expect(signal.aborted).toBe(true);
    await act(async () => { answer(png()); });
    // Whatever was decoded from the late answer was released again, and nothing was drawn.
    expect(released).toHaveBeenCalledTimes(decode.mock.calls.length);
    expect(drawImage).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('does not open at all without the reader\'s session', async () => {
    auth.current = signedOut();
    render(viewerAlone());
    expect(queryTrigger()).toBeDisabled();
    await act(async () => { fireEvent.click(queryTrigger()!); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it('nothing is kept when the figure leaves the document while its image is held', async () => {
    const view = render(viewerAlone());
    await open();
    expect(released).not.toHaveBeenCalled();
    view.unmount();
    expect(released).toHaveBeenCalledTimes(1);
  });
});
