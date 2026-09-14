import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import {
  createWorkspaceModel,
  releaseNoteKey,
} from '@/lib/matrix-options/revised-paper-review';
import { RevisedPaperWorkspace, normalizeReaderTextForDisplay } from '../RevisedPaperWorkspace';

let measuredWidth = 720;
let measuredOverflow = 0;
let resizeCallback: (() => void) | undefined;
const originalRect = HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  measuredWidth = 720;
  measuredOverflow = 0;
  resizeCallback = undefined;
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      if (this.getAttribute('aria-label') === 'Publication workspace') return { width: measuredWidth, height: 0, top: 0, left: 0, right: measuredWidth, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
      return originalRect.call(this);
    },
  });
  Object.defineProperty(document.documentElement, 'scrollWidth', { configurable: true, value: 1280 });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 1280 });
  Object.defineProperty(document.body, 'scrollWidth', { configurable: true, get: () => 1280 + measuredOverflow });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resizeCallback = callback; }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', { configurable: true, value: originalRect });
});

describe('RevisedPaperWorkspace', () => {
  it('removes only standalone generated section anchors for presentation', () => {
    const source = [
      '  <div id="sec-first" class="section-anchor"></div>  ',
      '<div id="sec-second" class="section-anchor"> </div>',
      '<div id="sec-near" class="section-anchor">Keep this content</div>',
      '<div id="sec-other" class="other-anchor"></div>',
    ].join('\r\n');

    expect(normalizeReaderTextForDisplay(source)).toBe([
      '<div id="sec-near" class="section-anchor">Keep this content</div>',
      '<div id="sec-other" class="other-anchor"></div>',
    ].join('\r\n'));
  });

  it('renders a bounded real-release atlas with all six lenses and one-action modes', () => {
    const structure = loadRevisedPaperStructure();
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);

    expect(screen.getByRole('heading', { name: 'Review workspace' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publication' })).toBeInTheDocument();
    for (const lens of ['All', 'Core', 'Appendices', 'Evidence', 'Objects', 'Questions']) {
      expect(screen.getAllByText(lens).length).toBeGreaterThan(0);
    }
    expect(within(screen.getByRole('list', { name: 'Current atlas page' })).getAllByRole('listitem').length).toBeLessThanOrEqual(40);
    expect(screen.getByText('Assignment unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Assignment source:/)).toHaveTextContent('Assignments are not connected for this release.');
    expect(screen.queryByText(/ASSIGNMENT_UNAVAILABLE|LIVE_ASSIGNMENT_SOURCE_NOT_AUTHORIZED/)).not.toBeInTheDocument();
    for (const disposition of ['Feedback submitted', 'No feedback confirmed', 'Deferred with reason', 'Escalated with reason']) {
      expect(screen.getByText(disposition)).toBeInTheDocument();
    }
    expect(screen.getAllByText('unresolved')).toHaveLength(2);
    expect(screen.queryByText(/ACCEPT|REQUEST_CHANGES|REJECT|ABSTAIN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('preserves mode, lens, query, and page on Atlas and question destinations', () => {
    const structure = loadRevisedPaperStructure();
    const query = { lens: 'questions' as const, q: structure.questions[0]?.label ?? '', page: 1 };
    const expectedMyReviewQuery = new URLSearchParams({ mode: 'my-review', lens: query.lens, page: '1', q: query.q }).toString();
    const expectedPublicationQuery = new URLSearchParams({ mode: 'publication', lens: query.lens, page: '1', q: query.q }).toString();

    const { unmount } = render(<RevisedPaperWorkspace model={createWorkspaceModel(structure, query, 'my-review')} />);
    const myReviewAtlasLink = within(screen.getByRole('list', { name: 'Current atlas page' })).getAllByRole('link')[0];
    const myReviewQuestionLink = within(screen.getByRole('heading', { name: 'Unassigned publication questions' }).closest('section') as HTMLElement).getAllByRole('link')[0];
    expect(myReviewAtlasLink).toHaveAttribute('href', expect.stringContaining(`?${expectedMyReviewQuery}`));
    expect(myReviewQuestionLink).toHaveAttribute('href', expect.stringContaining(`?${expectedMyReviewQuery}`));
    unmount();

    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure, query, 'publication')} />);
    const publicationAtlasLink = within(screen.getByRole('list', { name: 'Current atlas page' })).getAllByRole('link')[0];
    const publicationQuestionLink = within(screen.getByRole('heading', { name: 'Unassigned publication questions' }).closest('section') as HTMLElement).getAllByRole('link')[0];
    expect(publicationAtlasLink).toHaveAttribute('href', expect.stringContaining(`?${expectedPublicationQuery}`));
    expect(publicationQuestionLink).toHaveAttribute('href', expect.stringContaining(`?${expectedPublicationQuery}`));
  });

  it('marks every non-paper workspace region print-hidden while preserving the reader', () => {
    const structure = loadRevisedPaperStructure();
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} readerText={'# Printed paper\n\nAuthenticated body.'} />);

    const reader = screen.getByRole('heading', { name: 'Canonical reader' }).closest('section') as HTMLElement;
    const hiddenRegions = [
      screen.getByRole('banner'),
      screen.getByRole('complementary', { name: 'Workspace navigation' }),
      screen.getByRole('heading', { name: 'My Review cockpit' }).closest('section'),
      screen.getByRole('heading', { name: 'Publication Atlas' }).closest('section'),
      screen.getByRole('heading', { name: 'Unassigned publication questions' }).closest('section'),
      screen.getByRole('heading', { name: 'Review ledgers' }).closest('div'),
      screen.getByRole('complementary', { name: 'Context and notes' }),
    ];

    for (const region of hiddenRegions) {
      expect(region).not.toBeNull();
      expect(region).toHaveClass('print:hidden');
    }
    expect(reader).not.toHaveClass('print:hidden');
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(reader).toHaveClass('print:col-span-full', 'print:w-full', 'print:max-w-none');
    expect(within(reader).getByRole('heading', { name: 'Printed paper', level: 1 })).toBeInTheDocument();
    expect(within(reader).getByText('Authenticated body.')).toBeInTheDocument();
  });

  it('renders the bounded reader semantically and keeps raw HTML and unsafe links inert', () => {
    const structure = loadRevisedPaperStructure();
    render(
      <RevisedPaperWorkspace
        model={createWorkspaceModel(structure)}
        readerText={`# Selected heading

**Bold reader copy**

- A semantic list item

<script>window.__paperScriptExecuted = true</script>

[Unsafe link](javascript:alert('paper'))`}
      />,
    );

    const reader = screen.getByRole('region', { name: 'Publication workspace' });
    expect(within(reader).getByRole('heading', { name: 'Selected heading', level: 1 })).toBeInTheDocument();
    expect(within(reader).getByText('Bold reader copy').tagName).toBe('STRONG');
    const renderedReader = reader.querySelector('.math-renderer');
    expect(renderedReader).not.toBeNull();
    expect(renderedReader?.querySelector('ul')).not.toBeNull();
    expect(reader.querySelector('pre')).toBeNull();
    expect(reader.querySelector('script')).toBeNull();
    expect(within(reader).getByText('Unsafe link').closest('a')).toHaveAttribute('href', '');
  });

  it('keeps trust details closed, notes release-bound, and pinning deterministic', () => {
    const structure = loadRevisedPaperStructure();
    const model = createWorkspaceModel(structure, undefined, 'publication');
    render(<RevisedPaperWorkspace model={model} />);

    const main = screen.getByTestId('workspace-shell');
    expect(main).toHaveAttribute('data-pin-eligible', 'true');
    const trustStrip = screen.getByTestId('trust-strip');
    expect(trustStrip).toHaveTextContent(model.documentVersion);
    expect(trustStrip).toHaveTextContent('Repository release');
    expect(trustStrip).toHaveTextContent('Not recorded');
    expect(trustStrip).toHaveTextContent('None recorded');
    expect(trustStrip).toHaveTextContent('Exact source mapping');
    expect(trustStrip).toHaveTextContent('Current release');
    expect(trustStrip).not.toHaveTextContent(/EXACT_BYTES_VERIFIED|REPOSITORY_ARTIFACT|NONE_RECORDED|EXACT_SOURCE_RANGE|CURRENT_EXACT_RELEASE/);
    const rail = screen.getByTestId('context-rail');
    const openButton = screen.getByRole('button', { name: 'Open context' });
    expect(openButton).toBeEnabled();
    expect(screen.queryByTestId('context-drawer')).not.toBeInTheDocument();
    fireEvent.click(openButton);
    const pinButton = screen.getByRole('button', { name: 'Pin context' });
    expect(pinButton).toBeEnabled();
    expect(pinButton).toHaveAttribute('aria-pressed', 'false');
    expect(rail).toHaveAttribute('data-pinned', 'false');
    fireEvent.click(pinButton);
    expect(screen.getByRole('button', { name: 'Unpin context' })).toHaveAttribute('aria-pressed', 'true');
    expect(rail).toHaveAttribute('data-pinned', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Unpin context' }));
    fireEvent.click(openButton);
    expect(screen.getByRole('button', { name: 'Pin context' })).toHaveAttribute('aria-pressed', 'false');
    expect(rail).toHaveAttribute('data-pinned', 'false');
    const closeButton = screen.getByRole('button', { name: 'Close context' });
    fireEvent.click(closeButton);
    expect(screen.queryByTestId('context-drawer')).not.toBeInTheDocument();
    expect(openButton).toHaveFocus();
    fireEvent.click(openButton);
    const note = screen.getByRole('textbox', { name: 'Note' });
    fireEvent.change(note, { target: { value: 'release-local note' } });
    const noteId = model.atlas.rows[0]?.id ?? 'workspace';
    expect(window.localStorage.getItem(releaseNoteKey(model.releaseIdentity, noteId))).toBe('release-local note');
  });

  it('binds reader heading and device-local notes to the requested detail, not the first atlas row', () => {
    const structure = loadRevisedPaperStructure();
    const target = structure.nodes[1];
    const firstAtlasRow = structure.nodes[0];
    expect(target).toBeTruthy();
    expect(firstAtlasRow).toBeTruthy();
    if (!target || !firstAtlasRow) return;
    expect(target.id).not.toBe(firstAtlasRow.id);
    window.localStorage.clear();
    const model = createWorkspaceModel(
      structure,
      { lens: 'all', q: '', page: 1 },
      'publication',
      { id: target.id, domain: target.domain, label: target.label, startByte: target.startByte, endByte: target.endByte, ownerNodeId: null },
    );
    render(<RevisedPaperWorkspace model={model} readerText="# Requested detail\n\nExact range." />);

    expect(screen.getByRole('heading', { name: target.label })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: target.label }).closest('section')).toHaveAttribute('data-reader-detail-id', target.id);
    fireEvent.click(screen.getByRole('button', { name: 'Open context' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note' }), { target: { value: 'detail-local note' } });
    expect(window.localStorage.getItem(releaseNoteKey(model.releaseIdentity, target.id))).toBe('detail-local note');
    expect(window.localStorage.getItem(releaseNoteKey(model.releaseIdentity, firstAtlasRow.id))).toBeNull();
  });

  it('keeps note editing usable when storage read or write is unavailable', () => {
    const structure = loadRevisedPaperStructure();
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('storage denied'); });
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open context' }));
    expect(screen.getByRole('status')).toHaveTextContent('Retained for this session; device storage is unavailable.');
    const note = screen.getByRole('textbox', { name: 'Note' });
    fireEvent.change(note, { target: { value: 'session-only note' } });
    expect(note).toHaveValue('session-only note');

    vi.restoreAllMocks();
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota exceeded'); });
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Open context' }).at(-1) as HTMLElement);
    const secondNote = screen.getAllByRole('textbox', { name: 'Note' }).at(-1) as HTMLElement;
    fireEvent.change(secondNote, { target: { value: 'quota note' } });
    expect(secondNote).toHaveValue('quota note');
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('Retained for this session; device storage is unavailable.');
  });

  it('shows the unassigned question packet without assignment or progress state', () => {
    const structure = loadRevisedPaperStructure();
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);

    expect(screen.getByRole('heading', { name: 'Unassigned publication questions' })).toBeInTheDocument();
    expect(screen.getByText(/no assignment, inventory, progress, or disposition is created/i)).toBeInTheDocument();
    expect(screen.queryByText(/progress/i)).toBeInTheDocument();
  });

  it('keeps pinning unavailable below the exact 45rem boundary', () => {
    const structure = loadRevisedPaperStructure();
    measuredWidth = 719.84;
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open context' }));
    const pinButton = screen.getByRole('button', { name: 'Pin context' });
    expect(pinButton).toBeDisabled();
    expect(screen.getByTestId('workspace-shell')).toHaveAttribute('data-pin-eligible', 'false');
    expect(screen.getByTestId('context-rail')).toHaveAttribute('data-pinned', 'false');
    fireEvent.click(pinButton);
    expect(screen.getByTestId('context-rail')).toHaveAttribute('data-pinned', 'false');
  });

  it('recomputes measured width and page overflow at runtime', async () => {
    const structure = loadRevisedPaperStructure();
    render(<RevisedPaperWorkspace model={createWorkspaceModel(structure)} />);
    const main = screen.getByTestId('workspace-shell');
    expect(main).toHaveAttribute('data-pin-eligible', 'true');

    measuredWidth = 719.84;
    act(() => window.dispatchEvent(new Event('resize')));
    await waitFor(() => expect(main).toHaveAttribute('data-pin-eligible', 'false'));

    measuredWidth = 720;
    measuredOverflow = 2;
    act(() => resizeCallback?.());
    await waitFor(() => expect(main).toHaveAttribute('data-pin-eligible', 'false'));

    measuredOverflow = 1;
    act(() => resizeCallback?.());
    await waitFor(() => expect(main).toHaveAttribute('data-pin-eligible', 'true'));
    expect(main).toHaveAttribute('data-pin-preference', 'false');
  });
});
