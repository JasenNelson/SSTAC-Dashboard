'use client';

// Shared runtime context for the Agentic OS multi-route layout.
//
// The Agentic OS admin page used to be a single client component
// (AgenticOsClient.tsx) that owned BOTH the projects view AND the bottom
// tabbed terminal panel + launch dispatch state. The 2026-05-16 IA refactor
// introduced sibling routes (e.g. /admin/agentic-os/subscriptions) that
// also need to dispatch Pattern A launches and have their output land in
// the SAME bottom panel as the projects-view launches.
//
// Rather than duplicate the launch fetch / SSE / runs-registry plumbing
// per route, the layout (`layout.tsx` -> `AgenticOsLayoutClient.tsx`)
// owns the runtime state and exposes it via this context. Route content
// (projects view, subscriptions view, future github/vercel/notebooklm
// views) reads from it through the `useAgenticOsRuntime()` hook and
// dispatches launches through `launchAction(...)`.
//
// The bottom panel is rendered ONCE by the layout, so a launch fired
// from any route's main pane streams its output into the same panel the
// user is already looking at -- consistent with the VSCode/Linear-style
// "always-on bottom shell" pattern.

import { createContext, useContext } from 'react';
import type {
  TerminalTab,
  ActiveRun,
} from '@/components/agentic-os/TerminalPanel';

/**
 * Optional per-launch hints. The same shape AgenticOsClient.launchAction
 * has always accepted; keep additive so new options (e.g. a third slug
 * type for a future Pattern E) can land without touching every caller.
 */
export interface LaunchOptions {
  /** Pattern C (step 8): discovered skill slug for action === 'run_skill'. */
  skillSlug?: string;
  /** Pattern D (step 10): discovered agent slug for action === 'run_agent'. */
  agentSlug?: string;
}

/**
 * Runtime state + dispatch surface shared across every Agentic OS route.
 * Owned by AgenticOsLayoutClient; consumed by route content + the bottom
 * panel. Producers MUST use the functional setState form for `runs` and
 * `launchingFor` so concurrent launches from different routes don't race
 * each other's state.
 */
export interface AgenticOsRuntime {
  /** Active + completed run cards, most-recent first. */
  runs: ActiveRun[];
  /** Set of in-flight `${project}::${action}[::${slug}]` concurrency keys. */
  launchingFor: ReadonlySet<string>;
  /** Currently-selected bottom-panel tab. */
  terminalTab: TerminalTab;
  /** Change the bottom-panel tab. */
  setTerminalTab: (tab: TerminalTab) => void;
  /**
   * Dispatch a Pattern A / C / D launch. Returns a promise that resolves
   * after the POST + SSE setup completes (or fails). Callers do not await
   * the promise; UI uses `launchingFor` to render the busy state.
   */
  launchAction: (
    project: string,
    action: string,
    options?: LaunchOptions,
  ) => Promise<void>;
  /**
   * Remove a run card from the registry. Closes its EventSource. Does NOT
   * kill the child process (Node loses visibility once the child is
   * detached + spawned).
   */
  closeRun: (runId: string) => void;
  /**
   * Step 9 / Pattern E: whether the embedded xterm.js terminal modal is
   * enabled (node-pty loaded + AGENTIC_OS_PTY_SECRET set + launch enabled).
   * Resolved server-side in the layout and exposed here so any route's
   * client component can render the matching enabled/disabled affordance.
   */
  ptyEnabled: boolean;
}

/**
 * The context defaults to `null` rather than a no-op runtime so a missing
 * provider is a HARD error at the consumption site instead of silently
 * dropping launches on the floor. The `useAgenticOsRuntime()` hook throws
 * a descriptive error in that case.
 */
const AgenticOsRuntimeContext = createContext<AgenticOsRuntime | null>(null);

/**
 * Provider component re-export so callers don't need to import the raw
 * context object. The layout client wraps every child route with this.
 */
export const AgenticOsRuntimeProvider = AgenticOsRuntimeContext.Provider;

/**
 * Consume the shared runtime. Throws if called outside the layout's
 * provider -- caller is in the wrong tree.
 */
export function useAgenticOsRuntime(): AgenticOsRuntime {
  const ctx = useContext(AgenticOsRuntimeContext);
  if (ctx === null) {
    throw new Error(
      'useAgenticOsRuntime must be called inside AgenticOsRuntimeProvider. ' +
        'Wrap your component tree with AgenticOsLayoutClient (the /admin/' +
        'agentic-os layout already does this).',
    );
  }
  return ctx;
}

/**
 * Test-only helper: lets unit tests render a consumer without standing up
 * the full layout client. NOT exported from the package barrel; tests
 * import this path directly.
 */
export const __AgenticOsRuntimeContext_FOR_TESTS = AgenticOsRuntimeContext;
