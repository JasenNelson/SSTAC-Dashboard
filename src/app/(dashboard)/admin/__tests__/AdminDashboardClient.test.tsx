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
vi.mock('@/lib/agentic-os/feature-flag', () => ({
  isAgenticOsEnabled: () => false,
}));

import AdminDashboardClient from '../AdminDashboardClient';

const METRICS = {
  totalUsers: 12,
  newDocumentsThisMonth: 3,
  totalDiscussionThreads: 7,
  activeAnnouncements: 2,
  totalMilestones: 10,
  completedMilestones: 4,
  totalPollVotes: 55,
};

function renderDashboard(overrides: Partial<typeof METRICS> = {}) {
  return render(<AdminDashboardClient metrics={{ ...METRICS, ...overrides }} />);
}

describe('AdminDashboardClient copy contract', () => {
  it('links Options Paper Reviews to the admin reviews route', () => {
    renderDashboard();
    const link = screen.getByRole('link', { name: /Options Paper Reviews/ });
    expect(link).toHaveAttribute('href', '/admin/matrix-options-paper-reviews');
  });

  it('uses Database naming for the former Matrix Map cards', () => {
    renderDashboard();
    expect(screen.getByText('Database Health')).toBeInTheDocument();
    expect(screen.getByText('Database Site Aggregates')).toBeInTheDocument();
    expect(screen.getByText('Database Publish')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Database Health/ })).toHaveAttribute(
      'href',
      '/admin/matrix-map/health',
    );
  });

  it('does not contain the phrase Matrix Map anywhere', () => {
    renderDashboard();
    expect(document.body.textContent).not.toContain('Matrix Map');
  });

  it.each(['System Status', 'All Systems Operational', 'Recent Activity', '2 hours ago'])(
    'does not render the placeholder block text %s',
    (text) => {
      renderDashboard();
      expect(document.body.textContent).not.toContain(text);
    },
  );

  it('orders Options Paper Reviews after Matrix Review and before Jermilova Synthesis Review', () => {
    renderDashboard();
    const body = document.body.textContent ?? '';
    const matrixReview = body.indexOf('Matrix Review');
    const paperReviews = body.indexOf('Options Paper Reviews');
    const jermilova = body.indexOf('Jermilova Synthesis Review');
    expect(matrixReview).toBeGreaterThanOrEqual(0);
    expect(paperReviews).toBeGreaterThan(matrixReview);
    expect(jermilova).toBeGreaterThan(paperReviews);
  });

  it('does not render NaN when there are zero milestones', () => {
    renderDashboard({ totalMilestones: 0, completedMilestones: 0 });
    expect(document.body.textContent).not.toContain('NaN');
  });
});
