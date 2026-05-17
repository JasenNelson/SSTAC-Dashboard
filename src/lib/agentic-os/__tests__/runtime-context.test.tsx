import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  AgenticOsRuntimeProvider,
  useAgenticOsRuntime,
  type AgenticOsRuntime,
} from '../runtime-context';

// Minimal consumer used by every test below. Reads from the runtime + lets
// us assert that the values flow through and that producers expose stable
// references where promised.
function Consumer({
  onRender,
}: {
  onRender?: (rt: AgenticOsRuntime) => void;
}) {
  const rt = useAgenticOsRuntime();
  onRender?.(rt);
  return (
    <div>
      <div data-testid="runs-count">{rt.runs.length}</div>
      <div data-testid="launching-count">{rt.launchingFor.size}</div>
      <div data-testid="pty-enabled">{String(rt.ptyEnabled)}</div>
      <div data-testid="tab">{rt.terminalTab}</div>
      <button
        type="button"
        onClick={() => {
          void rt.launchAction('Project-A', 'run_safe_exit');
        }}
      >
        launch
      </button>
      <button
        type="button"
        onClick={() => {
          rt.setTerminalTab('agents');
        }}
      >
        switch-tab
      </button>
    </div>
  );
}

function makeRuntime(overrides: Partial<AgenticOsRuntime> = {}): AgenticOsRuntime {
  const base: AgenticOsRuntime = {
    runs: [],
    launchingFor: new Set<string>(),
    terminalTab: 'logs',
    setTerminalTab: vi.fn(),
    launchAction: vi.fn().mockResolvedValue(undefined),
    closeRun: vi.fn(),
    ptyEnabled: false,
  };
  return { ...base, ...overrides };
}

describe('AgenticOsRuntime context', () => {
  it('exposes the provider value to descendants via useAgenticOsRuntime()', () => {
    const launchAction = vi.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({
      runs: [
        {
          runId: 'run-1',
          project: 'Project-A',
          action: 'run_safe_exit',
          command: { exe: 'claude', args: ['-p', '/safe-exit'], cwd: 'Project-A' },
          startedAt: new Date().toISOString(),
          lines: [],
          status: 'running',
        },
      ],
      launchingFor: new Set(['Project-A::run_safe_exit']),
      terminalTab: 'logs',
      launchAction,
      ptyEnabled: true,
    });

    render(
      <AgenticOsRuntimeProvider value={runtime}>
        <Consumer />
      </AgenticOsRuntimeProvider>,
    );

    expect(screen.getByTestId('runs-count').textContent).toBe('1');
    expect(screen.getByTestId('launching-count').textContent).toBe('1');
    expect(screen.getByTestId('pty-enabled').textContent).toBe('true');
    expect(screen.getByTestId('tab').textContent).toBe('logs');
  });

  it('routes consumer-triggered launchAction calls through the provided dispatcher', () => {
    const launchAction = vi.fn().mockResolvedValue(undefined);
    const runtime = makeRuntime({ launchAction });
    render(
      <AgenticOsRuntimeProvider value={runtime}>
        <Consumer />
      </AgenticOsRuntimeProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'launch' }).click();
    });

    expect(launchAction).toHaveBeenCalledTimes(1);
    expect(launchAction).toHaveBeenCalledWith('Project-A', 'run_safe_exit');
  });

  it('routes setTerminalTab through the provided setter', () => {
    const setTerminalTab = vi.fn();
    const runtime = makeRuntime({ setTerminalTab });
    render(
      <AgenticOsRuntimeProvider value={runtime}>
        <Consumer />
      </AgenticOsRuntimeProvider>,
    );

    act(() => {
      screen.getByRole('button', { name: 'switch-tab' }).click();
    });

    expect(setTerminalTab).toHaveBeenCalledWith('agents');
  });

  it('THROWS a descriptive error when useAgenticOsRuntime is called outside a provider', () => {
    // Suppress the React error boundary spam from the expected throw so the
    // test output stays readable. The throw itself is the assertion.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => render(<Consumer />)).toThrow(
        /useAgenticOsRuntime must be called inside AgenticOsRuntimeProvider/,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
