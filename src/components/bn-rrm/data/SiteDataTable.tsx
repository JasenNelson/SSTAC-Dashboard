/**
 * SiteDataTable Component
 *
 * Displays uploaded site data in a table with validation indicators
 */

'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/utils/cn';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import type { SiteData } from '@/types/bn-rrm/site-data';
import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Beaker,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Trash2,
  Play,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';

interface SiteDataTableProps {
  onRunAssessment?: (siteId: string) => void;
  onViewOnMap?: (siteId: string) => void;
}

export function SiteDataTable({ onRunAssessment, onViewOnMap }: SiteDataTableProps) {
  const sites = useSiteDataStore((state) => state.sites);
  const assessments = useSiteDataStore((state) => state.assessments);
  const removeSite = useSiteDataStore((state) => state.removeSite);
  const selectSite = useSiteDataStore((state) => state.selectSite);
  const selectedSiteId = useSiteDataStore((state) => state.selectedSiteId);
  const selectedSiteIds = useSiteDataStore((state) => state.selectedSiteIds);
  const toggleSiteSelection = useSiteDataStore((state) => state.toggleSiteSelection);
  const selectAllSites = useSiteDataStore((state) => state.selectAllSites);
  const clearSiteSelection = useSiteDataStore((state) => state.clearSiteSelection);
  const removeSelectedSites = useSiteDataStore((state) => state.removeSelectedSites);
  const clearAllSites = useSiteDataStore((state) => state.clearAllSites);

  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set());

  const siteList = useMemo(() => {
    // Filter out any undefined or malformed entries
    return Object.values(sites).filter((site): site is SiteData => {
      return site != null &&
             site.location != null &&
             typeof site.location.id === 'string' &&
             Array.isArray(site.sedimentChemistry);
    });
  }, [sites]);

  const toggleExpand = (siteId: string) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  const getValidationStatus = (site: SiteData): 'good' | 'warning' | 'exceedance' => {
    let hasWarning = false;
    let hasExceedance = false;

    site.sedimentChemistry.forEach((chem) => {
      if (chem.copper) {
        if (chem.copper > 197) hasExceedance = true;
        else if (chem.copper > 35.7) hasWarning = true;
      }
      if (chem.zinc) {
        if (chem.zinc > 315) hasExceedance = true;
        else if (chem.zinc > 123) hasWarning = true;
      }
      if (chem.lead) {
        if (chem.lead > 91.3) hasExceedance = true;
        else if (chem.lead > 35) hasWarning = true;
      }
    });

    if (hasExceedance) return 'exceedance';
    if (hasWarning) return 'warning';
    return 'good';
  };

  if (siteList.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
        <Beaker className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No site data loaded</p>
        <p className="text-sm mt-1">Upload a file to get started</p>
      </div>
    );
  }

  const allSelected = siteList.length > 0 && selectedSiteIds.length === siteList.length;
  const someSelected = selectedSiteIds.length > 0 && selectedSiteIds.length < siteList.length;

  const handleSelectAll = () => {
    if (allSelected) {
      clearSiteSelection();
    } else {
      selectAllSites();
    }
  };

  const handleDeleteSelected = () => {
    if (selectedSiteIds.length === 0) return;
    if (confirm(`Delete ${selectedSiteIds.length} selected site${selectedSiteIds.length !== 1 ? 's' : ''}?`)) {
      removeSelectedSites();
    }
  };

  const handleClearAll = () => {
    if (confirm(`Delete all ${siteList.length} sites? This cannot be undone.`)) {
      clearAllSites();
    }
  };

  return (
    <div className="space-y-2">
      {/* Bulk actions toolbar */}
      <div className="flex items-center gap-2 px-2 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
          title={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-500" />
          ) : someSelected ? (
            <MinusSquare className="w-4 h-4 text-blue-500" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
        </button>

        <span className="text-xs text-slate-400 dark:text-slate-500">
          {selectedSiteIds.length > 0
            ? `${selectedSiteIds.length} of ${siteList.length} selected`
            : `${siteList.length} site${siteList.length !== 1 ? 's' : ''}`}
        </span>

        <div className="flex-1" />

        {selectedSiteIds.length > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedSiteIds.length})
          </button>
        )}

        {siteList.length > 0 && selectedSiteIds.length === 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      {siteList.map((site) => {
        const siteId = site.location.id;
        const isExpanded = expandedSites.has(siteId);
        const status = getValidationStatus(site);
        const assessment = assessments[siteId];
        const isSelected = selectedSiteId === siteId;
        const isChecked = selectedSiteIds.includes(siteId);

        return (
          <div
            key={siteId}
            className={cn(
              'border rounded-lg overflow-hidden transition-all',
              isSelected ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30' : 'border-slate-200 dark:border-slate-700'
            )}
          >
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors',
                isExpanded && 'border-b border-slate-100 dark:border-slate-700'
              )}
              onClick={() => {
                toggleExpand(siteId);
                selectSite(siteId);
              }}
            >
              <button
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                onClick={(e) => { e.stopPropagation(); toggleSiteSelection(siteId); }}
                title={isChecked ? 'Deselect' : 'Select'}
                aria-label={isChecked ? 'Deselect site' : 'Select site'}
              >
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-blue-500" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                )}
              </button>

              <button
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded"
                aria-label={isExpanded ? 'Collapse site details' : 'Expand site details'}
                aria-expanded={isExpanded}
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
              </button>

              <StatusIcon status={status} />

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                  {site.location.name}
                  {site.location.sourceTag === 'training' && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Training</span>
                  )}
                  {site.location.sourceTag === 'comparison' && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">Comparison</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {site.sedimentChemistry.length} sample{site.sedimentChemistry.length !== 1 ? 's' : ''} • {site.location.region || 'No region'}
                </p>
              </div>

              {assessment && (
                <div className={cn('px-2 py-1 rounded text-xs font-medium',
                  assessment.mostLikelyImpact === 'none' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                  assessment.mostLikelyImpact === 'minor' && 'bg-yellow-100 text-yellow-700 dark:text-yellow-300',
                  assessment.mostLikelyImpact === 'moderate' && 'bg-orange-100 text-orange-700',
                  assessment.mostLikelyImpact === 'severe' && 'bg-red-100 text-red-700 dark:text-red-300'
                )}>
                  {assessment.mostLikelyImpact}
                </div>
              )}

              <div className="flex items-center gap-1">
                {onViewOnMap && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onViewOnMap(siteId); }}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                    title="View on map"
                    aria-label="View on map"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                )}
                {onRunAssessment && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRunAssessment(siteId); }}
                    className="p-2 text-slate-400 dark:text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    title="Run assessment"
                    aria-label="Run assessment"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeSite(siteId); }}
                  className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Remove site"
                  aria-label="Remove site"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50">
                <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Coordinates</p>
                    <p className="font-medium">{site.location.latitude?.toFixed(4) ?? '—'}, {site.location.longitude?.toFixed(4) ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Site Type</p>
                    <p className="font-medium capitalize">{site.location.siteType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Waterbody</p>
                    <p className="font-medium">{site.location.waterbody || '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Date</p>
                    <p className="font-medium">{site.location.dateCollected || '—'}</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-700">
                        <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-400">Sample</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Cu</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Zn</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Pb</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">PAHs</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">TOC</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">AVS</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 dark:text-slate-400">Fines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {site.sedimentChemistry.map((chem, idx) => (
                        <tr key={chem.sampleId || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                          <td className="px-3 py-2 font-medium">{chem.sampleId || `Sample ${idx + 1}`}</td>
                          <td className="px-3 py-2 text-right"><ChemValue value={chem.copper} isqg={35.7} pel={197} /></td>
                          <td className="px-3 py-2 text-right"><ChemValue value={chem.zinc} isqg={123} pel={315} /></td>
                          <td className="px-3 py-2 text-right"><ChemValue value={chem.lead} isqg={35} pel={91.3} /></td>
                          <td className="px-3 py-2 text-right"><ChemValue value={chem.totalPAHs} isqg={1684} pel={16770} /></td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{chem.toc?.toFixed(1) ?? '—'}%</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{chem.avs?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{chem.percentFines?.toFixed(0) ?? '—'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                  Values colored by CCME guidelines: <span className="text-green-600 dark:text-green-400">below ISQG</span>, <span className="text-yellow-600 dark:text-yellow-400">ISQG-PEL</span>, <span className="text-red-600 dark:text-red-400">above PEL</span>
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusIcon({ status }: { status: 'good' | 'warning' | 'exceedance' }) {
  if (status === 'exceedance') return <AlertCircle className="w-5 h-5 text-red-500" />;
  if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <CheckCircle className="w-5 h-5 text-green-500" />;
}

function ChemValue({ value, isqg, pel }: { value?: number; isqg: number; pel: number }) {
  if (value === undefined || value === null || isNaN(value)) return <span className="text-slate-400 dark:text-slate-500">—</span>;
  let colorClass = 'text-green-600 dark:text-green-400';
  if (value > pel) colorClass = 'text-red-600 dark:text-red-400 font-medium';
  else if (value > isqg) colorClass = 'text-yellow-600 dark:text-yellow-400';
  return <span className={colorClass}>{value.toFixed(1)}</span>;
}

export default SiteDataTable;
