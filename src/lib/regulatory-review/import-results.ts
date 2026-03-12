/**
 * Shared import function for evaluation results → dashboard DB.
 *
 * Used by:
 *   - POST /api/regulatory-review/run-engine (admin/debug path)
 *   - GET  /api/regulatory-review/projects/[id]/evaluate-status (project pipeline)
 */

// ============================================================================
// Types matching the engine output
// ============================================================================

export interface EvidenceItem {
  spec_id: string;
  spec_description: string;
  evidence_type: string;
  source_file: string;
  location: string;
  page_reference: string;
  excerpt: string;
  confidence: string;
  match_reasons: string[];
}

export interface AssessmentResult {
  csap_id: string;
  csap_text: string;
  section: string | null;
  sheet: string | null;
  item_number: number | null;
  result: string;
  confidence: string;
  discretion_tier: string;
  evidence_coverage: number;
  regulatory_authority: string | null;
  linked_policies: string[];
  reviewer_notes: string | null;
  action_required: string | null;
  evidence_found: EvidenceItem[];
  keywords_matched: string[];
  sections_searched: number;
}

export interface EvaluationResult {
  evaluation_id: string;
  submission_id: string;
  site_id: string;
  submission_type: string;
  evaluation_started: string;
  evaluation_completed: string;
  checklist_source: string;
  total_checklist_items: number;
  summary: {
    total_items: number;
    pass_count: number;
    partial_count: number;
    fail_count: number;
    na_count: number;
    requires_judgment_count: number;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    overall_coverage: number;
  };
  overall_recommendation: string;
  requires_human_review: boolean;
  assessments: AssessmentResult[];
}

// ============================================================================
// Import function
// ============================================================================

/**
 * Import evaluation results into the dashboard database.
 *
 * Deletes any existing data for the same submission_id first (allows re-runs).
 */
export async function importResultsToDatabase(result: EvaluationResult): Promise<{
  submissionCreated: boolean;
  assessmentsImported: number;
}> {
  // Dynamic import to avoid issues with better-sqlite3 in API routes
  const { getDatabase } = await import('@/lib/sqlite/client');

  const db = getDatabase();
  let submissionCreated = false;
  let assessmentsImported = 0;

  // First, delete existing data for this submission (to allow re-runs)
  const existingSubmission = db.prepare('SELECT id FROM submissions WHERE submission_id = ?').get(result.submission_id) as { id: string } | undefined;
  if (existingSubmission) {
    db.prepare('DELETE FROM judgments WHERE assessment_id IN (SELECT id FROM assessments WHERE submission_id = ?)').run(existingSubmission.id);
    db.prepare('DELETE FROM assessments WHERE submission_id = ?').run(existingSubmission.id);
    db.prepare('DELETE FROM submissions WHERE id = ?').run(existingSubmission.id);
  }

  // Create submission
  const insertSubmission = db.prepare(`
    INSERT INTO submissions (
      id, submission_id, site_id, submission_type, checklist_source,
      total_items, evaluation_started, evaluation_completed,
      overall_recommendation, requires_human_review,
      pass_count, partial_count, fail_count, requires_judgment_count,
      tier1_count, tier2_count, tier3_count, overall_coverage
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSubmission.run(
    result.submission_id,
    result.submission_id,
    result.site_id,
    result.submission_type,
    result.checklist_source,
    result.total_checklist_items,
    result.evaluation_started,
    result.evaluation_completed,
    result.overall_recommendation,
    result.requires_human_review ? 1 : 0,
    result.summary.pass_count,
    result.summary.partial_count,
    result.summary.fail_count,
    result.summary.requires_judgment_count,
    result.summary.tier1_count,
    result.summary.tier2_count,
    result.summary.tier3_count,
    result.summary.overall_coverage
  );
  submissionCreated = true;

  // Import assessments
  const insertAssessment = db.prepare(`
    INSERT INTO assessments (
      submission_id, csap_id, csap_text, section, sheet, item_number,
      ai_result, ai_confidence, discretion_tier, evidence_coverage,
      regulatory_authority, linked_policies, reviewer_notes, action_required,
      evidence_found, keywords_matched, sections_searched
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((...args: unknown[]) => {
    const assessments = args[0] as AssessmentResult[];
    for (const assessment of assessments) {
      insertAssessment.run(
        result.submission_id,
        assessment.csap_id,
        assessment.csap_text,
        assessment.section,
        assessment.sheet,
        assessment.item_number,
        assessment.result,
        assessment.confidence,
        assessment.discretion_tier,
        assessment.evidence_coverage,
        assessment.regulatory_authority,
        JSON.stringify(assessment.linked_policies),
        assessment.reviewer_notes,
        assessment.action_required,
        JSON.stringify(assessment.evidence_found),
        JSON.stringify(assessment.keywords_matched),
        assessment.sections_searched
      );
    }
    return assessments.length;
  });

  assessmentsImported = insertMany(result.assessments);

  return { submissionCreated, assessmentsImported };
}
