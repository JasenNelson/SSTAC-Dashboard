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
  tooltips: Tooltips;
  /** Step 6b: launch a Pattern A skill against the selected project. */
  onLaunch?: (project: string, action: string) => void;
  /** Set of in-flight "{project}::{action}" concurrency keys. Allows
   *  concurrent launches across rows without single-string races. */
  launchingFor?: ReadonlySet<string>;
  /** Available Pattern A skills (step 6b). When empty, the detail panel
   *  shows the legacy disabled state. */
  patternASkills?: ReadonlyArray<PatternASkill>;
}

export default function ProjectDetailPanel({
  project,
  activity,
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

        {/* Skills + Agents — empty placeholders until later steps. */}
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
              title={tooltips.step10}
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
