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

  const handleVote = async (optionIndex: number) => {
    if (hasVoted || isLoading) return;

    setIsLoading(true);
    setSelectedOption(optionIndex);

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
          optionIndex
        }),
      });

      if (response.ok) {
        setHasVoted(true);
        setShowResults(true);
        
        // Fetch updated results
        await fetchResults();
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, optionIndex);
        }
      } else {
        console.error('Failed to submit vote');
        setSelectedOption(null);
      }
    } catch (error) {
      console.error('Error submitting vote:', error);
      setSelectedOption(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/polls/results?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    }
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
      
      <div className="space-y-4">
        {options.map((option, optionIndex) => {
          const votes = getOptionVotes(optionIndex);
          const percentage = getPercentage(votes, results?.total_votes || 0);
          const isSelected = selectedOption === optionIndex;
          const isVoted = hasVoted;
          
          return (
            <div key={optionIndex} className="relative">
              <button
                onClick={() => handleVote(optionIndex)}
                disabled={isVoted || isLoading}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-300 ${
                  isVoted 
                    ? 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 cursor-not-allowed' 
                    : 'bg-white dark:bg-gray-700 border-blue-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md cursor-pointer'
                } ${isSelected && !isVoted ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${
                    isVoted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-white'
                  }`}>
                    {option}
                  </span>
                  
                  {isVoted && (
                    <div className="flex items-center space-x-2">
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
