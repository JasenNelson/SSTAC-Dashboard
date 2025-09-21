'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import QRCodeDisplay from '@/components/dashboard/QRCodeDisplay';

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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'twg' | 'cew'>('all');
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [qrCodeExpanded, setQrCodeExpanded] = useState(false);
  const [expandedPollGroup, setExpandedPollGroup] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    fetchPollResults();
  }, []);

  const fetchPollResults = async () => {
    try {
      setLoading(true);
      
      // Fetch both single-choice and ranking poll results with error handling
      const [singleChoiceResult, rankingResult] = await Promise.all([
        supabase.from('poll_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true }),
        supabase.from('ranking_results').select('*').order('page_path', { ascending: true }).order('poll_index', { ascending: true })
      ]);

      // Handle errors gracefully without breaking admin status
      if (singleChoiceResult.error) {
        console.error('Error fetching single-choice poll results:', singleChoiceResult.error);
        // Don't throw error, just log it and continue
      }
      if (rankingResult.error) {
        console.error('Error fetching ranking poll results:', rankingResult.error);
        // Don't throw error, just log it and continue
      }

      // Debug: Log raw data for all polls
      console.log('🔍 Raw single-choice data:', singleChoiceResult.data);
      console.log('🔍 Raw ranking data:', rankingResult.data);

      // Process results with fallback for missing data
      const singleChoiceData = singleChoiceResult.data || [];
      const rankingData = rankingResult.data || [];
      
      // Debug: Log specific data for tiered-framework
      console.log('🔍 Raw single-choice data for tiered-framework:', 
        singleChoiceData.filter(p => p.page_path.includes('tiered-framework'))
      );
      console.log('🔍 Raw ranking data for tiered-framework:', 
        rankingData.filter(p => p.page_path.includes('tiered-framework'))
      );

      // Define current active polls to filter out old/test data
      // Use more specific matching patterns to avoid false positives
      const currentPollQuestions = [
        // Holistic Protection Questions (only current page questions)
        "Given the potential for over-conservatism and remediation challenges, for which contaminant classes would the initial development of Matrix Sediment Standards protective of food toxicity be most scientifically defensible and practically beneficial?",
        "Rank in order of highest to lowest importance the following considerations in developing and implementing the Matrix Sediment Standards Framework:",
        
        // Tiered Framework Questions (exactly matching survey-results and cew-polls pages)
        "In developing Protocol 2 requirements, procedures, and a supporting model for bioavailability adjustments, would a cause-effect model (e.g., Bayesian Networks or Regression) be the best approach for a scientific framework that uses site-specific data and known toxicity-modifying factors to develop refined sediment standards?",
        "Please rank the following lines of evidence in order of importance for developing a robust scientific framework for deriving Tier 2b site-specific sediment standards for screening-level risk assessment (1 = most important):",
        
        // Prioritization Questions (exactly matching cew-polls page)
        "Please rank these potential feasibility criteria to help inform the development of a prioritization framework (1= highest):",
        "Please rank these timeframe considerations for developing a prioritization framework and strategic planning for research to support modernizing BC's sediment standards (1= highest):",
        "Based on Today's discussion and your experience, please rank these four areas for modernization priority in BC's sediment standards (1= highest):",
        "Which scientific approach to bioavailability holds the most promise for practical and defensible application in BC's regulatory framework?",
        "When considering contaminant mixtures, rank the following approaches from most to least scientifically defensible and practically achievable for BC's regulatory framework (1= highest):",
        "Within a medium-term (3-5 year) research plan, rank the following scientific objectives from most to least critical for modernizing BC's sediment standards?",
        "To support long-term (5+ years) strategic goals, please rank the following foundational research areas in order of importance for creating a more adaptive and forward-looking regulatory framework (1= highest importance):",
        "For the Hazard Index / Concentration Addition approach to mixture assessment, what is the single greatest scientific research gap that must be addressed before it can be reliably implemented?"
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
      singleChoiceData.forEach(poll => {
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
      rankingData.forEach(poll => {
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
          // Create separate results for survey and CEW polls
          if (surveyPoll && cewPoll) {
            // Store original results separately
            surveyResults = (surveyPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: result.votes || 0
            })).sort((a: any, b: any) => b.votes - a.votes);
            
            cewResults = (cewPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: result.votes || 0
            })).sort((a: any, b: any) => b.votes - a.votes);
            
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
            })).sort((a: any, b: any) => b.votes - a.votes);
          } else if (surveyPoll) {
            // Only survey data
            surveyResults = (surveyPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: result.votes || 0
            })).sort((a: any, b: any) => b.votes - a.votes);
            pollResults = surveyResults;
          } else if (cewPoll) {
            // Only CEW data
            cewResults = (cewPoll.results || []).map((result: any) => ({
              option_index: result.option_index,
              option_text: result.option_text,
              votes: result.votes || 0
            })).sort((a: any, b: any) => b.votes - a.votes);
            pollResults = cewResults;
          } else {
            pollResults = [];
          }
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
      // For single-choice polls, use the actual separate results
      if (filterMode === 'twg' && poll.survey_results) {
        return poll.survey_results;
      } else if (filterMode === 'cew' && poll.cew_results) {
        return poll.cew_results;
      }
    }
    
    return poll.results;
  };

  const navigateToNextQuestion = (currentPoll: PollResult) => {
    // Get all polls in the same group
    const pollGroup = getPollGroup(currentPoll.page_path);
    const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);
    
    // Find current poll index
    const currentIndex = groupPolls.findIndex(poll => 
      poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
    );
    
    // Navigate to next poll (wrap around to first if at end)
    const nextIndex = (currentIndex + 1) % groupPolls.length;
    const nextPoll = groupPolls[nextIndex];
    
    if (nextPoll) {
      const nextPollKey = nextPoll.poll_id || nextPoll.ranking_poll_id || `poll-${nextPoll.page_path}-${nextPoll.poll_index}`;
      setSelectedQuestion(nextPollKey);
      setCurrentQuestionIndex(nextIndex);
    }
  };

  const navigateToPreviousQuestion = (currentPoll: PollResult) => {
    // Get all polls in the same group
    const pollGroup = getPollGroup(currentPoll.page_path);
    const groupPolls = filteredPolls.filter(poll => getPollGroup(poll.page_path) === pollGroup);
    
    // Find current poll index
    const currentIndex = groupPolls.findIndex(poll => 
      poll.page_path === currentPoll.page_path && poll.poll_index === currentPoll.poll_index
    );
    
    // Navigate to previous poll (wrap around to last if at beginning)
    const prevIndex = currentIndex === 0 ? groupPolls.length - 1 : currentIndex - 1;
    const prevPoll = groupPolls[prevIndex];
    
    if (prevPoll) {
      const prevPollKey = prevPoll.poll_id || prevPoll.ranking_poll_id || `poll-${prevPoll.page_path}-${prevPoll.poll_index}`;
      setSelectedQuestion(prevPollKey);
      setCurrentQuestionIndex(prevIndex);
    }
  };

  const getPageTitle = (pagePath: string) => {
    const pathMap: { [key: string]: string } = {
      '/survey-results/holistic-protection': 'Holistic Protection',
      '/survey-results/tiered-framework': 'Tiered Framework',
      '/survey-results/prioritization': 'Prioritization Framework',
      '/survey-results/effectiveness': 'Effectiveness of Current Standards',
      '/survey-results/technical-standards': 'Technical Standards',
      '/survey-results/detailed-findings': 'Detailed Findings',
      '/cew-polls/holistic-protection': 'Holistic Protection', // Same as survey-results
      '/cew-polls/tiered-framework': 'Tiered Framework', // Same as survey-results
      '/cew-polls/prioritization': 'Prioritization Framework', // Same as survey-results
    };
    return pathMap[pagePath] || pagePath;
  };

  const getPollGroup = (pagePath: string): 'holistic-protection' | 'tiered-framework' | 'prioritization' | null => {
    if (pagePath.includes('holistic-protection')) return 'holistic-protection';
    if (pagePath.includes('tiered-framework')) return 'tiered-framework';
    if (pagePath.includes('prioritization')) return 'prioritization';
    return null;
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
      {leftPanelVisible && (
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
              {Object.entries(groupPollsByTheme(filteredPolls)).map(([themeId, theme]) => {
                if (theme.polls.length === 0) return null;
                
                const isExpanded = expandedGroup === themeId;
                const getThemeColors = (themeId: string) => {
                  switch (themeId) {
                    case 'holistic-protection':
                      return {
                        bg: 'bg-blue-50 dark:bg-blue-900/20',
                        hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
                        text: 'text-gray-900 dark:text-blue-100',
                        questionBg: 'bg-blue-100 dark:bg-blue-800/30',
                        questionHover: 'hover:bg-blue-200 dark:hover:bg-blue-800/40'
                      };
                    case 'tiered-framework':
                      return {
                        bg: 'bg-orange-50 dark:bg-orange-600/20',
                        hover: 'hover:bg-orange-100 dark:hover:bg-orange-600/30',
                        text: 'text-gray-900 dark:text-orange-200',
                        questionBg: 'bg-orange-100 dark:bg-orange-700/30',
                        questionHover: 'hover:bg-orange-200 dark:hover:bg-orange-700/40'
                      };
                    case 'prioritization':
                      return {
                        bg: 'bg-purple-50 dark:bg-purple-900/20',
                        hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
                        text: 'text-gray-900 dark:text-purple-100',
                        questionBg: 'bg-purple-100 dark:bg-purple-800/30',
                        questionHover: 'hover:bg-purple-200 dark:hover:bg-purple-800/40'
                      };
                    default:
                      return {
                        bg: 'bg-gray-50 dark:bg-gray-700/20',
                        hover: 'hover:bg-gray-100 dark:hover:bg-gray-700/30',
                        text: 'text-gray-900 dark:text-gray-100',
                        questionBg: 'bg-gray-100 dark:bg-gray-600/30',
                        questionHover: 'hover:bg-gray-200 dark:hover:bg-gray-600/40'
                      };
                  }
                };
                
                const colors = getThemeColors(themeId);
                
                return (
                  <div key={themeId} className="space-y-1">
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : themeId)}
                      className={`w-full px-4 py-3 rounded-lg font-medium transition-colors text-left ${colors.bg} ${colors.text} ${colors.hover} flex items-center justify-between`}
                    >
                      <span>{theme.name}</span>
                      <span className="text-sm">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </button>
                    
                    {isExpanded && (
                      <div className="ml-4 space-y-1">
                        {theme.polls.map((poll) => {
                          const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}`;
                          // For ranking polls, show participant count (responses). For single-choice, show total votes.
                          const totalVotes = poll.is_ranking ? 
                            (poll.combined_survey_votes || 0) + (poll.combined_cew_votes || 0) :
                            getFilteredPollResults(poll).reduce((sum, r) => sum + r.votes, 0);
                          
                          return (
                            <button
                              key={pollKey}
                              onClick={() => setSelectedQuestion(pollKey)}
                              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${colors.questionBg} ${colors.text} ${colors.questionHover} flex items-center justify-between ${
                                selectedQuestion === pollKey ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <span>Question {poll.poll_index + 1}</span>
                              <span className="text-xs bg-white dark:bg-gray-600 px-2 py-1 rounded-full">
                                {totalVotes} {poll.is_ranking ? 'responses' : 'votes'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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

          {/* Hide Panel Button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setLeftPanelVisible(false)}
              className="flex items-center justify-center w-10 h-10 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors shadow-lg"
              title="Hide filter panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Show Panel Button - appears when panel is hidden */}
      {!leftPanelVisible && (
        <div className="fixed left-4 top-20 z-50">
          <button
            onClick={() => setLeftPanelVisible(true)}
            className="flex items-center justify-center w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
            title="Show filter panel"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Refresh Results Button - appears when panel is hidden */}
      {!leftPanelVisible && (
        <div className="fixed left-4 top-32 z-50">
          <button
            onClick={() => fetchPollResults()}
            className="flex items-center justify-center w-12 h-12 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors shadow-xl border-2 border-white dark:border-gray-800"
            title="Refresh results"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 overflow-y-auto ${leftPanelVisible ? 'ml-80' : 'ml-0'}`}>
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
        ) : !selectedQuestion ? (
          <div className="text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">📋</div>
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Select a Question</h3>
            <p className="text-gray-500 dark:text-gray-500">Choose a question from the left panel to view its results.</p>
          </div>
        ) : (
          <div>
            {(() => {
              // Find the selected poll
              const selectedPoll = filteredPolls.find(poll => {
                const pollKey = poll.poll_id || poll.ranking_poll_id || `poll-${poll.page_path}-${poll.poll_index}`;
                return pollKey === selectedQuestion;
              });
              
              if (!selectedPoll) {
                return (
                  <div className="text-center py-12">
                    <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">❌</div>
                    <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">Question Not Found</h3>
                    <p className="text-gray-500 dark:text-gray-500">The selected question could not be found.</p>
                  </div>
                );
              }
              
              const pollKey = selectedPoll.poll_id || selectedPoll.ranking_poll_id || `poll-${selectedPoll.page_path}-${selectedPoll.poll_index}`;
              const isExpanded = expandedPoll === pollKey;
              
              return (
                <div key={pollKey} className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
                  isExpanded ? `fixed top-20 right-4 bottom-4 ${leftPanelVisible ? 'left-80' : 'left-20'} z-[60] flex flex-col` : 'p-8'
                }`}>
                  <div className={isExpanded ? 'p-4 flex-1 flex flex-col' : ''}>
                  <div className={`${isExpanded ? 'mb-3' : 'mb-4'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 max-w-3xl mr-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className={`font-bold text-gray-800 dark:text-white ${isExpanded ? 'text-2xl' : 'text-2xl'}`}>
                            {getPageTitle(selectedPoll.page_path)} - Question {selectedPoll.poll_index + 1}
                          </h3>
                          <button
                            onClick={() => navigateToPreviousQuestion(selectedPoll)}
                            className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Previous question in group"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => navigateToNextQuestion(selectedPoll)}
                            className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Next question in group"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setExpandedPoll(isExpanded ? null : pollKey)}
                            className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title={isExpanded ? 'Close expanded view' : 'Expand to fit screen'}
                          >
                            {isExpanded ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${isExpanded ? 'text-lg mb-3' : 'text-lg'}`}>{selectedPoll.question}</p>
                      </div>
                      
                      {/* QR Code and Join at containers - positioned on the right */}
                      <div className="flex items-start space-x-3 flex-shrink-0">
                        {(() => {
                          const pollGroup = getPollGroup(selectedPoll.page_path);
                          if (!pollGroup) return null;
                          
                          const getWebAddress = (group: string) => {
                            switch (group) {
                              case 'holistic-protection':
                                return 'bit.ly/SABCS-Holistic';
                              case 'tiered-framework':
                                return 'bit.ly/SABCS-Tiered';
                              case 'prioritization':
                                return 'bit.ly/SABCS-Prio';
                              default:
                                return null;
                            }
                          };
                          
                          const webAddress = getWebAddress(pollGroup);
                          
                          return (
                            <div className="flex items-start space-x-3">
                              {/* Web Address and Password */}
                              {webAddress && (
                                <div 
                                  className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
                                  onClick={() => {
                                    setExpandedPollGroup(pollGroup);
                                    setQrCodeExpanded(!qrCodeExpanded);
                                  }}
                                  title="Click to expand for conference display"
                                >
                                  {/* Join at section */}
                                  <div className="flex flex-col items-center">
                                    <div className="text-sm font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                                      Join at:
                                    </div>
                                    <div className="text-lg font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                                      {webAddress}
                                    </div>
                                  </div>
                                  {/* Spacing */}
                                  <div className="h-2"></div>
                                  {/* Password section */}
                                  <div className="flex flex-col items-center">
                                    <div className="text-sm font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                                      Password:
                                    </div>
                                    <div className="text-lg font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                                      CEW2025
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* QR Code */}
                              <div 
                                className="cursor-pointer hover:opacity-80 transition-opacity duration-200"
                                onClick={() => {
                                  setExpandedPollGroup(pollGroup);
                                  setQrCodeExpanded(!qrCodeExpanded);
                                }}
                                title="Click to expand for conference display"
                              >
                                <QRCodeDisplay 
                                  pollGroup={pollGroup} 
                                  className={isExpanded ? 'scale-75' : ''} 
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Combined vote breakdown */}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    {filterMode === 'all' && (
                      <>
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                          TWG/SSTAC: {selectedPoll.combined_survey_votes || 0} responses
                        </div>
                        <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                          CEW: {selectedPoll.combined_cew_votes || 0} responses
                        </div>
                      </>
                    )}
                    {filterMode === 'twg' && (
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                        TWG/SSTAC: {selectedPoll.combined_survey_votes || 0} responses
                      </div>
                    )}
                    {filterMode === 'cew' && (
                      <div className="bg-green-600 text-white px-3 py-1 rounded-full font-medium shadow-sm">
                        CEW: {selectedPoll.combined_cew_votes || 0} responses
                      </div>
                    )}
                  </div>
                </div>

                <div className={`space-y-4 ${isExpanded ? 'space-y-2 flex-1' : ''}`}>
                  {selectedPoll.is_ranking ? (
                    // For ranking polls, sort by average rank (lower is better)
                    [...getFilteredPollResults(selectedPoll)].sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0)).map((result, index) => {
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
                            isExpanded ? 'h-8' : 'h-5'
                          }`}>
                            <div
                              className={`rounded-full transition-all duration-700 max-w-full ${
                                isExpanded ? 'h-8' : 'h-5'
                              } ${
                                isTopChoice 
                                  ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                  : 'bg-gradient-to-r from-blue-400 to-blue-500'
                              }`}
                              style={{ 
                                width: `${(() => {
                                  // Use the same logic as PollResultsChart for ranking polls
                                  const validResults = selectedPoll.results.filter(r => 
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
                      const filteredResults = getFilteredPollResults(selectedPoll);
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
                              isExpanded ? 'h-8' : 'h-5'
                            }`}>
                              <div
                                className={`rounded-full transition-all duration-700 max-w-full ${
                                  isExpanded ? 'h-8' : 'h-5'
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
            })()}
          </div>
        )}

        </div>
      </div>

      {/* Expanded QR Code and Join at Overlay */}
      {qrCodeExpanded && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setQrCodeExpanded(false)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-5xl mx-4 relative transform scale-[1.3]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setQrCodeExpanded(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Expanded content */}
            <div className="flex flex-col items-center space-y-8">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white text-center">
                Conference Poll Access
              </h3>
              
              <div className="flex flex-col lg:flex-row items-center justify-center space-y-8 lg:space-y-0 lg:space-x-12 w-full">
                {/* Expanded Join at container */}
                <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 w-full lg:w-auto lg:min-w-[400px] lg:max-w-[450px]">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="text-2xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                      Join at:
                    </div>
                    <div className="text-4xl font-bold text-blue-700 dark:text-white whitespace-nowrap text-center" style={{color: '#1d4ed8'}}>
                      {(() => {
                        const getWebAddress = (group: string) => {
                          switch (group) {
                            case 'holistic-protection':
                              return 'bit.ly/SABCS-Holistic';
                            case 'tiered-framework':
                              return 'bit.ly/SABCS-Tiered';
                            case 'prioritization':
                              return 'bit.ly/SABCS-Prio';
                            default:
                              return 'bit.ly/SABCS-Holistic'; // Default fallback
                          }
                        };
                        
                        return getWebAddress(expandedPollGroup || 'holistic-protection');
                      })()}
                    </div>
                  </div>
                  
                  <div className="h-6"></div>
                  
                  <div className="flex flex-col items-center space-y-4">
                    <div className="text-2xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                      Password:
                    </div>
                    <div className="text-4xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                      CEW2025
                    </div>
                  </div>
                </div>

                {/* Expanded QR Code */}
                <div className="flex items-center justify-center">
                  <div className="transform scale-125">
                    <QRCodeDisplay 
                      pollGroup={(expandedPollGroup || 'holistic-protection') as 'holistic-protection' | 'tiered-framework' | 'prioritization' | 'wiks'} 
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
