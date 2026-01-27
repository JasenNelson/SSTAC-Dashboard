'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PollResultsChart from './PollResultsChart';

interface RankingOption {
  id: string;
  text: string;
  rank: number | null;
}

interface RankingPollProps {
  pollIndex: number;
  question: string;
  options: string[];
  pagePath: string;
  questionNumber?: number;
  authCode?: string;
  onVote?: (pollIndex: number, rankings: number[]) => void;
}

export default function RankingPoll({ 
  pollIndex, 
  question, 
  options, 
  pagePath, 
  questionNumber,
  authCode,
  onVote 
}: RankingPollProps) {
  const [rankingOptions, setRankingOptions] = useState<RankingOption[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    total_votes: number;
    results: Array<{
      option_index: number;
      option_text: string;
      averageRank: number;
      votes: number;
    }>;
  } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [userRankings, setUserRankings] = useState<number[] | null>(null);

  const [showChangeOption, setShowChangeOption] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      // Determine API endpoint based on page path
      // Use unified API endpoint for all pages
      const apiEndpoint = '/api/ranking-polls/results';
      
      let url = `${apiEndpoint}?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`;
      if (authCode) {
        url += `&authCode=${encodeURIComponent(authCode)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        
        // Check if user has already voted
        if (data.userRankings && data.userRankings.length > 0) {
          setUserRankings(data.userRankings);
          
          // For CEW pages, show previous rankings but don't disable submit button
          // This allows users to see their previous choice while still being able to vote again
          if (pagePath.startsWith('/cew-polls/')) {
            setShowResults(true);
            // Set the user's previous rankings for display only
            const updatedOptions = options.map((option, index) => ({
              id: `option-${index}`,
              text: option,
              rank: data.userRankings[index] || null
            }));
            setRankingOptions(updatedOptions);
          } else {
            // For authenticated pages, disable submit button as usual
            // Only set hasVoted to true if user is not in change vote mode
            if (!showChangeOption) {
              setHasVoted(true);
            }
            setShowResults(true);
            const updatedOptions = options.map((option, index) => ({
              id: `option-${index}`,
              text: option,
              rank: data.userRankings[index] || null
            }));
            setRankingOptions(updatedOptions);
          }
        }
      }
    } catch (error) {
      console.error(`[RankingPoll ${pollIndex}] Error fetching results:`, error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePath, pollIndex, options]); // authCode and showChangeOption are stable

  // Initialize ranking options and check for existing vote
  useEffect(() => {
    const initialOptions = options.map((option, index) => ({
      id: `option-${index}`,
      text: option,
      rank: null
    }));
    setRankingOptions(initialOptions);
    
    // Check for existing vote
    fetchResults();
    
    // Check for CEW ranking in sessionStorage
    if (pagePath.startsWith('/cew-polls/')) {
      checkCEWRankingStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchResults]); // options and pagePath are dependencies of fetchResults

  const checkCEWRankingStatus = () => {
    // For CEW pages, don't persist rankings at all - start fresh each time
    // This ensures true privacy in incognito mode
  };

  const handleRankChange = (optionId: string, newRank: number) => {
    setRankingOptions(prev => {
      const updated = [...prev];
      
      // Clear any existing rank for this option
      const optionIndex = updated.findIndex(opt => opt.id === optionId);
      if (optionIndex !== -1) {
        updated[optionIndex].rank = null;
      }
      
      // Clear the rank from any other option that had this rank
      updated.forEach(opt => {
        if (opt.rank === newRank && opt.id !== optionId) {
          opt.rank = null;
        }
      });
      
      // Set the new rank
      if (optionIndex !== -1) {
        updated[optionIndex].rank = newRank;
      }
      
      return updated;
    });
  };

  const handleSubmitRanking = async () => {
    if ((hasVoted && !showChangeOption) || isLoading) {
      return;
    }

    // Check if all options are ranked
    const allRanked = rankingOptions.every(opt => opt.rank !== null);
    
    if (!allRanked) {
      alert('Please rank all options before submitting.');
      return;
    }

    // No device tracking for CEW pages - allow multiple votes
    setIsLoading(true);

    try {
      // Convert rankings to array format (rank 1 = index 0, etc.)
      const rankings = rankingOptions
        .sort((a, b) => (a.rank || 0) - (b.rank || 0))
        .map((opt, _index) => {
          const originalIndex = options.findIndex(option => option === opt.text);
          return originalIndex;
        });

      // Convert rankings to the format expected by the API
      const rankingsData = rankings.map((optionIndex: number, rank: number) => ({
        optionIndex,
        rank: rank + 1
      }));

      // Determine API endpoint based on page path
      // Use unified API endpoint for all pages
      const apiEndpoint = '/api/ranking-polls/submit';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pagePath,
          pollIndex,
          question,
          options,
          rankings: rankingsData,
          authCode: authCode || undefined
        }),
      });

      if (response.ok) {
        setHasVoted(true);
        setShowResults(true);
        setUserRankings(rankings);
        setShowChangeOption(false);
        
        // Save ranking to sessionStorage for CEW pages
        // For CEW pages, don't save rankings locally for privacy
        
        // Fetch updated results
        await fetchResults();
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, rankings);
        }
      } else {
        console.error(`Failed to submit ranking for poll ${pollIndex}:`, response.status);
      }
    } catch (error) {
      console.error('Error submitting ranking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeRanking = () => {
    setShowChangeOption(true);
    setHasVoted(false);
    // Don't reset rankings immediately - let user see their previous rankings and change them
    // setRankingOptions(prev => prev.map(opt => ({ ...opt, rank: null })));
    
    // No device tracking for CEW pages - allow re-voting
  };

  const handleCancelChange = () => {
    setShowChangeOption(false);
    setHasVoted(true);
    // Restore user's previous rankings
    if (userRankings) {
      const restoredOptions = options.map((option, index) => ({
        id: `option-${index}`,
        text: option,
        rank: userRankings[index] || null
      }));
      setRankingOptions(restoredOptions);
    }
  };

  const getRankingText = (rank: number) => {
    const rankTexts = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
    return rankTexts[rank - 1] || `${rank}th`;
  };

  const getAverageRanking = (optionIndex: number) => {
    if (!results?.results) return null;
    const option = results.results.find((r: { option_index: number }) => r.option_index === optionIndex);
    return option?.averageRank || null;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 text-center">
        {questionNumber && `Question ${questionNumber}: `}{question}
      </h3>
      
      {/* User's previous ranking indicator - always show when user has voted */}
      {hasVoted && userRankings && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
              <span className="text-green-800 dark:text-green-200">
                You have already ranked these options
              </span>
            </div>
            {!showChangeOption && (
              <button
                onClick={handleChangeRanking}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Change Ranking
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Change ranking mode indicator */}
      {showChangeOption && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 dark:text-yellow-400 font-semibold">🔄</span>
              <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                Re-rank all options to change your ranking
              </span>
            </div>
            <button
              onClick={handleCancelChange}
              className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-4">
        {rankingOptions.map((option, index) => {
          const averageRank = getAverageRanking(index);
          const isRanked = option.rank !== null;
          
          return (
            <div key={option.id} className="relative">
              <div className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
                hasVoted 
                  ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500' 
                  : 'bg-white dark:bg-gray-700 border-blue-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md'
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <span className={`font-medium ${
                    hasVoted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-white'
                  }`}>
                    <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">
                      Option {String.fromCharCode(65 + index)}:
                    </span>
                    {option.text}
                  </span>
                  
                  {hasVoted && averageRank && (
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        Avg Rank: {averageRank.toFixed(1)}
                      </span>
                    </div>
                  )}
                  
                  {isRanked && !hasVoted && (
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      {getRankingText(option.rank!)}
                    </span>
                  )}
                </div>
                
                {(!hasVoted || showChangeOption) && (
                  <div className="flex flex-wrap gap-2">
                    {options.map((_, rankNum) => (
                      <button
                        key={rankNum}
                        onClick={() => handleRankChange(option.id, rankNum + 1)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          option.rank === rankNum + 1
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-200 dark:hover:bg-blue-700 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-500'
                        }`}
                      >
                        {getRankingText(rankNum + 1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>


      {(!hasVoted || showChangeOption) && (
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              handleSubmitRanking();
            }}
            disabled={isLoading || !rankingOptions.every(opt => opt.rank !== null)}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              isLoading || !rankingOptions.every(opt => opt.rank !== null)
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg transform hover:-translate-y-1'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Submitting...</span>
              </div>
            ) : (
              showChangeOption ? 'Update Ranking' : 'Submit Ranking'
            )}
          </button>
        </div>
      )}

      {/* Results Visualization */}
      {showResults && (
        <div className="mt-6">
          <PollResultsChart
            pollType="ranking"
            results={results}
            title="Ranking Results"
            showVoteCount={true}
            showPercentages={false}
            interactive={true}
          />
        </div>
      )}
    </div>
  );
}
