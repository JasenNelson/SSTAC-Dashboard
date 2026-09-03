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
      <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex shrink-0 items-center gap-3 border-r border-slate-200 pr-4 dark:border-slate-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg"><FileText className="h-5 w-5 text-white" /></div>
          <div><p className="font-bold leading-tight text-slate-800 dark:text-slate-100">Matrix Options</p><p className="text-[10px] leading-tight text-slate-500 dark:text-slate-400">Policy Review</p></div>
        </div>
        <div className="min-w-0 flex-1">
          <MatrixOptionsPrimaryNavigation
            activeViewId="TWG Review"
            paperWorkspaceEnabled={paperWorkspaceEnabled}
            panelId={MATRIX_OPTIONS_PAPER_TABPANEL_ID}
            paperRoute
          />
        </div>
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
