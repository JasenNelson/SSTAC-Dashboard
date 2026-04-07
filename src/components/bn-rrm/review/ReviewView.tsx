'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { usePackStore } from '@/stores/bn-rrm/packStore';
import { GuideView } from './GuideView';
import { EvidenceView } from './EvidenceView';
import { ModelOverview } from './ModelOverview';
import { ValidationDashboard } from './ValidationDashboard';
import { DecisionsAndLimitations } from './DecisionsAndLimitations';
import { CptTransparency } from './CptTransparency';
import { DataProvenance } from './DataProvenance';
import { SiteReports } from './SiteReports';
import { RiskComparison } from './RiskComparison';

type ReviewSection = 'guide' | 'evidence' | 'overview' | 'validation' | 'decisions' | 'cpt' | 'provenance' | 'sites' | 'comparison';

const ALL_SECTIONS: { id: ReviewSection; label: string; description: string }[] = [
  { id: 'guide', label: 'Guide', description: 'Step-by-step model review' },
  { id: 'evidence', label: 'Evidence', description: 'Observed vs inferred nodes' },
  { id: 'overview', label: 'Model Overview', description: 'Architecture, metrics, training data' },
  { id: 'validation', label: 'QA/QC & Validation', description: 'LOO results, confusion matrix' },
  { id: 'decisions', label: 'Decisions & Limitations', description: 'DR records, known limitations' },
  { id: 'cpt', label: 'CPT Transparency', description: 'Per-node source, coverage, distributions' },
  { id: 'provenance', label: 'Data & Provenance', description: 'Document registry, station tracing' },
  { id: 'sites', label: 'Site Reports', description: 'Per-site chemistry, toxicity, community' },
  { id: 'comparison', label: 'Risk Comparison', description: 'BN-RRM vs report-stated WOE' },
];

// Sections hidden per scope_type when artifact data is not meaningful.
// Benchmark packs use mercury/fish-tissue endpoints -- sediment-specific
// views (evidence, site reports, risk comparison) have no applicable data.
const HIDDEN_BY_SCOPE: Partial<Record<string, Set<ReviewSection>>> = {
  benchmark: new Set<ReviewSection>(['evidence', 'sites', 'comparison']),
};

export function ReviewView() {
  const [activeSection, setActiveSection] = useState<ReviewSection>('guide');
  const packManifest = usePackStore((s) => s.packManifest);

  const hidden = HIDDEN_BY_SCOPE[packManifest?.scope_type ?? ''];
  const sections = hidden
    ? ALL_SECTIONS.filter((s) => !hidden.has(s.id))
    : ALL_SECTIONS;

  // Reset to 'guide' if active section was hidden by a pack switch
  const resolvedSection = sections.some((s) => s.id === activeSection)
    ? activeSection
    : 'guide';

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 shrink-0">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Peer Review</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Transparency data for Dr. Landis
          </p>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex flex-col px-3 py-2.5 rounded-lg text-left transition-colors',
                resolvedSection === section.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              <span className="text-sm font-medium">{section.label}</span>
              <span className="text-xs opacity-70 mt-0.5">{section.description}</span>
            </button>
          ))}
        </nav>

        {/* Dataset badge */}
        <div className="mt-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Dataset Status</div>
          <div className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium">
            {packManifest?.training_corpus?.dataset_status ?? 'Loading...'}
          </div>
          <div className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">
            {packManifest?.version_history?.created
              ? new Date(packManifest.version_history.created).toLocaleDateString('en-CA')
              : ''}{' '}
            {packManifest ? `\u00B7 ${packManifest.training_corpus?.n_stations ?? '?'} stations` : ''}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {packManifest?.display_name ?? ''}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {resolvedSection === 'guide' && <GuideView />}
          {resolvedSection === 'evidence' && <EvidenceView />}
          {resolvedSection === 'overview' && <ModelOverview />}
          {resolvedSection === 'validation' && <ValidationDashboard />}
          {resolvedSection === 'decisions' && <DecisionsAndLimitations />}
          {resolvedSection === 'cpt' && <CptTransparency />}
          {resolvedSection === 'provenance' && <DataProvenance />}
          {resolvedSection === 'sites' && <SiteReports />}
          {resolvedSection === 'comparison' && <RiskComparison />}
        </div>
      </div>
    </div>
  );
}
