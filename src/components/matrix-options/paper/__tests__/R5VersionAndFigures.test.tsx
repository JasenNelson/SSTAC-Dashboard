import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptedFigureAssetHref, getAcceptedFiguresContract } from '@/lib/matrix-options/paper/accepted-figures';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import type { CohortPortion } from '@/lib/matrix-options/paper/cohort-portions';
import { getPaperRelease, PAPER_RELEASES, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '@/lib/matrix-options/paper/releases';
import { getReviewLineage, reviewLineageView } from '@/lib/matrix-options/paper/review-lineage';
import { getReviewerGuideContract } from '@/lib/matrix-options/reviewer-guide';
import { questionTitle } from '@/lib/matrix-options/paper/review-navigation';
import {
  frontMatterTitleBlock,
  maskFrontMatter,
  pandocAnchorSpans,
  parseFrontMatter,
  presentFencedDivs,
  presentPreambleMarkdown,
  stripPandocAnchorSpans,
} from '@/lib/matrix-options/paper/source-presentation';
import type { PaperUrlState } from '@/lib/matrix-options/paper/url-state';
import { REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';
import { getProductionAssignment } from '@/lib/matrix-options/revised-paper-review';

import { AcceptedFigureImage } from '../AcceptedFigureImage';
import { ACCEPTED_FIGURE_IMAGE_CLASS, acceptedFigureRatio } from '../AcceptedPaperFigure';
import type { PaperOutlineNavEntry } from '../PaperOutlineNav';
import { PAPER_PRINT_IMAGE_WAIT_MS, PaperDocumentToolbar, waitForPaperFigureImages } from '../PaperSectionWindow';
import type { PaperSectionWindowApi } from '../PaperSectionWindow';
import { PaperText } from '../PaperText';
import { PaperVersionControl, PaperVersionStatus, PaperWithheldNotice, paperVersionHref } from '../PaperVersionControl';
import { RevisedPaperWorkspace } from '../RevisedPaperWorkspace';
import { SYNTHETIC_CHANGED_HEADING, SYNTHETIC_CHANGED_PROMPT, syntheticResolvedR5Guide } from './r5-synthetic-guide';

/*
 * Units 2 and 4 at the component level: the draft version control and its
 * status line, an accepted figure block drawn (or refused) by PaperText, the
 * pandoc presentation helpers, and the print wait for figure images.
 */

const contract = getAcceptedFiguresContract(R5_PAPER_VERSION)!;
const predecessorBase = `/matrix-options/paper/publication/v/${REVISED_PAPER_VERSION}`;
const r5Base = `/matrix-options/paper/publication/v/${R5_PAPER_VERSION}`;
// The workspace is handed its reviewer guide by the server page. The private-storage draft's
// own guide text is in no file here, so its tests hand it a guide with synthetic text.
const defaultGuide = getReviewerGuideContract();
const r5Guide = syntheticResolvedR5Guide();

/*
 * The text of a placement block is the release's own: the contract binds it by
 * hash and holds none of it. These blocks carry synthetic text around the
 * contract's real figure ids and asset files.
 */
const SYNTHETIC_STATUS = 'SYNTHETIC_STATUS; FOR_TESTS';
const SYNTHETIC_ALT = 'A synthetic alternative description of the figure.';
const syntheticCaption = (figureId: string) => `Figure ${figureId}. A synthetic caption for figure ${figureId}.`;

function block(figureId: string, overrides: { caption?: string; status?: string; alt?: string; file?: string } = {}): string {
  const placement = contract.placements.find((candidate) => candidate.figureId === figureId)!;
  const asset = contract.assets.find((candidate) => candidate.id === placement.assetId)!;
  return [
    `<!-- MATRIX_FIGURE_PLACEMENT: ${figureId} -->`,
    '',
    `[]{#fig-${figureId.toLowerCase()}}${overrides.caption ?? syntheticCaption(figureId)}`,
    '',
    `**Status: ${overrides.status ?? SYNTHETIC_STATUS}**`,
    '',
    `![${overrides.alt ?? SYNTHETIC_ALT}](assets/${overrides.file ?? asset.file})`,
  ].join('\n');
}

describe('PaperText: accepted figure blocks', () => {
  it('draws a block with the contract\'s figure id and asset file as the accepted PNG, with the block\'s own caption, status and alternative text', () => {
    const placement = contract.placements.find((candidate) => candidate.figureId === '7-1')!;
    const asset = contract.assets.find((candidate) => candidate.id === placement.assetId)!;
    const { container } = render(<PaperText markdown={`Before the figure.\n\n${block('7-1')}\n\nAfter the figure.`} />);
    const figure = container.querySelector('figure#fig-7-1');
    expect(figure).not.toBeNull();
    const image = figure!.querySelector('img')!;
    expect(image).toHaveAttribute('src', acceptedFigureAssetHref({ releaseIdentity: R5_PAPER_VERSION, asset }));
    expect(image).toHaveAttribute('alt', SYNTHETIC_ALT);
    expect(image).toHaveAttribute('width', String(asset.width));
    expect(image).toHaveAttribute('height', String(asset.height));
    expect(image).toHaveClass(ACCEPTED_FIGURE_IMAGE_CLASS);
    // The sizing rules read the artwork's own shape: width / height of the bound pixel size.
    expect(image.style.getPropertyValue('--paper-figure-ratio')).toBe(String(acceptedFigureRatio(asset)));
    expect(acceptedFigureRatio(asset)).toBeCloseTo(asset.width / asset.height, 4);
    expect(image.getAttribute('src')).not.toContain('assets/');
    expect(figure!.querySelector('figcaption')).toHaveTextContent(syntheticCaption('7-1'));
    expect(screen.getByTestId('accepted-figure-status-fig-7-1').textContent).toBe(`Status: ${SYNTHETIC_STATUS}`);
    // The figure is tied to its bound placement and asset by id and hash, never by its text.
    expect(figure).toHaveAttribute('data-semantic-asset', asset.id);
    expect(figure).toHaveAttribute('data-asset-sha256', asset.sha256);
    expect(figure).toHaveAttribute('data-section-anchor', placement.sectionAnchor);
    // The figure is named by its caption.
    expect(figure).toHaveAttribute('aria-labelledby', figure!.querySelector('figcaption')!.id);
    // This draft is a private-storage release: nothing in the figure opens the image by itself,
    // in a new tab or otherwise (AcceptedPaperFigureOwnTab.test.tsx has both sides of the rule).
    expect(within(figure as HTMLElement).queryAllByRole('link')).toEqual([]);
    expect(figure!.querySelector('a, [target], .paper-figure__actions')).toBeNull();
    // The prose around it is still prose, and nothing of the block is left in it.
    expect(container).toHaveTextContent('Before the figure.');
    expect(container).toHaveTextContent('After the figure.');
    expect(container.innerHTML).not.toContain('MATRIX_FIGURE_PLACEMENT');
    expect(container.innerHTML).not.toContain('{#fig-');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('draws a shared asset under each of its placements with that placement\'s own caption and id', () => {
    const shared = contract.assets.find((asset) => asset.placementIds.length === 2)!;
    const [firstId, secondId] = shared.placementIds;
    const { container } = render(<PaperText markdown={`${block(firstId)}\n\nBetween.\n\n${block(secondId)}`} />);
    const figures = Array.from(container.querySelectorAll('figure[data-accepted-figure]'));
    expect(figures.map((figure) => figure.getAttribute('data-accepted-figure'))).toEqual([firstId, secondId]);
    expect(new Set(figures.map((figure) => figure.id)).size).toBe(2);
    expect(new Set(figures.map((figure) => figure.querySelector('img')?.getAttribute('src'))).size).toBe(1);
    expect(figures[0].querySelector('figcaption')?.textContent).not.toBe(figures[1].querySelector('figcaption')?.textContent);
  });

  it('shows whatever caption, status and alternative text the block carries: the contract holds no text to compare it with', () => {
    // The text is proven on the server, where the whole release and each block's joined text
    // are checked against their bound hashes before anything is served
    // (lib/matrix-options/paper/accepted-figures-server.ts). The reader draws what it is given.
    const { container } = render(<PaperText markdown={block('7-1', { caption: 'Figure 7-1. Another caption.', status: 'ANOTHER_STATUS', alt: 'Another description.' })} />);
    const figure = container.querySelector('figure#fig-7-1')!;
    expect(figure.querySelector('img')).toHaveAttribute('alt', 'Another description.');
    expect(figure.querySelector('figcaption')).toHaveTextContent('Figure 7-1. Another caption.');
    expect(screen.getByTestId('accepted-figure-status-fig-7-1').textContent).toBe('Status: ANOTHER_STATUS');
    // No text member of the contract exists for the reader to have used instead.
    for (const entry of [...contract.assets, ...contract.placements]) {
      expect(Object.keys(entry).filter((key) => ['caption', 'alt', 'status'].includes(key))).toEqual([]);
    }
  });

  it.each([
    ['a caption that carries another figure\'s number', { caption: 'Figure 7-2. A caption of some other figure.' }],
    ['a caption with no figure number', { caption: 'A caption with no label.' }],
    ['another bound asset file', { file: 'FIG6-1.png' }],
    ['an unbound asset file', { file: 'FIG9-9.png' }],
  ])('refuses a block with %s: a note in words, no image and no caption', (_name, overrides) => {
    const { container } = render(<PaperText markdown={`Before.\n\n${block('7-1', overrides)}\n\nAfter.`} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelector('#fig-7-1')).toBeNull();
    const note = container.querySelector('[data-accepted-figure-unavailable="7-1"]');
    expect(note).toHaveTextContent('Figure 7-1 could not be verified against the accepted figure for this draft, so it is not shown.');
    expect(within(note as HTMLElement).getByRole('note')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('assets/');
    expect(container).toHaveTextContent('Before.');
    expect(container).toHaveTextContent('After.');
  });

  it('refuses a marker for a figure the contract does not have, and one with no block after it', () => {
    const unknown = block('7-1').replace('MATRIX_FIGURE_PLACEMENT: 7-1', 'MATRIX_FIGURE_PLACEMENT: 9-9');
    const first = render(<PaperText markdown={unknown} />);
    expect(first.container.querySelector('img')).toBeNull();
    expect(first.container.querySelector('[data-accepted-figure-unavailable="9-9"]')).not.toBeNull();
    first.unmount();
    const bare = render(<PaperText markdown={'Text.\n\n<!-- MATRIX_FIGURE_PLACEMENT: 7-1 -->\n\nMore text.'} />);
    expect(bare.container.querySelector('img')).toBeNull();
    expect(bare.container.querySelector('[data-accepted-figure-unavailable="7-1"]')).not.toBeNull();
    expect(bare.container).toHaveTextContent('More text.');
  });

  it('leaves markdown without a placement marker exactly as it was (the predecessor path)', () => {
    const { container } = render(<PaperText markdown={'A paragraph.\n\n**Status: DRAFT.** Prepared under review.\n\n![alt](assets/FIG6-1.png)'} />);
    expect(container.querySelector('figure')).toBeNull();
    expect(container.querySelector('strong')).toHaveTextContent('Status: DRAFT.');
    // An ordinary Markdown image is not an accepted figure and is not rewritten into one.
    expect(container.querySelector('img')).not.toHaveClass(ACCEPTED_FIGURE_IMAGE_CLASS);
  });
});

describe('AcceptedFigureImage: a figure that does not load', () => {
  const props = { src: '/api/matrix-options/paper/v/x/figures/FIG6-1.png?sha256=abc', alt: 'An alternative description.', width: 1430, height: 579, ratio: 2.4698, figureName: 'Figure 6-1' };

  it('says in words that the figure did not load, and "Try again" requests the same address with a new element', () => {
    const { container } = render(<AcceptedFigureImage {...props} />);
    const first = container.querySelector('img')!;
    expect(first).toHaveAttribute('src', props.src);
    expect(screen.queryByTestId('accepted-figure-load-failed')).toBeNull();
    fireEvent.error(first);
    const note = screen.getByTestId('accepted-figure-load-failed');
    expect(note).toHaveTextContent('Figure 6-1 did not load.');
    expect(note).toHaveAttribute('role', 'note');
    // The figure's own description is still there while the image is not.
    expect(within(note).getByTestId('accepted-figure-load-failed-description')).toHaveTextContent('An alternative description.');
    // No broken image is left behind.
    expect(container.querySelector('img')).toBeNull();
    fireEvent.click(within(note).getByRole('button', { name: 'Try again' }));
    const second = container.querySelector('img')!;
    expect(second).toHaveAttribute('src', props.src);
    expect(second).not.toBe(first);
    expect(screen.queryByTestId('accepted-figure-load-failed')).toBeNull();
    // A second failure is reported again (no silent give-up).
    fireEvent.error(second);
    expect(screen.getByTestId('accepted-figure-load-failed')).toBeInTheDocument();
  });

  it('two-sided: an image that loads shows no note', () => {
    const { container } = render(<AcceptedFigureImage {...props} />);
    fireEvent.load(container.querySelector('img')!);
    expect(screen.queryByTestId('accepted-figure-load-failed')).toBeNull();
    expect(container.querySelector('img')).toHaveClass(ACCEPTED_FIGURE_IMAGE_CLASS);
  });

  it('catches a load that failed before the component hydrated (complete, zero natural width)', () => {
    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0);
    try {
      render(<AcceptedFigureImage {...props} />);
      expect(screen.getByTestId('accepted-figure-load-failed')).toHaveTextContent('Figure 6-1 did not load.');
    } finally {
      complete.mockRestore();
      naturalWidth.mockRestore();
    }
  });
});

describe('paperVersionHref', () => {
  const r5 = getPaperRelease(R5_PAPER_VERSION)!;
  const predecessor = getPaperRelease(REVISED_PAPER_VERSION)!;

  it('carries the reader\'s section by stable id through the other draft\'s section route', () => {
    expect(paperVersionHref(r5, { mode: 'working-draft', cohort: null, stableSectionId: 'sec-7-8' })).toBe(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-7-8`);
    expect(paperVersionHref(predecessor, { mode: 'working-draft', cohort: null, stableSectionId: 'app-b' })).toBe(`/matrix-options/paper/v/${REVISED_PAPER_VERSION}/app-b`);
  });

  it('opens the other draft at its start when there is no stable section', () => {
    expect(paperVersionHref(r5, { mode: 'working-draft', cohort: null, stableSectionId: null })).toBe(`${r5Base}?mode=working-draft`);
  });

  it('keeps My Review and the review topic, and never a question or a section', () => {
    expect(paperVersionHref(r5, { mode: 'my-review', cohort: 'methods-water-type', stableSectionId: 'sec-7-8' })).toBe(`${r5Base}?mode=my-review&cohort=methods-water-type`);
    expect(paperVersionHref(predecessor, { mode: 'my-review', cohort: null, stableSectionId: null })).toBe(`${predecessorBase}?mode=my-review`);
    for (const context of [{ mode: 'my-review', cohort: 'categories', stableSectionId: 'sec-4-1' }, { mode: 'working-draft', cohort: null, stableSectionId: 'sec-4-1' }] as const) {
      expect(paperVersionHref(r5, context)).not.toContain('q=');
      expect(paperVersionHref(r5, context)).not.toContain('rpq');
    }
  });
});

describe('PaperVersionControl and PaperVersionStatus', () => {
  const context = { mode: 'working-draft', cohort: null, stableSectionId: 'sec-7-8' } as const;
  // Owner decision (interim release): the working draft is named "Current review draft" and the
  // default predecessor "Earlier draft (default)". No name carries a version number, none says
  // responses are kept or saved, and none says the working draft will become the default.
  const DEFAULT_OPTION_TEXT = 'Earlier draft (default)The earlier draft of the paper. It is still the default draft. Responses to it are separate from responses to the current review draft.';
  const R5_OPTION_TEXT = 'Current review draftThe current review draft of the paper, shown as a preview. It is not the default draft. Responses to it are separate from responses to the earlier draft.';
  const R5_STATUS_TEXT = 'Current review draft. A preview: not the default draft. Responses to this draft are separate from the earlier draft.';

  it('binds exactly these names, and none of them names a version, a saved response or a future default', () => {
    const [defaultRelease, r5Release] = PAPER_RELEASES;
    expect(defaultRelease).toMatchObject({ documentVersion: REVISED_PAPER_VERSION, label: 'Earlier draft (default)', shortLabel: 'Earlier draft', summary: 'The earlier draft of the paper. It is still the default draft. Responses to it are separate from responses to the current review draft.' });
    expect(r5Release).toMatchObject({ documentVersion: R5_PAPER_VERSION, label: 'Current review draft', shortLabel: 'Current draft', summary: 'The current review draft of the paper, shown as a preview. It is not the default draft. Responses to it are separate from responses to the earlier draft.' });
    for (const text of [DEFAULT_OPTION_TEXT, R5_OPTION_TEXT, R5_STATUS_TEXT, 'Go to the earlier draft']) {
      expect(text).not.toMatch(/0\.9\.8|1\.0\.11|\bkept\b|\bsaved\b|\byet\b/i);
    }
  });

  it('names the draft on screen and lists both bound drafts, the current one not a link', () => {
    render(<PaperVersionControl documentVersion={REVISED_PAPER_VERSION} buttonClassName="btn" {...context} />);
    const toggle = screen.getByTestId('paper-version-toggle');
    expect(toggle).toHaveAccessibleName('Draft version: Earlier draft');
    expect(toggle).toHaveAttribute('aria-haspopup', 'dialog');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('paper-version-popover')).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const popover = screen.getByRole('dialog', { name: 'Draft version' });
    expect(popover).toBe(screen.getByTestId('paper-version-popover'));
    expect(toggle).toHaveAttribute('aria-controls', popover.id);
    const current = within(popover).getByTestId(`paper-version-option-${REVISED_PAPER_VERSION}`);
    expect(current.tagName).toBe('DIV');
    expect(current).toHaveAttribute('aria-current', 'true');
    // The two names swap between the drafts, so each option is found by its test id and its
    // whole text is compared.
    expect(current.textContent).toBe(`${DEFAULT_OPTION_TEXT}You are viewing this draft.`);
    const other = within(popover).getByTestId(`paper-version-option-${R5_PAPER_VERSION}`);
    expect(other.tagName).toBe('A');
    expect(other).toHaveAttribute('href', `/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-7-8`);
    expect(other.textContent).toBe(R5_OPTION_TEXT);
    const v0991 = within(popover).getByTestId(`paper-version-option-${V0991_PAPER_VERSION}`);
    expect(v0991.tagName).toBe('A');
    expect(v0991).toHaveAttribute('href', expect.stringContaining(`/matrix-options/paper/v/${V0991_PAPER_VERSION}`));
    expect(v0991.textContent).toBe(`${getPaperRelease(V0991_PAPER_VERSION)?.label}${getPaperRelease(V0991_PAPER_VERSION)?.summary}`);
    expect(within(popover).getAllByRole('link')).toHaveLength(2);
    // Every bound release is offered, each exactly once.
    expect(within(popover).getAllByRole('listitem')).toHaveLength(PAPER_RELEASES.length);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('paper-version-popover')).toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
  });

  it('on the working draft, offers the default draft as the link and marks the working draft current', () => {
    const onOpen = vi.fn();
    render(<PaperVersionControl documentVersion={R5_PAPER_VERSION} buttonClassName="btn" onOpen={onOpen} {...context} />);
    const toggle = screen.getByTestId('paper-version-toggle');
    expect(toggle).toHaveAccessibleName('Draft version: Current draft');
    fireEvent.click(toggle);
    expect(onOpen).toHaveBeenCalledTimes(1);
    const popover = screen.getByTestId('paper-version-popover');
    expect(within(popover).getByTestId(`paper-version-option-${R5_PAPER_VERSION}`)).toHaveAttribute('aria-current', 'true');
    expect(within(popover).getByTestId(`paper-version-option-${R5_PAPER_VERSION}`).textContent).toBe(`${R5_OPTION_TEXT}You are viewing this draft.`);
    expect(within(popover).getByTestId(`paper-version-option-${REVISED_PAPER_VERSION}`).textContent).toBe(DEFAULT_OPTION_TEXT);
    expect(within(popover).getByTestId(`paper-version-option-${REVISED_PAPER_VERSION}`)).toHaveAttribute('href', `/matrix-options/paper/v/${REVISED_PAPER_VERSION}/sec-7-8`);
    expect(within(popover).getByTestId(`paper-version-option-${V0991_PAPER_VERSION}`)).toHaveAttribute('href', expect.stringContaining(`/matrix-options/paper/v/${V0991_PAPER_VERSION}`));
    fireEvent.click(within(popover).getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('paper-version-popover')).toBeNull();
    expect(toggle).toHaveFocus();
    // Closing does not count as opening.
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a version that is not a bound release', () => {
    const { container } = render(<><PaperVersionControl documentVersion="unknown" buttonClassName="btn" {...context} /><PaperVersionStatus documentVersion="unknown" {...context} /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the status line only for a draft that is not the default', () => {
    const none = render(<PaperVersionStatus documentVersion={REVISED_PAPER_VERSION} {...context} />);
    expect(none.container).toBeEmptyDOMElement();
    none.unmount();
    render(<PaperVersionStatus documentVersion={R5_PAPER_VERSION} {...context} />);
    const status = screen.getByTestId('paper-version-status');
    expect(status).toHaveAttribute('role', 'note');
    expect(status.textContent).toBe(`${R5_STATUS_TEXT}Go to the earlier draft`);
    expect(within(status).getAllByRole('link')).toHaveLength(1);
    expect(within(status).getByRole('link', { name: 'Go to the earlier draft' })).toHaveAttribute('href', `/matrix-options/paper/v/${REVISED_PAPER_VERSION}/sec-7-8`);
    expect(status.className).toContain('print:hidden');
  });
});

describe('RevisedPaperWorkspace: draft version in the header', () => {
  const R5_STATUS_TEXT = 'Current review draft. A preview: not the default draft. Responses to this draft are separate from the earlier draft.';
  const WITHHELD_NOTICE = 'Appendix L is under revision and is not included in this presentation.';
  const outline: readonly PaperOutlineNavEntry[] = [
    { id: 'n1', anchor: 'intro', label: '1 Introduction', depth: 1, level: 1, parentId: null, childIds: ['n2'] },
    { id: 'n2', anchor: 'scope', label: '1.1 Scope', depth: 2, level: 2, parentId: 'n1', childIds: ['n3'] },
    { id: 'n3', anchor: 'detail', label: '1.1.1 Detail', depth: 3, level: 3, parentId: 'n2', childIds: [] },
    { id: 'n4', anchor: 'methods', label: '2 Methods', depth: 1, level: 1, parentId: null, childIds: [] },
  ];
  const stableSectionIds = { scope: 'sec-1-1', methods: 'sec-2-0' };
  const state = (overrides: Partial<PaperUrlState> = {}): PaperUrlState => ({ mode: 'working-draft', cohort: null, q: null, section: null, ...overrides });
  const originalScrollBy = window.scrollBy;

  function FakeDocument() {
    return <article>{outline.map((entry) => <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1}><h2>{entry.label} body</h2></section>)}</article>;
  }

  beforeEach(() => {
    const host = document.createElement('div');
    host.id = 'matrix-options-paper-header-actions';
    document.body.appendChild(host);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: vi.fn() });
    window.scrollBy = vi.fn() as unknown as typeof window.scrollBy;
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    document.getElementById('matrix-options-paper-header-actions')?.remove();
    window.scrollBy = originalScrollBy;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('default draft: the control is in the header controls, and there is no status line', () => {
    render(<RevisedPaperWorkspace guide={defaultGuide} documentVersion={REVISED_PAPER_VERSION} urlState={state()} assignment={getProductionAssignment()} outline={outline} stableSectionIds={stableSectionIds}><FakeDocument /></RevisedPaperWorkspace>);
    const controls = screen.getByTestId('workspace-header-controls');
    expect(within(controls).getByTestId('paper-version-toggle')).toHaveAccessibleName('Draft version: Earlier draft');
    expect(screen.queryByTestId('paper-version-status')).toBeNull();
    // The other header actions are still there, in the same group.
    expect(within(controls).getByRole('button', { name: 'Download Files' })).toBeInTheDocument();
    expect(within(controls).getByRole('link', { name: 'Working Draft' })).toHaveAttribute('href', `${predecessorBase}?mode=working-draft`);
  });

  it('working draft: says it is not the default, links its own modes, and carries the section being read to the default draft', () => {
    render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} urlState={state({ section: 'detail' })} assignment={getProductionAssignment()} outline={outline} stableSectionIds={stableSectionIds}><FakeDocument /></RevisedPaperWorkspace>);
    const controls = screen.getByTestId('workspace-header-controls');
    expect(within(controls).getByTestId('paper-version-toggle')).toHaveAccessibleName('Draft version: Current draft');
    expect(within(controls).getByRole('link', { name: 'Working Draft' })).toHaveAttribute('href', `${r5Base}?mode=working-draft`);
    expect(within(controls).getByRole('link', { name: 'My Review' }).getAttribute('href')).toContain(`${r5Base}?mode=my-review`);
    const status = screen.getByTestId('paper-version-status');
    expect(status).toHaveTextContent(R5_STATUS_TEXT);
    // "1.1.1 Detail" has no stable id of its own: its nearest numbered ancestor "1.1 Scope" does.
    expect(within(status).getByRole('link', { name: 'Go to the earlier draft' })).toHaveAttribute('href', `/matrix-options/paper/v/${REVISED_PAPER_VERSION}/sec-1-1`);
  });

  it('working draft: Download Files says plainly that this draft has none', () => {
    render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} urlState={state()} assignment={getProductionAssignment()} outline={outline}><FakeDocument /></RevisedPaperWorkspace>);
    fireEvent.click(within(screen.getByTestId('workspace-header-controls')).getByRole('button', { name: 'Download Files' }));
    const popover = screen.getByTestId('download-files-popover');
    expect(popover).toHaveTextContent('Download files are not available for this draft.');
    expect(popover).not.toHaveTextContent('being prepared');
    expect(within(popover).queryByRole('link')).toBeNull();
    // Without stable ids the default draft is opened at its start.
    expect(within(screen.getByTestId('paper-version-status')).getByRole('link')).toHaveAttribute('href', `${predecessorBase}?mode=working-draft`);
  });

  it('working draft My Review: asks the questions of the guide it was handed, and marks the reworded Q11 as needing a new response', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const portions: CohortPortion[] = getCohortManifest(R5_PAPER_VERSION).cohorts.map((cohort) => ({
      id: `${cohort.id}:paper-portion`,
      cohortId: cohort.id,
      name: cohort.name,
      status: 'available' as const,
      sectionNumber: '4.4',
      sourceLocator: 'Section 4.4',
      sourceNodeId: `node:${cohort.id}`,
      sectionLabel: cohort.name,
      startByte: 0,
      endByte: 42,
      text: `# ${cohort.name} source context\n\nAuthenticated bounded excerpt.`,
      sectionAnchor: `anchor-${cohort.id}`,
    }));
    const lineage = reviewLineageView(getReviewLineage(R5_PAPER_VERSION)!, 'c'.repeat(64));
    const q11 = r5Guide.questions[10];
    const first = render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} reviewManifestSha256={'b'.repeat(64)} urlState={state({ mode: 'my-review', cohort: 'methods-water-type', q: q11.id })} assignment={getProductionAssignment()} cohortPortions={portions} reviewLineage={lineage} />);
    // The question text on screen is the text of the guide prop, and of nothing else: this
    // draft's own guide text is in no module the workspace could have read it from.
    expect(q11.heading).toBe(SYNTHETIC_CHANGED_HEADING);
    expect(document.getElementById('active-question-heading')?.textContent).toBe(`Question 11: ${questionTitle(SYNTHETIC_CHANGED_HEADING)}`);
    expect(screen.getByTestId('active-question-response')).toHaveTextContent(SYNTHETIC_CHANGED_PROMPT);
    expect(defaultGuide.questions.some((question) => question.heading === SYNTHETIC_CHANGED_HEADING || question.prompt === SYNTHETIC_CHANGED_PROMPT)).toBe(false);
    expect(screen.getByTestId('review-lineage-changed')).toBeInTheDocument();
    expect(screen.getByTestId('paper-version-status')).toBeInTheDocument();
    // Switching drafts from My Review keeps the topic and drops the question (its id belongs to this draft).
    expect(within(screen.getByTestId('paper-version-status')).getByRole('link')).toHaveAttribute('href', `${predecessorBase}?mode=my-review&cohort=methods-water-type`);
    first.unmount();
    // Two-sided: Q10, in the same topic, has identical text and carries no such note.
    const q10 = r5Guide.questions[9];
    render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} reviewManifestSha256={'b'.repeat(64)} urlState={state({ mode: 'my-review', cohort: 'methods-water-type', q: q10.id })} assignment={getProductionAssignment()} cohortPortions={portions} reviewLineage={lineage} />);
    expect(screen.getByRole('heading', { name: /^Question 10: / })).toBeInTheDocument();
    expect(screen.queryByTestId('review-lineage-changed')).toBeNull();
  });

  it('working draft: shows the one withheld-section notice after the header, outside the paper, and it prints with the paper', () => {
    render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} urlState={state()} assignment={getProductionAssignment()} outline={outline} stableSectionIds={stableSectionIds}><FakeDocument /></RevisedPaperWorkspace>);
    const notices = screen.getAllByTestId('paper-withheld-notice');
    expect(notices).toHaveLength(1);
    const notice = notices[0];
    expect(notice).toHaveAttribute('role', 'note');
    // Editorial, and marked as such: the workspace's own label, then the one sentence, and nothing else.
    expect(notice).toHaveAttribute('data-editorial-notice');
    expect(within(notice).getByTestId('paper-withheld-notice-label').textContent).toBe('Workspace note');
    expect(within(notice).getByTestId('paper-withheld-notice-text').textContent).toBe(WITHHELD_NOTICE);
    expect(notice.textContent).toBe(`Workspace note${WITHHELD_NOTICE}`);
    // Outside the header (which does not print) and directly after it; outside the paper column.
    const header = screen.getByTestId('workspace-header');
    expect(header.className).toContain('print:hidden');
    expect(header.contains(notice)).toBe(false);
    expect(header.nextElementSibling).toBe(notice);
    expect(screen.getByTestId('paper-document-column').contains(notice)).toBe(false);
    expect(screen.getByTestId('workspace-layout').contains(notice)).toBe(false);
    // The Working Draft printout is the paper without that appendix, so the line prints too.
    expect(notice.className).not.toContain('print:hidden');
    expect(notice.className).toContain('shrink-0');
    // Said once on the page: not repeated in the status line or anywhere else.
    expect(document.body.textContent?.split(WITHHELD_NOTICE)).toHaveLength(2);
  });

  it('My Review: shows the same notice once, hidden in print because no paper text prints there', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} reviewManifestSha256={'b'.repeat(64)} urlState={state({ mode: 'my-review', cohort: 'categories' })} assignment={getProductionAssignment()} cohortPortions={[]} />);
    const notices = screen.getAllByTestId('paper-withheld-notice');
    expect(notices).toHaveLength(1);
    expect(within(notices[0]).getByTestId('paper-withheld-notice-text').textContent).toBe(WITHHELD_NOTICE);
    expect(screen.getByTestId('workspace-header').nextElementSibling).toBe(notices[0]);
    expect(notices[0].className.split(/\s+/)).toContain('print:hidden');
  });

  it('default draft: no such notice in either mode (it presents its whole source)', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const workingDraft = render(<RevisedPaperWorkspace guide={defaultGuide} documentVersion={REVISED_PAPER_VERSION} urlState={state()} assignment={getProductionAssignment()} outline={outline}><FakeDocument /></RevisedPaperWorkspace>);
    expect(screen.queryByTestId('paper-withheld-notice')).toBeNull();
    expect(document.body.textContent).not.toContain('under revision');
    workingDraft.unmount();
    render(<RevisedPaperWorkspace guide={defaultGuide} documentVersion={REVISED_PAPER_VERSION} reviewManifestSha256={'a'.repeat(64)} urlState={state({ mode: 'my-review', cohort: 'categories' })} assignment={getProductionAssignment()} cohortPortions={[]} />);
    expect(screen.queryByTestId('paper-withheld-notice')).toBeNull();
    // The component itself renders nothing for a release with no withheld section, or an unknown one.
    const { container } = render(<><PaperWithheldNotice documentVersion={REVISED_PAPER_VERSION} mode="working-draft" /><PaperWithheldNotice documentVersion="unknown" mode="working-draft" /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the contents heading in the review-panel note as the paper shows it: the display label under the working draft, the authored heading under the default', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const withContents: readonly PaperOutlineNavEntry[] = [...outline, { id: 'n5', anchor: 'master-table-of-contents', label: 'Master Table of Contents', depth: 1, level: 1, parentId: null, childIds: [] }];
    function ContentsDocument() {
      return <article>{withContents.map((entry) => <section key={entry.id} id={entry.anchor} data-paper-chunk={entry.anchor} tabIndex={-1}><h2>{entry.anchor} body</h2></section>)}</article>;
    }
    // A reader who follows a typed address to that heading: it has no review question of its own.
    window.history.replaceState(null, '', '/#master-table-of-contents');
    const working = render(<RevisedPaperWorkspace guide={r5Guide} documentVersion={R5_PAPER_VERSION} reviewManifestSha256={'b'.repeat(64)} urlState={state()} assignment={getProductionAssignment()} outline={withContents}><ContentsDocument /></RevisedPaperWorkspace>);
    await waitFor(() => expect(screen.getByTestId('review-section-note')).toHaveTextContent('"Table of Contents" has no review question of its own, so your current question stays open.'));
    expect(screen.getByTestId('review-section-note')).not.toHaveTextContent('Master Table of Contents');
    working.unmount();
    // Two-sided: the default draft names no display label, so its note is unchanged.
    window.history.replaceState(null, '', '/#master-table-of-contents');
    render(<RevisedPaperWorkspace guide={defaultGuide} documentVersion={REVISED_PAPER_VERSION} reviewManifestSha256={'a'.repeat(64)} urlState={state()} assignment={getProductionAssignment()} outline={withContents}><ContentsDocument /></RevisedPaperWorkspace>);
    await waitFor(() => expect(screen.getByTestId('review-section-note')).toHaveTextContent('"Master Table of Contents" has no review question of its own, so your current question stays open.'));
  });
  it('opening the draft version popover closes Download Files, and the reverse', () => {
    render(<RevisedPaperWorkspace guide={defaultGuide} documentVersion={REVISED_PAPER_VERSION} urlState={state()} assignment={getProductionAssignment()} outline={outline}><FakeDocument /></RevisedPaperWorkspace>);
    const controls = screen.getByTestId('workspace-header-controls');
    fireEvent.click(within(controls).getByRole('button', { name: 'Download Files' }));
    expect(screen.getByRole('dialog', { name: 'Download files' })).toBeInTheDocument();
    fireEvent.click(within(controls).getByTestId('paper-version-toggle'));
    expect(screen.getByRole('dialog', { name: 'Draft version' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Download files' })).toBeNull();
    fireEvent.click(within(controls).getByRole('button', { name: 'Download Files' }));
    expect(screen.getByRole('dialog', { name: 'Download files' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Draft version' })).toBeNull();
  });
});

describe('pandoc source presentation helpers', () => {
  const FRONT = '---\ntitle: "A Title"\nsubtitle: "A subtitle"\nauthor: "An Author"\ndate: "1 October 2026"\nlang: en-CA\n---\n';

  it('parses a simple front-matter block and nothing else', () => {
    const parsed = parseFrontMatter(`${FRONT}\nBody`);
    expect(parsed?.length).toBe(FRONT.length);
    expect(parsed?.fields).toEqual({ title: 'A Title', subtitle: 'A subtitle', author: 'An Author', date: '1 October 2026', lang: 'en-CA' });
    expect(parseFrontMatter('Body\n---\ntitle: x\n---\n')).toBeNull();
    expect(parseFrontMatter('---\ntitle: "unterminated\n')).toBeNull();
    expect(parseFrontMatter('---\n---\n')).toBeNull();
    expect(parseFrontMatter('---\ntitle: a\ntitle: b\n---\n')).toBeNull();
    expect(parseFrontMatter('---\nnested:\n  key: value\n---\n')).toBeNull();
    expect(parseFrontMatter('---\ntitle: "an \\" escape"\n---\n')).toBeNull();
  });

  it('masks front matter with spaces of the same length, keeping every line break and every later offset', () => {
    const source = `${FRONT}\n## First heading\n`;
    const masked = maskFrontMatter(source);
    expect(masked).toHaveLength(source.length);
    expect(masked.slice(FRONT.length)).toBe(source.slice(FRONT.length));
    expect(masked.slice(0, FRONT.length)).toMatch(/^[ \n]+$/);
    expect(masked.split('\n')).toHaveLength(source.split('\n').length);
    expect(masked.indexOf('## First heading')).toBe(source.indexOf('## First heading'));
    // No front matter: the very same string.
    expect(maskFrontMatter('## Heading\n')).toBe('## Heading\n');
  });

  it('shows only the fields the source carries as a title block, never longer than the block it replaces', () => {
    const block = frontMatterTitleBlock(parseFrontMatter(FRONT)!.fields);
    expect(block).toBe('# A Title\n\n**A subtitle**\n\nAn Author\\\n1 October 2026\n');
    expect(block.length).toBeLessThanOrEqual(FRONT.length);
    expect(block).not.toContain('lang');
    expect(frontMatterTitleBlock({ title: 'Only' })).toBe('# Only\n');
    expect(frontMatterTitleBlock({})).toBe('');
  });

  it('turns a complete fenced div into a block quote and leaves an unmatched fence alone', () => {
    expect(presentFencedDivs('::: {.draft-label}\nDRAFT\n\nNot policy.\n:::\n\nAfter')).toBe('> DRAFT\n>\n> Not policy.\n\nAfter');
    expect(presentFencedDivs('::: {.draft-label}\nDRAFT with no close')).toBe('::: {.draft-label}\nDRAFT with no close');
    expect(presentFencedDivs('No fences here.')).toBe('No fences here.');
  });

  it('removes empty anchor spans only, and reports each with its offset', () => {
    expect(stripPandocAnchorSpans('[]{#tbl-2}Table 2. Title')).toBe('Table 2. Title');
    expect(stripPandocAnchorSpans('[text]{#keep} and [](#link) and {#bare}')).toBe('[text]{#keep} and [](#link) and {#bare}');
    expect(pandocAnchorSpans('a []{#fig-6-1}b []{#tbl-2}c')).toEqual([{ id: 'fig-6-1', offset: 2 }, { id: 'tbl-2', offset: 16 }]);
    expect(pandocAnchorSpans('nothing')).toEqual([]);
  });

  it('presents a preamble only for a release bound as having front matter', () => {
    const preamble = `${FRONT}\n::: {.draft-label}\nDRAFT\n:::\n`;
    expect(presentPreambleMarkdown(preamble, undefined)).toBe(preamble);
    expect(presentPreambleMarkdown(preamble, { frontMatter: false })).toBe(preamble);
    const shown = presentPreambleMarkdown(preamble, { frontMatter: true });
    expect(shown).toBe('# A Title\n\n**A subtitle**\n\nAn Author\\\n1 October 2026\n\n> DRAFT\n');
    expect(shown.length).toBeLessThanOrEqual(preamble.length);
  });
});

describe('waitForPaperFigureImages', () => {
  function figureImage(complete: boolean): HTMLImageElement {
    const image = document.createElement('img');
    image.className = ACCEPTED_FIGURE_IMAGE_CLASS;
    Object.defineProperty(image, 'complete', { configurable: true, get: () => complete });
    return image;
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves at once when there is no figure image, or every one has loaded', async () => {
    const root = document.createElement('div');
    root.appendChild(document.createElement('img'));
    await expect(waitForPaperFigureImages(root)).resolves.toBeUndefined();
    root.appendChild(figureImage(true));
    await expect(waitForPaperFigureImages(root)).resolves.toBeUndefined();
  });

  it('waits for every pending figure image to load or fail before resolving', async () => {
    const root = document.createElement('div');
    const first = figureImage(false);
    const second = figureImage(false);
    root.append(first, second);
    let done = false;
    const waiting = waitForPaperFigureImages(root).then(() => { done = true; });
    first.dispatchEvent(new Event('load'));
    await Promise.resolve();
    expect(done).toBe(false);
    second.dispatchEvent(new Event('error'));
    await waiting;
    expect(done).toBe(true);
  });

  it('Print waits for a figure image that is still loading, then opens the print dialog once', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const pending = figureImage(false);
    document.body.appendChild(pending);
    try {
      const statuses = ['loaded', 'loaded', 'loaded'];
      const api = {
        total: 3, loadedCount: 3, complete: true, loadingAll: false, failedCount: 0,
        snapshot: { statuses, loadedCount: 3, complete: true, loadingAll: false, errors: [null, null, null], results: [undefined, undefined, undefined] },
        loadedKey: statuses.join(','), ensureLoaded: vi.fn(() => true), loadAll: vi.fn(), retry: vi.fn(),
      } as unknown as PaperSectionWindowApi;
      render(<PaperDocumentToolbar api={api} />);
      fireEvent.click(screen.getByTestId('paper-print-button'));
      // Give the print effect every chance to run: it must still be waiting on the image.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(printSpy).not.toHaveBeenCalled();
      pending.dispatchEvent(new Event('load'));
      await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    } finally {
      pending.remove();
      printSpy.mockRestore();
    }
  });

  it('gives up after the timeout, so a stuck image never blocks printing', async () => {
    vi.useFakeTimers();
    const root = document.createElement('div');
    root.appendChild(figureImage(false));
    let done = false;
    void waitForPaperFigureImages(root).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(PAPER_PRINT_IMAGE_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});
