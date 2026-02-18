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
import path from 'path';
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

// ============================================================================
// Engine DB connection (read-only) for policy metadata
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available
}

const ENGINE_DB_PATH = path.join(process.cwd(), '..', 'Regulatory-Review', 'engine', 'data', 'rraa_v3_2.db');

interface EngineDbPolicyRow {
  topic_category: string | null;
  semantic_sentences: string | null;
}

/**
 * Get policy context from the engine DB (semantic sentences + topic category)
 */
function getPolicyContextFromEngineDb(csapId: string): { topicCategory: string; semanticSentences: { intent: string; purpose: string; function: string; evidence: string; deficiency: string } } | null {
  if (!Database) return null;
  try {
    const db = new Database(ENGINE_DB_PATH, { readonly: true });
    const row = db.prepare(
      'SELECT topic_category, semantic_sentences FROM policy_statements WHERE id = ? AND is_active = 1'
    ).get(csapId) as EngineDbPolicyRow | undefined;
    db.close();

    if (!row) return null;

    const sentenceLabels = ['intent', 'purpose', 'function', 'evidence', 'deficiency'] as const;
    const sentences: Record<string, string> = { intent: '', purpose: '', function: '', evidence: '', deficiency: '' };

    if (row.semantic_sentences) {
      try {
        const parsed = JSON.parse(row.semantic_sentences);
        if (Array.isArray(parsed)) {
          sentenceLabels.forEach((label, i) => {
            sentences[label] = parsed[i] || '';
          });
        }
      } catch {
        // leave defaults
      }
    }

    return {
      topicCategory: row.topic_category || 'General',
      semanticSentences: sentences as { intent: string; purpose: string; function: string; evidence: string; deficiency: string },
    };
  } catch (err) {
    console.warn('Failed to query engine DB for policy context:', err);
    return null;
  }
}

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
 * Extract AI reasoning scores from evidence_found items or reviewer_notes.
 * Returns { similarity, relevance, completeness } or null if not found.
 */
