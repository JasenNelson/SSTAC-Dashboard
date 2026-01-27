'use client';

import React, { useState, useEffect, useCallback } from 'react';
import CustomWordCloud from './CustomWordCloud';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
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

// Safe WordCloud Component with additional error handling
const SafeWordCloud = ({ words, options }: { words: WordCloudData[]; options?: WordCloudOptions }) => {
  try {
    // Additional validation - ensure words is an array
    if (!Array.isArray(words)) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <p>Invalid data format</p>
          </div>
        </div>
      );
    }

    const safeWords = words.filter(word => {
      const isValid = word &&
        typeof word === 'object' &&
        word.text &&
        typeof word.text === 'string' &&
        word.text.trim().length > 0 &&
        typeof word.value === 'number' &&
        word.value > 0;
      
      return isValid;
    });

    if (safeWords.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="text-4xl mb-2">☁️</div>
            <p>No valid words to display</p>
          </div>
        </div>
      );
    }

    // Use our custom wordcloud component
    return (
      <CustomWordCloud
        words={safeWords}
        colors={options?.colors || ['#1e40af', '#2563eb', '#3b82f6']}
        fontFamily={options?.fontFamily || 'Inter, system-ui, sans-serif'}
        fontWeight={options?.fontWeight || 'normal'}
        minSize={12}
        maxSize={60}
      />
    );
  } catch (error) {
    console.error('SafeWordCloud Error:', error);
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p>Error rendering wordcloud</p>
        </div>
      </div>
    );
  }
};

interface WordCloudData {
  text: string;
  value: number;
}

interface WordCloudOptions {
  colors?: string[];
  fontFamily?: string;
  fontWeight?: string;
  enableTooltip?: boolean;
  deterministic?: boolean;
  fontSizes?: [number, number];
  fontStyle?: string;
  padding?: number;
  rotations?: number;
  rotationAngles?: [number, number];
  scale?: string;
  spiral?: string;
  transitionDuration?: number;
}

