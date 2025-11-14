// src/components/dashboard/wordcloud/WordCloudResultsSection.tsx
// Results section for WordCloud poll - displays word cloud and frequency table

'use client';

import React, { useState } from 'react';
import SafeWordCloud from './SafeWordCloud';
import { WordCloudErrorBoundary } from './WordCloudErrorBoundary';
import type { WordCloudData, ColorSchemeKey } from './WordCloudTypes';
import { COLOR_SCHEMES } from './WordCloudTypes';

interface WordCloudResultsSectionProps {
  results: {
    total_votes: number;
    words: WordCloudData[];
  };
}

export default function WordCloudResultsSection({ results }: WordCloudResultsSectionProps) {
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorSchemeKey>('aquatic');

  const wordCloudOptions = {
    colors: COLOR_SCHEMES[selectedColorScheme].colors,
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

  const wordsToShow = results.words || [];
  
  if (!wordsToShow || !Array.isArray(wordsToShow) || wordsToShow.length === 0) {
    return (
      <div className="mt-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner">
          <div className="flex items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">☁️</div>
              <p>No words submitted yet</p>
              <p className="text-sm">Be the first to submit words!</p>
            </div>
          </div>
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
      <div className="mt-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner">
          <div className="flex items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <p>No valid words to display</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...wordsToShow.map(w => w.value));

  return (
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
            onChange={(e) => setSelectedColorScheme(e.target.value as ColorSchemeKey)}
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
          <WordCloudErrorBoundary fallback={
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
          </WordCloudErrorBoundary>
        </div>
      </div>
      
      {/* Word Frequency Table */}
      {wordsToShow.length > 0 && (
        <div className="mt-6">
          <h5 className="text-md font-semibold text-gray-800 dark:text-white mb-3">
            Word Frequency
          </h5>
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
            <div className="max-h-48 overflow-y-auto">
              {wordsToShow.map((word, index) => (
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

