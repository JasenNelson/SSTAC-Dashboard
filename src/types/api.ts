/**
 * API Request and Response Types
 * Type-safe contracts for all API endpoints
 * Task 1.1 - Type Safety Foundation
 */

import type {
  Poll,
  PollResults,
  RankingResults,
  WordcloudResults,
  Announcement,
  Milestone,
  Discussion,
  DiscussionReply,
  Document,
  Tag,
  ReviewSubmission,
  RegulatorySubmission,
  RegulatoryAssessment,
  RegulatoryJudgment,
  SubmissionSummary,
} from './database';

import type {
  PollSubmitPayload,
  RankingSubmitPayload,
  WordcloudSubmitPayload,
  DiscussionCreatePayload,
  DiscussionReplyPayload,
  DocumentCreatePayload,
  TagCreatePayload,
  AnnouncementCreatePayload,
  MilestoneCreatePayload,
  ReviewFormData,
} from './forms';

// =============================================================================
// Generic API Response Wrappers
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ApiMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// =============================================================================
// Poll API Endpoints
// =============================================================================

// GET /api/polls/results
export interface GetPollResultsRequest {
  pollId?: string;
  pageContext?: string;
}

export interface GetPollResultsResponse extends ApiResponse<PollResults> {
  userVote?: number | null;
  userOtherText?: string | null;
}

// POST /api/polls/submit
export interface SubmitPollRequest extends PollSubmitPayload {}

export interface SubmitPollResponse extends ApiResponse<{ pollId: string }> {
  success: boolean;
}

// GET /api/ranking-polls/results
export interface GetRankingResultsRequest {
  pollId?: string;
  pageContext?: string;
}

export interface GetRankingResultsResponse extends ApiResponse<RankingResults> {
  userRankings?: number[] | null;
}

// POST /api/ranking-polls/submit
export interface SubmitRankingRequest extends RankingSubmitPayload {}

export interface SubmitRankingResponse extends ApiResponse<{ pollId: string }> {
  success: boolean;
}

// GET /api/wordcloud-polls/results
export interface GetWordcloudResultsRequest {
  pollId?: string;
  pageContext?: string;
}

export interface GetWordcloudResultsResponse extends ApiResponse<WordcloudResults> {}

// POST /api/wordcloud-polls/submit
export interface SubmitWordcloudRequest extends WordcloudSubmitPayload {}

export interface SubmitWordcloudResponse extends ApiResponse<{ pollId: string }> {
  success: boolean;
}

// =============================================================================
// Discussion API Endpoints
// =============================================================================

// GET /api/discussions
export interface GetDiscussionsRequest {
  page?: number;
  pageSize?: number;
  sortBy?: 'newest' | 'popular' | 'mostReplied';
}

export interface GetDiscussionsResponse extends PaginatedResponse<Discussion> {}

// POST /api/discussions
export interface CreateDiscussionRequest extends DiscussionCreatePayload {}

export interface CreateDiscussionResponse extends ApiResponse<Discussion> {}

// GET /api/discussions/[id]
export interface GetDiscussionRequest {
  id: string;
}

export interface GetDiscussionResponse extends ApiResponse<Discussion & { replies: DiscussionReply[] }> {}

// GET /api/discussions/[id]/replies
export interface GetDiscussionRepliesRequest {
  id: string;
  page?: number;
  pageSize?: number;
}

export interface GetDiscussionRepliesResponse extends PaginatedResponse<DiscussionReply> {}

// POST /api/discussions/[id]/replies
export interface CreateReplyRequest extends DiscussionReplyPayload {}

export interface CreateReplyResponse extends ApiResponse<DiscussionReply> {}

// =============================================================================
// Document API Endpoints
// =============================================================================

// GET /api/documents
export interface GetDocumentsRequest {
  tag?: string;
  page?: number;
  pageSize?: number;
}

export interface GetDocumentsResponse extends PaginatedResponse<Document> {}

// POST /api/documents
export interface CreateDocumentRequest extends DocumentCreatePayload {}

export interface CreateDocumentResponse extends ApiResponse<Document> {}

// GET /api/documents/[id]
export interface GetDocumentRequest {
  id: string;
}

export interface GetDocumentResponse extends ApiResponse<Document> {}

// DELETE /api/documents/[id]
export interface DeleteDocumentResponse extends ApiResponse<{ deleted: boolean }> {}

// =============================================================================
// Tags API Endpoints
// =============================================================================

// GET /api/tags
export interface GetTagsRequest {
  search?: string;
}

export interface GetTagsResponse extends ApiResponse<Tag[]> {}

// POST /api/tags
export interface CreateTagRequest extends TagCreatePayload {}

export interface CreateTagResponse extends ApiResponse<Tag> {}

// =============================================================================
// Announcements API Endpoints
// =============================================================================

