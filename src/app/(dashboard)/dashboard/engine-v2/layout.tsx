// engine_v2 frontend Lane 1 / Module L1-2: route shell layout.
// Thin wrapper for the /dashboard/engine-v2 route segment. Admin gating
// is enforced in each Server Component (page.tsx files), not here, so
// per-route redirect targets remain explicit per the plan v7.19.

import type { ReactNode } from "react";

export default function EngineV2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
            Engine v2
          </h1>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
