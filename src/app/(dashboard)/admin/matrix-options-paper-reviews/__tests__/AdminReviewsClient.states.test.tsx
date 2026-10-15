import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/matrix-options-paper-reviews',
}));
vi.mock('@/lib/agentic-os/feature-flag', () => ({
  isAgenticOsEnabled: () => false,
}));

import AdminReviewsClient from '../AdminReviewsClient';
import type { ReviewRow } from '@/lib/matrix-options/paper/review-csv';

const ROW: ReviewRow = {
  documentVersion: 'v1-states',
  manifestSha256: 'a'.repeat(64),
  cohortId: 'cohort-1',
  questionId: 'question-states-1',
  userId: 'user-1',
  draftText: 'draft',
  submittedText: 'answer',
  currentRevision: 2,
  submittedRevision: 1,
  submittedAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:01.000Z',
  status: 'changed-since-submit',
};

type Kind = 'ready' | 'empty' | 'query-error' | 'integrity-error';
const KINDS: Kind[] = ['ready', 'empty', 'query-error', 'integrity-error'];

function renderState(kind: Kind) {
  const rows = kind === 'ready' ? [ROW] : [];
  return render(
    <AdminReviewsClient rows={rows} state={{ kind }} initialFilters={{}} />,
  );
}

describe('AdminReviewsClient shared chrome across states', () => {
  it.each(KINDS)('%s: renders the h1 and admin quick links with current page', (kind) => {
    renderState(kind);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Options Paper Reviews' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Admin Quick Links')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Options Paper Reviews' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

describe('AdminReviewsClient state bodies', () => {
  it('query-error shows the query failure alert', () => {
    renderState('query-error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Review query failed. No review data is available.',
    );
  });

  it('integrity-error shows the integrity failure alert', () => {
    renderState('integrity-error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Review integrity validation failed. No review data is available.',
    );
  });

  it('empty shows the empty message and keeps the export link', () => {
    renderState('empty');
    expect(screen.getByText('No reviews match the selected filters.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('ready shows the responses table with fixture cells', () => {
    renderState('ready');
    expect(screen.getByText('Review responses')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: ROW.questionId })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: ROW.documentVersion })).toBeInTheDocument();
  });
});
