'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PollResult, MatrixData } from '../types';

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: PollResult[];
  timestamp: number;
}

// Global cache to share data across hook instances
const pollDataCache = new Map<string, CacheEntry>();

export function usePollData() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const supabase = useMemo(() => createClient(), []);
  const cacheKeyRef = useRef('poll_data_default');

  // Wrap fetchPollResults in useCallback to stabilize function reference
  const fetchPollResults = useCallback(async (forceRefresh = false) => {
    try {
      const cacheKey = cacheKeyRef.current;

      // Check cache if not forcing refresh
      if (!forceRefresh && pollDataCache.has(cacheKey)) {
        const cachedEntry = pollDataCache.get(cacheKey)!;
        const cacheAge = Date.now() - cachedEntry.timestamp;

        // Return cached data if still fresh (less than CACHE_DURATION_MS old)
        if (cacheAge < CACHE_DURATION_MS) {
          setPollResults(cachedEntry.data);
          setLoading(false);
          setError(null);
          return;
        }
      }

      setLoading(true);

      // Fetch single-choice, ranking, and wordcloud poll results with error handling
      const [singleChoiceResult, rankingResult, wordcloudResult] = await Promise.all([
        supabase.from('poll_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
        supabase.from('ranking_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
        supabase.from('wordcloud_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true })
      ]);

      // Handle errors gracefully without breaking admin status
      if (singleChoiceResult.error) {
        console.error('Error fetching single-choice poll results:', singleChoiceResult.error);
      }
      if (rankingResult.error) {
        console.error('Error fetching ranking poll results:', rankingResult.error);
      }
      if (wordcloudResult.error) {
        console.error('Error fetching wordcloud poll results:', wordcloudResult.error);
      }

      // Process results with fallback for missing data
      const singleChoiceData = singleChoiceResult.data || [];
      const rankingData = rankingResult.data || [];
      const wordcloudData = wordcloudResult.data || [];

      // Define current active polls to filter out old/test data
      const currentPollQuestions = [
        "Rank the importance of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = very important to 5 = not important)",
        "Rank the feasibility of updating CSR sediment standards for direct toxicity to ecological receptors (matrix standards, possibly based on SSDs). (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = very important to 5 = not important)",
        "Rank the feasibility of developing CSR sediment standards for direct toxicity to human receptors (matrix standards). (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing new CSR sediment standards for food-related toxicity to ecological receptors. (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing CSR sediment standards for food-related toxicity to human receptors. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing CSR sediment standards for food-related toxicity to human receptors. (1 = easily achievable to 5 = not feasible)",
        "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
        "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
        "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
        "Rank the importance of incorporating bioavailability adjustments into sediment standards. (1 = very important to 5 = not important)",
        "Rank the feasibility of incorporating bioavailability adjustments into sediment standards. (1 = easily achievable to 5 = not feasible)",
        "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve utility of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.",
        "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
        "Overall, what is the greatest constraint to advancing holistic sediment protection in BC?"
      ];

      // Group polls by question to combine survey-results and cew-polls data
      const pollGroups = new Map<string, {
        surveyPoll?: any;
        cewPoll?: any;
        isRanking: boolean;
        isWordcloud?: boolean;
        question: string;
        poll_index: number;
        options: string[];
      }>();

      // Process single-choice polls
      singleChoiceData.forEach(poll => {
        const matchesCurrentQuestion = currentPollQuestions.some(question => {
          const pollStart = poll.question.substring(0, 100).toLowerCase();
          const questionStart = question.substring(0, 100).toLowerCase();
          return pollStart.includes(questionStart.substring(0, 50)) ||
                 questionStart.includes(pollStart.substring(0, 50)) ||
                 pollStart.includes('matrix sediment standards') && questionStart.includes('matrix sediment standards');
        });

        if (!matchesCurrentQuestion) {
          return;
        }

        let key;
        if (poll.page_path.includes('holistic-protection')) {
          key = `holistic-protection_${poll.poll_index}`;
        } else if (poll.page_path.includes('tiered-framework')) {
          key = `tiered-framework_${poll.poll_index}`;
        } else if (poll.page_path.includes('prioritization')) {
          key = `prioritization_${poll.poll_index}`;
        } else if (poll.page_path.includes('wiks')) {
          key = `wiks_${poll.poll_index}`;
        } else {
          const topic = poll.page_path.split('/').pop() || 'unknown';
          key = `${topic}_${poll.poll_index}`;
        }

        if (!pollGroups.has(key)) {
          pollGroups.set(key, {
            isRanking: false,
            question: poll.question,
            poll_index: poll.poll_index,
            options: poll.options
          });
        }
        const group = pollGroups.get(key)!;
        if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
          group.surveyPoll = poll;
        } else if (poll.page_path.startsWith('/cew-polls')) {
          group.cewPoll = poll;
          if (poll.page_path.includes('holistic-protection')) {
            group.question = poll.question;
            group.options = poll.options;
          }
        }
      });

      // Process ranking polls
      rankingData.forEach(poll => {
        const matchesCurrentQuestion = currentPollQuestions.some(question => {
          const pollStart = poll.question.substring(0, 100).toLowerCase();
          const questionStart = question.substring(0, 100).toLowerCase();
          return pollStart.includes(questionStart.substring(0, 50)) ||
                 questionStart.includes(pollStart.substring(0, 50));
        });

        if (!matchesCurrentQuestion) {
          return;
        }

        let key;
        if (poll.page_path.includes('holistic-protection')) {
          key = `holistic-protection_${poll.poll_index}`;
        } else if (poll.page_path.includes('prioritization')) {
          key = `prioritization_${poll.poll_index}`;
        } else {
          const topic = poll.page_path.split('/').pop() || 'unknown';
          key = `${topic}_${poll.poll_index}`;
        }

        if (!pollGroups.has(key)) {
          pollGroups.set(key, {
            isRanking: true,
            question: poll.question,
            poll_index: poll.poll_index,
            options: poll.options
          });
        } else {
          const group = pollGroups.get(key)!;
          group.isRanking = true;
        }

        const group = pollGroups.get(key)!;
        if (poll.page_path.startsWith('/survey-results')) {
          group.surveyPoll = poll;
        } else if (poll.page_path.startsWith('/cew-polls')) {
          group.cewPoll = poll;
        }
      });

      // Process wordcloud polls
      wordcloudData.forEach(poll => {
        if (!poll.question.includes('constraint') && !poll.question.includes('focus')) {
          return;
        }

        let key;
        if (poll.page_path.includes('prioritization')) {
          key = `prioritization_${poll.poll_index}`;
        } else {
          const topic = poll.page_path.split('/').pop() || 'unknown';
          key = `${topic}_${poll.poll_index}`;
        }

        if (!pollGroups.has(key)) {
          pollGroups.set(key, {
            isRanking: false,
            isWordcloud: true,
            question: poll.question,
            poll_index: poll.poll_index,
            options: poll.options
          });
        } else {
          const group = pollGroups.get(key)!;
          group.isWordcloud = true;
        }

        const group = pollGroups.get(key)!;
        if (poll.page_path.startsWith('/survey-results')) {
          group.surveyPoll = poll;
        } else if (poll.page_path.startsWith('/cew-polls')) {
          group.cewPoll = poll;
        }
      });

      // Combine results from survey and CEW polls
      const combinedResults: any[] = [];

      pollGroups.forEach((group, key) => {
        const surveyPoll = group.surveyPoll;
        const cewPoll = group.cewPoll;

        let pollResults: any[] = [];
        let surveyResults: any[] = [];
        let cewResults: any[] = [];
        let surveyVotes = 0;
        let cewVotes = 0;
        let wordcloudWords: string[] | null = null;

        if (group.isWordcloud && surveyPoll) {
          const words = (surveyPoll.results || []).map((r: any) => r.text || r.word);
          wordcloudWords = Array.from(new Set(words));
          pollResults = surveyPoll.results || [];
        } else if (!group.isRanking && surveyPoll) {
          pollResults = surveyPoll.results || [];
          surveyVotes = surveyPoll.total_votes || 0;
          surveyResults = surveyPoll.results || [];

          if (cewPoll) {
            const cewPollResults = cewPoll.results || [];
            cewVotes = cewPoll.total_votes || 0;
            cewResults = cewPollResults;
            pollResults = [...surveyPoll.results || [], ...cewPollResults];
          }
        } else if (group.isRanking && surveyPoll) {
          pollResults = surveyPoll.results || [];
          surveyVotes = surveyPoll.total_votes || 0;
          surveyResults = surveyPoll.results || [];

          if (cewPoll) {
            const cewPollResults = cewPoll.results || [];
            cewVotes = cewPoll.total_votes || 0;
            cewResults = cewPollResults;
            pollResults = [...surveyPoll.results || [], ...cewPollResults];
          }
        } else if (cewPoll) {
          pollResults = cewPoll.results || [];
          cewVotes = cewPoll.total_votes || 0;
          cewResults = cewPoll.results || [];
        }

        const totalVotes = surveyVotes + cewVotes;

        const basePoll = surveyPoll || cewPoll;
        const combinedPoll = {
          ...basePoll,
          total_votes: totalVotes,
          results: pollResults,
          combined_survey_votes: surveyVotes,
          combined_cew_votes: cewVotes,
          is_ranking: group.isRanking,
          is_wordcloud: group.isWordcloud,
          wordcloud_words: group.isWordcloud ? (wordcloudWords || []) : undefined,
          page_path: surveyPoll?.page_path || cewPoll?.page_path || '/survey-results/holistic-protection',
          survey_results: surveyResults,
          cew_results: cewResults
        };

        combinedResults.push(combinedPoll);
      });

      // Sort by page path and poll index
      combinedResults.sort((a, b) => {
        if (a.page_path !== b.page_path) {
          return a.page_path.localeCompare(b.page_path);
        }
        return a.poll_index - b.poll_index;
      });

      // If no combined results, fallback to showing raw data
      let finalResults: PollResult[];
      if (combinedResults.length === 0) {
        finalResults = [
          ...singleChoiceData.map(poll => ({
            ...poll,
            is_ranking: false,
            combined_survey_votes: poll.total_votes || 0,
            combined_cew_votes: 0
          })),
          ...rankingData.map(poll => ({
            ...poll,
            is_ranking: true,
            combined_survey_votes: poll.total_votes || 0,
            combined_cew_votes: 0
          }))
        ];
      } else {
        finalResults = combinedResults;
      }

      // Cache the results
      pollDataCache.set(cacheKey, {
        data: finalResults,
        timestamp: Date.now()
      });

      setPollResults(finalResults);
    } catch (err) {
      console.error('Error fetching poll results:', err);
      setError('Failed to fetch poll results');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPollResults();
  }, [fetchPollResults]);

  // Function to manually clear cache (useful for admin updates)
  const clearCache = useCallback(() => {
    pollDataCache.delete(cacheKeyRef.current);
  }, []);

  // Function to refresh data, bypassing cache
  const refreshData = useCallback(() => {
    return fetchPollResults(true);
  }, [fetchPollResults]);

  return {
    pollResults,
    loading,
    error,
    matrixData,
    fetchPollResults,
    setMatrixData,
    clearCache,
    refreshData
  };
}
