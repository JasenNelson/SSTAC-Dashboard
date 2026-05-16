// Pure-SVG sparkline for per-project commit activity. No chart library --
// the data shape is tiny (14 points) and a polyline is sufficient.
//
// Color is driven by the caller via `tone` so the same component renders
// emerald for "active", red for "blocked", and slate for "no activity in
// window". Stroke uses `currentColor` so the tone class propagates from
// the wrapping span; this also lets parent styling (e.g., a row hover
// state) tint the sparkline without rerendering.
//
// Accessibility: role="img" + a descriptive aria-label summarizing the
// total commits over the window so screen readers don't read out a soup
// of polyline coordinates.

import type { DailyCommitCount } from '@/lib/agentic-os/git-activity';

export type SparklineTone = 'active' | 'blocked' | 'idle';

interface Props {
  data: DailyCommitCount[];
  tone?: SparklineTone;
  /**
   * The intended window size in days. Used ONLY to build a meaningful aria-label
   * ("X commits over the last N days") that doesn't lie when the upstream
   * produced a shorter array than expected. Defaults to 14 to match
   * git-activity.ts's DEFAULT_DAYS; pass explicitly if your caller varies it.
   */
  windowDays?: number;
  /** Rendered pixel width (CSS); SVG viewBox is fixed at 120x24. */
  width?: number;
  height?: number;
  /** Override the aria-label entirely. Defaults to a summarized count. */
  ariaLabel?: string;
}

const VIEW_W = 120;
const VIEW_H = 24;
const PAD = 2;

const TONE_CLASSES: Record<SparklineTone, string> = {
  active: 'text-emerald-500 dark:text-emerald-400',
  blocked: 'text-red-500 dark:text-red-400',
  idle: 'text-slate-400 dark:text-slate-500',
};

export default function ActivitySparkline({
  data,
  tone = 'active',
  windowDays = 14,
  width = 96,
  height = 24,
  ariaLabel,
}: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const effectiveTone: SparklineTone = total === 0 ? 'idle' : tone;
  const colorClass = TONE_CLASSES[effectiveTone];

  // Graceful empty state -- caller passed an empty array (parser hadn't run
  // or window was zero days). Render a dashed line so the layout slot does
  // not collapse and the column stays aligned with sibling rows.
  if (data.length === 0) {
    return (
      <span
        className={`inline-flex items-center font-mono text-xs ${colorClass}`}
        aria-label={ariaLabel ?? 'No activity data'}
      >
        ——————
      </span>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = VIEW_W - PAD * 2;
  const innerH = VIEW_H - PAD * 2;
  const denom = Math.max(1, data.length - 1);

  const points = data
    .map((d, i) => {
      const x = PAD + (i / denom) * innerW;
      // Invert y so higher counts appear higher on the sparkline.
      const y = PAD + (1 - d.count / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Label uses windowDays rather than data.length so a short or padded input
  // never causes the screen-reader announcement to misrepresent the window.
  const label =
    ariaLabel ??
    `${total} commit${total === 1 ? '' : 's'} over the last ${windowDays} day${
      windowDays === 1 ? '' : 's'
    }`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width={width}
      height={height}
      className={colorClass}
      role="img"
      aria-label={label}
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
