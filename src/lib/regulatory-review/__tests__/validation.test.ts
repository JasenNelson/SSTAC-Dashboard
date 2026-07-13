import { describe, it, expect } from 'vitest';
import {
  parseCreateJudgment,
  parseUpdateJudgment,
  parseAssessmentFilters,
  parseExportOptions
} from '../validation';
import { HumanResult } from '../types';

describe('validation', () => {
  describe('parseCreateJudgment', () => {
    it('fails if OVERRIDE_PASS without overrideReason', () => {
      const result = parseCreateJudgment({
        assessmentId: 1,
        humanResult: HumanResult.OVERRIDE_PASS
      });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('overrideReason');
    });

    it('fails if OVERRIDE_FAIL with reason < 10 chars', () => {
      const result = parseCreateJudgment({
        assessmentId: 1,
        humanResult: HumanResult.OVERRIDE_FAIL,
        overrideReason: 'Too short'
      });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('overrideReason');
    });

    it('succeeds with OVERRIDE_PASS and valid reason', () => {
      const result = parseCreateJudgment({
        assessmentId: 1,
        humanResult: HumanResult.OVERRIDE_PASS,
        overrideReason: 'This is a sufficient reason.'
      });
      expect(result.error).toBeUndefined();
      expect(result.data?.humanResult).toBe(HumanResult.OVERRIDE_PASS);
    });

    it('fails if routedTo set without routingReason', () => {
      const result = parseCreateJudgment({
        assessmentId: 1,
        routedTo: 'Bob'
      });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('routingReason');
    });
  });

  describe('parseUpdateJudgment', () => {
    it('fails if OVERRIDE_PASS without overrideReason', () => {
      const result = parseUpdateJudgment({
        humanResult: HumanResult.OVERRIDE_PASS
      });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('overrideReason');
    });

    it('succeeds with OVERRIDE_PASS and valid reason', () => {
      const result = parseUpdateJudgment({
        humanResult: HumanResult.OVERRIDE_PASS,
        overrideReason: 'This is a sufficient reason.'
      });
      expect(result.error).toBeUndefined();
    });
  });

  describe('parseAssessmentFilters', () => {
    it('coerces single value to array', () => {
      const result = parseAssessmentFilters({
        sheets: 'Sheet1'
      });
      expect(result.error).toBeUndefined();
      expect(result.data?.sheets).toEqual(['Sheet1']);
    });

    it('handles offset/limit boundaries', () => {
      const res1 = parseAssessmentFilters({ offset: -1 });
      expect(res1.error).toBeDefined();
      expect(res1.error).toContain('offset');

      const res2 = parseAssessmentFilters({ limit: 0 });
      expect(res2.error).toBeDefined();
      expect(res2.error).toContain('limit');

      const res3 = parseAssessmentFilters({ limit: 1000 });
      expect(res3.error).toBeDefined();
      expect(res3.error).toContain('limit');
    });
  });

  describe('parseExportOptions', () => {
    it('rejects filename with bad characters', () => {
      const result = parseExportOptions({
        filename: 'bad name!.csv'
      });
      expect(result.error).toBeDefined();
      expect(result.error).toContain('filename');
    });

    it('accepts valid filename', () => {
      const result = parseExportOptions({
        filename: 'good-name_123'
      });
      expect(result.error).toBeUndefined();
      expect(result.data?.filename).toBe('good-name_123');
    });
  });
});
