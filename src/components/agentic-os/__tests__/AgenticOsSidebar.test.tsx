import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import AgenticOsSidebar, {
  type SidebarCategory,
} from '../AgenticOsSidebar';

// Next's <Link> is a thin wrapper over <a> in tests; with the App Router
// the default export reads from a Server-Component context that doesn't
// exist in jsdom. Stub it out to a plain anchor so we can assert href +
// aria-current behavior.
vi.mock('next/link', () => {
  return {
    default: ({
      href,
      children,
      ...rest
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
      <a href={href} {...rest}>
        {children}
      </a>
    ),
  };
});

describe('AgenticOsSidebar', () => {
  it('renders the five expected sources: Projects, AI Subs, GitHub, Vercel, NotebookLM', () => {
    render(<AgenticOsSidebar activeCategory="projects" />);

    // Active route renders as an anchor; future routes render as <span role="note">.
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI Subs/i })).toBeInTheDocument();
    // Future entries render with role="note" + aria-disabled.
    const futureEntries = screen.getAllByRole('note');
    const futureLabels = futureEntries.map((el) => el.textContent ?? '');
    expect(futureLabels.some((t) => /GitHub/.test(t))).toBe(true);
    expect(futureLabels.some((t) => /Vercel/.test(t))).toBe(true);
    expect(futureLabels.some((t) => /NotebookLM/.test(t))).toBe(true);
  });

  it.each([
    ['projects', /Projects/i],
    ['subscriptions', /AI Subs/i],
  ] as ReadonlyArray<[SidebarCategory, RegExp]>)(
    'marks the active category with aria-current="page" (%s)',
    (activeCategory, label) => {
      render(<AgenticOsSidebar activeCategory={activeCategory} />);
      const link = screen.getByRole('link', { name: label });
      expect(link).toHaveAttribute('aria-current', 'page');
    },
  );

  it('does NOT mark non-active categories with aria-current', () => {
    render(<AgenticOsSidebar activeCategory="projects" />);
    const aiSubsLink = screen.getByRole('link', { name: /AI Subs/i });
    expect(aiSubsLink).not.toHaveAttribute('aria-current');
  });

  it('tags every future entry with data-future-panel and renders as non-interactive <span>', () => {
    // role="note" + plain <span> is how non-interactive "coming soon" is
    // conveyed; jsx-a11y rejects aria-disabled on role=note. The data-*
    // attribute + the span tag together establish the future-panel
    // contract (no aria-current, no href, not focusable).
    render(<AgenticOsSidebar activeCategory="projects" />);
    const futureEntries = screen.getAllByRole('note');
    expect(futureEntries.length).toBeGreaterThanOrEqual(3);
    for (const el of futureEntries) {
      expect(el).toHaveAttribute('data-future-panel', 'true');
      expect(el.tagName.toLowerCase()).toBe('span');
      expect(el).not.toHaveAttribute('href');
      expect(el).not.toHaveAttribute('aria-current');
    }
  });

  it('emits the correct hrefs for active routes', () => {
    render(<AgenticOsSidebar activeCategory="projects" />);
    expect(
      screen.getByRole('link', { name: /Projects/i }),
    ).toHaveAttribute('href', '/admin/agentic-os');
    expect(
      screen.getByRole('link', { name: /AI Subs/i }),
    ).toHaveAttribute('href', '/admin/agentic-os/subscriptions');
  });

  it('renders the children slot below the category nav for view-specific sub-nav', () => {
    render(
      <AgenticOsSidebar activeCategory="projects">
        <div data-testid="view-subnav">Views + Running + Quick actions</div>
      </AgenticOsSidebar>,
    );
    expect(screen.getByTestId('view-subnav')).toBeInTheDocument();
  });

  it('has the navigation landmark + a Sources label for accessibility', () => {
    render(<AgenticOsSidebar activeCategory="projects" />);
    const aside = screen.getByRole('complementary', {
      name: /Agentic OS navigation/i,
    });
    // The categories nav is nested inside the aside.
    const nav = within(aside).getByRole('navigation', {
      name: /Agentic OS sections/i,
    });
    expect(nav).toBeInTheDocument();
  });
});
