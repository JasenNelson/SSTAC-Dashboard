/**
 * Matching Detail API for HITL Baseline Validation
 *
 * GET /api/regulatory-review/matching-detail?assessmentId=123
 * Returns detailed matching rationale for an assessment.
 *
 * POST /api/regulatory-review/matching-detail
 * Saves a baseline validation for an assessment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssessmentById } from '@/lib/sqlite/queries';
import {
  getBaselineValidation,
  upsertBaselineValidation,
  type BaselineValidationData,
} from '@/lib/sqlite/queries/validation';
import type {
  MatchingDetail,
  MatchingRationale,
  PolicyContext,
  BaselineValidationRecord,
} from '@/lib/regulatory-review/types';

/**
 * Parse JSON field safely
 */
function safeParseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Reconstruct matching rationale from assessment data
 */
function buildMatchingRationale(assessment: {
  keywords_matched: string | null;
  evidence_found: string | null;
  sections_searched: number;
  evidence_coverage: number;
  ai_confidence: string | null;
}): MatchingRationale {
  const keywordsMatched = safeParseJson<string[]>(assessment.keywords_matched) || [];
  const evidenceFound = safeParseJson<Array<{
    score?: number;
    keyword_score?: number;
    semantic_score?: number;
    structural_score?: number;
    section_id?: string;
    ai_triggered?: boolean;
    ai_reasoning?: string;
    cross_ref_boost?: number;
  }>>(assessment.evidence_found) || [];

  // Calculate scores from evidence found (use first evidence item if available)
  const firstEvidence = evidenceFound[0] || {};
  const keywordScore = firstEvidence.keyword_score ?? (assessment.evidence_coverage / 100) * 0.7;
  const semanticScore = firstEvidence.semantic_score ?? (assessment.evidence_coverage / 100) * 0.8;
  const structuralScore = firstEvidence.structural_score ?? 0.5;
  const combinedScore = firstEvidence.score ?? (keywordScore * 0.4 + semanticScore * 0.4 + structuralScore * 0.2);

  // Determine if AI was triggered
  const aiTriggered = firstEvidence.ai_triggered || keywordsMatched.length < 4;

  return {
    method: aiTriggered ? 'ai_fallback' : (keywordsMatched.length > 0 ? 'hybrid' : 'keyword'),
    scores: {
      keyword: keywordScore,
      semantic: semanticScore,
      structural: structuralScore,
      combined: combinedScore,
    },
    scoreBreakdown: [
      `Keyword match: ${Math.round(keywordScore * 100)}% (weight: 0.4)`,
      `Semantic match: ${Math.round(semanticScore * 100)}% (weight: 0.4)`,
      `Structural match: ${Math.round(structuralScore * 100)}% (weight: 0.2)`,
    ],
    policyKeywords: keywordsMatched,
    keywordsFound: keywordsMatched,
    keywordsMissing: [], // We don't have this data stored, would need policy keywords
    keywordsSource: 'extracted_from_policy',
    aiDetails: aiTriggered ? {
      triggered: true,
      triggerReason: keywordsMatched.length < 4 ? 'Sparse keywords (<4 matched)' : 'Low keyword score',
      reasoning: firstEvidence.ai_reasoning,
      confidence: assessment.ai_confidence === 'HIGH' ? 0.9 : assessment.ai_confidence === 'MEDIUM' ? 0.7 : 0.5,
    } : undefined,
    crossRefDetails: firstEvidence.cross_ref_boost ? {
      boostApplied: true,
      boostAmount: firstEvidence.cross_ref_boost,
      relatedPolicies: [],
    } : undefined,
    searchStats: {
      sectionsSearched: assessment.sections_searched,
      bestSection: firstEvidence.section_id || 'Unknown',
      bestScore: combinedScore,
    },
  };
}

/**
 * Build policy context from assessment and linked policies
 */
function buildPolicyContext(assessment: {
  csap_id: string;
  csap_text: string;
  discretion_tier: string;
  linked_policies: string | null;
}): PolicyContext {
  const linkedPolicies = safeParseJson<string[]>(assessment.linked_policies) || [];

  return {
    policyId: assessment.csap_id,
    verbatimText: assessment.csap_text,
    discretionTier: assessment.discretion_tier as PolicyContext['discretionTier'],
    topicCategory: 'General', // Would need to be stored or derived
    semanticSentences: {
      intent: '', // These would come from the policy database
      purpose: '',
      function: '',
      evidence: '',
      deficiency: '',
    },
    keywords: linkedPolicies.length > 0 ? linkedPolicies : [],
  };
}

/**
 * Parse assessment ID from string format (e.g., "ASM-123" or "123")
 * Returns the numeric portion of the ID.
 */
