/**
 * Poll Results Types
 * Type definitions for poll data structures and results
 * Task 1.4 - Replacing `any` types
 */

// =============================================================================
// Result Item Types
// =============================================================================

export interface PollResultItem {
  option_index: number;
  option_text: string;
  votes: number;
  averageRank?: number;
}

export interface WordcloudItem {
  text: string;
  value: number;
}

// =============================================================================
// Poll Result Types
// =============================================================================

export interface PollResult {
  poll_id?: string;
  ranking_poll_id?: string;
  wordcloud_poll_id?: string;
  page_path: string;
  poll_index: number;
  question: string;
  options?: string[];
  total_votes: number;
  results: PollResultItem[];
  is_ranking?: boolean;
  is_wordcloud?: boolean;
  words?: WordcloudItem[];
  wordcloud_words?: WordcloudItem[];
  combined_survey_votes?: number;
  combined_cew_votes?: number;
  survey_results?: PollResultItem[];
  cew_results?: PollResultItem[];
  max_words?: number;
  word_limit?: number;
  surveyWords?: WordcloudItem[];
  cewWords?: WordcloudItem[];
}

// =============================================================================
// Poll Grouping Types (for combining survey and CEW data)
// =============================================================================

export interface PollGroupEntry {
  surveyPoll?: PollResult;
  cewPoll?: PollResult;
  isRanking: boolean;
  isWordcloud?: boolean;
  question: string;
  poll_index: number;
  options: string[];
}

export interface CombinedPollResults {
  pollGroups: Map<string, PollGroupEntry>;
  allResults: PollResult[];
}

// =============================================================================
// User Vote Types
// =============================================================================

export interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

// =============================================================================
// Matrix Data Types
// =============================================================================

export interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
}

// =============================================================================
// Filter Types
// =============================================================================

export type FilterMode = 'all' | 'twg' | 'cew';

export interface VoteCounts {
  twg: number;
  cew: number;
  total: number;
}

// =============================================================================
// Cache Types
// =============================================================================

export interface CacheEntry {
  data: PollResult[];
  timestamp: number;
}

export interface MatrixCacheEntry {
  data: MatrixData[];
  timestamp: number;
}
