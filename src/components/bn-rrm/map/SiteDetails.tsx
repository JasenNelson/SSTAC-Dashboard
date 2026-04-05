/**
 * SiteDetails Component
 *
 * Side panel showing details of selected site on the map.
 * Supports multi-select for batch assessment and multi-site report export.
 */

'use client';

import { cn } from '@/utils/cn';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import {
  MapPin,
  Beaker,
  Activity,
  AlertTriangle,
  CheckCircle,
  X,
  Play,
  FileText,
  Info,
} from 'lucide-react';

interface SiteDetailsProps {
  className?: string;
  onClose?: () => void;
  onRunAssessment?: (siteId: string) => void;
  onRunBatchAssessment?: (siteIds: string[]) => void;
}

export function SiteDetails({ className, onClose, onRunAssessment, onRunBatchAssessment }: SiteDetailsProps) {
  const selectedSiteId = useSiteDataStore((state) => state.selectedSiteId);
  const selectedSiteIds = useSiteDataStore((state) => state.selectedSiteIds);
  const sites = useSiteDataStore((state) => state.sites);
  const assessments = useSiteDataStore((state) => state.assessments);
  const selectSite = useSiteDataStore((state) => state.selectSite);
  const batchProgress = useSiteDataStore((state) => state.batchAssessmentProgress);

  const site = selectedSiteId ? sites[selectedSiteId] : undefined;
  const assessment = selectedSiteId ? assessments[selectedSiteId] : undefined;
  const multiCount = selectedSiteIds.length;
  const isMultiSelect = multiCount > 1;

  if (!site) {
    return (
      <div className={cn('bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-6', className)}>
        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
          <MapPin className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">No site selected</p>
          <p className="text-xs mt-1">Click a marker on the map</p>
        </div>
      </div>
    );
  }

  const { location, sedimentChemistry } = site;

  const avgCopper = sedimentChemistry.reduce((sum, c) => sum + (c.copper || 0), 0) / sedimentChemistry.length;
  const avgZinc = sedimentChemistry.reduce((sum, c) => sum + (c.zinc || 0), 0) / sedimentChemistry.length;
  const maxCopper = Math.max(...sedimentChemistry.map((c) => c.copper || 0));
  const maxZinc = Math.max(...sedimentChemistry.map((c) => c.zinc || 0));

  // Determine batch assessment button label
  const allHaveAssessments = isMultiSelect && selectedSiteIds.every(id => assessments[id]);
  const batchButtonLabel = isMultiSelect
    ? `${allHaveAssessments ? 'Re-run' : 'Run'} Assessment (${multiCount} sites)`
    : `${assessment ? 'Re-run' : 'Run'} Assessment`;

  // Multi-site report export
  const handleReportExport = () => {
    if (isMultiSelect) {
      const selectedSites = selectedSiteIds
        .map(id => ({ site: sites[id], assessment: assessments[id] ?? null }))
        .filter(s => s.site);
      const data = {
        exportDate: new Date().toISOString(),
        siteCount: selectedSites.length,
        sites: selectedSites,
      };
      downloadJson(data, `bn-rrm-multi-site-${new Date().toISOString().split('T')[0]}.json`);
    } else {
      const data = { exportDate: new Date().toISOString(), site, assessment: assessment ?? null };
      downloadJson(data, `bn-rrm-site-${location.id}-${new Date().toISOString().split('T')[0]}.json`);
    }
  };

  // Assessment handler — single or batch
  const handleAssessment = () => {
    if (isMultiSelect && onRunBatchAssessment) {
      onRunBatchAssessment(selectedSiteIds);
    } else if (onRunAssessment) {
      onRunAssessment(location.id);
    }
  };

  const isReferenceData = location.sourceTag === 'training' || location.sourceTag === 'comparison';

  return (
    <div className={cn('bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col', className)}>
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">{location.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{location.region || 'No region'}</p>
            {isMultiSelect && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{multiCount} sites selected</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={() => { selectSite(null); onClose(); }}
              className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close site details"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {isReferenceData && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-xs text-amber-700 dark:text-amber-400">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Reference data — site-level mean chemistry
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Section title="Location" icon={MapPin}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Coordinates</p>
              <p className="font-medium">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Type</p>
              <p className="font-medium capitalize">{location.siteType}</p>
            </div>
            {location.waterbody && (
              <div className="col-span-2">
                <p className="text-slate-500 dark:text-slate-400">Waterbody</p>
                <p className="font-medium">{location.waterbody}</p>
              </div>
            )}
          </div>
        </Section>

        <Section title="Chemistry Summary" icon={Beaker}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Samples</span>
              <span className="font-medium">{sedimentChemistry.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Collection Date</span>
              <span className="font-medium">{location.dateCollected}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Contaminant Levels (mg/kg)</p>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Copper (avg)" value={avgCopper.toFixed(1)} status={avgCopper > 197 ? 'error' : avgCopper > 35.7 ? 'warning' : 'good'} />
                <StatBox label="Copper (max)" value={maxCopper.toFixed(1)} status={maxCopper > 197 ? 'error' : maxCopper > 35.7 ? 'warning' : 'good'} />
                <StatBox label="Zinc (avg)" value={avgZinc.toFixed(1)} status={avgZinc > 315 ? 'error' : avgZinc > 123 ? 'warning' : 'good'} />
                <StatBox label="Zinc (max)" value={maxZinc.toFixed(1)} status={maxZinc > 315 ? 'error' : maxZinc > 123 ? 'warning' : 'good'} />
              </div>
            </div>
          </div>
        </Section>

        <Section title="Risk Assessment" icon={Activity}>
          {assessment ? (
            <div className="space-y-3">
              <div className={cn('p-3 rounded-lg border-2',
                assessment.mostLikelyImpact === 'none' && 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
                assessment.mostLikelyImpact === 'minor' && 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
                assessment.mostLikelyImpact === 'moderate' && 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700',
                assessment.mostLikelyImpact === 'severe' && 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
              )}>
                <div className="flex items-center gap-2">
                  {assessment.mostLikelyImpact === 'none' || assessment.mostLikelyImpact === 'minor' ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  )}
                  <div>
                    <p className="font-semibold capitalize">{assessment.mostLikelyImpact} Impact</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{(assessment.impactProbabilities[assessment.mostLikelyImpact] * 100).toFixed(0)}% probability</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Impact Probabilities</p>
                <div className="space-y-1">
                  {Object.entries(assessment.impactProbabilities).map(([impact, prob]) => (
                    <div key={impact} className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full',
                          impact === 'none' && 'bg-green-500',
                          impact === 'minor' && 'bg-yellow-500',
                          impact === 'moderate' && 'bg-orange-500',
                          impact === 'severe' && 'bg-red-500'
                        )} style={{ width: `${prob * 100}%` }} />
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400 w-12 text-right">{(prob * 100).toFixed(0)}%</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 w-16 capitalize">{impact}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <AlertTriangle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Not yet assessed</p>
              {onRunAssessment && !isMultiSelect && (
                <button onClick={() => onRunAssessment(location.id)} className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors mx-auto">
                  <Play className="w-4 h-4" />Run Assessment
                </button>
              )}
            </div>
          )}
        </Section>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        {batchProgress && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
            Assessing {batchProgress.current}/{batchProgress.total}...
          </p>
        )}
        <div className="flex gap-2">
          {(onRunAssessment || onRunBatchAssessment) && (
            <button
              onClick={handleAssessment}
              disabled={!!batchProgress}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors',
                batchProgress
                  ? 'bg-blue-300 dark:bg-blue-800 text-white cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600',
              )}
            >
              <Play className="w-4 h-4" />{batchButtonLabel}
            </button>
          )}
          <button
            onClick={handleReportExport}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            {isMultiSelect ? `Report (${multiCount})` : 'Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, status }: { label: string; value: string; status: 'good' | 'warning' | 'error' }) {
  return (
    <div className={cn('p-2 rounded-lg text-center',
      status === 'good' && 'bg-green-50 dark:bg-green-900/20',
      status === 'warning' && 'bg-yellow-50 dark:bg-yellow-900/20',
      status === 'error' && 'bg-red-50 dark:bg-red-900/20'
    )}>
      <p className={cn('text-lg font-bold',
        status === 'good' && 'text-green-700 dark:text-green-300',
        status === 'warning' && 'text-yellow-700 dark:text-yellow-300',
        status === 'error' && 'text-red-700 dark:text-red-300'
      )}>{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

export default SiteDetails;
