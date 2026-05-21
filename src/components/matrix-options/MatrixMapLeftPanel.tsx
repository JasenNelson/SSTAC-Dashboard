'use client';

// PR-MAP-10: Left "Selection Stats" panel for the matrix_map Interactive Map.
// Subscribes to the shared bn-rrm Zustand identify store so identify-tool
// results from src/components/bn-rrm/map/SiteMap.tsx render here in addition
// to the existing Leaflet popup at click coords. The integration pattern
// mirrors src/components/bn-rrm/map/SiteDetails.tsx:271-279 so both surfaces
// stay visually + behaviorally consistent.

import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import { IdentifiedFeaturesList } from '@/components/bn-rrm/map/IdentifiedFeaturesList';

export function MatrixMapLeftPanel() {
  const identifiedFeatures = useSiteDataStore((s) => s.identifiedFeatures);
  const primaryFeatureIndex = useSiteDataStore((s) => s.primaryFeatureIndex);
  const setPrimaryFeatureIndex = useSiteDataStore((s) => s.setPrimaryFeatureIndex);
  const clearIdentifiedFeatures = useSiteDataStore((s) => s.clearIdentifiedFeatures);

  const hasIdentified = identifiedFeatures.length > 0;

  return (
    <div className="w-80 h-full flex flex-col">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Map Selection
        </p>
        <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
          Selection Stats
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div
          data-testid="matrix-map-left-panel-pr-map-4-placeholder"
          className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            PR-MAP-4 content -- coming next
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Per PLAN_V3_4_2 section 3.5: selection summary with classification
            composition; Provincial Background stats (n, mean, median, sd, min,
            max, 95th percentile, UTL 95/95, 90% UCL, censoring fraction);
            Site-specific Background stats (same 10 stats); methodology badge;
            Calculator action buttons; admin-only CSV export.
          </p>
        </div>
        {hasIdentified ? (
          <IdentifiedFeaturesList
            features={identifiedFeatures}
            primaryIndex={primaryFeatureIndex}
            onPromote={setPrimaryFeatureIndex}
            onClear={clearIdentifiedFeatures}
          />
        ) : (
          <div
            data-testid="matrix-map-left-panel-state-a-placeholder"
            className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/30 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              State A: identify just fired
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              When no samples are selected but identify has fired on a WMS layer:
              scrollable identified-features list grouped by layer with
              collapse/expand and per-layer suppress filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
