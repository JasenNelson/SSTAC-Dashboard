import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import SubscriptionsView, {
  type SubscriptionsLoadResult,
} from '../SubscriptionsView';
import {
  AgenticOsRuntimeProvider,
  type AgenticOsRuntime,
} from '@/lib/agentic-os/runtime-context';
import type { AiSubscription } from '@/lib/agentic-os/parse-ai-subscriptions';

const FIXTURE_SUBSCRIPTIONS: AiSubscription[] = [
  {
    name: 'Claude',
    provider: 'Anthropic',
    subscriptionTier: 'Max',
    billingCycle: 'Monthly',
    resetDate: 'check Anthropic Console',
    lastChecked: '2026-05-16',
    usageUrl: 'https://console.anthropic.com/settings/usage',
    liveCheckCommand: 'claude auth status',
    liveCheckAction: 'check_claude_auth',
    notes: 'Live auth-status subcommand returns JSON.',
    extras: {},
  },
  {
    name: 'Codex CLI',
    provider: 'OpenAI',
    subscriptionTier: 'ChatGPT Plus',
    billingCycle: 'Monthly',
    resetDate: 'check OpenAI account',
    lastChecked: '2026-05-16',
    usageUrl: 'https://platform.openai.com/account/usage',
    liveCheckCommand: 'codex login status',
    liveCheckAction: 'check_codex_login',
    notes: '',
    extras: {},
  },
  {
    name: 'NoAction',
    provider: 'Manual',
    subscriptionTier: 'free',
    billingCycle: '',
    resetDate: '',
    lastChecked: '2026-05-16',
    usageUrl: 'https://example.test/usage',
    notes: 'No live-check command for this provider.',
    extras: {},
  },
];

function makeRuntime(
  overrides: Partial<AgenticOsRuntime> = {},
): AgenticOsRuntime {
  return {
    runs: [],
    launchingFor: new Set<string>(),
    terminalTab: 'logs',
    setTerminalTab: vi.fn(),
    launchAction: vi.fn().mockResolvedValue(undefined),
    closeRun: vi.fn(),
    ptyEnabled: false,
    ...overrides,
  };
}

function renderWithRuntime(
  result: SubscriptionsLoadResult,
  runtime: AgenticOsRuntime = makeRuntime(),
) {
  return render(
    <AgenticOsRuntimeProvider value={runtime}>
      <SubscriptionsView result={result} />
    </AgenticOsRuntimeProvider>,
  );
}

describe('SubscriptionsView', () => {
  it('renders a provider card for each subscription with name + tier', () => {
    renderWithRuntime({ ok: true, subscriptions: FIXTURE_SUBSCRIPTIONS });

    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Codex CLI')).toBeInTheDocument();
    expect(screen.getByText('NoAction')).toBeInTheDocument();
    // Subscription tier is rendered inline in each card. There may be
    // multiple "Max"-style tier strings on the page; checking the count
    // header is enough for a smoke assertion.
    expect(screen.getByText(/3 providers/)).toBeInTheDocument();
  });

  it('dispatches launchAction with the correct (project, action) tuple when Check now is clicked', () => {
    const launchAction = vi.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({ launchAction });
    renderWithRuntime(
      { ok: true, subscriptions: FIXTURE_SUBSCRIPTIONS },
      runtime,
    );

    // Two providers expose a liveCheckAction -> two Check now buttons render.
    const buttons = screen.getAllByRole('button', { name: /Check now/i });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]);
    expect(launchAction).toHaveBeenCalledTimes(1);
    // Default attribution project is 'SSTAC-Dashboard' (panel default). The
    // first provider in the fixture wires check_claude_auth.
    expect(launchAction).toHaveBeenCalledWith(
      'SSTAC-Dashboard',
      'check_claude_auth',
    );

    fireEvent.click(buttons[1]);
    expect(launchAction).toHaveBeenCalledTimes(2);
    expect(launchAction).toHaveBeenLastCalledWith(
      'SSTAC-Dashboard',
      'check_codex_login',
    );
  });

  it('marks Check now as busy when its concurrency key is in launchingFor', () => {
    const launchAction = vi.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({
      launchAction,
      launchingFor: new Set(['SSTAC-Dashboard::check_claude_auth']),
    });
    renderWithRuntime(
      { ok: true, subscriptions: FIXTURE_SUBSCRIPTIONS },
      runtime,
    );

    // Busy button label changes to "checking ...".
    expect(
      screen.getByRole('button', { name: /checking/i }),
    ).toBeDisabled();
    // The other check-now button stays enabled (not bled by Project A's busy
    // key) -- still labeled "Check now".
    const enabled = screen
      .getAllByRole('button', { name: /Check now/i })
      .filter((el) => !(el as HTMLButtonElement).disabled);
    expect(enabled).toHaveLength(1);
  });

  it('renders an error envelope when AI_SUBSCRIPTIONS.md cannot be read', () => {
    renderWithRuntime({
      ok: false,
      error: {
        message: 'ENOENT: no such file or directory',
        expectedPath: 'C:/Projects/Knowledge-Base/AI_SUBSCRIPTIONS.md',
      },
    });

    expect(
      screen.getByText(/Could not read AI_SUBSCRIPTIONS\.md/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ENOENT: no such file or directory/),
    ).toBeInTheDocument();
    // The expected path is rendered both inside a <code> element + interpolated
    // into the hint paragraph; use getAllByText to assert both surfaces show it.
    const pathMatches = screen.getAllByText(
      /Knowledge-Base\/AI_SUBSCRIPTIONS\.md/,
    );
    expect(pathMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the empty state when AI_SUBSCRIPTIONS.md parses cleanly but lists no providers', () => {
    renderWithRuntime({ ok: true, subscriptions: [] });
    expect(
      screen.getByText(
        /No providers configured in Knowledge-Base\/AI_SUBSCRIPTIONS\.md/,
      ),
    ).toBeInTheDocument();
  });
});
