// AI Subscriptions view (server entry).
//
// Server-side responsibilities are minimal: read AI_SUBSCRIPTIONS.md and
// pass the parsed providers (or a load-error envelope) to the
// SubscriptionsView client component. Auth + admin-role + feature-flag +
// PTY-enabled gates are handled by the shared layout.tsx so this file
// stays narrow.
//
// Why the data fetch is here rather than in the layout: the layout serves
// every sibling route; computing AI_SUBSCRIPTIONS.md on every navigation
// (even when on /projects) would be wasted I/O on a file that's only
// surfaced on /subscriptions. The trade-off is one extra fs read per
// /subscriptions render, which is trivial.

import {
  readAiSubscriptions,
  resolveAiSubscriptionsPath,
  type AiSubscription,
} from '@/lib/agentic-os/parse-ai-subscriptions';
import SubscriptionsView, {
  type SubscriptionsLoadResult,
} from './SubscriptionsView';

export const dynamic = 'force-dynamic';

export default async function AgenticOsSubscriptionsPage() {
  let result: SubscriptionsLoadResult;
  try {
    const parsed = await readAiSubscriptions();
    const subscriptions: AiSubscription[] = parsed.subscriptions;
    result = { ok: true, subscriptions };
  } catch (err) {
    const expectedPath = resolveAiSubscriptionsPath();
    const message = err instanceof Error ? err.message : String(err);
    result = {
      ok: false,
      error: { message, expectedPath },
    };
  }

  return <SubscriptionsView result={result} />;
}
