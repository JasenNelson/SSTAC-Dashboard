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

import { useState, useMemo, useEffect } from 'react';
import AdminFunctionsNav from '@/components/dashboard/AdminFunctionsNav';
import ActivitySparkline from '@/components/agentic-os/ActivitySparkline';
import ConvergenceGraph from '@/components/agentic-os/ConvergenceGraph';
import TerminalPanel, {
  type TerminalTab,
} from '@/components/agentic-os/TerminalPanel';
import ProjectDetailPanel from '@/components/agentic-os/ProjectDetailPanel';
import type {
  Project,
  ConvergenceEdge,
} from '@/lib/agentic-os/parse-projects-map';
import type { ProjectActivity } from '@/lib/agentic-os/git-activity';
import {
  TOOLTIPS,
  inferStatus,
  sparklineToneFor,
  formatLastActivity,
  compactName,
  shortenPath,
} from '@/lib/agentic-os/status-helpers';

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
            title={TOOLTIPS.step10}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/40" />
            <span className="font-mono">0 agents</span>
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
            title={TOOLTIPS.step6}
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
              title={TOOLTIPS.step6}
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
              title={TOOLTIPS.step6}
            >
              /safe-exit on all
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
              disabled
              title={TOOLTIPS.step6}
            >
              Detect orphans
            </button>
            <button
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500 cursor-not-allowed"
              disabled
              title={TOOLTIPS.step11}
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
                title={TOOLTIPS.step6}
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
                              title={TOOLTIPS.step9}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open
                            </button>
                            <button
                              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 cursor-not-allowed text-slate-500 dark:text-slate-400"
                              disabled
                              title={TOOLTIPS.step8}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Skill v
                            </button>
                            <button
                              className="text-xs bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700/30 rounded px-2 py-0.5 cursor-not-allowed text-sky-700 dark:text-sky-300"
                              disabled
                              title={TOOLTIPS.step10}
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
          <TerminalPanel
            activeTab={terminalTab}
            onTabChange={setTerminalTab}
            tooltips={{
              logs: TOOLTIPS.step6,
              terminal: TOOLTIPS.step9,
              agents: TOOLTIPS.step10,
              tasks: TOOLTIPS.step11,
            }}
          />
        </main>

        {/* Right detail panel */}
        <ProjectDetailPanel
          project={selectedProject}
          activity={selectedProject ? activity[selectedProject.name] : undefined}
          tooltips={TOOLTIPS}
        />
      </div>
    </div>
  );
}
