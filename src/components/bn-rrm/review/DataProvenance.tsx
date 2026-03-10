'use client';

import { useState, useMemo } from 'react';
import provDataRaw from '@/data/bn-rrm/transparency/provenance_registry.json';

type Document = {
  doc_id: number;
  site_id: number;
  filename: string | null;
  title: string;
  author: string;
  date: string;
  type: string;
  pages: number | null;
};

type ProvenanceRecord = {
  target_table: string;
  page_number: number | string | null;
  table_number: string | null;
  figure_number: string | null;
  extraction_method: string | null;
  confidence: number | null;
  reviewer_verified: boolean | null;
  doc_title: string;
  doc_author: string;
  doc_type: string;
};

type Station = {
  station_id: number;
  station_name: string;
  site_name: string;
  registry_id: string;
  waterbody_type: string;
  data_counts: { chemistry: number; toxicity: number; community: number };
  co_location: string;
  provenance_quality?: string;
  provenance_coverage?: { data_records: number; provenance_linked: number; coverage_pct: number };
  provenance_records: ProvenanceRecord[];
};

type ProvenanceRegistryData = {
  _meta: { export_date: string; db_hash: string };
  documents: Document[];
  stations: Station[];
  summary: {
    total_documents: number;
    total_stations: number;
    stations_with_provenance: number;
    co_location_breakdown: Record<string, number>;
  };
};

const CO_LOC_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  full_triad: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Full Triad' },
  partial: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Partial' },
  single_loe: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-300', label: 'Single LoE' },
  no_data: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'No Data' },
};

