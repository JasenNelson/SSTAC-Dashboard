'use client';

// AI Subscriptions view (client component) -- main pane of the
// /admin/agentic-os/subscriptions route.
//
// Reads the parsed AiSubscription[] from the parent server component +
// pulls launchAction + launchingFor from the shared runtime context (lives
// in the layout). Renders the AiSubscriptionsPanel component which is the
// actual UI; this wrapper exists to bridge the server -> context boundary
// and to render a route-level error envelope when AI_SUBSCRIPTIONS.md is
// missing or unparseable.
//
// "Check now" buttons fire Pattern A launches through the shared runtime;
// the resulting run cards stream into the same bottom-panel Logs tab as
// every other Pattern A skill launch, so the user has one place to watch
// stdout regardless of which route triggered it.

import AiSubscriptionsPanel from '@/components/agentic-os/AiSubscriptionsPanel';
import { useAgenticOsRuntime } from '@/lib/agentic-os/runtime-context';
import type { DisplayAiSubscription } from '@/lib/agentic-os/parse-ai-subscriptions';

export type SubscriptionsLoadResult =
  | { ok: true; subscriptions: DisplayAiSubscription[] }
  | { ok: false; error: { message: string; expectedPath: string } };

interface Props {
  result: SubscriptionsLoadResult;
}

export default function SubscriptionsView({ result }: Props) {
  const runtime = useAgenticOsRuntime();
  const { launchAction, launchingFor } = runtime;

  // AiSubscriptionsPanel expects (project: string, action: string) => void
  // (no options). The runtime's launchAction is async and accepts options;
  // the adapter discards the void return and forgoes the options branch
  // (check_* actions don't take skill/agent slugs).
  const onLaunch = (project: string, action: string) => {
    void launchAction(project, action);
  };

  if (!result.ok) {
    return (
      <div className="p-6">
        <div className="max-w-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 rounded-lg p-6">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-300 mb-2">
            Could not read AI_SUBSCRIPTIONS.md
          </h2>
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono mb-3 break-all">
            Expected at:{' '}
            <code className="text-slate-900 dark:text-slate-100">
              {result.error.expectedPath}
            </code>
          </div>
          <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 overflow-x-auto">
            {result.error.message}
          </pre>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mt-3">
            Ensure Knowledge-Base/AI_SUBSCRIPTIONS.md exists at the expected
            path or set the <code>KNOWLEDGE_BASE_PATH</code> environment
            variable to point at the Knowledge-Base directory before
            restarting <code>next dev</code>. See the file template in the
            Knowledge-Base README for the expected schema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-baseline gap-3">
        <h2 className="text-base font-semibold">AI Subscriptions</h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          {result.subscriptions.length} provider
          {result.subscriptions.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <AiSubscriptionsPanel
          subscriptions={result.subscriptions}
          onLaunch={onLaunch}
          launchingFor={launchingFor}
        />
      </div>
    </div>
  );
}