interface WordCloudPollProps {
  pollIndex: number;
  question: string;
  maxWords: number;
  wordLimit: number;
  pagePath: string;
  questionNumber?: number;
  authCode?: string;
  predefinedOptions?: Array<{ display: string; keyword: string }>;
  onVote?: (pollIndex: number, words: string[]) => void;
}

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
  const [words, setWords] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    total_votes: number;
    words: WordCloudData[];
    user_words?: string[];
  }>({
    total_votes: 0,
    words: [],
    user_words: []
  });
  const [_showResults, setShowResults] = useState(false);
  const [showAggregatedResults, setShowAggregatedResults] = useState(false);
  const [isFetchingAggregated, setIsFetchingAggregated] = useState(false);
  const [userWords, setUserWords] = useState<string[] | null>(null);
  const [showChangeOption, setShowChangeOption] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState<string[]>([]);
  const [customWords, setCustomWords] = useState<string>('');
  const [isFetching, setIsFetching] = useState(false);

  // Handle predefined option selection
  const handlePredefinedToggle = (keyword: string) => {
    setSelectedPredefined(prev => {
      if (prev.includes(keyword)) {
        return prev.filter(k => k !== keyword);
      } else {
        // Check if we're at max words limit
        if (prev.length >= maxWords) {
          alert(`You can only select up to ${maxWords} words.`);
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

  // Aquatic blue/green color schemes for word cloud
  const colorSchemes = {
    aquatic: {
      colors: ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'],
      background: 'transparent'
    },
    ocean: {
      colors: ['#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1'],
      background: 'transparent'
    },
    marine: {
      colors: ['#1e3a8a', '#1e40af', '#3b82f6', '#06b6d4', '#0891b2', '#0e7490'],
      background: 'transparent'
    },
    teal: {
      colors: ['#134e4a', '#0f766e', '#14b8a6', '#2dd4bf', '#5eead4', '#a7f3d0'],
      background: 'transparent'
    }
  };

  const [selectedColorScheme, setSelectedColorScheme] = useState<keyof typeof colorSchemes>('aquatic');

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
        alert('Failed to load aggregated results. Please try again.');
      }
    } catch (error) {
      console.error(`[WordCloudPoll ${pollIndex}] Error fetching aggregated results:`, error);
      alert('Failed to load aggregated results. Please try again.');
    } finally {
      setIsFetchingAggregated(false);
    }
  };

  const fetchResults = useCallback(async () => {
    if (isFetching) return; // Prevent multiple simultaneous calls
    
    setIsFetching(true);
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
          setShowResults(false);
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
      setIsFetching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePath, pollIndex, authCode]); // isFetching is intentionally excluded to prevent loops

  // Initialize and check for existing vote
  useEffect(() => {
    setWords([]);
    
    // Add a small delay to prevent rapid successive calls
    const timeoutId = setTimeout(() => {
      fetchResults();
    }, 100);
    
    // Check for CEW words in sessionStorage
    if (pagePath.startsWith('/cew-polls/')) {
      checkCEWWordStatus();
    }
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePath, pollIndex, authCode]); // fetchResults is stable and depends on the same deps

  const checkCEWWordStatus = () => {
    // For CEW pages, don't persist words at all - start fresh each time
    // This ensures true privacy in incognito mode
  };

  const _handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  const _addWordField = () => {
    if (words.length < maxWords) {
      setWords([...words, '']);
    }
  };

  const _removeWordField = (index: number) => {
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
  };

  const handleSubmitWords = async () => {
    if ((hasVoted && !showChangeOption) || isLoading) {
      return;
    }

    // Get all selected words (predefined + custom)
    const allWords = getAllSelectedWords();
    
    if (allWords.length === 0) {
      alert('Please select at least one option or enter custom words.');
      return;
    }

    if (allWords.length > maxWords) {
      alert(`Please select no more than ${maxWords} words total.`);
      return;
    }

    // Validate word length
    const invalidWords = allWords.filter(word => word.length > wordLimit);
    if (invalidWords.length > 0) {
      alert(`Words must be ${wordLimit} characters or less. Invalid words: ${invalidWords.join(', ')}`);
      return;
    }

    // Check for duplicates
    const uniqueWords = [...new Set(allWords.map(word => word.toLowerCase()))];
    if (uniqueWords.length !== allWords.length) {
      alert('Please select unique words (no duplicates).');
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
        if (pagePath.startsWith('/cew-polls/')) {
          // CEW pages: don't show results at all (privacy)
          setShowResults(false);
        } else {
          // Survey-results pages: don't auto-show aggregated results
          setShowResults(false);
        }
        setUserWords(allWords);
        setShowChangeOption(false);
        
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
        if (errorData.error) {
          alert(`Error: ${errorData.error}`);
        } else {
          alert('Failed to submit words. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error submitting words:', error);
      alert(`Failed to submit words: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeWords = () => {
    setShowChangeOption(true);
    setHasVoted(false);
    setWords([]);
  };

  const handleCancelChange = () => {
    setShowChangeOption(false);
    setHasVoted(true);
    setWords(userWords || []);
  };

  const wordCloudOptions = {
    colors: colorSchemes[selectedColorScheme].colors,
    enableTooltip: true,
    deterministic: false,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizes: [12, 60] as [number, number],
    fontStyle: 'normal' as const,
    fontWeight: 'normal' as const,
    padding: 1,
    rotations: 3,
    rotationAngles: [0, 90] as [number, number],
    scale: 'sqrt' as const,
    spiral: 'archimedean' as const,
    transitionDuration: 1000,
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
        <div className="mb-8">
          {/* Predefined Options */}
          {predefinedOptions.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Choose ONE option below OR enter custom words (not both):
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {predefinedOptions.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handlePredefinedToggle(option.keyword)}
                    className={`p-4 text-left rounded-lg border-2 transition-all duration-200 ${
                      selectedPredefined.includes(option.keyword)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-500'
                    }`}
                  >
                    <div className="font-medium">{option.display}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Will submit: <strong>{option.keyword}</strong>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                Selected: {selectedPredefined.length} option{selectedPredefined.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* Custom Words Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Or enter custom words (up to {maxWords} words, {wordLimit} characters each):
            </label>
            <div className="relative">
              <input
                type="text"
                value={customWords}
                onChange={(e) => handleCustomWordsChange(e.target.value)}
                placeholder="Enter custom words separated by spaces"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                style={{ 
                  pointerEvents: 'auto',
                  position: 'relative',
                  zIndex: 10
                }}
                autoComplete="off"
              />
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {customWords.trim() ? `${customWords.trim().split(/\s+/).filter(w => w.length > 0).length} custom words` : 'No custom words entered'}
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={handleSubmitWords}
              disabled={isLoading || getAllSelectedWords().length === 0}
              className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
                isLoading || getAllSelectedWords().length === 0
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
                showChangeOption ? 'Update Words' : 'Submit Words'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Results Visualization - Only show when aggregated results are requested */}
      {showAggregatedResults && (results?.words?.length > 0 || (userWords && userWords.length > 0)) && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
              Word Cloud Results ({results.total_votes || 0} response{(results.total_votes || 0) !== 1 ? 's' : ''})
            </h4>
            
            {/* Color Scheme Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Color:</span>
              <select
                value={selectedColorScheme}
                onChange={(e) => setSelectedColorScheme(e.target.value as keyof typeof colorSchemes)}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="aquatic">Aquatic Blue</option>
                <option value="ocean">Ocean Teal</option>
                <option value="marine">Marine Blue</option>
                <option value="teal">Deep Teal</option>
              </select>
            </div>
          </div>
          
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner">
              <div style={{ height: '400px', width: '100%' }}>
                {(() => {
                  // Show aggregated words from ALL users
                  const wordsToShow = results.words || [];
                  
                  if (!wordsToShow || !Array.isArray(wordsToShow) || wordsToShow.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">☁️</div>
                          <p>No words submitted yet</p>
                          <p className="text-sm">Be the first to submit words!</p>
                        </div>
                      </div>
                    );
                  }
                  
                  const validWords = wordsToShow.filter(word => 
                    word && 
                    typeof word === 'object' && 
                    word.text && 
                    typeof word.text === 'string' && 
                    word.text.trim().length > 0 && 
                    typeof word.value === 'number' && 
                    word.value > 0
                  );
                  
                  
                  if (validWords.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">⚠️</div>
                          <p>No valid words to display</p>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <ErrorBoundary fallback={
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">⚠️</div>
                          <p>Error displaying wordcloud</p>
                          <p className="text-sm">Please refresh the page</p>
                        </div>
                      </div>
                    }>
                      <SafeWordCloud
                        words={validWords}
                        options={wordCloudOptions}
                      />
                    </ErrorBoundary>
                  );
                })()}
              </div>
            </div>
          
          {/* Word Frequency Table */}
          {results.words && results.words.length > 0 && (
            <div className="mt-6">
              <h5 className="text-md font-semibold text-gray-800 dark:text-white mb-3">
                Word Frequency
              </h5>
              <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
                <div className="max-h-48 overflow-y-auto">
                  {(() => {
                    // Show aggregated words from ALL users
                    const wordsToShow = results.words || [];
                    
                    const maxValue = Math.max(...wordsToShow.map(w => w.value));
                    
                    return wordsToShow.map((word, index) => (
                      <div key={index} className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <span className="font-medium text-gray-900 dark:text-white">{word.text}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${Math.min((word.value / maxValue) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 min-w-[2rem] text-right">
                            {word.value}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