const PROV_QUALITY_BADGES: Record<string, { bg: string; text: string; label: string; note: string }> = {
  full_provenance: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Full', note: 'All data records have document-level provenance.' },
  partial_provenance: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Partial', note: 'Some data records lack document-level provenance linkage.' },
  legacy_no_provenance: { bg: 'bg-slate-200 dark:bg-slate-600', text: 'text-slate-600 dark:text-slate-300', label: 'Legacy', note: 'Pre-extraction data — provenance established at site/report level, not per-record.' },
  no_data: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400', label: '—', note: 'No data records at this station.' },
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

export function DataProvenance() {
  const [activeTab, setActiveTab] = useState<'registry' | 'stations'>('registry');
  const [selectedStation, setSelectedStation] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>('all');

  const data = provDataRaw as unknown as ProvenanceRegistryData;

  const siteNames = useMemo(() => {
    const names = new Set(data.stations.map(s => s.site_name));
    return Array.from(names).sort();
  }, [data.stations]);

  const filteredStations = useMemo(() => {
    return data.stations.filter(s => {
      if (siteFilter !== 'all' && s.site_name !== siteFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return s.station_name.toLowerCase().includes(term) ||
               s.site_name.toLowerCase().includes(term) ||
               s.registry_id.toLowerCase().includes(term);
      }
      return true;
    });
  }, [data.stations, siteFilter, searchTerm]);

  const selectedStationData = useMemo(() => {
    if (selectedStation === null) return null;
    return data.stations.find(s => s.station_id === selectedStation) ?? null;
  }, [data.stations, selectedStation]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Data & Provenance</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Document registry and station-level data traceability
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        {[
          { id: 'registry' as const, label: 'Document Registry', count: data.documents.length },
          { id: 'stations' as const, label: 'Station Provenance', count: data.stations.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.label} <span className="text-[10px] opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'registry' && (
        <div className="space-y-4">
          {/* Document table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Title</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Author</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Date</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">Pages</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documents.map(doc => (
                    <tr key={doc.doc_id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-3 py-2 font-mono text-slate-500">{doc.doc_id}</td>
                      <td className="px-3 py-2 text-slate-800 dark:text-slate-200 max-w-xs truncate" title={doc.title}>{doc.title}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{doc.author}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono">{doc.date}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{doc.pages ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <button
              onClick={() => exportData(data.documents, 'document_registry.json', 'json')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => exportData(data.documents, 'document_registry.csv', 'csv')}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stations' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search stations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
            <select
              value={siteFilter}
              onChange={e => setSiteFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Sites</option>
              {siteNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Co-location summary */}
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(data.summary.co_location_breakdown).map(([key, count]) => {
              const badge = CO_LOC_BADGES[key] ?? CO_LOC_BADGES.no_data;
              return (
                <div key={key} className={`p-2 rounded-lg ${badge.bg}`}>
                  <div className={`text-lg font-bold ${badge.text}`}>{count}</div>
                  <div className={`text-[10px] ${badge.text} opacity-80`}>{badge.label}</div>
                </div>
              );
            })}
          </div>

          {/* Station list */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Station</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Site</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Chem</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Tox</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Comm</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Co-loc</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-600 dark:text-slate-300">Prov</th>
                </tr>
              </thead>
              <tbody>
                {filteredStations.map(st => {
                  const badge = CO_LOC_BADGES[st.co_location] ?? CO_LOC_BADGES.no_data;
                  return (
                    <tr
                      key={st.station_id}
                      onClick={() => setSelectedStation(st.station_id === selectedStation ? null : st.station_id)}
                      className={`border-b border-slate-100 dark:border-slate-700/50 cursor-pointer transition-colors ${
                        selectedStation === st.station_id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">{st.station_name}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={st.site_name}>{st.site_name}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{st.data_counts.chemistry || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{st.data_counts.toxicity || '—'}</td>
                      <td className="px-3 py-2 text-center text-slate-500">{st.data_counts.community || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(() => {
                          const pq = PROV_QUALITY_BADGES[st.provenance_quality ?? 'no_data'] ?? PROV_QUALITY_BADGES.no_data;
                          return <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${pq.bg} ${pq.text}`}>{pq.label}</span>;
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Station detail panel */}
          {selectedStationData && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {selectedStationData.station_name}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {selectedStationData.site_name} &middot; Registry: {selectedStationData.registry_id} &middot; {selectedStationData.waterbody_type}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Data counts */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Chemistry', count: selectedStationData.data_counts.chemistry },
                  { label: 'Toxicity', count: selectedStationData.data_counts.toxicity },
                  { label: 'Community', count: selectedStationData.data_counts.community },
                ].map(d => (
                  <div key={d.label} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{d.count}</div>
                    <div className="text-[10px] text-slate-500">{d.label}</div>
                  </div>
                ))}
              </div>

              {/* Provenance quality callout */}
              {(() => {
                const pq = PROV_QUALITY_BADGES[selectedStationData.provenance_quality ?? 'no_data'] ?? PROV_QUALITY_BADGES.no_data;
                const cov = selectedStationData.provenance_coverage;
                return (
                  <div className={`rounded-lg p-2.5 ${pq.bg}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${pq.text}`}>Provenance: {pq.label}</span>
                      {cov && cov.data_records > 0 && (
                        <span className={`text-[10px] ${pq.text} opacity-70`}>
                          ({cov.provenance_linked}/{cov.data_records} records linked, {cov.coverage_pct}%)
                        </span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${pq.text} opacity-80`}>{pq.note}</p>
                  </div>
                );
              })()}

              {/* Provenance records */}
              {selectedStationData.provenance_records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">Table</th>
                        <th className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">Source Document</th>
                        <th className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">Page</th>
                        <th className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">Table #</th>
                        <th className="px-2 py-1 text-left font-semibold text-slate-600 dark:text-slate-300">Method</th>
                        <th className="px-2 py-1 text-center font-semibold text-slate-600 dark:text-slate-300">Conf</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStationData.provenance_records.map((pr, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                          <td className="px-2 py-1 font-mono text-slate-500">{pr.target_table}</td>
                          <td className="px-2 py-1 text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={pr.doc_title}>{pr.doc_title}</td>
                          <td className="px-2 py-1 text-slate-500">{pr.page_number ?? '—'}</td>
                          <td className="px-2 py-1 text-slate-500">{pr.table_number ?? '—'}</td>
                          <td className="px-2 py-1 text-slate-500">{pr.extraction_method ?? '—'}</td>
                          <td className="px-2 py-1 text-center text-slate-500">
                            {pr.confidence !== null ? (pr.confidence * 100).toFixed(0) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No provenance records linked to this station.</p>
              )}
            </div>
          )}

          {/* Export */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const flat = filteredStations.map(s => ({
                  station_id: s.station_id,
                  station_name: s.station_name,
                  site_name: s.site_name,
                  registry_id: s.registry_id,
                  waterbody_type: s.waterbody_type,
                  chemistry_records: s.data_counts.chemistry,
                  toxicity_records: s.data_counts.toxicity,
                  community_records: s.data_counts.community,
                  co_location: s.co_location,
                  provenance_count: s.provenance_records.length,
                }));
                exportData(flat, 'station_provenance.json', 'json');
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Export JSON
            </button>
            <button
              onClick={() => {
                const flat = filteredStations.map(s => ({
                  station_id: s.station_id,
                  station_name: s.station_name,
                  site_name: s.site_name,
                  registry_id: s.registry_id,
                  waterbody_type: s.waterbody_type,
                  chemistry_records: s.data_counts.chemistry,
                  toxicity_records: s.data_counts.toxicity,
                  community_records: s.data_counts.community,
                  co_location: s.co_location,
                  provenance_count: s.provenance_records.length,
                }));
                exportData(flat, 'station_provenance.csv', 'csv');
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
