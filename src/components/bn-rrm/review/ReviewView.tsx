'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { ModelOverview } from './ModelOverview';
import { ValidationDashboard } from './ValidationDashboard';
import { DecisionsAndLimitations } from './DecisionsAndLimitations';

type ReviewSection = 'overview' | 'validation' | 'decisions';

const sections: { id: ReviewSection; label: string; description: string }[] = [
  { id: 'overview', label: 'Model Overview', description: 'Architecture, metrics, training data' },
  { id: 'validation', label: 'QA/QC & Validation', description: 'LOO results, confusion matrix' },
  { id: 'decisions', label: 'Decisions & Limitations', description: 'DR records, known limitations' },
];

export function ReviewView() {
  const [activeSection, setActiveSection] = useState<ReviewSection>('overview');

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 shrink-0">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Peer Review</h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Transparency data for Dr. Landis
          </p>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex flex-col px-3 py-2 rounded-lg text-left transition-colors',
                activeSection === section.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              <span className="text-sm font-medium">{section.label}</span>
              <span className="text-[10px] opacity-70">{section.description}</span>
            </button>
          ))}
        </nav>

        {/* Dataset badge */}
        <div className="mt-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Dataset Status</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            FROZEN (DR-003)
          </div>
          <div className="text-[10px] text-amber-500 dark:text-amber-500 mt-0.5">
            2026-03-09 &middot; 82 stations
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {activeSection === 'overview' && <ModelOverview />}
          {activeSection === 'validation' && <ValidationDashboard />}
          {activeSection === 'decisions' && <DecisionsAndLimitations />}
        </div>
      </div>
    </div>
  );
}
