/**
 * Regulatory Review Submissions API
 *
 * GET /api/regulatory-review/submissions
 * Returns all submissions with summary statistics.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSubmissions,
  getSubmissionsSummary,
} from '@/lib/sqlite/queries';

/**
 * GET /api/regulatory-review/submissions
 *
 * Returns all submissions ordered by import date (most recent first)
 * with overall summary statistics.
 */
export async function GET(_request: NextRequest) {
  try {
    // Get all submissions
    const submissions = getSubmissions('imported_at');

    // Get summary statistics
    const summary = getSubmissionsSummary();

    // Transform database results to camelCase for API response
    const transformedSubmissions = submissions.map((sub) => ({
      id: sub.id,
      submissionId: sub.submission_id,
      siteId: sub.site_id,
      submissionType: sub.submission_type,
      checklistSource: sub.checklist_source,
      totalItems: sub.total_items,
      evaluationStarted: sub.evaluation_started,
      evaluationCompleted: sub.evaluation_completed,
      overallRecommendation: sub.overall_recommendation,
      requiresHumanReview: Boolean(sub.requires_human_review),
      importedAt: sub.imported_at,
      passCount: sub.pass_count,
      partialCount: sub.partial_count,
      failCount: sub.fail_count,
      requiresJudgmentCount: sub.requires_judgment_count,
      tier1Count: sub.tier1_count,
      tier2Count: sub.tier2_count,
      tier3Count: sub.tier3_count,
      overallCoverage: sub.overall_coverage,
    }));

    return NextResponse.json({
      submissions: transformedSubmissions,
      summary: {
        totalSubmissions: summary.total_submissions,
        totalAssessments: summary.total_assessments,
        totalReviewed: summary.total_reviewed,
        totalPending: summary.total_pending,
      },
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}
