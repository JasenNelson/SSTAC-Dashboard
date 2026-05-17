'use client';

// Agentic OS Projects view (client component).
//
// Renders the "pulse" view as the main pane of the /admin/agentic-os
// root route: project table, internal sub-sidebar with Views filter +
// Running indicators + Quick actions, right-hand detail panel for the
// selected project, and the convergence graph.
//
// IA refactor (2026-05-16): the outer chrome (admin pills bar + page
// sub-header + category nav + bottom tabbed terminal panel) lives in
// the parent layout (layout.tsx -> AgenticOsLayoutClient.tsx). Runtime
// state (runs, launchingFor, terminalTab, launchAction, closeRun,
// ptyEnabled) is owned by the layout and consumed here via
// useAgenticOsRuntime(). This file's responsibilities shrank to:
//   - Selection state (which project's detail panel is shown)
//   - Free-text filter + Views filter state
//   - Embedded xterm.js modal open state (only consumer in PR-1)
//   - All the Projects-view-specific UI elements
//
// Visual reference: .tmp_presentation/design_mockups/style1_linear_terminals.html
// Build plan: .tmp_presentation/master/AGENTIC_OS_HANDOFF.md §11 (steps 4-12)

import { useState, useMemo, useEffect, useCallback } from 'react';
import ActivitySparkline from '@/components/agentic-os/ActivitySparkline';
import ConvergenceGraph from '@/components/agentic-os/ConvergenceGraph';
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
import { useAgenticOsRuntime } from '@/lib/agentic-os/runtime-context';

// Pattern A skill actions exposed by the per-row Skill v dropdown and the
// detail panel's claude-resume button. Order is presentation order. The
// action keys MUST match COMMAND_TEMPLATES keys in launch-validator.ts
// (gate 6 will 400 otherwise).
const PATTERN_A_SKILLS: ReadonlyArray<{
  action: string;
  label: string;
  slash: string;
}> = [
  { action: 'run_safe_exit', label: '/safe-exit', slash: '/safe-exit' },
  { action: 'run_update_docs', label: '/update-docs', slash: '/update-docs' },
  { action: 'run_doc_navigator', label: '/doc-navigator', slash: '/doc-navigator' },
];

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
  /** Per-project discovered skills (step 8 / Pattern C), keyed by project name. */
  projectSkills?: Record<string, ProjectSkills>;
  /** Per-project discovered agents (step 10 / Pattern D), keyed by project name. */
  projectAgents?: Record<string, ProjectAgents>;
}

