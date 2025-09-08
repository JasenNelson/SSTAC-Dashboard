'use client';

import React, { useState, useEffect } from 'react';

interface PollOption {
  optionIndex: number;
  optionText: string;
  votes: number;
}

interface PollResults {
  total_votes: number;
  results: PollOption[];
}

interface PollWithResultsProps {
  pollIndex: number;
  question: string;
  options: string[];
  pagePath: string;
  onVote?: (pollIndex: number, optionIndex: number) => void;
}

export default function PollWithResults({ 
  pollIndex, 
  question, 
  options, 
  pagePath, 
  onVote 
}: PollWithResultsProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [showChangeOption, setShowChangeOption] = useState(false);

  // Fetch results when component mounts
  useEffect(() => {
    fetchResults();
  }, []);

  const handleSelectOption = (optionIndex: number) => {
    if ((hasVoted && !showChangeOption) || isLoading) return;
    console.log(`[PollWithResults ${pollIndex}] Selected option ${optionIndex}`);
    setSelectedOption(optionIndex);
  };

  const handleSubmitVote = async () => {
    if (selectedOption === null || isLoading) return;

    console.log(`[PollWithResults ${pollIndex}] Submitting vote for option ${selectedOption}`);
    setIsLoading(true);

    try {
      const response = await fetch('/api/polls/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pagePath,
          pollIndex,
          question,
          options,
          optionIndex: selectedOption
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[PollWithResults ${pollIndex}] Vote submitted successfully:`, result);
        setHasVoted(true);
        setShowResults(true);
        setUserVote(selectedOption);
        setShowChangeOption(false);
        
        // Fetch updated results
        await fetchResults();
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, selectedOption);
        }
      } else {
        console.error(`[PollWithResults ${pollIndex}] Failed to submit vote:`, response.status);
        setSelectedOption(null);
      }
    } catch (error) {
      console.error(`[PollWithResults ${pollIndex}] Error submitting vote:`, error);
      setSelectedOption(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      console.log(`[PollWithResults ${pollIndex}] Fetching results for poll ${pollIndex} on page ${pagePath}`);
      const response = await fetch(`/api/polls/results?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`[PollWithResults ${pollIndex}] API Response:`, data);
        setResults(data.results);
        
        // Check if user has already voted
        if (data.userVote !== null && data.userVote !== undefined) {
          console.log(`[PollWithResults ${pollIndex}] User has vote:`, data.userVote);
          setUserVote(data.userVote);
          setHasVoted(true);
          setShowResults(true);
        } else {
          console.log(`[PollWithResults ${pollIndex}] No user vote found`);
        }
      } else {
        console.log(`[PollWithResults ${pollIndex}] Failed to fetch results:`, response.status);
      }
    } catch (error) {
      console.error(`[PollWithResults ${pollIndex}] Error fetching results:`, error);
    }
  };

  const handleChangeVote = () => {
    setShowChangeOption(true);
    setHasVoted(false);
    setSelectedOption(null);
  };

  const handleCancelChange = () => {
    setShowChangeOption(false);
    setHasVoted(true);
    setSelectedOption(userVote);
  };

  const getPercentage = (votes: number, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const getOptionVotes = (optionIndex: number) => {
    if (!results?.results) return 0;
    const option = results.results.find(r => r.optionIndex === optionIndex);
    return option?.votes || 0;
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 text-center">
        {question}
      </h3>
      
      {/* User's previous vote indicator - always show when user has voted */}
      {hasVoted && userVote !== null && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
              <span className="text-green-800 dark:text-green-200">
                You voted: <strong>{options[userVote]}</strong>
              </span>
            </div>
            {!showChangeOption && (
              <button
                onClick={handleChangeVote}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Change Vote
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Change vote mode indicator */}
      {showChangeOption && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 dark:text-yellow-400 font-semibold">🔄</span>
              <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                Choose a new option to change your vote
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
        {options.map((option, optionIndex) => {
          const votes = getOptionVotes(optionIndex);
          const percentage = getPercentage(votes, results?.total_votes || 0);
          const isSelected = selectedOption === optionIndex;
          const isVoted = hasVoted;
          
          return (
            <div key={optionIndex} className="relative">
              <button
                onClick={() => handleSelectOption(optionIndex)}
                disabled={(isVoted && !showChangeOption) || isLoading}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                  (isVoted && !showChangeOption)
                    ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-700 border-blue-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md cursor-pointer'
                } ${isSelected && (!isVoted || showChangeOption) ? 'ring-2 ring-blue-500' : ''} ${
                  userVote === optionIndex && hasVoted && !showChangeOption ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${
                    isVoted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-white'
                  }`}>
                    {option}
                  </span>
                  
                  {isVoted && (
                    <div className="flex items-center space-x-2">
                      {userVote === optionIndex && !showChangeOption && (
                        <span className="text-green-600 dark:text-green-400 font-semibold text-sm">
                          Your Vote
                        </span>
                      )}
                      <span className="text-blue-600 dark:text-blue-400 font-semibold">
                        {percentage}%
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-sm">
                        ({votes} vote{votes !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}
                  
                  {isLoading && isSelected && (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
                      <span className="text-blue-600 dark:text-blue-400 text-sm">Submitting...</span>
                    </div>
                  )}
                </div>
                
                {/* Progress bar for voted options */}
                {isVoted && (
                  <div className="mt-3 w-full bg-gray-200 dark:bg-gray-500 rounded-full h-2">
                    <div 
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Submit Button - always show when not voted, disabled until option selected */}
      {!hasVoted && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleSubmitVote}
            disabled={selectedOption === null || isLoading}
            className={`px-8 py-3 font-semibold rounded-xl transition-colors duration-300 flex items-center space-x-2 ${
              selectedOption === null || isLoading
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{showChangeOption ? 'Updating Vote...' : 'Submitting Vote...'}</span>
              </>
            ) : (
              <>
                <span>{showChangeOption ? 'Update Vote' : 'Submit Vote'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Summary */}
      {showResults && results && (
        <div className="mt-6 p-4 bg-white dark:bg-gray-700 rounded-lg border border-blue-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Results</h4>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {results.total_votes} total vote{results.total_votes !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-2">
            {results.results.map((result, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1 mr-2">
                  {result.optionText}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {getPercentage(result.votes, results.total_votes)}%
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    ({result.votes})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
