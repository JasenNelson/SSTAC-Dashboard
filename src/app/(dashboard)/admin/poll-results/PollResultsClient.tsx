'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { PollResult } from './types';
import FilterSidebar from './components/FilterSidebar';
import ResultsDisplay from './components/ResultsDisplay';
import PollResultsHeader from './components/PollResultsHeader';
import PollNavigationButtons from './components/PollNavigationButtons';
import PollEmptyStates from './components/PollEmptyStates';
import { usePollExport } from './hooks/usePollExport';
import { usePollData } from './hooks/usePollData';
import { useResultsState } from './hooks/useResultsState';
import { useMatrixDataCache } from './hooks/useMatrixDataCache';
import { usePollUtilities } from './hooks/usePollUtilities';

export default function PollResultsClient() {
  const { pollResults, loading, error, matrixData, setMatrixData, fetchPollResults } = usePollData();
  const { fetchMatrixData } = useMatrixDataCache();
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
    toggleMatrixGraph,
  } = useResultsState();

  const { getPageTitle, getPollGroup, groupPollsByTheme } = usePollUtilities();

  // Fetch matrix data with caching and request deduplication (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        console.log(`🔍 MATRIX API CALL: Fetching matrix data with filter=${filterMode}`);
        const data = await fetchMatrixData(filterMode as 'all' | 'twg' | 'cew');
        console.log(`🔍 MATRIX API DATA:`, data);
        setMatrixData(data);
      } catch (error) {
        console.error('❌ MATRIX API FAILED:', error);
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode, fetchMatrixData]);

  // Filter polls based on filter mode
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
      total: filteredPolls.reduce((sum, poll) => sum + poll.total_votes, 0),
    };
  }, [filteredPolls]);

  const getFilteredPollResults = useCallback((poll: PollResult) => {
    if (poll.is_wordcloud) {
      const surveyVotes = poll.combined_survey_votes || 0;
      const cewVotes = poll.combined_cew_votes || 0;

      if (filterMode === 'twg') {
        return surveyVotes > 0 ? [{ option_index: 0, option_text: 'Survey Responses', votes: surveyVotes }] : [];
      } else if (filterMode === 'cew') {
        return cewVotes > 0 ? [{ option_index: 0, option_text: 'CEW Responses', votes: cewVotes }] : [];
      } else if (filterMode === 'all') {
        const totalVotes = surveyVotes + cewVotes;
        return totalVotes > 0 ? [{ option_index: 0, option_text: 'All Responses', votes: totalVotes }] : [];
      }
      return [];
    } else if (poll.is_ranking) {
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
      return poll.results;
    } else {
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
      return poll.results;
    }
  }, [filterMode]);

  const { exportSingleChoicePoll, exportRankingPoll, exportWordcloudPoll, exportMatrixGraph, exportAllQuestions } =
    usePollExport({
      filterMode,
      filteredPolls,
      getFilteredPollResults,
      getFilteredVoteCounts,
    });

  const navigateToNextQuestion = useCallback(
    (currentPoll: PollResult) => {
      const pollGroup = getPollGroup(currentPoll.page_path);
      const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);

      const currentIndex = groupPolls.findIndex(
        poll => poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
      );

      const nextIndex = (currentIndex + 1) % groupPolls.length;
      const nextPoll = groupPolls[nextIndex];

      if (nextPoll) {
        const nextPollKey = nextPoll.poll_id || nextPoll.ranking_poll_id || `poll-${nextPoll.page_path}-${nextPoll.poll_index}`;
        setSelectedQuestion(nextPollKey);

        if (expandedPoll) {
          setExpandedPoll(nextPollKey);
        }
      }
    },
    [filteredPolls, expandedPoll, setSelectedQuestion, setExpandedPoll, getPollGroup]
  );

  const navigateToPreviousQuestion = useCallback(
    (currentPoll: PollResult) => {
      const pollGroup = getPollGroup(currentPoll.page_path);
      const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);

      const currentIndex = groupPolls.findIndex(
        poll => poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
      );

      const prevIndex = currentIndex === 0 ? groupPolls.length - 1 : currentIndex - 1;
      const prevPoll = groupPolls[prevIndex];

      if (prevPoll) {
        const prevPollKey = prevPoll.poll_id || prevPoll.ranking_poll_id || `poll-${prevPoll.page_path}-${prevPoll.poll_index}`;
        setSelectedQuestion(prevPollKey);

        if (expandedPoll) {
          setExpandedPoll(prevPollKey);
        }
      }
    },
    [filteredPolls, expandedPoll, setSelectedQuestion, setExpandedPoll, getPollGroup]
  );

  const selectedPoll = useMemo(() => {
    if (!selectedQuestion) return undefined;
    return filteredPolls.find(poll => {
      const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}`;
      return pollKey === selectedQuestion;
    });
  }, [filteredPolls, selectedQuestion]);

  // Check for empty states
  const emptyState = (
    <PollEmptyStates
      loading={loading}
      pollResults={pollResults}
      selectedQuestion={selectedQuestion}
      selectedPoll={selectedPoll}
      onRetry={() => fetchPollResults()}
      error={error}
    />
  );

  if (loading || error || pollResults.length === 0 || !selectedQuestion || !selectedPoll) {
    return emptyState;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
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

      <PollNavigationButtons
        leftPanelVisible={leftPanelVisible}
        onShowPanel={() => setLeftPanelVisible(true)}
        onRefresh={() => {
          fetchPollResults();
          setLastRefresh(new Date());
        }}
      />

      <div className={`flex-1 overflow-y-auto ${leftPanelVisible ? 'ml-80' : 'ml-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PollResultsHeader lastRefresh={lastRefresh} />

          <ResultsDisplay
            selectedPoll={selectedPoll}
            isExpanded={expandedPoll === (selectedPoll.poll_id || selectedPoll.ranking_poll_id || `poll-${selectedPoll.page_path}-${selectedPoll.poll_index}`)}
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
        </div>
      </div>
    </div>
  );
}
