import { render, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { acceptedFigureAssetHref, getAcceptedFiguresContract, type AcceptedFigureBinding } from '@/lib/matrix-options/paper/accepted-figures';
import * as releases from '@/lib/matrix-options/paper/releases';

import { AcceptedPaperFigure, acceptedFigureOpensInOwnTab } from '../AcceptedPaperFigure';

/*
 * The "Open full-size image" link opens the image alone in a new tab. That tab is
 * outside the page's session gate, so it would go on showing a private figure after
 * the reader signed out. The rule: only a figure of a repository release has the
 * link. Both sides are shown here on the same component and the same binding, with
 * only the delivery of the binding's release changed.
 */

vi.mock('@/lib/matrix-options/paper/releases', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/matrix-options/paper/releases')>();
  return { ...original, getPaperRelease: vi.fn(original.getPaperRelease) };
});

const { R5_PAPER_VERSION, DEFAULT_PAPER_VERSION } = releases;
// The module as it really is: the lookup the mocked one stands in front of.
const realGetPaperRelease = (await vi.importActual<typeof import('@/lib/matrix-options/paper/releases')>('@/lib/matrix-options/paper/releases')).getPaperRelease;

const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;
const placement = contract.placements[0];
const asset = contract.assets.find((candidate) => candidate.id === placement.assetId)!;

// Synthetic text around the contract's real ids: the contract holds no text.
function binding(releaseIdentity: string): AcceptedFigureBinding {
  return { releaseIdentity, placement, asset, caption: `Figure ${placement.figureId}. A synthetic caption.`, status: 'SYNTHETIC_STATUS', alt: 'A synthetic description.' };
}

/** Everything in the figure that could open the image by itself. */
function ownTabAffordances(figure: Element): Element[] {
  return Array.from(figure.querySelectorAll('a, [target], [href], .paper-figure__actions'));
}

afterEach(() => {
  vi.mocked(releases.getPaperRelease).mockImplementation(realGetPaperRelease);
});

describe('AcceptedPaperFigure: a link that opens the image in a tab of its own', () => {
  it('is not offered for the private-storage draft: the figure has its image and caption, and no link at all', () => {
    expect(realGetPaperRelease(R5_PAPER_VERSION)?.delivery).toBe('private-storage');
    const { container } = render(<AcceptedPaperFigure figure={binding(R5_PAPER_VERSION)} />);
    const figure = container.querySelector('figure[data-accepted-figure]')!;
    // The figure itself is drawn, from the authenticated route.
    expect(figure.querySelector('img')).toHaveAttribute('src', acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset }));
    expect(figure.querySelector('figcaption')).toHaveTextContent(`Figure ${placement.figureId}. A synthetic caption.`);
    expect(within(figure as HTMLElement).queryAllByRole('link')).toEqual([]);
    expect(ownTabAffordances(figure)).toEqual([]);
    expect(figure.innerHTML).not.toContain('_blank');
    expect(figure).not.toHaveTextContent('Open full-size image');
  });

  it('is offered when the same figure belongs to a repository release: one link, to the image, in a new tab', () => {
    vi.mocked(releases.getPaperRelease).mockImplementation((version) => {
      const release = realGetPaperRelease(version);
      return release ? { ...release, delivery: 'repository' } : null;
    });
    const { container } = render(<AcceptedPaperFigure figure={binding(R5_PAPER_VERSION)} />);
    const figure = container.querySelector('figure[data-accepted-figure]')!;
    const link = within(figure as HTMLElement).getByRole('link', { name: `Open full-size image of Figure ${placement.figureId} in a new tab` });
    expect(link).toHaveAttribute('href', acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset }));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(figure as HTMLElement).getAllByRole('link')).toHaveLength(1);
  });

  it('is not offered for a release this application does not know', () => {
    const { container } = render(<AcceptedPaperFigure figure={binding('no-such-release')} />);
    expect(ownTabAffordances(container.querySelector('figure[data-accepted-figure]')!)).toEqual([]);
  });

  it('follows the delivery of the release and nothing else', () => {
    expect(acceptedFigureOpensInOwnTab(R5_PAPER_VERSION)).toBe(false);
    expect(acceptedFigureOpensInOwnTab(DEFAULT_PAPER_VERSION)).toBe(true);
    expect(acceptedFigureOpensInOwnTab('no-such-release')).toBe(false);
    expect(acceptedFigureOpensInOwnTab('')).toBe(false);
  });
});
