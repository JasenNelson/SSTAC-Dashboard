'use client';

import React, { useState, useEffect } from 'react';
import PollResultsChart from './dashboard/PollResultsChart';

interface PollOption {
  option_index: number;
  option_text: string;
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
  questionNumber?: number;
  authCode?: string;
  onVote?: (pollIndex: number, optionIndex: number, otherText?: string) => void;
}

export default function PollWithResults({ 
  pollIndex, 
  question, 
  options, 
  pagePath, 
  questionNumber,
  authCode,
  onVote 
}: PollWithResultsProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [userVote, setUserVote] = useState<number | null>(null);

  const [showChangeOption, setShowChangeOption] = useState(false);
  const [otherText, setOtherText] = useState<string>('');
  const [userOtherText, setUserOtherText] = useState<string>('');
  const [sessionId] = useState<string>(() => {
    // Generate a unique session ID for this user session
    // This ensures all votes from the same session use the same user_id
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('cew-session-id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        sessionStorage.setItem('cew-session-id', sessionId);
      }
      console.log(`[PollWithResults] Session ID generated/retrieved: ${sessionId}`);
      return sessionId;
    }
    console.log(`[PollWithResults] Using default session ID (server-side)`);
    return 'default';
  });

  // Fetch results when component mounts
  useEffect(() => {
    fetchResults();
    // Check for existing vote in sessionStorage for CEW pages
    if (pagePath.startsWith('/cew-polls/')) {
      checkCEWVoteStatus();
    }
  }, []);

  const checkCEWVoteStatus = () => {
    // For CEW pages, don't persist votes at all - start fresh each time
    // This ensures true privacy in incognito mode
    console.log(`[PollWithResults ${pollIndex}] CEW poll - no vote persistence for privacy`);
  };

  const handleSelectOption = (optionIndex: number) => {
    if ((hasVoted && !showChangeOption) || isLoading) return;
    console.log(`[PollWithResults ${pollIndex}] Selected option ${optionIndex}`);
    setSelectedOption(optionIndex);
    // Clear other text when selecting a new option
    if (!isOtherOption(options[optionIndex])) {
      setOtherText('');
    }
  };

  const handleSubmitVote = async () => {
    console.log(`[PollWithResults] handleSubmitVote called for poll ${pollIndex}`);
    console.log(`[PollWithResults] selectedOption: ${selectedOption}, isLoading: ${isLoading}`);
    
    if (selectedOption === null || isLoading) {
      console.log(`[PollWithResults] Early return - selectedOption: ${selectedOption}, isLoading: ${isLoading}`);
      return;
    }
    
    // Validate other text if "Other" is selected
    if (isSelectedOther() && !otherText.trim()) {
      alert('Please provide details for your "Other" selection.');
      return;
    }

    // Debug: Log session ID and vote details with timestamp
    const voteTimestamp = new Date().toISOString();
    console.log(`[PollWithResults] 🗳️ SUBMITTING VOTE - Poll ${pollIndex} at ${voteTimestamp}:`, {
      sessionId,
      authCode,
      selectedOption,
      pagePath,
      timestamp: voteTimestamp,
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    });

    // No device tracking for CEW pages - allow multiple votes
    setIsLoading(true);

    try {
      // Use unified API endpoint for all pages
      const apiEndpoint = '/api/polls/submit';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({
          pagePath,
          pollIndex,
          question,
          options,
          optionIndex: selectedOption,
          otherText: isSelectedOther() ? otherText.trim() : undefined,
          authCode: authCode || undefined
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setHasVoted(true);
        setShowResults(true);
        setUserVote(selectedOption);
        setUserOtherText(isOtherOption(options[selectedOption]) ? otherText.trim() : '');
        setShowChangeOption(false);
        setSelectedOption(null); // Clear selected option after voting
        
        // Save vote to sessionStorage for CEW pages
        // For CEW pages, don't save votes locally for privacy
        if (pagePath.startsWith('/cew-polls/')) {
          console.log(`[PollWithResults ${pollIndex}] CEW poll - vote submitted but not persisted locally for privacy`);
        }
        
        // Fetch updated results to show new vote counts
        console.log(`[PollWithResults ${pollIndex}] Fetching updated results after vote submission`);
        await fetchResults();
        console.log(`[PollWithResults ${pollIndex}] Results fetch completed`);
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, selectedOption, isOtherOption(options[selectedOption]) ? otherText.trim() : undefined);
        }
      } else {
        const errorData = await response.json();
        
        // Show specific error message to user
        if (errorData.error) {
          alert(errorData.error);
        } else {
          alert('Failed to submit vote. Please try again.');
        }
        
        setSelectedOption(null);
      }
    } catch (error) {
      alert('Failed to submit vote. Please try again.');
      setSelectedOption(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchResults = async () => {
    try {
      console.log(`[PollWithResults ${pollIndex}] Fetching results for poll ${pollIndex} on page ${pagePath}`);
      
      // Use unified API endpoint for all pages
      const apiEndpoint = '/api/polls/results';
      
      let url = `${apiEndpoint}?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`;
      if (authCode) {
        url += `&authCode=${encodeURIComponent(authCode)}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`[PollWithResults ${pollIndex}] API Response:`, data);
        console.log(`[PollWithResults ${pollIndex}] Setting results state with:`, data.results);
        setResults(data.results);
        
        // Check if user has already voted (for both authenticated and CEW pages)
        if (data.userVote !== null && data.userVote !== undefined) {
          console.log(`[PollWithResults ${pollIndex}] User has vote:`, data.userVote);
          console.log(`[PollWithResults ${pollIndex}] showChangeOption state:`, showChangeOption);
          setUserVote(data.userVote);
          setUserOtherText(data.userOtherText || '');
          
          // Only set hasVoted to true if user is not in change vote mode
          if (!showChangeOption) {
            console.log(`[PollWithResults ${pollIndex}] Setting hasVoted to true (not in change mode)`);
            setHasVoted(true);
            setShowResults(true);
          } else {
            console.log(`[PollWithResults ${pollIndex}] Skipping hasVoted=true because in change mode`);
          }
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
    // Prevent change vote on CEW pages
    if (pagePath.startsWith('/cew-polls/')) {
      console.log(`[PollWithResults ${pollIndex}] Change vote not allowed on CEW pages`);
      return;
    }
    
    console.log(`[PollWithResults ${pollIndex}] handleChangeVote called - setting showChangeOption to true`);
    setShowChangeOption(true);
    setHasVoted(false);
    // Don't reset selectedOption immediately - let user see their previous choice and change it
    // setSelectedOption(null);
    setOtherText('');
    
    // Don't call fetchResults immediately - it causes race condition with state updates
    // The results are already loaded, we just need to show the change interface
    console.log(`[PollWithResults ${pollIndex}] Skipping fetchResults to avoid race condition`);
  };

  const handleCancelChange = () => {
    // Prevent cancel change on CEW pages
    if (pagePath.startsWith('/cew-polls/')) {
      console.log(`[PollWithResults ${pollIndex}] Cancel change not allowed on CEW pages`);
      return;
    }
    
    setShowChangeOption(false);
    setHasVoted(true);
    setSelectedOption(userVote);
    setOtherText('');
  };

  const getPercentage = (votes: number, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const getOptionVotes = (optionIndex: number) => {
    if (!results?.results) return 0;
    const option = results.results.find(r => r.option_index === optionIndex);
    return option?.votes || 0;
  };

  const isOtherOption = (optionText: string) => {
    return optionText.toLowerCase().includes('other');
  };

  const isSelectedOther = () => {
    return selectedOption !== null && isOtherOption(options[selectedOption]);
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 text-center">
        {questionNumber && `Question ${questionNumber}: `}{question}
      </h3>
      
      {/* User's previous vote indicator - always show when user has voted */}
      {hasVoted && userVote !== null && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
              <span className="text-green-800 dark:text-green-200">
                You voted: <strong>Option {String.fromCharCode(65 + userVote)}: {options[userVote]}</strong>
                {userOtherText && (
                  <span className="block mt-1 text-sm">
                    <strong>Your "Other" response:</strong> "{userOtherText}"
                  </span>
                )}
              </span>
            </div>
            {!showChangeOption && !pagePath.startsWith('/cew-polls/') && (
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
      {showChangeOption && !pagePath.startsWith('/cew-polls/') && (
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
          
          // Debug logging
          if (optionIndex === 0) { // Only log for first option to avoid spam
            console.log(`[PollWithResults ${pollIndex}] Button state:`, {
              hasVoted,
              showChangeOption,
              isVoted,
              disabled: (isVoted && !showChangeOption) || isLoading
            });
          }
          
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
                    <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">
                      Option {String.fromCharCode(65 + optionIndex)}:
                    </span>
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

      {/* Other Text Input - show when "Other" is selected */}
      {!hasVoted && isSelectedOther() && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <label htmlFor={`other-text-${pollIndex}`} className="block text-sm font-medium text-gray-900 dark:text-blue-200 mb-2">
            Please provide details for your "Other" selection:
          </label>
          <textarea
            id={`other-text-${pollIndex}`}
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Enter your specific details here..."
            className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            rows={3}
            maxLength={500}
          />
          <div className="mt-1 text-xs text-gray-900 dark:text-blue-400">
            {otherText.length}/500 characters
          </div>
        </div>
      )}


      {/* Submit Button - show when not voted OR when in change vote mode */}
      {(() => {
        const shouldShowButton = !hasVoted || showChangeOption;
        console.log(`[PollWithResults ${pollIndex}] Button state:`, { hasVoted, showChangeOption, selectedOption, shouldShowButton });
        return shouldShowButton;
      })() && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              handleSubmitVote();
            }}
            disabled={(() => {
              const isDisabled = selectedOption === null || isLoading || (isSelectedOther() && !otherText.trim());
              console.log(`[PollWithResults ${pollIndex}] Button disabled check:`, { selectedOption, isLoading, isSelectedOther: isSelectedOther(), otherText: otherText.trim(), isDisabled });
              return isDisabled;
            })()}
            className={`px-8 py-3 font-semibold rounded-xl transition-colors duration-300 flex items-center space-x-2 ${
              selectedOption === null || isLoading || (isSelectedOther() && !otherText.trim())
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>{showChangeOption && !pagePath.startsWith('/cew-polls/') ? 'Updating Vote...' : 'Submitting Vote...'}</span>
              </>
            ) : (
              <>
                <span>{showChangeOption && !pagePath.startsWith('/cew-polls/') ? 'Update Vote' : 'Submit Vote'}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      )}

      {/* Results Visualization */}
      {showResults && (
        <div className="mt-6">
          <PollResultsChart
            pollType="single-choice"
            results={results}
            title="Poll Results"
            showVoteCount={true}
            showPercentages={true}
            interactive={true}
            options={options}
          />
        </div>
      )}
    </div>
  );
}
