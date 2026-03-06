'use client';

import { useState } from 'react';
import { Plus, LayoutGrid } from 'lucide-react';
import { isLocalEngineClient } from '@/lib/feature-flags';
import ReviewWizard from './wizard/ReviewWizard';
import ActiveReviewsGrid from './ActiveReviewsGrid';
import type { DisplaySubmission } from './SubmissionCard';

// =============================================================================
// Types
// =============================================================================

export interface ReviewProjectDisplay {
  id: string;
  siteId: string;
  siteName: string | null;
  applicantName: string | null;
  applicationTypes: string[];
  selectedServices: string[];
  status: string;
  fileCount: number;
  createdAt: string;
}

// =============================================================================
// Main Component
// =============================================================================

interface LandingPageClientProps {
  submissions: DisplaySubmission[];
  projects: ReviewProjectDisplay[];
}

type TabId = 'new' | 'active';

export default function LandingPageClient({
  submissions,
  projects,
}: LandingPageClientProps) {
  const engineEnabled = isLocalEngineClient();
  const [activeTab, setActiveTab] = useState<TabId>('active');

  const allTabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'new',
      label: 'New Review',
      icon: <Plus className="h-4 w-4" />,
    },
    {
      id: 'active',
      label: 'Active Reviews',
      icon: <LayoutGrid className="h-4 w-4" />,
    },
  ];

  // Hide "New Review" tab when local engine is not available
  const tabs = engineEnabled
    ? allTabs
    : allTabs.filter((t) => t.id !== 'new');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700 mb-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-sky-600 dark:border-sky-400 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'active' && (projects.length + submissions.length) > 0 && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      isActive
                        ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-300'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {projects.length + submissions.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'new' && <ReviewWizard />}
      {activeTab === 'active' && (
        <ActiveReviewsGrid
          projects={projects}
          legacySubmissions={submissions}
        />
      )}
    </div>
  );
}
