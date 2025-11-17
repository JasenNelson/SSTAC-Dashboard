'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/components/Toast';
import WordCloudInputSection from './wordcloud/WordCloudInputSection';
import WordCloudResultsSection from './wordcloud/WordCloudResultsSection';
import type { WordCloudPollProps, WordCloudResults } from './wordcloud/WordCloudTypes';

export default function WordCloudPoll({ 
  pollIndex, 
  question, 
  maxWords,
  wordLimit,
  pagePath,
  questionNumber,
  authCode,
  predefinedOptions = [],
  onVote
}: WordCloudPollProps) {
  const { showToast } = useToast();
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<WordCloudResults>({
    total_votes: 0,
    words: [],
    user_words: []
  });
  const [showAggregatedResults, setShowAggregatedResults] = useState(false);
  const [isFetchingAggregated, setIsFetchingAggregated] = useState(false);
  const [userWords, setUserWords] = useState<string[] | null>(null);
  const [showChangeOption, setShowChangeOption] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>([]);
  const [customWords, setCustomWords] = useState<string>('');
  const isFetchingRef = useRef(false);
  const hasAppliedExistingWordsRef = useRef(false);
  const lastAppliedUserWordsRef = useRef<string | null>(null);

  // Handle predefined option selection
  const handlePredefinedToggle = (keyword: string) => {
    setSelectedPredefined(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword);
      } else {
        // Check if we're at max words limit - check before updating state
        if (prev.length >= maxWords) {
          // Show toast after state update completes
          setTimeout(() => {
            showToast({
              type: 'warning',
              title: 'Selection limit reached',
              message: `You can only select up to ${maxWords} words.`
            });
          }, 0);
          return prev;
        }
        // Clear custom words when selecting predefined options
        setCustomWords('');
        return [...prev, keyword];
      }
    });
  };

  // Handle custom words input
  const handleCustomWordsChange = (value: string) => {
    // Clear predefined selections when entering custom words
    setSelectedPredefined([]);
    setCustomWords(value);
  };

  // Get all selected words (predefined + custom)
  const getAllSelectedWords = () => {
    const customWordsArray = customWords.trim() ? customWords.trim().split(/\s+/).filter(word => word.length > 0) : [];
    return [...selectedPredefined, ...customWordsArray];
  };

  const applyExistingWords = useCallback((existingWords: string[] | null) => {
    if (!existingWords || existingWords.length === 0) {
      setSelectedPredefined([]);
      setCustomWords('');
      return;
    }

    const keywordLookup = new Map(predefinedOptions.map(option => [option.keyword.toLowerCase(), option.keyword]));
    const matchedKeywords: string[] = [];
    const customOnly: string[] = [];

    existingWords.forEach(word => {
      const keyword = keywordLookup.get(word.toLowerCase());
      if (keyword) {
        matchedKeywords.push(keyword);
      } else {
        customOnly.push(word);
      }
    });

    setSelectedPredefined(matchedKeywords);
    setCustomWords(customOnly.join(' '));
  }, [predefinedOptions]);


  // Handler to fetch and show aggregated results
  const handleViewResults = async () => {
    if (isFetchingAggregated) return;
    
    setIsFetchingAggregated(true);
    try {
      const apiEndpoint = '/api/wordcloud-polls/results';
      let url = `${apiEndpoint}?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`;
      if (authCode) {
        url += `&authCode=${encodeURIComponent(authCode)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        // Store aggregated results from ALL users
        setResults(data.results || { total_votes: 0, words: [], user_words: [] });
        setShowAggregatedResults(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[WordCloudPoll ${pollIndex}] Failed to fetch aggregated results:`, response.status, errorData);
        showToast({
          type: 'error',
          title: 'Unable to load results',
          message: 'Please try again.'
        });
      }
    } catch (error) {
      console.error(`[WordCloudPoll ${pollIndex}] Error fetching aggregated results:`, error);
      showToast({
        type: 'error',
        title: 'Unable to load results',
        message: 'Please try again.'
      });
    } finally {
      setIsFetchingAggregated(false);
    }
  };

  const fetchResults = useCallback(async () => {
    if (isFetchingRef.current) return; // Prevent multiple simultaneous calls

    isFetchingRef.current = true;
    try {
      // Only fetch results for survey-results pages (authenticated users)
      // CEW pages should remain insert-only without fetching results
      if (pagePath.startsWith('/cew-polls/')) {
        setResults({ total_votes: 0, words: [], user_words: [] });
        return;
      }
      
      // Use unified API endpoint for survey-results pages only
      const apiEndpoint = '/api/wordcloud-polls/results';
      
      let url = `${apiEndpoint}?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`;
      if (authCode) {
        url += `&authCode=${encodeURIComponent(authCode)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || { total_votes: 0, words: [], user_words: [] });
        
        // Check if user has already submitted words (from results.user_words)
        const userWordsFromResponse = data.results?.user_words;
        if (userWordsFromResponse && Array.isArray(userWordsFromResponse) && userWordsFromResponse.length > 0) {
          setUserWords(userWordsFromResponse);
          setHasVoted(true);
          // Don't auto-show aggregated results - user must click "View Results" button
        } else {
          setUserWords(null);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[WordCloudPoll ${pollIndex}] Failed to fetch results:`, response.status, errorData);
        // Set empty results on error
        setResults({ total_votes: 0, words: [], user_words: [] });
      }
    } catch (error) {
      console.error(`[WordCloudPoll ${pollIndex}] Error fetching results:`, error);
      // Set empty results on error
      setResults({ total_votes: 0, words: [], user_words: [] });
    } finally {
      isFetchingRef.current = false;
    }
  }, [authCode, pagePath, pollIndex]);

  // Reset flags when poll changes
  useEffect(() => {
    hasAppliedExistingWordsRef.current = false;
    lastAppliedUserWordsRef.current = null;
  }, [pagePath, pollIndex]);

  // Fetch results on mount/poll change
  useEffect(() => {
    // Add a small delay to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      fetchResults();
    }, 100);
    
    // Check for CEW words in sessionStorage
    if (pagePath.startsWith('/cew-polls/')) {
      checkCEWWordStatus();
    }
    
    return () => clearTimeout(timeoutId);
  }, [fetchResults, pagePath, pollIndex, authCode]);

  // Apply existing words when we first get them (but not during editing)
  useEffect(() => {
    // Only apply existing words on initial load when we have userWords and we're not in change mode
    // Don't re-apply if we've already applied these exact words (prevents reset during editing)
    if (userWords && !showChangeOption && hasVoted) {
      const userWordsKey = JSON.stringify(userWords);
      // Only apply if we haven't applied these exact words before
      if (lastAppliedUserWordsRef.current !== userWordsKey) {
        applyExistingWords(userWords);
        lastAppliedUserWordsRef.current = userWordsKey;
        hasAppliedExistingWordsRef.current = true;
      }
    }
  }, [userWords, showChangeOption, hasVoted, applyExistingWords]);

  const checkCEWWordStatus = () => {
    // For CEW pages, don't persist words at all - start fresh each time
    // This ensures true privacy in incognito mode
  };

  const handleSubmitWords = async () => {
    if ((hasVoted && !showChangeOption) || isLoading) {
      return;
    }

    // Get all selected words (predefined + custom)
    const allWords = getAllSelectedWords();
    
    if (allWords.length === 0) {
      showToast({
        type: 'warning',
        title: 'No words selected',
        message: 'Please select at least one option or enter custom words.'
      });
      return;
    }

    if (allWords.length > maxWords) {
      showToast({
        type: 'warning',
        title: 'Selection limit exceeded',
        message: `Please select no more than ${maxWords} words total.`
      });
      return;
    }

    // Validate word length
    const invalidWords = allWords.filter(word => word.length > wordLimit);
    if (invalidWords.length > 0) {
      showToast({
        type: 'warning',
        title: 'Word too long',
        message: `Words must be ${wordLimit} characters or less. Invalid words: ${invalidWords.join(', ')}`
      });
      return;
    }

    // Check for duplicates
    const uniqueWords = [...new Set(allWords.map(word => word.toLowerCase()))];
    if (uniqueWords.length !== allWords.length) {
      showToast({
        type: 'warning',
        title: 'Duplicate words',
        message: 'Please select unique words (no duplicates).'
      });
      return;
    }

    setIsLoading(true);

    try {
      const apiEndpoint = '/api/wordcloud-polls/submit';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pagePath,
          pollIndex,
          question,
          maxWords,
          wordLimit,
          words: allWords,
          authCode: authCode || undefined
        }),
      });

      if (response.ok) {
        setHasVoted(true);
        // For /survey-results/* pages, don't auto-show aggregated results
        // Only show user's confirmation. Aggregated results shown via button.
        setUserWords(allWords);
        setShowChangeOption(false);
        // Update refs to track the newly submitted words
        const userWordsKey = JSON.stringify(allWords);
        lastAppliedUserWordsRef.current = userWordsKey;
        hasAppliedExistingWordsRef.current = true;
        
        // For CEW pages, don't save words locally for privacy
        if (pagePath.startsWith('/cew-polls/')) {
          // No persistence for CEW polls
        } else {
          // For authenticated users, persist vote locally
          sessionStorage.setItem(`wordcloud_vote_${pagePath}_${pollIndex}`, JSON.stringify(allWords));
        }
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, allWords);
        }
      } else {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        showToast({
          type: 'error',
          title: 'Unable to submit words',
          message: errorData.error ?? 'Please try again.'
        });
      }
    } catch (error) {
      console.error('Error submitting words:', error);
      showToast({
        type: 'error',
        title: 'Unable to submit words',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeWords = () => {
    setShowChangeOption(true);
    setHasVoted(false);
    // Apply existing words when entering change mode
    if (userWords) {
      const userWordsKey = JSON.stringify(userWords);
      applyExistingWords(userWords);
      lastAppliedUserWordsRef.current = userWordsKey;
      hasAppliedExistingWordsRef.current = true;
    }
  };

  const handleCancelChange = () => {
    setShowChangeOption(false);
    setHasVoted(true);
    // Restore the original words when canceling
    if (userWords) {
      const userWordsKey = JSON.stringify(userWords);
      applyExistingWords(userWords);
      lastAppliedUserWordsRef.current = userWordsKey;
      hasAppliedExistingWordsRef.current = true;
    }
  };


  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
      <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-8 text-center">
        {questionNumber && `Question ${questionNumber}: `}{question}
      </h3>
      
      {/* User's previous words indicator - always show when user has voted */}
      {hasVoted && userWords && userWords.length > 0 && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400 font-semibold">✓</span>
              <span className="text-green-800 dark:text-green-200">
                You submitted: <strong>{userWords.join(', ')}</strong>
              </span>
            </div>
            {!showChangeOption && !pagePath.startsWith('/cew-polls/') && (
              <button
                onClick={handleChangeWords}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Change Words
              </button>
            )}
          </div>
        </div>
      )}

      {/* View Results Button - Only show for /survey-results/* pages after submission */}
      {hasVoted && !showAggregatedResults && !pagePath.startsWith('/cew-polls/') && (
        <div className="mb-6 text-center">
          <button
            onClick={handleViewResults}
            disabled={isFetchingAggregated}
            className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
              isFetchingAggregated
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg transform hover:-translate-y-1'
            }`}
          >
            {isFetchingAggregated ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Loading...</span>
              </div>
            ) : (
              'View All Responses'
            )}
          </button>
        </div>
      )}
      
      {/* Change words mode indicator */}
      {showChangeOption && !pagePath.startsWith('/cew-polls/') && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-yellow-600 dark:text-yellow-400 font-semibold">🔄</span>
              <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                Enter new words to change your submission
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
      
      {/* Word Input Section */}
      {(!hasVoted || showChangeOption) && (
        <WordCloudInputSection
          maxWords={maxWords}
          wordLimit={wordLimit}
          predefinedOptions={predefinedOptions}
          selectedPredefined={selectedPredefined}
          customWords={customWords}
          isLoading={isLoading}
          onPredefinedToggle={handlePredefinedToggle}
          onCustomWordsChange={handleCustomWordsChange}
          onSubmit={handleSubmitWords}
          getAllSelectedWords={getAllSelectedWords}
          showChangeOption={showChangeOption}
        />
      )}

      {/* Results Visualization - Only show when aggregated results are requested */}
      {showAggregatedResults && (results?.words?.length > 0 || (userWords && userWords.length > 0)) && (
        <WordCloudResultsSection results={results} />
      )}
    </div>
  );
}
