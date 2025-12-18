import { PollResult, MatrixData } from '../types';
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

interface UsePollExportParams {
  filterMode: 'all' | 'twg' | 'cew';
  filteredPolls: PollResult[];
  getFilteredPollResults: (poll: PollResult) => Array<{
    option_index: number;
    option_text: string;
    votes: number;
    averageRank?: number;
  }>;
  getFilteredVoteCounts: () => {
    twg: number;
    cew: number;
    total: number;
  };
}

export function usePollExport({
  filterMode,
  filteredPolls,
  getFilteredPollResults,
  getFilteredVoteCounts
}: UsePollExportParams) {
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
      alert('No wordcloud data available to export');
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
      alert('No polls available to export');
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
        const filteredResults = getFilteredPollResults(poll);
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

  return {
    exportSingleChoicePoll,
    exportRankingPoll,
    exportWordcloudPoll,
    exportMatrixGraph,
    exportAllQuestions
  };
}
