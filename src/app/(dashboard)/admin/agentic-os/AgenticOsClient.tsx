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

import { useState, useMemo, useEffect } from 'react';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
import ActivitySparkline, {
  type SparklineTone,
} from '@/components/agentic-os/ActivitySparkline';
import ConvergenceGraph from '@/components/agentic-os/ConvergenceGraph';
import type {
  Project,
  ConvergenceEdge,
} from '@/lib/agentic-os/parse-projects-map';
import type { ProjectActivity } from '@/lib/agentic-os/git-activity';

export type AgenticOsResult =
  | { ok: true; projects: Project[]; edges: ConvergenceEdge[] }
  | {
      ok: false;
      error: string;
      detail?: string;
      expectedPath?: string;
      hint?: string;
    };

type TerminalTab = 'logs' | 'terminal' | 'agents' | 'tasks';

interface Props {
  result: AgenticOsResult;
  /** Per-project git activity, keyed by project name. Empty object on map read failure. */
  activity?: Record<string, ProjectActivity>;
}

// Step-deferral tooltips so the disabled buttons explain themselves on hover.
const TOOLTIP = {
  step5: 'Mermaid convergence graph arrives in MVP step 5',
  step6: 'Launch buttons arrive in MVP step 6 (Pattern A: headless)',
  step7: 'External Windows Terminal pop-out arrives in MVP step 7',
  step8: 'Skill dropdown + per-project skill discovery arrives in MVP step 8',
  step9: 'Embedded xterm.js modal arrives in MVP step 9',
  step10: 'Agent dropdown + spawn arrives in MVP step 10',
  step11: 'Cowork daily digest + Telegram automation arrives in MVP step 11',
} as const;

/**
 * Map an inferred project status label to the sparkline color tone.
 * `total === 0` already overrides to "idle" inside the sparkline itself,
 * so the only mapping needed here is: blocked -> red, everything else -> emerald.
 */
function sparklineToneFor(statusLabel: string): SparklineTone {
  return statusLabel === 'blocked' ? 'blocked' : 'active';
}

/**
 * Render a commit timestamp as a compact "Xm / Xh / Xd / Mon DD" relative
 * marker for the table's Last column.
 */
