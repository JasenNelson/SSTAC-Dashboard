/**
 * API Module - Central Export
 * Type-safe API client and operations
 * Task 1.3 - API Client Layer
 *
 * Usage:
 * import { getApiClient, getPollWithUserVote } from '@/lib/api'
 */

// Export client classes and functions
export { ApiClient, getApiClient, resetApiClient, ApiClientError } from './client';
export type { ApiClientConfig } from './client';

// Export poll operations
export {
  getPollWithUserVote,
  submitPollVote,
  getRankingPollWithUserVote,
  submitRankingVote,
  getWordcloudResults,
  submitWordcloudWord,
} from './polls';

// Type re-exports for convenience
export type { ApiResponse, ApiError, ApiHandlerResponse } from '@/types';
