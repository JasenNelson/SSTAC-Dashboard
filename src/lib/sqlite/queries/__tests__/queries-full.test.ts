/**
 * Comprehensive tests for queries/index.ts and queries/review-projects.ts.
 *
 * Strategy: mock the SQLite client so no native better-sqlite3 build is needed.
 * We verify:
 *   - correct SQL is built (parameterised, no injection)
 *   - correct params are passed through
 *   - filter combinations are accumulated correctly
 *   - boolean/null coercion for judgment fields
 *   - updateJudgment dynamic SET builder (each field individually)
 *   - updateReviewProject dynamic SET builder
 *   - getOrCreateJudgment create path
 *   - getProgress math (empty corpus + partial corpus)
 *   - getSubmissionsSummary delegation
 *   - review-session lifecycle
 *   - review-projects CRUD + file lifecycle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock shared client helpers
// ---------------------------------------------------------------------------

const mockGetOne = vi.fn<(...args: unknown[]) => unknown>();
const mockExecuteQuery = vi.fn<(...args: unknown[]) => unknown[]>(() => []);
const mockExecuteStatement = vi.fn<(...args: unknown[]) => { changes: number; lastInsertRowid?: number }>(
  () => ({ changes: 1, lastInsertRowid: 99 })
);

// db.prepare(...).run / .get / .all  -- shared mock
const mockRun = vi.fn<(...args: unknown[]) => { changes: number; lastInsertRowid?: number }>(
  () => ({ changes: 1, lastInsertRowid: 42 })
);
const mockGet = vi.fn<(...args: unknown[]) => Record<string, unknown> | null>(() => null);
const mockAll = vi.fn<(...args: unknown[]) => Record<string, unknown>[]>(() => []);
const mockPrepare = vi.fn<(...args: unknown[]) => { run: typeof mockRun; get: typeof mockGet; all: typeof mockAll }>(
  () => ({ run: mockRun, get: mockGet, all: mockAll })
);
const mockTransaction = vi.fn((fn: (...args: unknown[]) => unknown) => fn);
const mockDbGet = vi.fn();

const mockDb = {
  prepare: mockPrepare,
  transaction: mockTransaction,
  get: mockDbGet,
};

vi.mock('../../client', () => ({
  getDatabase: () => mockDb,
  getOne: (...args: unknown[]) => mockGetOne(...args),
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  executeStatement: (...args: unknown[]) => mockExecuteStatement(...args),
}));

import {
  getSubmissions,
  getSubmissionById,
  getSubmissionBySubmissionId,
  getAssessments,
  getAssessmentById,
  getAssessmentWithJudgment,
  getJudgmentsForSubmission,
  createJudgment,
  updateJudgment,
  getOrCreateJudgment,
  getProgress,
  getSubmissionsSummary,
  createReviewSession,
  endReviewSession,
  getReviewSessions,
} from '../index';

import {
  getReviewProjects,
  getReviewProjectById,
  createReviewProject,
  updateReviewProject,
  deleteReviewProject,
  getProjectFiles,
  getUnprocessedFiles,
  addProjectFile,
  removeProjectFile,
  markFileProcessed,
} from '../review-projects';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockGetOne.mockReset();
  mockExecuteQuery.mockReset().mockReturnValue([]);
  mockExecuteStatement.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 99 });
  mockRun.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 42 });
  mockGet.mockReset().mockReturnValue(null);
  mockAll.mockReset().mockReturnValue([]);
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  mockTransaction.mockReset().mockImplementation((fn: (...args: unknown[]) => unknown) => fn);
}

beforeEach(resetMocks);

// ===========================================================================
// getSubmissions
// ===========================================================================

describe('getSubmissions', () => {
  it('defaults to ORDER BY imported_at DESC', () => {
    getSubmissions();
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
  });

  it('accepts "evaluation_completed" orderBy', () => {
    getSubmissions('evaluation_completed');
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY evaluation_completed DESC/);
  });

  it('falls back to imported_at for unknown column at runtime', () => {
    getSubmissions('injected; DROP TABLE--' as unknown as 'imported_at');
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY imported_at DESC/);
    expect(sql).not.toMatch(/injected/i);
  });

  it('returns whatever executeQuery returns', () => {
    const fake = [{ id: 'x' }];
    mockExecuteQuery.mockReturnValue(fake);
    expect(getSubmissions()).toBe(fake);
  });
});

// ===========================================================================
// getSubmissionById / getSubmissionBySubmissionId
// ===========================================================================

describe('getSubmissionById', () => {
  it('delegates to getOne with correct SQL and id', () => {
    mockGetOne.mockReturnValue({ id: 'abc' });
    const result = getSubmissionById('abc');
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      ['abc']
    );
    expect(result).toEqual({ id: 'abc' });
  });

  it('returns undefined when not found', () => {
    mockGetOne.mockReturnValue(undefined);
    expect(getSubmissionById('no')).toBeUndefined();
  });
});

describe('getSubmissionBySubmissionId', () => {
  it('queries by submission_id column', () => {
    mockGetOne.mockReturnValue(undefined);
    getSubmissionBySubmissionId('SID-999');
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE submission_id = ?'),
      ['SID-999']
    );
  });
});

// ===========================================================================
// getAssessments -- filter combinations
// ===========================================================================

describe('getAssessments', () => {
  it('only includes submission_id condition when no filters supplied', () => {
    getAssessments('sub-1');
    const [, params] = mockExecuteQuery.mock.calls[0];
    expect(params).toEqual(['sub-1']);
  });

  it('appends discretion_tier filter correctly', () => {
    getAssessments('sub-1', { discretion_tier: 'TIER_1_BINARY' });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/a\.discretion_tier = \?/);
    expect(params).toContain('TIER_1_BINARY');
  });

  it('appends ai_result filter correctly', () => {
    getAssessments('sub-1', { ai_result: 'PASS' });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/a\.ai_result = \?/);
    expect(params).toContain('PASS');
  });

  it('appends section filter correctly', () => {
    getAssessments('sub-1', { section: 'Section A' });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/a\.section = \?/);
    expect(params).toContain('Section A');
  });

  it('appends sheet filter correctly', () => {
    getAssessments('sub-1', { sheet: 'Sheet1' });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/a\.sheet = \?/);
    expect(params).toContain('Sheet1');
  });

  it('adds PENDING review_status condition', () => {
    getAssessments('sub-1', { review_status: 'PENDING' });
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/j\.id IS NULL OR j\.review_status = \?/);
  });

  it('adds REVIEWED review_status condition', () => {
    getAssessments('sub-1', { review_status: 'REVIEWED' });
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/j\.review_status != \?/);
  });

  it('does not add review_status condition when ALL', () => {
    getAssessments('sub-1', { review_status: 'ALL' });
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).not.toMatch(/j\.review_status/);
  });

  it('appends LIMIT only when truthy limit given', () => {
    getAssessments('sub-1', { limit: 10 });
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/LIMIT \?/);
    expect(params).toContain(10);
  });

  it('appends LIMIT and OFFSET when both given', () => {
    getAssessments('sub-1', { limit: 10, offset: 20 });
    const [, params] = mockExecuteQuery.mock.calls[0];
    expect(params).toEqual(['sub-1', 10, 20]);
  });

  it('accumulates multiple filters correctly', () => {
    getAssessments('sub-2', {
      discretion_tier: 'TIER_2_PROFESSIONAL',
      ai_result: 'FAIL',
      review_status: 'PENDING',
      limit: 5,
      offset: 15,
    });
    const [, params] = mockExecuteQuery.mock.calls[0];
    expect(params).toEqual(['sub-2', 'TIER_2_PROFESSIONAL', 'FAIL', 'PENDING', 5, 15]);
  });
});

// ===========================================================================
// getAssessmentById / getAssessmentWithJudgment
// ===========================================================================

describe('getAssessmentById', () => {
  it('queries WHERE id = ?', () => {
    mockGetOne.mockReturnValue({ id: 7 });
    getAssessmentById(7);
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      [7]
    );
  });
});

describe('getAssessmentWithJudgment', () => {
  it('returns undefined when assessment not found', () => {
    mockGetOne.mockReturnValue(undefined);
    expect(getAssessmentWithJudgment(1)).toBeUndefined();
  });

  it('returns assessment merged with null judgment when none exists', () => {
    const assessment = { id: 1, csap_id: 'X1' };
    // First call returns assessment, second call returns undefined (no judgment)
    mockGetOne
      .mockReturnValueOnce(assessment)
      .mockReturnValueOnce(undefined);

    const result = getAssessmentWithJudgment(1);
    expect(result).toMatchObject({ id: 1, judgment: null });
  });

  it('returns assessment merged with judgment when one exists', () => {
    const assessment = { id: 1, csap_id: 'X1' };
    const judgment = { id: 5, assessment_id: 1 };
    mockGetOne
      .mockReturnValueOnce(assessment)
      .mockReturnValueOnce(judgment);

    const result = getAssessmentWithJudgment(1);
    expect(result).toMatchObject({ id: 1, judgment: { id: 5 } });
  });
});

// ===========================================================================
// getJudgmentsForSubmission
// ===========================================================================

describe('getJudgmentsForSubmission', () => {
  it('queries via prepare/all with the submission_id param', () => {
    const fakeJudgments = [{ id: 10 }];
    mockAll.mockReturnValue(fakeJudgments);

    const result = getJudgmentsForSubmission('sub-X');

    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE a.submission_id = ?'));
    expect(mockAll).toHaveBeenCalledWith('sub-X');
    expect(result).toEqual(fakeJudgments);
  });
});

// ===========================================================================
// createJudgment -- boolean coercion
// ===========================================================================

describe('createJudgment', () => {
  beforeEach(() => {
    // getOne at end of createJudgment returns the created row
    mockGetOne.mockReturnValue({ id: 42, assessment_id: 1, review_status: 'PENDING' });
  });

  it('stores include_in_final as 1 when true', () => {
    createJudgment(1, { include_in_final: true });
    const args = mockRun.mock.calls[0];
    // include_in_final is the 7th bind param (index 6) after assessmentId
    // order: assessmentId, human_result, human_confidence, judgment_notes,
    //        override_reason, evidence_sufficiency, include_in_final, ...
    expect(args[6]).toBe(1);
  });

  it('stores include_in_final as 0 when false', () => {
    createJudgment(1, { include_in_final: false });
    const args = mockRun.mock.calls[0];
    expect(args[6]).toBe(0);
  });

  it('stores follow_up_needed as 1 when true', () => {
    createJudgment(1, { follow_up_needed: true });
    const args = mockRun.mock.calls[0];
    // order after include_in_final: final_memo_summary, follow_up_needed
    expect(args[8]).toBe(1);
  });

  it('defaults evidence_sufficiency to UNREVIEWED when not provided', () => {
    createJudgment(1, {});
    const args = mockRun.mock.calls[0];
    // evidence_sufficiency is index 5
    expect(args[5]).toBe('UNREVIEWED');
  });

  it('defaults review_status to PENDING when not provided', () => {
    createJudgment(1, {});
    const args = mockRun.mock.calls[0];
    // review_status is the last bind param (index 13)
    expect(args[13]).toBe('PENDING');
  });

  it('uses provided review_status', () => {
    createJudgment(1, { review_status: 'ACCEPTED' });
    const args = mockRun.mock.calls[0];
    expect(args[13]).toBe('ACCEPTED');
  });
});

// ===========================================================================
// updateJudgment -- dynamic SET builder
// ===========================================================================

describe('updateJudgment', () => {
  beforeEach(() => {
    mockGetOne.mockReturnValue({ id: 5, review_status: 'PENDING' });
  });

  it('returns existing record without a prepare call when data is empty', () => {
    const result = updateJudgment(5, {});
    expect(result).toEqual({ id: 5, review_status: 'PENDING' });
    // prepare is not called for the UPDATE when no fields changed
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE judgments'));
  });

  it('builds SET for human_result', () => {
    updateJudgment(5, { human_result: 'ADEQUATE' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0]).toMatch(/human_result = \?/);
  });

  it('builds SET for human_confidence', () => {
    updateJudgment(5, { human_confidence: '0.9' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    expect(updateCall![0]).toMatch(/human_confidence = \?/);
  });

  it('builds SET for evidence_sufficiency', () => {
    updateJudgment(5, { evidence_sufficiency: 'ADEQUATE' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    expect(updateCall![0]).toMatch(/evidence_sufficiency = \?/);
  });

  it('stores include_in_final=true as 1 in UPDATE', () => {
    updateJudgment(5, { include_in_final: true });
    expect(mockRun).toHaveBeenCalledWith(1, 5);
  });

  it('stores follow_up_needed=false as 0 in UPDATE', () => {
    updateJudgment(5, { follow_up_needed: false });
    expect(mockRun).toHaveBeenCalledWith(0, 5);
  });

  it('auto-sets reviewed_at when review_status changes from PENDING', () => {
    updateJudgment(5, { review_status: 'ACCEPTED' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    expect(updateCall![0]).toMatch(/reviewed_at = datetime\('now'\)/);
  });

  it('does not auto-set reviewed_at when review_status stays PENDING', () => {
    updateJudgment(5, { review_status: 'PENDING' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    // The condition in source: `else if (data.review_status && data.review_status !== 'PENDING')`
    // So PENDING should NOT trigger the auto-set
    expect(updateCall?.[0] ?? '').not.toMatch(/reviewed_at = datetime/);
  });

  it('respects explicit reviewed_at over the auto-set', () => {
    updateJudgment(5, { reviewed_at: '2026-01-01T00:00:00Z', review_status: 'ACCEPTED' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE judgments')
    );
    // When reviewed_at is explicit the auto branch is skipped; the column appears once
    const occurrences = ((updateCall![0] as string).match(/reviewed_at/g) || []).length;
    expect(occurrences).toBe(1);
  });
});

// ===========================================================================
// getOrCreateJudgment
// ===========================================================================

describe('getOrCreateJudgment', () => {
  it('returns existing judgment without insert when found', () => {
    const existing = { id: 10, assessment_id: 3 };
    mockGetOne.mockReturnValue(existing);
    const result = getOrCreateJudgment(3);
    expect(result).toBe(existing);
    // prepare should NOT have been called for INSERT
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO judgments'));
  });

  it('creates a new judgment when none exists', () => {
    const newJudgment = { id: 11, assessment_id: 3, review_status: 'PENDING' };
    // First getOne returns undefined (no existing), second getOne (inside createJudgment) returns the new row
    mockGetOne.mockReturnValueOnce(undefined).mockReturnValueOnce(newJudgment);
    const result = getOrCreateJudgment(3);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO judgments'));
    expect(result).toEqual(newJudgment);
  });
});

// ===========================================================================
// getProgress
// ===========================================================================

describe('getProgress', () => {
  it('returns undefined when submission not found', () => {
    mockGetOne.mockReturnValue(undefined);
    expect(getProgress('missing')).toBeUndefined();
  });

  it('returns 0% progress_percentage when there are no assessments', () => {
    mockGetOne.mockReturnValue({ id: 'sub-1' }); // submission found
    mockGet.mockReturnValue({
      total_assessments: 0,
      reviewed_count: 0,
      pending_count: 0,
      accepted_count: 0,
      overridden_count: 0,
      tier1_pending: 0,
      tier2_pending: 0,
      tier3_pending: 0,
    });
    const result = getProgress('sub-1');
    expect(result?.progress_percentage).toBe(0);
  });

  it('calculates progress_percentage correctly', () => {
    mockGetOne.mockReturnValue({ id: 'sub-1' });
    mockGet.mockReturnValue({
      total_assessments: 4,
      reviewed_count: 3,
      pending_count: 1,
      accepted_count: 2,
      overridden_count: 1,
      tier1_pending: 0,
      tier2_pending: 1,
      tier3_pending: 0,
    });
    const result = getProgress('sub-1');
    expect(result?.progress_percentage).toBe(75);
    expect(result?.total_assessments).toBe(4);
    expect(result?.reviewed_count).toBe(3);
  });
});

// ===========================================================================
// getSubmissionsSummary
// ===========================================================================

describe('getSubmissionsSummary', () => {
  it('returns the result from db.prepare().get()', () => {
    const fake = {
      total_submissions: 3,
      total_assessments: 100,
      total_reviewed: 60,
      total_pending: 40,
    };
    mockGet.mockReturnValue(fake);
    const result = getSubmissionsSummary();
    expect(result).toEqual(fake);
  });
});

// ===========================================================================
// Review session lifecycle
// ===========================================================================

describe('createReviewSession', () => {
  it('inserts with submission_id and reviewer_id', () => {
    const session = { id: 1, submission_id: 'sub-1' };
    mockGetOne.mockReturnValue(session);
    const result = createReviewSession('sub-1', 'reviewer-X');
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO review_sessions')
    );
    expect(mockRun).toHaveBeenCalledWith('sub-1', 'reviewer-X');
    expect(result).toEqual(session);
  });

  it('uses null when reviewerId is omitted', () => {
    mockGetOne.mockReturnValue({ id: 2 });
    createReviewSession('sub-2');
    expect(mockRun).toHaveBeenCalledWith('sub-2', null);
  });
});

describe('endReviewSession', () => {
  it('calls executeStatement with all summary fields', () => {
    const session = { id: 1 };
    mockGetOne.mockReturnValue(session);
    endReviewSession(1, {
      items_reviewed: 10,
      items_accepted: 8,
      items_overridden: 1,
      items_deferred: 1,
      session_notes: 'done',
    });
    expect(mockExecuteStatement).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE review_sessions'),
      [10, 8, 1, 1, 'done', 1]
    );
  });

  it('passes null for session_notes when omitted', () => {
    mockGetOne.mockReturnValue({ id: 3 });
    endReviewSession(3, {
      items_reviewed: 0,
      items_accepted: 0,
      items_overridden: 0,
      items_deferred: 0,
    });
    const callArgs = mockExecuteStatement.mock.calls[0] as unknown[];
    const params = callArgs[1] as unknown[];
    expect(params[4]).toBeNull();
  });
});

describe('getReviewSessions', () => {
  it('queries sessions ordered by session_start DESC', () => {
    getReviewSessions('sub-1');
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY session_start DESC/);
    expect(params).toEqual(['sub-1']);
  });
});

// ===========================================================================
// review-projects.ts
// ===========================================================================

describe('getReviewProjects', () => {
  it('fetches all without status filter', () => {
    getReviewProjects();
    const [sql] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM review_projects/);
    expect(sql).not.toMatch(/WHERE/);
  });

  it('adds WHERE status = ? when status provided', () => {
    getReviewProjects('ACTIVE');
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/WHERE status = \?/);
    expect(params).toEqual(['ACTIVE']);
  });
});

describe('getReviewProjectById', () => {
  it('delegates to getOne with project id', () => {
    mockGetOne.mockReturnValue({ id: 'proj-1' });
    const result = getReviewProjectById('proj-1');
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      ['proj-1']
    );
    expect(result).toEqual({ id: 'proj-1' });
  });
});

describe('createReviewProject', () => {
  it('inserts all 13 fields and returns the created project', () => {
    const project = {
      id: 'p1',
      site_id: 's1',
      site_name: 'Site 1',
      applicant_name: 'J. Smith',
      applicant_company: 'ACME',
      application_type: 'CSR',
      selected_services: 'review',
      submission_date: '2026-01-01',
      site_address: '123 Main St',
      site_region: 'Lower Mainland',
      folder_path: '/projects/p1',
      notes: null,
      status: 'ACTIVE',
    };
    mockGetOne.mockReturnValue({ ...project, created_at: 'now', updated_at: 'now' });

    const result = createReviewProject(project);

    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO review_projects'));
    expect(mockRun).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'p1' });
  });
});

describe('updateReviewProject', () => {
  beforeEach(() => {
    mockGetOne.mockReturnValue({ id: 'p1', status: 'ACTIVE' });
  });

  it('returns project without UPDATE when no fields provided', () => {
    const result = updateReviewProject('p1', {});
    expect(result).toEqual({ id: 'p1', status: 'ACTIVE' });
    expect(mockPrepare).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE review_projects'));
  });

  it('updates status field', () => {
    updateReviewProject('p1', { status: 'ARCHIVED' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE review_projects')
    );
    expect(updateCall![0]).toMatch(/status = \?/);
    expect(updateCall![0]).toMatch(/updated_at = datetime\('now'\)/);
  });

  it('updates site_name and notes', () => {
    updateReviewProject('p1', { site_name: 'New Name', notes: 'Updated' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE review_projects')
    );
    expect(updateCall![0]).toMatch(/site_name = \?/);
    expect(updateCall![0]).toMatch(/notes = \?/);
  });

  it('updates folder_path and site_region', () => {
    updateReviewProject('p1', { folder_path: '/new/path', site_region: 'North' });
    const updateCall = mockPrepare.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('UPDATE review_projects')
    );
    expect(updateCall![0]).toMatch(/folder_path = \?/);
    expect(updateCall![0]).toMatch(/site_region = \?/);
  });
});

describe('deleteReviewProject', () => {
  it('returns true when a row was deleted', () => {
    mockExecuteStatement.mockReturnValue({ changes: 1 });
    expect(deleteReviewProject('p1')).toBe(true);
    expect(mockExecuteStatement).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM review_projects WHERE id = ?'),
      ['p1']
    );
  });

  it('returns false when no row was deleted', () => {
    mockExecuteStatement.mockReturnValue({ changes: 0 });
    expect(deleteReviewProject('no-such')).toBe(false);
  });
});

describe('getProjectFiles', () => {
  it('queries files ordered by uploaded_at ASC', () => {
    getProjectFiles('p1');
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/ORDER BY uploaded_at ASC/);
    expect(params).toEqual(['p1']);
  });
});

describe('getUnprocessedFiles', () => {
  it('includes processed = 0 condition', () => {
    getUnprocessedFiles('p1');
    const [sql, params] = mockExecuteQuery.mock.calls[0];
    expect(sql).toMatch(/AND processed = 0/);
    expect(params).toEqual(['p1']);
  });
});

describe('addProjectFile', () => {
  it('inserts file record and returns created file', () => {
    const file = { id: 99, project_id: 'p1', filename: 'doc.pdf' };
    mockGetOne.mockReturnValue(file);
    const result = addProjectFile('p1', 'doc.pdf', 1024, 'application/pdf');
    expect(mockExecuteStatement).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO review_project_files'),
      ['p1', 'doc.pdf', 1024, 'application/pdf']
    );
    expect(result).toEqual(file);
  });
});

describe('removeProjectFile', () => {
  it('returns true on successful delete', () => {
    mockExecuteStatement.mockReturnValue({ changes: 1 });
    expect(removeProjectFile(5)).toBe(true);
  });

  it('returns false when file not found', () => {
    mockExecuteStatement.mockReturnValue({ changes: 0 });
    expect(removeProjectFile(999)).toBe(false);
  });
});

describe('markFileProcessed', () => {
  it('calls executeStatement with the file id', () => {
    markFileProcessed(7);
    expect(mockExecuteStatement).toHaveBeenCalledWith(
      expect.stringContaining("processed = 1"),
      [7]
    );
  });
});
