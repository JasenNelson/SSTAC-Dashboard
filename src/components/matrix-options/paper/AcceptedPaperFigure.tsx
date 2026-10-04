import ScrollFadeRegion from '@/components/ScrollFadeRegion';
import {
  acceptedFigureAssetHref,
  acceptedFigureDomId,
  splitAcceptedFigureCaption,
  type AcceptedFigureBinding,
} from '@/lib/matrix-options/paper/accepted-figures';
import { getPaperRelease } from '@/lib/matrix-options/paper/releases';

import { ACCEPTED_FIGURE_IMAGE_CLASS, AcceptedFigureImage } from './AcceptedFigureImage';
import { AcceptedFigureViewer } from './AcceptedFigureViewer';

/*
 * One accepted figure of a release: the exact accepted PNG, with the caption,
 * status and alternative text of its own placement block in the release text
 * (lib/matrix-options/paper/accepted-figures.ts). That text is shown as the
 * binding carries it: the server proved the whole release text, and each
 * block's text against its placement, before any of it reached a reader.
 * No directive: rendered by PaperText on the server document and in the client
 * section window alike.
 *
 * The image is the accepted artwork, never a redraw, so nothing about it is
 * themed: it sits on a white plate in light, dark and print alike, which is the
 * ground it was drawn on. Its intrinsic size is declared, so the page reserves
 * the figure's height before the bytes arrive and nothing shifts when they do.
 *
 * The artwork's lettering is drawn into the image. The image is therefore sized
 * from its own shape (globals.css .paper-figure__image, driven by the
 * --paper-figure-ratio set here): height-capped so a square or portrait figure
 * does not fill the screen, and with a legible floor for wide figures. In a
 * column clearly narrower than that floor the plate keeps the image at the
 * floor and scrolls sideways inside the figure (the same scroll-and-fade
 * affordance the paper's wide tables use); the page itself never scrolls
 * sideways.
 *
 * "Open full-size image" gives the whole image its own tab for zooming, for a
 * repository release only. A tab that holds the image alone is outside the page's
 * session gate (PrivateReleaseSessionGate): it would go on showing the image
 * after the reader signed out or another reader signed in. So a figure of a
 * private-storage release has no such link, and no other address that opens
 * the image by itself. It has "View full-size image" instead: a dialog in the
 * page, inside the gate, that asks the authenticated route for the bytes again
 * and is cleared and closed with the reader's session (AcceptedFigureViewer).
 *
 * The image loads eagerly: a section is only in the document once it has been
 * loaded, and print needs every figure of every loaded section. The image
 * itself is a small client component (AcceptedFigureImage) so a load that is
 * refused or fails is said in words with a retry, never left as a broken mark.
 */

export { ACCEPTED_FIGURE_IMAGE_CLASS };

/** Width / height of the bound artwork, to four decimals: the one number the figure's sizing rules use. */
export function acceptedFigureRatio(asset: Pick<AcceptedFigureBinding['asset'], 'width' | 'height'>): number {
  return Number((asset.width / asset.height).toFixed(4));
}

/**
 * Whether a figure of this release may link to its image in a tab of its own. Only a
 * release known to be a repository release: a private-storage release, and a release
 * identity this application does not know, get no such link.
 */
export function acceptedFigureOpensInOwnTab(releaseIdentity: string): boolean {
  return getPaperRelease(releaseIdentity)?.delivery === 'repository';
}

/**
 * Whether a figure of this release has the in-page full-size viewer instead: only a
 * release known to be a private-storage release. The viewer itself offers nothing
 * outside a session gate (AcceptedFigureViewer).
 */
export function acceptedFigureViewsInPage(releaseIdentity: string): boolean {
  return getPaperRelease(releaseIdentity)?.delivery === 'private-storage';
}

export function AcceptedPaperFigure({ figure }: { readonly figure: AcceptedFigureBinding }) {
  const { placement, asset } = figure;
  const id = acceptedFigureDomId(placement.figureId);
  const captionId = `paper-figure-caption-${id}`;
  const { label, text } = splitAcceptedFigureCaption({ figureId: placement.figureId, caption: figure.caption });
  const href = acceptedFigureAssetHref(figure);
  const opensInOwnTab = acceptedFigureOpensInOwnTab(figure.releaseIdentity);
  const viewsInPage = acceptedFigureViewsInPage(figure.releaseIdentity);
  return (
    <figure
      id={id}
      className="paper-figure paper-figure--accepted"
      data-accepted-figure={placement.figureId}
      data-semantic-asset={asset.id}
      data-asset-sha256={asset.sha256}
      data-section-anchor={placement.sectionAnchor}
      data-binding="accepted"
      aria-labelledby={captionId}
    >
      <ScrollFadeRegion className="paper-figure__plate" fadeFrom="from-white" captionText="Swipe to see the whole figure">
        <AcceptedFigureImage src={href} alt={figure.alt} width={asset.width} height={asset.height} ratio={acceptedFigureRatio(asset)} figureName={label.replace(/\.$/, '')} />
      </ScrollFadeRegion>
      <figcaption id={captionId} className="paper-figure__caption">
        <span className="paper-figure__number">{label}</span> {text}
        <span className="paper-figure__status-line" data-testid={`accepted-figure-status-${id}`}>Status: {figure.status}</span>
      </figcaption>
      {opensInOwnTab ? (
        <p className="paper-figure__actions print:hidden">
          <a href={href} target="_blank" rel="noopener noreferrer">
            {/* The space is its own text node: whitespace at the edge of a visually hidden span is not reliably kept in the accessible name. */}
            Open full-size image{' '}<span className="sr-only">of {label.replace(/\.$/, '')} in a new tab</span>
          </a>
        </p>
      ) : viewsInPage ? (
        <AcceptedFigureViewer src={href} alt={figure.alt} width={asset.width} height={asset.height} figureName={label.replace(/\.$/, '')} />
      ) : null}
    </figure>
  );
}

/**
 * A placement block that has no binding: its figure id, its asset file or the
 * shape of its lines is not what the contract binds. It is said in words where
 * the figure would be; no image is requested.
 */
export function AcceptedPaperFigureUnavailable({ figureId }: { readonly figureId: string }) {
  return (
    <figure className="paper-figure paper-figure--accepted" data-accepted-figure-unavailable={figureId} data-binding="unbound">
      <p className="paper-figure__status" role="note">Figure {figureId} could not be verified against the accepted figure for this draft, so it is not shown.</p>
    </figure>
  );
}
