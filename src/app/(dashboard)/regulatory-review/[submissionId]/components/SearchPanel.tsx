'use client';

import React, { useState } from 'react';
import { X, Search, Database, FileText } from 'lucide-react';
import PolicySearch from './PolicySearch';
import SubmissionSearch from './SubmissionSearch';

// ============================================================================
// Types
// ============================================================================

export interface SearchPanelProps {
  submissionId?: string;
  csapId?: string;
  onClose: () => void;
}

type SearchTab = 'policy' | 'submission';

// ============================================================================
// Main Component
// ============================================================================

export default function SearchPanel({
  submissionId,
  csapId,
  onClose,
}: SearchPanelProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>('policy');

  return (
    <div className="w-[400px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Search
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'policy'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Database className="w-4 h-4" />
            Policy Database
          </button>
          <button
            onClick={() => setActiveTab('submission')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'submission'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Submission
          </button>
        </div>
      </div>

      {/* Search Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'policy' ? (
          <PolicySearch csapId={csapId} />
        ) : (
          <SubmissionSearch submissionId={submissionId} />
        )}
      </div>

      {/* Footer Hint */}
      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {activeTab === 'policy'
            ? 'Search 6,036 policies in the regulatory knowledge base'
            : 'Search evidence excerpts from the submission documents'
          }
        </p>
      </div>
    </div>
  );
}
