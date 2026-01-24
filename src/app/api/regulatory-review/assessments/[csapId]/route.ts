/**
 * Regulatory Review Single Assessment API
 *
 * GET /api/regulatory-review/assessments/[csapId]
 * Returns a single assessment with its judgment if exists.
 *
 * PATCH /api/regulatory-review/assessments/[csapId]
 * Updates or creates a judgment for the assessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAssessmentWithJudgment,
  getOrCreateJudgment,
  updateJudgment,
  getAssessmentById,
} from '@/lib/sqlite/queries';
import { getOne } from '@/lib/sqlite/client';
import { parseUpdateJudgment } from '@/lib/regulatory-review/validation';
import { DiscretionTier, HumanResult } from '@/lib/regulatory-review/types';

// Type for database assessment lookup
interface AssessmentLookup {
  id: number;
  discretion_tier: string;
}

/**
 * Parse JSON field safely, returning null on failure
 */
function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Validate judgment against tier constraints
 *
 * Per the three-tier discretion model:
 * - TIER_1_BINARY: Full authority, any result allowed
 * - TIER_2_PROFESSIONAL: Can flag deficiencies, CANNOT return ADEQUATE/PASS
 * - TIER_3_STATUTORY: Observe only, CANNOT provide any adequacy determination
 */
function validateJudgmentForTier(
  tier: string,
  humanResult: string | undefined
): { valid: boolean; error?: string } {
  if (!humanResult) {
    return { valid: true };
  }

  // TIER_2_PROFESSIONAL cannot accept/pass - only flag deficiencies
  if (tier === DiscretionTier.TIER_2_PROFESSIONAL) {
    if (humanResult === HumanResult.ACCEPT || humanResult === HumanResult.OVERRIDE_PASS) {
      return {
        valid: false,
        error:
          'TIER_2_PROFESSIONAL items require professional judgment. Cannot return ACCEPT or OVERRIDE_PASS - only flag deficiencies or defer.',
      };
    }
  }

  // TIER_3_STATUTORY cannot make any adequacy determination
  if (tier === DiscretionTier.TIER_3_STATUTORY) {
    if (
      humanResult === HumanResult.ACCEPT ||
      humanResult === HumanResult.OVERRIDE_PASS ||
      humanResult === HumanResult.OVERRIDE_FAIL
    ) {
      return {
        valid: false,
        error:
          'TIER_3_STATUTORY items require Statutory Decision Maker determination. Cannot provide adequacy assessment - only DEFER is allowed.',
      };
    }
  }

  return { valid: true };
}

