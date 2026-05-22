'use client';

// PR-MAP-10: Left "Selection Stats" panel for the matrix_map Interactive Map.
// Subscribes to the matrix-map identify store so identify-tool / identify-area
// results from src/app/(dashboard)/matrix-map/MatrixMap.tsx (Path-B fork)
// render in the side panel in addition to the Leaflet popup at click coords.
// IdentifiedFeaturesList is reused from src/components/bn-rrm/map/ since
// the presentational contract is the same across the two map surfaces.

import { useEffect, useState } from 'react';
import { useMatrixMapIdentifyStore } from '@/stores/matrix-map/identifyStore';
import { useMatrixMapSelectionStore } from '@/stores/matrix-map/selectionStore';
import { IdentifiedFeaturesList } from '@/components/bn-rrm/map/IdentifiedFeaturesList';
import { checkCurrentUserAdminStatus } from '@/lib/admin-utils';
import type { MatrixMapData, MatrixSample } from '@/app/(dashboard)/matrix-map/types';

interface MatrixMapLeftPanelProps {
  initialMapData: MatrixMapData;
}

export function MatrixMapLeftPanel({ initialMapData }: MatrixMapLeftPanelProps) {
  const identifiedFeatures = useMatrixMapIdentifyStore((s) => s.identifiedFeatures);
  const primaryFeatureIndex = useMatrixMapIdentifyStore((s) => s.primaryFeatureIndex);
  const setPrimaryFeatureIndex = useMatrixMapIdentifyStore((s) => s.setPrimaryFeatureIndex);
  const clearIdentifiedFeatures = useMatrixMapIdentifyStore((s) => s.clearIdentifiedFeatures);
  const selectedSampleIds = useMatrixMapSelectionStore((s) => s.selectedSampleIds);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasIdentified = identifiedFeatures.length > 0;
  const selectedSamples = initialMapData.visible_samples.filter((sample) =>
    selectedSampleIds.includes(sample.id),
  );
  const composition = countSelectionComposition(selectedSamples);
  const unknownCount = composition.unknown;
  const hasSelection = selectedSamples.length > 0;

  useEffect(() => {
    let cancelled = false;
    checkCurrentUserAdminStatus().then((value) => {
      if (!cancelled) setIsAdmin(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        {hasSelection ? (
          <div
            data-testid="matrix-map-left-panel-selection-stats"
            className="space-y-3"
          >
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Selection
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatSelectionSummary(selectedSamples.length, composition)}
              </p>
            </div>

            {unknownCount > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                  {unknownCount} selected {unknownCount === 1 ? 'station has' : 'stations have'} unclassified status and are EXCLUDED from UTL computation.
                  {' '}
                  <span className="font-semibold underline decoration-dotted">
                    Override their classification here
                  </span>
                  {' '}
                  to include.
                </p>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Calculator Actions
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed"
                >
                  Use Provincial Background in Calculator
                </button>
                <button
                  type="button"
                  disabled
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-semibold text-slate-400 dark:text-slate-500 cursor-not-allowed"
                >
                  Use Site-specific Background in Calculator
                </button>
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void exportSelectionCsv({
                    selectedSampleIds,
                    setIsExporting,
                    setExportError,
                  })}
                  disabled={isExporting}
                  className="w-full rounded-md bg-slate-900 dark:bg-slate-100 px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExporting ? 'Exporting...' : 'Export selection as CSV'}
                </button>
                {exportError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {exportError}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : hasIdentified ? (
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

function countSelectionComposition(samples: MatrixSample[]) {
  return samples.reduce(
    (acc, sample) => {
      acc[sample.classification] += 1;
      return acc;
    },
    { reference: 0, impacted: 0, unknown: 0 },
  );
}

function formatSelectionSummary(
  selectedCount: number,
  composition: ReturnType<typeof countSelectionComposition>,
) {
  return `${selectedCount} selected (${composition.reference} reference, ${composition.impacted} impacted, ${composition.unknown} unknown)`;
}

async function exportSelectionCsv({
  selectedSampleIds,
  setIsExporting,
  setExportError,
}: {
  selectedSampleIds: string[];
  setIsExporting: (value: boolean) => void;
  setExportError: (value: string | null) => void;
}) {
  if (typeof window === 'undefined' || selectedSampleIds.length === 0) return;
  setIsExporting(true);
  setExportError(null);
  try {
    const response = await fetch('/api/matrix-map/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        export_type: 'selection',
        selected_sample_ids: selectedSampleIds,
      }),
    });
    if (!response.ok) {
      throw new Error('Selection export failed.');
    }
    await downloadCsvResponse(response);
  } catch (err) {
    setExportError(err instanceof Error ? err.message : 'Selection export failed.');
  } finally {
    setIsExporting(false);
  }
}

async function downloadCsvResponse(response: Response) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const disposition = response.headers.get('content-disposition') ?? '';
  const filenameMatch = /filename="([^"]+)"/.exec(disposition);
  anchor.href = url;
  anchor.download = filenameMatch?.[1] ?? 'matrix-map-selection.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}
