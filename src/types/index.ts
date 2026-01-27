/**
 * Central Type Definitions Export
 * Main barrel file for all application types
 * Task 1.1 - Type Safety Foundation
 *
 * Usage:
 * import type { PollResults, ReviewFormData, ApiResponse } from '@/types'
 */

import type { ApiResponse } from './api';

// =============================================================================
// Database Types
// =============================================================================
export type {
  // User
  UserRole,

  // Documents
  Tag,
  Document,

  // Forum
  Discussion,
  DiscussionReply,
  Like,

  // Polls
  Poll,
  PollVote,
  PollResults,
  PollResultItem,

  // Ranking Polls
  RankingPoll,
  RankingVote,
  RankingResults,
  RankingResultItem,

  // Wordcloud Polls
  WordcloudPoll,
  WordcloudVote,
  WordcloudResults,
  WordFrequency,

  // Admin
  Announcement,
  Milestone,

  // Reviews
  ReviewSubmission,
  ReviewFile,

  // Regulatory (SQLite)
  RegulatorySubmission,
  RegulatoryAssessment,
  RegulatoryJudgment,
  ReviewSession,
  BaselineValidation,

  // Derived Types
  PollSummary,
  SubmissionSummary,
  RegulatorySubmissionDetail,
} from './database';

// =============================================================================
// Form Types
// =============================================================================
export type {
  // Review Forms
  ReviewFormData,
  ReviewFormSection,
  ReviewFormField,
  SelectOption,
  FieldValidation,

  // Poll Submissions
  PollSubmitPayload,
  RankingSubmitPayload,
  RankingSubmission,
  WordcloudSubmitPayload,

  // Forum Submissions
  DiscussionCreatePayload,
  DiscussionUpdatePayload,
  DiscussionReplyPayload,
  ReplyUpdatePayload,

  // Document Mgmt
  DocumentCreatePayload,
  DocumentUpdatePayload,
  TagCreatePayload,
  TagUpdatePayload,

  // Admin
  AnnouncementCreatePayload,
  AnnouncementUpdatePayload,
  MilestoneCreatePayload,
  MilestoneUpdatePayload,

  // File Upload
  ReviewFileUploadPayload,
  FileUploadResponse,

  // Regulatory Forms
  AssessmentFormData,
  SubmissionReviewFormData,

  // Form State
  FormState,
  FormValidationResult,
  FormField,
  FormSection,
  FormConfig,

  // Admin
  AdminRoleTogglePayload,
  AdminActionPayload,
} from './forms';

// =============================================================================
// API Types
// =============================================================================
export type {
  // Generic Wrappers
  ApiResponse,
  ApiError,
  ApiMetadata,
  PaginatedResponse,
  PaginationInfo,

  // Poll Endpoints
  GetPollResultsRequest,
  GetPollResultsResponse,
  SubmitPollRequest,
  SubmitPollResponse,
  GetRankingResultsRequest,
  GetRankingResultsResponse,
  SubmitRankingRequest,
  SubmitRankingResponse,
  GetWordcloudResultsRequest,
  GetWordcloudResultsResponse,
  SubmitWordcloudRequest,
  SubmitWordcloudResponse,

  // Discussion Endpoints
  GetDiscussionsRequest,
  GetDiscussionsResponse,
  CreateDiscussionRequest,
  CreateDiscussionResponse,
  GetDiscussionRequest,
  GetDiscussionResponse,
  GetDiscussionRepliesRequest,
  GetDiscussionRepliesResponse,
  CreateReplyRequest,
  CreateReplyResponse,

  // Document Endpoints
  GetDocumentsRequest,
  GetDocumentsResponse,
  CreateDocumentRequest,
  CreateDocumentResponse,
  GetDocumentRequest,
  GetDocumentResponse,
  DeleteDocumentResponse,

  // Tags Endpoints
  GetTagsRequest,
  GetTagsResponse,
  CreateTagRequest,
  CreateTagResponse,

  // Announcements Endpoints
  GetAnnouncementsRequest,
  GetAnnouncementsResponse,
  CreateAnnouncementRequest,
  CreateAnnouncementResponse,

  // Milestones Endpoints
  GetMilestonesRequest,
  GetMilestonesResponse,
  CreateMilestoneRequest,
  CreateMilestoneResponse,

  // Review Endpoints
  SaveReviewRequest,
  SaveReviewResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
  ReviewUploadRequest,
  ReviewUploadResponse,

  // Regulatory Review Endpoints
  GetRegulatorySubmissionsRequest,
  GetRegulatorySubmissionsResponse,
  GetRegulatoryAssessmentsRequest,
  AssessmentFilter,
  GetRegulatoryAssessmentsResponse,
  GetRegulatoryAssessmentDetailRequest,
  GetRegulatoryAssessmentDetailResponse,
  CreateJudgmentRequest,
  CreateJudgmentResponse,
  GetReviewProgressRequest,
  GetReviewProgressResponse,
  GetValidationStatsRequest,
  GetValidationStatsResponse,
  GetMatchingDetailRequest,
  GetMatchingDetailResponse,
  RunAssessmentEngineRequest,
  RunAssessmentEngineResponse,

  // Matrix Endpoints
  GetMatrixDataRequest,
  GetMatrixDataResponse,
  MatrixItem,

  // Auth Endpoints
  AuthCallbackRequest,
  AuthCallbackResponse,

  // Search Endpoints
  SearchRequest,
  SearchResult,
  SearchResponse,

  // Health Endpoints
  HealthCheckResponse,
} from './api';

// =============================================================================
// Re-export review types from existing files (added in Phase 2)
// Note: These imports are available after consolidating existing type files
// =============================================================================
// export type { ... } from '@/app/(dashboard)/twg/review/types';
// export type { ... } from '@/lib/regulatory-review/types';

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Nullable version of any type
 * Usage: Nullable<string> = "hello" | null
 */
export type Nullable<T> = T | null;

/**
 * Optional version of any type (undefined instead of null)
 * Usage: Optional<string> = "hello" | undefined
 */
export type Optional<T> = T | undefined;

/**
 * Async version of function return type
 */
export type Async<T> = Promise<T>;

/**
 * Extract keys that have specific value type
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Make all properties optional (recursively)
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Make all properties readonly (recursively)
 */
export type DeepReadonly<T> = T extends object
  ? {
      readonly [P in keyof T]: DeepReadonly<T[P]>;
    }
  : T;

/**
 * Extract return type from promise
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * Function that may throw error
 */
export type ResultType<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// =============================================================================
// API Helper Types
// =============================================================================

/**
 * Generic async API handler return type
 */
export type ApiHandlerResponse<T = unknown> = Promise<ApiResponse<T>>;

/**
 * Extract the data type from an API response
 */
export type ResponseData<T extends ApiResponse<unknown>> = T extends ApiResponse<infer U>
  ? U
  : never;

/**
 * Query parameters object
 */
export interface QueryParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Request headers object
 */
export interface RequestHeaders {
  [key: string]: string;
}
