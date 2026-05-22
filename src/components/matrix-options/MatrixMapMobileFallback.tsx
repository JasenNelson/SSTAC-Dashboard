'use client';

// PR-MAP-17a: mobile fallback banner for the matrix-options
// Interactive Map. Replaces the desktop 3-column layout entirely
// when window.innerWidth < 768px (per
// docs/design/matrix-map/PLAN_V3_4_2.md section 3.8). The full spec
// also calls for a read-only summary view (site list + most-recent-
// measurement table); that is intentionally deferred to PR-MAP-17b
// to keep this PR a tight, mergeable shim. PR-MAP-17a alone is
// already a behavior improvement over the current state, where
// /matrix-options on a phone renders broken overflow.
//
// Banner copy is verbatim from PLAN_V3_4_2 line 183-184.
//
// Plain ASCII only.

import { Smartphone } from 'lucide-react';

export function MatrixMapMobileFallback() {
  return (
    <div
      data-testid="matrix-map-mobile-fallback"
      className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/30"
    >
      <div className="max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-300" aria-hidden="true" />
          </div>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Interactive Map needs a wider viewport
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          Use a desktop or tablet (768px or wider) for the full interactive map.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          The other Matrix Options tabs (Guide, Conceptual Model, Jurisdictional
          Frameworks, TWG Review, Calculator) are fully usable on this device.
        </p>
      </div>
    </div>
  );
}
