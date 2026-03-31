'use client';

import React from 'react';
import { PollResult } from '../types';

interface FilterSidebarProps {
  filterMode: 'all' | 'twg' | 'cew';
  setFilterMode: (mode: 'all' | 'twg' | 'cew') => void;
  showPresentationControls: boolean;
  setShowPresentationControls: React.Dispatch<React.SetStateAction<boolean>>;
  filteredPolls: PollResult[];
  expandedGroup: string | null;
  setExpandedGroup: (group: string | null) => void;
  selectedQuestion: string | null;
  setSelectedQuestion: (question: string | null) => void;
  loading: boolean;
  onRefresh: () => void;
  onExportAll: () => void;
  onHidePanel: () => void;
  groupPollsByTheme: (polls: PollResult[]) => Record<string, { name: string; polls: PollResult[] }>;
  getFilteredPollResults: (poll: PollResult) => { votes: number }[];
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filterMode,
  setFilterMode,
  showPresentationControls,
  setShowPresentationControls,
  filteredPolls,
  expandedGroup,
  setExpandedGroup,
  selectedQuestion,
  setSelectedQuestion,
  loading,
  onRefresh,
  onExportAll,
  onHidePanel,
  groupPollsByTheme,
  getFilteredPollResults,
}) => {
  // Base style matches the inactive filter buttons exactly
  const inactiveBase = 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600';
  const questionBase = 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600';

  const getThemeDot = (themeId: string) => {
    switch (themeId) {
      case 'holistic-protection': return 'bg-sky-500';
      case 'tiered-framework': return 'bg-orange-500';
      case 'prioritization': return 'bg-purple-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="fixed left-0 top-0 w-80 h-screen bg-white dark:bg-slate-800 shadow-lg border-r border-slate-200 dark:border-slate-700 flex-shrink-0 overflow-y-auto z-10">
      <div className="p-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Filter Results</h2>
        
        {/* Filter Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => setFilterMode('twg')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'twg'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            SSTAC & TWG Only
          </button>
          <button
            onClick={() => setFilterMode('cew')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'cew'
                ? 'bg-green-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            CEW Only
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            All Responses
          </button>
        </div>

        {/* Display Options */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Display Options</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowPresentationControls((prev) => !prev)}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-between ${
                showPresentationControls
                  ? 'bg-sky-700 text-white hover:bg-sky-800'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              <span>{showPresentationControls ? 'Hide Presentation Controls' : 'Show Presentation Controls'}</span>
              <span className="text-sm">
                {showPresentationControls ? 'ON' : 'OFF'}
              </span>
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle the per-question export button, join instructions, and QR code display in the results view.
            </p>
          </div>
        </div>

        {/* Poll Question Groups */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Poll Groups</h3>
          <div className="space-y-2">
            {Object.entries(groupPollsByTheme(filteredPolls)).map(([themeId, theme]) => {
              if (theme.polls.length === 0) return null;
              
              const isExpanded = expandedGroup === themeId;

              return (
                <div key={themeId} className="space-y-1">
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : themeId)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${inactiveBase} flex items-center justify-between`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${getThemeDot(themeId)} flex-shrink-0`} />
                      {theme.name}
                    </span>
                    <span className="text-sm">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ml-4 space-y-1">
                      {theme.polls.map((poll) => {
                        const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}`;
                        const totalVotes = getFilteredPollResults(poll).reduce((sum, r) => sum + r.votes, 0);

                        return (
                          <button
                            key={pollKey}
                            onClick={() => setSelectedQuestion(pollKey)}
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${questionBase} flex items-center justify-between ${
                              selectedQuestion === pollKey ? 'ring-2 ring-sky-500' : ''
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${getThemeDot(themeId)} flex-shrink-0`} />
                              Question {poll.poll_index + 1}
                            </span>
                            <span className="text-xs bg-white dark:bg-slate-600 px-2 py-1 rounded-full">
                              {totalVotes} {(poll.is_ranking || poll.is_wordcloud) ? 'responses' : 'votes'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Export All Button */}
        <div className="mt-4">
          <button
            onClick={onExportAll}
            disabled={loading || filteredPolls.length === 0}
            className="w-full px-4 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            title="Export all questions to a single CSV file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export All ({filteredPolls.length} questions)
          </button>
        </div>

        {/* Refresh Button */}
        <div className="mt-4">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-full px-4 py-3 bg-sky-600 dark:bg-sky-500 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Refreshing...
              </>
            ) : (
              <>
                🔄 Refresh Results
              </>
            )}
          </button>
        </div>

        {/* Hide Panel Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onHidePanel}
            className="flex items-center justify-center w-10 h-10 bg-slate-600 dark:bg-slate-500 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
            aria-label="Hide filter panel"
            title="Hide filter panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;

