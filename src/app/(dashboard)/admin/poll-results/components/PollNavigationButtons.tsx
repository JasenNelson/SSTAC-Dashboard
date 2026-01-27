'use client';

import React from 'react';

interface PollNavigationButtonsProps {
  leftPanelVisible: boolean;
  onShowPanel: () => void;
  onRefresh: () => void;
}

export default function PollNavigationButtons({
  leftPanelVisible,
  onShowPanel,
  onRefresh
}: PollNavigationButtonsProps) {
  if (leftPanelVisible) {
    return null;
  }

  return (
    <>
      {/* Show Panel Button */}
      <div className="fixed left-4 top-20 z-50">
        <button
          onClick={onShowPanel}
          className="flex items-center justify-center w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
          title="Show filter panel"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 5l7 7-7 7M5 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      {/* Refresh Results Button */}
      <div className="fixed left-4 top-32 z-50">
        <button
          onClick={onRefresh}
          className="flex items-center justify-center w-12 h-12 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
          title="Refresh results"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </>
  );
}
