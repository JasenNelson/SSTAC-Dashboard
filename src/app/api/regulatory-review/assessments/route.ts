/**
 * Regulatory Review Assessments API
 *
 * GET /api/regulatory-review/assessments
 * Returns filtered assessments for a submission with pagination.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAssessments, getAssessmentWithJudgment } from '@/lib/sqlite/queries';
import type { AssessmentFilters } from '@/lib/sqlite/queries';

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
 * Raw evidence item from database (snake_case)
 */
interface RawEvidenceItem {
  spec_id?: string;
  spec_description?: string;
  evidence_type?: string;
  location?: string;
  page_reference?: string;
  excerpt?: string;
  confidence?: string;
  match_reasons?: string[];
}

/**
 * Transform evidence items from snake_case (DB) to camelCase (API)
 */
function transformEvidenceItems(raw: RawEvidenceItem[] | null): {
  specId: string;
  specDescription?: string;
  evidenceType?: string;
  location: string;
  pageReference?: string;
  excerpt: string;
  confidence: string;
  matchReasons: string[];
}[] {
  if (!raw || !Array.isArray(raw)) return [];

  return raw.map((item) => ({
    specId: item.spec_id || '',
    specDescription: item.spec_description,
    evidenceType: item.evidence_type,
    location: item.location || '',
    pageReference: item.page_reference,
    excerpt: item.excerpt || '',
    confidence: item.confidence || 'MEDIUM',
    matchReasons: item.match_reasons || [],
  }));
}

/**
 * GET /api/regulatory-review/assessments
 *
 * Query Parameters:
 * - submissionId (required): The submission to fetch assessments for
 * - tier: Filter by discretion tier (TIER_1_BINARY, TIER_2_PROFESSIONAL, TIER_3_STATUTORY)
 * - status: Filter by review status (PENDING, REVIEWED, ALL)
 * - result: Filter by AI result (PASS, PARTIAL, FAIL, REQUIRES_JUDGMENT)
 * - section: Filter by section name
 * - offset: Pagination offset (default: 0)
 * - limit: Number of results (default: 50, max: 500)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Required parameter
    const submissionId = searchParams.get('submissionId');
    if (!submissionId) {
      return NextResponse.json(
        { error: 'submissionId is required' },
        { status: 400 }
      );
    }

    // Build filters from query parameters
    const filters: AssessmentFilters = {};

    // Discretion tier filter
    const tier = searchParams.get('tier');
    if (tier) {
      const validTiers = ['TIER_1_BINARY', 'TIER_2_PROFESSIONAL', 'TIER_3_STATUTORY'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json(
          { error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
          { status: 400 }
        );
      }
      filters.discretion_tier = tier;
    }

    // Review status filter
    const status = searchParams.get('status');
    if (status) {
      const validStatuses = ['PENDING', 'REVIEWED', 'ALL'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      filters.review_status = status as 'PENDING' | 'REVIEWED' | 'ALL';
    }

    // AI result filter
    const result = searchParams.get('result');
    if (result) {
      const validResults = ['PASS', 'PARTIAL', 'FAIL', 'REQUIRES_JUDGMENT'];
      if (!validResults.includes(result)) {
        return NextResponse.json(
          { error: `Invalid result. Must be one of: ${validResults.join(', ')}` },
          { status: 400 }
        );
      }
      filters.ai_result = result;
    }

    // Section filter
    const section = searchParams.get('section');
    if (section) {
      filters.section = section;
    }

    // Sheet filter
    const sheet = searchParams.get('sheet');
    if (sheet) {
      filters.sheet = sheet;
    }

    // Pagination
    const offsetParam = searchParams.get('offset');
    const limitParam = searchParams.get('limit');

    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 50;

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'offset must be a non-negative integer' },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'limit must be a positive integer' },
        { status: 400 }
      );
    }

    filters.offset = offset;
    filters.limit = limit;

    // Fetch assessments from database
    const assessments = getAssessments(submissionId, filters);

    // Get total count without pagination for pagination info
    const totalFilters = { ...filters };
    delete totalFilters.offset;
    delete totalFilters.limit;
    const allAssessments = getAssessments(submissionId, totalFilters);
    const total = allAssessments.length;

    // Transform assessments with parsed JSON fields and judgment data
    const transformedAssessments = assessments.map((assessment) => {
      // Fetch judgment for this assessment
      const assessmentWithJudgment = getAssessmentWithJudgment(assessment.id);
      const judgment = assessmentWithJudgment?.judgment || null;

      return {
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
        evidenceFound: transformEvidenceItems(safeParseJson<RawEvidenceItem[]>(assessment.evidence_found)),
        keywordsMatched: safeParseJson<string[]>(assessment.keywords_matched) || [],
        sectionsSearched: assessment.sections_searched,
        judgment: judgment
          ? {
              id: judgment.id,
              assessmentId: judgment.assessment_id,
              humanResult: judgment.human_result,
              humanConfidence: judgment.human_confidence,
              judgmentNotes: judgment.judgment_notes,
              overrideReason: judgment.override_reason,
              evidenceSufficiency: judgment.evidence_sufficiency,
              includeInFinal: judgment.include_in_final === 1,
              finalMemoSummary: judgment.final_memo_summary,
              followUpNeeded: judgment.follow_up_needed === 1,
              routedTo: judgment.routed_to,
              routingReason: judgment.routing_reason,
              reviewerId: judgment.reviewer_id,
              reviewerName: judgment.reviewer_name,
              reviewedAt: judgment.reviewed_at,
              reviewStatus: judgment.review_status,
            }
          : null,
      };
    });

    return NextResponse.json({
      assessments: transformedAssessments,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + assessments.length < total,
      },
      filtersApplied: {
        submissionId,
        tier: tier || undefined,
        status: status || undefined,
        result: result || undefined,
        section: section || undefined,
        sheet: sheet || undefined,
      },
    });
  } catch (error) {
    console.error('Error fetching assessments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assessments' },
      { status: 500 }
    );
  }
}
