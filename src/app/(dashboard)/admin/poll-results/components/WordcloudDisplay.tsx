'use client';

import React, { Suspense, lazy } from 'react';
import { PollResult } from '../types';

// Lazy load CustomWordCloud since it's a heavy canvas-based component
const CustomWordCloud = lazy(() => import('@/components/dashboard/CustomWordCloud'));

interface WordcloudDisplayProps {
  selectedPoll: PollResult;
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

function WordcloudDisplay({ selectedPoll }: WordcloudDisplayProps) {
  return (
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
                <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading wordcloud...</div>}>
                  <CustomWordCloud
                    words={selectedPoll.wordcloud_words}
                    colors={['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']}
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="normal"
                    minSize={12}
                    maxSize={60}
                  />
                </Suspense>
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
  );
}

export default React.memo(WordcloudDisplay);
