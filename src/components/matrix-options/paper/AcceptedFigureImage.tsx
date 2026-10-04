'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

/*
 * The image of one accepted figure, with a visible failure state.
 *
 * The figures route is authenticated and rate limited, so a request can be
 * refused (an expired session, a busy minute) or the bytes can be unavailable.
 * A bare <img> would then show only the browser's broken-image mark with no way
 * forward. Here a failed load is said in words where the image would be, with a
 * "Try again" button that requests the same address once more.
 *
 * A load that failed BEFORE this component hydrated fires no React event, so
 * the image's own state is also checked once on mount.
 */

export const ACCEPTED_FIGURE_IMAGE_CLASS = 'paper-figure__image';

export interface AcceptedFigureImageProps {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  /** Width / height of the artwork, for the sizing rules in globals.css. */
  readonly ratio: number;
  /** "Figure 6-1", for the failure note. */
  readonly figureName: string;
}

export function AcceptedFigureImage({ src, alt, width, height, ratio, figureName }: AcceptedFigureImageProps) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) setFailed(true);
  }, [attempt]);

  if (failed) {
    return (
      <div className="paper-figure__load-failed" role="note" data-testid="accepted-figure-load-failed">
        <p>{figureName} did not load.</p>
        {/* The accepted description stays available while the image is missing (it is the
            image's own alternative text, unchanged), so no reader loses what the figure shows. */}
        {alt ? <p data-testid="accepted-figure-load-failed-description">{alt}</p> : null}
        <button
          type="button"
          className="print:hidden"
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    // A plain <img>: the accepted bytes come from an authenticated route, which next/image's
    // server-side optimizer cannot fetch with the reader's session, and they must not be re-encoded.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      // A new element per attempt, so "Try again" issues a new request for the same address.
      key={attempt}
      ref={imageRef}
      className={ACCEPTED_FIGURE_IMAGE_CLASS}
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{ '--paper-figure-ratio': ratio } as CSSProperties}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
