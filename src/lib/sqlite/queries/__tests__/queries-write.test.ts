/**
 * Tests for the INSERT-side query helpers in queries/index.ts and
 * queries/review-projects.ts that queries-full.test.ts does not exercise:
 *
 *   - createSubmission          (18-column bind order + re-read by id)
 *   - createAssessment          (17-column bind order + lastInsertRowid re-read)
 *   - createAssessmentsBulk     (transaction wrapper + per-row run + count)
 *   - createReviewProject       (13-column bind order + re-read by id)
 *
 * Strategy mirrors queries-full.test.ts: mock the SQLite client so no native
 * better-sqlite3 build is needed and assert on the exact bind arguments.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetOne = vi.fn<(...args: unknown[]) => unknown>();
const mockExecuteQuery = vi.fn<(...args: unknown[]) => unknown[]>(() => []);
const mockExecuteStatement = vi.fn<(...args: unknown[]) => { changes: number; lastInsertRowid?: number }>(
  () => ({ changes: 1, lastInsertRowid: 99 })
);

const mockRun = vi.fn<(...args: unknown[]) => { changes: number; lastInsertRowid?: number }>(
  () => ({ changes: 1, lastInsertRowid: 42 })
);
const mockGet = vi.fn<(...args: unknown[]) => Record<string, unknown> | null>(() => null);
const mockAll = vi.fn<(...args: unknown[]) => Record<string, unknown>[]>(() => []);
const mockPrepare = vi.fn<(...args: unknown[]) => { run: typeof mockRun; get: typeof mockGet; all: typeof mockAll }>(
  () => ({ run: mockRun, get: mockGet, all: mockAll })
);
// Faithful transaction shim: better-sqlite3's db.transaction(fn) returns a
// function that, when called, runs fn. The source calls the returned wrapper
// with the assessments array, so the shim must forward its args to fn.
const mockTransaction = vi.fn((fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args));

const mockDb = {
  prepare: mockPrepare,
  transaction: mockTransaction,
};

vi.mock('../../client', () => ({
  getDatabase: () => mockDb,
  getOne: (...args: unknown[]) => mockGetOne(...args),
  executeQuery: (...args: unknown[]) => mockExecuteQuery(...args),
  executeStatement: (...args: unknown[]) => mockExecuteStatement(...args),
}));

import {
  createSubmission,
  createAssessment,
  createAssessmentsBulk,
  type Submission,
  type Assessment,
} from '../index';

import { createReviewProject, type ReviewProject } from '../review-projects';

function resetMocks() {
  mockGetOne.mockReset();
  mockExecuteQuery.mockReset().mockReturnValue([]);
  mockExecuteStatement.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 99 });
  mockRun.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 42 });
  mockGet.mockReset().mockReturnValue(null);
  mockAll.mockReset().mockReturnValue([]);
  mockPrepare.mockReset().mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  mockTransaction.mockReset().mockImplementation(
    (fn: (...args: unknown[]) => unknown) => (...args: unknown[]) => fn(...args)
  );
}

beforeEach(resetMocks);

// ===========================================================================
// createSubmission
// ===========================================================================

function sampleSubmission(): Omit<Submission, 'imported_at'> {
  return {
    id: 'sub-1',
    submission_id: 'SID-1',
    site_id: 'site-1',
    submission_type: 'CSR',
    checklist_source: 'csap',
    total_items: 10,
    evaluation_started: '2026-01-01',
    evaluation_completed: '2026-01-02',
    overall_recommendation: 'ADEQUATE',
    requires_human_review: 1,
    pass_count: 5,
    partial_count: 3,
    fail_count: 1,
    requires_judgment_count: 1,
    tier1_count: 4,
    tier2_count: 5,
    tier3_count: 1,
    overall_coverage: 0.9,
  };
}

describe('createSubmission', () => {
  it('prepares an INSERT INTO submissions statement', () => {
    mockGetOne.mockReturnValue({ ...sampleSubmission(), imported_at: 'now' });
    createSubmission(sampleSubmission());
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO submissions'));
  });

  it('binds all 18 columns in declaration order', () => {
    mockGetOne.mockReturnValue({ ...sampleSubmission(), imported_at: 'now' });
    const s = sampleSubmission();
    createSubmission(s);
    expect(mockRun).toHaveBeenCalledWith(
      s.id,
      s.submission_id,
      s.site_id,
      s.submission_type,
      s.checklist_source,
      s.total_items,
      s.evaluation_started,
      s.evaluation_completed,
      s.overall_recommendation,
      s.requires_human_review,
      s.pass_count,
      s.partial_count,
      s.fail_count,
      s.requires_judgment_count,
      s.tier1_count,
      s.tier2_count,
      s.tier3_count,
      s.overall_coverage,
    );
    const args = mockRun.mock.calls[0];
    expect(args).toHaveLength(18);
  });

  it('re-reads the created row via getSubmissionById and returns it', () => {
    const created = { ...sampleSubmission(), imported_at: '2026-01-03' };
    mockGetOne.mockReturnValue(created);
    const result = createSubmission(sampleSubmission());
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      ['sub-1'],
    );
    expect(result).toEqual(created);
  });

  it('passes null checklist_source through unchanged', () => {
    mockGetOne.mockReturnValue({ imported_at: 'now' });
    createSubmission({ ...sampleSubmission(), checklist_source: null });
    expect(mockRun.mock.calls[0][4]).toBeNull();
  });
});

// ===========================================================================
// createAssessment
// ===========================================================================

function sampleAssessment(): Omit<Assessment, 'id'> {
  return {
    submission_id: 'sub-1',
    csap_id: 'C-1',
    csap_text: 'Item text',
    section: 'Section A',
    sheet: 'Sheet1',
    item_number: 3,
    ai_result: 'PASS',
    ai_confidence: '0.8',
    discretion_tier: 'TIER_1_BINARY',
    evidence_coverage: 0.7,
    regulatory_authority: 'EMA',
    linked_policies: 'P1,P2',
    reviewer_notes: null,
    action_required: null,
    evidence_found: 'yes',
    keywords_matched: 'a,b',
    sections_searched: 4,
  };
}

describe('createAssessment', () => {
  it('prepares an INSERT INTO assessments statement', () => {
    mockGetOne.mockReturnValue({ id: 7, ...sampleAssessment() });
    createAssessment(sampleAssessment());
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO assessments'));
  });

  it('binds all 17 columns in declaration order', () => {
    mockGetOne.mockReturnValue({ id: 7 });
    const a = sampleAssessment();
    createAssessment(a);
    expect(mockRun).toHaveBeenCalledWith(
      a.submission_id,
      a.csap_id,
      a.csap_text,
      a.section,
      a.sheet,
      a.item_number,
      a.ai_result,
      a.ai_confidence,
      a.discretion_tier,
      a.evidence_coverage,
      a.regulatory_authority,
      a.linked_policies,
      a.reviewer_notes,
      a.action_required,
      a.evidence_found,
      a.keywords_matched,
      a.sections_searched,
    );
    expect(mockRun.mock.calls[0]).toHaveLength(17);
  });

  it('re-reads the row via lastInsertRowid (coerced to number) and returns it', () => {
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 123 });
    const created = { id: 123, ...sampleAssessment() };
    mockGetOne.mockReturnValue(created);

    const result = createAssessment(sampleAssessment());

    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      [123],
    );
    expect(result).toEqual(created);
  });
});

// ===========================================================================
// createAssessmentsBulk
// ===========================================================================

describe('createAssessmentsBulk', () => {
  it('wraps the inserts in a single db.transaction', () => {
    createAssessmentsBulk([sampleAssessment(), sampleAssessment()]);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('runs the prepared statement once per assessment', () => {
    createAssessmentsBulk([sampleAssessment(), sampleAssessment(), sampleAssessment()]);
    expect(mockRun).toHaveBeenCalledTimes(3);
  });

  it('returns the number of rows inserted', () => {
    const count = createAssessmentsBulk([sampleAssessment(), sampleAssessment()]);
    expect(count).toBe(2);
  });

  it('handles an empty batch without running any inserts and returns 0', () => {
    const count = createAssessmentsBulk([]);
    expect(count).toBe(0);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('binds each row in column order', () => {
    const a = sampleAssessment();
    createAssessmentsBulk([a]);
    expect(mockRun).toHaveBeenCalledWith(
      a.submission_id,
      a.csap_id,
      a.csap_text,
      a.section,
      a.sheet,
      a.item_number,
      a.ai_result,
      a.ai_confidence,
      a.discretion_tier,
      a.evidence_coverage,
      a.regulatory_authority,
      a.linked_policies,
      a.reviewer_notes,
      a.action_required,
      a.evidence_found,
      a.keywords_matched,
      a.sections_searched,
    );
  });
});

// ===========================================================================
// createReviewProject
// ===========================================================================

function sampleProject(): Omit<ReviewProject, 'created_at' | 'updated_at'> {
  return {
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
}

describe('createReviewProject', () => {
  it('prepares an INSERT INTO review_projects statement', () => {
    mockGetOne.mockReturnValue({ ...sampleProject(), created_at: 'now', updated_at: 'now' });
    createReviewProject(sampleProject());
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO review_projects'));
  });

  it('binds all 13 columns in declaration order', () => {
    mockGetOne.mockReturnValue({ ...sampleProject(), created_at: 'now', updated_at: 'now' });
    const p = sampleProject();
    createReviewProject(p);
    expect(mockRun).toHaveBeenCalledWith(
      p.id,
      p.site_id,
      p.site_name,
      p.applicant_name,
      p.applicant_company,
      p.application_type,
      p.selected_services,
      p.submission_date,
      p.site_address,
      p.site_region,
      p.folder_path,
      p.notes,
      p.status,
    );
    expect(mockRun.mock.calls[0]).toHaveLength(13);
  });

  it('re-reads the created project via getReviewProjectById and returns it', () => {
    const created = { ...sampleProject(), created_at: '2026-01-01', updated_at: '2026-01-01' };
    mockGetOne.mockReturnValue(created);
    const result = createReviewProject(sampleProject());
    expect(mockGetOne).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = ?'),
      ['p1'],
    );
    expect(result).toEqual(created);
  });

  it('passes null notes through unchanged', () => {
    mockGetOne.mockReturnValue({ created_at: 'now', updated_at: 'now' });
    createReviewProject({ ...sampleProject(), notes: null });
    // notes is the 12th bind param (index 11).
    expect(mockRun.mock.calls[0][11]).toBeNull();
  });
});
