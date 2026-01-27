/**
 * Form and Form Data Types
 * Structured types for all form submissions in the application
 * Task 1.1 - Type Safety Foundation
 */

// =============================================================================
// TWG Review Form Types (Phase 1 & Phase 2 Sections)
// =============================================================================

/**
 * Review Form Data - Replaces the untyped `any` in ReviewSubmission.form_data
 * Structured to handle both Phase 1 and Phase 2 review sections
 */
export interface ReviewFormData {
  phase: 'Phase 1 Review' | 'Phase 2 Review';
  sections: ReviewFormSection[];
  metadata?: {
    lastSaved?: string;
    version: number;
  };
}

export interface ReviewFormSection {
  id: string;
  title: string;
  description: string;
  fields: ReviewFormField[];
  completed: boolean;
  validationErrors?: string[];
}

export interface ReviewFormField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'rating' | 'date';
  label: string;
  value: string | number | boolean | string[] | null;
  required: boolean;
  placeholder?: string;
  options?: SelectOption[]; // For select, radio, checkbox fields
  validation?: FieldValidation;
  error?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  custom?: (value: unknown) => boolean | string;
}

// =============================================================================
// Poll Submission Types
// =============================================================================

export interface PollSubmitPayload {
  pollId: string;
  optionIndex: number;
  otherText?: string;
  pageContext?: string;
}

export interface RankingSubmitPayload {
  pollId: string;
  rankings: RankingSubmission[]; // array of {optionIndex, rank}
  pageContext?: string;
}

export interface RankingSubmission {
  optionIndex: number;
  rank: number;
}

export interface WordcloudSubmitPayload {
  pollId: string;
  words: string[];
  pageContext?: string;
}

// =============================================================================
// Forum Submission Types
// =============================================================================

export interface DiscussionCreatePayload {
  title: string;
  content: string;
  tags?: string[]; // Optional topic tags
}

export interface DiscussionUpdatePayload {
  title?: string;
  content?: string;
}

export interface DiscussionReplyPayload {
  content: string;
  discussionId: string;
}

export interface ReplyUpdatePayload {
  content: string;
}

// =============================================================================
// Document Management Types
// =============================================================================

export interface DocumentCreatePayload {
  title: string;
  description?: string;
  file: File;
  tag?: string;
}

export interface DocumentUpdatePayload {
  title?: string;
  description?: string;
  tag?: string;
}

export interface TagCreatePayload {
  name: string;
  color: string;
}

export interface TagUpdatePayload {
  name?: string;
  color?: string;
}

// =============================================================================
// Announcement & Milestone Types
// =============================================================================

export interface AnnouncementCreatePayload {
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  isActive: boolean;
}

export interface AnnouncementUpdatePayload {
  title?: string;
  content?: string;
  priority?: 'low' | 'medium' | 'high';
  isActive?: boolean;
}

export interface MilestoneCreatePayload {
  title: string;
  description?: string;
  targetDate?: string; // ISO date string
  status: 'active' | 'completed' | 'deferred';
  priority: 'low' | 'medium' | 'high';
}

export interface MilestoneUpdatePayload {
  title?: string;
  description?: string;
  targetDate?: string;
  status?: 'active' | 'completed' | 'deferred';
  priority?: 'low' | 'medium' | 'high';
}

// =============================================================================
// Review File Upload Types
// =============================================================================

export interface ReviewFileUploadPayload {
  submissionId: string;
  file: File;
  fileType: 'document' | 'evidence' | 'attachment';
}

export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

// =============================================================================
// Regulatory Review Form Types (SQLite-based)
// =============================================================================

export interface AssessmentFormData {
  assessmentId: string;
  csapId: string;
  csapText: string;
  section: string;
  item: string;

  // AI Assessment Result
  aiResult: 'pass' | 'partial' | 'fail' | 'requires_judgment';
  aiConfidence: number; // 0-1

  // Human Judgment (Optional)
  humanResult?: 'pass' | 'partial' | 'fail';
  humanConfidence?: number; // 0-1
  judgmentNotes?: string;

  // Evidence
  evidenceFound?: Record<string, unknown>; // JSON
  keywordsMatched?: string[];
  sectionsSearched?: string[];

  // Discretion & Routing
  discretionTier: 1 | 2 | 3;
  requiresHumanReview: boolean;
  routeTo?: string;
  routingReason?: string;
  overrideReason?: string;

  // Validation
  evidenceCoverage: number; // 0-1
  actionRequired: boolean;
  validationNotes?: string;

  // Metadata
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SubmissionReviewFormData {
  submissionId: string;
  siteId: string;
  submissionType: 'DSI' | 'NRC' | 'Other';
  checklistSource: string;
  totalItems: number;

  // Review Session Info
  sessionStart: string;
  reviewerNotes?: string;

  // Assessment Summaries
  itemsReviewed: number;
  itemsAccepted: number;
  itemsOverridden: number;
  itemsDeferred: number;

  // Pass/Fail Counts
  passCount: number;
  failCount: number;
  partialCount: number;
  requiresJudgmentCount: number;

  // Coverage Analysis
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  overallCoverage: number;

  // Baseline Validation
  baselineValidationType?: string;
  baselineNotes?: string;

  // Overall Assessment
  overallRecommendation?: string;
  requiresHumanReview: boolean;
}

// =============================================================================
// Form State Types (for Components & Hooks)
// =============================================================================

export interface FormState<T> {
  data: T;
  isDirty: boolean;
  isSubmitting: boolean;
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface FormField<T> {
  name: keyof T;
  value: unknown;
  error?: string;
  touched: boolean;
  isDirty: boolean;
}

// =============================================================================
// Generic Form Types
// =============================================================================

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField<unknown>[];
}

export interface FormConfig {
  sections: FormSection[];
  submitLabel?: string;
  cancelLabel?: string;
  autoSave?: boolean;
  autoSaveInterval?: number; // milliseconds
}

// =============================================================================
// Admin Form Types
// =============================================================================

export interface AdminRoleTogglePayload {
  userId: string;
  role: 'admin' | 'user' | 'reviewer' | 'moderator';
  action: 'add' | 'remove';
}

export interface AdminActionPayload {
  action: string;
  targetId: string;
  data?: Record<string, unknown>;
}
