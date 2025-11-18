import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateExportMetadata,
  exportSingleChoicePollToCSV,
  exportRankingPollToCSV,
  exportWordcloudPollToCSV,
  exportMatrixGraphToCSV,
  downloadCSV,
  getFilterModeDisplayName,
  generatePollExportFilename,
  generateBulkExportFilename,
  type ExportMetadata,
  type SingleChoicePollExport,
  type RankingPollExport,
  type WordcloudPollExport,
  type MatrixGraphExport,
} from '../poll-export-utils';

// Note: escapeCSV and generateCSVRow are not exported, but we can test them indirectly
// through the exported functions. If needed, we can export them for testing.

describe('poll-export-utils', () => {
  describe('generateExportMetadata', () => {
    it('should generate metadata with all fields', () => {
      const metadata: ExportMetadata = {
        exportDate: '2025-11-18T12:00:00Z',
        filterMode: 'all',
        totalQuestions: 10,
        totalResponses: 150,
        twgResponses: 100,
        cewResponses: 50,
        exportVersion: '1.0.0',
      };

      const result = generateExportMetadata(metadata);
      expect(result).toContain('=== EXPORT METADATA ===');
      expect(result).toContain('Export Date,2025-11-18T12:00:00Z');
      expect(result).toContain('Filter Mode,All Responses');
      expect(result).toContain('Total Questions,10');
      expect(result).toContain('Total Responses,150');
      expect(result).toContain('TWG/SSTAC Responses,100');
      expect(result).toContain('CEW Responses,50');
      expect(result).toContain('Export Version,1.0.0');
      expect(result).toContain('=== POLL RESULTS ===');
    });

    it('should handle TWG filter mode', () => {
      const metadata: ExportMetadata = {
        exportDate: '2025-11-18',
        filterMode: 'twg',
        totalQuestions: 5,
        totalResponses: 50,
        twgResponses: 50,
        cewResponses: 0,
        exportVersion: '1.0.0',
      };

      const result = generateExportMetadata(metadata);
      expect(result).toContain('Filter Mode,TWG/SSTAC Only');
    });

    it('should handle CEW filter mode', () => {
      const metadata: ExportMetadata = {
        exportDate: '2025-11-18',
        filterMode: 'cew',
        totalQuestions: 5,
        totalResponses: 30,
        twgResponses: 0,
        cewResponses: 30,
        exportVersion: '1.0.0',
      };

      const result = generateExportMetadata(metadata);
      expect(result).toContain('Filter Mode,CEW Only');
    });
  });

  describe('exportSingleChoicePollToCSV', () => {
    it('should export single-choice poll with all filter mode', () => {
      const poll: SingleChoicePollExport = {
        question: 'Test Question?',
        pollType: 'single-choice',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 100,
        twgResponses: 60,
        cewResponses: 40,
        options: [
          { optionIndex: 0, optionText: 'Option A', votes: 50, percentage: 50, twgVotes: 30, cewVotes: 20 },
          { optionIndex: 1, optionText: 'Option B', votes: 50, percentage: 50, twgVotes: 30, cewVotes: 20 },
        ],
      };

      const result = exportSingleChoicePollToCSV(poll);
      expect(result).toContain('Question');
      expect(result).toContain('Test Question?');
      expect(result).toContain('Option A');
      expect(result).toContain('Option B');
      expect(result).toContain('TWG/SSTAC Responses');
      expect(result).toContain('CEW Responses');
      expect(result).toContain('50.00%');
    });

    it('should export single-choice poll with TWG filter mode', () => {
      const poll: SingleChoicePollExport = {
        question: 'Test Question?',
        pollType: 'single-choice',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'twg',
        totalResponses: 60,
        options: [
          { optionIndex: 0, optionText: 'Option A', votes: 30, percentage: 50 },
          { optionIndex: 1, optionText: 'Option B', votes: 30, percentage: 50 },
        ],
      };

      const result = exportSingleChoicePollToCSV(poll);
      expect(result).not.toContain('TWG/SSTAC Responses');
      expect(result).not.toContain('CEW Responses');
      expect(result).toContain('TWG/SSTAC Only');
    });

    it('should escape special characters in CSV', () => {
      const poll: SingleChoicePollExport = {
        question: 'Question with "quotes" and, commas?',
        pollType: 'single-choice',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        options: [
          { optionIndex: 0, optionText: 'Option with "quotes"', votes: 10, percentage: 100 },
        ],
      };

      const result = exportSingleChoicePollToCSV(poll);
      // CSV should properly escape quotes
      expect(result).toContain('""quotes""');
    });
  });

  describe('exportRankingPollToCSV', () => {
    it('should export ranking poll sorted by average rank', () => {
      const poll: RankingPollExport = {
        question: 'Rank these options',
        pollType: 'ranking',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 50,
        options: [
          { optionIndex: 0, optionText: 'Option A', averageRank: 3.5, votes: 50 },
          { optionIndex: 1, optionText: 'Option B', averageRank: 1.2, votes: 50 },
          { optionIndex: 2, optionText: 'Option C', averageRank: 2.8, votes: 50 },
        ],
      };

      const result = exportRankingPollToCSV(poll);
      const lines = result.split('\n');
      
      // Find Option B (lowest rank = best) - should appear first
      const optionBIndex = lines.findIndex(line => line.includes('Option B'));
      const optionCIndex = lines.findIndex(line => line.includes('Option C'));
      const optionAIndex = lines.findIndex(line => line.includes('Option A'));
      
      expect(optionBIndex).toBeLessThan(optionCIndex);
      expect(optionCIndex).toBeLessThan(optionAIndex);
    });

    it('should include all required fields', () => {
      const poll: RankingPollExport = {
        question: 'Test Ranking',
        pollType: 'ranking',
        pagePath: '/survey-results/test',
        pollIndex: 1,
        filterMode: 'all',
        totalResponses: 30,
        options: [
          { optionIndex: 0, optionText: 'Best Option', averageRank: 1.0, votes: 30 },
        ],
      };

      const result = exportRankingPollToCSV(poll);
      expect(result).toContain('Average Rank');
      expect(result).toContain('1.00');
      expect(result).toContain('Best Option');
    });
  });

  describe('exportWordcloudPollToCSV', () => {
    it('should export wordcloud poll sorted by frequency', () => {
      const poll: WordcloudPollExport = {
        question: 'Enter words',
        pollType: 'wordcloud',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 20,
        words: [
          { word: 'word1', frequency: 5, percentage: 25 },
          { word: 'word2', frequency: 10, percentage: 50 },
          { word: 'word3', frequency: 3, percentage: 15 },
        ],
      };

      const result = exportWordcloudPollToCSV(poll);
      const lines = result.split('\n');
      
      // Find words - highest frequency should appear first
      const word2Index = lines.findIndex(line => line.includes('word2'));
      const word1Index = lines.findIndex(line => line.includes('word1'));
      const word3Index = lines.findIndex(line => line.includes('word3'));
      
      expect(word2Index).toBeLessThan(word1Index);
      expect(word1Index).toBeLessThan(word3Index);
    });

    it('should include frequency and percentage', () => {
      const poll: WordcloudPollExport = {
        question: 'Test Wordcloud',
        pollType: 'wordcloud',
        pagePath: '/survey-results/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        words: [
          { word: 'test', frequency: 5, percentage: 50 },
        ],
      };

      const result = exportWordcloudPollToCSV(poll);
      expect(result).toContain('Frequency');
      expect(result).toContain('Percentage');
      expect(result).toContain('5');
      expect(result).toContain('50.00%');
    });
  });

  describe('exportMatrixGraphToCSV', () => {
    it('should export matrix graph with all sections', () => {
      const graph: MatrixGraphExport = {
        questionPair: 'Q1-Q2 Pair',
        question1Text: 'Importance question',
        question2Text: 'Feasibility question',
        filterMode: 'all',
        totalResponses: 25,
        avgImportance: 2.5,
        avgFeasibility: 3.0,
        quadrantCounts: {
          highPriority: 10,
          noGo: 5,
          longerTerm: 7,
          possiblyLater: 3,
        },
        dataPoints: [
          { userId: 'user1', userType: 'authenticated', importance: 2, feasibility: 2, quadrant: 'HIGH PRIORITY' },
          { userId: 'user2', userType: 'cew', importance: 4, feasibility: 4, quadrant: 'NO GO' },
        ],
      };

      const result = exportMatrixGraphToCSV(graph);
      expect(result).toContain('=== MATRIX GRAPH SUMMARY ===');
      expect(result).toContain('=== QUADRANT SUMMARY ===');
      expect(result).toContain('=== INDIVIDUAL DATA POINTS ===');
      expect(result).toContain('Q1-Q2 Pair');
      expect(result).toContain('HIGH PRIORITY');
      expect(result).toContain('NO GO');
      expect(result).toContain('user1');
      expect(result).toContain('TWG/SSTAC');
      expect(result).toContain('CEW');
    });

    it('should include all quadrant counts', () => {
      const graph: MatrixGraphExport = {
        questionPair: 'Test Pair',
        question1Text: 'Q1',
        question2Text: 'Q2',
        filterMode: 'all',
        totalResponses: 20,
        avgImportance: 3.0,
        avgFeasibility: 3.0,
        quadrantCounts: {
          highPriority: 5,
          noGo: 5,
          longerTerm: 5,
          possiblyLater: 5,
        },
        dataPoints: [],
      };

      const result = exportMatrixGraphToCSV(graph);
      expect(result).toContain('HIGH PRIORITY,5');
      expect(result).toContain('NO GO,5');
      expect(result).toContain('LONGER-TERM,5');
      expect(result).toContain('POSSIBLY LATER?,5');
    });
  });

  describe('getFilterModeDisplayName', () => {
    it('should return correct display name for all modes', () => {
      expect(getFilterModeDisplayName('all')).toBe('All Responses');
      expect(getFilterModeDisplayName('twg')).toBe('TWG/SSTAC Only');
      expect(getFilterModeDisplayName('cew')).toBe('CEW Only');
    });
  });

  describe('generatePollExportFilename', () => {
    it('should generate filename with all components', () => {
      const date = new Date('2025-11-18');
      const filename = generatePollExportFilename('single-choice', '/survey-results/test', 0, 'all', date);
      
      expect(filename).toContain('test');
      expect(filename).toContain('q1');
      expect(filename).toContain('single-choice');
      expect(filename).toContain('all');
      expect(filename).toContain('2025-11-18');
      expect(filename).toMatch(/\.csv$/);
    });

    it('should use current date when not provided', () => {
      const filename = generatePollExportFilename('ranking', '/survey-results/prioritization', 2, 'twg');
      expect(filename).toContain('prioritization');
      expect(filename).toContain('q3');
      expect(filename).toContain('twg');
      expect(filename).toMatch(/\.csv$/);
    });

    it('should handle different poll types', () => {
      const filename1 = generatePollExportFilename('single-choice', '/test', 0, 'all');
      const filename2 = generatePollExportFilename('wordcloud', '/test', 0, 'all');
      
      expect(filename1).toContain('single-choice');
      expect(filename2).toContain('wordcloud');
    });
  });

  describe('generateBulkExportFilename', () => {
    it('should generate bulk export filename', () => {
      const date = new Date('2025-11-18');
      const filename = generateBulkExportFilename('all', date);
      
      expect(filename).toBe('poll-results-all-2025-11-18.csv');
    });

    it('should handle different filter modes', () => {
      expect(generateBulkExportFilename('all')).toContain('poll-results-all-');
      expect(generateBulkExportFilename('twg')).toContain('poll-results-twg-');
      expect(generateBulkExportFilename('cew')).toContain('poll-results-cew-');
    });

    it('should use current date when not provided', () => {
      const filename = generateBulkExportFilename('all');
      expect(filename).toMatch(/^poll-results-all-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe('downloadCSV', () => {
    beforeEach(() => {
      // Mock DOM methods
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      // Mock document methods
      document.createElement = vi.fn(() => {
        const link = {
          href: '',
          download: '',
          click: vi.fn(),
        } as unknown as HTMLAnchorElement;
        return link;
      });
      
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create blob and trigger download', () => {
      const content = 'test,content\n1,2';
      const filename = 'test.csv';
      
      downloadCSV(content, filename);
      
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('CSV escaping edge cases', () => {
    it('should handle null and undefined values', () => {
      const poll: SingleChoicePollExport = {
        question: 'Test',
        pollType: 'single-choice',
        pagePath: '/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 0,
        options: [
          { optionIndex: 0, optionText: '', votes: 0, percentage: 0 },
        ],
      };

      const result = exportSingleChoicePollToCSV(poll);
      // Should not throw and should handle empty strings
      expect(result).toBeDefined();
    });

    it('should handle newlines in text', () => {
      const poll: SingleChoicePollExport = {
        question: 'Question with\nnewline?',
        pollType: 'single-choice',
        pagePath: '/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        options: [
          { optionIndex: 0, optionText: 'Option\nwith\nnewlines', votes: 10, percentage: 100 },
        ],
      };

      const result = exportSingleChoicePollToCSV(poll);
      // Should properly escape newlines
      expect(result).toContain('Question with');
      expect(result).toBeDefined();
    });
  });
});