// GET /api/announcements
export interface GetAnnouncementsRequest {
  activeOnly?: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface GetAnnouncementsResponse extends ApiResponse<Announcement[]> {}

// POST /api/announcements (Admin only)
export interface CreateAnnouncementRequest extends AnnouncementCreatePayload {}

export interface CreateAnnouncementResponse extends ApiResponse<Announcement> {}

// =============================================================================
// Milestones API Endpoints
// =============================================================================

// GET /api/milestones
export interface GetMilestonesRequest {
  status?: 'active' | 'completed' | 'deferred';
  sortBy?: 'date' | 'priority';
}

export interface GetMilestonesResponse extends ApiResponse<Milestone[]> {}

// POST /api/milestones (Admin only)
export interface CreateMilestoneRequest extends MilestoneCreatePayload {}

export interface CreateMilestoneResponse extends ApiResponse<Milestone> {}

// =============================================================================
// Review Submission API Endpoints
// =============================================================================

// POST /api/review/save
export interface SaveReviewRequest {
  formData: ReviewFormData;
  submissionId?: string;
}

export interface SaveReviewResponse extends ApiResponse<ReviewSubmission> {
  success: boolean;
  submission: ReviewSubmission;
}

// POST /api/review/submit
export interface SubmitReviewRequest {
  submissionId: string;
  formData: ReviewFormData;
}

export interface SubmitReviewResponse extends ApiResponse<ReviewSubmission> {
  success: boolean;
}

// POST /api/review/upload
export interface ReviewUploadRequest {
  submissionId: string;
  file: FormData; // Contains File object
  fileType: 'document' | 'evidence' | 'attachment';
}

export interface ReviewUploadResponse extends ApiResponse<{
  fileId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}> {}

// =============================================================================
// Regulatory Review API Endpoints (SQLite)
// =============================================================================

// GET /api/regulatory-review/submissions
export interface GetRegulatorySubmissionsRequest {
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'title' | 'status';
}

export interface GetRegulatorySubmissionsResponse extends ApiResponse<RegulatorySubmission[]> {
  summary: SubmissionSummary;
}

// GET /api/regulatory-review/assessments
export interface GetRegulatoryAssessmentsRequest {
  submissionId?: string;
  page?: number;
  pageSize?: number;
  filter?: AssessmentFilter;
}

export interface AssessmentFilter {
  result?: 'pass' | 'partial' | 'fail' | 'requires_judgment';
  discretionTier?: 1 | 2 | 3;
  requiresHumanReview?: boolean;
  section?: string;
}

export interface GetRegulatoryAssessmentsResponse extends PaginatedResponse<RegulatoryAssessment> {
  filtersApplied?: AssessmentFilter;
  summary?: {
    total: number;
    pass: number;
    partial: number;
    fail: number;
    requiresJudgment: number;
  };
}

// GET /api/regulatory-review/assessments/[csapId]
export interface GetRegulatoryAssessmentDetailRequest {
  csapId: string;
}

export interface GetRegulatoryAssessmentDetailResponse extends ApiResponse<RegulatoryAssessment & {
  judgment?: RegulatoryJudgment;
  relatedAssessments?: RegulatoryAssessment[];
}> {}

// POST /api/regulatory-review/judgments
export interface CreateJudgmentRequest {
  assessmentId: string;
  humanResult: 'pass' | 'partial' | 'fail';
  humanConfidence: number;
  judgmentNotes: string;
  overrideReason?: string;
  routeTo?: string;
  routingReason?: string;
}

export interface CreateJudgmentResponse extends ApiResponse<RegulatoryJudgment> {}

// GET /api/regulatory-review/progress
export interface GetReviewProgressRequest {
  submissionId: string;
}

export interface GetReviewProgressResponse extends ApiResponse<{
  total: number;
  reviewed: number;
  pending: number;
  percentage: number;
  estimatedTimeRemaining?: number; // minutes
}> {}

// GET /api/regulatory-review/validation-stats
export interface GetValidationStatsRequest {
  submissionId: string;
  validationType?: string;
}

export interface GetValidationStatsResponse extends ApiResponse<{
  total: number;
  passed: number;
  failed: number;
  notes: Record<string, unknown>;
}> {}

// GET /api/regulatory-review/matching-detail
export interface GetMatchingDetailRequest {
  assessmentId: string;
}

export interface GetMatchingDetailResponse extends ApiResponse<{
  csapId: string;
  keywordsMatched: string[];
  sectionsSearched: string[];
  relevantPolicies: string[];
  matchingScore: number;
  evidence: Record<string, unknown>;
}> {}

// POST /api/regulatory-review/run-engine
export interface RunAssessmentEngineRequest {
  submissionId: string;
  options?: {
    reFlagItems?: boolean;
    recalculateAll?: boolean;
  };
}

export interface RunAssessmentEngineResponse extends ApiResponse<{
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress?: number;
  estimatedTime?: number; // seconds
}> {}

// =============================================================================
// Matrix/Prioritization API Endpoints
// =============================================================================

export interface GetMatrixDataRequest {
  pageContext?: string;
  includeRankings?: boolean;
}

export interface GetMatrixDataResponse extends ApiResponse<{
  xAxis: string; // Axis label
  yAxis: string; // Axis label
  items: MatrixItem[];
  scaling?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}> {}

export interface MatrixItem {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
}

// =============================================================================
// Auth API Endpoints
// =============================================================================

export interface AuthCallbackRequest {
  code: string;
  state: string;
}

export interface AuthCallbackResponse extends ApiResponse<{
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}> {}

// =============================================================================
// Search API Endpoints (Optional)
// =============================================================================

export interface SearchRequest {
  query: string;
  category?: 'documents' | 'discussions' | 'assessments';
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: 'document' | 'discussion' | 'assessment';
  title: string;
  excerpt?: string;
  url: string;
  score: number;
}

export interface SearchResponse extends ApiResponse<SearchResult[]> {}

// =============================================================================
// Health Check & System Endpoints
// =============================================================================

export interface HealthCheckResponse extends ApiResponse<{
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: 'healthy' | 'down';
    redis: 'healthy' | 'down';
    storage: 'healthy' | 'down';
  };
}> {}
