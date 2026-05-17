// AI Subscriptions view (server entry).
//
// Server-side responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (codex 2026-05-16 P2 fix:
//      defense in depth against stale layout RSC cache on client-side
//      navigation between sibling routes). The layout.tsx ALSO performs
//      the same check; both must pass for the page to render.
//   2. Read AI_SUBSCRIPTIONS.md and pass the parsed providers (or a
//      load-error envelope) to the SubscriptionsView client component.
//
// Why the data fetch is here rather than in the layout: the layout serves
// every sibling route; computing AI_SUBSCRIPTIONS.md on every navigation
// (even when on /projects) would be wasted I/O on a file that's only
// surfaced on /subscriptions. The trade-off is one extra fs read per
// /subscriptions render, which is trivial.

import { requireAgenticOsPageAccess } from '@/lib/agentic-os/page-auth-guard';
import {
  readAiSubscriptions,
  resolveAiSubscriptionsPath,
  toDisplayAiSubscription,
  type DisplayAiSubscription,
} from '@/lib/agentic-os/parse-ai-subscriptions';
import SubscriptionsView, {
  type SubscriptionsLoadResult,
} from './SubscriptionsView';

export const dynamic = 'force-dynamic';

export default async function AgenticOsSubscriptionsPage() {
  // Page-level auth guard. Redirects to /login (unauth) or /dashboard
  // (auth but not admin) on failure. Defense in depth alongside the
  // layout's identical check.
  await requireAgenticOsPageAccess();

  let result: SubscriptionsLoadResult;
  try {
    const parsed = await readAiSubscriptions();
    // Strip `extras` at the server -> client boundary so unrecognized
    // **Bold:** fields in AI_SUBSCRIPTIONS.md do not cross into the RSC
    // payload. Codex 2026-05-16 holistic P2: the panel never renders
    // extras, but RSC still serializes whatever props the client component
    // receives.
    const subscriptions: DisplayAiSubscription[] =
      parsed.subscriptions.map(toDisplayAiSubscription);
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
