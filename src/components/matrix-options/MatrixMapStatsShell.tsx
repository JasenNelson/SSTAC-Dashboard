'use client';

// Phase-0 seam for the MatrixMapSelectionStats engine (Phase 1).
// Phase 1 replaces the placeholder copy with the real stats buckets.
// Plain ASCII only (code point <= 127).

export function MatrixMapStatsShell() {
  return (
    <div
      data-testid="matrix-map-left-panel-stats-shell"
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Detailed selection statistics will appear here.
      </p>
    </div>
  );
}