function ErrorState({
  error,
  detail,
  expectedPath,
  hint,
}: Extract<AgenticOsResult, { ok: false }>) {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto mt-12 border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
          {error}
        </h1>
        {expectedPath && (
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono mb-4 break-all">
            Expected at:{' '}
            <code className="text-slate-900 dark:text-slate-100">
              {expectedPath}
            </code>
          </div>
        )}
        {detail && (
          <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 mb-4 overflow-x-auto">
            {detail}
          </pre>
        )}
        {hint && (
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {hint}
          </p>
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
}: Props) {
  // Runtime state lives in the layout-owned context. Local state here is
  // only the Projects-view-specific UI: selection, filter, view filter,
  // embedded terminal modal.
  const runtime = useAgenticOsRuntime();
  const { runs, launchingFor, launchAction, ptyEnabled } = runtime;

  // Hooks must be unconditional -- declare ALL state before the early return.
  const [selectedName, setSelectedName] = useState<string | null>(
    result.ok && result.projects.length > 0 ? result.projects[0].name : null,
  );
  const [filter, setFilter] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');

  // Step 9 / Pattern E: which project (if any) has the embedded terminal
  // modal open. Null = modal closed. Only one modal open at a time. PR-1
  // scope: the Projects view is the only consumer; modal state stays
  // local rather than going through runtime context. If a future sibling
  // route (e.g. Vercel panel) needs to open the modal, promote this state
  // into AgenticOsRuntime and mount the modal in AgenticOsLayoutClient.
  const [embeddedTerminalProject, setEmbeddedTerminalProject] = useState<
    string | null
  >(null);
  const openEmbeddedTerminal = useCallback(
    (project: string) => {
      if (!ptyEnabled) return; // defense in depth -- button is also disabled
      setEmbeddedTerminalProject(project);
    },
    [ptyEnabled],
  );
  const closeEmbeddedTerminal = useCallback(() => {
    setEmbeddedTerminalProject(null);
  }, []);

  // Wrap `projects` in its own useMemo so downstream filtered/statusCounts/
  // agentCountTotal references see a STABLE array identity across renders
  // when `result` does not change.
  const projects = useMemo(
    () => (result.ok ? result.projects : []),
    [result],
  );

  // Owner-bug 4 (2026-05-16): combined free-text + Views filter applied
  // through the pure applyViewFilter helper.
  const filteredProjects = useMemo(
    () => applyViewFilter(projects, filter, viewFilter),
    [projects, filter, viewFilter],
  );

  // If the user filters in a way that excludes the currently-selected
  // project, reset selection to the first match (or null if empty).
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
    <div className="grid grid-cols-[14rem_minmax(0,1fr)_20rem] min-h-full">
      {/* View-specific sub-sidebar. The category nav lives in the layout's
          sidebar; this is the Projects-route-specific filter / running
          indicators / quick actions slot. Sibling routes (subscriptions,
          future panels) render their own equivalent or skip this column. */}
      <aside
        aria-label="Projects view filters"
        className="border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
      >
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
        <nav
          className="flex-1 overflow-y-auto py-2 text-[13px]"
          aria-label="Project views"
        >
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
            Views
          </div>
          {(
            [
              { id: 'all', label: 'All projects', count: statusCounts.total },
              { id: 'active', label: 'Active', count: statusCounts.active },
              { id: 'blocked', label: 'Blocked', count: statusCounts.blocked },
            ] as ReadonlyArray<{
              id: ViewFilter;
              label: string;
              count: number;
            }>
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
          {/* Owner-bug 1 (2026-05-16): "coming soon" treatment. */}
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

      {/* Middle column: project table + convergence graph. */}
      <div className="overflow-y-auto min-w-0">
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-baseline gap-3">
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
              ? `No projects match the current filters${
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
                <th className="text-right font-medium px-6 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => {
                const status = inferStatus(p.status);
                const isSelected = p.name === selectedName;
                return (
                  <tr
                    key={p.name}
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
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-900/20'
                        : 'hover:bg-white dark:bg-slate-800'
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
                      {formatLastActivity(
                        activity[p.name]?.lastCommitAt ?? null,
                      )}
                    </td>
                    <td className="px-6 text-right">
                      <div
                        className="inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
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
                                    const det = e.currentTarget.closest(
                                      'details',
                                    ) as HTMLDetailsElement | null;
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
                                    const busy =
                                      launchingFor.has(concurrencyKey);
                                    return (
                                      <button
                                        key={sk.slug}
                                        type="button"
                                        disabled={busy}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const det = e.currentTarget.closest(
                                            'details',
                                          ) as HTMLDetailsElement | null;
                                          if (det) det.open = false;
                                          void launchAction(
                                            p.name,
                                            'run_skill',
                                            { skillSlug: sk.slug },
                                          );
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
                              const projAgentsList = pa?.projectAgents ?? [];
                              const globAgents = pa?.globalAgents ?? [];
                              const hasAny =
                                projAgentsList.length > 0 ||
                                globAgents.length > 0;
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
                                  ) : projAgentsList.length === 0 ? (
                                    <div className="px-3 py-1 text-[10px] italic text-slate-500 dark:text-slate-400">
                                      {globAgents.length > 0
                                        ? 'No project agents; see global agents below'
                                        : 'No project agents'}
                                    </div>
                                  ) : (
                                    projAgentsList.map((ag) => {
                                      const concurrencyKey = `${p.name}::run_agent::${ag.slug}`;
                                      const busy =
                                        launchingFor.has(concurrencyKey);
                                      return (
                                        <button
                                          key={`p-${ag.slug}`}
                                          type="button"
                                          disabled={busy}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const det = e.currentTarget.closest(
                                              'details',
                                            ) as HTMLDetailsElement | null;
                                            if (det) det.open = false;
                                            void launchAction(
                                              p.name,
                                              'run_agent',
                                              { agentSlug: ag.slug },
                                            );
                                          }}
                                          className="block w-full text-left text-xs px-3 py-1.5 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 disabled:opacity-50 disabled:cursor-wait"
                                          title={`Run claude --agent ${ag.slug} --bg in ${p.name}`}
                                        >
                                          <div className="font-mono">
                                            {ag.slug}
                                            {ag.name &&
                                              ag.name !== ag.slug && (
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
                                      const busy =
                                        launchingFor.has(concurrencyKey);
                                      return (
                                        <button
                                          key={`g-${ag.slug}`}
                                          type="button"
                                          disabled={busy}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const det = e.currentTarget.closest(
                                              'details',
                                            ) as HTMLDetailsElement | null;
                                            if (det) det.open = false;
                                            void launchAction(
                                              p.name,
                                              'run_agent',
                                              { agentSlug: ag.slug },
                                            );
                                          }}
                                          className="block w-full text-left text-xs px-3 py-1.5 text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/30 disabled:opacity-50 disabled:cursor-wait"
                                          title={`Run claude --agent ${ag.slug} --bg in ${p.name}`}
                                        >
                                          <div className="font-mono">
                                            {ag.slug}
                                            {ag.name &&
                                              ag.name !== ag.slug && (
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

        {/* Convergence graph -- step 5. Interactive node-and-edge view. */}
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
          <ConvergenceGraph edges={result.edges} projects={projects} />
        </div>
      </div>

      {/* Right detail panel */}
      <ProjectDetailPanel
        project={selectedProject}
        activity={selectedProject ? activity[selectedProject.name] : undefined}
        skills={
          selectedProject ? projectSkills[selectedProject.name] : undefined
        }
        agents={
          selectedProject ? projectAgents[selectedProject.name] : undefined
        }
        tooltips={TOOLTIPS}
        onLaunch={launchAction}
        launchingFor={launchingFor}
        patternASkills={PATTERN_A_SKILLS}
        ptyEnabled={ptyEnabled}
        onOpenEmbeddedTerminal={openEmbeddedTerminal}
      />

      {/* Step 9 / Pattern E: embedded xterm.js modal. */}
      {embeddedTerminalProject && (
        <EmbeddedTerminalModal
          project={embeddedTerminalProject}
          onClose={closeEmbeddedTerminal}
        />
      )}
    </div>
  );
}
