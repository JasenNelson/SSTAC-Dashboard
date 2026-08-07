'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';
import { phase2Tasks, type Phase2Task, type Phase2Subtask } from './phase2Tasks';
import Phase2GanttChart from './Phase2GanttChart';

// OWNER DECISION 2026-06-08: HIDE hours in the TWG-facing Guide by default.
// Flip this boolean to show/hide estimated hours.
const SHOW_ESTIMATED_HOURS = false;

function getLeadType(task: Phase2Task): 'Internal' | 'TWG' | 'Mixed' {
  const leads = task.subtasks.map((s) => s.lead.toLowerCase());
  const hasInternal = leads.some((l) => /\b(internal|env)\b/.test(l));
  const hasExternal = leads.some((l) => /\b(twg|sabcs|sstac)\b/.test(l));

  if (hasInternal && hasExternal) return 'Mixed';
  if (hasExternal) return 'TWG';
  return 'Internal';
}

function deriveDeadlineSpan(subtasks: Phase2Subtask[]): string {
  if (subtasks.length === 0) return '';
  const weeks: number[] = [];
  const months: number[] = [];
  let hasOngoing = false;

  for (const s of subtasks) {
    const d = s.deadline.toLowerCase();
    if (d.includes('ongoing')) hasOngoing = true;
    const matches = Array.from(d.matchAll(/\d+/g)).map(m => parseInt(m[0], 10));
    if (d.includes('week')) {
      weeks.push(...matches);
    } else if (d.includes('month')) {
      months.push(...matches);
    }
  }

  const minWeek = weeks.length ? Math.min(...weeks) : null;
  const maxWeek = weeks.length ? Math.max(...weeks) : null;
  const minMonth = months.length ? Math.min(...months) : null;
  const maxMonth = months.length ? Math.max(...months) : null;

  if (minWeek === null && minMonth === null) {
    return hasOngoing ? 'Ongoing' : subtasks[0].deadline;
  }

  if (minWeek !== null && minMonth !== null) {
    const startStr = `Week ${minWeek}`;
    const endStr = hasOngoing ? 'Ongoing' : `Month ${maxMonth}`;
    return `${startStr} to ${endStr}`;
  } else if (minWeek !== null) {
    if (hasOngoing) return `Week ${minWeek} to Ongoing`;
    if (minWeek === maxWeek) return `Week ${minWeek}`;
    return `Weeks ${minWeek}-${maxWeek}`;
  } else if (minMonth !== null) {
    if (hasOngoing) return `Month ${minMonth} to Ongoing`;
    if (minMonth === maxMonth) return `Month ${minMonth}`;
    return `Months ${minMonth}-${maxMonth}`;
  }

  return '';
}

export default function Phase2TasksSection() {
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const totalTasks = phase2Tasks.length;
  const totalSubtasks = phase2Tasks.reduce((sum, t) => sum + t.subtasks.length, 0);
  const totalHours = phase2Tasks.reduce((sum, t) => sum + t.subtasks.reduce((sSum, s) => sSum + s.estHours, 0), 0);

  const startSpan = phase2Tasks[0].subtasks[0].deadline;
  const endSpan = phase2Tasks[totalTasks - 1].subtasks[phase2Tasks[totalTasks - 1].subtasks.length - 1].deadline;

  const handleToggle = (taskId: string) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    for (const task of phase2Tasks) {
      nextState[task.id] = true;
    }
    setExpandedTasks(nextState);
  };

  const handleCollapseAll = () => {
    setExpandedTasks({});
  };

  return (
    <div className="space-y-6 mt-8">
      {/* Visual H2 heading styled to match markdown h2 */}
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2 mt-8 mb-4">
        Phase 2 (2026) Tasks and Activities
      </h2>

      <Phase2GanttChart />

      {/* Summary line + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
        <div className="text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">{totalTasks}</span> tasks |{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{totalSubtasks}</span> subtasks |{' '}
          Phase 2 spans {startSpan} to {endSpan}.
          {SHOW_ESTIMATED_HOURS && (
            <>
              {' '}| <span className="font-semibold text-slate-800 dark:text-slate-200">~{totalHours.toLocaleString()}</span> estimated hours
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Collapsible Accordion List */}
      <div className="space-y-4">
        {phase2Tasks.map((task) => {
          const isExpanded = expandedTasks[task.id] ?? false;
          const contentId = `content-${task.id.replace(/\s+/g, '-')}`;
          const leadType = getLeadType(task);

          let badgeColor = '';
          if (leadType === 'Internal') {
            badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/30';
          } else if (leadType === 'TWG') {
            badgeColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200/50 dark:border-green-800/30';
          } else {
            badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/30';
          }

          const span = deriveDeadlineSpan(task.subtasks);
          const taskHours = task.subtasks.reduce((sum, s) => sum + s.estHours, 0);

          return (
            <div
              key={task.id}
              className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
            >
              <button
                type="button"
                onClick={() => handleToggle(task.id)}
                className="w-full flex items-center justify-between p-4 text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                aria-expanded={isExpanded}
                aria-controls={contentId}
              >
                <div className="flex flex-wrap items-center gap-2 mr-4">
                  <span className="text-base font-semibold text-slate-800 dark:text-slate-200">
                    {task.id} - {task.title}
                  </span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>
                    {leadType}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono border border-slate-200/50 dark:border-slate-700/50">
                    {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''}
                    {SHOW_ESTIMATED_HOURS && ` - ${taskHours} h`} - {span}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                )}
              </button>

              <div
                id={contentId}
                hidden={!isExpanded}
                className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold">
                        <th className="py-2 px-3 pl-0">Subtask</th>
                        <th className="py-2 px-3">Deadline</th>
                        {SHOW_ESTIMATED_HOURS && <th className="py-2 px-3 text-right">Est. Hours</th>}
                        <th className="py-2 px-3 pr-0 text-right">Lead</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {task.subtasks.map((subtask) => (
                        <tr key={subtask.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-3 pl-0 font-medium">
                            {subtask.id} {subtask.subtask}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">{subtask.deadline}</td>
                          {SHOW_ESTIMATED_HOURS && (
                            <td className="py-3 px-3 text-right font-mono">{subtask.estHours}</td>
                          )}
                          <td className="py-3 px-3 pr-0 text-right whitespace-nowrap">{subtask.lead}</td>
                        </tr>
                      ))}
                      {SHOW_ESTIMATED_HOURS && (
                        <tr className="font-semibold text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/10">
                          <td className="py-2 px-3 pl-0">Total</td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 text-right font-mono">{taskHours}</td>
                          <td className="py-2 px-3 pr-0"></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
