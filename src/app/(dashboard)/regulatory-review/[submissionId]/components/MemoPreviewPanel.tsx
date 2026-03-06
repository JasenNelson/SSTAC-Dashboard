import React from 'react';
import { X, FileText, FileCheck, ListChecks } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface MemoPreviewPanelProps {
  stats: {
    total: number;
    reviewed: number;
    sufficient: number;
    insufficient: number;
    needsMoreEvidence: number;
    unreviewed: number;
  };
  finalSummaryCount: number;
  finalIncludedCount: number;
  followUpCount: number;
  onGenerateInterim: () => void;
  onGenerateFinal: () => void;
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export default function MemoPreviewPanel({
  stats,
  finalSummaryCount,
  finalIncludedCount,
  followUpCount,
  onGenerateInterim,
  onGenerateFinal,
  onClose,
}: MemoPreviewPanelProps) {
  return (
    <div className="w-[360px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Memo Preview
            </h3>
          </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          title="Close panel"
        >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Interim memo captures full review detail. Final memo is a curated 6-10 page summary.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <ListChecks className="w-4 h-4 text-slate-500" />
            Interim Memo (Auto-Filled)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Total items: {stats.total}</div>
            <div>Reviewed: {stats.reviewed} / {stats.total}</div>
            <div>Unreviewed: {stats.unreviewed}</div>
            <div>Follow-up flags: {followUpCount}</div>
          </div>
          <button
            onClick={onGenerateInterim}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Generate Interim Memo
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <FileCheck className="w-4 h-4 text-slate-500" />
            Final Memo (Curated)
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <div>Included items: {finalIncludedCount}</div>
            <div>Summaries drafted: {finalSummaryCount}</div>
            <div>Target length: 6-10 pages</div>
          </div>
          <button
            onClick={onGenerateFinal}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded bg-sky-600 text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Generate Final Memo
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Final memo export is available once required items are reviewed.
        </p>
      </div>
    </div>
  );
}
