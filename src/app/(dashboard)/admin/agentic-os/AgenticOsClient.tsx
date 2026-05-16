'use client';

// Agentic OS admin page client — Step 3 of the MVP.
//
// Renders the static "pulse" view: project table, sidebar with filter +
// quick-actions, right-hand detail panel for the selected project, and a
// bottom tabbed terminal-shell placeholder. Launch/skill/agent/terminal
// surfaces are visually present but disabled with "MVP step N" tooltips so
// the layout is observable before the agentic behavior lands.
//
// Visual reference: .tmp_presentation/design_mockups/style1_linear_terminals.html
// Build plan: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §11 (steps 4-12)
//
// Styling: arbitrary palette values (#0A0A0A, #1F1F1F, etc.) are intentional
// and scoped to this page — they match the mockup's Linear-style dark dense
// aesthetic. The rest of the dashboard remains in its slate light/dark theme.
//
// Step-6 prep refactor (holistic-review NIT-1 + NIT-2): pure helpers + the
// TOOLTIPS constant live in `@/lib/agentic-os/status-helpers` (vitest-covered);
// the bottom tabbed terminal panel lives in `./TerminalPanel`; the right-hand
// project detail aside lives in `./ProjectDetailPanel`. This file retains
// selection / filter / tab state and the page-level layout grid.

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
import ActivitySparkline from '@/components/agentic-os/ActivitySparkline';
import ConvergenceGraph from '@/components/agentic-os/ConvergenceGraph';
import TerminalPanel, {
  type TerminalTab,
  type ActiveRun,
  type LogLine,
} from '@/components/agentic-os/TerminalPanel';
import ProjectDetailPanel from '@/components/agentic-os/ProjectDetailPanel';
import EmbeddedTerminalModal from '@/components/agentic-os/EmbeddedTerminalModal';
import type {
  Project,
  ConvergenceEdge,
} from '@/lib/agentic-os/parse-projects-map';
import type { ProjectActivity } from '@/lib/agentic-os/git-activity';
import type { ProjectSkills } from '@/lib/agentic-os/skill-discovery';
import type { ProjectAgents } from '@/lib/agentic-os/agent-discovery';
import {
  TOOLTIPS,
  inferStatus,
  sparklineToneFor,
  formatLastActivity,
  compactName,
  shortenPath,
  applyViewFilter,
  type ViewFilter,
} from '@/lib/agentic-os/status-helpers';

// Pattern A skill actions exposed by the per-row Skill v dropdown and the
// detail panel's claude-resume button. Order is presentation order. The
// action keys MUST match COMMAND_TEMPLATES keys in launch-validator.ts
// (gate 6 will 400 otherwise).
const PATTERN_A_SKILLS: ReadonlyArray<{ action: string; label: string; slash: string }> = [
  { action: 'run_safe_exit', label: '/safe-exit', slash: '/safe-exit' },
  { action: 'run_update_docs', label: '/update-docs', slash: '/update-docs' },
  { action: 'run_doc_navigator', label: '/doc-navigator', slash: '/doc-navigator' },
];

function skillForAction(action: string): string {
  const found = PATTERN_A_SKILLS.find((s) => s.action === action);
  return found ? found.slash : action;
}

export type AgenticOsResult =
  | { ok: true; projects: Project[]; edges: ConvergenceEdge[] }
  | {
      ok: false;
      error: string;
      detail?: string;
      expectedPath?: string;
      hint?: string;
    };

interface Props {
  result: AgenticOsResult;
  /** Per-project git activity, keyed by project name. Empty object on map read failure. */
  activity?: Record<string, ProjectActivity>;
  /** Per-project discovered skills (step 8 / Pattern C), keyed by project name.
   *  Empty object on map read failure; missing entries render as the
   *  "no skills discovered" placeholder. */
  projectSkills?: Record<string, ProjectSkills>;
  /** Per-project discovered agents (step 10 / Pattern D), keyed by project
   *  name. Each entry carries both project-scoped agents and the shared
   *  global agents list. Empty object on map read failure; missing entries
   *  render as the "no agents discovered" placeholder. */
  projectAgents?: Record<string, ProjectAgents>;
  /** Step 9 / Pattern E: whether the embedded xterm.js terminal modal is
   *  enabled. Server-resolved (isAgenticOsPtyEnabled checks node-pty +
   *  AGENTIC_OS_PTY_SECRET + launch-enabled). When false the "Open in
   *  embedded terminal" button stays disabled with an explanatory tooltip. */
  ptyEnabled?: boolean;
}

