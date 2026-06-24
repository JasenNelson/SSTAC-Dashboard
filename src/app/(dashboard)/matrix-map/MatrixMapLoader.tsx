'use client';

// =====================================================================
// MatrixMapLoader -- client wrapper that lazy-loads the leaflet tree
// =====================================================================
//
// Why this file exists:
//   In Next 15 the `ssr: false` option on `next/dynamic` is NOT
//   permitted in Server Components. The parent page.tsx is a Server
//   Component (it gates on Supabase auth + user_roles). This thin
//   client-component wrapper performs the dynamic import with
//   `ssr: false` so the react-leaflet / leaflet module graph (both of
//   which touch `window` and `document` at module load) never executes
//   server-side. Pattern mirrors src/app/(dashboard)/bn-rrm/BNRRMClient
//   which dynamically imports SiteMap the same way.
//
// PR-MAP-2 scope per docs/design/matrix-map/PLAN_V3_4_2.md section 7.
// Plain ASCII only.
// =====================================================================

import dynamic from 'next/dynamic';

// Leaflet + markercluster CSS lives here (NOT in MatrixMap.tsx) so the
// vitest smoke spec for MatrixMap.tsx can mock the dynamic JS imports
// cleanly without Vite trying to process .css through the project's
// PostCSS config (which is .mjs-based for Next/Tailwind and not loadable
// from Vite directly). Pattern matches BNRRMClient -> SiteMap.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import type { MatrixMapData } from './types';

const MatrixMap = dynamic(
  () => import('./MatrixMap').then((mod) => mod.MatrixMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
          <span className="text-sm">Loading map...</span>
        </div>
      </div>
    ),
  },
);

export interface MatrixMapLoaderProps {
  /**
   * Initial sample + hidden-summary payload from the server-side
   * `matrix_map.fetch_samples_with_hidden_summary` RPC call in
   * page.tsx. Pass-through to the underlying MatrixMap client
   * component.
   */
  initialMapData: MatrixMapData;
  /**
   * Optional error string surfaced when the server-side RPC fetch
   * failed; renders as a small inline notice inside the map area.
   */
  fetchErrorMessage?: string | null;
  /**
   * bbox-lane Stage 2 pass-through: notifies an embedding parent of each
   * viewport-refetch payload so sibling panels can accumulate a cumulative
   * sample union (selection resolution must survive viewport changes).
   */
  onMapDataChange?: (data: MatrixMapData) => void;
}

export default function MatrixMapLoader({
  initialMapData,
  fetchErrorMessage,
  onMapDataChange,
}: MatrixMapLoaderProps) {
  return (
    <MatrixMap
      initialMapData={initialMapData}
      fetchErrorMessage={fetchErrorMessage}
      onMapDataChange={onMapDataChange}
    />
  );
}
