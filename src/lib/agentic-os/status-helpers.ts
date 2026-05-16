// Pure helpers extracted from AgenticOsClient.tsx during the step-6-prep
// refactor (holistic-review NIT-1 + NIT-2). These functions are stateless,
// have no React dependencies, and are exercised by
// `src/lib/agentic-os/__tests__/status-helpers.test.ts`.
//
// Keeping these out of the React component makes the upcoming SSE log
// streaming diff (step 6) readable and lets us assert behavior at the unit
// level rather than via DOM snapshots.

import type { SparklineTone } from '@/components/agentic-os/ActivitySparkline';

/**
 * Step-deferral tooltips so disabled buttons explain themselves on hover.
 * Keyed by the MVP step number that will activate the surface.
 */
export const TOOLTIPS = {
  step5: 'Mermaid convergence graph arrives in MVP step 5',
  step6: 'Launch buttons arrive in MVP step 6 (Pattern A: headless)',
  step7: 'Pop out a new Windows Terminal tab running claude --resume in this project',
  step8: 'Skill dropdown + per-project skill discovery arrives in MVP step 8',
  step9:
    'Embedded terminal disabled. Set AGENTIC_OS_PTY_SECRET in .env.local ' +
    '(any 64-char hex), then restart with `npm run dev:all` so the PTY ' +
    'sidecar starts alongside Next.',
  step10: 'Agent dropdown + spawn arrives in MVP step 10',
  step11: 'Cowork daily digest + Telegram automation arrives in MVP step 11',
} as const;

export type Tooltips = typeof TOOLTIPS;

/**
 * Map free-text Status field to a badge color + canonical label. The data
 * is human-maintained so we keyword-sniff rather than expect strict enum
 * values. Order of checks is load-bearing: blocked/auth_point wins over
 * paused, which wins over stale, which wins over done/archived; the
 * fallthrough default is "active".
 */
export function inferStatus(status: string): { color: string; label: string } {
  const lower = status.toLowerCase();
  if (lower.includes('blocked') || lower.includes('auth_point')) {
    return { color: 'bg-red-400', label: 'blocked' };
  }
  if (lower.includes('paused')) {
    return { color: 'bg-amber-400', label: 'paused' };
  }
  if (lower.includes('stale')) {
    return { color: 'bg-gray-500', label: 'stale' };
  }
  if (lower.includes('done') || lower.includes('archived')) {
    return { color: 'bg-gray-400', label: 'done' };
  }
  return { color: 'bg-emerald-400', label: 'active' };
}

/**
 * Map an inferred project status label to the sparkline color tone.
 * `total === 0` already overrides to "idle" inside the sparkline itself,
 * so the only mapping needed here is: blocked -> red, everything else -> emerald.
 */
export function sparklineToneFor(statusLabel: string): SparklineTone {
  return statusLabel === 'blocked' ? 'blocked' : 'active';
}

/**
 * Render a commit timestamp as a compact "Xm / Xh / Xd / Mon DD" relative
 * marker for the table's Last column. Returns the em-dash placeholder for
 * null and unparseable values; returns "just now" for future timestamps
 * (clock-skew tolerant).
 */
export function formatLastActivity(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "Compact" project name for the table — lowercase mirrors the mockup's
 * display style without mutating the source data.
 */
export function compactName(name: string): string {
  return name.toLowerCase();
}

/**
 * Show absolute Windows-style paths as ~-prefixed shorthand for tighter
 * table rows. Falls back to the raw value if the path doesn't match the
 * `<drive>:\Projects\<name>` convention; returns "" for empty input.
 */
export function shortenPath(absPath: string): string {
  if (!absPath) return '';
  const match = absPath.match(/^[A-Za-z]:\\Projects\\(.+?)\\?$/);
  if (match) return `~/Projects/${match[1].replace(/\\/g, '/')}`;
  return absPath;
}