function extractAiReasoningScores(
  evidenceFound: Array<Record<string, unknown>>,
  reviewerNotes: string | null
): { similarity: number; relevance: number; completeness: number } | null {
  // Strategy 1: Find AI-REASONING item in evidence_found and parse match_reasons
  for (const item of evidenceFound) {
    const specId = String(item.spec_id || item.specId || '');
    if (specId.includes('AI-REASONING') || item.evidence_type === 'AI_REASONING') {
      const matchReasons = (item.match_reasons || item.matchReasons) as string[] | undefined;
      if (Array.isArray(matchReasons)) {
        const scores: Record<string, number> = {};
        for (const reason of matchReasons) {
          const match = String(reason).match(/^(similarity|relevance|completeness):(\d+\.?\d*)/);
          if (match) {
            scores[match[1]] = parseFloat(match[2]);
          }
        }
        if (scores.similarity !== undefined || scores.relevance !== undefined || scores.completeness !== undefined) {
          return {
            similarity: scores.similarity ?? 0,
            relevance: scores.relevance ?? 0,
            completeness: scores.completeness ?? 0,
          };
        }
      }
    }
  }

  // Strategy 2: Parse from reviewer_notes text
  if (reviewerNotes) {
    const simMatch = reviewerNotes.match(/similarity[=:](\d+\.?\d*)/);
    const relMatch = reviewerNotes.match(/relevance[=:](\d+\.?\d*)/);
    const compMatch = reviewerNotes.match(/completeness[=:](\d+\.?\d*)/);
    if (simMatch || relMatch || compMatch) {
      return {
        similarity: simMatch ? parseFloat(simMatch[1]) : 0,
        relevance: relMatch ? parseFloat(relMatch[1]) : 0,
        completeness: compMatch ? parseFloat(compMatch[1]) : 0,
      };
    }
  }

  return null;
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
  reviewer_notes: string | null;
}): MatchingRationale {
  const keywordsMatched = safeParseJson<string[]>(assessment.keywords_matched) || [];
  const evidenceFound = safeParseJson<Array<Record<string, unknown>>>(assessment.evidence_found) || [];

  // Try to extract AI reasoning scores
  const aiScores = extractAiReasoningScores(evidenceFound, assessment.reviewer_notes);

  if (aiScores) {
    // AI Reasoning evaluation — show real scores
    const combined = (aiScores.similarity + aiScores.relevance + aiScores.completeness) / 3;
    return {
      method: 'ai_reasoning',
      evaluationType: 'ai_reasoning',
      scores: {
        keyword: 0,
        semantic: 0,
        structural: 0,
        combined,
        similarity: aiScores.similarity,
        relevance: aiScores.relevance,
        completeness: aiScores.completeness,
      },
      scoreBreakdown: [
        `Similarity: ${Math.round(aiScores.similarity * 100)}%`,
        `Relevance: ${Math.round(aiScores.relevance * 100)}%`,
        `Completeness: ${Math.round(aiScores.completeness * 100)}%`,
      ],
      policyKeywords: keywordsMatched,
      keywordsFound: keywordsMatched,
      keywordsMissing: [],
      keywordsSource: 'extracted_from_policy',
      aiDetails: {
        triggered: true,
        triggerReason: 'Tier 2 AI Reasoning evaluation',
        confidence: assessment.ai_confidence === 'HIGH' ? 0.9 : assessment.ai_confidence === 'MEDIUM' ? 0.7 : 0.5,
      },
      searchStats: {
        sectionsSearched: assessment.sections_searched,
        bestSection: 'AI Reasoning',
        bestScore: combined,
      },
    };
  }

  // Fallback: traditional pipeline scores
  const firstEvidence = (evidenceFound[0] || {}) as Record<string, unknown>;
  const keywordScore = (firstEvidence.keyword_score as number) ?? (assessment.evidence_coverage / 100) * 0.7;
  const semanticScore = (firstEvidence.semantic_score as number) ?? (assessment.evidence_coverage / 100) * 0.8;
  const structuralScore = (firstEvidence.structural_score as number) ?? 0.5;
  const combinedScore = (firstEvidence.score as number) ?? (keywordScore * 0.4 + semanticScore * 0.4 + structuralScore * 0.2);

  const aiTriggered = (firstEvidence.ai_triggered as boolean) || keywordsMatched.length < 4;

  return {
    method: aiTriggered ? 'ai_fallback' : (keywordsMatched.length > 0 ? 'hybrid' : 'keyword'),
    evaluationType: 'pipeline',
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
    keywordsMissing: [],
    keywordsSource: 'extracted_from_policy',
    aiDetails: aiTriggered ? {
      triggered: true,
      triggerReason: keywordsMatched.length < 4 ? 'Sparse keywords (<4 matched)' : 'Low keyword score',
      reasoning: firstEvidence.ai_reasoning as string | undefined,
      confidence: assessment.ai_confidence === 'HIGH' ? 0.9 : assessment.ai_confidence === 'MEDIUM' ? 0.7 : 0.5,
    } : undefined,
    crossRefDetails: (firstEvidence.cross_ref_boost as number) ? {
      boostApplied: true,
      boostAmount: firstEvidence.cross_ref_boost as number,
      relatedPolicies: [],
    } : undefined,
    searchStats: {
      sectionsSearched: assessment.sections_searched,
      bestSection: (firstEvidence.section_id as string) || 'Unknown',
      bestScore: combinedScore,
    },
  };
}

/**
 * Build policy context from assessment and linked policies.
 * Queries engine DB for semantic sentences and topic category.
 */
function buildPolicyContext(assessment: {
  csap_id: string;
  csap_text: string;
  discretion_tier: string;
  linked_policies: string | null;
}): PolicyContext {
  const linkedPolicies = safeParseJson<string[]>(assessment.linked_policies) || [];

  // Query engine DB for semantic sentences and topic category
  const engineData = getPolicyContextFromEngineDb(assessment.csap_id);

  return {
    policyId: assessment.csap_id,
    verbatimText: assessment.csap_text,
    discretionTier: assessment.discretion_tier as PolicyContext['discretionTier'],
    topicCategory: engineData?.topicCategory || 'General',
    semanticSentences: engineData?.semanticSentences || {
      intent: '',
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
