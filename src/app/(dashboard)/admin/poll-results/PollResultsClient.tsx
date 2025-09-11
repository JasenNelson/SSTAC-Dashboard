'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PollResult {
  poll_id: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[];
  total_votes: number;
  results: Array<{
    option_index: number;
    option_text: string;
    votes: number;
  }>;
}

export default function PollResultsClient() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchPollResults();
  }, []);

  const fetchPollResults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('poll_results')
        .select('*')
        .order('page_path', { ascending: true })
        .order('poll_index', { ascending: true });

      if (error) {
        throw error;
      }

      setPollResults(data || []);
    } catch (err) {
      console.error('Error fetching poll results:', err);
      setError('Failed to fetch poll results');
    } finally {
      setLoading(false);
    }
  };

  const getPercentage = (votes: number, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  const getPageTitle = (pagePath: string) => {
    const pathMap: { [key: string]: string } = {
      '/survey-results/holistic-protection': 'Holistic Protection',
      '/survey-results/tiered-framework': 'Tiered Framework',
      '/survey-results/prioritization': 'Prioritization Framework',
      '/survey-results/wiks': 'Indigenous Knowledge & Science',
      '/cew-polls/holistic-protection': 'CEW: Holistic Protection',
      '/cew-polls/tiered-framework': 'CEW: Tiered Framework',
      '/cew-polls/prioritization': 'CEW: Prioritization',
      '/cew-polls/wiks': 'CEW: Indigenous Knowledge',
    };
    return pathMap[pagePath] || pagePath;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading poll results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchPollResults}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Poll Results Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">View and analyze poll responses from all survey theme pages</p>
        </div>

        {pollResults.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Poll Results Yet</h3>
            <p className="text-gray-500 dark:text-gray-500">Poll results will appear here once users start voting.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {pollResults.map((poll) => (
              <div key={poll.poll_id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      {getPageTitle(poll.page_path)} - Poll {poll.poll_index + 1}
                    </h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {poll.total_votes} total vote{poll.total_votes !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">{poll.question}</p>
                </div>

                <div className="space-y-3">
                  {poll.results.map((result) => {
                    const percentage = getPercentage(result.votes, poll.total_votes);
                    return (
                      <div key={result.option_index} className="flex items-center space-x-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {result.option_text}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {result.votes} vote{result.votes !== 1 ? 's' : ''} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={fetchPollResults}
            className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Refresh Results
          </button>
        </div>
      </div>
    </div>
  );
}
