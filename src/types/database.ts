/**
 * Database Model Types
 * Auto-generated types that mirror Supabase PostgreSQL schema
 * Generated: Task 1.1 - Type Safety Foundation
 */

import type { ReviewFormData } from './forms';

// =============================================================================
// User Management Types
// =============================================================================

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user' | 'reviewer' | 'moderator';
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Document Management Types
// =============================================================================

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  tag: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Forum System Types
// =============================================================================

export interface Discussion {
  id: string;
  title: string;
  content: string;
  user_id: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface DiscussionReply {
  id: string;
  discussion_id: string;
  content: string;
  user_id: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface Like {
  id: string;
  user_id: string;
  discussion_id: string | null;
  reply_id: string | null;
  created_at: string;
}

// =============================================================================
// Polling System Types
// =============================================================================

export interface Poll {
  id: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[]; // JSONB array
  total_votes: number;
  created_at: string;
  updated_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string | null;
  option_index: number;
  other_text: string | null;
  voted_at: string;
}

export interface PollResults {
  page_path: string;
  poll_index: number;
  question: string;
  total_votes: number;
  results: PollResultItem[];
}

export interface PollResultItem {
  option_index: number;
  option_text: string;
  votes: number;
  percentage: number;
}

// =============================================================================
// Ranking Poll Types
// =============================================================================

export interface RankingPoll {
  id: string;
  page_path: string;
  poll_index: number;
  question: string;
  options: string[]; // JSONB array
  total_votes: number;
  created_at: string;
  updated_at: string;
}

export interface RankingVote {
  id: string;
  ranking_poll_id: string;
  user_id: string | null;
  option_index: number;
  rank: number;
  voted_at: string;
}

export interface RankingResults {
  page_path: string;
  poll_index: number;
  question: string;
  total_votes: number;
  results: RankingResultItem[];
}

export interface RankingResultItem {
  option_index: number;
  option_text: string;
  average_rank: number;
  min_rank: number;
  max_rank: number;
  vote_count: number;
}

// =============================================================================
// Wordcloud Poll Types
// =============================================================================

export interface WordcloudPoll {
  id: string;
  page_path: string;
  poll_index: number;
  question: string;
  max_words: number;
  word_limit: number;
  created_at: string;
  updated_at: string;
}

export interface WordcloudVote {
  id: string;
  poll_id: string;
  user_id: string | null;
  word: string;
  submitted_at: string;
}

export interface WordcloudResults {
  page_path: string;
  poll_index: number;
  question: string;
  total_votes: number;
  words: WordFrequency[];
  user_words: string[] | null;
}

export interface WordFrequency {
  text: string;
  value: number;
  percentage: number;
}

// =============================================================================
// Admin Support Types
// =============================================================================

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'active' | 'completed' | 'deferred';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TWG Review Submission Types
// =============================================================================

export interface ReviewSubmission {
  id: string;
  user_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  form_data: ReviewFormData; // Typed JSONB
  created_at: string;
  updated_at: string;
}

export interface ReviewFile {
  id: string;
  submission_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

// =============================================================================
// Regulatory Review Types (SQLite)
// =============================================================================

export interface RegulatorySubmission {
  id: string;
  submission_id: string; // e.g., "DSI-2025-001"
  site_id: string;
  submission_type: 'DSI' | 'NRC' | 'Other';
  checklist_source: string;
  total_items: number;
  evaluation_started: string | null;
  evaluation_completed: string | null;
  overall_recommendation: string | null;
  requires_human_review: boolean;
  imported_at: string;
  pass_count: number;
  partial_count: number;
  fail_count: number;
  requires_judgment_count: number;
  tier1_count: number;
  tier2_count: number;
  tier3_count: number;
  overall_coverage: number;
}

export interface RegulatoryAssessment {
  id: string;
  submission_id: string;
  csap_id: string;
  csap_text: string;
  section: string;
  sheet: string;
  item_number: string;
  ai_result: 'pass' | 'partial' | 'fail' | 'requires_judgment';
  ai_confidence: number; // 0-1
  discretion_tier: 1 | 2 | 3;
  evidence_coverage: number; // 0-1
  regulatory_authority: string | null;
  linked_policies: string[] | null; // JSON array
  reviewer_notes: string | null;
  action_required: boolean;
  evidence_found: Record<string, unknown> | null; // JSON object
  keywords_matched: string[] | null; // JSON array
  sections_searched: string[] | null; // JSON array
}

export interface RegulatoryJudgment {
  id: string;
  assessment_id: string;
  human_result: 'pass' | 'partial' | 'fail';
  human_confidence: number; // 0-1
  judgment_notes: string;
  override_reason: string | null;
  routed_to: string | null;
  routing_reason: string | null;
  reviewer_id: string;
  reviewer_name: string;
  reviewed_at: string;
  review_status: 'pending' | 'approved' | 'deferred';
}

export interface ReviewSession {
  id: string;
  submission_id: string;
  reviewer_id: string;
  session_start: string;
  session_end: string | null;
  items_reviewed: number;
  items_accepted: number;
  items_overridden: number;
  items_deferred: number;
  session_notes: string | null;
}

export interface BaselineValidation {
  id: string;
  assessment_id: string;
  validation_type: string;
  notes: string;
  reviewer_id: string;
  timestamp: string;
}

// =============================================================================
// Derived/Computed Types (Views & Aggregations)
// =============================================================================

export interface PollSummary {
  total_polls: number;
  total_votes: number;
  poll_by_page: Record<string, number>;
  active_pages: string[];
}

export interface SubmissionSummary {
  totalSubmissions: number;
  totalAssessments: number;
  totalReviewed: number;
  totalPending: number;
  passCount: number;
  failCount: number;
}

export interface RegulatorySubmissionDetail extends RegulatorySubmission {
  assessments: RegulatoryAssessment[];
  judgments: RegulatoryJudgment[];
  reviewProgress: {
    total: number;
    completed: number;
    percentage: number;
  };
}
