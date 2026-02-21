/**
 * Regulatory Review Types
 *
 * TypeScript types for the SSTAC-Dashboard regulatory review feature.
 * These types align with the RRAA (Regulatory Review AI Agent) three-tier
 * discretion model for contaminated sites submission adequacy assessment.
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Assessment result from AI evaluation
 * - PASS: All evidence requirements satisfied
 * - PARTIAL: Some evidence found but gaps remain
 * - FAIL: Critical evidence missing or non-compliant
 * - REQUIRES_JUDGMENT: Professional or statutory judgment needed
 */
export enum AssessmentResult {
  PASS = 'PASS',
  PARTIAL = 'PARTIAL',
  FAIL = 'FAIL',
  REQUIRES_JUDGMENT = 'REQUIRES_JUDGMENT',
}

/**
 * Confidence level for AI assessments and evidence matching
 */
export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

/**
 * Three-tier discretion model for AI authority constraints
 *
 * TIER_1_BINARY: AI has full authority (must/shall/required)
 * TIER_2_PROFESSIONAL: AI flags only, cannot return ADEQUATE (should/sufficient)
 * TIER_3_STATUTORY: AI observes only, cannot evaluate (may/Director/Indigenous)
 */
export enum DiscretionTier {
  TIER_1_BINARY = 'TIER_1_BINARY',
  TIER_2_PROFESSIONAL = 'TIER_2_PROFESSIONAL',
  TIER_3_STATUTORY = 'TIER_3_STATUTORY',
}

/**
 * Human reviewer decision on an assessment
 */
export enum HumanResult {
  ACCEPT = 'ACCEPT',
  OVERRIDE_PASS = 'OVERRIDE_PASS',
  OVERRIDE_FAIL = 'OVERRIDE_FAIL',
  DEFER = 'DEFER',
}

/**
 * Status of human review workflow
 */
export enum ReviewStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DEFERRED = 'DEFERRED',
}

/**
 * Reviewer evidence sufficiency status
 */
export enum EvidenceSufficiency {
  SUFFICIENT = 'SUFFICIENT',
  INSUFFICIENT = 'INSUFFICIENT',
  NEEDS_MORE_EVIDENCE = 'NEEDS_MORE_EVIDENCE',
  UNREVIEWED = 'UNREVIEWED',
}

/**
 * Evidence types from the regulatory knowledge base
 * Comprehensive list of 33 evidence specification types from data analysis
 */
export enum EvidenceType {
  // Documentation and Records
  DOCUMENTATION = 'DOCUMENTATION',
  RECORD = 'RECORD',
  REPORT = 'REPORT',
  LETTER = 'LETTER',
  CERTIFICATE = 'CERTIFICATE',
  NOTIFICATION = 'NOTIFICATION',
  DECLARATION = 'DECLARATION',
  STATEMENT = 'STATEMENT',

  // Plans and Maps
  SITE_PLAN = 'SITE_PLAN',
  REMEDIATION_PLAN = 'REMEDIATION_PLAN',
  MONITORING_PLAN = 'MONITORING_PLAN',
  CONTINGENCY_PLAN = 'CONTINGENCY_PLAN',
  MAP = 'MAP',
  FIGURE = 'FIGURE',
  DRAWING = 'DRAWING',

  // Technical Data
  TRV_TABLE = 'TRV_TABLE',
  LABORATORY_DATA = 'LABORATORY_DATA',
  FIELD_DATA = 'FIELD_DATA',
  SAMPLE_RESULTS = 'SAMPLE_RESULTS',
  ANALYTICAL_RESULTS = 'ANALYTICAL_RESULTS',
  CALCULATION = 'CALCULATION',
  MODEL_OUTPUT = 'MODEL_OUTPUT',

  // Assessment Documents
  RISK_ASSESSMENT = 'RISK_ASSESSMENT',
  HUMAN_HEALTH_ASSESSMENT = 'HUMAN_HEALTH_ASSESSMENT',
  ECOLOGICAL_ASSESSMENT = 'ECOLOGICAL_ASSESSMENT',
  VAPOUR_ASSESSMENT = 'VAPOUR_ASSESSMENT',

