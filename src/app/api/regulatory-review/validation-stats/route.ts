/**
 * Validation Statistics API
 *
 * GET /api/regulatory-review/validation-stats?submissionId=xxx
 * Returns baseline validation statistics for a submission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-guards';
import { getSubmissionById } from '@/lib/sqlite/queries';
import { getBaselineValidationStats } from '@/lib/sqlite/queries/validation';

/**
 * GET /api/regulatory-review/validation-stats
 *
 * Query Parameters:
 * - submissionId: The submission ID (required)
 */
export async function GET(request: NextRequest) {
  try {
    const authError = await requireAdmin()
    if (authError) return authError

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

    // Get validation statistics
    const stats = getBaselineValidationStats(submissionId);

    // Calculate progress percentage
    const progressPercent = submission.total_items > 0
      ? Math.round((stats.total_validated / submission.total_items) * 100)
      : 0;

    // Target benchmarks from ENGINE_BASELINE_COMPARISON.md
    const benchmarks = {
      tier1: { targetFpRate: 0.05, targetFnRate: 0.02 },
      tier2: { targetFpRate: 0.10, targetFnRate: 0.05 },
    };

    // Check if meeting targets
    const meetingTargets = {
      tier1Fp: stats.by_tier.tier1.total > 0
        ? (stats.by_tier.tier1.fp / stats.by_tier.tier1.total) <= benchmarks.tier1.targetFpRate
        : true,
      tier1Fn: stats.by_tier.tier1.total > 0
        ? (stats.by_tier.tier1.fn / stats.by_tier.tier1.total) <= benchmarks.tier1.targetFnRate
        : true,
      tier2Fp: stats.by_tier.tier2.total > 0
        ? (stats.by_tier.tier2.fp / stats.by_tier.tier2.total) <= benchmarks.tier2.targetFpRate
        : true,
      tier2Fn: stats.by_tier.tier2.total > 0
        ? (stats.by_tier.tier2.fn / stats.by_tier.tier2.total) <= benchmarks.tier2.targetFnRate
        : true,
    };

    return NextResponse.json({
      submissionId,
      totalItems: submission.total_items,
      stats: {
        totalValidated: stats.total_validated,
        progressPercent,
        breakdown: {
          truePositive: stats.true_positive,
          falsePositive: stats.false_positive,
          trueNegative: stats.true_negative,
          falseNegative: stats.false_negative,
        },
        rates: {
          precision: stats.precision,
          recall: stats.recall,
          f1Score: stats.f1_score,
          falsePositiveRate: stats.fp_rate,
          falseNegativeRate: stats.fn_rate,
        },
        byTier: stats.by_tier,
      },
      benchmarks,
      meetingTargets,
    });
  } catch (error) {
    console.error('Error fetching validation stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation statistics' },
      { status: 500 }
    );
  }
}
