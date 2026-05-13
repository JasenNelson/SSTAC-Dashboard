// engine_v2 frontend Lane 2d / Module L2d-1: Local-engine indicator chip.
//
// Renders a small "Local engine only" badge when the client-side feature flag
// `NEXT_PUBLIC_LOCAL_ENGINE` is NOT 'true'. Per owner Q5 (2026-05-13): on
// Vercel the search/chat/export features are unreachable; this badge makes
// the absence visible rather than silent.
//
// Returns null when `isLocalEngineClient()` is true (i.e., local dev) so the
// chip only surfaces on cloud builds. ASCII-only.

"use client";

import { isLocalEngineClient } from "@/lib/feature-flags";

export interface LocalEngineBadgeProps {
  className?: string;
}

export function LocalEngineBadge({
  className,
}: LocalEngineBadgeProps): React.ReactElement | null {
  if (isLocalEngineClient()) return null;

  return (
    <span
      role="status"
      aria-label="Local engine only"
      title="Search, chat, and export features run only on the local development engine. They are intentionally hidden on cloud deployments."
      className={
        "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 " +
        (className ?? "")
      }
    >
      <span aria-hidden="true">[local-only]</span>
      <span>Local engine only</span>
    </span>
  );
}

export default LocalEngineBadge;
