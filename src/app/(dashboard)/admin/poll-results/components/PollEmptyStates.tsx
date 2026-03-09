'use client';

import React from 'react';
import { PollResult } from '../types';

interface PollEmptyStatesProps {
  loading: boolean;
  pollResults: PollResult[];
  selectedQuestion: string | null;
  selectedPoll: PollResult | undefined;
  onRetry: () => void;
  error: string | null;
}

export default function PollEmptyStates({
  loading,
  pollResults,
  selectedQuestion,
  selectedPoll,
  onRetry,
  error
}: PollEmptyStatesProps) {
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 dark:border-sky-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Loading poll results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            Error
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-sky-600 dark:bg-sky-500 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (pollResults.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
          No Poll Results Yet
        </h3>
        <p className="text-slate-500 dark:text-slate-500">
          Poll results will appear here once users start voting.
        </p>
      </div>
    );
  }

  if (!selectedQuestion) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Select a Question
        </h3>
        <p className="text-slate-500 dark:text-slate-500">
          Choose a question from the left panel to view its results.
        </p>
      </div>
    );
  }

  if (!selectedPoll) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">❌</div>
        <h3 className="text-xl font-semibold text-slate-600 dark:text-slate-400 mb-2">
          Question Not Found
        </h3>
        <p className="text-slate-500 dark:text-slate-500">
          The selected question could not be found.
        </p>
      </div>
    );
  }

  return null;
}
