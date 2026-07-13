import { describe, it, expect } from 'vitest';
import {
  exportSingleChoicePollToCSV,
  exportRankingPollToCSV,
  exportWordcloudPollToCSV,
  exportMatrixGraphToCSV,
  generateExportMetadata,
  generatePollExportFilename,
  generateBulkExportFilename,
  getFilterModeDisplayName,
  type ExportMetadata,
  type SingleChoicePollExport,
  type RankingPollExport,
  type WordcloudPollExport,
  type MatrixGraphExport
} from '../poll-export-utils';

describe('poll-export-utils', () => {
  describe('exportSingleChoicePollToCSV', () => {
    it('escapes option text containing comma, quote, and newline', () => {
      const poll: SingleChoicePollExport = {
        question: 'Q1',
        pollType: 'single_choice',
        pagePath: '/test/poll',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        twgResponses: 5,
        cewResponses: 5,
        options: [
          {
            optionIndex: 0,
            optionText: 'Has comma, quote " and \n newline',
            votes: 5,
            percentage: 50,
            twgVotes: 2,
            cewVotes: 3
          }
        ]
      };
      const csv = exportSingleChoicePollToCSV(poll);
      expect(csv).toContain('"Has comma, quote "" and \n newline"');
      expect(csv).toContain('50.00%');
    });

    it('handles filterMode twg/cew vs all column sets', () => {
      const poll: SingleChoicePollExport = {
        question: 'Q1',
        pollType: 'single_choice',
        pagePath: '/test/poll',
        pollIndex: 0,
        filterMode: 'twg',
        totalResponses: 10,
        options: [
          {
            optionIndex: 0,
            optionText: 'Option 1',
            votes: 10,
            percentage: 100
          }
        ]
      };
      const csv = exportSingleChoicePollToCSV(poll);
      expect(csv).not.toContain('TWG/SSTAC Responses');
      expect(csv).not.toContain('CEW Responses');
      expect(csv).not.toContain('TWG/SSTAC Votes');
      expect(csv).not.toContain('CEW Votes');
    });

    it('handles empty options array', () => {
      const poll: SingleChoicePollExport = {
        question: 'Q1',
        pollType: 'single_choice',
        pagePath: '/test/poll',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 0,
        options: []
      };
      const csv = exportSingleChoicePollToCSV(poll);
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // Only header
    });
  });

  describe('exportRankingPollToCSV', () => {
    it('sorts rows by averageRank ASC and formats correctly', () => {
      const poll: RankingPollExport = {
        question: 'Q1',
        pollType: 'ranking',
        pagePath: '/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        options: [
          { optionIndex: 0, optionText: 'Worst', averageRank: 3.5, votes: 10 },
          { optionIndex: 1, optionText: 'Best', averageRank: 1.2, votes: 10 },
          { optionIndex: 2, optionText: 'Middle', averageRank: 2.1, votes: 10 }
        ]
      };
      const csv = exportRankingPollToCSV(poll);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('Best');
      expect(lines[1]).toContain('1.20');
      expect(lines[2]).toContain('Middle');
      expect(lines[2]).toContain('2.10');
      expect(lines[3]).toContain('Worst');
      expect(lines[3]).toContain('3.50');
    });
  });

  describe('exportWordcloudPollToCSV', () => {
    it('sorts rows by frequency DESC and formats percentage', () => {
      const poll: WordcloudPollExport = {
        question: 'Q1',
        pollType: 'wordcloud',
        pagePath: '/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 10,
        words: [
          { word: 'apple', frequency: 2, percentage: 20 },
          { word: 'banana', frequency: 8, percentage: 80 },
          { word: 'cherry', frequency: 5, percentage: 50 }
        ]
      };
      const csv = exportWordcloudPollToCSV(poll);
      const lines = csv.split('\n');
      expect(lines[1]).toContain('banana');
      expect(lines[1]).toContain('80.00%');
      expect(lines[2]).toContain('cherry');
      expect(lines[2]).toContain('50.00%');
      expect(lines[3]).toContain('apple');
      expect(lines[3]).toContain('20.00%');
    });

    it('handles empty words array', () => {
      const poll: WordcloudPollExport = {
        question: 'Q1',
        pollType: 'wordcloud',
        pagePath: '/test',
        pollIndex: 0,
        filterMode: 'all',
        totalResponses: 0,
        words: []
      };
      const csv = exportWordcloudPollToCSV(poll);
      expect(csv.split('\n').length).toBe(1);
    });
  });

  describe('exportMatrixGraphToCSV', () => {
    it('formats summary and data points correctly', () => {
      const graph: MatrixGraphExport = {
        questionPair: 'Q1 vs Q2',
        question1Text: 'Importance',
        question2Text: 'Feasibility',
        filterMode: 'all',
        totalResponses: 2,
        avgImportance: 3.5,
        avgFeasibility: 4.2,
        quadrantCounts: {
          highPriority: 1,
          noGo: 0,
          longerTerm: 1,
          possiblyLater: 0
        },
        dataPoints: [
          { userId: 'u1', userType: 'authenticated', importance: 5, feasibility: 5, quadrant: 'HIGH PRIORITY' },
          { userId: 'u2', userType: 'cew', importance: 2, feasibility: 2, quadrant: 'LONGER-TERM' }
        ]
      };
      const csv = exportMatrixGraphToCSV(graph);
      expect(csv).toContain('Average Importance,3.50');
      expect(csv).toContain('Average Feasibility,4.20');
      expect(csv).toContain('HIGH PRIORITY,1');
      expect(csv).toContain('u1,TWG/SSTAC,5,5,HIGH PRIORITY');
      expect(csv).toContain('u2,CEW,2,2,LONGER-TERM');
    });
  });

  describe('generateExportMetadata', () => {
    it('generates accurate metadata text', () => {
      const metadata: ExportMetadata = {
        exportDate: '2026-07-13',
        filterMode: 'twg',
        totalQuestions: 5,
        totalResponses: 100,
        twgResponses: 100,
        cewResponses: 0,
        exportVersion: '1.0'
      };
      const text = generateExportMetadata(metadata);
      expect(text).toContain('Export Date,2026-07-13');
      expect(text).toContain('Filter Mode,TWG/SSTAC Only');
      expect(text).toContain('Total Questions,5');
    });
  });

  describe('Filename Generators', () => {
    it('generatePollExportFilename formats correctly', () => {
      const d = new Date('2026-07-13T12:00:00Z');
      const filename = generatePollExportFilename('single_choice', '/some/topic-slug', 1, 'cew', d);
      expect(filename).toBe('topic-slug-q2-single_choice-cew-2026-07-13.csv');
    });

    it('generateBulkExportFilename formats correctly', () => {
      const d = new Date('2026-07-13T12:00:00Z');
      const filename = generateBulkExportFilename('all', d);
      expect(filename).toBe('poll-results-all-2026-07-13.csv');
    });
  });

  describe('getFilterModeDisplayName', () => {
    it('returns correct display names', () => {
      expect(getFilterModeDisplayName('all')).toBe('All Responses');
      expect(getFilterModeDisplayName('twg')).toBe('TWG/SSTAC Only');
      expect(getFilterModeDisplayName('cew')).toBe('CEW Only');
    });
  });
});
