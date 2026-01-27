'use client';

import React, { useMemo } from 'react';
import { PollResult } from '../types';

interface RankingDisplayProps {
  selectedPoll: PollResult;
  isExpanded: boolean;
  getFilteredPollResults: (poll: PollResult) => Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
}

function RankingDisplay({ selectedPoll, isExpanded, getFilteredPollResults }: RankingDisplayProps) {
  // Memoize the sorted results to avoid recalculating on every render
  const sortedResults = useMemo(() => {
    // For ranking polls, sort by average rank (lower is better)
    const filteredResults = getFilteredPollResults(selectedPoll);
    let results = [...filteredResults].sort(
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
      results = completeResults.sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
    }

    return results;
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
}

export default React.memo(RankingDisplay);