/**
 * GET /api/regulatory-review/assessments/[csapId]
 *
 * Returns a single assessment with its judgment.
 * csapId can be:
 * - Numeric ID (database primary key)
 * - CSAP checklist item ID (e.g., "DSI-1.2.3")
 *
 * Query Parameters:
 * - submissionId (optional): Required when using CSAP ID to disambiguate
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ csapId: string }> }
) {
  try {
    const { csapId } = await params;
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');

    let assessment;

    // Check if csapId is numeric (database ID) or string (CSAP ID)
    const numericId = parseInt(csapId, 10);
    if (!isNaN(numericId) && numericId.toString() === csapId) {
      // Numeric ID - fetch directly
      assessment = getAssessmentWithJudgment(numericId);
    } else {
      // CSAP ID - need to look up by csap_id field
      let sql = 'SELECT id, discretion_tier FROM assessments WHERE csap_id = ?';
      const queryParams: unknown[] = [csapId];

      if (submissionId) {
        sql += ' AND submission_id = ?';
        queryParams.push(submissionId);
      }

      const lookup = getOne<AssessmentLookup>(sql, queryParams);

      if (!lookup) {
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }

      assessment = getAssessmentWithJudgment(lookup.id);
    }

    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Transform to API response format
    const response = {
      id: assessment.id,
      submissionId: assessment.submission_id,
      csapId: assessment.csap_id,
      csapText: assessment.csap_text,
      section: assessment.section,
      sheet: assessment.sheet,
      itemNumber: assessment.item_number,
      aiResult: assessment.ai_result,
      aiConfidence: assessment.ai_confidence,
      discretionTier: assessment.discretion_tier,
      evidenceCoverage: assessment.evidence_coverage,
      regulatoryAuthority: assessment.regulatory_authority,
      linkedPolicies: safeParseJson<string[]>(assessment.linked_policies) || [],
      reviewerNotes: assessment.reviewer_notes,
      actionRequired: assessment.action_required,
      evidenceFound: safeParseJson<unknown[]>(assessment.evidence_found) || [],
      keywordsMatched: safeParseJson<string[]>(assessment.keywords_matched) || [],
      sectionsSearched: assessment.sections_searched,
      judgment: assessment.judgment
        ? {
            id: assessment.judgment.id,
            assessmentId: assessment.judgment.assessment_id,
            humanResult: assessment.judgment.human_result,
            humanConfidence: assessment.judgment.human_confidence,
            judgmentNotes: assessment.judgment.judgment_notes,
            overrideReason: assessment.judgment.override_reason,
            routedTo: assessment.judgment.routed_to,
            routingReason: assessment.judgment.routing_reason,
            reviewerId: assessment.judgment.reviewer_id,
            reviewerName: assessment.judgment.reviewer_name,
            reviewedAt: assessment.judgment.reviewed_at,
            reviewStatus: assessment.judgment.review_status,
          }
        : null,
    };

    return NextResponse.json({ assessment: response });
  } catch (error) {
    console.error('Error fetching assessment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/regulatory-review/assessments/[csapId]
 *
 * Updates or creates a judgment for the assessment.
 *
 * Request Body:
 * {
 *   humanResult?: "ACCEPT" | "OVERRIDE_PASS" | "OVERRIDE_FAIL" | "DEFER"
 *   humanConfidence?: "HIGH" | "MEDIUM" | "LOW" | "NONE"
 *   judgmentNotes?: string
 *   overrideReason?: string (required if humanResult is OVERRIDE_*)
 *   routedTo?: string
 *   routingReason?: string (required if routedTo is set)
 *   reviewStatus?: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DEFERRED"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ csapId: string }> }
) {
  try {
    const { csapId } = await params;
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');

    // Parse and validate request body
    const body = await request.json();
    const validation = parseUpdateJudgment(body);

    if (validation.error) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const judgmentData = validation.data!;

    // Find the assessment
    let assessmentId: number;
    let discretionTier: string;

    const numericId = parseInt(csapId, 10);
    if (!isNaN(numericId) && numericId.toString() === csapId) {
      // Numeric ID
      const assessment = getAssessmentById(numericId);
      if (!assessment) {
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }
      assessmentId = assessment.id;
      discretionTier = assessment.discretion_tier;
    } else {
      // CSAP ID - look up
      let sql = 'SELECT id, discretion_tier FROM assessments WHERE csap_id = ?';
      const queryParams: unknown[] = [csapId];

      if (submissionId) {
        sql += ' AND submission_id = ?';
        queryParams.push(submissionId);
      }

      const lookup = getOne<AssessmentLookup>(sql, queryParams);

      if (!lookup) {
        return NextResponse.json(
          { error: 'Assessment not found' },
          { status: 404 }
        );
      }

      assessmentId = lookup.id;
      discretionTier = lookup.discretion_tier;
    }

    // Validate judgment against tier constraints
    const tierValidation = validateJudgmentForTier(
      discretionTier,
      judgmentData.humanResult
    );

    if (!tierValidation.valid) {
      return NextResponse.json(
        {
          error: tierValidation.error,
          tierConstraint: true,
          tier: discretionTier,
        },
        { status: 422 }
      );
    }

    // Get or create judgment
    const existingJudgment = getOrCreateJudgment(assessmentId);

    // Update the judgment
    const updatedJudgment = updateJudgment(existingJudgment.id, {
      human_result: judgmentData.humanResult,
      human_confidence: judgmentData.humanConfidence,
      judgment_notes: judgmentData.judgmentNotes,
      override_reason: judgmentData.overrideReason,
      routed_to: judgmentData.routedTo,
      routing_reason: judgmentData.routingReason,
      review_status: judgmentData.reviewStatus,
    });

    if (!updatedJudgment) {
      return NextResponse.json(
        { error: 'Failed to update judgment' },
        { status: 500 }
      );
    }

    // Return the updated assessment with judgment
    const assessment = getAssessmentWithJudgment(assessmentId);

    const response = {
      id: assessment!.id,
      submissionId: assessment!.submission_id,
      csapId: assessment!.csap_id,
      csapText: assessment!.csap_text,
      section: assessment!.section,
      sheet: assessment!.sheet,
      itemNumber: assessment!.item_number,
      aiResult: assessment!.ai_result,
      aiConfidence: assessment!.ai_confidence,
      discretionTier: assessment!.discretion_tier,
      evidenceCoverage: assessment!.evidence_coverage,
      regulatoryAuthority: assessment!.regulatory_authority,
      linkedPolicies: safeParseJson<string[]>(assessment!.linked_policies) || [],
      reviewerNotes: assessment!.reviewer_notes,
      actionRequired: assessment!.action_required,
      evidenceFound: safeParseJson<unknown[]>(assessment!.evidence_found) || [],
      keywordsMatched: safeParseJson<string[]>(assessment!.keywords_matched) || [],
      sectionsSearched: assessment!.sections_searched,
      judgment: {
        id: updatedJudgment.id,
        assessmentId: updatedJudgment.assessment_id,
        humanResult: updatedJudgment.human_result,
        humanConfidence: updatedJudgment.human_confidence,
        judgmentNotes: updatedJudgment.judgment_notes,
        overrideReason: updatedJudgment.override_reason,
        routedTo: updatedJudgment.routed_to,
        routingReason: updatedJudgment.routing_reason,
        reviewerId: updatedJudgment.reviewer_id,
        reviewerName: updatedJudgment.reviewer_name,
        reviewedAt: updatedJudgment.reviewed_at,
        reviewStatus: updatedJudgment.review_status,
      },
    };

    return NextResponse.json({
      assessment: response,
      message: 'Judgment updated successfully',
    });
  } catch (error) {
    console.error('Error updating assessment judgment:', error);
    return NextResponse.json(
      { error: 'Failed to update judgment' },
      { status: 500 }
    );
  }
}
