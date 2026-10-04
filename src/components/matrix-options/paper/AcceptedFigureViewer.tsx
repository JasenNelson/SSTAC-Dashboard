'use client';

import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';

import { PrivateReleaseReaderContext, privateReleaseReaderState } from './PrivateReleaseSessionGate';

/*
 * The full-size view of one accepted figure of a PRIVATE-STORAGE release: a modal
 * dialog in the page, opened by a button under the figure.
 *
 * Why not a link. A tab that holds the image alone is outside the page's session
 * gate (PrivateReleaseSessionGate): it would go on showing the image after the
 * reader signed out or another reader signed in. This viewer stays inside the
 * gate, so it is gone with the page, and it holds the image under the same rule.
 *
 * What it shows, and when:
 * - it exists only inside a gate (PrivateReleaseReaderContext names the reader the
 *   page was rendered for). Outside one it renders nothing;
 * - the button works only while the browser's session is a verified, non-anonymous
 *   session of that reader (privateReleaseReaderState, the gate's own rule);
 * - opening asks the application's authenticated figures route for the bytes
 *   again, with `no-store`: the server checks the feature gate, the reader and the
 *   bytes on that request, and only what it then sends is shown. A refusal (401,
 *   503, a network failure, anything that is not the PNG of the bound pixel size)
 *   is said in words;
 * - the bytes are decoded in memory and DRAWN on a canvas. The image is given no
 *   address of any kind: no Storage address, no signed address, no object or data
 *   address, no link. (The page's content security policy allows an image only
 *   from this origin, so an object address would not even be drawn.)
 * - the moment the session is no longer that reader's (sign-out, another reader,
 *   a session that could not be verified) the request is aborted, the decoded
 *   image is released and the dialog is closed. The same happens when the gate
 *   removes the page, and when the reader closes the dialog.
 *
 * Keyboard: the button opens it (Enter or Space); focus moves into the dialog;
 * Escape and "Close" close it, and focus returns to the button.
 */

export interface AcceptedFigureViewerProps {
  /** The application's authenticated figures route for this asset (acceptedFigureAssetHref). */
  readonly src: string;
  /** The accepted description of the figure: the accessible name of the drawn image. */
  readonly alt: string;
  /** The bound pixel size of the artwork; bytes that decode to another size are not shown. */
  readonly width: number;
  readonly height: number;
  /** "Figure 6-1", for the button, the dialog title and the refusal note. */
  readonly figureName: string;
}

type View =
  | { readonly status: 'closed' }
  | { readonly status: 'checking' }
  | { readonly status: 'shown'; readonly image: ImageBitmap }
  | { readonly status: 'refused' };

const CLOSED: View = Object.freeze({ status: 'closed' });

/** What the request for the bytes carries: never a cached answer, the reader's own cookies, no redirect followed. */
export const ACCEPTED_FIGURE_VIEWER_REQUEST = Object.freeze({ cache: 'no-store', credentials: 'same-origin', redirect: 'error' } as const);

export function AcceptedFigureViewer(props: AcceptedFigureViewerProps) {
  const servedTo = useContext(PrivateReleaseReaderContext);
  // Outside a session gate there is no reader to hold the image for: nothing is offered.
  if (typeof servedTo !== 'string' || servedTo === '') return null;
  return <AcceptedFigureViewerForReader {...props} servedTo={servedTo} />;
}

