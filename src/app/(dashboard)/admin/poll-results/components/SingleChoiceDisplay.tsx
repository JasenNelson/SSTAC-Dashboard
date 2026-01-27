'use client';

import React, { useMemo } from 'react';
import { PollResult } from '../types';

interface SingleChoiceDisplayProps {
  selectedPoll: PollResult;
  isExpanded: boolean;
  getFilteredPollResults: (poll: PollResult) => Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
}

const getPercentage = (votes: number, totalVotes: number) => {
  if (totalVotes === 0) return 0;
  return Math.round((votes / totalVotes) * 100);
};

function SingleChoiceDisplay({
  selectedPoll,
  isExpanded,
  getFilteredPollResults,
}: SingleChoiceDisplayProps) {
  // Memoize sorted results calculation to avoid recalculating on every render
  const { sortedResults, filteredTotal, maxVotes } = useMemo(() => {
    const filteredResults = getFilteredPollResults(selectedPoll);
    const total = filteredResults.reduce((sum, r) => sum + r.votes, 0);
    const max = Math.max(...filteredResults.map((r) => r.votes));

    // For prioritization and tiered-framework questions, ensure all options are shown in order
    let results = [...filteredResults].sort((a, b) => a.option_index - b.option_index);

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
      results = completeResults;
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
      results = completeResults;
    }

    return { sortedResults: results, filteredTotal: total, maxVotes: max };
  }, [selectedPoll, getFilteredPollResults]);

  // Memoize text size calculation to avoid recalculating on every render
  const needsLargerText = useMemo(
    () =>
      (selectedPoll.page_path.includes('holistic-protection') &&
        selectedPoll.poll_index >= 0 &&
        selectedPoll.poll_index <= 7) ||
      (selectedPoll.page_path.includes('prioritization') &&
        selectedPoll.poll_index >= 0 &&
        selectedPoll.poll_index <= 1),
    [selectedPoll.page_path, selectedPoll.poll_index]
  );

  // Use expanded format for tiered-framework questions (same as ranking polls)
  if (selectedPoll.page_path.includes('tiered-framework')) {

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
}

export default React.memo(SingleChoiceDisplay);
