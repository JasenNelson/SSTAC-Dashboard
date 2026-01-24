/**
 * Regulatory Review Progress API
 *
 * GET /api/regulatory-review/progress
 * Returns progress statistics for a submission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProgress, getSubmissionById } from '@/lib/sqlite/queries';
import type { ReviewProgress } from '@/lib/regulatory-review/types';

/**
 * GET /api/regulatory-review/progress
 *
 * Returns review progress statistics for a submission.
 *
 * Query Parameters:
 * - submissionId (required): The submission to get progress for
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    // Verify submission exists
    const submission = getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Get progress from database
    const progress = getProgress(submissionId);

    if (!progress) {
      return NextResponse.json(
        { error: 'Failed to calculate progress' },
        { status: 500 }
      );
    }

    // Calculate additional statistics for the ReviewProgress structure
    // Using submission data for tier counts and auto-passed items
    const autoPassed = submission.pass_count; // Items that passed with TIER_1_BINARY full authority

    // Transform to the ReviewProgress interface format
    const reviewProgress: ReviewProgress = {
      totalItems: progress.total_assessments,

      tierBreakdown: {
        tier1: submission.tier1_count,
        tier2: submission.tier2_count,
        tier3: submission.tier3_count,
      },

      statusBreakdown: {
        autoPassed: autoPassed,
        pendingReview: progress.pending_count,
        reviewed: progress.reviewed_count,
        deferred: 0, // Would need separate query for deferred count if tracked
      },

      progressPercent: progress.progress_percentage,

      // Items needing attention: TIER_2 pending + TIER_3 pending + any FAIL results
      itemsNeedingAttention:
        progress.tier2_pending + progress.tier3_pending + submission.fail_count,
    };

    // Also return the raw progress data for additional context
    return NextResponse.json({
      progress: reviewProgress,
      details: {
        submissionId: progress.submission_id,
        totalAssessments: progress.total_assessments,
        reviewedCount: progress.reviewed_count,
        pendingCount: progress.pending_count,
        acceptedCount: progress.accepted_count,
        overriddenCount: progress.overridden_count,
        tier1Pending: progress.tier1_pending,
        tier2Pending: progress.tier2_pending,
        tier3Pending: progress.tier3_pending,
        progressPercentage: progress.progress_percentage,
      },
      submission: {
        id: submission.id,
        submissionId: submission.submission_id,
        siteId: submission.site_id,
        submissionType: submission.submission_type,
        totalItems: submission.total_items,
        passCount: submission.pass_count,
        partialCount: submission.partial_count,
        failCount: submission.fail_count,
        requiresJudgmentCount: submission.requires_judgment_count,
        tier1Count: submission.tier1_count,
        tier2Count: submission.tier2_count,
        tier3Count: submission.tier3_count,
        overallCoverage: submission.overall_coverage,
        overallRecommendation: submission.overall_recommendation,
        evaluationCompleted: submission.evaluation_completed,
      },
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
