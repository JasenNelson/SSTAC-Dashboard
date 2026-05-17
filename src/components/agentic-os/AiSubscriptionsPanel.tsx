'use client';

// AI Subscriptions panel for the Agentic OS bottom tabbed panel.
//
// Data source: AI_SUBSCRIPTIONS.md (Knowledge-Base/) parsed server-side via
// parse-ai-subscriptions.ts. Each provider entry surfaces:
//   - Provider name + subscription tier (owner-curated manual data)
//   - Last-checked timestamp + reset cadence
//   - Click-through link to the provider's official usage dashboard
//   - Optional "Check now" button that fires a Pattern A launch via the
//     existing /api/agentic-os/launch route. Buttons are only rendered when
//     the provider entry's `liveCheckAction` resolves to an allowlisted
//     launch-validator template (the parser's allowlist gates this; the
//     launch route allowlist is the real security boundary).
//
// Why no inline result panel: keeping the "Check now" output flowing into the
// existing logs tab (via the same SSE stream as Pattern A skill launches)
// preserves the one-place-to-read-output invariant + avoids re-implementing
// the run-card / log-renderer plumbing here. Owner clicks "Check now", logs
// tab populates with the run, owner reads it. Inline results may land in a
// later iteration if friction warrants it.
//
// Important: this component renders zero secrets. Subscription tier + email
// are owner-self-data already exposed in the live-check command's stdout.

import type { DisplayAiSubscription } from '@/lib/agentic-os/parse-ai-subscriptions';

interface Props {
  /**
   * Parsed AI subscriptions from AI_SUBSCRIPTIONS.md, in the display-only
   * shape (no `extras` bag). Codex 2026-05-16 holistic P2: page.tsx strips
   * `extras` at the server -> client boundary so unrecognized **Bold:**
   * fields never enter the RSC payload.
   */
  subscriptions: DisplayAiSubscription[];
  /**
   * Optional fixed project to attribute live-check launches to. The launch
   * route requires a project name (the cwd is computed from it) but the
   * check_* actions are project-agnostic. Defaults to 'SSTAC-Dashboard'
   * which is guaranteed in the allowlist. Parent may override if a
   * different allowlisted project is more semantically natural.
   */
  launchAttributionProject?: string;
  /**
   * Optional load-failure detail. When set, the panel renders an error
   * card instead of the subscriptions list. Mirrors the page's read-error
   * handling so missing/unparseable AI_SUBSCRIPTIONS.md doesn't crash the
   * whole admin page.
   */
  loadError?: { message: string; hint?: string } | null;
  /**
   * Pattern A launch dispatcher, same shape as the rest of the page uses.
   * When omitted, the "Check now" buttons render disabled with a tooltip
   * explaining the launch surface is unavailable (matches the parent's
   * Pattern A button pattern).
   */
  onLaunch?: (project: string, action: string) => void;
  /**
   * Set of in-flight concurrency keys ({project}::{action}). When the
   * panel's per-provider check action is in flight the button shows a
   * busy state. Mirrors the parent's launchingFor convention.
   */
  launchingFor?: ReadonlySet<string>;
}

const DEFAULT_LAUNCH_ATTRIBUTION_PROJECT = 'SSTAC-Dashboard';

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export default function AiSubscriptionsPanel({
  subscriptions,
  launchAttributionProject = DEFAULT_LAUNCH_ATTRIBUTION_PROJECT,
  loadError,
  onLaunch,
  launchingFor,
}: Props) {
  if (loadError) {
    return (
      <div className="p-4 text-xs">
        <div className="text-red-600 dark:text-red-400 font-semibold mb-1">
          Could not read AI_SUBSCRIPTIONS.md
        </div>
        <div className="text-slate-600 dark:text-slate-400 mb-1">
          {loadError.message}
        </div>
        {loadError.hint && (
          <div className="text-slate-500 dark:text-slate-500 italic">
            {loadError.hint}
          </div>
        )}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="p-4 text-xs italic text-slate-500 dark:text-slate-400">
        No providers configured in Knowledge-Base/AI_SUBSCRIPTIONS.md.
      </div>
    );
  }

  return (
    <div className="p-3 overflow-y-auto max-h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subscriptions.map((sub) => {
          const concurrencyKey = sub.liveCheckAction
            ? `${launchAttributionProject}::${sub.liveCheckAction}`
            : null;
          const busy = concurrencyKey
            ? launchingFor?.has(concurrencyKey) ?? false
            : false;
          const canCheck =
            !!sub.liveCheckAction && !!onLaunch && !busy;
          const externalUrlOk = isHttpUrl(sub.usageUrl);
          return (
            <div
              key={sub.name}
              className="border border-slate-200 dark:border-slate-700 rounded p-3 bg-white dark:bg-slate-900 flex flex-col gap-1.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                  {sub.name}
                </div>
                {sub.subscriptionTier && (
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono shrink-0">
                    {sub.subscriptionTier}
                  </span>
                )}
              </div>
              {sub.provider && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {sub.provider}
                </div>
              )}
              <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                {sub.billingCycle && (
                  <>
                    <span className="text-slate-500">Cycle</span>
                    <span>{sub.billingCycle}</span>
                  </>
                )}
                {sub.resetDate && (
                  <>
                    <span className="text-slate-500">Reset</span>
                    <span>{sub.resetDate}</span>
                  </>
                )}
                {sub.lastChecked && (
                  <>
                    <span className="text-slate-500">Checked</span>
                    <span>{sub.lastChecked}</span>
                  </>
                )}
              </div>
              {sub.notes && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 line-clamp-3">
                  {sub.notes}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {externalUrlOk ? (
                  <a
                    href={sub.usageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-violet-700 dark:text-violet-300 hover:underline"
                  >
                    Open usage page -&gt;
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    no usage URL
                  </span>
                )}
                {sub.liveCheckAction && (
                  <button
                    type="button"
                    className="text-[11px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded px-2 py-0.5 font-medium border border-violet-200 dark:border-violet-700/30 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-200 dark:hover:bg-violet-900/50"
                    disabled={!canCheck}
                    title={
                      !onLaunch
                        ? 'Launch route disabled in this environment'
                        : sub.liveCheckCommand
                          ? `Run \`${sub.liveCheckCommand}\` and stream output to the logs tab`
                          : 'Run live check and stream output to the logs tab'
                    }
                    onClick={() => {
                      if (canCheck && sub.liveCheckAction) {
                        onLaunch!(launchAttributionProject, sub.liveCheckAction);
                      }
                    }}
                  >
                    {busy ? 'checking ...' : 'Check now'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
