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

import AdminFunctionsNav from '../AdminFunctionsNav';

describe('AdminFunctionsNav copy and order contract', () => {
  it('lists the quick links in the expected order with Database naming', () => {
    render(<AdminFunctionsNav />);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Dashboard',
      'User Management',
      'Tag Management',
      'Announcements',
      'Milestones',
      'Poll Results',
      'TWG Review',
      'Catalog Staging Review',
      'Matrix Review',
      'Options Paper Reviews',
      'Jermilova Review',
      'Database Health',
      'Database Publish',
      'Database Site Aggregates',
      'Regulatory Review',
      'Engine v2',
    ]);
  });

  it('gives every quick link a 44px minimum touch target', () => {
    render(<AdminFunctionsNav />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toContain('min-h-[44px]');
    }
  });

  it('marks only Options Paper Reviews as the current page', () => {
    render(<AdminFunctionsNav />);
    const current = screen.getByRole('link', { name: 'Options Paper Reviews' });
    expect(current).toHaveAttribute('href', '/admin/matrix-options-paper-reviews');
    expect(current).toHaveAttribute('aria-current', 'page');
    const others = screen
      .getAllByRole('link')
      .filter((a) => a !== current && a.hasAttribute('aria-current'));
    expect(others).toHaveLength(0);
  });
});
