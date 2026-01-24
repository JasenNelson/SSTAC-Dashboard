'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { PollResult } from './types';
import FilterSidebar from './components/FilterSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import { usePollExport } from './hooks/usePollExport';
import { usePollData } from './hooks/usePollData';
import { useResultsState } from './hooks/useResultsState';

export default function PollResultsClient() {
  // Use hooks for data fetching and UI state management
  const { pollResults, loading, error, matrixData, setMatrixData, fetchPollResults } = usePollData();
  const {
    expandedPoll,
    setExpandedPoll,
    expandedGroup,
    setExpandedGroup,
    selectedQuestion,
    setSelectedQuestion,
    filterMode,
    setFilterMode,
    leftPanelVisible,
    setLeftPanelVisible,
    qrCodeExpanded,
    setQrCodeExpanded,
    expandedPollGroup,
    setExpandedPollGroup,
    lastRefresh,
    setLastRefresh,
    showMatrixGraphs,
    showPresentationControls,
    setShowPresentationControls,
    toggleMatrixGraph
  } = useResultsState();

  // Fetch matrix data for prioritization graphs (debounced to reduce API calls)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        console.log(`🔍 MATRIX API CALL: Fetching matrix data with filter=${filterMode}`);
        const response = await fetch(`/api/graphs/prioritization-matrix?filter=${filterMode}`);
        console.log(`🔍 MATRIX API RESPONSE: Status ${response.status}`);
        if (response.ok) {
        const data = await response.json();
        console.log(`🔍 MATRIX API DATA:`, data);
        console.log(`🔍 MATRIX API DATA DETAILED:`, JSON.stringify(data, null, 2));
        setMatrixData(data);
        } else {
          console.error(`❌ MATRIX API ERROR: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error("❌ MATRIX API FAILED:", error);
      }
    }, 500); // Debounce: wait 500ms after last update before fetching

    return () => clearTimeout(timer); // Clean up timer on effect re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode]); // Only depend on filterMode, not pollResults (reduces API calls 40-60%)

  const filteredPolls = useMemo(() => {
    if (filterMode === 'all') {
      return pollResults;
    }

    return pollResults.filter(poll => {
      if (filterMode === 'twg') {
        return (poll.combined_survey_votes || 0) > 0;
      } else if (filterMode === 'cew') {
        return (poll.combined_cew_votes || 0) > 0;
      }
      return true;
    });
  }, [pollResults, filterMode]);

  const getFilteredVoteCounts = useCallback(() => {
    return {
      twg: filteredPolls.reduce((sum, poll) => sum + (poll.combined_survey_votes || 0), 0),
      cew: filteredPolls.reduce((sum, poll) => sum + (poll.combined_cew_votes || 0), 0),
      total: filteredPolls.reduce((sum, poll) => sum + poll.total_votes, 0)
    };
  }, [filteredPolls]);

  // Get filtered results for a specific poll based on filter mode
  const getFilteredPollResults = useCallback((poll: PollResult) => {
    if (poll.is_wordcloud) {
      // For wordcloud polls, create mock results based on vote counts
      const surveyVotes = poll.combined_survey_votes || 0;
      const cewVotes = poll.combined_cew_votes || 0;

      if (filterMode === 'twg') {
        return surveyVotes > 0 ? [{ option_index: 0, option_text: 'Survey Responses', votes: surveyVotes }] : [];
      } else if (filterMode === 'cew') {
        return cewVotes > 0 ? [{ option_index: 0, option_text: 'CEW Responses', votes: cewVotes }] : [];
      } else if (filterMode === 'all') {
        // For "all" filter, show combined total
        const totalVotes = surveyVotes + cewVotes;
        return totalVotes > 0 ? [{ option_index: 0, option_text: 'All Responses', votes: totalVotes }] : [];
      }
      return [];
    } else if (poll.is_ranking) {
      // For ranking polls, use the original survey or CEW results
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
      // Fallback to combined results if original data not available
      return poll.results;
    } else {
      // For single-choice polls, use the actual separate results
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
      // For "all" filter, return combined results
      return poll.results;
    }
  }, [filterMode]);

  // Use export hook for CSV export functionality
  const {
    exportSingleChoicePoll,
    exportRankingPoll,
    exportWordcloudPoll,
    exportMatrixGraph,
    exportAllQuestions
  } = usePollExport({
    filterMode,
    filteredPolls,
    getFilteredPollResults,
    getFilteredVoteCounts
  });

  const navigateToNextQuestion = useCallback((currentPoll: PollResult) => {
    // Get all polls in the same group
    const pollGroup = getPollGroup(currentPoll.page_path);
    const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);

    // Find current poll index
    const currentIndex = groupPolls.findIndex(poll =>
      poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
    );

    // Navigate to next poll (wrap around to first if at end)
    const nextIndex = (currentIndex + 1) % groupPolls.length;
    const nextPoll = groupPolls[nextIndex];

    if (nextPoll) {
      const nextPollKey = nextPoll.poll_id || nextPoll.ranking_poll_id || `poll-${nextPoll.page_path}-${nextPoll.poll_index}`;
      setSelectedQuestion(nextPollKey);

      // If currently expanded, keep the new question expanded
      if (expandedPoll) {
        setExpandedPoll(nextPollKey);
      }
    }
  }, [filteredPolls, expandedPoll, setSelectedQuestion, setExpandedPoll]);

  const navigateToPreviousQuestion = useCallback((currentPoll: PollResult) => {
    // Get all polls in the same group
    const pollGroup = getPollGroup(currentPoll.page_path);
    const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);

    // Find current poll index
    const currentIndex = groupPolls.findIndex(poll =>
      poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
    );

    // Navigate to previous poll (wrap around to last if at beginning)
    const prevIndex = currentIndex === 0 ? groupPolls.length - 1 : currentIndex - 1;
    const prevPoll = groupPolls[prevIndex];

    if (prevPoll) {
      const prevPollKey = prevPoll.poll_id || prevPoll.ranking_poll_id || `poll-${prevPoll.page_path}-${prevPoll.poll_index}`;
      setSelectedQuestion(prevPollKey);

      // If currently expanded, keep the new question expanded
      if (expandedPoll) {
        setExpandedPoll(prevPollKey);
      }
    }
  }, [filteredPolls, expandedPoll, setSelectedQuestion, setExpandedPoll]);

  const getPageTitle = useCallback((pagePath: string) => {
    const pathMap: { [key: string]: string } = {
      '/survey-results/holistic-protection': 'Holistic Protection',
      '/survey-results/tiered-framework': 'Tiered Framework',
      '/survey-results/prioritization': 'Prioritization Framework',
      '/survey-results/effectiveness': 'Effectiveness of Current Standards',
      '/survey-results/technical-standards': 'Technical Standards',
      '/survey-results/detailed-findings': 'Detailed Findings',
      '/cew-polls/holistic-protection': 'Holistic Protection', // Same as survey-results
      '/cew-polls/tiered-framework': 'Tiered Framework', // Same as survey-results
      '/cew-polls/prioritization': 'Prioritization Framework', // Same as survey-results
    };
    return pathMap[pagePath] || pagePath;
  }, []);

  const getPollGroup = useCallback((pagePath: string): 'holistic-protection' | 'tiered-framework' | 'prioritization' | null => {
    if (pagePath.includes('holistic-protection')) return 'holistic-protection';
    if (pagePath.includes('tiered-framework')) return 'tiered-framework';
    if (pagePath.includes('prioritization')) return 'prioritization';
    return null;
  }, []);

  const groupPollsByTheme = useCallback((polls: PollResult[]) => {
    const themes = {
      'holistic-protection': {
        name: 'Holistic Protection',
        polls: polls.filter(poll =>
          poll.page_path.includes('holistic-protection')
        ).sort((a, b) => a.poll_index - b.poll_index)
      },
      'tiered-framework': {
        name: 'Tiered Framework',
        polls: polls.filter(poll =>
          poll.page_path.includes('tiered-framework')
        ).sort((a, b) => a.poll_index - b.poll_index)
      },
      'prioritization': {
        name: 'Prioritization',
        polls: polls.filter(poll =>
          poll.page_path.includes('prioritization')
        ).sort((a, b) => a.poll_index - b.poll_index),
        showGraphs: true
      }
    };
    return themes;
  }, []);

  // Memoize selectedPoll lookup to avoid O(n) search on every render
  const selectedPoll = useMemo(() => {
    if (!selectedQuestion) return undefined;
    return filteredPolls.find(poll => {
      const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}`;
      return pollKey === selectedQuestion;
    });
  }, [filteredPolls, selectedQuestion]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading poll results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchPollResults()}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Fixed Left Panel */}
      {leftPanelVisible && (
        <FilterSidebar
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          showPresentationControls={showPresentationControls}
          setShowPresentationControls={setShowPresentationControls}
          filteredPolls={filteredPolls}
          expandedGroup={expandedGroup}
          setExpandedGroup={setExpandedGroup}
          selectedQuestion={selectedQuestion}
          setSelectedQuestion={setSelectedQuestion}
          loading={loading}
          onRefresh={() => {
            fetchPollResults();
            setLastRefresh(new Date());
          }}
          onExportAll={exportAllQuestions}
          onHidePanel={() => setLeftPanelVisible(false)}
          groupPollsByTheme={groupPollsByTheme}
          getFilteredPollResults={getFilteredPollResults}
        />
      )}

      {/* Show Panel Button - appears when panel is hidden */}
      {!leftPanelVisible && (
        <div className="fixed left-4 top-20 z-50">
          <button
            onClick={() => setLeftPanelVisible(true)}
            className="flex items-center justify-center w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
            title="Show filter panel"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Refresh Results Button - appears when panel is hidden */}
      {!leftPanelVisible && (
        <div className="fixed left-4 top-32 z-50">
          <button
            onClick={() => {
              fetchPollResults();
              setLastRefresh(new Date());
            }}
            className="flex items-center justify-center w-12 h-12 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
            title="Refresh results"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto ${leftPanelVisible ? 'ml-80' : 'ml-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Live Poll Results Dashboard</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
            </div>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">Combined results from TWG & SSTAC members (via dashboard) and CEW conference attendees (live event)</p>
        </div>

        {pollResults.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Poll Results Yet</h3>
            <p className="text-gray-500 dark:text-gray-500">Poll results will appear here once users start voting.</p>
          </div>
        ) : !selectedQuestion ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Select a Question</h3>
            <p className="text-gray-500 dark:text-gray-500">Choose a question from the left panel to view its results.</p>
          </div>
        ) : !selectedPoll ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Question Not Found</h3>
            <p className="text-gray-500 dark:text-gray-500">The selected question could not be found.</p>
          </div>
        ) : (
          <div>
            {(() => {
              const isExpanded = expandedPoll === (selectedPoll.poll_id || selectedPoll.ranking_poll_id || `poll-${selectedPoll.page_path}-${selectedPoll.poll_index}`);

              return (
                <ResultsDisplay
                  selectedPoll={selectedPoll}
                  isExpanded={isExpanded}
                  expandedPoll={expandedPoll}
                  setExpandedPoll={setExpandedPoll}
                  filterMode={filterMode}
                  showPresentationControls={showPresentationControls}
                  matrixData={matrixData}
                  showMatrixGraphs={showMatrixGraphs}
                  toggleMatrixGraph={toggleMatrixGraph}
                  filteredPolls={filteredPolls}
                  leftPanelVisible={leftPanelVisible}
                  qrCodeExpanded={qrCodeExpanded}
                  expandedPollGroup={expandedPollGroup}
                  setQrCodeExpanded={setQrCodeExpanded}
                  setExpandedPollGroup={setExpandedPollGroup}
                  getFilteredPollResults={getFilteredPollResults}
                  navigateToNextQuestion={navigateToNextQuestion}
                  navigateToPreviousQuestion={navigateToPreviousQuestion}
                  exportSingleChoicePoll={exportSingleChoicePoll}
                  exportRankingPoll={exportRankingPoll}
                  exportWordcloudPoll={exportWordcloudPoll}
                  exportMatrixGraph={exportMatrixGraph}
                  getPageTitle={getPageTitle}
                  getPollGroup={getPollGroup}
                />
              );
            })()}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
