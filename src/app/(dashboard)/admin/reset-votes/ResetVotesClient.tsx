'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetVotesClient() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const resetVotes = async (withBackup: boolean = false) => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      if (withBackup) {
        // Create backup tables first
        const backupResult = await supabase.rpc('create_vote_backup');
        if (backupResult.error) {
          throw new Error(`Backup failed: ${backupResult.error.message}`);
        }
      }

      // Clear poll votes
      const pollVotesResult = await supabase.from('poll_votes').delete().neq('id', 0);
      if (pollVotesResult.error) {
        throw new Error(`Failed to clear poll votes: ${pollVotesResult.error.message}`);
      }

      // Clear ranking votes
      const rankingVotesResult = await supabase.from('ranking_votes').delete().neq('id', 0);
      if (rankingVotesResult.error) {
        throw new Error(`Failed to clear ranking votes: ${rankingVotesResult.error.message}`);
      }

      setMessage(withBackup 
        ? '✅ Votes reset successfully! Backup created with timestamp.'
        : '✅ All poll votes have been reset to 0.'
      );

    } catch (err) {
      console.error('Error resetting votes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset votes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Reset Poll Votes
          </h1>
          
          <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              ⚠️ Warning
            </h2>
            <p className="text-yellow-700 dark:text-yellow-300">
              This action will permanently delete all poll votes from the database. 
              This should only be done before the actual event to ensure a clean start.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => resetVotes(true)}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset with Backup'}
              </button>
              
              <button
                onClick={() => resetVotes(false)}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition-colors disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Without Backup'}
              </button>
            </div>

            {message && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-200">{message}</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </div>

          <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              What This Does:
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li>• Deletes all votes from <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">poll_votes</code> table</li>
              <li>• Deletes all votes from <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">ranking_votes</code> table</li>
              <li>• Poll results views will automatically show 0 votes</li>
              <li>• This does NOT affect poll questions or options</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
