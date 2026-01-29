// src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import ErrorBoundary from '@/components/ErrorBoundary';
import ReviewDashboardClient from './ReviewDashboardClient';
import {
  getSubmissionById,
  getAssessments,
  getJudgmentsForSubmission,
  type Assessment as DbAssessment,
  type Judgment as DbJudgment,
} from '@/lib/sqlite/queries';
import { getTaxonomySummaries, type TaxonomySummary } from '@/lib/regulatory-review/taxonomy-mapping';

// Structured evidence item for detailed display
export interface StructuredEvidenceItem {
  specId: string;
  specDescription?: string;
  evidenceType?: string;
  location: string;
  pageReference?: string;
  excerpt: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  matchReasons: string[];
}

// Types for the regulatory review data (UI format)
export interface Assessment {
  id: string;
  dbId: number;
  policyId: string;
  citationLabel?: string;
  stageId?: string;
  stageLabel?: string;
  topicId?: string;
  topicLabel?: string;
  subtopicId?: string;
  subtopicLabel?: string;
  policyTitle: string;
  section: string;
  sheet: string;  // Excel tab name (Stg1, Stg2, DSI, RA, RP, etc.)
  itemNumber: number;  // Original item number from source for ordering
  tier: 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY';
  status: 'pass' | 'fail' | 'pending' | 'flagged';
  evidence: string[];  // Summary strings for backward compatibility
  evidenceItems: StructuredEvidenceItem[];  // Full structured evidence
  notes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  aiConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  evidenceCoverage?: number;
}

export interface Judgment {
  id?: number;
  assessmentId?: number;
  humanResult?: string;
  humanConfidence?: string;
  judgmentNotes?: string;
  overrideReason?: string;
  evidenceSufficiency?: string;
  includeInFinal?: boolean;
  finalMemoSummary?: string;
  followUpNeeded?: boolean;
  routedTo?: string;
  routingReason?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewStatus?: string;
}

export interface Submission {
  id: string;
  siteId: string;
  type: string;
  status: 'pending' | 'in_progress' | 'complete';
  submittedAt: string;
  submittedBy: string;
  assessments: Assessment[];
  judgments?: Judgment[];
}

// Evidence item from the database JSON
interface EvidenceItem {
  spec_id: string;
  spec_description: string;
  evidence_type: string;
  location: string;
  page_reference?: string;
  excerpt: string;
  confidence: string;
  match_reasons: string[];
}

// Transform database assessment to UI format
function transformAssessment(
  dbAssessment: DbAssessment,
  taxonomySummaries: Map<string, TaxonomySummary>
): Assessment {
  // Map AI result to UI status
  const statusMap: Record<string, 'pass' | 'fail' | 'pending' | 'flagged'> = {
    'PASS': 'pass',
    'FAIL': 'fail',
    'REQUIRES_JUDGMENT': 'pending',
    'PARTIAL': 'flagged',
  };

  // Parse evidence_found JSON and create both formats
  let evidence: string[] = [];
  let evidenceItems: StructuredEvidenceItem[] = [];

  if (dbAssessment.evidence_found) {
    try {
      const rawItems: EvidenceItem[] = JSON.parse(dbAssessment.evidence_found);

      // Create structured evidence items (full data)
      evidenceItems = rawItems.map((e) => ({
        specId: e.spec_id || '',
        specDescription: e.spec_description,
        evidenceType: e.evidence_type,
        location: e.location || 'Unknown location',
        pageReference: e.page_reference,
        excerpt: e.excerpt || '',
        confidence: (e.confidence || 'MEDIUM') as StructuredEvidenceItem['confidence'],
        matchReasons: e.match_reasons || [],
      }));

      // Create summary strings for backward compatibility
      evidence = rawItems.map((e) => {
        const location = e.location || 'Unknown location';
        const pageRef = e.page_reference ? ` (p. ${e.page_reference})` : '';
        const excerpt = e.excerpt || e.spec_description;
        return `[${location}${pageRef}] ${excerpt}`;
      });
    } catch {
      evidence = [];
      evidenceItems = [];
    }
  }

  // Map tier from database format
  let tier: 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY' = 'TIER_1_BINARY';
  if (dbAssessment.discretion_tier === 'TIER_2_PROFESSIONAL') {
    tier = 'TIER_2_PROFESSIONAL';
  } else if (dbAssessment.discretion_tier === 'TIER_3_STATUTORY') {
    tier = 'TIER_3_STATUTORY';
  }

  // Map confidence
  const confidenceMap: Record<string, StructuredEvidenceItem['confidence']> = {
    'HIGH': 'HIGH',
    'MEDIUM': 'MEDIUM',
    'LOW': 'LOW',
    'NONE': 'NONE',
  };

  const taxonomy = taxonomySummaries.get(dbAssessment.csap_id);

  return {
    id: `ASM-${dbAssessment.id}`,
    dbId: dbAssessment.id,
    policyId: dbAssessment.csap_id,
    citationLabel: taxonomy?.citationLabel,
    stageId: taxonomy?.stageId,
    stageLabel: taxonomy?.stageLabel,
    topicId: taxonomy?.topicId,
    topicLabel: taxonomy?.topicLabel,
    subtopicId: taxonomy?.subtopicId,
    subtopicLabel: taxonomy?.subtopicLabel,
    policyTitle: dbAssessment.csap_text,
    section: dbAssessment.section || 'General',
    sheet: dbAssessment.sheet || 'Other',  // Excel tab name for hierarchical grouping
    itemNumber: dbAssessment.item_number ?? 9999,  // Source order (fallback to end)
    tier,
    status: statusMap[dbAssessment.ai_result] || 'pending',
    evidence,
    evidenceItems,
    notes: dbAssessment.reviewer_notes || dbAssessment.action_required || '',
    reviewedAt: null,
    reviewedBy: null,
    aiConfidence: confidenceMap[dbAssessment.ai_confidence || 'MEDIUM'],
    evidenceCoverage: dbAssessment.evidence_coverage,
  };
}