  // Verification and Compliance
  QA_QC_RECORD = 'QA_QC_RECORD',
  CHAIN_OF_CUSTODY = 'CHAIN_OF_CUSTODY',
  PROFESSIONAL_OPINION = 'PROFESSIONAL_OPINION',
  SIGN_OFF = 'SIGN_OFF',

  // External and Third-Party
  PERMIT = 'PERMIT',
  APPROVAL = 'APPROVAL',
  CORRESPONDENCE = 'CORRESPONDENCE',
}

// ============================================================================
// Interfaces - Evidence
// ============================================================================

/**
 * Individual evidence item found during assessment
 */
export interface EvidenceItem {
  /** Evidence specification ID from knowledge base */
  specId: string;
  /** Human-readable description of the evidence requirement */
  specDescription: string;
  /** Type of evidence (from EvidenceType enum) */
  evidenceType: string;
  /** Location in submission document */
  location: string;
  /** Specific page reference if available */
  pageReference?: string;
  /** Extracted text excerpt from the evidence */
  excerpt: string;
  /** AI confidence in the evidence match */
  confidence: ConfidenceLevel;
  /** Reasons why this evidence was matched */
  matchReasons: string[];
  // Phase 4 (PIV-EVIDENCE-FIDELITY-001): Fidelity and ranking fields
  /** Evidence text fidelity: verbatim | normalized | structured | ai */
  excerptFidelity?: string;
  /** Whether confidence is excerpt-level or policy-level */
  confidenceScope?: string;
  /** Reason for fidelity classification */
  fidelityReason?: string;
  /** Source dict key path for provenance */
  sourcePath?: string;
  /** Pre-sanitization evidence text */
  evidenceTextRaw?: string;
  /** Post-sanitization evidence text for display */
  evidenceTextDisplay?: string;
  /** Ranking score for evidence ordering */
  rankScore?: number;
  /** Ranking factors applied */
  rankReason?: string[];
}

// ============================================================================
// Interfaces - Assessment
// ============================================================================

/**
 * Complete assessment record for a checklist item
 */
export interface Assessment {
  /** Database primary key */
  id: number;
  /** Parent submission identifier */
  submissionId: string;
  /** CSAP checklist item identifier */
  csapId: string;
  /** Full text of the CSAP requirement */
  csapText: string;
  /** Section within the checklist (e.g., "Site Characterization") */
  section: string;
  /** Sheet/tab name from source checklist */
  sheet: string;
  /** Item number within the sheet */
  itemNumber: number;

  // AI Evaluation Results
  /** AI determination result */
  aiResult: AssessmentResult;
  /** AI confidence in the result */
  aiConfidence: ConfidenceLevel;
  /** Discretion tier that constrains AI authority */
  discretionTier: DiscretionTier;
  /** Percentage of required evidence found (0-100) */
  evidenceCoverage: number;

  // Regulatory Context
  /** Source regulation/protocol authority */
  regulatoryAuthority?: string;
  /** IDs of policies linked to this requirement */
  linkedPolicies: string[];

  // Review Guidance
  /** Notes for human reviewer */
  reviewerNotes: string;
  /** Specific action required from reviewer */
  actionRequired: string;

  // Evidence Details
  /** Array of evidence items found */
  evidenceFound: EvidenceItem[];
  /** Keywords that matched during search */
  keywordsMatched: string[];
  /** Number of document sections searched */
  sectionsSearched: number;

  // Human Judgment (populated from join if exists)
  /** Associated human judgment record */
  judgment?: Judgment;
}

// ============================================================================
// Interfaces - Judgment
// ============================================================================

/**
 * Human judgment record for an assessment
 */
export interface Judgment {
  /** Database primary key */
  id: number;
  /** Foreign key to Assessment */
  assessmentId: number;

  // Human Decision
  /** Final human decision */
  humanResult?: HumanResult;
  /** Human's confidence in their decision */
  humanConfidence?: ConfidenceLevel;
  /** Detailed notes explaining the judgment */
  judgmentNotes?: string;
  /** Required explanation if overriding AI result */
  overrideReason?: string;

