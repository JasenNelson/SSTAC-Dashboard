import { FileText } from 'lucide-react';
import { redirect } from 'next/navigation';

import MatrixOptionsPrimaryNavigation from '@/components/matrix-options/MatrixOptionsPrimaryNavigation';
import {
  MATRIX_OPTIONS_PAPER_TABPANEL_ID,
  MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH,
  isMatrixOptionsPaperWorkspaceEnabled,
  matrixOptionsPrimaryTabId,
} from '@/lib/matrix-options/navigation';

export const metadata = {
  title: 'Options Paper | SSTAC Dashboard',
  description: 'Versioned Matrix Options Paper reader workspace.',
};

export default function MatrixOptionsPaperLayout({ children }: { children: React.ReactNode }) {
  const paperWorkspaceEnabled = isMatrixOptionsPaperWorkspaceEnabled(
    process.env.MATRIX_OPTIONS_PAPER_WORKSPACE,
  );
  if (!paperWorkspaceEnabled) redirect(MATRIX_OPTIONS_LEGACY_TWG_REVIEW_PATH);
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 dark:bg-slate-900">
      {/* M1-03: the row wraps; below sm the actions slot takes its own full-width line, so no child forces horizontal overflow at 360px. */}
      <header data-testid="paper-layout-header" className="sticky top-0 z-30 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 print:hidden">
        <div data-testid="paper-layout-brand" className="flex min-w-0 items-center gap-3 border-r border-slate-200 pr-4 dark:border-slate-700">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg"><FileText className="h-5 w-5 text-white" /></div>
          <div className="min-w-0"><p className="font-bold leading-tight text-slate-800 dark:text-slate-100">Matrix Options</p><p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">Policy Review</p></div>
        </div>
        <div data-testid="paper-layout-primary-navigation" className="min-w-0 flex-1">
          <MatrixOptionsPrimaryNavigation
            activeViewId="TWG Review"
            paperWorkspaceEnabled={paperWorkspaceEnabled}
            panelId={MATRIX_OPTIONS_PAPER_TABPANEL_ID}
            paperRoute
          />
        </div>
        <div
          id="matrix-options-paper-header-actions"
          data-testid="paper-header-actions"
          role="group"
          className="flex min-h-[44px] w-full min-w-0 max-w-full flex-wrap items-center gap-2 border-slate-200 empty:hidden dark:border-slate-700 sm:ml-auto sm:w-auto sm:border-l sm:pl-4"
          aria-label="Paper workspace actions"
        />
      </header>
      <div
        id={MATRIX_OPTIONS_PAPER_TABPANEL_ID}
        role="tabpanel"
        aria-labelledby={matrixOptionsPrimaryTabId('TWG Review')}
      >
        {children}
      </div>
    </div>
  );
}
