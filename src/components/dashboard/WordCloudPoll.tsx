'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ReactWordcloud from 'react-wordcloud';
// Note: react-wordcloud doesn't require separate CSS import

interface WordCloudData {
  text: string;
  value: number;
}

interface WordCloudPollProps {
  pollIndex: number;
  question: string;
  maxWords: number;
  wordLimit: number;
  pagePath: string;
  questionNumber?: number;
  authCode?: string;
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
  onVote 
}: WordCloudPollProps) {
  const [words, setWords] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    total_votes: number;
    words: WordCloudData[];
    user_words?: string[];
  } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [userWords, setUserWords] = useState<string[] | null>(null);
  const [showChangeOption, setShowChangeOption] = useState(false);

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

  const fetchResults = useCallback(async () => {
    try {
      console.log(`[WordCloudPoll ${pollIndex}] Fetching results for poll ${pollIndex} on page ${pagePath}`);
      
      const apiEndpoint = '/api/wordcloud-polls/results';
      let url = `${apiEndpoint}?pagePath=${encodeURIComponent(pagePath)}&pollIndex=${pollIndex}`;
      if (authCode) {
        url += `&authCode=${encodeURIComponent(authCode)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`[WordCloudPoll ${pollIndex}] API Response:`, data);
        setResults(data.results);
        
        // Check if user has already voted
        if (data.results?.user_words && data.results.user_words.length > 0) {
          console.log(`[WordCloudPoll ${pollIndex}] User has words:`, data.results.user_words);
          setUserWords(data.results.user_words);
          
          // For CEW pages, show previous words but don't disable submit button
          if (pagePath.startsWith('/cew-polls/')) {
            setShowResults(true);
            setWords(data.results.user_words);
          } else {
            // For authenticated pages, disable submit button as usual
            setHasVoted(true);
            setShowResults(true);
            setWords(data.results.user_words);
          }
        } else {
          console.log(`[WordCloudPoll ${pollIndex}] No user words found`);
        }
      } else {
        console.log(`[WordCloudPoll ${pollIndex}] Failed to fetch results:`, response.status);
      }
    } catch (error) {
      console.error(`[WordCloudPoll ${pollIndex}] Error fetching results:`, error);
    }
  }, [pagePath, pollIndex, authCode]);

  // Initialize and check for existing vote
  useEffect(() => {
    setWords([]);
    fetchResults();
    
    // Check for CEW words in sessionStorage
    if (pagePath.startsWith('/cew-polls/')) {
      checkCEWWordStatus();
    }
  }, [fetchResults]);

  const checkCEWWordStatus = () => {
    // For CEW pages, don't persist words at all - start fresh each time
    // This ensures true privacy in incognito mode
    console.log(`[WordCloudPoll ${pollIndex}] CEW poll - no word persistence for privacy`);
  };

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  const addWordField = () => {
    if (words.length < maxWords) {
      setWords([...words, '']);
    }
  };

  const removeWordField = (index: number) => {
    const newWords = words.filter((_, i) => i !== index);
    setWords(newWords);
  };

  const handleSubmitWords = async () => {
    if ((hasVoted && !showChangeOption) || isLoading) {
      return;
    }

    // Validate words
    const validWords = words.filter(word => word.trim().length > 0);
    
    if (validWords.length === 0) {
      alert('Please enter at least one word.');
      return;
    }

    if (validWords.length > maxWords) {
      alert(`Please enter no more than ${maxWords} words.`);
      return;
    }

    // Validate word length
    const invalidWords = validWords.filter(word => word.length > wordLimit);
    if (invalidWords.length > 0) {
      alert(`Words must be ${wordLimit} characters or less. Invalid words: ${invalidWords.join(', ')}`);
      return;
    }

    // Check for duplicates
    const uniqueWords = [...new Set(validWords.map(word => word.toLowerCase()))];
    if (uniqueWords.length !== validWords.length) {
      alert('Please enter unique words (no duplicates).');
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
          words: validWords,
          authCode: authCode || undefined
        }),
      });

      if (response.ok) {
        console.log(`Successfully submitted words for poll ${pollIndex}`);
        setHasVoted(true);
        setShowResults(true);
        setUserWords(validWords);
        setShowChangeOption(false);
        
        // Save words to sessionStorage for CEW pages
        // For CEW pages, don't save words locally for privacy
        if (pagePath.startsWith('/cew-polls/')) {
          console.log(`[WordCloudPoll ${pollIndex}] CEW poll - words submitted but not persisted locally for privacy`);
        }
        
        // Fetch updated results
        await fetchResults();
        
        // Call parent callback if provided
        if (onVote) {
          onVote(pollIndex, validWords);
        }
      } else {
        const errorData = await response.json();
        if (errorData.error) {
          alert(errorData.error);
        } else {
          alert('Failed to submit words. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error submitting words:', error);
      alert('Failed to submit words. Please try again.');
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Enter up to {maxWords} words (max {wordLimit} characters each):
            </label>
            <div className="space-y-3">
              {words.map((word, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => handleWordChange(index, e.target.value)}
                    placeholder={`Word ${index + 1}`}
                    maxLength={wordLimit}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[3rem]">
                    {word.length}/{wordLimit}
                  </span>
                  {words.length > 1 && (
                    <button
                      onClick={() => removeWordField(index)}
                      className="px-2 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {words.length < maxWords && (
                <button
                  onClick={addWordField}
                  className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                >
                  Add Word ({words.length}/{maxWords})
                </button>
              )}
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={handleSubmitWords}
              disabled={isLoading || words.filter(w => w.trim().length > 0).length === 0}
              className={`px-8 py-3 rounded-xl font-semibold transition-all duration-300 ${
                isLoading || words.filter(w => w.trim().length > 0).length === 0
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

      {/* Results Visualization */}
      {showResults && results && results.words && results.words.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
              Word Cloud Results ({results.total_votes} response{results.total_votes !== 1 ? 's' : ''})
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
              <ReactWordcloud
                words={results.words}
                options={wordCloudOptions}
              />
            </div>
          </div>
          
          {/* Word Frequency Table */}
          <div className="mt-6">
            <h5 className="text-md font-semibold text-gray-800 dark:text-white mb-3">
              Word Frequency
            </h5>
            <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
              <div className="max-h-48 overflow-y-auto">
                {results.words.map((word, index) => (
                  <div key={index} className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    <span className="font-medium text-gray-900 dark:text-white">{word.text}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min((word.value / Math.max(...results.words.map(w => w.value))) * 100, 100)}%` 
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
          </div>
        </div>
      )}
    </div>
  );
}
