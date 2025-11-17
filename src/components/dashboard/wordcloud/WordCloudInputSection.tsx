// src/components/dashboard/wordcloud/WordCloudInputSection.tsx
// Input section for WordCloud poll - handles predefined options and custom words

'use client';

import React from 'react';

interface WordCloudInputSectionProps {
  maxWords: number;
  wordLimit: number;
  predefinedOptions: Array<{ display: string; keyword: string }>;
  selectedPredefined: string[];
  customWords: string;
  isLoading: boolean;
  onPredefinedToggle: (keyword: string) => void;
  onCustomWordsChange: (value: string) => void;
  onSubmit: () => void;
  getAllSelectedWords: () => string[];
  showChangeOption?: boolean;
}

export default function WordCloudInputSection({
  maxWords,
  wordLimit,
  predefinedOptions,
  selectedPredefined,
  customWords,
  isLoading,
  onPredefinedToggle,
  onCustomWordsChange,
  onSubmit,
  getAllSelectedWords,
  showChangeOption = false
}: WordCloudInputSectionProps) {
  return (
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
                onClick={() => onPredefinedToggle(option.keyword)}
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
            onChange={(e) => onCustomWordsChange(e.target.value)}
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
          onClick={onSubmit}
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
  );
}

