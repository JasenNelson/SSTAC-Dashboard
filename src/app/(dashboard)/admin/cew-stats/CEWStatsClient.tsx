'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

interface VoteStats {
  totalVotes: number;
  anonymousVotes: number;
  authenticatedVotes: number;
  pageStats: {
    pagePath: string;
    pollIndex: number;
    question: string;
    totalVotes: number;
    anonymousVotes: number;
  }[];
}

export default function CEWStatsClient() {
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get all votes
      const { data: votes, error: votesError } = await supabase
        .from('poll_votes')
        .select(`
          poll_id,
          user_id,
          option_index,
          voted_at,
          polls!inner(page_path, poll_index, question)
        `)
        .order('voted_at', { ascending: false });

      if (votesError) {
        console.error('Error fetching votes:', votesError);
        return;
      }

      // Calculate stats
      const totalVotes = votes.length;
      const anonymousVotes = votes.filter(v => v.user_id.startsWith('anon_')).length;
      const authenticatedVotes = totalVotes - anonymousVotes;

      // Group by page and poll
      const pageStatsMap = new Map();
      votes.forEach((vote: any) => {
        const polls = vote.polls as any;
        const key = `${polls.page_path}_${polls.poll_index}`;
        if (!pageStatsMap.has(key)) {
          pageStatsMap.set(key, {
            pagePath: polls.page_path,
            pollIndex: polls.poll_index,
            question: polls.question,
            totalVotes: 0,
            anonymousVotes: 0
          });
        }
        
        const stat = pageStatsMap.get(key);
        stat.totalVotes++;
        if (vote.user_id.startsWith('anon_')) {
          stat.anonymousVotes++;
        }
      });

      const pageStats = Array.from(pageStatsMap.values());

      setStats({
        totalVotes,
        anonymousVotes,
        authenticatedVotes,
        pageStats
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          CEW Poll Statistics
        </h1>

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Total Votes
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {stats?.totalVotes || 0}
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Anonymous Votes
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {stats?.anonymousVotes || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats ? Math.round((stats.anonymousVotes / stats.totalVotes) * 100) : 0}% of total
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Authenticated Votes
            </h3>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              {stats?.authenticatedVotes || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats ? Math.round((stats.authenticatedVotes / stats.totalVotes) * 100) : 0}% of total
            </p>
          </div>
        </div>

        {/* Page Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            Poll Breakdown
          </h2>
          
          <div className="space-y-4">
            {stats?.pageStats.map((pageStat, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {pageStat.pagePath} - Question {pageStat.pollIndex}
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {pageStat.totalVotes} total votes
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                  {pageStat.question}
                </p>
                <div className="flex space-x-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">
                    {pageStat.anonymousVotes} anonymous
                  </span>
                  <span className="text-purple-600 dark:text-purple-400">
                    {pageStat.totalVotes - pageStat.anonymousVotes} authenticated
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={fetchStats}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Refresh Stats
          </button>
        </div>
      </div>
    </div>
  );
}
