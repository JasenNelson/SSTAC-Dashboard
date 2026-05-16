'use client';

// Bottom tabbed terminal-shell panel.
//
// Step 6a: extracted from AgenticOsClient.tsx with placeholder tabpanels.
// Step 6b: the 'logs' tabpanel now renders a stack of "log cards", one per
// active run (most-recent first). The 'terminal' / 'agents' / 'tasks' tabs
// carry explanatory placeholders -- step 9 shipped the embedded terminal as
// a MODAL (not a tab), step 10 shipped agent launches via a per-project
// dropdown (output streams into the logs tab), and step 11 (Cowork digest)
// lives on a separate machine. Placeholder copy refreshed 2026-05-16
// (owner-bug 5) to reflect those realities.
//
// Tab tooltips are passed in by the parent so the component has no implicit
// dependency on the parent's TOOLTIP step-number catalog.

import { useEffect, useRef } from 'react';

export type TerminalTab = 'logs' | 'terminal' | 'agents' | 'tasks';

export interface LogLine {
  stream: 'stdout' | 'stderr';
  text: string;
  ts: number;
}

export interface ActiveRun {
  runId: string;
  project: string;
  action: string;
  command: { exe: string; args: readonly string[]; cwd: string };
  startedAt: string;
  lines: LogLine[];
  status: 'running' | 'completed' | 'failed';
  exitCode?: number | null;
  exitedAt?: string | null;
}

interface Props {
  activeTab: TerminalTab;
  onTabChange: (tab: TerminalTab) => void;
  /** Per-tab tooltips. Caller is responsible for sourcing these from the shared TOOLTIPS map. */
  tooltips: { logs: string; terminal: string; agents: string; tasks: string };
  /** Active log streams keyed by runId. Step 6b. */
  activeRuns?: ActiveRun[];
  /** Remove a run card from the parent's state. Does NOT kill the child. */
  onCloseRun?: (runId: string) => void;
}

const TABS: readonly TerminalTab[] = ['logs', 'terminal', 'agents', 'tasks'];

// Owner-bug 5 (2026-05-16): the non-logs tabs used to read
// "this tab will populate when MVP step 9/10/11 ships its launch / streaming
// surface" -- but step 9 and step 10 ARE shipped, and step 11 (Cowork
// Telegram digest) lives on a separate machine entirely. Owner directive:
// keep all four tabs, refresh placeholder copy so it reflects what each
// surface actually does today. NO timeline promises. The placeholders are
// pointers / explainers, not "coming soon" cards.
//
// - terminal: the embedded xterm.js terminal (step 9) is a MODAL, not a tab.
//   Tell the user how to open it from this page (per-row Open button + the
//   right-pane "Open in embedded terminal" button).
// - agents: agents are launched via the per-project "Agent v" dropdown
//   (Pattern D, step 10). The run cards for `run_agent` launches surface in
//   the logs tab next to skill runs; this tab is the conceptual home for a
//   future filtered agents-only view.
// - tasks: Cowork Telegram digest lives on a separate machine. No timeline.
interface TabPlaceholder {
  readonly heading: string;
  readonly body: string;
}
const TAB_PLACEHOLDERS: Record<Exclude<TerminalTab, 'logs'>, TabPlaceholder> = {
  terminal: {
    heading: 'TERMINAL',
    body:
      'The embedded xterm.js terminal opens as a MODAL, not a tab. ' +
      'Use the per-row "Open" button on any project, or the right-pane ' +
      '"Open in embedded terminal" button on the selected project, to ' +
      'launch a real PTY session (requires AGENTIC_OS_PTY_SECRET + ' +
      '`npm run dev:all`).',
  },
  agents: {
    heading: 'AGENTS',
    body:
      'Agents are launched via the per-project "Agent v" dropdown in the ' +
      'Actions column. Running agents stream their output into the LOGS ' +
      'tab as `run_agent` cards alongside skill runs. A filtered ' +
      'agents-only view will live here.',
  },
  tasks: {
    heading: 'TASKS',
    body:
      'The daily digest + task queue lives on a separate Cowork machine ' +
      '(Telegram automation). This tab is a pointer for when that ' +
      'integration surfaces here.',
  },
};

