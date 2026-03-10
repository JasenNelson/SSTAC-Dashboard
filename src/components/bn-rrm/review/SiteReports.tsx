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

type CampaignDates = {
  earliest: string;
  latest: string;
  n_unique_dates: number;
  n_years: number;
  cross_year: boolean;
};

type SourceDocument = {
  doc_id: number;
  title: string;
  author: string;
  date: string;
  type: string;
};

type StationDetail = {
  station_id: number;
  station_name: string;
  station_type: string;
  depth_m: number | null;
  latitude: number | null;
  longitude: number | null;
  date_earliest: string | null;
  date_latest: string | null;
  n_sample_dates: number;
  chemistry_records: number;
  toxicity_records: number;
  community_records: number;
  co_location: string;
  cross_year_merge: boolean;
};

type Site = {
  site_id: number;
  name: string;
  registry_id: string;
  waterbody_type: string;
  region: string | null;
  station_count: number;
  campaign_dates: CampaignDates | null;
  temporal_note: string | null;
  source_documents: SourceDocument[] | null;
  station_details: StationDetail[] | null;
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

/** Flatten station details for CSV export (objects -> scalar columns) */
function flattenStationDetails(stations: StationDetail[], siteName: string): Record<string, unknown>[] {
  return stations.map(s => ({
    site_name: siteName,
    station_id: s.station_id,
    station_name: s.station_name,
    station_type: s.station_type,
    depth_m: s.depth_m,
    latitude: s.latitude,
    longitude: s.longitude,
    date_earliest: s.date_earliest,
    date_latest: s.date_latest,
    n_sample_dates: s.n_sample_dates,
    chemistry_records: s.chemistry_records,
    toxicity_records: s.toxicity_records,
    community_records: s.community_records,
    co_location: s.co_location,
    cross_year_merge: s.cross_year_merge,
  }));
}

function formatDateRange(dates: CampaignDates): string {
  const startYear = dates.earliest.slice(0, 4);
  const endYear = dates.latest.slice(0, 4);
  if (startYear === endYear) return startYear;
  return `${startYear}\u2013${endYear}`;
}

function SiteCard({ site, selected, onClick }: { site: Site; selected: boolean; onClick: () => void }) {
  const wb = WATERBODY_COLORS[site.waterbody_type.toLowerCase()] ?? WATERBODY_COLORS.marine;
  const triads = site.co_location_quality.full_triad ?? 0;
  const crossYear = site.campaign_dates?.cross_year ?? false;

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
        {crossYear && (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            Cross-year
          </span>
        )}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400">
        Registry: {site.registry_id} &middot; {site.station_count} stations &middot; {triads} triads
        {site.campaign_dates && <> &middot; {formatDateRange(site.campaign_dates)}</>}
      </div>
      <div className="flex gap-4 mt-2.5 text-xs">
        <span className={`${site.chemistry_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Chem {site.chemistry_summary ? `(${site.chemistry_summary.length})` : '\u2014'}
        </span>
        <span className={`${site.toxicity_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Tox {site.toxicity_summary ? `(${site.toxicity_summary.length})` : '\u2014'}
        </span>
        <span className={`${site.community_summary ? 'text-green-600 dark:text-green-400' : 'text-slate-300'}`}>
          Comm {site.community_summary ? `(n=${site.community_summary.n})` : '\u2014'}
        </span>
      </div>
    </button>
  );
}

type DataTab = 'chemistry' | 'toxicity' | 'community' | 'stations';

export function SiteReports() {
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<DataTab>('chemistry');

  const data = siteDataRaw as unknown as SiteReportsData;
  const selectedSite = useMemo(() =>
    selectedSiteId !== null ? data.sites.find(s => s.site_id === selectedSiteId) ?? null : null,
    [data.sites, selectedSiteId]
  );

  const canExport = selectedSite !== null;
  const activeDataForExport = useMemo(() => {
    if (!selectedSite) return null;
    if (activeDataTab === 'chemistry') return selectedSite.chemistry_summary;
    if (activeDataTab === 'toxicity') return selectedSite.toxicity_summary;
    if (activeDataTab === 'community') return selectedSite.community_summary?.metrics ?? null;
    if (activeDataTab === 'stations') return selectedSite.station_details;
    return null;
  }, [selectedSite, activeDataTab]);

  const exportFilename = selectedSite
    ? `${selectedSite.name.replace(/\s/g, '_')}_${activeDataTab}`
    : '';

  const handleExport = (format: 'json' | 'csv') => {
    if (!activeDataForExport || !selectedSite) return;
    if (activeDataTab === 'stations' && format === 'csv') {
      exportData(
        flattenStationDetails(activeDataForExport as StationDetail[], selectedSite.name),
        `${exportFilename}.csv`,
        'csv'
      );
    } else {
      exportData(activeDataForExport, `${exportFilename}.${format}`, format);
    }
  };

  // Count missing coords for selected site
  const coordStats = useMemo(() => {
    if (!selectedSite?.station_details) return null;
    const total = selectedSite.station_details.length;
    const withCoords = selectedSite.station_details.filter(s => s.latitude !== null && s.longitude !== null).length;
    return { total, withCoords, missing: total - withCoords };
  }, [selectedSite]);

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
                onClick={() => handleExport('json')}
                disabled={!activeDataForExport}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
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
                  {selectedSite.campaign_dates && (
                    <> &middot; {formatDateRange(selectedSite.campaign_dates)} ({selectedSite.campaign_dates.n_unique_dates} dates, {selectedSite.campaign_dates.n_years} yr{selectedSite.campaign_dates.n_years !== 1 ? 's' : ''})</>
                  )}
                  {selectedSite.source_documents && selectedSite.source_documents.length > 0 && (
                    <> &middot; {selectedSite.source_documents.length} source doc{selectedSite.source_documents.length !== 1 ? 's' : ''}</>
                  )}
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

            {/* Cross-year warning banner */}
            {selectedSite.campaign_dates?.cross_year && selectedSite.temporal_note && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Temporal note:</span> {selectedSite.temporal_note}
                </p>
              </div>
            )}

            {/* Missing coordinates callout */}
            {coordStats && coordStats.missing === coordStats.total && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">Data note:</span> Station coordinates (lat/lon) were not extracted into the database for this site. Spatial audit requires the original source documents listed above.
                </p>
              </div>
            )}

            {/* Source documents */}
            {selectedSite.source_documents && selectedSite.source_documents.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1.5">Source Documents</div>
                <div className="space-y-1">
                  {selectedSite.source_documents.map(doc => (
                    <div key={doc.doc_id} className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{doc.title}</span>
                      {' \u2014 '}{doc.author}, {doc.date.slice(0, 4)}
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px]">
                        {doc.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    const count = selectedSite.woe_risk_distribution[risk] ?? selectedSite.woe_risk_distribution[risk.toLowerCase()] ?? selectedSite.woe_risk_distribution[`${risk.toLowerCase()}-to-high`] ?? 0;
                    const colors: Record<string, string> = {
                      Low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                      Moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                      High: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                    };
                    if (count === 0) return null;
                    return (
                      <span key={risk} className={`px-3 py-1.5 rounded text-sm font-medium ${colors[risk]}`}>
                        {risk}: {count}
                      </span>
                    );
                  })}
                  {/* Show non-standard risk keys (e.g. "moderate-to-high") */}
                  {Object.entries(selectedSite.woe_risk_distribution)
                    .filter(([k]) => !['low', 'moderate', 'high'].includes(k.toLowerCase()))
                    .map(([key, count]) => (
                      <span key={key} className="px-3 py-1.5 rounded text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        {key}: {count}
                      </span>
                    ))
                  }
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
              { id: 'stations' as const, label: `Stations (${selectedSite.station_details?.length ?? 0})`, available: !!selectedSite.station_details?.length },
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
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.min ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.max ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.mean ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{row.n}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{row.isqg ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-400">{row.pel ?? '\u2014'}</td>
                        <td className={`px-3 py-2 text-right font-mono ${row.exceed_isqg > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-300'}`}>
                          {row.exceed_isqg || '\u2014'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${row.exceed_pel > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-300'}`}>
                          {row.exceed_pel || '\u2014'}
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
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.min ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.max ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{row.mean ?? '\u2014'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{row.n}</td>
                        <td className={`px-3 py-2 text-right font-mono ${row.sig_different_count > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-300'}`}>
                          {row.sig_different_count || '\u2014'}
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
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.min ?? '\u2014'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.max ?? '\u2014'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{m.mean ?? '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">n = {selectedSite.community_summary.n} samples</p>
              </div>
            )}

            {/* Station details tab */}
            {activeDataTab === 'stations' && selectedSite.station_details && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Station</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-slate-600 dark:text-slate-300" title="Co-location quality: full triad (chem+tox+comm), chem+tox, or single LOE">Co-location</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300" title="Sampling date range (count of unique dates)">Dates</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300" title="Chemistry sample records">Chem</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300" title="Toxicity test records">Tox</th>
                        <th className="px-3 py-2.5 text-right font-semibold text-slate-600 dark:text-slate-300" title="Benthic community survey records">Community</th>
                        <th className="px-3 py-2.5 text-center font-semibold text-slate-600 dark:text-slate-300" title="Latitude/longitude coordinates (when available in database)">Coords</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSite.station_details.map((s) => {
                        const dateLabel = s.date_earliest === s.date_latest
                          ? (s.date_earliest?.slice(0, 10) ?? '\u2014')
                          : `${s.date_earliest?.slice(0, 10) ?? '?'} \u2013 ${s.date_latest?.slice(0, 10) ?? '?'}`;
                        return (
                          <tr
                            key={s.station_id}
                            className={`border-b border-slate-100 dark:border-slate-700/50 ${s.cross_year_merge ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                          >
                            <td className="px-3 py-2 text-slate-800 dark:text-slate-200 font-mono text-xs">
                              {s.station_name}
                              {s.cross_year_merge && (
                                <span className="ml-1.5 px-1 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                                  merged
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{s.station_type.replace(/_/g, ' ')}</td>
                            <td className="px-3 py-2 text-slate-500 text-xs">{s.co_location.replace(/_/g, ' ')}</td>
                            <td className="px-3 py-2 text-right text-slate-500 text-xs whitespace-nowrap">
                              {dateLabel}
                              {s.n_sample_dates > 1 && <span className="text-slate-400 ml-1">({s.n_sample_dates})</span>}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{s.chemistry_records || '\u2014'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{s.toxicity_records || '\u2014'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">{s.community_records || '\u2014'}</td>
                            <td className="px-3 py-2 text-center" title={s.latitude !== null && s.longitude !== null ? `${s.latitude}, ${s.longitude}` : 'Coordinates not available in database'}>
                              {s.latitude !== null && s.longitude !== null ? (
                                <span className="text-green-600 dark:text-green-400 text-xs font-mono">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 text-xs">n/a</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">
                  {selectedSite.station_details.length} stations
                  {coordStats && coordStats.missing === coordStats.total && (
                    <> &middot; No coordinates in dataset (lat/lon not extracted)</>
                  )}
                  {coordStats && coordStats.missing > 0 && coordStats.missing < coordStats.total && (
                    <> &middot; {coordStats.withCoords}/{coordStats.total} stations with coordinates</>
                  )}
                  {selectedSite.station_details.some(s => s.cross_year_merge) && (
                    <> &middot; <span className="text-amber-600 dark:text-amber-400">Amber rows = cross-year merged</span></>
                  )}
                </p>
              </div>
            )}

            {/* No data states */}
            {activeDataTab === 'chemistry' && !selectedSite.chemistry_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No chemistry data for this site.</p>
            )}
            {activeDataTab === 'toxicity' && !selectedSite.toxicity_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No toxicity data for this site.</p>
            )}
            {activeDataTab === 'community' && !selectedSite.community_summary && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No community data for this site.</p>
            )}
            {activeDataTab === 'stations' && !selectedSite.station_details?.length && (
              <p className="text-sm text-slate-400 italic py-6 text-center">No station details available for this site.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