function parseAssessmentId(idParam: string): number | null {
  // Handle "ASM-123" format by extracting the numeric portion
  const asmMatch = idParam.match(/^ASM-(\d+)$/i);
  if (asmMatch) {
    return parseInt(asmMatch[1], 10);
  }
  // Handle plain numeric format
  const numericId = parseInt(idParam, 10);
  return isNaN(numericId) ? null : numericId;
}

/**
 * GET /api/regulatory-review/matching-detail
 *
 * Query Parameters:
 * - assessmentId: The assessment ID (required, supports "ASM-123" or "123" format)
 * - submissionId: Optional submission ID for context
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assessmentIdParam = searchParams.get('assessmentId');

    if (!assessmentIdParam) {
      return NextResponse.json(
        { error: 'assessmentId is required' },
        { status: 400 }
      );
    }

    const assessmentId = parseAssessmentId(assessmentIdParam);
    if (assessmentId === null) {
      return NextResponse.json(
        { error: 'assessmentId must be a valid ID (e.g., "123" or "ASM-123")' },
        { status: 400 }
      );
    }

    // Fetch assessment
    const assessment = getAssessmentById(assessmentId);
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Fetch validation if exists
    const validation = getBaselineValidation(assessmentId);

    // Build evidence context from evidence_found
    const evidenceFound = safeParseJson<Array<{
      excerpt?: string;
      full_context?: string;
      source_document?: string;
      source_section?: string;
      page_start?: number;
      page_end?: number;
    }>>(assessment.evidence_found) || [];

    const evidenceContext = evidenceFound.map((e) => ({
      excerpt: e.excerpt || '',
      fullContext: e.full_context,
      sourceDocument: e.source_document || 'Submission Document',
      sourceSection: e.source_section || 'Unknown Section',
      pageRange: (e.page_start && e.page_end) ? [e.page_start, e.page_end] as [number, number] : null,
    }));

    // Build the matching detail response
    const matchingDetail: MatchingDetail = {
      assessmentId: assessment.id.toString(),
      csapId: assessment.csap_id,
      policyContext: buildPolicyContext(assessment),
      evidenceContext,
      matchingRationale: buildMatchingRationale(assessment),
      engineDetermination: {
        result: assessment.ai_result as MatchingDetail['engineDetermination']['result'],
        confidence: (assessment.ai_confidence || 'MEDIUM') as MatchingDetail['engineDetermination']['confidence'],
        evidenceCoverage: assessment.evidence_coverage,
      },
      validation: validation ? {
        assessment: validation.validation_type,
        notes: validation.notes || '',
        reviewerId: validation.reviewer_id || '',
        timestamp: validation.validated_at,
      } : undefined,
    };

    return NextResponse.json({ matchingDetail });
  } catch (error) {
    console.error('Error fetching matching detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matching detail' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regulatory-review/matching-detail
 *
 * Request Body:
 * {
 *   assessmentId: number | string (supports "ASM-123" or "123" format),
 *   validation: {
 *     assessment: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_NEGATIVE',
 *     notes?: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { assessmentId: rawAssessmentId, validation } = body as {
      assessmentId: number | string;
      validation: {
        assessment: BaselineValidationRecord['assessment'];
        notes?: string;
      };
    };

    if (!rawAssessmentId || !validation?.assessment) {
      return NextResponse.json(
        { error: 'assessmentId and validation.assessment are required' },
        { status: 400 }
      );
    }

    // Parse assessment ID (handles both "ASM-123" string format and numeric format)
    const assessmentId = typeof rawAssessmentId === 'number'
      ? rawAssessmentId
      : parseAssessmentId(rawAssessmentId);

    if (assessmentId === null) {
      return NextResponse.json(
        { error: 'assessmentId must be a valid ID (e.g., "123" or "ASM-123")' },
        { status: 400 }
      );
    }

    // Verify assessment exists
    const assessment = getAssessmentById(assessmentId);
    if (!assessment) {
      return NextResponse.json(
        { error: 'Assessment not found' },
        { status: 404 }
      );
    }

    // Save the validation
    const validationData: BaselineValidationData = {
      validation_type: validation.assessment,
      notes: validation.notes,
      // TODO: Get reviewer info from session/auth
      reviewer_id: 'system',
      reviewer_name: 'System User',
    };

    const savedValidation = upsertBaselineValidation(assessmentId, validationData);

    return NextResponse.json({
      success: true,
      validation: {
        id: savedValidation.id,
        assessmentId: savedValidation.assessment_id,
        assessment: savedValidation.validation_type,
        notes: savedValidation.notes,
        reviewerId: savedValidation.reviewer_id,
        timestamp: savedValidation.validated_at,
      },
    });
  } catch (error) {
    console.error('Error saving validation:', error);
    return NextResponse.json(
      { error: 'Failed to save validation' },
      { status: 500 }
    );
  }
}
