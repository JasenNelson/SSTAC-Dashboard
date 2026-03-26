'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { TrainingSites } from './TrainingSites';
import { ExternalSites } from './ExternalSites';
import { MethodComparison } from './MethodComparison';

type CaseStudySection = 'training' | 'external' | 'methods';

const sections: { id: CaseStudySection; label: string; description: string }[] = [
  { id: 'training', label: 'Training Sites', description: 'BN-RRM vs WOE for 8 training sites' },
  { id: 'external', label: 'External Sites', description: 'Non-training site comparisons' },
  { id: 'methods', label: 'Method Comparison', description: 'BN-RRM vs WOE, SQT, SQG approaches' },
];

export function CaseStudiesView() {
  const [activeSection, setActiveSection] = useState<CaseStudySection>('training');

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 shrink-0">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Case Studies</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Descriptive comparison with report-stated risk assessments
          </p>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex flex-col px-3 py-2.5 rounded-lg text-left transition-colors',
                activeSection === section.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              <span className="text-sm font-medium">{section.label}</span>
              <span className="text-xs opacity-70 mt-0.5">{section.description}</span>
            </button>
          ))}
        </nav>

        {/* Boundary note */}
        <div className="mt-6 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Comparison Scope</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Report-stated classifications are external reference labels,
            not BN training targets or ground truth.
          </p>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {activeSection === 'training' && <TrainingSites />}
          {activeSection === 'external' && <ExternalSites />}
          {activeSection === 'methods' && <MethodComparison />}
        </div>
      </div>
    </div>
  );
}
