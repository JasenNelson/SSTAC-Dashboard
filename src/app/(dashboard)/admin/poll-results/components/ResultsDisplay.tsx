'use client';

import React from 'react';
import { PollResult, MatrixData } from '../types';
import QRCodeDisplay from '@/components/dashboard/QRCodeDisplay';
import QRCodeModal from './QRCodeModal';
import CustomWordCloud from '@/components/dashboard/CustomWordCloud';
import MatrixGraphRenderer from './MatrixGraphRenderer';

interface ResultsDisplayProps {
  selectedPoll: PollResult;
  isExpanded: boolean;
  expandedPoll: string | null;
  setExpandedPoll: (key: string | null) => void;
  filterMode: 'all' | 'twg' | 'cew';
  showPresentationControls: boolean;
  matrixData: MatrixData[];
  showMatrixGraphs: { [key: string]: boolean };
  toggleMatrixGraph: (questionPairKey: string) => void;
  filteredPolls: PollResult[];
  leftPanelVisible: boolean;
  qrCodeExpanded: boolean;
  expandedPollGroup: string | null;
  setQrCodeExpanded: (expanded: boolean) => void;
  setExpandedPollGroup: (group: string | null) => void;
  getFilteredPollResults: (poll: PollResult) => Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  navigateToNextQuestion: (poll: PollResult) => void;
  navigateToPreviousQuestion: (poll: PollResult) => void;
  exportSingleChoicePoll: (poll: PollResult) => void;
  exportRankingPoll: (poll: PollResult) => void;
  exportWordcloudPoll: (poll: PollResult) => void;
  exportMatrixGraph: (graph: MatrixData, q1Text: string, q2Text: string, title: string) => void;
  getPageTitle: (pagePath: string) => string;
  getPollGroup: (pagePath: string) => 'holistic-protection' | 'tiered-framework' | 'prioritization' | null;
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WordCloud Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

const getPercentage = (votes: number, totalVotes: number) => {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 100);
};

