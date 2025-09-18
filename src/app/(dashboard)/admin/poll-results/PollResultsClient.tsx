'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PollResult {
  poll_id?: string;
  ranking_poll_id?: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[];
  total_votes: number;
  results: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  is_ranking?: boolean;
  combined_survey_votes?: number;
  combined_cew_votes?: number;
  survey_results?: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  cew_results?: Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
}

export default function PollResultsClient() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'twg' | 'cew'>('all');
  const supabase = createClient();

  useEffect(() => {
    fetchPollResults();
  }, []);

  const fetchPollResults = async () => {
    try {
      setLoading(true);
      
      // Fetch both single-choice and ranking poll results
      const [singleChoiceResult, rankingResult] = await Promise.all([
        supabase.from('poll_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
        supabase.from('ranking_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true })
      ]);

      

      if (singleChoiceResult.error) throw singleChoiceResult.error;
      if (rankingResult.error) throw rankingResult.error;

      // Debug: Log raw data for all polls
      console.log('🔍 Raw single-choice data:', singleChoiceResult.data);
      console.log('🔍 Raw ranking data:', rankingResult.data);
      
      // Debug: Log specific data for tiered-framework
      console.log('🔍 Raw single-choice data for tiered-framework:', 
        (singleChoiceResult.data || []).filter(p => p.page_path.includes('tiered-framework'))
      );
      console.log('🔍 Raw ranking data for tiered-framework:', 
        (rankingResult.data || []).filter(p => p.page_path.includes('tiered-framework'))
      );

      // Define current active polls to filter out old/test data
      // Use more specific matching patterns to avoid false positives
      const currentPollQuestions = [
        // Holistic Protection Questions
        "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
        "What is the most important consideration when developing sediment quality standards that protect both ecological and human health?",
        "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
        
        // Tiered Framework Questions
        "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
        "What is the most important factor for determining which tier a contaminated site should be assigned to in a tiered framework?",
        "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment",
        
        // WIKS Questions
        "What is the most effective starting point for developing a holistic baseline study that combines co-located sampling",
        "How can the scientific framework incorporate protection goals related to Indigenous Stewardship principles",
        "Within a tiered framework, where can place-based Indigenous Knowledge provide the most direct scientific value",
        
        // Prioritization Questions
        "Which scientific approach to bioavailability holds the most promise for practical and defensible application",
        "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap",
        "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments",
        "Please rank these potential feasibility criteria to help inform the development of a prioritization framework",
        "Please rank these timeframe considerations for developing a prioritization framework and strategic planning",
        "Based on Today's discussion and your experience, please rank these four areas for modernization priority",
        "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible",
        "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical",
        "To support long-term (5+ years) strategic goals, please rank the following foundational research areas"
      ];

      // Group polls by question to combine survey-results and cew-polls data
      const pollGroups = new Map<string, {
        surveyPoll?: any;
        cewPoll?: any;
        isRanking: boolean;
        question: string;
        poll_index: number;
        options: string[];
      }>();

      // Process single-choice polls
      (singleChoiceResult.data || []).forEach(poll => {
        // Only process polls that match current active questions
        const matchesCurrentQuestion = currentPollQuestions.some(question => 
          poll.question.includes(question.substring(0, 50)) || 
          question.includes(poll.question.substring(0, 50))
        );
        if (!matchesCurrentQuestion) {
          return;
        }
        
        
        // Create a key that groups polls by topic and poll_index, regardless of page_path
        // Use consistent keys for all topics to group survey and CEW polls together
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
          // For any other topics, extract the topic name from the page path
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
          // For Holistic Protection, prefer the CEW question text
          if (poll.page_path.includes('holistic-protection')) {
            group.question = poll.question;
            group.options = poll.options;
          }
        }
      });

      // Process ranking polls
      (rankingResult.data || []).forEach(poll => {
        // Only process polls that match current active questions
        const matchesCurrentQuestion = currentPollQuestions.some(question => 
          poll.question.includes(question.substring(0, 50)) || 
          question.includes(poll.question.substring(0, 50))
        );
        if (!matchesCurrentQuestion) {
          return;
        }
        
        
        // Create a key that groups polls by topic and poll_index, regardless of page_path
        // Use consistent keys for all topics to group survey and CEW polls together
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
          // For any other topics, extract the topic name from the page path
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
          // If group already exists, ensure it's marked as ranking
          const group = pollGroups.get(key)!;
          group.isRanking = true;
        }
        const group = pollGroups.get(key)!;
        if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
          group.surveyPoll = poll;
        } else if (poll.page_path.startsWith('/cew-polls')) {
          group.cewPoll = poll;
          // For Holistic Protection, prefer the CEW question text
          if (poll.page_path.includes('holistic-protection')) {
            group.question = poll.question;
            group.options = poll.options;
          }
        }
      });

      // Combine results for each group
      const combinedResults: PollResult[] = [];
      
      
      pollGroups.forEach((group, key) => {
        const surveyPoll = group.surveyPoll;
        const cewPoll = group.cewPoll;

        let totalVotes = 0;
        let surveyVotes = 0;
        let cewVotes = 0;
        let pollResults: any[] = [];
        let surveyResults: any[] = [];
        let cewResults: any[] = [];

        // Calculate vote counts based on poll type
        if (group.isRanking) {
          // For ranking polls, use total_votes field which represents unique participants
          // Each user ranks ALL options, so total_votes = number of participants
          surveyVotes = surveyPoll ? (surveyPoll.total_votes || 0) : 0;
          cewVotes = cewPoll ? (cewPoll.total_votes || 0) : 0;
        } else {
          // For single-choice polls, sum up all votes in the results
          // Each user selects ONE option, so sum of votes = total responses
          surveyVotes = surveyPoll ? (surveyPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;
          cewVotes = cewPoll ? (cewPoll.results || []).reduce((sum: number, result: any) => sum + (result.votes || 0), 0) : 0;
        }
        totalVotes = surveyVotes + cewVotes;

        if (group.isRanking) {
          // For ranking polls, we need to handle this differently
          // Each person ranks ALL options, so we can't just sum votes
          // We need to combine the ranking data properly
          
          if (surveyPoll && cewPoll) {
            // Store original results separately
            surveyResults = (surveyPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: surveyVotes, // Use participant count for ranking polls
              averageRank: result.averageRank || 0
            })).sort((a: any, b: any) => a.averageRank - b.averageRank);
            
            cewResults = (cewPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: cewVotes, // Use participant count for ranking polls
              averageRank: result.averageRank || 0
            })).sort((a: any, b: any) => a.averageRank - b.averageRank);
            
            // Combine them for "all" mode
            const allResults = [...(surveyPoll.results || []), ...(cewPoll.results || [])];
            
            const optionMap = new Map<number, { 
              totalRank: number, 
              count: number, 
              option_text: string
            }>();
            
            allResults.forEach(result => {
              if (!optionMap.has(result.option_index)) {
                optionMap.set(result.option_index, {
                  totalRank: 0,
                  count: 0,
                  option_text: result.option_text || group.options[result.option_index] || ''
                });
              }
              const option = optionMap.get(result.option_index)!;
              option.totalRank += (result.averageRank || 0) * (result.votes || 0);
              option.count += result.votes || 0;
            });
            
            pollResults = Array.from(optionMap.entries()).map(([optionIndex, data]) => ({
              option_index: optionIndex,
              option_text: data.option_text,
              votes: totalVotes, // For ranking polls, votes should represent total participants
              averageRank: data.count > 0 ? data.totalRank / data.count : 0
            })).sort((a: any, b: any) => a.averageRank - b.averageRank);
          } else if (surveyPoll) {
            // Only survey data
            surveyResults = (surveyPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: surveyVotes, // Use participant count for ranking polls
              averageRank: result.averageRank || 0
            })).sort((a: any, b: any) => a.averageRank - b.averageRank);
            pollResults = surveyResults;
          } else if (cewPoll) {
            // Only CEW data
            cewResults = (cewPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: cewVotes, // Use participant count for ranking polls
              averageRank: result.averageRank || 0
            })).sort((a: any, b: any) => a.averageRank - b.averageRank);
            pollResults = cewResults;
          } else {
            pollResults = [];
          }

        } else {
          // Combine single-choice poll results
          const optionMap = new Map<number, { votes: number, option_text: string }>();
          
          [...(surveyPoll?.results || []), ...(cewPoll?.results || [])].forEach(result => {
            if (!optionMap.has(result.option_index)) {
              optionMap.set(result.option_index, {
                votes: 0,
                option_text: result.option_text || group.options[result.option_index] || ''
              });
            }
            optionMap.get(result.option_index)!.votes += result.votes || 0;
          });
          
          pollResults = Array.from(optionMap.entries()).map(([optionIndex, data]) => ({
            option_index: optionIndex,
            option_text: data.option_text,
            votes: data.votes
          })).sort((a, b) => b.votes - a.votes);
        }

        // Create combined poll result
        const basePoll = surveyPoll || cewPoll;
        const combinedPoll = {
          ...basePoll,
          total_votes: totalVotes, // Use calculated total instead of database total_votes
          results: pollResults,
          combined_survey_votes: surveyVotes, // Use calculated survey votes
          combined_cew_votes: cewVotes, // Use calculated CEW votes
          is_ranking: group.isRanking,
          page_path: surveyPoll?.page_path || cewPoll?.page_path || '/survey-results/holistic-protection',
          survey_results: surveyResults,
          cew_results: cewResults
        };

        
        
        
        
        // Debug logging for WIKS polls
        if (key.includes('wiks')) {
          console.log('🔍 DEBUG: WIKS Poll:', {
            key,
            page_path: combinedPoll.page_path,
            question: combinedPoll.question.substring(0, 100) + '...',
            surveyVotes,
            cewVotes,
            totalVotes,
            combined_survey_votes: combinedPoll.combined_survey_votes,
            combined_cew_votes: combinedPoll.combined_cew_votes,
            isRanking: group.isRanking,
            surveyPoll: surveyPoll ? { total_votes: surveyPoll.total_votes, results_count: surveyPoll.results?.length, page_path: surveyPoll.page_path } : null,
            cewPoll: cewPoll ? { total_votes: cewPoll.total_votes, results_count: cewPoll.results?.length, page_path: cewPoll.page_path } : null
          });
        }

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
      if (combinedResults.length === 0) {
        const fallbackResults = [
          ...(singleChoiceResult.data || []).map(poll => ({ 
            ...poll, 
            is_ranking: false,
            combined_survey_votes: poll.total_votes || 0,
            combined_cew_votes: 0
          })),
          ...(rankingResult.data || []).map(poll => ({ 
            ...poll, 
            is_ranking: true,
            combined_survey_votes: poll.total_votes || 0,
            combined_cew_votes: 0
          }))
        ];
        setPollResults(fallbackResults);
      } else {
        setPollResults(combinedResults);
      }
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

  const filteredPolls = useMemo(() => {
    if (filterMode === 'all') {
      return pollResults;
    }
    
    return pollResults.filter(poll => {
      if (filterMode === 'twg') {
        return (poll.combined_survey_votes || 0) > 0;
      } else if (filterMode === 'cew') {
        return (poll.combined_cew_votes || 0) > 0;
      }
      return true;
    });
  }, [pollResults, filterMode]);

  const getFilteredVoteCounts = () => {
    return {
      twg: filteredPolls.reduce((sum, poll) => sum + (poll.combined_survey_votes || 0), 0),
      cew: filteredPolls.reduce((sum, poll) => sum + (poll.combined_cew_votes || 0), 0),
      total: filteredPolls.reduce((sum, poll) => sum + poll.total_votes, 0)
    };
  };

  // Get filtered results for a specific poll based on filter mode
  const getFilteredPollResults = (poll: PollResult) => {
    if (filterMode === 'all') {
      return poll.results;
    }
    
    if (poll.is_ranking) {
      // For ranking polls, use the original survey or CEW results
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
      // Fallback to combined results if original data not available
      return poll.results;
    } else {
      // For single-choice polls, scale down the combined results proportionally
      if (filterMode === 'twg') {
        const scaleFactor = (poll.combined_survey_votes || 0) / (poll.total_votes || 1);
        return poll.results.map(result => ({
          ...result,
          votes: Math.round(result.votes * scaleFactor)
        }));
      } else if (filterMode === 'cew') {
        const scaleFactor = (poll.combined_cew_votes || 0) / (poll.total_votes || 1);
        return poll.results.map(result => ({
          ...result,
          votes: Math.round(result.votes * scaleFactor)
        }));
      }
    }
    
    return poll.results;
  };

  const getPageTitle = (pagePath: string) => {
    const pathMap: { [key: string]: string } = {
      '/survey-results/holistic-protection': 'Holistic Protection',
      '/survey-results/tiered-framework': 'Tiered Framework',
      '/survey-results/prioritization': 'Prioritization Framework',
      '/survey-results/wiks': 'Weaving Indigenous Knowledge & Science',
      '/survey-results/effectiveness': 'Effectiveness of Current Standards',
      '/survey-results/technical-standards': 'Technical Standards',
      '/survey-results/detailed-findings': 'Detailed Findings',
      '/wiks': 'Weaving Indigenous Knowledge & Science',
      '/cew-polls/holistic-protection': 'Holistic Protection', // Same as survey-results
      '/cew-polls/tiered-framework': 'Tiered Framework', // Same as survey-results
      '/cew-polls/prioritization': 'Prioritization Framework', // Same as survey-results
      '/cew-polls/wiks': 'Weaving Indigenous Knowledge & Science',
    };
    return pathMap[pagePath] || pagePath;
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const groupPollsByTheme = (polls: PollResult[]) => {
    const themes = {
      'holistic-protection': {
        name: 'Holistic Protection',
        polls: polls.filter(poll => 
          poll.page_path.includes('holistic-protection')
        )
      },
      'tiered-framework': {
        name: 'Tiered Framework',
        polls: polls.filter(poll => 
          poll.page_path.includes('tiered-framework')
        )
      },
      'prioritization': {
        name: 'Prioritization',
        polls: polls.filter(poll => 
          poll.page_path.includes('prioritization')
        )
      },
      'wiks': {
        name: 'Weaving Indigenous Knowledge & Science',
        polls: polls.filter(poll => 
          poll.page_path.includes('wiks')
        )
      }
    };
    return themes;
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Fixed Left Panel */}
      <div className="fixed left-0 top-0 w-80 h-screen bg-white dark:bg-gray-800 shadow-lg border-r border-gray-200 dark:border-gray-700 flex-shrink-0 overflow-y-auto z-10">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Filter Results</h2>
          
          {/* Filter Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setFilterMode('twg')}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                filterMode === 'twg'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              SSTAC & TWG Only
            </button>
            <button
              onClick={() => setFilterMode('cew')}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                filterMode === 'cew'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              CEW Only
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${
                filterMode === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All Responses
            </button>
          </div>

          {/* Poll Question Groups */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Poll Groups</h3>
            <div className="space-y-2">
              <button
                onClick={() => scrollToSection('holistic-protection')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors text-left bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-blue-100 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              >
                Holistic Protection
              </button>
              <button
                onClick={() => scrollToSection('tiered-framework')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors text-left bg-orange-50 dark:bg-orange-600/20 text-gray-900 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-600/30"
              >
                Tiered Framework
              </button>
              <button
                onClick={() => scrollToSection('prioritization')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors text-left bg-purple-50 dark:bg-purple-900/20 text-gray-900 dark:text-purple-100 hover:bg-purple-100 dark:hover:bg-purple-900/30"
              >
                Prioritization
              </button>
              <button
                onClick={() => scrollToSection('wiks')}
                className="w-full px-4 py-3 rounded-lg font-medium transition-colors text-left bg-green-50 dark:bg-green-800/20 text-gray-900 dark:text-green-100 hover:bg-green-100 dark:hover:bg-green-800/30"
              >
                Weaving Indigenous Knowledge & Science
              </button>
            </div>
          </div>
          
          {/* Refresh Button */}
          <div className="mt-6">
            <button
              onClick={fetchPollResults}
              disabled={loading}
              className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Refreshing...
                </>
              ) : (
                <>
                  🔄 Refresh Results
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto ml-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Live Poll Results Dashboard</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">Combined results from TWG & SSTAC members (via dashboard) and CEW conference attendees (live event)</p>
        </div>

        {pollResults.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Poll Results Yet</h3>
            <p className="text-gray-500 dark:text-gray-500">Poll results will appear here once users start voting.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(groupPollsByTheme(filteredPolls)).map(([themeId, theme]) => {
              if (theme.polls.length === 0) return null;
              
              return (
                <div key={themeId} id={themeId} className="scroll-mt-8">
                  <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{theme.name}</h2>
                    <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                  </div>
                  
          <div className="space-y-8">
                    {theme.polls.map((poll, index) => {
              const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}-${index}`;
              const isExpanded = expandedPoll === pollKey;
              
              return (
                <div key={pollKey} className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
                  isExpanded ? 'fixed top-4 right-4 bottom-4 left-80 z-50 flex flex-col' : 'p-8'
                }`}>
                  <div className={isExpanded ? 'p-4 flex-1 flex flex-col' : ''}>
                  <div className={`flex items-center justify-between ${isExpanded ? 'mb-3' : 'mb-4'}`}>
                    <h3 className={`font-bold text-gray-800 dark:text-white ${isExpanded ? 'text-2xl' : 'text-2xl'}`}>
                      {getPageTitle(poll.page_path)} - Question {poll.poll_index + 1}
                    </h3>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className={`font-bold text-blue-600 dark:text-blue-400 ${isExpanded ? 'text-3xl' : 'text-3xl'}`}>
                          {(() => {
                            const filteredResults = getFilteredPollResults(poll);
                            return filteredResults.reduce((sum, r) => sum + r.votes, 0);
                          })()}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Total Responses
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedPoll(isExpanded ? null : pollKey)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          isExpanded
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                      >
                        {isExpanded ? 'Close' : 'Expand to Fit Screen'}
                      </button>
                    </div>
                  </div>
                  <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${isExpanded ? 'text-lg mb-3' : 'text-lg'}`}>{poll.question}</p>
                  
                  {/* Combined vote breakdown */}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    {filterMode === 'all' && (
                      <>
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                          TWG/SSTAC: {poll.combined_survey_votes || 0} responses
                        </div>
                        <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                          CEW: {poll.combined_cew_votes || 0} responses
                        </div>
                      </>
                    )}
                    {filterMode === 'twg' && (
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                        TWG/SSTAC: {poll.combined_survey_votes || 0} responses
                      </div>
                    )}
                    {filterMode === 'cew' && (
                      <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                        CEW: {poll.combined_cew_votes || 0} responses
                      </div>
                    )}
                    
                    {/* Debug logging for Holistic Protection Q2 */}
                    {poll.page_path.includes('holistic-protection') && poll.poll_index === 1 && (
                      <div className="text-xs text-gray-500 mt-2">
                        DEBUG: Total={poll.total_votes}, Survey={poll.combined_survey_votes}, CEW={poll.combined_cew_votes}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`space-y-4 ${isExpanded ? 'space-y-2 flex-1' : ''}`}>
                  {poll.is_ranking ? (
                    // For ranking polls, sort by average rank (lower is better)
                    [...getFilteredPollResults(poll)].sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0)).map((result, index) => {
                      const isTopChoice = index === 0; // First item after sorting by rank
                      
                    return (
                        <div key={result.option_index} className={`rounded-lg border-2 transition-all duration-300 ${
                          isExpanded ? 'p-3' : 'p-4'
                        } ${
                          isTopChoice 
                            ? 'border-blue-500 bg-white dark:bg-gray-800 dark:border-blue-400' 
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        }`}>
                          <div className={`flex items-center justify-between ${isExpanded ? 'mb-2' : 'mb-3'}`}>
                            <div className="flex items-center space-x-3">
                              {isTopChoice && (
                                <div className={`bg-blue-500 text-white rounded-full flex items-center justify-center font-bold ${
                                  isExpanded ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm'
                                }`}>
                                  🏆
                                </div>
                              )}
                              <span className={`font-medium ${
                                isExpanded ? 'text-base' : 'text-base'
                              } text-gray-900 dark:text-gray-100`}>
                              {result.option_text}
                            </span>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-blue-600 dark:text-blue-400 ${
                                isExpanded ? 'text-2xl' : 'text-2xl'
                              }`}>
                                {result.averageRank?.toFixed(1) || 'N/A'}
                              </div>
                              <div className={`text-gray-600 dark:text-gray-400 ${
                                isExpanded ? 'text-sm' : 'text-sm'
                              }`}>
                                Avg Rank
                              </div>
                            </div>
                          </div>
                          <div className={`w-full max-w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden ${
                            isExpanded ? 'h-6' : 'h-3'
                          }`}>
                            <div
                              className={`rounded-full transition-all duration-700 max-w-full ${
                                isExpanded ? 'h-6' : 'h-3'
                              } ${
                                isTopChoice 
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                  : 'bg-gradient-to-r from-blue-400 to-blue-500'
                              }`}
                              style={{ 
                                width: `${(() => {
                                  // Use the same logic as PollResultsChart for ranking polls
                                  const validResults = poll.results.filter(r => 
                                    r.averageRank !== null && r.averageRank !== undefined
                                  );
                                  const maxRank = Math.max(...validResults.map(r => r.averageRank || 0));
                                  const minRank = Math.min(...validResults.map(r => r.averageRank || 0));
                                  const rankRange = maxRank - minRank;
                                  
                                  if (rankRange === 0) return '100%';
                                  
                                  // Calculate inverse value for bar length (lower rank = higher value for display)
                                  const inverseValue = maxRank - (result.averageRank || 0) + 1;
                                  const maxInverseValue = rankRange + 1;
                                  
                                  return `${Math.max(10, (inverseValue / maxInverseValue) * 100)}%`;
                                })()}` 
                              }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // For single-choice polls, use the original logic
                    (() => {
                      const filteredResults = getFilteredPollResults(poll);
                      const maxVotes = Math.max(...filteredResults.map(r => r.votes));
                      return filteredResults.map((result, index) => {
                        const filteredTotal = filteredResults.reduce((sum, r) => sum + r.votes, 0);
                        const percentage = getPercentage(result.votes, filteredTotal);
                        const isTopChoice = result.votes === maxVotes;
                    
                        return (
                          <div key={result.option_index} className={`rounded-lg border-2 transition-all duration-300 ${
                            isExpanded ? 'p-3' : 'p-4'
                          } ${
                            isTopChoice 
                              ? 'border-blue-500 bg-white dark:bg-gray-800 dark:border-blue-400' 
                              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                          }`}>
                            <div className={`flex items-center justify-between ${isExpanded ? 'mb-2' : 'mb-3'}`}>
                              <div className="flex items-center space-x-3">
                                {isTopChoice && (
                                  <div className={`bg-blue-500 text-white rounded-full flex items-center justify-center font-bold ${
                                    isExpanded ? 'w-8 h-8 text-sm' : 'w-8 h-8 text-sm'
                                  }`}>
                                    🏆
                                  </div>
                                )}
                                <span className={`font-medium ${
                                  isExpanded ? 'text-base' : 'text-base'
                                } text-gray-900 dark:text-gray-100`}>
                                  {result.option_text}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold text-gray-900 dark:text-gray-100 ${
                                  isExpanded ? 'text-2xl' : 'text-2xl'
                                }`}>
                                  {result.votes}
                                </div>
                                <div className={`text-gray-600 dark:text-gray-400 ${
                                  isExpanded ? 'text-sm' : 'text-sm'
                                }`}>
                                  {percentage}%
                                </div>
                              </div>
                            </div>
                            <div className={`w-full max-w-full bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden ${
                              isExpanded ? 'h-6' : 'h-3'
                            }`}>
                              <div
                                className={`rounded-full transition-all duration-700 max-w-full ${
                                  isExpanded ? 'h-6' : 'h-3'
                                } ${
                                  isTopChoice 
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                    : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                }`}
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}
