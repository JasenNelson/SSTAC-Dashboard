'use client';

import InteractiveBarChart from './InteractiveBarChart';

interface PollOption {
  option_index: number;
  option_text: string;
  votes: number;
  other_texts?: string[];
}

interface PollResults {
  total_votes: number;
  results: PollOption[];
}

interface RankingResults {
  total_votes: number;
  results: Array<{
    option_index: number;
    option_text: string;
    averageRank: number;  // Note: camelCase from database view
    votes: number;        // Note: 'votes' not 'vote_count' from database view
  }>;
}

interface PollResultsChartProps {
  pollType: 'single-choice' | 'ranking';
  results: PollResults | RankingResults | null;
  title?: string;
  showVoteCount?: boolean;
  showPercentages?: boolean;
  interactive?: boolean;
  options?: string[]; // Add options array for option labels
}

export default function PollResultsChart({
  pollType,
  results,
  title = 'Poll Results',
  showVoteCount = true,
  showPercentages = true,
  interactive = true,
  options: _options = [],
}: PollResultsChartProps) {
  // Safety check for no results
  if (!results || results.total_votes === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <div className="text-4xl mb-2">📊</div>
          <p>No votes yet</p>
          <p className="text-sm mt-1">Be the first to vote!</p>
        </div>
      </div>
    );
  }

  // Color palette for poll options
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
  ];

  let chartData;

  if (pollType === 'single-choice') {
    const singleChoiceResults = results as PollResults;
    
    // Safety check for results array
    if (!singleChoiceResults.results || !Array.isArray(singleChoiceResults.results)) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <div className="text-4xl mb-2">📊</div>
            <p>No poll data available</p>
            <p className="text-sm mt-1">Poll results are being processed</p>
          </div>
        </div>
      );
    }
    
    // Sort by votes (highest first) for better visualization
    const sortedResults = [...singleChoiceResults.results].sort((a, b) => b.votes - a.votes);
    
    chartData = sortedResults.map((option, index) => {
      // Use option label (A, B, C, D, E) for mobile-friendly display
      const optionLabel = `Option ${String.fromCharCode(65 + option.option_index)}`;
      const optionText = option.option_text || 'Unknown Option';
      
      // Build description - keep it simple for "Other" options
      const description = `${optionLabel}: ${optionText} - ${option.votes} vote${option.votes !== 1 ? 's' : ''}`;
      // Note: We don't show other_texts in the chart to keep it simple
      
      return {
        label: optionLabel,
        value: option.votes,
        color: colors[index % colors.length],
        description: description,
        fullText: optionText, // Keep full text for tooltips
        otherTexts: option.other_texts || [], // Keep other texts for display
      };
    });
  } else {
    const rankingResults = results as RankingResults;
    
    // Safety check for results array
    if (!rankingResults.results || !Array.isArray(rankingResults.results)) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <div className="text-4xl mb-2">📊</div>
            <p>No ranking data available</p>
            <p className="text-sm mt-1">Ranking results are being processed</p>
          </div>
        </div>
      );
    }
    
    // Sort by average rank (lowest first, since lower rank = better)
    // Filter out options with undefined averageRank and sort the rest
    const validResults = rankingResults.results.filter(option => 
      option.averageRank !== null && option.averageRank !== undefined
    );
    const sortedResults = [...validResults].sort((a, b) => a.averageRank - b.averageRank);
    
    // For ranking, we want to show bars sized inversely to rank (lower rank = longer bar)
    const maxRank = Math.max(...sortedResults.map(option => option.averageRank));
    const minRank = Math.min(...sortedResults.map(option => option.averageRank));
    const rankRange = maxRank - minRank;
    
    chartData = sortedResults.map((option, index) => {
      // Use option label (A, B, C, D, E) for mobile-friendly display
      const optionLabel = `Option ${String.fromCharCode(65 + option.option_index)}`;
      const optionText = option.option_text || 'Unknown Option';
      
      // Calculate inverse value for bar length (lower rank = higher value for display)
      const inverseValue = rankRange > 0 ? maxRank - option.averageRank + 1 : 1;
      
      return {
        label: optionLabel,
        value: inverseValue, // Use inverse value for bar length
        color: colors[index % colors.length],
        description: `${optionLabel}: ${optionText} - Average rank: ${option.averageRank.toFixed(1)} (${option.votes} vote${option.votes !== 1 ? 's' : ''})`,
        originalValue: option.averageRank, // Keep original rank for display
        fullText: optionText, // Keep full text for tooltips
      };
    });
    
    // If no valid results, show empty state
    if (chartData.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">{title}</h3>
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <div className="text-4xl mb-2">📊</div>
            <p>No ranking data available</p>
            <p className="text-sm mt-1">Complete rankings to see results</p>
          </div>
        </div>
      );
    }
  }

  // Custom title based on poll type
  const chartTitle = pollType === 'ranking' 
    ? `${title} - Average Rankings (Lower = Better)`
    : title;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">{chartTitle}</h3>
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {pollType === 'ranking' ? 'Average Rank' : 'Vote Count'}
          </span>
          <span>
            Total: {results.total_votes} response{results.total_votes !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      {pollType === 'ranking' ? (
        <div className="space-y-3">
          {chartData.map((item, index) => {
            const rankValue = (item as { originalValue?: number }).originalValue ?? 0;
            const _isHovered = false; // Reserved for future hover state

            return (
              <div key={index} className="group relative">
                <div className="flex items-center space-x-3">
                  {/* Label */}
                  <div className="w-64 text-sm font-medium text-gray-700 dark:text-gray-300 text-right">
                    {item.label}
                  </div>

                  {/* Bar Container */}
                  <div className="flex-1 bg-gray-200 dark:bg-gray-600 rounded-full h-8 overflow-hidden relative">
                    {/* Bar - sized based on inverse rank (lower rank = longer bar) */}
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: item.color,
                        width: `${(item.value / Math.max(...chartData.map(d => d.value))) * 100}%`,
                      }}
                    />

                    {/* Rank Value on Bar */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-white drop-shadow-sm">
                        {rankValue.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Rank Label */}
                  <div className="w-20 text-sm font-semibold text-gray-600 dark:text-gray-400 text-right">
                    Rank {rankValue.toFixed(1)}
                  </div>
                </div>
                
              </div>
            );
          })}
        </div>
      ) : (
        <InteractiveBarChart
          data={chartData}
          title=""
          orientation="horizontal"
          showValues={showVoteCount}
          showPercentages={showPercentages}
          interactive={interactive}
        />
      )}
      
      {pollType === 'ranking' && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2 text-sm text-blue-800 dark:text-blue-200">
            <span className="text-blue-600 dark:text-blue-400">💡</span>
            <span>
              <strong>Ranking Guide:</strong> Lower average rank = higher importance 
              (1st = most important, {chartData.length}th = least important)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