export default function ResultsDisplay({
  selectedPoll,
  isExpanded,
  setExpandedPoll,
  filterMode,
  showPresentationControls,
  matrixData,
  showMatrixGraphs,
  toggleMatrixGraph,
  filteredPolls,
  leftPanelVisible,
  qrCodeExpanded,
  expandedPollGroup,
  setQrCodeExpanded,
  setExpandedPollGroup,
  getFilteredPollResults,
  navigateToNextQuestion,
  navigateToPreviousQuestion,
  exportSingleChoicePoll,
  exportRankingPoll,
  exportWordcloudPoll,
  exportMatrixGraph,
  getPageTitle,
  getPollGroup,
}: ResultsDisplayProps) {
  const pollKey = selectedPoll.poll_id || selectedPoll.ranking_poll_id || `poll-${selectedPoll.page_path}-${selectedPoll.poll_index}`;

  return (
    <>
      <div
        key={pollKey}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isExpanded
            ? `fixed top-20 right-4 bottom-4 ${leftPanelVisible ? 'left-80' : 'left-20'} z-[60] flex flex-col`
            : 'p-8'
        }`}
      >
        <div className={isExpanded ? 'p-8 flex-1 flex flex-col' : ''}>
          <div className={`${isExpanded ? 'mb-3' : 'mb-4'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`flex-1 mr-4 ${isExpanded ? 'max-w-4xl' : 'max-w-3xl'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <h3
                    className={`font-bold text-gray-800 dark:text-white ${
                      isExpanded ? 'text-3xl' : 'text-2xl'
                    }`}
                  >
                    {getPageTitle(selectedPoll.page_path)} - Question {selectedPoll.poll_index + 1}
                  </h3>
                  <button
                    onClick={() => navigateToPreviousQuestion(selectedPoll)}
                    className={`flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
                      isExpanded ? 'w-8 h-8' : 'w-6 h-6'
                    }`}
                    title="Previous question in group"
                  >
                    <svg
                      className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${
                        isExpanded ? 'w-5 h-5' : 'w-4 h-4'
                      }`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigateToNextQuestion(selectedPoll)}
                    className={`flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${
                      isExpanded ? 'w-8 h-8' : 'w-6 h-6'
                    }`}
                    title="Next question in group"
                  >
                    <svg
                      className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${
                        isExpanded ? 'w-5 h-5' : 'w-4 h-4'
                      }`}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => setExpandedPoll(isExpanded ? null : pollKey)}
                    className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title={isExpanded ? 'Close expanded view' : 'Expand to fit screen'}
                  >
                    {isExpanded ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                <p
                  className={`text-gray-700 dark:text-gray-300 leading-relaxed ${
                    isExpanded ? 'text-xl mb-3' : 'text-lg'
                  }`}
                >
                  {selectedPoll.question}
                </p>
              </div>

              {/* Export Buttons */}
              {showPresentationControls && (
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => {
                      if (selectedPoll.is_wordcloud) {
                        exportWordcloudPoll(selectedPoll);
                      } else if (selectedPoll.is_ranking) {
                        exportRankingPoll(selectedPoll);
                      } else {
                        exportSingleChoicePoll(selectedPoll);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200"
                    title="Export this question to CSV"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export CSV
                  </button>
                </div>
              )}

              {/* QR Code and Join at containers - positioned on the right */}
              {showPresentationControls && (
                <div
                  className={`flex items-start flex-shrink-0 ${
                    isExpanded ? 'space-x-3 -ml-8 mt-2' : 'space-x-3'
                  }`}
                >
                  {(() => {
                    const pollGroup = getPollGroup(selectedPoll.page_path);
                    if (!pollGroup) return null;

                    const getWebAddress = (group: string) => {
                      switch (group) {
                        case 'holistic-protection':
                          return 'bit.ly/SABCS-Holistic';
                        case 'tiered-framework':
                          return 'bit.ly/SABCS-Tiered';
                        case 'prioritization':
                          return 'bit.ly/SABCS-Prio';
                        default:
                          return null;
                      }
                    };

                    const webAddress = getWebAddress(pollGroup);

                    return (
                      <div className={`flex items-start ${isExpanded ? 'space-x-26' : 'space-x-3'}`}>
                        {/* Web Address and Password */}
                        {webAddress && (
                          <div
                            className={`flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 ${
                              isExpanded ? 'p-5 transform scale-[1.45]' : 'p-3'
                            }`}
                            onClick={() => {
                              setExpandedPollGroup(pollGroup);
                              setQrCodeExpanded(!qrCodeExpanded);
                            }}
                            title="Click to expand for conference display"
                          >
                            {/* Join at section */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`font-bold text-blue-700 dark:text-white ${
                                  isExpanded ? 'text-base' : 'text-sm'
                                }`}
                                style={{ color: '#1d4ed8' }}
                              >
                                Join at:
                              </div>
                              <div
                                className={`font-bold text-blue-700 dark:text-white ${
                                  isExpanded ? 'text-xl' : 'text-lg'
                                }`}
                                style={{ color: '#1d4ed8' }}
                              >
                                {webAddress}
                              </div>
                            </div>
                            {/* Spacing */}
                            <div className="h-2"></div>
                            {/* Password section */}
                            <div className="flex flex-col items-center">
                              <div
                                className={`font-bold text-blue-700 dark:text-white ${
                                  isExpanded ? 'text-base' : 'text-sm'
                                }`}
                                style={{ color: '#1d4ed8' }}
                              >
                                Password:
                              </div>
                              <div
                                className={`font-bold text-blue-700 dark:text-white ${
                                  isExpanded ? 'text-xl' : 'text-lg'
                                }`}
                                style={{ color: '#1d4ed8' }}
                              >
                                CEW2025
                              </div>
                            </div>
                          </div>
                        )}
                        {/* QR Code */}
                        <div
                          className={`cursor-pointer hover:opacity-80 transition-opacity duration-200 ${
                            isExpanded ? 'transform scale-[1.45] ml-8' : ''
                          }`}
                          onClick={() => {
                            setExpandedPollGroup(pollGroup);
                            setQrCodeExpanded(!qrCodeExpanded);
                          }}
                          title="Click to expand for conference display"
                        >
                          <QRCodeDisplay pollGroup={pollGroup} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Combined vote breakdown */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {filterMode === 'all' && (
              <>
                <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                  TWG/SSTAC: {selectedPoll.combined_survey_votes || 0} responses
                </div>
                <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                  CEW: {selectedPoll.combined_cew_votes || 0} responses
                </div>
              </>
            )}
            {filterMode === 'twg' && (
              <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                TWG/SSTAC: {selectedPoll.combined_survey_votes || 0} responses
              </div>
            )}
            {filterMode === 'cew' && (
              <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                CEW: {selectedPoll.combined_cew_votes || 0} responses
              </div>
            )}
          </div>
        </div>

        <div className={`space-y-2 ${isExpanded ? 'space-y-2 flex-1 px-4' : ''}`}>
          {selectedPoll.is_wordcloud ? (
            // For wordcloud polls, display word cloud visualization
            <div className="space-y-6">
              {/* Word Cloud Visualization */}
              {selectedPoll.wordcloud_words && selectedPoll.wordcloud_words.length > 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner">
                  <div className="mb-4 flex justify-between items-center">
                    <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                      Word Cloud ({selectedPoll.total_votes} response
                      {selectedPoll.total_votes !== 1 ? 's' : ''})
                    </h4>
                  </div>
                  <div style={{ height: '400px', width: '100%' }}>
                    {selectedPoll.wordcloud_words.every(
                      (word) =>
                        word &&
                        typeof word === 'object' &&
                        word.text &&
                        typeof word.text === 'string' &&
                        word.text.trim().length > 0 &&
                        typeof word.value === 'number' &&
                        word.value > 0
                    ) ? (
                      <ErrorBoundary
                        fallback={
                          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <div className="text-center">
                              <div className="text-4xl mb-2">⚠️</div>
                              <p>Error displaying wordcloud</p>
                              <p className="text-sm">Please refresh the page</p>
                            </div>
                          </div>
                        }
                      >
                        <CustomWordCloud
                          words={selectedPoll.wordcloud_words}
                          colors={['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']}
                          fontFamily="Inter, system-ui, sans-serif"
                          fontWeight="normal"
                          minSize={12}
                          maxSize={60}
                        />
                      </ErrorBoundary>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">☁️</div>
                          <p>No valid words to display</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">☁️</div>
                  <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    No Words Yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-500">
                    Word cloud will appear here once users start submitting words.
                  </p>
                </div>
              )}

              {/* Word Frequency Table */}
              {selectedPoll.wordcloud_words && selectedPoll.wordcloud_words.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                  <h5 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Word Frequency
                  </h5>
                  <div className="max-h-64 overflow-y-auto">
                    {selectedPoll.wordcloud_words.map((word, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{word.text}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 dark:bg-gray-300 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(
                                  (word.value /
                                    Math.max(
                                      ...(selectedPoll.wordcloud_words || []).map((w) => w.value)
                                    )) *
                                    100,
                                  100
                                )}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 min-w-[2rem] text-right">
                            {word.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : selectedPoll.is_ranking ? (
            // For ranking polls, sort by average rank (lower is better)
            (() => {
              const filteredResults = getFilteredPollResults(selectedPoll);
              let sortedResults = [...filteredResults].sort(
                (a, b) => (a.averageRank || 0) - (b.averageRank || 0)
              );

              // For prioritization questions, ensure all 5 options are shown in order
              if (selectedPoll.page_path.includes('prioritization')) {
                // Create a complete set of all 5 options (0-4) with default values for missing ones
                const completeResults = [];
                const resultsMap = new Map(filteredResults.map((r) => [r.option_index, r]));

                // Debug: Log the options array to see what we have
                console.log('🔍 Prioritization ranking poll options:', {
                  pollIndex: selectedPoll.poll_index,
                  options: selectedPoll.options,
                  optionsType: typeof selectedPoll.options,
                  optionsLength: selectedPoll.options?.length,
                  isArray: Array.isArray(selectedPoll.options),
                  stringified: JSON.stringify(selectedPoll.options),
                });

                // For prioritization questions 3 and 4, only create 4 options (0-3), for others create 5
                const maxOptions =
                  selectedPoll.poll_index === 2 || selectedPoll.poll_index === 3 ? 4 : 5; // poll_index 2 = question 3, poll_index 3 = question 4
                for (let i = 0; i < maxOptions; i++) {
                  if (resultsMap.has(i)) {
                    completeResults.push(resultsMap.get(i)!);
                  } else {
                    // Create a placeholder result for missing options
                    // Try to get option text from the options array, with better fallback
                    let optionText = `Option ${i + 1}`;

                    // Try to parse options if they're stored as JSON string
                    let optionsArray = selectedPoll.options;
                    if (typeof selectedPoll.options === 'string') {
                      try {
                        optionsArray = JSON.parse(selectedPoll.options);
                      } catch (e) {
                        console.warn('Failed to parse options JSON:', e);
                      }
                    }

                    if (optionsArray && Array.isArray(optionsArray) && optionsArray[i]) {
                      optionText = optionsArray[i];
                    } else if (optionsArray && typeof optionsArray === 'object' && optionsArray[i]) {
                      optionText = optionsArray[i];
                    }

                    completeResults.push({
                      option_index: i,
                      option_text: optionText,
                      votes: 0,
                      averageRank: 0,
                    });
                  }
                }
                sortedResults = completeResults.sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
              }

              // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
              const needsLargerText =
                (selectedPoll.page_path.includes('holistic-protection') &&
                  selectedPoll.poll_index >= 0 &&
                  selectedPoll.poll_index <= 7) ||
                (selectedPoll.page_path.includes('prioritization') &&
                  selectedPoll.poll_index >= 0 &&
                  selectedPoll.poll_index <= 1);

              return (
                <div className="space-y-4">
                  {sortedResults.map((result, index) => {
                    const isTopChoice = index === 0; // First item after sorting by rank

                    return (
                      <div
                        key={result.option_index}
                        className={`rounded-lg border-2 transition-all duration-300 ${
                          isExpanded ? 'p-3' : 'p-4'
                        } ${
                          isTopChoice
                            ? 'border-blue-500 bg-white dark:bg-gray-800 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                      >
                        <div className={`flex items-center justify-between ${isExpanded ? 'mb-2' : 'mb-3'}`}>
                          <div className="flex items-center space-x-3">
                            {isTopChoice && (
                              <div
                                className={`bg-blue-500 text-white rounded-full flex items-center justify-center font-bold ${
                                  isExpanded ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm'
                                }`}
                              >
                                🏆
                              </div>
                            )}
                            <span
                              className={`font-medium ${
                                needsLargerText
                                  ? isExpanded
                                    ? 'text-xl'
                                    : 'text-lg'
                                  : isExpanded
                                    ? 'text-lg'
                                    : 'text-base'
                              } text-gray-900 dark:text-gray-100`}
                            >
                              {result.option_text}
                            </span>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-bold text-blue-600 dark:text-blue-400 ${
                                isExpanded ? 'text-3xl' : 'text-2xl'
                              }`}
                            >
                              {result.averageRank?.toFixed(1) || 'N/A'}
                            </div>
                            <div
                              className={`text-gray-600 dark:text-gray-400 ${
                                isExpanded ? 'text-base' : 'text-sm'
                              }`}
                            >
                              Avg Rank
                            </div>
                          </div>
                        </div>
                        <div
                          className={`w-full max-w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                            needsLargerText
                              ? isExpanded
                                ? 'h-10'
                                : 'h-7'
                              : isExpanded
                                ? 'h-8'
                                : 'h-5'
                          }`}
                        >
                          <div
                            className={`rounded-full transition-all duration-700 max-w-full ${
                              needsLargerText
                                ? isExpanded
                                  ? 'h-10'
                                  : 'h-7'
                                : isExpanded
                                  ? 'h-8'
                                  : 'h-5'
                            } ${
                              isTopChoice
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                : 'bg-gradient-to-r from-blue-400 to-blue-500'
                            }`}
                            style={{
                              width: `${(() => {
                                const validResults = sortedResults.filter(
                                  (r) => r.averageRank !== null && r.averageRank !== undefined
                                );
                                if (validResults.length === 0) return '100%';
                                const maxRank = Math.max(...validResults.map((r) => r.averageRank || 0));
                                const minRank = Math.min(...validResults.map((r) => r.averageRank || 0));
                                const rankRange = maxRank - minRank;

                                if (rankRange === 0) return '100%';

                                const inverseValue = maxRank - (result.averageRank || 0) + 1;
                                const maxInverseValue = rankRange + 1;

                                return `${Math.max(10, (inverseValue / maxInverseValue) * 100)}%`;
                              })()}`,
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            // For single-choice polls, use expanded format for tiered-framework, compact for others
            (() => {
              const filteredResults = getFilteredPollResults(selectedPoll);
              const filteredTotal = filteredResults.reduce((sum, r) => sum + r.votes, 0);
              const maxVotes = Math.max(...filteredResults.map((r) => r.votes));

              // For prioritization and tiered-framework questions, ensure all options are shown in order
              let sortedResults = [...filteredResults].sort((a, b) => a.option_index - b.option_index);

              if (selectedPoll.page_path.includes('prioritization')) {
                // Create a complete set of all 5 options (0-4) with 0 votes for missing ones
                const completeResults = [];
                const resultsMap = new Map(filteredResults.map((r) => [r.option_index, r]));

                for (let i = 0; i < 5; i++) {
                  if (resultsMap.has(i)) {
                    completeResults.push(resultsMap.get(i)!);
                  } else {
                    // Create a placeholder result for missing options
                    completeResults.push({
                      option_index: i,
                      option_text: selectedPoll.options?.[i] || `Option ${i + 1}`,
                      votes: 0,
                    });
                  }
                }
                sortedResults = completeResults;
              } else if (selectedPoll.page_path.includes('tiered-framework')) {
                // Create a complete set of all 5 options (0-4) with 0 votes for missing ones
                const completeResults = [];
                const resultsMap = new Map(filteredResults.map((r) => [r.option_index, r]));

                for (let i = 0; i < 5; i++) {
                  if (resultsMap.has(i)) {
                    completeResults.push(resultsMap.get(i)!);
                  } else {
                    // Create a placeholder result for missing options
                    completeResults.push({
                      option_index: i,
                      option_text: selectedPoll.options?.[i] || `Option ${i + 1}`,
                      votes: 0,
                    });
                  }
                }
                sortedResults = completeResults;
              }

              // Use expanded format for tiered-framework questions (same as ranking polls)
              if (selectedPoll.page_path.includes('tiered-framework')) {
                // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
                const needsLargerText =
                  (selectedPoll.page_path.includes('holistic-protection') &&
                    selectedPoll.poll_index >= 0 &&
                    selectedPoll.poll_index <= 7) ||
                  (selectedPoll.page_path.includes('prioritization') &&
                    selectedPoll.poll_index >= 0 &&
                    selectedPoll.poll_index <= 1);

                return (
                  <div className="space-y-4">
                    {sortedResults.map((result) => {
                      const percentage = getPercentage(result.votes, filteredTotal);
                      const isTopChoice = result.votes === maxVotes;

                      return (
                        <div
                          key={result.option_index}
                          className={`rounded-lg border-2 transition-all duration-300 ${
                            isExpanded ? 'p-3' : 'p-4'
                          } ${
                            isTopChoice
                              ? 'border-blue-500 bg-white dark:bg-gray-800 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                          }`}
                        >
                          <div className={`flex items-center justify-between ${isExpanded ? 'mb-2' : 'mb-3'}`}>
                            <div className="flex items-center space-x-3">
                              {isTopChoice && (
                                <div
                                  className={`bg-blue-500 text-white rounded-full flex items-center justify-center font-bold ${
                                    isExpanded ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm'
                                  }`}
                                >
                                  🏆
                                </div>
                              )}
                              <span
                                className={`font-medium ${
                                  needsLargerText
                                    ? isExpanded
                                      ? 'text-xl'
                                      : 'text-lg'
                                    : isExpanded
                                      ? 'text-lg'
                                      : 'text-base'
                                } text-gray-900 dark:text-gray-100`}
                              >
                                {result.option_text}
                              </span>
                            </div>
                            <div className="text-right">
                              <div
                                className={`font-bold text-blue-600 dark:text-blue-400 ${
                                  isExpanded ? 'text-3xl' : 'text-2xl'
                                }`}
                              >
                                {result.votes}
                              </div>
                              <div
                                className={`text-gray-600 dark:text-gray-400 ${
                                  isExpanded ? 'text-base' : 'text-sm'
                                }`}
                              >
                                Votes
                              </div>
                            </div>
                          </div>
                          <div
                            className={`w-full max-w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                              needsLargerText
                                ? isExpanded
                                  ? 'h-10'
                                  : 'h-7'
                                : isExpanded
                                  ? 'h-8'
                                  : 'h-5'
                            }`}
                          >
                            <div
                              className={`rounded-full transition-all duration-700 max-w-full ${
                                needsLargerText
                                  ? isExpanded
                                    ? 'h-10'
                                    : 'h-7'
                                  : isExpanded
                                    ? 'h-8'
                                    : 'h-5'
                              } ${
                                isTopChoice
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                  : 'bg-gradient-to-r from-blue-400 to-blue-500'
                              }`}
                              style={{
                                width: `${Math.max(2, percentage)}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Use compact format for other single-choice polls
              // Calculate the width needed for the longest option text
              const maxTextLength = Math.max(...sortedResults.map((r) => r.option_text.length));
              const textWidth = Math.min(Math.max(maxTextLength * 8, 80), 150); // 8px per character, min 80px, max 150px

              // Define gradient colors from light to dark (lowest to highest votes)
              const getGradientColor = (votes: number, maxVotes: number) => {
                const ratio = maxVotes > 0 ? votes / maxVotes : 0;
                if (ratio >= 0.8) return 'bg-gradient-to-r from-indigo-600 to-indigo-700'; // Highest votes - dark indigo
                if (ratio >= 0.6) return 'bg-gradient-to-r from-indigo-500 to-indigo-600'; // High votes - indigo
                if (ratio >= 0.4) return 'bg-gradient-to-r from-blue-600 to-indigo-500'; // Medium votes - blue to indigo
                if (ratio >= 0.2) return 'bg-gradient-to-r from-blue-500 to-blue-600'; // Low votes - blue
                return 'bg-gradient-to-r from-blue-400 to-blue-500'; // Lowest votes - light blue
              };

              // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
              const needsLargerText =
                (selectedPoll.page_path.includes('holistic-protection') &&
                  selectedPoll.poll_index >= 0 &&
                  selectedPoll.poll_index <= 7) ||
                (selectedPoll.page_path.includes('prioritization') &&
                  selectedPoll.poll_index >= 0 &&
                  selectedPoll.poll_index <= 1);

              return (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                  <div className="space-y-2">
                    {sortedResults.map((result) => {
                      const percentage = getPercentage(result.votes, filteredTotal);

                      return (
                        <div key={result.option_index} className="flex items-center space-x-3">
                          <div
                            className={`flex-shrink-0 font-medium text-gray-600 dark:text-gray-400 text-left ${
                              needsLargerText ? 'text-lg' : 'text-xs'
                            }`}
                            style={{ width: `${textWidth}px` }}
                          >
                            {result.option_text}
                          </div>
                          <div className="flex-1 relative min-w-[80px]">
                            <div
                              className={`w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                                needsLargerText ? 'h-6' : 'h-4'
                              }`}
                            >
                              <div
                                className={`rounded-full transition-all duration-500 ${getGradientColor(
                                  result.votes,
                                  maxVotes
                                )} ${needsLargerText ? 'h-6' : 'h-4'}`}
                                style={{
                                  width: `${Math.max(2, percentage)}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                          <div
                            className={`w-12 flex-shrink-0 font-semibold text-gray-700 dark:text-gray-300 text-right ${
                              needsLargerText ? 'text-sm' : 'text-xs'
                            }`}
                          >
                            {result.votes}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                    Total: {filteredTotal} response{filteredTotal !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Matrix Graphs Renderer - Handles prioritization and holistic graphs */}
        <MatrixGraphRenderer
          selectedPoll={selectedPoll}
          matrixData={matrixData}
          showMatrixGraphs={showMatrixGraphs}
          toggleMatrixGraph={toggleMatrixGraph}
          exportMatrixGraph={exportMatrixGraph}
          filteredPolls={filteredPolls}
        />
      </div>

      {/* Expanded QR Code and Join at Overlay */}
      <QRCodeModal isOpen={qrCodeExpanded} onClose={() => setQrCodeExpanded(false)} expandedPollGroup={expandedPollGroup} />
    </>
  );
}
