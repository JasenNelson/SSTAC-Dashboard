/**
 * Query Helpers for Regulatory Review Database
 *
 * Provides typed functions for common database operations.
 */

import { getDatabase, getOne, executeQuery, executeStatement } from '../client';

// =============================================================================
// Types
// =============================================================================

export interface Submission {
  id: string;
  submission_id: string;
  site_id: string;
  submission_type: string;
  checklist_source: string | null;
  total_items: number;
  evaluation_started: string | null;
  evaluation_completed: string | null;
  overall_recommendation: string | null;
  requires_human_review: number;
  imported_at: string;
  pass_count: number;
  partial_count: number;
  fail_count: number;
  requires_judgment_count: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  overall_coverage: number;
}

export interface Assessment {
  id: number;
  submission_id: string;
  csap_id: string;
  csap_text: string;
  section: string | null;
  sheet: string | null;
  item_number: number | null;
  ai_result: string;
  ai_confidence: string | null;
  discretion_tier: string;
  evidence_coverage: number;
  regulatory_authority: string | null;
  linked_policies: string | null;
  reviewer_notes: string | null;
  action_required: string | null;
  evidence_found: string | null;
  keywords_matched: string | null;
  sections_searched: number;
}

export interface Judgment {
  id: number;
  assessment_id: number;
  human_result: string | null;
  human_confidence: string | null;
  judgment_notes: string | null;
  override_reason: string | null;
  evidence_sufficiency: string | null;
  include_in_final: number | null;
  final_memo_summary: string | null;
  follow_up_needed: number | null;
  routed_to: string | null;
  routing_reason: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewed_at: string;
  review_status: string;
}

export interface ReviewSession {
  id: number;
  submission_id: string;
  reviewer_id: string | null;
  session_start: string;
  session_end: string | null;
  items_reviewed: number;
  items_accepted: number;
  items_overridden: number;
  items_deferred: number;
  session_notes: string | null;
}

export interface AssessmentFilters {
  discretion_tier?: string;
  ai_result?: string;
  review_status?: 'PENDING' | 'REVIEWED' | 'ALL';
  section?: string;
  sheet?: string;
  limit?: number;
  offset?: number;
}

export interface SubmissionProgress {
  submission_id: string;
  total_assessments: number;
  reviewed_count: number;
  pending_count: number;
  accepted_count: number;
  overridden_count: number;
  tier1_pending: number;
  tier2_pending: number;
  tier3_pending: number;
  progress_percentage: number;
}

export interface CreateJudgmentData {
  human_result?: string;
  human_confidence?: string;
  judgment_notes?: string;
  override_reason?: string;
  evidence_sufficiency?: string;
  include_in_final?: boolean;
  final_memo_summary?: string;
  follow_up_needed?: boolean;
  routed_to?: string;
  routing_reason?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  review_status?: string;
}

export interface UpdateJudgmentData extends Partial<CreateJudgmentData> {
  reviewed_at?: string;
}

// =============================================================================
// Submission Queries
// =============================================================================

/**
 * Get all submissions with optional ordering
 */
export function getSubmissions(orderBy: 'imported_at' | 'evaluation_completed' = 'imported_at'): Submission[] {
  const sql = `
    SELECT * FROM submissions
    ORDER BY ${orderBy} DESC
  `;
  return executeQuery<Submission>(sql);
}

/**
 * Get a single submission by ID
 */
export function getSubmissionById(id: string): Submission | undefined {
  const sql = 'SELECT * FROM submissions WHERE id = ?';
  return getOne<Submission>(sql, [id]);
}

/**
 * Get submission by submission_id (external reference)
 */
export function getSubmissionBySubmissionId(submissionId: string): Submission | undefined {
  const sql = 'SELECT * FROM submissions WHERE submission_id = ?';
  return getOne<Submission>(sql, [submissionId]);
}

/**
 * Insert a new submission
 */
