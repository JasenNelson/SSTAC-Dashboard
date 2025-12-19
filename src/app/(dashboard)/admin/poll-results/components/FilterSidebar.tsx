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
  getFilteredPollResults: (poll: PollResult) => any[];
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
  const getThemeColors = (themeId: string) => {
    switch (themeId) {
      case 'holistic-protection':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          text: 'text-gray-900 dark:text-blue-100',
          questionBg: 'bg-blue-100 dark:bg-blue-800/30',
          questionHover: 'hover:bg-blue-200 dark:hover:bg-blue-800/40'
        };
      case 'tiered-framework':
        return {
          bg: 'bg-orange-50 dark:bg-orange-600/20',
          hover: 'hover:bg-orange-100 dark:hover:bg-orange-600/30',
          text: 'text-gray-900 dark:text-orange-200',
          questionBg: 'bg-orange-100 dark:bg-orange-700/30',
          questionHover: 'hover:bg-orange-200 dark:hover:bg-orange-700/40'
        };
      case 'prioritization':
        return {
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
          text: 'text-gray-900 dark:text-purple-100',
          questionBg: 'bg-purple-100 dark:bg-purple-800/30',
          questionHover: 'hover:bg-purple-200 dark:hover:bg-purple-800/40'
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-700/20',
          hover: 'hover:bg-gray-100 dark:hover:bg-gray-700/30',
          text: 'text-gray-900 dark:text-gray-100',
          questionBg: 'bg-gray-100 dark:bg-gray-600/30',
          questionHover: 'hover:bg-gray-200 dark:hover:bg-gray-600/40'
        };
    }
  };

  return (
    <div className="fixed left-0 top-0 w-80 h-screen bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto z-10">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Filter Results</h2>
        
        {/* Filter Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => setFilterMode('twg')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'twg'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            SSTAC & TWG Only
          </button>
          <button
            onClick={() => setFilterMode('cew')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'cew'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            CEW Only
          </button>
          <button
            onClick={() => setFilterMode('all')}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
              filterMode === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Responses
          </button>
        </div>

        {/* Display Options */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Display Options</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowPresentationControls((prev) => !prev)}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-between ${
                showPresentationControls
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span>{showPresentationControls ? 'Hide Presentation Controls' : 'Show Presentation Controls'}</span>
              <span className="text-sm">
                {showPresentationControls ? 'ON' : 'OFF'}
              </span>
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Toggle the per-question export button, join instructions, and QR code display in the results view.
            </p>
          </div>
        </div>

        {/* Poll Question Groups */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Poll Groups</h3>
          <div className="space-y-2">
            {Object.entries(groupPollsByTheme(filteredPolls)).map(([themeId, theme]) => {
              if (theme.polls.length === 0) return null;
              
              const isExpanded = expandedGroup === themeId;
              const colors = getThemeColors(themeId);
              
              return (
                <div key={themeId} className="space-y-1">
                  <button
                    onClick={() => setExpandedGroup(isExpanded ? null : themeId)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${colors.bg} ${colors.text} ${colors.hover} flex items-center justify-between`}
                  >
                    <span>{theme.name}</span>
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
                            className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${colors.questionBg} ${colors.text} ${colors.questionHover} flex items-center justify-between ${
                              selectedQuestion === pollKey ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <span>Question {poll.poll_index + 1}</span>
                            <span className="text-xs bg-white dark:bg-gray-600 px-2 py-1 rounded-full">
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
            className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            className="flex items-center justify-center w-10 h-10 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors shadow-lg"
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

