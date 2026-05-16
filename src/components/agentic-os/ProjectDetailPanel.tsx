'use client';

// Right-hand "selected project" detail aside extracted from AgenticOsClient.tsx
// as step-6 preparation (holistic-review NIT-1). The component is presentational:
// the parent owns selection state and passes the resolved `project` (or null
// for the empty state) plus the per-project git activity bundle.
//
// All step-N tooltips arrive via the shared TOOLTIPS map so the disabled
// Launch / Skills / Agents controls stay in lockstep with the parent's
// indicator chips when those step numbers shift.

import type { Project } from '@/lib/agentic-os/parse-projects-map';
import type { ProjectActivity } from '@/lib/agentic-os/git-activity';
import type { ProjectSkills } from '@/lib/agentic-os/skill-discovery';
import type { ProjectAgents } from '@/lib/agentic-os/agent-discovery';
import {
  compactName,
  shortenPath,
  type Tooltips,
} from '@/lib/agentic-os/status-helpers';

export interface PatternASkill {
  /** action key passed to /api/agentic-os/launch (must match launch-validator). */
  action: string;
  /** Human label, e.g. "/safe-exit". */
  label: string;
  /** Slash command (for display). */
  slash: string;
}

interface Props {
  project: Project | null;
  activity?: ProjectActivity;
  /** Step 8 / Pattern C: skills discovered from <project>/.claude/skills/.
   *  Undefined when no discovery has happened (renders the legacy placeholder);
   *  defined-with-empty-skills renders the "no skills discovered" message;
   *  defined-with-error renders the failure note. */
  skills?: ProjectSkills;
  /** Step 10 / Pattern D: agents discovered from <project>/.claude/agents/
   *  (project scope) AND ~/.claude/agents/ (global scope, shared across all
   *  projects). Undefined when no discovery has happened (renders the legacy
   *  placeholder); defined-with-empty-lists renders the empty-state message;
   *  defined-with-error renders the failure note. */
  agents?: ProjectAgents;
  tooltips: Tooltips;
  /** Step 6b: launch a Pattern A skill against the selected project.
   *  Step 8: optional `options.skillSlug` carries the discovered skill slug
   *  when action === 'run_skill'.
   *  Step 10: optional `options.agentSlug` carries the discovered agent slug
   *  when action === 'run_agent'. */
  onLaunch?: (
    project: string,
    action: string,
    options?: { skillSlug?: string; agentSlug?: string },
  ) => void;
  /** Set of in-flight concurrency keys. For Pattern A this is
   *  "{project}::{action}"; for Pattern C run_skill it is
   *  "{project}::run_skill::{skillSlug}"; for Pattern D run_agent it is
   *  "{project}::run_agent::{agentSlug}" so concurrent discovered-agent
   *  launches on the same project don't race the single-string key. */
  launchingFor?: ReadonlySet<string>;
  /** Available Pattern A skills (step 6b). When empty, the detail panel
   *  shows the legacy disabled state. */
  patternASkills?: ReadonlyArray<PatternASkill>;
}