export function createSubmission(submission: Omit<Submission, 'imported_at'>): Submission {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO submissions (
      id, submission_id, site_id, submission_type, checklist_source,
      total_items, evaluation_started, evaluation_completed,
      overall_recommendation, requires_human_review,
      pass_count, partial_count, fail_count, requires_judgment_count,
      tier1_count, tier2_count, tier3_count, overall_coverage
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  stmt.run(
    submission.id,
    submission.submission_id,
    submission.site_id,
    submission.submission_type,
    submission.checklist_source,
    submission.total_items,
    submission.evaluation_started,
    submission.evaluation_completed,
    submission.overall_recommendation,
    submission.requires_human_review,
    submission.pass_count,
    submission.partial_count,
    submission.fail_count,
    submission.requires_judgment_count,
    submission.tier1_count,
    submission.tier2_count,
    submission.tier3_count,
    submission.overall_coverage
  );

  return getSubmissionById(submission.id)!;
}

// =============================================================================
// Assessment Queries
// =============================================================================

/**
 * Get assessments for a submission with optional filters
 */
export function getAssessments(submissionId: string, filters: AssessmentFilters = {}): Assessment[] {
  const conditions: string[] = ['a.submission_id = ?'];
  const params: unknown[] = [submissionId];

  if (filters.discretion_tier) {
    conditions.push('a.discretion_tier = ?');
    params.push(filters.discretion_tier);
  }

  if (filters.ai_result) {
    conditions.push('a.ai_result = ?');
    params.push(filters.ai_result);
  }

  if (filters.section) {
    conditions.push('a.section = ?');
    params.push(filters.section);
  }

  if (filters.sheet) {
    conditions.push('a.sheet = ?');
    params.push(filters.sheet);
  }

  if (filters.review_status && filters.review_status !== 'ALL') {
    if (filters.review_status === 'PENDING') {
      conditions.push('(j.id IS NULL OR j.review_status = ?)');
      params.push('PENDING');
    } else if (filters.review_status === 'REVIEWED') {
      conditions.push('j.review_status != ?');
      params.push('PENDING');
    }
  }

  let sql = `
    SELECT a.*
    FROM assessments a
    LEFT JOIN judgments j ON a.id = j.assessment_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.item_number ASC, a.id ASC
  `;

  if (filters.limit) {
    sql += ` LIMIT ${filters.limit}`;
    if (filters.offset) {
      sql += ` OFFSET ${filters.offset}`;
    }
  }

  return executeQuery<Assessment>(sql, params);
}

/**
 * Get a single assessment by ID
 */
export function getAssessmentById(id: number): Assessment | undefined {
  const sql = 'SELECT * FROM assessments WHERE id = ?';
  return getOne<Assessment>(sql, [id]);
}

/**
 * Get assessment with its judgment
 */
export function getAssessmentWithJudgment(id: number): (Assessment & { judgment: Judgment | null }) | undefined {
  const assessment = getAssessmentById(id);
  if (!assessment) return undefined;

  const judgment = getOne<Judgment>('SELECT * FROM judgments WHERE assessment_id = ?', [id]);

  return {
    ...assessment,
    judgment: judgment || null,
  };
}

/**
 * Get all judgments for a submission (joins via assessments)
 */
export function getJudgmentsForSubmission(submissionId: string): Judgment[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT j.*
    FROM judgments j
    JOIN assessments a ON a.id = j.assessment_id
    WHERE a.submission_id = ?
  `).all(submissionId) as Judgment[];
}

/**
 * Insert a new assessment
 */
export function createAssessment(assessment: Omit<Assessment, 'id'>): Assessment {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO assessments (
      submission_id, csap_id, csap_text, section, sheet, item_number,
      ai_result, ai_confidence, discretion_tier, evidence_coverage,
      regulatory_authority, linked_policies, reviewer_notes, action_required,
      evidence_found, keywords_matched, sections_searched
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    assessment.submission_id,
    assessment.csap_id,
    assessment.csap_text,
    assessment.section,
    assessment.sheet,
    assessment.item_number,
    assessment.ai_result,
    assessment.ai_confidence,
    assessment.discretion_tier,
    assessment.evidence_coverage,
    assessment.regulatory_authority,
    assessment.linked_policies,
    assessment.reviewer_notes,
    assessment.action_required,
    assessment.evidence_found,
    assessment.keywords_matched,
    assessment.sections_searched
  );

  return getAssessmentById(Number(result.lastInsertRowid))!;
}

/**
 * Bulk insert assessments
 */
export function createAssessmentsBulk(assessments: Omit<Assessment, 'id'>[]): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO assessments (
      submission_id, csap_id, csap_text, section, sheet, item_number,
      ai_result, ai_confidence, discretion_tier, evidence_coverage,
      regulatory_authority, linked_policies, reviewer_notes, action_required,
      evidence_found, keywords_matched, sections_searched
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((...args: unknown[]) => {
    const items = args[0] as Omit<Assessment, 'id'>[];
    for (const item of items) {
      stmt.run(
        item.submission_id,
        item.csap_id,
        item.csap_text,
        item.section,
        item.sheet,
        item.item_number,
        item.ai_result,
        item.ai_confidence,
        item.discretion_tier,
        item.evidence_coverage,
        item.regulatory_authority,
        item.linked_policies,
        item.reviewer_notes,
        item.action_required,
        item.evidence_found,
        item.keywords_matched,
        item.sections_searched
      );
    }
    return items.length;
  });

  return insertMany(assessments);
}

// =============================================================================
// Judgment Queries
// =============================================================================

/**
 * Create a judgment for an assessment
 */
export function createJudgment(assessmentId: number, data: CreateJudgmentData): Judgment {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO judgments (
      assessment_id, human_result, human_confidence, judgment_notes,
      override_reason, evidence_sufficiency, include_in_final,
      final_memo_summary, follow_up_needed, routed_to, routing_reason,
      reviewer_id, reviewer_name, review_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    assessmentId,
    data.human_result || null,
    data.human_confidence || null,
    data.judgment_notes || null,
    data.override_reason || null,
    data.evidence_sufficiency || 'UNREVIEWED',
    data.include_in_final ? 1 : 0,
    data.final_memo_summary || null,
    data.follow_up_needed ? 1 : 0,
    data.routed_to || null,
    data.routing_reason || null,
    data.reviewer_id || null,
    data.reviewer_name || null,
    data.review_status || 'PENDING'
  );

  return getOne<Judgment>('SELECT * FROM judgments WHERE id = ?', [result.lastInsertRowid])!;
}

/**
 * Update an existing judgment
 */
export function updateJudgment(id: number, data: UpdateJudgmentData): Judgment | undefined {
  const db = getDatabase();

  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.human_result !== undefined) {
    updates.push('human_result = ?');
    params.push(data.human_result);
  }
  if (data.human_confidence !== undefined) {
    updates.push('human_confidence = ?');
    params.push(data.human_confidence);
  }
  if (data.judgment_notes !== undefined) {
    updates.push('judgment_notes = ?');
    params.push(data.judgment_notes);
  }
  if (data.override_reason !== undefined) {
    updates.push('override_reason = ?');
    params.push(data.override_reason);
  }
  if (data.evidence_sufficiency !== undefined) {
    updates.push('evidence_sufficiency = ?');
    params.push(data.evidence_sufficiency);
  }
  if (data.include_in_final !== undefined) {
    updates.push('include_in_final = ?');
    params.push(data.include_in_final ? 1 : 0);
  }
  if (data.final_memo_summary !== undefined) {
    updates.push('final_memo_summary = ?');
    params.push(data.final_memo_summary);
  }
  if (data.follow_up_needed !== undefined) {
    updates.push('follow_up_needed = ?');
    params.push(data.follow_up_needed ? 1 : 0);
  }
  if (data.routed_to !== undefined) {
    updates.push('routed_to = ?');
    params.push(data.routed_to);
  }
  if (data.routing_reason !== undefined) {
    updates.push('routing_reason = ?');
    params.push(data.routing_reason);
  }
  if (data.reviewer_id !== undefined) {
    updates.push('reviewer_id = ?');
    params.push(data.reviewer_id);
  }
  if (data.reviewer_name !== undefined) {
    updates.push('reviewer_name = ?');
    params.push(data.reviewer_name);
  }
  if (data.review_status !== undefined) {
    updates.push('review_status = ?');
    params.push(data.review_status);
  }
  if (data.reviewed_at !== undefined) {
    updates.push('reviewed_at = ?');
    params.push(data.reviewed_at);
  } else if (data.review_status && data.review_status !== 'PENDING') {
    // Auto-update reviewed_at when status changes from PENDING
    updates.push("reviewed_at = datetime('now')");
  }

  if (updates.length === 0) {
    return getOne<Judgment>('SELECT * FROM judgments WHERE id = ?', [id]);
  }

  params.push(id);

  db.prepare(`UPDATE judgments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  return getOne<Judgment>('SELECT * FROM judgments WHERE id = ?', [id]);
}

/**
 * Get or create a judgment for an assessment
 */
export function getOrCreateJudgment(assessmentId: number): Judgment {
  const existing = getOne<Judgment>('SELECT * FROM judgments WHERE assessment_id = ?', [assessmentId]);
  if (existing) return existing;

  return createJudgment(assessmentId, { review_status: 'PENDING' });
}

// =============================================================================
// Progress Queries
// =============================================================================

/**
 * Get review progress for a submission
 */
export function getProgress(submissionId: string): SubmissionProgress | undefined {
  const submission = getSubmissionById(submissionId);
  if (!submission) return undefined;

  const db = getDatabase();

  // Get counts
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_assessments,
      SUM(CASE WHEN j.review_status IS NOT NULL AND j.review_status != 'PENDING' THEN 1 ELSE 0 END) as reviewed_count,
      SUM(CASE WHEN j.review_status IS NULL OR j.review_status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN j.review_status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_count,
      SUM(CASE WHEN j.review_status = 'OVERRIDDEN' THEN 1 ELSE 0 END) as overridden_count,
      SUM(CASE WHEN a.discretion_tier = 'TIER_1_BINARY' AND (j.review_status IS NULL OR j.review_status = 'PENDING') THEN 1 ELSE 0 END) as tier1_pending,
      SUM(CASE WHEN a.discretion_tier = 'TIER_2_PROFESSIONAL' AND (j.review_status IS NULL OR j.review_status = 'PENDING') THEN 1 ELSE 0 END) as tier2_pending,
      SUM(CASE WHEN a.discretion_tier = 'TIER_3_STATUTORY' AND (j.review_status IS NULL OR j.review_status = 'PENDING') THEN 1 ELSE 0 END) as tier3_pending
    FROM assessments a
    LEFT JOIN judgments j ON a.id = j.assessment_id
    WHERE a.submission_id = ?
  `).get(submissionId) as {
    total_assessments: number;
    reviewed_count: number;
    pending_count: number;
    accepted_count: number;
    overridden_count: number;
    tier1_pending: number;
    tier2_pending: number;
    tier3_pending: number;
  };

  const progressPercentage = stats.total_assessments > 0
    ? (stats.reviewed_count / stats.total_assessments) * 100
    : 0;

  return {
    submission_id: submissionId,
    total_assessments: stats.total_assessments,
    reviewed_count: stats.reviewed_count,
    pending_count: stats.pending_count,
    accepted_count: stats.accepted_count,
    overridden_count: stats.overridden_count,
    tier1_pending: stats.tier1_pending,
    tier2_pending: stats.tier2_pending,
    tier3_pending: stats.tier3_pending,
    progress_percentage: Math.round(progressPercentage * 100) / 100,
  };
}

/**
 * Get summary statistics for all submissions
 */
export function getSubmissionsSummary(): {
  total_submissions: number;
  total_assessments: number;
  total_reviewed: number;
  total_pending: number;
} {
  const db = getDatabase();

  const result = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM submissions) as total_submissions,
      (SELECT COUNT(*) FROM assessments) as total_assessments,
      (SELECT COUNT(*) FROM judgments WHERE review_status != 'PENDING') as total_reviewed,
      (SELECT COUNT(*) FROM assessments a LEFT JOIN judgments j ON a.id = j.assessment_id WHERE j.id IS NULL OR j.review_status = 'PENDING') as total_pending
  `).get() as {
    total_submissions: number;
    total_assessments: number;
    total_reviewed: number;
    total_pending: number;
  };

  return result;
}

// =============================================================================
// Review Session Queries
// =============================================================================

/**
 * Create a new review session
 */
export function createReviewSession(submissionId: string, reviewerId?: string): ReviewSession {
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO review_sessions (submission_id, reviewer_id)
    VALUES (?, ?)
  `).run(submissionId, reviewerId || null);

  return getOne<ReviewSession>('SELECT * FROM review_sessions WHERE id = ?', [result.lastInsertRowid])!;
}

/**
 * End a review session with summary
 */
export function endReviewSession(
  sessionId: number,
  summary: {
    items_reviewed: number;
    items_accepted: number;
    items_overridden: number;
    items_deferred: number;
    session_notes?: string;
  }
): ReviewSession | undefined {
  executeStatement(
    `UPDATE review_sessions SET
      session_end = datetime('now'),
      items_reviewed = ?,
      items_accepted = ?,
      items_overridden = ?,
      items_deferred = ?,
      session_notes = ?
    WHERE id = ?`,
    [
      summary.items_reviewed,
      summary.items_accepted,
      summary.items_overridden,
      summary.items_deferred,
      summary.session_notes || null,
      sessionId,
    ]
  );

  return getOne<ReviewSession>('SELECT * FROM review_sessions WHERE id = ?', [sessionId]);
}

/**
 * Get review sessions for a submission
 */
export function getReviewSessions(submissionId: string): ReviewSession[] {
  return executeQuery<ReviewSession>(
    'SELECT * FROM review_sessions WHERE submission_id = ? ORDER BY session_start DESC',
    [submissionId]
  );
}
