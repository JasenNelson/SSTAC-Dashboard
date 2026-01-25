/**
 * Poll API Operations
 * Type-safe wrapper for poll-related database operations
 * Task 1.3 - API Client Layer
 */

import { getApiClient } from './client';
import type {
  PollResults,
  RankingResults,
  WordcloudResults,
  SubmitPollResponse,
} from '@/types';

// =============================================================================
// Poll Operations
// =============================================================================

/**
 * Get poll results with user's vote
 */
export async function getPollWithUserVote(
  pagePath: string,
  pollIndex: number,
  userId?: string
): Promise<{
  results: PollResults | null;
  userVote?: number | null;
  userOtherText?: string | null;
  error?: Error;
}> {
  const client = getApiClient();

  try {
    const { data: pollData, error: pollError } = await client.getPollData(pagePath, pollIndex);

    if (pollError && pollError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch poll: ${pollError.message}`);
    }

    if (!pollData) {
      return { results: null };
    }

    // Get aggregated results
    const { data: resultsData, error: resultsError } = await client.getPollResults(pagePath, pollIndex);

    if (resultsError && resultsError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch poll results: ${resultsError.message}`);
    }

    if (!resultsData) {
      return { results: null };
    }

    // Get user's vote if authenticated
    let userVote: number | null = null;
    let userOtherText: string | null = null;

    if (userId) {
      const { data: userVoteData } = await client.getUserPollVote(
        (pollData as any).id,
        userId
      );
      if (userVoteData) {
        userVote = (userVoteData as any).option_index;
        userOtherText = (userVoteData as any).other_text;
      }
    }

    return {
      results: resultsData as PollResults,
      userVote,
      userOtherText,
    };
  } catch (error) {
    return {
      results: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Submit a poll vote
 */
export async function submitPollVote(
  pagePath: string,
  pollIndex: number,
  optionIndex: number,
  userId: string | null = null,
  otherText?: string
): Promise<SubmitPollResponse> {
  const client = getApiClient();

  try {
    // Get poll to find ID
    const { data: pollData, error: pollError } = await client.getPollData(pagePath, pollIndex);

    if (pollError || !pollData) {
      throw new Error('Poll not found');
    }

    // Submit vote
    const { error: submitError } = await client.submitPollVote(
      (pollData as any).id,
      userId,
      optionIndex,
      otherText
    );

    if (submitError) {
      throw new Error(`Failed to submit vote: ${submitError.message}`);
    }

    return { success: true, data: { pollId: (pollData as any).id } };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'POLL_SUBMIT_FAILED',
        message: error instanceof Error ? error.message : 'Failed to submit poll vote',
        statusCode: 500,
      },
    };
  }
}

// =============================================================================
// Ranking Poll Operations
// =============================================================================

/**
 * Get ranking poll results with user's rankings
 */
export async function getRankingPollWithUserVote(
  pagePath: string,
  pollIndex: number,
  userId?: string
): Promise<{
  results: RankingResults | null;
  userRankings?: Array<{ optionIndex: number; rank: number }> | null;
  error?: Error;
}> {
  const client = getApiClient();

  try {
    const { data: pollData, error: pollError } = await client.getRankingPollData(pagePath, pollIndex);

    if (pollError && pollError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch ranking poll: ${pollError.message}`);
    }

    if (!pollData) {
      return { results: null };
    }

    // Get aggregated results
    const { data: resultsData, error: resultsError } = await client.getRankingResults(pagePath, pollIndex);

    if (resultsError && resultsError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch ranking results: ${resultsError.message}`);
    }

    if (!resultsData) {
      return { results: null };
    }

    return {
      results: resultsData as RankingResults,
    };
  } catch (error) {
    return {
      results: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Submit ranking votes
 */
export async function submitRankingVote(
  pagePath: string,
  pollIndex: number,
  rankings: Array<{ optionIndex: number; rank: number }>,
  userId: string | null = null
): Promise<{ success: boolean; error?: any }> {
  const client = getApiClient();

  try {
    // Get poll to find ID
    const { data: pollData, error: pollError } = await client.getRankingPollData(pagePath, pollIndex);

    if (pollError || !pollData) {
      throw new Error('Ranking poll not found');
    }

    // Submit rankings
    const { error: submitError } = await client.submitRankingVote((pollData as any).id, userId, rankings);

    if (submitError) {
      throw new Error(`Failed to submit rankings: ${submitError.message}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit rankings',
    };
  }
}

// =============================================================================
// Wordcloud Poll Operations
// =============================================================================

/**
 * Get wordcloud poll results
 */
export async function getWordcloudResults(
  pagePath: string,
  pollIndex: number
): Promise<{
  results: WordcloudResults | null;
  error?: Error;
}> {
  const client = getApiClient();

  try {
    const { data: pollData, error: pollError } = await client.getWordcloudPollData(pagePath, pollIndex);

    if (pollError && pollError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch wordcloud poll: ${pollError.message}`);
    }

    if (!pollData) {
      return { results: null };
    }

    // Get aggregated results
    const { data: resultsData, error: resultsError } = await client.getWordcloudResults(pagePath, pollIndex);

    if (resultsError && resultsError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch wordcloud results: ${resultsError.message}`);
    }

    if (!resultsData) {
      return { results: null };
    }

    return {
      results: resultsData as WordcloudResults,
    };
  } catch (error) {
    return {
      results: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Submit wordcloud word
 */
export async function submitWordcloudWord(
  pagePath: string,
  pollIndex: number,
  word: string,
  userId: string | null = null
): Promise<{ success: boolean; error?: string }> {
  const client = getApiClient();

  try {
    // Validate word
    if (!word || word.trim().length === 0) {
      throw new Error('Word cannot be empty');
    }

    if (word.length > 100) {
      throw new Error('Word must be less than 100 characters');
    }

    // Get poll to find ID
    const { data: pollData, error: pollError } = await client.getWordcloudPollData(pagePath, pollIndex);

    if (pollError || !pollData) {
      throw new Error('Wordcloud poll not found');
    }

    // Submit word
    const { error: submitError } = await client.submitWordcloudVote((pollData as any).id, userId, word.trim());

    if (submitError) {
      throw new Error(`Failed to submit word: ${submitError.message}`);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit word',
    };
  }
}
