'use client';

import { useState, useMemo } from 'react';
import siteDataRaw from '@/data/bn-rrm/transparency/site_reports.json';

type ChemRow = {
  parameter: string;
  group: string | null;
  unit: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  n: number;
  isqg: number | null;
  pel: number | null;
  exceed_isqg: number;
  exceed_pel: number;
};

type ToxRow = {
  test_type: string;
  species: string;
  endpoint: string;
  unit: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  n: number;
  sig_different_count: number;
};

type CommunityMetric = {
  name: string;
  min: number | null;
  max: number | null;
  mean: number | null;
};

type Site = {
  site_id: number;
  name: string;
  registry_id: string;
  waterbody_type: string;
  region: string | null;
  station_count: number;
  co_location_quality: Record<string, number>;
  woe_risk_distribution: Record<string, number>;
  chemistry_summary: ChemRow[] | null;
  toxicity_summary: ToxRow[] | null;
  community_summary: { n: number; metrics: CommunityMetric[] } | null;
};

type SiteReportsData = {
  _meta: { export_date: string; db_hash: string };
  sites: Site[];
  summary: {
    total_sites: number;
    total_stations: number;
    sites_with_chemistry: number;
    sites_with_toxicity: number;
    sites_with_community: number;
  };
};

const WATERBODY_COLORS: Record<string, { bg: string; text: string }> = {
  marine: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  freshwater: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
};

