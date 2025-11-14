// src/components/dashboard/wordcloud/SafeWordCloud.tsx
// Safe WordCloud component with error handling and validation

'use client';

import React from 'react';
import CustomWordCloud from '../CustomWordCloud';
import type { WordCloudData, WordCloudDisplayOptions } from './WordCloudTypes';

interface SafeWordCloudProps {
  words: WordCloudData[];
  options?: WordCloudDisplayOptions;
}

export default function SafeWordCloud({ words, options }: SafeWordCloudProps) {
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
}