export default function ProjectDetailPanel({
  project,
  activity,
  skills,
  agents,
  tooltips,
  onLaunch,
  launchingFor,
  patternASkills,
}: Props) {
  if (!project) {
    return (
      <aside className="border-l border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
        <div className="p-6 text-xs text-slate-500 dark:text-slate-400 italic">
          Select a project on the left to see its details.
        </div>
      </aside>
    );
  }

  return (
    <aside className="border-l border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
          Selected
        </div>
        <h3 className="font-semibold">{compactName(project.name)}</h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1 truncate">
          {shortenPath(project.path)}
        </div>
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {project.tags.map((t) => (
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
        {/* Launch session. Step 6b: Pattern A skills are live; embedded
            terminal (step 9) + external pop-out (step 7) stay disabled. */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            Launch session
          </div>
          <button
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium py-1.5 rounded mb-2 cursor-not-allowed border border-slate-200 dark:border-slate-700"
            disabled
            title={tooltips.step9}
          >
            Open in embedded terminal
          </button>
          {patternASkills && patternASkills.length > 0 && onLaunch ? (
            <>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5 font-mono">
                Pattern A (headless):
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {patternASkills.map((s) => {
                  const concurrencyKey = `${project.name}::${s.action}`;
                  const busy = launchingFor?.has(concurrencyKey) ?? false;
                  return (
                    <button
                      key={s.action}
                      type="button"
                      disabled={busy}
                      onClick={() => onLaunch(project.name, s.action)}
                      className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/30 text-xs py-1.5 px-2 rounded font-mono text-left hover:bg-violet-200 dark:hover:bg-violet-900/50 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                      title={`Run claude -p '${s.slash}' in ${project.name}`}
                    >
                      claude -p &apos;{s.slash}&apos;{busy && ' ...'}
                    </button>
                  );
                })}
              </div>
              {/* Step 7: Pattern B external pop-out. Fires open_session
                  which spawns wt.exe with `-d <cwd> claude --resume`.
                  wt.exe creates a new desktop terminal tab and exits cleanly;
                  the launch route still records the audit + SSE entry. */}
              {(() => {
                const concurrencyKey = `${project.name}::open_session`;
                const busy = launchingFor?.has(concurrencyKey) ?? false;
                return (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onLaunch(project.name, 'open_session')}
                    className="mt-2 w-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700/30 text-xs py-1.5 rounded hover:bg-sky-200 dark:hover:bg-sky-900/50 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                    title={tooltips.step7}
                  >
                    [ ] external (pop out new terminal){busy && ' ...'}
                  </button>
                );
              })()}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs py-1.5 rounded font-mono cursor-not-allowed text-slate-500 dark:text-slate-400"
                disabled
                title={tooltips.step6}
              >
                claude --resume
              </button>
              <button
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs py-1.5 rounded cursor-not-allowed text-slate-500 dark:text-slate-400"
                disabled
                title={tooltips.step7}
              >
                [ ] external
              </button>
            </div>
          )}
        </div>

        {/* Purpose / Status / Resume prompt block */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-3">
          {project.purpose && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Purpose
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {project.purpose}
              </div>
            </div>
          )}
          {project.status && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Status
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {project.status}
              </div>
            </div>
          )}
          {project.resumePrompt && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Resume prompt
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 italic leading-relaxed border-l-2 border-slate-200 dark:border-slate-700 pl-2">
                {project.resumePrompt}
              </div>
            </div>
          )}
          {project.keyHandoff && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Key handoff
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200 font-mono break-all">
                {project.keyHandoff}
              </div>
            </div>
          )}
          {project.activitySignal && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-1">
                Activity signal
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-mono leading-relaxed">
                {project.activitySignal}
              </div>
            </div>
          )}
        </div>

        {/* Extras — owner-maintained "other" fields like Convergence, Hard-won lessons */}
        {Object.keys(project.extras).length > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
              Notes
            </div>
            {Object.entries(project.extras).map(([k, v]) => (
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

        {/* Skills -- step 8 / Pattern C live discovery. Lists the skills found
            under <project>/.claude/skills/ each as a clickable launch button.
            Click fires onLaunch(project, 'run_skill', { skillSlug }), which
            routes through the same /api/agentic-os/launch + SSE plumbing as
            Pattern A so the run shows up in the run-card list / terminal
            panel. Empty/error/truncated states each get their own affordance
            (no green check, no red error -- just italic notes). */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2 flex items-center justify-between">
            <span>Skills</span>
            <span
              className="font-mono text-slate-400 dark:text-slate-500"
              title={tooltips.step8}
            >
              step 8
            </span>
          </div>
          {(() => {
            if (!skills) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Skill discovery not yet loaded.
                </div>
              );
            }
            if (skills.error) {
              return (
                <div className="text-xs text-red-600 dark:text-red-400 italic">
                  Skill discovery failed: {skills.error}
                </div>
              );
            }
            if (skills.skills.length === 0) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No skills discovered for this project
                </div>
              );
            }
            return (
              <>
                <div className="grid grid-cols-1 gap-1.5">
                  {skills.skills.map((sk) => {
                    const concurrencyKey = `${project.name}::run_skill::${sk.slug}`;
                    const busy = launchingFor?.has(concurrencyKey) ?? false;
                    return (
                      <button
                        key={sk.slug}
                        type="button"
                        disabled={!onLaunch || busy}
                        onClick={() =>
                          onLaunch?.(project.name, 'run_skill', { skillSlug: sk.slug })
                        }
                        className="text-left bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700/30 text-xs py-1.5 px-2 rounded hover:bg-violet-200 dark:hover:bg-violet-900/50 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                        title={`Run claude -p '/${sk.slug}' in ${project.name}`}
                      >
                        <div className="font-mono">
                          /{sk.slug}
                          {busy && (
                            <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                              ...
                            </span>
                          )}
                        </div>
                        {sk.name && sk.name !== sk.slug && (
                          <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
                            {sk.name}
                          </div>
                        )}
                        {sk.description && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug whitespace-normal break-words font-sans">
                            {sk.description}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {skills.truncated && (
                  <div className="mt-1.5 text-[10px] italic text-amber-600 dark:text-amber-400">
                    More skills exist; cap at 50
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Agents -- step 10 / Pattern D live discovery. Lists project-scoped
            agents from <project>/.claude/agents/*.md (top), then global
            agents from ~/.claude/agents/*.md (bottom, separated by a
            divider). Click fires onLaunch(project, 'run_agent',
            { agentSlug }), which routes through the same /api/agentic-os/launch
            + SSE plumbing as Pattern A/C so the run shows up in the run-card
            list / terminal panel. */}
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
              title={tooltips.step10}
            >
              step 10
            </span>
          </div>
          {(() => {
            if (!agents) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Agent discovery not yet loaded.
                </div>
              );
            }
            const renderAgentButton = (
              ag: ProjectAgents['projectAgents'][number],
              keyPrefix: string,
            ) => {
              const concurrencyKey = `${project.name}::run_agent::${ag.slug}`;
              const busy = launchingFor?.has(concurrencyKey) ?? false;
              return (
                <button
                  key={`${keyPrefix}-${ag.slug}`}
                  type="button"
                  disabled={!onLaunch || busy}
                  onClick={() =>
                    onLaunch?.(project.name, 'run_agent', { agentSlug: ag.slug })
                  }
                  className="text-left bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-700/30 text-xs py-1.5 px-2 rounded hover:bg-sky-200 dark:hover:bg-sky-900/50 disabled:opacity-50 disabled:cursor-wait focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
                  title={`Run claude --agent ${ag.slug} --bg in ${project.name}`}
                >
                  <div className="font-mono">
                    {ag.slug}
                    {busy && (
                      <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                        ...
                      </span>
                    )}
                  </div>
                  {ag.name && ag.name !== ag.slug && (
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-sans">
                      {ag.name}
                    </div>
                  )}
                  {ag.description && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug whitespace-normal break-words font-sans">
                      {ag.description}
                    </div>
                  )}
                </button>
              );
            };

            const projList = agents.projectAgents;
            const globList = agents.globalAgents;
            const totalDiscovered = projList.length + globList.length;
            if (agents.error && totalDiscovered === 0) {
              return (
                <div className="text-xs text-red-600 dark:text-red-400 italic">
                  Agent discovery failed: {agents.error}
                </div>
              );
            }
            if (totalDiscovered === 0) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No agents discovered for this project
                </div>
              );
            }
            return (
              <>
                <div
                  className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5 font-mono uppercase tracking-wider"
                  aria-label="Project-scoped agents"
                >
                  Project agents
                </div>
                {projList.length === 0 ? (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 italic mb-2">
                    {globList.length > 0
                      ? 'No project agents; see global agents below'
                      : 'No project agents'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 mb-2">
                    {projList.map((ag) => renderAgentButton(ag, 'p'))}
                  </div>
                )}
                {agents.error && (
                  <div className="text-[10px] italic text-red-600 dark:text-red-400 mb-2">
                    Project agent discovery hit error: {agents.error}
                  </div>
                )}
                <hr
                  role="separator"
                  className="my-2 border-slate-200 dark:border-slate-700"
                />
                <div
                  className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5 font-mono uppercase tracking-wider"
                  aria-label="Global (user-scoped) agents"
                >
                  Global agents
                </div>
                {globList.length === 0 ? (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                    No global agents
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {globList.map((ag) => renderAgentButton(ag, 'g'))}
                  </div>
                )}
                {agents.truncated && (
                  <div className="mt-1.5 text-[10px] italic text-amber-600 dark:text-amber-400">
                    More project agents exist; cap at 50
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Recent commits -- populated server-side by getProjectActivity. */}
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            Recent commits
          </div>
          {(() => {
            if (!activity) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Activity not yet loaded.
                </div>
              );
            }
            if (activity.error) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Git unavailable: {activity.error}
                </div>
              );
            }
            if (activity.recent.length === 0) {
              return (
                <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                  No commits in the last 14 days.
                </div>
              );
            }
            return (
              <ul className="space-y-1.5 text-xs">
                {activity.recent.map((c) => (
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
    </aside>
  );
}
