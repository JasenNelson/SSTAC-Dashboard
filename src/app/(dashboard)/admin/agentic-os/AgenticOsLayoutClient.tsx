'use client';

// Agentic OS layout client.
//
// Owns the chrome that surrounds every sibling route in /admin/agentic-os:
//   - Admin pills bar (AdminFunctionsNav)
//   - Page sub-header (brand + indicator chips: agents, tasks, sessions)
//   - Left sidebar (category nav + route-specific sub-nav slot)
//   - Bottom tabbed terminal panel (logs / terminal / agents / tasks)
//   - Right detail aside (rendered only on the Projects route via the
//     `routeRightAside` slot; subscriptions and future routes render
//     full-width main panes)
//
// Owns the launch runtime state (runs, launchingFor, terminalTab) and the
// dispatch helpers (launchAction, closeRun) and exposes them via
// AgenticOsRuntimeProvider so route content on ANY sibling route can fire
// launches that stream output into the SAME bottom panel.
//
// Active category is computed from the current pathname (usePathname) so
// the sidebar highlight stays in sync with whichever sibling route Next
// has mounted into {children}.
//
// IMPORTANT: this component does NOT render the route's main pane content
// directly -- {children} arrives from Next's layout->page composition. The
// route's page is responsible for rendering its main pane (Projects view,
// SubscriptionsView, etc.) and for opting into the right detail aside via
// the `routeRightAside` context slot if it needs one.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
import AgenticOsSidebar, {
  type SidebarCategory,
} from '@/components/agentic-os/AgenticOsSidebar';
import TerminalPanel, {
  type TerminalTab,
  type ActiveRun,
  type LogLine,
} from '@/components/agentic-os/TerminalPanel';
import {
  AgenticOsRuntimeProvider,
  type AgenticOsRuntime,
  type LaunchOptions,
} from '@/lib/agentic-os/runtime-context';
import { TOOLTIPS } from '@/lib/agentic-os/status-helpers';

interface Props {
  /** Route content (Projects view, SubscriptionsView, etc.). */
  children: React.ReactNode;
  /** Step 9 / Pattern E: whether the embedded xterm.js modal is enabled
   *  (node-pty loaded + AGENTIC_OS_PTY_SECRET set + launch enabled).
   *  Resolved server-side in the layout and passed through. */
  ptyEnabled: boolean;
  /** Total agents discovered across projects + the shared global pool.
   *  Displayed in the header indicator chip. Computed once in the layout
   *  server component from the projects-map fan-out. */
  agentCountTotal: number;
}

/**
 * Map the current pathname to the active sidebar category. Defaults to
 * 'projects' (the root route) when the pathname doesn't match a known
 * sibling. This is the ONLY place URL -> category coupling lives.
 */
function categoryForPath(pathname: string | null): SidebarCategory {
  if (!pathname) return 'projects';
  if (pathname.startsWith('/admin/agentic-os/subscriptions')) {
    return 'subscriptions';
  }
  if (pathname.startsWith('/admin/agentic-os/github')) {
    return 'github';
  }
  if (pathname.startsWith('/admin/agentic-os/vercel')) {
    return 'vercel';
  }
  if (pathname.startsWith('/admin/agentic-os/notebooklm')) {
    return 'notebooklm';
  }
  return 'projects';
}

