/**
 * Regulatory Review Bulk Judgments API
 *
 * POST /api/regulatory-review/judgments
 * Bulk create or update judgments for assessments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAssessmentById,
  getOrCreateJudgment,
  updateJudgment,
  getSubmissionById,
} from '@/lib/sqlite/queries';
import {
  humanResultSchema,
  confidenceLevelSchema,
} from '@/lib/regulatory-review/validation';
import { DiscretionTier, HumanResult } from '@/lib/regulatory-review/types';

/**
 * Schema for a single judgment in bulk operation
 */
const bulkJudgmentItemSchema = z
  .object({
    assessmentId: z.number().int().positive('Assessment ID must be a positive integer'),
    humanResult: humanResultSchema.optional(),
    humanConfidence: confidenceLevelSchema.optional(),
    judgmentNotes: z
      .string()
      .max(5000, 'Judgment notes must be 5000 characters or less')
      .trim()
      .optional(),
    overrideReason: z
      .string()
      .max(2000, 'Override reason must be 2000 characters or less')
      .trim()
      .optional(),
  })
  .refine(
    (data) => {
      // If overriding, require an explanation
      if (
        data.humanResult === HumanResult.OVERRIDE_PASS ||
        data.humanResult === HumanResult.OVERRIDE_FAIL
      ) {
        return (
          data.overrideReason !== undefined &&
          data.overrideReason.trim().length >= 10
        );
      }
      return true;
    },
    {
      message:
        'Override reason is required (minimum 10 characters) when overriding AI result',
      path: ['overrideReason'],
    }
  );

/**
 * Schema for the bulk judgments request body
 */
const bulkJudgmentsSchema = z.object({
  submissionId: z.string().min(1, 'submission_id is required'),
  judgments: z
    .array(bulkJudgmentItemSchema)
    .min(1, 'At least one judgment is required')
    .max(100, 'Cannot process more than 100 judgments at once'),
});

// Type used for validation - may be used in future expansion
type _BulkJudgmentItem = z.infer<typeof bulkJudgmentItemSchema>;

/**
 * Validate judgment against tier constraints
 */
function validateJudgmentForTier(
  tier: string,
  humanResult: string | undefined
): { valid: boolean; error?: string } {
  if (!humanResult) {
    return { valid: true };
  }

  if (tier === DiscretionTier.TIER_2_PROFESSIONAL) {
    if (humanResult === HumanResult.ACCEPT || humanResult === HumanResult.OVERRIDE_PASS) {
      return {
        valid: false,
        error:
          'TIER_2_PROFESSIONAL cannot ACCEPT or OVERRIDE_PASS - only flag deficiencies or defer',
      };
    }
  }

  if (tier === DiscretionTier.TIER_3_STATUTORY) {
    if (
      humanResult === HumanResult.ACCEPT ||
      humanResult === HumanResult.OVERRIDE_PASS ||
      humanResult === HumanResult.OVERRIDE_FAIL
    ) {
      return {
        valid: false,
        error:
          'TIER_3_STATUTORY requires SDM determination - only DEFER is allowed',
      };
    }
  }

  return { valid: true };
}

interface ProcessedResult {
  assessmentId: number;
  success: boolean;
  error?: string;
  judgmentId?: number;
}

/**
 * POST /api/regulatory-review/judgments
 *
 * Bulk create or update judgments for assessments.
 *
 * Request Body:
 * {
 *   submissionId: string,
 *   judgments: [
 *     {
 *       assessmentId: number,
 *       humanResult?: "ACCEPT" | "OVERRIDE_PASS" | "OVERRIDE_FAIL" | "DEFER",
 *       humanConfidence?: "HIGH" | "MEDIUM" | "LOW" | "NONE",
 *       judgmentNotes?: string,
 *       overrideReason?: string
 *     },
 *     ...
 *   ]
 * }
 *
 * Response:
 * {
 *   processed: number,
 *   succeeded: number,
 *   failed: number,
 *   results: [
 *     { assessmentId: number, success: boolean, error?: string, judgmentId?: number }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = bulkJudgmentsSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        {
          error: firstError
            ? `${firstError.path.join('.')}: ${firstError.message}`
            : 'Validation failed',
        },
        { status: 400 }
      );
    }

    const { submissionId, judgments } = validation.data;

    // Verify submission exists
    const submission = getSubmissionById(submissionId);
    if (!submission) {
      return NextResponse.json(
        { error: `Submission not found: ${submissionId}` },
        { status: 404 }
      );
    }

    // Process each judgment
    const results: ProcessedResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const item of judgments) {
      try {
        // Verify assessment exists and belongs to submission
        const assessment = getAssessmentById(item.assessmentId);

        if (!assessment) {
          results.push({
            assessmentId: item.assessmentId,
            success: false,
            error: 'Assessment not found',
          });
          failed++;
          continue;
        }

        if (assessment.submission_id !== submissionId) {
          results.push({
            assessmentId: item.assessmentId,
            success: false,
            error: 'Assessment does not belong to the specified submission',
          });
          failed++;
          continue;
        }

        // Validate against tier constraints
        const tierValidation = validateJudgmentForTier(
          assessment.discretion_tier,
          item.humanResult
        );

        if (!tierValidation.valid) {
          results.push({
            assessmentId: item.assessmentId,
            success: false,
            error: tierValidation.error,
          });
          failed++;
          continue;
        }

        // Get or create judgment
        const existingJudgment = getOrCreateJudgment(item.assessmentId);

        // Update the judgment
        const updatedJudgment = updateJudgment(existingJudgment.id, {
          human_result: item.humanResult,
          human_confidence: item.humanConfidence,
          judgment_notes: item.judgmentNotes,
          override_reason: item.overrideReason,
          review_status: item.humanResult ? 'COMPLETED' : undefined,
        });

        if (updatedJudgment) {
          results.push({
            assessmentId: item.assessmentId,
            success: true,
            judgmentId: updatedJudgment.id,
          });
          succeeded++;
        } else {
          results.push({
            assessmentId: item.assessmentId,
            success: false,
            error: 'Failed to update judgment',
          });
          failed++;
        }
      } catch (error) {
        console.error(`Error processing judgment for assessment ${item.assessmentId}:`, error);
        results.push({
          assessmentId: item.assessmentId,
          success: false,
          error: 'Internal error processing judgment',
        });
        failed++;
      }
    }

    // Return summary
    const statusCode = failed === judgments.length ? 422 : succeeded === judgments.length ? 200 : 207;

    return NextResponse.json(
      {
        processed: judgments.length,
        succeeded,
        failed,
        results,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Error processing bulk judgments:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk judgments' },
      { status: 500 }
    );
  }
}
