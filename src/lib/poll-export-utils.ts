/**
 * Poll Results Export Utilities
 * Provides comprehensive CSV export functionality for all poll types
 * with full option text (no truncation) for report generation
 */

export interface ExportMetadata {
  exportDate: string;
  filterMode: 'all' | 'twg' | 'cew';
  totalQuestions: number;
  totalResponses: number;
  twgResponses: number;
  cewResponses: number;
  exportVersion: string;
}

export interface SingleChoicePollExport {
  question: string;
  pollType: string;
  pagePath: string;
  pollIndex: number;
  filterMode: 'all' | 'twg' | 'cew';
  totalResponses: number;
  twgResponses?: number;
  cewResponses?: number;
  options: Array<{
    optionIndex: number;
    optionText: string;
    votes: number;
    percentage: number;
    twgVotes?: number;
    cewVotes?: number;
  }>;
}

export interface RankingPollExport {
  question: string;
  pollType: string;
  pagePath: string;
  pollIndex: number;
  filterMode: 'all' | 'twg' | 'cew';
  totalResponses: number;
  twgResponses?: number;
  cewResponses?: number;
  options: Array<{
    optionIndex: number;
    optionText: string;
    averageRank: number;
    votes: number;
  }>;
}

export interface WordcloudPollExport {
  question: string;
  pollType: string;
  pagePath: string;
  pollIndex: number;
  filterMode: 'all' | 'twg' | 'cew';
  totalResponses: number;
  twgResponses?: number;
  cewResponses?: number;
  words: Array<{
    word: string;
    frequency: number;
    percentage: number;
  }>;
}

export interface MatrixGraphExport {
  questionPair: string;
  question1Text: string;
  question2Text: string;
  filterMode: 'all' | 'twg' | 'cew';
  totalResponses: number;
  avgImportance: number;
  avgFeasibility: number;
  quadrantCounts: {
    highPriority: number;
    noGo: number;
    longerTerm: number;
    possiblyLater: number;
  };
  dataPoints: Array<{
    userId: string;
    userType: 'authenticated' | 'cew';
    importance: number;
    feasibility: number;
    quadrant: string;
  }>;
}

/**
 * Escape CSV values properly
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '""';
  }
  const str = String(value);
  // Replace double quotes with two double quotes, then wrap in quotes if needed
  const escaped = str.replace(/"/g, '""');
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Generate CSV row from array of values
 */
function generateCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(',');
}

/**
 * Generate metadata section for CSV export
 */
export function generateExportMetadata(metadata: ExportMetadata): string {
  const lines = [
    '=== EXPORT METADATA ===',
    `Export Date,${metadata.exportDate}`,
    `Filter Mode,${metadata.filterMode === 'all' ? 'All Responses' : metadata.filterMode === 'twg' ? 'TWG/SSTAC Only' : 'CEW Only'}`,
    `Total Questions,${metadata.totalQuestions}`,
    `Total Responses,${metadata.totalResponses}`,
    `TWG/SSTAC Responses,${metadata.twgResponses}`,
    `CEW Responses,${metadata.cewResponses}`,
    `Export Version,${metadata.exportVersion}`,
    '',
    '=== POLL RESULTS ===',
    ''
  ];
  return lines.join('\n');
}

/**
 * Export single-choice poll to CSV
 */
export function exportSingleChoicePollToCSV(poll: SingleChoicePollExport): string {
  const lines: string[] = [];
  
  // Header
  lines.push(generateCSVRow([
    'Question',
    'Poll Type',
    'Page Path',
    'Poll Index',
    'Filter Mode',
    'Total Responses',
    ...(poll.filterMode === 'all' ? ['TWG/SSTAC Responses', 'CEW Responses'] : []),
    'Option Index',
    'Option Text (Full)',
    'Votes',
    'Percentage',
    ...(poll.filterMode === 'all' ? ['TWG/SSTAC Votes', 'CEW Votes'] : [])
  ]));
  
  // Data rows
  poll.options.forEach(option => {
    const row = [
      poll.question,
      poll.pollType,
      poll.pagePath,
      poll.pollIndex,
      poll.filterMode === 'all' ? 'All Responses' : poll.filterMode === 'twg' ? 'TWG/SSTAC Only' : 'CEW Only',
      poll.totalResponses,
      ...(poll.filterMode === 'all' ? [poll.twgResponses || 0, poll.cewResponses || 0] : []),
      option.optionIndex,
      option.optionText, // Full text, no truncation
      option.votes,
      `${option.percentage.toFixed(2)}%`,
      ...(poll.filterMode === 'all' ? [option.twgVotes || 0, option.cewVotes || 0] : [])
    ];
    lines.push(generateCSVRow(row));
  });
  
  return lines.join('\n');
}

/**
 * Export ranking poll to CSV
 */
export function exportRankingPollToCSV(poll: RankingPollExport): string {
  const lines: string[] = [];
  
  // Header
  lines.push(generateCSVRow([
    'Question',
    'Poll Type',
    'Page Path',
    'Poll Index',
    'Filter Mode',
    'Total Responses',
    ...(poll.filterMode === 'all' ? ['TWG/SSTAC Responses', 'CEW Responses'] : []),
    'Option Index',
    'Option Text (Full)',
    'Average Rank',
    'Votes'
  ]));
  
  // Sort by average rank (best first)
  const sortedOptions = [...poll.options].sort((a, b) => a.averageRank - b.averageRank);
  
  // Data rows
  sortedOptions.forEach(option => {
    const row = [
      poll.question,
      poll.pollType,
      poll.pagePath,
      poll.pollIndex,
      poll.filterMode === 'all' ? 'All Responses' : poll.filterMode === 'twg' ? 'TWG/SSTAC Only' : 'CEW Only',
      poll.totalResponses,
      ...(poll.filterMode === 'all' ? [poll.twgResponses || 0, poll.cewResponses || 0] : []),
      option.optionIndex,
      option.optionText, // Full text, no truncation
      option.averageRank.toFixed(2),
      option.votes
    ];
    lines.push(generateCSVRow(row));
  });
  
  return lines.join('\n');
}