function formatElapsed(startedAt: string, exitedAt: string | null | undefined): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return '';
  const end = exitedAt ? Date.parse(exitedAt) : Date.now();
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m${remSec.toString().padStart(2, '0')}s`;
}

// Status pill: animated blue dot (running), green check (completed),
// red dot (failed).
function StatusPill({ status, exitCode }: { status: ActiveRun['status']; exitCode?: number | null }) {
  if (status === 'running') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-700 dark:text-sky-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
        </span>
        running
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        exit 0
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-700 dark:text-red-300">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
      exit {exitCode ?? '?'}
    </span>
  );
}

function LogCard({
  run,
  onClose,
}: {
  run: ActiveRun;
  onClose?: (runId: string) => void;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new lines. We compare line count (cheap) and force the
  // scrollTop to scrollHeight on every change. If the user has manually
  // scrolled up to inspect earlier output, this still pulls them back to
  // the bottom -- acceptable for the MVP; a "follow tail" toggle is a
  // follow-up.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [run.lines.length]);

  const cmdline = `${run.command.exe} ${run.command.args.join(' ')}`;

  return (
    <div
      data-testid={`log-card-${run.runId}`}
      className="border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900 shadow-sm mb-2"
    >
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
        <span className="font-mono text-xs text-slate-800 dark:text-slate-200 truncate" title={cmdline}>
          {cmdline}
        </span>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
          {run.project}
        </span>
        <StatusPill status={run.status} exitCode={run.exitCode} />
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
          {formatElapsed(run.startedAt, run.exitedAt)}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onClose?.(run.runId)}
          aria-label={`Close run ${run.runId}`}
          className="text-[10px] font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
          title="Remove this run card (does not kill the child process)"
        >
          x
        </button>
      </div>
      <div
        ref={bodyRef}
        // xterm-look: black bg, mono font, dense lines. Mirrors the
        // style1_linear_terminals.html mockup's logs panel.
        className="bg-[#0A0A0A] text-slate-200 font-mono text-[11px] leading-tight px-3 py-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all"
      >
        {run.lines.length === 0 ? (
          // Empty-state copy branches on action: Pattern B (open_session) spawns
          // wt.exe which launches an external desktop window and exits
          // immediately, so no inline stdout/stderr is ever expected. The
          // generic "waiting for output" wording would be misleading. All
          // other actions are Pattern A (claude -p <skill>) which streams its
          // output over SSE; for those the wait message is accurate.
          run.action === 'open_session' ? (
            <span className="text-slate-500 italic">
              External terminal opened on your desktop; no inline output expected.
            </span>
          ) : (
            <span className="text-slate-500 italic">Waiting for output...</span>
          )
        ) : (
          run.lines.map((line, i) => (
            <div
              key={`${run.runId}-${i}-${line.ts}`}
              className={
                line.stream === 'stderr'
                  ? 'text-red-300'
                  : 'text-slate-200'
              }
            >
              {/* Strip basic ANSI CSI sequences so [32mfoo[0m doesn't
                  garble the display. Full xterm color support arrives with
                  the embedded xterm modal in step 9. */}
              {stripAnsi(line.text)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Minimal CSI / OSC stripper. Drops:
//   - CSI sequences:  ESC [ <params> <final-byte 0x40-0x7e>
//   - OSC sequences:  ESC ] ... BEL or ESC ]
const ANSI_CSI_RE = /\[[0-?]*[ -/]*[@-~]/g;
const ANSI_OSC_RE = /\][^]*/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_CSI_RE, '').replace(ANSI_OSC_RE, '');
}

export default function TerminalPanel({
  activeTab,
  onTabChange,
  tooltips,
  activeRuns,
  onCloseRun,
}: Props) {
  const runs = activeRuns ?? [];
  const runningCount = runs.filter((r) => r.status === 'running').length;

  return (
    <div className="border-t-2 border-violet-600/30 bg-slate-50 dark:bg-slate-900 flex flex-col">
      <div
        role="tablist"
        aria-label="Terminal panel views"
        className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2"
      >
        {TABS.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              id={`agentic-tab-${tab}`}
              role="tab"
              aria-selected={active}
              aria-controls={`agentic-tabpanel-${tab}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onTabChange(tab)}
              title={tooltips[tab]}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                active
                  ? 'border-violet-500 text-slate-900 dark:text-white'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-white'
              }`}
            >
              {tab}
              {tab === 'logs' && runs.length > 0 && (
                <span className="ml-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  ({runs.length})
                </span>
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-2">
          {runningCount > 0
            ? `${runningCount} running`
            : runs.length > 0
              ? `${runs.length} session${runs.length === 1 ? '' : 's'}`
              : 'no streams yet'}
        </span>
      </div>
      <div
        id={`agentic-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`agentic-tab-${activeTab}`}
        className="flex-1 overflow-y-auto p-3"
      >
        {activeTab === 'logs' ? (
          runs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 italic">
              <div className="text-center">
                <div className="font-mono text-slate-500 dark:text-slate-400 mb-2">
                  LOGS
                </div>
                <div>
                  No runs yet. Click an action button on a project row to start one.
                </div>
              </div>
            </div>
          ) : (
            <div>
              {runs.map((run) => (
                <LogCard key={run.runId} run={run} onClose={onCloseRun} />
              ))}
            </div>
          )
        ) : (
          (() => {
            const placeholder =
              TAB_PLACEHOLDERS[activeTab as Exclude<TerminalTab, 'logs'>];
            return (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
                <div className="text-center max-w-md px-4">
                  <div className="font-mono text-slate-500 dark:text-slate-400 mb-2">
                    {placeholder.heading}
                  </div>
                  <div className="leading-relaxed">{placeholder.body}</div>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
