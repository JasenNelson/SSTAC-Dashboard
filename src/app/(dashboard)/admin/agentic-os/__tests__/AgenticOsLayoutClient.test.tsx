import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import AgenticOsLayoutClient from '../AgenticOsLayoutClient';
import { useAgenticOsRuntime } from '@/lib/agentic-os/runtime-context';

// next/navigation's usePathname relies on Next's runtime; jsdom has none.
// Drive it via a controllable module-level setter so different tests can
// assert different active-category highlights.
let __mockPathname: string = '/admin/agentic-os';
vi.mock('next/navigation', () => ({
  usePathname: () => __mockPathname,
}));

// Stub next/link to a plain anchor (same pattern as AgenticOsSidebar test).
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// AdminFunctionsNav reads from a Supabase client at render time. Stub it
// to keep this test focused on the layout chrome itself.
vi.mock('@/components/dashboard/AdminFunctionsNav', () => ({
  default: () => <div data-testid="admin-functions-nav" />,
}));

// EmbeddedTerminalModal is dynamically imported in production and pulls in
// xterm.js. The layout client doesn't mount it directly (the projects
// route does), so no stub needed here -- but if other imports pull it
// transitively a stub keeps the test hermetic.

// Consumer used to verify the runtime context is wired through.
function RuntimePeek() {
  const rt = useAgenticOsRuntime();
  return (
    <div>
      <div data-testid="pty">{String(rt.ptyEnabled)}</div>
      <div data-testid="tab">{rt.terminalTab}</div>
      <div data-testid="runs">{rt.runs.length}</div>
    </div>
  );
}

describe('AgenticOsLayoutClient', () => {
  it('smoke-renders the chrome: admin pills, header brand, sidebar, bottom panel', () => {
    __mockPathname = '/admin/agentic-os';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={0}>
        <div data-testid="route-content">projects view goes here</div>
      </AgenticOsLayoutClient>,
    );

    // Admin pills bar (stubbed marker)
    expect(screen.getByTestId('admin-functions-nav')).toBeInTheDocument();
    // Brand
    expect(screen.getByText(/Agentic OS/)).toBeInTheDocument();
    expect(screen.getByText(/v0\.1 dev/)).toBeInTheDocument();
    // Sidebar landmark
    expect(
      screen.getByRole('complementary', { name: /Agentic OS navigation/i }),
    ).toBeInTheDocument();
    // Bottom panel tablist
    expect(
      screen.getByRole('tablist', { name: /Terminal panel views/i }),
    ).toBeInTheDocument();
    // Route content
    expect(screen.getByTestId('route-content')).toBeInTheDocument();
  });

  it('highlights the Projects category when pathname matches the root', () => {
    __mockPathname = '/admin/agentic-os';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={0}>
        <div />
      </AgenticOsLayoutClient>,
    );
    const projectsLink = screen.getByRole('link', { name: /Projects/i });
    expect(projectsLink).toHaveAttribute('aria-current', 'page');
    const subsLink = screen.getByRole('link', { name: /AI Subs/i });
    expect(subsLink).not.toHaveAttribute('aria-current');
  });

  it('highlights the AI Subs category when pathname is /admin/agentic-os/subscriptions', () => {
    __mockPathname = '/admin/agentic-os/subscriptions';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={0}>
        <div />
      </AgenticOsLayoutClient>,
    );
    const subsLink = screen.getByRole('link', { name: /AI Subs/i });
    expect(subsLink).toHaveAttribute('aria-current', 'page');
    const projectsLink = screen.getByRole('link', { name: /Projects/i });
    expect(projectsLink).not.toHaveAttribute('aria-current');
  });

  it('falls back to Projects category for unknown pathnames', () => {
    __mockPathname = '/admin/agentic-os/some-future-route';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={0}>
        <div />
      </AgenticOsLayoutClient>,
    );
    const projectsLink = screen.getByRole('link', { name: /Projects/i });
    expect(projectsLink).toHaveAttribute('aria-current', 'page');
  });

  it('renders the agentCountTotal in the header chip', () => {
    __mockPathname = '/admin/agentic-os';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={7}>
        <div />
      </AgenticOsLayoutClient>,
    );
    expect(screen.getByText(/7 agents/)).toBeInTheDocument();
  });

  it('exposes a runtime context populated with ptyEnabled + default registries', () => {
    __mockPathname = '/admin/agentic-os';
    render(
      <AgenticOsLayoutClient ptyEnabled={true} agentCountTotal={0}>
        <RuntimePeek />
      </AgenticOsLayoutClient>,
    );
    expect(screen.getByTestId('pty').textContent).toBe('true');
    expect(screen.getByTestId('tab').textContent).toBe('logs');
    expect(screen.getByTestId('runs').textContent).toBe('0');
  });

  it('reflects ptyEnabled=false through the runtime', () => {
    __mockPathname = '/admin/agentic-os';
    render(
      <AgenticOsLayoutClient ptyEnabled={false} agentCountTotal={0}>
        <RuntimePeek />
      </AgenticOsLayoutClient>,
    );
    expect(screen.getByTestId('pty').textContent).toBe('false');
  });
});
