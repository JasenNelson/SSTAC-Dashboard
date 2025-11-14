'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import QRCodeDisplay from '@/components/dashboard/QRCodeDisplay';
import CustomWordCloud from '@/components/dashboard/CustomWordCloud';
import PrioritizationMatrixGraph from '@/components/graphs/PrioritizationMatrixGraph';
import { useToast } from '@/components/Toast';
import {
  fetchPollResultsData,
  buildCombinedPollResults,
  type CombinedPollResult as PollResult
} from '@/services/pollResultsService';
import {
  exportSingleChoicePollToCSV,
  exportRankingPollToCSV,
  exportWordcloudPollToCSV,
  exportMatrixGraphToCSV,
  generateExportMetadata,
  downloadCSV,
  generatePollExportFilename,
  generateBulkExportFilename,
  type ExportMetadata as ExportMetadataType
} from '@/lib/poll-export-utils';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
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

interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
}

export default function PollResultsClient() {
  const { showToast } = useToast();
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
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showMatrixGraphs, setShowMatrixGraphs] = useState<{[key: string]: boolean}>({});
  const [showPresentationControls, setShowPresentationControls] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  // Toggle matrix graph visibility for a specific question pair
  const toggleMatrixGraph = useCallback((questionPairKey: string) => {
    setShowMatrixGraphs(prev => ({
      ...prev,
      [questionPairKey]: !prev[questionPairKey]
    }));
  }, []);

  const fetchPollResults = useCallback(async () => {
    try {
      setLoading(true);

      const { singleChoice, ranking, wordcloud, errors } = await fetchPollResultsData(supabase);

      if (errors.singleChoice) {
        console.error('Error fetching single-choice poll results:', errors.singleChoice);
      }
      if (errors.ranking) {
        console.error('Error fetching ranking poll results:', errors.ranking);
      }
      if (errors.wordcloud) {
        console.error('Error fetching wordcloud poll results:', errors.wordcloud);
      }

      const { combinedResults, fallbackResults } = buildCombinedPollResults(singleChoice, ranking, wordcloud);
      const nextResults = combinedResults.length ? combinedResults : fallbackResults;

      setPollResults(nextResults);
    } catch (err) {
      console.error('Error fetching poll results:', err);
      setError('Failed to fetch poll results');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchPollResults();
  }, [fetchPollResults]);

  useEffect(() => {
    const fetchMatrixData = async () => {
      try {
        console.log(`🔍 MATRIX API CALL: Fetching matrix data with filter=${filterMode}`);
        const response = await fetch(`/api/graphs/prioritization-matrix?filter=${filterMode}`);
        console.log(`🔍 MATRIX API RESPONSE: Status ${response.status}`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 MATRIX API DATA:', data);
          console.log('🔍 MATRIX API DATA DETAILED:', JSON.stringify(data, null, 2));
          setMatrixData(data);
        } else {
          console.error(`❌ MATRIX API ERROR: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('❌ MATRIX API FAILED:', error);
      }
    };

    void fetchMatrixData();
  }, [filterMode]);

  const getPercentage = (votes: number, totalVotes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };

  // Export functions for each poll type
  const exportSingleChoicePoll = (poll: PollResult) => {
    const filteredResults = getFilteredPollResults(poll);
    const totalVotes = filteredResults.reduce((sum, r) => sum + r.votes, 0);
    
    // Get full option text from options array
    const getFullOptionText = (index: number): string => {
      if (!poll.options || !Array.isArray(poll.options)) return `Option ${index + 1}`;
      return poll.options[index] || `Option ${index + 1}`;
    };

    const exportData = {
      question: poll.question,
      pollType: 'Single-Choice',
      pagePath: poll.page_path,
      pollIndex: poll.poll_index,
      filterMode: filterMode,
      totalResponses: totalVotes,
      twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
      cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
      options: filteredResults.map(result => {
        const fullText = getFullOptionText(result.option_index);
        const percentage = totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0;
        
        // For "all" filter, try to get breakdown from survey/cew results
        let twgVotes: number | undefined;
        let cewVotes: number | undefined;
        
        if (filterMode === 'all') {
          const surveyResult = poll.survey_results?.find(r => r.option_index === result.option_index);
          const cewResult = poll.cew_results?.find(r => r.option_index === result.option_index);
          twgVotes = surveyResult?.votes || 0;
          cewVotes = cewResult?.votes || 0;
        }
        
        return {
          optionIndex: result.option_index,
          optionText: fullText, // Full text, no truncation
          votes: result.votes,
          percentage: percentage,
          twgVotes: filterMode === 'all' ? twgVotes : undefined,
          cewVotes: filterMode === 'all' ? cewVotes : undefined
        };
      })
    };

    const csvContent = exportSingleChoicePollToCSV(exportData);
    const filename = generatePollExportFilename('single-choice', poll.page_path, poll.poll_index, filterMode);
    downloadCSV(csvContent, filename);
  };

  const exportRankingPoll = (poll: PollResult) => {
    const filteredResults = getFilteredPollResults(poll);
    const totalVotes = filteredResults.length > 0 ? filteredResults[0].votes : poll.total_votes;
    
    // Get full option text from options array
    const getFullOptionText = (index: number): string => {
      if (!poll.options || !Array.isArray(poll.options)) return `Option ${index + 1}`;
      return poll.options[index] || `Option ${index + 1}`;
    };

    const exportData = {
      question: poll.question,
      pollType: 'Ranking',
      pagePath: poll.page_path,
      pollIndex: poll.poll_index,
      filterMode: filterMode,
      totalResponses: totalVotes,
      twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
      cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
      options: filteredResults.map(result => ({
        optionIndex: result.option_index,
        optionText: getFullOptionText(result.option_index), // Full text, no truncation
        averageRank: result.averageRank || 0,
        votes: result.votes
      }))
    };

    const csvContent = exportRankingPollToCSV(exportData);
    const filename = generatePollExportFilename('ranking', poll.page_path, poll.poll_index, filterMode);
    downloadCSV(csvContent, filename);
  };

  const exportWordcloudPoll = (poll: PollResult) => {
    if (!poll.wordcloud_words || poll.wordcloud_words.length === 0) {
      showToast({
        type: 'info',
        title: 'Nothing to export',
        message: 'Wordcloud data is currently empty.'
      });
      return;
    }

    const totalVotes = poll.wordcloud_words.reduce((sum, word) => sum + (word.value || 0), 0);
    const totalResponses = poll.total_votes || totalVotes;

    // Calculate percentages
    const wordsWithPercentages = poll.wordcloud_words.map(word => ({
      word: word.text,
      frequency: word.value,
      percentage: totalVotes > 0 ? (word.value / totalVotes) * 100 : 0
    }));

    const exportData = {
      question: poll.question,
      pollType: 'Wordcloud',
      pagePath: poll.page_path,
      pollIndex: poll.poll_index,
      filterMode: filterMode,
      totalResponses: totalResponses,
      twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
      cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
      words: wordsWithPercentages
    };

    const csvContent = exportWordcloudPollToCSV(exportData);
    const filename = generatePollExportFilename('wordcloud', poll.page_path, poll.poll_index, filterMode);
    downloadCSV(csvContent, filename);
  };

  const exportMatrixGraph = (graph: MatrixData, question1Text: string, question2Text: string, questionPair: string) => {
    // Classify data points into quadrants
    const classifyQuadrant = (importance: number, feasibility: number): string => {
      // Scale: 1 = high, 5 = low
      // High Priority: High importance (1-2), High feasibility (1-2)
      // No Go: High importance (1-2), Low feasibility (4-5)
      // Longer-term: Low importance (4-5), High feasibility (1-2)
      // Possibly Later?: Everything else
      
      if (importance <= 2 && feasibility <= 2) return 'HIGH PRIORITY';
      if (importance <= 2 && feasibility >= 4) return 'NO GO';
      if (importance >= 4 && feasibility <= 2) return 'LONGER-TERM';
      return 'POSSIBLY LATER?';
    };

    const quadrantCounts = {
      highPriority: 0,
      noGo: 0,
      longerTerm: 0,
      possiblyLater: 0
    };

    const classifiedPoints = graph.individualPairs.map(point => {
      const quadrant = classifyQuadrant(point.importance, point.feasibility);
      if (quadrant === 'HIGH PRIORITY') quadrantCounts.highPriority++;
      else if (quadrant === 'NO GO') quadrantCounts.noGo++;
      else if (quadrant === 'LONGER-TERM') quadrantCounts.longerTerm++;
      else quadrantCounts.possiblyLater++;
      
      return {
        userId: point.userId,
        userType: point.userType,
        importance: point.importance,
        feasibility: point.feasibility,
        quadrant: quadrant
      };
    });

    const exportData = {
      questionPair: questionPair,
      question1Text: question1Text,
      question2Text: question2Text,
      filterMode: filterMode,
      totalResponses: graph.responses,
      avgImportance: graph.avgImportance,
      avgFeasibility: graph.avgFeasibility,
      quadrantCounts: quadrantCounts,
      dataPoints: classifiedPoints
    };

    const csvContent = exportMatrixGraphToCSV(exportData);
    const filename = `matrix-graph-${questionPair.toLowerCase().replace(/\s+/g, '-')}-${filterMode}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(csvContent, filename);
  };

  const exportAllQuestions = () => {
    if (filteredPolls.length === 0) {
      showToast({
        type: 'info',
        title: 'Nothing to export',
        message: 'No polls are available for export.'
      });
      return;
    }

    const exportDate = new Date();
    const voteCounts = getFilteredVoteCounts();

    // Generate metadata
    const metadata: ExportMetadataType = {
      exportDate: exportDate.toISOString(),
      filterMode: filterMode,
      totalQuestions: filteredPolls.length,
      totalResponses: voteCounts.total,
      twgResponses: voteCounts.twg,
      cewResponses: voteCounts.cew,
      exportVersion: '1.0'
    };

    const csvLines: string[] = [];
    csvLines.push(generateExportMetadata(metadata));
    csvLines.push('');

    // Export each poll
    filteredPolls.forEach((poll, index) => {
      csvLines.push(`=== QUESTION ${index + 1} ===`);
      csvLines.push('');

      if (poll.is_wordcloud) {
        if (poll.wordcloud_words && poll.wordcloud_words.length > 0) {
          const totalVotes = poll.wordcloud_words.reduce((sum, word) => sum + (word.value || 0), 0);
          const wordsWithPercentages = poll.wordcloud_words.map(word => ({
            word: word.text,
            frequency: word.value,
            percentage: totalVotes > 0 ? (word.value / totalVotes) * 100 : 0
          }));

          const exportData = {
            question: poll.question,
            pollType: 'Wordcloud',
            pagePath: poll.page_path,
            pollIndex: poll.poll_index,
            filterMode: filterMode,
            totalResponses: poll.total_votes || totalVotes,
            twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
            cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
            words: wordsWithPercentages
          };
          csvLines.push(exportWordcloudPollToCSV(exportData));
        }
      } else if (poll.is_ranking) {
        const filteredResults = getFilteredPollResults(poll);
        const totalVotes = filteredResults.length > 0 ? filteredResults[0].votes : poll.total_votes;
        
        const getFullOptionText = (index: number): string => {
          if (!poll.options || !Array.isArray(poll.options)) return `Option ${index + 1}`;
          return poll.options[index] || `Option ${index + 1}`;
        };

        const exportData = {
          question: poll.question,
          pollType: 'Ranking',
          pagePath: poll.page_path,
          pollIndex: poll.poll_index,
          filterMode: filterMode,
          totalResponses: totalVotes,
          twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
          cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
          options: filteredResults.map(result => ({
            optionIndex: result.option_index,
            optionText: getFullOptionText(result.option_index),
            averageRank: result.averageRank || 0,
            votes: result.votes
          }))
        };
        csvLines.push(exportRankingPollToCSV(exportData));
      } else {
        // Single-choice poll
        const filteredResults = getFilteredPollResults(poll);
        const totalVotes = filteredResults.reduce((sum, r) => sum + r.votes, 0);
        
        const getFullOptionText = (index: number): string => {
          if (!poll.options || !Array.isArray(poll.options)) return `Option ${index + 1}`;
          return poll.options[index] || `Option ${index + 1}`;
        };

        const exportData = {
          question: poll.question,
          pollType: 'Single-Choice',
          pagePath: poll.page_path,
          pollIndex: poll.poll_index,
          filterMode: filterMode,
          totalResponses: totalVotes,
          twgResponses: filterMode === 'all' ? poll.combined_survey_votes : undefined,
          cewResponses: filterMode === 'all' ? poll.combined_cew_votes : undefined,
          options: filteredResults.map(result => {
            const fullText = getFullOptionText(result.option_index);
            const percentage = totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0;
            
            let twgVotes: number | undefined;
            let cewVotes: number | undefined;
            
            if (filterMode === 'all') {
              const surveyResult = poll.survey_results?.find(r => r.option_index === result.option_index);
              const cewResult = poll.cew_results?.find(r => r.option_index === result.option_index);
              twgVotes = surveyResult?.votes || 0;
              cewVotes = cewResult?.votes || 0;
            }
            
            return {
              optionIndex: result.option_index,
              optionText: fullText,
              votes: result.votes,
              percentage: percentage,
              twgVotes: filterMode === 'all' ? twgVotes : undefined,
              cewVotes: filterMode === 'all' ? cewVotes : undefined
            };
          })
        };
        csvLines.push(exportSingleChoicePollToCSV(exportData));
      }

      csvLines.push('');
      csvLines.push('');
    });

    const csvContent = csvLines.join('\n');
    const filename = generateBulkExportFilename(filterMode);
    downloadCSV(csvContent, filename);
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
    if (poll.is_wordcloud) {
      // For wordcloud polls, create mock results based on vote counts
      const surveyVotes = poll.combined_survey_votes || 0;
      const cewVotes = poll.combined_cew_votes || 0;
      
      if (filterMode === 'twg') {
        return surveyVotes > 0 ? [{ option_index: 0, option_text: 'Survey Responses', votes: surveyVotes }] : [];
      } else if (filterMode === 'cew') {
        return cewVotes > 0 ? [{ option_index: 0, option_text: 'CEW Responses', votes: cewVotes }] : [];
      } else if (filterMode === 'all') {
        // For "all" filter, show combined total
        const totalVotes = surveyVotes + cewVotes;
        return totalVotes > 0 ? [{ option_index: 0, option_text: 'All Responses', votes: totalVotes }] : [];
      }
      return [];
    } else if (poll.is_ranking) {
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
      // For "all" filter, return combined results
      return poll.results;
    }
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

          {/* Display Options */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Display Options</h3>
            <div className="space-y-2">
              <button
                onClick={() => setShowPresentationControls((prev) => !prev)}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-between ${
                  showPresentationControls
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span>{showPresentationControls ? 'Hide Presentation Controls' : 'Show Presentation Controls'}</span>
                <span className="text-sm">
                  {showPresentationControls ? 'ON' : 'OFF'}
                </span>
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Toggle the per-question export button, join instructions, and QR code display in the results view.
              </p>
            </div>
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
                          // For all poll types, use filtered results to respect the current filter mode
                          const totalVotes = getFilteredPollResults(poll).reduce((sum, r) => sum + r.votes, 0);
                          
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
          
          {/* Export All Button */}
          <div className="mt-4">
            <button
              onClick={exportAllQuestions}
              disabled={loading || filteredPolls.length === 0}
              className="w-full px-4 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title="Export all questions to a single CSV file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export All ({filteredPolls.length} questions)
            </button>
          </div>

          {/* Refresh Button */}
          <div className="mt-4">
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
                      
                      {/* Export Buttons */}
                      {showPresentationControls && (
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => {
                              if (selectedPoll.is_wordcloud) {
                                exportWordcloudPoll(selectedPoll);
                              } else if (selectedPoll.is_ranking) {
                                exportRankingPoll(selectedPoll);
                              } else {
                                exportSingleChoicePoll(selectedPoll);
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200"
                            title="Export this question to CSV"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                          </button>
                        </div>
                      )}
                      
                      {/* QR Code and Join at containers - positioned on the right */}
                      {showPresentationControls && (
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
                      )}
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


                <div className={`space-y-2 ${isExpanded ? 'space-y-2 flex-1 px-4' : ''}`}>
                  {selectedPoll.is_wordcloud ? (
                    // For wordcloud polls, display word cloud visualization
                    <div className="space-y-6">
                      {/* Word Cloud Visualization */}
                      {selectedPoll.wordcloud_words && selectedPoll.wordcloud_words.length > 0 ? (
                        <div 
                          className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-inner"
                        >
                          <div className="mb-4 flex justify-between items-center">
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
                                  <div className="w-24 bg-gray-200 dark:bg-gray-300 rounded-full h-2">
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
                    (() => {
                      // Define pollKey once for the ranking poll chart
                      const filteredResults = getFilteredPollResults(selectedPoll);
                      let sortedResults = [...filteredResults].sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
                      
                      // For prioritization questions, ensure all 5 options are shown in order
                      if (selectedPoll.page_path.includes('prioritization')) {
                        // Create a complete set of all 5 options (0-4) with default values for missing ones
                        const completeResults = [];
                        const resultsMap = new Map(filteredResults.map(r => [r.option_index, r]));
                        
                        // Debug: Log the options array to see what we have
                        console.log('🔍 Prioritization ranking poll options:', {
                          pollIndex: selectedPoll.poll_index,
                          options: selectedPoll.options,
                          optionsType: typeof selectedPoll.options,
                          optionsLength: selectedPoll.options?.length,
                          isArray: Array.isArray(selectedPoll.options),
                          stringified: JSON.stringify(selectedPoll.options)
                        });
                        
                        // For prioritization questions 3 and 4, only create 4 options (0-3), for others create 5
                        const maxOptions = (selectedPoll.poll_index === 2 || selectedPoll.poll_index === 3) ? 4 : 5; // poll_index 2 = question 3, poll_index 3 = question 4
                        for (let i = 0; i < maxOptions; i++) {
                          if (resultsMap.has(i)) {
                            completeResults.push(resultsMap.get(i)!);
                          } else {
                            // Create a placeholder result for missing options
                            // Try to get option text from the options array, with better fallback
                            let optionText = `Option ${i + 1}`;
                            
                            // Try to parse options if they're stored as JSON string
                            let optionsArray = selectedPoll.options;
                            if (typeof selectedPoll.options === 'string') {
                              try {
                                optionsArray = JSON.parse(selectedPoll.options);
                              } catch (e) {
                                console.warn('Failed to parse options JSON:', e);
                              }
                            }
                            
                            if (optionsArray && Array.isArray(optionsArray) && optionsArray[i]) {
                              optionText = optionsArray[i];
                            } else if (optionsArray && typeof optionsArray === 'object' && optionsArray[i]) {
                              optionText = optionsArray[i];
                            }
                            
                            completeResults.push({
                              option_index: i,
                              option_text: optionText,
                              votes: 0,
                              averageRank: 0
                            });
                          }
                        }
                        sortedResults = completeResults.sort((a, b) => (a.averageRank || 0) - (b.averageRank || 0));
                      }
                      
                      // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
                      const needsLargerText = (
                        (selectedPoll.page_path.includes('holistic-protection') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 7) ||
                        (selectedPoll.page_path.includes('prioritization') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 1)
                      );
                      
                      return (
                        <div 
                          className="space-y-4"
                        >
                            {sortedResults.map((result, idx) => {
                            const isTopChoice = idx === 0; // First item after sorting by rank
                            
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
                                      needsLargerText 
                                        ? (isExpanded ? 'text-xl' : 'text-lg')
                                        : (isExpanded ? 'text-lg' : 'text-base')
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
                                <div className={`w-full max-w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                                  needsLargerText 
                                    ? (isExpanded ? 'h-10' : 'h-7')
                                    : (isExpanded ? 'h-8' : 'h-5')
                                }`}>
                                  <div
                                    className={`rounded-full transition-all duration-700 max-w-full ${
                                      needsLargerText 
                                        ? (isExpanded ? 'h-10' : 'h-7')
                                        : (isExpanded ? 'h-8' : 'h-5')
                                    } ${
                                      isTopChoice 
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                        : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                    }`}
                                    style={{ 
                                      width: `${(() => {
                                        const validResults = sortedResults.filter(r => 
                                          r.averageRank !== null && r.averageRank !== undefined
                                        );
                                        if (validResults.length === 0) return '100%';
                                        const maxRank = Math.max(...validResults.map(r => r.averageRank || 0));
                                        const minRank = Math.min(...validResults.map(r => r.averageRank || 0));
                                        const rankRange = maxRank - minRank;
                                        
                                        if (rankRange === 0) return '100%';
                                        
                                        const inverseValue = maxRank - (result.averageRank || 0) + 1;
                                        const maxInverseValue = rankRange + 1;
                                        
                                        return `${Math.max(10, (inverseValue / maxInverseValue) * 100)}%`;
                                      })()}` 
                                    }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    // For single-choice polls, use expanded format for tiered-framework, compact for others
                    (() => {
                      // Define pollKey once for both expanded and compact formats
                      const filteredResults = getFilteredPollResults(selectedPoll);
                      const filteredTotal = filteredResults.reduce((sum, r) => sum + r.votes, 0);
                      const maxVotes = Math.max(...filteredResults.map(r => r.votes));
                      
                      // For prioritization and tiered-framework questions, ensure all options are shown in order
                      let sortedResults = [...filteredResults].sort((a, b) => a.option_index - b.option_index);
                      
                      if (selectedPoll.page_path.includes('prioritization')) {
                        // Create a complete set of all 5 options (0-4) with 0 votes for missing ones
                        const completeResults = [];
                        const resultsMap = new Map(filteredResults.map(r => [r.option_index, r]));
                        
                        for (let i = 0; i < 5; i++) {
                          if (resultsMap.has(i)) {
                            completeResults.push(resultsMap.get(i)!);
                          } else {
                            // Create a placeholder result for missing options
                            completeResults.push({
                              option_index: i,
                              option_text: selectedPoll.options?.[i] || `Option ${i + 1}`,
                              votes: 0
                            });
                          }
                        }
                        sortedResults = completeResults;
                      } else if (selectedPoll.page_path.includes('tiered-framework')) {
                        // Create a complete set of all 5 options (0-4) with 0 votes for missing ones
                        const completeResults = [];
                        const resultsMap = new Map(filteredResults.map(r => [r.option_index, r]));
                        
                        for (let i = 0; i < 5; i++) {
                          if (resultsMap.has(i)) {
                            completeResults.push(resultsMap.get(i)!);
                          } else {
                            // Create a placeholder result for missing options
                            completeResults.push({
                              option_index: i,
                              option_text: selectedPoll.options?.[i] || `Option ${i + 1}`,
                              votes: 0
                            });
                          }
                        }
                        sortedResults = completeResults;
                      }
                      
                      // Use expanded format for tiered-framework questions (same as ranking polls)
                      if (selectedPoll.page_path.includes('tiered-framework')) {
                        // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
                        const needsLargerText = (
                          (selectedPoll.page_path.includes('holistic-protection') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 7) ||
                          (selectedPoll.page_path.includes('prioritization') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 1)
                        );
                        
                      return (
                        <div 
                          className="space-y-4"
                        >
                            {sortedResults.map(result => {
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
                                    needsLargerText 
                                      ? (isExpanded ? 'text-xl' : 'text-lg')
                                      : (isExpanded ? 'text-lg' : 'text-base')
                                  } text-gray-900 dark:text-gray-100`}>
                                    {result.option_text}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className={`font-bold text-blue-600 dark:text-blue-400 ${
                                    isExpanded ? 'text-3xl' : 'text-2xl'
                                  }`}>
                                    {result.votes}
                                  </div>
                                  <div className={`text-gray-600 dark:text-gray-400 ${
                                    isExpanded ? 'text-base' : 'text-sm'
                                  }`}>
                                    Votes
                                  </div>
                                </div>
                              </div>
                              <div className={`w-full max-w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                                needsLargerText 
                                  ? (isExpanded ? 'h-10' : 'h-7')
                                  : (isExpanded ? 'h-8' : 'h-5')
                              }`}>
                                <div
                                  className={`rounded-full transition-all duration-700 max-w-full ${
                                    needsLargerText 
                                      ? (isExpanded ? 'h-10' : 'h-7')
                                      : (isExpanded ? 'h-8' : 'h-5')
                                  } ${
                                    isTopChoice 
                                      ? 'bg-gradient-to-r from-blue-500 to-blue-600' 
                                      : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                  }`}
                                  style={{ 
                                    width: `${Math.max(2, percentage)}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      );
                      }
                      
                      // Use compact format for other single-choice polls
                      // Calculate the width needed for the longest option text
                      const maxTextLength = Math.max(...sortedResults.map(r => r.option_text.length));
                      const textWidth = Math.min(Math.max(maxTextLength * 8, 80), 150); // 8px per character, min 80px, max 150px
                      
                      // Define gradient colors from light to dark (lowest to highest votes)
                      const getGradientColor = (votes: number, maxVotes: number) => {
                        const ratio = maxVotes > 0 ? votes / maxVotes : 0;
                        if (ratio >= 0.8) return 'bg-gradient-to-r from-indigo-600 to-indigo-700'; // Highest votes - dark indigo
                        if (ratio >= 0.6) return 'bg-gradient-to-r from-indigo-500 to-indigo-600'; // High votes - indigo
                        if (ratio >= 0.4) return 'bg-gradient-to-r from-blue-600 to-indigo-500'; // Medium votes - blue to indigo
                        if (ratio >= 0.2) return 'bg-gradient-to-r from-blue-500 to-blue-600'; // Low votes - blue
                        return 'bg-gradient-to-r from-blue-400 to-blue-500'; // Lowest votes - light blue
                      };
                      
                      // Check if this is a question that needs larger text (Questions 1-8 in holistic, Questions 1-2 in prioritization)
                      const needsLargerText = (
                        (selectedPoll.page_path.includes('holistic-protection') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 7) ||
                        (selectedPoll.page_path.includes('prioritization') && selectedPoll.poll_index >= 0 && selectedPoll.poll_index <= 1)
                      );
                      
                      return (
                        <div 
                          className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
                        >
                          <div className="space-y-2">
                            {sortedResults.map(result => {
                              const percentage = getPercentage(result.votes, filteredTotal);
                              
                              return (
                                <div key={result.option_index} className="flex items-center space-x-3">
                                  <div 
                                    className={`flex-shrink-0 font-medium text-gray-600 dark:text-gray-400 text-left ${
                                      needsLargerText ? 'text-lg' : 'text-xs'
                                    }`}
                                    style={{ width: `${textWidth}px` }}
                                  >
                                    {result.option_text}
                                  </div>
                                  <div className="flex-1 relative min-w-[80px]">
                                    <div className={`w-full bg-gray-200 dark:bg-gray-300 rounded-full overflow-hidden ${
                                      needsLargerText ? 'h-6' : 'h-4'
                                    }`}>
                                      <div
                                        className={`rounded-full transition-all duration-500 ${getGradientColor(result.votes, maxVotes)} ${
                                          needsLargerText ? 'h-6' : 'h-4'
                                        }`}
                                        style={{ 
                                          width: `${Math.max(2, percentage)}%` 
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                  <div className={`w-12 flex-shrink-0 font-semibold text-gray-700 dark:text-gray-300 text-right ${
                                    needsLargerText ? 'text-sm' : 'text-xs'
                                  }`}>
                                    {result.votes}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
                            Total: {filteredTotal} response{filteredTotal !== 1 ? 's' : ''}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Prioritization Matrix Graphs - Show only after Question 2 (poll_index 1) */}
                {selectedPoll.page_path.includes('prioritization') && 
                 selectedPoll.poll_index === 1 && 
                 matrixData.length > 0 && (() => {
                  // For prioritization, use the first graph (index 0)
                  const specificGraph = matrixData[0];
                  const questionPairKey = 'prioritization-q1-q2';
                  const isVisible = showMatrixGraphs[questionPairKey];
                  
                  if (!specificGraph) return null;
                  
                  return (
                    <div className="mt-6">
                      {/* Toggle and Export Buttons */}
                      <div className="flex justify-center gap-3 mb-4">
                        <button
                          onClick={() => toggleMatrixGraph(questionPairKey)}
                          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
                        >
                          {isVisible ? (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Hide Matrix Graph
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Show Matrix Graph
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const q1Poll = filteredPolls.find(p => p.page_path.includes('prioritization') && p.poll_index === 0);
                            const q2Poll = filteredPolls.find(p => p.page_path.includes('prioritization') && p.poll_index === 1);
                            const q1Text = q1Poll?.question || 'Question 1';
                            const q2Text = q2Poll?.question || 'Question 2';
                            exportMatrixGraph(specificGraph, q1Text, q2Text, 'Prioritization Q1-Q2');
                          }}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
                          title="Export matrix graph data to CSV"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export CSV
                        </button>
                      </div>
                      
                      {/* Matrix Graph - Conditionally Rendered */}
                      {isVisible && (
                        <div 
                          className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800"
                        >
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                            Prioritization
                          </h3>
                          <div className="flex justify-center">
                            <div className="w-full max-w-4xl">
                              <PrioritizationMatrixGraph key={specificGraph.title} {...specificGraph} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Holistic Protection Matrix Graphs - Show on feasibility questions (1, 3, 5, 7) */}
                {selectedPoll.page_path.includes('holistic-protection') && 
                 [1, 3, 5, 7].includes(selectedPoll.poll_index) && 
                 matrixData.length > 0 && (() => {
                  // Find the specific graph for this question pair (offset by 1 since holistic starts at index 1 in matrixData)
                  const questionPairIndex = [1, 3, 5, 7].indexOf(selectedPoll.poll_index);
                  const specificGraph = matrixData[questionPairIndex + 1]; // +1 because index 0 is prioritization
                  
                  if (!specificGraph) return null;
                  
                  // Create unique key for each question pair
                  const questionPairKey = `holistic-q${selectedPoll.poll_index}-q${selectedPoll.poll_index + 1}`;
                  const isVisible = showMatrixGraphs[questionPairKey];
                  
                  return (
                    <div className="mt-6">
                      {/* Toggle and Export Buttons */}
                      <div className="flex justify-center gap-3 mb-4">
                        <button
                          onClick={() => toggleMatrixGraph(questionPairKey)}
                          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
                        >
                          {isVisible ? (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Hide Matrix Graph
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              Show Matrix Graph
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            const importancePoll = filteredPolls.find(p => p.page_path.includes('holistic-protection') && p.poll_index === selectedPoll.poll_index - 1);
                            const feasibilityPoll = filteredPolls.find(p => p.page_path.includes('holistic-protection') && p.poll_index === selectedPoll.poll_index);
                            const q1Text = importancePoll?.question || `Question ${selectedPoll.poll_index}`;
                            const q2Text = feasibilityPoll?.question || `Question ${selectedPoll.poll_index + 1}`;
                            exportMatrixGraph(specificGraph, q1Text, q2Text, `Holistic Protection Q${selectedPoll.poll_index}-Q${selectedPoll.poll_index + 1}`);
                          }}
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
                          title="Export matrix graph data to CSV"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Export CSV
                        </button>
                      </div>
                      
                      {/* Matrix Graph - Conditionally Rendered */}
                      {isVisible && (
                        <div 
                          className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800"
                        >
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                            Prioritization
                          </h3>
                          <div className="flex justify-center">
                            <div className="w-full max-w-4xl">
                              <PrioritizationMatrixGraph key={specificGraph.title} {...specificGraph} />
                            </div>
                          </div>
                        </div>
                      )}
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
