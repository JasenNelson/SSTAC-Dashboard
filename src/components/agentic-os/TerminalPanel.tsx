'use client';

// Bottom tabbed terminal-shell panel extracted from AgenticOsClient.tsx as
// step-6 preparation (holistic-review NIT-1). The component is presentational:
// all state (which tab is active) is owned by the parent and threaded through
// `activeTab` + `onTabChange`. This isolation lets step 6 land real SSE log
// streaming (autoscroll, ANSI handling, reconnect) inside the `logs` tabpanel
// without dragging the rest of the page into the diff.
//
// Tab tooltips are passed in by the parent rather than imported here so the
// component has no implicit dependency on the parent's TOOLTIP step-number
// catalog -- the parent decides which "this ships in step N" string belongs
// on each tab.

export type TerminalTab = 'logs' | 'terminal' | 'agents' | 'tasks';

interface Props {
  activeTab: TerminalTab;
  onTabChange: (tab: TerminalTab) => void;
  /** Per-tab tooltips. Caller is responsible for sourcing these from the shared TOOLTIPS map. */
  tooltips: { logs: string; terminal: string; agents: string; tasks: string };
}

const TABS: readonly TerminalTab[] = ['logs', 'terminal', 'agents', 'tasks'];

// Map each tab to the MVP step number that activates it. Kept here (rather
// than in the parent) because it is genuinely a property of this panel: the
// placeholder text inside the tabpanel needs the same step number that the
// tab's tooltip references.
const TAB_STEP: Record<TerminalTab, string> = {
  logs: '6',
  terminal: '9',
  agents: '10',
  tasks: '11',
};

export default function TerminalPanel({
  activeTab,
  onTabChange,
  tooltips,
}: Props) {
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
            </button>
          );
        })}
        <div className="flex-1" />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono px-2">
          no streams yet
        </span>
      </div>
      <div
        id={`agentic-tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`agentic-tab-${activeTab}`}
        className="flex-1 overflow-y-auto p-6 text-xs text-slate-500 dark:text-slate-400 italic flex items-center justify-center"
      >
        <div className="text-center">
          <div className="font-mono text-slate-500 dark:text-slate-400 mb-2">
            {activeTab.toUpperCase()}
          </div>
          <div>
            This tab will populate when MVP step {TAB_STEP[activeTab]} ships
            its launch / streaming surface.
          </div>
        </div>
      </div>
    </div>
  );
}
