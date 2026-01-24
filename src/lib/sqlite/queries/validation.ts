/**
 * Baseline Validation Queries
 *
 * Functions for HITL (Human-in-the-Loop) engine accuracy validation.
 */

import { getDatabase, getOne, executeQuery } from '../client';

// =============================================================================
// Types
// =============================================================================

export interface BaselineValidation {
  id: number;
  assessment_id: number;
  validation_type: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_NEGATIVE';
  notes: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  validated_at: string;
}

export interface BaselineValidationData {
  validation_type: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_NEGATIVE';
  notes?: string;
  reviewer_id?: string;
  reviewer_name?: string;
}

export interface ValidationStats {
  total_validated: number;
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
  precision: number;
  recall: number;
  f1_score: number;
  fp_rate: number;
  fn_rate: number;
  by_tier: {
    tier1: { fp: number; fn: number; total: number };
    tier2: { fp: number; fn: number; total: number };
    tier3: { fp: number; fn: number; total: number };
  };
}

// =============================================================================
// Queries
// =============================================================================

/**
 * Get baseline validation for an assessment
 */
export function getBaselineValidation(assessmentId: number): BaselineValidation | undefined {
  return getOne<BaselineValidation>(
    'SELECT * FROM baseline_validations WHERE assessment_id = ?',
    [assessmentId]
  );
}

/**
 * Create or update a baseline validation
 */
export function upsertBaselineValidation(
  assessmentId: number,
  data: BaselineValidationData
): BaselineValidation {
  const db = getDatabase();

  const existing = getBaselineValidation(assessmentId);

  if (existing) {
    db.prepare(`
      UPDATE baseline_validations
      SET validation_type = ?, notes = ?, reviewer_id = ?, reviewer_name = ?, validated_at = datetime('now')
      WHERE assessment_id = ?
    `).run(
      data.validation_type,
      data.notes || null,
      data.reviewer_id || null,
      data.reviewer_name || null,
      assessmentId
    );
  } else {
    db.prepare(`
      INSERT INTO baseline_validations (assessment_id, validation_type, notes, reviewer_id, reviewer_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      data.validation_type,
      data.notes || null,
      data.reviewer_id || null,
      data.reviewer_name || null
    );
  }

  return getBaselineValidation(assessmentId)!;
}

/**
 * Get all baseline validations for a submission
 */
export function getBaselineValidations(submissionId: string): BaselineValidation[] {
  return executeQuery<BaselineValidation>(
    `SELECT bv.* FROM baseline_validations bv
     JOIN assessments a ON bv.assessment_id = a.id
     WHERE a.submission_id = ?
     ORDER BY bv.validated_at DESC`,
    [submissionId]
  );
}

/**
 * Get baseline validation statistics for a submission
 */
export function getBaselineValidationStats(submissionId: string): ValidationStats {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_validated,
      SUM(CASE WHEN bv.validation_type = 'TRUE_POSITIVE' THEN 1 ELSE 0 END) as true_positive,
      SUM(CASE WHEN bv.validation_type = 'FALSE_POSITIVE' THEN 1 ELSE 0 END) as false_positive,
      SUM(CASE WHEN bv.validation_type = 'TRUE_NEGATIVE' THEN 1 ELSE 0 END) as true_negative,
      SUM(CASE WHEN bv.validation_type = 'FALSE_NEGATIVE' THEN 1 ELSE 0 END) as false_negative
    FROM baseline_validations bv
    JOIN assessments a ON bv.assessment_id = a.id
    WHERE a.submission_id = ?
  `).get(submissionId) as {
    total_validated: number;
    true_positive: number;
    false_positive: number;
    true_negative: number;
    false_negative: number;
  };

  const tierStats = db.prepare(`
    SELECT
      a.discretion_tier,
      SUM(CASE WHEN bv.validation_type = 'FALSE_POSITIVE' THEN 1 ELSE 0 END) as fp,
      SUM(CASE WHEN bv.validation_type = 'FALSE_NEGATIVE' THEN 1 ELSE 0 END) as fn,
      COUNT(*) as total
    FROM baseline_validations bv
    JOIN assessments a ON bv.assessment_id = a.id
    WHERE a.submission_id = ?
    GROUP BY a.discretion_tier
  `).all(submissionId) as { discretion_tier: string; fp: number; fn: number; total: number }[];

  const byTier = {
    tier1: { fp: 0, fn: 0, total: 0 },
    tier2: { fp: 0, fn: 0, total: 0 },
    tier3: { fp: 0, fn: 0, total: 0 },
  };

  for (const row of tierStats) {
    if (row.discretion_tier === 'TIER_1_BINARY') {
      byTier.tier1 = { fp: row.fp, fn: row.fn, total: row.total };
    } else if (row.discretion_tier === 'TIER_2_PROFESSIONAL') {
      byTier.tier2 = { fp: row.fp, fn: row.fn, total: row.total };
    } else if (row.discretion_tier === 'TIER_3_STATUTORY') {
      byTier.tier3 = { fp: row.fp, fn: row.fn, total: row.total };
    }
  }

  // Calculate precision, recall, and F1 score
  const tp = stats.true_positive || 0;
  const fp = stats.false_positive || 0;
  const fn = stats.false_negative || 0;
  const tn = stats.true_negative || 0;

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // False positive rate and false negative rate
  const fpRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const fnRate = tp + fn > 0 ? fn / (tp + fn) : 0;

  return {
    total_validated: stats.total_validated || 0,
    true_positive: tp,
    false_positive: fp,
    true_negative: tn,
    false_negative: fn,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1_score: Math.round(f1Score * 1000) / 1000,
    fp_rate: Math.round(fpRate * 1000) / 1000,
    fn_rate: Math.round(fnRate * 1000) / 1000,
    by_tier: byTier,
  };
}
