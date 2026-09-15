import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';
import { createWorkspaceModel } from '@/lib/matrix-options/revised-paper-review';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import { RevisedPaperWorkspace, normalizeReaderTextForDisplay } from '../RevisedPaperWorkspace';
import type { CohortPortion } from '../RevisedPaperWorkspace';

beforeEach(() => {
  const host = document.createElement('div');
  host.id = 'matrix-options-paper-header-actions';
  host.setAttribute('data-testid', 'paper-header-actions');
  document.body.appendChild(host);
});

afterEach(() => {
  document.getElementById('matrix-options-paper-header-actions')?.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function realModel(mode: 'my-review' | 'publication' = 'my-review') {
  return createWorkspaceModel(loadRevisedPaperStructure(), undefined, mode);
}

function realPortions() {
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
  }));
}

describe('RevisedPaperWorkspace', () => {
  it('removes only standalone generated section anchors for presentation', () => {
    const source = ['  <div id="sec-first" class="section-anchor"></div>  ', '<div id="sec-second" class="section-anchor"> </div>', '<div id="sec-near" class="section-anchor">Keep this content</div>', '<div id="sec-other" class="other-anchor"></div>'].join('\r\n');
    expect(normalizeReaderTextForDisplay(source)).toBe(['<div id="sec-near" class="section-anchor">Keep this content</div>', '<div id="sec-other" class="other-anchor"></div>'].join('\r\n'));
  });

  it('keeps Publication Atlas and lenses in the document while panels start closed', () => {
    render(<RevisedPaperWorkspace model={realModel('publication')} />);
    expect(screen.getByRole('heading', { name: 'Publication Atlas' })).toBeInTheDocument();
    expect(screen.queryByTestId('review-package-panel')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Publication lenses' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workspace-toolbar')).not.toBeInTheDocument();
    const headerControls = screen.getByTestId('workspace-header-controls');
    const download = within(headerControls).getByRole('button', { name: 'Show Download files' });
    expect(download).toHaveClass('min-h-[44px]');
    expect(download.querySelector('svg')).not.toBeNull();
    const headerActionsHost = screen.getByTestId('paper-header-actions');
    const panelControls = screen.getByTestId('workspace-panel-controls');
    expect(within(headerActionsHost).getByTestId('workspace-panel-controls')).toBe(panelControls);
    expect(within(headerControls).queryByRole('button', { name: 'Show Navigation' })).not.toBeInTheDocument();
    expect(within(panelControls).getByRole('button', { name: 'Show Navigation' })).toBeInTheDocument();
    expect(within(panelControls).queryByRole('button', { name: 'Show Review Comments' })).not.toBeInTheDocument();
    const sections = screen.getByRole('button', { name: 'Show Navigation' });
    expect(sections.querySelector('svg')).not.toBeNull();
    expect(sections).toHaveClass('min-h-[44px]');
    expect(sections).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Show Review Comments' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('release-notes-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-layout')).toHaveClass('block');
    expect(screen.getByTestId('workspace-layout')).toHaveClass('lg:block');
    expect(screen.getByTestId('workspace-layout')).not.toHaveClass('lg:grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]');
    fireEvent.click(sections);
    expect(screen.getByTestId('publication-sections-panel')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Publication lenses' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Hide Navigation' })).toHaveLength(2);
    expect(sections).toHaveAttribute('aria-expanded', 'true');
    expect(sections).toHaveClass('border-slate-400', 'bg-slate-200', 'text-slate-900', 'shadow-sm');
    expect(sections).not.toHaveClass('bg-sky-50', 'text-sky-700');
    expect(screen.getByTestId('workspace-layout')).toHaveClass('lg:grid-cols-[20rem_minmax(0,1fr)]');
  });

  it('exposes five cohort controls and authenticated portions in the Navigation panel', async () => {
    const { container } = render(<RevisedPaperWorkspace model={realModel()} cohortPortions={realPortions()} />);
    const show = screen.getByRole('button', { name: 'Show Navigation' });
    expect(show).toHaveTextContent('Navigation');
    expect(show.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'My Review' })).toHaveAttribute('href', '/matrix-options/paper/publication/v/1.0.11-remediated-20260913?mode=my-review&lens=all&page=1');
    fireEvent.click(show);
    const panel = screen.getByTestId('review-package-panel');
    expect(within(panel).getByRole('heading', { name: 'Navigation' })).toBeInTheDocument();
    const cohortNav = within(panel).getByRole('navigation', { name: 'Review cohorts' });
    expect(within(cohortNav).getAllByRole('button', { name: /questions$/ })).toHaveLength(5);
    for (const name of ['Categories, 3 questions', 'Pathway and grid, 2 questions', 'Exposure assumptions, 2 questions', 'Inputs and evidence, 3 questions', 'Methods and water type, 2 questions']) {
      expect(within(cohortNav).getByRole('button', { name })).toHaveClass('min-h-[44px]');
    }
    expect(within(panel).queryByRole('button', { name: /^Question/ })).not.toBeInTheDocument();
    expect(within(document.getElementById('cohort-categories-portions') as HTMLElement).getByText('Authenticated paper portions')).toBeInTheDocument();
    for (const cohortId of ['categories', 'pathway-grid', 'exposure-assumptions', 'inputs-evidence', 'methods-water-type']) {
      expect(document.getElementById(`cohort-${cohortId}-portions`)).toBeInTheDocument();
    }
    expect(document.getElementById('cohort-categories-portions')).not.toHaveAttribute('hidden');
    expect(document.getElementById('cohort-pathway-grid-portions')).toHaveAttribute('hidden');
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    fireEvent.click(within(cohortNav).getByRole('button', { name: 'Pathway and grid, 2 questions' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pathway and grid' })).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('.fixed')).toBeNull();
    expect(container.querySelector('.absolute')).toBeNull();
  });

  it('keeps the selected bounded portion before the reader and activates one question response', () => {
    render(<RevisedPaperWorkspace model={realModel()} cohortPortions={realPortions()} />);
    const paper = screen.getByTestId('cohort-paper');
    expect(screen.queryByRole('heading', { name: 'Canonical reader' })).toBeNull();
    expect(screen.queryByTestId('active-question-response')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Review Comments' }));
    const selectedResponse = screen.getByTestId('active-question-response');
    expect(paper.compareDocumentPosition(selectedResponse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('paper-portion-navigation')).toHaveTextContent('Paper portion 1 of 1');
    expect(screen.getAllByTestId('active-question-response')).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Jump to question' })).toHaveClass('min-h-[44px]');
    expect(screen.getByRole('combobox', { name: 'Jump to question' })).toHaveClass('w-full', 'min-w-0');
    expect(screen.getByTestId('question-navigation')).toHaveClass('space-y-4');
    expect(screen.getByTestId('question-navigation')).not.toHaveClass('sm:flex-row');
    expect(screen.getByTestId('question-navigation-buttons')).toHaveClass('grid-cols-2');
    expect(screen.getByRole('button', { name: 'Previous question' })).toHaveClass('min-w-0');
    expect(screen.getByRole('button', { name: 'Next question' })).toHaveClass('min-w-0');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save|Submit|Resume/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jump to question' }), { target: { value: '4' } });
    const response = screen.getByTestId('active-question-response');
    expect(response).toHaveFocus();
    expect(response).not.toHaveTextContent('Paper portion');
    expect(response).toHaveTextContent('4\u00d74=16');
    const visibleMath = response.querySelector('.katex-html');
    expect(visibleMath).not.toBeNull();
    expect(visibleMath?.textContent).not.toContain('\\');
    expect(visibleMath?.textContent).not.toContain('$');
  });

  it('preserves a requested non-first portion across cohort changes', async () => {
    const basePortions = realPortions();
    const target = basePortions.find((portion) => portion.cohortId === 'pathway-grid');
    expect(target).toBeTruthy();
    if (!target) return;
    const second = { ...target, id: 'pathway-grid:second', sectionLabel: 'Pathway second portion', text: '# Pathway second portion\n\nSecond authenticated bounded excerpt.' };
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    render(<RevisedPaperWorkspace model={realModel()} cohortPortions={[...basePortions, second]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Navigation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pathway and grid, 2 questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pathway second portion' }));
    await waitFor(() => {
      expect(within(screen.getByTestId('cohort-paper')).getByRole('heading', { name: 'Pathway second portion', level: 2 })).toHaveFocus();
      expect(screen.getByTestId('cohort-paper')).toHaveTextContent('Second authenticated bounded excerpt.');
    });
    expect(within(screen.getByTestId('review-package-panel')).getByRole('button', { name: 'Pathway second portion' })).toHaveAttribute('aria-pressed', 'true');
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('makes panels mutually exclusive and returns focus on close or Escape', () => {
    render(<RevisedPaperWorkspace model={realModel()} />);
    const reading = screen.getByRole('button', { name: 'Show Download files' });
    const release = screen.getByRole('button', { name: 'Show Review Comments' });
    fireEvent.click(reading);
    expect(screen.getByTestId('reading-materials-panel')).toBeInTheDocument();
    fireEvent.click(release);
    expect(screen.queryByTestId('reading-materials-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('release-notes-panel')).toBeInTheDocument();
    expect(within(screen.getByTestId('release-notes-panel')).getByRole('button', { name: 'Hide Review Comments' })).toBeInTheDocument();
    expect(release).toHaveClass('border-slate-400', 'bg-slate-200', 'text-slate-900', 'shadow-sm');
    expect(release).not.toHaveClass('bg-sky-50', 'text-sky-700');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('release-notes-panel')).not.toBeInTheDocument();
    expect(release).toHaveFocus();
    fireEvent.click(reading);
    fireEvent.click(within(screen.getByTestId('reading-materials-panel')).getByRole('button', { name: 'Hide Download files' }));
    expect(reading).toHaveFocus();
  });

  it('keeps reading materials truthful with no absent download links', () => {
    render(<RevisedPaperWorkspace model={realModel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Download files' }));
    const panel = screen.getByTestId('reading-materials-content');
    expect(screen.getByRole('heading', { name: 'Download files' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reading materials' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Review files|Reading materials/)).not.toBeInTheDocument();
    expect(panel).toHaveTextContent('will be downloaded when ready');
    expect(panel).toHaveTextContent('being prepared pending integrity verification');
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders an unavailable referenced section without paper bytes', () => {
    const unavailable: CohortPortion = { id: 'categories:section-7.8', cohortId: 'categories', name: 'Categories', status: 'unavailable', sectionNumber: '7.8', sourceLocator: 'Section 7.8', sectionLabel: 'Section 7.8' };
    render(<RevisedPaperWorkspace model={realModel()} cohortPortions={[unavailable]} />);
    expect(screen.getByText('Section 7.8 is referenced by this review cohort but is not present as a section in this release.')).toBeInTheDocument();
    expect(screen.getByTestId('cohort-paper')).toHaveTextContent('No paper bytes are attached.');
    expect(screen.getByTestId('paper-portion-navigation')).toHaveTextContent('Paper portion 1 of 1');
  });

  it('keeps trust, local notes, and ledgers out of the Review Comments response panel', () => {
    render(<RevisedPaperWorkspace model={realModel()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show Review Comments' }));
    const panel = screen.getByTestId('release-notes-panel');
    expect(within(panel).getByTestId('active-question-response')).toBeInTheDocument();
    expect(screen.queryByTestId('trust-strip')).not.toBeInTheDocument();
    expect(screen.queryByText('Device-local note')).not.toBeInTheDocument();
    expect(screen.queryByText('Review ledger')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps the paper semantic and print-safe while non-paper workspace stays hidden', () => {
    render(<RevisedPaperWorkspace model={realModel('publication')} readerText={'# Printed paper\n\n**Authenticated body.**'} />);
    const reader = screen.getByRole('heading', { name: 'Canonical reader' }).closest('section') as HTMLElement;
    expect(reader).not.toHaveClass('print:hidden');
    expect(reader).toHaveClass('print:w-full', 'print:max-w-none');
    expect(screen.getByRole('banner')).toHaveClass('print:hidden');
    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument();
    expect(within(reader).getByRole('heading', { name: 'Printed paper', level: 1 })).toBeInTheDocument();
    expect(within(reader).getByText('Authenticated body.').tagName).toBe('STRONG');
    expect(reader.querySelector('pre')).toBeNull();
  });

  it('never renders detail reader text in My Review while Publication retains it', () => {
    const readerText = '# Requested detail\n\nAuthenticated detail body.';
    const { rerender } = render(<RevisedPaperWorkspace model={realModel()} readerText={readerText} />);
    expect(screen.queryByRole('heading', { name: 'Requested detail', level: 1 })).not.toBeInTheDocument();
    rerender(<RevisedPaperWorkspace model={realModel('publication')} readerText={readerText} />);
    expect(screen.getByRole('heading', { name: 'Requested detail', level: 1 })).toBeInTheDocument();
  });
});
