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
              <button
                type="button"
                onClick={() => exportSelectionCsv(selectedSamples)}
                className="w-full rounded-md bg-slate-900 dark:bg-slate-100 px-3 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-white"
              >
                Export selection as CSV
              </button>
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

function exportSelectionCsv(samples: MatrixSample[]) {
  if (typeof window === 'undefined' || samples.length === 0) return;

  const headers = [
    'sample_id',
    'station_id',
    'display_name',
    'classification',
    'coordinate_quality_tier',
    'source_dra_id',
    'bc_region',
    'waterbody',
    'longitude',
    'latitude',
  ];
  const rows = samples.map((sample) => [
    sample.id,
    sample.station_id,
    sample.display_name,
    sample.classification,
    sample.coordinate_quality_tier,
    sample.source_dra_id ?? '',
    sample.bc_region ?? '',
    sample.waterbody ?? '',
    String(sample.geometry.coordinates[0]),
    String(sample.geometry.coordinates[1]),
  ]);
  downloadCsv('matrix-map-selection.csv', [headers, ...rows]);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (!/[",\n\r]/.test(safeValue)) return safeValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}
