/**
 * Tests for queries/validation.ts
 *
 * Mock strategy: mirror queries-full.test.ts exactly -- vi.mock('../../client')
 * with getDatabase returning mockDb, getOne and executeQuery forwarded to vi.fn mocks.
 * No native better-sqlite3 required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock shared client helpers
// ---------------------------------------------------------------------------

const mockGetOne = vi.fn<(...args: unknown[]) => unknown>();
const mockExecuteQuery = vi.fn<(...args: unknown[]) => unknown[]>(() => []);

const mockRun = vi.fn<(...args: unknown[]) => { changes: number; lastInsertRowid?: number }>(
  () => ({ changes: 1, lastInsertRowid: 1 })
);
const mockGet = vi.fn<(...args: unknown[]) => Record<string, unknown> | null>(() => null);
const mockAll = vi.fn<(...args: unknown[]) => Record<string, unknown>[]>(() => []);
const mockPrepare = vi.fn<
  (...args: unknown[]) => { run: typeof mockRun; get: typeof mockGet; all: typeof mockAll }
>(() => ({ run: mockRun, get: mockGet, all: mockAll }));

const mockDb = {
  prepare: mockPrepare,
};

vi.mock('../../client', () => ({
  getDatabase: () => mockDb,
  getOne: (...args: unknown[]) => mockGetOne(...args),
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
}));

import {
  getBaselineValidation,
  upsertBaselineValidation,
  getBaselineValidations,
  getBaselineValidationStats,
} from '../validation';
import type { BaselineValidation } from '../validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockGetOne.mockReset();
  mockExecuteQuery.mockReset().mockReturnValue([]);
  mockRun.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  mockGet.mockReset().mockReturnValue(null);
  mockAll.mockReset().mockReturnValue([]);
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
}

beforeEach(resetMocks);

// ---------------------------------------------------------------------------
// Sample rows
// ---------------------------------------------------------------------------

const sampleRow: BaselineValidation = {
  id: 1,
  assessment_id: 42,
  validation_type: 'TRUE_POSITIVE',
  notes: 'looks correct',
  reviewer_id: 'rev-1',
  reviewer_name: 'Reviewer One',
  validated_at: '2026-06-13T00:00:00Z',
};

// ===========================================================================
// getBaselineValidation
// ===========================================================================

describe('getBaselineValidation', () => {
  it('returns the row from getOne', () => {
    mockGetOne.mockReturnValue(sampleRow);
    const result = getBaselineValidation(42);
    expect(result).toBe(sampleRow);
  });

  it('passes the correct SQL containing WHERE assessment_id = ?', () => {
    mockGetOne.mockReturnValue(sampleRow);
    getBaselineValidation(42);
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE assessment_id = ?'),
      [42]
    );
  });

  it('passes the assessmentId as the sole param', () => {
    mockGetOne.mockReturnValue(undefined);
    getBaselineValidation(99);
    const [, params] = mockGetOne.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([99]);
  });

  it('returns undefined when getOne returns undefined', () => {
    mockGetOne.mockReturnValue(undefined);
    expect(getBaselineValidation(0)).toBeUndefined();
  });
});

// ===========================================================================
// upsertBaselineValidation
// ===========================================================================

describe('upsertBaselineValidation', () => {
  it('UPDATE path: runs UPDATE when existing row found', () => {
    // First getOne (existing check) returns the existing row;
    // second getOne (return value) also returns an updated row.
    const updatedRow: BaselineValidation = {
      ...sampleRow,
      validation_type: 'FALSE_POSITIVE',
      notes: 'updated note',
    };
    mockGetOne
      .mockReturnValueOnce(sampleRow)    // existing check
      .mockReturnValueOnce(updatedRow);  // return value fetch

    const data = {
      validation_type: 'FALSE_POSITIVE' as const,
      notes: 'updated note',
      reviewer_id: 'rev-2',
      reviewer_name: 'Reviewer Two',
    };

    const result = upsertBaselineValidation(42, data);

    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE baseline_validations')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toMatch(/UPDATE baseline_validations/);

    expect(mockRun).toHaveBeenCalledWith(
      'FALSE_POSITIVE',
      'updated note',
      'rev-2',
      'Reviewer Two',
      42
    );

    expect(result).toBe(updatedRow);
  });

  it('INSERT path: runs INSERT when no existing row found', () => {
    const insertedRow: BaselineValidation = {
      id: 10,
      assessment_id: 7,
      validation_type: 'TRUE_NEGATIVE',
      notes: null,
      reviewer_id: null,
      reviewer_name: null,
      validated_at: '2026-06-13T00:00:00Z',
    };
    // First getOne returns undefined (no existing row);
    // second getOne (after INSERT) returns the inserted row.
    mockGetOne
      .mockReturnValueOnce(undefined)   // existing check -> no row
      .mockReturnValueOnce(insertedRow); // return value fetch

    const data = {
      validation_type: 'TRUE_NEGATIVE' as const,
    };

    const result = upsertBaselineValidation(7, data);

    const insertCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO baseline_validations')
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![0]).toMatch(/INSERT INTO baseline_validations/);

    expect(mockRun).toHaveBeenCalledWith(7, 'TRUE_NEGATIVE', null, null, null);

    expect(result).toBe(insertedRow);
  });

  it('null-coercion: omitted notes/reviewer_* coerce to null in UPDATE path', () => {
    const existing: BaselineValidation = { ...sampleRow };
    const afterUpdate: BaselineValidation = { ...sampleRow, notes: null, reviewer_id: null, reviewer_name: null };
    mockGetOne
      .mockReturnValueOnce(existing)
      .mockReturnValueOnce(afterUpdate);

    upsertBaselineValidation(42, { validation_type: 'TRUE_POSITIVE' });

    expect(mockRun).toHaveBeenCalledWith('TRUE_POSITIVE', null, null, null, 42);
  });

  it('null-coercion: omitted notes/reviewer_* coerce to null in INSERT path', () => {
    const inserted: BaselineValidation = {
      id: 20,
      assessment_id: 5,
      validation_type: 'FALSE_NEGATIVE',
      notes: null,
      reviewer_id: null,
      reviewer_name: null,
      validated_at: '2026-06-13T00:00:00Z',
    };
    mockGetOne
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(inserted);

    upsertBaselineValidation(5, { validation_type: 'FALSE_NEGATIVE' });

    expect(mockRun).toHaveBeenCalledWith(5, 'FALSE_NEGATIVE', null, null, null);
  });
});

// ===========================================================================
// getBaselineValidations
// ===========================================================================

describe('getBaselineValidations', () => {
  it('returns the rows from executeQuery', () => {
    const rows = [sampleRow, { ...sampleRow, id: 2, assessment_id: 43 }];
    mockExecuteQuery.mockReturnValue(rows);
    const result = getBaselineValidations('sub-123');
    expect(result).toBe(rows);
  });

  it('passes submissionId as the param', () => {
    mockExecuteQuery.mockReturnValue([]);
    getBaselineValidations('sub-456');
    const [, params] = mockExecuteQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual(['sub-456']);
  });

  it('SQL contains the assessments JOIN', () => {
    mockExecuteQuery.mockReturnValue([]);
    getBaselineValidations('sub-789');
    const [sql] = mockExecuteQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/JOIN assessments/i);
  });

  it('SQL contains ORDER BY validated_at DESC', () => {
    mockExecuteQuery.mockReturnValue([]);
    getBaselineValidations('sub-abc');
    const [sql] = mockExecuteQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/ORDER BY bv\.validated_at DESC/);
  });

  it('SQL filters by submission (WHERE a.submission_id = ?) so it does not return every submission', () => {
    // With the client mocked, the param array alone does not prove the WHERE clause exists;
    // assert the SQL itself filters, or a dropped WHERE would silently return all submissions.
    mockExecuteQuery.mockReturnValue([]);
    getBaselineValidations('sub-where');
    const [sql] = mockExecuteQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/WHERE\s+a\.submission_id\s*=\s*\?/i);
  });
});

// ===========================================================================
// getBaselineValidationStats
// ===========================================================================

describe('getBaselineValidationStats', () => {
  // -------------------------------------------------------------------------
  // Happy path with concrete counts
  // -------------------------------------------------------------------------

  it('happy path: computes precision, recall, f1, fp_rate, fn_rate correctly', () => {
    // tp=3, fp=1, tn=2, fn=1 -> precision=3/4=0.75, recall=3/4=0.75,
    // f1=2*0.75*0.75/(0.75+0.75)=0.75, fp_rate=1/3~0.333, fn_rate=1/4=0.25
    mockGet.mockReturnValue({
      total_validated: 7,
      true_positive: 3,
      false_positive: 1,
      true_negative: 2,
      false_negative: 1,
    });
    mockAll.mockReturnValue([]);

    const result = getBaselineValidationStats('sub-1');

    expect(result.total_validated).toBe(7);
    expect(result.true_positive).toBe(3);
    expect(result.false_positive).toBe(1);
    expect(result.true_negative).toBe(2);
    expect(result.false_negative).toBe(1);
    expect(result.precision).toBe(0.75);
    expect(result.recall).toBe(0.75);
    expect(result.f1_score).toBe(0.75);
    expect(result.fp_rate).toBe(0.333);
    expect(result.fn_rate).toBe(0.25);
  });

  it('happy path: by_tier maps TIER_1_BINARY, TIER_2_PROFESSIONAL, TIER_3_STATUTORY', () => {
    mockGet.mockReturnValue({
      total_validated: 6,
      true_positive: 2,
      false_positive: 1,
      true_negative: 2,
      false_negative: 1,
    });
    mockAll.mockReturnValue([
      { discretion_tier: 'TIER_1_BINARY', fp: 0, fn: 1, total: 2 },
      { discretion_tier: 'TIER_2_PROFESSIONAL', fp: 1, fn: 0, total: 3 },
      { discretion_tier: 'TIER_3_STATUTORY', fp: 0, fn: 0, total: 1 },
    ]);

    const result = getBaselineValidationStats('sub-2');

    expect(result.by_tier.tier1).toEqual({ fp: 0, fn: 1, total: 2 });
    expect(result.by_tier.tier2).toEqual({ fp: 1, fn: 0, total: 3 });
    expect(result.by_tier.tier3).toEqual({ fp: 0, fn: 0, total: 1 });
  });

  it('by_tier: unlisted tiers remain at {fp:0, fn:0, total:0}', () => {
    mockGet.mockReturnValue({
      total_validated: 1,
      true_positive: 1,
      false_positive: 0,
      true_negative: 0,
      false_negative: 0,
    });
    // Only tier1 row returned; tier2/tier3 absent from DB result.
    mockAll.mockReturnValue([
      { discretion_tier: 'TIER_1_BINARY', fp: 0, fn: 0, total: 1 },
    ]);

    const result = getBaselineValidationStats('sub-3');

    expect(result.by_tier.tier2).toEqual({ fp: 0, fn: 0, total: 0 });
    expect(result.by_tier.tier3).toEqual({ fp: 0, fn: 0, total: 0 });
  });

  // -------------------------------------------------------------------------
  // Division-by-zero / empty corpus
  // -------------------------------------------------------------------------

  it('division-by-zero: all counts zero -> all metrics are 0', () => {
    mockGet.mockReturnValue({
      total_validated: 0,
      true_positive: 0,
      false_positive: 0,
      true_negative: 0,
      false_negative: 0,
    });
    mockAll.mockReturnValue([]);

    const result = getBaselineValidationStats('sub-empty');

    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1_score).toBe(0);
    expect(result.fp_rate).toBe(0);
    expect(result.fn_rate).toBe(0);
    expect(result.total_validated).toBe(0);
    expect(result.by_tier).toEqual({
      tier1: { fp: 0, fn: 0, total: 0 },
      tier2: { fp: 0, fn: 0, total: 0 },
      tier3: { fp: 0, fn: 0, total: 0 },
    });
  });

  // -------------------------------------------------------------------------
  // Rounding to 3 decimals
  // -------------------------------------------------------------------------

  it('rounding: tp=1, fp=2 -> precision rounds to 0.333', () => {
    // precision = 1/(1+2) = 0.333...
    // recall = 1/(1+0) = 1 (fn=0)
    // f1 = 2*0.333*1/(0.333+1) ~= 0.5 (exact: 2/3/(4/3) = 1/2)
    // fp_rate = 2/(2+0) = 1 (tn=0); fn_rate = 0/(1+0) = 0
    mockGet.mockReturnValue({
      total_validated: 3,
      true_positive: 1,
      false_positive: 2,
      true_negative: 0,
      false_negative: 0,
    });
    mockAll.mockReturnValue([]);

    const result = getBaselineValidationStats('sub-round');

    expect(result.precision).toBe(0.333);
    expect(result.recall).toBe(1);
    expect(result.f1_score).toBe(0.5);
    expect(result.fp_rate).toBe(1);
    expect(result.fn_rate).toBe(0);
  });

  it('rounding: recall 2/3 rounds to 0.667', () => {
    // tp=2, fn=1 -> recall = 2/3 = 0.666...
    // fp=0, tn=0 -> precision guard: tp+fp=2>0, precision=2/2=1
    // f1 = 2*1*(2/3)/(1+2/3) = (4/3)/(5/3) = 4/5 = 0.8
    // fp_rate = 0/(0+0) = 0 (guard); fn_rate = 1/(2+1) = 0.333
    mockGet.mockReturnValue({
      total_validated: 3,
      true_positive: 2,
      false_positive: 0,
      true_negative: 0,
      false_negative: 1,
    });
    mockAll.mockReturnValue([]);

    const result = getBaselineValidationStats('sub-recall');

    expect(result.recall).toBe(0.667);
    expect(result.precision).toBe(1);
    expect(result.f1_score).toBe(0.8);
    expect(result.fn_rate).toBe(0.333);
  });

  // -------------------------------------------------------------------------
  // Unknown discretion_tier is ignored (no crash, not mapped)
  // -------------------------------------------------------------------------

  it('unknown discretion_tier is ignored -- does not crash, not reflected in by_tier', () => {
    mockGet.mockReturnValue({
      total_validated: 2,
      true_positive: 1,
      false_positive: 0,
      true_negative: 1,
      false_negative: 0,
    });
    mockAll.mockReturnValue([
      { discretion_tier: 'TIER_1_BINARY', fp: 0, fn: 0, total: 2 },
      { discretion_tier: 'UNKNOWN_TIER_99', fp: 5, fn: 5, total: 10 },
    ]);

    const result = getBaselineValidationStats('sub-unknown-tier');

    // Unknown tier must not affect any mapped tier.
    expect(result.by_tier.tier1).toEqual({ fp: 0, fn: 0, total: 2 });
    expect(result.by_tier.tier2).toEqual({ fp: 0, fn: 0, total: 0 });
    expect(result.by_tier.tier3).toEqual({ fp: 0, fn: 0, total: 0 });
  });

  // -------------------------------------------------------------------------
  // SQLite SUM returning null coerced to 0 via || 0 guards
  // -------------------------------------------------------------------------

  it('null SUM values from SQLite are coerced to 0', () => {
    // SQLite returns null for SUM when no rows match; the source guards with || 0.
    mockGet.mockReturnValue({
      total_validated: 0,
      true_positive: null,
      false_positive: null,
      true_negative: null,
      false_negative: null,
    });
    mockAll.mockReturnValue([]);

    const result = getBaselineValidationStats('sub-nulls');

    expect(result.true_positive).toBe(0);
    expect(result.false_positive).toBe(0);
    expect(result.true_negative).toBe(0);
    expect(result.false_negative).toBe(0);
    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1_score).toBe(0);
    expect(result.fp_rate).toBe(0);
    expect(result.fn_rate).toBe(0);
  });

  // -------------------------------------------------------------------------
  // prepare is called twice: once for countsSql, once for tierSql
  // -------------------------------------------------------------------------

  it('calls db.prepare twice: first for counts (using .get), second for tiers (using .all)', () => {
    mockGet.mockReturnValue({
      total_validated: 1,
      true_positive: 1,
      false_positive: 0,
      true_negative: 0,
      false_negative: 0,
    });
    mockAll.mockReturnValue([]);

    getBaselineValidationStats('sub-prepare-check');

    // prepare should be called at least twice (counts SQL + tier SQL)
    expect(mockPrepare.mock.calls.length).toBeGreaterThanOrEqual(2);
    // get was called for the counts query
    expect(mockGet).toHaveBeenCalledWith('sub-prepare-check');
    // all was called for the tier query
    expect(mockAll).toHaveBeenCalledWith('sub-prepare-check');

    // With the client mocked, calling .get/.all proves nothing about the SQL itself; capture the
    // two prepared statements and assert the load-bearing aggregation clauses so a regression in
    // the SQL (a dropped SUM(CASE), WHERE filter, or GROUP BY) is actually caught.
    const countsSql = mockPrepare.mock.calls[0][0] as string;
    const tierSql = mockPrepare.mock.calls[1][0] as string;
    expect(countsSql).toMatch(/SUM\(CASE WHEN bv\.validation_type = 'TRUE_POSITIVE'/i);
    expect(countsSql).toMatch(/SUM\(CASE WHEN bv\.validation_type = 'FALSE_NEGATIVE'/i);
    expect(countsSql).toMatch(/JOIN assessments a ON bv\.assessment_id = a\.id/i);
    expect(countsSql).toMatch(/WHERE\s+a\.submission_id\s*=\s*\?/i);
    expect(tierSql).toMatch(/GROUP BY\s+a\.discretion_tier/i);
    expect(tierSql).toMatch(/WHERE\s+a\.submission_id\s*=\s*\?/i);
  });
});
