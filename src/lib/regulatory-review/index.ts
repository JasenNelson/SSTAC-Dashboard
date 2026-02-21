/**
 * Regulatory Review Module
 *
 * Exports all types, validation schemas, and tier logic for the
 * SSTAC-Dashboard regulatory review feature.
 */

// Types and Interfaces
export {
  // Enums
  AssessmentResult,
  ConfidenceLevel,
  DiscretionTier,
  EvidenceType,
  EvidenceSufficiency,
  HumanResult,
  ReviewStatus,
  // Interfaces
  type Assessment,
  type AssessmentFilters,
  type AssessmentsResponse,
  type AssessmentSummary,
  type AssessmentWithJudgment,
  type CreateJudgment,
  type EvidenceItem,
  type Judgment,
  type ProgressResponse,
  type ReviewProgress,
  type Submission,
  type SubmissionsResponse,
  type UpdateJudgment,
} from './types';

// Validation Schemas and Helpers
export {
  // Enum schemas
  assessmentResultSchema,
  confidenceLevelSchema,
  discretionTierSchema,
  humanResultSchema,
  evidenceSufficiencySchema,
  reviewStatusSchema,
  // Main schemas
  assessmentFilterSchema,
  createJudgmentSchema,
  exportOptionsSchema,
  submissionQuerySchema,
  updateJudgmentSchema,
  // Inferred types
  type AssessmentFilterInput,
  type CreateJudgmentInput,
  type ExportOptionsInput,
  type SubmissionQueryInput,
  type UpdateJudgmentInput,
  // Helper functions
  parseAssessmentFilters,
  parseCreateJudgment,
  parseExportOptions,
  parseUpdateJudgment,
} from './validation';

// Tier Logic
export {
  // Human review determination
  requiresHumanReview,
  getRoutingTarget,
  getRoutingReason,
  // Allowed actions
  getAllowedActionsByTier,
  type AllowedActions,
  // Validation
  validateJudgmentAgainstTier,
  validateAssessmentJudgment,
  type TierValidationResult,
  // Indigenous content detection
  detectIndigenousContent,
  // Utility functions
  formatTierName,
  getTierColor,
  getResultColor,
  getConfidenceColor,
  calculateReviewPriority,
  sortByReviewPriority,
} from './tier-logic';

// Memo Generation
export {
  // Generation functions
  generateMarkdown,
  generateHTML,
  generatePreview,
  // Statistics
  calculateStats,
  filterAssessments,
  // Export helpers
  downloadContent,
  copyToClipboard,
  // Types
  type LocalAssessment,
  type LocalJudgment,
  type ExportOptions,
  type MemoData,
  type MemoStats,
} from './memo-generator';