function exportData(data: unknown, filename: string, type: 'json' | 'csv') {
  let content: string;
  let mimeType: string;
  if (type === 'json') {
    content = JSON.stringify(data, null, 2);
    mimeType = 'application/json';
  } else {
    const arr = data as Record<string, unknown>[];
    if (!arr.length) return;
    const keys = Object.keys(arr[0]);
    content = keys.join(',') + '\n' + arr.map(row =>
      keys.map(k => {
        const v = row[k];
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return `"${v.replace(/"/g, '""')}"`;
        return String(v);
      }).join(',')
    ).join('\n');
    mimeType = 'text/csv';
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SiteCard({ site, selected, onClick }: { site: Site; selected: boolean; onClick: () => void }) {
  const wb = WATERBODY_COLORS[site.waterbody_type] ?? WATERBODY_COLORS.marine;
  const triads = site.co_location_quality.full_triad ?? 0;

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-xl border text-left transition-colors ${
        selected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base font-semibold text-slate-800 dark:text-slate-100">{site.name}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${wb.bg} ${wb.text}`}>
          {site.waterbody_type}
        </span>
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Registry: {site.registry_id} &middot; {site.station_count} stations &middot; {triads} triads
      </div>
      <div className="flex gap-4 mt-2.5 text-xs">
        <span className={`${site.chemistry_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Chem {site.chemistry_summary ? `(${site.chemistry_summary.length})` : '—'}
        </span>
        <span className={`${site.toxicity_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Tox {site.toxicity_summary ? `(${site.toxicity_summary.length})` : '—'}
        </span>
        <span className={`${site.community_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Comm {site.community_summary ? `(n=${site.community_summary.n})` : '—'}
        </span>
      </div>
    </button>
  );
}

export function SiteReports() {
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'chemistry' | 'toxicity' | 'community'>('chemistry');

  const data = siteDataRaw as unknown as SiteReportsData;
  const selectedSite = useMemo(() =>
    selectedSiteId !== null ? data.sites.find(s => s.site_id === selectedSiteId) ?? null : null,
    [data.sites, selectedSiteId]
  );

  const canExport = selectedSite !== null;
  const activeDataForExport = selectedSite
    ? activeDataTab === 'chemistry' ? selectedSite.chemistry_summary
      : activeDataTab === 'toxicity' ? selectedSite.toxicity_summary
        : selectedSite.community_summary?.metrics ?? null
    : null;

  const exportFilename = selectedSite
    ? `${selectedSite.name.replace(/\s/g, '_')}_${activeDataTab}`
    : '';

  return (
    <div className="space-y-6">
      {/* Header with export toolbar */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Site Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {data.summary.total_sites} sites &middot; {data.summary.total_stations} stations
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {!canExport ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 italic">Select a site to enable exports</span>
          ) : (
            <>
              <span className="text-xs text-slate-400 dark:text-slate-500 mr-1">
                {selectedSite!.name} / {activeDataTab}
              </span>
              <button
                onClick={() => activeDataForExport && exportData(activeDataForExport, `${exportFilename}.json`, 'json')}
                disabled={!activeDataForExport}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export JSON
              </button>
              <button
                onClick={() => activeDataForExport && exportData(activeDataForExport, `${exportFilename}.csv`, 'csv')}
                disabled={!activeDataForExport}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Site cards */}
      <div className="grid grid-cols-2 gap-3">
        {data.sites.map(site => (
          <SiteCard
            key={site.site_id}
            site={site}
            selected={selectedSiteId === site.site_id}
            onClick={() => setSelectedSiteId(selectedSiteId === site.site_id ? null : site.site_id)}
          />
        ))}
      </div>

      {/* Selected site detail */}
      {selectedSite && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
          {/* Site header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedSite.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Registry: {selectedSite.registry_id} &middot; {selectedSite.waterbody_type} &middot; {selectedSite.station_count} stations
                </p>
              </div>
              <button
                onClick={() => setSelectedSiteId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {Object.entries(selectedSite.co_location_quality).map(([key, count]) => (
                <div key={key} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{count}</div>
                  <div className="text-xs text-slate-500">{key.replace(/_/g, ' ')}</div>
                </div>
              ))}
            </div>

            {/* WOE risk distribution */}
            {Object.keys(selectedSite.woe_risk_distribution).length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5">WOE Risk</div>
                <div className="flex gap-2">
                  {['Low', 'Moderate', 'High'].map(risk => {
                    const count = selectedSite.woe_risk_distribution[risk] ?? 0;
                    const colors: Record<string, string> = {
                      Low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                      Moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                      High: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                    };
                    return (
                      <span key={risk} className={`px-3 py-1.5 rounded text-sm font-medium ${colors[risk]}`}>
                        {risk}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Data tab switcher */}
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            {[
              { id: 'chemistry' as const, label: 'Chemistry', available: !!selectedSite.chemistry_summary },
              { id: 'toxicity' as const, label: 'Toxicity', available: !!selectedSite.toxicity_summary },
              { id: 'community' as const, label: 'Community', available: !!selectedSite.community_summary },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveDataTab(tab.id)}
                disabled={!tab.available}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                  activeDataTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                    : tab.available
                      ? 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Data tables */}
          <div className="p-5">
            {activeDataTab === 'chemistry' && selectedSite.chemistry_summary && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Parameter</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Unit</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Min</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Max</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Mean</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">N</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">ISQG</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">PEL</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-amber-600 dark:text-amber-400">&gt;ISQG</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">&gt;PEL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSite.chemistry_summary.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.parameter}</td>
                        <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.min ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.max ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.mean ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{row.n}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{row.isqg ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{row.pel ?? '—'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${row.exceed_isqg > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-300'}`}>
                          {row.exceed_isqg || '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${row.exceed_pel > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-300'}`}>
                          {row.exceed_pel || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeDataTab === 'toxicity' && selectedSite.toxicity_summary && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Species</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Endpoint</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Unit</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Min</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Max</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Mean</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">N</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">Sig.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSite.toxicity_summary.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.species}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.endpoint}</td>
                        <td className="px-3 py-2 text-slate-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.min ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.max ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.mean ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{row.n}</td>
                        <td className={`px-3 py-2 text-right font-mono ${row.sig_different_count > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-300'}`}>
                          {row.sig_different_count || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeDataTab === 'community' && selectedSite.community_summary && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Metric</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Min</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Max</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300">Mean</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSite.community_summary.metrics.map((m, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{m.name}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.min ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.max ?? '—'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.mean ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">n = {selectedSite.community_summary.n} samples</p>
              </div>
            )}

            {/* No data state */}
            {activeDataTab === 'chemistry' && !selectedSite.chemistry_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No chemistry data for this site.</p>
            )}
            {activeDataTab === 'toxicity' && !selectedSite.toxicity_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No toxicity data for this site.</p>
            )}
            {activeDataTab === 'community' && !selectedSite.community_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No community data for this site.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
