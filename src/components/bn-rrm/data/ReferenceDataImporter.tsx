/**
 * ReferenceDataImporter Component
 *
 * Imports training and comparison site data from the BN-RRM transparency
 * files into the siteDataStore for map display and assessment.
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import {
  adaptTrainingSites,
  adaptComparisonSites,
} from '@/lib/bn-rrm/transparency-adapters';
import type {
  SiteReportsJSON,
  RiskComparisonJSON,
  ImportResult,
} from '@/lib/bn-rrm/transparency-adapters';
import {
  Database,
  GitCompareArrows,
  AlertTriangle,
  Download,
  Trash2,
  CheckCircle,
} from 'lucide-react';

import siteReportsData from '@/data/bn-rrm/transparency/site_reports.json';
import riskComparisonData from '@/data/bn-rrm/transparency/risk_comparison.json';

const siteReports = siteReportsData as unknown as SiteReportsJSON;
const riskComparison = riskComparisonData as unknown as RiskComparisonJSON;

export function ReferenceDataImporter() {
  const { sites, addSites, clearSitesByTag } = useSiteDataStore();

  const [trainingResult, setTrainingResult] = useState<ImportResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ImportResult | null>(null);

  // Count currently loaded reference sites
  const loadedCounts = useMemo(() => {
    const allSites = Object.values(sites);
    return {
      training: allSites.filter(s => s.location.sourceTag === 'training').length,
      comparison: allSites.filter(s => s.location.sourceTag === 'comparison').length,
    };
  }, [sites]);

  const handleImportTraining = useCallback(() => {
    const result = adaptTrainingSites(siteReports);
    addSites(result.sites);
    setTrainingResult(result);
  }, [addSites]);

  const handleImportComparison = useCallback(() => {
    const result = adaptComparisonSites(riskComparison, siteReports);
    addSites(result.sites);
    setComparisonResult(result);
  }, [addSites]);

  const handleRemoveTraining = useCallback(() => {
    clearSitesByTag('training');
    setTrainingResult(null);
  }, [clearSitesByTag]);

  const handleRemoveComparison = useCallback(() => {
    clearSitesByTag('comparison');
    setComparisonResult(null);
  }, [clearSitesByTag]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        Reference Data
      </h3>

      {/* Disclaimer */}
      <div className="flex gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          These stations represent a small subset of the BN-RRM dataset where co-located
          chemistry, toxicity, and/or community data were available. Chemistry values are
          site-level means, not station-specific measurements. Sites without station coordinates
          are shown at approximate site centroids.
        </p>
      </div>

      {/* Import cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Training Sites */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Training Sites
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            8 sites, ~44 map points. Data used to train the BN-RRM causal model.
          </p>
          {loadedCounts.training > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {loadedCounts.training} entries loaded
              </div>
              <button
                onClick={handleRemoveTraining}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={handleImportTraining}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Import Training Sites
            </button>
          )}
        </div>

        {/* Comparison Sites */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitCompareArrows className="w-4 h-4 text-teal-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Comparison Sites
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            5 sites, ~13 map points. WOE vs BN-RRM external validation.
          </p>
          {loadedCounts.comparison > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                <CheckCircle className="w-3.5 h-3.5" />
                {loadedCounts.comparison} entries loaded
              </div>
              <button
                onClick={handleRemoveComparison}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={handleImportComparison}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 rounded hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Import Comparison Sites
            </button>
          )}
        </div>
      </div>

      {/* Import result messages */}
      {trainingResult && loadedCounts.training > 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Imported {trainingResult.imported} training points ({trainingResult.stationCount} stations
          + {trainingResult.centroidCount} site centroids).
          {trainingResult.skippedNoCoords > 0 && (
            <> {trainingResult.skippedNoCoords} stations had no coordinates.</>
          )}
        </p>
      )}
      {comparisonResult && loadedCounts.comparison > 0 && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Imported {comparisonResult.imported} comparison points ({comparisonResult.stationCount} stations
          + {comparisonResult.centroidCount} site centroids).
        </p>
      )}
    </div>
  );
}

export default ReferenceDataImporter;
