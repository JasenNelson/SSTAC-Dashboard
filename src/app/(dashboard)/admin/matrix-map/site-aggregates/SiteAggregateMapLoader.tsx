'use client';

/**
 * Client SSR boundary for the Option C aggregate map.
 *
 * Mirrors src/app/(dashboard)/matrix-map/MatrixMapLoader.tsx: `next/dynamic` with `ssr: false`
 * (forbidden inside a Server Component, hence this 'use client' wrapper) plus the Leaflet CSS
 * import kept HERE rather than in the map component, so the vitest smoke test can mock the
 * leaflet JS module without Vite trying to run the CSS through PostCSS.
 */
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import type { AggregateMarker } from '@/lib/matrix-map/siteAggregateMarkers';

const SiteAggregateMap = dynamic(() => import('./SiteAggregateMap').then((mod) => mod.SiteAggregateMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <span className="text-sm text-slate-500 dark:text-slate-400">Loading map...</span>
    </div>
  ),
});

export function SiteAggregateMapLoader({ markers }: { markers: AggregateMarker[] }) {
  return <SiteAggregateMap markers={markers} />;
}

export default SiteAggregateMapLoader;
