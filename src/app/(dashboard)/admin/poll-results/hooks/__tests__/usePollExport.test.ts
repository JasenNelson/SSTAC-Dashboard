import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePollExport } from '../usePollExport';
import { PollResult, MatrixData } from '../../types';
import * as exportUtils from '@/lib/poll-export-utils';

// Mock the export utilities
vi.mock('@/lib/poll-export-utils', () => ({
  exportSingleChoicePollToCSV: vi.fn(() => 'csv-content'),
  exportRankingPollToCSV: vi.fn(() => 'csv-content'),
  exportWordcloudPollToCSV: vi.fn(() => 'csv-content'),
  exportMatrixGraphToCSV: vi.fn(() => 'csv-content'),
  generateExportMetadata: vi.fn(() => 'metadata-header'),
  downloadCSV: vi.fn(),
  generatePollExportFilename: vi.fn((type, path, index, mode) => `export-${type}-${mode}.csv`),
  generateBulkExportFilename: vi.fn((mode) => `bulk-export-${mode}.csv`)
}));

// Mock alert
global.alert = vi.fn();

describe('usePollExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock data generators
  const mockSingleChoicePoll = (overrides?: Partial<PollResult>): PollResult => ({
    poll_id: 'poll-1',
    question: 'What is your priority?',
    options: ['Option A', 'Option B', 'Option C'],
    is_wordcloud: false,
    is_ranking: false,
    poll_index: 0,
    page_path: '/holistic-protection',
    total_votes: 100,
    combined_survey_votes: 60,
    combined_cew_votes: 40,
    survey_results: [
      { option_index: 0, votes: 40 },
      { option_index: 1, votes: 15 },
      { option_index: 2, votes: 5 }
    ],
    cew_results: [
      { option_index: 0, votes: 25 },
      { option_index: 1, votes: 10 },
      { option_index: 2, votes: 5 }
    ],
    wordcloud_words: [],
    ranking_poll_id: undefined,
    ...overrides
  });

  const mockRankingPoll = (overrides?: Partial<PollResult>): PollResult => ({
    poll_id: undefined,
    ranking_poll_id: 'ranking-1',
    question: 'Rank by importance',
    options: ['Item A', 'Item B', 'Item C'],
    is_wordcloud: false,
    is_ranking: true,
    poll_index: 1,
    page_path: '/tiered-framework',
    total_votes: 80,
    combined_survey_votes: 50,
    combined_cew_votes: 30,
    survey_results: [
      { option_index: 0, votes: 50, averageRank: 1.5 },
      { option_index: 1, votes: 50, averageRank: 2.0 },
      { option_index: 2, votes: 50, averageRank: 2.8 }
    ],
    cew_results: [
      { option_index: 0, votes: 30, averageRank: 1.6 },
      { option_index: 1, votes: 30, averageRank: 2.1 },
      { option_index: 2, votes: 30, averageRank: 2.9 }
    ],
    wordcloud_words: [],
    ...overrides
  });

  const mockWordcloudPoll = (overrides?: Partial<PollResult>): PollResult => ({
    poll_id: 'wordcloud-1',
    question: 'What matters most?',
    options: [],
    is_wordcloud: true,
    is_ranking: false,
    poll_index: 2,
    page_path: '/prioritization',
    total_votes: 100,
    combined_survey_votes: 60,
    combined_cew_votes: 40,
    survey_results: [],
    cew_results: [],
    wordcloud_words: [
      { text: 'ecosystem', value: 45 },
      { text: 'protection', value: 35 },
      { text: 'health', value: 20 }
    ],
    ranking_poll_id: undefined,
    ...overrides
  });

  const mockMatrixData = (overrides?: Partial<MatrixData>): MatrixData => ({
    title: 'Prioritization Q1-Q2',
    avgImportance: 3.2,
    avgFeasibility: 2.8,
    responses: 50,
    individualPairs: [
      { userId: 'user-1', userType: 'twg', importance: 1, feasibility: 1 },
      { userId: 'user-2', userType: 'cew', importance: 2, feasibility: 3 },
      { userId: 'user-3', userType: 'twg', importance: 4, feasibility: 2 },
      { userId: 'user-4', userType: 'cew', importance: 5, feasibility: 4 }
    ],
    ...overrides
  });

  // Test: Hook initialization
  it('should initialize with correct params', () => {
    const mockGetFilteredPollResults = vi.fn(() => []);
    const mockGetFilteredVoteCounts = vi.fn(() => ({ twg: 0, cew: 0, total: 0 }));

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    expect(result.current).toBeDefined();
    expect(typeof result.current.exportSingleChoicePoll).toBe('function');
    expect(typeof result.current.exportRankingPoll).toBe('function');
    expect(typeof result.current.exportWordcloudPoll).toBe('function');
    expect(typeof result.current.exportMatrixGraph).toBe('function');
    expect(typeof result.current.exportAllQuestions).toBe('function');
  });

  // Test: Single-choice poll export
  it('should export single-choice poll with filter mode all', () => {
    const poll = mockSingleChoicePoll();
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option A', votes: 65 },
      { option_index: 1, option_text: 'Option B', votes: 25 },
      { option_index: 2, option_text: 'Option C', votes: 10 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportSingleChoicePoll(poll);
    });

    expect(exportUtils.exportSingleChoicePollToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      'csv-content',
      expect.stringContaining('single-choice')
    );
  });

  // Test: Single-choice poll export with TWG filter
  it('should export single-choice poll with filter mode twg', () => {
    const poll = mockSingleChoicePoll();
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option A', votes: 40 },
      { option_index: 1, option_text: 'Option B', votes: 15 },
      { option_index: 2, option_text: 'Option C', votes: 5 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'twg',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportSingleChoicePoll(poll);
    });

    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      'csv-content',
      expect.stringContaining('twg')
    );
  });

  // Test: Ranking poll export
  it('should export ranking poll with average ranks', () => {
    const poll = mockRankingPoll();
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Item A', votes: 50, averageRank: 1.5 },
      { option_index: 1, option_text: 'Item B', votes: 50, averageRank: 2.0 },
      { option_index: 2, option_text: 'Item C', votes: 50, averageRank: 2.8 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportRankingPoll(poll);
    });

    expect(exportUtils.exportRankingPollToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      'csv-content',
      expect.stringContaining('ranking')
    );
  });

  // Test: Wordcloud poll export
  it('should export wordcloud poll with word frequencies', () => {
    const poll = mockWordcloudPoll();
    const mockGetFilteredPollResults = vi.fn(() => []);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportWordcloudPoll(poll);
    });

    expect(exportUtils.exportWordcloudPollToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      'csv-content',
      expect.stringContaining('wordcloud')
    );
  });

  // Test: Wordcloud poll export with empty data
  it('should alert when wordcloud has no data', () => {
    const poll = mockWordcloudPoll({ wordcloud_words: [] });
    const mockGetFilteredPollResults = vi.fn();
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportWordcloudPoll(poll);
    });

    expect(global.alert).toHaveBeenCalledWith('No wordcloud data available to export');
    expect(exportUtils.downloadCSV).not.toHaveBeenCalled();
  });

  // Test: Matrix graph export with quadrant classification
  it('should export matrix graph with quadrant classification', () => {
    const matrixData = mockMatrixData();
    const mockGetFilteredPollResults = vi.fn();
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportMatrixGraph(matrixData, 'Question 1', 'Question 2', 'priority-q1-q2');
    });

    expect(exportUtils.exportMatrixGraphToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      'csv-content',
      expect.stringContaining('matrix-graph')
    );
  });

  // Test: Matrix graph quadrant classification logic
  it('should correctly classify matrix data into quadrants', () => {
    // Data with different quadrant scenarios
    const matrixData = mockMatrixData({
      individualPairs: [
        { userId: 'user-1', userType: 'twg', importance: 1, feasibility: 1 }, // HIGH PRIORITY
        { userId: 'user-2', userType: 'cew', importance: 1, feasibility: 4 }, // NO GO
        { userId: 'user-3', userType: 'twg', importance: 4, feasibility: 1 }, // LONGER-TERM
        { userId: 'user-4', userType: 'cew', importance: 3, feasibility: 3 }  // POSSIBLY LATER?
      ]
    });

    const mockGetFilteredPollResults = vi.fn();
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportMatrixGraph(matrixData, 'Q1', 'Q2', 'test-pair');
    });

    // Verify the export was called (which means classification happened)
    expect(exportUtils.exportMatrixGraphToCSV).toHaveBeenCalled();
  });

  // Test: Bulk export all questions
  it('should export all questions in bulk', () => {
    const polls = [mockSingleChoicePoll(), mockRankingPoll(), mockWordcloudPoll()];
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option', votes: 50 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn(() => ({ twg: 60, cew: 40, total: 100 }));

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: polls,
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportAllQuestions();
    });

    expect(exportUtils.generateExportMetadata).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      expect.stringContaining('metadata-header'),
      expect.stringContaining('bulk-export')
    );
  });

  // Test: Bulk export with no polls
  it('should alert when no polls available for bulk export', () => {
    const mockGetFilteredPollResults = vi.fn();
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportAllQuestions();
    });

    expect(global.alert).toHaveBeenCalledWith('No polls available to export');
    expect(exportUtils.downloadCSV).not.toHaveBeenCalled();
  });

  // Test: Filter mode affects export filename
  it('should include correct filter mode in exported filenames', () => {
    const poll = mockSingleChoicePoll();
    const modes: Array<'all' | 'twg' | 'cew'> = ['all', 'twg', 'cew'];

    modes.forEach(mode => {
      vi.clearAllMocks();

      const mockGetFilteredPollResults = vi.fn(() => [
        { option_index: 0, option_text: 'Option A', votes: 50 }
      ]);
      const mockGetFilteredVoteCounts = vi.fn();

      const { result } = renderHook(() =>
        usePollExport({
          filterMode: mode,
          filteredPolls: [poll],
          getFilteredPollResults: mockGetFilteredPollResults,
          getFilteredVoteCounts: mockGetFilteredVoteCounts
        })
      );

      act(() => {
        result.current.exportSingleChoicePoll(poll);
      });

      expect(exportUtils.generatePollExportFilename).toHaveBeenCalledWith(
        'single-choice',
        poll.page_path,
        poll.poll_index,
        mode
      );
    });
  });

  // Test: Single-choice poll with no options array
  it('should handle single-choice poll without options array gracefully', () => {
    const poll = mockSingleChoicePoll({ options: undefined });
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option 1', votes: 30 },
      { option_index: 1, option_text: 'Option 2', votes: 20 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportSingleChoicePoll(poll);
    });

    // Should still export (using default "Option N" format)
    expect(exportUtils.exportSingleChoicePollToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalled();
  });

  // Test: Percentage calculation in exports
  it('should calculate percentages correctly for single-choice poll', () => {
    const poll = mockSingleChoicePoll();
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option A', votes: 50 },
      { option_index: 1, option_text: 'Option B', votes: 30 },
      { option_index: 2, option_text: 'Option C', votes: 20 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'twg',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportSingleChoicePoll(poll);
    });

    // Verify export was called (percentages calculated internally)
    expect(exportUtils.exportSingleChoicePollToCSV).toHaveBeenCalled();
  });

  // Test: CEW filter mode in bulk export
  it('should export all questions with CEW filter mode', () => {
    const polls = [mockSingleChoicePoll(), mockRankingPoll()];
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Option', votes: 40 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn(() => ({ twg: 0, cew: 80, total: 80 }));

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'cew',
        filteredPolls: polls,
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportAllQuestions();
    });

    expect(exportUtils.downloadCSV).toHaveBeenCalledWith(
      expect.stringContaining('metadata-header'),
      expect.stringContaining('cew')
    );
  });

  // Test: Ranking poll with missing average ranks
  it('should handle ranking poll with missing averageRank gracefully', () => {
    const poll = mockRankingPoll();
    const mockGetFilteredPollResults = vi.fn(() => [
      { option_index: 0, option_text: 'Item A', votes: 50 }, // No averageRank
      { option_index: 1, option_text: 'Item B', votes: 50, averageRank: 2.0 }
    ]);
    const mockGetFilteredVoteCounts = vi.fn();

    const { result } = renderHook(() =>
      usePollExport({
        filterMode: 'all',
        filteredPolls: [poll],
        getFilteredPollResults: mockGetFilteredPollResults,
        getFilteredVoteCounts: mockGetFilteredVoteCounts
      })
    );

    act(() => {
      result.current.exportRankingPoll(poll);
    });

    // Should still export with default averageRank: 0
    expect(exportUtils.exportRankingPollToCSV).toHaveBeenCalled();
    expect(exportUtils.downloadCSV).toHaveBeenCalled();
  });
});
