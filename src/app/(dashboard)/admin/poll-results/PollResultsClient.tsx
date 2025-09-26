'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import QRCodeDisplay from '@/components/dashboard/QRCodeDisplay';
import CustomWordCloud from '@/components/dashboard/CustomWordCloud';
import PrioritizationMatrixGraph from '@/components/graphs/PrioritizationMatrixGraph';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WordCloud Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

interface PollResult {
  poll_id?: string;
  ranking_poll_id?: string;
  wordcloud_poll_id?: string;
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
  is_wordcloud?: boolean;
  wordcloud_words?: Array<{
    text: string;
    value: number;
  }>;
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

interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
}

export default function PollResultsClient() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'twg' | 'cew'>('all');
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [qrCodeExpanded, setQrCodeExpanded] = useState(false);
  const [expandedPollGroup, setExpandedPollGroup] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const supabase = createClient();

  useEffect(() => {
    fetchPollResults();
  }, []);


  // Fetch matrix data for prioritization graphs
  useEffect(() => {
    const fetchMatrixData = async () => {
      try {
        const response = await fetch('/api/graphs/prioritization-matrix');
        if (response.ok) {
          const data = await response.json();
          setMatrixData(data);
        }
      } catch (error) {
        console.error("Failed to fetch matrix graph data:", error);
      }
    };

    fetchMatrixData();
  }, [pollResults]); // Re-run when poll data changes

  const fetchPollResults = async () => {
    try {
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
        // Don't throw error, just log it and continue
      }
      if (rankingResult.error) {
        console.error('Error fetching ranking poll results:', rankingResult.error);
        // Don't throw error, just log it and continue
      }
      if (wordcloudResult.error) {
        console.error('Error fetching wordcloud poll results:', wordcloudResult.error);
        // Don't throw error, just log it and continue
      }

      // Process results with fallback for missing data
      const singleChoiceData = singleChoiceResult.data || [];
      const rankingData = rankingResult.data || [];
      const wordcloudData = wordcloudResult.data || [];
      
      // Debug: Log specific data for tiered-framework
      console.log('🔍 Raw single-choice data for tiered-framework:', 
        singleChoiceData.filter(p => p.page_path.includes('tiered-framework'))
      );
      console.log('🔍 Raw ranking data for tiered-framework:', 
        rankingData.filter(p => p.page_path.includes('tiered-framework'))
      );
      
      // Debug: Log wordcloud data for prioritization
      console.log('🔍 Raw wordcloud data for prioritization:', 
        wordcloudData.filter(p => p.page_path.includes('prioritization'))
      );

      // Define current active polls to filter out old/test data
      // Use more specific matching patterns to avoid false positives
      const currentPollQuestions = [
        // Holistic Protection Questions (3 ranking questions)
        "How would you rank the regulatory need / priority of developing Matrix Sediment Standards for the following? Please rank (1 = highest priority; 4 = lowest priority).",
        "How would you rank the anticipated scientific defensibility of SedS-foodHH (Matrix Sediment Standards designed to protect human health from food-related toxicity), if they were developed for the following contaminant classes, using currently-available science and methods? Please rank (1 = most defensible; 4 = least defensible).",
        "How would you rank the anticipated scientific defensibility of SedS-foodECO (Matrix Sediment Standards designed to protect ecological health from food-related toxicity), if they were developed for the following contaminant classes, using currently-available science and methods? Please rank (1 = most defensible; 4 = least defensible).",
        
        // Tiered Framework Questions (3 single-choice questions)
        "What is the primary regulatory advantage of using a probabilistic framework (e.g., Bayesian) to integrate EqP and BLM predictions into a scientific framework for deriving site-specific sediment standards (Tier 2)?",
        "In developing a probabilistic framework for deriving site-specific sediment standards (Tier 2), which data type is most critical for effectively narrowing the uncertainty of the final risk estimate?",
        "What is the biggest practical hurdle to overcome when implementing a Bayesian framework in the development of a scientific framework for deriving site-specific sediment standards (Tier 2)?",
        
        // Prioritization Questions (13 questions: 10 single-choice + 2 ranking + 1 wordcloud)
        "Rank the importance of developing a framework for deriving site-specific sediment standards, based on bioavailability adjustment, to provide an enhanced numerical assessment option (Tier 2), between generic numerical (Tier 1) and risk-based (Tier 3) assessments. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing the framework for deriving site-specific sediment standards, based on an integrated approach using Equilibrium Partitioning and Biotic Ligand Models. (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from direct toxicity. (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect ecosystem health food-related toxicity. (1 = easily achievable to 5 = not feasible)",
        "Rank the importance of developing a framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = very important to 5 = not important)",
        "Rank the feasibility of developing the framework for deriving matrix sediment standards that holistically protect human health from food-related toxicity. (1 = easily achievable to 5 = not feasible)",
        "To help focus development of matrix standards, please rank the four actions below for the degree to which they would improve development of the standards (1 = top priority; 4 = lowest priority). If you do not know or have an opinion, do not respond to any given question.",
        "Of the four options below, what focus will provide greatest value to holistic sediment management in BC? (1 = top priority; 4 = lowest priority)",
        "Overall, what is the greatest barrier to advancing holistic sediment protection in BC?"
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

      // Process wordcloud polls - aggregate by poll_id first
      const wordcloudPollsMap = new Map<string, {
        poll_id: string;
        page_path: string;
        poll_index: number;
        question: string;
        max_words: number;
        word_limit: number;
        total_votes: number;
        words: Array<{ text: string; value: number }>;
        surveyWords: Array<{ text: string; value: number }>;
        cewWords: Array<{ text: string; value: number }>;
      }>();

      wordcloudData.forEach(poll => {
        // Only process polls that match current active questions
        const matchesCurrentQuestion = currentPollQuestions.some(question => 
          poll.question.includes(question.substring(0, 50)) || 
          question.includes(poll.question.substring(0, 50))
        );
        if (!matchesCurrentQuestion) {
          return;
        }

        const pollId = poll.poll_id;
        if (!wordcloudPollsMap.has(pollId)) {
          wordcloudPollsMap.set(pollId, {
            poll_id: pollId,
            page_path: poll.page_path,
            poll_index: poll.poll_index,
            question: poll.question,
            max_words: poll.max_words || 3,
            word_limit: poll.word_limit || 20,
            total_votes: poll.total_responses || 0,
            words: [],
            surveyWords: [],
            cewWords: []
          });
        }

        const pollData = wordcloudPollsMap.get(pollId)!;
        
        // Add word data
        if (poll.word && poll.frequency) {
          const wordData = { text: poll.word, value: poll.frequency };
          pollData.words.push(wordData);
          
          if (poll.page_path.startsWith('/survey-results') || poll.page_path === '/wiks') {
            pollData.surveyWords.push(wordData);
          } else if (poll.page_path.startsWith('/cew-polls')) {
            pollData.cewWords.push(wordData);
          }
        }
      });

      // Convert aggregated wordcloud data to poll groups
      wordcloudPollsMap.forEach((pollData, pollId) => {
        
        // Create a key that groups polls by topic and poll_index
        let key;
        if (pollData.page_path.includes('tiered-framework')) {
          key = `tiered-framework_${pollData.poll_index}`;
        } else if (pollData.page_path.includes('holistic-protection')) {
          key = `holistic-protection_${pollData.poll_index}`;
        } else if (pollData.page_path.includes('prioritization')) {
          key = `prioritization_${pollData.poll_index}`;
        } else if (pollData.page_path.includes('wiks')) {
          key = `wiks_${pollData.poll_index}`;
        } else {
          const topic = pollData.page_path.split('/').pop() || 'unknown';
          key = `${topic}_${pollData.poll_index}`;
        }

        // Sort words by frequency
        pollData.words.sort((a, b) => b.value - a.value);
        pollData.surveyWords.sort((a, b) => b.value - a.value);
        pollData.cewWords.sort((a, b) => b.value - a.value);

        if (!pollGroups.has(key)) {
          pollGroups.set(key, {
            isRanking: false,
            isWordcloud: true,
            question: pollData.question,
            poll_index: pollData.poll_index,
            options: []
          });
        } else {
          const group = pollGroups.get(key)!;
          group.isWordcloud = true;
        }

        const group = pollGroups.get(key)!;
        
        // Create survey and CEW poll objects
        if (pollData.surveyWords.length > 0) {
          group.surveyPoll = {
            ...pollData,
            words: pollData.surveyWords,
            total_votes: pollData.total_votes // Use database total_responses, not word frequency sum
          };
        }
        
        if (pollData.cewWords.length > 0) {
          group.cewPoll = {
            ...pollData,
            words: pollData.cewWords,
            total_votes: pollData.total_votes // Use database total_responses, not word frequency sum
          };
        }
        
        // Also create poll objects even if no words yet, but with correct total_votes
        if (pollData.surveyWords.length === 0 && pollData.cewWords.length === 0) {
          // No words yet, but we still need to create the poll structure
          group.surveyPoll = {
            ...pollData,
            words: [],
            total_votes: pollData.total_votes // Use database total_responses
          };
          group.cewPoll = {
            ...pollData,
            words: [],
            total_votes: pollData.total_votes // Use database total_responses
          };
        }
        
        // Debug: Log wordcloud poll data processing
        if (pollData.page_path.includes('prioritization')) {
          console.log('🔍 Wordcloud poll data processing:', {
            pollId: pollData.poll_id,
            pagePath: pollData.page_path,
            pollIndex: pollData.poll_index,
            totalVotes: pollData.total_votes,
            surveyWords: pollData.surveyWords,
            cewWords: pollData.cewWords,
            surveyPoll: group.surveyPoll ? { total_votes: group.surveyPoll.total_votes } : null,
            cewPoll: group.cewPoll ? { total_votes: group.cewPoll.total_votes } : null
          });
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
        let wordcloudWords: Array<{ text: string; value: number }> = [];

        // Calculate vote counts based on poll type
        if (group.isRanking) {
          // For ranking polls, use total_votes field which represents unique participants
          // Each user ranks ALL options, so total_votes = number of participants
          surveyVotes = surveyPoll ? (surveyPoll.total_votes || 0) : 0;
          cewVotes = cewPoll ? (cewPoll.total_votes || 0) : 0;
        } else if (group.isWordcloud) {
          // For wordcloud polls, use total_responses from database which represents unique participants
          // This is the correct way to count responses for wordcloud polls
          surveyVotes = surveyPoll ? (surveyPoll.total_votes || 0) : 0;
          cewVotes = cewPoll ? (cewPoll.total_votes || 0) : 0;
          
          // Debug: Log wordcloud vote calculation
          if (key.includes('prioritization')) {
            console.log('🔍 Wordcloud vote calculation:', {
              key,
              surveyVotes,
              cewVotes,
              totalVotes: surveyVotes + cewVotes,
              surveyPoll: surveyPoll ? { 
                total_votes: surveyPoll.total_votes, 
                words: surveyPoll.words?.length,
                wordValues: surveyPoll.words?.map((w: any) => w.value) || []
              } : null,
              cewPoll: cewPoll ? { 
                total_votes: cewPoll.total_votes, 
                words: cewPoll.words?.length,
                wordValues: cewPoll.words?.map((w: any) => w.value) || []
              } : null
            });
          }
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

        } else if (group.isWordcloud) {
          // For wordcloud polls, process word frequency data
          
          if (surveyPoll && cewPoll) {
            // Combine word frequency data from both sources
            const wordMap = new Map<string, number>();
            
            // Process survey words
            if (surveyPoll.words) {
              surveyPoll.words.forEach((word: any) => {
                const key = word.text;
                const value = word.value || 0;
                if (key) {
                  wordMap.set(key, (wordMap.get(key) || 0) + value);
                }
              });
            }
            
            // Process CEW words
            if (cewPoll.words) {
              cewPoll.words.forEach((word: any) => {
                const key = word.text;
                const value = word.value || 0;
                if (key) {
                  wordMap.set(key, (wordMap.get(key) || 0) + value);
                }
              });
            }
            
            // Convert to array and sort by frequency
            wordcloudWords = Array.from(wordMap.entries())
              .map(([text, value]) => ({ text, value }))
              .sort((a, b) => b.value - a.value);
          } else if (surveyPoll) {
            // Only survey data
            wordcloudWords = surveyPoll.words || [];
          } else if (cewPoll) {
            // Only CEW data
            wordcloudWords = cewPoll.words || [];
          }
          
          // For wordcloud polls, we don't have traditional results
          pollResults = [];
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
          is_wordcloud: group.isWordcloud,
          wordcloud_words: group.isWordcloud ? (wordcloudWords || []) : undefined,
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
      
      // If currently expanded, keep the new question expanded
      if (expandedPoll) {
        setExpandedPoll(nextPollKey);
      }
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
      
      // If currently expanded, keep the new question expanded
      if (expandedPoll) {
        setExpandedPoll(prevPollKey);
      }
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
        ).sort((a, b) => a.poll_index - b.poll_index)
      },
      'tiered-framework': {
        name: 'Tiered Framework',
        polls: polls.filter(poll => 
          poll.page_path.includes('tiered-framework')
        ).sort((a, b) => a.poll_index - b.poll_index)
      },
      'prioritization': {
        name: 'Prioritization',
        polls: polls.filter(poll => 
          poll.page_path.includes('prioritization')
        ).sort((a, b) => a.poll_index - b.poll_index),
        showGraphs: true
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
                          // For ranking and wordcloud polls, show participant count (responses). For single-choice, show total votes.
                          const totalVotes = (poll.is_ranking || poll.is_wordcloud) ? 
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
                                {totalVotes} {(poll.is_ranking || poll.is_wordcloud) ? 'responses' : 'votes'}
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
              onClick={() => {
                fetchPollResults();
                setLastRefresh(new Date());
              }}
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
            onClick={() => {
              fetchPollResults();
              setLastRefresh(new Date());
            }}
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
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Live Poll Results Dashboard</h1>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
            </div>
          </div>
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
                  <div className={isExpanded ? 'p-8 flex-1 flex flex-col' : ''}>
                  <div className={`${isExpanded ? 'mb-3' : 'mb-4'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`flex-1 mr-4 ${isExpanded ? 'max-w-4xl' : 'max-w-3xl'}`}>
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className={`font-bold text-gray-800 dark:text-white ${isExpanded ? 'text-3xl' : 'text-2xl'}`}>
                            {getPageTitle(selectedPoll.page_path)} - Question {selectedPoll.poll_index + 1}
                          </h3>
                          <button
                            onClick={() => navigateToPreviousQuestion(selectedPoll)}
                            className={`flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isExpanded ? 'w-8 h-8' : 'w-6 h-6'}`}
                            title="Previous question in group"
                          >
                            <svg className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${isExpanded ? 'w-5 h-5' : 'w-4 h-4'}`}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => navigateToNextQuestion(selectedPoll)}
                            className={`flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded ${isExpanded ? 'w-8 h-8' : 'w-6 h-6'}`}
                            title="Next question in group"
                          >
                            <svg className={`fill="none" stroke="currentColor" viewBox="0 0 24 24" ${isExpanded ? 'w-5 h-5' : 'w-4 h-4'}`}>
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
                        <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${isExpanded ? 'text-xl mb-3' : 'text-lg'}`}>{selectedPoll.question}</p>
                      </div>
                      
                      {/* QR Code and Join at containers - positioned on the right */}
                      <div className={`flex items-start flex-shrink-0 ${isExpanded ? 'space-x-3 -ml-8 mt-2' : 'space-x-3'}`}>
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
                            <div className={`flex items-start ${isExpanded ? 'space-x-26' : 'space-x-3'}`}>
                              {/* Web Address and Password */}
                              {webAddress && (
                                <div 
                                  className={`flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 ${isExpanded ? 'p-5 transform scale-[1.45]' : 'p-3'}`}
                                  onClick={() => {
                                    setExpandedPollGroup(pollGroup);
                                    setQrCodeExpanded(!qrCodeExpanded);
                                  }}
                                  title="Click to expand for conference display"
                                >
                                  {/* Join at section */}
                                  <div className="flex flex-col items-center">
                                    <div className={`font-bold text-blue-700 dark:text-white ${isExpanded ? 'text-base' : 'text-sm'}`} style={{color: '#1d4ed8'}}>
                                      Join at:
                                    </div>
                                    <div className={`font-bold text-blue-700 dark:text-white ${isExpanded ? 'text-xl' : 'text-lg'}`} style={{color: '#1d4ed8'}}>
                                      {webAddress}
                                    </div>
                                  </div>
                                  {/* Spacing */}
                                  <div className="h-2"></div>
                                  {/* Password section */}
                                  <div className="flex flex-col items-center">
                                    <div className={`font-bold text-blue-700 dark:text-white ${isExpanded ? 'text-base' : 'text-sm'}`} style={{color: '#1d4ed8'}}>
                                      Password:
                                    </div>
                                    <div className={`font-bold text-blue-700 dark:text-white ${isExpanded ? 'text-xl' : 'text-lg'}`} style={{color: '#1d4ed8'}}>
                                      CEW2025
                                    </div>
                                  </div>
                                </div>
                              )}
                              {/* QR Code */}
                              <div 
                                className={`cursor-pointer hover:opacity-80 transition-opacity duration-200 ${isExpanded ? 'transform scale-[1.45] ml-8' : ''}`}
                                onClick={() => {
                                  setExpandedPollGroup(pollGroup);
                                  setQrCodeExpanded(!qrCodeExpanded);
                                }}
                                title="Click to expand for conference display"
                              >
                                <QRCodeDisplay 
                                  pollGroup={pollGroup} 
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


                <div className={`space-y-4 ${isExpanded ? 'space-y-2 flex-1 px-4' : ''}`}>
                  {selectedPoll.is_wordcloud ? (
                    // For wordcloud polls, display word cloud visualization
                    <div className="space-y-6">
                      {/* Word Cloud Visualization */}
                      {selectedPoll.wordcloud_words && selectedPoll.wordcloud_words.length > 0 ? (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner">
                          <div className="mb-4">
                            <h4 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                              Word Cloud ({selectedPoll.total_votes} response{selectedPoll.total_votes !== 1 ? 's' : ''})
                            </h4>
                          </div>
                          <div style={{ height: '400px', width: '100%' }}>
                            {selectedPoll.wordcloud_words.every(word => 
                              word && 
                              typeof word === 'object' && 
                              word.text && 
                              typeof word.text === 'string' && 
                              word.text.trim().length > 0 &&
                              typeof word.value === 'number' && 
                              word.value > 0
                            ) ? (
                              <ErrorBoundary fallback={
                                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                  <div className="text-center">
                                    <div className="text-4xl mb-2">⚠️</div>
                                    <p>Error displaying wordcloud</p>
                                    <p className="text-sm">Please refresh the page</p>
                                  </div>
                                </div>
                              }>
             <CustomWordCloud
               words={selectedPoll.wordcloud_words}
               colors={['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe']}
               fontFamily="Inter, system-ui, sans-serif"
               fontWeight="normal"
               minSize={12}
               maxSize={60}
             />
                              </ErrorBoundary>
                            ) : (
                              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                <div className="text-center">
                                  <div className="text-4xl mb-2">☁️</div>
                                  <p>No valid words to display</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <div className="text-gray-400 dark:text-gray-500 text-6xl mb-4">☁️</div>
                          <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No Words Yet</h3>
                          <p className="text-gray-500 dark:text-gray-500">Word cloud will appear here once users start submitting words.</p>
                        </div>
                      )}
                      
                      {/* Word Frequency Table */}
                      {selectedPoll.wordcloud_words && selectedPoll.wordcloud_words.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                          <h5 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                            Word Frequency
                          </h5>
                          <div className="max-h-64 overflow-y-auto">
                            {selectedPoll.wordcloud_words.map((word, index) => (
                              <div key={index} className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                                <span className="font-medium text-gray-900 dark:text-white">{word.text}</span>
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                    <div 
                                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                      style={{ 
                                        width: `${Math.min((word.value / Math.max(...(selectedPoll.wordcloud_words || []).map(w => w.value))) * 100, 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 min-w-[2rem] text-right">
                                    {word.value}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : selectedPoll.is_ranking ? (
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
                                isExpanded ? 'text-lg' : 'text-base'
                              } text-gray-900 dark:text-gray-100`}>
                                {result.option_text}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-blue-600 dark:text-blue-400 ${
                                isExpanded ? 'text-3xl' : 'text-2xl'
                              }`}>
                                {result.averageRank?.toFixed(1) || 'N/A'}
                              </div>
                              <div className={`text-gray-600 dark:text-gray-400 ${
                                isExpanded ? 'text-base' : 'text-sm'
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
                                isExpanded ? 'text-lg' : 'text-base'
                              } text-gray-900 dark:text-gray-100`}>
                                {result.option_text}
                              </span>
                              </div>
                              <div className="text-right">
                                <div className={`font-bold text-gray-900 dark:text-gray-100 ${
                                  isExpanded ? 'text-3xl' : 'text-2xl'
                                }`}>
                                  {result.votes}
                                </div>
                                <div className={`text-gray-600 dark:text-gray-400 ${
                                  isExpanded ? 'text-base' : 'text-sm'
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

                {/* Prioritization Matrix Graphs - Show on second question of each pair (2, 4, 6, 8, 10) */}
                {selectedPoll.page_path.includes('prioritization') && 
                 [1, 3, 5, 7, 9].includes(selectedPoll.poll_index) && 
                 matrixData.length > 0 && (() => {
                  // Find the specific graph for this question pair
                  const questionPairIndex = [1, 3, 5, 7, 9].indexOf(selectedPoll.poll_index);
                  const specificGraph = matrixData[questionPairIndex];
                  
                  if (!specificGraph) return null;
                  
                  return (
                    <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                        Prioritization Matrix Results
                      </h3>
                      <div className="flex justify-center">
                        <div className="w-full max-w-4xl">
                          <PrioritizationMatrixGraph key={specificGraph.title} {...specificGraph} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
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
            className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-5xl mx-4 relative transform scale-[1.5]"
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
              <h3 className="text-3xl font-bold text-gray-800 dark:text-white text-center">
                Conference Poll Access
              </h3>
              
              <div className="flex flex-col lg:flex-row items-center justify-center space-y-8 lg:space-y-0 lg:space-x-12 w-full">
                {/* Expanded Join at container */}
                <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800 w-full lg:w-auto lg:min-w-[400px] lg:max-w-[450px]">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="text-3xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
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
                    <div className="text-3xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                      Password:
                    </div>
                    <div className="text-5xl font-bold text-blue-700 dark:text-white" style={{color: '#1d4ed8'}}>
                      CEW2025
                    </div>
                  </div>
                </div>

                {/* Expanded QR Code */}
                <div className="flex items-center justify-center">
                  <div className="transform scale-140">
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
