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

interface Props {
  project: Project | null;
  activity?: ProjectActivity;
  tooltips: Tooltips;
}

export default function ProjectDetailPanel({
  project,
  activity,
  tooltips,
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
        {/* Launch session — all controls disabled at step 3. */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold mb-2">
            Launch session
          </div>
          <button
            className="w-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium py-1.5 rounded mb-2 cursor-not-allowed border border-violet-200 dark:border-violet-700/30"
            disabled
            title={tooltips.step9}
          >
            Open in embedded terminal
          </button>
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