/**
 * Export wordcloud poll to CSV
 */
export function exportWordcloudPollToCSV(poll: WordcloudPollExport): string {
  const lines: string[] = [];
  
  // Header
  lines.push(generateCSVRow([
    'Question',
    'Poll Type',
    'Page Path',
    'Poll Index',
    'Filter Mode',
    'Total Responses',
    ...(poll.filterMode === 'all' ? ['TWG/SSTAC Responses', 'CEW Responses'] : []),
    'Word',
    'Frequency',
    'Percentage'
  ]));
  
  // Sort by frequency (highest first)
  const sortedWords = [...poll.words].sort((a, b) => b.frequency - a.frequency);
  
  // Data rows
  sortedWords.forEach(word => {
    const row = [
      poll.question,
      poll.pollType,
      poll.pagePath,
      poll.pollIndex,
      poll.filterMode === 'all' ? 'All Responses' : poll.filterMode === 'twg' ? 'TWG/SSTAC Only' : 'CEW Only',
      poll.totalResponses,
      ...(poll.filterMode === 'all' ? [poll.twgResponses || 0, poll.cewResponses || 0] : []),
      word.word,
      word.frequency,
      `${word.percentage.toFixed(2)}%`
    ];
    lines.push(generateCSVRow(row));
  });
  
  return lines.join('\n');
}

/**
 * Export matrix graph to CSV
 */
export function exportMatrixGraphToCSV(graph: MatrixGraphExport): string {
  const lines: string[] = [];
  
  // Summary header
  lines.push('=== MATRIX GRAPH SUMMARY ===');
  lines.push(generateCSVRow(['Metric', 'Value']));
  lines.push(generateCSVRow(['Question Pair', graph.questionPair]));
  lines.push(generateCSVRow(['Question 1', graph.question1Text]));
  lines.push(generateCSVRow(['Question 2', graph.question2Text]));
  lines.push(generateCSVRow(['Filter Mode', graph.filterMode === 'all' ? 'All Responses' : graph.filterMode === 'twg' ? 'TWG/SSTAC Only' : 'CEW Only']));
  lines.push(generateCSVRow(['Total Responses', graph.totalResponses]));
  lines.push(generateCSVRow(['Average Importance', graph.avgImportance.toFixed(2)]));
  lines.push(generateCSVRow(['Average Feasibility', graph.avgFeasibility.toFixed(2)]));
  lines.push('');
  lines.push('=== QUADRANT SUMMARY ===');
  lines.push(generateCSVRow(['Quadrant', 'Count']));
  lines.push(generateCSVRow(['HIGH PRIORITY', graph.quadrantCounts.highPriority]));
  lines.push(generateCSVRow(['NO GO', graph.quadrantCounts.noGo]));
  lines.push(generateCSVRow(['LONGER-TERM', graph.quadrantCounts.longerTerm]));
  lines.push(generateCSVRow(['POSSIBLY LATER?', graph.quadrantCounts.possiblyLater]));
  lines.push('');
  lines.push('=== INDIVIDUAL DATA POINTS ===');
  
  // Individual data points header
  lines.push(generateCSVRow([
    'User ID',
    'User Type',
    'Importance',
    'Feasibility',
    'Quadrant'
  ]));
  
  // Data rows
  graph.dataPoints.forEach(point => {
    const row = [
      point.userId,
      point.userType === 'authenticated' ? 'TWG/SSTAC' : 'CEW',
      point.importance,
      point.feasibility,
      point.quadrant
    ];
    lines.push(generateCSVRow(row));
  });
  
  return lines.join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Get filter mode display name
 */
export function getFilterModeDisplayName(mode: 'all' | 'twg' | 'cew'): string {
  switch (mode) {
    case 'all':
      return 'All Responses';
    case 'twg':
      return 'TWG/SSTAC Only';
    case 'cew':
      return 'CEW Only';
    default:
      return 'All Responses';
  }
}

/**
 * Generate filename for poll export
 */
export function generatePollExportFilename(
  pollType: string,
  pagePath: string,
  pollIndex: number,
  filterMode: 'all' | 'twg' | 'cew',
  date?: Date
): string {
  const exportDate = date || new Date();
  const dateStr = exportDate.toISOString().slice(0, 10);
  const topic = pagePath.split('/').pop() || 'poll';
  const filter = filterMode === 'all' ? 'all' : filterMode === 'twg' ? 'twg' : 'cew';
  return `${topic}-q${pollIndex + 1}-${pollType}-${filter}-${dateStr}.csv`;
}

/**
 * Generate filename for bulk export
 */
export function generateBulkExportFilename(filterMode: 'all' | 'twg' | 'cew', date?: Date): string {
  const exportDate = date || new Date();
  const dateStr = exportDate.toISOString().slice(0, 10);
  const filter = filterMode === 'all' ? 'all' : filterMode === 'twg' ? 'twg' : 'cew';
  return `poll-results-${filter}-${dateStr}.csv`;
}