function formatLastActivity(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// Map free-text Status field to a badge color. The data is human-maintained
// so we keyword-sniff rather than expect strict enum values.
function inferStatus(status: string): { color: string; label: string } {
  const lower = status.toLowerCase();
  if (lower.includes('blocked') || lower.includes('auth_point')) {
    return { color: 'bg-red-400', label: 'blocked' };
  }
  if (lower.includes('paused')) {
    return { color: 'bg-amber-400', label: 'paused' };
  }
  if (lower.includes('stale')) {
    return { color: 'bg-gray-500', label: 'stale' };
  }
  if (lower.includes('done') || lower.includes('archived')) {
    return { color: 'bg-gray-400', label: 'done' };
  }
  return { color: 'bg-emerald-400', label: 'active' };
}

// "Compact" project name for the table — lowercase + dash format mirrors the
// mockup's display style without mutating the source data.
function compactName(name: string): string {
  return name.toLowerCase();
}

// Show absolute Windows-style paths as ~-prefixed shorthand for tighter table
// rows. Falls back to the raw value if the path doesn't match the convention.
function shortenPath(absPath: string): string {
  if (!absPath) return '';
  const match = absPath.match(/^[A-Za-z]:\\Projects\\(.+?)\\?$/);
  if (match) return `~/Projects/${match[1].replace(/\\/g, '/')}`;
  return absPath;
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

export default function AgenticOsClient({ result, activity = {} }: Props) {
  // Hooks must be unconditional — declare ALL state before the early return.
  const [selectedName, setSelectedName] = useState<string | null>(
    result.ok && result.projects.length > 0 ? result.projects[0].name : null
  );
  const [filter, setFilter] = useState('');
  const [terminalTab, setTerminalTab] = useState<TerminalTab>('logs');

  const projects = result.ok ? result.projects : [];

  const filteredProjects = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.purpose.toLowerCase().includes(q)
    );
  }, [projects, filter]);

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
            title={TOOLTIP.step10}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/40" />
            <span className="font-mono">0 agents</span>
          </span>
          <span
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
            title={TOOLTIP.step11}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
            <span className="font-mono">0 tasks</span>
          </span>
          <span
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"
            title={TOOLTIP.step6}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40" />
            <span className="font-mono">0 sessions</span>
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
          <nav className="flex-1 overflow-y-auto py-2 text-[13px]">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Views
            </div>
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border-l-2 border-violet-500">
              All projects
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {statusCounts.total}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-3 py-1.5 text-slate-600 dark:text-slate-400"
              title="Filter-by-status arrives with a richer filter model in a later step"
            >
              Active
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {statusCounts.active}
              </span>
            </div>
            <div
              className="flex items-center justify-between px-3 py-1.5 text-slate-600 dark:text-slate-400"
              title="Filter-by-status arrives with a richer filter model in a later step"
            >
              Blocked
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                {statusCounts.blocked}
              </span>
            </div>

            <div
              className="px-3 py-1 mt-4 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between"
              title={TOOLTIP.step6}
            >
              <span>Running</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono normal-case font-normal">
                0
              </span>
            </div>
            <div className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 italic">
              No active sessions
            </div>

            <div className="px-3 py-1 mt-4 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Quick actions
            </div>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
              disabled
              title={TOOLTIP.step6}
            >
              /safe-exit on all
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
              disabled
              title={TOOLTIP.step6}
            >
              Detect orphans
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
              disabled
              title={TOOLTIP.step11}
            >
              Daily digest preview
            </button>
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
              </span>
              <div className="flex-1" />
              <button
                className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 cursor-not-allowed rounded px-2.5 py-1 font-medium border border-violet-200 dark:border-violet-700/30"
                disabled
                title={TOOLTIP.step6}
              >
                + Action
              </button>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400 italic">
                {filter
                  ? `No projects match "${filter}". Clear the filter to see all ${projects.length}.`
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
                          <div className="inline-flex items-center gap-1 opacity-60">
                            <button
                              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 cursor-not-allowed text-slate-500 dark:text-slate-400"
                              disabled
                              title={TOOLTIP.step9}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                            </button>
                            <button
                              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 cursor-not-allowed text-slate-500 dark:text-slate-400"
                              disabled
                              title={TOOLTIP.step8}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Skill v
                            </button>
                            <button
                              className="text-xs bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700/30 rounded px-2 py-0.5 cursor-not-allowed text-sky-700 dark:text-sky-300"
                              disabled
                              title={TOOLTIP.step10}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Agent v
                            </button>
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
                projectNames={projects.map((p) => p.name)}
              />
            </div>
          </div>

          {/* Bottom terminal panel — tabbed shell only; live streaming starts step 6. */}
          <div className="border-t-2 border-violet-600/30 bg-slate-50 dark:bg-slate-900 flex flex-col">
            <div
              role="tablist"
              aria-label="Terminal panel views"
              className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
            >
              {(['logs', 'terminal', 'agents', 'tasks'] as const).map((tab) => {
                const active = tab === terminalTab;
                const tooltip =
                  tab === 'logs'
                    ? TOOLTIP.step6
                    : tab === 'terminal'
                      ? TOOLTIP.step9
                      : tab === 'agents'
                        ? TOOLTIP.step10
                        : TOOLTIP.step11;
                return (
                  <button
                    key={tab}
                    id={`agentic-tab-${tab}`}
                    role="tab"
                    aria-selected={active}
                    aria-controls={`agentic-tabpanel-${tab}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTerminalTab(tab)}
                    title={tooltip}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                      active
                        ? 'border-violet-500 text-slate-900 dark:text-white'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
              <div className="flex-1" />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-2">
                no streams yet
              </span>
            </div>
            <div
              id={`agentic-tabpanel-${terminalTab}`}
              role="tabpanel"
              aria-labelledby={`agentic-tab-${terminalTab}`}
              className="flex-1 overflow-y-auto p-6 text-xs text-slate-500 dark:text-slate-400 italic flex items-center justify-center"
            >
              <div className="text-center">
                <div className="font-mono text-slate-500 dark:text-slate-400 mb-2">
                  {terminalTab.toUpperCase()}
                </div>
                <div>
                  This tab will populate when MVP step{' '}
                  {terminalTab === 'logs'
                    ? '6'
                    : terminalTab === 'terminal'
                      ? '9'
                      : terminalTab === 'agents'
                        ? '10'
                        : '11'}{' '}
                  ships its launch / streaming surface.
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right detail panel */}
        <aside className="border-l border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          {!selectedProject ? (
            <div className="p-6 text-xs text-slate-500 dark:text-slate-400 italic">
              Select a project on the left to see its details.
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                  Selected
                </div>
                <h3 className="font-semibold">
                  {compactName(selectedProject.name)}
                </h3>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
                  {shortenPath(selectedProject.path)}
                </div>
                {selectedProject.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedProject.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Launch session — all controls disabled at step 3. */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                    Launch session
                  </div>
                  <button
                    className="w-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium py-1.5 rounded mb-2 cursor-not-allowed border border-violet-200 dark:border-violet-700/30"
                    disabled
                    title={TOOLTIP.step9}
                  >
                    Open in embedded terminal
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs py-1.5 rounded font-mono cursor-not-allowed text-slate-500 dark:text-slate-400"
                      disabled
                      title={TOOLTIP.step6}
                    >
                      claude --resume
                    </button>
                    <button
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs py-1.5 rounded cursor-not-allowed text-slate-500 dark:text-slate-400"
                      disabled
                      title={TOOLTIP.step7}
                    >
                      [ ] external
                    </button>
                  </div>
                </div>

                {/* Purpose / Status / Resume prompt block */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-3">
                  {selectedProject.purpose && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        Purpose
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedProject.purpose}
                      </div>
                    </div>
                  )}
                  {selectedProject.status && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        Status
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedProject.status}
                      </div>
                    </div>
                  )}
                  {selectedProject.resumePrompt && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        Resume prompt
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                        {selectedProject.resumePrompt}
                      </div>
                    </div>
                  )}
                  {selectedProject.keyHandoff && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        Key handoff
                      </div>
                      <div className="text-xs text-slate-800 dark:text-slate-200 font-mono break-all">
                        {selectedProject.keyHandoff}
                      </div>
                    </div>
                  )}
                  {selectedProject.activitySignal && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                        Activity signal
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed">
                        {selectedProject.activitySignal}
                      </div>
                    </div>
                  )}
                </div>

                {/* Extras — owner-maintained "other" fields like Convergence, Hard-won lessons */}
                {Object.keys(selectedProject.extras).length > 0 && (
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                      Notes
                    </div>
                    {Object.entries(selectedProject.extras).map(([k, v]) => (
                      <div key={k}>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mb-1">
                          {k}
                        </div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {v}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Skills + Agents — empty placeholders until later steps. */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2 flex items-center justify-between">
                    <span>Skills</span>
                    <span
                      className="font-mono text-slate-400 dark:text-slate-500"
                      title={TOOLTIP.step8}
                    >
                      step 8
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Skill discovery from .claude/skills/ ships in MVP step 8.
                  </div>
                </div>

                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      Agents
                      <span className="px-1 py-0 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-mono text-[9px] rounded">
                        NEW
                      </span>
                    </span>
                    <span
                      className="font-mono text-slate-400 dark:text-slate-500"
                      title={TOOLTIP.step10}
                    >
                      step 10
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Agent discovery from .claude/agents/ ships in MVP step 10.
                  </div>
                </div>

                {/* Recent commits -- populated server-side by getProjectActivity. */}
                <div className="px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
                    Recent commits
                  </div>
                  {(() => {
                    const projActivity = activity[selectedProject.name];
                    if (!projActivity) {
                      return (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Activity not yet loaded.
                        </div>
                      );
                    }
                    if (projActivity.error) {
                      return (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                          Git unavailable: {projActivity.error}
                        </div>
                      );
                    }
                    if (projActivity.recent.length === 0) {
                      return (
                        <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                          No commits in the last 14 days.
                        </div>
                      );
                    }
                    return (
                      <ul className="space-y-1.5 text-xs">
                        {projActivity.recent.map((c) => (
                          <li key={c.sha} className="flex gap-2">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                              {c.sha}
                            </span>
                            {/* min-w-0 is load-bearing: without it, this flex
                                item refuses to shrink and `truncate` silently
                                falls back to horizontal overflow. */}
                            <span className="text-slate-700 dark:text-slate-300 truncate min-w-0">
                              {c.subject}
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
