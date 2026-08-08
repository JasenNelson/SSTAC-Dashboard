import React from 'react';
import { cn } from '@/utils/cn';
import { phase2Tasks } from './phase2Tasks';

const MONTHS = [
  "May '26", "Jun '26", "Jul '26", "Aug '26", "Sep '26", "Oct '26", "Nov '26",
  "Dec '26", "Jan '27", "Feb '27", "Mar '27", "Apr '27", "May '27", "Jun '27"
];

const TASK_COLORS: Record<string, string> = {
  'Task 1': 'bg-blue-500',
  'Task 2': 'bg-blue-500',
  'Task 3': 'bg-yellow-500 dark:bg-yellow-600', // Improved contrast over yellow-400
  'Task 4': 'bg-indigo-500',
  'Task 5': 'bg-indigo-500',
  'Task 6': 'bg-indigo-500',
  'Task 7': 'bg-indigo-500',
  'Task 8': 'bg-green-500',
  'Task 9': 'bg-red-500',
  'Task 10': 'bg-slate-300 dark:bg-slate-600'
};

const TASK_PHASE_NAMES: Record<string, string> = {
  'Task 1': 'Preparation',
  'Task 2': 'Preparation',
  'Task 3': 'Data Compilation',
  'Task 4': 'Research & Frameworks',
  'Task 5': 'Research & Frameworks',
  'Task 6': 'Research & Frameworks',
  'Task 7': 'Research & Frameworks',
  'Task 8': 'Workshop',
  'Task 9': 'Deliverables',
  'Task 10': 'Project Management'
};

export function parseCol(deadline: string): { start: number, end: number } {
  const d = deadline.toLowerCase();
  let endCol = d.includes('ongoing') ? 14 : -1;
  const matches = Array.from(d.matchAll(/\d+/g)).map(m => parseInt(m[0], 10));
  
  if (d.includes('week')) {
    // Roughly 4.3 weeks per month; Week 1-4 falls in Month 1, Week 5 in Month 2.
    const startMonth = matches.length ? Math.ceil(matches[0] / 4.3) : 1;
    let endMonth = matches.length > 1 ? Math.ceil(matches[matches.length - 1] / 4.3) : startMonth;
    if (endCol === 14) endMonth = 14;
    return { start: Math.max(1, startMonth), end: Math.max(1, endMonth) };
  }
  
  if (d.includes('month') && matches.length) {
    const startMonth = matches[0];
    let endMonth = matches.length > 1 ? matches[matches.length - 1] : startMonth;
    if (endCol === 14) endMonth = 14;
    return { start: Math.max(1, startMonth), end: Math.min(14, endMonth) };
  }

  // Pure "Ongoing" case
  if (endCol === 14) return { start: 1, end: 14 };

  return { start: 1, end: 1 };
}

export const GANTT_DATA = phase2Tasks.map(task => {
  const activeCols = new Set<number>();
  task.subtasks.forEach(s => {
    const { start, end } = parseCol(s.deadline);
    for (let i = start; i <= end; i++) activeCols.add(i);
  });
  
  const cols = Array.from(activeCols).sort((a,b) => a-b);
  const segments: {start: number, end: number}[] = [];
  if (cols.length > 0) {
    let currentStart = cols[0];
    let currentEnd = cols[0];
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === currentEnd + 1) {
        currentEnd = cols[i];
      } else {
        segments.push({ start: currentStart, end: currentEnd });
        currentStart = cols[i];
        currentEnd = cols[i];
      }
    }
    segments.push({ start: currentStart, end: currentEnd });
  }

  return {
    id: task.id.replace('Task ', ''),
    title: task.title,
    segments,
    color: TASK_COLORS[task.id] || 'bg-slate-500',
    phaseName: TASK_PHASE_NAMES[task.id] || 'Unknown'
  };
});

export default function Phase2GanttChart() {
  return (
    <figure className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-6 shadow-sm overflow-x-auto mb-6">
      <figcaption className="sr-only">
        Gantt chart showing the timeline for Phase 2 tasks from May 2026 to June 2027.
      </figcaption>
      
      {/* Screen Reader Only Table for Accessibility */}
      <table className="sr-only">
        <thead>
          <tr>
            <th>Task ID</th>
            <th>Title</th>
            <th>Phase</th>
            <th>Schedule</th>
          </tr>
        </thead>
        <tbody>
          {GANTT_DATA.map(row => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.title}</td>
              <td>{row.phaseName}</td>
              <td>
                {row.segments.map(seg => `${MONTHS[seg.start - 1]} to ${MONTHS[seg.end - 1]}`).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Visual Gantt Chart (Hidden from AT) */}
      <div className="min-w-[1000px]" aria-hidden="true">
        {/* Header */}
        <div className="flex items-end mb-4">
          <div className="w-80 font-semibold text-slate-800 dark:text-slate-200 shrink-0">Project Tasks</div>
          <div className="flex-1 grid gap-1 text-center text-xs font-medium text-slate-500" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
            {MONTHS.map((m, i) => (
              <div key={m} className={cn("pb-2 border-b-2", i === 0 ? "border-blue-500 text-blue-600" : "border-slate-100 dark:border-slate-800")}>
                {i === 0 && <div className="text-[9px] uppercase tracking-wider mb-1 text-blue-500">Kickoff</div>}
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="space-y-2">
          {GANTT_DATA.map((row) => (
            <div key={row.id} className="flex items-center group min-h-[2.5rem]">
              <div className="w-80 flex gap-3 text-sm border-r border-slate-100 dark:border-slate-800 pr-3 shrink-0 py-1">
                <span className="text-slate-400 font-mono text-xs mt-0.5 w-6 text-right shrink-0">{row.id}</span>
                <span 
                  className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors leading-snug break-words"
                  title={row.title}
                >
                  {row.title}
                </span>
              </div>
              <div className="flex-1 grid gap-1 items-center px-1 self-stretch" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                {row.segments.map((seg, idx) => (
                  <div
                    key={idx}
                    className={cn("h-5 rounded shadow-sm opacity-90", row.color)}
                    style={{ gridColumnStart: seg.start, gridColumnEnd: seg.end + 1 }}
                    title={`${row.title} (${MONTHS[seg.start - 1]} - ${MONTHS[seg.end - 1]})`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300 mr-2">Phases:</span>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Preparation</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /> Research & Frameworks</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500 dark:bg-yellow-600" /> Data Compilation</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /> Workshop</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Deliverables</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" /> Project Management</div>
        </div>
      </div>
    </figure>
  );
}