function ErrorState({
  error,
  detail,
  expectedPath,
  hint,
}: Extract<AgenticOsResult, { ok: false }>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 p-8">
      <div className="max-w-2xl mx-auto mt-12 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">{error}</h1>
        {expectedPath && (
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono mb-4 break-all">
            Expected at:{' '}
            <code className="text-slate-900 dark:text-slate-100">{expectedPath}</code>
          </div>
        )}
        {detail && (
          <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 mb-4 overflow-x-auto">
            {detail}
          </pre>
        )}
        {hint && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{hint}</p>
        )}
      </div>
    </div>
  );
}

export default function AgenticOsClient({
  result,
  activity = {},
  projectSkills = {},
  projectAgents = {},
  ptyEnabled = false,
}: Props) {
  // Hooks must be unconditional — declare ALL state before the early return.
  const [selectedName, setSelectedName] = useState<string | null>(
    result.ok && result.projects.length > 0 ? result.projects[0].name : null
  );
  const [filter, setFilter] = useState('');
  // Owner-bug 4 (2026-05-16): the three Views items used to be inert <div>s.
  // They now control this discriminated-union state, which feeds into
  // applyViewFilter alongside the free-text filter. Default 'all' preserves
  // the prior no-op behavior so the page renders identically on first load.
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [terminalTab, setTerminalTab] = useState<TerminalTab>('logs');

  // Step 6b: active run streams. Keyed by runId; rendered by TerminalPanel.
  // EventSource lifecycle:
  //  - opened by launchAction() on successful POST to /launch
  //  - closed by the 'exit' event handler (server signals child close)
  //  - closed on component unmount (effect cleanup below)
  //  - closed when the user clicks the run card's x (closeRun handler)
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  // Step 9 / Pattern E: which project (if any) has the embedded terminal
  // modal open. Null = modal closed. Only one modal open at a time -- the
  // mockup doesn't suggest stacking embedded terminals.
  const [embeddedTerminalProject, setEmbeddedTerminalProject] = useState<string | null>(null);
  const openEmbeddedTerminal = useCallback((project: string) => {
    if (!ptyEnabled) return; // defense in depth -- button is also disabled
    setEmbeddedTerminalProject(project);
  }, [ptyEnabled]);
  const closeEmbeddedTerminal = useCallback(() => {
    setEmbeddedTerminalProject(null);
  }, []);
  // Set of in-flight "${project}::${action}" concurrency keys. A Set (rather
  // than a single string) lets concurrent launches across different rows
  // coexist without racing each other: a fast click followed by a slow click
  // would otherwise leave the slow launch's button stuck busy when the fast
  // launch cleared the single-string state. React update detection requires
  // a new Set reference on every mutation -- callers MUST use `new Set(prev)`
  // before add/delete (see addLaunching / removeLaunching helpers below).
  const [launchingFor, setLaunchingFor] = useState<Set<string>>(() => new Set());
  // Track open EventSources so unmount + manual-close can release them.
  // Stored in a ref to avoid re-renders on every open/close.
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Close all event sources on unmount. Without this, navigating away from
  // the page leaves connections open until the dev-server times them out.
  useEffect(() => {
    const map = eventSourcesRef.current;
    return () => {
      for (const es of map.values()) {
        try { es.close(); } catch { /* ignore */ }
      }
      map.clear();
    };
  }, []);

  const closeRun = useCallback((runId: string) => {
    const es = eventSourcesRef.current.get(runId);
    if (es) {
      try { es.close(); } catch { /* ignore */ }
      eventSourcesRef.current.delete(runId);
    }
    setRuns((prev) => prev.filter((r) => r.runId !== runId));
  }, []);

  const launchAction = useCallback(
    async (
      project: string,
      action: string,
      options?: { skillSlug?: string; agentSlug?: string },
    ) => {
      // Concurrency keys distinguish per-slug clicks so two different
      // discovered skills (or agents) can run concurrently on the same project.
      // Without this, two run_skill / run_agent launches on the same project
      // would race the single-string key. Order: skillSlug then agentSlug;
      // they are mutually exclusive at the action level (run_skill vs run_agent)
      // so only one branch is ever taken.
      const slugForKey = options?.skillSlug ?? options?.agentSlug ?? '';
      const concurrencyKey = slugForKey
        ? `${project}::${action}::${slugForKey}`
        : `${project}::${action}`;
      // Functional read via setState to avoid capturing a stale Set reference
      // in the closure (the useCallback dep list intentionally omits
      // launchingFor so back-to-back launches don't allocate a new callback).
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
        } = {
          project,
          action,
        };
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
            detail = j.error ? `${j.error}${j.detail ? ': ' + j.detail : ''}` : '';
          } catch { /* ignore */ }
          alert(`Launch failed (${resp.status})${detail ? ': ' + detail : ''}`);
          return;
        }
        const body = (await resp.json()) as {
          runId: string;
          pid?: number;
          status: string;
        };
        const startedAt = new Date().toISOString();
        // Optimistic command display. The server-side validator is the source
        // of truth; this is only what we render in the run card while the
        // child is alive. open_session (Pattern B, step 7 / BUG-3 fix
        // 2026-05-16) spawns cmd.exe which fires `start wt.exe ...` to
        // activate the wt.exe AppExecutionAlias via the shell; cmd.exe
        // exits within ms, the activated wt.exe paints its tab in a
        // separate process tree, and the run card flips to "completed"
        // with empty stdout. Mirror the server-side argv shape exactly
        // so the optimistic card matches the audit-log entry.
        const command =
          action === 'open_session'
            ? {
                exe: 'cmd.exe',
                args: ['/c', 'start', 'wt.exe', '-d', project, 'claude', '--resume'],
                cwd: project,
              }
            : action === 'run_skill' && options?.skillSlug
              ? { exe: 'claude', args: ['-p', `/${options.skillSlug}`], cwd: project }
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
                : { exe: 'claude', args: ['-p', skillForAction(action)], cwd: project };
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
            const { text, ts } = JSON.parse(payload) as { text: string; ts: number };
            setRuns((prev) =>
              prev.map((r) =>
                r.runId === body.runId
                  ? { ...r, lines: [...r.lines, { stream, text, ts } as LogLine] }
                  : r,
              ),
            );
          } catch {
            // Malformed payload -- ignore.
          }
        };

        es.addEventListener('stdout', (e: MessageEvent) => appendLine('stdout', e.data));
        es.addEventListener('stderr', (e: MessageEvent) => appendLine('stderr', e.data));
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
          try { es.close(); } catch { /* ignore */ }
          eventSourcesRef.current.delete(body.runId);
        });
        es.addEventListener('snapshot_complete', () => {
          // Boundary marker -- noop in the client today; reserved for
          // a "live tail" indicator in a future step.
        });
        es.onerror = () => {
          // EventSource auto-reconnects on transient errors. Only treat as
          // terminal if the readyState is CLOSED (2) -- e.g. server hard-closed
          // after exit. In that case we already cleaned up via the 'exit'
          // handler; this is defense in depth.
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
    // launchingFor intentionally omitted: all reads/writes happen through
    // the functional setLaunchingFor form so the latest state is always
    // observed without re-allocating this callback on every mutation.
    [],
  );

  // Wrap `projects` in its own useMemo so the downstream filteredProjects /
  // statusCounts / agentCountTotal references see a STABLE array identity
  // across renders when `result` does not change. Without this, the ternary
  // `result.ok ? result.projects : []` returns a fresh `[]` reference each
  // render in the error branch, which would invalidate every useMemo that
  // depends on it -- and would trigger the react-hooks/exhaustive-deps
  // warning on filteredProjects' dependency array (NIT-A from the
  // holistic review). Polishes that warning cleanly without an eslint-disable.
  const projects = useMemo(
    () => (result.ok ? result.projects : []),
    [result],
  );

  // Owner-bug 4 (2026-05-16): combined free-text + Views filter is now
  // applied through the pure applyViewFilter helper in status-helpers.ts so
  // it can be unit-tested without DOM. The helper accepts readonly arrays,
  // hence the cast back to Project[] -- the result is structurally identical
  // and downstream code only reads from it.
  const filteredProjects = useMemo(
    () => applyViewFilter(projects, filter, viewFilter),
    [projects, filter, viewFilter],
  );

  // If the user filters in a way that excludes the currently-selected project,
  // the right detail panel would otherwise show a project not visible in the
  // table -- confusing. Reset selection to the first match (or null if empty).
  useEffect(() => {
    if (
      selectedName &&
      !filteredProjects.some((p) => p.name === selectedName)
    ) {
      setSelectedName(filteredProjects[0]?.name ?? null);
    }
  }, [filteredProjects, selectedName]);

  if (!result.ok) {
    return <ErrorState {...result} />;
  }

  const selectedProject =
    projects.find((p) => p.name === selectedName) ?? null;

  const statusCounts = {
    total: projects.length,
    active: projects.filter((p) => inferStatus(p.status).label === 'active')
      .length,
    blocked: projects.filter((p) => inferStatus(p.status).label === 'blocked')
      .length,
  };

  // Total discovered agents across all projects + the shared global list
  // (counted once, since it's identical for every project entry).
  const agentCountTotal = (() => {
    let projTotal = 0;
    let globalCount = 0;
    let sawGlobal = false;
    for (const p of projects) {
      const pa = projectAgents[p.name];
      if (!pa) continue;
      projTotal += pa.projectAgents.length;
      if (!sawGlobal) {
        globalCount = pa.globalAgents.length;
        sawGlobal = true;
      }
    }
    return projTotal + globalCount;
  })();

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
      {/* Admin pill-bar — inherits the dashboard's slate/sky palette directly now. */}
      <div className="px-4 pt-4">
        <AdminFunctionsNav />
      </div>

      {/* Page sub-header — Agentic OS brand + v0.1 dev + indicator chips. */}
      <header className="h-12 border-y border-slate-200 dark:border-slate-700 flex items-center px-4 gap-4 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500" />
          <span className="font-semibold tracking-tight">Agentic OS</span>
          <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">v0.1 dev</span>
        </div>
        <div className="flex-1" />
        {/* Indicator chips — all zero at step 3; populated by later steps. */}
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
                runs.some((r) => r.status === 'running')
                  ? 'bg-emerald-400'
                  : 'bg-emerald-400/40'
              }`}
            />
            <span className="font-mono">
              {runs.filter((r) => r.status === 'running').length} sessions
            </span>
          </span>
        </div>
      </header>

      {/* Three-pane main grid. Min-height keeps the layout observable on
          short viewports; overflow-x-auto lets the page scroll horizontally
          (rather than break) on viewports narrower than the fixed 14+20rem
          side panels. Responsive collapse to a drawer is a follow-up. */}
      <div className="grid grid-cols-[14rem_minmax(0,1fr)_20rem] min-h-[calc(100vh-14rem)] overflow-x-auto">
        {/* Left sidebar */}
        <aside className="border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects"
              aria-label="Filter projects by name, tag, or purpose"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 text-xs placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-slate-900 dark:text-slate-100"
            />
          </div>
          <nav className="flex-1 overflow-y-auto py-2 text-[13px]" aria-label="Project views">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Views
            </div>
            {/* Owner-bug 4 (2026-05-16): three Views items are now clickable
                buttons that set viewFilter. The selected item carries the
                violet left-border + slate-100 highlight that previously sat
                statically on "All projects". role="radiogroup" semantics
                (above) + aria-pressed on each button signal the
                mutually-exclusive state to screen readers. */}
            {(
              [
                { id: 'all', label: 'All projects', count: statusCounts.total },
                { id: 'active', label: 'Active', count: statusCounts.active },
                { id: 'blocked', label: 'Blocked', count: statusCounts.blocked },
              ] as ReadonlyArray<{ id: ViewFilter; label: string; count: number }>
            ).map((v) => {
              const selected = viewFilter === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setViewFilter(v.id)}
                  title={
                    v.id === 'all'
                      ? 'Show every project'
                      : `Show only projects whose inferred status is ${v.id}`
                  }
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                    selected
                      ? 'bg-slate-100 dark:bg-slate-800 border-l-2 border-violet-500 text-slate-900 dark:text-slate-100'
                      : 'border-l-2 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span>{v.label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {v.count}
                  </span>
                </button>
              );
            })}

            <div
              className="px-3 py-1 mt-4 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between"
              title="Active Pattern A skill runs (step 6b)"
            >
              <span>Running</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono normal-case font-normal">
                {runs.filter((r) => r.status === 'running').length}
              </span>
            </div>
            {runs.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 italic">
                No active sessions
              </div>
            ) : (
              runs.slice(0, 5).map((r) => (
                <div
                  key={r.runId}
                  className="px-3 py-1 text-xs text-slate-700 dark:text-slate-300 truncate font-mono flex items-center gap-1.5"
                  title={`${r.project} - ${r.action} (${r.status})`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.status === 'running'
                        ? 'bg-sky-400'
                        : r.status === 'completed'
                          ? 'bg-emerald-400'
                          : 'bg-red-400'
                    }`}
                  />
                  <span className="truncate">{r.project}</span>
                </div>
              ))
            )}

            <div className="px-3 py-1 mt-4 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Quick actions
            </div>
            {/* Owner-bug 1 (2026-05-16): these three items are deferred (some
                indefinitely -- "Detect orphans" was a mockup-only idea). They
                used to render as <button disabled> which gave Windows browsers
                a red "no-entry" cursor that looked like a broken affordance.
                Owner directive: style as "coming soon" -- italic + reduced
                opacity, NO cursor-not-allowed, NO hover state, NO disabled
                attribute (so the cursor stays as default and they read as
                informational labels rather than broken controls). Rendered as
                <div role="note"> so screen readers don't announce them as
                interactive. */}
            <div
              role="note"
              className="block w-full text-left px-3 py-1.5 text-xs italic text-slate-500 dark:text-slate-400 opacity-50 select-none"
              title="Bulk Pattern A across all projects -- coming soon. Use the per-row Skill v dropdown today."
            >
              /safe-exit on all
              <span className="ml-1 text-[10px] font-mono not-italic">
                (coming soon)
              </span>
            </div>
            <div
              role="note"
              className="block w-full text-left px-3 py-1.5 text-xs italic text-slate-500 dark:text-slate-400 opacity-50 select-none"
              title="Orphan-process detection from the dashboard -- coming soon."
            >
              Detect orphans
              <span className="ml-1 text-[10px] font-mono not-italic">
                (coming soon)
              </span>
            </div>
            <div
              role="note"
              className="block w-full text-left px-3 py-1.5 text-xs italic text-slate-500 dark:text-slate-400 opacity-50 select-none"
              title="Cowork daily digest preview -- coming soon (lives on a separate machine)."
            >
              Daily digest preview
              <span className="ml-1 text-[10px] font-mono not-italic">
                (coming soon)
              </span>
            </div>
          </nav>
        </aside>

        {/*
          Main content: project table on top, terminal shell on bottom.
          Explicit row sizing (1fr top, 18rem bottom) is required so the
          terminal panel actually gets vertical space. A previous attempt
          with `grid-rows-[1fr_auto]` + inline `height: 32%` collapsed the
          bottom row to its content because percentage heights need a
          definite parent dimension that `auto` does not provide.
        */}
        <main className="grid grid-rows-[1fr_18rem] overflow-hidden min-w-0">
          <div className="overflow-y-auto">
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-baseline gap-3">
              {/* h2 because the dashboard's <Header> already emits the page's h1. */}
              <h2 className="text-base font-semibold">All projects</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {filteredProjects.length} of {projects.length}
                {filter ? ` matching "${filter}"` : ''}
                {viewFilter !== 'all' ? ` | view: ${viewFilter}` : ''}
              </span>
              <div className="flex-1" />
              <button
                className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 cursor-not-allowed rounded px-2.5 py-1 font-medium border border-violet-200 dark:border-violet-700/30 opacity-70"
                disabled
                title="Bulk action picker ships after step 6b -- use the per-row Skill v dropdown today"
              >
                + Action
              </button>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400 italic">
                {filter || viewFilter !== 'all'
                  ? // Owner-bug 4 (2026-05-16): the empty-state message now
                    // reflects BOTH the free-text and Views filter so the
                    // user knows which control to clear when zero rows
                    // remain after applying e.g. the "Active" view + a
                    // text-search that excludes every active project.
                    `No projects match the current filters${
                      filter ? ` (text: "${filter}")` : ''
                    }${
                      viewFilter !== 'all' ? ` (view: ${viewFilter})` : ''
                    }. Clear them to see all ${projects.length}.`
                  : 'PROJECTS_MAP.md parsed cleanly but contained no projects under "## Active Projects".'}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left font-medium px-6 py-2 w-1/3">
                      Project
                    </th>
                    <th className="text-left font-medium px-2 py-2">Status</th>
                    <th className="text-left font-medium px-2 py-2 w-32">
                      Activity
                    </th>
                    <th className="text-left font-medium px-2 py-2">Last</th>
                    <th className="text-right font-medium px-6 py-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((p) => {
                    const status = inferStatus(p.status);
                    const isSelected = p.name === selectedName;
                    return (
                      <tr
                        key={p.name}
                        // Row acts as a button — Enter / Space select. Mouse
                        // clicks anywhere in the row still work via onClick.
                        // Action buttons inside the row stopPropagation.
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`Select project ${p.name}`}
                        onClick={() => setSelectedName(p.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedName(p.name);
                          }
                        }}
                        className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer group focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                          isSelected ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-white dark:bg-slate-800'
                        }`}
                      >
                        <td className="px-6 py-2.5">
                          <div className="font-medium flex items-center gap-2">
                            <span>{compactName(p.name)}</span>
                            {isSelected && (
                              <span className="text-violet-600 dark:text-violet-400 text-[10px] font-mono">
                                · selected
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                            {shortenPath(p.path) || (
                              <span className="italic text-slate-400 dark:text-slate-500">
                                (path missing in PROJECTS_MAP.md)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 align-middle">
                          <span className="text-xs inline-flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${status.color}`}
                            />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-2 align-middle">
                          <ActivitySparkline
                            data={activity[p.name]?.daily ?? []}
                            tone={sparklineToneFor(status.label)}
                          />
                        </td>
                        <td className="px-2 align-middle text-xs text-slate-600 dark:text-slate-400 font-mono">
                          {formatLastActivity(activity[p.name]?.lastCommitAt ?? null)}
                        </td>
                        <td className="px-6 text-right">
                          <div
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {/* Step 9 / Pattern E: embedded xterm.js modal.
                                Live when ptyEnabled (server-side check that
                                node-pty loaded + AGENTIC_OS_PTY_SECRET is
                                set + launch-enabled). Disabled with an
                                explanatory tooltip otherwise. */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                openEmbeddedTerminal(p.name);
                              }}
                              disabled={!ptyEnabled}
                              className={
                                ptyEnabled
                                  ? 'text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/30 rounded px-2 py-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500'
                                  : 'text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 cursor-not-allowed text-slate-500 dark:text-slate-400 opacity-60'
                              }
                              title={
                                ptyEnabled
                                  ? 'Open an embedded xterm.js terminal modal connected to a real PTY (claude --resume) for this project'
                                  : 'Set AGENTIC_OS_PTY_SECRET in .env.local and run `npm run pty-server` to enable the embedded terminal modal'
                              }
                            >
                              Open
                            </button>
                            {/* Step 7: Pattern B (wt.exe external pop-out).
                                Fires open_session which spawns a new Windows
                                Terminal tab running `claude --resume` in the
                                project cwd. wt.exe exits immediately (exit 0);
                                the audit log + SSE wiring still record the
                                launch. */}
                            {(() => {
                              const concurrencyKey = `${p.name}::open_session`;
                              const busy = launchingFor.has(concurrencyKey);
                              return (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    void launchAction(p.name, 'open_session');
                                  }}
                                  className="text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/30 rounded px-2 py-0.5 hover:bg-sky-200 dark:hover:bg-sky-900/50 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                                  title={TOOLTIPS.step7}
                                >
                                  [ ] external{busy && ' ...'}
                                </button>
                              );
                            })()}
                            {/* Skill v dropdown (Pattern A, step 6b + Pattern C, step 8).
                                Native <details> avoids dependency on a headless
                                UI library; the summary acts as the button.
                                Top section: the three hardcoded Pattern A
                                baselines. Bottom section: skills discovered
                                from <project>/.claude/skills/ via server-side
                                discoverProjectSkills. The two are separated
                                by an <hr role="separator"> divider so the
                                hardcoded set stays visually distinct from
                                project-local discovery (audit-trail clarity). */}
                            <details className="relative">
                              <summary
                                className="list-none cursor-pointer text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/30 rounded px-2 py-0.5 hover:bg-violet-200 dark:hover:bg-violet-900/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                                title="Launch a Pattern A headless skill (claude -p '/<skill>')"
                              >
                                Skill v
                              </summary>
                              <div className="absolute right-0 mt-1 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-md py-1 min-w-[14rem] max-h-60 overflow-y-auto">
                                {PATTERN_A_SKILLS.map((s) => {
                                  const concurrencyKey = `${p.name}::${s.action}`;
                                  const busy = launchingFor.has(concurrencyKey);
                                  return (
                                    <button
                                      key={s.action}
                                      type="button"
                                      disabled={busy}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        // Close the <details> popover.
                                        const det = (
                                          e.currentTarget.closest('details') as HTMLDetailsElement | null
                                        );
                                        if (det) det.open = false;
                                        void launchAction(p.name, s.action);
                                      }}
                                      className="block w-full text-left text-xs px-3 py-1.5 font-mono text-slate-800 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50 disabled:cursor-wait"
                                    >
                                      {s.label}
                                      {busy && (
                                        <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                          ...
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Pattern C (step 8): discovered skills.
                                    Divider gives a clear visual + a11y break
                                    between the hardcoded baseline above and
                                    project-local discovery below. */}
                                <hr
                                  role="separator"
                                  className="my-1 border-slate-200 dark:border-slate-700"
                                />
                                <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                                  Project skills
                                </div>
                                {(() => {
                                  const ps = projectSkills[p.name];
                                  if (ps?.error) {
                                    return (
                                      <div className="px-3 py-1 text-[10px] italic text-red-600 dark:text-red-400">
                                        Skill discovery failed: {ps.error}
                                      </div>
                                    );
                                  }
                                  if (!ps || ps.skills.length === 0) {
                                    return (
                                      <div className="px-3 py-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                                        No skills discovered for this project
                                      </div>
                                    );
                                  }
                                  return (
                                    <>
                                      {ps.skills.map((sk) => {
                                        const concurrencyKey = `${p.name}::run_skill::${sk.slug}`;
                                        const busy = launchingFor.has(concurrencyKey);
                                        return (
                                          <button
                                            key={sk.slug}
                                            type="button"
                                            disabled={busy}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              const det = (
                                                e.currentTarget.closest('details') as HTMLDetailsElement | null
                                              );
                                              if (det) det.open = false;
                                              void launchAction(p.name, 'run_skill', { skillSlug: sk.slug });
                                            }}
                                            className="block w-full text-left text-xs px-3 py-1.5 text-slate-800 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-50 disabled:cursor-wait"
                                            title={`Run claude -p '/${sk.slug}' in ${p.name}`}
                                          >
                                            <div className="font-mono">
                                              /{sk.slug}
                                              {sk.name && sk.name !== sk.slug && (
                                                <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                                                  {sk.name}
                                                </span>
                                              )}
                                              {busy && (
                                                <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                                  ...
                                                </span>
                                              )}
                                            </div>
                                            {sk.description && (
                                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug whitespace-normal break-words">
                                                {sk.description}
                                              </div>
                                            )}
                                          </button>
                                        );
                                      })}
                                      {ps.truncated && (
                                        <div className="px-3 py-1 text-[10px] italic text-amber-600 dark:text-amber-400">
                                          More skills exist; cap at 50
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </details>
                            {/* Pattern D (step 10): Agent v dropdown.
                                Lists project-scoped agents from
                                <project>/.claude/agents/*.md AND global
                                agents from ~/.claude/agents/*.md (the same
                                global list appears on every row). Click
                                fires launchAction(p.name, 'run_agent',
                                { agentSlug: agent.slug }) which routes
                                through the same /api/agentic-os/launch +
                                SSE plumbing as Pattern A/C, so the run
                                surfaces in the run-card list. */}
                            <details className="relative">
                              <summary
                                className="list-none cursor-pointer text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/30 rounded px-2 py-0.5 hover:bg-sky-200 dark:hover:bg-sky-900/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                                title="Launch a Pattern D agent (claude --agent <slug> --bg)"
                              >
                                Agent v
                              </summary>
                              <div className="absolute right-0 mt-1 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-md py-1 min-w-[14rem] max-h-60 overflow-y-auto">
                                {(() => {
                                  const pa = projectAgents[p.name];
                                  const projAgents = pa?.projectAgents ?? [];
                                  const globAgents = pa?.globalAgents ?? [];
                                  const hasAny =
                                    projAgents.length > 0 || globAgents.length > 0;
                                  return (
                                    <>
                                      <div
                                        className="px-3 py-1 text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold"
                                        aria-label="Project-scoped agents"
                                      >
                                        Project agents
                                      </div>
                                      {pa?.error ? (
                                        <div className="px-3 py-1 text-[10px] italic text-red-600 dark:text-red-400">
                                          Agent discovery failed: {pa.error}
                                        </div>
                                      ) : projAgents.length === 0 ? (
                                        <div className="px-3 py-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                                          {globAgents.length > 0
                                            ? 'No project agents; see global agents below'
                                            : 'No project agents'}
                                        </div>
                                      ) : (
                                        projAgents.map((ag) => {
                                          const concurrencyKey = `${p.name}::run_agent::${ag.slug}`;
                                          const busy = launchingFor.has(concurrencyKey);
                                          return (
                                            <button
                                              key={`p-${ag.slug}`}
                                              type="button"
                                              disabled={busy}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                const det = (
                                                  e.currentTarget.closest(
                                                    'details',
                                                  ) as HTMLDetailsElement | null
                                                );
                                                if (det) det.open = false;
                                                void launchAction(p.name, 'run_agent', {
                                                  agentSlug: ag.slug,
                                                });
                                              }}
                                              className="block w-full text-left text-xs px-3 py-1.5 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 disabled:opacity-50 disabled:cursor-wait"
                                              title={`Run claude --agent ${ag.slug} --bg in ${p.name}`}
                                            >
                                              <div className="font-mono">
                                                {ag.slug}
                                                {ag.name && ag.name !== ag.slug && (
                                                  <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                                                    {ag.name}
                                                  </span>
                                                )}
                                                {busy && (
                                                  <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                                    ...
                                                  </span>
                                                )}
                                              </div>
                                              {ag.description && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug whitespace-normal break-words">
                                                  {ag.description}
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })
                                      )}
                                      <hr
                                        role="separator"
                                        className="my-1 border-slate-200 dark:border-slate-700"
                                      />
                                      <div
                                        className="px-3 py-1 text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold"
                                        aria-label="Global (user-scoped) agents"
                                      >
                                        Global agents
                                      </div>
                                      {globAgents.length === 0 ? (
                                        <div className="px-3 py-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                                          No global agents
                                        </div>
                                      ) : (
                                        globAgents.map((ag) => {
                                          const concurrencyKey = `${p.name}::run_agent::${ag.slug}`;
                                          const busy = launchingFor.has(concurrencyKey);
                                          return (
                                            <button
                                              key={`g-${ag.slug}`}
                                              type="button"
                                              disabled={busy}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                const det = (
                                                  e.currentTarget.closest(
                                                    'details',
                                                  ) as HTMLDetailsElement | null
                                                );
                                                if (det) det.open = false;
                                                void launchAction(p.name, 'run_agent', {
                                                  agentSlug: ag.slug,
                                                });
                                              }}
                                              className="block w-full text-left text-xs px-3 py-1.5 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 disabled:opacity-50 disabled:cursor-wait"
                                              title={`Run claude --agent ${ag.slug} --bg in ${p.name}`}
                                            >
                                              <div className="font-mono">
                                                {ag.slug}
                                                {ag.name && ag.name !== ag.slug && (
                                                  <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                                                    {ag.name}
                                                  </span>
                                                )}
                                                {busy && (
                                                  <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                                    ...
                                                  </span>
                                                )}
                                              </div>
                                              {ag.description && (
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug whitespace-normal break-words">
                                                  {ag.description}
                                                </div>
                                              )}
                                            </button>
                                          );
                                        })
                                      )}
                                      {pa?.truncated && (
                                        <div className="px-3 py-1 text-[10px] italic text-amber-600 dark:text-amber-400">
                                          More project agents exist; cap at 50
                                        </div>
                                      )}
                                      {!hasAny && !pa?.error && (
                                        <div className="sr-only">
                                          No agents discovered
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Convergence graph — step 5. Interactive node-and-edge view of
                the parsed convergence edges. Falls back to an sr-only text
                list internally for screen readers. */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                Convergence graph
                <span className="ml-2 font-mono normal-case text-slate-500 dark:text-slate-400">
                  ({projects.length} projects · {result.edges.length} edges
                  {result.edges.filter((e) => e.dashed).length > 0
                    ? ` · ${result.edges.filter((e) => e.dashed).length} dashed (future)`
                    : ''}
                  )
                </span>
              </div>
              <ConvergenceGraph
                edges={result.edges}
                projects={projects}
              />
            </div>
          </div>

          {/* Bottom terminal panel — step 6b: logs tab is live (SSE-driven). */}
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

        {/* Right detail panel */}
        <ProjectDetailPanel
          project={selectedProject}
          activity={selectedProject ? activity[selectedProject.name] : undefined}
          skills={selectedProject ? projectSkills[selectedProject.name] : undefined}
          agents={selectedProject ? projectAgents[selectedProject.name] : undefined}
          tooltips={TOOLTIPS}
          onLaunch={launchAction}
          launchingFor={launchingFor}
          patternASkills={PATTERN_A_SKILLS}
          ptyEnabled={ptyEnabled}
          onOpenEmbeddedTerminal={openEmbeddedTerminal}
        />
      </div>

      {/* Step 9 / Pattern E: embedded xterm.js modal. Mounted only when a
          project is selected. The modal owns its own xterm.js + WebSocket
          lifecycle; the parent just controls which project (if any) is
          currently open. */}
      {embeddedTerminalProject && (
        <EmbeddedTerminalModal
          project={embeddedTerminalProject}
          onClose={closeEmbeddedTerminal}
        />
      )}
    </div>
  );
}