function transformJudgment(dbJudgment: DbJudgment): Judgment {
  return {
    id: dbJudgment.id,
    assessmentId: dbJudgment.assessment_id,
    humanResult: dbJudgment.human_result || undefined,
    humanConfidence: dbJudgment.human_confidence || undefined,
    judgmentNotes: dbJudgment.judgment_notes || undefined,
    overrideReason: dbJudgment.override_reason || undefined,
    evidenceSufficiency: dbJudgment.evidence_sufficiency || undefined,
    includeInFinal: dbJudgment.include_in_final === 1,
    finalMemoSummary: dbJudgment.final_memo_summary || undefined,
    followUpNeeded: dbJudgment.follow_up_needed === 1,
    routedTo: dbJudgment.routed_to || undefined,
    routingReason: dbJudgment.routing_reason || undefined,
    reviewerId: dbJudgment.reviewer_id || undefined,
    reviewerName: dbJudgment.reviewer_name || undefined,
    reviewedAt: dbJudgment.reviewed_at || undefined,
    reviewStatus: dbJudgment.review_status || undefined,
  };
}

// Fetch submission with assessments from SQLite
function getSubmissionWithAssessments(submissionId: string): Submission | null {
  try {
    const dbSubmission = getSubmissionById(submissionId);
    if (!dbSubmission) return null;

    const dbAssessments = getAssessments(submissionId);
    const dbJudgments = getJudgmentsForSubmission(submissionId);
    const taxonomySummaries = getTaxonomySummaries(dbAssessments.map((assessment) => assessment.csap_id));

    // Determine status
    let status: 'pending' | 'in_progress' | 'complete' = 'pending';
    const hasReviewed = dbSubmission.pass_count > 0 || dbSubmission.fail_count > 0;
    const hasPending = dbSubmission.requires_judgment_count > 0;
    if (hasReviewed && hasPending) {
      status = 'in_progress';
    } else if (!hasPending) {
      status = 'complete';
    }

    return {
      id: dbSubmission.id,
      siteId: dbSubmission.site_id,
      type: dbSubmission.submission_type,
      status,
      submittedAt: dbSubmission.evaluation_started || dbSubmission.imported_at,
      submittedBy: 'AI Evaluation',
      assessments: dbAssessments.map((assessment) => transformAssessment(assessment, taxonomySummaries)),
      judgments: dbJudgments.map(transformJudgment),
    };
  } catch (error) {
    console.error('Error fetching submission:', error);
    return null;
  }
}

interface PageProps {
  params: Promise<{ submissionId: string }>;
}

export default async function SubmissionReviewPage({ params }: PageProps) {
  const { submissionId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (_error) {
            // Server Component cookie handling
          }
        },
      },
    }
  );

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?redirect=/regulatory-review/${submissionId}`);
  }

  // Fetch submission from SQLite
  const submission = getSubmissionWithAssessments(submissionId);

  if (!submission) {
    notFound();
  }

  return (
    <ErrorBoundary>
      <ReviewDashboardClient
        submission={submission}
        user={{
          id: user.id,
          email: user.email || '',
        }}
      />
    </ErrorBoundary>
  );
}
