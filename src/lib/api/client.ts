/**
 * Supabase API Client Wrapper
 * Centralized, typed wrapper around Supabase client
 * Task 1.3 - API Client Layer
 *
 * Usage:
 * const { data, error } = await apiClient.getPollResults(pollId)
 */

import { createAuthenticatedClient } from '@/lib/supabase-auth';
import type {
  ApiResponse as _ApiResponse,
  ApiError,
} from '@/types';

// Re-export to suppress unused import warning (type is used by consumers)
export type { _ApiResponse as ApiResponse };

// =============================================================================
// Client Configuration
// =============================================================================

export interface ApiClientConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableLogging?: boolean;
}

const DEFAULT_CONFIG: ApiClientConfig = {
  timeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000,
  enableLogging: process.env.NODE_ENV === 'development',
};

// =============================================================================
// Error Types
// =============================================================================

interface ApiErrorResponse {
  status?: number;
  statusCode?: number;
  code?: string;
  name?: string;
  message?: string;
  error_description?: string;
}

// =============================================================================
// Error Handling
// =============================================================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'UNKNOWN_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiClientError';
  }

  toApiError(): ApiError {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// =============================================================================
// API Client Class
// =============================================================================

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a database query with error handling and retry logic
   */
  private async executeQuery<T>(
    operation: () => Promise<{ data: T | null; error: ApiErrorResponse | null }>,
    operationName: string
  ): Promise<{ data: T | null; error: ApiErrorResponse | null }> {
    let lastError: ApiErrorResponse | null = null;

    for (let attempt = 0; attempt <= (this.config.retryAttempts || 0); attempt++) {
      try {
        if (attempt > 0) {
          this.log(`Retry ${attempt}/${this.config.retryAttempts} for ${operationName}`);
          await new Promise(resolve =>
            setTimeout(resolve, (this.config.retryDelay || 1000) * attempt)
          );
        }

        const result = await Promise.race([
          operation(),
          this.createTimeout(this.config.timeout || 30000),
        ]);

        if (result.error && !this.isRetryableError(result.error)) {
          // Non-retryable error, throw immediately
          throw result.error;
        }

        if (!result.error) {
          this.log(`✓ ${operationName} succeeded`);
          return result;
        }

        lastError = result.error as ApiErrorResponse | null;
      } catch (error: unknown) {
        lastError = error as ApiErrorResponse;

        if (attempt === (this.config.retryAttempts || 0)) {
          this.error(`✗ ${operationName} failed after ${attempt + 1} attempts`, error);
          throw new ApiClientError(
            this.getErrorMessage(error),
            this.getStatusCode(error),
            this.getErrorCode(error)
          );
        }
      }
    }

    return { data: null, error: lastError };
  }

  /**
   * Timeout helper
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: ApiErrorResponse): boolean {
    if (!error) return false;

    // Retryable status codes
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    if (error.status && retryableStatuses.includes(error.status)) {
      return true;
    }

    // Network errors
    if (
      error.message?.includes('network') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract error details
   */
  private getErrorMessage(error: ApiErrorResponse | unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return (error.message as string) || 'Unknown error occurred';
    }
    if (error && typeof error === 'object' && 'error_description' in error) {
      return (error.error_description as string) || 'Unknown error occurred';
    }
    return 'Unknown error occurred';
  }

  private getStatusCode(error: ApiErrorResponse | unknown): number {
    if (typeof error === 'object' && error !== null) {
      if ('status' in error) return (error.status as number) || 500;
      if ('statusCode' in error) return (error.statusCode as number) || 500;
    }
    return 500;
  }

  private getErrorCode(error: ApiErrorResponse | unknown): string {
    if (typeof error === 'object' && error !== null) {
      if ('code' in error) return (error.code as string) || 'UNKNOWN_ERROR';
      if ('name' in error) return (error.name as string) || 'UNKNOWN_ERROR';
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Logging utilities
   */
  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[API Client] ${message}`);
    }
  }

  private error(message: string, error?: unknown): void {
    if (this.config.enableLogging) {
      console.error(`[API Client] ${message}`, error);
    }
  }

  // =============================================================================
  // Public API Methods - Polls
  // =============================================================================

  async getPollData(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('polls')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getPollData(${pagePath}, ${pollIndex})`
    );
  }

  async getPollResults(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('poll_results')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getPollResults(${pagePath}, ${pollIndex})`
    );
  }

  async getUserPollVote(pollId: string, userId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('poll_votes')
          .select('*')
          .eq('poll_id', pollId)
          .eq('user_id', userId)
          .single(),
      `getUserPollVote(${pollId}, ${userId})`
    );
  }

  async submitPollVote(
    pollId: string,
    userId: string | null,
    optionIndex: number,
    otherText?: string
  ) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase.from('poll_votes').insert({
          poll_id: pollId,
          user_id: userId,
          option_index: optionIndex,
          other_text: otherText || null,
          voted_at: new Date().toISOString(),
        }),
      `submitPollVote(${pollId}, option=${optionIndex})`
    );
  }

  // =============================================================================
  // Public API Methods - Ranking Polls
  // =============================================================================

  async getRankingPollData(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('ranking_polls')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getRankingPollData(${pagePath}, ${pollIndex})`
    );
  }

  async getRankingResults(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('ranking_results')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getRankingResults(${pagePath}, ${pollIndex})`
    );
  }

  async submitRankingVote(pollId: string, userId: string | null, rankings: Array<{ optionIndex: number; rank: number }>) {
    const supabase = await createAuthenticatedClient();

    // Insert multiple ranking votes
    const votes = rankings.map(({ optionIndex, rank }) => ({
      ranking_poll_id: pollId,
      user_id: userId,
      option_index: optionIndex,
      rank,
      voted_at: new Date().toISOString(),
    }));

    return this.executeQuery(
      async () => supabase.from('ranking_votes').insert(votes),
      `submitRankingVotes(${pollId}, ${rankings.length} items)`
    );
  }

  // =============================================================================
  // Public API Methods - Wordcloud Polls
  // =============================================================================

  async getWordcloudPollData(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('wordcloud_polls')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getWordcloudPollData(${pagePath}, ${pollIndex})`
    );
  }

  async getWordcloudResults(pagePath: string, pollIndex: number) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('wordcloud_results')
          .select('*')
          .eq('page_path', pagePath)
          .eq('poll_index', pollIndex)
          .single(),
      `getWordcloudResults(${pagePath}, ${pollIndex})`
    );
  }

  async submitWordcloudVote(pollId: string, userId: string | null, word: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase.from('wordcloud_votes').insert({
          poll_id: pollId,
          user_id: userId,
          word,
          submitted_at: new Date().toISOString(),
        }),
      `submitWordcloudVote(${pollId}, word=${word})`
    );
  }

  // =============================================================================
  // Public API Methods - Forum
  // =============================================================================

  async getDiscussions(limit: number = 20, offset: number = 0) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('discussions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1),
      `getDiscussions(limit=${limit}, offset=${offset})`
    );
  }

  async getDiscussionById(discussionId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('discussions')
          .select('*')
          .eq('id', discussionId)
          .single(),
      `getDiscussionById(${discussionId})`
    );
  }

  async createDiscussion(title: string, content: string, userId: string, userEmail: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase.from('discussions').insert({
          title,
          content,
          user_id: userId,
          user_email: userEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      `createDiscussion(${title})`
    );
  }

  async getDiscussionReplies(discussionId: string, limit: number = 50, offset: number = 0) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('discussion_replies')
          .select('*')
          .eq('discussion_id', discussionId)
          .order('created_at', { ascending: true })
          .range(offset, offset + limit - 1),
      `getDiscussionReplies(${discussionId})`
    );
  }

  async createDiscussionReply(discussionId: string, content: string, userId: string, userEmail: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase.from('discussion_replies').insert({
          discussion_id: discussionId,
          content,
          user_id: userId,
          user_email: userEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      `createDiscussionReply(${discussionId})`
    );
  }

  // =============================================================================
  // Public API Methods - Documents
  // =============================================================================

  async getDocuments(limit: number = 100, offset: number = 0, tag?: string) {
    const supabase = await createAuthenticatedClient();
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (tag) {
      query = query.eq('tag', tag);
    }

    return this.executeQuery(
      async () => query.range(offset, offset + limit - 1),
      `getDocuments(tag=${tag}, limit=${limit})`
    );
  }

  async getDocumentById(documentId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single(),
      `getDocumentById(${documentId})`
    );
  }

  // =============================================================================
  // Public API Methods - Tags
  // =============================================================================

  async getTags() {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () => supabase.from('tags').select('*').order('name', { ascending: true }),
      'getTags()'
    );
  }

  async createTag(name: string, color: string, userId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase.from('tags').insert({
          name,
          color,
          created_by: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      `createTag(${name})`
    );
  }

  // =============================================================================
  // Public API Methods - Announcements & Milestones
  // =============================================================================

  async getAnnouncements() {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
      'getAnnouncements()'
    );
  }

  async getMilestones() {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('milestones')
          .select('*')
          .in('status', ['active', 'completed'])
          .order('target_date', { ascending: true }),
      'getMilestones()'
    );
  }

  // =============================================================================
  // Public API Methods - Reviews
  // =============================================================================

  async getReviewSubmission(submissionId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('review_submissions')
          .select('*')
          .eq('id', submissionId)
          .single(),
      `getReviewSubmission(${submissionId})`
    );
  }

  async saveReviewSubmission(
    userId: string,
    formData: Record<string, unknown>,
    submissionId?: string
  ) {
    const supabase = await createAuthenticatedClient();

    if (submissionId) {
      return this.executeQuery(
        async () =>
          supabase
            .from('review_submissions')
            .update({
              form_data: formData,
              updated_at: new Date().toISOString(),
            })
            .eq('id', submissionId),
        `saveReviewSubmission(${submissionId})`
      );
    }

    return this.executeQuery(
      async () =>
        supabase.from('review_submissions').insert({
          user_id: userId,
          status: 'draft',
          form_data: formData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      'createReviewSubmission()'
    );
  }

  async submitReviewSubmission(submissionId: string) {
    const supabase = await createAuthenticatedClient();
    return this.executeQuery(
      async () =>
        supabase
          .from('review_submissions')
          .update({
            status: 'submitted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', submissionId),
      `submitReviewSubmission(${submissionId})`
    );
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let apiClientInstance: ApiClient | null = null;

/**
 * Get or create API client singleton
 */
export function getApiClient(config?: Partial<ApiClientConfig>): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new ApiClient(config);
  }
  return apiClientInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetApiClient(): void {
  apiClientInstance = null;
}