function AcceptedFigureViewerForReader({ src, alt, width, height, figureName, servedTo }: AcceptedFigureViewerProps & { readonly servedTo: string }) {
  const { session, isLoading, authUnverified } = useAuth();
  const allowed = privateReleaseReaderState({ session, isLoading }, servedTo) === 'allowed' && !authUnverified;
  const [view, setView] = useState<View>(CLOSED);
  const [fit, setFit] = useState(true);
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const held = useRef<ImageBitmap | null>(null);
  const returnFocus = useRef(false);
  const titleId = useId();

  /** Drops everything the viewer holds: the request in flight and the decoded image. */
  const discard = useCallback(() => {
    request.current?.abort();
    request.current = null;
    held.current?.close();
    held.current = null;
  }, []);

  const close = useCallback((refocus: boolean) => {
    discard();
    returnFocus.current = refocus;
    setView(CLOSED);
  }, [discard]);

  // The session is no longer the reader's: clear and close at once, whatever the dialog was showing.
  useEffect(() => {
    if (!allowed) close(false);
  }, [allowed, close]);

  // The gate removed the page (or the figure left the document): nothing is kept.
  useEffect(() => discard, [discard]);

  // Focus goes back to the button once the dialog is out of the document (while it is modal, the button cannot take focus).
  useEffect(() => {
    if (view.status !== 'closed' || !returnFocus.current) return;
    returnFocus.current = false;
    // The page did not move while the dialog was open, so the button is where the reader left it.
    trigger.current?.focus({ preventScroll: true });
  }, [view.status]);

  const open = useCallback(async () => {
    if (!allowed) return;
    discard();
    const controller = new AbortController();
    request.current = controller;
    setFit(true);
    setView({ status: 'checking' });
    const current = () => request.current === controller && !controller.signal.aborted;
    try {
      const response = await fetch(src, { ...ACCEPTED_FIGURE_VIEWER_REQUEST, signal: controller.signal });
      if (!response.ok || !(response.headers.get('content-type') ?? '').toLowerCase().startsWith('image/png')) throw new Error('refused');
      const image = await createImageBitmap(await response.blob());
      // Closed, or the session changed, while the answer was on its way: the image is released unseen.
      // So is an image that is not the bound artwork's size.
      if (!current() || image.width !== width || image.height !== height) {
        image.close();
        if (current()) setView({ status: 'refused' });
        return;
      }
      held.current = image;
      setView({ status: 'shown', image });
    } catch {
      if (current()) setView({ status: 'refused' });
    }
  }, [allowed, discard, height, src, width]);

  const showModal = useCallback((dialog: HTMLDialogElement | null) => {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);

  const shown = view.status === 'shown' ? view.image : null;
  /** Draws the decoded image on the canvas the moment the canvas is in the document. */
  const draw = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || shown === null) return;
    canvas.getContext('2d')?.drawImage(shown, 0, 0);
  }, [shown]);

  return (
    <div className="paper-figure__viewer print:hidden">
      <button ref={trigger} type="button" disabled={!allowed} aria-haspopup="dialog" data-testid="accepted-figure-view-full-size" onClick={() => { void open(); }}>
        {/* The space is its own text node: whitespace at the edge of a visually hidden span is not reliably kept in the accessible name. */}
        View full-size image{' '}<span className="sr-only">of {figureName}</span>
      </button>
      {view.status === 'closed' ? null : (
        <dialog
          ref={showModal}
          className="paper-figure-viewer"
          data-testid="accepted-figure-viewer"
          data-view={view.status}
          aria-labelledby={titleId}
          // Escape ends in `close`; so does anything else that closes the dialog itself.
          onClose={() => close(true)}
          // A press on the backdrop is a press on the dialog element itself, outside its content.
          onClick={(event) => { if (event.target === event.currentTarget) close(true); }}
        >
          <div className="paper-figure-viewer__bar">
            <h2 id={titleId} className="paper-figure-viewer__title">{figureName}, full size</h2>
            {view.status === 'shown' ? (
              <button type="button" aria-pressed={fit} onClick={() => setFit((value) => !value)}>Fit to window</button>
            ) : null}
            <button type="button" autoFocus data-testid="accepted-figure-viewer-close" onClick={() => close(true)}>Close</button>
          </div>
          {view.status === 'shown' ? (
            // Focusable, so the keyboard can scroll an image larger than the window.
            <div className="paper-figure-viewer__stage" tabIndex={0} role="group" aria-label={`${figureName}, full-size image`}>
              {/* The accepted artwork exactly as the server sent it for this session, drawn pixel for pixel. */}
              <canvas
                ref={draw}
                className={fit ? 'paper-figure-viewer__image paper-figure-viewer__image--fit' : 'paper-figure-viewer__image'}
                role="img"
                aria-label={alt}
                width={view.image.width}
                height={view.image.height}
                data-testid="accepted-figure-viewer-image"
              />
            </div>
          ) : view.status === 'checking' ? (
            <p className="paper-figure-viewer__note" role="status">Checking your session and loading {figureName}.</p>
          ) : (
            <p className="paper-figure-viewer__note" role="alert" data-testid="accepted-figure-viewer-refused">{figureName} could not be opened. Your session may have ended: close this, then sign in again.</p>
          )}
        </dialog>
      )}
    </div>
  );
}