export default function AgenticOsLayoutClient({
  children,
  ptyEnabled,
  agentCountTotal,
}: Props) {
  const pathname = usePathname();
  const activeCategory = categoryForPath(pathname);

  // ----- Runtime state (lifted from AgenticOsClient) ------------------------
  // See runtime-context.ts for the rationale. Producers MUST use the
  // functional setState form so concurrent launches from different routes
  // don't race each other's state.
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const [launchingFor, setLaunchingFor] = useState<Set<string>>(() => new Set());
  const [terminalTab, setTerminalTab] = useState<TerminalTab>('logs');

  // Track open EventSources so unmount / manual-close can release them.
  // Stored in a ref to avoid re-renders on every open/close.
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Close all event sources on unmount. Without this, navigating away
  // from the page leaves connections open until the dev-server times
  // them out.
  useEffect(() => {
    const map = eventSourcesRef.current;
    return () => {
      for (const es of map.values()) {
        try {
          es.close();
        } catch {
          /* ignore */
        }
      }
      map.clear();
    };
  }, []);

  const closeRun = useCallback((runId: string) => {
    const es = eventSourcesRef.current.get(runId);
    if (es) {
      try {
        es.close();
      } catch {
        /* ignore */
      }
      eventSourcesRef.current.delete(runId);
    }
    setRuns((prev) => prev.filter((r) => r.runId !== runId));
  }, []);

  const launchAction = useCallback(
    async (
      project: string,
      action: string,
      options?: LaunchOptions,
    ): Promise<void> => {
      // Concurrency keys distinguish per-slug clicks so two different
      // discovered skills (or agents) can run concurrently on the same
      // project. Without this, two run_skill / run_agent launches on
      // the same project would race the single-string key.
      const slugForKey = options?.skillSlug ?? options?.agentSlug ?? '';
      const concurrencyKey = slugForKey
        ? `${project}::${action}::${slugForKey}`
        : `${project}::${action}`;
      let alreadyInFlight = false;
      setLaunchingFor((prev) => {
        if (prev.has(concurrencyKey)) {
          alreadyInFlight = true;
          return prev; // same reference -- no re-render
        }
        const next = new Set(prev);
        next.add(concurrencyKey);
        return next;
      });
      if (alreadyInFlight) return; // double-click guard
      try {
        const reqBody: {
          project: string;
          action: string;
          skillSlug?: string;
          agentSlug?: string;
        } = { project, action };
        if (options?.skillSlug) reqBody.skillSlug = options.skillSlug;
        if (options?.agentSlug) reqBody.agentSlug = options.agentSlug;
        const resp = await fetch('/api/agentic-os/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(reqBody),
        });
        if (!resp.ok) {
          let detail = '';
          try {
            const j = await resp.json();
            detail = j.error
              ? `${j.error}${j.detail ? ': ' + j.detail : ''}`
              : '';
          } catch {
            /* ignore */
          }
          alert(
            `Launch failed (${resp.status})${detail ? ': ' + detail : ''}`,
          );
          return;
        }
        const body = (await resp.json()) as {
          runId: string;
          pid?: number;
          status: string;
        };
        const startedAt = new Date().toISOString();
        // Optimistic command display. The server-side validator is the
        // source of truth; this is only what we render in the run card
        // while the child is alive. Mirror the server-side argv shape
        // exactly so the optimistic card matches the audit-log entry.
        // check_* actions (from the AI Subscriptions panel) are
        // project-agnostic system probes; their argv depends on the
        // template (claude auth status / codex login status / etc.).
        // Rather than mirror each one, fall through to a generic
        // optimistic shape: the action key as exe+args. The real argv
        // arrives via SSE within ms.
        const command =
          action === 'open_session'
            ? {
                exe: 'cmd.exe',
                args: ['/c', 'start', 'wt.exe', '-d', project, 'claude', '--resume'],
                cwd: project,
              }
            : action === 'run_skill' && options?.skillSlug
              ? {
                  exe: 'claude',
                  args: ['-p', `/${options.skillSlug}`],
                  cwd: project,
                }
              : action === 'run_agent' && options?.agentSlug
                ? {
                    exe: 'claude',
                    args: [
                      '--agent',
                      options.agentSlug,
                      '--bg',
                      `Begin working on ${project}.`,
                    ],
                    cwd: project,
                  }
                : action === 'check_claude_auth'
                  ? { exe: 'claude', args: ['auth', 'status'], cwd: project }
                  : action === 'check_codex_login'
                    ? { exe: 'codex', args: ['login', 'status'], cwd: project }
                    : action === 'check_cursor_about'
                      ? { exe: 'agent', args: ['about'], cwd: project }
                      : action === 'check_ollama_models'
                        ? { exe: 'ollama', args: ['list'], cwd: project }
                        : action === 'run_safe_exit'
                          ? { exe: 'claude', args: ['-p', '/safe-exit'], cwd: project }
                          : action === 'run_update_docs'
                            ? { exe: 'claude', args: ['-p', '/update-docs'], cwd: project }
                            : action === 'run_doc_navigator'
                              ? { exe: 'claude', args: ['-p', '/doc-navigator'], cwd: project }
                              : { exe: 'claude', args: ['-p', action], cwd: project };
        const newRun: ActiveRun = {
          runId: body.runId,
          project,
          action,
          command,
          startedAt,
          lines: [],
          status: 'running',
          exitCode: null,
          exitedAt: null,
        };
        setRuns((prev) => [newRun, ...prev]);
        setTerminalTab('logs');

        // Open the SSE stream. EventSource auto-reconnects on transient
        // network errors; we let it. On 'exit' or 'error after exit' we
        // close explicitly.
        const es = new EventSource(`/api/agentic-os/stream/${body.runId}`);
        eventSourcesRef.current.set(body.runId, es);

        const appendLine = (stream: 'stdout' | 'stderr', payload: string) => {
          try {
            const { text, ts } = JSON.parse(payload) as {
              text: string;
              ts: number;
            };
            setRuns((prev) =>
              prev.map((r) =>
                r.runId === body.runId
                  ? {
                      ...r,
                      lines: [...r.lines, { stream, text, ts } as LogLine],
                    }
                  : r,
              ),
            );
          } catch {
            // Malformed payload -- ignore.
          }
        };

        es.addEventListener('stdout', (e: MessageEvent) =>
          appendLine('stdout', e.data),
        );
        es.addEventListener('stderr', (e: MessageEvent) =>
          appendLine('stderr', e.data),
        );
        es.addEventListener('exit', (e: MessageEvent) => {
          try {
            const { exitCode, exitedAt } = JSON.parse(e.data) as {
              exitCode: number | null;
              exitedAt: string;
            };
            setRuns((prev) =>
              prev.map((r) =>
                r.runId === body.runId
                  ? {
                      ...r,
                      status: exitCode === 0 ? 'completed' : 'failed',
                      exitCode,
                      exitedAt,
                    }
                  : r,
              ),
            );
          } catch {
            // ignore
          }
          try {
            es.close();
          } catch {
            /* ignore */
          }
          eventSourcesRef.current.delete(body.runId);
        });
        es.addEventListener('snapshot_complete', () => {
          // Boundary marker -- noop in the client today; reserved for a
          // "live tail" indicator in a future step.
        });
        es.onerror = () => {
          // EventSource auto-reconnects on transient errors. Only treat as
          // terminal if the readyState is CLOSED (2) -- e.g. server hard-
          // closed after exit. In that case we already cleaned up via the
          // 'exit' handler; this is defense in depth.
          if (es.readyState === EventSource.CLOSED) {
            eventSourcesRef.current.delete(body.runId);
          }
        };
      } catch (err) {
        alert(
          'Launch network error: ' +
            (err instanceof Error ? err.message : String(err)),
        );
      } finally {
        setLaunchingFor((prev) => {
          if (!prev.has(concurrencyKey)) return prev; // already cleared elsewhere
          const next = new Set(prev);
          next.delete(concurrencyKey);
          return next;
        });
      }
    },
    // All reads/writes of launchingFor + runs happen through the functional
    // setState form, so the latest state is always observed without needing
    // these in the dep array. Re-allocating the callback on every mutation
    // would cause every consumer to re-render needlessly.
    [],
  );

  const runtime: AgenticOsRuntime = useMemo(
    () => ({
      runs,
      launchingFor,
      terminalTab,
      setTerminalTab,
      launchAction,
      closeRun,
      ptyEnabled,
    }),
    [runs, launchingFor, terminalTab, launchAction, closeRun, ptyEnabled],
  );

  const runningCount = runs.filter((r) => r.status === 'running').length;

  return (
    <AgenticOsRuntimeProvider value={runtime}>
      <div
        className="bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 min-h-screen"
        data-pty-enabled={ptyEnabled ? 'true' : 'false'}
      >
        {/* Admin pill-bar -- inherits the dashboard's slate/sky palette. */}
        <div className="px-4 pt-4">
          <AdminFunctionsNav />
        </div>

        {/* Page sub-header. */}
        <header className="h-12 border-y border-slate-200 dark:border-slate-700 flex items-center px-4 gap-4 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500" />
            <span className="font-semibold tracking-tight">Agentic OS</span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
              v0.1 dev
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 text-xs">
            <span
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
              title="Total agents discovered (project-scoped across all projects + shared global pool)"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  agentCountTotal > 0 ? 'bg-blue-400' : 'bg-blue-400/40'
                }`}
              />
              <span className="font-mono">{agentCountTotal} agents</span>
            </span>
            <span
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
              title={TOOLTIPS.step11}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
              <span className="font-mono">0 tasks</span>
            </span>
            <span
              className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
              title="Active Pattern A skill runs (step 6b)"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  runningCount > 0 ? 'bg-emerald-400' : 'bg-emerald-400/40'
                }`}
              />
              <span className="font-mono">{runningCount} sessions</span>
            </span>
          </div>
        </header>

        {/* Two-pane main grid: sidebar + main content. The route's content
            (children) decides internally whether to render a right detail
            aside (Projects view does; Subscriptions does not). Bottom
            terminal panel always renders, lifted out of any route's main
            content so launches from any route stream into the same place. */}
        <div className="grid grid-cols-[14rem_minmax(0,1fr)] min-h-[calc(100vh-14rem)] overflow-x-auto">
          <AgenticOsSidebar activeCategory={activeCategory}>
            {/* Route-specific sub-nav slot. Empty in PR-1: each sibling
                route renders its own filter / actions / indicator UI
                inline within its main pane (no portal / parallel-route
                wiring needed). Available for routes that prefer the
                dedicated sidebar region in a later PR. */}
          </AgenticOsSidebar>
          <main className="grid grid-rows-[1fr_18rem] overflow-hidden min-w-0">
            <div className="overflow-y-auto">{children}</div>
            <TerminalPanel
              activeTab={terminalTab}
              onTabChange={setTerminalTab}
              tooltips={{
                logs: 'Live stdout/stderr from launched Pattern A skills (step 6b)',
                terminal: TOOLTIPS.step9,
                agents: TOOLTIPS.step10,
                tasks: TOOLTIPS.step11,
              }}
              activeRuns={runs}
              onCloseRun={closeRun}
            />
          </main>
        </div>
      </div>
    </AgenticOsRuntimeProvider>
  );
}

// Note: the Step 9 / Pattern E embedded xterm.js modal (EmbeddedTerminalModal)
// is mounted inside the projects route (AgenticOsClient.tsx) because it's
// the only consumer in PR-1. Modal is a fixed-position overlay so its
// position in the React tree is irrelevant for layering. If/when another
// route needs to open it (e.g. a future Vercel-panel "open repo terminal"
// action), promote modal-open state into AgenticOsRuntime here.

export type { Props as AgenticOsLayoutClientProps };