  // Evidence sufficiency + memo curation
  /** Reviewer evidence sufficiency label */
  evidenceSufficiency?: EvidenceSufficiency;
  /** Include this item in Final Memo */
  includeInFinal?: boolean;
  /** Final Memo summary text (1-3 paragraphs) */
  finalMemoSummary?: string;
  /** Follow-up needed to request more engine evaluation */
  followUpNeeded?: boolean;

  // Routing
  /** Role/person item was routed to */
  routedTo?: string;
  /** Reason for routing (e.g., "TIER_3 requires SDM") */
  routingReason?: string;

  // Audit Trail
  /** Reviewer's user ID */
  reviewerId?: string;
  /** Reviewer's display name */
  reviewerName?: string;
  /** ISO timestamp of review */
  reviewedAt: string;
  /** Current status of the review */
  reviewStatus: ReviewStatus;
}

// ============================================================================
// Interfaces - Submission
// ============================================================================

/**
 * Submission record with summary statistics
 */
export interface Submission {
  /** Database primary key (typically UUID) */
  id: string;
  /** External submission identifier */
  submissionId: string;
  /** Contaminated site identifier */
  siteId: string;
  /** Type of submission (e.g., "DSI", "PSI", "Remediation") */
  submissionType: string;
  /** Source checklist used (e.g., "CSAP_DSI_v2.1") */
  checklistSource?: string;
  /** Total checklist items in submission */
  totalItems: number;

  // Evaluation Timeline
  /** ISO timestamp when evaluation began */
  evaluationStarted?: string;
  /** ISO timestamp when evaluation completed */
  evaluationCompleted?: string;

  // Overall Status
  /** Summary recommendation from AI */
  overallRecommendation?: string;
  /** True if any items require human review */
  requiresHumanReview: boolean;
  /** ISO timestamp of import */
  importedAt: string;

  // Summary Statistics (aggregated from assessments)
  /** Count of PASS results */
  passCount: number;
  /** Count of PARTIAL results */
  partialCount: number;
  /** Count of FAIL results */
  failCount: number;
  /** Count of REQUIRES_JUDGMENT results */
  requiresJudgmentCount: number;

  // Tier Distribution
  /** Count of TIER_1_BINARY items */
  tier1Count: number;
  /** Count of TIER_2_PROFESSIONAL items */
  tier2Count: number;
  /** Count of TIER_3_STATUTORY items */
  tier3Count: number;

  /** Average evidence coverage across all items (0-100) */
  overallCoverage: number;
}

// ============================================================================
// Interfaces - Progress Tracking
// ============================================================================

/**
 * Review progress summary for a submission
 */
export interface ReviewProgress {
  /** Total items requiring review */
  totalItems: number;

  /** Breakdown by discretion tier */
  tierBreakdown: {
    tier1: number;
    tier2: number;
    tier3: number;
  };

  /** Breakdown by review status */
  statusBreakdown: {
    /** Items auto-passed by AI (TIER_1 only) */
    autoPassed: number;
    /** Items awaiting human review */
    pendingReview: number;
    /** Items with completed human review */
    reviewed: number;
    /** Items deferred to later or another party */
    deferred: number;
  };

  /** Overall progress percentage (0-100) */
  progressPercent: number;

  /** Count of items flagged for immediate attention */
  itemsNeedingAttention: number;
}

// ============================================================================
// Interfaces - Filtering
// ============================================================================

/**
 * Filter options for querying assessments
 */
