import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/components/matrix-options/MatrixOptionsPrimaryNavigation', () => ({ default: () => <nav aria-label="Matrix Options stub" /> }));

import MatrixOptionsPaperResolverPage from '../page';
import MatrixOptionsPaperLayout from '../layout';
import MatrixOptionsPaperNotFound from '../not-found';
import { REVISED_PAPER_ROUTE } from '@/lib/matrix-options/revised-paper';

describe('/matrix-options/paper', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE = 'true';
    delete process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION;
  });

  it('redirects directly to the exact authenticated paper version', async () => {
    await expect(MatrixOptionsPaperResolverPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(REVISED_PAPER_ROUTE);
  });

  it('keeps the legacy redirect when the workspace flag is off', async () => {
    delete process.env.MATRIX_OPTIONS_PAPER_WORKSPACE;
    await expect(MatrixOptionsPaperResolverPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options?view=TWG%20Review');
  });

  it('lands on the canonical Working Draft URL when both flags are on', async () => {
    process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION = 'true';
    await expect(MatrixOptionsPaperResolverPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith('/matrix-options/paper/publication/v/1.0.11-remediated-7-8-successor-20260918-D?mode=working-draft');
  });

  it('F-06: gives the header actions slot a named group role and hides it while empty', () => {
    render(<MatrixOptionsPaperLayout><p>child content</p></MatrixOptionsPaperLayout>);
    const slot = screen.getByTestId('paper-header-actions');
    expect(slot).toHaveAttribute('role', 'group');
    expect(screen.getByRole('group', { name: 'Paper workspace actions' })).toBe(slot);
    expect(slot).toHaveClass('empty:hidden');
    expect(slot).toBeEmptyDOMElement();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('M1-03: lets the header row wrap so no child forces horizontal overflow at 360px', () => {
    render(<MatrixOptionsPaperLayout><p>child content</p></MatrixOptionsPaperLayout>);
    const header = screen.getByTestId('paper-layout-header');
    expect(header).toHaveClass('flex', 'flex-wrap', 'min-w-0');
    const brand = screen.getByTestId('paper-layout-brand');
    expect(brand).toHaveClass('min-w-0');
    expect(brand).not.toHaveClass('shrink-0');
    expect(screen.getByTestId('paper-layout-primary-navigation')).toHaveClass('min-w-0', 'flex-1');
    const slot = screen.getByTestId('paper-header-actions');
    expect(slot).toHaveClass('w-full', 'min-w-0', 'max-w-full', 'flex-wrap', 'sm:w-auto', 'sm:ml-auto');
    expect(slot).not.toHaveClass('shrink-0');
    expect(slot.className.split(/\s+/)).not.toContain('ml-auto');
    for (const element of [header, ...Array.from(header.querySelectorAll('*'))]) {
      expect(element.getAttribute('class') ?? '').not.toMatch(/(?:^|\s)(?:min-w-\[|w-\[|basis-\[)/);
    }
  });

  it('uses truthful authenticated-release wording for missing paper identities', () => {
    render(<MatrixOptionsPaperNotFound />);
    expect(screen.getByText(/authenticated V16 paper release/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the current verified paper' })).toHaveAttribute('href', '/matrix-options/paper');
    expect(screen.queryByText(/synthetic release|current fixture/i)).not.toBeInTheDocument();
  });
});