export interface AssessmentFilters {
  /** Filter by AI result */
  results?: AssessmentResult[];
  /** Filter by confidence level */
  confidenceLevels?: ConfidenceLevel[];
  /** Filter by discretion tier */
  discretionTiers?: DiscretionTier[];
  /** Filter by sheet name */
  sheets?: string[];
  /** Filter by section name */
  sections?: string[];
  /** Filter by review status (from joined judgment) */
  reviewStatuses?: ReviewStatus[];
  /** Filter to items with action required */
  hasActionRequired?: boolean;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response type for submissions list endpoint
 */
export interface SubmissionsResponse {
  submissions: Submission[];
}

/**
 * Response type for assessments list endpoint with pagination
 */
export interface AssessmentsResponse {
  assessments: Assessment[];
  pagination: {
    total: number;
    offset: number;
    limit: number;
  };
  filtersApplied: AssessmentFilters;
}

/**
 * Response type for progress endpoint
 */
export type ProgressResponse = ReviewProgress;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for creating a new judgment (subset of Judgment fields)
 */
export type CreateJudgment = Pick<
  Judgment,
  | 'assessmentId'
  | 'humanResult'
  | 'humanConfidence'
  | 'judgmentNotes'
  | 'overrideReason'
  | 'routedTo'
  | 'routingReason'
  | 'evidenceSufficiency'
  | 'includeInFinal'
  | 'finalMemoSummary'
  | 'followUpNeeded'
>;

/**
 * Type for updating an existing judgment
 */
export type UpdateJudgment = Partial<
  Pick<
    Judgment,
    | 'humanResult'
    | 'humanConfidence'
    | 'judgmentNotes'
    | 'overrideReason'
    | 'routedTo'
    | 'routingReason'
    | 'evidenceSufficiency'
    | 'includeInFinal'
    | 'finalMemoSummary'
    | 'followUpNeeded'
    | 'reviewStatus'
  >
>;

/**
 * Assessment with required judgment (for review queue views)
 */
export interface AssessmentWithJudgment extends Assessment {
  judgment: Judgment;
}

/**
 * Minimal assessment for list views (performance optimization)
 */
export type AssessmentSummary = Pick<
  Assessment,
  | 'id'
  | 'csapId'
  | 'section'
  | 'sheet'
  | 'itemNumber'
  | 'aiResult'
  | 'aiConfidence'
  | 'discretionTier'
  | 'evidenceCoverage'
  | 'actionRequired'
> & {
  reviewStatus?: ReviewStatus;
};

// ============================================================================
// Interfaces - Matching Rationale (for HITL Baseline Validation)
// ============================================================================

export interface MatchingRationale {
  method: 'hybrid' | 'keyword' | 'ai_fallback' | 'ai_reasoning';
  evaluationType?: 'ai_reasoning' | 'pipeline';
  scores: {
    keyword: number;
    semantic: number;
    structural: number;
    combined: number;
    // AI reasoning scores (when evaluationType === 'ai_reasoning')
    similarity?: number;
    relevance?: number;
    completeness?: number;
  };
  scoreBreakdown: string[];
  policyKeywords: string[];
  keywordsFound: string[];
  keywordsMissing: string[];
  keywordsSource: string;
  aiDetails?: {
    triggered: boolean;
    triggerReason?: string;
    model?: string;
    reasoning?: string;
    confidence?: number;
  };
  crossRefDetails?: {
    boostApplied: boolean;
    boostAmount: number;
    relatedPolicies: string[];
  };
  searchStats: {
    sectionsSearched: number;
    bestSection: string;
    bestScore: number;
    runnerUpScore?: number;
  };
}

export interface PolicyContext {
  policyId: string;
  verbatimText: string;
  discretionTier: DiscretionTier;
  topicCategory: string;
  semanticSentences: {
    intent: string;
    purpose: string;
    function: string;
    evidence: string;
    deficiency: string;
  };
  keywords: string[];
}

export interface MatchingDetail {
  assessmentId: string;
  csapId: string;
  policyContext: PolicyContext;
  evidenceContext: {
    excerpt: string;
    fullContext?: string;
    sourceDocument: string;
    sourceSection: string;
    pageRange: [number, number] | null;
  }[];
  matchingRationale: MatchingRationale;
  engineDetermination: {
    result: AssessmentResult;
    confidence: ConfidenceLevel;
    evidenceCoverage: number;
  };
  validation?: BaselineValidationRecord;
}

export interface BaselineValidationRecord {
  assessment: 'TRUE_POSITIVE' | 'FALSE_POSITIVE' | 'TRUE_NEGATIVE' | 'FALSE_NEGATIVE';
  notes: string;
  reviewerId: string;
  timestamp: string;
}

export interface BaselineValidationStats {
  totalValidated: number;
  breakdown: {
    truePositive: number;
    falsePositive: number;
    trueNegative: number;
    falseNegative: number;
  };
  rates: {
    precision: number;
    recall: number;
    f1Score: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
  };
  byTier: {
    tier1: { fp: number; fn: number; total: number };
    tier2: { fp: number; fn: number; total: number };
    tier3: { fp: number; fn: number; total: number };
  };
}
